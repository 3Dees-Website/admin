import { useState } from 'react';
import { X, Send } from 'lucide-react';
import './styles/EgiNoteModal.css';

/**
 * Confirmation modal collecting the required "note to EGI" before an
 * Approved transition. EGI's backend rejects Approve requests with
 * 400 MissingField if egiNote is empty, so this is a hard gate, not
 * a nicety.
 */
export function EgiNoteModal({
  open,
  title = 'Approve & Notify EGI',
  description,
  confirmLabel = 'Approve & Sync',
  busy = false,
  verificationDocuments,
  onCancel,
  onConfirm,
}) {
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);

  if (!open) return null;

  const trimmed = note.trim();
  const isValid = trimmed.length > 0;

  const handleConfirm = () => {
    if (!isValid) {
      setTouched(true);
      return;
    }
    onConfirm(trimmed);
  };

  const handleClose = () => {
    setNote('');
    setTouched(false);
    onCancel();
  };

  return (
    <div className="enm-overlay">
      <div className="enm-backdrop" onClick={busy ? undefined : handleClose} />
      <div className="enm-modal">
        <div className="enm-header">
          <div>
            <h3 className="enm-title">{title}</h3>
            {description && <p className="enm-subtitle">{description}</p>}
          </div>
          <button onClick={handleClose} className="enm-close-btn" disabled={busy} aria-label="Close">
            <X className="enm-close-icon" />
          </button>
        </div>

        <div className="enm-body">
          <label className="enm-label">
            Note to EGI <span className="enm-required">*</span>
          </label>
          <textarea
            className={`enm-textarea${touched && !isValid ? ' enm-textarea--error' : ''}`}
            rows={4}
            value={note}
            onChange={(e) => { setNote(e.target.value); if (touched) setTouched(false); }}
            placeholder="e.g. Approved — strong fit for the Osun cohort."
            autoFocus
            disabled={busy}
          />
          {touched && !isValid && (
            <span className="enm-error-text">A note to EGI is required before approving.</span>
          )}
          <p className="enm-hint">
            This note is sent to EGI along with the candidate record. It's separate from internal admin notes.
          </p>
          {verificationDocuments !== undefined && (
            <p className="enm-verification-reminder">
              {verificationDocuments.length > 0
                ? `Attached verification documents: ${verificationDocuments.map((d) => d.label).join(', ')}.`
                : 'No verification documents attached yet.'}
            </p>
          )}
        </div>

        <div className="enm-footer">
          <button type="button" onClick={handleClose} className="enm-cancel-btn" disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} className="enm-confirm-btn" disabled={busy}>
            <Send className="enm-btn-icon" />
            <span>{busy ? 'Sending…' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
