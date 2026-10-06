/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { usePaginatedAccountAuditLogs } from '../hooks/usePaginatedAccountAuditLogs';
import { PaginationControls } from '../components/PaginationControls';
import { TableLoadingRows } from '../components/TableLoadingRows';
import { userService } from '../services/userService';
import './styles/SuperadminAccountActivity.css';

const COLUMN_COUNT = 5;

// The backend's action keys, in the wording a superadmin reads.
const ACTIONS = {
  user_created:         { label: 'Account created',              tone: 'saa-action-created' },
  user_suspended:       { label: 'Account suspended',            tone: 'saa-action-suspended' },
  user_reactivated:     { label: 'Account reactivated',          tone: 'saa-action-reactivated' },
  user_password_reset:  { label: 'Password reset by superadmin', tone: 'saa-action-reset' },
  user_deleted:         { label: 'Account deleted',              tone: 'saa-action-deleted' },
  own_name_changed:     { label: 'Changed own name',             tone: 'saa-action-self' },
  own_password_changed: { label: 'Changed own password',         tone: 'saa-action-self' },
};

const ROLE_LABELS = { admin: 'Admin', superadmin: 'Superadmin' };

// An action added to the backend before this page knows it still gets a
// readable label rather than a raw key.
function actionInfo(action) {
  if (ACTIONS[action]) return ACTIONS[action];
  const words = String(action || 'unknown action').replace(/_/g, ' ').trim();
  return { label: words.charAt(0).toUpperCase() + words.slice(1), tone: 'saa-action-unknown' };
}

const shortId = (id) => (id ? String(id).slice(0, 8) : 'unknown');

function formatValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }
  return String(value);
}

function Timestamp({ value }) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return <span className="saa-muted">—</span>;
  }
  return (
    <div className="saa-timestamp">
      <span>{date.toLocaleDateString()}</span>
      <span className="saa-timestamp-time">{date.toLocaleTimeString()}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const tone = status === 'Active'
    ? 'saa-status-active'
    : status === 'Suspended'
    ? 'saa-status-suspended'
    : 'saa-status-other';
  return <span className={`saa-status-badge ${tone}`}>{formatValue(status)}</span>;
}

/**
 * One account as recorded on the entry. Name and email are snapshots from the
 * time of the action; `users` (the current accounts) adds what has changed
 * since — the account deleted, or renamed. While `users` is unknown (still
 * loading, or the fetch failed) nothing is claimed either way.
 */
function AccountCell({ person, users, onFilter }) {
  const displayName = person.name || person.email || `Unknown account (${shortId(person.id)})`;
  const current = users.byId ? users.byId.get(person.id) : undefined;
  const isDeleted = users.byId !== null && Boolean(person.id) && !current;
  const renamedTo = current && person.name && current.name && current.name !== person.name
    ? current.name
    : null;

  return (
    <div className="saa-account">
      <div className="saa-account-line">
        {person.id ? (
          <button
            type="button"
            className="saa-account-name saa-account-link"
            onClick={() => onFilter(person.id)}
            title="Show all activity for this account"
          >
            {displayName}
          </button>
        ) : (
          <span className="saa-account-name">{displayName}</span>
        )}
        {person.role === 'superadmin' && <span className="saa-role-chip">Superadmin</span>}
        {isDeleted && (
          <span
            className="saa-deleted-tag"
            title="This account no longer exists. Name and email are as they were at the time of this action."
          >
            Deleted account
          </span>
        )}
      </div>
      {person.name && person.email && <span className="saa-account-email">{person.email}</span>}
      {renamedTo && (
        <span
          className="saa-account-now"
          title="The account's current name. The name above is as it was at the time of this action."
        >
          now {renamedTo}
        </span>
      )}
    </div>
  );
}

function DetailsList({ details }) {
  const entries = Object.entries(details);
  if (entries.length === 0) {
    return <span className="saa-muted">No further details recorded</span>;
  }
  return (
    <dl className="saa-details-list">
      {entries.map(([key, value]) => (
        <div key={key} className="saa-details-pair">
          <dt>{key}</dt>
          <dd>{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

// Returns null when the entry doesn't carry what its action normally records,
// so the caller falls back to listing whatever details there are.
function knownDetails(entry) {
  const { action, details, target } = entry;
  switch (action) {
    case 'user_suspended':
    case 'user_reactivated':
      if (!details.prevStatus && !details.newStatus) return null;
      return (
        <div className="saa-shift">
          {details.prevStatus && (
            <>
              <StatusBadge status={details.prevStatus} />
              <span className="saa-arrow">➔</span>
            </>
          )}
          {details.newStatus && <StatusBadge status={details.newStatus} />}
        </div>
      );
    case 'own_name_changed':
      if (!details.prevName && !details.newName) return null;
      return (
        <div className="saa-shift saa-shift-names">
          <span className="saa-name-old">{formatValue(details.prevName)}</span>
          <span className="saa-arrow">➔</span>
          <span className="saa-name-new">{formatValue(details.newName)}</span>
        </div>
      );
    case 'user_deleted':
      if (!details.status) return null;
      return <span>Was {formatValue(details.status)} when deleted</span>;
    case 'user_created':
      // Not in details: the created role is the target's role snapshot.
      return target.role
        ? <span>As {ROLE_LABELS[target.role] || formatValue(target.role)}</span>
        : <span className="saa-muted">Role not recorded</span>;
    default:
      return null;
  }
}

function DetailsCell({ entry }) {
  return knownDetails(entry) ?? <DetailsList details={entry.details} />;
}

function errorContent(error) {
  if (error?.error === 'Forbidden') {
    return { message: 'Only superadmins can view account activity.', action: null };
  }
  if (error?.error === 'ValidationError') {
    return { message: "That account link isn't valid.", action: 'clear' };
  }
  // The API's own 404, not this page's route: the backend this dashboard is
  // connected to doesn't have the account activity endpoint.
  if (error?.error === 'NotFound') {
    return {
      message: "The server this dashboard is connected to doesn't provide account activity yet (it answered “Route not found”). The backend may need restarting or updating.",
      action: 'retry',
    };
  }
  return {
    message: error?.message || 'Account activity could not be loaded.',
    action: 'retry',
  };
}

export function SuperadminAccountActivity() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedAction = searchParams.get('action') || '';
  const selectedUserId = searchParams.get('userId') || '';

  // byId is null until the current accounts are known. If the fetch fails it
  // stays null, so no account is ever labelled deleted on a guess.
  const [users, setUsers] = useState({ byId: null, list: [] });

  useEffect(() => {
    let cancelled = false;
    userService.getUsers()
      .then((list) => {
        if (cancelled) return;
        const valid = (Array.isArray(list) ? list : []).filter((u) => u && u.id);
        setUsers({ byId: new Map(valid.map((u) => [u.id, u])), list: valid });
      })
      .catch(() => {
        // Leave byId null: deleted/renamed hints are simply not shown.
      });
    return () => { cancelled = true; };
  }, []);

  const {
    items: entries, total, page, pageSize, setPage, setPageSize, isLoading, error, refetch,
  } = usePaginatedAccountAuditLogs({
    action: selectedAction || undefined,
    userId: selectedUserId || undefined,
  });

  const updateParam = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  };

  const clearFilters = () => setSearchParams({}, { replace: true });
  const filterToAccount = (id) => updateParam('userId', id);

  const sortedUsers = useMemo(
    () => [...users.list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [users.list]
  );

  // The selected account may be deleted (not in the users list) — name it
  // from the loaded entries if possible.
  const accountNameFor = (id) => {
    const current = users.byId?.get(id);
    if (current?.name) return current.name;
    for (const entry of entries) {
      if (entry.actor.id === id && entry.actor.name) return entry.actor.name;
      if (entry.target.id === id && (entry.target.name || entry.target.email)) {
        return entry.target.name || entry.target.email;
      }
    }
    return `account ${shortId(id)}`;
  };
  const selectedAccountName = selectedUserId ? accountNameFor(selectedUserId) : '';

  const selectedIsListed = !selectedUserId || Boolean(users.byId?.has(selectedUserId));
  const selectedActionIsKnown = !selectedAction || Boolean(ACTIONS[selectedAction]);
  const hasFilters = Boolean(selectedAction || selectedUserId);
  const errorInfo = error ? errorContent(error) : null;

  return (
    <div className="saa-wrapper" id="superadmin-account-activity">

      {/* Page Header */}
      <div className="saa-header-card">
        <div>
          <span className="saa-compliance-label">ACCOUNT GOVERNANCE</span>
          <h1 className="saa-title">Account Activity Log</h1>
          <p className="saa-subtitle">
            Records who created, suspended, reactivated or deleted an admin account, who reset another admin's password, and who changed their own name or password. Names and emails are shown as they were at the time.
          </p>
        </div>
        <div className="saa-header-actions">
          <span className="saa-secure-tag">SUPERADMIN ACCESS ONLY</span>
        </div>
      </div>

      {/* Filters */}
      <div className="saa-filters-card">
        <div className="saa-filter-group">
          <label className="saa-filter-label" htmlFor="saa-action-filter">Action</label>
          <select
            id="saa-action-filter"
            value={selectedAction}
            onChange={(e) => updateParam('action', e.target.value)}
            className="saa-select"
          >
            <option value="">All actions</option>
            {Object.entries(ACTIONS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
            {!selectedActionIsKnown && (
              <option value={selectedAction}>{actionInfo(selectedAction).label}</option>
            )}
          </select>
        </div>

        <div className="saa-filter-group">
          <label className="saa-filter-label" htmlFor="saa-account-filter">Account</label>
          <select
            id="saa-account-filter"
            value={selectedUserId}
            onChange={(e) => updateParam('userId', e.target.value)}
            className="saa-select"
          >
            <option value="">All accounts</option>
            {sortedUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || 'Unnamed'}{u.email ? ` (${u.email})` : ''}
              </option>
            ))}
            {!selectedIsListed && (
              <option value={selectedUserId}>{selectedAccountName}</option>
            )}
          </select>
        </div>

        {selectedUserId && (
          <div className="saa-filter-chip-row">
            <span className="saa-filter-chip">
              Showing activity for <strong>{selectedAccountName}</strong> (as actor or affected account)
              <button
                type="button"
                className="saa-filter-chip-clear"
                onClick={() => updateParam('userId', '')}
                aria-label="Clear account filter"
              >
                <X size={12} />
                <span>Clear</span>
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="saa-table-card">
        <div className="saa-table-scroll">
          <table className="saa-table">
            <thead>
              <tr className="saa-thead-row">
                <th className="saa-th">When</th>
                <th className="saa-th">What</th>
                <th className="saa-th">Done By</th>
                <th className="saa-th">Account Affected</th>
                <th className="saa-th">Details</th>
              </tr>
            </thead>
            <tbody className="saa-tbody">
              {isLoading && <TableLoadingRows colSpan={COLUMN_COUNT} />}

              {!isLoading && errorInfo && (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="saa-empty-row saa-error-row">
                    <p>{errorInfo.message}</p>
                    {errorInfo.action === 'clear' && (
                      <button type="button" className="saa-empty-btn" onClick={clearFilters}>
                        Clear filters
                      </button>
                    )}
                    {errorInfo.action === 'retry' && (
                      <button type="button" className="saa-empty-btn" onClick={refetch}>
                        Try again
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {!isLoading && !errorInfo && entries.map((entry) => {
                const { label, tone } = actionInfo(entry.action);
                const isSelf = Boolean(entry.actor.id) && entry.actor.id === entry.target.id;
                return (
                  <tr key={entry.id} className="saa-row">
                    <td className="saa-td">
                      <Timestamp value={entry.timestamp} />
                    </td>
                    <td className="saa-td">
                      <span className={`saa-action-badge ${tone}`}>{label}</span>
                    </td>
                    <td className="saa-td">
                      <AccountCell person={entry.actor} users={users} onFilter={filterToAccount} />
                    </td>
                    <td className="saa-td">
                      {isSelf
                        ? <span className="saa-self">Their own account</span>
                        : <AccountCell person={entry.target} users={users} onFilter={filterToAccount} />}
                    </td>
                    <td className="saa-td saa-details">
                      <DetailsCell entry={entry} />
                    </td>
                  </tr>
                );
              })}

              {!isLoading && !errorInfo && entries.length === 0 && (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="saa-empty-row">
                    {hasFilters ? (
                      <>
                        <p>No matching account activity for these filters.</p>
                        <button type="button" className="saa-empty-btn" onClick={clearFilters}>
                          Clear filters
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="saa-empty-title">No account activity recorded yet.</p>
                        <p>
                          Account changes appear here: creating, suspending, reactivating or deleting accounts, password resets, and people changing their own name or password. Changes made before this log was introduced aren't recorded.
                        </p>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={errorInfo ? 0 : total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

    </div>
  );
}
