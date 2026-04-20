import { equalTo, get, orderByChild, query as dbQuery, ref as dbRef } from "firebase/database";
import { db, schoolPath } from "../firebase";
import { RTDB_BASE_RAW, extractSchoolCodeFromRtdbBase } from "../api/rtdbScope";
import {
  buildChatKeyCandidates,
  chatKeyIncludesUser,
  formatLastMessagePreview,
  getConversationSortTime,
  getSafeProfileImage,
  inferContactTypeFromUser,
  mapInBatches,
  parseChatParticipantIds,
  resolveExistingChatKey,
  uniqueNonEmptyValues,
} from "./chatRtdb";
import { fetchCachedJson, readCachedJson, writeCachedJson } from "./rtdbCache";

const USER_RECORD_TTL_MS = 15 * 60 * 1000;
const PARENT_RECORD_TTL_MS = 15 * 60 * 1000;
const DIRECTORY_TTL_MS = 5 * 60 * 1000;
const SCHOOL_INFO_TTL_MS = 5 * 60 * 1000;
const CHAT_INDEX_TTL_MS = 20 * 1000;
const CHAT_SUMMARY_TTL_MS = 15 * 1000;
const CLASS_MARKS_TTL_MS = 5 * 60 * 1000;
const ATTENDANCE_TTL_MS = 5 * 60 * 1000;

const sessionValuePrefix = "register_session_cache_v2";
const sessionInflight = new Map();
const userRecordCache = new Map();
const parentRecordCache = new Map();
const attendanceCourseCache = new Map();

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
    // Ignore storage failures.
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

export const buildSchoolRtdbBase = (schoolCode) => {
  const normalizedSchoolCode = normalizeIdentifier(schoolCode);
  return normalizedSchoolCode
    ? `${RTDB_BASE_RAW}/Platform1/Schools/${encodeURIComponent(normalizedSchoolCode)}`
    : RTDB_BASE_RAW;
};

export const readSessionResource = (cacheKey, options = {}) => {
  if (typeof window === "undefined") return null;

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
  if (typeof window === "undefined") return data;

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

const loadSessionCachedResource = async ({ cacheKey, ttlMs, force = false, loader, fallbackValue = null }) => {
  if (!cacheKey || typeof loader !== "function") {
    return fallbackValue;
  }

  if (!force) {
    const cachedData = readSessionResource(cacheKey, { ttlMs });
    if (cachedData !== null) {
      return cachedData;
    }

    const inflightRequest = sessionInflight.get(cacheKey);
    if (inflightRequest) {
      return inflightRequest;
    }
  }

  const request = Promise.resolve()
    .then(loader)
    .then((data) => {
      const nextData = typeof data === "undefined" ? fallbackValue : data;
      writeSessionResource(cacheKey, nextData);
      return nextData;
    })
    .finally(() => {
      sessionInflight.delete(cacheKey);
    });

  sessionInflight.set(cacheKey, request);
  return request;
};

const buildNodeUrl = (rtdbBase, nodePath) => `${String(rtdbBase || "").trim()}/${String(nodePath || "").replace(/^\/+/, "")}.json`;

const loadNode = async ({ rtdbBase, nodePath, ttlMs, fallbackValue = {}, force = false, sessionKey }) => {
  const normalizedBase = String(rtdbBase || "").trim();
  if (!normalizedBase) {
    return fallbackValue;
  }

  const normalizedSessionKey = sessionKey || `${normalizedBase}:${nodePath}`;
  return loadSessionCachedResource({
    cacheKey: normalizedSessionKey,
    ttlMs,
    force,
    fallbackValue,
    loader: () =>
      fetchCachedJson(buildNodeUrl(normalizedBase, nodePath), {
        ttlMs,
        fallbackValue,
        force,
      }),
  });
};

export const loadSchoolUsersNode = ({ rtdbBase, force = false } = {}) =>
  loadNode({
    rtdbBase,
    nodePath: "Users",
    ttlMs: DIRECTORY_TTL_MS,
    fallbackValue: {},
    force,
    sessionKey: `${String(rtdbBase || "").trim()}:Users`,
  });

export const loadSchoolStudentsNode = ({ rtdbBase, force = false } = {}) =>
  loadNode({
    rtdbBase,
    nodePath: "Students",
    ttlMs: DIRECTORY_TTL_MS,
    fallbackValue: {},
    force,
    sessionKey: `${String(rtdbBase || "").trim()}:Students`,
  });

export const loadSchoolParentsNode = ({ rtdbBase, force = false } = {}) =>
  loadNode({
    rtdbBase,
    nodePath: "Parents",
    ttlMs: DIRECTORY_TTL_MS,
    fallbackValue: {},
    force,
    sessionKey: `${String(rtdbBase || "").trim()}:Parents`,
  });

export const loadSchoolTeachersNode = ({ rtdbBase, force = false } = {}) =>
  loadNode({
    rtdbBase,
    nodePath: "Teachers",
    ttlMs: DIRECTORY_TTL_MS,
    fallbackValue: {},
    force,
    sessionKey: `${String(rtdbBase || "").trim()}:Teachers`,
  });

export const loadGradeManagementNode = ({ rtdbBase, force = false } = {}) =>
  loadNode({
    rtdbBase,
    nodePath: "GradeManagement/grades",
    ttlMs: DIRECTORY_TTL_MS,
    fallbackValue: {},
    force,
    sessionKey: `${String(rtdbBase || "").trim()}:GradeManagement`,
  });

export const loadSchoolInfoNode = ({ rtdbBase, force = false } = {}) =>
  loadNode({
    rtdbBase,
    nodePath: "schoolInfo",
    ttlMs: SCHOOL_INFO_TTL_MS,
    fallbackValue: {},
    force,
    sessionKey: `${String(rtdbBase || "").trim()}:schoolInfo`,
  });

export const loadCurrentAcademicYear = async ({ rtdbBase, force = false } = {}) => {
  const schoolInfo = await loadSchoolInfoNode({ rtdbBase, force });
  return String(schoolInfo?.currentAcademicYear || "").trim();
};

const buildScopedCacheKey = (rtdbBase, entityName, identifier) => {
  return `${String(rtdbBase || "").trim()}|${entityName}|${normalizeIdentifier(identifier)}`;
};

const querySingleScopedRecord = async ({ nodePath, schoolCode, childPath, matchValue }) => {
  const normalizedValue = normalizeIdentifier(matchValue);
  if (!normalizedValue) {
    return { recordKey: "", record: null };
  }

  try {
    const snapshot = await get(
      dbQuery(
        dbRef(db, schoolPath(nodePath, schoolCode)),
        orderByChild(childPath),
        equalTo(normalizedValue)
      )
    );

    if (!snapshot.exists()) {
      return { recordKey: "", record: null };
    }

    const [recordKey, record] = Object.entries(snapshot.val() || {})[0] || [];
    return {
      recordKey: String(recordKey || "").trim(),
      record: isRecordObject(record) ? record : null,
    };
  } catch {
    return { recordKey: "", record: null };
  }
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
      nodePath: "Users",
      schoolCode: scopedSchoolCode,
      childPath,
      matchValue: normalizedUserId,
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

  const scopedSchoolCode = normalizeIdentifier(schoolCode || extractSchoolCodeFromRtdbBase(normalizedBase));
  const cacheKey = buildScopedCacheKey(normalizedBase, "Parents", normalizedParentId);
  if (!force && parentRecordCache.has(cacheKey)) {
    return parentRecordCache.get(cacheKey) || null;
  }

  const directUrl = `${normalizedBase}/Parents/${encodeURIComponent(normalizedParentId)}.json`;
  const directRecord = await fetchCachedJson(directUrl, {
    ttlMs: PARENT_RECORD_TTL_MS,
    fallbackValue: null,
    force,
  });
  if (isRecordObject(directRecord)) {
    parentRecordCache.set(cacheKey, directRecord);
    return directRecord;
  }

  for (const childPath of ["parentId", "userId"]) {
    const { recordKey, record } = await querySingleScopedRecord({
      nodePath: "Parents",
      schoolCode: scopedSchoolCode,
      childPath,
      matchValue: normalizedParentId,
    });

    if (!isRecordObject(record)) {
      continue;
    }

    parentRecordCache.set(cacheKey, record);
    writeCachedJson(directUrl, record);
    if (recordKey) {
      writeCachedJson(`${normalizedBase}/Parents/${encodeURIComponent(recordKey)}.json`, record);
    }
    return record;
  }

  return null;
};

export const loadParentRecordsByIds = async ({ rtdbBase, schoolCode, parentIds, force = false } = {}) => {
  const normalizedParentIds = [...new Set((parentIds || []).map(normalizeIdentifier).filter(Boolean))];
  if (!normalizedParentIds.length) {
    return {};
  }

  const records = await mapInBatches(normalizedParentIds, 8, async (parentId) => {
    const record = await loadParentRecordById({ rtdbBase, schoolCode, parentId, force });
    return [parentId, record];
  });

  return records.reduce((result, [parentId, record]) => {
    if (record) {
      result[parentId] = record;
    }
    return result;
  }, {});
};

export const loadClassMarksNode = async ({ rtdbBase, allowLegacy = false, force = false } = {}) => {
  const normalizedBase = String(rtdbBase || "").trim();
  if (!normalizedBase) {
    return {};
  }

  const cacheKey = `${normalizedBase}:ClassMarks`;
  return loadSessionCachedResource({
    cacheKey,
    ttlMs: CLASS_MARKS_TTL_MS,
    force,
    fallbackValue: {},
    loader: async () => {
      let classMarks = await fetchCachedJson(`${normalizedBase}/ClassMarks.json`, {
        ttlMs: CLASS_MARKS_TTL_MS,
        fallbackValue: {},
        force,
      });

      if (!allowLegacy || Object.keys(classMarks || {}).length > 0) {
        return classMarks || {};
      }

      classMarks = await fetchCachedJson(`${RTDB_BASE_RAW}/ClassMarks.json`, {
        ttlMs: CLASS_MARKS_TTL_MS,
        fallbackValue: {},
        force,
      });
      return classMarks || {};
    },
  });
};

export const loadMarksForStudent = async ({ rtdbBase, student, allowLegacy = false, force = false } = {}) => {
  const classMarks = await loadClassMarksNode({ rtdbBase, allowLegacy, force });
  const candidates = new Set(
    [
      student?.studentId,
      student?.userId,
      student?.id,
      student?.uid,
      student?.studentNumber,
    ]
      .map(normalizeIdentifier)
      .filter(Boolean)
  );

  const marksObj = {};
  Object.entries(classMarks || {}).forEach(([courseId, studentsNode]) => {
    if (!studentsNode || typeof studentsNode !== "object") {
      return;
    }

    const directMatchKey = [...candidates].find((candidate) => studentsNode?.[candidate]);
    if (directMatchKey) {
      marksObj[courseId] = studentsNode[directMatchKey];
      return;
    }

    const matchedRecord = Object.values(studentsNode || {}).find((record) => {
      if (!record || typeof record !== "object") {
        return false;
      }

      return [record.userId, record.studentId, record.id]
        .map(normalizeIdentifier)
        .some((candidate) => candidate && candidates.has(candidate));
    });

    if (matchedRecord) {
      marksObj[courseId] = matchedRecord;
    }
  });

  return marksObj;
};

export const loadAttendanceByCourseIds = async ({ rtdbBase, courseIds, force = false } = {}) => {
  const normalizedBase = String(rtdbBase || "").trim();
  const normalizedCourseIds = [...new Set((courseIds || []).map(normalizeIdentifier).filter(Boolean))];
  if (!normalizedBase || !normalizedCourseIds.length) {
    return {};
  }

  const cachedAttendance = {};
  const missingCourseIds = [];

  normalizedCourseIds.forEach((courseId) => {
    const cacheKey = `${normalizedBase}::${courseId}`;
    if (!force && attendanceCourseCache.has(cacheKey)) {
      cachedAttendance[courseId] = attendanceCourseCache.get(cacheKey) || {};
      return;
    }
    missingCourseIds.push(courseId);
  });

  if (!missingCourseIds.length) {
    return cachedAttendance;
  }

  const fetchedEntries = await Promise.all(
    missingCourseIds.map(async (courseId) => {
      const courseAttendance = await fetchCachedJson(`${normalizedBase}/Attendance/${encodeURIComponent(courseId)}.json`, {
        ttlMs: ATTENDANCE_TTL_MS,
        fallbackValue: {},
        force,
      });
      return [courseId, courseAttendance || {}];
    })
  );

  const fetchedAttendance = {};
  fetchedEntries.forEach(([courseId, courseAttendance]) => {
    const cacheKey = `${normalizedBase}::${courseId}`;
    attendanceCourseCache.set(cacheKey, courseAttendance || {});
    fetchedAttendance[courseId] = courseAttendance || {};
  });

  return {
    ...cachedAttendance,
    ...fetchedAttendance,
  };
};

export const loadAttendanceForStudent = async ({ rtdbBase, student, courseIds = [], force = false } = {}) => {
  const normalizedCourseIds = [...new Set((courseIds || []).map(normalizeIdentifier).filter(Boolean))];
  if (!normalizedCourseIds.length || !student) {
    return [];
  }

  const selectedStudentIds = new Set(
    [student?.studentId, student?.userId, student?.id]
      .map(normalizeIdentifier)
      .filter(Boolean)
  );

  const attendanceByCourse = await loadAttendanceByCourseIds({
    rtdbBase,
    courseIds: normalizedCourseIds,
    force,
  });

  const normalizedAttendance = [];

  Object.entries(attendanceByCourse || {}).forEach(([courseId, courseAttendance]) => {
    if (!courseAttendance || typeof courseAttendance !== "object") {
      return;
    }

    Object.entries(courseAttendance).forEach(([dateKey, studentsMap]) => {
      if (!studentsMap || typeof studentsMap !== "object") {
        return;
      }

      let record = null;
      for (const studentId of selectedStudentIds) {
        record = studentsMap?.[studentId] || studentsMap?.students?.[studentId] || null;
        if (record) {
          break;
        }
      }

      if (!record) {
        const matchedEntry = Object.values(studentsMap).find((value) => {
          if (!value || typeof value !== "object") {
            return false;
          }

          return [value.userId, value.studentId, value.id]
            .map(normalizeIdentifier)
            .some((candidate) => candidate && selectedStudentIds.has(candidate));
        });
        record = matchedEntry || null;
      }

      if (!record) {
        return;
      }

      let status = "absent";
      let teacherName = "";
      let subject = courseId;

      if (typeof record === "string") {
        status = record;
      } else if (typeof record === "object") {
        status = record.status || record.attendance_status || Object.values(record)[0] || "present";
        teacherName = record.teacherName || record.teacher || record.tutor || "";
        subject = record.subject || courseId;
      }

      normalizedAttendance.push({
        courseId,
        date: dateKey,
        status: String(status).toLowerCase(),
        teacherName,
        subject,
      });
    });
  });

  normalizedAttendance.sort((leftRecord, rightRecord) => new Date(rightRecord.date) - new Date(leftRecord.date));
  return normalizedAttendance;
};

export const buildRegisterTargetRoleOptions = () => [
  "all",
  "student",
  "parent",
  "teacher",
  "registerer",
  "finance",
  "admin",
];

export const fetchConversationSummaries = async ({
  rtdbBase,
  schoolCode,
  currentUserId,
  contactCandidates = [],
  unreadOnly = false,
  limit = 0,
  includeWithoutLastMessage = false,
  force = false,
} = {}) => {
  const normalizedBase = String(rtdbBase || "").trim();
  const normalizedCurrentUserId = normalizeIdentifier(currentUserId);
  const scopedSchoolCode = normalizeIdentifier(schoolCode || extractSchoolCodeFromRtdbBase(normalizedBase));
  if (!normalizedBase || !normalizedCurrentUserId) {
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

  const shallowIndex = await fetchCachedJson(`${normalizedBase}/Chats.json?shallow=true`, {
    ttlMs: CHAT_INDEX_TTL_MS,
    fallbackValue: {},
    force,
  });
  const chatKeySet = new Set(Object.keys(shallowIndex || {}));

  let candidateChatIds = [];
  if (contactHintsByUserId.size) {
    candidateChatIds = [...contactHintsByUserId.keys()]
      .map((contactUserId) => resolveExistingChatKey(chatKeySet, normalizedCurrentUserId, contactUserId))
      .filter(Boolean);

    if (!candidateChatIds.length && contactHintsByUserId.size <= 12) {
      candidateChatIds = [...contactHintsByUserId.keys()]
        .flatMap((contactUserId) => buildChatKeyCandidates(normalizedCurrentUserId, contactUserId))
        .filter(Boolean);
    }
  } else {
    candidateChatIds = [...chatKeySet].filter((chatKey) => chatKeyIncludesUser(chatKey, normalizedCurrentUserId));
  }

  candidateChatIds = [...new Set(candidateChatIds)];
  if (!candidateChatIds.length) {
    return [];
  }

  const rawSummaries = await mapInBatches(candidateChatIds, 10, async (chatId) => {
    const encodedChatId = encodeURIComponent(chatId);
    const [participants, unreadForMeRaw, lastMessage] = await Promise.all([
      fetchCachedJson(`${normalizedBase}/Chats/${encodedChatId}/participants.json`, {
        ttlMs: CHAT_SUMMARY_TTL_MS,
        fallbackValue: {},
        force,
      }),
      fetchCachedJson(`${normalizedBase}/Chats/${encodedChatId}/unread/${encodeURIComponent(normalizedCurrentUserId)}.json`, {
        ttlMs: CHAT_SUMMARY_TTL_MS,
        fallbackValue: 0,
        force,
      }),
      fetchCachedJson(`${normalizedBase}/Chats/${encodedChatId}/lastMessage.json`, {
        ttlMs: CHAT_SUMMARY_TTL_MS,
        fallbackValue: {},
        force,
      }),
    ]);

    const participantIds = parseChatParticipantIds(chatId, participants).filter(
      (participantId) => normalizeIdentifier(participantId) !== normalizedCurrentUserId
    );
    const otherUserId = normalizeIdentifier(participantIds[0]);
    const unreadForMe = Number(unreadForMeRaw || 0);
    const lastMessageTime = getConversationSortTime(
      lastMessage?.timeStamp ||
        lastMessage?.time ||
        lastMessage?.updatedAt ||
        lastMessage?.createdAt ||
        0
    );

    if (!otherUserId && !chatKeyIncludesUser(chatId, normalizedCurrentUserId)) {
      return null;
    }

    if (unreadOnly && unreadForMe <= 0) {
      return null;
    }

    if (!includeWithoutLastMessage && unreadForMe <= 0 && !lastMessageTime) {
      return null;
    }

    return {
      chatId,
      otherUserId,
      unreadForMe,
      lastMessage: isRecordObject(lastMessage) ? lastMessage : {},
      lastMessageText: formatLastMessagePreview(lastMessage),
      lastMessageTime,
    };
  });

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
      const profileImage = getSafeProfileImage(
        userRecord?.profileImage || fallbackContact?.profileImage,
        "/default-profile.png"
      );

      return {
        chatId: summary.chatId,
        contact: {
          userId: summary.otherUserId,
          name: displayName,
          profileImage,
          type:
            fallbackContact?.type ||
            fallbackContact?.tab ||
            inferContactTypeFromUser(userRecord || fallbackContact),
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

  if (Number(limit || 0) > 0) {
    return conversationList.slice(0, Number(limit));
  }

  return conversationList;
};

export const buildConversationSummaryMap = (summaries = []) => {
  return (summaries || []).reduce((result, summary) => {
    const contactUserId = normalizeIdentifier(summary?.contact?.userId || summary?.otherUserId);
    if (!contactUserId) {
      return result;
    }

    result[contactUserId] = summary;
    return result;
  }, {});
};

export const buildUserLookupFromNode = (usersNode = {}) => {
  const byUserId = {};
  Object.entries(usersNode || {}).forEach(([recordKey, userRecord]) => {
    if (!userRecord || typeof userRecord !== "object") {
      return;
    }

    byUserId[recordKey] = userRecord;
    const normalizedUserId = normalizeIdentifier(userRecord?.userId);
    if (normalizedUserId) {
      byUserId[normalizedUserId] = userRecord;
    }
  });

  return byUserId;
};