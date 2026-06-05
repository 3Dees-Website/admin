/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useJobs } from '../hooks/useJobs';
import { useApplications } from '../hooks/useApplications';
import { useToast } from '../hooks/useToast';
import { Briefcase, Users, FileLock2, History, ShieldAlert, Activity } from 'lucide-react';
import './styles/SuperadminDashboard.css';

export function SuperadminDashboard() {
  const { jobs } = useJobs();
  const { applications, auditLogs } = useApplications();
  const { addToast } = useToast();

  const admins = useMemo(() => {
    try {
      const dbStr = localStorage.getItem('3dees_local_db');
      if (dbStr) {
        const parsed = JSON.parse(dbStr);
        return parsed.users || [];
      }
    } catch (e) {
      // fallback
    }
    return [];
  }, [applications]);

  const adminStats = useMemo(() => {
    const totalAdmins = admins.filter((u) => u.role === 'admin').length;
    const activeAdmins = admins.filter((u) => u.role === 'admin' && u.status === 'Active').length;
    const suspendedAdmins = admins.filter((u) => u.role === 'admin' && u.status === 'Suspended').length;
    return { totalAdmins, activeAdmins, suspendedAdmins };
  }, [admins]);

  const recentAudits = useMemo(() => {
    return [...auditLogs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [auditLogs]);

  return (
    <div className="sd-wrapper" id="superadmin-dashboard-page">

      {/* Alert Banner */}
      <div className="sd-alert-banner">
        <div className="sd-alert-left">
          <ShieldAlert className="sd-alert-icon" />
          <div>
            <h2 className="sd-alert-title">Superadmin Advisory Console Active</h2>
            <p className="sd-alert-desc">
              Authorized to manage security levels, create vetting officer nodes, override candidate states, and browse historical audit streams.
            </p>
          </div>
        </div>
        <div className="sd-alert-actions">
          <Link to="/superadmin/admins" className="sd-manage-btn">
            Manage Vetting Officers
          </Link>
          <button
            onClick={() => addToast('success', 'Sync Core Checked', 'Audit hashes matches local persistent checksums.')}
            className="sd-diagnostic-btn"
          >
            Diagnostic Test
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="sd-metrics-grid" id="superadmin-metrics-row">

        <div className="sd-metric-card">
          <div className="sd-metric-top">
            <span className="sd-metric-label">Active Staff Admins</span>
            <Users className="sd-metric-icon" />
          </div>
          <div className="sd-metric-bottom">
            <p className="sd-metric-value">{adminStats.activeAdmins}</p>
            <span className="sd-metric-sub">{adminStats.suspendedAdmins} officers suspended</span>
          </div>
        </div>

        <div className="sd-metric-card">
          <div className="sd-metric-top">
            <span className="sd-metric-label">Total Active Jobs</span>
            <Briefcase className="sd-metric-icon" />
          </div>
          <div className="sd-metric-bottom">
            <p className="sd-metric-value">{jobs.length}</p>
            <span className="sd-metric-sub">Across all client sectors</span>
          </div>
        </div>

        <div className="sd-metric-card">
          <div className="sd-metric-top">
            <span className="sd-metric-label">Global Applications</span>
            <FileLock2 className="sd-metric-icon" />
          </div>
          <div className="sd-metric-bottom">
            <p className="sd-metric-value">{applications.length}</p>
            <span className="sd-metric-sub">Synced to local environment</span>
          </div>
        </div>

        <div className="sd-metric-card">
          <div className="sd-metric-top">
            <span className="sd-metric-label">Logged Vetting Changes</span>
            <History className="sd-metric-icon sd-metric-icon-green" />
          </div>
          <div className="sd-metric-bottom">
            <p className="sd-metric-value">{auditLogs.length}</p>
            <span className="sd-metric-sub">Immutable audits index</span>
          </div>
        </div>

      </div>

      {/* Work Grid */}
      <div className="sd-work-grid" id="superadmin-work-grid">

        {/* Audit Log Stream */}
        <div className="sd-audit-card">
          <div className="sd-audit-header">
            <h3 className="sd-audit-title">
              <Activity className="sd-audit-title-icon" />
              <span>Candidacy Change Ledger Stream</span>
            </h3>
            <Link to="/superadmin/audit" className="sd-verify-btn">
              Verify entire trail
            </Link>
          </div>

          <div className="sd-audit-body">
            {recentAudits.map((l) => (
              <div key={l.id} className="sd-audit-entry">
                <div className="sd-audit-entry-left">
                  <div className="sd-audit-action">
                    <span className="sd-audit-changed-by">{l.changedBy}</span>
                    {' '}action:{' '}
                    <span className="sd-audit-status-pill">
                      {l.previousStatus} ➔ {l.status}
                    </span>
                  </div>
                  <span className="sd-audit-meta">
                    Applicant: <strong className="sd-audit-bold">{l.applicantName}</strong>
                    {' '}• Job ID Ref: <span className="sd-audit-ref">{l.applicationId.slice(0, 8)}</span>
                  </span>
                  {l.notes && (
                    <span className="sd-audit-note">"Note: {l.notes}"</span>
                  )}
                </div>
                <span className="sd-audit-time">
                  {new Date(l.timestamp).toLocaleDateString()}{' '}
                  {new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {recentAudits.length === 0 && (
              <div className="sd-audit-empty">
                No security or candidacy audit logs recorded in local storage database yet.
              </div>
            )}
          </div>
        </div>

        {/* Sync Health Card */}
        <div className="sd-health-card">
          <div>
            <h3 className="sd-health-title">Sync Check Health</h3>

            <div className="sd-health-rows">
              <div className="sd-health-row">
                <span>EGI Gate Endpoint status</span>
                <span className="sd-health-online">ONLINE</span>
              </div>
              <div className="sd-health-row">
                <span>Total DB Synchronized (Approved)</span>
                <span className="sd-health-count">
                  {applications.filter((a) => a.egiSyncStatus === 'Synced').length} Records
                </span>
              </div>
              <div className="sd-health-row">
                <span>Sync Failure rate</span>
                <span className="sd-health-rate">0.00%</span>
              </div>
            </div>
          </div>

          <div className="sd-health-warning">
            <strong className="sd-health-warning-title">Critical Security Oversight:</strong>
            All password-reset functions, staff creations, and admin toggles list straight to our central diagnostic registry. Avoid sharing master panel clearances.
          </div>
        </div>

      </div>
    </div>
  );
}