import React, { useState } from 'react';
import { Link, useLocation} from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, Briefcase, FileUser, Users,
  History, LogOut, Bell, Menu, X, ShieldAlert
} from 'lucide-react';
import { LogoSVG } from './Navbar';
import './styles/AdminLayout.css';

export function AdminLayout({ children, role }) {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const adminMenu = [
    { name: 'Console Home', path: '/admin/dashboard', icon: <LayoutDashboard size={16} /> },
    { name: 'Manage Jobs', path: '/admin/jobs', icon: <Briefcase size={16} /> },
    { name: 'Applications', path: '/admin/applications', icon: <FileUser size={16} /> },
  ];

  const superAdminMenu = [
    { name: 'Super Console', path: '/superadmin/dashboard', icon: <LayoutDashboard size={16} /> },
    { name: 'Advisory Staff', path: '/superadmin/admins', icon: <Users size={16} /> },
    { name: 'All Vacancies', path: '/admin/jobs', icon: <Briefcase size={16} /> },
    { name: 'All Applications', path: '/superadmin/applications', icon: <FileUser size={16} /> },
    { name: 'Compliance Audits', path: '/superadmin/audit', icon: <History size={16} /> },
  ];

  const menu = role === 'superadmin' ? superAdminMenu : adminMenu;

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
            >
              <LogoSVG light={true} />
            </Link>
          ) : (
            <div className="sidebar-collapsed-logo">3D</div>
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
          <div className="sidebar-user-card">
            <span className="sidebar-user-session">Authorized Session</span>
            <span className="sidebar-user-name">{currentUser?.name}</span>
            <span className="sidebar-user-role">
              <ShieldAlert size={14} className="sidebar-shield-icon" />
              <span className="capitalize">{currentUser?.role} Clearance</span>
            </span>
          </div>
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
                id={`sidebar-link-${item.name.toLowerCase().replace(' ', '-')}`}
              >
                {item.icon}
                {!sidebarCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <button
            onClick={logout}
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
                : 'Operations Ledger'}
            </h2>
          </div>

          <div className="admin-header-right">
            {/* Notification Bell */}
            <div className="admin-notif-bell">
              <Bell size={16} />
              <span className="admin-notif-dot" />
            </div>

            <div className="admin-header-user">
              <span className="admin-header-username">{currentUser?.name}</span>
              <span className="admin-header-role">{currentUser?.role} clearance</span>
            </div>

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
          {children}
        </main>
      </div>

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      <nav className="mobile-tab-bar" id="mobile-bottom-tabs">
        {menu.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`mobile-tab-link${isActive ? ' mobile-tab-link--active' : ''}`}
            >
              {React.cloneElement(item.icon, { size: 18 })}
              <span className="mobile-tab-label">{item.name.split(' ').pop()}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}