import { API_BASE } from "../api/apiConfig";
import { RTDB_BASE_RAW } from "../api/rtdbScope";
import { resolveAvatarImage } from "./profileImage";
import {
  buildChatKeyCandidates,
  buildChatSummaryPath,
  buildOwnerChatSummariesPath,
  chatKeyIncludesUser,
  getConversationSortTime,
  mapInBatches,
  normalizeChatSummaryValue,
  parseChatParticipantIds,
  resolveExistingChatKey,
} from "./chatRtdb";
import { clearCachedJson, fetchCachedJson, readCachedJson, writeCachedJson } from "./rtdbCache";

const USER_RECORD_TTL_MS = 15 * 60 * 1000;
const PARENT_RECORD_TTL_MS = 15 * 60 * 1000;
const STUDENT_RECORD_TTL_MS = 15 * 60 * 1000;
const STUDENT_QUERY_TTL_MS = 5 * 60 * 1000;
const CHAT_INDEX_TTL_MS = 20 * 1000;
const CHAT_SUMMARY_TTL_MS = 15 * 1000;
const SCHOOL_CODE_TTL_MS = 24 * 60 * 60 * 1000;

const sessionValuePrefix = "teacher_session_cache_v1";
const userRecordCache = new Map();
const userNodeCache = new Map();
const parentRecordCache = new Map();
const studentRecordCache = new Map();
const schoolCodeInflight = new Map();

const readStorageJson = (storage, key) => {
  if (typeof window === "undefined") return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const writeStorageJson = (storage, key, value) => {
  if (typeof window === "undefined") return;

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
};

const isRecordObject = (value) => {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !value.error &&
      Object.keys(value).length > 0
  );
};

export const normalizeIdentifier = (value) => String(value || "").trim();
export const normalizeGrade = (value) => String(value ?? "").trim();
export const normalizeSection = (value) => String(value ?? "").trim().toUpperCase();
export const normalizeTeacherRef = (value) => String(value || "").trim().replace(/^-+/, "").toUpperCase();

export const buildGradeSectionKey = (grade, section) => {
  return `${normalizeGrade(grade)}|${normalizeSection(section)}`;
};

export const buildSchoolRtdbBase = (schoolCode) => {
  const normalizedSchoolCode = normalizeIdentifier(schoolCode);
  return normalizedSchoolCode
    ? `${RTDB_BASE_RAW}/Platform1/Schools/${normalizedSchoolCode}`
    : RTDB_BASE_RAW;
};

export const extractSchoolCodeFromRtdbBase = (rtdbBase) => {
  const normalizedBase = String(rtdbBase || "");
  const match = normalizedBase.match(/\/Platform1\/Schools\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
};

export const readSessionResource = (cacheKey, options = {}) => {
  const normalizedKey = `${sessionValuePrefix}:${String(cacheKey || "").trim()}`;
  if (!normalizedKey) return null;

  const parsed = readStorageJson(window.sessionStorage, normalizedKey) || readStorageJson(window.localStorage, normalizedKey);
  if (!parsed) return null;

  const ttlMs = Number(options?.ttlMs || 0);
  const cachedAt = Number(parsed.cachedAt || 0);
  if (ttlMs > 0 && cachedAt > 0 && Date.now() - cachedAt > ttlMs) {
    return null;
  }

  return parsed.data;
};

export const writeSessionResource = (cacheKey, data) => {
  const normalizedKey = `${sessionValuePrefix}:${String(cacheKey || "").trim()}`;
  if (!normalizedKey) return data;

  const payload = {
    data,
    cachedAt: Date.now(),
  };

  writeStorageJson(window.sessionStorage, normalizedKey, payload);
  writeStorageJson(window.localStorage, normalizedKey, payload);
  return data;
};

export const clearSessionResource = (cacheKey) => {
  if (typeof window === "undefined") return;

  const normalizedKey = `${sessionValuePrefix}:${String(cacheKey || "").trim()}`;
  if (!normalizedKey) return;

  try {
    window.sessionStorage.removeItem(normalizedKey);
    window.localStorage.removeItem(normalizedKey);
  } catch {
    // ignore storage failures
  }
};

export const fetchAcademicYearsNode = async (rtdbBase, { ttlMs = 15 * 60 * 1000 } = {}) => {
  const normalizedBase = String(rtdbBase || "").trim();
  if (!normalizedBase) {
    return {};
  }

  const cacheKey = `academic_years:${normalizedBase}`;
  const cachedValue = readSessionResource(cacheKey, { ttlMs });
  if (cachedValue && typeof cachedValue === "object") {
    return cachedValue;
  }

  const upperUrl = `${normalizedBase}/AcademicYears.json`;
  const upperData = await fetchCachedJson(upperUrl, {
    ttlMs,
    fallbackValue: {},
  }).catch(() => ({}));
  const upperNode = upperData && typeof upperData === "object" ? upperData : {};
  if (Object.keys(upperNode).length) {
    writeSessionResource(cacheKey, upperNode);
    return upperNode;
  }

  const lowerUrl = `${normalizedBase}/academicYears.json`;
  const lowerData = await fetchCachedJson(lowerUrl, {
    ttlMs,
    fallbackValue: {},
  }).catch(() => ({}));
  const lowerNode = lowerData && typeof lowerData === "object" ? lowerData : {};
  writeSessionResource(cacheKey, lowerNode);
  return lowerNode;
};

const buildScopedCacheKey = (rtdbBase, entityName, identifier) => {
  return `${String(rtdbBase || "").trim()}|${entityName}|${normalizeIdentifier(identifier)}`;
};

const readRecordChildValue = (recordKey, record, childPath) => {
  if (!childPath) {
    return "";
  }
  if (childPath === "$key") {
    return normalizeIdentifier(recordKey);
  }

  const segments = String(childPath || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  let currentValue = record;
  for (const segment of segments) {
    currentValue = currentValue?.[segment];
  }

  return normalizeIdentifier(currentValue);
};

const fetchScopedCollectionNode = async ({ rtdbBase, nodePath, ttlMs, force = false }) => {
  const normalizedBase = String(rtdbBase || "").trim();
  if (!normalizedBase || !nodePath) {
    return {};
  }

  const collectionNode = await fetchCachedJson(`${normalizedBase}/${nodePath}.json`, {
    ttlMs,
    fallbackValue: {},
    force,
  });

  return collectionNode && typeof collectionNode === "object" ? collectionNode : {};
};

const querySingleScopedRecord = async ({ rtdbBase, nodePath, childPath, matchValue, ttlMs = USER_RECORD_TTL_MS, force = false }) => {
  const normalizedValue = normalizeIdentifier(matchValue);
  const normalizedBase = String(rtdbBase || "").trim();
  if (!normalizedBase || !normalizedValue) {
    return { recordKey: "", record: null };
  }

  const collectionNode = await fetchScopedCollectionNode({
    rtdbBase: normalizedBase,
    nodePath,
    ttlMs,
    force,
  });

  const [recordKey, record] = Object.entries(collectionNode || {}).find(([entryKey, entryValue]) => {
    if (!isRecordObject(entryValue)) {
      return false;
    }

    return (
      normalizeIdentifier(entryKey) === normalizedValue ||
      readRecordChildValue(entryKey, entryValue, childPath) === normalizedValue
    );
  }) || [];

  return {
    recordKey: String(recordKey || "").trim(),
    record: isRecordObject(record) ? record : null,
  };
};

export const resolveTeacherSchoolCode = async (rawSchoolCode) => {
  const normalizedRawSchoolCode = normalizeIdentifier(rawSchoolCode);
  if (!normalizedRawSchoolCode) {
    return "";
  }

  if (normalizedRawSchoolCode.includes("-")) {
    return normalizedRawSchoolCode;
  }

  const shortKey = normalizedRawSchoolCode.toUpperCase();
  const inflightKey = `school:${shortKey}`;
  if (schoolCodeInflight.has(inflightKey)) {
    return schoolCodeInflight.get(inflightKey);
  }

  const request = (async () => {
    const mappedSchoolCode = await fetchCachedJson(
      `${RTDB_BASE_RAW}/Platform1/schoolCodeIndex/${shortKey}.json`,
      {
        ttlMs: SCHOOL_CODE_TTL_MS,
        fallbackValue: null,
      }
    );

    if (typeof mappedSchoolCode === "string" && mappedSchoolCode.trim()) {
      return String(mappedSchoolCode).trim();
    }

    const schoolsNode = await fetchCachedJson(`${RTDB_BASE_RAW}/Platform1/Schools.json`, {
      ttlMs: SCHOOL_CODE_TTL_MS,
      fallbackValue: {},
    });

    const match = Object.entries(schoolsNode || {}).find(([, schoolNode]) => {
      const shortName = String(schoolNode?.schoolInfo?.shortName || "").trim().toUpperCase();
      return shortName === shortKey;
    });

    return match?.[0] ? String(match[0]).trim() : normalizedRawSchoolCode;
  })().finally(() => {
    schoolCodeInflight.delete(inflightKey);
  });

  schoolCodeInflight.set(inflightKey, request);
  return request;
};

export const extractAllowedGradeSectionsFromCourseContext = (courseContext) => {
  const allowedGradeSections = new Set(
    (courseContext?.courses || [])
      .map((course) => buildGradeSectionKey(course?.grade, course?.section || course?.secation))
      .filter((value) => value !== "|")
  );

  (courseContext?.courseIds || []).forEach((courseId) => {
    const rawCourseId = normalizeIdentifier(courseId);
    const body = rawCourseId.startsWith("course_") ? rawCourseId.slice("course_".length) : rawCourseId;
    const lastFragment = body.split("_").filter(Boolean).at(-1) || "";
    const match = lastFragment.match(/^(\d+)([A-Za-z].*)$/);
    if (!match) {
      return;
    }

    const grade = String(match[1] || "").trim();
    const section = String(match[2] || "").trim().toUpperCase();
    if (grade && section) {
      allowedGradeSections.add(buildGradeSectionKey(grade, section));
    }
  });

  return allowedGradeSections;
};

export const getStudentUserId = (student = {}) => {
  return normalizeIdentifier(
    student?.userId ||
      student?.systemAccountInformation?.userId ||
      student?.account?.userId ||
      ""
  );
};

export const isActiveRecord = (record = {}) => {
  const rawValue = record?.status ?? record?.isActive;
  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  const normalizedValue = String(rawValue || "active").toLowerCase();
  return normalizedValue === "active" || normalizedValue === "true" || normalizedValue === "1";
};

export const loadUserRecordById = async ({ rtdbBase, schoolCode, userId, force = false } = {}) => {
  const normalizedUserId = normalizeIdentifier(userId);
  const normalizedBase = String(rtdbBase || "").trim();
  if (!normalizedBase || !normalizedUserId) {
    return null;
  }

  const scopedSchoolCode = normalizeIdentifier(schoolCode || extractSchoolCodeFromRtdbBase(normalizedBase));
  const cacheKey = buildScopedCacheKey(normalizedBase, "Users", normalizedUserId);
  if (!force && userRecordCache.has(cacheKey)) {
    return userRecordCache.get(cacheKey) || null;
  }

  const directUrl = `${normalizedBase}/Users/${encodeURIComponent(normalizedUserId)}.json`;
  const directRecord = await fetchCachedJson(directUrl, {
    ttlMs: USER_RECORD_TTL_MS,
    fallbackValue: null,
    force,
  });
  if (isRecordObject(directRecord)) {
    userRecordCache.set(cacheKey, directRecord);
    return directRecord;
  }

  for (const childPath of ["userId", "username"]) {
    const { recordKey, record } = await querySingleScopedRecord({
      rtdbBase: normalizedBase,
      nodePath: "Users",
      childPath,
      matchValue: normalizedUserId,
      ttlMs: USER_RECORD_TTL_MS,
      force,
    });

    if (!isRecordObject(record)) {
      continue;
    }

    userRecordCache.set(cacheKey, record);
    writeCachedJson(directUrl, record);
    if (recordKey) {
      writeCachedJson(`${normalizedBase}/Users/${encodeURIComponent(recordKey)}.json`, record);
    }
    return record;
  }

  return null;
};

export const loadUserNodeByIdentifier = async ({
  rtdbBase,
  schoolCode,
  identifier,
  childPaths = ["userId", "username", "teacherId"],
  force = false,
} = {}) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const normalizedBase = String(rtdbBase || "").trim();
  if (!normalizedBase || !normalizedIdentifier) {
    return { key: "", record: null };
  }

  const scopedSchoolCode = normalizeIdentifier(schoolCode || extractSchoolCodeFromRtdbBase(normalizedBase));
  const cacheKey = buildScopedCacheKey(normalizedBase, "Users:node", normalizedIdentifier);
  if (!force && userNodeCache.has(cacheKey)) {
    return userNodeCache.get(cacheKey) || { key: "", record: null };
  }

  const directUrl = `${normalizedBase}/Users/${encodeURIComponent(normalizedIdentifier)}.json`;
  const directRecord = await fetchCachedJson(directUrl, {
    ttlMs: USER_RECORD_TTL_MS,
    fallbackValue: null,
    force,
  });
  if (isRecordObject(directRecord)) {
    const directMatch = { key: normalizedIdentifier, record: directRecord };
    userNodeCache.set(cacheKey, directMatch);
    userRecordCache.set(buildScopedCacheKey(normalizedBase, "Users", normalizedIdentifier), directRecord);
    return directMatch;
  }

  for (const childPath of [...new Set((childPaths || []).map((value) => String(value || "").trim()).filter(Boolean))]) {
    const { recordKey, record } = await querySingleScopedRecord({
      rtdbBase: normalizedBase,
      nodePath: "Users",
      childPath,
      matchValue: normalizedIdentifier,
      ttlMs: USER_RECORD_TTL_MS,
      force,
    });

    if (!isRecordObject(record)) {
      continue;
    }

    const resolvedMatch = {
      key: String(recordKey || "").trim(),
      record,
    };
    userNodeCache.set(cacheKey, resolvedMatch);
    userRecordCache.set(buildScopedCacheKey(normalizedBase, "Users", normalizedIdentifier), record);
    writeCachedJson(directUrl, record);
    if (recordKey) {
      writeCachedJson(`${normalizedBase}/Users/${encodeURIComponent(recordKey)}.json`, record);
    }
    return resolvedMatch;
  }

  return { key: "", record: null };
};

export const loadUserRecordsByIds = async ({ rtdbBase, schoolCode, userIds, force = false } = {}) => {
  const normalizedUserIds = [...new Set((userIds || []).map(normalizeIdentifier).filter(Boolean))];
  if (!normalizedUserIds.length) {
    return {};
  }

  const records = await mapInBatches(normalizedUserIds, 8, async (userId) => {
    const record = await loadUserRecordById({ rtdbBase, schoolCode, userId, force });
    return [userId, record];
  });

  return records.reduce((result, [userId, record]) => {
    if (record) {
      result[userId] = record;
    }
    return result;
  }, {});
};

export const loadParentRecordById = async ({ rtdbBase, schoolCode, parentId, force = false } = {}) => {
  const normalizedParentId = normalizeIdentifier(parentId);
  const normalizedBase = String(rtdbBase || "").trim();
  if (!normalizedBase || !normalizedParentId) {
    return null;
  }

  const recordsById = await loadParentRecordsByIds({
    rtdbBase: normalizedBase,
    schoolCode,
    parentIds: [normalizedParentId],
    force,
  });

  return recordsById[normalizedParentId] || null;
};

export const loadParentRecordsByIds = async ({ rtdbBase, schoolCode, parentIds, force = false } = {}) => {
  const normalizedParentIds = [...new Set((parentIds || []).map(normalizeIdentifier).filter(Boolean))];
  if (!normalizedParentIds.length) {
    return {};
  }

  const normalizedBase = String(rtdbBase || "").trim();
  if (!normalizedBase) {
    return {};
  }

  const scopedSchoolCode = normalizeIdentifier(schoolCode || extractSchoolCodeFromRtdbBase(normalizedBase));
  const cachedRecords = {};
  const missingParentIds = [];

  normalizedParentIds.forEach((parentId) => {
    const cacheKey = buildScopedCacheKey(normalizedBase, "Parents", parentId);
    if (!force && parentRecordCache.has(cacheKey)) {
      const cachedRecord = parentRecordCache.get(cacheKey) || null;
      if (cachedRecord) {
        cachedRecords[parentId] = cachedRecord;
      }
      return;
    }

    missingParentIds.push(parentId);
  });

  if (!missingParentIds.length) {
    return cachedRecords;
  }

  const queryParams = new URLSearchParams();
  if (scopedSchoolCode) {
    queryParams.set("schoolCode", scopedSchoolCode);
  }
  missingParentIds.forEach((parentId) => {
    queryParams.append("parentId", parentId);
  });

  const parentRecordsUrl = `${API_BASE}/parents/by-ids?${queryParams.toString()}`;
  const fetchedParentRecords = await fetchCachedJson(parentRecordsUrl, {
    ttlMs: PARENT_RECORD_TTL_MS,
    fallbackValue: {},
    force,
  }).catch(() => ({}));

  const fetchedRecords = Object.entries(fetchedParentRecords || {}).reduce((result, [parentId, record]) => {
    if (isRecordObject(record)) {
      result[parentId] = record;
      parentRecordCache.set(buildScopedCacheKey(normalizedBase, "Parents", parentId), record);

      const resolvedParentId = normalizeIdentifier(record?.parentId);
      if (resolvedParentId) {
        parentRecordCache.set(buildScopedCacheKey(normalizedBase, "Parents", resolvedParentId), record);
      }

      const resolvedUserId = normalizeIdentifier(record?.userId);
      if (resolvedUserId) {
        parentRecordCache.set(buildScopedCacheKey(normalizedBase, "Parents", resolvedUserId), record);
      }
    }
    return result;
  }, {});

  return {
    ...cachedRecords,
    ...fetchedRecords,
  };
};

export const loadStudentRecordById = async ({ rtdbBase, schoolCode, studentId, force = false } = {}) => {
  const normalizedStudentId = normalizeIdentifier(studentId);
  const normalizedBase = String(rtdbBase || "").trim();
  if (!normalizedBase || !normalizedStudentId) {
    return null;
  }

  const scopedSchoolCode = normalizeIdentifier(schoolCode || extractSchoolCodeFromRtdbBase(normalizedBase));
  const cacheKey = buildScopedCacheKey(normalizedBase, "Students", normalizedStudentId);
  if (!force && studentRecordCache.has(cacheKey)) {
    return studentRecordCache.get(cacheKey) || null;
  }

  const directUrl = `${normalizedBase}/Students/${encodeURIComponent(normalizedStudentId)}.json`;
  const directRecord = await fetchCachedJson(directUrl, {
    ttlMs: STUDENT_RECORD_TTL_MS,
    fallbackValue: null,
    force,
  });
  if (isRecordObject(directRecord)) {
    studentRecordCache.set(cacheKey, directRecord);
    return directRecord;
  }

  for (const childPath of [
    "studentId",
    "userId",
    "basicStudentInformation/studentId",
    "systemAccountInformation/userId",
    "account/userId",
  ]) {
    const { recordKey, record } = await querySingleScopedRecord({
      rtdbBase: normalizedBase,
      nodePath: "Students",
      childPath,
      matchValue: normalizedStudentId,
      ttlMs: STUDENT_RECORD_TTL_MS,
      force,
    });

    if (!isRecordObject(record)) {
      continue;
    }

    studentRecordCache.set(cacheKey, record);
    writeCachedJson(directUrl, record);
    if (recordKey) {
      writeCachedJson(`${normalizedBase}/Students/${encodeURIComponent(recordKey)}.json`, record);
    }
    return record;
  }

  return null;
};

export const loadStudentRecordsByIds = async ({ rtdbBase, schoolCode, studentIds, force = false } = {}) => {
  const normalizedStudentIds = [...new Set((studentIds || []).map(normalizeIdentifier).filter(Boolean))];
  if (!normalizedStudentIds.length) {
    return {};
  }

  const records = await mapInBatches(normalizedStudentIds, 8, async (studentId) => {
    const record = await loadStudentRecordById({ rtdbBase, schoolCode, studentId, force });
    return [studentId, record];
  });

  return records.reduce((result, [studentId, record]) => {
    if (record) {
      result[studentId] = record;
    }
    return result;
  }, {});
};

const fetchStudentsByGrade = async ({ rtdbBase, gradeValue, force = false }) => {
  const normalizedGrade = normalizeGrade(gradeValue);
  const normalizedBase = String(rtdbBase || "").trim();
  if (!normalizedBase || !normalizedGrade) {
    return {};
  }

  const fullStudentsNode = await fetchScopedCollectionNode({
    rtdbBase: normalizedBase,
    nodePath: "Students",
    ttlMs: STUDENT_QUERY_TTL_MS,
    force,
  });

  return Object.entries(fullStudentsNode || {}).reduce((result, [studentKey, studentRecord]) => {
    if (!isRecordObject(studentRecord)) {
      return result;
    }

    const directGrade = normalizeGrade(studentRecord?.grade);
    const nestedGrade = normalizeGrade(studentRecord?.basicStudentInformation?.grade);
    if (directGrade !== normalizedGrade && nestedGrade !== normalizedGrade) {
      return result;
    }

    result[studentKey] = studentRecord;
    return result;
  }, {});
};

export const loadStudentsByGradeSections = async ({
  rtdbBase,
  schoolCode,
  allowedGradeSections,
  allowFullFallback = true,
  includeInactive = false,
} = {}) => {
  const normalizedBase = String(rtdbBase || "").trim();
  const scopedSchoolCode = normalizeIdentifier(schoolCode || extractSchoolCodeFromRtdbBase(normalizedBase));
  const allowedKeys = [...new Set(Array.from(allowedGradeSections || []).map(String).filter(Boolean))];
  if (!normalizedBase || !allowedKeys.length) {
    return [];
  }

  const queryParams = new URLSearchParams();
  if (scopedSchoolCode) {
    queryParams.set("schoolCode", scopedSchoolCode);
  }
  if (includeInactive) {
    queryParams.set("includeInactive", "true");
  }
  [...allowedKeys].sort((leftKey, rightKey) => leftKey.localeCompare(rightKey)).forEach((gradeSectionKey) => {
    queryParams.append("gradeSection", gradeSectionKey);
  });

  const scopedRowsUrl = `${API_BASE}/students/by-grade-sections?${queryParams.toString()}`;
  const scopedRows = await fetchCachedJson(scopedRowsUrl, {
    ttlMs: STUDENT_QUERY_TTL_MS,
    fallbackValue: null,
  });

  if (Array.isArray(scopedRows)) {
    return scopedRows
      .map((row) => {
        const rawRecord = row?.raw && typeof row.raw === "object" && !Array.isArray(row.raw) ? row.raw : {};
        const userRecord = row?.user && typeof row.user === "object" && !Array.isArray(row.user) ? row.user : null;
        const name =
          userRecord?.name ||
          rawRecord?.name ||
          rawRecord?.basicStudentInformation?.name ||
          "Student";
        const resolvedStudentId = normalizeIdentifier(row?.studentId || row?.studentKey || row?.userId);

        return {
          ...row,
          raw: rawRecord,
          user: userRecord,
          id: resolvedStudentId,
          studentId: resolvedStudentId,
          userId: normalizeIdentifier(row?.userId),
          grade: normalizeGrade(row?.grade || rawRecord?.grade || rawRecord?.basicStudentInformation?.grade),
          section: normalizeSection(row?.section || rawRecord?.section || rawRecord?.basicStudentInformation?.section),
          name,
          profileImage: resolveAvatarImage(
            name,
            userRecord?.profileImage,
            userRecord?.profile,
            userRecord?.avatar,
            rawRecord?.profileImage,
            rawRecord?.basicStudentInformation?.studentPhoto,
            rawRecord?.studentPhoto
          ),
        };
      })
      .sort((leftRow, rightRow) => String(leftRow?.name || "").localeCompare(String(rightRow?.name || "")));
  }

  const uniqueGrades = [...new Set(allowedKeys.map((value) => String(value || "").split("|")[0]).filter(Boolean))];
  const studentNodes = {};

  await mapInBatches(uniqueGrades, 3, async (gradeValue) => {
    const cacheUrl = `${normalizedBase}/Students.__grade__${encodeURIComponent(gradeValue)}.json`;
    const cachedGradeNode = readCachedJson(cacheUrl, {
      ttlMs: STUDENT_QUERY_TTL_MS,
    });

    if (cachedGradeNode && typeof cachedGradeNode === "object") {
      Object.assign(studentNodes, cachedGradeNode);
      return cachedGradeNode;
    }

    const gradeNode = await fetchStudentsByGrade({
      rtdbBase: normalizedBase,
      gradeValue,
      force: false,
    });
    writeCachedJson(cacheUrl, gradeNode || {});
    Object.assign(studentNodes, gradeNode || {});
    return gradeNode;
  });

  if (!Object.keys(studentNodes).length && allowFullFallback) {
    const fullStudentsNode = await fetchCachedJson(`${normalizedBase}/Students.json`, {
      ttlMs: STUDENT_QUERY_TTL_MS,
      fallbackValue: {},
    });
    Object.assign(studentNodes, fullStudentsNode || {});
  }

  const rows = Object.entries(studentNodes)
    .filter(([, studentRecord]) => {
      const studentUserId = getStudentUserId(studentRecord);
      if (!studentUserId) {
        return false;
      }

      if (!includeInactive && !isActiveRecord(studentRecord)) {
        return false;
      }

      const gradeSectionKey = buildGradeSectionKey(
        studentRecord?.grade || studentRecord?.basicStudentInformation?.grade,
        studentRecord?.section || studentRecord?.basicStudentInformation?.section
      );

      return allowedKeys.includes(gradeSectionKey);
    })
    .map(([studentKey, studentRecord]) => ({
      studentKey,
      studentId: normalizeIdentifier(studentRecord?.studentId || studentKey),
      userId: getStudentUserId(studentRecord),
      grade: normalizeGrade(studentRecord?.grade || studentRecord?.basicStudentInformation?.grade),
      section: normalizeSection(studentRecord?.section || studentRecord?.basicStudentInformation?.section),
      raw: studentRecord,
    }));

  const usersById = await loadUserRecordsByIds({
    rtdbBase: normalizedBase,
    schoolCode: scopedSchoolCode,
    userIds: rows.map((row) => row.userId),
  });

  return rows
    .map((row) => {
      const userRecord = usersById[row.userId] || null;
      const name =
        userRecord?.name ||
        row.raw?.name ||
        row.raw?.basicStudentInformation?.name ||
        "Student";
      const resolvedStudentId = normalizeIdentifier(row.studentId || row.studentKey || row.userId);

      return {
        ...row,
        id: resolvedStudentId,
        studentId: resolvedStudentId,
        user: userRecord,
        name,
        profileImage: resolveAvatarImage(
          name,
          userRecord?.profileImage,
          userRecord?.profile,
          userRecord?.avatar,
          row.raw?.profileImage,
          row.raw?.basicStudentInformation?.studentPhoto,
          row.raw?.studentPhoto
        ),
      };
    })
    .sort((leftRow, rightRow) => String(leftRow?.name || "").localeCompare(String(rightRow?.name || "")));
};

export const fetchTeacherConversationSummaries = async ({
  rtdbBase,
  schoolCode,
  teacherUserId,
  contactCandidates = [],
  unreadOnly = false,
  limit = 0,
  includeWithoutLastMessage = false,
  force = false,
} = {}) => {
  const normalizedBase = String(rtdbBase || "").trim();
  const normalizedTeacherUserId = normalizeIdentifier(teacherUserId);
  const scopedSchoolCode = normalizeIdentifier(schoolCode || extractSchoolCodeFromRtdbBase(normalizedBase));
  if (!normalizedBase || !normalizedTeacherUserId) {
    return [];
  }

  const contactHintsByUserId = new Map();
  (contactCandidates || []).forEach((contactCandidate) => {
    const contactUserId = normalizeIdentifier(contactCandidate?.userId);
    if (!contactUserId) {
      return;
    }

    if (!contactHintsByUserId.has(contactUserId)) {
      contactHintsByUserId.set(contactUserId, contactCandidate);
    }
  });

  const ownerSummariesRaw = await fetchCachedJson(`${normalizedBase}/${buildOwnerChatSummariesPath(normalizedTeacherUserId)}.json`, {
    ttlMs: CHAT_SUMMARY_TTL_MS,
    fallbackValue: {},
    force,
  });
  const ownerSummaryMap = ownerSummariesRaw && typeof ownerSummariesRaw === "object" ? ownerSummariesRaw : {};

  const summariesByOtherUserId = Object.entries(ownerSummaryMap).reduce((result, [chatId, value]) => {
    const participantIds = parseChatParticipantIds(chatId).filter(
      (participantId) => normalizeIdentifier(participantId) !== normalizedTeacherUserId
    );
    const normalizedSummary = normalizeChatSummaryValue(value, {
      chatId,
      otherUserId: participantIds[0] || "",
    });

    const otherUserId = normalizeIdentifier(normalizedSummary.otherUserId);
    if (!otherUserId) {
      return result;
    }

    const existingSummary = result.get(otherUserId);
    if (!existingSummary || normalizedSummary.lastMessageTime >= existingSummary.lastMessageTime) {
      result.set(otherUserId, normalizedSummary);
    }

    return result;
  }, new Map());

  const rawSummaries = (contactHintsByUserId.size ? [...contactHintsByUserId.keys()] : [...summariesByOtherUserId.keys()])
    .map((otherUserId) => {
      const normalizedOtherUserId = normalizeIdentifier(otherUserId);
      const summary = summariesByOtherUserId.get(normalizedOtherUserId);
      if (!summary) {
        return null;
      }

      if (unreadOnly && summary.unreadCount <= 0) {
        return null;
      }

      if (!includeWithoutLastMessage && summary.unreadCount <= 0 && !summary.lastMessageTime) {
        return null;
      }

      return {
        chatId: summary.chatId,
        otherUserId: normalizedOtherUserId,
        unreadForMe: summary.unreadCount,
        lastMessage: {
          senderId: summary.lastSenderId,
          seen: summary.lastMessageSeen,
          seenAt: summary.lastMessageSeenAt,
          timeStamp: summary.lastMessageTime,
          type: summary.lastMessageType,
          text: summary.lastMessageText,
        },
        lastMessageText: summary.lastMessageText,
        lastMessageTime: summary.lastMessageTime,
      };
    })
    .filter(Boolean);

  const summaries = rawSummaries.filter(Boolean);
  const userIdsToLoad = summaries
    .map((summary) => normalizeIdentifier(summary?.otherUserId))
    .filter((userId) => userId && !contactHintsByUserId.has(userId));

  const usersById = await loadUserRecordsByIds({
    rtdbBase: normalizedBase,
    schoolCode: scopedSchoolCode,
    userIds: userIdsToLoad,
    force,
  });

  const conversationList = summaries
    .map((summary) => {
      const fallbackContact = contactHintsByUserId.get(summary.otherUserId) || {};
      const userRecord = usersById[summary.otherUserId] || null;
      const displayName =
        userRecord?.name ||
        userRecord?.username ||
        fallbackContact?.name ||
        fallbackContact?.displayName ||
        summary.otherUserId ||
        "User";
      const profileImage = resolveAvatarImage(
        displayName,
        userRecord?.profileImage,
        userRecord?.profile,
        userRecord?.avatar,
        fallbackContact?.profileImage,
        fallbackContact?.profile,
        fallbackContact?.avatar
      );

      return {
        chatId: summary.chatId,
        contact: {
          userId: summary.otherUserId,
          name: displayName,
          profileImage,
          type: fallbackContact?.type || fallbackContact?.tab || "user",
        },
        displayName,
        profile: profileImage,
        lastMessageText: summary.lastMessageText,
        lastMessageTime: summary.lastMessageTime,
        lastMessageSeen: Boolean(summary.lastMessage?.seen),
        lastMessageSeenAt: summary.lastMessage?.seenAt || null,
        lastMessageSenderId: normalizeIdentifier(summary.lastMessage?.senderId),
        unreadForMe: summary.unreadForMe,
        title: summary.unreadForMe > 1 ? `${summary.unreadForMe} new messages` : "New message",
      };
    })
    .sort((leftConversation, rightConversation) => {
      return Number(rightConversation?.lastMessageTime || 0) - Number(leftConversation?.lastMessageTime || 0);
    });

  return limit > 0 ? conversationList.slice(0, limit) : conversationList;
};

export const buildUnreadConversationMap = (conversations = []) => {
  return (conversations || []).reduce((result, conversation) => {
    const userId = normalizeIdentifier(conversation?.contact?.userId || conversation?.userId);
    if (!userId) {
      return result;
    }

    result[userId] = Number(conversation?.unreadForMe || 0);
    return result;
  }, {});
};

export const clearCachedChatSummary = ({ rtdbBase, chatId, teacherUserId } = {}) => {
  const normalizedBase = String(rtdbBase || "").trim();
  const normalizedChatId = normalizeIdentifier(chatId);
  const normalizedTeacherUserId = normalizeIdentifier(teacherUserId);
  if (!normalizedBase || !normalizedChatId) {
    return;
  }

  if (normalizedTeacherUserId) {
    clearCachedJson(`${normalizedBase}/${buildChatSummaryPath(normalizedTeacherUserId, normalizedChatId)}.json`);
    clearCachedJson(`${normalizedBase}/${buildOwnerChatSummariesPath(normalizedTeacherUserId)}.json`);
  }
};