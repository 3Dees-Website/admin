import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useRouteBase } from '../hooks/useRouteBase';
import { StatusBadge } from './StatusBadge';
import { hasDuplicateFlags } from '../utils/duplicateFlags';
import './styles/DuplicateFlagsPanel.css';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

function MatchList({ title, tone, group, renderMeta, base }) {
  if (group.count === 0) return null;
  const hidden = group.count - group.matches.length;
  return (
    <div className={`dfp-group dfp-group--${tone}`}>
      <p className="dfp-title">
        <AlertTriangle className="dfp-icon" aria-hidden="true" />
        {title} ({group.count})
      </p>
      <ul className="dfp-list">
        {group.matches.map((m) => (
          <li key={m.id} className="dfp-item">
            <span className="dfp-ref">{m.referenceId}</span>
            {renderMeta(m)}
            <Link className="dfp-link" to={`${base}/applications?openApp=${m.id}`}>Open file</Link>
          </li>
        ))}
      </ul>
      {hidden > 0 && <p className="dfp-more">+ {hidden} more not listed</p>}
    </div>
  );
}

/** Which other applications this one may duplicate. Hidden in print (see ApplicationDetailPrint.css). */
export function DuplicateFlagsPanel({ flags }) {
  const base = useRouteBase();
  if (!hasDuplicateFlags(flags)) return null;
  return (
    <div className="dfp ad-dup-panel">
      <MatchList
        title="Already accepted for another application"
        tone="accepted"
        group={flags.alreadyAccepted}
        base={base}
        renderMeta={(m) => (
          <>
            <span>{m.jobTitle || 'Deleted Position'}</span>
            <span className="dfp-date">Accepted {formatDate(m.decidedAt)}</span>
          </>
        )}
      />
      <MatchList
        title="Possible duplicates for this job"
        tone="same-job"
        group={flags.sameJob}
        base={base}
        renderMeta={(m) => (
          <>
            <StatusBadge status={m.status} className="dfp-status" />
            <span className="dfp-date">Submitted {formatDate(m.submittedAt)}</span>
          </>
        )}
      />
    </div>
  );
}
