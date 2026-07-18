import { useState, useEffect, useRef, useCallback } from 'react';

const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_PAGE_SIZE = 20;

/**
 * Builds a server-driven pagination hook around a fetchFn(params) that
 * resolves to { items, total }. Free-text `search` is debounced; any other
 * filter change (or a resolved search) resets to page 1 before fetching, so
 * exactly one request fires per meaningful change instead of one per render.
 */
export function createPaginatedListHook(fetchFn) {
  return function usePaginatedList(filters = {}) {
    const { search = '', ...restFilters } = filters;
    const restFiltersKey = JSON.stringify(restFilters);

    const [debouncedSearch, setDebouncedSearch] = useState(search);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const requestIdRef = useRef(0);
    const filterKeyRef = useRef(`${restFiltersKey}|${search}`);

    useEffect(() => {
      const t = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
      return () => clearTimeout(t);
    }, [search]);

    const runFetch = useCallback(async (fetchPage, fetchPageSize) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchFn({
          ...restFilters,
          search: debouncedSearch || undefined,
          page: fetchPage,
          pageSize: fetchPageSize,
        });
        if (requestId !== requestIdRef.current) return;
        setItems(result.items);
        setTotal(result.total);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err);
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
      // restFiltersKey stands in for restFilters (stable content comparison)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restFiltersKey, debouncedSearch]);

    useEffect(() => {
      const key = `${restFiltersKey}|${debouncedSearch}`;
      if (filterKeyRef.current !== key) {
        filterKeyRef.current = key;
        if (page !== 1) {
          setPage(1);
          return; // the page-state change re-triggers this effect at page 1
        }
      }
      runFetch(page, pageSize);
    }, [restFiltersKey, debouncedSearch, page, pageSize, runFetch]);

    const refetch = useCallback(() => runFetch(page, pageSize), [runFetch, page, pageSize]);

    return { items, total, page, pageSize, setPage, setPageSize, isLoading, error, refetch };
  };
}
