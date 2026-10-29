/**
 * The permission-related slice of a user as the server sends it: the one place
 * `permissions` and the legacy `can_approve` are read. `canApprove` is kept for
 * one release while the backend still sends it; nothing in the dashboard reads
 * it any more (use can(user, PERM.APPROVE_CANDIDATES)).
 */
export function normalizePermissions(raw) {
  return {
    permissions: Array.isArray(raw?.permissions)
      ? raw.permissions.filter((k) => typeof k === 'string')
      : [],
    canApprove: raw?.can_approve === true,
  };
}
