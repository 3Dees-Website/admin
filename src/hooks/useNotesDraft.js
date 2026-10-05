import { useReducer, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { applicationService } from '../services/applicationService';
import { useToast } from './useToast';

export const NOTES_MAX_LENGTH = 10000;

const initialState = (appId, notes) => ({
  appId,
  // The last app.notes seen from the caller, so a replaced app object with
  // different notes is noticed during render.
  seenServerNotes: notes,
  draft: notes,
  // previousNotes for the next save: the value last loaded or saved.
  baseline: notes,
  // Values this editor has itself replaced. A response that still carries one
  // was read before our save landed, so it is stale and must not be adopted.
  superseded: [],
  phase: 'idle', // idle | saving | saved | error | latest
  savedAt: null,
  error: null,
  conflict: null, // { theirs } after a 409
  closePending: false,
});

function reducer(state, action) {
  switch (action.type) {
    case 'reset':
      return initialState(action.appId, action.notes);
    case 'server':
    case 'adopt': {
      // 'server' is the caller's app.notes changing; 'adopt' is a fresh read
      // made here, which must not touch seenServerNotes — else the next
      // render would see the (older) app.notes as a change and adopt it back.
      const next = action.type === 'server' ? { ...state, seenServerNotes: action.notes } : state;
      const clean = state.draft === state.baseline;
      if (!clean || state.phase === 'saving' || state.conflict || state.superseded.includes(action.notes)) {
        return next;
      }
      return { ...next, draft: action.notes, baseline: action.notes };
    }
    case 'edit':
      return { ...state, draft: action.draft };
    case 'saveStart':
      return { ...state, phase: 'saving', error: null };
    case 'saveOk':
      return {
        ...state,
        baseline: action.notes,
        superseded: action.previous === action.notes ? state.superseded : [...state.superseded, action.previous],
        phase: 'saved',
        savedAt: action.at,
        error: null,
      };
    case 'saveError':
      return { ...state, phase: 'error', error: action.message };
    case 'conflict':
      return { ...state, phase: 'idle', error: null, conflict: { theirs: action.theirs } };
    case 'useTheirs':
      return { ...state, draft: action.theirs, baseline: action.theirs, conflict: null, phase: 'latest' };
    case 'rebase':
      // Keep mine / Combine: the next save is made against their version.
      return { ...state, draft: action.draft, baseline: action.theirs, conflict: null, phase: 'idle' };
    case 'askClose':
      return { ...state, closePending: true };
    case 'cancelClose':
      return { ...state, closePending: false };
    default:
      return state;
  }
}

const describeSaveError = (err) => {
  if (err?.error === 'NotFound') return 'This application no longer exists. Your notes were not saved.';
  return err?.message || 'Could not reach the server.';
};

/**
 * The Administrative Notes notepad for one application drawer: the draft,
 * saving it on its own (PATCH /:id/notes), conflict handling and the
 * unsaved-changes guard. Called once by whatever owns the drawer's close and
 * status buttons (CandidateEditDrawer, or the pages with their own drawer);
 * AdminNotesPanel renders it inside ApplicationDetail.
 *
 * Status changes never carry the notepad — callers that close the drawer
 * after a status change must `await ensureSaved()` first.
 */
export function useNotesDraft(app) {
  const { addToast } = useToast();
  const appId = app?.id ?? null;
  const serverNotes = app?.notes ?? '';
  const applicantName = app?.applicantName || 'this applicant';

  const [state, dispatch] = useReducer(reducer, null, () => initialState(appId, serverNotes));

  // Adjusted during render (not in an effect) so the drawer never paints
  // another application's notes.
  if (state.appId !== appId) {
    dispatch({ type: 'reset', appId, notes: serverNotes });
  } else if (state.seenServerNotes !== serverNotes) {
    dispatch({ type: 'server', notes: serverNotes });
  }

  // Async handlers read these, never state: after an await, state in the
  // closure is stale. The save code updates them itself as it dispatches; the
  // layout effect re-syncs them from state after every commit.
  const idRef = useRef(appId);
  const draftRef = useRef(state.draft);
  const baselineRef = useRef(state.baseline);
  const conflictRef = useRef(state.conflict);
  const nameRef = useRef(applicantName);
  const inflightRef = useRef(null);
  const closeFnRef = useRef(null);
  const mountedRef = useRef(true);

  useLayoutEffect(() => {
    idRef.current = state.appId;
    draftRef.current = state.draft;
    baselineRef.current = state.baseline;
    conflictRef.current = state.conflict;
    nameRef.current = applicantName;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const isDirty = state.draft !== state.baseline;
  const needsGuard = isDirty || Boolean(state.conflict);

  useEffect(() => {
    if (!needsGuard) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [needsGuard]);

  const setDraft = useCallback((value) => {
    draftRef.current = value;
    dispatch({ type: 'edit', draft: value });
  }, []);

  /**
   * Saves the draft if it differs from previousNotes. One save at a time: a
   * call made while one is running waits, then looks again (the admin may
   * have typed meanwhile). Resolves to 'clean' | 'saved' | 'held' (an
   * emptied box with allowClear false) | 'conflict' | 'error'.
   */
  const save = useCallback(async ({ allowClear = true } = {}) => {
    while (inflightRef.current) await inflightRef.current;

    const id = idRef.current;
    if (id == null) return 'clean';
    if (conflictRef.current) return 'conflict';
    const notes = draftRef.current;
    const previousNotes = baselineRef.current;
    if (notes === previousNotes) return 'clean';
    if (notes === '' && !allowClear) return 'held';

    const name = nameRef.current;
    // Still the same drawer? If not, the outcome can only be reported by toast.
    const stillOpen = () => mountedRef.current && idRef.current === id;

    dispatch({ type: 'saveStart' });
    const run = (async () => {
      try {
        const updated = await applicationService.saveNotes(id, { notes, previousNotes });
        const saved = typeof updated?.notes === 'string' ? updated.notes : notes;
        if (stillOpen()) {
          baselineRef.current = saved;
          dispatch({ type: 'saveOk', notes: saved, previous: previousNotes, at: new Date() });
        }
        return 'saved';
      } catch (err) {
        if (err?.error === 'Conflict') {
          const theirs = typeof err.data?.notes === 'string' ? err.data.notes : '';
          if (stillOpen()) {
            conflictRef.current = { theirs };
            dispatch({ type: 'conflict', theirs });
            addToast('warning', 'Notes Not Saved', 'Someone else changed these notes while you were editing. Compare both versions in the notes panel.');
          } else {
            addToast('warning', 'Notes Not Saved', `Someone else changed the notes on ${name} while you were editing, so your changes were not saved. Reopen the application to review them.`);
          }
          return 'conflict';
        }
        const message = describeSaveError(err);
        if (stillOpen()) {
          dispatch({ type: 'saveError', message });
        } else {
          addToast('error', 'Notes Not Saved', `Your notes on ${name} were not saved: ${message}`);
        }
        return 'error';
      }
    })();
    inflightRef.current = run;
    run.finally(() => {
      if (inflightRef.current === run) inflightRef.current = null;
    });
    return run;
  }, [addToast]);

  /** Blur: saves edits, but never clears a note — that takes the button. */
  const saveOnBlur = useCallback(() => save({ allowClear: false }), [save]);

  /**
   * Before a status change that closes the drawer. Resolves true when the
   * notes are saved; otherwise says plainly that the status did not change.
   */
  const ensureSaved = useCallback(async () => {
    const result = await save({ allowClear: false });
    if (result === 'clean' || result === 'saved') return true;
    const messages = {
      conflict: "Someone else changed this applicant's notes while you were editing. Resolve the notes conflict first, then try again.",
      error: 'Your notes could not be saved. Retry saving the notes, then try again.',
      held: 'The notes box is empty but the saved note has not been cleared. Click "Clear note" to remove it, or undo your edit, then try again.',
    };
    addToast('warning', 'Status Not Changed', `The status was left as it was. ${messages[result]}`);
    return false;
  }, [save, addToast]);

  /** Runs `close` now if nothing is unsaved; otherwise asks first. */
  const requestClose = useCallback(async (close) => {
    while (inflightRef.current) await inflightRef.current;
    if (!conflictRef.current && draftRef.current === baselineRef.current) {
      close();
      return;
    }
    closeFnRef.current = close;
    dispatch({ type: 'askClose' });
  }, []);

  const cancelClose = useCallback(() => {
    closeFnRef.current = null;
    dispatch({ type: 'cancelClose' });
  }, []);

  const discardAndClose = useCallback(() => {
    const close = closeFnRef.current;
    closeFnRef.current = null;
    dispatch({ type: 'cancelClose' });
    close?.();
  }, []);

  const saveAndClose = useCallback(async () => {
    const close = closeFnRef.current;
    const cleared = draftRef.current === '';
    const name = nameRef.current;
    dispatch({ type: 'cancelClose' });
    const result = await save({ allowClear: true });
    closeFnRef.current = null;
    if (result === 'saved' || result === 'clean') {
      if (result === 'saved') {
        addToast('success', cleared ? 'Note Cleared' : 'Notes Saved', cleared ? `Note cleared for ${name}.` : `Notes saved for ${name}.`);
      }
      close?.();
    }
    // conflict / error: the drawer stays open and the panel shows why.
  }, [save, addToast]);

  /** Fresh server value (e.g. from GET /:id) — adopted only while clean. */
  const adoptServerNotes = useCallback((id, notes) => {
    if (id !== idRef.current || typeof notes !== 'string') return;
    dispatch({ type: 'adopt', notes });
  }, []);

  /** 'theirs' | 'combine' | 'mine' — see AdminNotesPanel's conflict panel. */
  const resolveConflict = useCallback((choice) => {
    const theirs = conflictRef.current?.theirs;
    if (theirs === undefined) return;
    const mine = draftRef.current;
    conflictRef.current = null;
    baselineRef.current = theirs;
    if (choice === 'theirs') {
      draftRef.current = theirs;
      dispatch({ type: 'useTheirs', theirs });
      return;
    }
    const draft = choice === 'combine' && theirs !== '' ? `${theirs}\n\n— My edits —\n${mine}` : mine;
    draftRef.current = draft;
    dispatch({ type: 'rebase', theirs, draft });
    if (choice === 'mine') save({ allowClear: true });
  }, [save]);

  return {
    applicantName,
    draft: state.draft,
    savedNotes: state.baseline,
    isDirty,
    phase: state.phase,
    savedAt: state.savedAt,
    error: state.error,
    conflict: state.conflict,
    closePending: state.closePending,
    setDraft,
    save,
    saveOnBlur,
    ensureSaved,
    requestClose,
    cancelClose,
    discardAndClose,
    saveAndClose,
    adoptServerNotes,
    resolveConflict,
  };
}
