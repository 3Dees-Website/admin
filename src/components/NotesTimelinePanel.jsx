import { Send } from 'lucide-react';
import { useNotesTimeline, NOTE_MAX_LENGTH } from '../hooks/useNotesTimeline';
import { StatusBadge } from './StatusBadge';
import { describeLoadError } from '../utils/describeLoadError';
import './styles/NotesTimelinePanel.css';

const COUNTER_FROM = 9000;

/**
 * The Administrative Notes section when the pipeline is on: every note from
 * every stage, newest last, with who wrote it and the stage the application
 * was in. Notes can only be added. Visible to every admin; none of it is sent
 * to EGI except the approval note, which is marked.
 */
export function NotesTimelinePanel({ app }) {
  const {
    status, notes, error, draft, setDraft, add, adding, addError, reload,
  } = useNotesTimeline(app.id, { refreshKey: `${app.status}|${app.egiSyncStatus}` });

  const loadError = status === 'error' ? describeLoadError(error, 'the notes') : null;
  const canAdd = draft.trim().length > 0 && !adding;

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canAdd) {
      e.preventDefault();
      add();
    }
  };

  return (
    <section className="ad-section">
      <h3 className="ad-section-title">Administrative Notes</h3>

      {status === 'loading' && <p className="ad-empty-hint">Loading notes…</p>}

      {loadError && (
        <div className="ntp-error" role="alert">
          <span>{loadError.message}</span>
          {loadError.canRetry && (
            <button type="button" className="ntp-link-btn" onClick={reload}>Retry</button>
          )}
        </div>
      )}

      {status === 'ready' && notes.length === 0 && (
        <p className="ad-empty-hint">No notes yet. Add the first one below.</p>
      )}

      {status === 'ready' && notes.length > 0 && (
        <ol className="ntp-list">
          {notes.map((note) => (
            <li key={note.id} className="ntp-item">
              <div className="ntp-meta">
                <span className="ntp-author">{note.authorName}</span>
                <StatusBadge status={note.stage} className="ntp-stage" />
                {(note.kind === 'egi' || note.sentToEgi) && (
                  <span className="ntp-egi-chip">Sent to EGI</span>
                )}
                <time className="ntp-time" dateTime={note.createdAt}>
                  {new Date(note.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="ntp-body">{note.body}</p>
            </li>
          ))}
        </ol>
      )}

      <textarea
        rows={3}
        value={draft}
        maxLength={NOTE_MAX_LENGTH}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={adding}
        placeholder="Add a note: credential discrepancies, background-check remarks, vetting decisions…"
        className="ad-notes-textarea"
        aria-label="New note"
      />

      <div className="ntp-footer">
        <span className="ntp-hint">Visible to every admin. Notes can&apos;t be edited or removed. Not sent to EGI.</span>
        {draft.length > COUNTER_FROM && (
          <span className="ntp-counter">{draft.length.toLocaleString()} / {NOTE_MAX_LENGTH.toLocaleString()}</span>
        )}
        <button type="button" className="ntp-btn" onClick={add} disabled={!canAdd}>
          <Send size={12} />
          {adding ? 'Adding…' : 'Add note'}
        </button>
      </div>

      {addError && <p className="ntp-add-error" role="alert">{addError}</p>}
    </section>
  );
}
