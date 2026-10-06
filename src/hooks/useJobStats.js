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
  // Set when the counts failed to load, so pages show "—" rather than 0.
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await applicationService.getStatsByJob();
      const map = {};
      items.forEach((stat) => { map[stat.jobId] = stat; });
      setStatsByJob(map);
    } catch (err) {
      // No toast — counts are supplementary, the jobs pages stay usable
      // without them; they show "—" instead.
      setError(err);
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
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
     
  }, []);

  return { statsByJob, isLoading, error, refetch };
}
