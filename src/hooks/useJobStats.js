import { useState, useEffect, useCallback } from 'react';
import { applicationService } from '../services/applicationService';

/**
 * Per-job application counts for the jobs list pages. Fetched as one small
 * aggregate call (GET /api/admin/applications/stats/by-job) instead of the
 * jobs pages pulling the full applications array, which doesn't scale.
 */
export function useJobStats() {
  const [statsByJob, setStatsByJob] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await applicationService.getStatsByJob();
      const map = {};
      items.forEach((stat) => { map[stat.jobId] = stat; });
      setStatsByJob(map);
    } catch {
      // Silent — counts are supplementary, the jobs pages stay usable without them.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    applicationService.getStatsByJob()
      .then((items) => {
        if (cancelled) return;
        const map = {};
        items.forEach((stat) => { map[stat.jobId] = stat; });
        setStatsByJob(map);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
     
  }, []);

  return { statsByJob, isLoading, refetch };
}
