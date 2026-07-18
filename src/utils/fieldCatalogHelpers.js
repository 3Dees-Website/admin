/**
 * Shared derivations over the field catalog ({ sections, fields }) fetched
 * from GET /api/field-catalog. Used by the requirements builder, the
 * read-only requirements summary, and the application detail renderer so
 * the "what's a conditional sub-field / who's its parent" logic exists once.
 */

// Sections with their non-conditional fields, in catalog order. Conditional
// sub-fields (Years/Detail/Proof) are never independently listed — they only
// ever render nested under their parent.
export function groupFieldsBySection(sections, fields) {
  return sections.map((section) => ({
    section,
    fields: fields.filter((f) => f.sectionKey === section.key && !f.conditionalOn),
  }));
}

export function getConditionalSubfieldKeys(fields) {
  return new Set(fields.filter((f) => f.conditionalOn).map((f) => f.key));
}

// Keys of fields that have generated Years/Detail/Proof sub-fields.
export function getExperienceParentKeys(fields) {
  return new Set(fields.filter((f) => f.conditionalOn).map((f) => f.conditionalOn));
}

// The (up to 3) sub-fields generated for a given parent key, in catalog order.
export function getSubfieldsForParent(fields, parentKey) {
  return fields.filter((f) => f.conditionalOn === parentKey);
}
