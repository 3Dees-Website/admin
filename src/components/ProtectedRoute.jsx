import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children, allowedRole = 'any' }) {
  const { currentUser, token } = useAuth();
  const location = useLocation();

  // If not logged in, redirect to login
  if (!token || !currentUser) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // If a specific role is demanded
  if (allowedRole !== 'any') {
    if (allowedRole === 'superadmin' && currentUser.role !== 'superadmin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (allowedRole === 'admin' && currentUser.role !== 'admin') {
      return <Navigate to="/superadmin/dashboard" replace />;
    }
  }

  return <>{children}</>;
}