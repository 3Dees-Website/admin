import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useJobs } from '../hooks/useJobs';
import { useApplicationStats } from '../hooks/useApplicationStats';
import { useAuth } from '../hooks/useAuth';
import { applicationService } from '../services/applicationService';
import { formatCount } from '../utils/formatCount';
import { TableLoadingRows } from '../components/TableLoadingRows';
import { TableErrorRow } from '../components/TableErrorRow';
import { Briefcase, FileText, CheckCircle, Clock, Ban, PlusCircle, ArrowUpRight } from 'lucide-react';
import './styles/AdminDashboard.css';

const RECENT_FEED_SIZE = 20;

// null means unknown (loading or failed): "—", never 0.
const countText = (n) => (n == null ? '—' : formatCount(n));

export function AdminDashboard() {
  const { jobs, jobsStatus } = useJobs();
  const { currentUser } = useAuth();
  const { stats: globalStats } = useApplicationStats();

  const [recentApplications, setRecentApplications] = useState([]);
  // 'loading' | 'ready' | 'error' — the feed's empty text only when 'ready'.
  const [feedStatus, setFeedStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    applicationService.getApplicationsPage({ page: 1, pageSize: RECENT_FEED_SIZE })
      .then(({ items }) => {
        if (cancelled) return;
        setRecentApplications(items);
        setFeedStatus('ready');
      })
      .catch(() => { if (!cancelled) setFeedStatus('error'); });
    return () => { cancelled = true; };
  }, []);

  const reloadFeed = async () => {
    setFeedStatus('loading');
    try {
      const { items } = await applicationService.getApplicationsPage({ page: 1, pageSize: RECENT_FEED_SIZE });
      setRecentApplications(items);
      setFeedStatus('ready');
    } catch {
      setFeedStatus('error');
    }
  };

  const stats = {
    totalJobs: jobsStatus === 'ready' ? jobs.length : null,
    totalApps: globalStats ? (globalStats.total ?? 0) : null,
    pending: globalStats ? (globalStats.byStatus?.Pending ?? 0) : null,
    shortlisted: globalStats ? (globalStats.byStatus?.Shortlisted ?? 0) : null,
    approved: globalStats ? (globalStats.byStatus?.Approved ?? 0) : null,
    rejected: globalStats ? (globalStats.byStatus?.Rejected ?? 0) : null,
  };

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

  return (
    <div className="admin-dashboard" id="admin-home-panel">

      {/* Greeting Banner */}
      <div className="greeting-banner">
        <div className="greeting-text">
          <h1 className="greeting-title">
            Good day, {currentUser?.name || 'Vetting Officer'}
          </h1>
          <p className="greeting-subtitle">
            Workforce Portal active. Accessing secure credential folders and compliance databases. Current role:{' '}
            <span className="greeting-role">{currentUser?.role}</span>.
          </p>
        </div>

        <div className="quick-actions">
          <Link
            to="/admin/jobs?create=open"
            className="btn btn-primary"
            id="dash-quick-post-job"
          >
            <PlusCircle size={16} />
            <span>Post New Job</span>
          </Link>
          <Link
            to="/admin/applications"
            className="btn btn-dark"
            id="dash-quick-view-apps"
          >
            <span>Applications</span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" id="overview-metrics-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Posted Positions</span>
            <Briefcase size={18} className="stat-icon stat-icon--primary" />
          </div>
          <p className="stat-value" title={String(countText(stats.totalJobs))}>{countText(stats.totalJobs)}</p>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Applications</span>
            <FileText size={18} className="stat-icon stat-icon--primary" />
          </div>
          <p className="stat-value" title={String(countText(stats.totalApps))}>{countText(stats.totalApps)}</p>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Pending Audit</span>
            <Clock size={18} className="stat-icon stat-icon--primary" />
          </div>
          <p className="stat-value" title={String(countText(stats.pending))}>{countText(stats.pending)}</p>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Shortlisted</span>
            <Clock size={18} className="stat-icon stat-icon--indigo" />
          </div>
          <p className="stat-value" title={String(countText(stats.shortlisted))}>{countText(stats.shortlisted)}</p>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Approved Placements</span>
            <CheckCircle size={18} className="stat-icon stat-icon--green" />
          </div>
          <p className="stat-value" title={String(countText(stats.approved))}>{countText(stats.approved)}</p>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Rejected Dossiers</span>
            <Ban size={18} className="stat-icon stat-icon--red" />
          </div>
          <p className="stat-value" title={String(countText(stats.rejected))}>{countText(stats.rejected)}</p>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="activity-table-card" id="recent-activity-ledger">
        <div className="activity-table-header">
          <h3 className="activity-table-title">Incoming Recruits Feed</h3>
          <Link
            to="/admin/applications"
            className="btn btn-primary btn-sm"
          >
            Launch Core Review Filter
          </Link>
        </div>

        <div className="table-scroll">
          <table className="activity-table">
            <thead>
              <tr className="table-head-row">
                <th>Candidate</th>
                <th>Target Role</th>
                <th>Submission Stamp</th>
                <th className="text-center">Reference Stamp</th>
                <th className="text-right">Status State</th>
              </tr>
            </thead>
            <tbody>
              {feedStatus === 'loading' && <TableLoadingRows colSpan={5} />}
              {feedStatus === 'error' && (
                <TableErrorRow colSpan={5} message="Couldn't load recent applications." onRetry={reloadFeed} />
              )}
              {feedStatus === 'ready' && recentApplications.map((app) => (
                <tr key={app.id} className="table-body-row">
                  <td>
                    <div className="candidate-cell">
                      <span className="candidate-name">{app.applicantName}</span>
                      <span className="candidate-email">{app.applicantEmail}</span>
                    </div>
                  </td>
                  <td className="role-cell">{getJobTitle(app.jobId)}</td>
                  <td className="date-cell">
                    {new Date(app.submittedAt).toLocaleDateString()}{' '}
                    {new Date(app.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="ref-cell text-center">{app.referenceId}</td>
                  <td className="text-right">
                    <span className={statusBadgeClass[app.status]}>
                      {app.status}
                    </span>
                  </td>
                </tr>
              ))}
              {feedStatus === 'ready' && recentApplications.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No candidacies have been submitted to this platform yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}