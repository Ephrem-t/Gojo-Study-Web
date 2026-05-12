import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AiFillPicture, AiFillVideoCamera } from "react-icons/ai";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaFacebookMessenger,
  FaCalendarAlt,
  FaPlus,
} from "react-icons/fa";
import "../styles/global.css";
import { BACKEND_BASE } from "../config.js";
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
      id: `default-${ethiopianYear}-${eventItem.month}-${eventItem.day}-${eventItem.title}`,
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

const isVideoMediaUrl = (mediaUrl, mediaType = "") => {
  const normalizedMediaType = String(mediaType || "").trim().toLowerCase();
  if (normalizedMediaType.startsWith("video/")) {
    return true;
  }

  const normalizedUrl = String(mediaUrl || "").trim().toLowerCase();
  return /\.(mp4|webm|ogg|mov|m4v|avi)(\?|#|$)/.test(normalizedUrl);
};

const parsePostTimestamp = (postValue) => {
  const rawCandidates = [
    postValue?.time,
    postValue?.createdAt,
    postValue?.timestamp,
    postValue?.postedAt,
    postValue?.date,
  ];

  for (const rawValue of rawCandidates) {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      continue;
    }

    if (typeof rawValue === "number") {
      const normalizedValue = rawValue < 1e12 ? rawValue * 1000 : rawValue;
      const parsedNumberDate = new Date(normalizedValue);
      if (!Number.isNaN(parsedNumberDate.getTime())) {
        return parsedNumberDate;
      }
      continue;
    }

    const parsedStringDate = new Date(rawValue);
    if (!Number.isNaN(parsedStringDate.getTime())) {
      return parsedStringDate;
    }
  }

  return null;
};

const formatCompactDate = (dateValue) => {
  const parsedDate = parsePostTimestamp(dateValue);
  if (!parsedDate) {
    return "";
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const skeletonBaseStyle = {
  background: "linear-gradient(90deg, color-mix(in srgb, var(--surface-muted) 92%, white) 0%, color-mix(in srgb, var(--surface-panel) 72%, white) 50%, color-mix(in srgb, var(--surface-muted) 92%, white) 100%)",
  backgroundSize: "200% 100%",
  animation: "myPostsSkeletonPulse 1.2s ease-in-out infinite",
  borderRadius: 10,
};

function MyPosts() {
  const API_BASE = `${BACKEND_BASE}/api`;
  const _storedAdmin = (() => {
    try {
      return JSON.parse(localStorage.getItem("admin")) || {};
    } catch (error) {
      return {};
    }
  })();
  const initialAdminId = _storedAdmin?.userId || null;
  const readStoredMyPostsCache = (adminIdValue) => {
    if (!adminIdValue) {
      return [];
    }

    try {
      const rawCache = localStorage.getItem(`my_posts_cache_${adminIdValue}`);
      if (!rawCache) {
        return [];
      }

      const parsedCache = JSON.parse(rawCache);
      if (!Array.isArray(parsedCache)) {
        return [];
      }

      return parsedCache.filter((postItem) => postItem && typeof postItem === "object");
    } catch (error) {
      return [];
    }
  };
  const initialCachedPosts = readStoredMyPostsCache(initialAdminId);
  const [posts, setPosts] = useState(initialCachedPosts);
  const [postsLoading, setPostsLoading] = useState(initialCachedPosts.length === 0 && Boolean(initialAdminId));
  const [postsInitialized, setPostsInitialized] = useState(initialCachedPosts.length > 0);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);
  const [postMediaMeta, setPostMediaMeta] = useState(null);
  const [targetRole, setTargetRole] = useState("all");
  const [targetOptions] = useState(["all", "student", "parent", "teacher", "registerer", "finance", "admin"]);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [posting, setPosting] = useState(false);
  const [isOptimizingMedia, setIsOptimizingMedia] = useState(false);
  const fileInputRef = useRef(null);
  const postsFetchRequestIdRef = useRef(0);
  const [postNotifications, setPostNotifications] = useState([]);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
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

  // loading states for edit/delete
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  // Per-user record cache to avoid re-downloading the same user repeatedly
  const notificationUserCacheRef = useRef(new Map());
  const navigate = useNavigate();
  const location = useLocation();
  const FEED_MAX_WIDTH = 760;
  const FEED_SECTION_STYLE = {
    width: "100%",
    maxWidth: FEED_MAX_WIDTH,
    margin: "0 auto",
    boxSizing: "border-box",
  };
  const isOverlayModalOpen = showCreatePostModal || showCalendarEventModal;
  const mediaPostCount = posts.filter((post) => Boolean(post.postUrl)).length;
  const totalPostLikes = posts.reduce((sum, post) => sum + Number(post.likeCount || 0), 0);

  const shellCardStyle = {
    background: "var(--surface-panel)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-soft)",
    borderRadius: 16,
    boxShadow: "var(--shadow-soft)",
  };
  const widgetCardStyle = {
    background: "var(--page-bg)",
    borderRadius: 16,
    padding: "11px",
    border: "1px solid var(--border-soft)",
  };
  const rightRailCardStyle = {
    background: "var(--surface-panel)",
    borderRadius: 12,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08), 0 8px 20px rgba(15, 23, 42, 0.04)",
    border: "1px solid rgba(15, 23, 42, 0.08)",
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
  const softPanelStyle = {
    background: "var(--surface-muted)",
    border: "1px solid var(--border-soft)",
    borderRadius: 10,
  };
  const smallStatStyle = {
    padding: "5px 8px",
    borderRadius: 12,
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: 72,
  };
  const subtleButtonStyle = {
    border: "1px solid var(--border-soft)",
    background: "var(--surface-panel)",
    color: "var(--text-secondary)",
  };
  // Read admin from localStorage
  const admin = _storedAdmin;
  const adminId = admin?.userId || null;
  const token =
    admin?.token ||
    admin?.accessToken ||
    admin?.idToken ||
    admin?.apiKey ||
    null;
  const schoolCode = admin?.schoolCode || "";
  const DB_ROOT = schoolCode
    ? `https://bale-house-rental-default-rtdb.firebaseio.com/Platform1/Schools/${schoolCode}`
    : "https://bale-house-rental-default-rtdb.firebaseio.com";
  const currentCalendarRole = String(admin?.role || admin?.userType || "admin").trim().toLowerCase().replace(/-/g, "_");
  const canManageCalendar = CALENDAR_MANAGER_ROLES.has(currentCalendarRole);
  const shouldShowPostsLoadingState = (postsLoading || !postsInitialized) && posts.length === 0;
  const myPostsCacheKey = adminId ? `my_posts_cache_${adminId}` : "";

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      axios.defaults.headers.common["x-access-token"] = token;
    } else {
      delete axios.defaults.headers.common["Authorization"];
      delete axios.defaults.headers.common["x-access-token"];
    }
  }, [token]);


  const renderSkeletonLine = (width, height = 12, extraStyle = {}) => (
    <div style={{ ...skeletonBaseStyle, width, height, ...extraStyle }} />
  );

  // counts for badges
  const messageCount = 0;
  const totalNotifications = (postNotifications?.length || 0) + messageCount;
  const canSubmitPost = Boolean(postText.trim() || postMedia) && !isOptimizingMedia;
  const myPostsCount = posts.filter(
    (post) => post.userId === admin.userId || post.adminId === admin.adminId
  ).length;
  const todayDate = new Date().toDateString();
  const todaysPostsCount = posts.filter((post) => {
    if (!Number.isFinite(post.parsedTimeMs)) {
      return false;
    }

    return new Date(post.parsedTimeMs).toDateString() === todayDate;
  }).length;
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
  const calendarToday = isCurrentCalendarMonth ? currentEthiopicDate.day : null;
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

  const fetchPostNotifications = async () => {
    if (!adminId) return;
    try {
      const res = await axios.get(`${API_BASE}/get_post_notifications/${adminId}`);
      let notifications = Array.isArray(res.data)
        ? res.data
        : Object.values(res.data || {});

      if (notifications.length === 0) {
        setPostNotifications([]);
        return;
      }

      // Collect only the unique adminIds that aren't already cached
      const uniqueAdminIds = [...new Set(notifications.map((n) => n.adminId).filter(Boolean))];
      const userCache = notificationUserCacheRef.current;
      const uncachedIds = uniqueAdminIds.filter((id) => !userCache.has(id));

      // Fetch only the missing users from the school-scoped Users node
      if (uncachedIds.length > 0 && DB_ROOT) {
        await Promise.all(
          uncachedIds.map(async (userId) => {
            try {
              const r = await axios.get(`${DB_ROOT}/Users/${userId}.json`);
              if (r.data && typeof r.data === "object") {
                userCache.set(userId, r.data);
              } else {
                userCache.set(userId, null);
              }
            } catch {
              userCache.set(userId, null);
            }
          })
        );
      }

      const findAdminUser = (id) => userCache.get(id) || null;

      const enriched = notifications.map((n) => {
        const posterUser = findAdminUser(n.adminId);
        return {
          ...n,
          notificationId: n.notificationId || n.id || `${n.postId}_${n.adminId}`,
          adminName: posterUser?.name || n.adminName || "Unknown Admin",
          adminProfile: posterUser?.profileImage || n.adminProfile || "/default-profile.png",
        };
      });

      setPostNotifications(enriched);
    } catch (err) {
      console.error("Post notification fetch failed", err);
      setPostNotifications([]);
    }
  };

  useEffect(() => {
    fetchPostNotifications();
  }, [adminId]);

  const handleNotificationClick = async (notification) => {
    try {
      await axios.post(`${API_BASE}/mark_post_notification_read`, {
        notificationId: notification.notificationId,
        adminId: admin.userId,
      });
    } catch (err) {
      console.warn("Failed to delete notification:", err);
    }

    setPostNotifications((prev) =>
      prev.filter((n) => n.notificationId !== notification.notificationId)
    );

    setShowPostDropdown(false);

    navigate("/dashboard", {
      state: { postId: notification.postId },
    });
  };

  const fetchMyPosts = async () => {
    const requestId = postsFetchRequestIdRef.current + 1;
    postsFetchRequestIdRef.current = requestId;

    if (!adminId) {
      setPostsLoading(false);
      setPostsInitialized(true);
      return;
    }

    const isCurrentRequest = () => postsFetchRequestIdRef.current === requestId;
    const readCachedPosts = () => readStoredMyPostsCache(adminId);

    const cachedPosts = readCachedPosts();
    if (cachedPosts.length > 0 && isCurrentRequest()) {
      setPosts(cachedPosts);
      setPostsLoading(false);
    } else {
      setPostsLoading(true);
    }

    try {
      const res = await axios.get(`${API_BASE}/get_my_posts/${adminId}`, {
        params: {
          limit: 200,
          schoolCode: schoolCode || "",
          userId: admin?.userId || adminId,
        },
        timeout: 12000,
      });
      const postsArray = Array.isArray(res.data)
        ? res.data
        : Object.entries(res.data || {}).map(([key, post]) => ({
            postId: key,
            ...post,
          }));

      const mappedPosts = postsArray
        .map((p) => {
          const parsedTime = parsePostTimestamp(p) || new Date();
          const mediaUrl = p.postUrl || p.mediaUrl || null;
          const postId = p.postId || p.id || "";
          return {
            postId: postId || String(p?.postId || p?.id || ""),
            message: p.message || p.postText || "",
            postUrl: mediaUrl,
            time: parsedTime.toLocaleString(),
            parsedTimeMs: parsedTime.getTime(),
            parsedTime,
            edited: p.edited || false,
            likeCount: Number(p.likeCount) || 0,
            likes: p.likes || {},
            adminId: p.adminId || adminId,
            targetRole: p.targetRole || "all",
            adminName: p.adminName || admin.name || "Admin",
            adminProfile: p.adminProfile || admin.profileImage || "/default-profile.png",
            isVideo: isVideoMediaUrl(mediaUrl, p.mediaType),
          };
        })
        .sort((a, b) => b.parsedTime - a.parsedTime);

      if (myPostsCacheKey) {
        try {
          localStorage.setItem(myPostsCacheKey, JSON.stringify(mappedPosts.slice(0, 120)));
        } catch (error) {
          // Ignore localStorage write issues.
        }
      }

      if (isCurrentRequest()) {
        setPosts(mappedPosts);
      }
    } catch (err) {
      const isTimeout = err?.code === "ECONNABORTED" || /timeout/i.test(String(err?.message || ""));
      if (isTimeout && cachedPosts.length > 0) {
        // Keep showing cached posts if backend is temporarily slow.
        if (isCurrentRequest()) {
          setPosts(cachedPosts);
        }
      }

      // Secondary fallback: use the fast school-scoped posts endpoint and filter locally.
      if (isTimeout && schoolCode) {
        try {
          const fallbackRes = await axios.get(`${API_BASE}/get_posts`, {
            params: { schoolCode, limit: 200 },
            timeout: 8000,
          });
          const sourcePosts = Array.isArray(fallbackRes?.data) ? fallbackRes.data : [];
          const actorIds = new Set([
            String(admin?.userId || "").trim(),
            String(adminId || "").trim(),
          ]);
          const filteredPosts = sourcePosts.filter((postItem) =>
            actorIds.has(String(postItem?.adminId || postItem?.userId || "").trim())
          );

          const mappedPosts = filteredPosts
            .map((p) => {
              const parsedTime = parsePostTimestamp(p) || new Date();
              const mediaUrl = p.postUrl || p.mediaUrl || null;
              const postId = p.postId || p.id || "";
              return {
                postId: postId || String(p?.postId || p?.id || ""),
                message: p.message || p.postText || "",
                postUrl: mediaUrl,
                time: parsedTime.toLocaleString(),
                parsedTimeMs: parsedTime.getTime(),
                parsedTime,
                edited: p.edited || false,
                likeCount: Number(p.likeCount) || 0,
                likes: p.likes || {},
                adminId: p.adminId || adminId,
                targetRole: p.targetRole || "all",
                adminName: p.adminName || admin.name || "Admin",
                adminProfile: p.adminProfile || admin.profileImage || "/default-profile.png",
                isVideo: isVideoMediaUrl(mediaUrl, p.mediaType),
              };
            })
            .sort((a, b) => b.parsedTime - a.parsedTime);

          if (isCurrentRequest()) {
            setPosts(mappedPosts);
          }

          if (myPostsCacheKey) {
            try {
              localStorage.setItem(myPostsCacheKey, JSON.stringify(mappedPosts.slice(0, 120)));
            } catch (error) {
              // Ignore localStorage write issues.
            }
          }
        } catch (fallbackErr) {
          // Keep existing cached posts if fallback also fails.
        }
      }

      console.error("Error fetching posts:", err.response?.data || err);
    } finally {
      if (isCurrentRequest()) {
        setPostsLoading(false);
        setPostsInitialized(true);
      }
    }
  };

  useEffect(() => {
    if (!adminId) return;
    fetchMyPosts();
  }, [adminId]);

  useEffect(() => {
    if (!myPostsCacheKey) {
      return;
    }

    try {
      localStorage.setItem(myPostsCacheKey, JSON.stringify(posts.slice(0, 120)));
    } catch (error) {
      // Ignore localStorage write issues.
    }
  }, [myPostsCacheKey, posts]);

  const handlePost = async () => {
    if (!(postText.trim() || postMedia) || isOptimizingMedia) return;
    if (posting) return;
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append("adminId", adminId);
      formData.append("userId", admin?.userId || adminId);
      formData.append("postText", postText);
      formData.append("message", postText);
      formData.append("adminName", admin?.name || "Admin");
      formData.append("adminProfile", admin?.profileImage || "/default-profile.png");
      formData.append("schoolCode", schoolCode || "");
      formData.append("targetRole", targetRole || "all");
      if (postMedia) formData.append("postMedia", postMedia);
      if (postMedia) formData.append("post_media", postMedia);

      await axios.post(`${API_BASE}/create_post`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPostText("");
      setPostMedia(null);
      setPostMediaMeta(null);
      setTargetRole("all");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowCreatePostModal(false);
      fetchMyPosts();
    } catch (err) {
      console.error("Error creating post:", err.response?.data || err);
      alert("Create post failed: " + (err.response?.data?.message || err.message || "See console"));
    } finally {
      setPosting(false);
    }
  };

  const handleEdit = (postId, currentContent) => {
    setEditingPostId(postId);
    setEditedContent(currentContent || "");
  };

  const saveEdit = async (postId) => {
    if (!postId) return;
    if (!adminId) return;
    const trimmed = (editedContent || "").trim();
    if (trimmed.length === 0) {
      alert("Post content cannot be empty.");
      return;
    }
    setSavingId(postId);

    // Try Firebase first
    try {
      const payload = {
        message: trimmed,
        edited: true,
        editedAt: new Date().toISOString(),
        lastEditedBy: adminId,
      };
      const firebaseUrl = `${RTDB_BASE}/Posts/${encodeURIComponent(postId)}.json`;
      await axios.patch(firebaseUrl, payload);
      setPosts((prev) =>
        prev.map((post) =>
          post.postId === postId ? { ...post, message: trimmed, edited: true } : post
        )
      );
      setEditingPostId(null);
      setEditedContent("");
      setSavingId(null);
      return;
    } catch (err) {
      // fallback to backend
    }

    try {
      const url = `${API_BASE}/edit_post/${postId}`;
      const payload = { adminId, postText: trimmed, message: trimmed };
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        headers["x-access-token"] = token;
      }
      const res = await axios.post(url, payload, { headers });
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || "Edit failed on backend");
      }
      setPosts((prev) =>
        prev.map((post) =>
          post.postId === postId ? { ...post, message: trimmed, edited: true } : post
        )
      );
      setEditingPostId(null);
      setEditedContent("");
    } catch (err) {
      console.error("[EDIT] Final error:", err.response?.status, err.response?.data || err.message || err);
      alert("Edit failed: " + (err.response?.data?.message || err.message || "See console"));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (postId) => {
    if (!postId) return;
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    if (!adminId) return;
    setDeletingId(postId);

    try {
      const firebaseUrl = `${RTDB_BASE}/Posts/${encodeURIComponent(postId)}.json`;
      await axios.delete(firebaseUrl);
      setPosts((prev) => prev.filter((p) => p.postId !== postId));
      setDeletingId(null);
      return;
    } catch (err) {
      // fallback below
    }

    try {
      const url = `${API_BASE}/delete_post/${postId}`;
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        headers["x-access-token"] = token;
      }

      try {
        const rPost = await axios.post(url, { adminId }, { headers });
        if (rPost.data && rPost.data.success === false) throw new Error(rPost.data.message || "delete returned success:false");
        setPosts((prev) => prev.filter((p) => p.postId !== postId));
        setDeletingId(null);
        return;
      } catch (postErr) {
        // try delete with body
      }

      try {
        const rDelBody = await axios.delete(url, { data: { adminId }, headers });
        if (rDelBody.data && rDelBody.data.success === false) throw new Error(rDelBody.data.message || "delete returned success:false");
        setPosts((prev) => prev.filter((p) => p.postId !== postId));
        setDeletingId(null);
        return;
      } catch (delBodyErr) {
        // try delete with params
      }

      const rDelParam = await axios.delete(url, { params: { adminId }, headers });
      if (rDelParam.data && rDelParam.data.success === false) throw new Error(rDelParam.data.message || "delete returned success:false");
      setPosts((prev) => prev.filter((p) => p.postId !== postId));
    } catch (err) {
      console.error("[DELETE] Final error:", err.response?.status, err.response?.data || err.message || err);
      alert("Delete failed: " + (err.response?.data?.message || err.message || "See console"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await axios.post(`${API_BASE}/like_post`, {
        adminId,
        postId,
      });
      if (res.data.success) {
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId === postId
              ? {
                  ...post,
                  likeCount: res.data.likeCount,
                  likes: {
                    ...post.likes,
                    [adminId]: res.data.liked ? true : undefined,
                  },
                }
              : post
          )
        );
      }
    } catch (err) {
      console.error("Error liking post:", err.response?.data || err);
    }
  };

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

  const loadCalendarEvents = async () => {
    if (!schoolCode) {
      setCalendarEvents([]);
      return;
    }

    setCalendarEventsLoading(true);
    try {
      const res = await axios.get(`${DB_ROOT}/CalendarEvents.json`);
      const rawEvents = res.data || {};
      const normalizedEvents = Object.entries(rawEvents)
        .map(([eventId, eventValue]) => normalizeCalendarEvent(eventId, eventValue))
        .filter((eventItem) => eventItem.gregorianDate);

      setCalendarEvents(sortCalendarEvents(normalizedEvents));
    } catch (err) {
      console.error("Failed to load calendar events:", err);
      setCalendarEvents([]);
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
      await loadCalendarEvents();
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
      await loadCalendarEvents();
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
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".notification-dropdown")) {
        setShowPostDropdown(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

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
  }, [schoolCode]);

  useEffect(() => {
    loadCalendarEvents();
  }, [schoolCode]);

  useEffect(() => {
    const preferredDay = calendarDays.find((dayItem) => dayItem?.ethDay === calendarToday) || calendarDays.find(Boolean) || null;

    if (!preferredDay) {
      setSelectedCalendarIsoDate("");
      return;
    }

    const stillVisible = calendarDays.some((dayItem) => dayItem?.isoDate === selectedCalendarIsoDate);
    if (!stillVisible) {
      setSelectedCalendarIsoDate(preferredDay.isoDate);
    }
  }, [calendarViewDate.year, calendarViewDate.month, calendarToday, calendarDays.length]);

  useEffect(() => {
    if (!showCreatePostModal) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowCreatePostModal(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showCreatePostModal]);

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

  return (
    <div
      className="dashboard-page"
      style={{
        background: "#FFFFFF",
        minHeight: "100vh",
        height: "auto",
        overflowX: "hidden",
        overflowY: "auto",
        color: "var(--text-primary)",
        "--surface-panel": "#FFFFFF",
        "--surface-accent": "#F1F8FF",
        "--surface-muted": "#F7FBFF",
        "--surface-strong": "#DCEBFF",
        "--page-bg": "#FFFFFF",
        "--border-soft": "#D7E7FB",
        "--border-strong": "#B5D2F8",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": "#007AFB",
        "--accent-soft": "#E7F2FF",
        "--accent-strong": "#007afb",
        "--success": "#00B6A9",
        "--success-soft": "#E9FBF9",
        "--success-border": "#AAEDE7",
        "--warning": "#DC2626",
        "--warning-soft": "#FEE2E2",
        "--warning-border": "#FCA5A5",
        "--danger": "#b91c1c",
        "--danger-border": "#fca5a5",
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
        "--surface-overlay": "#F1F8FF",
        "--input-bg": "#FFFFFF",
        "--input-border": "#B5D2F8",
        "--shadow-soft": "0 10px 24px rgba(0, 122, 251, 0.10)",
        "--shadow-panel": "0 14px 30px rgba(0, 122, 251, 0.14)",
        "--shadow-glow": "0 0 0 2px rgba(0, 122, 251, 0.18)",
      }}
    >
      <style>
        {`@keyframes myPostsSkeletonPulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }`}
      </style>
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

        {/* ---------------- MAIN CONTENT ---------------- */}
        <div
          className="main-content google-main"
          style={{
            flex: "1 1 0",
            minWidth: 0,
            maxWidth: "none",
            margin: "0",
            boxSizing: "border-box",
            alignSelf: "flex-start",
            minHeight: "calc(100vh - 24px)",
            overflowY: "visible",
            overflowX: "hidden",
            position: "relative",
            top: "auto",
            scrollbarWidth: "thin",
            scrollbarColor: "transparent transparent",
            padding: "0 12px 0 2px",
            display: "flex",
            justifyContent: "center",
            opacity: isOverlayModalOpen ? 0.45 : 1,
            filter: isOverlayModalOpen ? "blur(1px)" : "none",
            pointerEvents: isOverlayModalOpen ? "none" : "auto",
            transition: "opacity 180ms ease, filter 180ms ease",
          }}
        >
          <div style={{ width: "100%", maxWidth: FEED_SECTION_STYLE.maxWidth }}>
            <div className="section-header-card" style={{ ...FEED_SECTION_STYLE, margin: "0 auto 14px", boxShadow: "none" }}>
              <div className="section-header-card__title" style={{ fontSize: 17 }}>My Posts</div>
              <div className="section-header-card__subtitle">Review, edit, and manage your announcements.</div>
            </div>

          <div className="post-box" style={{ ...FEED_SECTION_STYLE, ...shellCardStyle, margin: "0 auto 14px", borderRadius: 12, overflow: "hidden", padding: "10px 12px" }}>
            <div className="fb-post-top" style={{ display: "flex", gap: 10, alignItems: "center", background: "transparent", border: "none", boxShadow: "none", padding: 0 }}>
              <ProfileAvatar src={admin.profileImage} name={admin?.name || "Admin"} alt="me" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border-soft)", flexShrink: 0 }} />
              <button
                type="button"
                onClick={() => setShowCreatePostModal(true)}
                style={{
                  flex: 1,
                  height: 42,
                  border: "1px solid var(--border-soft)",
                  background: "var(--surface-muted)",
                  borderRadius: 999,
                  padding: "0 16px",
                  fontSize: 14,
                  textAlign: "left",
                  color: "var(--text-secondary)",
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
                  border: "none",
                  borderRadius: 8,
                  background: "transparent",
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
                  border: "none",
                  borderRadius: 8,
                  background: "transparent",
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
          {shouldShowPostsLoadingState ? (
            <div style={{ ...FEED_SECTION_STYLE, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`my-posts-skeleton-${index}`} style={{ ...shellCardStyle, borderRadius: 10, overflow: "hidden", padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, flex: 1 }}>
                      <div style={{ ...skeletonBaseStyle, width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
                      <div style={{ display: "grid", gap: 7, flex: 1 }}>
                        {renderSkeletonLine("28%", 14)}
                        {renderSkeletonLine("52%", 12)}
                      </div>
                    </div>
                    {renderSkeletonLine("74px", 28, { borderRadius: 999 })}
                  </div>
                  <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                    {renderSkeletonLine("88%", 12)}
                    {renderSkeletonLine(index === 1 ? "56%" : "72%", 12)}
                    <div style={{ ...skeletonBaseStyle, width: "100%", height: index === 1 ? 210 : 170, borderRadius: 12, marginTop: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div style={{ ...FEED_SECTION_STYLE, ...shellCardStyle, margin: "0 auto", borderRadius: 10, padding: 18, textAlign: "center", color: "var(--text-secondary)", fontSize: 14 }}>
              You have no posts yet.
            </div>
          ) : (
            <div className="posts-container" style={{ ...FEED_SECTION_STYLE, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
              {posts.map((post) => (
                <div className="post-card facebook-post-card" id={`post-${post.postId}`} key={post.postId} style={{ ...shellCardStyle, borderRadius: 10, overflow: "hidden" }}>
                  <div className="post-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "12px 16px 8px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, flex: 1 }}>
                      <div className="img-circle" style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, borderRadius: "50%", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-soft)", background: "var(--surface-panel)" }}>
                        <ProfileAvatar src={post.adminProfile || admin.profileImage} name={post.adminName || admin.name || "Admin"} alt="profile" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block", flexShrink: 0 }} />
                      </div>
                      <div className="post-info" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <h4 style={{ margin: 0, fontSize: 15, color: "var(--text-primary)", fontWeight: 700, lineHeight: 1.2 }}>{post.adminName || admin.name || "Admin"}</h4>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2, fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                          <span>
                            {post.time}
                            {post.edited ? " · Edited" : ""}
                          </span>
                          <span>·</span>
                          <span>{post.targetRole && post.targetRole !== "all" ? `Visible to ${post.targetRole}` : "Visible to everyone"}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: "6px 10px", borderRadius: 999, background: "var(--surface-muted)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, flexShrink: 0, border: "1px solid var(--border-soft)" }}>
                      My post
                    </div>
                  </div>

                  {editingPostId === post.postId ? (
                    <div style={{ padding: "0 16px 12px" }}>
                      <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        style={{ width: "100%", minHeight: 120, resize: "vertical", border: "1px solid var(--input-border)", borderRadius: 8, padding: "10px 12px", fontSize: 15, lineHeight: 1.4, outline: "none", boxSizing: "border-box", color: "var(--text-primary)", background: "var(--input-bg)" }}
                      />
                      <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => saveEdit(post.postId)}
                          disabled={savingId === post.postId}
                          style={{ border: "none", background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)", borderRadius: 6, height: 34, padding: "0 14px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                        >
                            {savingId === post.postId ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingPostId(null)}
                          style={{ ...subtleButtonStyle, borderRadius: 6, height: 34, padding: "0 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {post.message ? (
                        <div style={{ padding: "0 16px 12px", color: "var(--text-primary)", fontSize: 15, lineHeight: 1.3333, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {post.message}
                        </div>
                      ) : null}
                      {post.postUrl && (
                        <div style={{ background: "#000", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {post.isVideo ? (
                            <video
                              src={post.postUrl}
                              controls
                              playsInline
                              preload="metadata"
                              style={{ width: "100%", height: "auto", maxHeight: "min(78vh, 720px)", display: "block", margin: "0 auto" }}
                            />
                          ) : (
                            <img
                              src={post.postUrl}
                              alt="post media"
                              style={{ width: "100%", height: "auto", maxHeight: "min(78vh, 720px)", objectFit: "contain", display: "block", margin: "0 auto" }}
                            />
                          )}
                        </div>
                      )}

                      <div style={{ padding: "10px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13, color: "var(--text-secondary)", borderTop: "1px solid var(--border-soft)" }}>
                        <div style={{ whiteSpace: "nowrap", fontSize: 12, fontWeight: 600 }}>
                          {post.targetRole && post.targetRole !== "all" ? `Visible to ${post.targetRole}` : "Visible to everyone"}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                          <button
                            onClick={() => handleEdit(post.postId, post.message)}
                            style={{ ...subtleButtonStyle, borderRadius: 999, height: 34, padding: "0 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(post.postId)}
                            disabled={deletingId === post.postId}
                            style={{ border: "none", background: "var(--danger)", borderRadius: 999, height: 34, padding: "0 14px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                          >
                            {deletingId === post.postId ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

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
          <div style={widgetCardStyle}>
            <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>Quick Statistics</h4>
            <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", justifyContent: "center", flexWrap: "nowrap" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={smallStatStyle}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>My Posts</div>
                  <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{myPostsCount}</div>
                </div>

                <div style={smallStatStyle}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>Unread</div>
                  <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{messageCount}</div>
                </div>

                <div style={smallStatStyle}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>Notifications</div>
                  <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{totalNotifications}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ ...widgetCardStyle, padding: "10px" }}>
              <h4 style={{ fontSize: 12, fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>Today's Activity</h4>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", ...softPanelStyle, padding: "7px 8px", fontSize: 10 }}>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>New Posts</span>
                  <strong style={{ color: "var(--text-primary)" }}>{todaysPostsCount}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", ...softPanelStyle, padding: "7px 8px", fontSize: 10 }}>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Messages</span>
                  <strong style={{ color: "var(--text-primary)" }}>{messageCount}</strong>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>Recent Contacts</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", ...softPanelStyle, padding: "7px 8px", lineHeight: 1.45 }}>
                    Disabled on this page to reduce Firebase background downloads.
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/all-chat")}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", textAlign: "center", ...softPanelStyle, padding: "8px 10px", cursor: "pointer", color: "var(--text-primary)", fontSize: 10, fontWeight: 800 }}
                  >
                    Open Messages
                  </button>
                </div>
              </div>
            </div>

            <div style={{ ...rightRailCardStyle, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", top: -34, right: -24, width: 104, height: 104, borderRadius: "50%", background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 10%, transparent) 0%, transparent 74%)", pointerEvents: "none" }} />
              <div style={{ padding: "14px 14px 12px", background: "var(--surface-panel)", borderBottom: "1px solid rgba(15, 23, 42, 0.08)", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={rightRailIconStyle}>
                      <FaCalendarAlt style={{ width: 14, height: 14 }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 900, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>School Calendar</h4>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 3, fontWeight: 800 }}>{calendarMonthLabel}</div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2, fontWeight: 500 }}>
                        {`${calendarMonthStartGregorian.day}/${calendarMonthStartGregorian.month}/${calendarMonthStartGregorian.year} - ${calendarMonthEndGregorian.day}/${calendarMonthEndGregorian.month}/${calendarMonthEndGregorian.year}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => handleCalendarMonthChange(-1)} style={{ ...rightRailIconButtonStyle, fontSize: 17 }} aria-label="Previous month" title="Previous month">‹</button>
                    <button type="button" onClick={() => handleCalendarMonthChange(1)} style={{ ...rightRailIconButtonStyle, fontSize: 17 }} aria-label="Next month" title="Next month">›</button>
                  </div>
                </div>
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <div style={{ ...rightRailPillStyle, color: "var(--text-primary)" }}>{monthlyCalendarEvents.length} event{monthlyCalendarEvents.length === 1 ? "" : "s"}</div>
                    <div style={{ ...rightRailPillStyle, color: canManageCalendar ? "var(--text-primary)" : "var(--text-secondary)" }}>{canManageCalendar ? "Manage access" : "View only"}</div>
                  </div>
                </div>
              </div>

              <div style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", borderRadius: 16, padding: "10px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, marginBottom: 6 }}>
                  {CALENDAR_WEEK_DAYS.map((day) => (
                    <div key={day} style={{ textAlign: "center", fontSize: 9, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.03em", textTransform: "uppercase" }}>{day}</div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
                  {calendarDays.map((day, index) => {
                    const isToday = day?.ethDay === calendarToday;
                    const dayOfWeek = index % 7;
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const primaryEvent = day?.events?.[0] || null;
                    const isNoClassDay = primaryEvent?.category === "no-class";
                    const isAcademicDay = primaryEvent?.category === "academic";
                    const isSelected = day?.isoDate === selectedCalendarIsoDate;
                    const isHovered = day?.isoDate === hoveredCalendarIsoDate;
                    const dayBackground = day
                      ? isToday
                        ? "var(--accent-soft)"
                        : isSelected
                          ? "color-mix(in srgb, var(--accent-soft) 72%, white 28%)"
                          : isNoClassDay
                            ? "color-mix(in srgb, var(--warning-soft) 58%, white 42%)"
                            : isAcademicDay
                              ? "color-mix(in srgb, var(--accent-soft) 46%, white 54%)"
                              : isWeekend
                                ? "color-mix(in srgb, var(--surface-muted) 82%, white 18%)"
                                : "var(--surface-panel)"
                      : "transparent";

                    return (
                      <button
                        type="button"
                        key={`${day?.ethDay || "blank"}-${index}`}
                        onClick={() => day && setSelectedCalendarIsoDate(day.isoDate)}
                        onMouseEnter={() => day && setHoveredCalendarIsoDate(day.isoDate)}
                        onMouseLeave={() => setHoveredCalendarIsoDate("")}
                        onFocus={() => day && setHoveredCalendarIsoDate(day.isoDate)}
                        onBlur={() => setHoveredCalendarIsoDate("")}
                        title={day?.events?.length ? day.events.map((eventItem) => eventItem.title).join(", ") : ""}
                        style={{ minHeight: 0, aspectRatio: "1 / 1", borderRadius: 10, border: isToday ? "1px solid var(--accent)" : isSelected ? "1px solid var(--accent-strong)" : isHovered ? "1px solid var(--border-strong)" : isNoClassDay ? "1px solid var(--warning-border)" : "1px solid var(--border-soft)", background: dayBackground, color: isToday ? "var(--accent-strong)" : day ? "var(--text-secondary)" : "transparent", fontSize: 10, fontWeight: isToday ? 800 : 700, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, padding: "5px 2px", boxShadow: day && isSelected ? "0 8px 18px rgba(0, 122, 251, 0.12)" : "none", cursor: day ? "pointer" : "default", outline: "none", transform: day && isSelected ? "translateY(-2px) scale(1.03)" : day && isHovered ? "translateY(-1px)" : "translateY(0)", transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease", position: "relative", overflow: "hidden" }}
                        disabled={!day}
                      >
                        {day ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 800, color: isToday || isSelected ? "var(--accent-strong)" : "var(--text-primary)", lineHeight: 1 }}>{day.ethDay}</div>
                            <div style={{ fontSize: 8, color: isSelected ? "var(--accent)" : "var(--text-muted)", lineHeight: 1 }}>{day.gregorianDate.day}/{day.gregorianDate.month}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 2, minHeight: 6 }}>
                              {day.events.slice(0, 2).map((eventItem) => (
                                <span key={eventItem.id} style={{ width: 5, height: 5, borderRadius: "50%", background: getCalendarEventMeta(eventItem.category).color }} />
                              ))}
                            </div>
                          </>
                        ) : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "var(--text-secondary)", fontWeight: 800, background: "var(--surface-panel)", border: "1px solid var(--warning-border)", borderRadius: 999, padding: "5px 8px" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--warning)" }} /> No class</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "var(--text-secondary)", fontWeight: 800, background: "var(--surface-panel)", border: "1px solid var(--border-strong)", borderRadius: 999, padding: "5px 8px" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} /> Academic</div>
                {canManageCalendar ? (
                  <button type="button" onClick={handleOpenCalendarEventModal} style={{ ...rightRailIconButtonStyle, width: 30, height: 30, borderRadius: 999, color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Add school calendar event" title="Add school calendar event"><FaPlus style={{ width: 12, height: 12 }} /></button>
                ) : null}
              </div>

              {calendarActionMessage ? (
                <div style={{ marginTop: 10, borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--accent-soft)", color: "var(--accent-strong)", fontSize: 10, fontWeight: 800, padding: "8px 10px" }}>{calendarActionMessage}</div>
              ) : null}

              <div style={{ marginTop: 12, background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 14, padding: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "var(--text-primary)" }}>{selectedCalendarDay ? `${ETHIOPIAN_MONTHS[calendarViewDate.month - 1]} ${selectedCalendarDay.ethDay}, ${calendarViewDate.year}` : "Select a date"}</div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>{selectedCalendarDay ? `Gregorian ${selectedCalendarDay.gregorianDate.day}/${selectedCalendarDay.gregorianDate.month}/${selectedCalendarDay.gregorianDate.year}` : "Choose a day to view or add calendar events."}</div>
                  </div>
                  {calendarEventsLoading && <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700 }}>Loading...</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {selectedCalendarEvents.length === 0 ? (
                    <div style={{ fontSize: 9, color: "var(--text-muted)", background: "var(--surface-muted)", borderRadius: 10, border: "1px solid var(--border-soft)", padding: "7px 9px" }}>No school events on this day.</div>
                  ) : (
                    selectedCalendarEvents.map((eventItem) => {
                      const eventMeta = getCalendarEventMeta(eventItem.category);
                      return (
                        <div key={eventItem.id} style={{ display: "flex", alignItems: "flex-start", gap: 7, background: "var(--surface-panel)", border: `1px solid ${eventMeta.border}`, borderRadius: 10, padding: "7px 8px" }}>
                          <span style={{ width: 8, height: 8, marginTop: 4, borderRadius: "50%", background: eventMeta.color, flexShrink: 0 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-primary)" }}>{eventItem.title}</div>
                              {eventItem.isDefault ? <span style={{ padding: "2px 6px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent-strong)", fontSize: 9, fontWeight: 800 }}>Default</span> : null}
                            </div>
                            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>{eventMeta.label}</div>
                            {eventItem.notes ? <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 3 }}>{eventItem.notes}</div> : null}
                          </div>
                          {canManageCalendar && !eventItem.isDefault ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              <button type="button" onClick={() => handleEditCalendarEvent(eventItem)} style={{ height: 26, padding: "0 9px", borderRadius: 8, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", fontSize: 9, fontWeight: 800, cursor: "pointer" }}>Edit</button>
                              <button type="button" onClick={() => handleDeleteCalendarEvent(eventItem)} disabled={calendarEventSaving} style={{ height: 26, padding: "0 9px", borderRadius: 8, border: "1px solid var(--danger-border)", background: "var(--surface-panel)", color: "var(--danger)", fontSize: 9, fontWeight: 800, cursor: calendarEventSaving ? "not-allowed" : "pointer" }}>Delete</button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div style={{ background: "var(--surface-panel)", borderRadius: 16, boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)", padding: "11px", border: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>Upcoming Deadlines</h4>
                {canManageCalendar ? <button type="button" onClick={handleOpenDeadlineModal} style={{ width: 28, height: 28, borderRadius: 999, border: "1px solid var(--border-strong)", background: "var(--surface-panel)", color: "var(--accent-strong)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} aria-label="Add upcoming deadline" title="Add upcoming deadline"><FaPlus style={{ width: 11, height: 11 }} /></button> : null}
              </div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {calendarEventsLoading ? (
                  <div style={{ padding: "8px 9px", borderRadius: 10, border: "1px solid var(--border-soft)", background: "var(--surface-muted)", fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>Loading deadlines...</div>
                ) : upcomingDeadlineEvents.length === 0 ? (
                  <div style={{ padding: "8px 9px", borderRadius: 10, border: "1px solid var(--border-soft)", background: "var(--surface-muted)", fontSize: 10, color: "var(--text-muted)" }}>
                    No upcoming deadlines in the next 30 days.
                    {canManageCalendar ? <button type="button" onClick={handleOpenDeadlineModal} style={{ marginTop: 8, height: 28, padding: "0 10px", borderRadius: 999, border: "1px solid var(--success-border)", background: "var(--surface-panel)", color: "var(--success)", fontSize: 9, fontWeight: 800, cursor: "pointer" }}>Add deadline</button> : null}
                  </div>
                ) : (
                  visibleUpcomingDeadlineEvents.map((eventItem) => {
                    const eventMeta = getCalendarEventMeta(eventItem.category);
                    return (
                      <div key={`deadline-${eventItem.id}`} style={{ padding: "8px 9px", borderRadius: 10, border: `1px solid ${eventMeta.border}`, background: "var(--surface-muted)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: eventMeta.color, flexShrink: 0 }} /><span>{eventItem.title?.trim() || eventItem.notes?.trim() || "Academic deadline"}</span></div>
                          <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 3 }}>{eventMeta.label}{eventItem.ethiopianDate?.month && eventItem.ethiopianDate?.day ? ` • ${ETHIOPIAN_MONTHS[eventItem.ethiopianDate.month - 1]} ${eventItem.ethiopianDate.day}` : ""}</div>
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatCalendarDeadlineDate(eventItem.gregorianDate)}</div>
                      </div>
                    );
                  })
                )}
                {!calendarEventsLoading && upcomingDeadlineEvents.length > 3 ? <button type="button" onClick={() => setShowAllUpcomingDeadlines((currentValue) => !currentValue)} style={{ alignSelf: "flex-start", height: 28, padding: "0 10px", borderRadius: 999, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--accent-strong)", fontSize: 9, fontWeight: 800, cursor: "pointer" }}>{showAllUpcomingDeadlines ? "See less" : `See more (${upcomingDeadlineEvents.length - 3})`}</button> : null}
              </div>
            </div>
          </div>

          <div style={{ background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)", borderRadius: 16, boxShadow: "var(--shadow-soft)", padding: "13px", border: "1px solid var(--border-soft)" }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>Sponsored Links</h4>
            <ul style={{ margin: "10px 0 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7, fontSize: 13 }}>
              <li style={{ color: "var(--accent-strong)", fontWeight: 600 }}>Gojo Study App</li>
              <li style={{ color: "var(--accent-strong)", fontWeight: 600 }}>Finance Portal</li>
              <li style={{ color: "var(--accent-strong)", fontWeight: 600 }}>HR Management</li>
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
                      <ProfileAvatar src={admin?.profileImage} name={admin?.name || "Admin"} alt="me" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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

                    <button
                      type="button"
                      onClick={handlePost}
                      disabled={posting || !canSubmitPost}
                      style={{
                        minWidth: 160,
                        height: 46,
                        border: "none",
                        background: posting || !canSubmitPost ? "var(--surface-strong)" : "var(--accent)",
                        borderRadius: 999,
                        color: posting || !canSubmitPost ? "var(--text-muted)" : "#fff",
                        fontSize: 14,
                        fontWeight: 800,
                        letterSpacing: "0.01em",
                        cursor: posting || !canSubmitPost ? "not-allowed" : "pointer",
                        boxShadow: posting || !canSubmitPost ? "none" : "0 8px 18px rgba(0, 122, 251, 0.14)",
                      }}
                    >
                      {posting ? "Publishing..." : isOptimizingMedia ? "Optimizing..." : "Publish post"}
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
            position: "fixed",
            inset: 0,
            background: "color-mix(in srgb, var(--text-primary) 26%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1200,
          }}
          onClick={handleCloseCalendarEventModal}
        >
          <div
            style={{
              width: "min(470px, 100%)",
              background: "var(--surface-panel)",
              borderRadius: 20,
              border: "1px solid var(--border-soft)",
              boxShadow: "var(--shadow-panel)",
              overflow: "hidden",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: "16px 16px 12px", background: "linear-gradient(180deg, var(--surface-overlay) 0%, var(--surface-panel) 100%)", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-primary)" }}>
                  {editingCalendarEventId
                    ? "Edit school calendar event"
                    : calendarModalContext === "deadline"
                      ? "Add upcoming deadline"
                      : "Add school calendar event"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                  {selectedCalendarDay
                    ? calendarModalContext === "deadline"
                      ? `Choose the date for this upcoming deadline in ${ETHIOPIAN_MONTHS[calendarViewDate.month - 1]}`
                      : `For Ethiopic day ${selectedCalendarDay.ethDay} in ${ETHIOPIAN_MONTHS[calendarViewDate.month - 1]}`
                    : "Select a day in the calendar first."}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseCalendarEventModal}
                style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid var(--border-soft)", background: "var(--surface-overlay)", color: "var(--text-secondary)", fontSize: 20, lineHeight: 1, cursor: "pointer" }}
                aria-label="Close calendar event modal"
              >
                ×
              </button>
            </div>

            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {!canManageCalendar ? (
                <div style={{ fontSize: 10, color: "var(--warning)", background: "var(--warning-soft)", border: "1px solid var(--warning-border)", borderRadius: 10, padding: "8px 10px" }}>
                  View only. Registrar or admin access is required to add, edit, or delete school calendar events.
                </div>
              ) : null}

              <div style={{ border: "1px solid var(--border-soft)", borderRadius: 16, padding: 10, background: "linear-gradient(180deg, var(--surface-overlay) 0%, var(--surface-panel) 100%)", boxShadow: "inset 0 1px 0 color-mix(in srgb, white 45%, transparent), var(--shadow-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "var(--text-primary)" }}>Choose day from calendar</div>
                    <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>{calendarMonthLabel}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button type="button" onClick={() => handleCalendarMonthChange(-1)} style={{ width: 28, height: 28, borderRadius: 9, border: "1px solid var(--border-soft)", background: "var(--surface-overlay)", color: "var(--text-primary)", cursor: "pointer", fontSize: 16, lineHeight: 1, boxShadow: "var(--shadow-soft)" }} aria-label="Previous Ethiopian month">‹</button>
                    <button type="button" onClick={() => handleCalendarMonthChange(1)} style={{ width: 28, height: 28, borderRadius: 9, border: "1px solid var(--border-soft)", background: "var(--surface-overlay)", color: "var(--text-primary)", cursor: "pointer", fontSize: 16, lineHeight: 1, boxShadow: "var(--shadow-soft)" }} aria-label="Next Ethiopian month">›</button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, marginBottom: 5 }}>
                  {CALENDAR_WEEK_DAYS.map((dayLabel) => (
                    <div key={dayLabel} style={{ textAlign: "center", fontSize: 8, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{dayLabel}</div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
                  {calendarDays.map((dayItem, index) => {
                    const isSelectedDay = dayItem?.isoDate === selectedCalendarIsoDate;
                    const hasEvents = (dayItem?.events?.length || 0) > 0;
                    const isTodayDay = dayItem?.ethDay === calendarToday;
                    const cellBackground = !dayItem
                      ? "transparent"
                      : isTodayDay
                        ? "linear-gradient(145deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent) 22%, var(--surface-overlay)) 100%)"
                        : isSelectedDay
                          ? "linear-gradient(145deg, var(--surface-overlay) 0%, var(--accent-soft) 55%, color-mix(in srgb, var(--accent) 22%, var(--surface-overlay)) 100%)"
                          : hasEvents
                            ? "linear-gradient(145deg, color-mix(in srgb, var(--warning-soft) 72%, var(--surface-panel)) 0%, var(--warning-soft) 100%)"
                            : "linear-gradient(145deg, var(--surface-panel) 0%, var(--surface-overlay) 100%)";

                    return (
                      <button
                        key={`${dayItem?.isoDate || "blank"}-${index}`}
                        type="button"
                        onClick={() => dayItem && setSelectedCalendarIsoDate(dayItem.isoDate)}
                        disabled={!dayItem || !canManageCalendar}
                        style={{ minHeight: 0, aspectRatio: "1 / 1", borderRadius: 10, border: isTodayDay ? "1px solid var(--accent)" : isSelectedDay ? "1px solid var(--accent-strong)" : hasEvents ? "1px solid var(--warning-border)" : "1px solid transparent", background: cellBackground, color: !dayItem ? "transparent" : isSelectedDay || isTodayDay ? "var(--accent-strong)" : "var(--text-primary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, cursor: dayItem && canManageCalendar ? "pointer" : "default", boxShadow: isSelectedDay ? "0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent), 0 12px 22px color-mix(in srgb, var(--accent-strong) 18%, transparent)" : isTodayDay ? "0 10px 18px color-mix(in srgb, var(--accent-strong) 14%, transparent)" : "var(--shadow-soft)", padding: "4px 2px", overflow: "hidden", position: "relative", transform: isSelectedDay ? "translateY(-1px) scale(1.02)" : "translateY(0) scale(1)", transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease" }}
                      >
                        {dayItem ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 800, lineHeight: 1 }}>{dayItem.ethDay}</div>
                            <div style={{ fontSize: 8, color: isSelectedDay ? "var(--accent-strong)" : "var(--text-secondary)", lineHeight: 1 }}>{dayItem.gregorianDate.day}/{dayItem.gregorianDate.month}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 2, minHeight: 6 }}>
                              {dayItem.events.slice(0, 2).map((eventItem) => (
                                <span key={eventItem.id} style={{ width: 5, height: 5, borderRadius: "50%", background: getCalendarEventMeta(eventItem.category).color, boxShadow: "0 0 0 2px color-mix(in srgb, var(--surface-panel) 82%, transparent)" }} />
                              ))}
                            </div>
                          </>
                        ) : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              {calendarModalContext === "deadline" ? (
                <div style={{ height: 42, borderRadius: 12, border: "1px solid var(--success-border)", padding: "0 12px", fontSize: 12, color: "var(--success)", background: "var(--success-soft)", display: "flex", alignItems: "center", fontWeight: 800 }}>Academic deadline</div>
              ) : (
                <select value={calendarEventForm.category} onChange={(e) => setCalendarEventForm((prev) => ({ ...prev, category: e.target.value, subType: "general" }))} disabled={!canManageCalendar} style={{ height: 42, borderRadius: 12, border: "1px solid var(--input-border)", padding: "0 12px", fontSize: 12, color: "var(--text-primary)", background: "var(--input-bg)" }}>
                  <option value="no-class">No class day</option>
                  <option value="academic">Academic day</option>
                </select>
              )}

              {calendarModalContext === "deadline" ? (
                <input type="text" value={calendarEventForm.title} onChange={(e) => setCalendarEventForm((prev) => ({ ...prev, title: e.target.value }))} disabled={!canManageCalendar} placeholder="Deadline title" style={{ height: 42, borderRadius: 12, border: "1px solid var(--input-border)", padding: "0 12px", fontSize: 12, color: "var(--text-primary)", background: "var(--input-bg)" }} />
              ) : null}

              <textarea value={calendarEventForm.notes} onChange={(e) => setCalendarEventForm((prev) => ({ ...prev, notes: e.target.value }))} disabled={!canManageCalendar} placeholder={calendarModalContext === "deadline" ? "Optional deadline note" : "Optional note"} rows={3} style={{ borderRadius: 12, border: "1px solid var(--input-border)", padding: "12px", fontSize: 12, color: "var(--text-primary)", background: "var(--input-bg)", resize: "vertical" }} />

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                <button type="button" onClick={handleCreateCalendarEvent} disabled={calendarEventSaving || !selectedCalendarDay || !canManageCalendar} style={{ flex: "1 1 180px", height: 42, borderRadius: 12, border: "none", background: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? "var(--surface-strong)" : "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)", color: "#fff", fontSize: 12, fontWeight: 900, cursor: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? "not-allowed" : "pointer", boxShadow: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? "none" : "0 12px 18px color-mix(in srgb, var(--accent-strong) 18%, transparent)" }}>
                  {calendarEventSaving ? "Saving..." : editingCalendarEventId ? "Update calendar event" : "Save calendar event"}
                </button>
                <button type="button" onClick={handleCloseCalendarEventModal} style={{ height: 42, padding: "0 14px", borderRadius: 12, border: "1px solid var(--border-soft)", background: "var(--surface-overlay)", color: "var(--text-primary)", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MyPosts;