import { useSyncExternalStore } from 'react';
import { getApprovalCap, subscribeApprovalCaps, normalizeApprovalCap } from '../utils/approvalCap';

/**
 * The newest approval cap received for a job, from any response that carried
 * one; `fallback` (an already-normalized cap on the row in hand) is used
 * until one has been seen.
 */
export function useApprovalCap(jobId, fallback = null) {
  const live = useSyncExternalStore(
    subscribeApprovalCaps,
    () => getApprovalCap(jobId),
    () => null,
  );
  return live ?? normalizeApprovalCap(fallback);
}
