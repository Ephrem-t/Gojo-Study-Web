import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';

const DEFAULT_PAGE_SIZE = 20;

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
  const {
    enabled = true,
    pageSize = DEFAULT_PAGE_SIZE,
    filterFn = null,
    resetKeys = [],
    infiniteScroll = false,
  } = options;
  const [pageIndex, setPageIndex] = useState(0);
  const [loadedCount, setLoadedCount] = useState(pageSize);
  const [isLoadingNext, setIsLoadingNext] = useState(false);

  const normalizedQueryKey = Array.isArray(queryKey) ? queryKey : [queryKey];
  const normalizedResetKeys = Array.isArray(resetKeys) ? resetKeys : [resetKeys];
  const effectivePageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);

  // Reset to page 0 whenever the effective key changes (e.g. different teacher)
  // or when a local filter/search value changes.
  const resetSignature = JSON.stringify([normalizedQueryKey, normalizedResetKeys]);
  useEffect(() => {
    setPageIndex(0);
    setLoadedCount(effectivePageSize);
    setIsLoadingNext(false);
  }, [resetSignature, effectivePageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isError, error } = useQuery({
    queryKey: normalizedQueryKey,
    queryFn: () => fetchFn(),
    enabled,
    // React Query v5: keepPreviousData replaced by placeholderData
    placeholderData: keepPreviousData,
  });

  const allItems = Array.isArray(data) ? data : [];
  const filteredItems = useMemo(() => {
    if (typeof filterFn !== 'function') {
      return allItems;
    }

    return allItems.filter((item, itemIndex) => filterFn(item, itemIndex, allItems));
  }, [allItems, filterFn]);

  // INFINITE SCROLL MODE: Return accumulated items up to loadedCount
  if (infiniteScroll) {
    const accumulatedItems = filteredItems.slice(0, loadedCount);
    const hasMore = loadedCount < filteredItems.length;
    
    const goNextInfinite = async () => {
      if (hasMore && !isLoadingNext) {
        setIsLoadingNext(true);
        // Simulate small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 300));
        setLoadedCount((prev) => Math.min(prev + effectivePageSize, filteredItems.length));
        setIsLoadingNext(false);
      }
    };

    return {
      items: accumulatedItems,
      allItems,
      filteredItems,
      isLoading,
      isError,
      error,
      pageSize: effectivePageSize,
      goNext: goNextInfinite,
      hasMore,
      isLoadingNext,
      loadedCount,
    };
  }

  // PAGINATION MODE: Original behavior
  const totalPages = Math.ceil(filteredItems.length / effectivePageSize);
  const maxPageIndex = Math.max(0, totalPages - 1);

  useEffect(() => {
    setPageIndex((currentPageIndex) => Math.min(currentPageIndex, maxPageIndex));
  }, [maxPageIndex]);

  const startIndex = pageIndex * effectivePageSize;
  const endIndex = startIndex + effectivePageSize;
  const items = filteredItems.slice(startIndex, endIndex);

  const hasNext = pageIndex < totalPages - 1;
  const hasPrev = pageIndex > 0;

  const goNext = () => { if (hasNext) setPageIndex((p) => p + 1); };
  const goPrev = () => { if (hasPrev) setPageIndex((p) => p - 1); };
  const resetPage = () => setPageIndex(0);

  return {
    items,
    allItems,
    filteredItems,
    isLoading,
    isError,
    error,
    pageIndex,
    pageSize: effectivePageSize,
    setPageIndex,
    resetPage,
    goNext,
    goPrev,
    hasNext,
    hasPrev,
    totalPages,
  };
};
