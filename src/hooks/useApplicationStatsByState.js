import { useState, useEffect, useCallback } from 'react';
import { applicationService } from '../services/applicationService';

/**
 * EGI-accepted application counts by state of origin, from
 * GET /api/admin/applications/stats/by-state: { total, items: [{ state, count }] }.
 * Used by the SuperadminDashboard state-of-origin chart.
 */
export function useApplicationStatsByState() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // Set when the load failed, so the chart says so instead of "no data yet".
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStats(await applicationService.getStatsByState());
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    applicationService.getStatsByState()
      .then((data) => { if (!cancelled) setStats(data); })
      .catch((err) => {
        // No toast — chart is supplementary, dashboard stays usable without it.
        if (!cancelled) setError(err);
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { stats, isLoading, error, refetch };
}
