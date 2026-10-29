import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TOKEN_STORAGE_KEYS, readStoredUser } from '../services/apiClient';
import { can } from '../utils/permissions';
import { routeBaseFor } from '../utils/routeBase';

/**
 * allowedRole: 'admin' | 'superadmin' | 'any' — the role-split route trees.
 * permission: a permission key, for a page inside a tree that is open to
 *   whoever holds it (a superadmin always does). Used inside an already
 *   protected tree, so a user without it goes to their own dashboard.
 */
export function ProtectedRoute({ children, allowedRole = 'any', permission = null }) {
  const { currentUser, token } = useAuth();
  const location = useLocation();

  // React state may not be hydrated yet if we just wrote to localStorage
  // (e.g. immediately after OTP success). Fall back to localStorage directly
  // so the route never incorrectly bounces a freshly committed session.
  const resolvedToken =
    token || localStorage.getItem(TOKEN_STORAGE_KEYS.access);

  // A corrupted stored user reads as null → redirect, same as no session.
  const resolvedUser = currentUser || readStoredUser();

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

  if (permission && !can(resolvedUser, permission)) {
    return <Navigate to={`${routeBaseFor(resolvedUser)}/dashboard`} replace />;
  }

  return <>{children}</>;
}