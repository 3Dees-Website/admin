import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { PortalProvider } from './context/PortalContext';
import { ToastContainer } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './components/AdminLayout';
import { OTPVerification } from './pages/OTPVerification';
import './App.css';

// Public pages
import { AdminLogin } from './pages/AdminLogin';

// Admin panel pages
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminJobs } from './pages/AdminJobs';
import { AdminApplications } from './pages/AdminApplications';
import { AdminPendingApplications } from './pages/AdminPendingApplications';

// Superadmin panel pages
import { SuperadminDashboard } from './pages/SuperadminDashboard';
import { SuperadminManageAdmins } from './pages/SuperadminManageAdmins';
import { SuperadminAllVacancies } from './pages/SuperadminAllVacancies';
import { SuperadminViewAllApplications } from './pages/SuperadminViewAllApplications';
import { SuperadminPendingApplications } from './pages/SuperadminPendingApplications';
import { SuperadminAuditTrail } from './pages/SuperadminAuditTrail';

function PanelLoaderPlaceholder() {
  return (
    <div className="panel-loader-placeholder">
      <svg className="panel-loader-spinner" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span>Authorizing Workspace Panels...</span>
    </div>
  );
}

export default function App() {
  return (
    <PortalProvider>
      <BrowserRouter>
        <ToastContainer />

        <Routes>
          {/* ── PUBLIC ── */}
          <Route path="/" element={<AdminLogin />} />
          <Route path="/admin/verify" element={<OTPVerification />} />

          {/* ── ADMIN ── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminLayout role="admin">
                  <Suspense fallback={<PanelLoaderPlaceholder />}>
                    <Outlet />
                  </Suspense>
                </AdminLayout>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard"    element={<AdminDashboard />} />
            <Route path="jobs"         element={<AdminJobs />} />
            <Route path="pending"      element={<AdminPendingApplications />} />
            <Route path="applications" element={<AdminApplications />} />
          </Route>

          {/* ── SUPERADMIN ── */}
          <Route
            path="/superadmin"
            element={
              <ProtectedRoute allowedRole="superadmin">
                <AdminLayout role="superadmin">
                  <Suspense fallback={<PanelLoaderPlaceholder />}>
                    <Outlet />
                  </Suspense>
                </AdminLayout>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="dashboard"    element={<SuperadminDashboard />} />
            <Route path="pending"      element={<SuperadminPendingApplications />} />
            <Route path="applications" element={<SuperadminViewAllApplications />} />
            <Route path="jobs"         element={<SuperadminAllVacancies />} />
            <Route path="admins"       element={<SuperadminManageAdmins />} />
            <Route path="audit"        element={<SuperadminAuditTrail />} />
          </Route>

          {/* ── CATCH ALL ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </PortalProvider>
  );
}