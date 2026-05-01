import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import "../styles/global.css";
import { AiFillPicture, AiFillVideoCamera } from "react-icons/ai";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaBell, FaFacebookMessenger, FaCalendarAlt, FaPlus, FaThumbsUp, FaHeart, FaRegHeart } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { BACKEND_BASE, FIREBASE_DATABASE_URL } from "../config.js";
import EthiopicCalendar from "ethiopic-calendar";
import ProfileAvatar from "../components/ProfileAvatar";
import { formatFileSize, optimizePostMedia } from "../utils/postMedia";

const ETHIOPIAN_MONTHS = [
  "Meskerem",
  "Tikimt",
  "Hidar",
  "Tahsas",
  "Tir",
  "Yekatit",
  "Megabit",
  "Miyazya",
  "Ginbot",
  "Sene",
  "Hamle",
  "Nehase",
  "Pagume",
];

const CALENDAR_WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_PROFILE_IMAGE = "/default-profile.png";
const DEFAULT_TARGET_ROLE_OPTIONS = ["all", "student", "parent", "teacher", "registerer", "finance", "hr", "admin"];
const SCHOOL_SCOPE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CALENDAR_EVENTS_CACHE_TTL_MS = 5 * 60 * 1000;
const POSTS_CACHE_TTL_MS = 10 * 60 * 1000;
const DASHBOARD_POST_FETCH_LIMIT = 60;
const DASHBOARD_POST_CACHE_LIMIT = 60;

const DEFAULT_ETHIOPIAN_SPECIAL_DAYS = [
  { month: 1, day: 1, title: "Enkutatash", notes: "Ethiopian New Year." },
  { month: 1, day: 17, title: "Meskel", notes: "Finding of the True Cross." },
  { month: 4, day: 29, title: "Genna", notes: "Ethiopian Christmas." },
  { month: 5, day: 11, title: "Timkat", notes: "Epiphany celebration." },
  { month: 6, day: 23, title: "Adwa Victory Day", notes: "National remembrance day." },
  { month: 8, day: 23, title: "International Labour Day", notes: "Public holiday." },
  { month: 9, day: 1, title: "Patriots' Victory Day", notes: "Public holiday." },
  { month: 9, day: 20, title: "Downfall of the Derg", notes: "National public holiday." },
];

const YEAR_SPECIFIC_GOVERNMENT_CLOSURES_GREGORIAN = {
  2017: [
    { date: "2025-03-31", title: "Eid al-Fitr", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2025-06-06", title: "Eid al-Adha", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2025-09-05", title: "Mawlid", notes: "Government holiday (may vary by moon sighting)." },
  ],
  2018: [
    { date: "2026-03-20", title: "Eid al-Fitr", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2026-05-27", title: "Eid al-Adha", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2026-08-26", title: "Mawlid", notes: "Government holiday (may vary by moon sighting)." },
  ],
  2019: [
    { date: "2027-03-10", title: "Eid al-Fitr", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2027-05-17", title: "Eid al-Adha", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2027-08-15", title: "Mawlid", notes: "Government holiday (may vary by moon sighting)." },
  ],
  2020: [
    { date: "2028-02-27", title: "Eid al-Fitr", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2028-05-05", title: "Eid al-Adha", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2028-08-04", title: "Mawlid", notes: "Government holiday (may vary by moon sighting)." },
  ],
  2021: [
    { date: "2029-02-14", title: "Eid al-Fitr", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2029-04-24", title: "Eid al-Adha", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2029-07-24", title: "Mawlid", notes: "Government holiday (may vary by moon sighting)." },
  ],
  2022: [
    { date: "2030-02-03", title: "Eid al-Fitr", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2030-04-13", title: "Eid al-Adha", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2030-07-13", title: "Mawlid", notes: "Government holiday (may vary by moon sighting)." },
  ],
  2023: [
    { date: "2031-01-23", title: "Eid al-Fitr", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2031-04-02", title: "Eid al-Adha", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2031-07-02", title: "Mawlid", notes: "Government holiday (may vary by moon sighting)." },
  ],
  2024: [
    { date: "2032-01-11", title: "Eid al-Fitr", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2032-03-21", title: "Eid al-Adha", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2032-06-20", title: "Mawlid", notes: "Government holiday (may vary by moon sighting)." },
  ],
  2025: [
    { date: "2032-12-31", title: "Eid al-Fitr", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2033-03-10", title: "Eid al-Adha", notes: "Government holiday (may vary by moon sighting)." },
    { date: "2033-06-09", title: "Mawlid", notes: "Government holiday (may vary by moon sighting)." },
  ],
};

function buildYearSpecificGovernmentClosures(ethiopianYear) {
  const gregorianEvents = YEAR_SPECIFIC_GOVERNMENT_CLOSURES_GREGORIAN[ethiopianYear] || [];
  return gregorianEvents.map((eventItem) => {
    const [year, month, day] = eventItem.date.split("-").map(Number);
    if (!year || !month || !day) return null;

    const ethDate = EthiopicCalendar.ge(year, month, day);
    if (ethDate.year !== ethiopianYear) return null;

    return {
      month: ethDate.month,
      day: ethDate.day,
      title: eventItem.title,
      notes: eventItem.notes,
    };
  }).filter(Boolean);
}

function getOrthodoxEasterDate(gregorianYear) {
  const a = gregorianYear % 4;
  const b = gregorianYear % 7;
  const c = gregorianYear % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const julianMonth = Math.floor((d + e + 114) / 31);
  const julianDay = ((d + e + 114) % 31) + 1;
  const julianDateAsGregorian = new Date(gregorianYear, julianMonth - 1, julianDay);
  julianDateAsGregorian.setDate(julianDateAsGregorian.getDate() + 13);
  return julianDateAsGregorian;
}

function buildMovableOrthodoxClosures(ethiopianYear) {
  const movableEvents = [];
  const seenEventKeys = new Set();

  [ethiopianYear + 7, ethiopianYear + 8].forEach((gregorianYear) => {
    const easterDate = getOrthodoxEasterDate(gregorianYear);
    const goodFridayDate = new Date(easterDate);
    goodFridayDate.setDate(goodFridayDate.getDate() - 2);

    [
      { title: "Siklet (Good Friday)", notes: "Orthodox movable feast.", date: goodFridayDate },
      { title: "Fasika (Easter)", notes: "Orthodox movable feast.", date: easterDate },
    ].forEach((eventItem) => {
      const ethDate = EthiopicCalendar.ge(
        eventItem.date.getFullYear(),
        eventItem.date.getMonth() + 1,
        eventItem.date.getDate()
      );

      if (ethDate.year !== ethiopianYear) return;

      const eventKey = `${ethDate.year}-${ethDate.month}-${ethDate.day}-${eventItem.title}`;
      if (seenEventKeys.has(eventKey)) return;

      seenEventKeys.add(eventKey);
      movableEvents.push({
        month: ethDate.month,
        day: ethDate.day,
        title: eventItem.title,
        notes: eventItem.notes,
      });
    });
  });

  return movableEvents;
}

const CALENDAR_EVENT_META = {
  academic: {
    label: "Academic",
    color: "var(--success)",
    background: "var(--success-soft)",
    border: "var(--success-border)",
    category: "academic",
    subType: "general",
  },
  "no-class": {
    label: "No class",
    color: "var(--warning)",
    background: "var(--warning-soft)",
    border: "var(--warning-border)",
    category: "no-class",
    subType: "general",
  },
};

const getCalendarEventKey = (category) => {
  if (category === "academic") {
    return "academic";
  }

  return "no-class";
};

const getCalendarEventMeta = (category) => {
  const eventKey = getCalendarEventKey(category);
  return CALENDAR_EVENT_META[eventKey] || CALENDAR_EVENT_META.academic;
};

const buildDefaultCalendarEvents = (ethiopianYear) => {
  const allEvents = [
    ...DEFAULT_ETHIOPIAN_SPECIAL_DAYS,
    ...buildMovableOrthodoxClosures(ethiopianYear),
    ...buildYearSpecificGovernmentClosures(ethiopianYear),
  ];
  return allEvents.map((eventItem) => {
    const gregorianDate = EthiopicCalendar.eg(ethiopianYear, eventItem.month, eventItem.day);
    const isoDate = `${gregorianDate.year}-${String(gregorianDate.month).padStart(2, "0")}-${String(gregorianDate.day).padStart(2, "0")}`;
    return {
      id: `default-${ethiopianYear}-${eventItem.month}-${eventItem.day}`,
      title: eventItem.title,
      type: "no-class",
      category: "no-class",
      subType: "general",
      notes: eventItem.notes,
      gregorianDate: isoDate,
      ethiopianDate: {
        year: ethiopianYear,
        month: eventItem.month,
        day: eventItem.day,
      },
      createdAt: "",
      createdBy: "system-default",
      isDefault: true,
    };
  });
};

const normalizePostLikes = (likes) => {
  if (Array.isArray(likes)) {
    return likes.reduce((accumulator, value) => {
      const normalizedValue = String(value || "").trim();
      if (normalizedValue) {
        accumulator[normalizedValue] = true;
      }
      return accumulator;
    }, {});
  }

  if (likes && typeof likes === "object") {
    return Object.entries(likes).reduce((accumulator, [key, value]) => {
      const normalizedKey = String(key || "").trim();
      if (normalizedKey && value) {
        accumulator[normalizedKey] = true;
      }
      return accumulator;
    }, {});
  }

  return {};
};

const isPostLikedByActor = (post, actorId) => {
  const normalizedActorId = String(actorId || "").trim();
  if (!normalizedActorId) {
    return false;
  }

  return Boolean(normalizePostLikes(post?.likes)[normalizedActorId]);
};

const getResolvedLikeCount = (post) => {
  const explicitCount = Number(post?.likeCount);
  if (Number.isFinite(explicitCount) && explicitCount >= 0) {
    return explicitCount;
  }

  return Object.keys(normalizePostLikes(post?.likes)).length;
};

const getConversationSortTime = (rawValue) => {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === "string") {
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      return 0;
    }

    const numericValue = Number(trimmedValue);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }

    const parsedTime = new Date(trimmedValue).getTime();
    if (!Number.isNaN(parsedTime)) {
      return parsedTime;
    }
  }

  return 0;
};

const formatPostTimestamp = (timestamp) => {
  if (!timestamp) return "Recent update";

  const parsedDate = new Date(timestamp);
  if (Number.isNaN(parsedDate.getTime())) return "Recent update";

  const diffInMinutes = Math.max(0, Math.floor((Date.now() - parsedDate.getTime()) / 60000));
  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d`;

  const dateOptions = parsedDate.getFullYear() === new Date().getFullYear()
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" };

  return parsedDate.toLocaleDateString("en-US", dateOptions);
};

const hasConversationUserSentMessage = (chatValue, userId) => {
  const normalizedUserId = String(userId || "").trim();
  if (!chatValue || !normalizedUserId) {
    return false;
  }

  if (String(chatValue?.lastMessage?.senderId || "").trim() === normalizedUserId) {
    return true;
  }

  const messages = chatValue?.messages;
  if (!messages || typeof messages !== "object") {
    return false;
  }

  return Object.values(messages).some(
    (messageValue) => String(messageValue?.senderId || "").trim() === normalizedUserId
  );
};

const normalizeConversationContactType = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (normalizedValue === "teacher" || normalizedValue === "teachers") {
    return "teacher";
  }

  if (normalizedValue === "student" || normalizedValue === "students") {
    return "student";
  }

  if (normalizedValue === "parent" || normalizedValue === "parents") {
    return "parent";
  }

  if (
    normalizedValue === "management" ||
    normalizedValue === "managements" ||
    normalizedValue === "office" ||
    normalizedValue === "offices" ||
    normalizedValue === "hr" ||
    normalizedValue === "finance" ||
    normalizedValue === "registerer" ||
    normalizedValue === "registerers" ||
    normalizedValue === "registrar"
  ) {
    return "management";
  }

  return "";
};

const formatAudienceLabel = (value) =>
  String(value || "")
    .split(/[\s,|]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      part
        .replace(/_/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    )
    .join(", ");

const normalizeCalendarEvent = (eventId, eventValue) => {
  const legacyType = eventValue?.type || "academic";
  const category = eventValue?.category || (legacyType === "academic" ? "academic" : "no-class");
  const eventMeta = getCalendarEventMeta(category);

  return {
    id: eventId,
    title: eventValue?.title || eventMeta.label,
    type: getCalendarEventKey(category),
    category,
    subType: "general",
    notes: eventValue?.notes || "",
    gregorianDate: eventValue?.gregorianDate || "",
    ethiopianDate: eventValue?.ethiopianDate || null,
    createdAt: eventValue?.createdAt || "",
    createdBy: eventValue?.createdBy || "",
    showInUpcomingDeadlines: Boolean(eventValue?.showInUpcomingDeadlines),
    isDefault: false,
  };
};

const CALENDAR_MANAGER_ROLES = new Set(["registrar", "registerer", "admin", "admins", "school_admin", "school_admins", "finance"]);

const sortCalendarEvents = (events) => [...events].sort((leftEvent, rightEvent) => {
  const dateComparison = String(leftEvent.gregorianDate || "").localeCompare(String(rightEvent.gregorianDate || ""));
  if (dateComparison !== 0) {
    return dateComparison;
  }

  return String(leftEvent.createdAt || "").localeCompare(String(rightEvent.createdAt || ""));
});

const formatCalendarDeadlineDate = (isoDate) => {
  if (!isoDate) {
    return "";
  }

  const parsedDate = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDate;
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const uniqueNonEmptyValues = (values) => {
  const seen = new Set();
  const normalizedValues = [];

  values.forEach((value) => {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue || seen.has(normalizedValue)) {
      return;
    }

    seen.add(normalizedValue);
    normalizedValues.push(normalizedValue);
  });

  return normalizedValues;
};

const getSchoolScopeAliasCodes = (values) =>
  uniqueNonEmptyValues(
    values.flatMap((value) => {
      const normalizedValue = String(value || "").trim();
      if (!normalizedValue) {
        return [];
      }

      const segments = normalizedValue.split("-").filter(Boolean);
      const lastSegment = segments.length > 1 ? segments[segments.length - 1] : "";
      return uniqueNonEmptyValues([normalizedValue, lastSegment]);
    })
  );

const getSchoolScopeStorageKey = (seedCode) =>
  `dashboard_school_scope_cache_${String(seedCode || "").trim().toLowerCase()}`;

const readCachedSchoolScopeCandidates = (seedCodes) => {
  const now = Date.now();

  return uniqueNonEmptyValues(
    getSchoolScopeAliasCodes(seedCodes).flatMap((seedCode) => {
      try {
        const rawCache = localStorage.getItem(getSchoolScopeStorageKey(seedCode));
        if (!rawCache) {
          return [];
        }

        const parsedCache = JSON.parse(rawCache);
        if (
          !parsedCache ||
          !Array.isArray(parsedCache.candidates) ||
          Number(parsedCache.expiresAt || 0) <= now
        ) {
          localStorage.removeItem(getSchoolScopeStorageKey(seedCode));
          return [];
        }

        return parsedCache.candidates;
      } catch (error) {
        return [];
      }
    })
  );
};

const writeCachedSchoolScopeCandidates = (seedCodes, candidates) => {
  const payload = JSON.stringify({
    candidates: uniqueNonEmptyValues(candidates),
    expiresAt: Date.now() + SCHOOL_SCOPE_CACHE_TTL_MS,
  });

  getSchoolScopeAliasCodes([...seedCodes, ...candidates]).forEach((seedCode) => {
    try {
      localStorage.setItem(getSchoolScopeStorageKey(seedCode), payload);
    } catch (error) {
      // Ignore localStorage write issues.
    }
  });
};

const getCalendarEventsStorageKey = (schoolScopeCode) =>
  `dashboard_calendar_events_cache_${String(schoolScopeCode || "").trim().toLowerCase()}`;

const readCachedCalendarEvents = (schoolScopeCode) => {
  const normalizedSchoolScopeCode = String(schoolScopeCode || "").trim();
  if (!normalizedSchoolScopeCode) {
    return { events: [], isFresh: false };
  }

  try {
    const rawCache = localStorage.getItem(getCalendarEventsStorageKey(normalizedSchoolScopeCode));
    if (!rawCache) {
      return { events: [], isFresh: false };
    }

    const parsedCache = JSON.parse(rawCache);
    if (!parsedCache || !Array.isArray(parsedCache.events)) {
      return { events: [], isFresh: false };
    }

    const isFresh = Number(parsedCache.expiresAt || 0) > Date.now();
    return {
      events: parsedCache.events,
      isFresh,
    };
  } catch (error) {
    return { events: [], isFresh: false };
  }
};

const writeCachedCalendarEvents = (schoolScopeCode, events) => {
  const normalizedSchoolScopeCode = String(schoolScopeCode || "").trim();
  if (!normalizedSchoolScopeCode) {
    return;
  }

  try {
    localStorage.setItem(
      getCalendarEventsStorageKey(normalizedSchoolScopeCode),
      JSON.stringify({
        events,
        expiresAt: Date.now() + CALENDAR_EVENTS_CACHE_TTL_MS,
      })
    );
  } catch (error) {
    // Ignore localStorage write issues.
  }
};

const pickFirstNonEmpty = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }

    const normalizedValue = String(value).trim();
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return "";
};

const isActiveEntity = (record) => {
  if (!record || typeof record !== "object") {
    return false;
  }

  if (record.isActive === false || record.deactivated || record.terminated) {
    return false;
  }

  const status = String(
    record.status ||
    record.employment?.status ||
    record.job?.status ||
    ""
  ).trim().toLowerCase();

  return status !== "inactive" && status !== "terminated";
};

const mergeUniquePosts = (...collections) => {
  const seenPostKeys = new Set();
  const mergedPosts = [];

  collections.flat().forEach((postItem, index) => {
    if (!postItem || typeof postItem !== "object") {
      return;
    }

    const postId = String(postItem.postId || postItem.id || "").trim();
    const fallbackKey = [
      postItem.userId || postItem.adminId || "anonymous",
      postItem.time || postItem.createdAt || `index-${index}`,
      postItem.message || postItem.postUrl || "",
    ].join("|");
    const uniqueKey = postId || fallbackKey;

    if (seenPostKeys.has(uniqueKey)) {
      return;
    }

    seenPostKeys.add(uniqueKey);
    mergedPosts.push({
      ...postItem,
      postId: postId || uniqueKey,
    });
  });

  return mergedPosts;
};

function Dashboard() {
  const PRIMARY = "#007AFB";
  const BACKGROUND = "#FFFFFF";
  const ACCENT = "#00B6A9";
  const API_BASE = `${BACKEND_BASE}/api`;
  const DB_URL = FIREBASE_DATABASE_URL;
  // ---------------- STATE ----------------
  const _storedAdmin = (() => {
    try {
      return JSON.parse(localStorage.getItem("admin")) || {};
    } catch (e) {
      return {};
    }
  })();
  const hasStoredAdminSession = Boolean(_storedAdmin.userId || _storedAdmin.adminId);
  const readStoredPostsCache = (schoolCodeValue) => {
    if (!schoolCodeValue) {
      return [];
    }

    try {
      const rawCache = localStorage.getItem(`dashboard_posts_cache_${schoolCodeValue}`);
      if (!rawCache) {
        return [];
      }

      const parsedCache = JSON.parse(rawCache);
      if (Array.isArray(parsedCache)) {
        return parsedCache.filter((postItem) => postItem && typeof postItem === "object");
      }

      if (!parsedCache || !Array.isArray(parsedCache.posts)) {
        return [];
      }

      return parsedCache.posts.filter((postItem) => postItem && typeof postItem === "object");
    } catch (error) {
      return [];
    }
  };
  const initialSchoolCode = _storedAdmin.schoolCode || "";
  const initialCachedPosts = readStoredPostsCache(initialSchoolCode);

  const [admin, setAdmin] = useState({
    adminId: _storedAdmin.adminId || "",
    userId: _storedAdmin.userId || _storedAdmin.userId || "",
    schoolCode: _storedAdmin.schoolCode || "",
    name: _storedAdmin.name || _storedAdmin.username || "Admin",
    username: _storedAdmin.username || "",
    role: _storedAdmin.role || _storedAdmin.userType || "admin",
    profileImage: _storedAdmin.profileImage || "/default-profile.png",
    isActive: _storedAdmin.isActive || false,
  });

  const [resolvedSchoolScopeCode, setResolvedSchoolScopeCode] = useState(() =>
    String(_storedAdmin.schoolCode || "").trim()
  );
  const schoolCode = admin.schoolCode || _storedAdmin.schoolCode || "";
  const schoolScopeCode = resolvedSchoolScopeCode || schoolCode;
  const DB_ROOT = schoolScopeCode ? `${DB_URL}/Platform1/Schools/${encodeURIComponent(schoolScopeCode)}` : DB_URL;
  const getSafeImageUrl = (value, fallback = DEFAULT_PROFILE_IMAGE) => {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) {
      return fallback;
    }

    const lowerValue = normalizedValue.toLowerCase();
    if (
      lowerValue === "null" ||
      lowerValue === "undefined" ||
      lowerValue.startsWith("file://") ||
      lowerValue.startsWith("content://")
    ) {
      return fallback;
    }

    return normalizedValue;
  };

  const getSafeMediaUrl = (value) => {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) {
      return "";
    }

    const lowerValue = normalizedValue.toLowerCase();
    if (
      lowerValue === "null" ||
      lowerValue === "undefined" ||
      lowerValue.startsWith("file://") ||
      lowerValue.startsWith("content://")
    ) {
      return "";
    }

    return normalizedValue;
  };

  const resolveSchoolScopeCandidates = async (preferredCode) => {
    const seedCodes = getSchoolScopeAliasCodes([
      preferredCode,
      admin.schoolCode,
      _storedAdmin.schoolCode,
    ]);
    const cacheKey = seedCodes.join("|") || "__default__";
    const cachedCandidates = schoolScopeCacheRef.current.get(cacheKey);
    if (cachedCandidates) {
      return cachedCandidates;
    }

    const persistedCandidates = readCachedSchoolScopeCandidates(seedCodes);
    if (persistedCandidates.length > 0) {
      schoolScopeCacheRef.current.set(cacheKey, persistedCandidates);
      return persistedCandidates;
    }

    const fullSchoolCodeCandidates = seedCodes.filter((value) => String(value || "").includes("-"));
    if (fullSchoolCodeCandidates.length > 0) {
      const directCandidates = getSchoolScopeAliasCodes(fullSchoolCodeCandidates);
      schoolScopeCacheRef.current.set(cacheKey, directCandidates);
      writeCachedSchoolScopeCandidates(seedCodes, directCandidates);
      return directCandidates;
    }

    const pendingLookup = schoolScopePromiseCacheRef.current.get(cacheKey);
    if (pendingLookup) {
      return pendingLookup;
    }

    const lookupPromise = (async () => {
      const resolvedCandidates = [...seedCodes];
      const seedSet = new Set(seedCodes.map((value) => value.toLowerCase()));

      try {
        const schoolsRes = await axios.get(`${API_BASE}/schools`, { timeout: 3500 });
        const schools = Array.isArray(schoolsRes.data?.schools) ? schoolsRes.data.schools : [];

        schools.forEach((school) => {
          const code = String(school?.code || "").trim();
          const shortName = String(school?.shortName || "").trim();

          if (
            (code && seedSet.has(code.toLowerCase())) ||
            (shortName && seedSet.has(shortName.toLowerCase()))
          ) {
            resolvedCandidates.push(code, shortName);
          }
        });
      } catch (error) {
        // Ignore school-option lookup failures and continue with stored values.
      }

      try {
        const schoolIndexRes = await axios.get(`${DB_URL}/Platform1/Schools.json`, {
          params: { shallow: true },
          timeout: 3500,
        });
        const schoolKeys = Object.keys(schoolIndexRes.data || {});
        const normalizedSeedValues = Array.from(seedSet);

        schoolKeys.forEach((schoolKey) => {
          const normalizedKey = String(schoolKey || "").trim().toLowerCase();
          if (!normalizedKey) {
            return;
          }

          const matchesSeed = normalizedSeedValues.some(
            (seedValue) =>
              normalizedKey === seedValue ||
              normalizedKey.endsWith(`-${seedValue}`) ||
              normalizedKey.startsWith(`${seedValue}-`) ||
              normalizedKey.includes(`-${seedValue}-`)
          );

          if (matchesSeed) {
            resolvedCandidates.push(schoolKey);
          }
        });

        if (schoolKeys.length > 0 && schoolKeys.length <= 60) {
          const schoolInfoResponses = await Promise.all(
            schoolKeys.map((schoolKey) =>
              axios
                .get(`${DB_URL}/Platform1/Schools/${encodeURIComponent(schoolKey)}/schoolInfo.json`, {
                  timeout: 3500,
                })
                .then((response) => ({ schoolKey, schoolInfo: response.data }))
                .catch(() => ({ schoolKey, schoolInfo: null }))
            )
          );

          schoolInfoResponses.forEach(({ schoolKey, schoolInfo }) => {
            const aliases = uniqueNonEmptyValues([
              schoolKey,
              schoolInfo?.schoolCode,
              schoolInfo?.shortName,
            ]);

            if (
              aliases.some((alias) => seedSet.has(String(alias || "").trim().toLowerCase()))
            ) {
              resolvedCandidates.push(...aliases);
            }
          });
        }
      } catch (error) {
        // Ignore direct Firebase school-index lookup failures and continue with stored values.
      }

      const finalCandidates = uniqueNonEmptyValues(resolvedCandidates);
      schoolScopeCacheRef.current.set(cacheKey, finalCandidates);
      writeCachedSchoolScopeCandidates(seedCodes, finalCandidates);
      return finalCandidates;
    })();

    schoolScopePromiseCacheRef.current.set(cacheKey, lookupPromise);

    try {
      return await lookupPromise;
    } finally {
      schoolScopePromiseCacheRef.current.delete(cacheKey);
    }
  };

  const pickPreferredSchoolScopeCode = (candidateCodes) => {
    const normalizedCandidates = uniqueNonEmptyValues(candidateCodes);
    return (
      normalizedCandidates.find((candidateCode) => String(candidateCode || "").toUpperCase().startsWith("ET-")) ||
      normalizedCandidates.find((candidateCode) => String(candidateCode || "").includes("-")) ||
      normalizedCandidates[0] ||
      ""
    );
  };

  const buildSchoolDbRoots = (candidateCodes) =>
    uniqueNonEmptyValues(candidateCodes).map(
      (candidateCode) => `${DB_URL}/Platform1/Schools/${candidateCode}`
    );

  const readMergedSchoolNode = async (candidateCodes, nodeName, fallbackValue = {}) => {
    const schoolDbRoots = buildSchoolDbRoots(candidateCodes);
    const candidateResponses = await Promise.all(
      schoolDbRoots.map((schoolDbRoot) =>
        axios
          .get(`${schoolDbRoot}/${nodeName}.json`, { timeout: 3500 })
          .then((response) => response.data)
          .catch(() => fallbackValue)
      )
    );

    const mergedCandidateNode = candidateResponses.reduce((accumulator, nodeValue) => {
      if (nodeValue && typeof nodeValue === "object" && !Array.isArray(nodeValue)) {
        Object.assign(accumulator, nodeValue);
      }
      return accumulator;
    }, {});

    if (Object.keys(mergedCandidateNode).length > 0) {
      return mergedCandidateNode;
    }

    const legacyNode = await axios
      .get(`${DB_URL}/${nodeName}.json`, { timeout: 3500 })
      .then((response) => response.data)
      .catch(() => fallbackValue);

    if (legacyNode && typeof legacyNode === "object" && !Array.isArray(legacyNode)) {
      return legacyNode;
    }

    return fallbackValue;
  };

  const [posts, setPosts] = useState(initialCachedPosts);
  const [postsLoading, setPostsLoading] = useState(initialCachedPosts.length === 0 && Boolean(initialSchoolCode));
  const [postsInitialized, setPostsInitialized] = useState(initialCachedPosts.length > 0);
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);
  const [postMediaMeta, setPostMediaMeta] = useState(null);
  const [isOptimizingMedia, setIsOptimizingMedia] = useState(false);
  const [targetRole, setTargetRole] = useState("all");
  const [targetOptions, setTargetOptions] = useState(DEFAULT_TARGET_ROLE_OPTIONS);
  const [likePendingPostIds, setLikePendingPostIds] = useState({});
  const fileInputRef = useRef(null);
  const postsFetchRequestIdRef = useRef(0);
  const schoolScopeCacheRef = useRef(new Map());
  const schoolScopePromiseCacheRef = useRef(new Map());

  const [unreadMessages, setUnreadMessages] = useState([]);
  const [showMessengerDropdown, setShowMessengerDropdown] = useState(false);

  const [teachers, setTeachers] = useState([]);
  const [unreadTeachers, setUnreadTeachers] = useState({});
  const [popupMessages, setPopupMessages] = useState([]);
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [expandedPostDescriptions, setExpandedPostDescriptions] = useState({});
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  // All unread messages from any sender type
  // Correct order
  const location = useLocation();
  const scrollToPostId = location.state?.scrollToPostId;
  const postIdToScroll = location.state?.postId;
  const postId = location.state?.postId;

  const [currentChat, setCurrentChat] = useState([]);
  const [loadingAdmin, setLoadingAdmin] = useState(!hasStoredAdminSession);
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const now = new Date();
    const currentEthiopicDate = EthiopicCalendar.ge(now.getFullYear(), now.getMonth() + 1, now.getDate());

    return {
      year: currentEthiopicDate.year,
      month: currentEthiopicDate.month,
    };
  });
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarEventsLoading, setCalendarEventsLoading] = useState(false);
  const [calendarEventForm, setCalendarEventForm] = useState({
    title: "",
    category: "no-class",
    subType: "general",
    notes: "",
  });
  const [calendarEventSaving, setCalendarEventSaving] = useState(false);
  const [selectedCalendarIsoDate, setSelectedCalendarIsoDate] = useState("");
  const [editingCalendarEventId, setEditingCalendarEventId] = useState("");
  const [calendarActionMessage, setCalendarActionMessage] = useState("");
  const [showCalendarEventModal, setShowCalendarEventModal] = useState(false);
  const [hoveredCalendarIsoDate, setHoveredCalendarIsoDate] = useState("");
  const [calendarModalContext, setCalendarModalContext] = useState("calendar");
  const [showAllUpcomingDeadlines, setShowAllUpcomingDeadlines] = useState(false);

  const adminUserId = admin.userId;
  const currentCalendarRole = String(admin.role || _storedAdmin.role || _storedAdmin.userType || "admin").trim().toLowerCase().replace(/-/g, "_");
  const canManageCalendar = CALENDAR_MANAGER_ROLES.has(currentCalendarRole);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [unreadPostList, setUnreadPostList] = useState([]);
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postSubmitError, setPostSubmitError] = useState("");
  const currentLikeActorId = admin.userId || admin.adminId || "";

  const navigate = useNavigate();
  const shouldShowPostsLoadingState = (postsLoading || !postsInitialized) && posts.length === 0;

  useEffect(() => {
    let isCancelled = false;

    const syncResolvedSchoolScopeCode = async () => {
      const seedCode = schoolCode || admin.schoolCode || _storedAdmin.schoolCode || "";
      if (!seedCode) {
        if (!isCancelled) {
          setResolvedSchoolScopeCode("");
        }
        return;
      }

      const candidateCodes = await resolveSchoolScopeCandidates(seedCode);
      const preferredSchoolScopeCode = pickPreferredSchoolScopeCode(candidateCodes) || seedCode;

      if (!isCancelled) {
        setResolvedSchoolScopeCode(preferredSchoolScopeCode);
      }
    };

    syncResolvedSchoolScopeCode();

    return () => {
      isCancelled = true;
    };
  }, [schoolCode]);

  const shouldShowPostSeeMore = (message = "") => {
    const normalizedMessage = String(message || "").trim();
    if (!normalizedMessage) {
      return false;
    }

    const sentenceCount = normalizedMessage
      .split(/[.!?]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .length;
    const lineCount = normalizedMessage.split(/\r?\n/).filter(Boolean).length;

    return normalizedMessage.length > 180 || sentenceCount > 2 || lineCount > 2;
  };

  const updateCachedPostEntries = (postIdValue, updater) => {
    uniqueNonEmptyValues([
      resolvedSchoolScopeCode,
      schoolScopeCode,
      schoolCode,
      admin.schoolCode,
      _storedAdmin.schoolCode,
    ]).forEach((schoolCodeValue) => {
      try {
        const cacheKey = `dashboard_posts_cache_${schoolCodeValue}`;
        const rawCache = localStorage.getItem(cacheKey);
        if (!rawCache) {
          return;
        }

        const parsedCache = JSON.parse(rawCache);
        const cachedPosts = Array.isArray(parsedCache)
          ? parsedCache
          : Array.isArray(parsedCache?.posts)
            ? parsedCache.posts
            : [];

        if (cachedPosts.length === 0) {
          return;
        }

        const nextCachedPosts = cachedPosts.map((postItem) =>
          String(postItem?.postId || "") === String(postIdValue || "")
            ? updater(postItem)
            : postItem
        );

        localStorage.setItem(cacheKey, JSON.stringify({
          posts: nextCachedPosts.slice(0, DASHBOARD_POST_CACHE_LIMIT),
          expiresAt: Date.now() + POSTS_CACHE_TTL_MS,
        }));
      } catch (error) {
        // Ignore cache sync issues.
      }
    });
  };

  const togglePostDescription = (postIdValue) => {
    setExpandedPostDescriptions((prev) => ({
      ...prev,
      [postIdValue]: !prev[postIdValue],
    }));
  };

  useEffect(() => {
    if (postId) {
      const element = document.getElementById(`post-${postId}`);
      if (element) element.scrollIntoView({ behavior: "smooth" });
    }
  }, [postId]);

  // ---------------- HELPER: LOAD ADMIN FROM LOCALSTORAGE ----------------
  const loadAdminFromStorage = async () => {
    const storedAdmin = localStorage.getItem("admin");

    if (!storedAdmin) {
      setLoadingAdmin(false);
      return;
    }

    try {
      const adminData = JSON.parse(storedAdmin);
      setAdmin({
        adminId: adminData.adminId || "",
        userId: adminData.userId || adminData.adminId || "",
        schoolCode: adminData.schoolCode || "",
        name: adminData.name || adminData.username || "Admin",
        username: adminData.username || "",
        role: adminData.role || adminData.userType || "admin",
        profileImage: adminData.profileImage || "/default-profile.png",
        isActive: adminData.isActive || false,
      });

      const lookupId = adminData.userId || adminData.adminId;
      if (!lookupId) {
        localStorage.removeItem("admin");
        setLoadingAdmin(false);
        return;
      }

      setLoadingAdmin(false);

      const profileRes = await axios.get(`${API_BASE}/admin/${lookupId}`, { timeout: 3500 });
      const profile = profileRes.data?.admin;

      if (!profileRes.data?.success || !profile) {
        return;
      }

      const nextAdmin = {
        adminId: profile.adminId || adminData.adminId,
        userId: profile.userId || adminData.userId,
        schoolCode: profile.schoolCode || adminData.schoolCode || "",
        name: profile.name || "Admin",
        username: profile.username || "",
        role: profile.role || adminData.role || adminData.userType || "admin",
        profileImage: profile.profileImage || "/default-profile.png",
        isActive: profile.isActive ?? adminData.isActive ?? false,
      };

      setAdmin(nextAdmin);
      localStorage.setItem("admin", JSON.stringify(nextAdmin));

    } catch (e) {
      setLoadingAdmin(false);
    }
  };

  const handleOpenChat = (user, userType) => {
    navigate("/all-chat", {
      state: {
        userType,           // "teacher" or "student"
        studentId: user?.id, // for student chat
        teacher: user,       // for teacher chat
      },
    });
  };

  // ---------------- FETCH POSTS ----------------
  const fetchPosts = async () => {
    const requestId = postsFetchRequestIdRef.current + 1;
    postsFetchRequestIdRef.current = requestId;

    const effectiveSchoolCode =
      schoolScopeCode ||
      schoolCode ||
      admin.schoolCode ||
      _storedAdmin.schoolCode ||
      (() => {
        try {
          return JSON.parse(localStorage.getItem("admin") || "{}").schoolCode || "";
        } catch (e) {
          return "";
        }
      })();

    const initialCacheCodes = uniqueNonEmptyValues([
      schoolScopeCode,
      effectiveSchoolCode,
      admin.schoolCode,
      _storedAdmin.schoolCode,
    ]);
    const isCurrentRequest = () => postsFetchRequestIdRef.current === requestId;
    const getPostCacheKeys = (schoolCodeValues) =>
      uniqueNonEmptyValues(schoolCodeValues).map(
        (schoolCodeValue) => `dashboard_posts_cache_${schoolCodeValue}`
      );

    const clearCachedPosts = (schoolCodeValues = initialCacheCodes) => {
      try {
        getPostCacheKeys(schoolCodeValues).forEach((cacheKey) => {
          localStorage.removeItem(cacheKey);
        });
      } catch (error) {
        // Ignore localStorage delete issues.
      }
    };

    if (!effectiveSchoolCode) {
      clearCachedPosts();
      setPosts([]);
      setPostsLoading(false);
      setPostsInitialized(true);
      return;
    }

    setPostsLoading(true);

    try {
      const isPostLike = (postValue) =>
        Boolean(
          postValue &&
          typeof postValue === "object" &&
          (postValue.postId || postValue.message || postValue.postUrl || postValue.time || postValue.createdAt)
        );

      const normalizePostsNode = (postsNode) => {
        if (!postsNode || typeof postsNode !== "object") {
          return [];
        }

        if (isPostLike(postsNode)) {
          return [{ postId: postsNode.postId, ...postsNode }];
        }

        return Object.entries(postsNode)
          .filter(([, value]) => value && typeof value === "object")
          .filter(([, value]) => isPostLike(value))
          .map(([key, value]) => ({
            postId: value.postId || key,
            ...value,
          }));
      };

      const extractPostsDeep = (payload, depth = 0) => {
        if (depth > 6 || !payload) {
          return [];
        }

        if (Array.isArray(payload)) {
          const direct = payload
            .filter((postItem) => isPostLike(postItem))
            .map((postItem, index) => ({
              postId: postItem.postId || `array-${depth}-${index}`,
              ...postItem,
            }));

          if (direct.length > 0) {
            return direct;
          }

          return payload.flatMap((item) => extractPostsDeep(item, depth + 1));
        }

        if (typeof payload === "object") {
          const normalizedNodePosts = normalizePostsNode(payload);
          if (normalizedNodePosts.length > 0) {
            return normalizedNodePosts;
          }

          return Object.values(payload)
            .filter((value) => value && typeof value === "object")
            .flatMap((value) => extractPostsDeep(value, depth + 1));
        }

        return [];
      };

      const normalizePostsResponse = (payload) => {
        const extracted = extractPostsDeep(payload);
        const uniquePosts = [];
        const seenPostIds = new Set();

        extracted.forEach((postItem, index) => {
          const postId = String(postItem.postId || postItem.id || `derived-${index}`);
          if (seenPostIds.has(postId)) {
            return;
          }

          seenPostIds.add(postId);
          uniquePosts.push({
            ...postItem,
            postId,
          });
        });

        return uniquePosts;
      };

      const readCachedPosts = (schoolCodeValues = initialCacheCodes) => {
        try {
          const now = Date.now();
          let hasFreshCache = false;
          const cachedPosts = mergeUniquePosts(
            getPostCacheKeys(schoolCodeValues).flatMap((cacheKey) => {
              const rawCache = localStorage.getItem(cacheKey);
              if (!rawCache) {
                return [];
              }

              const parsedCache = JSON.parse(rawCache);
              if (Array.isArray(parsedCache)) {
                return parsedCache.filter((postItem) => postItem && typeof postItem === "object");
              }

              if (!parsedCache || !Array.isArray(parsedCache.posts)) {
                return [];
              }

              if (Number(parsedCache.expiresAt || 0) > now) {
                hasFreshCache = true;
              }

              return parsedCache.posts.filter((postItem) => postItem && typeof postItem === "object");
            })
          );

          return {
            posts: cachedPosts,
            isFresh: hasFreshCache,
          };
        } catch (error) {
          return {
            posts: [],
            isFresh: false,
          };
        }
      };

      const writeCachedPosts = (postItems, schoolCodeValues = initialCacheCodes) => {
        try {
          const serializedPosts = JSON.stringify({
            posts: postItems.slice(0, DASHBOARD_POST_CACHE_LIMIT),
            expiresAt: Date.now() + POSTS_CACHE_TTL_MS,
          });
          getPostCacheKeys(schoolCodeValues).forEach((cacheKey) => {
            localStorage.setItem(cacheKey, serializedPosts);
          });
        } catch (error) {
          // Ignore localStorage write issues.
        }
      };

      const toFastRenderablePosts = (sourcePosts) => sourcePosts
        .sort((a, b) => new Date(b.time || b.createdAt || 0) - new Date(a.time || a.createdAt || 0))
        .map((postItem) => {
          const profile = postItem.adminProfile || postItem.adminProfileImage || postItem.profileImage || "";

          return {
            ...postItem,
            adminProfile: getSafeImageUrl(profile, DEFAULT_PROFILE_IMAGE),
            schoolCode: postItem.schoolCode || schoolScopeCode || effectiveSchoolCode,
          };
        });

      const safeGet = async (url, config = {}, fallbackData = null) => {
        try {
          const response = await axios.get(url, config);
          return response;
        } catch (error) {
          return { data: fallbackData };
        }
      };

      const fetchPostsForSchoolCodes = async (candidateCodes) => {
        const normalizedCandidateCodes = uniqueNonEmptyValues(candidateCodes);
        if (normalizedCandidateCodes.length === 0) {
          return [];
        }

        const apiPostsResponses = await Promise.all(
          normalizedCandidateCodes.map((candidateCode) =>
            safeGet(
              `${API_BASE}/get_posts`,
              {
                params: { schoolCode: candidateCode, limit: DASHBOARD_POST_FETCH_LIMIT },
                timeout: 4500,
              },
              []
            )
          )
        );

        const apiPosts = mergeUniquePosts(
          apiPostsResponses.flatMap((response) => normalizePostsResponse(response?.data))
        );

        if (apiPosts.length > 0) {
          return apiPosts;
        }

        const schoolDbRoots = buildSchoolDbRoots(normalizedCandidateCodes);
        const firebasePostsResponses = await Promise.all(
          schoolDbRoots.map((schoolDbRoot) =>
            safeGet(
              `${schoolDbRoot}/Posts.json`,
              {
                params: { orderBy: '"$key"', limitToLast: DASHBOARD_POST_FETCH_LIMIT },
                timeout: 4500,
              },
              {}
            )
          )
        );

        return mergeUniquePosts(
          firebasePostsResponses.flatMap((response) => normalizePostsNode(response?.data || {}))
        );
      };

      const cachedPostsResult = readCachedPosts();
      const cachedPosts = cachedPostsResult.posts || [];
      if (cachedPosts.length > 0 && isCurrentRequest()) {
        setPosts(cachedPosts);
        setPostsLoading(false);
      }

      const directSchoolCodes = uniqueNonEmptyValues([
        schoolScopeCode,
        effectiveSchoolCode,
      ]);
      let sourcePosts = await fetchPostsForSchoolCodes(directSchoolCodes);

      if (sourcePosts.length > 0 && isCurrentRequest()) {
        const fastDirectPosts = toFastRenderablePosts(sourcePosts);
        setPosts(fastDirectPosts);
        setPostsLoading(false);
        setPostsInitialized(true);
        writeCachedPosts(fastDirectPosts, directSchoolCodes);
      }

      const schoolCodeCandidates = await resolveSchoolScopeCandidates(schoolScopeCode || effectiveSchoolCode);
      const additionalSchoolCodeCandidates = uniqueNonEmptyValues(schoolCodeCandidates).filter(
        (candidateCode) => !directSchoolCodes.some(
          (directCode) => String(directCode || "").toLowerCase() === String(candidateCode || "").toLowerCase()
        )
      );

      if (additionalSchoolCodeCandidates.length > 0) {
        sourcePosts = mergeUniquePosts(
          sourcePosts,
          await fetchPostsForSchoolCodes(additionalSchoolCodeCandidates)
        );
      }

      if (sourcePosts.length === 0) {
        const [legacyApiPostsRes, legacyFirebasePostsRes] = await Promise.all([
          safeGet(`${API_BASE}/get_posts`, { timeout: 4500 }, []),
          safeGet(
            `${DB_URL}/Posts.json`,
            {
              params: { orderBy: '"$key"', limitToLast: DASHBOARD_POST_FETCH_LIMIT },
              timeout: 4500,
            },
            {}
          ),
        ]);

        sourcePosts = mergeUniquePosts(
          normalizePostsResponse(legacyApiPostsRes.data),
          normalizePostsNode(legacyFirebasePostsRes.data || {})
        );
      }

      const fastPosts = toFastRenderablePosts(sourcePosts);
      const cacheCodesToUpdate = uniqueNonEmptyValues([
        ...initialCacheCodes,
        ...schoolCodeCandidates,
      ]);

      if (fastPosts.length > 0) {
        writeCachedPosts(fastPosts, cacheCodesToUpdate);
      } else {
        clearCachedPosts(cacheCodesToUpdate);
      }

      if (isCurrentRequest()) {
        setPosts(fastPosts);
      }
    } catch (err) {
      if (postsFetchRequestIdRef.current === requestId) {
        console.error("Error fetching posts:", err);
      }
    } finally {
      if (postsFetchRequestIdRef.current === requestId) {
        setPostsLoading(false);
        setPostsInitialized(true);
      }
    }
  };

  // ---------------- FETCH CONVERSATIONS ----------------
  const fetchConversations = async () => {
    if (!adminUserId) {
      setConversations([]);
      return;
    }

    try {
      const schoolCodeCandidates = await resolveSchoolScopeCandidates(
        schoolScopeCode || schoolCode || admin.schoolCode || _storedAdmin.schoolCode || ""
      );

      const [usersData, chatsData] = await Promise.all([
        readMergedSchoolNode(schoolCodeCandidates, "Users", {}),
        readMergedSchoolNode(schoolCodeCandidates, "Chats", {}),
      ]);

      const usersByKey = usersData && typeof usersData === "object" ? usersData : {};
      const chatsMap = chatsData && typeof chatsData === "object" ? chatsData : {};
      const usersByUserId = {};
      const userKeyByUserId = {};

      Object.entries(usersByKey).forEach(([userKey, userNode]) => {
        const normalizedUserId = String(userNode?.userId || userKey || "").trim();
        if (!normalizedUserId) {
          return;
        }

        usersByUserId[normalizedUserId] = userNode;
        userKeyByUserId[normalizedUserId] = userKey;
      });

      const nextConversations = Object.entries(chatsMap)
        .map(([chatId, chatValue]) => {
          const chat = chatValue && typeof chatValue === "object" ? chatValue : null;
          if (!chat) {
            return null;
          }

          const participants = chat.participants || {};
          const participantKeys = Object.keys(participants || {});
          if (!participantKeys.includes(adminUserId)) {
            return null;
          }

          if (!hasConversationUserSentMessage(chat, adminUserId)) {
            return null;
          }

          const otherParticipantKey = participantKeys.find(
            (participantKey) => String(participantKey || "").trim() !== String(adminUserId).trim()
          );
          if (!otherParticipantKey) {
            return null;
          }

          const userPushKey = userKeyByUserId[otherParticipantKey];
          const fallbackUserRecord = usersByUserId[otherParticipantKey] || usersByKey[otherParticipantKey] || usersByKey[userPushKey] || {};
          const otherUserId = String(fallbackUserRecord?.userId || otherParticipantKey || "").trim();
          if (!otherUserId) {
            return null;
          }

          if (Object.keys(fallbackUserRecord).length > 0 && !isActiveEntity(fallbackUserRecord)) {
            return null;
          }

          const normalizedRole = String(
            fallbackUserRecord?.role || fallbackUserRecord?.userType || ""
          ).trim().toLowerCase();
          const inferredType = normalizeConversationContactType(
            normalizedRole
          ) || "teacher";
          const officeRole = ["hr", "finance", "registerer", "registerers", "registrar"].includes(normalizedRole)
            ? normalizeConversationContactType(normalizedRole) === "management"
              ? normalizedRole === "registerers" || normalizedRole === "registrar"
                ? "registerer"
                : normalizedRole
              : undefined
            : undefined;
          const profileImage = getSafeImageUrl(
            fallbackUserRecord?.profileImage || fallbackUserRecord?.profile,
            DEFAULT_PROFILE_IMAGE
          );
          const displayName = pickFirstNonEmpty(
            fallbackUserRecord?.name,
            fallbackUserRecord?.username,
            otherUserId,
            "User"
          );
          const lastMessage = chat.lastMessage || {};
          const lastMessageText = pickFirstNonEmpty(
            lastMessage?.text,
            String(lastMessage?.type || "").toLowerCase() === "image" ? "Image" : ""
          );
          const unreadForMe = Number(chat?.unread?.[adminUserId] || 0);
          const lastMessageTime = getConversationSortTime(
            lastMessage?.timeStamp || lastMessage?.time || chat?.updatedAt || chat?.createdAt || 0
          );

          return {
            chatId,
            contact: {
              id: otherUserId,
              userId: otherUserId,
              name: displayName,
              profileImage,
              type: inferredType,
              officeRole,
            },
            displayName,
            profile: profileImage,
            lastMessageText,
            lastMessageTime,
            unreadForMe,
          };
        })
        .filter(Boolean)
        .sort((leftConversation, rightConversation) => {
          if ((rightConversation?.lastMessageTime || 0) !== (leftConversation?.lastMessageTime || 0)) {
            return (rightConversation?.lastMessageTime || 0) - (leftConversation?.lastMessageTime || 0);
          }

          if ((rightConversation?.unreadForMe || 0) !== (leftConversation?.unreadForMe || 0)) {
            return (rightConversation?.unreadForMe || 0) - (leftConversation?.unreadForMe || 0);
          }

          return String(leftConversation?.displayName || "").localeCompare(String(rightConversation?.displayName || ""));
        });

      setConversations(nextConversations);
    } catch (err) {
      console.error("Conversation fetch failed:", err);
      setConversations([]);
    }
  };

  const handleOpenConversation = async (conversation) => {
    if (!conversation) {
      return;
    }

    const contact = conversation.contact || {};

    navigate("/all-chat", {
      state: {
        contact,
        chatId: conversation.chatId,
        tab: contact.type || "teacher",
        userType: contact.type || "teacher",
      },
    });

    setConversations((prevConversations) =>
      prevConversations.map((conversationItem) =>
        conversationItem.chatId === conversation.chatId
          ? { ...conversationItem, unreadForMe: 0 }
          : conversationItem
      )
    );

    try {
      await axios.put(`${DB_ROOT}/Chats/${conversation.chatId}/unread/${adminUserId}.json`, null);
    } catch (err) {
      console.error("Failed to clear admin unread state:", err);
    }
  };

  // ---------------- CLOSE DROPDOWN ON OUTSIDE CLICK ----------------
  useEffect(() => {
    const closeDropdown = (e) => {
      if (
        !e.target.closest(".icon-circle") &&
        !e.target.closest(".messenger-dropdown")
      ) {
        setShowMessageDropdown(false);
      }
    };

    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  /// ---------------- FETCH POST NOTIFICATIONS ----------------
  useEffect(() => {
    if (!admin.userId) {
      setUnreadPostList([]);
      return;
    }

    const unreadPosts = posts
      .filter((postValue) => !postValue?.seenBy || !postValue.seenBy[admin.userId])
      .slice(0, 5)
      .map((postItem) => ({
        ...postItem,
        adminName: postItem.adminName || "Admin",
        adminProfile: getSafeImageUrl(postItem.adminProfile, DEFAULT_PROFILE_IMAGE),
      }));

    setUnreadPostList(unreadPosts);
  }, [admin.userId, posts]);

  useEffect(() => {
    setTargetOptions(DEFAULT_TARGET_ROLE_OPTIONS);
    setTargetRole((prev) =>
      DEFAULT_TARGET_ROLE_OPTIONS.includes(prev) ? prev : "all"
    );
  }, []);

  const openChatWithUser = async (userId) => {
    setShowMessengerDropdown(false);

    // Fetch chat history
    const res = await axios.get(`${API_BASE}/chat/${admin.userId}/${userId}`);
    setCurrentChat(res.data); // You need a state `currentChat` to render the conversation

    // Mark messages as read
    await axios.post(`${API_BASE}/mark_messages_read`, {
      adminId: admin.userId,
      senderId: userId
    });

    // Refresh unread messages
    setUnreadMessages(prev => prev.filter(m => m.senderId !== userId));
  };

  // ---------------- OPEN POST FROM NOTIFICATION ----------------
  const openPostFromNotif = async (post) => {
    setShowPostDropdown(false);

    try {
      // 1️⃣ Mark as seen in school-scoped DB (register-style structure)
      await axios.put(`${DB_ROOT}/Posts/${post.postId}/seenBy/${admin.userId}.json`, true);

      // 2️⃣ REMOVE from notification list IMMEDIATELY
      setUnreadPostList(prev =>
        prev.filter(p => p.postId !== post.postId)
      );

      // 3️⃣ Update post as seen in main feed
      setPosts(prev =>
        prev.map(p =>
          p.postId === post.postId
            ? {
                ...p,
                seenBy: {
                  ...(p.seenBy || {}),
                  [admin.userId]: true
                }
              }
            : p
        )
      );

      // 4️⃣ Scroll + highlight
      setTimeout(() => {
        const el = document.getElementById(`post-${post.postId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.backgroundColor = "#fff9c4";
          setTimeout(() => (el.style.backgroundColor = ""), 1500);
        }
      }, 200);

    } catch (err) {
      console.error("Error opening post notification:", err);
    }
  };

  useEffect(() => {
    if (postIdToScroll) {
      const element = document.getElementById(`post-${postIdToScroll}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
        element.style.backgroundColor = "#ffffe0"; // optional highlight
        setTimeout(() => (element.style.backgroundColor = ""), 2000);
      }
    }
  }, [postIdToScroll]);

  // ---------------- CLOSE DROPDOWN ON OUTSIDE CLICK ----------------
  useEffect(() => {
    const close = (e) => {
      if (
        !e.target.closest(".icon-circle") &&
        !e.target.closest(".notification-dropdown")
      ) {
        setShowPostDropdown(false);
      }
    };

    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // ---------------- EFFECT ON MOUNT ----------------
  useEffect(() => {
    loadAdminFromStorage();
  }, []);

  useEffect(() => {
    if (!loadingAdmin && schoolCode) {
      if (posts.length === 0) {
        setPostsInitialized(false);
      }
      fetchPosts();
    }
  }, [loadingAdmin, schoolCode]);

  useEffect(() => {
    if (!showCreatePostModal) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setShowCreatePostModal(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showCreatePostModal]);

  // Add this effect to monitor admin state changes
  useEffect(() => {
    if (loadingAdmin) return;

    if (!admin.userId) {
      console.log("No admin found, redirecting to login");
      navigate("/login", { replace: true });
    }
  }, [loadingAdmin, admin.userId]);

  const handlePostMediaSelection = async (event) => {
    const file = event.target.files && event.target.files[0];

    if (!file) {
      setPostMedia(null);
      setPostMediaMeta(null);
      return;
    }

    setIsOptimizingMedia(true);

    try {
      const optimizedResult = await optimizePostMedia(file);
      setPostMedia(optimizedResult.file);
      setPostMediaMeta({
        originalSize: optimizedResult.originalSize,
        finalSize: optimizedResult.finalSize,
        wasCompressed: optimizedResult.wasCompressed,
        wasConvertedToJpeg: optimizedResult.wasConvertedToJpeg,
      });
    } catch (error) {
      console.error("Failed to optimize media:", error);
      setPostMedia(file);
      setPostMediaMeta({
        originalSize: Number(file.size || 0),
        finalSize: Number(file.size || 0),
        wasCompressed: false,
        wasConvertedToJpeg: false,
      });
    } finally {
      setIsOptimizingMedia(false);
    }
  };

  const handleOpenPostMediaPicker = () => {
    if (isOptimizingMedia) return;
    fileInputRef.current?.click();
  };

  const handlePost = async () => {
    if (!postText && !postMedia) return;
    if (isOptimizingMedia || postSubmitting) return;

    if (!admin.adminId || !admin.userId) {
      setPostSubmitError("Session expired. Please log in again.");
      return;
    }

    setPostSubmitting(true);
    setPostSubmitError("");

    try {
      const formData = new FormData();
      formData.append("message", postText);
      formData.append("adminId", admin.adminId);
      formData.append("userId", admin.userId);
      formData.append("adminName", admin.name || admin.username || "Admin");
      formData.append("adminProfile", admin.profileImage || DEFAULT_PROFILE_IMAGE);
      formData.append("schoolCode", schoolScopeCode || schoolCode || "");
      formData.append("targetRole", targetRole || "all");

      if (postMedia) {
        formData.append("post_media", postMedia);
      }

      const response = await axios.post(`${API_BASE}/create_post`, formData);
      if (response.data && response.data.success === false) {
        throw new Error(response.data.message || "Post could not be published.");
      }

      setPostText("");
      setPostMedia(null);
      setPostMediaMeta(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await fetchPosts();
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Post could not be published.";
      setPostSubmitError(message);
      throw error;
    } finally {
      setPostSubmitting(false);
    }
  };

  const handleSubmitCreatePost = async () => {
    if (!postText && !postMedia) return;

    try {
      await handlePost();
      setShowCreatePostModal(false);
    } catch (err) {
      console.error("Create post failed:", err);
    }
  };

  // ---------------- HANDLE LIKE ----------------
  const handleLike = async (postId) => {
    const normalizedPostId = String(postId || "").trim();
    if (!currentLikeActorId || !normalizedPostId || likePendingPostIds[normalizedPostId]) return;

    const currentPost = posts.find(
      (postItem) => String(postItem?.postId || "") === normalizedPostId
    );

    if (!currentPost) {
      return;
    }

    const previousLikes = normalizePostLikes(currentPost.likes);
    const wasLiked = Boolean(previousLikes[String(currentLikeActorId)]);
    const nextLikes = { ...previousLikes };

    if (wasLiked) {
      delete nextLikes[String(currentLikeActorId)];
    } else {
      nextLikes[String(currentLikeActorId)] = true;
    }

    const optimisticLikeCount = Object.keys(nextLikes).length;

    setLikePendingPostIds((prevState) => ({
      ...prevState,
      [normalizedPostId]: true,
    }));

    setPosts((prevPosts) => {
      const nextPosts = prevPosts.map((postItem) =>
        String(postItem?.postId || "") === normalizedPostId
          ? {
              ...postItem,
              likeCount: optimisticLikeCount,
              likes: nextLikes,
            }
          : postItem
      );

      return nextPosts;
    });

    updateCachedPostEntries(normalizedPostId, (postItem) => ({
      ...postItem,
      likeCount: optimisticLikeCount,
      likes: nextLikes,
    }));

    try {
      const res = await axios.post(`${API_BASE}/like_post`, {
        postId: normalizedPostId,
        adminId: admin.userId || admin.adminId,
        userId: admin.userId,
        schoolCode,
      });

      if (!res.data?.success) {
        throw new Error("Like request failed.");
      }

      const liked = Boolean(res.data.liked);
      const likeCount = Number(res.data.likeCount);
      const syncedLikes = { ...nextLikes };

      if (liked) {
        syncedLikes[String(currentLikeActorId)] = true;
      } else {
        delete syncedLikes[String(currentLikeActorId)];
      }

      setPosts((prevPosts) => {
        const nextPosts = prevPosts.map((postItem) =>
          String(postItem?.postId || "") === normalizedPostId
            ? {
                ...postItem,
                likeCount:
                  Number.isFinite(likeCount) && likeCount >= 0
                    ? likeCount
                    : Object.keys(syncedLikes).length,
                likes: syncedLikes,
              }
            : postItem
        );

        return nextPosts;
      });

      updateCachedPostEntries(normalizedPostId, (postItem) => ({
        ...postItem,
        likeCount:
          Number.isFinite(likeCount) && likeCount >= 0
            ? likeCount
            : Object.keys(syncedLikes).length,
        likes: syncedLikes,
      }));
    } catch (err) {
      const previousLikeCount = Object.keys(previousLikes).length;

      setPosts((prevPosts) => {
        const nextPosts = prevPosts.map((postItem) =>
          String(postItem?.postId || "") === normalizedPostId
            ? {
                ...postItem,
                likeCount: previousLikeCount,
                likes: previousLikes,
              }
            : postItem
        );

        return nextPosts;
      });

      updateCachedPostEntries(normalizedPostId, (postItem) => ({
        ...postItem,
        likeCount: previousLikeCount,
        likes: previousLikes,
      }));

      console.error("Error liking post:", err);
    } finally {
      setLikePendingPostIds((prevState) => {
        const nextState = { ...prevState };
        delete nextState[normalizedPostId];
        return nextState;
      });
    }
  };

  // ---------------- HANDLE DELETE ----------------
  const handleDelete = async (postId) => {
    try {
      await axios.delete(`${API_BASE}/delete_post/${postId}`, {
       data: { adminId: admin.adminId },
      });
      fetchPosts();
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  // ---------------- HANDLE EDIT ----------------
  const handleEdit = async (postId, currentText) => {
    const newText = prompt("Edit your post:", currentText);
    if (!newText) return;
    try {
      await axios.post(`${API_BASE}/edit_post/${postId}`, {
       adminId: admin.adminId,
        postText: newText,
      });
      fetchPosts();
    } catch (err) {
      console.error("Error editing post:", err);
    }
  };

  const markMessagesAsSeen = async (userId) => {
    const key1 = `${admin.userId}_${userId}`;
    const key2 = `${userId}_${admin.userId}`;

    const [r1, r2] = await Promise.all([
      axios.get(`${DB_URL}/Chats/${key1}/messages.json`),
      axios.get(`${DB_URL}/Chats/${key2}/messages.json`)
    ]);

    const updates = {};

    const collectUpdates = (data, basePath) => {
      Object.entries(data || {}).forEach(([msgId, msg]) => {
        if (msg.receiverId === admin.userId && !msg.seen) {
          updates[`${basePath}/${msgId}/seen`] = true;
        }
      });
    };

    collectUpdates(r1.data, `Chats/${key1}/messages`);
    collectUpdates(r2.data, `Chats/${key2}/messages`);

    if (Object.keys(updates).length > 0) {
      await axios.patch(
        `${DB_URL}/.json`,
        updates
      );
    }
  };

  // counts for badges
  const totalUnreadMessages = 0;
  const messageCount = totalUnreadMessages;
  const totalNotifications = (unreadPostList?.length || 0) + messageCount;
  const isOverlayModalOpen = showCalendarEventModal || showCreatePostModal;
  const canSubmitPost = Boolean(postText.trim() || postMedia) && !isOptimizingMedia;
  const FEED_MAX_WIDTH = 760;
  const MESSAGE_PREVIEW_LIMIT = 220;
  const FEED_SECTION_STYLE = {
    width: "100%",
    maxWidth: FEED_MAX_WIDTH,
    margin: "0 auto",
    boxSizing: "border-box",
  };
  const shellCardStyle = {
    background: "var(--surface-panel)",
    color: "var(--text-primary)",
    borderRadius: 16,
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
  };
  const rightRailCardStyle = {
    background: "var(--surface-panel)",
    borderRadius: 12,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08), 0 8px 20px rgba(15, 23, 42, 0.04)",
    border: "1px solid rgba(15, 23, 42, 0.08)",
  };
  const widgetCardStyle = {
    ...rightRailCardStyle,
    padding: "12px",
  };
  const softPanelStyle = {
    background: "#F8FAFC",
    border: "1px solid rgba(15, 23, 42, 0.06)",
    borderRadius: 10,
  };
  const smallStatStyle = {
    padding: "10px 12px",
    borderRadius: 10,
    background: "#F8FAFC",
    border: "1px solid rgba(15, 23, 42, 0.06)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    minWidth: 84,
  };
  const rightRailIconStyle = {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: "#F8FAFC",
    color: "var(--text-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(15, 23, 42, 0.08)",
  };
  const rightRailIconButtonStyle = {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    background: "#F8FAFC",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
  };
  const rightRailPillStyle = {
    padding: "4px 8px",
    borderRadius: 999,
    background: "#F8FAFC",
    border: "1px solid rgba(15, 23, 42, 0.06)",
    fontSize: 9,
    color: "var(--text-secondary)",
    fontWeight: 800,
  };
  const rightRailActionButtonStyle = {
    height: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(0, 122, 251, 0.18)",
    background: "#007AFB",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  };
  const rightRailSecondaryButtonStyle = {
    height: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    background: "var(--surface-panel)",
    color: "var(--text-primary)",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  };
  const adminRightSidebarLinks = [
    { to: "/dashboard", label: "Dashboard", icon: FaHome },
    { to: "/overview", label: "Overview", icon: FaFileAlt },
    { to: "/my-posts", label: "My Posts", icon: FaBell },
    { to: "/teachers", label: "Teachers", icon: FaChalkboardTeacher },
    { to: "/students", label: "Students", icon: FaFacebookMessenger },
    { to: "/academic-year", label: "Calendar", icon: FaCalendarAlt },
    { to: "/settings", label: "Settings", icon: FaCog },
  ];
  const myPostsCount = posts.filter((post) =>
    post.userId === admin.userId || post.adminId === admin.adminId
  ).length;
  const todayDate = new Date().toDateString();
  const todaysPostsCount = posts.filter((post) =>
    new Date(post.time || post.createdAt || Date.now()).toDateString() === todayDate
  ).length;

  const calendarNow = new Date();
  const calendarTodayIsoDate = `${calendarNow.getFullYear()}-${String(calendarNow.getMonth() + 1).padStart(2, "0")}-${String(calendarNow.getDate()).padStart(2, "0")}`;
  const deadlineWindowEnd = new Date(calendarNow);
  deadlineWindowEnd.setDate(deadlineWindowEnd.getDate() + 30);
  const deadlineWindowEndIsoDate = `${deadlineWindowEnd.getFullYear()}-${String(deadlineWindowEnd.getMonth() + 1).padStart(2, "0")}-${String(deadlineWindowEnd.getDate()).padStart(2, "0")}`;
  const currentEthiopicDate = EthiopicCalendar.ge(
    calendarNow.getFullYear(),
    calendarNow.getMonth() + 1,
    calendarNow.getDate()
  );
  const calendarMonthLabel = `${ETHIOPIAN_MONTHS[calendarViewDate.month - 1]} ${calendarViewDate.year}`;
  const isCurrentCalendarMonth =
    calendarViewDate.year === currentEthiopicDate.year &&
    calendarViewDate.month === currentEthiopicDate.month;
  const calendarToday = currentEthiopicDate.day;
  const calendarHighlightedDay = isCurrentCalendarMonth ? calendarToday : null;
  const calendarDaysInMonth = calendarViewDate.month === 13
    ? (calendarViewDate.year % 4 === 3 ? 6 : 5)
    : 30;
  const calendarMonthStartGregorian = EthiopicCalendar.eg(calendarViewDate.year, calendarViewDate.month, 1);
  const calendarMonthEndGregorian = EthiopicCalendar.eg(calendarViewDate.year, calendarViewDate.month, calendarDaysInMonth);
  const calendarFirstWeekday = new Date(
    calendarMonthStartGregorian.year,
    calendarMonthStartGregorian.month - 1,
    calendarMonthStartGregorian.day
  ).getDay();
  const defaultCalendarEvents = buildDefaultCalendarEvents(calendarViewDate.year);
  const mergedCalendarEvents = sortCalendarEvents([...defaultCalendarEvents, ...calendarEvents]);
  const calendarEventsByDate = mergedCalendarEvents.reduce((eventsMap, eventItem) => {
    const eventDate = String(eventItem.gregorianDate || "");
    if (!eventDate) {
      return eventsMap;
    }

    if (!eventsMap[eventDate]) {
      eventsMap[eventDate] = [];
    }

    eventsMap[eventDate].push(eventItem);
    return eventsMap;
  }, {});
  const calendarDays = Array.from({ length: calendarFirstWeekday + calendarDaysInMonth }, (_, index) => {
    const dayNumber = index - calendarFirstWeekday + 1;

    if (dayNumber < 1 || dayNumber > calendarDaysInMonth) {
      return null;
    }

    const gregorianDate = EthiopicCalendar.eg(calendarViewDate.year, calendarViewDate.month, dayNumber);
    const isoDate = `${gregorianDate.year}-${String(gregorianDate.month).padStart(2, "0")}-${String(gregorianDate.day).padStart(2, "0")}`;

    return {
      ethDay: dayNumber,
      isoDate,
      gregorianDate,
      events: calendarEventsByDate[isoDate] || [],
    };
  });
  const monthlyCalendarEvents = sortCalendarEvents(
    calendarDays
      .filter(Boolean)
      .flatMap((dayItem) => dayItem.events.map((eventItem) => ({ ...eventItem, ethDay: dayItem.ethDay })))
  );
  const upcomingDeadlineEvents = sortCalendarEvents(
    calendarEvents.filter(
      (eventItem) =>
        eventItem.showInUpcomingDeadlines &&
        eventItem.category === "academic" &&
        String(eventItem.gregorianDate || "") >= calendarTodayIsoDate &&
        String(eventItem.gregorianDate || "") <= deadlineWindowEndIsoDate
    )
  );
  const visibleUpcomingDeadlineEvents = showAllUpcomingDeadlines
    ? upcomingDeadlineEvents
    : upcomingDeadlineEvents.slice(0, 3);
  const editingCalendarEvent = calendarEvents.find((eventItem) => eventItem.id === editingCalendarEventId) || null;
  const selectableCalendarDays = calendarDays.filter(Boolean);
  const selectedCalendarDay = calendarDays.find((dayItem) => dayItem?.isoDate === selectedCalendarIsoDate) || null;
  const selectedCalendarEvents = selectedCalendarDay?.events || [];

  const handleCalendarMonthChange = (monthOffset) => {
    setCalendarViewDate((currentDate) => {
      let nextMonth = currentDate.month + monthOffset;
      let nextYear = currentDate.year;

      while (nextMonth < 1) {
        nextMonth += 13;
        nextYear -= 1;
      }

      while (nextMonth > 13) {
        nextMonth -= 13;
        nextYear += 1;
      }

      return {
        year: nextYear,
        month: nextMonth,
      };
    });
  };

  const loadCalendarEvents = async ({ forceRefresh = false } = {}) => {
    if (!schoolScopeCode) {
      setCalendarEvents([]);
      return;
    }

    if (!forceRefresh) {
      const cachedCalendar = readCachedCalendarEvents(schoolScopeCode);
      if (cachedCalendar.events.length > 0) {
        setCalendarEvents(sortCalendarEvents(cachedCalendar.events));
      }

      if (cachedCalendar.isFresh) {
        setCalendarEventsLoading(false);
        return;
      }
    }

    setCalendarEventsLoading(true);
    try {
      const res = await axios.get(`${DB_ROOT}/CalendarEvents.json`);
      const rawEvents = res.data || {};
      const normalizedEvents = Object.entries(rawEvents)
        .map(([eventId, eventValue]) => normalizeCalendarEvent(eventId, eventValue))
        .filter((eventItem) => eventItem.gregorianDate);

      setCalendarEvents(sortCalendarEvents(normalizedEvents));
      writeCachedCalendarEvents(schoolScopeCode, normalizedEvents);
    } catch (err) {
      console.error("Failed to load calendar events:", err);
      const cachedCalendar = readCachedCalendarEvents(schoolScopeCode);
      setCalendarEvents(sortCalendarEvents(cachedCalendar.events || []));
    } finally {
      setCalendarEventsLoading(false);
    }
  };

  const handleCreateCalendarEvent = async () => {
    if (!canManageCalendar) {
      alert("Only registrar or admin users can manage school calendar events.");
      return;
    }

    if (!selectedCalendarDay) {
      alert("Select a calendar day first.");
      return;
    }

    if (calendarModalContext === "deadline" && !calendarEventForm.title.trim()) {
      alert("Enter a deadline title.");
      return;
    }

    setCalendarEventSaving(true);
    try {
      const normalizedCategory = calendarModalContext === "deadline" ? "academic" : calendarEventForm.category;
      const selectedEventMeta = getCalendarEventMeta(normalizedCategory);
      const payload = {
        title: calendarEventForm.title.trim() || selectedEventMeta.label,
        type: getCalendarEventKey(normalizedCategory),
        category: normalizedCategory,
        subType: "general",
        notes: calendarEventForm.notes.trim(),
        showInUpcomingDeadlines: calendarModalContext === "deadline" || Boolean(editingCalendarEvent?.showInUpcomingDeadlines),
        gregorianDate: selectedCalendarDay.isoDate,
        ethiopianDate: {
          year: calendarViewDate.year,
          month: calendarViewDate.month,
          day: selectedCalendarDay.ethDay,
        },
        createdAt: new Date().toISOString(),
        createdBy: admin.userId || admin.adminId || "",
      };

      if (editingCalendarEventId) {
        await axios.patch(`${DB_ROOT}/CalendarEvents/${editingCalendarEventId}.json`, payload);
        setCalendarActionMessage("Calendar event updated successfully.");
      } else {
        await axios.post(`${DB_ROOT}/CalendarEvents.json`, payload);
        setCalendarActionMessage("Calendar event saved successfully.");
      }

      setCalendarEventForm({ title: "", category: "no-class", subType: "general", notes: "" });
      setEditingCalendarEventId("");
      setShowCalendarEventModal(false);
      setCalendarModalContext("calendar");
      await loadCalendarEvents({ forceRefresh: true });
    } catch (err) {
      console.error("Failed to save calendar event:", err);
      alert("Failed to save calendar event.");
    } finally {
      setCalendarEventSaving(false);
    }
  };

  const handleEditCalendarEvent = (eventItem) => {
    if (!canManageCalendar || eventItem.isDefault) {
      return;
    }

    setCalendarModalContext(eventItem.showInUpcomingDeadlines ? "deadline" : "calendar");
    setShowCalendarEventModal(true);

    const ethiopianDate = eventItem.ethiopianDate || (() => {
      const [year, month, day] = String(eventItem.gregorianDate || "").split("-").map(Number);
      if (!year || !month || !day) {
        return null;
      }

      return EthiopicCalendar.ge(year, month, day);
    })();

    if (ethiopianDate?.year && ethiopianDate?.month) {
      setCalendarViewDate({ year: ethiopianDate.year, month: ethiopianDate.month });
    }

    setSelectedCalendarIsoDate(eventItem.gregorianDate);
    setCalendarEventForm({
      title: eventItem.title || "",
      category: eventItem.category || (eventItem.type === "academic" ? "academic" : "no-class"),
      subType: "general",
      notes: eventItem.notes || "",
    });
    setEditingCalendarEventId(eventItem.id);
  };

  const handleDeleteCalendarEvent = async (eventItem) => {
    if (!canManageCalendar) {
      alert("Only registrar or admin users can manage school calendar events.");
      return;
    }

    if (eventItem.isDefault) {
      alert("Default Ethiopian special days cannot be deleted.");
      return;
    }

    const selectedEventMeta = getCalendarEventMeta(eventItem.category);
    const shouldDelete = window.confirm(`Delete ${selectedEventMeta.label} on ${eventItem.gregorianDate}?`);
    if (!shouldDelete) {
      return;
    }

    setCalendarEventSaving(true);
    try {
      await axios.delete(`${DB_ROOT}/CalendarEvents/${eventItem.id}.json`);
      if (editingCalendarEventId === eventItem.id) {
        setEditingCalendarEventId("");
        setCalendarEventForm({ title: "", category: "no-class", subType: "general", notes: "" });
      }
      setCalendarActionMessage("Calendar event deleted successfully.");
      await loadCalendarEvents({ forceRefresh: true });
    } catch (err) {
      console.error("Failed to delete calendar event:", err);
      alert("Failed to delete calendar event.");
    } finally {
      setCalendarEventSaving(false);
    }
  };

  const handleOpenCalendarEventModal = () => {
    if (!selectedCalendarIsoDate && selectableCalendarDays.length > 0) {
      setSelectedCalendarIsoDate(selectableCalendarDays[0].isoDate);
    }
    setEditingCalendarEventId("");
    setCalendarEventForm({ title: "", category: "no-class", subType: "general", notes: "" });
    setCalendarModalContext("calendar");
    setShowCalendarEventModal(true);
  };

  const handleOpenDeadlineModal = () => {
    if (!selectedCalendarIsoDate && selectableCalendarDays.length > 0) {
      setSelectedCalendarIsoDate(selectableCalendarDays[0].isoDate);
    }
    setEditingCalendarEventId("");
    setCalendarEventForm({ title: "", category: "academic", subType: "general", notes: "" });
    setCalendarModalContext("deadline");
    setShowCalendarEventModal(true);
  };

  const handleCloseCalendarEventModal = () => {
    setEditingCalendarEventId("");
    setCalendarEventForm({ title: "", category: "no-class", subType: "general", notes: "" });
    setCalendarModalContext("calendar");
    setShowCalendarEventModal(false);
  };

  useEffect(() => {
    if (!calendarActionMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCalendarActionMessage("");
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [calendarActionMessage]);

  useEffect(() => {
    setShowAllUpcomingDeadlines(false);
  }, [schoolScopeCode]);

  useEffect(() => {
    loadCalendarEvents();
  }, [DB_ROOT, schoolScopeCode]);

  useEffect(() => {
    const preferredDay = calendarDays.find((dayItem) => dayItem?.ethDay === calendarHighlightedDay) || calendarDays.find(Boolean) || null;

    if (!preferredDay) {
      setSelectedCalendarIsoDate("");
      return;
    }

    const stillVisible = calendarDays.some((dayItem) => dayItem?.isoDate === selectedCalendarIsoDate);
    if (!stillVisible) {
      setSelectedCalendarIsoDate(preferredDay.isoDate);
    }
  }, [calendarViewDate.year, calendarViewDate.month, calendarHighlightedDay, calendarDays.length]);

  // ---------------- RENDER ----------------
  return (
    <div
      className="dashboard-page"
      style={{
        background: BACKGROUND,
        minHeight: "100vh",
        height: "auto",
        overflowX: "hidden",
        overflowY: "auto",
        color: "var(--text-primary)",
        "--surface-panel": BACKGROUND,
        "--surface-accent": "#F1F8FF",
        "--surface-muted": "#F7FBFF",
        "--surface-strong": "#DCEBFF",
        "--page-bg": BACKGROUND,
        "--border-soft": "#D7E7FB",
        "--border-strong": "#B5D2F8",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": PRIMARY,
        "--accent-soft": "#E7F2FF",
        "--accent-strong": "#007afb",
        "--success": ACCENT,
        "--success-soft": "#E9FBF9",
        "--success-border": "#AAEDE7",
        "--warning": "#DC2626",
        "--warning-soft": "#FEE2E2",
        "--warning-border": "#FCA5A5",
        "--danger": "#b91c1c",
        "--danger-border": "#fca5a5",
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
        "--surface-overlay": "#F1F8FF",
        "--input-bg": BACKGROUND,
        "--input-border": "#B5D2F8",
        "--shadow-soft": "0 10px 24px rgba(0, 122, 251, 0.10)",
        "--shadow-panel": "0 14px 30px rgba(0, 122, 251, 0.14)",
        "--shadow-glow": "0 0 0 2px rgba(0, 122, 251, 0.18)",
      }}
    >

      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "18px 14px", minHeight: "100vh", background: "var(--page-bg)", width: "100%", boxSizing: "border-box", alignItems: "flex-start" }}>
        <div
          className="admin-sidebar-spacer"
          style={{
            width: "var(--sidebar-width)",
            minWidth: "var(--sidebar-width)",
            flex: "0 0 var(--sidebar-width)",
            pointerEvents: "none",
          }}
        />

        {/* MIDDLE FEED COLUMN */}
        <div className="main-content google-main" style={{ flex: "1 1 0", minWidth: 0, maxWidth: "none", margin: "0", boxSizing: "border-box", alignSelf: "flex-start", minHeight: "calc(100vh - 24px)", overflowY: "visible", overflowX: "hidden", position: "relative", top: "auto", scrollbarWidth: "thin", scrollbarColor: "transparent transparent", padding: "0 12px 0 2px", display: "flex", justifyContent: "center", opacity: isOverlayModalOpen ? 0.45 : 1, filter: isOverlayModalOpen ? "blur(1px)" : "none", pointerEvents: isOverlayModalOpen ? "none" : "auto", transition: "opacity 180ms ease, filter 180ms ease" }}>
          <div style={{ width: "100%", maxWidth: FEED_SECTION_STYLE.maxWidth }}>
          {/* Feed header */}
          <div className="section-header-card" style={{ ...FEED_SECTION_STYLE, margin: "0 auto 14px" }}>
            <div className="section-header-card__title" style={{ fontSize: 17 }}>School Updates Feed</div>
            <div className="section-header-card__subtitle">Post announcements, payment reminders, and notices.</div>
          </div>

          {/* Post input box */}
          <div className="post-box" style={{ ...FEED_SECTION_STYLE, ...shellCardStyle, margin: "0 auto 14px", borderRadius: 12, overflow: "hidden", padding: "12px 14px" }}>
            <div
              className="fb-post-top"
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                background: "var(--surface-panel)",
                border: "none",
                boxShadow: "none",
                padding: 0,
              }}
            >
              <ProfileAvatar
                src={admin.profileImage}
                name={admin?.name || "Admin"}
                alt={admin?.name || "Admin"}
                style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border-soft)", flexShrink: 0 }}
              />
              <button
                type="button"
                onClick={() => setShowCreatePostModal(true)}
                style={{
                  flex: 1,
                  height: 42,
                  border: "1px solid var(--border-soft)",
                  background: "#f8fafc",
                  borderRadius: 999,
                  padding: "0 16px",
                  fontSize: 14,
                  textAlign: "left",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                What's on your mind?
              </button>
              <button
                type="button"
                onClick={() => setShowCreatePostModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  borderRadius: 10,
                  background: "#f8fafc",
                  color: "var(--danger)",
                  fontSize: 18,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                title="Live video"
              >
                <AiFillVideoCamera className="fb-icon" />
              </button>
              <button
                type="button"
                onClick={() => setShowCreatePostModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  borderRadius: 10,
                  background: "#f8fafc",
                  color: "var(--success)",
                  fontSize: 18,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                title="Photo"
              >
                <AiFillPicture className="fb-icon" />
              </button>
            </div>
          </div>

          {/* Posts container */}
          <div className="posts-container" style={{ ...FEED_SECTION_STYLE, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
            {shouldShowPostsLoadingState ? (
              <div style={{ ...shellCardStyle, borderRadius: 10, padding: "16px", fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>
                Loading posts...
              </div>
            ) : posts.length === 0 ? (
              <div style={{ ...shellCardStyle, borderRadius: 10, padding: "16px", fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>
                No posts available right now.
              </div>
            ) : posts.map((post) => {
              const messageText = String(post.message || "");
              const canExpandPost = shouldShowPostSeeMore(messageText);
              const isPostExpanded = !!expandedPostDescriptions[post.postId];
              const normalizedTargetRole = String(post.targetRole || "").trim().toLowerCase();
              const audienceLabel = formatAudienceLabel(normalizedTargetRole) || "Selected audience";
              const isPublicPost = !normalizedTargetRole || normalizedTargetRole === "all";
              const targetRoleLabel = isPublicPost ? "Visible to everyone" : `Visible to ${audienceLabel}`;
              const audienceBadgeLabel = isPublicPost ? "Public update" : `${audienceLabel} update`;
              const likeCount = getResolvedLikeCount(post);
              const isLikedByAdmin = isPostLikedByActor(post, currentLikeActorId);
              const isLikePending = Boolean(likePendingPostIds[post.postId]);
              const mediaUrl = getSafeMediaUrl(post.postUrl);
              const postTimestamp = post.time || post.createdAt || "";
              const postTimeLabel = formatPostTimestamp(postTimestamp);
              const postTimestampTitle = postTimestamp ? new Date(postTimestamp).toLocaleString() : "";

              return (
                <div className="facebook-post-card" id={`post-${post.postId}`} key={post.postId} style={{ ...shellCardStyle, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(15, 23, 42, 0.08)", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08), 0 8px 20px rgba(15, 23, 42, 0.04)", transition: "background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease" }}>
                  <div className="facebook-post-card__header" style={{ padding: "12px 14px 10px" }}>
                    <div className="facebook-post-card__header-main">
                      <div className="facebook-post-card__avatar">
                        <ProfileAvatar src={post.adminProfile} name={post.adminName || "Admin"} alt={post.adminName || "Admin"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div className="facebook-post-card__identity">
                        <div className="facebook-post-card__identity-row">
                          <h4>{post.adminName || "Admin"}</h4>
                          <span className="facebook-post-card__page-badge">School Page</span>
                        </div>
                        <div className="facebook-post-card__meta" title={postTimestampTitle || undefined}>
                          <span>{postTimeLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{targetRoleLabel}</span>
                        </div>
                      </div>
                    </div>
                    <div className="facebook-post-card__type-chip">Announcement</div>
                  </div>

                  {messageText ? (
                    <div className="facebook-post-card__body" style={{ padding: "0 14px 12px" }}>
                      <div className="facebook-post-card__message">
                        {canExpandPost && !isPostExpanded
                          ? `${messageText.slice(0, MESSAGE_PREVIEW_LIMIT).trimEnd()}...`
                          : messageText}
                      </div>
                      {canExpandPost ? (
                        <button type="button" className="facebook-post-card__read-more" onClick={() => togglePostDescription(post.postId)}>
                          {isPostExpanded ? "See less" : "Read more"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {mediaUrl ? (
                    <div className="facebook-post-card__media-shell">
                      <img className="facebook-post-card__media" src={mediaUrl} alt="post media" />
                    </div>
                  ) : null}

                  <div className="facebook-post-card__stats" style={{ padding: "10px 14px 8px" }}>
                    <div className="facebook-post-card__stats-left">
                      {likeCount > 0 ? (
                        <>
                          <span className="facebook-post-card__reaction-bubble">
                            <FaThumbsUp style={{ width: 10, height: 10 }} />
                          </span>
                          <span>{`${likeCount} ${likeCount === 1 ? "like" : "likes"}`}</span>
                        </>
                      ) : (
                        <span>Be the first to react</span>
                      )}
                    </div>
                    <div className="facebook-post-card__stats-right" title={targetRoleLabel}>
                      <span>{audienceBadgeLabel}</span>
                    </div>
                  </div>

                  <div className="facebook-post-card__actions" style={{ padding: "4px 10px 10px" }}>
                    <button type="button" aria-pressed={isLikedByAdmin} onClick={() => handleLike(post.postId)} disabled={isLikePending} className={`facebook-post-card__action-button${isLikedByAdmin ? " is-active" : ""}`} style={{ opacity: isLikePending ? 0.78 : 1, cursor: isLikePending ? "progress" : "pointer" }}>
                      {isLikedByAdmin ? <FaHeart style={{ width: 14, height: 14 }} /> : <FaRegHeart style={{ width: 14, height: 14 }} />}
                      <span>{isLikedByAdmin ? "Liked" : "Like"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>

        {/* RIGHT WIDGETS COLUMN */}
        <div
          className="right-widgets-spacer"
          style={{
            width: "clamp(300px, 21vw, 360px)",
            minWidth: 300,
            maxWidth: 360,
            flex: "0 0 clamp(300px, 21vw, 360px)",
            marginLeft: 10,
            pointerEvents: "none",
          }}
        />

        <div className="dashboard-widgets" onWheel={(event) => event.stopPropagation()} style={{ width: "clamp(300px, 21vw, 360px)", minWidth: 300, maxWidth: 360, flex: "0 0 clamp(300px, 21vw, 360px)", display: "flex", flexDirection: "column", gap: 12, alignSelf: "flex-start", height: "calc(100vh - 88px)", maxHeight: "calc(100vh - 88px)", overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", position: "fixed", top: 74, right: 14, scrollbarWidth: "thin", scrollbarColor: "transparent transparent", paddingRight: 2, paddingLeft: 14, paddingBottom: 14, marginLeft: 10, marginRight: 0, borderLeft: "none", opacity: isOverlayModalOpen ? 0.45 : 1, filter: isOverlayModalOpen ? "blur(1px)" : "none", pointerEvents: isOverlayModalOpen ? "none" : "auto", transition: "opacity 180ms ease, filter 180ms ease", zIndex: 20 }}>
          {/* Quick Statistics */}
          <div style={widgetCardStyle}>
            <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Quick Statistics</h4>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'nowrap' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={smallStatStyle}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Total Posts</div>
                  <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{posts.length}</div>
                </div>

                <div style={smallStatStyle}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Unread</div>
                  <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{messageCount}</div>
                </div>

                <div style={smallStatStyle}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Notifications</div>
                  <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{totalNotifications}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Today + Deadlines row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...widgetCardStyle, padding: '10px' }}>
              <h4 style={{ fontSize: 12, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Today's Activity</h4>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', ...softPanelStyle, padding: '7px 8px', fontSize: 10 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>New Posts</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{todaysPostsCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', ...softPanelStyle, padding: '7px 8px', fontSize: 10 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Messages</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{messageCount}</strong>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Recent Contacts</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', ...softPanelStyle, padding: '7px 8px', lineHeight: 1.45 }}>
                    Disabled on the dashboard to reduce Firebase background downloads.
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/all-chat')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', textAlign: 'center', ...softPanelStyle, padding: '8px 10px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 10, fontWeight: 800 }}
                  >
                    Open Messages
                  </button>
                </div>
              </div>
            </div>

            <div style={{ ...rightRailCardStyle, overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -34, right: -24, width: 104, height: 104, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 10%, transparent) 0%, transparent 74%)', pointerEvents: 'none' }} />
              <div style={{ padding: '14px 14px 12px', background: 'var(--surface-panel)', borderBottom: '1px solid rgba(15, 23, 42, 0.08)', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={rightRailIconStyle}>
                      <FaCalendarAlt style={{ width: 14, height: 14 }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 900, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>School Calendar</h4>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, fontWeight: 800 }}>{calendarMonthLabel}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
                        {`${calendarMonthStartGregorian.day}/${calendarMonthStartGregorian.month}/${calendarMonthStartGregorian.year} - ${calendarMonthEndGregorian.day}/${calendarMonthEndGregorian.month}/${calendarMonthEndGregorian.year}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => handleCalendarMonthChange(-1)} style={{ ...rightRailIconButtonStyle, fontSize: 17 }} aria-label="Previous month" title="Previous month">‹</button>
                    <button type="button" onClick={() => handleCalendarMonthChange(1)} style={{ ...rightRailIconButtonStyle, fontSize: 17 }} aria-label="Next month" title="Next month">›</button>
                  </div>
                </div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ ...rightRailPillStyle, color: 'var(--text-primary)' }}>{monthlyCalendarEvents.length} event{monthlyCalendarEvents.length === 1 ? '' : 's'}</div>
                    <div style={{ ...rightRailPillStyle, color: canManageCalendar ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{canManageCalendar ? 'Manage access' : 'View only'}</div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-soft)', borderRadius: 16, padding: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 6 }}>
                  {CALENDAR_WEEK_DAYS.map((day) => (
                    <div key={day} style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{day}</div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                  {calendarDays.map((day, index) => {
                    const isToday = day?.ethDay === calendarHighlightedDay;
                    const dayOfWeek = index % 7;
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const primaryEvent = day?.events?.[0] || null;
                    const isNoClassDay = primaryEvent?.category === 'no-class';
                    const isAcademicDay = primaryEvent?.category === 'academic';
                    const isSelected = day?.isoDate === selectedCalendarIsoDate;
                    const isHovered = day?.isoDate === hoveredCalendarIsoDate;
                    const dayBackground = day
                      ? isToday
                        ? 'var(--accent-soft)'
                        : isSelected
                          ? 'color-mix(in srgb, var(--accent-soft) 72%, white 28%)'
                          : isNoClassDay
                            ? 'color-mix(in srgb, var(--warning-soft) 58%, white 42%)'
                            : isAcademicDay
                              ? 'color-mix(in srgb, var(--accent-soft) 46%, white 54%)'
                              : isWeekend
                                ? 'color-mix(in srgb, var(--surface-muted) 82%, white 18%)'
                                : 'var(--surface-panel)'
                      : 'transparent';

                    return (
                      <button
                        type="button"
                        key={`${day?.ethDay || 'blank'}-${index}`}
                        onClick={() => day && setSelectedCalendarIsoDate(day.isoDate)}
                        onMouseEnter={() => day && setHoveredCalendarIsoDate(day.isoDate)}
                        onMouseLeave={() => setHoveredCalendarIsoDate("")}
                        onFocus={() => day && setHoveredCalendarIsoDate(day.isoDate)}
                        onBlur={() => setHoveredCalendarIsoDate("")}
                        title={day?.events?.length ? day.events.map((eventItem) => eventItem.title).join(', ') : ''}
                        style={{ minHeight: 0, aspectRatio: '1 / 1', borderRadius: 10, border: isToday ? '1px solid var(--accent)' : isSelected ? '1px solid var(--accent-strong)' : isHovered ? '1px solid var(--border-strong)' : isNoClassDay ? '1px solid var(--warning-border)' : '1px solid var(--border-soft)', background: dayBackground, color: isToday ? 'var(--accent-strong)' : day ? 'var(--text-secondary)' : 'transparent', fontSize: 10, fontWeight: isToday ? 800 : 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '5px 2px', boxShadow: day && isSelected ? '0 8px 18px rgba(0, 122, 251, 0.12)' : 'none', cursor: day ? 'pointer' : 'default', outline: 'none', transform: day && isSelected ? 'translateY(-2px) scale(1.03)' : day && isHovered ? 'translateY(-1px)' : 'translateY(0)', transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease', position: 'relative', overflow: 'hidden' }}
                        disabled={!day}
                      >
                        {day ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 800, color: isToday || isSelected ? 'var(--accent-strong)' : 'var(--text-primary)', lineHeight: 1 }}>{day.ethDay}</div>
                            <div style={{ fontSize: 8, color: isSelected ? 'var(--accent)' : 'var(--text-muted)', lineHeight: 1 }}>{day.gregorianDate.day}/{day.gregorianDate.month}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 6 }}>
                              {day.events.slice(0, 2).map((eventItem) => (
                                <span key={eventItem.id} style={{ width: 5, height: 5, borderRadius: '50%', background: getCalendarEventMeta(eventItem.category).color }} />
                              ))}
                            </div>
                          </>
                        ) : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10,marginLeft: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--text-secondary)', fontWeight: 800, background: 'var(--surface-panel)', border: '1px solid var(--warning-border)', borderRadius: 999, padding: '5px 8px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)' }} /> No class</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--text-secondary)', fontWeight: 800, background: 'var(--surface-panel)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '5px 8px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} /> Academic</div>
                {canManageCalendar ? (
                  <button type="button" onClick={handleOpenCalendarEventModal} style={{ ...rightRailIconButtonStyle, width: 30, height: 30, borderRadius: 999, color: 'var(--text-primary)' }} aria-label="Add school calendar event" title="Add school calendar event"><FaPlus style={{ width: 12, height: 12 }} /></button>
                ) : null}
              </div>

              {calendarActionMessage ? (
                <div style={{ marginTop: 10, borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--accent-soft)', color: 'var(--accent-strong)', fontSize: 10, fontWeight: 800, padding: '8px 10px' }}>{calendarActionMessage}</div>
              ) : null}

              <div style={{ marginTop: 12, background: 'var(--surface-panel)', border: '1px solid var(--border-soft)', borderRadius: 14, padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-primary)' }}>{selectedCalendarDay ? `${ETHIOPIAN_MONTHS[calendarViewDate.month - 1]} ${selectedCalendarDay.ethDay}, ${calendarViewDate.year}` : 'Select a date'}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{selectedCalendarDay ? `Gregorian ${selectedCalendarDay.gregorianDate.day}/${selectedCalendarDay.gregorianDate.month}/${selectedCalendarDay.gregorianDate.year}` : 'Choose a day to view or add calendar events.'}</div>
                  </div>
                  {calendarEventsLoading && <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>Loading...</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {selectedCalendarEvents.length === 0 ? (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--surface-muted)', borderRadius: 10, border: '1px solid var(--border-soft)', padding: '7px 9px' }}>No school events on this day.</div>
                  ) : (
                    selectedCalendarEvents.map((eventItem) => {
                      const eventMeta = getCalendarEventMeta(eventItem.category);
                      return (
                        <div key={eventItem.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, background: 'var(--surface-panel)', border: `1px solid ${eventMeta.border}`, borderRadius: 10, padding: '7px 8px' }}>
                          <span style={{ width: 8, height: 8, marginTop: 4, borderRadius: '50%', background: eventMeta.color, flexShrink: 0 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-primary)' }}>{eventItem.title}</div>
                              {eventItem.isDefault ? <span style={{ padding: '2px 6px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent-strong)', fontSize: 9, fontWeight: 800 }}>Default</span> : null}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{eventMeta.label}</div>
                            {eventItem.notes ? <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 3 }}>{eventItem.notes}</div> : null}
                          </div>
                          {canManageCalendar && !eventItem.isDefault ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <button type="button" onClick={() => handleEditCalendarEvent(eventItem)} style={{ height: 26, padding: '0 9px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--surface-panel)', color: 'var(--text-secondary)', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>Edit</button>
                              <button type="button" onClick={() => handleDeleteCalendarEvent(eventItem)} disabled={calendarEventSaving} style={{ height: 26, padding: '0 9px', borderRadius: 8, border: '1px solid var(--danger-border)', background: 'var(--surface-panel)', color: 'var(--danger)', fontSize: 9, fontWeight: 800, cursor: calendarEventSaving ? 'not-allowed' : 'pointer' }}>Delete</button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div style={widgetCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Upcoming Deadlines</h4>
                {canManageCalendar ? <button type="button" onClick={handleOpenDeadlineModal} style={{ ...rightRailIconButtonStyle, borderRadius: 999, color: 'var(--text-primary)' }} aria-label="Add upcoming deadline" title="Add upcoming deadline"><FaPlus style={{ width: 11, height: 11 }} /></button> : null}
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {calendarEventsLoading ? (
                  <div style={{ padding: '8px 9px', borderRadius: 10, border: '1px solid rgba(15, 23, 42, 0.06)', background: '#F8FAFC', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>Loading deadlines...</div>
                ) : upcomingDeadlineEvents.length === 0 ? (
                  <div style={{ padding: '8px 9px', borderRadius: 10, border: '1px solid rgba(15, 23, 42, 0.06)', background: '#F8FAFC', fontSize: 10, color: 'var(--text-muted)' }}>
                    No upcoming deadlines in the next 30 days.
                    {canManageCalendar ? <button type="button" onClick={handleOpenDeadlineModal} style={{ marginTop: 8, height: 28, padding: '0 10px', borderRadius: 999, border: '1px solid rgba(15, 23, 42, 0.08)', background: 'var(--surface-panel)', color: 'var(--text-primary)', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>Add deadline</button> : null}
                  </div>
                ) : (
                  visibleUpcomingDeadlineEvents.map((eventItem) => {
                    const eventMeta = getCalendarEventMeta(eventItem.category);
                    return (
                      <div key={`deadline-${eventItem.id}`} style={{ padding: '8px 9px', borderRadius: 10, border: `1px solid ${eventMeta.border}`, background: 'var(--surface-muted)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: eventMeta.color, flexShrink: 0 }} /><span>{eventItem.title?.trim() || eventItem.notes?.trim() || 'Academic deadline'}</span></div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>{eventMeta.label}{eventItem.ethiopianDate?.month && eventItem.ethiopianDate?.day ? ` • ${ETHIOPIAN_MONTHS[eventItem.ethiopianDate.month - 1]} ${eventItem.ethiopianDate.day}` : ''}</div>
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatCalendarDeadlineDate(eventItem.gregorianDate)}</div>
                      </div>
                    );
                  })
                )}
                {!calendarEventsLoading && upcomingDeadlineEvents.length > 3 ? <button type="button" onClick={() => setShowAllUpcomingDeadlines((currentValue) => !currentValue)} style={{ alignSelf: 'flex-start', height: 28, padding: '0 10px', borderRadius: 999, border: '1px solid var(--border-soft)', background: 'var(--surface-panel)', color: 'var(--accent-strong)', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>{showAllUpcomingDeadlines ? 'See less' : `See more (${upcomingDeadlineEvents.length - 3})`}</button> : null}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div style={widgetCardStyle}>
            <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Sponsored Links</h4>
            <ul style={{ margin: '10px 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
              <li style={{ ...softPanelStyle, color: 'var(--text-primary)', fontWeight: 700, padding: '8px 10px' }}>Gojo Study App</li>
              <li style={{ ...softPanelStyle, color: 'var(--text-primary)', fontWeight: 700, padding: '8px 10px' }}>Finance Portal</li>
              <li style={{ ...softPanelStyle, color: 'var(--text-primary)', fontWeight: 700, padding: '8px 10px' }}>HR Management</li>
            </ul>
          </div>
        </div>
      </div>

      {showCreatePostModal && (
        <>
          <div
            onClick={() => setShowCreatePostModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.18)",
              backdropFilter: "blur(10px)",
              zIndex: 1200,
            }}
          />
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1201,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 12,
              pointerEvents: "none",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(640px, 100%)",
                maxHeight: "90vh",
                overflowY: "auto",
                background: "var(--surface-panel)",
                borderRadius: 28,
                border: "1px solid var(--border-soft)",
                boxShadow: "0 16px 36px rgba(15, 23, 42, 0.10)",
                pointerEvents: "auto",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "relative",
                  padding: "22px 24px 18px",
                  borderBottom: "1px solid var(--border-soft)",
                  background: "var(--surface-panel)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingRight: 52 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", width: "fit-content", height: 28, padding: "0 12px", borderRadius: 999, background: "var(--accent-soft)", border: "1px solid var(--border-strong)", color: "var(--accent-strong)", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    School Announcement
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1, letterSpacing: "-0.03em" }}>
                    Create a new post
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, maxWidth: 420 }}>
                    Share polished announcements, reminders, and updates with the right audience.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreatePostModal(false)}
                  style={{ position: "absolute", right: 18, top: 18, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", width: 40, height: 40, borderRadius: "50%", fontSize: 22, color: "var(--text-secondary)", cursor: "pointer", lineHeight: 1 }}
                  aria-label="Close create post modal"
                  title="Close"
                >
                  ×
                </button>
              </div>

              <div style={{ padding: "22px 24px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", padding: "14px 16px", borderRadius: 20, border: "1px solid var(--border-soft)", background: "var(--surface-muted)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--border-strong)", boxShadow: "var(--shadow-glow)", flexShrink: 0 }}>
                      <ProfileAvatar
                        src={admin?.profileImage}
                        name={admin?.name || "Admin"}
                        alt={admin?.name || "Admin"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {admin?.name || "Admin"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                        Posting from the admin dashboard
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 170 }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Audience
                    </div>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      style={{ height: 40, borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--input-bg)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", padding: "0 36px 0 12px", minWidth: 170, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)" }}
                      title="Post target role"
                    >
                      {targetOptions.map((role) => {
                        const label = role === "all" ? "All Users" : `${role.charAt(0).toUpperCase()}${role.slice(1)}s`;
                        return (
                          <option key={role} value={role}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div style={{ border: "1px solid var(--border-soft)", borderRadius: 24, background: "var(--surface-panel)", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px 12px", borderBottom: "1px solid color-mix(in srgb, var(--border-soft) 80%, transparent 20%)" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>Post message</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                      {postText.trim().length} characters
                    </div>
                  </div>

                  <textarea
                    placeholder="Write a clear announcement for your school community..."
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    style={{
                      minHeight: 220,
                      resize: "vertical",
                      border: "none",
                      background: "transparent",
                      borderRadius: 0,
                      padding: "18px 18px 16px",
                      fontSize: 19,
                      lineHeight: 1.6,
                      outline: "none",
                      color: "var(--text-primary)",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ border: "1px solid var(--border-soft)", borderRadius: 20, padding: "14px 16px", background: "var(--surface-panel)" }}>
                  <div className="fb-post-bottom" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ marginRight: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Media and attachments</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Add a photo or video to make the update stand out.</div>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handlePostMediaSelection}
                      accept="image/*,video/*"
                      style={{ display: "none" }}
                    />

                    <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "16px 18px", background: "linear-gradient(180deg, var(--surface-muted) 0%, #ffffff 100%)", borderRadius: 18, border: "1px dashed var(--border-strong)", boxSizing: "border-box", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 260px" }}>
                        <div style={{ width: 46, height: 46, borderRadius: 14, background: "var(--accent-soft)", border: "1px solid var(--border-strong)", color: "var(--accent-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                          {postMedia && String(postMedia.type || "").startsWith("video/") ? <AiFillVideoCamera /> : <AiFillPicture />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>
                            {postMedia ? "Media ready to attach" : "Choose a photo or video"}
                          </div>
                          <div style={{ marginTop: 3, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
                            {isOptimizingMedia
                              ? "Optimizing your image before upload."
                              : "Images are automatically compressed and converted to JPEG when that reduces size."}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginLeft: "auto" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 999, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", fontSize: 11, fontWeight: 800, letterSpacing: "0.02em" }}>
                          <AiFillVideoCamera style={{ color: "var(--danger)", fontSize: 15 }} />
                          Photos and videos
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenPostMediaPicker}
                          disabled={isOptimizingMedia}
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 42, padding: "0 18px", borderRadius: 999, background: isOptimizingMedia ? "var(--surface-strong)" : "var(--accent)", border: "none", cursor: isOptimizingMedia ? "progress" : "pointer", color: "#fff", fontSize: 13, fontWeight: 800, opacity: isOptimizingMedia ? 0.86 : 1, minWidth: 138 }}
                        >
                          <AiFillPicture style={{ fontSize: 17 }} />
                          <span>{isOptimizingMedia ? "Optimizing..." : postMedia ? "Change file" : "Choose file"}</span>
                        </button>
                      </div>
                    </div>

                    {postMedia && (
                      <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--surface-muted)", borderRadius: 16, border: "1px solid var(--border-soft)", boxSizing: "border-box" }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: String(postMedia.type || "").startsWith("video/") ? "var(--warning-soft)" : "var(--success-soft)", color: String(postMedia.type || "").startsWith("video/") ? "var(--danger)" : "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {String(postMedia.type || "").startsWith("video/") ? <AiFillVideoCamera style={{ fontSize: 20 }} /> : <AiFillPicture style={{ fontSize: 20 }} />}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {postMedia.name}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                            {postMediaMeta?.wasCompressed
                              ? `Optimized from ${formatFileSize(postMediaMeta.originalSize)} to ${formatFileSize(postMediaMeta.finalSize)}${postMediaMeta.wasConvertedToJpeg ? " as JPEG" : ""}`
                              : `Ready to attach to this post${postMediaMeta?.wasConvertedToJpeg ? " as JPEG" : ""}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPostMedia(null);
                            setPostMediaMeta(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", color: "var(--text-secondary)", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 }}
                          aria-label="Remove selected media"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingTop: 2 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Your post will appear in the school feed immediately after publishing.
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
                    <button
                      type="button"
                      onClick={() => setShowCreatePostModal(false)}
                      style={{
                        height: 44,
                        padding: "0 18px",
                        borderRadius: 999,
                        border: "1px solid var(--border-soft)",
                        background: "var(--surface-panel)",
                        color: "var(--text-secondary)",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>

                    {postSubmitError ? (
                      <div style={{ color: "var(--danger)", fontSize: 12, fontWeight: 700, marginRight: "auto" }}>
                        {postSubmitError}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleSubmitCreatePost}
                      disabled={!canSubmitPost || postSubmitting}
                      style={{
                        minWidth: 160,
                        height: 46,
                        border: "none",
                        background: canSubmitPost && !postSubmitting ? "var(--accent)" : "var(--surface-strong)",
                        borderRadius: 999,
                        color: canSubmitPost && !postSubmitting ? "#fff" : "var(--text-muted)",
                        fontSize: 14,
                        fontWeight: 800,
                        letterSpacing: "0.01em",
                        cursor: canSubmitPost && !postSubmitting ? "pointer" : "not-allowed",
                        boxShadow: canSubmitPost && !postSubmitting ? "0 8px 18px rgba(0, 122, 251, 0.14)" : "none",
                      }}
                    >
                      {postSubmitting ? "Publishing..." : isOptimizingMedia ? "Optimizing..." : "Publish post"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showCalendarEventModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'color-mix(in srgb, var(--text-primary) 26%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1200,
          }}
          onClick={handleCloseCalendarEventModal}
        >
          <div
            style={{
              width: 'min(470px, 100%)',
              background: 'var(--surface-panel)',
              borderRadius: 20,
              border: '1px solid var(--border-soft)',
              boxShadow: 'var(--shadow-panel)',
              overflow: 'hidden',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: '16px 16px 12px', background: 'linear-gradient(180deg, var(--surface-overlay) 0%, var(--surface-panel) 100%)', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)' }}>
                  {editingCalendarEventId
                    ? 'Edit school calendar event'
                    : calendarModalContext === 'deadline'
                      ? 'Add upcoming deadline'
                      : 'Add school calendar event'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {selectedCalendarDay
                    ? calendarModalContext === 'deadline'
                      ? `Choose the date for this upcoming deadline in ${ETHIOPIAN_MONTHS[calendarViewDate.month - 1]}`
                      : `For Ethiopic day ${selectedCalendarDay.ethDay} in ${ETHIOPIAN_MONTHS[calendarViewDate.month - 1]}`
                    : 'Select a day in the calendar first.'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseCalendarEventModal}
                style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid var(--border-soft)', background: 'var(--surface-overlay)', color: 'var(--text-secondary)', fontSize: 20, lineHeight: 1, cursor: 'pointer' }}
                aria-label="Close calendar event modal"
              >
                ×
              </button>
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!canManageCalendar ? (
                <div style={{ fontSize: 10, color: 'var(--warning)', background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 10, padding: '8px 10px' }}>
                  View only. Registrar or admin access is required to add, edit, or delete school calendar events.
                </div>
              ) : null}

              <div style={{ border: '1px solid var(--border-soft)', borderRadius: 16, padding: 10, background: 'linear-gradient(180deg, var(--surface-overlay) 0%, var(--surface-panel) 100%)', boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 45%, transparent), var(--shadow-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-primary)' }}>Choose day from calendar</div>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{calendarMonthLabel}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button type="button" onClick={() => handleCalendarMonthChange(-1)} style={{ width: 28, height: 28, borderRadius: 9, border: '1px solid var(--border-soft)', background: 'var(--surface-overlay)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 16, lineHeight: 1, boxShadow: 'var(--shadow-soft)' }} aria-label="Previous Ethiopian month">‹</button>
                    <button type="button" onClick={() => handleCalendarMonthChange(1)} style={{ width: 28, height: 28, borderRadius: 9, border: '1px solid var(--border-soft)', background: 'var(--surface-overlay)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 16, lineHeight: 1, boxShadow: 'var(--shadow-soft)' }} aria-label="Next Ethiopian month">›</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 5 }}>
                  {CALENDAR_WEEK_DAYS.map((dayLabel) => (
                    <div key={dayLabel} style={{ textAlign: 'center', fontSize: 8, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{dayLabel}</div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                  {calendarDays.map((dayItem, index) => {
                    const isSelectedDay = dayItem?.isoDate === selectedCalendarIsoDate;
                    const hasEvents = (dayItem?.events?.length || 0) > 0;
                    const isTodayDay = dayItem?.ethDay === calendarHighlightedDay;
                    const cellBackground = !dayItem
                      ? 'transparent'
                      : isTodayDay
                        ? 'linear-gradient(145deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent) 22%, var(--surface-overlay)) 100%)'
                        : isSelectedDay
                          ? 'linear-gradient(145deg, var(--surface-overlay) 0%, var(--accent-soft) 55%, color-mix(in srgb, var(--accent) 22%, var(--surface-overlay)) 100%)'
                          : hasEvents
                            ? 'linear-gradient(145deg, color-mix(in srgb, var(--warning-soft) 72%, var(--surface-panel)) 0%, var(--warning-soft) 100%)'
                            : 'linear-gradient(145deg, var(--surface-panel) 0%, var(--surface-overlay) 100%)';

                    return (
                      <button
                        key={`${dayItem?.isoDate || 'blank'}-${index}`}
                        type="button"
                        onClick={() => dayItem && setSelectedCalendarIsoDate(dayItem.isoDate)}
                        disabled={!dayItem || !canManageCalendar}
                        style={{ minHeight: 0, aspectRatio: '1 / 1', borderRadius: 10, border: isTodayDay ? '1px solid var(--accent)' : isSelectedDay ? '1px solid var(--accent-strong)' : hasEvents ? '1px solid var(--warning-border)' : '1px solid transparent', background: cellBackground, color: !dayItem ? 'transparent' : isSelectedDay || isTodayDay ? 'var(--accent-strong)' : 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: dayItem && canManageCalendar ? 'pointer' : 'default', boxShadow: isSelectedDay ? '0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent), 0 12px 22px color-mix(in srgb, var(--accent-strong) 18%, transparent)' : isTodayDay ? '0 10px 18px color-mix(in srgb, var(--accent-strong) 14%, transparent)' : 'var(--shadow-soft)', padding: '4px 2px', overflow: 'hidden', position: 'relative', transform: isSelectedDay ? 'translateY(-1px) scale(1.02)' : 'translateY(0) scale(1)', transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease' }}
                      >
                        {dayItem ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 800, lineHeight: 1 }}>{dayItem.ethDay}</div>
                            <div style={{ fontSize: 8, color: isSelectedDay ? 'var(--accent-strong)' : 'var(--text-secondary)', lineHeight: 1 }}>{dayItem.gregorianDate.day}/{dayItem.gregorianDate.month}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 6 }}>
                              {dayItem.events.slice(0, 2).map((eventItem) => (
                                <span key={eventItem.id} style={{ width: 5, height: 5, borderRadius: '50%', background: getCalendarEventMeta(eventItem.category).color, boxShadow: '0 0 0 2px color-mix(in srgb, var(--surface-panel) 82%, transparent)' }} />
                              ))}
                            </div>
                          </>
                        ) : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              {calendarModalContext === 'deadline' ? (
                <div style={{ height: 42, borderRadius: 12, border: '1px solid var(--success-border)', padding: '0 12px', fontSize: 12, color: 'var(--success)', background: 'var(--success-soft)', display: 'flex', alignItems: 'center', fontWeight: 800 }}>Academic deadline</div>
              ) : (
                <select value={calendarEventForm.category} onChange={(e) => setCalendarEventForm((prev) => ({ ...prev, category: e.target.value, subType: 'general' }))} disabled={!canManageCalendar} style={{ height: 42, borderRadius: 12, border: '1px solid var(--input-border)', padding: '0 12px', fontSize: 12, color: 'var(--text-primary)', background: 'var(--input-bg)' }}>
                  <option value="no-class">No class day</option>
                  <option value="academic">Academic day</option>
                </select>
              )}

              {calendarModalContext === 'deadline' ? (
                <input type="text" value={calendarEventForm.title} onChange={(e) => setCalendarEventForm((prev) => ({ ...prev, title: e.target.value }))} disabled={!canManageCalendar} placeholder="Deadline title" style={{ height: 42, borderRadius: 12, border: '1px solid var(--input-border)', padding: '0 12px', fontSize: 12, color: 'var(--text-primary)', background: 'var(--input-bg)' }} />
              ) : null}

              <textarea value={calendarEventForm.notes} onChange={(e) => setCalendarEventForm((prev) => ({ ...prev, notes: e.target.value }))} disabled={!canManageCalendar} placeholder={calendarModalContext === 'deadline' ? 'Optional deadline note' : 'Optional note'} rows={3} style={{ borderRadius: 12, border: '1px solid var(--input-border)', padding: '12px', fontSize: 12, color: 'var(--text-primary)', background: 'var(--input-bg)', resize: 'vertical' }} />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                <button type="button" onClick={handleCreateCalendarEvent} disabled={calendarEventSaving || !selectedCalendarDay || !canManageCalendar} style={{ flex: '1 1 180px', height: 42, borderRadius: 12, border: 'none', background: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? 'var(--surface-strong)' : 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)', color: '#fff', fontSize: 12, fontWeight: 900, cursor: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? 'not-allowed' : 'pointer', boxShadow: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? 'none' : '0 12px 18px color-mix(in srgb, var(--accent-strong) 18%, transparent)' }}>
                  {calendarEventSaving ? 'Saving...' : editingCalendarEventId ? 'Update calendar event' : 'Save calendar event'}
                </button>
                <button type="button" onClick={handleCloseCalendarEventModal} style={{ height: 42, padding: '0 14px', borderRadius: 12, border: '1px solid var(--border-soft)', background: 'var(--surface-overlay)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .posts-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          margin-left: 0;
        }
        .post-box {
          width: 100%;
          margin-left: auto;
          margin-right: auto;
          margin-top: 12px;
        }
        .facebook-post-card {
          width: 100%;
          max-width: 680px;
          margin: 0 auto;
          position: relative;
          isolation: isolate;
        }
        .facebook-post-card:hover {
          transform: translateY(-2px);
        }
        .facebook-post-card__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .facebook-post-card__header-main {
          min-width: 0;
          flex: 1;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .facebook-post-card__avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
          background: #fff;
        }
        .facebook-post-card__identity {
          min-width: 0;
          flex: 1;
        }
        .facebook-post-card__identity-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .facebook-post-card__identity-row h4 {
          margin: 0;
          font-size: 14px;
          line-height: 1.25;
          font-weight: 800;
          color: var(--text-primary);
        }
        .facebook-post-card__page-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 999px;
          background: #e7f3ff;
          color: #0866ff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.02em;
        }
        .facebook-post-card__meta {
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          font-size: 11px;
          font-weight: 600;
          color: #65676b;
        }
        .facebook-post-card__type-chip {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border-radius: 999px;
          background: linear-gradient(135deg, #f0f6ff 0%, #e7f3ff 100%);
          border: 1px solid #bfdcff;
          color: #0866ff;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .facebook-post-card__body {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .facebook-post-card__message {
          color: var(--text-primary);
          font-size: 14px;
          line-height: 1.45;
          word-break: break-word;
          white-space: pre-wrap;
        }
        .facebook-post-card__read-more {
          align-self: flex-start;
          padding: 0;
          border: none;
          background: transparent;
          color: #0866ff;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
        }
        .facebook-post-card__media-shell {
          background: #eff2f5;
          border-top: 1px solid rgba(15, 23, 42, 0.08);
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .facebook-post-card__media {
          width: 100%;
          height: auto;
          max-height: min(68vh, 540px);
          object-fit: contain;
          display: block;
          background: #eff2f5;
        }
        .facebook-post-card__stats {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        }
        .facebook-post-card__stats-left,
        .facebook-post-card__stats-right {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 600;
          color: #65676b;
        }
        .facebook-post-card__stats-right {
          justify-content: flex-end;
          text-align: right;
        }
        .facebook-post-card__reaction-bubble {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: #0866ff;
          color: #fff;
          box-shadow: 0 6px 16px rgba(8, 102, 255, 0.22);
        }
        .facebook-post-card__actions {
          display: flex;
        }
        .facebook-post-card__action-button {
          width: 100%;
          min-height: 36px;
          border: none;
          border-radius: 8px;
          background: transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          color: #65676b;
          font-size: 13px;
          font-weight: 800;
          transition: background 160ms ease, color 160ms ease, transform 160ms ease;
        }
        .facebook-post-card__action-button:hover {
          background: #f2f4f7;
        }
        .facebook-post-card__action-button.is-active {
          background: #e7f3ff;
          color: #0866ff;
        }
        .facebook-post-card__action-button:active {
          transform: translateY(1px);
        }
        @media (max-width: 720px) {
          .facebook-post-card__header {
            flex-wrap: wrap;
          }
          .facebook-post-card__type-chip {
            order: 3;
          }
          .facebook-post-card__stats {
            flex-direction: column;
            align-items: flex-start;
          }
          .facebook-post-card__stats-right {
            justify-content: flex-start;
            text-align: left;
          }
        }
        @media (max-width: 600px) {
          .posts-container {
            margin-left: 0 !important;
          }
          .post-box {
            margin-top: 0 !important;
          }
        }
        @media (max-width: 600px) {
          .posts-full-mobile,
          .posts-container,
          .post-box {
            width: 100vw !important;
            max-width: 100vw !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .posts-container {
            align-items: stretch;
          }
        }
        @media (max-width: 1100px) {
          .admin-sidebar-spacer,
          .right-widgets-spacer,
          .dashboard-widgets {
            display: none !important;
          }

          .dashboard-page .google-sidebar {
            position: static !important;
            top: auto !important;
            left: auto !important;
            width: 100% !important;
            min-width: 0 !important;
            max-width: none !important;
            height: auto !important;
            max-height: none !important;
            margin: 0 0 12px 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

export default Dashboard;
