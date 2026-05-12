const memoryCache = new Map();
const inflightRequests = new Map();

function getSessionStorage() {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getExpiry(ttlMs) {
  return Number.isFinite(ttlMs) && ttlMs > 0 ? Date.now() + ttlMs : Number.POSITIVE_INFINITY;
}

function isFresh(entry) {
  return Boolean(entry) && Number(entry.expiresAt || 0) > Date.now();
}

function readSessionEntry(key) {
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw);
    if (!isFresh(entry)) {
      storage.removeItem(key);
      return null;
    }

    return entry;
  } catch {
    return null;
  }
}

function writeSessionEntry(key, entry) {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore storage quota failures
  }
}

export function getCachedValue(key) {
  const memoryEntry = memoryCache.get(key);
  if (isFresh(memoryEntry)) {
    return memoryEntry.value;
  }

  if (memoryEntry) {
    memoryCache.delete(key);
  }

  const sessionEntry = readSessionEntry(key);
  if (sessionEntry) {
    memoryCache.set(key, sessionEntry);
    return sessionEntry.value;
  }

  return undefined;
}

export function setCachedValue(key, value, { ttlMs = 0, persist = false } = {}) {
  const entry = {
    value,
    expiresAt: getExpiry(ttlMs),
  };

  memoryCache.set(key, entry);

  if (persist) {
    writeSessionEntry(key, entry);
  }

  return value;
}

export function clearCachedValue(key) {
  memoryCache.delete(key);

  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function getOrLoad(key, loader, { ttlMs = 0, persist = false, force = false } = {}) {
  if (!force) {
    const cached = getCachedValue(key);
    if (cached !== undefined) {
      return cached;
    }
  }

  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }

  const requestPromise = Promise.resolve()
    .then(loader)
    .then((value) => {
      setCachedValue(key, value, { ttlMs, persist });
      inflightRequests.delete(key);
      return value;
    })
    .catch((error) => {
      inflightRequests.delete(key);
      throw error;
    });

  inflightRequests.set(key, requestPromise);
  return requestPromise;
}