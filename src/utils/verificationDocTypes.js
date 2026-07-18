// Matches backend/src/controllers/verificationDocuments.controller.js's
// DOC_TYPE_LABELS exactly — keep in sync if that list changes.
export const VERIFICATION_DOC_TYPES = [
  { value: 'police_check', label: 'Police / Criminal Record Check Report' },
  { value: 'medical_test', label: 'Medical Test Report' },
  { value: 'drug_test', label: 'Drug Test Report' },
  { value: 'reference_check', label: 'Reference Check Report' },
  { value: 'guarantor_form', label: 'Guarantor Form' },
  { value: 'address_verification', label: 'Address Verification Report' },
  { value: 'other', label: 'Other' },
];
