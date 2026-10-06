/**
 * Client-side mirror of the backend's edit-locking ladder
 * (backend/src/utils/applicationLock.js). This is for UI state (banner
 * copy, disabling controls) only — the server is the real enforcement, and
 * mapLockError() below translates its error codes if a race slips through.
 */
export function getLockInfo(app, currentUser, delivery) {
  const { status, egiDecision } = app;
  const isSuperadmin = currentUser?.role === 'superadmin';

  if (status === 'Pending' || status === 'Shortlisted') {
    return { locked: false };
  }

  if (status === 'Approved' && egiDecision === 'Pending') {
    return { locked: true, ...pendingEgiBanner(app.egiSyncStatus, delivery, isSuperadmin) };
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

/**
 * "Under EGI review" is only true once EGI has confirmed the application. The
 * sync status (always present) says whether it has; the delivery state from
 * egi_delivery (only once loaded) tells retrying apart from given up.
 */
function pendingEgiBanner(egiSyncStatus, delivery, isSuperadmin) {
  if (egiSyncStatus === 'Synced') {
    return { tone: 'info', banner: 'Locked — under EGI review' };
  }
  if (egiSyncStatus === 'Queued') {
    return { tone: 'info', banner: 'Locked — being delivered to EGI (not yet confirmed)' };
  }
  if (egiSyncStatus === 'Failed') {
    if (delivery?.deliveryState === 'exhausted') {
      return {
        tone: 'danger',
        banner: `Locked — delivery to EGI failed; 3DEES has not had a confirmation from EGI${isSuperadmin ? ' · you can redeliver it below' : ''}`,
      };
    }
    return { tone: 'warning', banner: 'Locked — delivery to EGI is failing and being retried; no confirmation from EGI yet' };
  }
  return { tone: 'info', banner: 'Locked — approved, not yet sent to EGI' };
}

// Fallback copy only: the server's own message wins, because it can say more
// (e.g. LockedPendingEgi now says whether EGI actually has the application).
const LOCK_ERROR_COPY = {
  LockedPendingEgi: 'This application is approved and awaiting an EGI decision — content is locked until a decision is recorded.',
  LockedAccepted: 'This application has been accepted by EGI and can no longer be edited.',
  EditForbidden: 'Only a superadmin may edit a declined or rejected application.',
};

export function mapLockError(err) {
  return err?.message || LOCK_ERROR_COPY[err?.error] || 'This action is not allowed right now.';
}
