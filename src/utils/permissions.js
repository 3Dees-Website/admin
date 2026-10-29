/**
 * The permission keys the dashboard gates on. The backend's registry
 * (GET /api/admin/users/permissions/registry) is the source of the key list
 * for the grant UI; these names are for the places that check one.
 */
export const PERM = Object.freeze({
  APPROVE_CANDIDATES: 'approve_candidates',
  RESEND_EGI: 'resend_egi',
  HARD_DELETE_APPLICATION: 'hard_delete_application',
  DELETE_CATEGORY: 'delete_category',
  MANAGE_SCREENING_CONFIG: 'manage_screening_config',
  EDIT_DECLINED_APPLICATIONS: 'edit_declined_applications',
  REVERSE_REJECTION: 'reverse_rejection',
  SAVE_DECLINED_APPLICATION: 'save_declined_application',
  EGI_SYNC_ACCESS: 'egi_sync_access',
  VIEW_APPROVED_CANDIDATES: 'view_approved_candidates',
});

/**
 * Whether `user` holds `key`. A superadmin holds every key whatever the list
 * says, which also keeps a session stored before permissions existed working.
 * This is a UI hint: the server enforces the real thing.
 */
export function can(user, key) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  return Array.isArray(user.permissions) && user.permissions.includes(key);
}

/** `{ grant, revoke }` that turns the `current` key set into `next`. */
export function diffPermissions(current, next) {
  const have = new Set(current);
  const want = new Set(next);
  return {
    grant: [...want].filter((k) => !have.has(k)),
    revoke: [...have].filter((k) => !want.has(k)),
  };
}

/** Order-insensitive equality of two key lists. */
export function samePermissions(a, b) {
  const x = new Set(a || []);
  const y = new Set(b || []);
  return x.size === y.size && [...x].every((k) => y.has(k));
}
