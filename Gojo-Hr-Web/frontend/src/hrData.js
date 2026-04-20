import api from './api';

const HR_RESOURCE_CACHE = new Map();

function normalizeCollection(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return Object.entries(data || {}).map(([id, payload]) => ({
    ...(payload || {}),
    id,
  }));
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

  const promise = loader()
    .then((data) => {
      HR_RESOURCE_CACHE.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    })
    .catch((error) => {
      HR_RESOURCE_CACHE.delete(cacheKey);
      throw error;
    });

  HR_RESOURCE_CACHE.set(cacheKey, { promise, timestamp: now });
  return promise;
}

export function setCachedHrResource(cacheKey, data) {
  HR_RESOURCE_CACHE.set(cacheKey, { data, timestamp: Date.now() });
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