import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Eye, EyeOff, Lock, Mail} from 'lucide-react';
import { LogoSVG } from '../components/Navbar';
import './styles/AdminLogin.css';

export function AdminLogin() {
  const { login, currentUser, token } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (token && currentUser) {
      const redirectPath = currentUser.role === 'superadmin' ? '/superadmin/dashboard' : '/admin/dashboard';
      navigate(redirectPath, { replace: true });
    }
  }, [token, currentUser, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      addToast('error', 'Incomplete Credentials', 'Please write both your email address and security passcode.');
      return;
    }

    setIsAuthenticating(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const success = await login(email, password);
    setIsAuthenticating(false);

    if (success) {
      setTimeout(() => {
        const persisted = localStorage.getItem('3dees_current_user');
        if (persisted) {
          const u = JSON.parse(persisted);
          const destination = u.role === 'superadmin' ? '/superadmin/dashboard' : '/admin/dashboard';
          navigate(destination, { replace: true });
        }
      }, 100);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="al-wrapper"
      id="portal-login-workspace"
    >
      <div className="al-card">

        {/* Header */}
        <div className="al-header">
          <LogoSVG light={false} />
          <h2 className="al-title">Administrative Staff Portal</h2>
          <p className="al-subtitle">
            Specify verified corporate representative credentials to gain access to processing controls and sync logs.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLoginSubmit} className="al-form">

          {/* Email */}
          <div className="al-field">
            <label className="al-label">Representative Email</label>
            <div className="al-input-wrap">
              <Mail className="al-input-icon" />
              <input
                type="email"
                required
                placeholder="representative@3dees.net"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="al-input"
                id="login-email-field"
              />
            </div>
          </div>

          {/* Password */}
          <div className="al-field">
            <label className="al-label">Security Passcode</label>
            <div className="al-input-wrap">
              <Lock className="al-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="al-input al-input-password"
                id="login-password-field"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="al-toggle-pass"
                aria-label="Toggle password view"
              >
                {showPassword ? <EyeOff className="al-eye-icon" /> : <Eye className="al-eye-icon" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isAuthenticating}
            className="al-submit-btn"
            id="login-submit-btn"
          >
            {isAuthenticating ? (
              <>
                <svg className="al-spinner" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Decrypting Lock...</span>
              </>
            ) : (
              <span>Decrypt & Open Session</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="al-footer">
          <span>Security audits and session keys refresh automatically.</span>
          <span>Security Clearance Level 1-B Required</span>
        </div>

      </div>
    </motion.div>
  );
}