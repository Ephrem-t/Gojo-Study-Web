import { equalTo, get, orderByChild, query as dbQuery, ref as dbRef } from "firebase/database";
import { db, schoolPath } from "../firebase";
import { RTDB_BASE_RAW } from "../api/rtdbScope";
import { resolveAvatarImage } from "./profileImage";
import {
  buildChatKeyCandidates,
  chatKeyIncludesUser,
  formatLastMessagePreview,
  getConversationSortTime,
  mapInBatches,
  parseChatParticipantIds,
  resolveExistingChatKey,
} from "./chatRtdb";
import { clearCachedJson, fetchCachedJson, readCachedJson, writeCachedJson } from "./rtdbCache";

const USER_RECORD_TTL_MS = 15 * 60 * 1000;
const PARENT_RECORD_TTL_MS = 15 * 60 * 1000;
const STUDENT_QUERY_TTL_MS = 5 * 60 * 1000;
const CHAT_INDEX_TTL_MS = 20 * 1000;
const CHAT_SUMMARY_TTL_MS = 15 * 1000;
const SCHOOL_CODE_TTL_MS = 24 * 60 * 60 * 1000;

const sessionValuePrefix = "teacher_session_cache_v1";
const userRecordCache = new Map();
const parentRecordCache = new Map();
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

const fetchStudentsByGrade = async ({ schoolCode, gradeValue }) => {
  const normalizedGrade = normalizeGrade(gradeValue);
  if (!normalizedGrade) {
    return {};
  }

  const [directGradeSnapshot, nestedGradeSnapshot] = await Promise.all([
    get(
      dbQuery(
        dbRef(db, schoolPath("Students", schoolCode)),
        orderByChild("grade"),
        equalTo(normalizedGrade)
      )
    ).catch(() => null),
    get(
      dbQuery(
        dbRef(db, schoolPath("Students", schoolCode)),
        orderByChild("basicStudentInformation/grade"),
        equalTo(normalizedGrade)
      )
    ).catch(() => null),
  ]);

  return {
    ...(directGradeSnapshot?.exists() ? directGradeSnapshot.val() || {} : {}),
    ...(nestedGradeSnapshot?.exists() ? nestedGradeSnapshot.val() || {} : {}),
  };
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

    const gradeNode = await fetchStudentsByGrade({ schoolCode: scopedSchoolCode, gradeValue });
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

      return {
        ...row,
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

  const shallowIndex = await fetchCachedJson(`${normalizedBase}/Chats.json?shallow=true`, {
    ttlMs: CHAT_INDEX_TTL_MS,
    fallbackValue: {},
    force,
  });
  const chatKeySet = new Set(Object.keys(shallowIndex || {}));

  let candidateChatIds = [];
  if (contactHintsByUserId.size) {
    candidateChatIds = [...contactHintsByUserId.keys()]
      .map((contactUserId) => resolveExistingChatKey(chatKeySet, normalizedTeacherUserId, contactUserId))
      .filter(Boolean);

    if (!candidateChatIds.length && contactHintsByUserId.size <= 12) {
      candidateChatIds = [...contactHintsByUserId.keys()]
        .flatMap((contactUserId) => buildChatKeyCandidates(normalizedTeacherUserId, contactUserId))
        .filter(Boolean);
    }
  } else {
    candidateChatIds = [...chatKeySet].filter((chatKey) => chatKeyIncludesUser(chatKey, normalizedTeacherUserId));
  }

  candidateChatIds = [...new Set(candidateChatIds)];
  if (!candidateChatIds.length) {
    return [];
  }

  const rawSummaries = await mapInBatches(candidateChatIds, 10, async (chatId) => {
    const [participants, unreadForMeRaw, lastMessage] = await Promise.all([
      fetchCachedJson(`${normalizedBase}/Chats/${encodeURIComponent(chatId)}/participants.json`, {
        ttlMs: CHAT_SUMMARY_TTL_MS,
        fallbackValue: {},
        force,
      }),
      fetchCachedJson(`${normalizedBase}/Chats/${encodeURIComponent(chatId)}/unread/${encodeURIComponent(normalizedTeacherUserId)}.json`, {
        ttlMs: CHAT_SUMMARY_TTL_MS,
        fallbackValue: 0,
        force,
      }),
      fetchCachedJson(`${normalizedBase}/Chats/${encodeURIComponent(chatId)}/lastMessage.json`, {
        ttlMs: CHAT_SUMMARY_TTL_MS,
        fallbackValue: {},
        force,
      }),
    ]);

    const participantIds = parseChatParticipantIds(chatId, participants).filter(
      (participantId) => normalizeIdentifier(participantId) !== normalizedTeacherUserId
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

    if (!otherUserId && !chatKeyIncludesUser(chatId, normalizedTeacherUserId)) {
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

  clearCachedJson(`${normalizedBase}/Chats.json?shallow=true`);
  clearCachedJson(`${normalizedBase}/Chats/${encodeURIComponent(normalizedChatId)}/participants.json`);
  clearCachedJson(`${normalizedBase}/Chats/${encodeURIComponent(normalizedChatId)}/lastMessage.json`);
  if (normalizedTeacherUserId) {
    clearCachedJson(`${normalizedBase}/Chats/${encodeURIComponent(normalizedChatId)}/unread/${encodeURIComponent(normalizedTeacherUserId)}.json`);
  }
};