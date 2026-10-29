import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, RefreshCw, Save, CheckCheck } from 'lucide-react';
import { useJobs } from '../hooks/useJobs';
import { useAuth } from '../hooks/useAuth';
import { useNavigationGuard } from '../hooks/useNavigationGuard';
import { useToast } from '../hooks/useToast';
import { applicationService } from '../services/applicationService';
import { describeLoadError } from '../utils/describeLoadError';
import { can, PERM } from '../utils/permissions';
import { routeBaseFor } from '../utils/routeBase';
import { StatusBadge } from './StatusBadge';
import { EgiDecisionBadge } from './EgiBadges';
import { TableLoadingRows } from './TableLoadingRows';
import './styles/ScoringWorkspace.css';

// Screening cohorts are small; beyond this the grid isn't offered, rather than
// being slow or silently cut off.
const SOFT_CAP = 300;

const round2 = (n) => Math.round(n * 100) / 100;
const scoreText = (row, key) => (row.screeningScores[key] === undefined ? '' : String(row.screeningScores[key]));

const CORRECTION_NEEDS_PERMISSION = 'Correcting a score after screening takes approval permission.';
const DECLINED_NEEDS_PERMISSION = 'Correcting the scores of an application EGI declined takes special permission.';
const lockReason = (row) => (row.status === 'Approved' ? DECLINED_NEEDS_PERMISSION : CORRECTION_NEEDS_PERMISSION);

/**
 * How a row's scores may be edited, from its status and who is asking.
 *   first   - Shortlisted (or Pending on a skip-screening job): scores can be
 *             entered, changed and cleared, and the candidate can be moved on.
 *   correct - Screened or Saved: a correction. Needs approval permission, and
 *             must stay complete (a score can't be cleared). An Approved
 *             application EGI declined is also a correction, but needs
 *             edit_declined_applications.
 *   locked  - a correction without that permission.
 */
function rowMode(row, canCorrect, canCorrectDeclined) {
  if (row.status === 'Shortlisted' || row.status === 'Pending') return 'first';
  if (row.status === 'Screened' || row.status === 'Archived') return canCorrect ? 'correct' : 'locked';
  if (row.status === 'Approved') return canCorrectDeclined ? 'correct' : 'locked';
  return 'locked';
}

/** One row's cells as typed, parsed and checked against the job's fields. */
function viewRow(row, fields, edits, mode) {
  const cells = {};
  let invalid = false;
  let dirty = false;
  let complete = true;
  let total = 0;
  fields.forEach((field) => {
    const base = scoreText(row, field.key);
    const raw = edits?.[field.key] ?? base;
    const isDirty = raw.trim() !== base;
    const trimmed = raw.trim();
    let value = null;
    let error = null;
    if (trimmed === '') {
      if (isDirty && mode === 'correct') error = 'A score can’t be cleared after screening';
    } else {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) error = 'Not a number';
      else if (n < 0 || n > field.max) error = `Must be 0 to ${field.max}`;
      else value = round2(n);
    }
    if (error) invalid = true;
    if (isDirty) dirty = true;
    if (value === null) complete = false;
    else total += value;
    cells[field.key] = { raw, value, error, dirty: isDirty };
  });
  return { cells, invalid, dirty, complete: complete && !invalid, total: complete && !invalid ? round2(total) : null };
}

function groupReasons(failed) {
  const counts = new Map();
  failed.forEach(({ reason }) => counts.set(reason || 'Unknown error', (counts.get(reason || 'Unknown error') || 0) + 1));
  const groups = [...counts.entries()].map(([reason, n]) => `${reason} (${n})`);
  const extra = groups.length - 3;
  return groups.slice(0, 3).join('; ') + (extra > 0 ? `; +${extra} other reason${extra !== 1 ? 's' : ''}` : '');
}

/**
 * The scoring screen: pick a job, score its candidates in a grid (one row per
 * candidate, one column per screening field). Edits are held locally per cell
 * and sent together with "Save changes"; moving a candidate to Screened is a
 * separate, explicit action once every field is scored.
 *
 * Used by both the admin and superadmin routes. The list is not polled: a
 * refresh would fight with what is being typed.
 */
/** The scoring screen. */
export function ScoringWorkspace() {
  const { jobs, jobsStatus, jobsError, reloadJobs } = useJobs();
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const canCorrect = can(currentUser, PERM.APPROVE_CANDIDATES);
  const canCorrectDeclined = can(currentUser, PERM.EDIT_DECLINED_APPLICATIONS);
  const canConfigureScreening = can(currentUser, PERM.MANAGE_SCREENING_CONFIG);
  const base = routeBaseFor(currentUser);

  const jobId = searchParams.get('job') || '';
  const job = jobs.find((j) => j.id === jobId) || null;
  const config = job?.screeningConfig ?? null;
  const fields = useMemo(() => config?.fields ?? [], [config]);

  // ── Candidates ────────────────────────────────────────────────────────────
  const [loaded, setLoaded] = useState({ key: null, rows: [], total: 0, tooMany: false, error: null });
  const [reloadTick, setReloadTick] = useState(0);
  const loadKey = job && config ? `${job.id}|${reloadTick}` : null;
  const skip = config?.skipScreening === true;

  useEffect(() => {
    if (!loadKey) return undefined;
    let cancelled = false;
    const queries = [
      { status: 'Shortlisted' },
      ...(skip ? [{ status: 'Pending' }] : []),
      { status: 'Screened' },
      { status: 'Archived' },
      // EGI-declined approvals can be corrected with edit_declined_applications.
      ...(canCorrectDeclined ? [{ status: 'Approved', egiDecision: 'Declined' }] : []),
    ];
    applicationService.getScoringCandidates({ jobId, queries, softCap: SOFT_CAP }).then(
      (res) => { if (!cancelled) setLoaded({ key: loadKey, rows: res.items, total: res.total, tooMany: res.tooMany, error: null }); },
      (error) => { if (!cancelled) setLoaded({ key: loadKey, rows: [], total: 0, tooMany: false, error }); },
    );
    return () => { cancelled = true; };
  }, [loadKey, jobId, skip, canCorrectDeclined]);

  const isLoading = Boolean(loadKey) && loaded.key !== loadKey;
  const loadError = !isLoading && loaded.error ? describeLoadError(loaded.error, 'the candidates') : null;
  const rows = useMemo(() => (isLoading || loaded.error || loaded.tooMany ? [] : loaded.rows), [isLoading, loaded]);

  // Applying a save result edits the rows we hold, so they live in state.
  const [overrides, setOverrides] = useState({}); // { [id]: partial row from a save result }
  const viewRows = useMemo(() => rows.map((r) => (overrides[r.id] ? { ...r, ...overrides[r.id] } : r)), [rows, overrides]);

  // ── Local edits ───────────────────────────────────────────────────────────
  const [edits, setEdits] = useState({}); // { [appId]: { [fieldKey]: string } }
  const [rowErrors, setRowErrors] = useState({}); // { [appId]: reason }
  const [busy, setBusy] = useState(null); // null | 'save' | 'finalize'

  const views = useMemo(() => {
    const map = {};
    viewRows.forEach((row) => {
      const mode = rowMode(row, canCorrect, canCorrectDeclined);
      map[row.id] = { mode, ...viewRow(row, fields, edits[row.id], mode) };
    });
    return map;
  }, [viewRows, fields, edits, canCorrect, canCorrectDeclined]);

  const dirtyRows = viewRows.filter((r) => views[r.id].mode !== 'locked' && views[r.id].dirty);
  const readyRows = viewRows.filter((r) => views[r.id].mode === 'first' && views[r.id].complete);
  const hasUnsaved = dirtyRows.length > 0;
  useNavigationGuard(hasUnsaved, 'You have scores that haven’t been saved. If you leave this page they will be lost.');

  useEffect(() => {
    if (!hasUnsaved) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsaved]);

  const resetLocalState = useCallback(() => {
    setEdits({});
    setRowErrors({});
    setOverrides({});
  }, []);

  const handleJobChange = (e) => {
    resetLocalState();
    setSearchParams(e.target.value ? { job: e.target.value } : {});
  };

  const handleReload = () => {
    resetLocalState();
    setReloadTick((t) => t + 1);
  };

  const setCell = (rowId, key, value) => {
    setEdits((prev) => ({ ...prev, [rowId]: { ...prev[rowId], [key]: value } }));
    setRowErrors((prev) => {
      if (!prev[rowId]) return prev;
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  // ── Saving ────────────────────────────────────────────────────────────────
  const tableRef = useRef(null);

  const report = (result, sentCount, noun) => {
    const done = result.success.length;
    if (result.failed.length === 0) {
      addToast('success', noun === 'screen' ? 'Moved to Screened' : 'Scores Saved', `${done} candidate${done !== 1 ? 's' : ''} ${noun === 'screen' ? 'moved to Screened' : 'saved'}.`);
    } else if (done === 0) {
      addToast('error', noun === 'screen' ? 'Not Moved to Screened' : 'Scores Not Saved', `None of the ${sentCount} could be ${noun === 'screen' ? 'moved' : 'saved'} — ${groupReasons(result.failed)}.`);
    } else {
      addToast('warning', 'Partly Saved', `${done} of ${sentCount} ${noun === 'screen' ? 'moved' : 'saved'}. ${result.failed.length} failed and are marked in the grid — ${groupReasons(result.failed)}.`);
    }
  };

  // What came back: successful rows take their new status, scores and totals
  // and drop their edits; failed rows keep their edits and show the reason.
  const applyResult = (result, sentById) => {
    const itemsById = Object.fromEntries(result.items.map((i) => [i.id, i]));
    const okIds = new Set(result.success);
    setOverrides((prev) => {
      const next = { ...prev };
      okIds.forEach((id) => {
        const item = itemsById[id];
        const row = viewRows.find((r) => r.id === id);
        if (!item || !row) return;
        const scores = { ...row.screeningScores };
        Object.entries(sentById[id] || {}).forEach(([key, value]) => {
          if (value === null) delete scores[key];
          else scores[key] = value;
        });
        next[id] = {
          ...(prev[id] || {}),
          status: item.status,
          screeningScores: scores,
          screeningTotal: item.screeningTotal,
          screeningMax: item.screeningMax,
          screeningPercentage: item.screeningPercentage,
        };
      });
      return next;
    });
    setEdits((prev) => {
      const next = { ...prev };
      okIds.forEach((id) => { delete next[id]; });
      return next;
    });
    setRowErrors((prev) => {
      const next = { ...prev };
      okIds.forEach((id) => { delete next[id]; });
      result.failed.forEach(({ id, reason }) => { next[id] = reason; });
      return next;
    });
  };

  // `targets` are rows; `full` sends every field (needed to move a candidate
  // on, since an entry must carry at least one score and all must be present).
  const send = async (targets, { finalize }) => {
    if (busy || targets.length === 0) return;
    const entries = [];
    const sentById = {};
    targets.forEach((row) => {
      const view = views[row.id];
      const scores = {};
      fields.forEach((field) => {
        const cell = view.cells[field.key];
        if (finalize || cell.dirty) scores[field.key] = cell.value;
      });
      sentById[row.id] = scores;
      entries.push({ applicationId: row.id, scores });
    });
    setBusy(finalize ? 'finalize' : 'save');
    const result = await applicationService.saveScores({ jobId, entries, finalize });
    setBusy(null);
    applyResult(result, sentById);
    report(result, entries.length, finalize ? 'screen' : 'save');
  };

  const handleSave = () => {
    const invalid = dirtyRows.filter((r) => views[r.id].invalid);
    if (invalid.length > 0) {
      setRowErrors((prev) => ({ ...prev, ...Object.fromEntries(invalid.map((r) => [r.id, 'Fix the highlighted scores first.'])) }));
      addToast('warning', 'Fix Highlighted Scores', `${invalid.length} candidate${invalid.length !== 1 ? 's have' : ' has'} a score that can’t be saved. The rest were saved.`);
    }
    return send(dirtyRows.filter((r) => !views[r.id].invalid), { finalize: false });
  };

  // ── Keyboard: Enter / arrows move between rows in the same column ────────
  const handleKeyDown = (e, rowIndex, colIndex) => {
    const move = { Enter: e.shiftKey ? -1 : 1, ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!move) return;
    e.preventDefault();
    tableRef.current?.querySelector(`[data-cell="${rowIndex + move}:${colIndex}"]`)?.focus();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const jobPicker = (
    <div className="scw-picker">
      <label className="scw-picker-label" htmlFor="scw-job">Vacancy</label>
      <select id="scw-job" className="scw-select" value={jobId} onChange={handleJobChange} disabled={hasUnsaved || busy !== null}>
        <option value="">Choose a vacancy…</option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.title} ({j.clientOrg}){j.screeningConfig ? '' : ' — screening not set up'}
          </option>
        ))}
      </select>
      {hasUnsaved && <span className="scw-hint">Save or discard your changes to switch vacancy.</span>}
    </div>
  );

  let body;
  if (jobsStatus === 'loading') {
    body = <p className="scw-message">Loading vacancies…</p>;
  } else if (jobsStatus === 'error') {
    const err = describeLoadError(jobsError, 'the vacancies');
    body = (
      <p className="scw-message scw-message--error" role="alert">
        {err.message} {err.canRetry && <button type="button" className="scw-link-btn" onClick={reloadJobs}>Retry</button>}
      </p>
    );
  } else if (!job) {
    body = <p className="scw-message">Choose a vacancy to see the candidates waiting to be scored.</p>;
  } else if (!config) {
    body = (
      <p className="scw-message">
        Screening isn&apos;t set up for <strong>{job.title}</strong>, so its candidates can&apos;t be scored yet.{' '}
        {canConfigureScreening
          ? <Link to={`${base}/jobs`} className="scw-link">Set it up under Manage Jobs.</Link>
          : 'Ask someone with screening-setup access to set up its screening fields.'}
      </p>
    );
  } else if (loaded.tooMany && !isLoading) {
    body = (
      <p className="scw-message scw-message--error" role="alert">
        This vacancy has {loaded.total} candidates at the scoring stages. The grid handles up to {SOFT_CAP}, so it isn&apos;t shown.
      </p>
    );
  } else {
    body = (
      <>
        <div className="scw-toolbar">
          <div className="scw-summary">
            <strong>{skip ? 'Overall score' : `${fields.length} field${fields.length !== 1 ? 's' : ''}`}</strong>
            {config.passMark != null && <span> · pass mark {config.passMark}</span>}
            {job.screeningLocked && <span className="scw-locked"><Lock size={11} /> configuration locked</span>}
          </div>
          <div className="scw-actions">
            <button type="button" className="scw-btn" onClick={handleReload} disabled={hasUnsaved || busy !== null || isLoading}>
              <RefreshCw size={12} /> Reload
            </button>
            <button type="button" className="scw-btn" onClick={resetLocalState} disabled={!hasUnsaved || busy !== null}>
              Discard changes
            </button>
            <button type="button" className="scw-btn scw-btn--primary" onClick={handleSave} disabled={!hasUnsaved || busy !== null}>
              <Save size={12} /> {busy === 'save' ? 'Saving…' : `Save changes${hasUnsaved ? ` (${dirtyRows.length})` : ''}`}
            </button>
            <button
              type="button"
              className="scw-btn scw-btn--screen"
              onClick={() => send(readyRows, { finalize: true })}
              disabled={readyRows.length === 0 || busy !== null}
              title="Moves every candidate whose fields are all scored to Screened."
            >
              <CheckCheck size={12} /> {busy === 'finalize' ? 'Moving…' : `Move ${readyRows.length} ready to Screened`}
            </button>
          </div>
        </div>

        <div className="scw-table-wrap">
          <table className="scw-table" ref={tableRef}>
            <thead>
              <tr>
                <th className="scw-th scw-th-name">Candidate</th>
                <th className="scw-th">Stage</th>
                {fields.map((field) => (
                  <th key={field.key} className="scw-th scw-th-score">
                    {field.label}
                    <span className="scw-th-max">/ {field.max}</span>
                  </th>
                ))}
                <th className="scw-th scw-th-score">Total</th>
                <th className="scw-th" />
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableLoadingRows colSpan={fields.length + 4} />}
              {!isLoading && loadError && (
                <tr><td colSpan={fields.length + 4} className="scw-empty">
                  {loadError.message} {loadError.canRetry && <button type="button" className="scw-link-btn" onClick={handleReload}>Retry</button>}
                </td></tr>
              )}
              {!isLoading && !loadError && viewRows.length === 0 && (
                <tr><td colSpan={fields.length + 4} className="scw-empty">
                  No candidates are waiting to be scored on this vacancy.
                </td></tr>
              )}
              {!isLoading && viewRows.map((row, rowIndex) => {
                const view = views[row.id];
                const locked = view.mode === 'locked';
                const passed = config.passMark != null && view.total !== null ? view.total >= config.passMark : null;
                return (
                  <tr key={row.id} className={`scw-row${rowErrors[row.id] ? ' scw-row--error' : ''}${view.dirty && !locked ? ' scw-row--dirty' : ''}`}>
                    <td className="scw-td scw-td-name">
                      <span className="scw-name">{row.applicantName}</span>
                      <span className="scw-meta">{row.referenceId} · <Link className="scw-link" to={`${base}/applications?openApp=${row.id}`}>Open file</Link></span>
                      {rowErrors[row.id] && <span className="scw-row-error" role="alert">{rowErrors[row.id]}</span>}
                    </td>
                    <td className="scw-td">
                      <StatusBadge status={row.status} className="scw-stage" />
                      {row.status === 'Approved' && <EgiDecisionBadge decision={row.egiDecision} />}
                    </td>
                    {fields.map((field, colIndex) => {
                      const cell = view.cells[field.key];
                      return (
                        <td key={field.key} className="scw-td scw-td-score">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min={0}
                            max={field.max}
                            className={`scw-cell${cell.error ? ' scw-cell--error' : ''}${cell.dirty && !locked ? ' scw-cell--dirty' : ''}`}
                            value={cell.raw}
                            onChange={(e) => setCell(row.id, field.key, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                            data-cell={`${rowIndex}:${colIndex}`}
                            disabled={locked || busy !== null}
                            title={locked ? lockReason(row) : cell.error || undefined}
                            aria-label={`${field.label} score for ${row.applicantName}`}
                            aria-invalid={Boolean(cell.error)}
                          />
                        </td>
                      );
                    })}
                    <td className="scw-td scw-td-score scw-total">
                      {view.total !== null ? `${view.total} / ${config.fields.reduce((s, f) => s + f.max, 0)}` : '—'}
                      {passed !== null && (
                        <span className={`scw-pass${passed ? ' scw-pass--yes' : ''}`}>{passed ? 'Pass' : 'Below pass mark'}</span>
                      )}
                    </td>
                    <td className="scw-td scw-td-action">
                      {locked && <span className="scw-lock" title={lockReason(row)}><Lock size={13} /></span>}
                      {view.mode === 'first' && (
                        <button
                          type="button"
                          className="scw-btn scw-btn--screen scw-btn--row"
                          onClick={() => send([row], { finalize: true })}
                          disabled={!view.complete || busy !== null}
                          title={view.complete ? 'Save and move to Screened' : 'Every field needs a score first'}
                        >
                          Move to Screened
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="scw-footnote">
          Scores are saved with <strong>Save changes</strong>; nothing is sent as you type. A candidate only moves to
          Screened when you choose <strong>Move to Screened</strong>. Once screened, a score can be corrected (not
          cleared) by someone with approval permission; someone with edit access to declined applications can also correct one that EGI declined.
          {!skip && ' Candidates who haven’t been shortlisted with an invitation can’t be scored.'}
        </p>
      </>
    );
  }

  return (
    <div className="scw-wrapper">
      <div className="scw-header-card">
        <div>
          <span className="scw-eyebrow">SCREENING</span>
          <h1 className="scw-title">Candidate Scoring</h1>
          <p className="scw-subtitle">Score shortlisted candidates against a vacancy&apos;s screening fields, then move them to Screened.</p>
        </div>
      </div>
      {jobPicker}
      {body}
    </div>
  );
}
