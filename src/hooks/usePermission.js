import { useAuth } from './useAuth';
import { can } from '../utils/permissions';

/** Whether the signed-in user holds `key`. */
export function usePermission(key) {
  const { currentUser } = useAuth();
  return can(currentUser, key);
}

/** `(key) => boolean` for the signed-in user, for checking several keys. */
export function useCan() {
  const { currentUser } = useAuth();
  return (key) => can(currentUser, key);
}
