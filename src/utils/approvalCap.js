/**
 * Per-job approval cap, as the API reports it: { approved, max, full, overCap }.
 * max is null when the job is uncapped. All of it is display-only; the server
 * enforces the real cap.
 *
 * The cap shows up in many different responses (jobs, stats, screened list,
 * application detail, approve/resend/bulk replies, a 409 JobFull). Each service
 * normalizer feeds what it sees into the small store below, so every screen
 * showing a job's count reads the newest figure received, and a refused approve
 * corrects the Screened list without a reload.
 */

const toNumber = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** The API's approvalCap object as { approved, max, full, overCap }, or null if absent. */
export function normalizeApprovalCap(cap) {
  if (!cap || typeof cap !== 'object') return null;
  const approved = toNumber(cap.approved) ?? 0;
  const max = toNumber(cap.max);
  return {
    approved,
    max,
    // Derived when the server omits them, per the documented rules.
    full: typeof cap.full === 'boolean' ? cap.full : max !== null && approved >= max,
    overCap: typeof cap.overCap === 'boolean' ? cap.overCap : max !== null && approved > max,
  };
}

const sameCap = (a, b) =>
  a && b && a.approved === b.approved && a.max === b.max && a.full === b.full && a.overCap === b.overCap;

let state = { caps: {}, jobByApp: {} };
const listeners = new Set();

const emit = () => listeners.forEach((l) => l());

/** Record a job's cap. Returns the normalized cap (null if `cap` was empty). */
export function recordApprovalCap(jobId, cap) {
  const next = normalizeApprovalCap(cap);
  if (!next || jobId === undefined || jobId === null) return next;
  const key = String(jobId);
  if (sameCap(state.caps[key], next)) return state.caps[key];
  state = { ...state, caps: { ...state.caps, [key]: next } };
  emit();
  return next;
}

/** Record a { [jobId]: approvalCap } map (screened list, bulk responses). */
export function recordApprovalCaps(map) {
  if (!map || typeof map !== 'object') return;
  Object.entries(map).forEach(([jobId, cap]) => recordApprovalCap(jobId, cap));
}

/** Remember which job an application belongs to, so an error that names only the application can still be mapped. */
export function registerApplicationJob(appId, jobId) {
  if (appId === undefined || appId === null || jobId === undefined || jobId === null) return;
  if (state.jobByApp[String(appId)] === jobId) return;
  state = { ...state, jobByApp: { ...state.jobByApp, [String(appId)]: jobId } };
}

/**
 * Pull the cap out of a failed request (the 409 JobFull body) and record it.
 * The body's exact shape isn't pinned down, so top level and `data` are both
 * read, and the job comes from the body or, failing that, the application.
 */
export function recordApprovalCapFromError(err, appId) {
  const cap = err?.approvalCap ?? err?.data?.approvalCap;
  if (!cap) return;
  const jobId = err?.jobId ?? err?.data?.jobId ?? state.jobByApp[String(appId)];
  recordApprovalCap(jobId, cap);
}

export function getApprovalCap(jobId) {
  return state.caps[String(jobId)] ?? null;
}

export function subscribeApprovalCaps(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearApprovalCaps() {
  state = { caps: {}, jobByApp: {} };
  emit();
}

/** "Approved: 3 of 5", or "Approved: 3" when the job is uncapped. */
export function formatApprovalCap(cap) {
  if (!cap) return null;
  return cap.max === null ? `Approved: ${cap.approved}` : `Approved: ${cap.approved} of ${cap.max}`;
}

/** Why Approve is unavailable for this job, or null when it is not. */
export function approvalCapBlockReason(cap) {
  if (!cap?.full) return null;
  return cap.overCap
    ? `Approval cap exceeded (${cap.approved} approved, cap ${cap.max}). No more can be approved for this job.`
    : `Approval cap reached (${cap.approved} of ${cap.max} approved). No more can be approved for this job.`;
}
