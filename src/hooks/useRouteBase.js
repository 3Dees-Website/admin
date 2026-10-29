import { useAuth } from './useAuth';
import { routeBaseFor } from '../utils/routeBase';

/** '/admin' or '/superadmin' for the signed-in user. */
export function useRouteBase() {
  const { currentUser } = useAuth();
  return routeBaseFor(currentUser);
}
