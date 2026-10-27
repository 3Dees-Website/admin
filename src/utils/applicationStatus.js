/**
 * The one place the dashboard knows how to NAME and COLOUR an applicant status,
 * an EGI decision or an EGI sync state. Presentation only.
 *
 * It deliberately holds no workflow rules. Which status an application may
 * move to comes from the server on every application (`allowedTransitions`,
 * see getAllowedTransitions below), so there is no edge table here to drift
 * from backend/src/utils/applicationWorkflow.js.
 *
 * Keys are the backend's values. `Archived` is shown to people as "Saved".
 *
 * A value this file does not know is never quietly shown as something else:
 * it renders as an explicit "Unknown" entry and is logged once.
 */

export const STATUS_META = {
  Pending:     { label: 'Pending',     tone: 'pending' },
  Shortlisted: { label: 'Shortlisted', tone: 'shortlisted' },
  Screened:    { label: 'Screened',    tone: 'screened' },
  Approved:    { label: 'Approved',    tone: 'approved' },
  Rejected:    { label: 'Rejected',    tone: 'rejected' },
  Archived:    { label: 'Saved',       tone: 'saved' },
};

// Filter order. The first four are all a pre-pipeline backend knows about;
// Screened and Archived only exist (and only return rows) once pipelineV2 is on.
const LEGACY_STATUS_ORDER = ['Pending', 'Shortlisted', 'Approved', 'Rejected'];
const PIPELINE_STATUS_ORDER = ['Pending', 'Shortlisted', 'Screened', 'Approved', 'Rejected', 'Archived'];

export const EGI_DECISION_META = {
  Pending:  { label: 'Awaiting EGI',    tone: 'gray' },
  Accepted: { label: 'Accepted by EGI', tone: 'green' },
  Declined: { label: 'Declined by EGI', tone: 'red' },
  Saved:    { label: 'Saved by EGI',    tone: 'slate' },
};

export const EGI_SYNC_META = {
  Pending: { label: 'Not sent',        tone: 'gray' },
  Queued:  { label: 'Sending…',        tone: 'blue' },
  Synced:  { label: 'Sent',            tone: 'green' },
  Failed:  { label: 'Delivery failed', tone: 'red' },
};

const warned = new Set();

export function unknownMeta(kind, value) {
  const key = `${kind}:${value}`;
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(`[applicationStatus] Unrecognised ${kind} ${JSON.stringify(value)} — shown as "Unknown". Add it to utils/applicationStatus.js.`);
  }
  const shown = value === undefined || value === null || value === '' ? '' : String(value);
  return { label: shown ? `Unknown: ${shown}` : 'Unknown', tone: 'unknown', known: false };
}

function resolve(table, kind, value) {
  const entry = Object.hasOwn(table, value ?? '') ? table[value] : null;
  return entry ? { ...entry, known: true } : unknownMeta(kind, value);
}

export const getStatusMeta = (status) => resolve(STATUS_META, 'application status', status);
export const getStatusLabel = (status) => getStatusMeta(status).label;

// The backend's column default is Pending, so a missing value is Pending —
// stated here once, rather than left to an `|| Pending` at each call site.
export const getEgiDecisionMeta = (decision) =>
  resolve(EGI_DECISION_META, 'EGI decision', decision ?? 'Pending');
export const getEgiSyncMeta = (status) =>
  resolve(EGI_SYNC_META, 'EGI sync status', status ?? 'Pending');

const toOptions = (keys, meta) => keys.map((value) => ({ value, label: meta[value].label }));

/** <option>s for a status filter. `pipelineV2` comes from currentUser. */
export const statusFilterOptions = ({ pipelineV2 = false } = {}) =>
  toOptions(pipelineV2 ? PIPELINE_STATUS_ORDER : LEGACY_STATUS_ORDER, STATUS_META);

export const egiDecisionFilterOptions = ({ pipelineV2 = false } = {}) =>
  toOptions(pipelineV2 ? ['Pending', 'Accepted', 'Declined', 'Saved'] : ['Pending', 'Accepted', 'Declined'], EGI_DECISION_META);

export const egiSyncFilterOptions = () => toOptions(Object.keys(EGI_SYNC_META), EGI_SYNC_META);

/**
 * The statuses the server says this user may move this application to right
 * now (already filtered by role, can_approve and the application's state).
 * `null` means the server did not say (a backend without the pipeline), which
 * is different from `[]` ("nothing is allowed"): callers decide what null means.
 */
export const getAllowedTransitions = (app) =>
  Array.isArray(app?.allowedTransitions) ? app.allowedTransitions : null;

export const canMoveTo = (app, status) => getAllowedTransitions(app)?.includes(status) === true;

// ── Status actions (buttons) ────────────────────────────────────────────────
// Which buttons exist comes from the server (allowedTransitions); this only
// decides how they look and in what order. The server's array order is not
// stable, so buttons follow ACTION_ORDER: destructive on the left, the
// forward move on the right.
//
// `input` is the extra thing a move needs before it can be sent. An entry in
// allowedTransitions means "allowed now", not "needs nothing".
const ACTION_ORDER = ['Rejected', 'Archived', 'Shortlisted', 'Screened', 'Approved'];

const ACTION_META = {
  Rejected:    { tone: 'reject',    label: 'Reject',           input: 'rejection' },
  Archived:    { tone: 'save',      label: 'Save for later',   input: null },
  Shortlisted: { tone: 'shortlist', label: 'Shortlist',        input: 'invite' },
  Screened:    { tone: 'screen',    label: 'Mark as Screened', input: null },
  Approved:    { tone: 'approve',   label: 'Approve & Sync',   input: 'egiNote' },
};

/**
 * The buttons to show for one application: [{ target, tone, label, input }].
 *
 * With a pipeline backend the server's allowedTransitions decides. Without
 * one (null — a backend before the pipeline), the original three buttons are
 * kept so nothing changes while the flag is off. With the pipeline on but no
 * list on this object, nothing is offered rather than guessing.
 */
export function getStatusActions(app, { pipelineV2 = false, showLegacyApprove = true } = {}) {
  const allowed = getAllowedTransitions(app);

  if (allowed === null) {
    if (pipelineV2) return [];
    return ['Rejected', 'Shortlisted', 'Approved']
      .filter((target) => target !== 'Approved' || showLegacyApprove)
      .map((target) => ({
        target,
        ...ACTION_META[target],
        input: target === 'Approved' ? 'egiNote' : null,
      }));
  }

  allowed.forEach((target) => {
    if (!ACTION_META[target]) unknownMeta('allowed transition', target);
  });

  return ACTION_ORDER.filter((target) => allowed.includes(target)).map((target) => {
    // Rejected -> Shortlisted is the superadmin's reversal: no invite needed.
    const reversal = target === 'Shortlisted' && app.status === 'Rejected';
    return reversal
      ? { target, ...ACTION_META[target], label: 'Reverse rejection', input: null }
      : { target, ...ACTION_META[target] };
  });
}
