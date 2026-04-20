import { fetchJson } from "./chatRtdb";

const responseCache = new Map();
const inflightRequests = new Map();

const getFreshEntry = (cacheKey, ttlMs) => {
  const entry = responseCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  const normalizedTtl = Number(ttlMs || 0);
  if (normalizedTtl > 0 && Date.now() - Number(entry.cachedAt || 0) > normalizedTtl) {
    return null;
  }

  return entry;
};

export const readCachedJson = (url, options = {}) => {
  const cacheKey = String(url || "").trim();
  if (!cacheKey) {
    return undefined;
  }

  const entry = getFreshEntry(cacheKey, options?.ttlMs);
  return entry ? entry.data : undefined;
};

export const writeCachedJson = (url, data) => {
  const cacheKey = String(url || "").trim();
  if (!cacheKey) {
    return data;
  }

  responseCache.set(cacheKey, {
    data,
    cachedAt: Date.now(),
  });

  return data;
};

export const clearCachedJson = (url) => {
  const cacheKey = String(url || "").trim();
  if (!cacheKey) {
    return;
  }

  responseCache.delete(cacheKey);
  inflightRequests.delete(cacheKey);
};

export const fetchCachedJson = async (url, options = {}) => {
  const cacheKey = String(url || "").trim();
  const ttlMs = Number(options?.ttlMs || 5 * 60 * 1000);
  const fallbackValue = Object.prototype.hasOwnProperty.call(options || {}, "fallbackValue")
    ? options.fallbackValue
    : null;
  const force = Boolean(options?.force);

  if (!cacheKey) {
    return fallbackValue;
  }

  if (!force) {
    const cachedEntry = getFreshEntry(cacheKey, ttlMs);
    if (cachedEntry) {
      return cachedEntry.data;
    }

    const inflightRequest = inflightRequests.get(cacheKey);
    if (inflightRequest) {
      return inflightRequest;
    }
  }

  const staleEntry = responseCache.get(cacheKey);
  const request = fetchJson(cacheKey, undefined)
    .then((data) => {
      if (typeof data !== "undefined") {
        writeCachedJson(cacheKey, data);
        return data;
      }

      if (staleEntry) {
        return staleEntry.data;
      }

      return fallbackValue;
    })
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, request);
  return request;
};