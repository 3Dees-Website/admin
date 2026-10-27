import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { NOTE_MAX_LENGTH } from '../hooks/useNotesTimeline';
import {
  localInputToInviteIso, inviteIsoToLocalInput, offsetLabel, formatInviteWhen,
} from '../utils/inviteDateTime';
import './styles/InviteModal.css';

// The backend's limits (lib/emailTemplates.js), so a form that passes here is
// one the server will accept.
const LIMITS = { body: 5000, venue: 300, phone: 40, instructions: 2000, note: NOTE_MAX_LENGTH };

const BLANK = { mode: 'text', body: '', venue: '', dateTime: '', phone: '', instructions: '', note: '' };

function formFromInvite(invite) {
  if (invite?.mode === 'structured') {
    return {
      ...BLANK,
      mode: 'structured',
      venue: invite.venue || '',
      dateTime: inviteIsoToLocalInput(invite.dateTime),
      phone: invite.phone || '',
      instructions: invite.instructions || '',
    };
  }
  if (invite?.mode === 'text') return { ...BLANK, mode: 'text', body: invite.body || '' };
  return BLANK;
}

function validate(form, showNote) {
  const errors = {};
  const over = (value, max) => value.trim().length > max;
  if (form.mode === 'text') {
    if (!form.body.trim()) errors.body = 'Write the invitation email.';
    else if (over(form.body, LIMITS.body)) errors.body = `Keep it to ${LIMITS.body.toLocaleString()} characters.`;
  } else {
    if (!form.venue.trim()) errors.venue = 'Enter the venue.';
    else if (over(form.venue, LIMITS.venue)) errors.venue = `Keep it to ${LIMITS.venue} characters.`;
    if (!form.dateTime) errors.dateTime = 'Choose the date and time.';
    else if (localInputToInviteIso(form.dateTime) === null) errors.dateTime = 'That is not a valid date and time.';
    if (!form.phone.trim()) errors.phone = 'Enter a contact number.';
    else if (over(form.phone, LIMITS.phone)) errors.phone = `Keep it to ${LIMITS.phone} characters.`;
    if (over(form.instructions, LIMITS.instructions)) errors.instructions = `Keep it to ${LIMITS.instructions.toLocaleString()} characters.`;
  }
  if (showNote && over(form.note, LIMITS.note)) errors.note = `Keep it to ${LIMITS.note.toLocaleString()} characters.`;
  return errors;
}

function buildInvite(form) {
  if (form.mode === 'text') return { mode: 'text', body: form.body.trim() };
  const instructions = form.instructions.trim();
  return {
    mode: 'structured',
    venue: form.venue.trim(),
    dateTime: localInputToInviteIso(form.dateTime),
    phone: form.phone.trim(),
    ...(instructions ? { instructions } : {}),
  };
}

/**
 * The invitation form behind Shortlist, bulk Shortlist and "Update & resend
 * invite". Two ways to write it: the email in your own words, or the details
 * (venue, date and time, contact number, optional instructions) which the
 * system lays out. Optionally an internal note, which goes to the notes
 * timeline and is never sent to the applicant.
 *
 * More than one recipient adds a review step showing how many applicants will
 * be emailed, since sending can't be recalled.
 *
 * onConfirm({ invite, notes }) — `notes` is undefined when left blank.
 */
export function InviteModal({
  open,
  title = 'Shortlist & Send Invitation',
  description,
  confirmLabel = 'Shortlist & Send Invite',
  busy = false,
  initialInvite = null,
  showNote = true,
  recipientCount = 1,
  onCancel,
  onConfirm,
}) {
  const [form, setForm] = useState(() => formFromInvite(initialInvite));
  const [touched, setTouched] = useState(false);
  const [stage, setStage] = useState('edit');

  // Reset whenever the parent opens or closes the modal, so nothing typed
  // carries over to the next applicant. A failed send leaves `open` as it is,
  // so the typed invitation survives for a retry.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setForm(formFromInvite(initialInvite));
    setTouched(false);
    setStage('edit');
  }

  if (!open) return null;

  const errors = validate(form, showNote);
  const hasErrors = Object.keys(errors).length > 0;
  const needsReview = recipientCount > 1;
  const reviewing = needsReview && stage === 'confirm';
  const shown = (key) => (touched ? errors[key] : undefined);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = () => {
    setTouched(true);
    if (hasErrors) return;
    if (needsReview && stage === 'edit') {
      setStage('confirm');
      return;
    }
    const notes = showNote && form.note.trim() ? form.note.trim() : undefined;
    onConfirm({ invite: buildInvite(form), notes });
  };

  const handleClose = () => {
    if (!busy) onCancel();
  };

  const invite = hasErrors ? null : buildInvite(form);
  const plural = recipientCount !== 1 ? 's' : '';

  return (
    <div className="ivm-overlay">
      <div className="ivm-backdrop" onClick={handleClose} />
      <div className="ivm-modal" role="dialog" aria-modal="true" aria-labelledby="ivm-title">
        <div className="ivm-header">
          <div>
            <h3 id="ivm-title" className="ivm-title">{title}</h3>
            {description && <p className="ivm-subtitle">{description}</p>}
          </div>
          <button type="button" onClick={handleClose} className="ivm-close-btn" disabled={busy} aria-label="Close">
            <X className="ivm-close-icon" />
          </button>
        </div>

        {reviewing ? (
          <div className="ivm-body">
            <p className="ivm-review-count">
              {recipientCount} applicant{plural} will each be emailed this invitation as soon as you send.
            </p>
            <p className="ivm-hint">Emails can&apos;t be recalled once they are queued.</p>
            <div className="ivm-review-card">
              {invite.mode === 'text' ? (
                <p className="ivm-review-text">{invite.body}</p>
              ) : (
                <dl className="ivm-review-list">
                  <dt>Venue</dt><dd>{invite.venue}</dd>
                  <dt>Date and time</dt><dd>{formatInviteWhen(invite.dateTime)}</dd>
                  <dt>Contact number</dt><dd>{invite.phone}</dd>
                  {invite.instructions && (<><dt>Instructions</dt><dd className="ivm-review-text">{invite.instructions}</dd></>)}
                </dl>
              )}
            </div>
            {showNote && (
              <p className="ivm-hint">
                {form.note.trim()
                  ? 'The internal note will be added to each applicant’s notes timeline.'
                  : 'No internal note.'}
              </p>
            )}
          </div>
        ) : (
          <div className="ivm-body">
            <div className="ivm-modes" role="radiogroup" aria-label="How to write the invitation">
              {[['text', 'Write the email'], ['structured', 'Fill in the details']].map(([value, label]) => (
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

            {form.mode === 'text' ? (
              <Field label="Invitation email" required error={shown('body')} counter={[form.body.trim().length, LIMITS.body]}>
                <textarea
                  className={`ivm-input ivm-textarea${shown('body') ? ' ivm-input--error' : ''}`}
                  rows={7}
                  value={form.body}
                  onChange={set('body')}
                  placeholder="Tell the applicant where to go, when, who to ask for and what to bring."
                  disabled={busy}
                  autoFocus
                />
              </Field>
            ) : (
              <>
                <Field label="Venue" required error={shown('venue')}>
                  <input className={`ivm-input${shown('venue') ? ' ivm-input--error' : ''}`} type="text" value={form.venue}
                    onChange={set('venue')} maxLength={LIMITS.venue} disabled={busy} autoFocus
                    placeholder="e.g. 3DEES office, 12 Allen Avenue, Ikeja" />
                </Field>
                <div className="ivm-row">
                  <Field label="Date and time" required error={shown('dateTime')}
                    hint={`Your browser's time zone (GMT${offsetLabel()}). The applicant's email shows Nigerian time (WAT).`}>
                    <input className={`ivm-input${shown('dateTime') ? ' ivm-input--error' : ''}`} type="datetime-local"
                      value={form.dateTime} onChange={set('dateTime')} disabled={busy} />
                  </Field>
                  <Field label="Contact number" required error={shown('phone')}>
                    <input className={`ivm-input${shown('phone') ? ' ivm-input--error' : ''}`} type="tel" value={form.phone}
                      onChange={set('phone')} maxLength={LIMITS.phone} disabled={busy} placeholder="e.g. 0801 234 5678" />
                  </Field>
                </div>
                <Field label="Instructions" optional error={shown('instructions')} counter={[form.instructions.trim().length, LIMITS.instructions]}>
                  <textarea className={`ivm-input ivm-textarea${shown('instructions') ? ' ivm-input--error' : ''}`} rows={3}
                    value={form.instructions} onChange={set('instructions')} disabled={busy}
                    placeholder="What to bring, dress code, who to ask for…" />
                </Field>
              </>
            )}

            {showNote && (
              <Field label="Internal note" optional error={shown('note')}
                hint="Added to the notes timeline at the Shortlisted stage. Visible to admins only; never sent to the applicant.">
                <textarea className={`ivm-input ivm-textarea${shown('note') ? ' ivm-input--error' : ''}`} rows={2}
                  value={form.note} onChange={set('note')} disabled={busy} />
              </Field>
            )}
          </div>
        )}

        <div className="ivm-footer">
          {reviewing ? (
            <button type="button" onClick={() => setStage('edit')} className="ivm-cancel-btn" disabled={busy}>Back</button>
          ) : (
            <button type="button" onClick={handleClose} className="ivm-cancel-btn" disabled={busy}>Cancel</button>
          )}
          <button type="button" onClick={handleSubmit} className="ivm-confirm-btn" disabled={busy}>
            <Send className="ivm-btn-icon" />
            <span>
              {busy
                ? 'Sending…'
                : reviewing
                  ? `Send to ${recipientCount} applicant${plural}`
                  : needsReview ? 'Review & send…' : confirmLabel}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Label, input, then error-or-hint and an optional counter. Also used by RejectModal. */
export function Field({ label, required, optional, error, hint, counter, children }) {
  const [length, max] = counter || [];
  return (
    <div className="ivm-field">
      <label className="ivm-label">
        {label}{' '}
        {required && <span className="ivm-required">*</span>}
        {optional && <span className="ivm-optional">(optional)</span>}
      </label>
      {children}
      <div className="ivm-meta-row">
        {error ? <span className="ivm-error-text">{error}</span> : hint ? <span className="ivm-hint">{hint}</span> : <span />}
        {counter && (
          <span className={`ivm-counter${length > max ? ' ivm-counter--over' : ''}`}>
            {length.toLocaleString()} / {max.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

/** The modal as StatusActions uses it: shortlisting one applicant. */
export function ShortlistInviteModal({ app, busy, onCancel, onConfirm }) {
  return (
    <InviteModal
      open
      busy={busy}
      description={`${app.applicantName} (${app.applicantEmail || 'no email on record'}) is emailed this invitation as soon as you shortlist them.`}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
