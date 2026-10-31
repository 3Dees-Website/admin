import { Eye } from 'lucide-react';
import './styles/PresenceBadge.css';

// "Jane viewing" / "Jane, Ayo viewing" / "Jane, Ayo +2 viewing". The title= lists everyone.
const summarize = (names) => (
  names.length <= 2 ? names.join(', ') : `${names[0]}, ${names[1]} +${names.length - 2}`
);

/**
 * The other admins currently viewing an application. Nothing renders for a row
 * with no viewers or one that never carried the field.
 */
export function PresenceBadge({ viewers, className = '' }) {
  if (!Array.isArray(viewers) || viewers.length === 0) return null;
  const names = viewers.map((v) => v.name);
  return (
    <span className={`pvb ${className}`.trim()} title={`Currently viewing: ${names.join(', ')}`}>
      <Eye className="pvb-icon" aria-hidden="true" />
      <span className="pvb-text">{summarize(names)} viewing</span>
    </span>
  );
}
