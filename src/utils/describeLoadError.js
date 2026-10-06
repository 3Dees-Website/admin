/**
 * Turns a failed list load into words a person can act on, so a page never
 * shows its empty state ("nothing here") when it simply couldn't look.
 * `what` names the thing that failed, e.g. "the audit trail".
 *
 * Returns { message, canRetry }. A 403 is not retryable: the same request
 * will be refused again until the person's access changes.
 */
export function describeLoadError(err, what) {
  if (err?.error === 'Forbidden') {
    return {
      message: `You don't have permission to view ${what}. If your access changed recently, sign out and sign in again.`,
      canRetry: false,
    };
  }
  if (err?.error === 'PersistentAuthFailure') {
    return { message: err.message, canRetry: false };
  }
  // Our own request timeout is the only thing that aborts a fetch.
  if (err?.name === 'AbortError') {
    return {
      message: `The server took too long to respond, so ${what} couldn't be loaded.`,
      canRetry: true,
    };
  }
  // A dropped or refused connection surfaces as a native TypeError whose
  // text varies by browser; SessionRefreshUnavailable is apiClient's own
  // "couldn't reach the server to renew the session".
  if (err instanceof TypeError || err?.error === 'SessionRefreshUnavailable') {
    return {
      message: `Couldn't reach the server, so ${what} couldn't be loaded. Check your connection.`,
      canRetry: true,
    };
  }
  return {
    message: `The server had a problem loading ${what}.`,
    canRetry: true,
  };
}
