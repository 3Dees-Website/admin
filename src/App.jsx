import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { PortalProvider } from './context/PortalContext';
import { ToastContainer } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './components/AdminLayout';
import { OTPVerification } from './pages/OTPVerification';
import { SuperadminAllVacancies } from './pages/SuperadminAllVacancies';
import './App.css';

// Public pages
import { AdminLogin } from './pages/AdminLogin';

// Admin panel pages
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminJobs } from './pages/AdminJobs';
import { AdminApplications } from './pages/AdminApplications';

// Superadmin panel pages
import { SuperadminDashboard } from './pages/SuperadminDashboard';
import { SuperadminManageAdmins } from './pages/SuperadminManageAdmins';
import { SuperadminViewAllApplications } from './pages/SuperadminViewAllApplications';
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
          {/* GENERAL GUEST DIRECTORIES CHANNELS */}

          <Route path="/" element={<AdminLogin />} />
          <Route path="/admin/verify" element={<OTPVerification />} />

          {/* ADMIN OPERATIONS AREA SECURED GATES */}
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
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="jobs" element={<AdminJobs />} />
            <Route path="applications" element={<AdminApplications />} />
          </Route>

          {/* SUPERADMIN OVERSIGHT AREA SECURED MASTER CLEARANCES */}
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
            <Route path="dashboard" element={<SuperadminDashboard />} />
            <Route path="admins" element={<SuperadminManageAdmins />} />
            <Route path="applications" element={<SuperadminViewAllApplications />} />
            <Route path="jobs" element={<SuperadminAllVacancies />} />
            <Route path="audit" element={<SuperadminAuditTrail />} />
          </Route>

          {/* CATCH ALL WILDCARDS */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter> 
    </PortalProvider>
  );
}