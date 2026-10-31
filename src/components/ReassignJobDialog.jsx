import { useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { useJobs } from '../hooks/useJobs';

/**
 * Confirm dialog for moving an application to another job (superadmin only).
 * The picker lists every job except Drafts and the current one; the server
 * enforces the real rules. `onConfirm(jobId)` is called with the chosen job.
 */
export function ReassignJobDialog({ app, busy, onCancel, onConfirm }) {
  const { jobs, jobsStatus, reloadJobs } = useJobs();
  const [jobId, setJobId] = useState('');

  // The cached list may predate jobs created or changed since login.
  useEffect(() => {
    reloadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = jobs.filter((j) => j.status !== 'Draft' && j.id !== app.jobId);
  const loading = jobsStatus === 'loading';
  const failed = jobsStatus === 'error';

  return (
    <div className="ad-delete-overlay">
      <div className="ad-delete-backdrop" onClick={busy ? undefined : onCancel} />
      <div className="ad-delete-modal" role="dialog" aria-modal="true" aria-labelledby="ad-reassign-title">
        <ArrowRightLeft className="ad-reassign-icon" />
        <h3 className="ad-delete-title" id="ad-reassign-title">Change Job</h3>
        <p className="ad-delete-desc">
          Move <strong>{app.applicantName}</strong>&apos;s application from{' '}
          <strong>{app.jobTitle || 'its current job'}</strong> to another job.
        </p>
        <p className="ad-delete-desc">
          Screening scores and the application status are kept as they are, even if they no longer
          match the new job&apos;s requirements.
        </p>
        <label className="ad-reassign-label" htmlFor="ad-reassign-job">New job</label>
        <select
          id="ad-reassign-job"
          className="ad-reassign-select"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          disabled={busy || loading || failed}
        >
          <option value="">{loading ? 'Loading jobs…' : 'Select a job…'}</option>
          {options.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title} ({j.clientOrg}){j.status !== 'Active' ? ` · ${j.status}` : ''}
            </option>
          ))}
        </select>
        {failed && <p className="ad-delete-error" role="alert">Could not load the list of jobs.</p>}
        <div className="ad-delete-actions">
          <button type="button" onClick={onCancel} className="ad-delete-cancel-btn" disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(jobId)}
            className="ad-reassign-confirm-btn"
            disabled={busy || !jobId}
          >
            {busy ? 'Moving…' : 'Move Application'}
          </button>
        </div>
      </div>
    </div>
  );
}
