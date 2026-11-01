import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

// Whole seconds left until `iso`, ticking once a second, or 0 once it passes
// (or when there is no usable time). It only drives what is shown: reaching 0
// re-enables Delete, and the server decides again on the click.
function useSecondsUntil(iso) {
  const target = iso ? new Date(iso).getTime() : NaN;
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (Number.isNaN(target)) return undefined;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= target) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [target]);

  return Number.isNaN(target) ? 0 : Math.max(0, Math.ceil((target - now) / 1000));
}

const formatCountdown = (total) => {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h && `${h}h`, (h || m) && `${m}m`, `${s}s`].filter(Boolean).join(' ');
};

/**
 * Confirm dialog for permanently deleting an application. It stays open on a
 * refusal and shows the server's reason (like the job delete dialog).
 * `refusal` is { error, message, deletableAt? } from the last attempt.
 *
 * - NotDeletableYet: a live countdown to `deletableAt`; Delete is disabled
 *   until it ends. Then the countdown goes and Delete works again — a click
 *   asks the server, which is the real check.
 * - NotDeletable / DeliveryInFlight: Delete stays disabled with the reason.
 *
 * Delete also stays disabled until the exact phrase "Delete {applicantName}"
 * is typed (case-sensitive, untrimmed).
 */
export function DeleteApplicationDialog({ app, busy, refusal, onCancel, onConfirm }) {
  const seconds = useSecondsUntil(refusal?.error === 'NotDeletableYet' ? refusal.deletableAt : null);
  const counting = refusal?.error === 'NotDeletableYet' && seconds > 0;
  const blocked = counting || refusal?.error === 'NotDeletable' || refusal?.error === 'DeliveryInFlight';
  // Once the wait is over the old message no longer applies.
  const showReason = refusal && !(refusal.error === 'NotDeletableYet' && !counting);
  // The dialog is mounted only while open, so this starts empty on every open.
  const [typed, setTyped] = useState('');
  const phrase = `Delete ${app.applicantName}`;
  const confirmed = typed === phrase;

  return (
    <div className="ad-delete-overlay">
      <div className="ad-delete-backdrop" onClick={busy ? undefined : onCancel} />
      <div className="ad-delete-modal">
        <ShieldAlert className="ad-delete-icon" />
        <h3 className="ad-delete-title">Delete Application</h3>
        <p className="ad-delete-desc">
          This permanently deletes <strong>{app.applicantName}</strong>&apos;s application, all uploaded
          documents, and verification records. This cannot be undone.
        </p>
        <label className="ad-delete-confirm-label" htmlFor="ad-delete-confirm-input">
          To confirm, type <strong>{phrase}</strong> below.
        </label>
        <input
          id="ad-delete-confirm-input"
          type="text"
          className="ad-delete-confirm-input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {showReason && <p className="ad-delete-error" role="alert">{refusal.message}</p>}
        {counting && (
          <p className="ad-delete-countdown" aria-live="off">
            Can be deleted in <strong>{formatCountdown(seconds)}</strong>
          </p>
        )}
        <div className="ad-delete-actions">
          <button type="button" onClick={onCancel} className="ad-delete-cancel-btn" disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="ad-delete-confirm-btn"
            disabled={busy || blocked || !confirmed}
            title={blocked ? refusal.message : undefined}
          >
            {busy ? 'Deleting…' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
