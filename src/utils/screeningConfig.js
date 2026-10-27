// Helpers for a job's screening configuration: { skipScreening, fields:
// [{ key, label, max }], passMark? }. The rules mirror the backend's validator
// (backend/src/utils/screeningConfig.js) so a form that passes here is one the
// server accepts; the server stays the authority.
//
// The form edits a *draft*, where numbers are kept as typed (strings) so a
// half-typed "7." isn't lost:
//   { skipScreening, fields: [{ key, label, max: string }], passMark: string }

export const OVERALL_KEY = 'overall';
export const MAX_FIELDS = 20;
export const MAX_LABEL_LENGTH = 100;
export const MAX_SCORE = 1000;
const KEY_PATTERN = /^[a-z][a-zA-Z0-9]{0,39}$/;

export function draftFromConfig(config) {
  if (!config) return null;
  return {
    skipScreening: config.skipScreening === true,
    fields: config.fields.map((f) => ({ key: f.key, label: f.label, max: String(f.max) })),
    passMark: config.passMark === null || config.passMark === undefined ? '' : String(config.passMark),
  };
}

export function emptyDraft() {
  return { skipScreening: false, fields: [{ key: 'skill1', label: '', max: '' }], passMark: '' };
}

/** A key from a label: "Interview skills" -> "interviewSkills", unique among `taken`. */
export function keyFromLabel(label, taken = []) {
  const words = String(label).toLowerCase().match(/[a-z0-9]+/g) || [];
  let base = words.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join('');
  if (!/^[a-z]/.test(base)) base = `f${base}`;
  base = base.slice(0, 36);
  if (base === 'f') base = 'field';
  let key = base;
  for (let n = 2; taken.includes(key); n += 1) key = `${base}${n}`;
  return key;
}

const num = (value) => (String(value).trim() === '' ? NaN : Number(value));

/** The first problem with a draft, in words, or null when it is valid. */
export function validateDraft(draft) {
  if (!draft) return null;
  const { fields } = draft;
  if (fields.length === 0) return 'Add at least one screening field.';
  if (fields.length > MAX_FIELDS) return `A job can have at most ${MAX_FIELDS} screening fields.`;
  const seen = new Set();
  for (const [i, f] of fields.entries()) {
    const n = i + 1;
    if (!KEY_PATTERN.test(f.key)) return `Field ${n}: the name needs letters or digits.`;
    if (seen.has(f.key)) return `Field ${n}: "${f.label}" produces the same internal name as another field. Reword one of them.`;
    seen.add(f.key);
    const label = f.label.trim();
    if (!label) return `Field ${n}: enter a name.`;
    if (label.length > MAX_LABEL_LENGTH) return `Field ${n}: keep the name to ${MAX_LABEL_LENGTH} characters.`;
    const max = num(f.max);
    if (!Number.isFinite(max) || max <= 0 || max > MAX_SCORE) return `Field ${n} (${label}): the maximum score must be above 0 and at most ${MAX_SCORE}.`;
  }
  if (draft.skipScreening && (fields.length !== 1 || fields[0].key !== OVERALL_KEY)) {
    return 'A job that skips screening has exactly one overall score.';
  }
  if (String(draft.passMark).trim() !== '') {
    const pass = num(draft.passMark);
    const totalMax = fields.reduce((sum, f) => sum + num(f.max), 0);
    if (!Number.isFinite(pass) || pass <= 0 || pass > totalMax) {
      return `The pass mark must be above 0 and at most the total of all maximum scores (${totalMax}).`;
    }
  }
  return null;
}

/** The request body value for `screeningConfig`. Call only on a valid draft. */
export function payloadFromDraft(draft) {
  const payload = {
    skipScreening: draft.skipScreening,
    fields: draft.fields.map((f) => ({ key: f.key, label: f.label.trim(), max: num(f.max) })),
  };
  if (String(draft.passMark).trim() !== '') payload.passMark = num(draft.passMark);
  return payload;
}
