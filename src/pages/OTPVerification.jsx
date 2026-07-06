import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, ArrowLeft, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { LogoSVG } from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';
import './styles/OTPVerification.css';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export function OTPVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { commitSession, currentUser, token } = useAuth();

  // Route state populated by AdminLogin after a successful step-1 login call
  const { pendingToken, maskedEmail } = location.state || {};

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [error, setError] = useState('');
  const canResend = countdown <= 0;
  const [success, setSuccess] = useState(false);
  const [pendingDestination, setPendingDestination] = useState(null);

  const inputRefs = useRef([]);

  // Guard: no pending token means someone landed here directly — send to login
  useEffect(() => {
    if (!pendingToken) {
      navigate('/', { replace: true });
    }
  }, [pendingToken, navigate]);

  // Countdown timer for the resend notice
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Navigate only after React state confirms the committed session is live
  useEffect(() => {
    if (pendingDestination && token && currentUser) {
      navigate(pendingDestination, { replace: true });
    }
  }, [token, currentUser, pendingDestination, navigate]);

  const formatCountdown = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleDigitChange = (index, value) => {
    setError('');
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    const filled = next.join('');
    if (filled.length === OTP_LENGTH) verifyOtp(filled);
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      setError('');
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
      } else {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      const code = digits.join('');
      if (code.length === OTP_LENGTH) verifyOtp(code);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    if (pasted.length === OTP_LENGTH) verifyOtp(pasted);
  };

  const verifyOtp = useCallback(async (code) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setError('');

    try {
      const { accessToken, refreshToken, user } = await authService.verifyOtp(pendingToken, code);

      // Persist tokens and user, then load portal data
      await commitSession(user, accessToken, refreshToken);

      setSuccess(true);
      const dest = user.role === 'superadmin' ? '/superadmin/dashboard' : '/admin/dashboard';
      setPendingDestination(dest);
    } catch (err) {
      setIsVerifying(false);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();

      const terminalErrors = ['TooManyAttempts', 'OTPExpired', 'InvalidToken'];
      if (terminalErrors.includes(err?.error)) {
        setError(err.message || 'Session expired. Please log in again.');
        setTimeout(() => navigate('/', { replace: true }), 2000);
        return;
      }

      // InvalidOTP — remaining attempts are included in the message from the server
      setError(err?.message || 'Invalid verification code. Please try again.');
    }
  }, [isVerifying, pendingToken, commitSession, navigate]);

  const handleResend = () => {
    // The API has no dedicated resend endpoint — the user must re-authenticate
    // to get a fresh OTP. Navigate back to login with an informational message.
    navigate('/', {
      replace: true,
      state: { info: 'Please sign in again to receive a new verification code.' },
    });
  };

  const filledCount = digits.filter(Boolean).length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="otp-wrapper"
    >
      <div className="otp-card">

        {/* Back link */}
        <motion.button
          className="otp-back-btn"
          onClick={() => navigate('/')}
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.96 }}
          type="button"
        >
          <ArrowLeft size={14} />
          <span>Back to Login</span>
        </motion.button>

        {/* Header */}
        <div className="otp-header">
          <LogoSVG light={false} />

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success-icon"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="otp-shield-wrap otp-shield-wrap--success"
              >
                <CheckCircle2 className="otp-shield-icon otp-shield-icon--success" />
              </motion.div>
            ) : (
              <motion.div
                key="shield-icon"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="otp-shield-wrap"
              >
                <ShieldCheck className="otp-shield-icon" />
                <span className="otp-shield-ring" />
              </motion.div>
            )}
          </AnimatePresence>

          <h2 className="otp-title">
            {success ? 'Identity Confirmed' : 'Two-Factor Verification'}
          </h2>
          <p className="otp-subtitle">
            {success
              ? 'Authentication successful. Redirecting to your dashboard...'
              : (
                <>
                  A 6-digit verification code has been dispatched to{' '}
                  <strong>{maskedEmail || 'your registered email'}</strong>.{' '}
                  Enter it below to complete authentication.
                </>
              )
            }
          </p>
        </div>

        {/* OTP Input Grid */}
        {!success && (
          <div className="otp-input-section">
            <div
              className={`otp-input-grid${isVerifying ? ' otp-input-grid--verifying' : ''}${error ? ' otp-input-grid--error' : ''}`}
              onPaste={handlePaste}
            >
              {digits.map((d, i) => (
                <motion.input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  disabled={isVerifying}
                  className={`otp-digit${d ? ' otp-digit--filled' : ''}`}
                  aria-label={`Digit ${i + 1}`}
                  autoFocus={i === 0}
                  whileFocus={{ scale: 1.06 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                />
              ))}
            </div>

            {/* Progress bar */}
            <div className="otp-progress-bar">
              <motion.div
                className="otp-progress-fill"
                animate={{ width: `${(filledCount / OTP_LENGTH) * 100}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="otp-error"
                >
                  <AlertCircle size={13} />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Verify button */}
            <motion.button
              type="button"
              onClick={() => {
                const code = digits.join('');
                if (code.length === OTP_LENGTH) verifyOtp(code);
              }}
              disabled={filledCount < OTP_LENGTH || isVerifying}
              className="otp-submit-btn"
              whileHover={filledCount === OTP_LENGTH && !isVerifying ? { y: -1 } : {}}
              whileTap={filledCount === OTP_LENGTH && !isVerifying ? { scale: 0.98 } : {}}
            >
              {isVerifying ? (
                <>
                  <svg className="otp-spinner" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Verifying Identity...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={15} />
                  <span>Verify &amp; Authenticate</span>
                </>
              )}
            </motion.button>
          </div>
        )}

        {/* Success state */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="otp-success-state"
          >
            <div className="otp-success-bar">
              <motion.div
                className="otp-success-fill"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
              />
            </div>
            <p className="otp-success-label">Establishing secure session...</p>
          </motion.div>
        )}

        {/* Resend section */}
        {!success && (
          <div className="otp-resend-section">
            {canResend ? (
              <button
                type="button"
                onClick={handleResend}
                className="otp-resend-btn"
              >
                <ArrowLeft size={13} />
                <span>Return to Login for a new code</span>
              </button>
            ) : (
              <span className="otp-countdown">
                <Clock size={13} className="otp-countdown-icon" />
                Resend available in <strong>{formatCountdown(countdown)}</strong>
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="otp-footer">
          <span>All verification codes expire after 10 minutes.</span>
        </div>

      </div>
    </motion.div>
  );
}
