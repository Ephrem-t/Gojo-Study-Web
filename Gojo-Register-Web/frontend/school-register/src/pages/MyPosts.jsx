import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
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
  FaChartLine,
  FaChevronDown,
  FaPlus,
  FaVideo,
  FaPhotoVideo,
  FaPlayCircle,
  FaThumbsUp,
} from "react-icons/fa";
import "../styles/global.css";
import { BACKEND_BASE } from "../config.js";
import useTopbarNotifications from "../hooks/useTopbarNotifications";
import EthiopicCalendar from "ethiopic-calendar";
import RegisterSidebar from "../components/RegisterSidebar";
import { formatFileSize, optimizePostMedia } from "../utils/postMedia";
import { buildRegisterTargetRoleOptions, fetchConversationSummaries } from "../utils/registerData";

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
];

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

const buildDefaultCalendarEvents = (ethiopianYear) => DEFAULT_ETHIOPIAN_SPECIAL_DAYS.map((eventItem) => {
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

const CALENDAR_MANAGER_ROLES = new Set(["registrar", "registerer", "admin", "school_admin", "school-admin", "finance"]);

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

const hasUsableProfileImage = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  return normalized !== "/default-profile.png" && normalized.toLowerCase() !== "null" && normalized.toLowerCase() !== "undefined";
};

const getAvatarInitials = (value) => {
  const parts = String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return "RO";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
};

const readStoredRegisterUser = () => {
  try {
    return JSON.parse(
      localStorage.getItem("finance") ||
      localStorage.getItem("registrar") ||
      localStorage.getItem("admin")
    ) || {};
  } catch (e) {
    return {};
  }
};

const persistStoredRegisterUser = (userData) => {
  const mergedUserData = userData || {};
  localStorage.setItem("finance", JSON.stringify(mergedUserData));
  localStorage.setItem("registrar", JSON.stringify(mergedUserData));
  localStorage.setItem(
    "admin",
    JSON.stringify({
      ...mergedUserData,
      adminId: mergedUserData.financeId || mergedUserData.adminId || "",
    })
  );
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

const isVideoMediaUrl = (mediaUrl, mediaType) => {
  if (String(mediaType || "").toLowerCase().startsWith("video/")) {
    return true;
  }

  return /\.(mp4|webm|ogg|mov|m4v|avi)(?:$|[?#])/i.test(String(mediaUrl || ""));
};

function MyPosts() {
  const API_BASE = `${BACKEND_BASE}/api`;
  const [posts, setPosts] = useState([]);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);
  const [postMediaMeta, setPostMediaMeta] = useState(null);
  const [isOptimizingMedia, setIsOptimizingMedia] = useState(false);
  const [targetRole, setTargetRole] = useState("all");
  const [targetOptions, setTargetOptions] = useState(["all"]);
  const fileInputRef = useRef(null);
  const [recentContacts, setRecentContacts] = useState([]);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
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
  const [expandedPostDescriptions, setExpandedPostDescriptions] = useState({});

  // loading states for edit/delete
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();
  const FEED_MAX_WIDTH = "min(700px, 100%)";
  const isOverlayModalOpen = showCreatePostModal || showCalendarEventModal;
  const today = new Date();
  const todaysPostsCount = posts.filter((post) => {
    if (!Number.isFinite(post.parsedTimeMs)) {
      return false;
    }

    return new Date(post.parsedTimeMs).toDateString() === today.toDateString();
  }).length;
  const mediaPostCount = posts.filter((post) => Boolean(post.postUrl)).length;
  const totalPostLikes = posts.reduce((sum, post) => sum + Number(post.likeCount || 0), 0);
  const canSubmitPost = Boolean(postText.trim() || postMedia) && !isOptimizingMedia;

  // Read admin from localStorage
  // Read finance/admin from localStorage (compat)
  const _storedFinance = readStoredRegisterUser();

  const [finance, setFinance] = useState({
    financeId: _storedFinance.financeId || _storedFinance.adminId || "",
    userId: _storedFinance.userId || "",
    schoolCode: _storedFinance.schoolCode || "",
    name: _storedFinance.name || _storedFinance.username || "Register Office",
    username: _storedFinance.username || "",
    role: _storedFinance.role || _storedFinance.userType || "registrar",
    profileImage: _storedFinance.profileImage || "/default-profile.png",
    token: _storedFinance.token || _storedFinance.accessToken || _storedFinance.idToken || _storedFinance.apiKey || null,
  });

  // Compatibility alias: older code expects `admin` object
  const admin = {
    adminId: finance.financeId || finance.adminId || "",
    userId: finance.userId || "",
    name: finance.name || finance.username || "Register Office",
    profileImage: finance.profileImage || "/default-profile.png",
    token: finance.token || null,
  };

  // include username (from Users node) for sidebar display
  admin.username = finance.username || "";
  const currentLikeActorId = admin.userId || admin.adminId || "";
  const currentCalendarRole = String(finance.role || _storedFinance.role || _storedFinance.userType || "registrar").trim().toLowerCase();
  const canManageCalendar = CALENDAR_MANAGER_ROLES.has(currentCalendarRole);
  const shellCardStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    borderRadius: 16,
    boxShadow: "var(--shadow-panel)",
  };
  const softPanelStyle = {
    background: "var(--surface-muted)",
    border: "1px solid var(--border-soft)",
    borderRadius: 12,
  };
  const widgetCardStyle = {
    background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)",
    borderRadius: 16,
    boxShadow: "var(--shadow-panel)",
    padding: "11px",
    border: "1px solid var(--border-soft)",
  };
  const statChipStyle = {
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
  const modalCardStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-panel)",
  };
  const inputFieldStyle = {
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
  };
  const iconButtonStyle = {
    border: "1px solid var(--border-soft)",
    background: "var(--surface-panel)",
    color: "var(--text-secondary)",
  };

  // Prefer the finance/adminId (financeId) when available; fallback to userId
  const adminId = admin?.adminId || admin?.userId || null;
  const token = admin?.token || null;

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

  const togglePostDescription = (postId) => {
    setExpandedPostDescriptions((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };
  const renderProfileAvatar = (imageUrl, name, size = 40, borderRadius = "50%") => {
    const hasImage = hasUsableProfileImage(imageUrl);
    const initials = getAvatarInitials(name);
    const resolvedBorderRadius = typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius;

    return (
      <div
        className="img-circle"
        style={{
          width: size,
          height: size,
          borderRadius: resolvedBorderRadius,
          overflow: "hidden",
          flexShrink: 0,
          border: hasImage ? "1px solid var(--border-soft)" : "1px solid var(--accent-strong)",
          background: hasImage ? "var(--surface-panel)" : "var(--accent-strong)",
          color: hasImage ? "var(--text-primary)" : "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.max(12, Math.round(size * 0.34)),
          fontWeight: 900,
          letterSpacing: "0.03em",
          position: "relative",
        }}
      >
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{initials}</span>
        {hasImage ? (
          <img
            src={imageUrl}
            alt={name || "profile"}
            style={{ width: "100%", height: "100%", objectFit: "cover", position: "relative", zIndex: 1 }}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}
      </div>
    );
  };

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      axios.defaults.headers.common["x-access-token"] = token;
    } else {
      delete axios.defaults.headers.common["Authorization"];
      delete axios.defaults.headers.common["x-access-token"];
    }
  }, [token]);

  const RTDB_BASE_RAW = "https://bale-house-rental-default-rtdb.firebaseio.com";
  const schoolCode = finance.schoolCode || _storedFinance.schoolCode || "";
  const DB_ROOT = schoolCode
    ? `${RTDB_BASE_RAW}/Platform1/Schools/${schoolCode}`
    : RTDB_BASE_RAW;
  const RTDB_BASE = DB_ROOT;
  const DB_URL = DB_ROOT;
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
    if (!eventsMap[eventItem.gregorianDate]) {
      eventsMap[eventItem.gregorianDate] = [];
    }
    eventsMap[eventItem.gregorianDate].push(eventItem);
    return eventsMap;
  }, {});
  const calendarDays = Array.from({ length: calendarFirstWeekday + calendarDaysInMonth }, (_, index) => {
    const dayNumber = index - calendarFirstWeekday + 1;
    if (dayNumber <= 0) {
      return null;
    }

    const gregorianDate = EthiopicCalendar.eg(calendarViewDate.year, calendarViewDate.month, dayNumber);
    const isoDate = `${gregorianDate.year}-${String(gregorianDate.month).padStart(2, "0")}-${String(gregorianDate.day).padStart(2, "0")}`;

    return {
      ethDay: dayNumber,
      gregorianDate,
      isoDate,
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

  const [loadingFinance, setLoadingFinance] = useState(true);

  const loadFinanceFromStorage = async () => {
    const stored = localStorage.getItem("finance") || localStorage.getItem("registrar") || localStorage.getItem("admin");

    if (!stored) {
      setLoadingFinance(false);
      return;
    }

    try {
      const financeData = JSON.parse(stored) || {};

      const financeKey = financeData.financeId || financeData.adminId || financeData.id || financeData.uid || "";
      const possibleUserId = financeData.userId || financeData.user_id || financeData.uid || financeData.user || "";

      if (financeKey) {
        let res = null;
        try {
          res = (await axios.get(`${DB_URL}/Finance/${financeKey}.json`)) || null;
        } catch (err) {
          res = null;
        }

        if (!res || !res.data) {
          try {
            res = (await axios.get(`${DB_URL}/Academics/${financeKey}.json`)) || null;
          } catch (err) {
            res = null;
          }
        }

        if (res && res.data) {
          const node = res.data;
          const userId = node.userId || node.user_id || possibleUserId || "";

          if (userId) {
            try {
              const userRes = await axios.get(`${DB_URL}/Users/${userId}.json`);
              const nextFinance = {
                financeId: financeKey,
                userId,
                schoolCode: financeData.schoolCode || "",
                name: userRes.data?.name || node.name || financeData.name || "Register Office",
                username: userRes.data?.username || financeData.username || "",
                role: node.role || node.userType || userRes.data?.role || userRes.data?.userType || financeData.role || financeData.userType || "registrar",
                profileImage: userRes.data?.profileImage || node.profileImage || financeData.profileImage || "/default-profile.png",
                token: financeData.token || financeData.accessToken || financeData.idToken || financeData.apiKey || null,
              };
              setFinance(nextFinance);
              persistStoredRegisterUser({ ...financeData, ...nextFinance });
              setLoadingFinance(false);
              return;
            } catch (err) {
              const nextFinance = {
                financeId: financeKey,
                userId,
                schoolCode: financeData.schoolCode || "",
                name: node.name || financeData.name || "Register Office",
                username: node.username || financeData.username || "",
                role: node.role || node.userType || financeData.role || financeData.userType || "registrar",
                profileImage: node.profileImage || financeData.profileImage || "/default-profile.png",
                token: financeData.token || financeData.accessToken || financeData.idToken || financeData.apiKey || null,
              };
              setFinance(nextFinance);
              persistStoredRegisterUser({ ...financeData, ...nextFinance });
              setLoadingFinance(false);
              return;
            }
          }
        }
      }

      if (possibleUserId) {
        try {
          const userRes = await axios.get(`${DB_URL}/Users/${possibleUserId}.json`);
          const nextFinance = {
            financeId: financeData.financeId || financeData.adminId || "",
            userId: possibleUserId,
            schoolCode: financeData.schoolCode || "",
            name: userRes.data?.name || financeData.name || "Register Office",
            username: userRes.data?.username || financeData.username || "",
            role: userRes.data?.role || userRes.data?.userType || financeData.role || financeData.userType || "registrar",
            profileImage: userRes.data?.profileImage || financeData.profileImage || "/default-profile.png",
            token: financeData.token || financeData.accessToken || financeData.idToken || financeData.apiKey || null,
          };
          setFinance(nextFinance);
          persistStoredRegisterUser({ ...financeData, ...nextFinance });
          setLoadingFinance(false);
          return;
        } catch (err) {
          // ignore and fallback to stored data
        }
      }

      const fallbackFinance = {
        financeId: financeData.financeId || financeData.adminId || "",
        userId: financeData.userId || "",
        schoolCode: financeData.schoolCode || "",
        name: financeData.name || financeData.username || "Register Office",
        username: financeData.username || "",
        role: financeData.role || financeData.userType || "registrar",
        profileImage: financeData.profileImage || "/default-profile.png",
        token: financeData.token || financeData.accessToken || financeData.idToken || financeData.apiKey || null,
      };
      setFinance(fallbackFinance);
      persistStoredRegisterUser({ ...financeData, ...fallbackFinance });
    } catch (e) {
      try {
        localStorage.removeItem("finance");
        localStorage.removeItem("registrar");
        localStorage.removeItem("admin");
      } catch (err) {}
    }

    setLoadingFinance(false);
  };

  const {
    unreadSenders,
    setUnreadSenders,
    unreadPosts: postNotifications,
    setUnreadPosts: setPostNotifications,
    messageCount,
    totalNotifications,
    markMessagesAsSeen,
    markPostAsSeen,
  } = useTopbarNotifications({
    dbRoot: RTDB_BASE,
    currentUserId: admin.userId,
  });

  const handleNotificationClick = async (notification) => {
    try {
      await markPostAsSeen(notification.postId);
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
      const basePayload = {
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
      };
      const payload = editingCalendarEventId
        ? {
            ...basePayload,
            createdAt: editingCalendarEvent?.createdAt || "",
            createdBy: editingCalendarEvent?.createdBy || admin.userId || admin.adminId || "",
            updatedAt: new Date().toISOString(),
            updatedBy: admin.userId || admin.adminId || "",
          }
        : {
            ...basePayload,
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

  const fetchMyPosts = async () => {
    if (!adminId) return;
    try {
      const res = await axios.get(`${API_BASE}/get_my_posts/${adminId}`, {
        params: { schoolCode },
      });
      const postsArray = Array.isArray(res.data)
        ? res.data
        : Object.entries(res.data || {}).map(([key, post]) => ({
            postId: key,
            ...post,
          }));

      const mappedPosts = postsArray
        .map((p) => {
          const parsedTime = parsePostTimestamp(p);
          const postId = p.postId || p.id || "";
          const postUrl = p.postUrl || p.mediaUrl || null;
          const mediaType = p.mediaType || p.postMediaType || p.fileType || "";
          return {
            postId: postId || String(p?.postId || p?.id || ""),
            message: p.message || p.postText || "",
            postUrl,
            mediaType,
            time: parsedTime ? parsedTime.toLocaleString() : "Unknown time",
            parsedTime,
            parsedTimeMs: parsedTime ? parsedTime.getTime() : 0,
            edited: p.edited || false,
            likeCount: Number(p.likeCount) || 0,
            likes: p.likes || {},
            adminId: p.adminId || adminId,
            adminName: p.adminName || p.financeName || finance.name || admin.name,
            adminProfile: p.adminProfile || p.financeProfile || "",
            targetRole: p.targetRole || p.audience || "all",
            isVideo: isVideoMediaUrl(postUrl, mediaType),
          };
        })
        .sort((a, b) => b.parsedTimeMs - a.parsedTimeMs);

      setPosts(mappedPosts);
    } catch (err) {
      console.error("Error fetching posts:", err.response?.data || err);
    }
  };

  useEffect(() => {
    if (loadingFinance) return;
    if (!adminId) return;

    const runRefresh = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      fetchMyPosts();
    };

    runRefresh();
    window.addEventListener("focus", runRefresh);
    document.addEventListener("visibilitychange", runRefresh);

    return () => {
      window.removeEventListener("focus", runRefresh);
      document.removeEventListener("visibilitychange", runRefresh);
    };
  }, [adminId, loadingFinance, schoolCode]);

  // load finance info on mount (so adminId is populated from RTDB when needed)
  useEffect(() => {
    loadFinanceFromStorage();
  }, []);

  const handlePost = async () => {
    if (!(postText.trim() || postMedia) || isOptimizingMedia) return false;
    try {
      const formData = new FormData();
      // Use backend-compatible field names: `message`, `postUrl` (if uploading client-side), and include finance fields
      formData.append("adminId", adminId);
      formData.append("message", postText);
      if (postMedia) formData.append("postMedia", postMedia);

      // Include finance fields for new schema compatibility
      formData.append("financeId", finance.financeId || admin.adminId || "");
      formData.append("financeName", finance.name || admin.name || "");
      formData.append("financeProfile", finance.profileImage || admin.profileImage || "");
      // also include admin display fields for older backend compatibility
      formData.append("adminName", admin.name || "");
      formData.append("adminProfile", admin.profileImage || "");
      // include userId if available
      formData.append("userId", finance.userId || admin.userId || "");
      formData.append("schoolCode", schoolCode || "");
      formData.append("targetRole", targetRole || "all");

      await axios.post(`${API_BASE}/create_post`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPostText("");
      setPostMedia(null);
      setPostMediaMeta(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchMyPosts();
      return true;
    } catch (err) {
      console.error("Error creating post:", err.response?.data || err);
      alert("Create post failed: " + (err.response?.data?.message || err.message || "See console"));
      return false;
    }
  };

  const handleSubmitCreatePost = async () => {
    if (!(postText.trim() || postMedia) || isOptimizingMedia) return;
    const success = await handlePost();
    if (success) setShowCreatePostModal(false);
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

  useEffect(() => {
    const fetchTeachersAndRecent = async () => {
      const financeUserId = finance.userId;
      if (!financeUserId) {
        setRecentContacts([]);
        setTargetOptions(buildRegisterTargetRoleOptions());
        return;
      }

      try {
        const nextRoles = buildRegisterTargetRoleOptions();
        setTargetOptions(nextRoles);
        setTargetRole((prev) => (nextRoles.includes(prev) ? prev : "all"));

        const summaries = await fetchConversationSummaries({
          rtdbBase: DB_URL,
          currentUserId: financeUserId,
          includeWithoutLastMessage: true,
          limit: 5,
        });

        setRecentContacts(
          summaries.map((summary) => ({
            userId: summary?.contact?.userId || "",
            name: summary?.contact?.name || summary?.displayName || "Unknown",
            profileImage: summary?.contact?.profileImage || "/default-profile.png",
            lastMessage: summary?.lastMessageText || "",
            lastTime: Number(summary?.lastMessageTime || 0),
            type: summary?.contact?.type || "user",
          }))
        );
      } catch (err) {
        console.error("Error fetching recent contacts in MyPosts:", err);
      }
    };

    fetchTeachersAndRecent();
  }, [DB_URL, finance.userId]);

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

  return (
    <div className="dashboard-page" style={{ background: "var(--page-bg)", minHeight: "100vh" }}>
      <nav className="top-navbar" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface-panel)" }}>
        <h2 style={{ color: "var(--text-primary)", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>

        <div className="nav-right">
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowPostDropdown((prev) => !prev);
            }}
          >
            <FaBell />
            {totalNotifications > 0 && (
              <span className="badge">{totalNotifications}</span>
            )}
            {showPostDropdown && (
              <div className="notification-dropdown" onClick={(e) => e.stopPropagation()} style={{
                  position: "absolute",
                  top: "45px",
                  right: "0",
                  width: "360px",
                  maxHeight: "420px",
                  overflowY: "auto",
                  background: "var(--surface-overlay)",
                  borderRadius: 10,
                  border: "1px solid var(--border-soft)",
                  boxShadow: "var(--shadow-panel)",
                  zIndex: 1000,
                  padding: 6,
                }}>
                {totalNotifications === 0 ? (
                  <p className="muted">No new notifications</p>
                ) : (
                  <div>
                    {/* Posts section */}
                    {postNotifications.length > 0 && (
                      <div>
                        <div className="notification-section-title">Posts</div>
                        {postNotifications.map((n) => (
                          <div
                            key={n.notificationId}
                            className="notification-row"
                            onClick={async () => {
                              try {
                                await axios.post(`${API_BASE}/mark_post_notification_read`, {
                                  notificationId: n.notificationId,
                                });
                              } catch (err) {
                                console.warn("Failed to mark notification:", err);
                              }

                              setPostNotifications((prev) => prev.filter((notif) => notif.notificationId !== n.notificationId));
                              setShowPostDropdown(false);
                              navigate("/dashboard", {
                                state: {
                                  postId: n.postId,
                                  posterName: n.adminName,
                                  posterProfile: n.adminProfile,
                                },
                              });
                            }}
                            style={{
                              padding: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              cursor: "pointer",
                              borderBottom: "1px solid var(--border-soft)",
                              transition: "background 120ms ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                          >
                            <div style={{ width: 46, height: 46, flexShrink: 0 }}>
                              {renderProfileAvatar(n.adminProfile, n.adminName, 46)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: "block", marginBottom: 4, color: "var(--text-primary)" }}>{n.adminName}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{n.message}</p>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>{new Date(n.time || n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Messages section */}
                    {messageCount > 0 && (
                      <div>
                        <div className="notification-section-title" style={{ padding: '8px 10px', color: 'var(--text-primary)', fontWeight: 700, background: 'var(--surface-muted)', border: '1px solid var(--border-soft)', borderRadius: 6, margin: '8px 6px' }}>Messages</div>
                        {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                              <div
                                key={userId}
                                className="notification-row"
                                onClick={async () => {
                                  await markMessagesAsSeen(userId);
                                  setUnreadSenders((prev) => {
                                    const copy = { ...prev };
                                    delete copy[userId];
                                    return copy;
                                  });
                                  setShowPostDropdown(false);
                                  navigate("/all-chat", { state: { user: { userId, name: sender.name, profileImage: sender.profileImage, type: sender.type } } });
                                }}
                                style={{
                                  padding: 10,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  cursor: "pointer",
                                  borderBottom: "1px solid var(--border-soft)",
                                  transition: "background 120ms ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                              >
                                {renderProfileAvatar(sender.profileImage, sender.name, 46, 8)}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <strong style={{ display: "block", marginBottom: 4, color: "var(--text-primary)" }}>{sender.name}</strong>
                                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{sender.count} new message{sender.count > 1 && "s"}</p>
                                </div>
                              </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/all-chat") }>
            <FaFacebookMessenger />
            {messageCount > 0 && <span className="badge">{messageCount}</span>}
          </div>

          <div className="profile-img" style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
            {renderProfileAvatar(admin.profileImage, admin.name, 38)}
          </div>
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", gap: 16, padding: "18px 16px", minHeight: "100vh", background: "var(--page-bg)", width: "100%", boxSizing: "border-box" }}>
        <RegisterSidebar
          user={admin}
          sticky
          fullHeight
          dimmed={isOverlayModalOpen}
          style={{ width: 'clamp(220px, 15vw, 280px)', minWidth: 220, top: 24 }}
        />

        {/* ---------------- MAIN CONTENT ---------------- */}
        <div className="main-content google-main" style={{ flex: '1 1 auto', minWidth: 0, maxWidth: 'none', margin: '0', boxSizing: 'border-box', alignSelf: 'flex-start', height: 'calc(100vh - 24px)', overflowY: 'auto', position: 'sticky', top: 24, scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent', padding: '0 2px', opacity: isOverlayModalOpen ? 0.45 : 1, filter: isOverlayModalOpen ? 'blur(1px)' : 'none', pointerEvents: isOverlayModalOpen ? 'none' : 'auto', transition: 'opacity 180ms ease, filter 180ms ease' }}>
          <div
            style={{
              ...shellCardStyle,
              maxWidth: FEED_MAX_WIDTH,
              margin: "0 auto 14px",
              color: "var(--text-primary)",
              padding: "14px 16px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, var(--accent), var(--accent-strong), color-mix(in srgb, var(--accent) 68%, white))" }} />
            <div style={{ fontSize: 17, fontWeight: 800 }}>My Posts</div>
            <div style={{ marginTop: 5, fontSize: 12, color: "var(--text-secondary)" }}>Manage, edit, and review your announcements.</div>
          </div>

          {/* Post input box */}
          <div className="post-box" style={{ ...shellCardStyle, maxWidth: FEED_MAX_WIDTH, margin: "0 auto 14px", borderRadius: 12, overflow: "hidden", padding: "10px 12px" }}>
            <div
              className="fb-post-top"
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                background: "transparent",
                border: "none",
                boxShadow: "none",
                padding: 0,
              }}
            >
              {renderProfileAvatar(admin.profileImage, admin.name, 38)}
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
              {/* Reel button removed */}
            </div>
          </div>

          {/* Posts container */}
          {posts.length === 0 ? (
            <div style={{ ...shellCardStyle, maxWidth: FEED_MAX_WIDTH, margin: '0 auto', borderRadius: 10, padding: 18, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
              You have no posts yet.
            </div>
          ) : (
            <div className="posts-container" style={{ maxWidth: FEED_MAX_WIDTH, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
              {posts.map((post) => (
                <div
                  className="post-card facebook-post-card"
                  id={`post-${post.postId}`}
                  key={post.postId}
                  style={{ ...shellCardStyle, borderRadius: 10, overflow: "hidden" }}
                >
                  <div className="post-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "12px 16px 8px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, flex: 1 }}>
                      {renderProfileAvatar(post.adminProfile, post.adminName || admin.name, 38)}
                      <div className="post-info" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <h4 style={{ margin: 0, fontSize: 15, color: "var(--text-primary)", fontWeight: 700, lineHeight: 1.2 }}>{post.adminName || admin.name || "Admin"}</h4>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2, fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                          <span>{post.time}{post.edited ? " · Edited" : ""}</span>
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
                          onClick={() => setEditingPostId(null)}
                          style={{ ...subtleButtonStyle, borderRadius: 6, height: 34, padding: "0 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(post.postId)}
                          disabled={savingId === post.postId}
                          style={{ border: "none", background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)", borderRadius: 6, height: 34, padding: "0 14px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                        >
                          {savingId === post.postId ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {post.message ? (() => {
                        const canExpandPost = shouldShowPostSeeMore(post.message);
                        const isPostExpanded = !!expandedPostDescriptions[post.postId];

                        return (
                          <div style={{ padding: "0 16px 12px" }}>
                            <div
                              style={{
                                color: "var(--text-primary)",
                                fontSize: 15,
                                lineHeight: 1.5,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                maxHeight: canExpandPost && !isPostExpanded ? "3.9em" : "none",
                                overflow: canExpandPost && !isPostExpanded ? "hidden" : "visible",
                                position: "relative",
                              }}
                            >
                              {post.message}
                            </div>
                            {canExpandPost ? (
                              <button
                                type="button"
                                onClick={() => togglePostDescription(post.postId)}
                                style={{
                                  marginTop: 6,
                                  border: "none",
                                  background: "transparent",
                                  color: "var(--accent-strong)",
                                  fontSize: 13,
                                  fontWeight: 700,
                                  padding: 0,
                                  cursor: "pointer",
                                }}
                              >
                                {isPostExpanded ? "See less" : "See more"}
                              </button>
                            ) : null}
                          </div>
                        );
                      })() : null}

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

                      <div style={{ padding: "10px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13, color: "var(--text-muted)", borderTop: "1px solid var(--border-soft)", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => handleLike(post.postId)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            minWidth: 0,
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: "pointer",
                            color: post.likes && post.likes[currentLikeActorId] ? "var(--accent-strong)" : "var(--text-muted)",
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          <span style={{ width: 20, height: 20, borderRadius: "50%", background: post.likes && post.likes[currentLikeActorId] ? "var(--accent-strong)" : "var(--surface-strong)", color: post.likes && post.likes[currentLikeActorId] ? "#fff" : "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <FaThumbsUp style={{ width: 10, height: 10 }} />
                          </span>
                          <span style={{ whiteSpace: "nowrap" }}>{post.likeCount || 0} like{(post.likeCount || 0) === 1 ? "" : "s"}</span>
                        </button>

                        <div style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                          {post.targetRole && post.targetRole !== "all" ? `Visible to ${post.targetRole}` : "Visible to everyone"}
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginLeft: "auto" }}>
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

        {/* RIGHT WIDGETS COLUMN */}
        <div className="dashboard-widgets" style={{ width: 'clamp(300px, 21vw, 360px)', minWidth: 300, maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'flex-start', height: 'calc(100vh - 24px)', overflowY: 'auto', position: 'sticky', top: 24, scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent', paddingRight: 2, marginLeft: 'auto', marginRight: 0, opacity: isOverlayModalOpen ? 0.45 : 1, filter: isOverlayModalOpen ? 'blur(1px)' : 'none', pointerEvents: isOverlayModalOpen ? 'none' : 'auto', transition: 'opacity 180ms ease, filter 180ms ease' }}>
          <div style={widgetCardStyle}>
            <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Quick Statistics</h4>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'nowrap' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={statChipStyle}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>My Posts</div>
                  <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{posts.length}</div>
                </div>
                <div style={statChipStyle}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Media</div>
                  <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{mediaPostCount}</div>
                </div>
                <div style={statChipStyle}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Likes</div>
                  <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{totalPostLikes}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...widgetCardStyle, padding: '10px' }}>
              <h4 style={{ fontSize: 12, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Today's Activity</h4>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ ...softPanelStyle, display: 'flex', justifyContent: 'space-between', padding: '7px 8px', fontSize: 10 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>New Posts</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{todaysPostsCount}</strong>
                </div>
                <div style={{ ...softPanelStyle, display: 'flex', justifyContent: 'space-between', padding: '7px 8px', fontSize: 10 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Messages</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{messageCount}</strong>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Recent Contacts</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recentContacts.length === 0 ? (
                    <div style={{ ...softPanelStyle, fontSize: 10, color: 'var(--text-muted)', padding: '7px 8px' }}>
                      No recent chats yet
                    </div>
                  ) : (
                    recentContacts.map((contact) => (
                      <button
                        key={contact.userId}
                        type="button"
                        onClick={() => navigate('/all-chat', {
                          state: {
                            user: {
                              userId: contact.userId,
                              name: contact.name,
                              profileImage: contact.profileImage,
                              type: contact.type || 'user',
                            },
                          },
                        })}
                        style={{ ...softPanelStyle, display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', padding: '5px 6px', cursor: 'pointer' }}
                      >
                        {renderProfileAvatar(contact.profileImage, contact.name, 24)}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {contact.name}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {contact.lastMessage || 'Open chat'}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={{ background: 'linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)', borderRadius: 20, boxShadow: 'var(--shadow-panel)', padding: '10px', border: '1px solid var(--border-soft)', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -40, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 16%, transparent) 0%, transparent 72%)', pointerEvents: 'none' }} />
              <div style={{ margin: '-10px -10px 10px', padding: '12px 10px 10px', background: 'linear-gradient(135deg, var(--accent-soft) 0%, var(--surface-muted) 55%, var(--surface-panel) 100%)', borderBottom: '1px solid var(--border-soft)', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent) 20%, transparent) 100%)', color: 'var(--accent-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 30%, transparent), 0 8px 18px color-mix(in srgb, var(--accent-strong) 14%, transparent)' }}>
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
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(-1)}
                      style={{ ...iconButtonStyle, width: 28, height: 28, borderRadius: 9, cursor: 'pointer', fontSize: 17, lineHeight: 1, boxShadow: 'var(--shadow-soft)' }}
                      aria-label="Previous month"
                      title="Previous month"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(1)}
                      style={{ ...iconButtonStyle, width: 28, height: 28, borderRadius: 9, cursor: 'pointer', fontSize: 17, lineHeight: 1, boxShadow: 'var(--shadow-soft)' }}
                      aria-label="Next month"
                      title="Next month"
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ padding: '4px 8px', borderRadius: 999, background: 'var(--surface-panel)', border: '1px solid var(--border-soft)', fontSize: 9, color: 'var(--accent-strong)', fontWeight: 800 }}>
                      {monthlyCalendarEvents.length} event{monthlyCalendarEvents.length === 1 ? '' : 's'}
                    </div>
                    <div style={{ padding: '4px 8px', borderRadius: 999, background: canManageCalendar ? 'var(--success-soft)' : 'var(--warning-soft)', border: canManageCalendar ? '1px solid var(--success-border)' : '1px solid var(--warning-border)', fontSize: 9, color: canManageCalendar ? 'var(--success)' : 'var(--warning)', fontWeight: 800 }}>
                      {canManageCalendar ? 'Manage access' : 'View only'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'linear-gradient(180deg, var(--surface-muted) 0%, color-mix(in srgb, var(--surface-muted) 92%, var(--page-bg) 8%) 100%)', border: '1px solid var(--border-soft)', borderRadius: 16, padding: '10px', boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 22%, transparent)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 6 }}>
                  {CALENDAR_WEEK_DAYS.map((day) => (
                    <div key={day} style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                      {day}
                    </div>
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
                        ? 'linear-gradient(145deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent) 22%, var(--surface-overlay)) 100%)'
                        : isSelected
                          ? 'linear-gradient(145deg, var(--surface-overlay) 0%, var(--accent-soft) 55%, color-mix(in srgb, var(--accent) 22%, var(--surface-overlay)) 100%)'
                          : isNoClassDay
                            ? 'linear-gradient(145deg, color-mix(in srgb, var(--warning-soft) 70%, var(--surface-panel)) 0%, var(--warning-soft) 100%)'
                            : isAcademicDay
                              ? 'linear-gradient(145deg, color-mix(in srgb, var(--success-soft) 72%, var(--surface-panel)) 0%, var(--success-soft) 100%)'
                              : isWeekend
                                ? 'linear-gradient(145deg, var(--surface-muted) 0%, color-mix(in srgb, var(--surface-muted) 88%, var(--surface-overlay) 12%) 100%)'
                                : 'linear-gradient(145deg, var(--surface-panel) 0%, var(--surface-overlay) 100%)'
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
                        style={{
                          minHeight: 0,
                          aspectRatio: '1 / 1',
                          borderRadius: 10,
                          border: isToday
                            ? '1px solid var(--accent)'
                            : isSelected
                              ? '1px solid var(--accent-strong)'
                              : isHovered
                                ? '1px solid color-mix(in srgb, var(--accent) 55%, transparent)'
                                : isNoClassDay
                                  ? '1px solid var(--warning-border)'
                                  : '1px solid transparent',
                          background: dayBackground,
                          color: isToday ? 'var(--accent-strong)' : day ? 'var(--text-secondary)' : 'transparent',
                          fontSize: 10,
                          fontWeight: isToday ? 800 : 700,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1,
                          padding: '5px 2px',
                          boxShadow: day && !isToday
                            ? isSelected
                              ? '0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent), 0 12px 24px color-mix(in srgb, var(--accent-strong) 18%, transparent)'
                              : isHovered
                                ? '0 10px 18px color-mix(in srgb, var(--accent-strong) 12%, transparent)'
                                : 'var(--shadow-soft)'
                            : 'none',
                          cursor: day ? 'pointer' : 'default',
                          outline: 'none',
                          transform: day && isSelected
                            ? 'translateY(-2px) scale(1.03)'
                            : day && isHovered
                              ? 'translateY(-1px) scale(1.015)'
                              : 'translateY(0) scale(1)',
                          transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                        disabled={!day}
                      >
                        {day ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 800, color: isToday || isSelected ? 'var(--accent-strong)' : 'var(--text-primary)', lineHeight: 1 }}>{day.ethDay}</div>
                            <div style={{ fontSize: 8, color: isSelected ? 'var(--accent-strong)' : 'var(--text-muted)', lineHeight: 1 }}>{day.gregorianDate.day}/{day.gregorianDate.month}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 6 }}>
                              {day.events.slice(0, 2).map((eventItem) => (
                                <span
                                  key={eventItem.id}
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: '50%',
                                    background: getCalendarEventMeta(eventItem.category).color,
                                    boxShadow: '0 0 0 2px color-mix(in srgb, var(--surface-panel) 82%, transparent)',
                                  }}
                                />
                              ))}
                            </div>
                          </>
                        ) : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--warning)', fontWeight: 800, background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 999, padding: '5px 8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)' }} /> No class
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--success)', fontWeight: 800, background: 'var(--success-soft)', border: '1px solid var(--success-border)', borderRadius: 999, padding: '5px 8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} /> Academic
                </div>
                {canManageCalendar ? (
                  <button
                    type="button"
                    onClick={handleOpenCalendarEventModal}
                    style={{ width: 30, height: 30, borderRadius: 999, border: '1px solid var(--border-soft)', background: 'linear-gradient(135deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent) 20%, transparent) 100%)', color: 'var(--accent-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 16px color-mix(in srgb, var(--accent-strong) 14%, transparent)' }}
                    aria-label="Add school calendar event"
                    title="Add school calendar event"
                  >
                    <FaPlus style={{ width: 12, height: 12 }} />
                  </button>
                ) : null}
              </div>

              {calendarActionMessage ? (
                <div style={{ marginTop: 10, borderRadius: 12, border: '1px solid var(--success-border)', background: 'linear-gradient(180deg, color-mix(in srgb, var(--success-soft) 86%, var(--surface-panel)) 0%, var(--success-soft) 100%)', color: 'var(--success)', fontSize: 10, fontWeight: 800, padding: '8px 10px', boxShadow: '0 10px 18px color-mix(in srgb, var(--success) 10%, transparent)' }}>
                  {calendarActionMessage}
                </div>
              ) : null}

              <div style={{ marginTop: 12, background: 'linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)', border: '1px solid var(--border-soft)', borderRadius: 14, padding: '10px', boxShadow: 'var(--shadow-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-primary)' }}>
                      {selectedCalendarDay
                        ? `${ETHIOPIAN_MONTHS[calendarViewDate.month - 1]} ${selectedCalendarDay.ethDay}, ${calendarViewDate.year}`
                        : 'Select a date'}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                      {selectedCalendarDay
                        ? `Gregorian ${selectedCalendarDay.gregorianDate.day}/${selectedCalendarDay.gregorianDate.month}/${selectedCalendarDay.gregorianDate.year}`
                        : 'Choose a day to view or add calendar events.'}
                    </div>
                  </div>
                  {calendarEventsLoading && (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>Loading...</div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {selectedCalendarEvents.length === 0 ? (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--surface-muted)', borderRadius: 10, border: '1px solid var(--border-soft)', padding: '7px 9px' }}>
                      No school events on this day.
                    </div>
                  ) : (
                    selectedCalendarEvents.map((eventItem) => {
                      const eventMeta = getCalendarEventMeta(eventItem.category);

                      return (
                        <div
                          key={eventItem.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 7,
                            background: eventMeta.background,
                            border: `1px solid ${eventMeta.border}`,
                            borderRadius: 10,
                            padding: '7px 8px',
                          }}
                        >
                          <span style={{ width: 8, height: 8, marginTop: 4, borderRadius: '50%', background: eventMeta.color, flexShrink: 0 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-primary)' }}>{eventItem.title}</div>
                              {eventItem.isDefault ? (
                                <span style={{ padding: '2px 6px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent-strong)', fontSize: 9, fontWeight: 800 }}>Default</span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{eventMeta.label}</div>
                            {eventItem.notes ? (
                              <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 3 }}>{eventItem.notes}</div>
                            ) : null}
                          </div>
                          {canManageCalendar && !eventItem.isDefault ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => handleEditCalendarEvent(eventItem)}
                                style={{ ...subtleButtonStyle, height: 26, padding: '0 9px', borderRadius: 8, fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCalendarEvent(eventItem)}
                                disabled={calendarEventSaving}
                                style={{ height: 26, padding: '0 9px', borderRadius: 8, border: '1px solid var(--danger-border)', background: 'var(--surface-panel)', color: 'var(--danger)', fontSize: 9, fontWeight: 800, cursor: calendarEventSaving ? 'not-allowed' : 'pointer' }}
                              >
                                Delete
                              </button>
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
                {canManageCalendar ? (
                  <button
                    type="button"
                    onClick={handleOpenDeadlineModal}
                    style={{ width: 28, height: 28, borderRadius: 999, border: '1px solid var(--success-border)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--success-soft) 80%, var(--surface-panel)) 0%, var(--success-soft) 100%)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 16px color-mix(in srgb, var(--success) 14%, transparent)' }}
                    aria-label="Add upcoming deadline"
                    title="Add upcoming deadline"
                  >
                    <FaPlus style={{ width: 11, height: 11 }} />
                  </button>
                ) : null}
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {calendarEventsLoading ? (
                  <div style={{ padding: '8px 9px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--surface-muted)', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>
                    Loading deadlines...
                  </div>
                ) : upcomingDeadlineEvents.length === 0 ? (
                  <div style={{ padding: '8px 9px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--surface-muted)', fontSize: 10, color: 'var(--text-muted)' }}>
                    No upcoming deadlines in the next 30 days.
                    {canManageCalendar ? (
                      <button
                        type="button"
                        onClick={handleOpenDeadlineModal}
                        style={{ marginTop: 8, height: 28, padding: '0 10px', borderRadius: 999, border: '1px solid var(--success-border)', background: 'var(--surface-panel)', color: 'var(--success)', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
                      >
                        Add deadline
                      </button>
                    ) : null}
                  </div>
                ) : (
                  visibleUpcomingDeadlineEvents.map((eventItem) => {
                    const eventMeta = getCalendarEventMeta(eventItem.category);

                    return (
                      <div
                        key={`deadline-${eventItem.id}`}
                        style={{
                          padding: '8px 9px',
                          borderRadius: 10,
                          border: `1px solid ${eventMeta.border}`,
                          background: eventMeta.background,
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: eventMeta.color, flexShrink: 0 }} />
                            <span>{eventItem.title?.trim() || eventItem.notes?.trim() || 'Academic deadline'}</span>
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 3 }}>
                            {eventMeta.label}
                            {eventItem.ethiopianDate?.month && eventItem.ethiopianDate?.day
                              ? ` • ${ETHIOPIAN_MONTHS[eventItem.ethiopianDate.month - 1]} ${eventItem.ethiopianDate.day}`
                              : ''}
                          </div>
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {formatCalendarDeadlineDate(eventItem.gregorianDate)}
                        </div>
                      </div>
                    );
                  })
                )}
                {!calendarEventsLoading && upcomingDeadlineEvents.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllUpcomingDeadlines((currentValue) => !currentValue)}
                    style={{ alignSelf: 'flex-start', height: 28, padding: '0 10px', borderRadius: 999, border: '1px solid var(--border-soft)', background: 'var(--surface-panel)', color: 'var(--accent-strong)', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
                  >
                    {showAllUpcomingDeadlines ? 'See less' : `See more (${upcomingDeadlineEvents.length - 3})`}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ ...widgetCardStyle, padding: '13px' }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Sponsored Links</h4>
            <ul style={{ margin: '10px 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
              <li style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>Gojo Study App</li>
              <li style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>Finance Portal</li>
              <li style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>HR Management</li>
            </ul>
          </div>
        </div>
      </div>

      {showCreatePostModal && (
        <div
          onClick={() => setShowCreatePostModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "color-mix(in srgb, var(--surface-overlay) 84%, transparent)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 1,
              minHeight: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 12,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(500px, 100%)",
                maxHeight: "90vh",
                overflowY: "auto",
                background: "var(--surface-panel)",
                borderRadius: 18,
                border: "1px solid var(--border-soft)",
                boxShadow: "var(--shadow-panel)",
              }}
            >
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 20px 14px", borderBottom: "1px solid var(--border-soft)" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>Create post</div>
                <button
                  type="button"
                  onClick={() => setShowCreatePostModal(false)}
                  style={{ position: "absolute", right: 16, top: 12, border: "1px solid var(--border-soft)", background: "var(--surface-muted)", width: 36, height: 36, borderRadius: "50%", fontSize: 22, color: "var(--text-secondary)", cursor: "pointer", lineHeight: 1 }}
                  aria-label="Close create post modal"
                  title="Close"
                >
                  ×
                </button>
              </div>

              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {renderProfileAvatar(admin.profileImage, admin.name, 40)}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>{admin.name || "Register Office"}</div>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      style={{ height: 28, borderRadius: 7, border: "1px solid var(--input-border)", background: "var(--input-bg)", fontSize: 12, fontWeight: 600, color: "var(--text-primary)", padding: "0 28px 0 10px", width: "fit-content", minWidth: 112 }}
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

                <textarea
                  placeholder="What's on your mind?"
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  style={{
                    minHeight: 180,
                    resize: "vertical",
                    border: "none",
                    background: "transparent",
                    borderRadius: 0,
                    padding: 0,
                    fontSize: 24,
                    lineHeight: 1.3333,
                    outline: "none",
                    color: "var(--text-primary)",
                  }}
                />

                <div style={{ border: "1px solid var(--border-soft)", borderRadius: 12, padding: "8px 12px", boxShadow: "var(--shadow-soft)", background: "var(--surface-overlay)" }}>
                  <div className="fb-post-bottom" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ marginRight: "auto", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Add to your post</div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handlePostMediaSelection}
                      accept="image/*,video/*"
                      style={{ display: "none" }}
                    />
                    <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "14px 16px", background: "linear-gradient(180deg, var(--surface-muted) 0%, #ffffff 100%)", borderRadius: 14, border: "1px dashed var(--border-strong)", boxSizing: "border-box", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 250px" }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--accent-soft)", border: "1px solid var(--border-strong)", color: "var(--accent-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
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
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 999, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", fontSize: 11, fontWeight: 800, letterSpacing: "0.02em" }}>
                          <AiFillVideoCamera style={{ color: "var(--danger)", fontSize: 15 }} />
                          Photos and videos
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenPostMediaPicker}
                          disabled={isOptimizingMedia}
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 999, background: isOptimizingMedia ? "var(--surface-strong)" : "var(--accent)", border: "none", cursor: isOptimizingMedia ? "progress" : "pointer", color: "#fff", fontSize: 13, fontWeight: 800, opacity: isOptimizingMedia ? 0.86 : 1, minWidth: 132 }}
                        >
                          <AiFillPicture style={{ fontSize: 17 }} />
                          <span>{isOptimizingMedia ? "Optimizing..." : postMedia ? "Change file" : "Choose file"}</span>
                        </button>
                      </div>
                    </div>

                    {postMedia && (
                      <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface-muted)", borderRadius: 10, boxSizing: "border-box" }}>
                        {String(postMedia.type || "").startsWith("video/") ? (
                          <AiFillVideoCamera style={{ color: "var(--danger)", fontSize: 18, flexShrink: 0 }} />
                        ) : (
                          <AiFillPicture style={{ color: "var(--success)", fontSize: 18, flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                          style={{ background: "var(--surface-strong)", border: "1px solid var(--border-soft)", color: "var(--text-secondary)", width: 26, height: 26, borderRadius: "50%", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                          aria-label="Remove selected media"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSubmitCreatePost}
                  disabled={!canSubmitPost}
                  style={{
                    width: "100%",
                    border: "none",
                    background: canSubmitPost ? "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)" : "var(--surface-strong)",
                    borderRadius: 6,
                    height: 36,
                    color: canSubmitPost ? "#fff" : "var(--text-muted)",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: canSubmitPost ? "pointer" : "not-allowed",
                  }}
                >
                  {isOptimizingMedia ? "Optimizing..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
              ...modalCardStyle,
              borderRadius: 20,
              overflow: 'hidden',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: '16px 16px 12px', background: 'linear-gradient(180deg, var(--surface-muted) 0%, var(--surface-panel) 100%)', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)' }}>
                  {editingCalendarEventId
                    ? 'Edit school calendar event'
                    : calendarModalContext === 'deadline'
                      ? 'Add upcoming deadline'
                      : 'Add school calendar event'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
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
                style={{ ...iconButtonStyle, width: 34, height: 34, borderRadius: 999, fontSize: 20, lineHeight: 1, cursor: 'pointer' }}
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

              <div style={{ border: '1px solid var(--border-soft)', borderRadius: 16, padding: 10, background: 'linear-gradient(180deg, var(--surface-muted) 0%, var(--surface-panel) 100%)', boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 18%, transparent), var(--shadow-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-primary)' }}>Choose day from calendar</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{calendarMonthLabel}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(-1)}
                      style={{ ...iconButtonStyle, width: 28, height: 28, borderRadius: 9, cursor: 'pointer', fontSize: 16, lineHeight: 1, boxShadow: 'var(--shadow-soft)' }}
                      aria-label="Previous Ethiopian month"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(1)}
                      style={{ ...iconButtonStyle, width: 28, height: 28, borderRadius: 9, cursor: 'pointer', fontSize: 16, lineHeight: 1, boxShadow: 'var(--shadow-soft)' }}
                      aria-label="Next Ethiopian month"
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 5 }}>
                  {CALENDAR_WEEK_DAYS.map((dayLabel) => (
                    <div key={dayLabel} style={{ textAlign: 'center', fontSize: 8, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {dayLabel}
                    </div>
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
                        style={{
                          minHeight: 0,
                          aspectRatio: '1 / 1',
                          borderRadius: 10,
                          border: isTodayDay ? '1px solid var(--accent)' : isSelectedDay ? '1px solid var(--accent-strong)' : hasEvents ? '1px solid var(--warning-border)' : '1px solid transparent',
                          background: cellBackground,
                          color: !dayItem ? 'transparent' : isSelectedDay || isTodayDay ? 'var(--accent-strong)' : 'var(--text-primary)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1,
                          cursor: dayItem && canManageCalendar ? 'pointer' : 'default',
                          boxShadow: isSelectedDay
                            ? '0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent), 0 12px 22px color-mix(in srgb, var(--accent-strong) 18%, transparent)'
                            : isTodayDay
                              ? '0 10px 18px color-mix(in srgb, var(--accent-strong) 14%, transparent)'
                              : 'var(--shadow-soft)',
                          padding: '4px 2px',
                          overflow: 'hidden',
                          position: 'relative',
                          transform: isSelectedDay ? 'translateY(-1px) scale(1.02)' : 'translateY(0) scale(1)',
                          transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease',
                        }}
                      >
                        {dayItem ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 800, lineHeight: 1 }}>{dayItem.ethDay}</div>
                            <div style={{ fontSize: 8, color: isSelectedDay ? 'var(--accent-strong)' : 'var(--text-muted)', lineHeight: 1 }}>{dayItem.gregorianDate.day}/{dayItem.gregorianDate.month}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 6 }}>
                              {dayItem.events.slice(0, 2).map((eventItem) => (
                                <span
                                  key={eventItem.id}
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: '50%',
                                    background: getCalendarEventMeta(eventItem.category).color,
                                    boxShadow: '0 0 0 2px color-mix(in srgb, var(--surface-panel) 82%, transparent)',
                                  }}
                                />
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
                <div style={{ height: 42, borderRadius: 12, border: '1px solid var(--success-border)', padding: '0 12px', fontSize: 12, color: 'var(--success)', background: 'var(--success-soft)', display: 'flex', alignItems: 'center', fontWeight: 800 }}>
                  Academic deadline
                </div>
              ) : (
                <select
                  value={calendarEventForm.category}
                  onChange={(e) => setCalendarEventForm((prev) => ({ ...prev, category: e.target.value, subType: 'general' }))}
                  disabled={!canManageCalendar}
                  style={{ ...inputFieldStyle, height: 42, borderRadius: 12, padding: '0 12px', fontSize: 12 }}
                >
                  <option value="no-class">No class day</option>
                  <option value="academic">Academic day</option>
                </select>
              )}

              {calendarModalContext === 'deadline' ? (
                <input
                  type="text"
                  value={calendarEventForm.title}
                  onChange={(e) => setCalendarEventForm((prev) => ({ ...prev, title: e.target.value }))}
                  disabled={!canManageCalendar}
                  placeholder="Deadline title"
                  style={{ ...inputFieldStyle, height: 42, borderRadius: 12, padding: '0 12px', fontSize: 12 }}
                />
              ) : null}

              <textarea
                value={calendarEventForm.notes}
                onChange={(e) => setCalendarEventForm((prev) => ({ ...prev, notes: e.target.value }))}
                disabled={!canManageCalendar}
                placeholder={calendarModalContext === 'deadline' ? 'Optional deadline note' : 'Optional note'}
                rows={3}
                style={{ ...inputFieldStyle, borderRadius: 12, padding: '12px', fontSize: 12, resize: 'vertical' }}
              />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                <button
                  type="button"
                  onClick={handleCreateCalendarEvent}
                  disabled={calendarEventSaving || !selectedCalendarDay || !canManageCalendar}
                  style={{
                    flex: '1 1 180px',
                    height: 42,
                    borderRadius: 12,
                    border: 'none',
                    background: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? 'var(--surface-strong)' : 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? 'not-allowed' : 'pointer',
                    boxShadow: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? 'none' : '0 12px 18px color-mix(in srgb, var(--accent-strong) 18%, transparent)',
                  }}
                >
                  {calendarEventSaving ? 'Saving...' : editingCalendarEventId ? 'Update calendar event' : 'Save calendar event'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseCalendarEventModal}
                  style={{ ...subtleButtonStyle, height: 42, padding: '0 14px', borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
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