/**
 * Client-side helpers for the Enroll Applicant wizard, ported from the public
 * site's fieldCatalogHelpers.js (the two repos share no code). They mirror the
 * backend's field catalog and submission validator. The backend stays
 * authoritative: this only drives the wizard and gives friendly per-field
 * errors before a round trip.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE = /^[0-9+\s]+$/;

export const deriveFullName = ({ firstName, middleName, lastName } = {}) =>
  [firstName, middleName, lastName].filter(Boolean).join(' ').trim();

export const deriveAge = (dateOfBirthISO) => {
  if (!dateOfBirthISO) return null;
  const dob = new Date(dateOfBirthISO);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
};

export const isEmptyValue = (v) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * Sections the wizard renders as steps, in catalog order: a section is
 * "enabled" if at least one of its non-conditional fields is in the job's
 * application requirements.
 */
export const getEnabledSections = (catalog, applicationRequirements) => {
  if (!catalog || !applicationRequirements) return [];
  return catalog.sections.filter((section) =>
    catalog.fields.some(
      (f) => f.sectionKey === section.key && !f.conditionalOn && applicationRequirements[f.key]
    )
  );
};

/**
 * Fields to render for one section step, in catalog order. Experience-trio
 * sub-fields are visible only once their parent is enabled for the job AND
 * answered "Yes".
 */
export const getVisibleSectionFields = (catalog, sectionKey, applicationRequirements, answers) => {
  if (!catalog) return [];
  const reqs = applicationRequirements || {};
  return catalog.fields.filter((f) => {
    if (f.sectionKey !== sectionKey) return false;
    if (f.conditionalOn) return Boolean(reqs[f.conditionalOn]) && answers[f.conditionalOn] === 'Yes';
    return Boolean(reqs[f.key]);
  });
};

// Sub-fields (Years / Detail / Proof) generated for an experience-trio parent.
export const getSubfieldsOf = (catalog, parentKey) =>
  catalog ? catalog.fields.filter((f) => f.conditionalOn === parentKey) : [];

export const getRequirement = (field, applicationRequirements) => {
  if (field.conditionalOn) return 'optional';
  return applicationRequirements?.[field.key];
};

/** Format-validate one field's current value; returns an error string or null. */
export const validateFieldValue = (field, rawValue) => {
  const v = field.validation || {};
  switch (field.type) {
    case 'text':
    case 'textarea': {
      const value = String(rawValue);
      if (v.minLength && value.length < v.minLength) return `${field.label} must be at least ${v.minLength} characters.`;
      if (v.maxLength && value.length > v.maxLength) return `${field.label} must be at most ${v.maxLength} characters.`;
      return null;
    }
    case 'email':
      if (!EMAIL_RE.test(String(rawValue))) return `${field.label} must be a valid email address.`;
      return null;
    case 'tel': {
      const value = String(rawValue);
      if (!TEL_RE.test(value)) return `${field.label} must contain only digits, "+" and spaces.`;
      if (value.length < v.minLength || value.length > v.maxLength) return `${field.label} must be ${v.minLength}-${v.maxLength} characters.`;
      return null;
    }
    case 'date': {
      const date = new Date(rawValue);
      if (Number.isNaN(date.getTime())) return `${field.label} must be a valid date.`;
      if (v.mustBePast && date >= new Date()) return `${field.label} must be in the past.`;
      if (v.minAge && deriveAge(rawValue) < v.minAge) return `${field.label} implies an age of at least ${v.minAge}.`;
      if (v.mustBeTodayOrFuture) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date < today) return `${field.label} must be today or later.`;
      }
      return null;
    }
    case 'number': {
      const value = Number(rawValue);
      if (Number.isNaN(value)) return `${field.label} must be a number.`;
      if (v.min !== undefined && value < v.min) return `${field.label} must be at least ${v.min}.`;
      if (v.max !== undefined && value > v.max) return `${field.label} must be at most ${v.max}.`;
      return null;
    }
    case 'year': {
      const value = Number(rawValue);
      if (!Number.isInteger(value)) return `${field.label} must be a valid year.`;
      if (value < v.min || value > v.max) return `${field.label} must be between ${v.min} and ${v.max}.`;
      return null;
    }
    case 'select':
      if (!field.options?.includes(String(rawValue))) return `${field.label} must be one of the allowed options.`;
      return null;
    case 'yesno':
      if (rawValue !== 'Yes' && rawValue !== 'No') return `${field.label} must be "Yes" or "No".`;
      return null;
    default:
      return null;
  }
};

export const validateFile = (field, file) => {
  const v = field.validation || {};
  if (v.mimeTypes && !v.mimeTypes.includes(file.type)) {
    return `Invalid format. Expected: ${v.mimeTypes.join(', ')}`;
  }
  if (v.maxSizeBytes && file.size > v.maxSizeBytes) {
    return `File exceeds ${(v.maxSizeBytes / (1024 * 1024)).toFixed(0)}MB limit.`;
  }
  return null;
};

/** Validate every visible field of one wizard step. Returns { [key]: error }. */
export const validateSectionFields = (fields, applicationRequirements, answers, files) => {
  const errors = {};
  fields.forEach((field) => {
    const requirement = getRequirement(field, applicationRequirements);

    if (field.type === 'file') {
      const has = field.multiple ? (files[field.key]?.length > 0) : Boolean(files[field.key]);
      if (requirement === 'required' && !has) errors[field.key] = `${field.label} is required.`;
      return;
    }

    if (field.type === 'declaration') {
      if (requirement === 'required' && answers[field.key] !== true) {
        errors[field.key] = `${field.label} must be accepted.`;
      }
      return;
    }

    const raw = answers[field.key];
    if (isEmptyValue(raw)) {
      if (requirement === 'required') errors[field.key] = `${field.label} is required.`;
      return;
    }

    if (field.key === 'lga') return; // dependent select: any chosen or typed value is valid

    const err = validateFieldValue(field, raw);
    if (err) errors[field.key] = err;
  });
  return errors;
};

/** Human-readable display value for the Review step. */
export const formatAnswerForReview = (field, value) => {
  if (isEmptyValue(value)) return '—';
  if (field.type === 'declaration') return value === true ? 'Accepted' : 'Not accepted';
  return String(value);
};

/**
 * The multipart body for POST /api/admin/applications, the same shape as the
 * public submit: jobId, one flat field per answer key, files under their
 * catalog key (a multi-file field repeats its key). Only fields visible for
 * this job and answers are sent, so answers left over from a previously
 * picked job never reach the server.
 */
export const buildEnrollmentFormData = ({ jobId, catalog, sections, requirements, answers, files }) => {
  const formData = new FormData();
  formData.append('jobId', jobId);
  sections.forEach((section) => {
    getVisibleSectionFields(catalog, section.key, requirements, answers).forEach((f) => {
      if (f.type === 'file') {
        const value = files[f.key];
        if (!value) return;
        (Array.isArray(value) ? value : [value]).forEach((file) => formData.append(f.key, file));
        return;
      }
      const value = answers[f.key];
      if (value === undefined || value === null || value === '') return;
      formData.append(f.key, typeof value === 'boolean' ? String(value) : value);
    });
  });
  return formData;
};

/**
 * Whether a job can take an enrollment, judged only from what the client
 * knows: Active and not past its closing date. A full job (SlotsFull) can
 * only be known by the server, which reports it on submit.
 * Returns null when open, otherwise the reason it can't be chosen.
 */
export const getJobIneligibleReason = (job) => {
  if (job.status !== 'Active') return job.status || 'Not active';
  if (job.isExpired) return 'Closing date passed';
  return null;
};
