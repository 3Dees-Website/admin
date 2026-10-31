import { useEffect, useState } from 'react';
import { applicationService } from '../services/applicationService';

export const PRESENCE_HEARTBEAT_MS = 25000;

/**
 * Who else is viewing this application. Beats every 25s while the tab is
 * visible (and at once when it becomes visible again), and clears our presence
 * when the application changes or the detail unmounts. A failed beat keeps the
 * last list; the server drops us after 75s without one.
 */
export function usePresence(appId) {
  const [state, setState] = useState({ appId: null, viewers: [] });

  useEffect(() => {
    if (appId == null) return undefined;
    let cancelled = false;
    let inFlight = Promise.resolve();

    const beat = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      inFlight = applicationService.heartbeatPresence(appId).then(
        (viewers) => { if (!cancelled) setState({ appId, viewers }); },
        () => {},
      );
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat();
    };

    beat();
    const intervalId = setInterval(beat, PRESENCE_HEARTBEAT_MS);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      // Wait for a beat still on the wire, so a late POST can't land after the
      // DELETE and leave us listed for 75s.
      inFlight.then(() => applicationService.clearPresence(appId)).catch(() => {});
    };
  }, [appId]);

  return state.appId === appId ? state.viewers : [];
}
