/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApplications } from '../hooks/useApplications';
import { useJobs } from '../hooks/useJobs';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Search, ShieldAlert, RefreshCw, X } from 'lucide-react';
import { EgiNoteModal } from '../components/EgiNoteModal';
import { EgiSyncBadge, EgiDecisionBadge } from '../components/EgiBadges';
import './styles/SuperadminViewAllApplications.css';

const POLL_INTERVAL_MS = 60000;

export function SuperadminViewAllApplications() {
  const { applications, reviewApplication, refreshApplications } = useApplications();
  const { jobs } = useJobs();
  const { currentUser } = useAuth();
  const { addToast } = useToast();

  const [selectedJobId, setSelectedJobId] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeApp, setActiveApp] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approving, setApproving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const ok = await refreshApplications();
    setIsRefreshing(false);
    if (!ok) {
      addToast('error', 'Refresh Failed', 'Could not refresh applications from the server.');
    }
  }, [refreshApplications, addToast]);

  useEffect(() => {
    refreshApplications();

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshApplications();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusClasses = {
    Pending: 'status-pending',
    Shortlisted: 'status-shortlisted',
    Approved: 'status-approved',
    Rejected: 'status-rejected',
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

  function handleInitiateReview(app) {
    setActiveApp(app);
    setAdminNotes(app.notes || '');
  }

  const handleUpdateApplicantStatus = async (status, egiNote) => {
    if (!activeApp) return;
    addToast('info', 'Execute Oversight Trigger', `Writing compliance check to ${status}...`);
    await reviewApplication(activeApp.id, status, adminNotes, egiNote);
    const updatedModel = applications.find((a) => a.id === activeApp.id);
    if (updatedModel) {
      setActiveApp(updatedModel);
    } else {
      setActiveApp(null);
    }
  };

  const handleApproveConfirm = async (egiNote) => {
    setApproving(true);
    await handleUpdateApplicantStatus('Approved', egiNote);
    setApproving(false);
    setShowApproveModal(false);
  };

  const handleExportCSV = () => {
    if (filteredApps.length === 0) return;
    try {
      const hStr = 'ReferenceStamp,ApplicantName,Email,Phone,RoleApplied,HighestQualification,Status,SyncState,EGI Decision,EGI Decision Note,SubmissionDate';
      const rows = filteredApps.map((a) => [
        `"${a.referenceId}"`, `"${a.personalInfo.fullName}"`, `"${a.personalInfo.email}"`,
        `"${a.personalInfo.phone}"`, `"${getJobTitle(a.jobId)}"`, `"${a.educationInfo.highestQualification}"`,
        `"${a.status}"`, `"${a.egiSyncStatus}"`,
        `"${a.egiDecision || ''}"`, `"${(a.egiDecisionNote || '').replace(/"/g, '""')}"`,
        `"${new Date(a.submittedAt).toLocaleDateString()}"`
      ]);
      const csvContent = [hStr, ...rows.map((r) => r.join(','))].join('\n');
      const bObj = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const lnk = document.createElement('a');
      lnk.setAttribute('href', URL.createObjectURL(bObj));
      lnk.setAttribute('download', '3DEES_All_Sponsor_Dossiers_Evaluations.csv');
      document.body.appendChild(lnk);
      lnk.click();
      document.body.removeChild(lnk);
      addToast('success', 'Master Ledger Exported', 'Generated superadmin summary report.');
    } catch {
      addToast('error', 'CSV Crash', 'Encountered compilation failure.');
    }
  };

  return (
    <div className="sva-wrapper" id="superadmin-applications-workspace">

      {/* Page Header */}
      <div className="sva-header-card">
        <div>
          <span className="sva-security-label">EXECUTIVE SECURITY LEVEL 1</span>
          <h1 className="sva-title">Central Placements Ledger (All Sectors)</h1>
          <p className="sva-subtitle">Universal overview targeting cross-departmental agronomy, engineering, finance and logistics slots.</p>
        </div>
        <div className="sva-header-actions">
          <button
            onClick={handleManualRefresh}
            className="sva-refresh-btn"
            id="btn-refresh-applications"
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={isRefreshing ? 'sva-spin-icon' : ''} />
            <span>Refresh</span>
          </button>
          <button onClick={handleExportCSV} className="sva-export-btn">
            Export Universal Tabular Report
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="sva-filters-card">
        <div className="sva-filter-group">
          <label className="sva-filter-label">Search Dossiers Map</label>
          <div className="sva-search-wrapper">
            <Search className="sva-search-icon" />
            <input
              type="text"
              placeholder="Search by candidate, code, or qualification..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sva-search-input"
            />
          </div>
        </div>

        <div className="sva-filter-group">
          <label className="sva-filter-label">Client Vetting Pipeline</label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="sva-select"
          >
            <option value="All">All Jobs Across Nigeria</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} ({j.clientOrg})
              </option>
            ))}
          </select>
        </div>

        <div className="sva-filter-group">
          <label className="sva-filter-label">Evaluations Filtering Block</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="sva-select"
          >
            <option value="All">All Vetting Outcomes</option>
            <option value="Pending">Pending Audit</option>
            <option value="Shortlisted">Officer Shortlisted</option>
            <option value="Approved">Executive Approved (Synced)</option>
            <option value="Rejected">Compliance Rejected</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="sva-table-card">
        <div className="sva-table-scroll">
          <table className="sva-table">
            <thead>
              <tr className="sva-thead-row">
                <th className="sva-th">Applicant Name</th>
                <th className="sva-th">Pipeline Role Target</th>
                <th className="sva-th">Candidacy State</th>
                <th className="sva-th sva-th-center">Reference Stamp</th>
                <th className="sva-th sva-th-center">Sync Gateway</th>
                <th className="sva-th sva-th-center">EGI Decision</th>
                <th className="sva-th sva-th-right">Operation Audit</th>
              </tr>
            </thead>
            <tbody className="sva-tbody">
              {filteredApps.map((a) => (
                <tr key={a.id} className="sva-row">
                  <td className="sva-td">
                    <div className="sva-applicant-info">
                      <span className="sva-applicant-name">{a.personalInfo.fullName}</span>
                      <span className="sva-applicant-meta">{a.personalInfo.email} • {a.personalInfo.phone}</span>
                    </div>
                  </td>
                  <td className="sva-td sva-job-title">{getJobTitle(a.jobId)}</td>
                  <td className="sva-td">
                    <span className={`sva-status-badge ${statusClasses[a.status]}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="sva-td sva-td-center sva-ref-id">{a.referenceId}</td>
                  <td className="sva-td sva-td-center">
                    <EgiSyncBadge status={a.egiSyncStatus} />
                  </td>
                  <td className="sva-td sva-td-center">
                    <EgiDecisionBadge decision={a.egiDecision} />
                  </td>
                  <td className="sva-td sva-td-right">
                    <button
                      onClick={() => handleInitiateReview(a)}
                      className="sva-review-btn"
                      id={`super-review-btn-${a.id}`}
                    >
                      Audit & Override
                    </button>
                  </td>
                </tr>
              ))}
              {filteredApps.length === 0 && (
                <tr>
                  <td colSpan={7} className="sva-empty-row">
                    No placement dossiers correspond with currently active queries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer Overlay */}
      {activeApp && (
        <div className="sva-overlay">
          <div className="sva-overlay-backdrop" onClick={() => setActiveApp(null)} />

          <div className="sva-drawer">
            {/* Drawer Header */}
            <div className="sva-drawer-header">
              <div>
                <span className="sva-drawer-label">SUPERADMIN SECURE OVERRIDE</span>
                <h2 className="sva-drawer-name">{activeApp.personalInfo.fullName}</h2>
              </div>
              <button onClick={() => setActiveApp(null)} className="sva-drawer-close">
                <X className="sva-close-icon" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="sva-drawer-body">

              {/* Warning Banner */}
              <div className="sva-warning-banner">
                <ShieldAlert className="sva-warning-icon" />
                <div>
                  <strong className="sva-warning-title">Warning: Compliance Override Mode Active</strong>
                  <div className="sva-warning-text">
                    Status adjustments executed by Superadmins bypass the general screening buffer. All edits will log directly to the central compliance audit register.
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="sva-details-grid">
                <div><strong>Evaluation Stamp:</strong> <span className="sva-ref-mono">{activeApp.referenceId}</span></div>
                <div><strong>Current evaluation state:</strong> <span className="sva-current-status">{activeApp.status}</span></div>
                <div><strong>Target Position:</strong> <span className="sva-detail-muted">{getJobTitle(activeApp.jobId)}</span></div>
                <div><strong>Client Sponsoring:</strong> <span className="sva-detail-dark">{jobs.find((j) => j.id === activeApp.jobId)?.clientOrg || 'Unknown Client'}</span></div>
              </div>

              {/* EGI Sync & Decision */}
              <div className="sva-egi-group">
                <label className="sva-filter-label">EGI Sync &amp; Decision</label>
                <div className="sva-egi-row">
                  <span>Delivery to EGI</span>
                  <EgiSyncBadge status={activeApp.egiSyncStatus} />
                </div>
                <div className="sva-egi-row">
                  <span>EGI Decision</span>
                  <EgiDecisionBadge decision={activeApp.egiDecision} />
                </div>
                {activeApp.egiNote && (
                  <p className="sva-egi-note"><strong>Note sent to EGI:</strong> {activeApp.egiNote}</p>
                )}
                {activeApp.egiDecision === 'Declined' && activeApp.egiDecisionNote && (
                  <p className="sva-egi-note sva-egi-note--declined"><strong>EGI's decline reason:</strong> {activeApp.egiDecisionNote}</p>
                )}
                {activeApp.egiDecisionBy && (
                  <span className="sva-egi-meta">
                    Decided by {activeApp.egiDecisionBy}
                    {activeApp.egiDecisionAt && ` on ${new Date(activeApp.egiDecisionAt).toLocaleDateString()}`}
                  </span>
                )}
                {activeApp.egiReferenceId && (
                  <span className="sva-egi-meta">EGI reference: {activeApp.egiReferenceId}</span>
                )}
              </div>

              {/* Notes */}
              <div className="sva-notes-group">
                <label className="sva-filter-label">Compliance Override Annotations</label>
                <textarea
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Annotate specific reasons regarding credential bypasses, reference audits verification, or general oversight directives..."
                  className="sva-textarea"
                />
              </div>

              {/* Status History */}
              <div className="sva-history-group">
                <h4 className="sva-history-title">Dossier Evaluation Audit History</h4>
                <div className="sva-history-list">
                  {activeApp.statusHistory.map((hist, idx) => (
                    <div key={idx} className="sva-history-item">
                      <span>• Vetted to <strong className="sva-history-status">{hist.status}</strong> by <span className="sva-history-by">{hist.changedBy}</span></span>
                      <span className="sva-history-time">
                        {new Date(hist.timestamp).toLocaleDateString()} {new Date(hist.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="sva-drawer-footer">
              <span className="sva-sync-status">
                <RefreshCw className="sva-spin-icon" /> Multi-Ref Handshakes active
              </span>
              <div className="sva-action-btns">
                <button onClick={() => handleUpdateApplicantStatus('Rejected')} className="sva-btn-reject">
                  Reject & Block
                </button>
                <button onClick={() => handleUpdateApplicantStatus('Shortlisted')} className="sva-btn-shortlist">
                  Force Shortlist
                </button>
                <button onClick={() => setShowApproveModal(true)} className="sva-btn-approve">
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
        description={activeApp ? `Approving ${activeApp.personalInfo.fullName} sends this note to EGI along with the candidate record.` : ''}
        onCancel={() => setShowApproveModal(false)}
        onConfirm={handleApproveConfirm}
      />
    </div>
  );
}