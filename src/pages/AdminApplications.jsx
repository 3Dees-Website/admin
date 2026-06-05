import React, { useState, useMemo } from 'react';
import { useApplications } from '../hooks/useApplications';
import { useJobs } from '../hooks/useJobs';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Search, Download, Eye, Check, X, RefreshCw } from 'lucide-react';
import './styles/AdminApplications.css';

export function AdminApplications() {
  const { applications, reviewApplication, bulkReviewApplications } = useApplications();
  const { jobs } = useJobs();
  const { currentUser } = useAuth();
  const { addToast } = useToast();

  const [selectedJobId, setSelectedJobId] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppIds, setSelectedAppIds] = useState([]);
  const [activeApp, setActiveApp] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');

  const statusBadgeClass = {
    Pending: 'badge badge-pending',
    Shortlisted: 'badge badge-shortlisted',
    Approved: 'badge badge-approved',
    Rejected: 'badge badge-rejected',
  };

  const syncBadgeClass = {
    Synced: 'badge badge-sync-synced',
    Pending: 'badge badge-sync-pending',
  };

  const getJobTitle = (jobId) => {
    const found = jobs.find((j) => j.id === jobId);
    return found ? found.title : 'Deleted Position';
  };

  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchesJob = selectedJobId === 'All' || app.jobId === selectedJobId;
      const matchesStatus = selectedStatus === 'All' || app.status === selectedStatus;
      const searchLower = searchTerm.toLowerCase();
      const jobTitle = getJobTitle(app.jobId).toLowerCase();
      const matchesSearch =
        app.personalInfo.fullName.toLowerCase().includes(searchLower) ||
        app.personalInfo.email.toLowerCase().includes(searchLower) ||
        app.referenceId.toLowerCase().includes(searchLower) ||
        jobTitle.includes(searchLower);
      return matchesJob && matchesStatus && matchesSearch;
    });
  }, [applications, selectedJobId, selectedStatus, searchTerm, jobs]);

  const handleToggleSelectAll = () => {
    if (selectedAppIds.length === filteredApps.length) {
      setSelectedAppIds([]);
    } else {
      setSelectedAppIds(filteredApps.map((a) => a.id));
    }
  };

  const handleToggleSelectOne = (id) => {
    if (selectedAppIds.includes(id)) {
      setSelectedAppIds(selectedAppIds.filter((item) => item !== id));
    } else {
      setSelectedAppIds([...selectedAppIds, id]);
    }
  };

  const handleBulkAction = (status) => {
    if (selectedAppIds.length === 0) {
      addToast('info', 'Bulk Action Null', 'No applicants were selected in the active list.');
      return;
    }
    bulkReviewApplications(selectedAppIds, status);
    setSelectedAppIds([]);
  };

  const handleInitiateReview = (app) => {
    setActiveApp(app);
    setAdminNotes(app.notes || '');
  };

  const handleUpdateApplicantStatus = async (status) => {
    if (!activeApp) return;
    addToast('info', 'Status Queued', 'Running credential checks & starting portal sync...');
    await reviewApplication(activeApp.id, status, adminNotes);
    const updatedModel = applications.find((a) => a.id === activeApp.id);
    if (updatedModel) {
      setActiveApp(updatedModel);
    } else {
      setActiveApp(null);
    }
  };

  const handleExportCSV = () => {
    if (filteredApps.length === 0) {
      addToast('error', 'CSV Export Null', 'The matching applicant list carries no active rows.');
      return;
    }
    try {
      const headers = [
        'ReferenceStamp', 'ApplicantName', 'Email', 'Phone', 'RoleApplied',
        'Qualification', 'WorkExperienceYears', 'Status', 'SyncState', 'SubmissionDate'
      ];
      const rows = filteredApps.map((a) => [
        `"${a.referenceId}"`,
        `"${a.personalInfo.fullName}"`,
        `"${a.personalInfo.email}"`,
        `"${a.personalInfo.phone}"`,
        `"${getJobTitle(a.jobId)}"`,
        `"${a.educationInfo.highestQualification}"`,
        `"${a.educationInfo.yearsOfExperience || '0'}"`,
        `"${a.status}"`,
        `"${a.egiSyncStatus}"`,
        `"${new Date(a.submittedAt).toLocaleDateString()}"`,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `3DEES_Candidates_Vetting_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('success', 'CSV Statement Exported', `Generated report with ${filteredApps.length} rows.`);
    } catch (err) {
      addToast('error', 'CSV Compilation Issue', 'Could not assemble tabular files.');
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
        <button onClick={handleExportCSV} className="btn btn-dark" id="btn-export-dossiers">
          <Download size={16} className="icon-primary" />
          <span>Export filtered CSV report</span>
        </button>
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
                    checked={filteredApps.length > 0 && selectedAppIds.length === filteredApps.length}
                    onChange={handleToggleSelectAll}
                    className="checkbox"
                  />
                </th>
                <th>Name &amp; Contacts</th>
                <th>Position App</th>
                <th>Review State</th>
                <th className="text-center">Reference Stamp</th>
                <th className="text-center">Sync Gateway</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredApps.map((a) => {
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
                      <span className={syncBadgeClass[a.egiSyncStatus]}>
                        {a.egiSyncStatus === 'Synced' ? 'Synced to EGI' : 'Sync Pending'}
                      </span>
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
              {filteredApps.length === 0 && (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No active candidacies match your currently selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
                  onClick={() => handleUpdateApplicantStatus('Approved')}
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
    </div>
  );
}