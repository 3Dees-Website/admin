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
import { Search, UserCheck, ListFilter, ShieldAlert } from 'lucide-react';
import { CandidateAvatar } from '../components/CandidateAvatar';
import { PresenceBadge } from '../components/PresenceBadge';
import { EnteredByBadge } from '../components/EnteredByBadge';
import './styles/SuperadminShortlisted.css';

// When the application was last set to Shortlisted, from its status history.
const shortlistedAt = (app) => {
  const entry = [...(app.statusHistory || [])].reverse().find((h) => h.status === 'Shortlisted');
  return entry ? new Date(entry.timestamp).toLocaleDateString() : '—';
};

export function SuperadminShortlisted() {
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
    <div className="ssh-wrapper" id="superadmin-shortlisted-page">

      {/* Header */}
      <div className="ssh-header-card">
        <div>
          <span className="ssh-security-label">EXECUTIVE SECURITY LEVEL 1 · SHORTLISTED</span>
          <h1 className="ssh-title">Global Shortlisted Applications</h1>
          <p className="ssh-subtitle">
            Cross-sector shortlisted applicants awaiting scoring. Superadmin override enables invitation updates, document injection and vacancy reassignment without standard workflow gates.
          </p>
        </div>
        <div className="ssh-header-alert">
          <ShieldAlert className="ssh-alert-icon" />
          <span>Override Mode Available</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="ssh-stats-row">
        <div className="ssh-stat-card">
          <UserCheck className="ssh-stat-icon ssh-icon-green" />
          <div>
            <span className="ssh-stat-val">{stats.total}</span>
            <span className="ssh-stat-key">Total Shortlisted</span>
          </div>
        </div>
        <div className="ssh-stat-card">
          <ListFilter className="ssh-stat-icon" />
          <div>
            <span className="ssh-stat-val">{stats.matching}</span>
            <span className="ssh-stat-key">Matching Filters</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="ssh-controls-card">
        <div className="ssh-filters">
          <div className="ssh-search-wrap">
            <Search className="ssh-search-icon" />
            <input
              type="text"
              placeholder="Search candidate, email, reference, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ssh-search-input"
            />
          </div>
          <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} className="ssh-select">
            <option value="All">All Pipelines</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title} ({j.clientOrg})</option>
            ))}
          </select>
          <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="ssh-select">
            <option value="All">All States</option>
            {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={selectedEgiDecision} onChange={(e) => setSelectedEgiDecision(e.target.value)} className="ssh-select">
            <option value="All">All EGI Decisions</option>
            {egiDecisionFilterOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select value={selectedEgiSync} onChange={(e) => setSelectedEgiSync(e.target.value)} className="ssh-select">
            <option value="All">All Sync States</option>
            {egiSyncFilterOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="ssh-table-card">
        <div className="ssh-table-scroll">
          <table className="ssh-table">
            <thead>
              <tr className="ssh-thead-row">
                <th className="ssh-th">Candidate</th>
                <th className="ssh-th">Pipeline / Client</th>
                <th className="ssh-th">EGI</th>
                <th className="ssh-th ssh-th-center">Submitted</th>
                <th className="ssh-th ssh-th-center">Shortlisted</th>
                <th className="ssh-th ssh-th-right">Override Actions</th>
              </tr>
            </thead>
            <tbody className="ssh-tbody">
              {isLoading && <TableLoadingRows colSpan={colSpan} />}
              {!isLoading && loadError && (
                <TableErrorRow
                  colSpan={colSpan}
                  message={loadError.message}
                  onRetry={loadError.canRetry ? refetch : undefined}
                />
              )}
              {!isLoading && items.map((app) => (
                <tr key={app.id} className="ssh-row">
                  <td className="ssh-td">
                    <div className="ssh-candidate">
                      <CandidateAvatar className="ssh-avatar" name={app.applicantName} photoUrl={app.photoUrl} />
                      <div className="ssh-candidate-info">
                        <span className="ssh-candidate-name">{app.applicantName}</span>
                        <span className="ssh-candidate-meta">{app.applicantEmail}</span>
                        <span className="ssh-ref">{app.referenceId}</span>
                        {app.stateOfOrigin && <span className="ssh-candidate-meta">{app.stateOfOrigin}</span>}
                        <EnteredByBadge enteredBy={app.enteredBy} />
                        <PresenceBadge viewers={app.currentViewers} />
                      </div>
                    </div>
                  </td>

                  <td className="ssh-td">
                    <div className="ssh-pipeline-cell">
                      <span className="ssh-pipeline-role">{getJobTitle(app.jobId)}</span>
                      <span className="ssh-pipeline-client">{jobs.find((j) => j.id === app.jobId)?.clientOrg || 'Unknown Client'}</span>
                    </div>
                  </td>

                  <td className="ssh-td">
                    <div className="ssh-egi-cell">
                      <EgiDecisionBadge decision={app.egiDecision} />
                      <EgiSyncBadge status={app.egiSyncStatus} />
                    </div>
                  </td>

                  <td className="ssh-td ssh-td-center">
                    <span className="ssh-date">{new Date(app.submittedAt).toLocaleDateString()}</span>
                  </td>

                  <td className="ssh-td ssh-td-center">
                    <span className="ssh-date">{shortlistedAt(app)}</span>
                  </td>

                  <td className="ssh-td ssh-td-right">
                    <div className="ssh-row-actions">
                      <button onClick={() => setEditingApp(app)} className="ssh-open-btn" title="Open candidate file">
                        Override File
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !loadError && items.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="ssh-empty">
                    <UserCheck className="ssh-empty-icon" />
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
          isSuperadmin={true}
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
          onJobReassigned={() => {
            refetch();
            refetchStats();
          }}
        />
      )}

    </div>
  );
}
