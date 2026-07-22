import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle2, Check, X } from 'lucide-react';
import { LogoSVG } from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import './styles/ResetPassword.css';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const RULES = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'lower', label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { key: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'digit', label: 'One digit', test: (v) => /\d/.test(v) },
  { key: 'special', label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export function ResetPassword() {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const id = searchParams.get('id');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState(null); // { message, error } on failure

  const passwordValid = PASSWORD_RULE.test(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const showMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const canSubmit = passwordValid && passwordsMatch && !isSubmitting;

  const ruleChecks = useMemo(
    () => RULES.map((rule) => ({ ...rule, met: rule.test(newPassword) })),
    [newPassword]
  );

  if (!token || !id) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rp-wrapper"
      >
        <div className="rp-card">
          <div className="rp-header">
            <LogoSVG light={false} />
            <h2 className="rp-title">Invalid Reset Link</h2>
            <p className="rp-subtitle">
              This password reset link is missing required information. Please request a new one.
            </p>
          </div>
          <Link to="/forgot-password" className="rp-submit-btn rp-submit-btn--link">
            Request a New Link
          </Link>
        </div>
      </motion.div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setResult(null);

    const res = await resetPassword({ id, token, newPassword });

    setIsSubmitting(false);

    if (res.success) {
      setSuccess(true);
      return;
    }

    setResult(res);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="rp-wrapper"
    >
      <div className="rp-card">

        {/* Header */}
        <div className="rp-header">
          <LogoSVG light={false} />
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success-icon"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rp-shield-wrap rp-shield-wrap--success"
              >
                <CheckCircle2 className="rp-shield-icon rp-shield-icon--success" />
              </motion.div>
            ) : (
              <motion.div
                key="lock-icon"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rp-shield-wrap"
              >
                <Lock className="rp-shield-icon" />
              </motion.div>
            )}
          </AnimatePresence>
          <h2 className="rp-title">
            {success ? 'Password Reset' : 'Set a New Password'}
          </h2>
          <p className="rp-subtitle">
            {success
              ? 'Your password has been reset. You can now log in with your new password.'
              : 'Choose a strong password for your account.'}
          </p>
        </div>

        {!success && (
          <form onSubmit={handleSubmit} className="rp-form">
            {/* New Password */}
            <div className="rp-field">
              <label className="rp-label">New Password</label>
              <div className="rp-input-wrap">
                <Lock className="rp-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rp-input rp-input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="rp-toggle-pass"
                  aria-label="Toggle password view"
                >
                  {showPassword ? <EyeOff className="rp-eye-icon" /> : <Eye className="rp-eye-icon" />}
                </button>
              </div>
            </div>

            {/* Password rules checklist */}
            <ul className="rp-rules">
              {ruleChecks.map((rule) => (
                <li key={rule.key} className={`rp-rule${rule.met ? ' rp-rule--met' : ''}`}>
                  {rule.met ? <Check size={12} /> : <X size={12} />}
                  <span>{rule.label}</span>
                </li>
              ))}
            </ul>

            {/* Confirm Password */}
            <div className="rp-field">
              <label className="rp-label">Confirm New Password</label>
              <div className="rp-input-wrap">
                <Lock className="rp-input-icon" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="rp-input rp-input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="rp-toggle-pass"
                  aria-label="Toggle password view"
                >
                  {showConfirm ? <EyeOff className="rp-eye-icon" /> : <Eye className="rp-eye-icon" />}
                </button>
              </div>
            </div>

            {/* Mismatch / server error */}
            <AnimatePresence>
              {(showMismatch || result) && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rp-error"
                >
                  <AlertCircle size={13} />
                  <span>{result ? result.message : 'Passwords do not match.'}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {result?.error === 'InvalidToken' && (
              <Link to="/forgot-password" className="rp-retry-link">
                Request a new link
              </Link>
            )}

            <button type="submit" disabled={!canSubmit} className="rp-submit-btn">
              {isSubmitting ? (
                <>
                  <svg className="rp-spinner" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Resetting Password...</span>
                </>
              ) : (
                <span>Reset Password</span>
              )}
            </button>
          </form>
        )}

        {success && (
          <Link to="/" className="rp-submit-btn rp-submit-btn--link">
            Continue to Login
          </Link>
        )}

      </div>
    </motion.div>
  );
}
