/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Plus, ToggleLeft, ToggleRight, Trash2, Key, X, Check, ShieldAlert, History } from 'lucide-react';
import './styles/SuperadminManageAdmins.css';

export function SuperadminManageAdmins() {
  const { admins, registerAdmin, toggleAdminSuspension, resetAdminPass, removeAdmin } = useAuth();
  const { addToast } = useToast();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [resetPassTarget, setResetPassTarget] = useState(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState(null);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [overridePass, setOverridePass] = useState('');

  // Every action below waits for the server before closing, so a failure
  // keeps the modal and whatever was typed.
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Ids with a status toggle in flight. Each request flips the status, so a
  // second click before the first answers would undo it — and leave two
  // entries in the account activity log.
  // The ref is the guard (it updates synchronously, so even two clicks inside
  // one render can't both pass); the state drives the disabled button.
  const togglingRef = useRef(new Set());
  const [togglingIds, setTogglingIds] = useState(() => new Set());

  const handleRegister = async (e) => {
    e.preventDefault();
    if (isRegistering) return;
    if (!newName.trim() || !newEmail.trim() || !newPass.trim()) {
      addToast('error', 'Incomplete Fields', 'Please fill out all administrative parameters.');
      return;
    }
    setIsRegistering(true);
    const success = await registerAdmin(newName, newEmail, newPass);
    setIsRegistering(false);
    if (success) {
      setNewName('');
      setNewEmail('');
      setNewPass('');
      setCreateModalOpen(false);
    }
  };

  const handlePasswordOverride = async (e) => {
    e.preventDefault();
    if (!resetPassTarget || isResetting) return;
    if (!overridePass.trim()) {
      addToast('error', 'Placeholder Field Empty', 'Please write a new alphanumeric passcode.');
      return;
    }
    setIsResetting(true);
    const success = await resetAdminPass(resetPassTarget.id, overridePass);
    setIsResetting(false);
    if (success) {
      setResetPassTarget(null);
      setOverridePass('');
    }
  };

  const handleDeleteStaff = async () => {
    if (!confirmDeleteTarget || isDeleting) return;
    setIsDeleting(true);
    const success = await removeAdmin(confirmDeleteTarget.id);
    setIsDeleting(false);
    if (success) setConfirmDeleteTarget(null);
  };

  const handleToggleSuspension = async (adminId) => {
    if (togglingRef.current.has(adminId)) return;
    togglingRef.current.add(adminId);
    setTogglingIds((prev) => new Set(prev).add(adminId));
    await toggleAdminSuspension(adminId);
    togglingRef.current.delete(adminId);
    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.delete(adminId);
      return next;
    });
  };

  return (
    <div className="sma-wrapper" id="superadmin-admins-view">

      {/* Header */}
      <div className="sma-header-card">
        <div>
          <h1 className="sma-title">Active Advisory Staff Registry</h1>
          <p className="sma-subtitle">Authorise corporate staff profiles. Register, freeze, delete, or reset password hashes.</p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="sma-register-btn"
          id="btn-register-officer"
        >
          <Plus className="sma-btn-icon" />
          <span>Register Vetting Officer</span>
        </button>
      </div>

      {/* Staff Table */}
      <div className="sma-table-card">
        <div className="sma-table-scroll">
          <table className="sma-table">
            <thead>
              <tr className="sma-thead-row">
                <th className="sma-th">Administrative Officer</th>
                <th className="sma-th">Authorised Email</th>
                <th className="sma-th">Created Timestamp</th>
                <th className="sma-th">Last Activity Session</th>
                <th className="sma-th sma-th-center">Freeze Frame Status</th>
                <th className="sma-th sma-th-right">Operations Layout</th>
              </tr>
            </thead>
            <tbody className="sma-tbody">
              {admins.map((adm) => (
                <tr key={adm.id} className="sma-row">
                  <td className="sma-td">
                    <div className="sma-officer-cell">
                      <div className="sma-avatar">
                        {adm.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="sma-officer-name">{adm.name}</span>
                    </div>
                  </td>
                  <td className="sma-td sma-email">{adm.email}</td>
                  <td className="sma-td sma-muted">
                    {new Date(adm.createdAt || '').toLocaleString()}
                  </td>
                  <td className="sma-td sma-muted">
                    {adm.lastLogin ? new Date(adm.lastLogin).toLocaleString() : 'Never Active'}
                  </td>
                  <td className="sma-td sma-td-center">
                    <span className={`sma-status-badge ${adm.status === 'Active' ? 'sma-status-active' : 'sma-status-suspended'}`}>
                      {adm.status}
                    </span>
                  </td>
                  <td className="sma-td sma-td-right">
                    <div className="sma-actions">
                      <Link
                        to={`/superadmin/account-activity?userId=${encodeURIComponent(adm.id)}`}
                        className="sma-icon-btn"
                        title="View account activity"
                        aria-label={`View account activity for ${adm.name}`}
                      >
                        <History className="sma-icon" />
                      </Link>
                      {adm.role !== 'superadmin' && (
                        <>
                          <button
                            onClick={() => handleToggleSuspension(adm.id)}
                            disabled={togglingIds.has(adm.id)}
                            className="sma-toggle-btn"
                            title={adm.status === 'Active' ? 'Freeze Account / Suspend' : 'Activate Account'}
                          >
                            {adm.status === 'Active'
                              ? <ToggleRight className="sma-toggle-icon sma-toggle-active" />
                              : <ToggleLeft className="sma-toggle-icon sma-toggle-inactive" />
                            }
                            <span>{togglingIds.has(adm.id) ? 'Saving…' : 'Toggle Suspension'}</span>
                          </button>

                          <button
                            onClick={() => setResetPassTarget(adm)}
                            className="sma-icon-btn"
                            title="Reassign security passcode"
                          >
                            <Key className="sma-icon" />
                          </button>

                          <button
                            onClick={() => setConfirmDeleteTarget(adm)}
                            className="sma-icon-btn sma-icon-btn-delete"
                            title="Remove Officer profile"
                          >
                            <Trash2 className="sma-icon" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={6} className="sma-empty-row">
                    No active recruitment administrative staff logged inside registry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Modal */}
      {createModalOpen && (
        <div className="sma-overlay">
          <div className="sma-modal">
            <div className="sma-modal-header">
              <div>
                <h3 className="sma-modal-title">Register Vetting Officer</h3>
                <p className="sma-modal-subtitle">Authorise dynamic credentials for recruitment reviews.</p>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="sma-modal-close" disabled={isRegistering}>
                <X className="sma-close-icon" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="sma-form">
              <div className="sma-field">
                <label className="sma-label">Officer Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cynthia Ogbonna"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="sma-input"
                />
              </div>

              <div className="sma-field">
                <label className="sma-label">Authorised Email</label>
                <input
                  type="email"
                  required
                  placeholder="name@3dees.net"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="sma-input"
                />
              </div>

              <div className="sma-field">
                <label className="sma-label">Initial Password Passcode</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OfficerPass@3D"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className="sma-input"
                />
              </div>

              <div className="sma-form-footer">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="sma-cancel-btn" disabled={isRegistering}>
                  Cancel
                </button>
                <button type="submit" className="sma-submit-btn" disabled={isRegistering}>
                  <Check className="sma-btn-icon" />
                  <span>{isRegistering ? 'Registering…' : 'Register Officer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPassTarget && (
        <div className="sma-overlay">
          <div className="sma-modal sma-modal-sm">
            <div className="sma-modal-header">
              <h3 className="sma-modal-title">Overwrite Password Passcode</h3>
              <button onClick={() => setResetPassTarget(null)} className="sma-modal-close" disabled={isResetting}>
                <X className="sma-close-icon" />
              </button>
            </div>

            <form onSubmit={handlePasswordOverride} className="sma-form">
              <span className="sma-reset-desc">
                Reassigning security passcode for <strong className="sma-highlight">{resetPassTarget.name}</strong>.
              </span>

              <div className="sma-field">
                <label className="sma-label">Write New Passcode</label>
                <input
                  type="text"
                  required
                  placeholder="AdminOverride@123"
                  value={overridePass}
                  onChange={(e) => setOverridePass(e.target.value)}
                  className="sma-input"
                />
              </div>

              <div className="sma-form-footer sma-form-footer-tight">
                <button type="button" onClick={() => setResetPassTarget(null)} className="sma-cancel-btn" disabled={isResetting}>
                  Cancel
                </button>
                <button type="submit" className="sma-submit-btn" disabled={isResetting}>
                  {isResetting ? 'Saving…' : 'Override Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDeleteTarget && (
        <div className="sma-overlay">
          <div className="sma-modal sma-modal-sm sma-modal-danger">
            <div className="sma-delete-body">
              <ShieldAlert className="sma-danger-icon" />
              <div>
                <h3 className="sma-modal-title">Remove Staff Profile</h3>
                <p className="sma-delete-desc">
                  This disables <strong className="sma-bold-dark">{confirmDeleteTarget.name} ({confirmDeleteTarget.email})</strong> completely. Security token sessions will instantly sever.
                </p>
              </div>
            </div>

            <div className="sma-delete-footer">
              <button onClick={() => setConfirmDeleteTarget(null)} className="sma-cancel-btn" disabled={isDeleting}>
                Cancel Delete
              </button>
              <button onClick={handleDeleteStaff} className="sma-delete-btn" disabled={isDeleting}>
                {isDeleting ? 'Deleting…' : 'Delete Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}