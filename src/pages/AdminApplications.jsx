import React, { useState, useEffect, useCallback } from 'react';
import { useApplications } from '../hooks/useApplications';
import { usePaginatedApplications } from '../hooks/usePaginatedApplications';
import { useJobs } from '../hooks/useJobs';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Search, Download, Eye, Check, X, RefreshCw } from 'lucide-react';
import { EgiNoteModal } from '../components/EgiNoteModal';
import { EgiSyncBadge, EgiDecisionBadge } from '../components/EgiBadges';
import { PaginationControls } from '../components/PaginationControls';
import { TableLoadingRows } from '../components/TableLoadingRows';
import { applicationService } from '../services/applicationService';
import { downloadBlob } from '../utils/downloadBlob';
import './styles/AdminApplications.css';

const POLL_INTERVAL_MS = 60000;

export function AdminApplications() {
  const { reviewApplication, bulkReviewApplications } = useApplications();
  const { jobs } = useJobs();
  const { currentUser } = useAuth();
  const { addToast } = useToast();

  const [selectedJobId, setSelectedJobId] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedEgiDecision, setSelectedEgiDecision] = useState('All');
  const [selectedEgiSyncStatus, setSelectedEgiSyncStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppIds, setSelectedAppIds] = useState([]);
  const [activeApp, setActiveApp] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approving, setApproving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const filters = {
    jobId: selectedJobId !== 'All' ? selectedJobId : undefined,
    status: selectedStatus !== 'All' ? selectedStatus : undefined,
    egiDecision: selectedEgiDecision !== 'All' ? selectedEgiDecision : undefined,
    egiSyncStatus: selectedEgiSyncStatus !== 'All' ? selectedEgiSyncStatus : undefined,
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

  const statusBadgeClass = {
    Pending: 'badge badge-pending',
    Shortlisted: 'badge badge-shortlisted',
    Approved: 'badge badge-approved',
    Rejected: 'badge badge-rejected',
  };

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

  const handleBulkAction = async (status) => {
    if (selectedAppIds.length === 0) {
      addToast('info', 'Bulk Action Null', 'No applicants were selected in the active list.');
      return;
    }
    await bulkReviewApplications(selectedAppIds, status);
    setSelectedAppIds([]);
    refetch();
  };

  const handleInitiateReview = (app) => {
    setActiveApp(app);
    setAdminNotes(app.notes || '');
  };

  const handleUpdateApplicantStatus = async (status, egiNote) => {
    if (!activeApp) return;
    addToast('info', 'Status Queued', 'Running credential checks & starting portal sync...');
    const updated = await reviewApplication(activeApp.id, status, adminNotes, egiNote);
    setActiveApp(updated);
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
      downloadBlob(blob, `3DEES_Candidates_Vetting_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      addToast('success', 'CSV Statement Exported', 'Your filtered report has downloaded.');
    } catch (err) {
      addToast('error', 'CSV Compilation Issue', err?.message || 'Could not assemble tabular files.');
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
            <option value="Pending">Pending Audit</option>
            <option value="Shortlisted">Officer Shortlisted</option>
            <option value="Approved">Executive Approved (Synced)</option>
            <option value="Rejected">Compliance Rejected</option>
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
            <option value="Pending">Awaiting EGI</option>
            <option value="Accepted">Accepted by EGI</option>
            <option value="Declined">Declined by EGI</option>
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
            <option value="Pending">Not sent</option>
            <option value="Queued">Sending…</option>
            <option value="Synced">Sent</option>
            <option value="Failed">Delivery failed</option>
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
            <button onClick={() => handleBulkAction('Shortlisted')} className="btn btn-primary btn-sm">
              Bulk Shortlist Selection
            </button>
            <button onClick={() => handleBulkAction('Rejected')} className="btn btn-danger btn-sm">
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
                        <span className="candidate-name">{a.personalInfo.fullName}</span>
                        <span className="candidate-meta">{a.personalInfo.email} • {a.personalInfo.phone}</span>
                      </div>
                    </td>
                    <td className="role-cell">{getJobTitle(a.jobId)}</td>
                    <td>
                      <span className={statusBadgeClass[a.status]}>{a.status}</span>
                    </td>
                    <td className="ref-cell text-center">{a.referenceId}</td>
                    <td className="text-center">
                      <EgiSyncBadge status={a.egiSyncStatus} />
                    </td>
                    <td className="text-center">
                      <EgiDecisionBadge decision={a.egiDecision} />
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
              {!isLoading && items.length === 0 && (
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
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Slide-out Drawer */}
      {activeApp && (
        <div className="drawer-overlay">
          <div className="drawer-backdrop" onClick={() => setActiveApp(null)} />
          <div className="drawer">

            {/* Drawer Header */}
            <div className="drawer-header">
              <div>
                <span className="drawer-eyebrow">Candidacy Sheet Audit</span>
                <h2 className="drawer-title">{activeApp.personalInfo.fullName}</h2>
              </div>
              <button onClick={() => setActiveApp(null)} className="drawer-close" aria-label="Close drawer">
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
                  <span className={statusBadgeClass[activeApp.status]}>{activeApp.status}</span>
                </div>
              </div>

              {/* EGI Sync & Decision */}
              <div className="drawer-section">
                <h3 className="drawer-section-title">EGI Sync &amp; Decision</h3>
                <div className="info-grid">
                  <div><strong>Delivery to EGI:</strong> <EgiSyncBadge status={activeApp.egiSyncStatus} /></div>
                  <div><strong>EGI Decision:</strong> <EgiDecisionBadge decision={activeApp.egiDecision} /></div>
                  {activeApp.egiNote && (
                    <div className="col-span-2">
                      <strong>Note sent to EGI:</strong>
                      <p className="info-address">{activeApp.egiNote}</p>
                    </div>
                  )}
                  {activeApp.egiDecision === 'Declined' && activeApp.egiDecisionNote && (
                    <div className="col-span-2">
                      <strong>EGI's decline reason:</strong>
                      <p className="info-address">{activeApp.egiDecisionNote}</p>
                    </div>
                  )}
                  {activeApp.egiDecisionBy && (
                    <div>
                      <strong>Decided by:</strong>{' '}
                      <span className="info-value">
                        {activeApp.egiDecisionBy}
                        {activeApp.egiDecisionAt && ` on ${new Date(activeApp.egiDecisionAt).toLocaleDateString()}`}
                      </span>
                    </div>
                  )}
                  {activeApp.egiReferenceId && (
                    <div><strong>EGI reference:</strong> <span className="info-value">{activeApp.egiReferenceId}</span></div>
                  )}
                </div>
              </div>

              {/* Biography */}
              <div className="drawer-section">
                <h3 className="drawer-section-title">Candidate Biography</h3>
                <div className="info-grid">
                  <div><strong>Email contact:</strong> <span className="info-value">{activeApp.personalInfo.email}</span></div>
                  <div><strong>Phone line:</strong> <span className="info-value">{activeApp.personalInfo.phone}</span></div>
                  <div><strong>Gender:</strong> <span className="info-value">{activeApp.personalInfo.gender}</span></div>
                  {activeApp.personalInfo.dob && (
                    <div><strong>Date of Birth:</strong> <span className="info-value">{activeApp.personalInfo.dob}</span></div>
                  )}
                  {activeApp.personalInfo.stateOfOrigin && (
                    <div>
                      <strong>State/LGA:</strong>{' '}
                      <span className="info-value">
                        {activeApp.personalInfo.stateOfOrigin} (LGA: {activeApp.personalInfo.lga || 'None'})
                      </span>
                    </div>
                  )}
                  <div className="col-span-2">
                    <strong>Residence address:</strong>
                    <p className="info-address">{activeApp.personalInfo.residentialAddress}</p>
                  </div>
                </div>
              </div>

              {/* Intellectual Assets */}
              <div className="drawer-section">
                <h3 className="drawer-section-title">Intellectual Assets</h3>
                <div className="info-grid">
                  <div><strong>Highest Qualification:</strong> <span className="info-value">{activeApp.educationInfo.highestQualification}</span></div>
                  <div><strong>Graduation Academy:</strong> <span className="info-value">{activeApp.educationInfo.institution}</span></div>
                  <div><strong>Year Graduated:</strong> <span className="info-value">{activeApp.educationInfo.yearOfGraduation}</span></div>
                  <div><strong>Years Experience:</strong> <span className="info-value">{activeApp.educationInfo.yearsOfExperience || '0'} Years</span></div>
                  {activeApp.educationInfo.currentEmployer && (
                    <div className="col-span-2"><strong>Last Sponsor Org:</strong> <span className="info-value">{activeApp.educationInfo.currentEmployer}</span></div>
                  )}
                  <div className="col-span-2">
                    <strong>Work history statement summary:</strong>
                    <p className="info-address">{activeApp.educationInfo.workSummary}</p>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div className="drawer-section">
                <h3 className="drawer-section-title">Supporting Dossier Files</h3>
                <div className="docs-grid">
                  {Object.entries(activeApp.documents).map(([key, fileObj]) => {
                    if (!fileObj) return null;
                    return (
                      <div key={key} className="doc-card">
                        <div className="doc-info">
                          <h4 className="doc-key">{key}</h4>
                          <p className="doc-name">{fileObj.name}</p>
                          <span className="doc-meta">{fileObj.size} • {fileObj.type.split('/').pop()?.toUpperCase()}</span>
                        </div>
                        <a
                          href={fileObj.url}
                          download={fileObj.name}
                          onClick={() => addToast('success', 'File Download Initiated', `Opening mock stream for ${fileObj.name}`)}
                          className="doc-download-btn"
                        >
                          <Download size={16} />
                        </a>
                      </div>
                    );
                  })}
                  {Object.keys(activeApp.documents).length === 0 && (
                    <div className="col-span-2 docs-empty">
                      This vacancy required no administrative document folder submissions.
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Notes */}
              <div className="drawer-notes">
                <label className="filter-label">Administrative Audit Notes &amp; Directives</label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Annotate credential discrepancies, background check remarks, or specific vetting approvals here..."
                  className="notes-textarea"
                />
              </div>

              {/* Audit Trace */}
              <div className="drawer-section">
                <h4 className="audit-trace-title">Candidacy Evaluation Audit Trace</h4>
                <div className="audit-trace-list">
                  {activeApp.statusHistory.map((hist, idx) => (
                    <div key={idx} className="audit-trace-item">
                      <span>
                        Vetted to <strong className="trace-status">{hist.status}</strong> by{' '}
                        <span className="trace-officer">{hist.changedBy}</span>
                      </span>
                      <span className="trace-date">
                        {new Date(hist.timestamp).toLocaleDateString()}{' '}
                        {new Date(hist.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="drawer-footer">
              <span className="drawer-sync-label">
                <RefreshCw size={14} className="spin-icon" /> EGI database sync live
              </span>
              <div className="drawer-footer-actions">
                <button
                  type="button"
                  onClick={() => handleUpdateApplicantStatus('Rejected')}
                  className="btn btn-reject"
                >
                  Reject Dossier
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateApplicantStatus('Shortlisted')}
                  className="btn btn-shortlist"
                >
                  Shortlist
                </button>
                <button
                  type="button"
                  onClick={() => setShowApproveModal(true)}
                  className="btn btn-approve"
                >
                  <Check size={16} />
                  <span>Approve &amp; Sync</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <EgiNoteModal
        open={showApproveModal}
        busy={approving}
        description={activeApp ? `Approving ${activeApp.personalInfo.fullName} sends this note to EGI along with the candidate record.` : ''}
        onCancel={() => setShowApproveModal(false)}
        onConfirm={handleApproveConfirm}
      />
    </div>
  );
}