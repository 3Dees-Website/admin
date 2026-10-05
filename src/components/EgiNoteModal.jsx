import { useState } from 'react';
import { X, Send } from 'lucide-react';
import './styles/EgiNoteModal.css';

/**
 * Confirmation modal collecting the required "note to EGI" before an
 * Approved transition. EGI's backend rejects Approve requests with
 * 400 MissingField if egiNote is empty, so this is a hard gate, not
 * a nicety.
 *
 * The backend also rejects notes over EGI_NOTE_MAX_LENGTH with 400
 * ValidationError. It measures String(egiNote).length on the value it
 * receives, and this modal sends `trimmed`, so the counter measures
 * `trimmed.length` — the exact string that goes over the wire.
 */
const EGI_NOTE_MAX_LENGTH = 5000;

export function EgiNoteModal({
  open,
  title = 'Approve & Notify EGI',
  description,
  confirmLabel = 'Approve & Sync',
  busy = false,
  // A redelivery's note is optional (blank resends the original note); every
  // other use keeps the defaults, so the Approve flow is unchanged.
  noteRequired = true,
  placeholder = 'e.g. Approved — strong fit for the Osun cohort.',
  hint = "This note is sent to EGI along with the candidate record. It's separate from internal admin notes.",
  verificationDocuments,
  onCancel,
  onConfirm,
}) {
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);

  // Clear the note whenever the parent opens or closes the modal, so a note
  // can never carry over to the next applicant (some parents share one
  // instance across rows). A failed confirm leaves `open` unchanged, so the
  // typed note survives for a retry.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setNote('');
    setTouched(false);
  }

  if (!open) return null;

  const trimmed = note.trim();
  const isEmpty = trimmed.length === 0;
  const overBy = trimmed.length - EGI_NOTE_MAX_LENGTH;
  const isTooLong = overBy > 0;

  const handleConfirm = () => {
    if (noteRequired && isEmpty) {
      setTouched(true);
      return;
    }
    if (isTooLong) return;
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
            Note to EGI {noteRequired
              ? <span className="enm-required">*</span>
              : <span className="enm-optional">(optional)</span>}
          </label>
          <textarea
            className={`enm-textarea${(noteRequired && touched && isEmpty) || isTooLong ? ' enm-textarea--error' : ''}`}
            rows={4}
            value={note}
            onChange={(e) => { setNote(e.target.value); if (touched) setTouched(false); }}
            placeholder={placeholder}
            autoFocus
            disabled={busy}
          />
          <div className="enm-counter-row">
            {noteRequired && touched && isEmpty && (
              <span className="enm-error-text">A note to EGI is required before approving.</span>
            )}
            {isTooLong && (
              <span className="enm-error-text">
                Note is {overBy.toLocaleString()} character{overBy !== 1 ? 's' : ''} over the {EGI_NOTE_MAX_LENGTH.toLocaleString()} limit. Shorten it before approving.
              </span>
            )}
            <span className={`enm-counter${isTooLong ? ' enm-counter--over' : ''}`}>
              {trimmed.length.toLocaleString()} / {EGI_NOTE_MAX_LENGTH.toLocaleString()}
            </span>
          </div>
          <p className="enm-hint">{hint}</p>
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
