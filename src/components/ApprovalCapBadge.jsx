import { AlertTriangle } from 'lucide-react';
import { useApprovalCap } from '../hooks/useApprovalCap';
import { formatApprovalCap } from '../utils/approvalCap';
import './styles/ApprovalCapBadge.css';

/**
 * "Approved: 3 of 5" for a job ("Approved: 3" when uncapped), with a warning
 * tone when the cap is exceeded. Renders nothing until a cap has been seen.
 * `cap` is the row's own approvalCap, used until a newer one arrives.
 */
export function ApprovalCapBadge({ jobId, cap, className = '' }) {
  const live = useApprovalCap(jobId, cap);
  if (!live) return null;
  const tone = live.overCap ? ' acb--over' : live.full ? ' acb--full' : '';
  return (
    <span
      className={`acb${tone} ${className}`}
      title={live.overCap ? 'More candidates are approved than the cap allows.' : live.full ? 'The approval cap has been reached.' : undefined}
    >
      {formatApprovalCap(live)}
      {live.overCap && <><AlertTriangle size={11} aria-hidden="true" /> Over cap</>}
      {live.full && !live.overCap && <span className="acb-flag">Full</span>}
    </span>
  );
}
