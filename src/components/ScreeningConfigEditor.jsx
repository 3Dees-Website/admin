import { Plus, Trash2, Lock } from 'lucide-react';
import {
  OVERALL_KEY, MAX_FIELDS, MAX_LABEL_LENGTH, MAX_SCORE, emptyDraft, keyFromLabel,
} from '../utils/screeningConfig';
import './styles/ScreeningConfigEditor.css';

/**
 * Edits a job's screening configuration draft (see utils/screeningConfig.js):
 * whether the job skips screening (one overall score) or scores candidates on
 * a list of fields, each with a maximum, and an optional pass mark.
 *
 * Superadmin only — JobFormModal doesn't render it for anyone else. `locked`
 * freezes every input: once any candidate on the job has a score the server
 * refuses any change to the configuration, the pass mark included (it is
 * compared as a whole).
 *
 * A configuration, once saved, can't be removed, only changed — so there is no
 * "remove screening" control.
 */
export function ScreeningConfigEditor({ value, onChange, locked = false, checking = false, lockCheckFailed = false }) {
  const disabled = locked || checking;

  if (!value) {
    return (
      <div className="sce-empty">
        <p className="sce-empty-text">
          Screening isn&apos;t set up for this job, so candidates can&apos;t be scored or moved to Screened yet.
        </p>
        <button type="button" className="sce-btn" onClick={() => onChange(emptyDraft())}>
          <Plus size={12} /> Set up screening
        </button>
      </div>
    );
  }

  const totalMax = value.fields.reduce((sum, f) => sum + (Number(f.max) || 0), 0);

  const setField = (index, patch) => {
    const fields = value.fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange({ ...value, fields });
  };

  // The internal name follows the label while the job is still editable (no
  // candidate has scores, so nothing refers to the old name yet).
  const setLabel = (index, label) => {
    const taken = value.fields.filter((_, i) => i !== index).map((f) => f.key);
    setField(index, { label, key: keyFromLabel(label, taken) });
  };

  const addField = () => {
    const taken = value.fields.map((f) => f.key);
    onChange({ ...value, fields: [...value.fields, { key: keyFromLabel('', taken), label: '', max: '' }] });
  };

  const removeField = (index) => {
    onChange({ ...value, fields: value.fields.filter((_, i) => i !== index) });
  };

  const setSkip = (skip) => {
    if (skip) {
      const first = value.fields[0];
      onChange({
        ...value,
        skipScreening: true,
        fields: [{ key: OVERALL_KEY, label: first?.label || 'Overall score', max: first?.max || '100' }],
      });
    } else {
      const first = value.fields[0];
      onChange({
        ...value,
        skipScreening: false,
        fields: [{ key: keyFromLabel(first?.label || ''), label: first?.label || '', max: first?.max || '' }],
      });
    }
  };

  return (
    <div className="sce-wrapper">
      {locked && (
        <div className="sce-locked" role="status">
          <Lock size={14} />
          <span>
            <strong>Locked.</strong> Candidates on this job have already been scored, so the fields, maximum scores,
            pass mark and skip-screening setting can no longer change.
          </span>
        </div>
      )}
      {checking && <p className="sce-note">Checking whether this configuration is locked…</p>}
      {lockCheckFailed && !locked && (
        <p className="sce-note">
          Couldn&apos;t check whether candidates have been scored. The server will refuse a change if they have.
        </p>
      )}

      <label className="sce-toggle">
        <input
          type="checkbox"
          checked={value.skipScreening}
          onChange={(e) => setSkip(e.target.checked)}
          disabled={disabled}
        />
        <span>
          <strong>This job skips screening.</strong>{' '}
          Candidates are given one overall score and go from Pending straight to Screened, without an invitation.
        </span>
      </label>

      <div className="sce-fields">
        <div className="sce-fields-head">
          <span>{value.skipScreening ? 'Overall score' : 'Screening fields'}</span>
          <span className="sce-total">Total of maximums: {totalMax || '—'}</span>
        </div>

        {value.fields.map((field, index) => (
          <div key={index} className="sce-field-row">
            <div className="sce-field-label">
              <input
                type="text"
                className="sce-input"
                value={field.label}
                onChange={(e) => setLabel(index, e.target.value)}
                maxLength={MAX_LABEL_LENGTH}
                placeholder={value.skipScreening ? 'Overall score' : 'e.g. Interview skills'}
                aria-label={`Field ${index + 1} name`}
                disabled={disabled}
              />
            </div>
            <div className="sce-field-max">
              <input
                type="number"
                className="sce-input"
                value={field.max}
                onChange={(e) => setField(index, { max: e.target.value })}
                min={1}
                max={MAX_SCORE}
                step="any"
                placeholder="Max"
                aria-label={`Field ${index + 1} maximum score`}
                disabled={disabled}
              />
            </div>
            {!value.skipScreening && (
              <button
                type="button"
                className="sce-icon-btn"
                onClick={() => removeField(index)}
                disabled={disabled || value.fields.length === 1}
                title={value.fields.length === 1 ? 'A job needs at least one field' : 'Remove field'}
                aria-label={`Remove field ${index + 1}`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}

        {!value.skipScreening && (
          <button
            type="button"
            className="sce-btn"
            onClick={addField}
            disabled={disabled || value.fields.length >= MAX_FIELDS}
          >
            <Plus size={12} /> Add field
          </button>
        )}
      </div>

      <div className="sce-pass">
        <label className="sce-pass-label" htmlFor="sce-pass-mark">Pass mark (optional)</label>
        <input
          id="sce-pass-mark"
          type="number"
          className="sce-input sce-pass-input"
          value={value.passMark}
          onChange={(e) => onChange({ ...value, passMark: e.target.value })}
          min={1}
          step="any"
          placeholder="e.g. 60"
          disabled={disabled}
        />
        <span className="sce-note">
          Shown against each total on the Screened list. Informational only: nothing is blocked below it.
        </span>
      </div>
    </div>
  );
}
