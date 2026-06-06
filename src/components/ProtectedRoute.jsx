import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children, allowedRole = 'any' }) {
  const { currentUser, token } = useAuth();
  const location = useLocation();

  // React state may not be hydrated yet if we just wrote to localStorage
  // (e.g. immediately after OTP success). Fall back to localStorage directly
  // so the route never incorrectly bounces a freshly committed session.
  const resolvedToken =
    token || localStorage.getItem('3dees_token');

  const resolvedUser = (() => {
    if (currentUser) return currentUser;
    const raw = localStorage.getItem('3dees_current_user');
    return raw ? JSON.parse(raw) : null;
  })();

  if (!resolvedToken || !resolvedUser) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (allowedRole !== 'any') {
    if (allowedRole === 'superadmin' && resolvedUser.role !== 'superadmin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (allowedRole === 'admin' && resolvedUser.role !== 'admin') {
      return <Navigate to="/superadmin/dashboard" replace />;
    }
  }

  return <>{children}</>;
}