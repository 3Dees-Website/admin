import { AlertTriangle } from 'lucide-react';
import './styles/UnsavedChangesDialog.css';

/**
 * A plain "are you sure" for a bulk move that needs no input (e.g. Save N
 * candidates). Shares its look with UnsavedChangesDialog.
 */
export function BulkConfirmDialog({ open, title, message, confirmLabel = 'Confirm', busy = false, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="ucd-overlay">
      <div className="ucd-backdrop" onClick={busy ? undefined : onCancel} />
      <div className="ucd-modal" role="alertdialog" aria-modal="true" aria-labelledby="bcd-title">
        <AlertTriangle className="ucd-icon" />
        <h3 id="bcd-title" className="ucd-title">{title}</h3>
        <p className="ucd-desc">{message}</p>
        <div className="ucd-actions">
          <button type="button" className="ucd-btn" onClick={onCancel} disabled={busy} autoFocus>Cancel</button>
          <button type="button" className="ucd-btn ucd-btn--primary" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
