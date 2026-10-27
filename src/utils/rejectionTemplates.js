// The drafted rejection messages the backend knows, keyed by the name sent as
// `rejection.template`. "standard" is the only one and there is no endpoint
// that lists them, so the wording is copied here to show it before sending.
// It must match REJECTION_TEMPLATES in backend/src/lib/emailTemplates.js: the
// backend sends its own text, so a mismatch makes the preview wrong, not the
// email.
export const REJECTION_TEMPLATES = {
  standard: {
    label: 'Standard message',
    text: 'Thank you for the time and effort you put into your application. After careful consideration, '
      + 'we regret to inform you that we will not be taking it further on this occasion. '
      + 'We encourage you to apply for future opportunities that match your experience, and we wish you every success.',
  },
};

export const DEFAULT_REJECTION_TEMPLATE = 'standard';
