import './styles/EgiBadges.css';

const SYNC_MAP = {
  Pending: { tone: 'gray',  label: 'Not sent' },
  Queued:  { tone: 'blue',  label: 'Sending…' },
  Synced:  { tone: 'green', label: 'Sent' },
  Failed:  { tone: 'red',   label: 'Delivery failed' },
};

const DECISION_MAP = {
  Pending:  { tone: 'gray',  label: 'Awaiting EGI' },
  Accepted: { tone: 'green', label: 'Accepted by EGI' },
  Declined: { tone: 'red',   label: 'Declined by EGI' },
};

export function EgiSyncBadge({ status }) {
  const entry = SYNC_MAP[status] || SYNC_MAP.Pending;
  return <span className={`egi-badge egi-badge--${entry.tone}`}>{entry.label}</span>;
}

export function EgiDecisionBadge({ decision }) {
  const entry = DECISION_MAP[decision] || DECISION_MAP.Pending;
  return <span className={`egi-badge egi-badge--${entry.tone}`}>{entry.label}</span>;
}

export function EgiResendBadge({ count }) {
  if (!count) return null;
  return <span className="egi-badge egi-badge--blue">Resent ×{count}</span>;
}
