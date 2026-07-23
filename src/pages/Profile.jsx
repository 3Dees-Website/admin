import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Calendar, Clock, AlertCircle, CheckCircle2, Check, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { profileService } from '../services/profileService';
import './styles/Profile.css';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const RULES = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'lower', label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { key: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'digit', label: 'One digit', test: (v) => /\d/.test(v) },
  { key: 'special', label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function formatDate(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function Profile() {
  const { updateCurrentUser } = useAuth();
  const { addToast } = useToast();

  const [me, setMe] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const [name, setName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFieldErrors, setPasswordFieldErrors] = useState({ current: '', new: '' });
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const fetchMe = useCallback(() => {
    return profileService.getMe()
      .then((user) => {
        setMe(user);
        setName(user.name);
        setFetchError(false);
      })
      .catch(() => setFetchError(true))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const handleRetry = () => {
    setIsLoading(true);
    fetchMe();
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === me.name) return;

    setIsSavingName(true);
    setNameSaved(false);
    try {
      const updated = await profileService.updateMyName(name.trim());
      setMe(updated);
      setName(updated.name);
      updateCurrentUser({ name: updated.name });
      setNameSaved(true);
      addToast('success', 'Name Updated', 'Your display name has been changed.');
    } catch (err) {
      addToast('error', 'Update Failed', err?.message || 'Could not update your name.');
    } finally {
      setIsSavingName(false);
    }
  };

  const passwordValid = PASSWORD_RULE.test(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const showMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmitPassword =
    currentPassword.trim().length > 0 && passwordValid && passwordsMatch && !isChangingPassword;

  const ruleChecks = RULES.map((rule) => ({ ...rule, met: rule.test(newPassword) }));

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!canSubmitPassword) return;

    setIsChangingPassword(true);
    setPasswordFieldErrors({ current: '', new: '' });
    setPasswordSuccess(false);

    try {
      await profileService.changeMyPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
      addToast('success', 'Password Changed', 'Your password has been updated.');
    } catch (err) {
      if (err?.error === 'IncorrectPassword') {
        setPasswordFieldErrors({ current: 'Your current password is incorrect.', new: '' });
      } else if (err?.error === 'SamePassword') {
        setPasswordFieldErrors({ current: '', new: err?.message || 'New password must be different from your current password.' });
      } else if (err?.error === 'ValidationError') {
        setPasswordFieldErrors({ current: '', new: err?.message || 'Password does not meet the required rules.' });
      } else {
        addToast('error', 'Password Change Failed', err?.message || 'Could not change your password.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="pf-wrapper">
      <div className="pf-header">
        <h2 className="pf-title">Your Profile</h2>
        <p className="pf-subtitle">Manage your account details and security credentials.</p>
      </div>

      {isLoading && (
        <div className="pf-loading-state">
          <svg className="pf-spinner" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading your profile…</span>
        </div>
      )}

      {!isLoading && fetchError && (
        <div className="pf-error-state">
          <AlertCircle size={18} />
          <span>Could not load your profile.</span>
          <button type="button" className="pf-retry-btn" onClick={handleRetry}>Retry</button>
        </div>
      )}

      {!isLoading && !fetchError && me && (
        <div className="pf-columns">
        <div className="pf-col-left">
          {/* Read-only info */}
          <div className="pf-card">
            <h3 className="pf-card-title">Account Details</h3>
            <div className="pf-info-rows">
              <div className="pf-info-row">
                <span className="pf-info-label"><Mail size={13} /> Email</span>
                <span className="pf-info-value">{me.email}</span>
              </div>
              <div className="pf-info-row">
                <span className="pf-info-label"><ShieldCheck size={13} /> Role</span>
                <span className="pf-info-value capitalize">{me.role}</span>
              </div>
              <div className="pf-info-row">
                <span className="pf-info-label"><Calendar size={13} /> Account Created</span>
                <span className="pf-info-value">{formatDate(me.created_at)}</span>
              </div>
              <div className="pf-info-row">
                <span className="pf-info-label"><Clock size={13} /> Last Login</span>
                <span className="pf-info-value">{formatDate(me.last_login)}</span>
              </div>
            </div>
          </div>

          {/* Editable name */}
          <div className="pf-card">
            <h3 className="pf-card-title">Display Name</h3>
            <form onSubmit={handleSaveName} className="pf-name-form">
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setNameSaved(false); }}
                className="pf-input"
                placeholder="Your name"
              />
              <button
                type="submit"
                disabled={isSavingName || !name.trim() || name.trim() === me.name}
                className="pf-submit-btn"
              >
                {isSavingName ? 'Saving...' : 'Save'}
              </button>
            </form>
            <AnimatePresence>
              {nameSaved && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="pf-success"
                >
                  <CheckCircle2 size={13} />
                  <span>Name updated.</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="pf-col-right">
          {/* Change password */}
          <div className="pf-card">
            <h3 className="pf-card-title">Change Password</h3>
            <form onSubmit={handleChangePassword} className="pf-form">
              <div className="pf-field">
                <label className="pf-label">Current Password</label>
                <div className="pf-input-wrap">
                  <Lock className="pf-input-icon" />
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => { setCurrentPassword(e.target.value); setPasswordFieldErrors((p) => ({ ...p, current: '' })); }}
                    className="pf-input pf-input-password"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="pf-toggle-pass"
                    aria-label="Toggle password view"
                  >
                    {showCurrent ? <EyeOff className="pf-eye-icon" /> : <Eye className="pf-eye-icon" />}
                  </button>
                </div>
                {passwordFieldErrors.current && (
                  <div className="pf-error">
                    <AlertCircle size={13} />
                    <span>{passwordFieldErrors.current}</span>
                  </div>
                )}
              </div>

              <div className="pf-field">
                <label className="pf-label">New Password</label>
                <div className="pf-input-wrap">
                  <Lock className="pf-input-icon" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordFieldErrors((p) => ({ ...p, new: '' })); }}
                    className="pf-input pf-input-password"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="pf-toggle-pass"
                    aria-label="Toggle password view"
                  >
                    {showNew ? <EyeOff className="pf-eye-icon" /> : <Eye className="pf-eye-icon" />}
                  </button>
                </div>
                {passwordFieldErrors.new && (
                  <div className="pf-error">
                    <AlertCircle size={13} />
                    <span>{passwordFieldErrors.new}</span>
                  </div>
                )}
              </div>

              <ul className="pf-rules">
                {ruleChecks.map((rule) => (
                  <li key={rule.key} className={`pf-rule${rule.met ? ' pf-rule--met' : ''}`}>
                    {rule.met ? <Check size={12} /> : <X size={12} />}
                    <span>{rule.label}</span>
                  </li>
                ))}
              </ul>

              <div className="pf-field">
                <label className="pf-label">Confirm New Password</label>
                <div className="pf-input-wrap">
                  <Lock className="pf-input-icon" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pf-input pf-input-password"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="pf-toggle-pass"
                    aria-label="Toggle password view"
                  >
                    {showConfirm ? <EyeOff className="pf-eye-icon" /> : <Eye className="pf-eye-icon" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showMismatch && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="pf-error"
                  >
                    <AlertCircle size={13} />
                    <span>Passwords do not match.</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <button type="submit" disabled={!canSubmitPassword} className="pf-submit-btn">
                {isChangingPassword ? 'Changing Password...' : 'Change Password'}
              </button>

              <AnimatePresence>
                {passwordSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="pf-success"
                  >
                    <CheckCircle2 size={13} />
                    <span>Your password has been changed.</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
