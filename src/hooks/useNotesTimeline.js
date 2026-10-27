import { useState, useEffect, useCallback } from 'react';
import { applicationService } from '../services/applicationService';

export const NOTE_MAX_LENGTH = 10000;

// An unsent note, per application, kept for the life of the page so closing
// the drawer by accident doesn't throw it away. (Reloading the page does.)
const unsentDrafts = new Map();

/**
 * The notes timeline for one application: the list, and adding to it.
 *
 * Notes are append-only, so unlike the single notepad there is no draft
 * baseline, no conflict and no overwrite. The list is read when the
 * application changes, when `refreshKey` changes (a status change writes notes
 * of its own) and on `reload()`.
 *
 * status: 'loading' | 'ready' | 'error'
 */
export function useNotesTimeline(appId, { refreshKey } = {}) {
  const [loaded, setLoaded] = useState({ appId: null, notes: [], error: null });
  const [reloadTick, setReloadTick] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [draftState, setDraftState] = useState(() => ({ appId, text: unsentDrafts.get(appId) ?? '' }));

  // Adjusted during render so another application's draft is never painted.
  if (draftState.appId !== appId) {
    setDraftState({ appId, text: unsentDrafts.get(appId) ?? '' });
  }
  const draft = draftState.appId === appId ? draftState.text : (unsentDrafts.get(appId) ?? '');

  useEffect(() => {
    if (appId == null) return undefined;
    let cancelled = false;
    applicationService.getNotes(appId).then(
      (notes) => { if (!cancelled) setLoaded({ appId, notes, error: null }); },
      (error) => { if (!cancelled) setLoaded({ appId, notes: [], error }); },
    );
    return () => { cancelled = true; };
  }, [appId, refreshKey, reloadTick]);

  const isCurrent = loaded.appId === appId;
  const status = !isCurrent ? 'loading' : loaded.error ? 'error' : 'ready';

  useEffect(() => {
    if (!draft) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft]);

  const setDraft = useCallback((text) => {
    if (text) unsentDrafts.set(appId, text);
    else unsentDrafts.delete(appId);
    setDraftState({ appId, text });
  }, [appId]);

  const reload = useCallback(() => {
    setLoaded((prev) => ({ ...prev, appId: null }));
    setReloadTick((t) => t + 1);
  }, []);

  /** Resolves true once the note is saved. */
  const add = useCallback(async () => {
    const text = draft.trim();
    if (!text || adding) return false;
    const id = appId;
    setAdding(true);
    setAddError(null);
    try {
      const note = await applicationService.addNote(id, text);
      unsentDrafts.delete(id);
      setDraftState((prev) => (prev.appId === id ? { appId: id, text: '' } : prev));
      setLoaded((prev) => (prev.appId === id ? { ...prev, notes: [...prev.notes, note] } : prev));
      return true;
    } catch (err) {
      if (err?.error) {
        setAddError(err.message || 'The note could not be saved.');
      } else {
        // No answer from the server (timeout, dropped connection): the note
        // may or may not have been saved. Re-read the list rather than invite
        // a retry that could post it twice.
        setAddError("Couldn't confirm the note was saved. The list below has been refreshed — check it before sending again.");
        setReloadTick((t) => t + 1);
      }
      return false;
    } finally {
      setAdding(false);
    }
  }, [appId, draft, adding]);

  return {
    status,
    notes: isCurrent ? loaded.notes : [],
    error: isCurrent ? loaded.error : null,
    draft,
    setDraft,
    add,
    adding,
    addError,
    reload,
  };
}
