import { useState, useEffect, useRef, useCallback } from 'react';
import { applicationService } from '../services/applicationService';

const DETAIL_CONCURRENCY = 5;

export const detailKey = (item) => `${item.id}|${item.status}`;

/**
 * GET /screened rows don't carry `allowedTransitions`, which is what decides
 * the Save and Approve buttons. Until the list sends it, this reads each
 * visible row's own application (GET /:id, a few at a time) and keeps it by
 * id + status, so a row is read once and again only if its status changes.
 *
 * Rows that already carry the list are never fetched, so this goes quiet by
 * itself once the backend adds it.
 *
 * details[key] is the application, or 'error'. `setDetail(app)` stores a fresh
 * one (the reply to a status change); `reset()` forgets everything, e.g. on a
 * manual refresh, which also retries rows that failed.
 */
export function useScreenedRowDetails(items) {
  const [details, setDetails] = useState({});
  const requestedRef = useRef(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const todo = items.filter((i) => i.allowedTransitions === null && !requestedRef.current.has(detailKey(i)));
    if (todo.length === 0) return;
    todo.forEach((i) => requestedRef.current.add(detailKey(i)));
    const queue = [...todo];
    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        let value;
        try {
          value = await applicationService.getApplication(item.id);
        } catch {
          value = 'error';
        }
        if (mountedRef.current) setDetails((prev) => ({ ...prev, [detailKey(item)]: value }));
      }
    };
    for (let n = 0; n < Math.min(DETAIL_CONCURRENCY, todo.length); n += 1) worker();
  }, [items]);

  const setDetail = useCallback((app) => {
    requestedRef.current.add(detailKey(app));
    setDetails((prev) => ({ ...prev, [detailKey(app)]: app }));
  }, []);

  const reset = useCallback(() => {
    requestedRef.current = new Set();
    setDetails({});
  }, []);

  return { details, setDetail, reset };
}
