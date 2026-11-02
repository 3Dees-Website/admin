import { useState } from 'react';
import { useJobs } from '../hooks/useJobs';
import { parseAgeInputs, formatAgeRequirement } from '../utils/ageRequirement';
import './styles/ApprovalCapControl.css';

const asText = (v) => (v === null || v === undefined ? '' : String(v));

/**
 * Sets the age range an applicant must fall in to apply for a job. It has its
 * own request (PUT /jobs/:id/age-requirement), so it saves on its own button
 * and is independent of the vacancy form around it. A minimum alone means "at
 * least this old"; a maximum needs a minimum; both empty means no requirement.
 * Shares its look with ApprovalCapControl.
 */
export function AgeRequirementControl({ job }) {
  const { setJobAgeRequirement } = useJobs();

  // What the server holds, as far as this form knows. `job` is the row the
  // modal was opened with and does not refresh after a save, so it is tracked here.
  const [saved, setSaved] = useState({ minAge: job.minAge ?? null, maxAge: job.maxAge ?? null });
  const [minText, setMinText] = useState(asText(job.minAge));
  const [maxText, setMaxText] = useState(asText(job.maxAge));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { tone: 'error' | 'ok', text }

  const parsed = parseAgeInputs(minText, maxText);
  const valid = !parsed.error;
  const unchanged = valid && parsed.value.minAge === saved.minAge && parsed.value.maxAge === saved.maxAge;
  const hasSaved = saved.minAge !== null;
  const current = formatAgeRequirement(saved.minAge, saved.maxAge, { long: true });

  const save = async (next) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await setJobAgeRequirement(job.id, next);
    setBusy(false);
    if (result.ok) {
      setSaved(result.ages);
      setMinText(asText(result.ages.minAge));
      setMaxText(asText(result.ages.maxAge));
      const text = formatAgeRequirement(result.ages.minAge, result.ages.maxAge, { long: true });
      setMessage({ tone: 'ok', text: text ? `Age requirement set to ${text}.` : 'Age requirement removed.' });
    } else {
      setMessage({ tone: 'error', text: result.message });
    }
  };

  const onEnter = (e) => {
    // Enter here must not submit the vacancy form around it.
    if (e.key === 'Enter') {
      e.preventDefault();
      if (valid && !unchanged) save(parsed.value);
    }
  };

  return (
    <div className="acc">
      <h3 className="acc-title">Age Requirement</h3>
      <p className="acc-desc">
        Applicants outside this range cannot submit an application for this vacancy. Leave both empty for no
        requirement. Saved on its own, separately from the vacancy details above and below.
      </p>
      <div className="acc-current">
        <span>Currently</span>
        <span>{current ?? 'No age requirement'}</span>
      </div>
      <div className="acc-row">
        <label className="acc-label" htmlFor={`arc-min-${job.id}`}>Minimum age</label>
        <input
          id={`arc-min-${job.id}`}
          type="number"
          min="18"
          step="1"
          inputMode="numeric"
          className="acc-input"
          value={minText}
          placeholder="No minimum"
          disabled={busy}
          onChange={(e) => {
            setMinText(e.target.value);
            if (e.target.value.trim() === '') setMaxText(''); // a maximum can't stand alone
            setMessage(null);
          }}
          onKeyDown={onEnter}
        />
        <label className="acc-label" htmlFor={`arc-max-${job.id}`}>Maximum age</label>
        <input
          id={`arc-max-${job.id}`}
          type="number"
          min="18"
          step="1"
          inputMode="numeric"
          className="acc-input"
          value={maxText}
          placeholder={minText.trim() === '' ? 'Set a minimum first' : 'No maximum'}
          disabled={busy || minText.trim() === ''}
          onChange={(e) => { setMaxText(e.target.value); setMessage(null); }}
          onKeyDown={onEnter}
        />
        <button type="button" className="acc-btn" disabled={busy || !valid || unchanged} onClick={() => save(parsed.value)}>
          {busy ? 'Saving…' : 'Save age requirement'}
        </button>
        {hasSaved && (
          <button
            type="button"
            className="acc-btn acc-btn--ghost"
            disabled={busy}
            onClick={() => save({ minAge: null, maxAge: null })}
          >
            Remove requirement
          </button>
        )}
      </div>
      {parsed.error && <p className="acc-msg acc-msg--error">{parsed.error}</p>}
      {message && <p className={`acc-msg acc-msg--${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  );
}
