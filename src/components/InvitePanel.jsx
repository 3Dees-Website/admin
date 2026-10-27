import { useState } from 'react';
import { Send } from 'lucide-react';
import { useApplications } from '../hooks/useApplications';
import { InviteModal } from './InviteModal';
import { formatInviteWhen } from '../utils/inviteDateTime';
import './styles/InvitePanel.css';

/**
 * The invitation on record for a candidate, and — while they are Shortlisted —
 * "Update & resend invite", which opens the same form pre-filled and emails
 * the applicant the new details. Only shown when the pipeline is on.
 *
 * `onUpdated(app)` receives the changed application.
 */
export function InvitePanel({ app, onUpdated }) {
  const { updateInvite } = useApplications();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const invite = app.inviteDetails;
  const canUpdate = app.status === 'Shortlisted';
  if (!invite && !canUpdate) return null;

  const handleConfirm = async ({ invite: next }) => {
    setBusy(true);
    const updated = await updateInvite(app.id, next);
    setBusy(false);
    if (updated) {
      setOpen(false);
      onUpdated(updated);
    }
  };

  return (
    <section className="ad-section">
      <h3 className="ad-section-title">Invitation</h3>

      {!invite && <p className="ad-empty-hint">No invitation is on record for this candidate.</p>}
      {invite?.mode === 'text' && <p className="ivp-text">{invite.body}</p>}
      {invite?.mode === 'structured' && (
        <dl className="ivp-list">
          <dt>Venue</dt><dd>{invite.venue}</dd>
          <dt>Date and time</dt><dd>{formatInviteWhen(invite.dateTime)}</dd>
          <dt>Contact number</dt><dd>{invite.phone}</dd>
          {invite.instructions && (<><dt>Instructions</dt><dd className="ivp-text">{invite.instructions}</dd></>)}
        </dl>
      )}

      {canUpdate && (
        <button type="button" className="ivp-btn" onClick={() => setOpen(true)}>
          <Send size={12} /> {invite ? 'Update & resend invite' : 'Send invitation'}
        </button>
      )}

      <InviteModal
        open={open}
        busy={busy}
        title={invite ? 'Update & Resend Invitation' : 'Send Invitation'}
        description={`${app.applicantName} (${app.applicantEmail || 'no email on record'}) is emailed the ${invite ? 'updated ' : ''}invitation as soon as you send.`}
        confirmLabel={invite ? 'Update & Resend' : 'Send Invitation'}
        initialInvite={invite}
        showNote={false}
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </section>
  );
}
