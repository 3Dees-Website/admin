/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useJobs } from '../hooks/useJobs';
import { useApplications } from '../hooks/useApplications';
import { useToast } from '../hooks/useToast';
import { Plus, Edit2, ToggleLeft, ToggleRight, Trash2, X, ShieldAlert, Check } from 'lucide-react';
import './styles/AdminJobs.css';

const DEFAULT_REQS = {
  cvRequired: true,
  coverLetterRequired: false,
  academicCertRequired: false,
  nyscCertRequired: false,
  passportPhotoRequired: false,
  nationalIdRequired: true,
  dobRequired: false,
  stateOfOriginRequired: false,
  lgaRequired: false,
  yearsOfExpRequired: false,
  currentEmployerRequired: false
};

const DEFAULT_FIELDS = {
  title: '',
  clientOrg: '',
  category: 'Agriculture',
  type: 'Full-time',
  location: '',
  openings: 1,
  salaryRange: '',
  description: '',
  responsibilities: '',
  requirements: '',
  closingDate: '',
  status: 'Active'
};

export function AdminJobs() {
  const { jobs, postJob, editJob, removeJob } = useJobs();
  const { applications } = useApplications();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [formFields, setFormFields] = useState({ ...DEFAULT_FIELDS });
  const [requirementsBuilder, setRequirementsBuilder] = useState({ ...DEFAULT_REQS });

  useEffect(() => {
    if (searchParams.get('create') === 'open') {
      setEditingJob(null);
      setFormFields({ ...DEFAULT_FIELDS });
      setRequirementsBuilder({ ...DEFAULT_REQS });
      setModalOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const resetForm = () => {
    setFormFields({ ...DEFAULT_FIELDS });
    setRequirementsBuilder({ ...DEFAULT_REQS });
  };

  const handleOpenEdit = (job) => {
    setEditingJob(job);
    setFormFields({
      title: job.title,
      clientOrg: job.clientOrg,
      category: job.category,
      type: job.type,
      location: job.location,
      openings: job.openings,
      salaryRange: job.salaryRange || '',
      description: job.description,
      responsibilities: job.responsibilities,
      requirements: job.requirements,
      closingDate: job.closingDate,
      status: job.status
    });
    setRequirementsBuilder({ ...job.applicationRequirements });
    setModalOpen(true);
  };

  const handleSubmitJob = (e) => {
    e.preventDefault();
    if (!formFields.title.trim() || !formFields.clientOrg.trim() || !formFields.location.trim() || !formFields.closingDate) {
      addToast('error', 'Incomplete Fields', 'Please fill out all mandatory starred parameters.');
      return;
    }

    if (editingJob) {
      editJob({ ...editingJob, ...formFields, applicationRequirements: requirementsBuilder });
      addToast('success', 'Vacancy Updates Recorded', 'Changes saved successfully.');
    } else {
      postJob({ ...formFields, applicationRequirements: requirementsBuilder });
    }

    setModalOpen(false);
    resetForm();
  };

  const handleToggleStatus = (job) => {
    const nextStatus = job.status === 'Active' ? 'Closed' : job.status === 'Closed' ? 'Draft' : 'Active';
    editJob({ ...job, status: nextStatus });
    addToast('info', 'Status Shifted', `"${job.title}" state toggled to ${nextStatus}.`);
  };

  const handleConfirmDelete = () => {
    if (confirmDeleteId) {
      removeJob(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  const appCounts = useMemo(() => {
    return applications.reduce((acc, app) => {
      acc[app.jobId] = (acc[app.jobId] || 0) + 1;
      return acc;
    }, {});
  }, [applications]);

  const statusClasses = {
    Active: 'aj-status-active',
    Draft:  'aj-status-draft',
    Closed: 'aj-status-closed'
  };

  // Reusable checkbox row for requirements builder
  const ReqCheck = ({ field, label }) => (
    <label className="aj-req-check">
      <input
        type="checkbox"
        checked={requirementsBuilder[field]}
        onChange={(e) => setRequirementsBuilder({ ...requirementsBuilder, [field]: e.target.checked })}
        className="aj-checkbox"
      />
      <span className="aj-req-label">{label}</span>
    </label>
  );

  return (
    <div className="aj-wrapper" id="admin-jobs-wrapper">

      {/* Header */}
      <div className="aj-header-card">
        <div>
          <h1 className="aj-title">Manage Open Vacancies</h1>
          <p className="aj-subtitle">Configure vacancy details and specify mandatory documents for candidates.</p>
        </div>
        <button
          onClick={() => { setEditingJob(null); resetForm(); setModalOpen(true); }}
          className="aj-create-btn"
          id="btn-create-vacancy"
        >
          <Plus className="aj-btn-icon" />
          <span>Create New Job Vacancy</span>
        </button>
      </div>

      {/* Table */}
      <div className="aj-table-card">
        <div className="aj-table-scroll">
          <table className="aj-table">
            <thead>
              <tr className="aj-thead-row">
                <th className="aj-th">Vacancy Title</th>
                <th className="aj-th">Client Org</th>
                <th className="aj-th">Location</th>
                <th className="aj-th aj-th-center">Submissions</th>
                <th className="aj-th aj-th-center">Status</th>
                <th className="aj-th aj-th-right">Operations</th>
              </tr>
            </thead>
            <tbody className="aj-tbody">
              {jobs.map((j) => (
                <tr key={j.id} className="aj-row">
                  <td className="aj-td">
                    <div className="aj-job-info">
                      <span className="aj-job-title">{j.title}</span>
                      <span className="aj-job-meta">{j.category} • {j.type}</span>
                    </div>
                  </td>
                  <td className="aj-td aj-muted">{j.clientOrg}</td>
                  <td className="aj-td aj-muted">{j.location}</td>
                  <td className="aj-td aj-td-center aj-app-count">{appCounts[j.id] || 0}</td>
                  <td className="aj-td aj-td-center">
                    <span className={`aj-status-badge ${statusClasses[j.status]}`}>{j.status}</span>
                  </td>
                  <td className="aj-td aj-td-right">
                    <div className="aj-actions">
                      <button onClick={() => handleToggleStatus(j)} className="aj-toggle-btn" title="Toggle Status">
                        {j.status === 'Active'
                          ? <ToggleRight className="aj-toggle-icon aj-toggle-on" />
                          : <ToggleLeft className="aj-toggle-icon" />}
                        <span>Toggle Status</span>
                      </button>
                      <button onClick={() => handleOpenEdit(j)} className="aj-icon-btn" title="Edit Vacancy">
                        <Edit2 className="aj-icon" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(j.id)} className="aj-icon-btn aj-icon-btn-del" title="Delete Vacancy">
                        <Trash2 className="aj-icon" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="aj-empty-row">
                    No vacancies are currently posted in the local database storage.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="aj-overlay">
          <div className="aj-modal">

            {/* Modal Header */}
            <div className="aj-modal-header">
              <div>
                <h2 className="aj-modal-title">
                  {editingJob ? `Modify Vacancy: ${editingJob.title}` : 'Post A New Job Vacancy'}
                </h2>
                <p className="aj-modal-subtitle">Inputs configuration fields define public listings parameters.</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="aj-modal-close" aria-label="Close form">
                <X className="aj-close-icon" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitJob} className="aj-form">

              {/* Row 1: Basic Info */}
              <div className="aj-fields-grid">
                <div className="aj-field aj-field-wide">
                  <label className="aj-label">Job Title <span className="aj-required">*</span></label>
                  <input type="text" required placeholder="e.g. Agronomist Field Officer"
                    value={formFields.title}
                    onChange={(e) => setFormFields({ ...formFields, title: e.target.value })}
                    className="aj-input" />
                </div>

                <div className="aj-field">
                  <label className="aj-label">Client Organisation <span className="aj-required">*</span></label>
                  <input type="text" required placeholder="e.g. Ogun Premium Holdings"
                    value={formFields.clientOrg}
                    onChange={(e) => setFormFields({ ...formFields, clientOrg: e.target.value })}
                    className="aj-input" />
                </div>

                <div className="aj-field">
                  <label className="aj-label">Category</label>
                  <select value={formFields.category}
                    onChange={(e) => setFormFields({ ...formFields, category: e.target.value })}
                    className="aj-select">
                    <option value="Agriculture">Agriculture Sector</option>
                    <option value="Construction">Construction Sector</option>
                    <option value="Administration">Corporate Administration</option>
                    <option value="Logistics">Logistics & Supply lines</option>
                    <option value="Finance">Finance & Banking</option>
                    <option value="ICT">Information Technology (ICT)</option>
                  </select>
                </div>

                <div className="aj-field">
                  <label className="aj-label">Employment Type</label>
                  <select value={formFields.type}
                    onChange={(e) => setFormFields({ ...formFields, type: e.target.value })}
                    className="aj-select">
                    <option value="Full-time">Full-time Operations</option>
                    <option value="Part-time">Part-time Operations</option>
                    <option value="Contract">Sponsor Contractual (Gig)</option>
                    <option value="Temporary">Temporary Support Placement</option>
                  </select>
                </div>

                <div className="aj-field">
                  <label className="aj-label">Location (State + LGA) <span className="aj-required">*</span></label>
                  <input type="text" required placeholder="e.g. Ogun (Abeokuta North)"
                    value={formFields.location}
                    onChange={(e) => setFormFields({ ...formFields, location: e.target.value })}
                    className="aj-input" />
                </div>

                <div className="aj-field">
                  <label className="aj-label">Capacity Slot Openings</label>
                  <input type="number" required min={1}
                    value={formFields.openings}
                    onChange={(e) => setFormFields({ ...formFields, openings: parseInt(e.target.value) || 1 })}
                    className="aj-input" />
                </div>

                <div className="aj-field">
                  <label className="aj-label">Salary Range (Optional)</label>
                  <input type="text" placeholder="e.g. ₦300k - ₦400k / Month"
                    value={formFields.salaryRange}
                    onChange={(e) => setFormFields({ ...formFields, salaryRange: e.target.value })}
                    className="aj-input" />
                </div>

                <div className="aj-field">
                  <label className="aj-label">Closing Date <span className="aj-required">*</span></label>
                  <input type="date" required
                    value={formFields.closingDate}
                    onChange={(e) => setFormFields({ ...formFields, closingDate: e.target.value })}
                    className="aj-input" />
                </div>
              </div>

              {/* Row 2: Textareas */}
              <div className="aj-textareas-grid">
                <div className="aj-field">
                  <label className="aj-label">Job Description <span className="aj-required">*</span></label>
                  <textarea rows={4} placeholder="Provide overview details and role focus summaries..."
                    value={formFields.description}
                    onChange={(e) => setFormFields({ ...formFields, description: e.target.value })}
                    className="aj-textarea" />
                </div>

                <div className="aj-field">
                  <label className="aj-label">Responsibilities (One per line) <span className="aj-required">*</span></label>
                  <textarea rows={4} placeholder="Oversee field logistics&#10;Monitor fertilizer inventories"
                    value={formFields.responsibilities}
                    onChange={(e) => setFormFields({ ...formFields, responsibilities: e.target.value })}
                    className="aj-textarea" />
                </div>

                <div className="aj-field">
                  <label className="aj-label">Requirements (One per line) <span className="aj-required">*</span></label>
                  <textarea rows={4} placeholder="B.Sc in Crop Science&#10;3+ years experience"
                    value={formFields.requirements}
                    onChange={(e) => setFormFields({ ...formFields, requirements: e.target.value })}
                    className="aj-textarea" />
                </div>
              </div>

              {/* Requirements Builder */}
              <div className="aj-req-builder">
                <h3 className="aj-req-builder-title">Dynamic Application Info Checklist Builder</h3>
                <p className="aj-req-builder-desc">
                  Mark which upload categories and bio fields are mandatory. Unmarked items will be completely hidden from the user intake panel.
                </p>
                <div className="aj-req-grid">
                  <ReqCheck field="cvRequired"              label="CV/Resume Upload" />
                  <ReqCheck field="coverLetterRequired"     label="Cover Letter Upload" />
                  <ReqCheck field="academicCertRequired"    label="Academic Cert Upload" />
                  <ReqCheck field="nyscCertRequired"        label="NYSC Degree Certificate" />
                  <ReqCheck field="passportPhotoRequired"   label="Passport Photograph" />
                  <ReqCheck field="nationalIdRequired"      label="National ID Upload" />
                  <ReqCheck field="dobRequired"             label="Date of Birth (Field)" />
                  <ReqCheck field="stateOfOriginRequired"   label="State of Origin (Field)" />
                  <ReqCheck field="lgaRequired"             label="LGA Address (Field)" />
                  <ReqCheck field="yearsOfExpRequired"      label="Experience Years (Field)" />
                  <ReqCheck field="currentEmployerRequired" label="Current Employer (Field)" />
                </div>
              </div>

              {/* Footer: Status + Buttons */}
              <div className="aj-form-footer">
                <div className="aj-status-row">
                  <label className="aj-label">Save Vacancy State</label>
                  <select value={formFields.status}
                    onChange={(e) => setFormFields({ ...formFields, status: e.target.value })}
                    className="aj-select aj-status-select">
                    <option value="Active">Publish Now (Active)</option>
                    <option value="Draft">Draft Mode (Hidden)</option>
                    <option value="Closed">Archive (Closed)</option>
                  </select>
                </div>

                <div className="aj-form-actions">
                  <button type="button" onClick={() => setModalOpen(false)} className="aj-cancel-btn">
                    Cancel
                  </button>
                  <button type="submit" className="aj-submit-btn">
                    <Check className="aj-check-icon" />
                    <span>{editingJob ? 'Save Vacancy Changes' : 'Publish Open Position'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDeleteId && (
        <div className="aj-overlay">
          <div className="aj-delete-modal">
            <div className="aj-delete-body">
              <ShieldAlert className="aj-danger-icon" />
              <div>
                <h3 className="aj-delete-title">Confirm Destructive Deletion</h3>
                <p className="aj-delete-desc">
                  This operation is permanent. It clears the open vacancy from all local registries. Applicants files remain unaffected but disconnected.
                </p>
              </div>
            </div>
            <div className="aj-delete-footer">
              <button onClick={() => setConfirmDeleteId(null)} className="aj-cancel-btn">
                Retain Job
              </button>
              <button onClick={handleConfirmDelete} className="aj-delete-confirm-btn">
                Delete Job Vacancy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}