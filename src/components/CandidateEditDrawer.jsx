/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { X, ShieldAlert } from 'lucide-react';
import { ApplicationDetail } from './ApplicationDetail';
import { StatusActions } from './StatusActions';
import { StatusBadge } from './StatusBadge';
import { useNotesDraft } from '../hooks/useNotesDraft';
import './styles/CandidateEditDrawer.css';

/**
 * Drawer chrome (overlay/header/footer) around the shared ApplicationDetail
 * content. Status transitions (Reject/Shortlist/Approve) stay here since
 * they're page-orchestrated; everything else (view/edit/documents/
 * verification/resend) lives in ApplicationDetail.
 *
 * The owning pages close the drawer after a successful status change, so the
 * notepad is saved first: if it can't be saved the status is not changed,
 * rather than the draft being lost with the drawer.
 */
export function CandidateEditDrawer({
  app,
  jobTitle,
  isSuperadmin = false,
  currentUser,
  onClose,
  onStatusChange,
  onAppUpdated,
}) {
  const notesDraft = useNotesDraft(app);

  const handleClose = () => notesDraft.requestClose(onClose);

  return (
    <div className="ced-overlay">
      <div className="ced-backdrop" onClick={handleClose} />

      <div className="ced-drawer">

        {/* Header */}
        <div className="ced-header">
          <div className="ced-header-left">
            <span className="ced-label">
              {isSuperadmin ? 'SUPERADMIN OVERRIDE · CANDIDATE FILE' : 'ADMIN · CANDIDATE FILE'}
            </span>
            <h2 className="ced-name">{app.applicantName}</h2>
            <span className="ced-meta">{jobTitle}&nbsp;·&nbsp;Ref:&nbsp;{app.referenceId}</span>
          </div>
          <button onClick={handleClose} className="ced-close-btn">
            <X className="ced-close-icon" />
          </button>
        </div>

        {/* Superadmin warning */}
        {isSuperadmin && (
          <div className="ced-warning">
            <ShieldAlert className="ced-warning-icon" />
            <div>
              <strong className="ced-warning-title">Override Mode Active</strong>
              <span className="ced-warning-text"> — All edits bypass normal workflow and log to the compliance audit register.</span>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="ced-body">
          <ApplicationDetail
            app={app}
            currentUser={currentUser}
            notesDraft={notesDraft}
            onAppUpdated={onAppUpdated}
          />
        </div>

        {/* Footer */}
        <div className="ced-footer">
          <div className="ced-footer-status">
            <span className="ced-footer-current">
              Current status:{' '}
              <StatusBadge status={app.status} className="ced-status-pill" />
            </span>
            {onStatusChange && (
              <div className="ced-status-btns">
                {/* beforeAction: the drawer closes after a status change, so the
                    notepad is saved first; if it can't be, the status is left
                    alone (ensureSaved has already said why). */}
                <StatusActions
                  app={app}
                  pipelineV2={currentUser?.pipelineV2 === true}
                  showLegacyApprove={isSuperadmin}
                  approveIcon
                  buttonClass={{ reject: 'ced-btn-reject', shortlist: 'ced-btn-shortlist', approve: 'ced-btn-approve' }}
                  beforeAction={notesDraft.ensureSaved}
                  onTransition={onStatusChange}
                />
              </div>
            )}
          </div>
          <div className="ced-footer-save">
            <button type="button" onClick={handleClose} className="ced-btn-cancel">Close</button>
          </div>
        </div>

      </div>
    </div>
  );
}
