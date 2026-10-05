import { useEffect, useRef } from 'react';
import { AlertTriangle, Check, Save } from 'lucide-react';
import { NOTES_MAX_LENGTH } from '../hooks/useNotesDraft';
import './styles/AdminNotesPanel.css';

const COUNTER_FROM = 9000;

const formatTime = (date) => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * The Administrative Notes section of ApplicationDetail. All state and saving
 * live in useNotesDraft (owned by the drawer's owner); this only renders it.
 */
export function AdminNotesPanel({ notesDraft }) {
  const {
    applicantName, draft, savedNotes, isDirty, phase, savedAt, error, conflict, closePending,
    setDraft, save, saveOnBlur, resolveConflict, cancelClose, discardAndClose, saveAndClose,
  } = notesDraft;

  const conflictRef = useRef(null);
  useEffect(() => {
    if (conflict) conflictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [conflict]);

  const saving = phase === 'saving';
  const isClearing = draft === '' && savedNotes !== '';
  const justSaved = phase === 'saved' && !isDirty;

  let status = null;
  if (conflict) {
    status = null;
  } else if (saving) {
    status = <span className="anp-status">Saving…</span>;
  } else if (isDirty && phase === 'error') {
    status = (
      <span className="anp-status anp-status--error" role="alert">
        Couldn&apos;t save: {error} Your text is still here.{' '}
        <button type="button" className="anp-link-btn" onClick={() => save()}>Retry</button>
      </span>
    );
  } else if (isClearing) {
    status = (
      <span className="anp-status anp-status--dirty">
        Unsaved — click <strong>Clear note</strong> to remove the saved note.
      </span>
    );
  } else if (isDirty) {
    status = <span className="anp-status anp-status--dirty"><span className="anp-dot" aria-hidden="true" />Unsaved changes</span>;
  } else if (justSaved && savedAt) {
    status = <span className="anp-status anp-status--saved"><Check size={12} /> Saved at {formatTime(savedAt)}</span>;
  } else if (phase === 'latest') {
    status = <span className="anp-status">Showing the latest saved version.</span>;
  }

  return (
    <section className="ad-section">
      <h3 className="ad-section-title">Administrative Notes</h3>

      {conflict && (
        <div className="anp-conflict" ref={conflictRef} role="alert">
          <div className="anp-conflict-head">
            <AlertTriangle size={16} className="anp-conflict-icon" />
            <strong>Someone else changed these notes</strong>
          </div>
          <p className="anp-conflict-desc">
            Another admin saved a different version while you were editing. <strong>Your changes have not been saved.</strong>{' '}
            Compare the two and choose what to keep.
          </p>
          <div className="anp-conflict-grid">
            <div>
              <span className="anp-conflict-label">Current saved version</span>
              <div className="anp-conflict-text">
                {conflict.theirs === '' ? <em>(empty — the note was cleared)</em> : conflict.theirs}
              </div>
            </div>
            <div>
              <span className="anp-conflict-label">Your version</span>
              <div className="anp-conflict-text">
                {draft === '' ? <em>(empty)</em> : draft}
              </div>
            </div>
          </div>
          <div className="anp-conflict-actions">
            <button type="button" className="anp-btn" onClick={() => resolveConflict('theirs')}>Use the saved version</button>
            <button type="button" className="anp-btn" onClick={() => resolveConflict('combine')}>Combine both</button>
            <button type="button" className="anp-btn anp-btn--primary" onClick={() => resolveConflict('mine')}>Keep mine and overwrite</button>
          </div>
        </div>
      )}

      <textarea
        rows={3}
        value={draft}
        maxLength={NOTES_MAX_LENGTH}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={conflict ? undefined : saveOnBlur}
        placeholder="Annotate credential discrepancies, background check remarks, or vetting approvals here..."
        className={`ad-notes-textarea${justSaved ? ' anp-textarea--saved' : ''}`}
        aria-label="Administrative notes"
      />

      <div className="anp-footer">
        <div className="anp-status-wrap" aria-live="polite">{status}</div>
        {draft.length > COUNTER_FROM && (
          <span className="anp-counter">{draft.length.toLocaleString()} / {NOTES_MAX_LENGTH.toLocaleString()}</span>
        )}
        <button
          type="button"
          className={`anp-btn ${isClearing ? 'anp-btn--danger' : 'anp-btn--primary'}`}
          onClick={() => save()}
          disabled={!isDirty || saving || Boolean(conflict)}
        >
          <Save size={12} />
          {isClearing ? 'Clear note' : 'Save notes'}
        </button>
      </div>

      {closePending && (
        <div className="ad-delete-overlay">
          <div className="ad-delete-backdrop" onClick={cancelClose} />
          <div className="ad-delete-modal" role="dialog" aria-modal="true" aria-labelledby="anp-unsaved-title">
            <AlertTriangle className="anp-unsaved-icon" />
            <h3 id="anp-unsaved-title" className="ad-delete-title">Unsaved notes</h3>
            <p className="ad-delete-desc">
              {conflict
                ? <>Your notes on <strong>{applicantName}</strong> haven&apos;t been saved because someone else changed them. If you close now, your changes will be lost.</>
                : isClearing
                  ? <>You emptied the notes box for <strong>{applicantName}</strong> but the saved note hasn&apos;t been cleared. If you close now, the saved note stays as it was.</>
                  : <>Your notes on <strong>{applicantName}</strong> haven&apos;t been saved. If you close now, your changes will be lost.</>}
            </p>
            <div className="ad-delete-actions anp-unsaved-actions">
              <button type="button" className="ad-delete-cancel-btn" onClick={cancelClose}>Keep editing</button>
              <button type="button" className="ad-delete-cancel-btn" onClick={discardAndClose}>Discard changes</button>
              {!conflict && (
                <button type="button" className="anp-btn anp-btn--primary" onClick={saveAndClose}>
                  {isClearing ? 'Clear note and close' : 'Save and close'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
