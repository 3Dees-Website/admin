/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApplications } from '../hooks/useApplications';
import { usePaginatedApplications } from '../hooks/usePaginatedApplications';
import { useJobs } from '../hooks/useJobs';
import { useAuth } from '../hooks/useAuth';
import { useFieldCatalog } from '../hooks/useFieldCatalog';
import { useToast } from '../hooks/useToast';
import { Search, ShieldAlert, RefreshCw, X } from 'lucide-react';
import { EgiNoteModal } from '../components/EgiNoteModal';
import { EgiSyncBadge, EgiDecisionBadge, EgiResendBadge } from '../components/EgiBadges';
import { ApplicationDetail } from '../components/ApplicationDetail';
import { PaginationControls } from '../components/PaginationControls';
import { TableLoadingRows } from '../components/TableLoadingRows';
import { applicationService } from '../services/applicationService';
import { downloadBlob } from '../utils/downloadBlob';
import './styles/SuperadminApprovedCandidates.css';

const POLL_INTERVAL_MS = 60000;

export function SuperadminApprovedCandidates() {
  const { reviewApplication } = useApplications();
  const { jobs } = useJobs();
  const { currentUser } = useAuth();
  const { catalog } = useFieldCatalog();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedEgiDecision, setSelectedEgiDecision] = useState('All');
  const [selectedStateOfOrigin, setSelectedStateOfOrigin] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeApp, setActiveApp] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approving, setApproving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const stateOptions = catalog?.fields.find((f) => f.key === 'stateOfOrigin')?.options || [];

  const filters = {
    status: 'Approved',
    egiDecision: selectedEgiDecision !== 'All' ? selectedEgiDecision : undefined,
    stateOfOrigin: selectedStateOfOrigin !== 'All' ? selectedStateOfOrigin : undefined,
    search: searchTerm,
  };

  const {
    items,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    isLoading,
    refetch,
  } = usePaginatedApplications(filters);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } catch {
      addToast('error', 'Refresh Failed', 'Could not refresh applications from the server.');
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, addToast]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const openAppId = searchParams.get('openApp');
    if (!openAppId) return;
    let cancelled = false;

    (async () => {
      try {
        const app = await applicationService.getApplication(openAppId);
        if (!cancelled) {
          setActiveApp(app);
          setAdminNotes(app.notes || '');
        }
      } catch {
        if (!cancelled) {
          addToast('error', 'Not Found', 'Could not load that application. It may have been removed.');
        }
      } finally {
        if (!cancelled) {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('openApp');
            return next;
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const getJobTitle = (jobId) => {
    const found = jobs.find((j) => j.id === jobId);
    return found ? found.title : 'Deleted Position';
  };

  function handleInitiateReview(app) {
    setActiveApp(app);
    setAdminNotes(app.notes || '');
  }

  const handleUpdateApplicantStatus = async (status, egiNote) => {
    if (!activeApp) return;
    addToast('info', 'Execute Oversight Trigger', `Writing compliance check to ${status}...`);
    const updated = await reviewApplication(activeApp.id, status, adminNotes, egiNote);
    if (updated) setActiveApp(updated);
    refetch();
  };

  const handleApproveConfirm = async (egiNote) => {
    setApproving(true);
    await handleUpdateApplicantStatus('Approved', egiNote);
    setApproving(false);
    setShowApproveModal(false);
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const blob = await applicationService.exportCsv(filters);
      downloadBlob(blob, '3DEES_Approved_Candidates.csv');
      addToast('success', 'Ledger Exported', 'Generated approved-candidates report.');
    } catch (err) {
      addToast('error', 'CSV Crash', err?.message || 'Encountered compilation failure.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="sac-wrapper" id="superadmin-approved-candidates-workspace">

      {/* Page Header */}
      <div className="sac-header-card">
        <div>
          <span className="sac-security-label">EXECUTIVE SECURITY LEVEL 1</span>
          <h1 className="sac-title">Approved Candidates (Sent to EGI)</h1>
          <p className="sac-subtitle">Candidates cleared through 3DEES review and dispatched to EGI, filterable by EGI decision and state of origin.</p>
        </div>
        <div className="sac-header-actions">
          <button
            onClick={handleManualRefresh}
            className="sac-refresh-btn"
            id="btn-refresh-approved-candidates"
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={isRefreshing ? 'sac-spin-icon' : ''} />
            <span>Refresh</span>
          </button>
          <button onClick={handleExportCSV} className="sac-export-btn" disabled={isExporting}>
            {isExporting ? 'Exporting…' : 'Export Approved Candidates'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="sac-filters-card">
        <div className="sac-filter-group">
          <label className="sac-filter-label">Search Dossiers Map</label>
          <div className="sac-search-wrapper">
            <Search className="sac-search-icon" />
            <input
              type="text"
              placeholder="Search by candidate, code, or qualification..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sac-search-input"
            />
          </div>
        </div>

        <div className="sac-filter-group">
          <label className="sac-filter-label">EGI Decision</label>
          <select
            value={selectedEgiDecision}
            onChange={(e) => setSelectedEgiDecision(e.target.value)}
            className="sac-select"
          >
            <option value="All">All EGI Decisions</option>
            <option value="Pending">Awaiting EGI</option>
            <option value="Accepted">Accepted by EGI</option>
            <option value="Declined">Declined by EGI</option>
          </select>
        </div>

        <div className="sac-filter-group">
          <label className="sac-filter-label">State of Origin</label>
          <select
            value={selectedStateOfOrigin}
            onChange={(e) => setSelectedStateOfOrigin(e.target.value)}
            className="sac-select"
          >
            <option value="All">All States</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="sac-table-card">
        <div className="sac-table-scroll">
          <table className="sac-table">
            <thead>
              <tr className="sac-thead-row">
                <th className="sac-th">Applicant Name</th>
                <th className="sac-th">Pipeline Role Target</th>
                <th className="sac-th">State of Origin</th>
                <th className="sac-th sac-th-center">Reference Stamp</th>
                <th className="sac-th sac-th-center">Sync Gateway</th>
                <th className="sac-th sac-th-center">EGI Decision</th>
                <th className="sac-th sac-th-right">Operation Audit</th>
              </tr>
            </thead>
            <tbody className="sac-tbody">
              {isLoading && <TableLoadingRows colSpan={7} />}
              {!isLoading && items.map((a) => (
                <tr key={a.id} className="sac-row">
                  <td className="sac-td">
                    <div className="sac-applicant-info">
                      <span className="sac-applicant-name">{a.applicantName}</span>
                      <span className="sac-applicant-meta">{a.applicantEmail}</span>
                    </div>
                  </td>
                  <td className="sac-td sac-job-title">{getJobTitle(a.jobId)}</td>
                  <td className="sac-td sac-state-cell">{a.stateOfOrigin || '—'}</td>
                  <td className="sac-td sac-td-center sac-ref-id">{a.referenceId}</td>
                  <td className="sac-td sac-td-center">
                    <EgiSyncBadge status={a.egiSyncStatus} />
                  </td>
                  <td className="sac-td sac-td-center">
                    <EgiDecisionBadge decision={a.egiDecision} />
                    <EgiResendBadge count={a.egiResendCount} />
                  </td>
                  <td className="sac-td sac-td-right">
                    <button
                      onClick={() => handleInitiateReview(a)}
                      className="sac-review-btn"
                      id={`approved-review-btn-${a.id}`}
                    >
                      Audit & Override
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="sac-empty-row">
                    No approved candidates correspond with currently active queries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Drawer Overlay */}
      {activeApp && (
        <div className="sac-overlay">
          <div className="sac-overlay-backdrop" onClick={() => setActiveApp(null)} />

          <div className="sac-drawer">
            {/* Drawer Header */}
            <div className="sac-drawer-header">
              <div>
                <span className="sac-drawer-label">SUPERADMIN SECURE OVERRIDE</span>
                <h2 className="sac-drawer-name">{activeApp.applicantName}</h2>
              </div>
              <button onClick={() => setActiveApp(null)} className="sac-drawer-close">
                <X className="sac-close-icon" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="sac-drawer-body">

              {/* Warning Banner */}
              <div className="sac-warning-banner">
                <ShieldAlert className="sac-warning-icon" />
                <div>
                  <strong className="sac-warning-title">Warning: Compliance Override Mode Active</strong>
                  <div className="sac-warning-text">
                    Status adjustments executed by Superadmins bypass the general screening buffer. All edits will log directly to the central compliance audit register.
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="sac-details-grid">
                <div><strong>Evaluation Stamp:</strong> <span className="sac-ref-mono">{activeApp.referenceId}</span></div>
                <div><strong>Current evaluation state:</strong> <span className="sac-current-status">{activeApp.status}</span></div>
                <div><strong>Target Position:</strong> <span className="sac-detail-muted">{getJobTitle(activeApp.jobId)}</span></div>
                <div><strong>Client Sponsoring:</strong> <span className="sac-detail-dark">{jobs.find((j) => j.id === activeApp.jobId)?.clientOrg || 'Unknown Client'}</span></div>
              </div>

              <ApplicationDetail
                app={activeApp}
                currentUser={currentUser}
                notes={adminNotes}
                onNotesChange={setAdminNotes}
                onAppUpdated={setActiveApp}
              />
            </div>

            {/* Drawer Footer */}
            <div className="sac-drawer-footer">
              <span className="sac-sync-status">
                <RefreshCw className="sac-spin-icon" /> Multi-Ref Handshakes active
              </span>
              <div className="sac-action-btns">
                <button onClick={() => handleUpdateApplicantStatus('Rejected')} className="sac-btn-reject">
                  Reject & Block
                </button>
                <button onClick={() => handleUpdateApplicantStatus('Shortlisted')} className="sac-btn-shortlist">
                  Force Shortlist
                </button>
                <button onClick={() => setShowApproveModal(true)} className="sac-btn-approve">
                  Approve & Portal Sync
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <EgiNoteModal
        open={showApproveModal}
        busy={approving}
        description={activeApp ? `Approving ${activeApp.applicantName} sends this note to EGI along with the candidate record.` : ''}
        verificationDocuments={activeApp?.verificationDocuments}
        onCancel={() => setShowApproveModal(false)}
        onConfirm={handleApproveConfirm}
      />
    </div>
  );
}
