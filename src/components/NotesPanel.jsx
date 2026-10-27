import { AdminNotesPanel } from './AdminNotesPanel';
import { NotesTimelinePanel } from './NotesTimelinePanel';

/**
 * Picks the notes UI for the backend in use: the notes timeline when the
 * applicant pipeline is on, the original single notepad (AdminNotesPanel,
 * driven by the drawer owner's useNotesDraft) when it is off. The notepad is
 * answered with 410 once the pipeline is on, so it cannot be shown then.
 */
export function NotesPanel({ app, pipelineV2, notesDraft }) {
  return pipelineV2
    ? <NotesTimelinePanel app={app} />
    : <AdminNotesPanel notesDraft={notesDraft} />;
}
