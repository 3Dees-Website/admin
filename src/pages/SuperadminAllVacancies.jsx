/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { useJobs } from '../hooks/useJobs';
import { useApplications } from '../hooks/useApplications';
import { useToast } from '../hooks/useToast';
import { Search, X, Briefcase, MapPin, Users, CalendarClock, ShieldAlert } from 'lucide-react';
import './styles/SuperadminAllVacancies.css';

const CATEGORIES = ['All', 'Agriculture', 'Construction', 'Administration', 'Logistics', 'Finance'];
const STATUSES   = ['All', 'Active', 'Closed', 'Paused'];

export function SuperadminAllVacancies() {
  const { jobs, removeJob, editJob } = useJobs();
  const { applications } = useApplications();
  const { addToast } = useToast();

  const [searchTerm,      setSearchTerm]      = useState('');
  const [selectedCat,     setSelectedCat]     = useState('All');
  const [selectedStatus,  setSelectedStatus]  = useState('All');
  const [activeJob,       setActiveJob]       = useState(null);
  const [confirmDelete,   setConfirmDelete]   = useState(null);

  /* ── Derived counts ── */
  const appCountFor = (jobId) =>
    applications.filter((a) => a.jobId === jobId).length;

  const approvedCountFor = (jobId) =>
    applications.filter((a) => a.jobId === jobId && a.status === 'Approved').length;

  /* ── Filtered list ── */
  const filteredJobs = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return jobs.filter((j) => {
      const matchesCat    = selectedCat    === 'All' || j.category === selectedCat;
      const matchesStatus = selectedStatus === 'All' || j.status   === selectedStatus;
      const matchesSearch =
        j.title.toLowerCase().includes(q)       ||
        j.clientOrg.toLowerCase().includes(q)   ||
        j.location.toLowerCase().includes(q)    ||
        j.category.toLowerCase().includes(q);
      return matchesCat && matchesStatus && matchesSearch;
    });
  }, [jobs, searchTerm, selectedCat, selectedStatus]);

  /* ── Summary stats ── */
  const stats = useMemo(() => ({
    total:    jobs.length,
    active:   jobs.filter((j) => j.status === 'Active').length,
    closed:   jobs.filter((j) => j.status === 'Closed').length,
    openings: jobs.reduce((sum, j) => sum + (Number(j.openings) || 0), 0),
  }), [jobs]);

  /* ── Status toggle (Active ↔ Closed) ── */
  const handleToggleStatus = (job) => {
    const newStatus = job.status === 'Active' ? 'Closed' : 'Active';
    editJob({ ...job, status: newStatus });
    addToast('info', 'Vacancy Status Updated', `"${job.title}" is now ${newStatus}.`);
    if (activeJob && activeJob.id === job.id) {
      setActiveJob({ ...job, status: newStatus });
    }
  };

  /* ── Force-delete ── */
  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    removeJob(confirmDelete.id);
    setConfirmDelete(null);
    if (activeJob && activeJob.id === confirmDelete.id) setActiveJob(null);
  };

  /* ── CSV export ── */
  const handleExport = () => {
    if (filteredJobs.length === 0) return;
    try {
      const header = 'Title,ClientOrg,Category,Type,Location,Openings,SalaryRange,Status,ClosingDate,PostedBy,TotalApplicants,Approved';
      const rows = filteredJobs.map((j) => [
        `"${j.title}"`, `"${j.clientOrg}"`, `"${j.category}"`,
        `"${j.type}"`,  `"${j.location}"`,  `"${j.openings}"`,
        `"${j.salaryRange}"`, `"${j.status}"`, `"${j.closingDate}"`,
        `"${j.postedBy}"`,
        `"${appCountFor(j.id)}"`,
        `"${approvedCountFor(j.id)}"`,
      ]);
      const csv  = [header, ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href     = URL.createObjectURL(blob);
      link.download = '3DEES_All_Vacancies_Ledger.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('success', 'Vacancies Exported', 'Full vacancies ledger downloaded as CSV.');
    } catch {
      addToast('error', 'Export Failed', 'Could not generate CSV report.');
    }
  };

  /* ── Closing date urgency ── */
  const daysUntilClose = (dateStr) => {
    const diff = new Date(dateStr) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const closingClass = (dateStr) => {
    const d = daysUntilClose(dateStr);
    if (d < 0)  return 'sav-close-expired';
    if (d <= 7) return 'sav-close-urgent';
    return 'sav-close-ok';
  };

  const closingLabel = (dateStr) => {
    const d = daysUntilClose(dateStr);
    if (d < 0)  return 'Expired';
    if (d === 0) return 'Closes today';
    if (d === 1) return '1 day left';
    return `${d} days left`;
  };

  return (
    <div className="sav-wrapper" id="superadmin-vacancies-workspace">

      {/* ── Page Header ── */}
      <div className="sav-header-card">
        <div>
          <span className="sav-security-label">EXECUTIVE SECURITY LEVEL 1</span>
          <h1 className="sav-title">Central Vacancies Ledger (All Sectors)</h1>
          <p className="sav-subtitle">
            Universal overview of all active, paused, and closed client recruitment pipelines across Nigeria.
          </p>
        </div>
        <button onClick={handleExport} className="sav-export-btn">
          Export Vacancies Report
        </button>
      </div>

      {/* ── Summary Metrics ── */}
      <div className="sav-metrics-row">
        <div className="sav-metric">
          <span className="sav-metric-label">Total Vacancies</span>
          <span className="sav-metric-value">{stats.total}</span>
        </div>
        <div className="sav-metric">
          <span className="sav-metric-label">Active Pipelines</span>
          <span className="sav-metric-value sav-metric-green">{stats.active}</span>
        </div>
        <div className="sav-metric">
          <span className="sav-metric-label">Closed Slots</span>
          <span className="sav-metric-value sav-metric-muted">{stats.closed}</span>
        </div>
        <div className="sav-metric">
          <span className="sav-metric-label">Total Openings</span>
          <span className="sav-metric-value sav-metric-orange">{stats.openings}</span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="sav-filters-card">
        <div className="sav-filter-group">
          <label className="sav-filter-label">Search Vacancies</label>
          <div className="sav-search-wrapper">
            <Search className="sav-search-icon" />
            <input
              type="text"
              placeholder="Search by title, client, location, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sav-search-input"
            />
          </div>
        </div>

        <div className="sav-filter-group">
          <label className="sav-filter-label">Sector Category</label>
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="sav-select"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c === 'All' ? 'All Sectors' : c}</option>
            ))}
          </select>
        </div>

        <div className="sav-filter-group">
          <label className="sav-filter-label">Pipeline Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="sav-select"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="sav-table-card">
        <div className="sav-table-scroll">
          <table className="sav-table">
            <thead>
              <tr className="sav-thead-row">
                <th className="sav-th">Vacancy / Client</th>
                <th className="sav-th">Sector & Type</th>
                <th className="sav-th sav-th-center">Openings</th>
                <th className="sav-th sav-th-center">Applicants</th>
                <th className="sav-th sav-th-center">Pipeline State</th>
                <th className="sav-th sav-th-center">Closing Date</th>
                <th className="sav-th sav-th-right">Operations</th>
              </tr>
            </thead>
            <tbody className="sav-tbody">
              {filteredJobs.map((job) => (
                <tr key={job.id} className="sav-row">

                  {/* Vacancy / Client */}
                  <td className="sav-td">
                    <div className="sav-job-info">
                      <span className="sav-job-title">{job.title}</span>
                      <span className="sav-job-client">{job.clientOrg}</span>
                      <span className="sav-job-location">
                        <MapPin className="sav-loc-icon" /> {job.location}
                      </span>
                    </div>
                  </td>

                  {/* Sector & Type */}
                  <td className="sav-td">
                    <div className="sav-sector-cell">
                      <span className="sav-category-badge">{job.category}</span>
                      <span className="sav-type-label">{job.type}</span>
                    </div>
                  </td>

                  {/* Openings */}
                  <td className="sav-td sav-td-center">
                    <span className="sav-openings-badge">
                      <Users className="sav-openings-icon" /> {job.openings}
                    </span>
                  </td>

                  {/* Applicants */}
                  <td className="sav-td sav-td-center">
                    <div className="sav-applicant-counts">
                      <span className="sav-total-apps">{appCountFor(job.id)} total</span>
                      <span className="sav-approved-apps">{approvedCountFor(job.id)} approved</span>
                    </div>
                  </td>

                  {/* Pipeline State */}
                  <td className="sav-td sav-td-center">
                    <span className={`sav-status-badge sav-status-${(job.status || 'Active').toLowerCase()}`}>
                      {job.status || 'Active'}
                    </span>
                  </td>

                  {/* Closing Date */}
                  <td className="sav-td sav-td-center">
                    <div className="sav-closing-cell">
                      <span className="sav-closing-date">
                        {new Date(job.closingDate).toLocaleDateString()}
                      </span>
                      <span className={`sav-closing-tag ${closingClass(job.closingDate)}`}>
                        {closingLabel(job.closingDate)}
                      </span>
                    </div>
                  </td>

                  {/* Operations */}
                  <td className="sav-td sav-td-right">
                    <div className="sav-action-group">
                      <button
                        onClick={() => setActiveJob(job)}
                        className="sav-audit-btn"
                      >
                        Audit & Override
                      </button>
                    </div>
                  </td>

                </tr>
              ))}
              {filteredJobs.length === 0 && (
                <tr>
                  <td colSpan={7} className="sav-empty-row">
                    No vacancy records correspond with currently active query terms.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Drawer Overlay ── */}
      {activeJob && (
        <div className="sav-overlay">
          <div className="sav-overlay-backdrop" onClick={() => setActiveJob(null)} />

          <div className="sav-drawer">

            {/* Drawer Header */}
            <div className="sav-drawer-header">
              <div>
                <span className="sav-drawer-label">SUPERADMIN VACANCY OVERRIDE</span>
                <h2 className="sav-drawer-name">{activeJob.title}</h2>
                <span className="sav-drawer-client">{activeJob.clientOrg}</span>
              </div>
              <button onClick={() => setActiveJob(null)} className="sav-drawer-close">
                <X className="sav-close-icon" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="sav-drawer-body">

              {/* Warning Banner */}
              <div className="sav-warning-banner">
                <ShieldAlert className="sav-warning-icon" />
                <div>
                  <strong className="sav-warning-title">Warning: Superadmin Override Mode Active</strong>
                  <div className="sav-warning-text">
                    Vacancy status changes and force-deletions executed here bypass standard admin workflows and are logged immediately to the compliance audit register.
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="sav-details-grid">
                <div className="sav-detail-item">
                  <span className="sav-detail-key">Category</span>
                  <span className="sav-detail-val">{activeJob.category}</span>
                </div>
                <div className="sav-detail-item">
                  <span className="sav-detail-key">Employment Type</span>
                  <span className="sav-detail-val">{activeJob.type}</span>
                </div>
                <div className="sav-detail-item">
                  <span className="sav-detail-key">Location</span>
                  <span className="sav-detail-val">{activeJob.location}</span>
                </div>
                <div className="sav-detail-item">
                  <span className="sav-detail-key">Openings</span>
                  <span className="sav-detail-val">{activeJob.openings} slot(s)</span>
                </div>
                <div className="sav-detail-item">
                  <span className="sav-detail-key">Salary Range</span>
                  <span className="sav-detail-val">{activeJob.salaryRange}</span>
                </div>
                <div className="sav-detail-item">
                  <span className="sav-detail-key">Closing Date</span>
                  <span className={`sav-detail-val ${closingClass(activeJob.closingDate)}`}>
                    {new Date(activeJob.closingDate).toLocaleDateString()} — {closingLabel(activeJob.closingDate)}
                  </span>
                </div>
                <div className="sav-detail-item">
                  <span className="sav-detail-key">Posted By</span>
                  <span className="sav-detail-val">{activeJob.postedBy}</span>
                </div>
                <div className="sav-detail-item">
                  <span className="sav-detail-key">Pipeline State</span>
                  <span className={`sav-status-badge sav-status-${(activeJob.status || 'Active').toLowerCase()}`}>
                    {activeJob.status || 'Active'}
                  </span>
                </div>
              </div>

              {/* Applicant Summary */}
              <div className="sav-app-summary">
                <h4 className="sav-section-title">
                  <Briefcase className="sav-section-icon" /> Applicant Pipeline Summary
                </h4>
                <div className="sav-app-stats">
                  <div className="sav-app-stat">
                    <span className="sav-app-stat-val">{appCountFor(activeJob.id)}</span>
                    <span className="sav-app-stat-key">Total Received</span>
                  </div>
                  <div className="sav-app-stat">
                    <span className="sav-app-stat-val sav-stat-shortlisted">
                      {applications.filter((a) => a.jobId === activeJob.id && a.status === 'Shortlisted').length}
                    </span>
                    <span className="sav-app-stat-key">Shortlisted</span>
                  </div>
                  <div className="sav-app-stat">
                    <span className="sav-app-stat-val sav-stat-approved">
                      {approvedCountFor(activeJob.id)}
                    </span>
                    <span className="sav-app-stat-key">Approved</span>
                  </div>
                  <div className="sav-app-stat">
                    <span className="sav-app-stat-val sav-stat-rejected">
                      {applications.filter((a) => a.jobId === activeJob.id && a.status === 'Rejected').length}
                    </span>
                    <span className="sav-app-stat-key">Rejected</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="sav-desc-block">
                <h4 className="sav-section-title">Role Description</h4>
                <p className="sav-desc-text">{activeJob.description}</p>
              </div>

              {/* Requirements */}
              <div className="sav-desc-block">
                <h4 className="sav-section-title">Requirements</h4>
                <div className="sav-req-list">
                  {activeJob.requirements.split('\n').map((req, i) => (
                    <div key={i} className="sav-req-item">• {req}</div>
                  ))}
                </div>
              </div>

            </div>

            {/* Drawer Footer */}
            <div className="sav-drawer-footer">
              <span className="sav-footer-meta">
                <CalendarClock className="sav-footer-icon" />
                Posted {new Date(activeJob.createdAt).toLocaleDateString()}
              </span>
              <div className="sav-footer-btns">
                <button
                  onClick={() => setConfirmDelete(activeJob)}
                  className="sav-btn-delete"
                >
                  Force Delete
                </button>
                <button
                  onClick={() => handleToggleStatus(activeJob)}
                  className={activeJob.status === 'Active' ? 'sav-btn-close' : 'sav-btn-reopen'}
                >
                  {activeJob.status === 'Active' ? 'Close Vacancy' : 'Reopen Vacancy'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {confirmDelete && (
        <div className="sav-modal-overlay">
          <div className="sav-confirm-modal">
            <div className="sav-confirm-body">
              <ShieldAlert className="sav-confirm-icon" />
              <div>
                <h3 className="sav-confirm-title">Force-Delete Vacancy</h3>
                <p className="sav-confirm-desc">
                  This will permanently remove{' '}
                  <strong className="sav-confirm-bold">"{confirmDelete.title}"</strong> from{' '}
                  <strong className="sav-confirm-bold">{confirmDelete.clientOrg}</strong> and all associated pipeline records. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="sav-confirm-footer">
              <button onClick={() => setConfirmDelete(null)} className="sav-confirm-cancel">
                Cancel
              </button>
              <button onClick={handleConfirmDelete} className="sav-confirm-delete">
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}