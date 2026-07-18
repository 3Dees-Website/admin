import { useState, useEffect, useCallback } from 'react';
import { applicationService } from '../services/applicationService';

/**
 * Global application counts from GET /api/admin/applications/stats:
 * { total, byStatus, submittedToday, byEgiDecision, byEgiSyncStatus }.
 * Used by dashboard tiles and the pending-queue pages instead of computing
 * counts from a full client-side applications array.
 */
export function useApplicationStats() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await applicationService.getStats();
      setStats(data);
    } catch {
      // Silent — stats tiles are supplementary, pages stay usable without them.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    applicationService.getStats()
      .then((data) => { if (!cancelled) setStats(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
     
  }, []);

  return { stats, isLoading, refetch };
}
