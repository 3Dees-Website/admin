import { getStatusMeta } from '../utils/applicationStatus';
import './styles/StatusBadge.css';

/**
 * An applicant status as a coloured label. Owns the colour only: the caller
 * passes its own `className` (badge, sva-status-badge, …) for size and shape,
 * so each page keeps its layout. Archived reads "Saved"; a status this build
 * doesn't know reads "Unknown: …" instead of borrowing another status's look.
 */
export function StatusBadge({ status, className = '' }) {
  const meta = getStatusMeta(status);
  return (
    <span
      className={`${className} stb stb--${meta.tone}`.trim()}
      title={meta.known ? undefined : `Unrecognised status: ${String(status)}`}
    >
      {meta.label}
    </span>
  );
}
