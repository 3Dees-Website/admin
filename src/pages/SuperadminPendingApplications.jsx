/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { useApplications } from '../hooks/useApplications';
import { usePaginatedApplications } from '../hooks/usePaginatedApplications';
import { useApplicationStats } from '../hooks/useApplicationStats';
import { useJobs } from '../hooks/useJobs';
import { useAuth } from '../hooks/useAuth';
import { CandidateEditDrawer } from '../components/CandidateEditDrawer';
import { InviteModal } from '../components/InviteModal';
import { RejectModal } from '../components/RejectModal';
import { PaginationControls } from '../components/PaginationControls';
import { TableLoadingRows } from '../components/TableLoadingRows';
import { TableErrorRow } from '../components/TableErrorRow';
import { describeLoadError } from '../utils/describeLoadError';
import {
  Search, Inbox, Clock, UserCheck, UserX,
  ShieldAlert, Zap
} from 'lucide-react';
import { CandidateAvatar } from '../components/CandidateAvatar';
import './styles/SuperadminPendingApplications.css';

export function SuperadminPendingApplications() {
  const { reviewApplication, bulkReviewApplications } = useApplications();
  const { jobs } = useJobs();
  const { currentUser } = useAuth();
  // There is no Pending -> Approved; shortlisting needs an invitation and
  // rejecting needs a message (bulk collects one shared invitation or message
  // first).

  const [searchTerm,    setSearchTerm]    = useState('');
  const [selectedJobId, setSelectedJobId] = useState('All');
  const [editingApp,    setEditingApp]    = useState(null);
  const [selectedIds,   setSelectedIds]   = useState(new Set());
  const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
  const [bulkInviteBusy, setBulkInviteBusy] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectBusy, setBulkRejectBusy] = useState(false);

  const {
    items: loadedItems, total: totalItems, page, pageSize, setPage, setPageSize, isLoading, error, refetch,
  } = usePaginatedApplications({
    status: 'Pending',
    jobId: selectedJobId !== 'All' ? selectedJobId : undefined,
    search: searchTerm,
  });
  const { stats: globalStats, refetch: refetchStats } = useApplicationStats();

  // On a failed load the hook still holds the last good rows (possibly from
  // a different filter). Drop them so nothing — rows, select-all, bulk
  // actions — treats them as the current list.
  const items = useMemo(() => (error ? [] : loadedItems), [error, loadedItems]);
  const loadError = error ? describeLoadError(error, 'the applications') : null;

  const getJobTitle = (jobId) => {
    const j = jobs.find((j) => j.id === jobId);
    return j ? j.title : 'Deleted Position';
  };

  // Oldest-first within the current page only — the list endpoint doesn't
  // support a sort/order param, so global oldest-first ordering across pages
  // isn't available without a backend change.
  const pendingApps = useMemo(
    () => [...items].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt)),
    [items]
  );

  // Selection only ever applies to the current page's rows: reset it
  // during render (rather than an effect) when the page or filters change.
  const pageKey = `${page}|${pageSize}|${selectedJobId}|${searchTerm}`;
  const [prevPageKey, setPrevPageKey] = useState(pageKey);
  if (pageKey !== prevPageKey) {
    setPrevPageKey(pageKey);
    setSelectedIds(new Set());
  }

  const stats = {
    // Global counts from the stats endpoint.
    // "—" until the counts are known: 0 would claim an empty queue.
    pending: globalStats ? (globalStats.byStatus?.Pending ?? 0) : '—',
    // submittedToday is all-status (the stats endpoint doesn't break down by
    // status + date); close enough since same-day submissions are rarely
    // triaged same-day, but not an exact "Pending received today" count.
    today: globalStats ? (globalStats.submittedToday ?? 0) : '—',
    // Overdue has no backend aggregate — this only reflects the current
    // page's rows, not the full pending queue.
    overdue: loadError ? '—' : pendingApps.filter(
      (a) => Date.now() - new Date(a.submittedAt).getTime() >= 7 * 24 * 60 * 60 * 1000
    ).length,
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingApps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingApps.map((a) => a.id)));
    }
  };

  /* Single status change from drawer. Resolves true on success so the
     drawer's approve modal knows whether to close. */
  const handleStatusChange = async (status, input) => {
    if (!editingApp) return false;
    const updated = await reviewApplication(editingApp.id, status, input);
    refetch();
    refetchStats();
    if (!updated) return false;
    setEditingApp(null);
    return true;
  };

  const handleOpenEdit = (app) => {
    setEditingApp(app);
  };

  /* Bulk shortlist/reject — one bulk request for the rows selected on the
     current page; only failures stay selected. `input` is the batch's one
     shared payload. null = the whole request was refused: selection is kept. */
  const runBulk = async (status, input) => {
    if (selectedIds.size === 0) return null;
    const ids = pendingApps
      .filter((a) => selectedIds.has(a.id))
      .map((a) => a.id);
    const result = await bulkReviewApplications(ids, status, input);
    if (result) setSelectedIds(new Set(result.failed.map((f) => f.id)));
    refetch();
    refetchStats();
    return result;
  };

  // Shortlisting collects one shared invitation first;
  // the modal stays open if the request is refused.
  const handleBulkShortlistConfirm = async (input) => {
    setBulkInviteBusy(true);
    const result = await runBulk('Shortlisted', input);
    setBulkInviteBusy(false);
    if (result) setBulkInviteOpen(false);
  };

  // Same for bulk Reject: one shared message (and optional note).
  const handleBulkRejectConfirm = async (input) => {
    setBulkRejectBusy(true);
    const result = await runBulk('Rejected', input);
    setBulkRejectBusy(false);
    if (result) setBulkRejectOpen(false);
  };

  const daysWaiting = (dateStr) =>
    Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));

  const waitClass = (dateStr) => {
    const d = daysWaiting(dateStr);
    if (d >= 7) return 'spa-wait-alert';
    if (d >= 3) return 'spa-wait-warn';
    return 'spa-wait-ok';
  };

  return (
    <div className="spa-wrapper" id="superadmin-pending-applications-page">

      {/* Header */}
      <div className="spa-header-card">
        <div>
          <span className="spa-security-label">EXECUTIVE SECURITY LEVEL 1 · PENDING QUEUE</span>
          <h1 className="spa-title">Global Unattended Applications</h1>
          <p className="spa-subtitle">
            Cross-sector pending applications awaiting vetting. Superadmin override enables direct approval, force-reject, and document injection without standard workflow gates.
          </p>
        </div>
        <div className="spa-header-alert">
          <ShieldAlert className="spa-alert-icon" />
          <span>Override Mode Available</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="spa-stats-row">
        <div className="spa-stat-card">
          <Inbox className="spa-stat-icon" />
          <div>
            <span className="spa-stat-val">{stats.pending}</span>
            <span className="spa-stat-key">Total Pending</span>
          </div>
        </div>
        <div className="spa-stat-card">
          <Clock className="spa-stat-icon spa-icon-amber" />
          <div>
            <span className="spa-stat-val">{stats.today}</span>
            <span className="spa-stat-key">Received Today</span>
          </div>
        </div>
        <div className="spa-stat-card">
          <ShieldAlert className="spa-stat-icon spa-icon-red" />
          <div>
            <span className="spa-stat-val">{stats.overdue}</span>
            <span className="spa-stat-key">Overdue (&gt;7 days)</span>
          </div>
        </div>
        <div className="spa-stat-card">
          <UserCheck className="spa-stat-icon spa-icon-green" />
          <div>
            <span className="spa-stat-val">{selectedIds.size}</span>
            <span className="spa-stat-key">Selected</span>
          </div>
        </div>
      </div>

      {/* Filters + Bulk Actions */}
      <div className="spa-controls-card">
        <div className="spa-filters">
          <div className="spa-search-wrap">
            <Search className="spa-search-icon" />
            <input
              type="text"
              placeholder="Search candidate, email, reference, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="spa-search-input"
            />
          </div>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="spa-select"
          >
            <option value="All">All Pipelines</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title} ({j.clientOrg})</option>
            ))}
          </select>
        </div>

        {selectedIds.size > 0 && (
          <div className="spa-bulk-bar">
            <span className="spa-bulk-count">
              <Zap className="spa-bulk-zap" /> {selectedIds.size} selected
            </span>
            <button
              onClick={() => setBulkInviteOpen(true)}
              className="spa-bulk-shortlist"
            >
              <UserCheck className="spa-bulk-icon" /> Bulk Shortlist
            </button>
            <button
              onClick={() => setBulkRejectOpen(true)}
              className="spa-bulk-reject"
            >
              <UserX className="spa-bulk-icon" /> Bulk Reject
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="spa-table-card">
        <div className="spa-table-scroll">
          <table className="spa-table">
            <thead>
              <tr className="spa-thead-row">
                <th className="spa-th spa-th-check">
                  <input
                    type="checkbox"
                    className="spa-checkbox"
                    checked={pendingApps.length > 0 && selectedIds.size === pendingApps.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="spa-th">Candidate</th>
                <th className="spa-th">Pipeline / Client</th>
                <th className="spa-th spa-th-center">Docs</th>
                <th className="spa-th spa-th-center">Submitted</th>
                <th className="spa-th spa-th-center">Waiting</th>
                <th className="spa-th spa-th-right">Override Actions</th>
              </tr>
            </thead>
            <tbody className="spa-tbody">
              {isLoading && <TableLoadingRows colSpan={7} />}
              {!isLoading && loadError && (
                <TableErrorRow
                  colSpan={7}
                  message={loadError.message}
                  onRetry={loadError.canRetry ? refetch : undefined}
                />
              )}
              {!isLoading && pendingApps.map((app) => {
                const job = jobs.find((j) => j.id === app.jobId);
                return (
                  <tr key={app.id} className={`spa-row${selectedIds.has(app.id) ? ' spa-row--selected' : ''}`}>

                    <td className="spa-td spa-td-check">
                      <input
                        type="checkbox"
                        className="spa-checkbox"
                        checked={selectedIds.has(app.id)}
                        onChange={() => toggleSelect(app.id)}
                      />
                    </td>

                    <td className="spa-td">
                      <div className="spa-candidate">
                        <CandidateAvatar className="spa-avatar" name={app.applicantName} photoUrl={app.photoUrl} />
                        <div className="spa-candidate-info">
                          <span className="spa-candidate-name">{app.applicantName}</span>
                          <span className="spa-candidate-meta">{app.applicantEmail}</span>
                          <span className="spa-ref">{app.referenceId}</span>
                        </div>
                      </div>
                    </td>

                    <td className="spa-td">
                      <div className="spa-pipeline-cell">
                        <span className="spa-pipeline-role">{getJobTitle(app.jobId)}</span>
                        <span className="spa-pipeline-client">{job?.clientOrg || 'Unknown Client'}</span>
                      </div>
                    </td>

                    <td className="spa-td spa-td-center">
                      <span className="spa-doc-count">
                        {Object.keys(app.documents).length} file{Object.keys(app.documents).length !== 1 ? 's' : ''}
                      </span>
                    </td>

                    <td className="spa-td spa-td-center">
                      <span className="spa-date">{new Date(app.submittedAt).toLocaleDateString()}</span>
                    </td>

                    <td className="spa-td spa-td-center">
                      <span className={`spa-wait-badge ${waitClass(app.submittedAt)}`}>
                        {daysWaiting(app.submittedAt) === 0 ? 'Today' : `${daysWaiting(app.submittedAt)}d`}
                      </span>
                    </td>

                    <td className="spa-td spa-td-right">
                      <div className="spa-row-actions">
                        <button
                          onClick={() => handleOpenEdit(app)}
                          className="spa-open-btn"
                        >
                          Override File
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
              {!isLoading && !loadError && pendingApps.length === 0 && (
                <tr>
                  <td colSpan={7} className="spa-empty">
                    <Inbox className="spa-empty-icon" />
                    <span>No pending applications match your current query terms.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={loadError ? 0 : totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <InviteModal
        open={bulkInviteOpen}
        busy={bulkInviteBusy}
        title="Shortlist & Send Invitations"
        confirmLabel="Shortlist & Send Invites"
        recipientCount={selectedIds.size}
        description={`${selectedIds.size} applicant${selectedIds.size !== 1 ? 's' : ''} will each be emailed this invitation as soon as you send.`}
        onCancel={() => setBulkInviteOpen(false)}
        onConfirm={handleBulkShortlistConfirm}
      />

      <RejectModal
        open={bulkRejectOpen}
        busy={bulkRejectBusy}
        title="Reject & Notify Applicants"
        confirmLabel="Reject & Send Messages"
        recipientCount={selectedIds.size}
        description={`${selectedIds.size} applicant${selectedIds.size !== 1 ? 's' : ''} will each be emailed this message as soon as you send.`}
        onCancel={() => setBulkRejectOpen(false)}
        onConfirm={handleBulkRejectConfirm}
      />

      {/* Candidate Edit Drawer — superadmin mode */}
      {editingApp && (
        <CandidateEditDrawer
          app={editingApp}
          jobTitle={getJobTitle(editingApp.jobId)}
          isSuperadmin={true}
          currentUser={currentUser}
          onClose={() => setEditingApp(null)}
          onStatusChange={handleStatusChange}
          onAppUpdated={setEditingApp}
        />
      )}

    </div>
  );
}