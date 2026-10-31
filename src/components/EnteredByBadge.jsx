import { UserPen } from 'lucide-react';
import './styles/EnteredByBadge.css';

/**
 * "Entered by Jane": the application was keyed in by staff, not submitted by
 * the applicant. A permanent historical fact, so unlike PresenceBadge it also
 * prints. Nothing renders for a self-submitted row (null) or one that never
 * carried the field (undefined).
 */
export function EnteredByBadge({ enteredBy, className = '' }) {
  if (!enteredBy) return null;
  const detail = [enteredBy.name, enteredBy.email].filter(Boolean).join(' · ');
  return (
    <span className={`ebb ${className}`.trim()} title={`Entered by staff on the applicant's behalf: ${detail}`}>
      <UserPen className="ebb-icon" aria-hidden="true" />
      <span className="ebb-text">Entered by {enteredBy.name}</span>
    </span>
  );
}
