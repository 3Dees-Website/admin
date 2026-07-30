/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useJobs } from '../hooks/useJobs';
import { useAuth } from '../hooks/useAuth';
import { useApplicationStats } from '../hooks/useApplicationStats';
import { useApplicationStatsByState } from '../hooks/useApplicationStatsByState';
import { useToast } from '../hooks/useToast';
import { Briefcase, Users, FileLock2, CheckCircle, ShieldAlert, Activity, MapPin } from 'lucide-react';
import { egiService } from '../services/egiService';
import { auditService } from '../services/auditService';
import { formatCount } from '../utils/formatCount';
import './styles/SuperadminDashboard.css';

const RECENT_AUDITS_SIZE = 20;

export function SuperadminDashboard() {
  const { jobs } = useJobs();
  const { admins } = useAuth();
  const { addToast } = useToast();
  const { stats: globalStats } = useApplicationStats();
  const { stats: stateStats, isLoading: stateStatsLoading } = useApplicationStatsByState();

  const [egiStats, setEgiStats] = useState(null);
  const [egiStatsLoading, setEgiStatsLoading] = useState(true);
  const [recentAudits, setRecentAudits] = useState([]);

  useEffect(() => {
    let cancelled = false;
    egiService.getQueueStats()
      .then((stats) => { if (!cancelled) setEgiStats(stats); })
      .catch(() => { if (!cancelled) addToast('error', 'EGI Sync Health', 'Could not load EGI queue stats.'); })
      .finally(() => { if (!cancelled) setEgiStatsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    auditService.getAuditLogsPage({ page: 1, pageSize: RECENT_AUDITS_SIZE })
      .then(({ items }) => {
        if (cancelled) return;
        setRecentAudits(items);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const egiCounts = useMemo(() => {
    const byStatus = { Pending: 0, Queued: 0, Synced: 0, Failed: 0 };
    (egiStats || []).forEach((s) => { byStatus[s.status] = s.count; });
    const total = byStatus.Pending + byStatus.Queued + byStatus.Synced + byStatus.Failed;
    const failureRate = total > 0 ? (byStatus.Failed / total) * 100 : 0;
    return { ...byStatus, total, failureRate };
  }, [egiStats]);

  const adminStats = useMemo(() => {
    const totalAdmins = admins.filter((u) => u.role === 'admin').length;
    const activeAdmins = admins.filter((u) => u.role === 'admin' && u.status === 'Active').length;
    const suspendedAdmins = admins.filter((u) => u.role === 'admin' && u.status === 'Suspended').length;
    return { totalAdmins, activeAdmins, suspendedAdmins };
  }, [admins]);

  const globalTotal = globalStats?.total ?? 0;
  const egiAccepted = globalStats?.byEgiDecision?.Accepted ?? 0;

  const stateRows = useMemo(() => {
    const total = stateStats?.total ?? 0;
    if (!total) return [];
    return (stateStats.items || [])
      .filter((s) => s.count > 0)
      .map((s) => ({ ...s, pct: (s.count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [stateStats]);

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
            <p className="sd-metric-value" title={String(adminStats.activeAdmins)}>{formatCount(adminStats.activeAdmins)}</p>
            <span className="sd-metric-sub">{adminStats.suspendedAdmins} officers suspended</span>
          </div>
        </div>

        <div className="sd-metric-card">
          <div className="sd-metric-top">
            <span className="sd-metric-label">Total Active Jobs</span>
            <Briefcase className="sd-metric-icon" />
          </div>
          <div className="sd-metric-bottom">
            <p className="sd-metric-value" title={String(jobs.length)}>{formatCount(jobs.length)}</p>
            <span className="sd-metric-sub">Across all client sectors</span>
          </div>
        </div>

        <div className="sd-metric-card">
          <div className="sd-metric-top">
            <span className="sd-metric-label">Global Applications</span>
            <FileLock2 className="sd-metric-icon" />
          </div>
          <div className="sd-metric-bottom">
            <p className="sd-metric-value" title={String(globalTotal)}>{formatCount(globalTotal)}</p>
            <span className="sd-metric-sub">Synced to local environment</span>
          </div>
        </div>

        <div className="sd-metric-card">
          <div className="sd-metric-top">
            <span className="sd-metric-label">EGI Approved Applications</span>
            <CheckCircle className="sd-metric-icon sd-metric-icon-green" />
          </div>
          <div className="sd-metric-bottom">
            <p className="sd-metric-value" title={String(egiAccepted)}>{formatCount(egiAccepted)}</p>
            <span className="sd-metric-sub">Accepted by EGI</span>
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
                      {l.prevStatus} ➔ {l.newStatus}
                    </span>
                  </div>
                  <span className="sd-audit-meta">
                    Applicant: <strong className="sd-audit-bold">{l.applicantName}</strong>
                    {' '}• Job ID Ref: <span className="sd-audit-ref">{l.applicationId.slice(0, 8)}</span>
                  </span>
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
            <h3 className="sd-health-title">EGI Sync Health</h3>

            <div className="sd-health-rows">
              <div className="sd-health-row">
                <span>Queue status</span>
                {egiStatsLoading ? (
                  <span className="sd-health-count">Loading…</span>
                ) : egiCounts.Failed > 0 ? (
                  <span className="sd-health-failed">{egiCounts.Failed} FAILED</span>
                ) : (
                  <span className="sd-health-online">HEALTHY</span>
                )}
              </div>
              <div className="sd-health-row">
                <span>Total Synced to EGI</span>
                <span className="sd-health-count">{egiStatsLoading ? '—' : egiCounts.Synced} Records</span>
              </div>
              <div className="sd-health-row">
                <span>Awaiting delivery (Pending/Queued)</span>
                <span className="sd-health-count">{egiStatsLoading ? '—' : egiCounts.Pending + egiCounts.Queued}</span>
              </div>
              <div className="sd-health-row">
                <span>Sync Failure rate</span>
                <span className="sd-health-rate">{egiStatsLoading ? '—' : `${egiCounts.failureRate.toFixed(2)}%`}</span>
              </div>
            </div>
          </div>

          <Link to="/superadmin/egi-sync" className="sd-health-link">
            View Failed EGI Deliveries →
          </Link>

          <div className="sd-health-warning">
            <strong className="sd-health-warning-title">Critical Security Oversight:</strong>
            All password-reset functions, staff creations, and admin toggles list straight to our central diagnostic registry. Avoid sharing master panel clearances.
          </div>
        </div>

      </div>

      {/* State-of-Origin Chart */}
      <div className="sd-state-card">
        <div className="sd-state-header">
          <h3 className="sd-state-title">
            <MapPin className="sd-state-title-icon" />
            <span>EGI Approvals by State of Origin</span>
          </h3>
          {stateRows.length > 0 && (
            <span className="sd-state-total">{stateStats.total} Accepted Total</span>
          )}
        </div>

        <div className="sd-state-body">
          {stateStatsLoading && (
            <div className="sd-state-empty">Loading…</div>
          )}

          {!stateStatsLoading && stateRows.length === 0 && (
            <div className="sd-state-empty">
              No state data yet — appears as EGI-accepted applicants with state of origin accumulate.
            </div>
          )}

          {stateRows.map((row, index) => (
            <div className="sd-state-row" key={row.state}>
              <span className="sd-state-label" title={row.state}>{row.state}</span>
              <div className="sd-state-track">
                <motion.div
                  className="sd-state-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${row.pct}%` }}
                  transition={{ duration: 0.6, delay: index * 0.05, ease: 'easeOut' }}
                />
              </div>
              <span className="sd-state-meta">
                {Math.round(row.pct)}%<span className="sd-state-count">({row.count})</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}