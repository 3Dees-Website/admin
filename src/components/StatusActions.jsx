import { useState } from 'react';
import { Check } from 'lucide-react';
import { EgiNoteModal } from './EgiNoteModal';
import { getStatusActions } from '../utils/applicationStatus';
import './styles/StatusActions.css';

// Modals for the moves that need input before they can be sent. 'egiNote'
// (Approve) is handled below. Invite and rejection-message modals are added
// here as they are built; until then those buttons are shown disabled.
const INPUT_MODALS = {};

const WAITING_TITLE = 'This needs an invitation or message form that is not in this release yet.';

/**
 * The status buttons of an application drawer, and the modal that goes with
 * them, in one place. The buttons come from the server's allowedTransitions
 * (see getStatusActions).
 *
 * Pages keep their own look by passing their button classes per tone
 * (`buttonClass`) and their own wording (`labels`); tones a page has no class
 * for (Save, Mark as Screened, Reverse rejection) use the .sta- styles.
 *
 * `onTransition(status, input)` does the request and resolves truthy on
 * success; `beforeAction()` (optional) resolves false to stop, e.g. when
 * unsaved notes could not be saved.
 */
export function StatusActions({
  app,
  pipelineV2 = false,
  showLegacyApprove = true,
  approveIcon = false,
  buttonClass = {},
  labels = {},
  beforeAction,
  onTransition,
}) {
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const actions = getStatusActions(app, { pipelineV2, showLegacyApprove });

  const run = async (action, input) => {
    if (busy) return false;
    setBusy(true);
    try {
      if (beforeAction && !(await beforeAction())) return false;
      return Boolean(await onTransition(action.target, input));
    } finally {
      setBusy(false);
    }
  };

  const start = async (action) => {
    if (busy) return;
    if (action.input === 'egiNote' || INPUT_MODALS[action.input]) {
      if (beforeAction && !(await beforeAction())) return;
      setPending(action);
      return;
    }
    await run(action, {});
  };

  const confirm = async (input) => {
    if (!pending) return;
    if (await run(pending, input)) setPending(null);
  };

  if (actions.length === 0) {
    return pipelineV2 ? <span className="sta-none">No actions available right now</span> : null;
  }

  const ExtraModal = pending ? INPUT_MODALS[pending.input] : null;

  return (
    <>
      {actions.map((action) => {
        const waiting = Boolean(action.input) && action.input !== 'egiNote' && !INPUT_MODALS[action.input];
        return (
          <button
            key={action.target}
            type="button"
            className={buttonClass[action.tone] ?? `sta-btn sta-btn--${action.tone}`}
            disabled={busy || waiting}
            title={waiting ? WAITING_TITLE : undefined}
            onClick={() => start(action)}
          >
            {approveIcon && action.tone === 'approve' && <Check size={14} />}
            {labels[action.tone] ?? action.label}
          </button>
        );
      })}

      <EgiNoteModal
        open={pending?.input === 'egiNote'}
        busy={busy}
        description={`Approving ${app.applicantName} sends this note to EGI along with the candidate record.`}
        verificationDocuments={app.verificationDocuments}
        onCancel={() => setPending(null)}
        onConfirm={(egiNote) => confirm({ egiNote })}
      />

      {ExtraModal && (
        <ExtraModal app={app} busy={busy} onCancel={() => setPending(null)} onConfirm={confirm} />
      )}
    </>
  );
}
