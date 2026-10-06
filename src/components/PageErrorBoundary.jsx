import { Component } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import './styles/PageErrorBoundary.css';

/**
 * Catches a page that throws while rendering, so the sidebar, header and
 * sign-out stay usable instead of the whole portal going blank.
 *
 * AdminLayout keys this on the path, so navigating to another page clears the
 * error. Only render errors are caught — async and event-handler errors
 * already surface as toasts.
 *
 * The error is always logged to the console: without that, a boundary turns a
 * loud crash into a quiet one and real bugs go unnoticed.
 */
export class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[PageErrorBoundary] Page crashed while rendering:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const { dashboardPath, currentPath } = this.props;
    return (
      <div className="peb-wrapper" role="alert">
        <AlertTriangle className="peb-icon" />
        <h2 className="peb-title">This page hit an error</h2>
        <p className="peb-text">
          Something on this page failed to display. The rest of the portal still works —
          reload to try again, or go to another page.
        </p>
        <div className="peb-actions">
          <button type="button" className="peb-btn peb-btn--primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
          {dashboardPath && dashboardPath !== currentPath && (
            <Link to={dashboardPath} className="peb-btn">Go to dashboard</Link>
          )}
        </div>
      </div>
    );
  }
}
