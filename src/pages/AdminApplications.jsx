import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApplications } from '../hooks/useApplications';
import { usePaginatedApplications } from '../hooks/usePaginatedApplications';
import { useJobs } from '../hooks/useJobs';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Search, Download, Eye, X, RefreshCw } from 'lucide-react';
import { StatusActions } from '../components/StatusActions';
import { InviteModal } from '../components/InviteModal';
import { RejectModal } from '../components/RejectModal';
import { EgiSyncBadge, EgiDecisionBadge, EgiResendBadge } from '../components/EgiBadges';
import { ApplicationDetail } from '../components/ApplicationDetail';
import { StatusBadge } from '../components/StatusBadge';
import { statusFilterOptions, egiDecisionFilterOptions, egiSyncFilterOptions } from '../utils/applicationStatus';
import { PaginationControls } from '../components/PaginationControls';
import { TableLoadingRows } from '../components/TableLoadingRows';
import { TableErrorRow } from '../components/TableErrorRow';
import { describeLoadError } from '../utils/describeLoadError';
import { applicationService } from '../services/applicationService';
import { downloadBlob } from '../utils/downloadBlob';
import './styles/AdminApplications.css';

const POLL_INTERVAL_MS = 60000;

export function AdminApplications() {
  const { reviewApplication, bulkReviewApplications } = useApplications();
  const { jobs } = useJobs();
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedJobId, setSelectedJobId] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedEgiDecision, setSelectedEgiDecision] = useState('All');
  const [selectedEgiSyncStatus, setSelectedEgiSyncStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppIds, setSelectedAppIds] = useState([]);
  const [activeApp, setActiveApp] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
  const [bulkInviteBusy, setBulkInviteBusy] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectBusy, setBulkRejectBusy] = useState(false);

  const filters = {
    jobId: selectedJobId !== 'All' ? selectedJobId : undefined,
    status: selectedStatus !== 'All' ? selectedStatus : undefined,
    egiDecision: selectedEgiDecision !== 'All' ? selectedEgiDecision : undefined,
    egiSyncStatus: selectedEgiSyncStatus !== 'All' ? selectedEgiSyncStatus : undefined,
    search: searchTerm,
  };

  const {
    items: loadedItems,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    isLoading,
    error,
    refetch,
  } = usePaginatedApplications(filters);

  // On a failed load the hook still holds the last good rows (possibly from
  // a different filter). Drop them so nothing — rows, select-all, bulk
  // actions — treats them as the current list.
  const items = error ? [] : loadedItems;
  const loadError = error ? describeLoadError(error, 'the applications') : null;

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

  const handleToggleSelectAll = () => {
    if (selectedAppIds.length === items.length) {
      setSelectedAppIds([]);
    } else {
      setSelectedAppIds(items.map((a) => a.id));
    }
  };

  const handleToggleSelectOne = (id) => {
    if (selectedAppIds.includes(id)) {
      setSelectedAppIds(selectedAppIds.filter((item) => item !== id));
    } else {
      setSelectedAppIds([...selectedAppIds, id]);
    }
  };

  // Bulk Shortlist sends one shared invitation (and
  // optional note) to everyone selected. A null result means the whole request
  // was refused (e.g. a malformed invitation): the modal stays open with what
  // was typed.
  const handleBulkShortlistConfirm = async (input) => {
    setBulkInviteBusy(true);
    const result = await bulkReviewApplications(selectedAppIds, 'Shortlisted', input);
    setBulkInviteBusy(false);
    if (!result) return;
    setBulkInviteOpen(false);
    setSelectedAppIds(result.failed.map((f) => f.id));
    refetch();
  };

  // Same for bulk Reject: one shared message (and optional note) for everyone.
  const handleBulkRejectConfirm = async (input) => {
    setBulkRejectBusy(true);
    const result = await bulkReviewApplications(selectedAppIds, 'Rejected', input);
    setBulkRejectBusy(false);
    if (!result) return;
    setBulkRejectOpen(false);
    setSelectedAppIds(result.failed.map((f) => f.id));
    refetch();
  };

  const handleInitiateReview = (app) => {
    setActiveApp(app);
  };

  const closeDrawer = () => setActiveApp(null);

  // `input` is whatever the move needed ({ egiNote } today). The server's reply
  // carries a fresh allowedTransitions, so the drawer's buttons stay right.
  const handleUpdateApplicantStatus = async (status, input) => {
    if (!activeApp) return null;
    const updated = await reviewApplication(activeApp.id, status, input);
    if (updated) setActiveApp(updated);
    refetch();
    return updated;
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const blob = await applicationService.exportCsv(filters);
      downloadBlob(blob, `3DEES_Candidates_Vetting_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      addToast('success', 'CSV Statement Exported', 'Your filtered report has downloaded.');
    } catch (err) {
      addToast('error', 'Export Failed', err?.message || 'Could not export the applications.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="admin-applications" id="applicant-vetting-workspace">

      {/* Header */}
      <div className="aa-header-card">
        <div>
          <h1 className="aa-header-title">Active Candidate Screening Console</h1>
          <p className="aa-header-subtitle">
            Independently audit applicant qualifications, verify legal declaration checks, and review sync statuses.
          </p>
        </div>
        <div className="aa-header-actions">
          <button
            onClick={handleManualRefresh}
            className="btn btn-ghost"
            id="btn-refresh-applications"
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="btn btn-dark"
            id="btn-export-dossiers"
            disabled={isExporting}
          >
            <Download size={16} className="icon-primary" />
            <span>{isExporting ? 'Exporting…' : 'Export filtered CSV report'}</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="aa-filters-card">
        <div className="filter-group">
          <label className="filter-label">Search Candidate / Code</label>
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Filter by name, email, stamp code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="filter-input"
            />
          </div>
        </div>
        <div className="filter-group">
          <label className="filter-label">Filter Vacancy Position</label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="filter-select"
          >
            <option value="All">All Careers Vacancies</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} ({j.clientOrg})
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Vetting Review State</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="filter-select"
          >
            <option value="All">All Vetting States</option>
            {statusFilterOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">EGI Decision</label>
          <select
            value={selectedEgiDecision}
            onChange={(e) => setSelectedEgiDecision(e.target.value)}
            className="filter-select"
          >
            <option value="All">All EGI Decisions</option>
            {egiDecisionFilterOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Sync Status</label>
          <select
            value={selectedEgiSyncStatus}
            onChange={(e) => setSelectedEgiSyncStatus(e.target.value)}
            className="filter-select"
          >
            <option value="All">All Sync States</option>
            {egiSyncFilterOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk Operations HUD */}
      {selectedAppIds.length > 0 && (
        <div className="bulk-hud">
          <span className="bulk-hud-label">
            Selected <strong className="bulk-hud-count">{selectedAppIds.length}</strong> matching candidates for bulk operations:
          </span>
          <div className="bulk-hud-actions">
            <button
              onClick={() => setBulkInviteOpen(true)}
              className="btn btn-primary btn-sm"
            >
              Bulk Shortlist Selection
            </button>
            <button
              onClick={() => setBulkRejectOpen(true)}
              className="btn btn-danger btn-sm"
            >
              Bulk Reject Selection
            </button>
            <button onClick={() => setSelectedAppIds([])} className="btn btn-ghost btn-sm">
              Cancel Selection
            </button>
          </div>
        </div>
      )}

      {/* Applicants Table */}
      <div className="aa-table-card">
        <div className="table-scroll">
          <table className="aa-table">
            <thead>
              <tr className="table-head-row">
                <th className="text-center col-checkbox">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedAppIds.length === items.length}
                    onChange={handleToggleSelectAll}
                    className="checkbox"
                  />
                </th>
                <th>Name &amp; Contacts</th>
                <th>Position App</th>
                <th>Review State</th>
                <th className="text-center">Reference Stamp</th>
                <th className="text-center">Sync Gateway</th>
                <th className="text-center">EGI Decision</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableLoadingRows colSpan={8} />}
              {!isLoading && loadError && (
                <TableErrorRow
                  colSpan={8}
                  message={loadError.message}
                  onRetry={loadError.canRetry ? refetch : undefined}
                />
              )}
              {!isLoading && items.map((a) => {
                const isSelected = selectedAppIds.includes(a.id);
                return (
                  <tr key={a.id} className={`table-body-row${isSelected ? ' row-selected' : ''}`}>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(a.id)}
                        className="checkbox"
                      />
                    </td>
                    <td>
                      <div className="candidate-cell">
                        <span className="candidate-name">{a.applicantName}</span>
                        <span className="candidate-meta">{a.applicantEmail}</span>
                      </div>
                    </td>
                    <td className="role-cell">{getJobTitle(a.jobId)}</td>
                    <td>
                      <StatusBadge status={a.status} className="badge" />
                    </td>
                    <td className="ref-cell text-center">{a.referenceId}</td>
                    <td className="text-center">
                      <EgiSyncBadge status={a.egiSyncStatus} />
                    </td>
                    <td className="text-center">
                      <EgiDecisionBadge decision={a.egiDecision} />
                      <EgiResendBadge count={a.egiResendCount} />
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleInitiateReview(a)}
                        className="btn btn-audit"
                        id={`review-btn-${a.id}`}
                      >
                        <Eye size={14} />
                        <span>Audit File</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && !loadError && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-empty">
                    No active candidacies match your currently selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={loadError ? 0 : total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Slide-out Drawer */}
      {activeApp && (
        <div className="drawer-overlay">
          <div className="drawer-backdrop" onClick={closeDrawer} />
          <div className="drawer">

            {/* Drawer Header */}
            <div className="drawer-header">
              <div>
                <span className="drawer-eyebrow">Candidacy Sheet Audit</span>
                <h2 className="drawer-title">{activeApp.applicantName}</h2>
              </div>
              <button onClick={closeDrawer} className="drawer-close" aria-label="Close drawer">
                <X size={24} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="drawer-body">

              {/* Status overview widget */}
              <div className="drawer-status-widget">
                <div>
                  <span className="widget-label">Reference Stamp Index</span>
                  <span className="widget-ref">{activeApp.referenceId}</span>
                </div>
                <div className="widget-right">
                  <span className="widget-label">Vetting Evaluation State</span>
                  <StatusBadge status={activeApp.status} className="badge" />
                </div>
              </div>

              <ApplicationDetail
                app={activeApp}
                currentUser={currentUser}
                onAppUpdated={setActiveApp}
                onDeleted={() => {
                  setActiveApp(null);
                  refetch();
                }}
                onDeleteFailed={refetch}
              />
            </div>

            {/* Drawer Footer */}
            <div className="drawer-footer">
              <span className="drawer-sync-label">
                <RefreshCw size={14} className="spin-icon" /> EGI database sync live
              </span>
              <div className="drawer-footer-actions">
                <StatusActions
                  app={activeApp}
                  approveIcon
                  buttonClass={{ reject: 'btn btn-reject', shortlist: 'btn btn-shortlist', approve: 'btn btn-approve' }}
                  labels={{ reject: 'Reject Dossier' }}
                  onTransition={handleUpdateApplicantStatus}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <InviteModal
        open={bulkInviteOpen}
        busy={bulkInviteBusy}
        title="Shortlist & Send Invitations"
        confirmLabel="Shortlist & Send Invites"
        recipientCount={selectedAppIds.length}
        description={`${selectedAppIds.length} applicant${selectedAppIds.length !== 1 ? 's' : ''} will each be emailed this invitation as soon as you send.`}
        onCancel={() => setBulkInviteOpen(false)}
        onConfirm={handleBulkShortlistConfirm}
      />

      <RejectModal
        open={bulkRejectOpen}
        busy={bulkRejectBusy}
        title="Reject & Notify Applicants"
        confirmLabel="Reject & Send Messages"
        recipientCount={selectedAppIds.length}
        description={`${selectedAppIds.length} applicant${selectedAppIds.length !== 1 ? 's' : ''} will each be emailed this message as soon as you send.`}
        onCancel={() => setBulkRejectOpen(false)}
        onConfirm={handleBulkRejectConfirm}
      />
    </div>
  );
}
