/**
 * Client-side mirror of the backend's edit-locking ladder
 * (backend/src/utils/applicationLock.js). This is for UI state (banner
 * copy, disabling controls) only — the server is the real enforcement, and
 * mapLockError() below translates its error codes if a race slips through.
 */
export function getLockInfo(app, currentUser) {
  const { status, egiDecision } = app;
  const isSuperadmin = currentUser?.role === 'superadmin';

  if (status === 'Pending' || status === 'Shortlisted') {
    return { locked: false };
  }

  if (status === 'Approved' && egiDecision === 'Pending') {
    return { locked: true, tone: 'info', banner: 'Locked — under EGI review' };
  }

  if (egiDecision === 'Declined') {
    if (isSuperadmin) {
      return {
        locked: false,
        tone: 'warning',
        canResend: true,
        banner: 'Declined by EGI — superadmin can edit and resend',
      };
    }
    return { locked: true, tone: 'warning', banner: 'Declined by EGI — only a superadmin may edit' };
  }

  if (status === 'Rejected') {
    if (isSuperadmin) {
      return { locked: false, tone: 'warning', banner: 'Rejected — superadmin override active' };
    }
    return { locked: true, tone: 'warning', banner: 'Rejected — only a superadmin may edit' };
  }

  if (egiDecision === 'Accepted') {
    return { locked: true, tone: 'success', banner: 'Locked — Accepted by EGI' };
  }

  return { locked: false };
}

const LOCK_ERROR_COPY = {
  LockedPendingEgi: 'This application is approved and awaiting an EGI decision — content is locked until a decision is recorded.',
  LockedAccepted: 'This application has been accepted by EGI and can no longer be edited.',
  EditForbidden: 'Only a superadmin may edit a declined or rejected application.',
};

export function mapLockError(err) {
  return LOCK_ERROR_COPY[err?.error] || err?.message || 'This action is not allowed right now.';
}
