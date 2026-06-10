/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { useApplications } from '../hooks/useApplications';
import { useJobs } from '../hooks/useJobs';
import { useToast } from '../hooks/useToast';
import { CandidateEditDrawer } from '../components/CandidateEditDrawer';
import { localStorageDb } from '../services/localStorageDb';
import {
  Search, Inbox, Clock, UserCheck, UserX,
  ShieldAlert, Zap
} from 'lucide-react';
import './styles/SuperadminPendingApplications.css';

export function SuperadminPendingApplications() {
  const { applications, reviewApplication } = useApplications();
  const { jobs } = useJobs();
  const { addToast } = useToast();

  const [searchTerm,    setSearchTerm]    = useState('');
  const [selectedJobId, setSelectedJobId] = useState('All');
  const [editingApp,    setEditingApp]    = useState(null);
  const [selectedIds,   setSelectedIds]   = useState(new Set());

  const getJobTitle = (jobId) => {
    const j = jobs.find((j) => j.id === jobId);
    return j ? j.title : 'Deleted Position';
  };

  /* Only Pending  */
  const pendingApps = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return applications
      .filter((a) => {
        if (a.status !== 'Pending') return false;
        const matchesJob    = selectedJobId === 'All' || a.jobId === selectedJobId;
        const matchesSearch =
          a.personalInfo.fullName.toLowerCase().includes(q) ||
          a.personalInfo.email.toLowerCase().includes(q)   ||
          a.referenceId.toLowerCase().includes(q)          ||
          getJobTitle(a.jobId).toLowerCase().includes(q);
        return matchesJob && matchesSearch;
      })
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  }, [applications, selectedJobId, searchTerm, jobs]);

  const stats = useMemo(() => {
    const pending = applications.filter((a) => a.status === 'Pending').length;
    const today   = applications.filter((a) => {
      if (a.status !== 'Pending') return false;
      return new Date(a.submittedAt).toDateString() === new Date().toDateString();
    }).length;
    const overdue = applications.filter((a) => {
      if (a.status !== 'Pending') return false;
      return Date.now() - new Date(a.submittedAt).getTime() >= 7 * 24 * 60 * 60 * 1000;
    }).length;
    return { pending, today, overdue };
  }, [applications]);

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

  const handleStatusChange = async (status) => {
    if (!editingApp) return;
    await reviewApplication(editingApp.id, status, editingApp.notes || '');
    setEditingApp(null);
    addToast('success', 'Override Applied', `Candidate moved to ${status} via superadmin override.`);
  };

  const handleSaveEdits = (updatedApp) => {
    const allApps = localStorageDb.getApplications();
    const merged  = allApps.map((a) => a.id === updatedApp.id ? { ...a, ...updatedApp } : a);
    localStorageDb.saveApplications(merged);
    addToast('success', 'Candidate File Updated', `${updatedApp.personalInfo.fullName}'s record saved to ledger.`);
    setEditingApp(null);
  };

  const bulkAction = async (status) => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      const app = applications.find((a) => a.id === id);
      if (app) await reviewApplication(id, status, app.notes || '');
    }
    addToast('success', `Bulk ${status}`, `${selectedIds.size} applicant(s) set to ${status}.`);
    setSelectedIds(new Set());
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
            <button onClick={() => bulkAction('Shortlisted')} className="spa-bulk-shortlist">
              <UserCheck className="spa-bulk-icon" /> Bulk Shortlist
            </button>
            <button onClick={() => bulkAction('Approved')} className="spa-bulk-approve">
              <UserCheck className="spa-bulk-icon" /> Bulk Approve & Sync
            </button>
            <button onClick={() => bulkAction('Rejected')} className="spa-bulk-reject">
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
              {pendingApps.map((app) => {
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
                        <div className="spa-avatar">
                          {app.personalInfo.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="spa-candidate-info">
                          <span className="spa-candidate-name">{app.personalInfo.fullName}</span>
                          <span className="spa-candidate-meta">{app.personalInfo.email}</span>
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
                          onClick={() => reviewApplication(app.id, 'Shortlisted', app.notes || '')}
                          className="spa-quick-shortlist"
                        >
                          Shortlist
                        </button>
                        <button
                          onClick={() => reviewApplication(app.id, 'Approved', app.notes || '')}
                          className="spa-quick-approve"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setEditingApp(app)}
                          className="spa-open-btn"
                        >
                          Override File
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
              {pendingApps.length === 0 && (
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
      </div>

      {/* Candidate Edit Drawer — superadmin mode */}
      {editingApp && (
        <CandidateEditDrawer
          app={editingApp}
          jobTitle={getJobTitle(editingApp.jobId)}
          isSuperadmin={true}
          addToast={addToast}
          onClose={() => setEditingApp(null)}
          onSave={handleSaveEdits}
          onStatusChange={handleStatusChange}
        />
      )}

    </div>
  );
}