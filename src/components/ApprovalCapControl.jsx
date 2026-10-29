import { useState } from 'react';
import { useJobs } from '../hooks/useJobs';
import { usePermission } from '../hooks/usePermission';
import { useApprovalCap } from '../hooks/useApprovalCap';
import { PERM } from '../utils/permissions';
import { ApprovalCapBadge } from './ApprovalCapBadge';
import './styles/ApprovalCapControl.css';

/**
 * Sets how many candidates may be approved for a job. It has its own request
 * (PUT /jobs/:id/approval-cap), so it saves on its own button and is
 * independent of the vacancy form around it. Needs manage_approval_cap; an
 * empty box means no cap.
 */
export function ApprovalCapControl({ job }) {
  const allowed = usePermission(PERM.MANAGE_APPROVAL_CAP);
  const { setJobApprovalCap } = useJobs();
  const cap = useApprovalCap(job.id, job.approvalCap);

  const [value, setValue] = useState(cap?.max === null || cap?.max === undefined ? '' : String(cap.max));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { tone: 'error' | 'ok', text }

  if (!allowed) return null;

  const trimmed = value.trim();
  const isUnlimited = trimmed === '';
  const parsed = isUnlimited ? null : Number(trimmed);
  const valid = isUnlimited || (Number.isInteger(parsed) && parsed >= 0);
  const unchanged = (cap?.max ?? null) === parsed;
  const belowApproved = valid && parsed !== null && cap && parsed < cap.approved;

  const save = async (next) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await setJobApprovalCap(job.id, next);
    setBusy(false);
    if (result.ok) {
      setValue(next === null ? '' : String(next));
      setMessage({ tone: 'ok', text: next === null ? 'Cap removed. Approvals are unlimited.' : `Cap set to ${next}.` });
    } else {
      setMessage({ tone: 'error', text: result.message });
    }
  };

  return (
    <div className="acc">
      <h3 className="acc-title">Approval Cap</h3>
      <p className="acc-desc">
        The most candidates that can be approved for this vacancy. Leave empty for no limit. Saved on its own,
        separately from the vacancy details above and below.
      </p>
      <div className="acc-current">
        <span>Currently</span>
        <ApprovalCapBadge jobId={job.id} cap={job.approvalCap} />
        {!cap && <span className="acc-unknown">not loaded yet</span>}
      </div>
      <div className="acc-row">
        <label className="acc-label" htmlFor={`acc-input-${job.id}`}>Maximum approved</label>
        <input
          id={`acc-input-${job.id}`}
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          className="acc-input"
          value={value}
          placeholder="Unlimited"
          disabled={busy}
          onChange={(e) => { setValue(e.target.value); setMessage(null); }}
          onKeyDown={(e) => {
            // Enter here must not submit the vacancy form around it.
            if (e.key === 'Enter') {
              e.preventDefault();
              if (valid && !unchanged) save(parsed);
            }
          }}
        />
        <button type="button" className="acc-btn" disabled={busy || !valid || unchanged} onClick={() => save(parsed)}>
          {busy ? 'Saving…' : 'Set cap'}
        </button>
        {cap?.max !== null && cap?.max !== undefined && (
          <button type="button" className="acc-btn acc-btn--ghost" disabled={busy} onClick={() => save(null)}>
            Remove cap
          </button>
        )}
      </div>
      {!valid && <p className="acc-msg acc-msg--error">Enter a whole number, 0 or more, or leave it empty for no cap.</p>}
      {belowApproved && (
        <p className="acc-msg acc-msg--warn">
          {cap.approved} already approved. A lower cap leaves them approved but blocks any further approvals.
        </p>
      )}
      {message && <p className={`acc-msg acc-msg--${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  );
}
