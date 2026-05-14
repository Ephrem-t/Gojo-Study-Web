import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

const PAGE_SIZE = 20;

/**
 * usePaginatedProxy
 * @param {Function} fetchFn   - async () => full array
 * @param {Array}    queryKey  - include dependency identifiers so the query
 *                               re-runs when the data source changes,
 *                               e.g. ['students', teacherUserId]
 * @param {Object}   options
 * @param {boolean}  options.enabled - false blocks the query until deps are ready
 */
export const usePaginatedProxy = (fetchFn, queryKey, options = {}) => {
  const { enabled = true } = options;
  const [pageIndex, setPageIndex] = useState(0);

  const normalizedQueryKey = Array.isArray(queryKey) ? queryKey : [queryKey];

  // Reset to page 0 whenever the effective key changes (e.g. different teacher)
  const keyString = JSON.stringify(normalizedQueryKey);
  useEffect(() => {
    setPageIndex(0);
  }, [keyString]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isError } = useQuery({
    queryKey: normalizedQueryKey,
    queryFn: () => fetchFn(),
    enabled,
    // React Query v5: keepPreviousData replaced by placeholderData
    placeholderData: keepPreviousData,
  });

  // Client-side pagination over the full cached result
  const allItems = data || [];
  const totalPages = Math.ceil(allItems.length / PAGE_SIZE);
  const startIndex = pageIndex * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const items = allItems.slice(startIndex, endIndex);

  const hasNext = pageIndex < totalPages - 1;
  const hasPrev = pageIndex > 0;

  const goNext = () => { if (hasNext) setPageIndex((p) => p + 1); };
  const goPrev = () => { if (hasPrev) setPageIndex((p) => p - 1); };

  return {
    items,
    allItems,
    isLoading,
    isError,
    pageIndex,
    goNext,
    goPrev,
    hasNext,
    hasPrev,
    totalPages,
  };
};
