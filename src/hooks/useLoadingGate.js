import { useEffect, useRef, useState } from 'react';

/**
 * Smooths a loading flag so a fast load never flashes an indicator.
 *
 * `visible` turns on only after `delay` ms of continuous loading, then stays on
 * for at least `minDuration` ms even if loading ends sooner. `minDuration: 0`
 * drops it the moment loading ends. `busy` is the raw flag OR'd with `visible`,
 * i.e. "loading, or still being held on screen".
 *
 * Gate the indicator only. A button's label and disabled state belong to the
 * real flag, never to `visible`/`busy`.
 */
export function useLoadingGate(isLoading, { delay = 150, minDuration = 350 } = {}) {
  const [shown, setShown] = useState(false);
  const [prevLoading, setPrevLoading] = useState(isLoading);
  const shownAtRef = useRef(0);

  // Nothing to hold when there is no minimum, so drop in the same render.
  if (prevLoading !== isLoading) {
    setPrevLoading(isLoading);
    if (!isLoading && minDuration <= 0) setShown(false);
  }

  useEffect(() => {
    if (isLoading) {
      if (shown) return undefined;
      const timer = setTimeout(() => {
        shownAtRef.current = Date.now();
        setShown(true);
      }, delay);
      return () => clearTimeout(timer);
    }
    if (!shown) return undefined;
    const remaining = Math.max(0, minDuration - (Date.now() - shownAtRef.current));
    const timer = setTimeout(() => setShown(false), remaining);
    return () => clearTimeout(timer);
  }, [isLoading, shown, delay, minDuration]);

  const visible = shown && (isLoading || minDuration > 0);
  return { visible, busy: isLoading || visible };
}
