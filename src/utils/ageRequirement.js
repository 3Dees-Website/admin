/**
 * A job's optional age requirement: { minAge, maxAge }. minAge alone means
 * "at least this old"; with maxAge it is an inclusive range. A bare maxAge is
 * never valid. The server enforces all of it; these rules only mirror it so the
 * forms can answer before a request is made.
 */

export const SITE_MIN_AGE = 18;
export const MAX_JOB_AGE = 120;

const toAge = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** API/service value (number, numeric string or empty) as a number or null. */
export const normalizeAge = toAge;

/**
 * Check the raw text of the two inputs. Returns { value: { minAge, maxAge } }
 * with numbers or nulls, or { error } with a message fit to show the user.
 */
export function parseAgeInputs(minText, maxText) {
  const minTrim = String(minText ?? '').trim();
  const maxTrim = String(maxText ?? '').trim();
  const min = minTrim === '' ? null : Number(minTrim);
  const max = maxTrim === '' ? null : Number(maxTrim);

  if (min !== null && !Number.isInteger(min)) return { error: 'Minimum age must be a whole number.' };
  if (max !== null && !Number.isInteger(max)) return { error: 'Maximum age must be a whole number.' };
  if (min !== null && min < SITE_MIN_AGE) return { error: `Minimum age can't be below ${SITE_MIN_AGE}.` };
  if (min !== null && min > MAX_JOB_AGE) return { error: `Minimum age can't be more than ${MAX_JOB_AGE}.` };
  if (max !== null && min === null) return { error: 'Set a minimum age before a maximum age.' };
  if (max !== null && max > MAX_JOB_AGE) return { error: `Maximum age can't be more than ${MAX_JOB_AGE}.` };
  if (max !== null && max < min) return { error: "Maximum age can't be lower than the minimum age." };
  return { value: { minAge: min, maxAge: max } };
}

/**
 * "21+" / "21–35" / "21" (compact), or "21 and over" / "21–35 years" /
 * "21 years" (long). null when there is no requirement.
 */
export function formatAgeRequirement(minAge, maxAge, { long = false } = {}) {
  const min = toAge(minAge);
  const max = toAge(maxAge);
  if (min === null) return null;
  if (max === null) return long ? `${min} and over` : `${min}+`;
  if (max === min) return long ? `${min} years` : String(min);
  return long ? `${min}–${max} years` : `${min}–${max}`;
}
