import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';
import { useJobs } from '../hooks/useJobs';
import { useAuth } from '../hooks/useAuth';
import { useApplications } from '../hooks/useApplications';
import { useFieldCatalog } from '../hooks/useFieldCatalog';
import { usePaginatedScreened } from '../hooks/usePaginatedScreened';
import { useScreenedRowDetails, detailKey } from '../hooks/useScreenedRowDetails';
import { StatusBadge } from './StatusBadge';
import { StatusActions } from './StatusActions';
import { EgiDecisionBadge } from './EgiBadges';
import { ApprovalCapBadge } from './ApprovalCapBadge';
import { PaginationControls } from './PaginationControls';
import { TableLoadingRows } from './TableLoadingRows';
import { TableErrorRow } from './TableErrorRow';
import { describeLoadError } from '../utils/describeLoadError';
import { routeBaseFor } from '../utils/routeBase';
import './styles/ScreenedList.css';

// The endpoint's sort keys, and the order each starts in (its own defaults).
const SORTS = {
  score: { label: 'Score', defaultOrder: 'desc' },
  name: { label: 'Candidate', defaultOrder: 'asc' },
  state: { label: 'State of origin', defaultOrder: 'asc' },
  job: { label: 'Vacancy', defaultOrder: 'asc' },
  submitted: { label: 'Submitted', defaultOrder: 'desc' },
};

// view is case-sensitive on the server; Archived is shown as "Saved".
const VIEWS = [
  { value: 'Screened', label: 'Screened' },
  { value: 'Archived', label: 'Saved' },
  { value: 'both', label: 'Screened and Saved' },
];

const ROW_BUTTONS = {
  save: 'sta-btn sta-btn--save scr-row-btn',
  approve: 'sta-btn sta-btn--approve scr-row-btn',
};

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

function SortHeader({ sortKey, sort, order, onSort, className = '' }) {
  const active = sort === sortKey;
  return (
    <th className={`scr-th ${className}`} aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`scr-sort-btn${active ? ' scr-sort-btn--active' : ''}`} onClick={() => onSort(sortKey)}>
        {SORTS[sortKey].label}
        {active && (order === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  );
}

/** The Screened list. */
export function ScreenedList() {
  const { jobs } = useJobs();
  const { currentUser } = useAuth();
  const { reviewApplication } = useApplications();
  const { catalog } = useFieldCatalog();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('All');
  const [selectedState, setSelectedState] = useState('All');
  const [view, setView] = useState('Screened');
  const [sort, setSort] = useState('score');
  const [order, setOrder] = useState(SORTS.score.defaultOrder);

  const base = routeBaseFor(currentUser);
  const stateOptions = catalog?.fields.find((f) => f.key === 'stateOfOrigin')?.options || [];

  const {
    items: loadedItems, total, page, pageSize, setPage, setPageSize, isLoading, error, refetch,
  } = usePaginatedScreened({
    view,
    sort,
    order,
    jobId: selectedJobId !== 'All' ? selectedJobId : undefined,
    stateOfOrigin: selectedState !== 'All' ? selectedState : undefined,
    search: searchTerm,
  });

  // On a failed load the hook still holds the last good rows (possibly from a
  // different filter); drop them so nothing treats them as the current list.
  const items = error ? [] : loadedItems;
  const loadError = error ? describeLoadError(error, 'the screened candidates') : null;

  const { details, setDetail, reset } = useScreenedRowDetails(items);

  const handleSort = (key) => {
    if (key === sort) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setOrder(SORTS[key].defaultOrder);
    }
  };

  const handleRefresh = () => {
    reset();
    refetch();
  };

  // The reply to a status change carries the row's fresh allowedTransitions.
  const handleTransition = async (item, status, input) => {
    const updated = await reviewApplication(item.id, status, input);
    if (updated) {
      setDetail(updated);
      refetch();
    }
    return updated;
  };

  const renderActions = (item) => {
    const app = item.allowedTransitions ? item : details[detailKey(item)];
    if (!app) return <span className="scr-muted">Loading…</span>;
    if (app === 'error') return <span className="scr-muted">Couldn&apos;t load actions</span>;
    return (
      <StatusActions
        app={app}
        only={['Archived', 'Approved']}
        emptyText="—"
        buttonClass={ROW_BUTTONS}
        onTransition={(status, input) => handleTransition(item, status, input)}
      />
    );
  };

  const colSpan = 7;

  return (
    <div className="scr-wrapper">
      <div className="scr-header-card">
        <div>
          <span className="scr-eyebrow">SCREENING</span>
          <h1 className="scr-title">Screened Candidates</h1>
          <p className="scr-subtitle">
            Candidates who have been scored, ranked for comparison. Save one for the future, or approve them to send to EGI.
          </p>
        </div>
        <button type="button" className="scr-btn" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="scr-filters">
        <div className="scr-filter scr-filter--search">
          <label className="scr-filter-label" htmlFor="scr-search">Search</label>
          <div className="scr-search-wrap">
            <Search size={14} className="scr-search-icon" />
            <input
              id="scr-search"
              type="text"
              className="scr-input scr-input--search"
              placeholder="Name, email or reference…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="scr-filter">
          <label className="scr-filter-label" htmlFor="scr-view">Show</label>
          <select id="scr-view" className="scr-input" value={view} onChange={(e) => setView(e.target.value)}>
            {VIEWS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </div>
        <div className="scr-filter">
          <label className="scr-filter-label" htmlFor="scr-job">Vacancy</label>
          <select id="scr-job" className="scr-input" value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
            <option value="All">All vacancies</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} ({j.clientOrg})</option>)}
          </select>
        </div>
        <div className="scr-filter">
          <label className="scr-filter-label" htmlFor="scr-state">State of origin</label>
          <select id="scr-state" className="scr-input" value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
            <option value="All">All states</option>
            {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="scr-table-card">
        <div className="scr-table-scroll">
          <table className="scr-table">
            <thead>
              <tr>
                <SortHeader sortKey="name" sort={sort} order={order} onSort={handleSort} />
                <SortHeader sortKey="job" sort={sort} order={order} onSort={handleSort} />
                <SortHeader sortKey="state" sort={sort} order={order} onSort={handleSort} />
                <SortHeader sortKey="score" sort={sort} order={order} onSort={handleSort} className="scr-th-center" />
                <th className="scr-th scr-th-center">Stage</th>
                <SortHeader sortKey="submitted" sort={sort} order={order} onSort={handleSort} className="scr-th-center" />
                <th className="scr-th scr-th-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableLoadingRows colSpan={colSpan} />}
              {!isLoading && loadError && (
                <TableErrorRow colSpan={colSpan} message={loadError.message} onRetry={loadError.canRetry ? refetch : undefined} />
              )}
              {!isLoading && items.map((item) => (
                <tr key={item.id} className="scr-row">
                  <td className="scr-td">
                    <span className="scr-name">{item.applicantName}</span>
                    <span className="scr-meta">{item.applicantEmail}</span>
                    <span className="scr-meta">
                      {item.referenceId} · <Link className="scr-link" to={`${base}/applications?openApp=${item.id}`}>Open file</Link>
                    </span>
                  </td>
                  <td className="scr-td">
                    {item.jobTitle || 'Deleted Position'}
                    <ApprovalCapBadge jobId={item.jobId} cap={item.approvalCap} className="scr-cap" />
                  </td>
                  <td className="scr-td">{item.stateOfOrigin || '—'}</td>
                  <td className="scr-td scr-td-center">
                    {item.screeningTotal !== null ? (
                      <>
                        <span className="scr-score">{item.screeningTotal} / {item.screeningMax}</span>
                        {item.screeningPercentage !== null && <span className="scr-meta">{item.screeningPercentage}%</span>}
                        {item.passed !== null && (
                          <span className={`scr-pass${item.passed ? ' scr-pass--yes' : ''}`}>
                            {item.passed ? 'Pass' : 'Below pass mark'}
                          </span>
                        )}
                      </>
                    ) : '—'}
                  </td>
                  <td className="scr-td scr-td-center">
                    <StatusBadge status={item.status} className="scr-stage" />
                    {/* Only once EGI has decided: a Screened row's default Pending is not news. */}
                    {item.egiDecision && item.egiDecision !== 'Pending' && <EgiDecisionBadge decision={item.egiDecision} />}
                    <span className="scr-meta">Screened {formatDate(item.screenedAt)}</span>
                  </td>
                  <td className="scr-td scr-td-center">{formatDate(item.submittedAt)}</td>
                  <td className="scr-td scr-td-right"><div className="scr-actions">{renderActions(item)}</div></td>
                </tr>
              ))}
              {!isLoading && !loadError && items.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="scr-empty">
                    No {view === 'Archived' ? 'saved' : view === 'both' ? 'screened or saved' : 'screened'} candidates match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={loadError ? 0 : total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
