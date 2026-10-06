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
import { PaginationControls } from '../components/PaginationControls';
import { TableLoadingRows } from '../components/TableLoadingRows';
import { TableErrorRow } from '../components/TableErrorRow';
import { describeLoadError } from '../utils/describeLoadError';
import { Search, Inbox, Clock, UserCheck, UserX } from 'lucide-react';
import './styles/AdminPendingApplications.css';

export function AdminPendingApplications() {
  const { reviewApplication, reviewApplicationsIndividually } = useApplications();
  const { jobs } = useJobs();
  const { currentUser } = useAuth();

  const [searchTerm,     setSearchTerm]     = useState('');
  const [selectedJobId,  setSelectedJobId]  = useState('All');
  const [editingApp,     setEditingApp]     = useState(null);
  const [selectedIds,    setSelectedIds]    = useState(new Set());

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

  /* Stats — from the global stats endpoint, not the page's rows */
  const stats = {
    // "—" until the counts are known: 0 would claim an empty queue.
    total: globalStats ? (globalStats.byStatus?.Pending ?? 0) : '—',
    // submittedToday is all-status (the stats endpoint doesn't break down by
    // status + date); close enough since same-day submissions are rarely
    // triaged same-day, but not an exact "Pending received today" count.
    today: globalStats ? (globalStats.submittedToday ?? 0) : '—',
  };

  /* Checkbox selection */
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

  /* Single status change from drawer */
  const handleStatusChange = async (status, egiNote) => {
    if (!editingApp) return false;
    const updated = await reviewApplication(editingApp.id, status, { egiNote });
    refetch();
    refetchStats();
    if (!updated) return false;
    setEditingApp(null);
    return true;
  };

  const handleOpenEdit = (app) => {
    setEditingApp(app);
  };

  /* Quick single-row shortlist */
  const handleQuickShortlist = async (app) => {
    await reviewApplication(app.id, 'Shortlisted');
    refetch();
    refetchStats();
  };

  /* Bulk shortlist/reject — applies only to rows selected on the current
     page, one request per row; only failures stay selected */
  const bulkAction = async (status) => {
    if (selectedIds.size === 0) return;
    const ids = pendingApps
      .filter((a) => selectedIds.has(a.id))
      .map((a) => a.id);
    const result = await reviewApplicationsIndividually(ids, status);
    setSelectedIds(new Set(result.failed.map((f) => f.id)));
    refetch();
    refetchStats();
  };

  const handleBulkShortlist = () => bulkAction('Shortlisted');
  const handleBulkReject = () => bulkAction('Rejected');

  /* Days waiting helper */
  const daysWaiting = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const waitClass = (dateStr) => {
    const d = daysWaiting(dateStr);
    if (d >= 7) return 'apa-wait-alert';
    if (d >= 3) return 'apa-wait-warn';
    return 'apa-wait-ok';
  };

  return (
    <div className="apa-wrapper" id="admin-pending-applications-page">

      {/* Header */}
      <div className="apa-header-card">
        <div>
          <span className="apa-page-label">PENDING QUEUE</span>
          <h1 className="apa-title">Unattended Applications</h1>
          <p className="apa-subtitle">
            Applications awaiting first review. Shortlist, reject, or open a candidate file to update details and documents.
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="apa-stats-row">
        <div className="apa-stat-card">
          <Inbox className="apa-stat-icon" />
          <div>
            <span className="apa-stat-val">{stats.total}</span>
            <span className="apa-stat-key">Total Pending</span>
          </div>
        </div>
        <div className="apa-stat-card">
          <Clock className="apa-stat-icon apa-icon-amber" />
          <div>
            <span className="apa-stat-val">{stats.today}</span>
            <span className="apa-stat-key">Received Today</span>
          </div>
        </div>
        <div className="apa-stat-card">
          <UserCheck className="apa-stat-icon apa-icon-green" />
          <div>
            <span className="apa-stat-val">{selectedIds.size}</span>
            <span className="apa-stat-key">Selected</span>
          </div>
        </div>
      </div>

      {/* Filters + Bulk Actions */}
      <div className="apa-controls-card">
        <div className="apa-filters">
          <div className="apa-search-wrap">
            <Search className="apa-search-icon" />
            <input
              type="text"
              placeholder="Search candidate, email, ref, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="apa-search-input"
            />
          </div>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="apa-select"
          >
            <option value="All">All Vacancies</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
        </div>

        {selectedIds.size > 0 && (
          <div className="apa-bulk-bar">
            <span className="apa-bulk-count">{selectedIds.size} selected</span>
            <button onClick={handleBulkShortlist} className="apa-bulk-shortlist">
              <UserCheck className="apa-bulk-icon" /> Shortlist All
            </button>
            <button onClick={handleBulkReject} className="apa-bulk-reject">
              <UserX className="apa-bulk-icon" /> Reject All
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="apa-table-card">
        <div className="apa-table-scroll">
          <table className="apa-table">
            <thead>
              <tr className="apa-thead-row">
                <th className="apa-th apa-th-check">
                  <input
                    type="checkbox"
                    className="apa-checkbox"
                    checked={pendingApps.length > 0 && selectedIds.size === pendingApps.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="apa-th">Candidate</th>
                <th className="apa-th">Applied Role</th>
                <th className="apa-th apa-th-center">Docs</th>
                <th className="apa-th apa-th-center">Submitted</th>
                <th className="apa-th apa-th-center">Waiting</th>
                <th className="apa-th apa-th-right">Actions</th>
              </tr>
            </thead>
            <tbody className="apa-tbody">
              {isLoading && <TableLoadingRows colSpan={7} />}
              {!isLoading && loadError && (
                <TableErrorRow
                  colSpan={7}
                  message={loadError.message}
                  onRetry={loadError.canRetry ? refetch : undefined}
                />
              )}
              {!isLoading && pendingApps.map((app) => (
                <tr key={app.id} className={`apa-row${selectedIds.has(app.id) ? ' apa-row--selected' : ''}`}>

                  <td className="apa-td apa-td-check">
                    <input
                      type="checkbox"
                      className="apa-checkbox"
                      checked={selectedIds.has(app.id)}
                      onChange={() => toggleSelect(app.id)}
                    />
                  </td>

                  <td className="apa-td">
                    <div className="apa-candidate">
                      <div className="apa-avatar">
                        {(app.applicantName || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="apa-candidate-info">
                        <span className="apa-candidate-name">{app.applicantName}</span>
                        <span className="apa-candidate-meta">{app.applicantEmail}</span>
                        <span className="apa-ref">{app.referenceId}</span>
                      </div>
                    </div>
                  </td>

                  <td className="apa-td">
                    <div className="apa-role-cell">
                      <span className="apa-role-title">{getJobTitle(app.jobId)}</span>
                      <span className="apa-role-qual">{app.formData.highestQualification || '—'}</span>
                    </div>
                  </td>

                  <td className="apa-td apa-td-center">
                    <span className="apa-doc-count">
                      {Object.keys(app.documents).length} file{Object.keys(app.documents).length !== 1 ? 's' : ''}
                    </span>
                  </td>

                  <td className="apa-td apa-td-center">
                    <span className="apa-date">
                      {new Date(app.submittedAt).toLocaleDateString()}
                    </span>
                  </td>

                  <td className="apa-td apa-td-center">
                    <span className={`apa-wait-badge ${waitClass(app.submittedAt)}`}>
                      {daysWaiting(app.submittedAt) === 0 ? 'Today' : `${daysWaiting(app.submittedAt)}d`}
                    </span>
                  </td>

                  <td className="apa-td apa-td-right">
                    <div className="apa-row-actions">
                      <button
                        onClick={() => handleQuickShortlist(app)}
                        className="apa-quick-shortlist"
                        title="Quick shortlist"
                      >
                        ✓ Shortlist
                      </button>
                      <button
                        onClick={() => handleOpenEdit(app)}
                        className="apa-open-btn"
                        title="Open candidate file"
                      >
                        Open File
                      </button>
                    </div>
                  </td>

                </tr>
              ))}
              {!isLoading && !loadError && pendingApps.length === 0 && (
                <tr>
                  <td colSpan={7} className="apa-empty">
                    <Inbox className="apa-empty-icon" />
                    <span>No pending applications match your filters.</span>
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

      {/* Candidate Edit Drawer */}
      {editingApp && (
        <CandidateEditDrawer
          app={editingApp}
          jobTitle={getJobTitle(editingApp.jobId)}
          isSuperadmin={false}
          currentUser={currentUser}
          onClose={() => setEditingApp(null)}
          onStatusChange={handleStatusChange}
          onAppUpdated={setEditingApp}
        />
      )}

    </div>
  );
}