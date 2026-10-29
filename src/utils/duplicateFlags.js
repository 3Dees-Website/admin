// The server's duplicateFlags on an application:
// { sameJob: { count, matches: [{ id, referenceId, status, submittedAt }] },
//   alreadyAccepted: { count, matches: [{ id, referenceId, jobId, jobTitle, decidedAt }] } }

function normalizeGroup(raw) {
  const matches = Array.isArray(raw?.matches) ? raw.matches : [];
  // count is the server's own total; matches may be shorter if it trims them.
  const count = Number.isFinite(Number(raw?.count)) ? Number(raw.count) : matches.length;
  return { count, matches };
}

/**
 * undefined = the response didn't carry the field ("not loaded"), which is
 * different from a row that has no duplicates (both counts 0). Mutation
 * responses are the ones that omit it; see keepDuplicateFlags.
 */
export function normalizeDuplicateFlags(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  return {
    sameJob: normalizeGroup(raw.sameJob),
    alreadyAccepted: normalizeGroup(raw.alreadyAccepted),
  };
}

/**
 * Only the three GET endpoints send duplicateFlags; the PATCH/POST responses
 * that replace an open row don't. Carry the previous value over so the flags
 * don't vanish from the drawer after an action.
 */
export function keepDuplicateFlags(updated, previous) {
  if (!updated || updated.duplicateFlags !== undefined) return updated;
  return { ...updated, duplicateFlags: previous?.duplicateFlags };
}

export const hasDuplicateFlags = (flags) =>
  Boolean(flags && (flags.sameJob.count > 0 || flags.alreadyAccepted.count > 0));

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '');

/** Plain-text list of a group's matches, for a native title= tooltip. */
export function describeMatches(group, kind) {
  const lines = group.matches.map((m) => (kind === 'alreadyAccepted'
    ? `${m.referenceId} · ${m.jobTitle || 'Deleted Position'}${m.decidedAt ? ` · accepted ${formatDate(m.decidedAt)}` : ''}`
    : `${m.referenceId} · ${m.status}${m.submittedAt ? ` · ${formatDate(m.submittedAt)}` : ''}`));
  if (group.count > group.matches.length) lines.push(`+ ${group.count - group.matches.length} more`);
  return lines.join('\n');
}
