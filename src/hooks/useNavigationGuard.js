import { useEffect } from 'react';

// The app uses BrowserRouter, which has no way to block a navigation, so the
// layout's links ask this instead. One page at a time can hold a guard.
let activeGuard = null;

/**
 * While `when` is true, leaving the page through the sidebar, tab bar or
 * header links asks first (AdminLayout shows the dialog). Reloading or closing
 * the tab needs its own `beforeunload` handler, and the browser's back button
 * is not covered.
 */
export function useNavigationGuard(when, message) {
  useEffect(() => {
    if (!when) return undefined;
    const guard = { message };
    activeGuard = guard;
    return () => {
      if (activeGuard === guard) activeGuard = null;
    };
  }, [when, message]);
}

export const getNavigationGuard = () => activeGuard;
