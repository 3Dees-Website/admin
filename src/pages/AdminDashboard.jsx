import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useJobs } from '../hooks/useJobs';
import { useApplications } from '../hooks/useApplications';
import { useAuth } from '../hooks/useAuth';
import { Briefcase, FileText, CheckCircle, Clock, Ban, PlusCircle, ArrowUpRight } from 'lucide-react';
import './styles/AdminDashboard.css';

export function AdminDashboard() {
  const { jobs } = useJobs();
  const { applications } = useApplications();
  const { currentUser } = useAuth();

  const stats = useMemo(() => {
    const totalJobs = jobs.length;
    const totalApps = applications.length;
    const pending = applications.filter((a) => a.status === 'Pending').length;
    const shortlisted = applications.filter((a) => a.status === 'Shortlisted').length;
    const approved = applications.filter((a) => a.status === 'Approved').length;
    const rejected = applications.filter((a) => a.status === 'Rejected').length;

    return { totalJobs, totalApps, pending, shortlisted, approved, rejected };
  }, [jobs, applications]);

  const recentApplications = useMemo(() => {
    return [...applications]
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, 10);
  }, [applications]);

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
          <p className="stat-value">{stats.totalJobs}</p>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Applications</span>
            <FileText size={18} className="stat-icon stat-icon--primary" />
          </div>
          <p className="stat-value">{stats.totalApps}</p>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Pending Audit</span>
            <Clock size={18} className="stat-icon stat-icon--primary" />
          </div>
          <p className="stat-value">{stats.pending}</p>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Shortlisted</span>
            <Clock size={18} className="stat-icon stat-icon--indigo" />
          </div>
          <p className="stat-value">{stats.shortlisted}</p>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Approved Placements</span>
            <CheckCircle size={18} className="stat-icon stat-icon--green" />
          </div>
          <p className="stat-value">{stats.approved}</p>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Rejected Dossiers</span>
            <Ban size={18} className="stat-icon stat-icon--red" />
          </div>
          <p className="stat-value">{stats.rejected}</p>
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
              {recentApplications.map((app) => (
                <tr key={app.id} className="table-body-row">
                  <td>
                    <div className="candidate-cell">
                      <span className="candidate-name">{app.personalInfo.fullName}</span>
                      <span className="candidate-email">{app.personalInfo.email}</span>
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
              {recentApplications.length === 0 && (
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