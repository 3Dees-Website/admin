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

/**
 * Returns a copy of a job's application requirements that satisfies the
 * backend's InvalidRequirements check: every catalog mandatory key is
 * "required", and a non-mandatory declaration field stored as "optional" is
 * "required" (the backend allows only Off or Required for those). Everything
 * else, including keys the catalog no longer lists, is left as it is. A
 * missing or non-object input is treated as {}.
 *
 * Shared by the requirements builder and PortalContext.editJob, so a job
 * saved without opening the form (e.g. a status toggle) is healed the same way.
 */
export function healRequirements(requirements, catalog) {
  const next = requirements && typeof requirements === 'object' && !Array.isArray(requirements)
    ? { ...requirements }
    : {};
  const mandatory = new Set(catalog?.mandatoryKeys || []);
  mandatory.forEach((key) => { next[key] = 'required'; });
  (catalog?.fields || []).forEach((f) => {
    if (f.type === 'declaration' && !mandatory.has(f.key) && next[f.key] === 'optional') {
      next[f.key] = 'required';
    }
  });
  return next;
}
