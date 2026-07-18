/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { usePaginatedAuditLogs } from '../hooks/usePaginatedAuditLogs';
import { useToast } from '../hooks/useToast';
import { Search, Download } from 'lucide-react';
import { PaginationControls } from '../components/PaginationControls';
import { TableLoadingRows } from '../components/TableLoadingRows';
import { auditService } from '../services/auditService';
import { downloadBlob } from '../utils/downloadBlob';
import './styles/SuperadminAuditTrail.css';

export function SuperadminAuditTrail() {
  const { addToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActor, setSelectedActor] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [isExporting, setIsExporting] = useState(false);

  const filters = {
    officer: selectedActor !== 'All' ? selectedActor : undefined,
    status: selectedStatus !== 'All' ? selectedStatus : undefined,
    search: searchTerm,
  };

  const {
    items: logs, total, page, pageSize, setPage, setPageSize, isLoading,
  } = usePaginatedAuditLogs(filters);

  // The officer filter can no longer be derived from every log (that would
  // mean fetching all of them). It's populated from officers seen on the
  // current page only, so it grows as you browse rather than listing everyone
  // up front — a known degradation of paginating this list.
  const actorsList = useMemo(() => {
    const list = logs.map((l) => l.changedBy);
    return ['All', ...Array.from(new Set(list))];
  }, [logs]);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const blob = await auditService.exportCsv(filters);
      downloadBlob(blob, `3DEES_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
      addToast('success', 'Audit Log Exported', 'Your filtered audit trail has downloaded.');
    } catch (err) {
      addToast('error', 'Export Failed', err?.message || 'Could not export the audit trail.');
    } finally {
      setIsExporting(false);
    }
  };

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
        <div className="sat-header-actions">
          <span className="sat-secure-tag">SECURE LOG INDEXING ACTIVE</span>
          <button
            onClick={handleExportCSV}
            className="sat-export-btn"
            disabled={isExporting}
          >
            <Download size={16} />
            <span>{isExporting ? 'Exporting…' : 'Export filtered CSV'}</span>
          </button>
        </div>
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
              {isLoading && <TableLoadingRows colSpan={5} />}
              {!isLoading && logs.map((log) => (
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
              {!isLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="sat-empty-row">
                    No matching compliance logs exist under currently specified query terms.
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

    </div>
  );
}