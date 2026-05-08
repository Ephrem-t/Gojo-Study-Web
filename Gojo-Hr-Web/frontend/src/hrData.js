import api from './api';

const HR_RESOURCE_CACHE = new Map();
const HR_PERSISTED_RESOURCE_PREFIX = 'gojo-hr:resource-cache:';

function normalizeCollection(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return Object.entries(data || {}).map(([id, payload]) => ({
    ...(payload || {}),
    id,
  }));
}

function getHrResourceStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function buildPersistedHrResourceKey(cacheKey) {
  return `${HR_PERSISTED_RESOURCE_PREFIX}${cacheKey}`;
}

function readPersistedHrResource(cacheKey, ttlMs) {
  if (ttlMs <= 0) {
    return { found: false, data: null };
  }

  const storage = getHrResourceStorage();
  if (!storage) {
    return { found: false, data: null };
  }

  const storageKey = buildPersistedHrResourceKey(cacheKey);

  try {
    const rawValue = storage.getItem(storageKey);
    if (!rawValue) {
      return { found: false, data: null };
    }

    const parsedValue = JSON.parse(rawValue);
    const timestamp = Number(parsedValue?.timestamp || 0);
    if (!Number.isFinite(timestamp) || (Date.now() - timestamp) >= ttlMs) {
      storage.removeItem(storageKey);
      return { found: false, data: null };
    }

    if (!Object.prototype.hasOwnProperty.call(parsedValue || {}, 'data')) {
      storage.removeItem(storageKey);
      return { found: false, data: null };
    }

    return { found: true, data: parsedValue.data };
  } catch {
    try {
      storage.removeItem(storageKey);
    } catch {
      // Ignore cleanup errors for corrupted cache entries.
    }
    return { found: false, data: null };
  }
}

function writePersistedHrResource(cacheKey, data) {
  const storage = getHrResourceStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(buildPersistedHrResourceKey(cacheKey), JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch {
    // Ignore storage quota or serialization errors and keep the in-memory cache working.
  }
}

function deletePersistedHrResource(cacheKey) {
  const storage = getHrResourceStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(buildPersistedHrResourceKey(cacheKey));
  } catch {
    // Ignore cleanup errors.
  }
}

export function getCachedHrResource(cacheKey, loader, ttlMs = 60 * 1000) {
  const now = Date.now();
  const existing = HR_RESOURCE_CACHE.get(cacheKey);

  if (existing?.promise) {
    return existing.promise;
  }

  if (existing && Object.prototype.hasOwnProperty.call(existing, 'data') && (now - existing.timestamp) < ttlMs) {
    return Promise.resolve(existing.data);
  }

  const persisted = readPersistedHrResource(cacheKey, ttlMs);
  if (persisted.found) {
    HR_RESOURCE_CACHE.set(cacheKey, { data: persisted.data, timestamp: now });
    return Promise.resolve(persisted.data);
  }

  const promise = loader()
    .then((data) => {
      HR_RESOURCE_CACHE.set(cacheKey, { data, timestamp: Date.now() });
      writePersistedHrResource(cacheKey, data);
      return data;
    })
    .catch((error) => {
      HR_RESOURCE_CACHE.delete(cacheKey);
      deletePersistedHrResource(cacheKey);
      throw error;
    });

  HR_RESOURCE_CACHE.set(cacheKey, { promise, timestamp: now });
  return promise;
}

export function setCachedHrResource(cacheKey, data) {
  HR_RESOURCE_CACHE.set(cacheKey, { data, timestamp: Date.now() });
  writePersistedHrResource(cacheKey, data);
}

export const HR_EMPLOYEES_CACHE_KEY = 'hr:employees:summary:all';
export const HR_DEPARTMENTS_CACHE_KEY = 'hr:departments:all';
export const HR_POSITIONS_CACHE_KEY = 'hr:positions:all';

export function getEmployeesSnapshot(ttlMs = 60 * 1000) {
  return getCachedHrResource(HR_EMPLOYEES_CACHE_KEY, async () => {
    const response = await api.get('/employees/summary');
    return normalizeCollection(response.data || {});
  }, ttlMs);
}

export function setEmployeesSnapshot(items) {
  setCachedHrResource(HR_EMPLOYEES_CACHE_KEY, Array.isArray(items) ? items : []);
}

export function getDepartmentsSnapshot(ttlMs = 5 * 60 * 1000) {
  return getCachedHrResource(HR_DEPARTMENTS_CACHE_KEY, async () => {
    const response = await api.get('/departments');
    return normalizeCollection(response.data || {});
  }, ttlMs);
}

export function setDepartmentsSnapshot(items) {
  setCachedHrResource(HR_DEPARTMENTS_CACHE_KEY, Array.isArray(items) ? items : []);
}

export function getPositionsSnapshot(ttlMs = 5 * 60 * 1000) {
  return getCachedHrResource(HR_POSITIONS_CACHE_KEY, async () => {
    const response = await api.get('/positions');
    return normalizeCollection(response.data || {});
  }, ttlMs);
}

export function setPositionsSnapshot(items) {
  setCachedHrResource(HR_POSITIONS_CACHE_KEY, Array.isArray(items) ? items : []);
}

export function getEmployeePersonal(employee) {
  return employee?.personal || employee?.profileData?.personal || {};
}

export function getEmployeeJob(employee) {
  const employment = employee?.employment || employee?.profileData?.employment || {};
  const job = employee?.job || employee?.profileData?.job || {};
  const merged = { ...job, ...employment };

  if (!merged.employeeCategory && merged.category) {
    merged.employeeCategory = merged.category;
  }
  if (!merged.category && merged.employeeCategory) {
    merged.category = merged.employeeCategory;
  }

  if (!merged.department && employee?.department) {
    merged.department = employee.department;
  }
  if (!merged.position && (employee?.position || employee?.role)) {
    merged.position = employee.position || employee.role;
  }
  if (!merged.status && employee?.status) {
    merged.status = employee.status;
  }
  if (!merged.hireDate && employee?.hireDate) {
    merged.hireDate = employee.hireDate;
  }

  return merged;
}

export function getEmployeeMeta(employee) {
  const userId = employee?.userId || employee?.meta?.userId || employee?.profileData?.meta?.userId || '';
  return userId ? { userId } : {};
}

export function getEmployeeContact(employee) {
  return employee?.contact || employee?.profileData?.contact || {};
}

export function getEmployeeName(employee) {
  const personal = getEmployeePersonal(employee);
  return employee?.name
    || employee?.fullName
    || [personal.firstName, personal.middleName, personal.lastName].filter(Boolean).join(' ')
    || 'Employee';
}

export function getEmployeeProfileImage(employee) {
  const personal = getEmployeePersonal(employee);
  return employee?.profileImage
    || employee?.profileImageUrl
    || employee?.photoURL
    || employee?.photo
    || personal.profileImage
    || personal.profileImageName
    || employee?.profileData?.personal?.profileImageName
    || '';
}

export function getEmployeeRoleId(employee) {
  return employee?.teacherId
    || employee?.managementId
    || employee?.financeId
    || employee?.hrId
    || employee?.profileData?.teacherId
    || employee?.profileData?.managementId
    || employee?.profileData?.financeId
    || employee?.profileData?.hrId
    || '';
}