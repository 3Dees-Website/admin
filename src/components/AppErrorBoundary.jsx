import { Component } from 'react';
import { TOKEN_STORAGE_KEYS } from '../services/apiClient';
import { authService } from '../services/authService';
import './styles/AppErrorBoundary.css';

// How long sign-out waits for the server-side revoke before leaving the page.
// Navigating away immediately could cancel the request in flight.
const REVOKE_WAIT_MS = 3000;

/**
 * Last-resort boundary around the whole app (see main.jsx). It sits above
 * PortalProvider and BrowserRouter, so it must not use the router, context,
 * toasts or icon components — any of those may be what crashed.
 *
 * Page crashes are caught first by PageErrorBoundary inside AdminLayout; this
 * one only sees crashes in the layout, the provider, the router, the public
 * pages, or PageErrorBoundary itself.
 *
 * There is no in-place reset: both actions do a full page load, which
 * remounts everything including this boundary.
 *
 * The error is always logged to the console, as the inner boundary does.
 */
export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, signingOut: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary] App crashed while rendering:', error, info?.componentStack);
  }

  // The only way out when the saved session itself is what breaks rendering
  // (e.g. an unparseable stored user) — a reload would just crash again.
  handleSignOut = async () => {
    this.setState({ signingOut: true });

    let revoke = Promise.resolve();
    try {
      const refreshToken = localStorage.getItem(TOKEN_STORAGE_KEYS.refresh);
      revoke = authService.logout(refreshToken);
    } catch {
      // Best-effort only — the local keys are cleared regardless.
    }

    try {
      localStorage.removeItem(TOKEN_STORAGE_KEYS.access);
      localStorage.removeItem(TOKEN_STORAGE_KEYS.refresh);
      localStorage.removeItem(TOKEN_STORAGE_KEYS.user);
    } catch {
      // Storage unavailable — nothing more can be done here.
    }

    try {
      await Promise.race([revoke, new Promise((resolve) => setTimeout(resolve, REVOKE_WAIT_MS))]);
    } catch {
      // Ignore — navigate regardless.
    }

    window.location.assign('/');
  };

  render() {
    const { error, signingOut } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="aeb-screen">
        <div className="aeb-card" role="alert">
          <h1 className="aeb-title">Something went wrong</h1>
          <p className="aeb-text">
            The portal ran into a problem and couldn't continue. Anything you already saved is
            safe, but changes you hadn't saved may need to be entered again.
          </p>
          <p className="aeb-text">
            Try reloading the page first. If this message comes back, sign out and sign in again.
          </p>

          <div className="aeb-actions">
            <button
              type="button"
              className="aeb-btn aeb-btn--primary"
              onClick={() => window.location.reload()}
              disabled={signingOut}
            >
              Reload the page
            </button>
            <button
              type="button"
              className="aeb-btn"
              onClick={this.handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? 'Signing out…' : 'Sign out and sign in again'}
            </button>
          </div>

          <p className="aeb-help">
            If this keeps happening, tell your system administrator what you were doing when it
            appeared.
          </p>

          <details className="aeb-details">
            <summary>Technical details</summary>
            <code>{String(error?.message || error)}</code>
          </details>
        </div>
      </div>
    );
  }
}
