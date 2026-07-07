/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { egiService } from '../services/egiService';
import { useToast } from '../hooks/useToast';
import { Search, Inbox, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import './styles/SuperadminEgiSync.css';

const STATUS_TONE = {
  Pending: 'ses-tone-gray',
  Queued: 'ses-tone-blue',
  Synced: 'ses-tone-green',
  Failed: 'ses-tone-red',
};

export function SuperadminEgiSync() {
  const { addToast } = useToast();

  const [stats, setStats] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState(null);

  const [statusFilter, setStatusFilter] = useState('Failed');
  const [searchTerm, setSearchTerm] = useState('');

  async function loadStats() {
    try {
      const data = await egiService.getQueueStats();
      setStats(data);
    } catch {
      addToast('error', 'EGI Queue', 'Could not load queue stats.');
    }
  }

  async function loadItems() {
    setLoading(true);
    try {
      const filters = {};
      if (statusFilter !== 'All') filters.status = statusFilter;
      if (searchTerm.trim()) filters.applicationId = searchTerm.trim();
      const data = await egiService.getQueueItems(filters);
      setItems(data);
    } catch {
      addToast('error', 'EGI Queue', 'Could not load queue items.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    egiService.getQueueStats()
      .then((data) => { if (!cancelled) setStats(data); })
      .catch(() => { if (!cancelled) addToast('error', 'EGI Queue', 'Could not load queue stats.'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      const filters = {};
      if (statusFilter !== 'All') filters.status = statusFilter;
      if (searchTerm.trim()) filters.applicationId = searchTerm.trim();
      egiService.getQueueItems(filters)
        .then((data) => { if (!cancelled) setItems(data); })
        .catch(() => { if (!cancelled) addToast('error', 'EGI Queue', 'Could not load queue items.'); })
        .finally(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchTerm]);

  const statCounts = useMemo(() => {
    const byStatus = { Pending: 0, Queued: 0, Synced: 0, Failed: 0 };
    stats.forEach((s) => { byStatus[s.status] = s.count; });
    return byStatus;
  }, [stats]);

  const handleRetry = async (item) => {
    setRetryingId(item.id);
    try {
      await egiService.retryQueueItem(item.id);
      addToast('success', 'Delivery Requeued', `${item.referenceId || item.applicationId} will be retried shortly.`);
      await Promise.all([loadItems(), loadStats()]);
    } catch (err) {
      addToast('error', 'Retry Failed', err?.message || 'Could not requeue this delivery.');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="ses-wrapper" id="superadmin-egi-sync-page">

      {/* Header */}
      <div className="ses-header-card">
        <div>
          <span className="ses-page-label">OPS · EGI OUTBOX</span>
          <h1 className="ses-title">EGI Sync Queue</h1>
          <p className="ses-subtitle">
            Delivery status for candidate records queued to EGI. Failed deliveries can be manually requeued below.
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="ses-stats-row">
        <div className="ses-stat-card">
          <Clock className="ses-stat-icon ses-icon-gray" />
          <div>
            <span className="ses-stat-val">{statCounts.Pending}</span>
            <span className="ses-stat-key">Pending</span>
          </div>
        </div>
        <div className="ses-stat-card">
          <RefreshCw className="ses-stat-icon ses-icon-blue" />
          <div>
            <span className="ses-stat-val">{statCounts.Queued}</span>
            <span className="ses-stat-key">Queued</span>
          </div>
        </div>
        <div className="ses-stat-card">
          <Inbox className="ses-stat-icon ses-icon-green" />
          <div>
            <span className="ses-stat-val">{statCounts.Synced}</span>
            <span className="ses-stat-key">Synced</span>
          </div>
        </div>
        <div className="ses-stat-card">
          <AlertTriangle className="ses-stat-icon ses-icon-red" />
          <div>
            <span className="ses-stat-val">{statCounts.Failed}</span>
            <span className="ses-stat-key">Failed</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="ses-controls-card">
        <div className="ses-filters">
          <div className="ses-search-wrap">
            <Search className="ses-search-icon" />
            <input
              type="text"
              placeholder="Filter by application ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ses-search-input"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ses-select"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Queued">Queued</option>
            <option value="Synced">Synced</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="ses-table-card">
        <div className="ses-table-scroll">
          <table className="ses-table">
            <thead>
              <tr className="ses-thead-row">
                <th className="ses-th">Reference</th>
                <th className="ses-th">Applicant Email</th>
                <th className="ses-th ses-th-center">Status</th>
                <th className="ses-th ses-th-center">Attempts</th>
                <th className="ses-th">Last Error</th>
                <th className="ses-th">Next Attempt</th>
                <th className="ses-th ses-th-right">Action</th>
              </tr>
            </thead>
            <tbody className="ses-tbody">
              {items.map((item) => (
                <tr key={item.id} className="ses-row">
                  <td className="ses-td ses-ref">{item.referenceId || item.applicationId}</td>
                  <td className="ses-td">{item.applicantEmail}</td>
                  <td className="ses-td ses-td-center">
                    <span className={`ses-badge ${STATUS_TONE[item.status] || 'ses-tone-gray'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="ses-td ses-td-center">{item.attempts}</td>
                  <td className="ses-td ses-error-cell" title={item.lastError}>{item.lastError || '—'}</td>
                  <td className="ses-td">
                    {item.nextAttemptAt ? new Date(item.nextAttemptAt).toLocaleString() : '—'}
                  </td>
                  <td className="ses-td ses-td-right">
                    {item.status === 'Failed' ? (
                      <button
                        onClick={() => handleRetry(item)}
                        disabled={retryingId === item.id}
                        className="ses-retry-btn"
                      >
                        <RefreshCw className={`ses-retry-icon${retryingId === item.id ? ' ses-retry-icon--spinning' : ''}`} />
                        <span>{retryingId === item.id ? 'Retrying…' : 'Retry'}</span>
                      </button>
                    ) : (
                      <span className="ses-no-action">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="ses-empty">
                    <Inbox className="ses-empty-icon" />
                    <span>No queue items match your current filters.</span>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="ses-empty">
                    <span>Loading queue items…</span>
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
