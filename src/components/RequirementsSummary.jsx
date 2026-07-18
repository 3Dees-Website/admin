import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { useFieldCatalog } from '../hooks/useFieldCatalog';
import { groupFieldsBySection } from '../utils/fieldCatalogHelpers';
import './styles/RequirementsSummary.css';

/**
 * Read-only view of a job's application_requirements — per-section counts,
 * expandable to the full enabled-field list. Used in SuperadminAllVacancies'
 * job detail drawer.
 */
export function RequirementsSummary({ applicationRequirements }) {
  const { catalog, isLoading } = useFieldCatalog();
  const [expanded, setExpanded] = useState(false);

  const requirements = applicationRequirements || {};

  const sectionGroups = useMemo(
    () => (catalog ? groupFieldsBySection(catalog.sections, catalog.fields) : []),
    [catalog]
  );

  if (isLoading || !catalog) {
    return <div className="rqs-loading">Loading requirements…</div>;
  }

  const summaries = sectionGroups
    .map(({ section, fields }) => {
      const enabled = fields.filter((f) => requirements[f.key]);
      return { section, enabled, total: fields.length };
    })
    .filter((s) => s.enabled.length > 0);

  const totalEnabled = summaries.reduce((sum, s) => sum + s.enabled.length, 0);

  return (
    <div className="rqs-wrapper">
      <button type="button" className="rqs-toggle" onClick={() => setExpanded((v) => !v)}>
        <ChevronDown className={`rqs-chevron${expanded ? ' rqs-chevron--open' : ''}`} size={14} />
        <span>{totalEnabled} field{totalEnabled !== 1 ? 's' : ''} enabled across {summaries.length} section{summaries.length !== 1 ? 's' : ''}</span>
      </button>

      <div className="rqs-counts">
        {summaries.map(({ section, enabled }) => (
          <span key={section.key} className="rqs-count-chip">
            {section.title}: <strong>{enabled.length}</strong>
          </span>
        ))}
        {summaries.length === 0 && (
          <span className="rqs-empty">No fields configured for this vacancy.</span>
        )}
      </div>

      {expanded && (
        <div className="rqs-full-list">
          {summaries.map(({ section, enabled }) => (
            <div key={section.key} className="rqs-section-block">
              <h5 className="rqs-section-title">{section.title}</h5>
              <div className="rqs-field-list">
                {enabled.map((f) => (
                  <div key={f.key} className="rqs-field-row">
                    <span>{f.label}</span>
                    <span className={`rqs-tag rqs-tag--${requirements[f.key]}`}>
                      {requirements[f.key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
