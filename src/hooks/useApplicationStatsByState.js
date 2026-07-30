import { useState, useEffect } from 'react';
import { applicationService } from '../services/applicationService';

/**
 * EGI-accepted application counts by state of origin, from
 * GET /api/admin/applications/stats/by-state: { total, items: [{ state, count }] }.
 * Used by the SuperadminDashboard state-of-origin chart.
 */
export function useApplicationStatsByState() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    applicationService.getStatsByState()
      .then((data) => { if (!cancelled) setStats(data); })
      .catch(() => {
        // Silent — chart is supplementary, dashboard stays usable without it.
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { stats, isLoading };
}
