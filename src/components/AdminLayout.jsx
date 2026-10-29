import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogOut, Menu, X, ShieldAlert, RefreshCw } from 'lucide-react';
import { buildMenu } from '../config/navigation';
import { LogoSVG } from './Navbar';
import { NotificationBell } from './NotificationBell';
import { PageErrorBoundary } from './PageErrorBoundary';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { getNavigationGuard } from '../hooks/useNavigationGuard';
import './styles/AdminLayout.css';

const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
const IDLE_CHECK_INTERVAL_MS = 30 * 1000;   // poll every 30s
const ACTIVITY_THROTTLE_MS = 5000;          // coalesce bursty events
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll'];

export function AdminLayout({ children, role }) {
  const { currentUser, logout, logoutIdle } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // A page with unsaved work registers a guard (useNavigationGuard); leaving it
  // through any link or End Session here then asks first.
  const [pendingLeave, setPendingLeave] = useState(null); // { message, run }

  const guarded = (run, to) => (e) => {
    const guard = getNavigationGuard();
    if (!guard || (to && to === location.pathname)) return;
    // Let "open in a new tab" style clicks through; they don't leave this page.
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return;
    e?.preventDefault();
    setPendingLeave({ message: guard.message, run });
  };
  const guardedLink = (to) => guarded(() => navigate(to), to);
  // For a button (End Session): do the action straight away unless a guard asks.
  const guardedAction = (run) => (e) => {
    const guard = getNavigationGuard();
    if (!guard) {
      run();
      return;
    }
    e?.preventDefault();
    setPendingLeave({ message: guard.message, run });
  };

  const lastActivityRef = useRef(Date.now());
  const logoutIdleRef = useRef(logoutIdle);
  logoutIdleRef.current = logoutIdle;

  useEffect(() => {
    let lastMarked = 0;
    const markActivity = () => {
      const now = Date.now();
      if (now - lastMarked > ACTIVITY_THROTTLE_MS) {
        lastMarked = now;
        lastActivityRef.current = now;
      }
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));

    const intervalId = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        logoutIdleRef.current();
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActivity));
      clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const menu = buildMenu(role, currentUser);

  return (
    <div className="admin-layout" id="admin-workspace-layout">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside
        className={`admin-sidebar${sidebarCollapsed ? ' admin-sidebar--collapsed' : ''}`}
        id="desktop-sidebar"
      >
        {/* Sidebar Header */}
        <div className="sidebar-header">
          {!sidebarCollapsed ? (
            <Link
              to={
                role === 'superadmin' 
                  ? '/superadmin/dashboard' 
                  : '/admin/dashboard'
              }
              onClick={guardedLink(role === 'superadmin' ? '/superadmin/dashboard' : '/admin/dashboard')}
            >
              <LogoSVG light={true} />
            </Link>
          ) : (
            <div className="sidebar-collapsed-logo">
              <img src="/3dees_Logo.png" alt="3dees" width={28} />
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="sidebar-collapse-btn"
            aria-label="Collapse sidebar"
          >
            {sidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>

        {/* Admin Designation Card */}
        {!sidebarCollapsed && (
          <Link
            to={role === 'superadmin' ? '/superadmin/profile' : '/admin/profile'}
            className="sidebar-user-card"
            onClick={guardedLink(role === 'superadmin' ? '/superadmin/profile' : '/admin/profile')}
          >
            <span className="sidebar-user-session">Authorized Session</span>
            <span className="sidebar-user-name">{currentUser?.name}</span>
            <span className="sidebar-user-role">
              <ShieldAlert size={14} className="sidebar-shield-icon" />
              <span className="capitalize">{currentUser?.role} Clearance</span>
            </span>
          </Link>
        )}

        {/* Sidebar Navigation */}
        <nav className="sidebar-nav">
          {menu.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`sidebar-nav-link${isActive ? ' sidebar-nav-link--active' : ''}${sidebarCollapsed ? ' sidebar-nav-link--icon-only' : ''}`}
                id={`sidebar-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={guardedLink(item.path)}
              >
                <item.Icon size={16} />
                {!sidebarCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <button
            onClick={guardedAction(logout)}
            className={`sidebar-signoff${sidebarCollapsed ? ' sidebar-signoff--icon-only' : ''}`}
            id="sidebar-sign-off"
          >
            <LogOut size={16} />
            {!sidebarCollapsed && <span>End Session</span>}
          </button>
        </div>
      </aside>

      {/* ── WORKSPACE AREA ── */}
      <div className="admin-workspace">

        {/* Top Header */}
        <header className="admin-header" id="admin-header-controls">
          <div>
            <h2 className="admin-header-title">
              {location.pathname.includes('dashboard')
                ? 'System Dashboards Control'
                : location.pathname.includes('pending')
                ? 'Pending Applications Queue'
                : location.pathname.includes('egi-sync')
                ? 'EGI Sync Queue'
                : location.pathname.includes('scoring')
                ? 'Candidate Scoring'
                : location.pathname.includes('screened')
                ? 'Screened Candidates'
                : 'Operations Ledger'}
            </h2>
          </div>

          <div className="admin-header-right">
            {/* Reload page */}
            <button
              type="button"
              className="admin-reload-btn"
              onClick={() => window.location.reload()}
              aria-label="Reload page"
              title="Reload"
            >
              <RefreshCw size={16} />
            </button>

            {/* Notification Bell */}
            <NotificationBell role={role} />

            <Link
              to={role === 'superadmin' ? '/superadmin/profile' : '/admin/profile'}
              className="admin-header-user"
              onClick={guardedLink(role === 'superadmin' ? '/superadmin/profile' : '/admin/profile')}
            >
              <span className="admin-header-username">{currentUser?.name}</span>
              <span className="admin-header-role">{currentUser?.role} clearance</span>
            </Link>

            {/* Mobile logout */}
            <button
              onClick={logout}
              className="admin-mobile-logout"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="admin-main">
          <PageErrorBoundary
            key={location.pathname}
            currentPath={location.pathname}
            dashboardPath={`/${role}/dashboard`}
          >
            {children}
          </PageErrorBoundary>
        </main>
      </div>

      {pendingLeave && (
        <UnsavedChangesDialog
          message={pendingLeave.message}
          onStay={() => setPendingLeave(null)}
          onLeave={() => {
            const { run } = pendingLeave;
            setPendingLeave(null);
            run();
          }}
        />
      )}

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      <nav className="mobile-tab-bar" id="mobile-bottom-tabs">
        {menu.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`mobile-tab-link${isActive ? ' mobile-tab-link--active' : ''}`}
              onClick={guardedLink(item.path)}
            >
              <item.Icon size={18} />
              <span className="mobile-tab-label">{item.name.split(' ').pop()}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}