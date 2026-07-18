/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { X, ShieldAlert, Check } from 'lucide-react';
import { ApplicationDetail } from './ApplicationDetail';
import { EgiNoteModal } from './EgiNoteModal';
import './styles/CandidateEditDrawer.css';

/**
 * Drawer chrome (overlay/header/footer) around the shared ApplicationDetail
 * content. Status transitions (Reject/Shortlist/Approve) stay here since
 * they're page-orchestrated; everything else (view/edit/documents/
 * verification/resend) lives in ApplicationDetail.
 */
export function CandidateEditDrawer({
  app,
  jobTitle,
  isSuperadmin = false,
  currentUser,
  notes,
  onNotesChange,
  onClose,
  onStatusChange,
  onAppUpdated,
}) {
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approving, setApproving] = useState(false);

  const handleApproveConfirm = async (egiNote) => {
    setApproving(true);
    await onStatusChange('Approved', egiNote);
    setApproving(false);
    setShowApproveModal(false);
  };

  return (
    <div className="ced-overlay">
      <div className="ced-backdrop" onClick={onClose} />

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
          <button onClick={onClose} className="ced-close-btn">
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
            notes={notes}
            onNotesChange={onNotesChange}
            onAppUpdated={onAppUpdated}
          />
        </div>

        {/* Footer */}
        <div className="ced-footer">
          <div className="ced-footer-status">
            <span className="ced-footer-current">
              Current status:{' '}
              <span className={`ced-status-pill ced-status-${app.status.toLowerCase()}`}>
                {app.status}
              </span>
            </span>
            {onStatusChange && (
              <div className="ced-status-btns">
                <button type="button" onClick={() => onStatusChange('Rejected')} className="ced-btn-reject">Reject</button>
                <button type="button" onClick={() => onStatusChange('Shortlisted')} className="ced-btn-shortlist">Shortlist</button>
                {isSuperadmin && (
                  <button type="button" onClick={() => setShowApproveModal(true)} className="ced-btn-approve">
                    <Check size={14} /> Approve &amp; Sync
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="ced-footer-save">
            <button type="button" onClick={onClose} className="ced-btn-cancel">Close</button>
          </div>
        </div>

      </div>

      <EgiNoteModal
        open={showApproveModal}
        busy={approving}
        description={`Approving ${app.applicantName} sends this note to EGI along with the candidate record.`}
        verificationDocuments={app.verificationDocuments}
        onCancel={() => setShowApproveModal(false)}
        onConfirm={handleApproveConfirm}
      />
    </div>
  );
}
