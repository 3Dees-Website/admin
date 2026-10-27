import { AlertTriangle } from 'lucide-react';
import { DELIVERY_STATE_MAP } from '../utils/egiDeliveryState';
import { getEgiDecisionMeta, getEgiSyncMeta, unknownMeta } from '../utils/applicationStatus';
import './styles/EgiBadges.css';

export function EgiSyncBadge({ status }) {
  const entry = getEgiSyncMeta(status);
  return <span className={`egi-badge egi-badge--${entry.tone}`}>{entry.label}</span>;
}

export function EgiDeliveryBadge({ state }) {
  const entry = DELIVERY_STATE_MAP[state] || unknownMeta('EGI delivery state', state);
  return (
    <span className={`egi-badge egi-badge--${entry.tone}`}>
      {entry.icon && <AlertTriangle className="egi-badge-icon" aria-hidden="true" />}
      {entry.label}
    </span>
  );
}

export function EgiDecisionBadge({ decision }) {
  const entry = getEgiDecisionMeta(decision);
  return <span className={`egi-badge egi-badge--${entry.tone}`}>{entry.label}</span>;
}

export function EgiResendBadge({ count }) {
  if (!count) return null;
  return <span className="egi-badge egi-badge--blue">Resent ×{count}</span>;
}
