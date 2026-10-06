/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { egiService } from '../services/egiService';
import { useToast } from '../hooks/useToast';
import { EgiDeliveryBadge } from '../components/EgiBadges';
import { DELIVERY_STATE_MAP } from '../utils/egiDeliveryState';
import { TableErrorRow } from '../components/TableErrorRow';
import { describeLoadError } from '../utils/describeLoadError';
import { Search, Inbox, AlertTriangle, RefreshCw, Clock, PauseCircle } from 'lucide-react';
import './styles/SuperadminEgiSync.css';

// Each option maps to the query the backend understands: `status` is the
// queue row's raw status, `state` its derived delivery_state. 'Failed' covers
// both retrying and gave-up rows, and stays the default so retrying rows
// remain visible as before.
const FILTER_OPTIONS = [
  { value: 'Failed',    label: 'Failed (retrying + gave up)', params: { status: 'Failed' } },
  { value: 'All',       label: 'All',             params: {} },
  { value: 'exhausted', label: 'Gave up',         params: { state: 'exhausted' } },
  { value: 'retrying',  label: 'Retrying',        params: { state: 'retrying' } },
  { value: 'stuck',     label: 'Stuck',           params: { state: 'stuck' } },
  { value: 'sending',   label: 'Sending',         params: { state: 'sending' } },
  { value: 'pending',   label: 'Waiting to send', params: { state: 'pending' } },
  { value: 'synced',    label: 'Delivered',       params: { state: 'synced' } },
];

const FORBIDDEN_MESSAGE = 'You no longer have superadmin access. Sign in again to continue.';

const isForbidden = (err) => err?.error === 'Forbidden';

function buildFilters(filterValue, searchTerm) {
  const option = FILTER_OPTIONS.find((o) => o.value === filterValue) || FILTER_OPTIONS[0];
  const filters = { ...option.params };
  if (searchTerm.trim()) filters.applicationId = searchTerm.trim();
  return filters;
}

function nextAttemptLabel(item) {
  if (item.superseded) return '—';
  switch (item.deliveryState) {
    case 'pending':
      return item.nextAttemptAt && new Date(item.nextAttemptAt) > new Date()
        ? new Date(item.nextAttemptAt).toLocaleString()
        : 'Now';
    case 'sending':
      return 'In progress';
    case 'stuck':
      return 'Worker recovers it automatically';
    case 'retrying':
      return item.nextAttemptAt ? new Date(item.nextAttemptAt).toLocaleString() : '—';
    case 'exhausted':
      return 'Never — gave up';
    default:
      return '—';
  }
}

export function SuperadminEgiSync() {
  const { addToast } = useToast();

  // null = counts unknown (still loading, or the last load failed): the
  // cards show "—", never 0, since 0 failed deliveries is a claim.
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  // A failed list load is said inline in the table, in place of the rows
  // (which may be from a different filter) — not with a toast.
  const [itemsError, setItemsError] = useState(null);
  const [retryingId, setRetryingId] = useState(null);

  const [stateFilter, setStateFilter] = useState('Failed');
  const [searchTerm, setSearchTerm] = useState('');

  const reportLoadError = (err, fallback) => {
    addToast('error', 'EGI Queue', isForbidden(err) ? FORBIDDEN_MESSAGE : fallback);
  };

  async function loadStats() {
    try {
      const data = await egiService.getQueueStats();
      setStats(data);
    } catch (err) {
      setStats(null);
      reportLoadError(err, 'Could not load queue stats.');
    }
  }

  async function loadItems() {
    setLoading(true);
    setItemsError(null);
    try {
      const data = await egiService.getQueueItems(buildFilters(stateFilter, searchTerm));
      setItems(data);
    } catch (err) {
      setItemsError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    egiService.getQueueStats()
      .then((data) => { if (!cancelled) setStats(data); })
      .catch((err) => { if (!cancelled) reportLoadError(err, 'Could not load queue stats.'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setItemsError(null);
      egiService.getQueueItems(buildFilters(stateFilter, searchTerm))
        .then((data) => { if (!cancelled) setItems(data); })
        .catch((err) => { if (!cancelled) setItemsError(err); })
        .finally(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; };
  }, [stateFilter, searchTerm]);

  // One stats row per queue status; exhausted/retrying/stuck split the Failed
  // and Processing rows. The queue has no 'Queued' status, hence no card for it.
  const statCounts = useMemo(() => {
    if (!stats) {
      return { waiting: '—', retrying: '—', exhausted: '—', stuck: '—', synced: '—' };
    }
    const byStatus = {};
    stats.forEach((s) => { byStatus[s.status] = s; });
    const pending = byStatus.Pending?.count || 0;
    const processing = byStatus.Processing?.count || 0;
    const stuck = byStatus.Processing?.stuck || 0;
    return {
      waiting: pending + (processing - stuck),
      retrying: byStatus.Failed?.retrying || 0,
      exhausted: byStatus.Failed?.exhausted || 0,
      stuck,
      synced: byStatus.Synced?.count || 0,
    };
  }, [stats]);

  const handleRetry = async (item) => {
    setRetryingId(item.id);
    try {
      await egiService.retryQueueItem(item.id);
      addToast('success', 'Delivery Requeued', `${item.referenceId || item.applicationId} will be retried shortly.`);
      await Promise.all([loadItems(), loadStats()]);
    } catch (err) {
      if (isForbidden(err)) {
        addToast('error', 'Retry Failed', FORBIDDEN_MESSAGE);
      } else if (err?.error === 'InvalidState') {
        // The row changed since the list loaded; the server says why. Reload
        // so the row shows its real state.
        addToast('error', 'Retry Not Possible', err.message);
        await Promise.all([loadItems(), loadStats()]);
      } else {
        addToast('error', 'Retry Failed', err?.message || 'Could not requeue this delivery.');
      }
    } finally {
      setRetryingId(null);
    }
  };

  const itemsLoadError = !itemsError ? null
    : isForbidden(itemsError) ? { message: FORBIDDEN_MESSAGE, canRetry: false }
    : describeLoadError(itemsError, 'the EGI queue');

  const statCards = [
    { key: 'waiting',   label: 'Waiting to send', icon: Clock,         tone: 'gray' },
    { key: 'retrying',  label: 'Retrying',        icon: RefreshCw,     tone: 'amber', filter: 'retrying' },
    {
      key: 'exhausted', label: 'Gave up', icon: AlertTriangle, tone: 'red', filter: 'exhausted', emphasis: true,
      note: 'Will not be retried automatically — each needs a retry or redelivery.',
    },
    {
      key: 'stuck', label: 'Stuck', icon: PauseCircle, tone: 'amber', filter: 'stuck',
      note: 'Recovers automatically — the worker reclaims these on its own.',
    },
    { key: 'synced',    label: 'Delivered',       icon: Inbox,         tone: 'green', filter: 'synced' },
  ];

  return (
    <div className="ses-wrapper" id="superadmin-egi-sync-page">

      {/* Header */}
      <div className="ses-header-card">
        <div>
          <span className="ses-page-label">OPS · EGI OUTBOX</span>
          <h1 className="ses-title">EGI Sync Queue</h1>
          <p className="ses-subtitle">
            Delivery status for candidate records queued to EGI. Deliveries that gave up will not be retried automatically and can be manually requeued below.
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="ses-stats-row">
        {statCards.map(({ key, label, icon: Icon, tone, filter, emphasis, note }) => {
          const value = statCounts[key];
          const className = [
            'ses-stat-card',
            filter ? 'ses-stat-card--clickable' : '',
            filter && stateFilter === filter ? 'ses-stat-card--active' : '',
            emphasis && value > 0 ? 'ses-stat-card--alert' : '',
          ].filter(Boolean).join(' ');
          const body = (
            <>
              <Icon className={`ses-stat-icon ses-icon-${tone}`} />
              <div>
                <span className="ses-stat-val">{value}</span>
                <span className="ses-stat-key">{label}</span>
                {note && <span className="ses-stat-note">{note}</span>}
              </div>
            </>
          );
          return filter ? (
            <button
              key={key}
              type="button"
              className={className}
              onClick={() => setStateFilter(filter)}
              title={`Show ${label.toLowerCase()} deliveries`}
            >
              {body}
            </button>
          ) : (
            <div key={key} className={className}>{body}</div>
          );
        })}
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
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="ses-select"
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
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
                <th className="ses-th ses-th-center">Delivery</th>
                <th className="ses-th ses-th-center">Attempts</th>
                <th className="ses-th">Last Error</th>
                <th className="ses-th">Next Attempt</th>
                <th className="ses-th ses-th-right">Action</th>
              </tr>
            </thead>
            <tbody className="ses-tbody">
              {!loading && itemsLoadError && (
                <TableErrorRow
                  colSpan={7}
                  message={itemsLoadError.message}
                  onRetry={itemsLoadError.canRetry ? loadItems : undefined}
                  retryLabel="Reload queue"
                />
              )}
              {!itemsLoadError && items.map((item) => {
                const needsAttention = item.deliveryState === 'exhausted' && !item.superseded;
                const rowClass = [
                  'ses-row',
                  needsAttention ? 'ses-row--attention' : '',
                  item.superseded ? 'ses-row--superseded' : '',
                ].filter(Boolean).join(' ');
                return (
                  <tr key={item.id} className={rowClass}>
                    <td className="ses-td ses-ref">{item.referenceId || item.applicationId}</td>
                    <td className="ses-td">{item.applicantEmail}</td>
                    <td className="ses-td ses-td-center">
                      {item.superseded ? (
                        <div className="ses-state-cell">
                          <span className="egi-badge egi-badge--gray">Superseded</span>
                          <span className="ses-state-was">
                            was: {DELIVERY_STATE_MAP[item.deliveryState]?.label || item.deliveryState}
                          </span>
                        </div>
                      ) : (
                        <EgiDeliveryBadge state={item.deliveryState} />
                      )}
                    </td>
                    <td className="ses-td ses-td-center">
                      {item.superseded ? '—' : `${item.attempts} / ${item.maxAttempts}`}
                    </td>
                    <td className="ses-td ses-error-cell" title={item.lastError}>{item.lastError || '—'}</td>
                    <td className={`ses-td${needsAttention ? ' ses-next--never' : ''}`}>
                      {nextAttemptLabel(item)}
                    </td>
                    <td className="ses-td ses-td-right">
                      {item.canRetry ? (
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
                );
              })}
              {!loading && !itemsLoadError && items.length === 0 && (
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
