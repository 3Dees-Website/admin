import { AlertTriangle } from 'lucide-react';
import { hasDuplicateFlags, describeMatches } from '../utils/duplicateFlags';
import './styles/DuplicateFlagBadges.css';

/**
 * "Possible duplicate ×2" (same job, amber) and "Already accepted ×1" (red).
 * Each pill shows only when its count is above 0; nothing renders for a row
 * with no flags or one that never carried them. The title= lists the matches.
 */
export function DuplicateFlagBadges({ flags, className = '' }) {
  if (!hasDuplicateFlags(flags)) return null;
  const { sameJob, alreadyAccepted } = flags;
  return (
    <span className={`dfb ${className}`.trim()}>
      {alreadyAccepted.count > 0 && (
        <span className="dfb-pill dfb-pill--accepted" title={describeMatches(alreadyAccepted, 'alreadyAccepted')}>
          <AlertTriangle className="dfb-icon" aria-hidden="true" />
          Already accepted ×{alreadyAccepted.count}
        </span>
      )}
      {sameJob.count > 0 && (
        <span className="dfb-pill dfb-pill--same-job" title={describeMatches(sameJob, 'sameJob')}>
          <AlertTriangle className="dfb-icon" aria-hidden="true" />
          Possible duplicate ×{sameJob.count}
        </span>
      )}
    </span>
  );
}
