/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { useApplications } from '../hooks/useApplications';
import { Search } from 'lucide-react';
import './styles/SuperadminAuditTrail.css';

export function SuperadminAuditTrail() {
  const { auditLogs } = useApplications();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActor, setSelectedActor] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  const actorsList = useMemo(() => {
    const list = auditLogs.map((l) => l.changedBy);
    return ['All', ...Array.from(new Set(list))];
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return [...auditLogs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .filter((l) => {
        const matchesActor = selectedActor === 'All' || l.changedBy === selectedActor;
        const matchesStatus = selectedStatus === 'All' || l.newStatus === selectedStatus;
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          l.applicantName.toLowerCase().includes(searchLower) ||
          l.jobTitle.toLowerCase().includes(searchLower) ||
          l.changedBy.toLowerCase().includes(searchLower) ||
          l.id.toLowerCase().includes(searchLower);
        return matchesActor && matchesStatus && matchesSearch;
      });
  }, [auditLogs, searchTerm, selectedActor, selectedStatus]);

  const stateClasses = {
    Pending:    'sat-badge-pending',
    Shortlisted:'sat-badge-shortlisted',
    Approved:   'sat-badge-approved',
    Rejected:   'sat-badge-rejected',
    New:        'sat-badge-new',
  };

  const getBadgeClass = (status) =>
    stateClasses[status] || 'sat-badge-new';

  return (
    <div className="sat-wrapper" id="superadmin-audit-ledger">

      {/* Page Header */}
      <div className="sat-header-card">
        <div>
          <span className="sat-compliance-label">REGULATORY COMPLIANCE</span>
          <h1 className="sat-title">Immutable Operations Audit Ledger</h1>
          <p className="sat-subtitle">
            Unified regulatory checklist logging all administrative status handshakes, passcode updates, and EGI syncs.
          </p>
        </div>
        <div className="sat-secure-tag">SECURE LOG INDEXING ACTIVE</div>
      </div>

      {/* Filters */}
      <div className="sat-filters-card">
        <div className="sat-filter-group">
          <label className="sat-filter-label">Search Vetting Logs</label>
          <div className="sat-search-wrapper">
            <Search className="sat-search-icon" />
            <input
              type="text"
              placeholder="Search by officer email, candidate name, or id..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sat-search-input"
            />
          </div>
        </div>

        <div className="sat-filter-group">
          <label className="sat-filter-label">Vetting Officer Actor</label>
          <select
            value={selectedActor}
            onChange={(e) => setSelectedActor(e.target.value)}
            className="sat-select"
          >
            {actorsList.map((act) => (
              <option key={act} value={act}>
                {act === 'All' ? 'All Operating Officers' : act}
              </option>
            ))}
          </select>
        </div>

        <div className="sat-filter-group">
          <label className="sat-filter-label">Vetted Output State</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="sat-select"
          >
            <option value="All">All Vetted Outcomes</option>
            <option value="Pending">Pending Audit</option>
            <option value="Shortlisted">Shortlisted</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="sat-table-card">
        <div className="sat-table-scroll">
          <table className="sat-table">
            <thead>
              <tr className="sat-thead-row">
                <th className="sat-th">Timestamp Stamp</th>
                <th className="sat-th">Evaluation ID</th>
                <th className="sat-th">Applicant Target</th>
                <th className="sat-th">Recruitment Officer</th>
                <th className="sat-th sat-th-center">Status Shift Diagram</th>
              </tr>
            </thead>
            <tbody className="sat-tbody">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="sat-row">

                  {/* Timestamp */}
                  <td className="sat-td">
                    <div className="sat-timestamp">
                      <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                      <span className="sat-timestamp-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </td>

                  {/* Log ID */}
                  <td className="sat-td sat-log-id">{log.id}</td>

                  {/* Applicant */}
                  <td className="sat-td">
                    <div className="sat-applicant">
                      <span className="sat-applicant-name">{log.applicantName}</span>
                      <span className="sat-applicant-job">{log.jobTitle}</span>
                    </div>
                  </td>

                  {/* Officer */}
                  <td className="sat-td">
                    <span className="sat-officer-badge">{log.changedBy}</span>
                  </td>

                  {/* Status shift */}
                  <td className="sat-td sat-td-center">
                    <div className="sat-status-shift">
                      <span className={`sat-status-badge ${getBadgeClass(log.prevStatus)}`}>
                        {log.prevStatus}
                      </span>
                      <span className="sat-arrow">➔</span>
                      <span className={`sat-status-badge ${getBadgeClass(log.newStatus)}`}>
                        {log.newStatus}
                      </span>
                    </div>
                  </td>

                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="sat-empty-row">
                    No matching compliance logs exist under currently specified query terms.
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