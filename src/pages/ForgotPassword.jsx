import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, ArrowLeft, MailCheck, AlertCircle } from 'lucide-react';
import { LogoSVG } from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import './styles/ForgotPassword.css';

export function ForgotPassword() {
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setError('');

    const result = await forgotPassword(email);

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setSubmitted(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fp-wrapper"
    >
      <div className="fp-card">

        {/* Back link */}
        <motion.div whileHover={{ x: -2 }} className="fp-back-wrap">
          <Link to="/" className="fp-back-btn">
            <ArrowLeft size={14} />
            <span>Back to Login</span>
          </Link>
        </motion.div>

        {/* Header */}
        <div className="fp-header">
          <LogoSVG light={false} />
          <h2 className="fp-title">Reset Your Password</h2>
          <p className="fp-subtitle">
            {submitted
              ? 'Check your inbox for further instructions.'
              : 'Enter the email associated with your account and we’ll send you a link to reset your password.'}
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="fp-form">
            <div className="fp-field">
              <label className="fp-label">Representative Email</label>
              <div className="fp-input-wrap">
                <Mail className="fp-input-icon" />
                <input
                  type="email"
                  required
                  placeholder="representative@3dees.net"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="fp-input"
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="fp-error"
                >
                  <AlertCircle size={13} />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isSubmitting || !email.trim()}
              className="fp-submit-btn"
            >
              {isSubmitting ? (
                <>
                  <svg className="fp-spinner" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Sending Link...</span>
                </>
              ) : (
                <span>Send Reset Link</span>
              )}
            </button>
          </form>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="fp-confirm-state"
          >
            <MailCheck className="fp-confirm-icon" />
            <p className="fp-confirm-text">
              If that email is registered, a reset link has been sent. Check your inbox.
            </p>
          </motion.div>
        )}

        {/* Footer */}
        <div className="fp-footer">
          <span>Reset links expire after a short window for your security.</span>
        </div>

      </div>
    </motion.div>
  );
}
