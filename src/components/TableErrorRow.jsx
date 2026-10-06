import './styles/TableErrorRow.css';

/**
 * A failed load, said plainly, with a way forward when retrying can help.
 * Shown in place of a list's rows and its empty state — never beside them.
 */
export function LoadErrorMessage({ message, onRetry, retryLabel = 'Try again' }) {
  return (
    <div className="ter-box" role="alert">
      <p className="ter-message">{message}</p>
      {onRetry && (
        <button type="button" className="ter-btn" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function TableErrorRow({ colSpan, ...props }) {
  return (
    <tr>
      <td colSpan={colSpan} className="ter-cell">
        <LoadErrorMessage {...props} />
      </td>
    </tr>
  );
}
