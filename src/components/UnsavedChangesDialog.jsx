import { AlertTriangle } from 'lucide-react';
import './styles/UnsavedChangesDialog.css';

/** "Leave without saving?" — shown by AdminLayout when a guarded page is left. */
export function UnsavedChangesDialog({ message, onStay, onLeave }) {
  return (
    <div className="ucd-overlay">
      <div className="ucd-backdrop" onClick={onStay} />
      <div className="ucd-modal" role="alertdialog" aria-modal="true" aria-labelledby="ucd-title">
        <AlertTriangle className="ucd-icon" />
        <h3 id="ucd-title" className="ucd-title">Leave without saving?</h3>
        <p className="ucd-desc">{message}</p>
        <div className="ucd-actions">
          <button type="button" className="ucd-btn" onClick={onStay} autoFocus>Stay on this page</button>
          <button type="button" className="ucd-btn ucd-btn--danger" onClick={onLeave}>Leave and discard</button>
        </div>
      </div>
    </div>
  );
}
