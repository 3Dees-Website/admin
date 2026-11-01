/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { usePaginatedApplications } from '../hooks/usePaginatedApplications';
import { useApplicationStats } from '../hooks/useApplicationStats';
import { useApplications } from '../hooks/useApplications';
import { useFieldCatalog } from '../hooks/useFieldCatalog';
import { useJobs } from '../hooks/useJobs';
import { useAuth } from '../hooks/useAuth';
import { CandidateEditDrawer } from '../components/CandidateEditDrawer';
import { PaginationControls } from '../components/PaginationControls';
import { TableLoadingRows } from '../components/TableLoadingRows';
import { TableErrorRow } from '../components/TableErrorRow';
import { EgiDecisionBadge, EgiSyncBadge } from '../components/EgiBadges';
import { describeLoadError } from '../utils/describeLoadError';
import { egiDecisionFilterOptions, egiSyncFilterOptions } from '../utils/applicationStatus';
import { Search, UserCheck, ListFilter } from 'lucide-react';
import { CandidateAvatar } from '../components/CandidateAvatar';
import { PresenceBadge } from '../components/PresenceBadge';
import { EnteredByBadge } from '../components/EnteredByBadge';
import './styles/AdminShortlisted.css';

// When the application was last set to Shortlisted, from its status history.
const shortlistedAt = (app) => {
  const entry = [...(app.statusHistory || [])].reverse().find((h) => h.status === 'Shortlisted');
  return entry ? new Date(entry.timestamp).toLocaleDateString() : '—';
};

export function AdminShortlisted() {
  const { reviewApplication } = useApplications();
  const { jobs } = useJobs();
  const { currentUser } = useAuth();
  const { catalog } = useFieldCatalog();

  const [searchTerm,           setSearchTerm]           = useState('');
  const [selectedJobId,        setSelectedJobId]        = useState('All');
  const [selectedState,        setSelectedState]        = useState('All');
  const [selectedEgiDecision,  setSelectedEgiDecision]  = useState('All');
  const [selectedEgiSync,      setSelectedEgiSync]      = useState('All');
  const [editingApp,           setEditingApp]           = useState(null);

  const stateOptions = catalog?.fields.find((f) => f.key === 'stateOfOrigin')?.options || [];

  const {
    items: loadedItems, total: totalItems, page, pageSize, setPage, setPageSize, isLoading, error, refetch,
  } = usePaginatedApplications({
    status: 'Shortlisted',
    jobId: selectedJobId !== 'All' ? selectedJobId : undefined,
    stateOfOrigin: selectedState !== 'All' ? selectedState : undefined,
    egiDecision: selectedEgiDecision !== 'All' ? selectedEgiDecision : undefined,
    egiSyncStatus: selectedEgiSync !== 'All' ? selectedEgiSync : undefined,
    search: searchTerm,
  });
  const { stats: globalStats, refetch: refetchStats } = useApplicationStats();

  // On a failed load the hook still holds the last good rows (possibly from
  // a different filter). Drop them so nothing treats them as the current list.
  const items = useMemo(() => (error ? [] : loadedItems), [error, loadedItems]);
  const loadError = error ? describeLoadError(error, 'the applications') : null;

  const getJobTitle = (jobId) => {
    const j = jobs.find((j) => j.id === jobId);
    return j ? j.title : 'Deleted Position';
  };

  const stats = {
    // "—" until the counts are known: 0 would claim an empty list.
    total: globalStats ? (globalStats.byStatus?.Shortlisted ?? 0) : '—',
    matching: loadError ? '—' : totalItems,
  };

  /* Single status change from drawer */
  const handleStatusChange = async (status, input) => {
    if (!editingApp) return false;
    const updated = await reviewApplication(editingApp.id, status, input);
    refetch();
    refetchStats();
    if (!updated) return false;
    setEditingApp(null);
    return true;
  };

  const colSpan = 6;

  return (
    <div className="ash-wrapper" id="admin-shortlisted-page">

      {/* Header */}
      <div className="ash-header-card">
        <div>
          <span className="ash-page-label">SHORTLISTED</span>
          <h1 className="ash-title">Shortlisted Applications</h1>
          <p className="ash-subtitle">
            Applicants who have been shortlisted and invited. Open a candidate file to update the invitation, details and documents.
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="ash-stats-row">
        <div className="ash-stat-card">
          <UserCheck className="ash-stat-icon ash-icon-green" />
          <div>
            <span className="ash-stat-val">{stats.total}</span>
            <span className="ash-stat-key">Total Shortlisted</span>
          </div>
        </div>
        <div className="ash-stat-card">
          <ListFilter className="ash-stat-icon" />
          <div>
            <span className="ash-stat-val">{stats.matching}</span>
            <span className="ash-stat-key">Matching Filters</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="ash-controls-card">
        <div className="ash-filters">
          <div className="ash-search-wrap">
            <Search className="ash-search-icon" />
            <input
              type="text"
              placeholder="Search candidate, email, ref, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ash-search-input"
            />
          </div>
          <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} className="ash-select">
            <option value="All">All Vacancies</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
          <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="ash-select">
            <option value="All">All States</option>
            {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={selectedEgiDecision} onChange={(e) => setSelectedEgiDecision(e.target.value)} className="ash-select">
            <option value="All">All EGI Decisions</option>
            {egiDecisionFilterOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select value={selectedEgiSync} onChange={(e) => setSelectedEgiSync(e.target.value)} className="ash-select">
            <option value="All">All Sync States</option>
            {egiSyncFilterOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="ash-table-card">
        <div className="ash-table-scroll">
          <table className="ash-table">
            <thead>
              <tr className="ash-thead-row">
                <th className="ash-th">Candidate</th>
                <th className="ash-th">Applied Role</th>
                <th className="ash-th">EGI</th>
                <th className="ash-th ash-th-center">Submitted</th>
                <th className="ash-th ash-th-center">Shortlisted</th>
                <th className="ash-th ash-th-right">Actions</th>
              </tr>
            </thead>
            <tbody className="ash-tbody">
              {isLoading && <TableLoadingRows colSpan={colSpan} />}
              {!isLoading && loadError && (
                <TableErrorRow
                  colSpan={colSpan}
                  message={loadError.message}
                  onRetry={loadError.canRetry ? refetch : undefined}
                />
              )}
              {!isLoading && items.map((app) => (
                <tr key={app.id} className="ash-row">
                  <td className="ash-td">
                    <div className="ash-candidate">
                      <CandidateAvatar className="ash-avatar" name={app.applicantName} photoUrl={app.photoUrl} />
                      <div className="ash-candidate-info">
                        <span className="ash-candidate-name">{app.applicantName}</span>
                        <span className="ash-candidate-meta">{app.applicantEmail}</span>
                        <span className="ash-ref">{app.referenceId}</span>
                        <EnteredByBadge enteredBy={app.enteredBy} />
                        <PresenceBadge viewers={app.currentViewers} />
                      </div>
                    </div>
                  </td>

                  <td className="ash-td">
                    <div className="ash-role-cell">
                      <span className="ash-role-title">{getJobTitle(app.jobId)}</span>
                      <span className="ash-role-qual">{app.stateOfOrigin || '—'}</span>
                    </div>
                  </td>

                  <td className="ash-td">
                    <div className="ash-egi-cell">
                      <EgiDecisionBadge decision={app.egiDecision} />
                      <EgiSyncBadge status={app.egiSyncStatus} />
                    </div>
                  </td>

                  <td className="ash-td ash-td-center">
                    <span className="ash-date">{new Date(app.submittedAt).toLocaleDateString()}</span>
                  </td>

                  <td className="ash-td ash-td-center">
                    <span className="ash-date">{shortlistedAt(app)}</span>
                  </td>

                  <td className="ash-td ash-td-right">
                    <div className="ash-row-actions">
                      <button onClick={() => setEditingApp(app)} className="ash-open-btn" title="Open candidate file">
                        Open File
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !loadError && items.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="ash-empty">
                    <UserCheck className="ash-empty-icon" />
                    <span>No shortlisted applications match your filters.</span>
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
          onDeleted={() => {
            setEditingApp(null);
            refetch();
            refetchStats();
          }}
          onDeleteFailed={refetch}
        />
      )}

    </div>
  );
}
