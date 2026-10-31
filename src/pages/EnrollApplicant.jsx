/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, UserPlus } from 'lucide-react';
import { useJobs } from '../hooks/useJobs';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useRouteBase } from '../hooks/useRouteBase';
import { useFieldCatalog } from '../hooks/useFieldCatalog';
import { useNavigationGuard } from '../hooks/useNavigationGuard';
import { applicationService } from '../services/applicationService';
import { EnrollmentFieldRenderer } from '../components/EnrollmentFieldRenderer';
import { CandidateEditDrawer } from '../components/CandidateEditDrawer';
import {
  getEnabledSections,
  getVisibleSectionFields,
  validateSectionFields,
  buildEnrollmentFormData,
  getJobIneligibleReason,
  deriveFullName,
  deriveAge,
  isEmptyValue,
  formatAnswerForReview,
} from '../utils/enrollmentValidation';
import './styles/EnrollApplicant.css';

const JOB_STEP_KEY = '__job';
const REVIEW_STEP_KEY = '__review';
const LEAVE_MESSAGE = 'The applicant details you have entered have not been submitted and will be lost.';

// What the backend's job-eligibility rejections mean to the person at the
// keyboard. All of them are about the chosen job, so they send the admin back
// to the vacancy step with their answers intact.
const JOB_REJECTIONS = {
  JobClosed: 'This job is no longer accepting applications. Pick a different job.',
  DeadlinePassed: 'The application deadline for this job has passed. Pick a different job.',
  SlotsFull: 'This job has no slots left. Pick a different job.',
  NotFound: 'This job no longer exists. Pick a different job.',
};

const removeKey = (obj, key) => {
  if (!(key in obj)) return obj;
  const next = { ...obj };
  delete next[key];
  return next;
};

export function EnrollApplicant() {
  const { jobs, jobsStatus, reloadJobs } = useJobs();
  const { catalog, isLoading: isLoadingCatalog } = useFieldCatalog();
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const routeBase = useRouteBase();

  const [jobId, setJobId] = useState('');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null); // { text } — submit-time problems the form can't show inline
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { id, referenceId, enteredBy, devFake? }
  const [openApp, setOpenApp] = useState(null);
  const [isOpening, setIsOpening] = useState(false);
  const submittingRef = useRef(false);
  const cardRef = useRef(null);

  // The cached job list may predate jobs created or changed since login.
  useEffect(() => {
    reloadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const job = useMemo(() => jobs.find((j) => j.id === jobId), [jobs, jobId]);
  const reqs = useMemo(() => job?.applicationRequirements || {}, [job]);
  const enabledSections = useMemo(
    () => (catalog && job ? getEnabledSections(catalog, reqs) : []),
    [catalog, job, reqs]
  );
  const steps = useMemo(
    () => [
      { key: JOB_STEP_KEY, title: 'Vacancy' },
      ...enabledSections,
      { key: REVIEW_STEP_KEY, title: 'Review' },
    ],
    [enabledSections]
  );
  const jobOptions = useMemo(() => jobs.filter((j) => j.status !== 'Draft'), [jobs]);

  const currentStep = steps[Math.min(step, steps.length - 1)];
  const isJobStep = currentStep.key === JOB_STEP_KEY;
  const isReviewStep = currentStep.key === REVIEW_STEP_KEY;

  const hasEntries = Boolean(jobId) || Object.keys(answers).length > 0 || Object.keys(files).length > 0;
  const isDirty = hasEntries && !result;
  useNavigationGuard(isDirty, LEAVE_MESSAGE);

  // Reloading or closing the tab is not covered by the navigation guard.
  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [step]);

  const handleJobChange = (e) => {
    setJobId(e.target.value);
    setBanner(null);
    setErrors({});
  };

  const handleAnswerChange = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => removeKey(prev, key));
  };

  const handleFileChange = (key, file) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
    setErrors((prev) => removeKey(prev, key));
    addToast('success', 'Document Attached', `Attached: ${file.name}`);
  };

  const handleFileAdd = (key, file) => {
    setFiles((prev) => ({ ...prev, [key]: [...(prev[key] || []), file] }));
    setErrors((prev) => removeKey(prev, key));
    addToast('success', 'Document Attached', `Attached: ${file.name}`);
  };

  const handleFileRemoveAt = (key, idx) => {
    setFiles((prev) => {
      if (idx === undefined) return removeKey(prev, key);
      const arr = [...(prev[key] || [])];
      arr.splice(idx, 1);
      return arr.length ? { ...prev, [key]: arr } : removeKey(prev, key);
    });
  };

  // Returns an error string for the vacancy step, or null when it is fine.
  const jobStepError = () => {
    if (!job) return 'Choose the job this applicant is applying for.';
    const reason = getJobIneligibleReason(job);
    return reason ? `This job can't take applications (${reason}). Choose a different job.` : null;
  };

  const validateStep = (idx) => {
    const section = steps[idx];
    if (section.key === REVIEW_STEP_KEY) return true;
    if (section.key === JOB_STEP_KEY) {
      const problem = jobStepError();
      setErrors(problem ? { [JOB_STEP_KEY]: problem } : {});
      return !problem;
    }
    const fields = getVisibleSectionFields(catalog, section.key, reqs, answers);
    const stepErrors = validateSectionFields(fields, reqs, answers, files);
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((p) => p + 1);
    } else {
      addToast('error', 'Validation Failure', 'Please resolve the highlighted details before continuing.');
    }
  };

  const handleBack = () => {
    setErrors({});
    setStep((p) => p - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;

    // Full pass across every step before sending; per-step validation already
    // gates Next, this catches anything left over if the admin went back.
    for (let i = 0; i < steps.length - 1; i++) {
      if (!validateStep(i)) {
        addToast('error', 'Validation Failure', `Please resolve the details in "${steps[i].title}" before submitting.`);
        setStep(i);
        return;
      }
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setBanner(null);
    try {
      const formData = buildEnrollmentFormData({
        jobId: job.id, catalog, sections: enabledSections, requirements: reqs, answers, files,
      });
      const created = await applicationService.enrollApplicant(formData);
      setResult(created);
      addToast('success', 'Applicant Enrolled', `Reference: ${created.referenceId}`);
    } catch (err) {
      const code = err?.error;
      if (JOB_REJECTIONS[code]) {
        setBanner({ text: JOB_REJECTIONS[code] });
        setStep(0);
        reloadJobs();
      } else {
        // ValidationError / MissingField arrive as one joined string, so they
        // are shown whole; anything else (network, timeout, 5xx) keeps the
        // form exactly as it is for another try.
        setBanner({ text: err?.message || 'Could not enroll the applicant. Please try again.' });
      }
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleEnrollAnother = () => {
    setResult(null);
    setOpenApp(null);
    setJobId('');
    setStep(0);
    setAnswers({});
    setFiles({});
    setErrors({});
    setBanner(null);
  };

  const handleOpenApplication = async () => {
    if (isOpening || !result) return;
    setIsOpening(true);
    try {
      setOpenApp(await applicationService.getApplication(result.id));
    } catch (err) {
      addToast('error', 'Could Not Open Application', err?.message || 'The application was created, but its file could not be loaded.');
    } finally {
      setIsOpening(false);
    }
  };

  if (isLoadingCatalog || (jobsStatus === 'loading' && jobs.length === 0)) {
    return <div className="ea-wrapper"><p className="ea-state">Loading the application form…</p></div>;
  }

  if (!catalog) {
    return (
      <div className="ea-wrapper">
        <div className="ea-state-card">
          <h1 className="ea-title">Application form unavailable</h1>
          <p className="ea-subtitle">The form definitions could not be loaded. Check the connection and reload the page.</p>
        </div>
      </div>
    );
  }

  const header = (
    <div className="ea-header-card">
      <span className="ea-page-label">ENROLL APPLICANT</span>
      <h1 className="ea-title">Enroll an Applicant</h1>
      <p className="ea-subtitle">
        Enter an application on an applicant&apos;s behalf. It joins the pending queue like any other
        application and is marked as entered by you.
      </p>
    </div>
  );

  if (result) {
    return (
      <div className="ea-wrapper">
        {header}
        <div className="ea-success">
          <div className="ea-success-icon-wrap"><Check className="ea-success-icon" /></div>
          <h2 className="ea-success-title">Applicant enrolled</h2>
          <p className="ea-success-desc">
            The application is now in the pending queue, entered by {result.enteredBy?.name || currentUser?.name || 'you'}.
          </p>
          <div className="ea-ref-stamp">{result.referenceId}</div>
          {result.devFake && (
            <p className="ea-success-note">Dev build: nothing was sent to the server, so there is no application to open.</p>
          )}
          <div className="ea-success-actions">
            {!result.devFake && (
              <button type="button" className="ea-btn ea-btn--primary" onClick={handleOpenApplication} disabled={isOpening}>
                {isOpening ? 'Opening…' : 'Open application'}
              </button>
            )}
            <button type="button" className="ea-btn ea-btn--secondary" onClick={handleEnrollAnother}>Enroll another</button>
            <Link to={`${routeBase}/pending`} className="ea-btn ea-btn--secondary">Go to pending queue</Link>
          </div>
        </div>

        {openApp && (
          <CandidateEditDrawer
            app={openApp}
            jobTitle={openApp.jobTitle}
            isSuperadmin={currentUser?.role === 'superadmin'}
            currentUser={currentUser}
            onClose={() => setOpenApp(null)}
            onAppUpdated={setOpenApp}
          />
        )}
      </div>
    );
  }

  const renderStepFields = () => {
    const visible = getVisibleSectionFields(catalog, currentStep.key, reqs, answers).filter((f) => !f.conditionalOn);
    const renderField = (field) => (
      <EnrollmentFieldRenderer
        key={field.key}
        field={field}
        required={reqs[field.key] === 'required'}
        answers={answers}
        files={files}
        errors={errors}
        catalog={catalog}
        disabled={isSubmitting}
        onAnswerChange={handleAnswerChange}
        onFileChange={handleFileChange}
        onFileAdd={handleFileAdd}
        onFileRemoveAt={handleFileRemoveAt}
        addToast={addToast}
      />
    );
    const fileFields = visible.filter((f) => f.type === 'file');
    const otherFields = visible.filter((f) => f.type !== 'file');
    return (
      <>
        {otherFields.length > 0 && <div className="ea-fields-grid">{otherFields.map(renderField)}</div>}
        {fileFields.length > 0 && <div className="ea-file-grid">{fileFields.map(renderField)}</div>}
      </>
    );
  };

  return (
    <div className="ea-wrapper" id="enroll-applicant-page">
      {header}

      <div className="ea-steps-bar">
        {steps.map((st, idx) => (
          <div key={st.key} className="ea-step-item">
            <div className={`ea-step-circle ${step >= idx ? 'ea-step-circle--active' : ''}`}>
              {step > idx ? <Check className="ea-step-check" /> : idx + 1}
            </div>
            <span className={`ea-step-label ${step === idx ? 'ea-step-label--active' : ''}`}>{st.title}</span>
          </div>
        ))}
      </div>

      <div className="ea-form-card" ref={cardRef}>
        {banner && (
          <div className="ea-banner" role="alert">
            <AlertCircle className="ea-banner-icon" />
            <span>{banner.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="ea-form">
          <h2 className="ea-step-title">{isReviewStep ? 'Review & Submit' : currentStep.title}</h2>

          {isJobStep && (
            <div className="ea-job-step">
              <label className="ea-job-label" htmlFor="ea-job">Job the applicant is applying for <span className="ea-required">*</span></label>
              <select
                id="ea-job"
                className={`ea-job-select${errors[JOB_STEP_KEY] ? ' ea-job-select--err' : ''}`}
                value={jobId}
                onChange={handleJobChange}
                disabled={isSubmitting || jobsStatus === 'error'}
              >
                <option value="">{jobsStatus === 'loading' ? 'Loading jobs…' : 'Select a job…'}</option>
                {jobOptions.map((j) => {
                  const reason = getJobIneligibleReason(j);
                  return (
                    <option key={j.id} value={j.id} disabled={Boolean(reason)}>
                      {j.title} ({j.clientOrg}){reason ? ` · ${reason}` : ''}
                    </option>
                  );
                })}
              </select>
              {jobsStatus === 'error' && <span className="ea-error-msg" role="alert">Could not load the list of jobs.</span>}
              {errors[JOB_STEP_KEY] && <span className="ea-error-msg" role="alert">{errors[JOB_STEP_KEY]}</span>}
              {job && (
                <div className="ea-job-info">
                  <div><strong>Employment type:</strong> {job.type || '—'}</div>
                  <div><strong>Location:</strong> {job.location || '—'}</div>
                </div>
              )}
              <p className="ea-job-hint">Only active jobs before their closing date can be chosen. A job whose slots are full is refused when you submit.</p>
            </div>
          )}

          {!isJobStep && !isReviewStep && <div className="ea-step-body">{renderStepFields()}</div>}

          {isReviewStep && (
            <div className="ea-review-grid">
              <div className="ea-review-card">
                <h4 className="ea-review-heading">Vacancy</h4>
                <div className="ea-review-rows">
                  <div><strong>Job:</strong> {job?.title} ({job?.clientOrg})</div>
                </div>
              </div>
              {enabledSections.map((section) => {
                const fields = getVisibleSectionFields(catalog, section.key, reqs, answers).filter((f) => f.type !== 'file');
                const answered = fields.filter((f) => f.type === 'declaration' || !isEmptyValue(answers[f.key]));
                const showFullName = section.key === 'personal';
                if (!showFullName && answered.length === 0) return null;
                return (
                  <div key={section.key} className="ea-review-card">
                    <h4 className="ea-review-heading">{section.title}</h4>
                    <div className="ea-review-rows">
                      {showFullName && (
                        <>
                          <div><strong>Full Name:</strong> {deriveFullName(answers) || '—'}</div>
                          {!isEmptyValue(answers.dateOfBirth) && (
                            <div><strong>Age:</strong> {deriveAge(answers.dateOfBirth)} years</div>
                          )}
                        </>
                      )}
                      {answered.map((f) => (
                        <div key={f.key}><strong>{f.label}:</strong> {formatAnswerForReview(f, answers[f.key])}</div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="ea-review-card ea-review-card--full">
                <h4 className="ea-review-heading">Attached Documents</h4>
                <div className="ea-attached-grid">
                  {Object.entries(files).flatMap(([key, val]) => {
                    const field = catalog.fields.find((f) => f.key === key);
                    if (!field || !getVisibleSectionFields(catalog, field.sectionKey, reqs, answers).some((f) => f.key === key)) return [];
                    return (Array.isArray(val) ? val : [val]).map((file, idx) => (
                      <div key={`${key}-${idx}`} className="ea-attached-item">
                        <Check className="ea-attached-check" />
                        <span>{field.label}: {file.name}</span>
                      </div>
                    ));
                  })}
                  {Object.keys(files).length === 0 && <span className="ea-attached-empty">None attached.</span>}
                </div>
              </div>
            </div>
          )}

          <div className="ea-nav-row">
            {step > 0 ? (
              <button type="button" onClick={handleBack} className="ea-btn ea-btn--secondary" disabled={isSubmitting}>
                <ChevronLeft className="ea-nav-icon" /><span>Back</span>
              </button>
            ) : <div />}

            {!isReviewStep ? (
              <button type="button" onClick={handleNext} className="ea-btn ea-btn--primary" disabled={isJobStep && !jobId}>
                <span>Next Step</span><ChevronRight className="ea-nav-icon" />
              </button>
            ) : (
              <button type="submit" className="ea-btn ea-btn--primary" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="ea-nav-icon ea-spin" /><span>Enrolling…</span></>
                ) : (
                  <><UserPlus className="ea-nav-icon" /><span>Enroll Applicant</span></>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
