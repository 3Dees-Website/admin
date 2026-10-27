import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { Field } from './InviteModal';
import { NOTE_MAX_LENGTH } from '../hooks/useNotesTimeline';
import { REJECTION_TEMPLATES, DEFAULT_REJECTION_TEMPLATE } from '../utils/rejectionTemplates';
import './styles/InviteModal.css';
import './styles/RejectModal.css';

// Same limits as the backend (lib/emailTemplates.js).
const MESSAGE_MAX = 5000;

const BLANK = { mode: 'template', template: DEFAULT_REJECTION_TEMPLATE, message: '', note: '' };

function validate(form) {
  const errors = {};
  if (form.mode === 'message') {
    const message = form.message.trim();
    if (!message) errors.message = 'Write the message the applicant will receive.';
    else if (message.length > MESSAGE_MAX) errors.message = `Keep it to ${MESSAGE_MAX.toLocaleString()} characters.`;
  }
  if (form.note.trim().length > NOTE_MAX_LENGTH) errors.note = `Keep it to ${NOTE_MAX_LENGTH.toLocaleString()} characters.`;
  return errors;
}

const buildRejection = (form) =>
  form.mode === 'template' ? { template: form.template } : { message: form.message.trim() };

/**
 * The message form behind Reject and bulk Reject. A rejection always tells the
 * applicant why in their own inbox: either the drafted "standard" message or
 * the admin's own words. Optionally an internal note, which goes to the notes
 * timeline at the Rejected stage and is never sent to the applicant.
 *
 * More than one recipient adds a review step showing how many applicants will
 * be emailed, since sending can't be recalled.
 *
 * onConfirm({ rejection, notes }) — `notes` is undefined when left blank.
 * Shares its shell styles with InviteModal.
 */
export function RejectModal({
  open,
  title = 'Reject & Notify Applicant',
  description,
  confirmLabel = 'Reject & Send Message',
  busy = false,
  recipientCount = 1,
  onCancel,
  onConfirm,
}) {
  const [form, setForm] = useState(BLANK);
  const [touched, setTouched] = useState(false);
  const [stage, setStage] = useState('edit');

  // Reset whenever the parent opens or closes the modal, so nothing typed
  // carries over to the next applicant. A failed send leaves `open` as it is,
  // so the typed message survives for a retry.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setForm(BLANK);
    setTouched(false);
    setStage('edit');
  }

  if (!open) return null;

  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;
  const needsReview = recipientCount > 1;
  const reviewing = needsReview && stage === 'confirm';
  const shown = (key) => (touched ? errors[key] : undefined);
  const plural = recipientCount !== 1 ? 's' : '';
  const sentText = form.mode === 'template' ? REJECTION_TEMPLATES[form.template].text : form.message.trim();

  const handleSubmit = () => {
    setTouched(true);
    if (hasErrors) return;
    if (needsReview && stage === 'edit') {
      setStage('confirm');
      return;
    }
    onConfirm({ rejection: buildRejection(form), notes: form.note.trim() || undefined });
  };

  const handleClose = () => {
    if (!busy) onCancel();
  };

  return (
    <div className="ivm-overlay">
      <div className="ivm-backdrop" onClick={handleClose} />
      <div className="ivm-modal" role="dialog" aria-modal="true" aria-labelledby="rjm-title">
        <div className="ivm-header">
          <div>
            <h3 id="rjm-title" className="ivm-title">{title}</h3>
            {description && <p className="ivm-subtitle">{description}</p>}
          </div>
          <button type="button" onClick={handleClose} className="ivm-close-btn" disabled={busy} aria-label="Close">
            <X className="ivm-close-icon" />
          </button>
        </div>

        {reviewing ? (
          <div className="ivm-body">
            <p className="ivm-review-count">
              {recipientCount} applicant{plural} will each be emailed this message as soon as you send.
            </p>
            <p className="ivm-hint">Emails can&apos;t be recalled once they are queued.</p>
            <div className="ivm-review-card">
              <p className="ivm-review-text">{sentText}</p>
            </div>
            <p className="ivm-hint">
              {form.note.trim()
                ? 'The internal note will be added to each applicant’s notes timeline.'
                : 'No internal note.'}
            </p>
          </div>
        ) : (
          <div className="ivm-body">
            <div className="ivm-modes" role="radiogroup" aria-label="How to write the message">
              {[['template', 'Use the standard message'], ['message', 'Write my own']].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={form.mode === value}
                  className={`ivm-mode-btn${form.mode === value ? ' ivm-mode-btn--active' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, mode: value }))}
                  disabled={busy}
                >
                  {label}
                </button>
              ))}
            </div>

            {form.mode === 'template' ? (
              <div className="ivm-field">
                <span className="ivm-label">Message the applicant will receive</span>
                <p className="rjm-template-text">{REJECTION_TEMPLATES[form.template].text}</p>
                <span className="ivm-hint">It is sent after a greeting that names the position they applied for.</span>
              </div>
            ) : (
              <Field label="Message to the applicant" required error={shown('message')} counter={[form.message.trim().length, MESSAGE_MAX]}>
                <textarea
                  className={`ivm-input ivm-textarea${shown('message') ? ' ivm-input--error' : ''}`}
                  rows={6}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Tell the applicant, kindly and clearly, that they won't be taken further."
                  disabled={busy}
                  autoFocus
                />
              </Field>
            )}

            <Field label="Internal note" optional error={shown('note')}
              hint="Added to the notes timeline at the Rejected stage. Visible to admins only; never sent to the applicant.">
              <textarea
                className={`ivm-input ivm-textarea${shown('note') ? ' ivm-input--error' : ''}`}
                rows={2}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                disabled={busy}
              />
            </Field>
          </div>
        )}

        <div className="ivm-footer">
          {reviewing ? (
            <button type="button" onClick={() => setStage('edit')} className="ivm-cancel-btn" disabled={busy}>Back</button>
          ) : (
            <button type="button" onClick={handleClose} className="ivm-cancel-btn" disabled={busy}>Cancel</button>
          )}
          <button type="button" onClick={handleSubmit} className="ivm-confirm-btn rjm-confirm-btn" disabled={busy}>
            <Send className="ivm-btn-icon" />
            <span>
              {busy
                ? 'Sending…'
                : reviewing
                  ? `Reject ${recipientCount} applicant${plural}`
                  : needsReview ? 'Review & send…' : confirmLabel}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** The modal as StatusActions uses it: rejecting one applicant. */
export function RejectApplicationModal({ app, busy, onCancel, onConfirm }) {
  return (
    <RejectModal
      open
      busy={busy}
      description={`${app.applicantName} (${app.applicantEmail || 'no email on record'}) is emailed this message as soon as you reject them.`}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
