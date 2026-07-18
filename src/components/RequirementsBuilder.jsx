import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import { useFieldCatalog } from '../hooks/useFieldCatalog';
import { groupFieldsBySection, getExperienceParentKeys } from '../utils/fieldCatalogHelpers';
import './styles/RequirementsBuilder.css';

const STATES = ['off', 'optional', 'required'];

/**
 * Catalog-driven job requirements builder: { [fieldKey]: "required"|"optional" }.
 * Mandatory core keys (mandatoryKeys from the catalog) always render locked
 * to "Required" and are force-merged into every onChange emission, so an
 * invalid config (per the backend's InvalidRequirements check) is
 * structurally unreachable from this UI.
 */
export function RequirementsBuilder({ value, onChange }) {
  const { catalog, isLoading } = useFieldCatalog();
  const [openSections, setOpenSections] = useState(() => new Set());

  const mandatorySet = useMemo(
    () => new Set(catalog?.mandatoryKeys || []),
    [catalog]
  );

  const experienceParents = useMemo(
    () => (catalog ? getExperienceParentKeys(catalog.fields) : new Set()),
    [catalog]
  );

  const sectionGroups = useMemo(
    () => (catalog ? groupFieldsBySection(catalog.sections, catalog.fields) : []),
    [catalog]
  );

  const withMandatory = (obj) => {
    const next = { ...obj };
    mandatorySet.forEach((key) => { next[key] = 'required'; });
    return next;
  };

  // Self-heal on catalog load: a cold `{}` (new job) or a config saved
  // before a mandatory key existed must still end up satisfying the
  // backend's InvalidRequirements check without requiring user interaction.
  useEffect(() => {
    if (!catalog) return;
    const missing = catalog.mandatoryKeys.some((key) => value[key] !== 'required');
    if (missing) onChange(withMandatory(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  if (isLoading || !catalog) {
    return <div className="rqb-loading">Loading field catalog…</div>;
  }

  const setField = (key, state) => {
    const next = withMandatory(value);
    if (state === 'off') {
      delete next[key];
    } else {
      next[key] = state;
    }
    onChange(withMandatory(next));
  };

  const setSectionAll = (fields, state) => {
    const next = withMandatory(value);
    fields.forEach((f) => {
      if (mandatorySet.has(f.key)) return;
      if (state === 'off') delete next[f.key];
      else next[f.key] = state;
    });
    onChange(withMandatory(next));
  };

  const toggleSection = (key) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="rqb-wrapper">
      {sectionGroups.map(({ section, fields }) => {
        if (fields.length === 0) return null;
        const isOpen = openSections.has(section.key);
        const enabledCount = fields.filter((f) => mandatorySet.has(f.key) || value[f.key]).length;

        return (
          <div key={section.key} className="rqb-section">
            <button
              type="button"
              className="rqb-section-header"
              onClick={() => toggleSection(section.key)}
              aria-expanded={isOpen}
            >
              <ChevronDown className={`rqb-chevron${isOpen ? ' rqb-chevron--open' : ''}`} size={16} />
              <span className="rqb-section-title">{section.title}</span>
              <span className="rqb-count-chip">{enabledCount} of {fields.length} enabled</span>
            </button>

            {isOpen && (
              <div className="rqb-section-body">
                <div className="rqb-bulk-actions">
                  <button type="button" onClick={() => setSectionAll(fields, 'required')} className="rqb-bulk-btn">
                    All required
                  </button>
                  <button type="button" onClick={() => setSectionAll(fields, 'optional')} className="rqb-bulk-btn">
                    All optional
                  </button>
                  <button type="button" onClick={() => setSectionAll(fields, 'off')} className="rqb-bulk-btn">
                    All off
                  </button>
                </div>

                <div className="rqb-rows">
                  {fields.map((field) => {
                    const isMandatory = mandatorySet.has(field.key);
                    const currentState = isMandatory ? 'required' : (value[field.key] || 'off');
                    const hasSubfields = experienceParents.has(field.key);

                    return (
                      <div key={field.key} className="rqb-row">
                        <div className="rqb-row-label-block">
                          <span className="rqb-row-label">{field.label}</span>
                          {hasSubfields && (
                            <span className="rqb-row-hint">
                              "Yes" reveals optional years/detail/proof inputs
                            </span>
                          )}
                          {isMandatory && (
                            <span className="rqb-row-hint">Always required on every job</span>
                          )}
                        </div>

                        {isMandatory ? (
                          <span className="rqb-locked-pill">
                            <Lock size={11} />
                            Required
                          </span>
                        ) : (
                          <div className="rqb-tristate" role="radiogroup" aria-label={field.label}>
                            {STATES.map((state) => (
                              <button
                                key={state}
                                type="button"
                                role="radio"
                                aria-checked={currentState === state}
                                className={`rqb-tristate-btn rqb-tristate-btn--${state}${currentState === state ? ' rqb-tristate-btn--active' : ''}`}
                                onClick={() => setField(field.key, state)}
                              >
                                {state === 'off' ? 'Off' : state === 'optional' ? 'Optional' : 'Required'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
