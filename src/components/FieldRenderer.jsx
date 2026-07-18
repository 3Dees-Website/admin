import './styles/FieldRenderer.css';

/**
 * One editable control for one field-catalog field. Never called for
 * type:'file' fields — applicant document uploads are view-only (see
 * ApplicationDetail's Documents panel); only verification documents get an
 * upload control, which has its own dedicated UI.
 */
export function FieldRenderer({ field, value, onChange, allValues = {}, lgasByState = {}, disabled = false }) {
  if (field.type === 'file') return null;

  const commonProps = {
    id: `fr-${field.key}`,
    disabled,
    className: 'fr-input',
  };

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          {...commonProps}
          className="fr-textarea"
          rows={3}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'select': {
      let options = field.options;
      if (field.key === 'lga') {
        const stateValue = allValues.stateOfOrigin;
        const knownLgas = stateValue && lgasByState[stateValue];
        if (!knownLgas || !knownLgas.length) {
          // Falls back to free text when the dependent options aren't available.
          return (
            <input
              {...commonProps}
              type="text"
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
            />
          );
        }
        options = knownLgas;
      }
      return (
        <select
          {...commonProps}
          className="fr-select"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    case 'yesno':
      return (
        <div className="fr-yesno" role="radiogroup" aria-label={field.label}>
          {['Yes', 'No'].map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={value === opt}
              disabled={disabled}
              className={`fr-yesno-btn${value === opt ? ' fr-yesno-btn--active' : ''}`}
              onClick={() => onChange(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      );

    case 'declaration':
      return (
        <label className="fr-checkbox-row">
          <input
            type="checkbox"
            disabled={disabled}
            checked={value === true || value === 'true'}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      );

    case 'date':
      return (
        <input
          {...commonProps}
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'number':
    case 'year':
      return (
        <input
          {...commonProps}
          type="number"
          min={field.validation?.min}
          max={field.validation?.max}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'email':
      return (
        <input
          {...commonProps}
          type="email"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'tel':
      return (
        <input
          {...commonProps}
          type="tel"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    default:
      return (
        <input
          {...commonProps}
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
