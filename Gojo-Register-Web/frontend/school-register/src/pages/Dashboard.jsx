import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import "../styles/global.css";
import { storage } from "../firebase.js";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { AiFillPicture, AiFillVideoCamera } from "react-icons/ai";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaBell, FaFacebookMessenger, FaCalendarAlt, FaChartLine, FaPlus, FaThumbsUp, FaEllipsisH, FaExchangeAlt, FaFolderOpen, FaUserGraduate, FaChevronDown } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { BACKEND_BASE } from "../config.js";
import useTopbarNotifications from "../hooks/useTopbarNotifications";
import EthiopicCalendar from "ethiopic-calendar";
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

const getOrthodoxEasterDate = (gregorianYear) => {
  const a = gregorianYear % 4;
  const b = gregorianYear % 7;
  const c = gregorianYear % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const julianMonth = Math.floor((d + e + 114) / 31);
  const julianDay = ((d + e + 114) % 31) + 1;

  const julianDateAsGregorian = new Date(
    gregorianYear,
    julianMonth - 1,
    julianDay
  );
  julianDateAsGregorian.setDate(julianDateAsGregorian.getDate() + 13);
  return julianDateAsGregorian;
};

const buildMovableOrthodoxClosures = (ethiopianYear) => {
  const movableEvents = [];
  const seenEventKeys = new Set();

  [ethiopianYear + 7, ethiopianYear + 8].forEach((gregorianYear) => {
    const easterDate = getOrthodoxEasterDate(gregorianYear);
    const goodFridayDate = new Date(easterDate);
    goodFridayDate.setDate(goodFridayDate.getDate() - 2);

    [
      {
        title: "Siklet",
        notes: "Good Friday school closure.",
        date: goodFridayDate,
      },
      {
        title: "Fasika",
        notes: "Orthodox Easter school closure.",
        date: easterDate,
      },
    ].forEach((eventItem) => {
      const ethDate = EthiopicCalendar.ge(
        eventItem.date.getFullYear(),
        eventItem.date.getMonth() + 1,
        eventItem.date.getDate()
      );

      if (ethDate.year !== ethiopianYear) {
        return;
      }

      const eventKey = `${ethDate.year}-${ethDate.month}-${ethDate.day}-${eventItem.title}`;
      if (seenEventKeys.has(eventKey)) {
        return;
      }

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
};

const buildYearSpecificGovernmentClosures = (ethiopianYear) => {
  const gregorianEvents = YEAR_SPECIFIC_GOVERNMENT_CLOSURES_GREGORIAN[ethiopianYear] || [];

  return gregorianEvents
    .map((eventItem) => {
      const [year, month, day] = String(eventItem.date || "").split("-").map(Number);
      if (!year || !month || !day) {
        return null;
      }

      const ethiopianDate = EthiopicCalendar.ge(year, month, day);
      if (ethiopianDate.year !== ethiopianYear) {
        return null;
      }

      return {
        month: ethiopianDate.month,
        day: ethiopianDate.day,
        title: eventItem.title,
        notes: eventItem.notes,
      };
    })
    .filter(Boolean);
};

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

const buildDefaultCalendarEvents = (ethiopianYear) => [
  ...DEFAULT_ETHIOPIAN_SPECIAL_DAYS,
  ...buildMovableOrthodoxClosures(ethiopianYear),
  ...buildYearSpecificGovernmentClosures(ethiopianYear),
].map((eventItem) => {
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
    source: "default-closure",
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

const createDefaultSidebarSections = () => ({
  dashboard: false,
  academic: false,
  student: false,
  status: false,
  documents: false,
  reports: false,
  system: false,
});

let dashboardSidebarSectionsState = createDefaultSidebarSections();

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

function Dashboard() {
  const PRIMARY = "#007AFB";
  const BACKGROUND = "#FFFFFF";
  const ACCENT = "#00B6A9";
  const API_BASE = `${BACKEND_BASE}/api`;
  const DB_URL = "https://bale-house-rental-default-rtdb.firebaseio.com";
  // ---------------- STATE ----------------
  const _storedFinance = (() => {
    try {
      return JSON.parse(localStorage.getItem("registrar") || localStorage.getItem("admin")) || {};
    } catch (e) {
      return {};
    }
  })();

  const [finance, setFinance] = useState({
    financeId: _storedFinance.financeId || _storedFinance.adminId || "",
    userId: _storedFinance.userId || "",
    schoolCode: _storedFinance.schoolCode || "",
    name: _storedFinance.name || _storedFinance.username || "Register Office",
    username: _storedFinance.username || "",
    role: _storedFinance.role || _storedFinance.userType || "registrar",
    profileImage: _storedFinance.profileImage || "/default-profile.png",
    isActive: _storedFinance.isActive || false,
  });

  const schoolCode = finance.schoolCode || _storedFinance.schoolCode || "";
  const DB_ROOT = schoolCode ? `${DB_URL}/Platform1/Schools/${schoolCode}` : DB_URL;

  // Compatibility alias: older code refers to `admin` — map `finance` fields to `admin`
  const admin = {
    adminId: finance.financeId || finance.adminId || "",
    userId: finance.userId || "",
    name: finance.name || finance.username || "Register Office",
    profileImage: finance.profileImage || "/default-profile.png",
    isActive: finance.isActive || false,
  };
  const currentLikeActorId = admin.userId || admin.adminId || "";
  const currentCalendarRole = String(finance.role || _storedFinance.role || _storedFinance.userType || "registrar").trim().toLowerCase();
  const canManageCalendar = CALENDAR_MANAGER_ROLES.has(currentCalendarRole);

  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);
  const [postMediaMeta, setPostMediaMeta] = useState(null);
  const [isOptimizingMedia, setIsOptimizingMedia] = useState(false);
  const [targetRole, setTargetRole] = useState("all");
  const [targetOptions, setTargetOptions] = useState(["all"]);
  const fileInputRef = useRef(null);

  const [unreadMessages, setUnreadMessages] = useState([]);
  const [showMessengerDropdown, setShowMessengerDropdown] = useState(false);

  const [teachers, setTeachers] = useState([]);
  const [unreadTeachers, setUnreadTeachers] = useState({});
  const [popupMessages, setPopupMessages] = useState([]);
  const [recentContacts, setRecentContacts] = useState([]);
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [expandedPostDescriptions, setExpandedPostDescriptions] = useState({});
  const [sidebarSections, setSidebarSections] = useState(() => ({ ...dashboardSidebarSectionsState }));
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  // All unread messages from any sender type
  // Correct order
  const location = useLocation();
  const scrollToPostId = location.state?.scrollToPostId;
  const postIdToScroll = location.state?.postId;
  const postId = location.state?.postId;

  const [currentChat, setCurrentChat] = useState([]);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
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

  const financeUserId = finance.userId;
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const {
    unreadSenders,
    setUnreadSenders,
    unreadPosts: unreadPostList,
    setUnreadPosts: setUnreadPostList,
    messageCount,
    totalNotifications,
    markMessagesAsSeen,
    markPostAsSeen,
  } = useTopbarNotifications({
    dbRoot: DB_ROOT,
    currentUserId: admin.userId,
  });

  const navigate = useNavigate();
  const FEED_MAX_WIDTH = "min(1320px, 100%)";
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
  const softPanelStyle = {
    background: "var(--surface-muted)",
    border: "1px solid var(--border-soft)",
    borderRadius: 10,
  };
  const widgetCardStyle = {
    background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-accent) 100%)",
    borderRadius: 16,
    boxShadow: "var(--shadow-soft)",
    padding: "11px",
    border: "1px solid var(--border-soft)",
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
  const currentPath = location.pathname;
  const sidebarSectionStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };
  const sidebarSectionTitleStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 12,
    fontWeight: 800,
    color: "var(--text-primary)",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--border-strong)",
    background: "linear-gradient(135deg, var(--surface-accent) 0%, var(--surface-panel) 100%)",
    cursor: "pointer",
  };
  const sidebarSectionChildrenStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginLeft: 10,
    paddingLeft: 10,
    borderLeft: "2px solid var(--border-strong)",
  };
  const sidebarLinkBaseStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    marginLeft: 10,
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-secondary)",
    borderRadius: 12,
    background: "var(--surface-muted)",
    border: "1px solid var(--border-soft)",
  };
  const sidebarLinkActiveStyle = {
    background: "var(--accent-strong)",
    color: "#ffffff",
    border: "1px solid var(--accent-strong)",
    boxShadow: "var(--shadow-glow)",
  };
  const sidebarSectionRoutes = {
    dashboard: ["/dashboard", "/my-posts", "/overview"],
    academic: ["/academic-years", "/grede-management", "/promotion-system"],
    student: ["/students", "/student-register", "/parents"],
    status: ["/transfer-withdrawal"],
    documents: ["/document-generation"],
    reports: ["/analytics"],
    system: ["/settings"],
  };
  const isSidebarSectionActive = (sectionKey) =>
    (sidebarSectionRoutes[sectionKey] || []).includes(currentPath);
  const getSidebarSectionButtonStyle = (sectionKey) => (
    sidebarSections[sectionKey] || isSidebarSectionActive(sectionKey)
      ? {
          ...sidebarSectionTitleStyle,
          background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--surface-accent) 100%)",
          border: isSidebarSectionActive(sectionKey) ? "2px solid var(--accent)" : "1px solid var(--border-strong)",
          boxShadow: isSidebarSectionActive(sectionKey)
            ? "var(--shadow-glow)"
            : "var(--shadow-soft)",
          color: "var(--text-primary)",
        }
      : sidebarSectionTitleStyle
  );
  const getSidebarLinkStyle = (path) => (
    currentPath === path
      ? { ...sidebarLinkBaseStyle, ...sidebarLinkActiveStyle }
      : sidebarLinkBaseStyle
  );
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
  const toggleSidebarSection = (sectionKey) => {
    setSidebarSections((prev) => {
      const nextState = {
        ...prev,
        [sectionKey]: !prev[sectionKey],
      };

      dashboardSidebarSectionsState = nextState;
      return nextState;
    });
  };
  const isOverlayModalOpen = showCalendarEventModal;
  const canSubmitPost = Boolean(postText.trim() || postMedia) && !isOptimizingMedia;
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
    if (!canManageCalendar) {
      return;
    }

    if (eventItem.isDefault) {
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

  const handleCancelCalendarEdit = () => {
    setEditingCalendarEventId("");
    setCalendarEventForm({ title: "", category: "no-class", subType: "general", notes: "" });
    setCalendarModalContext("calendar");
    setShowCalendarEventModal(false);
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
  }, [schoolCode]);

  useEffect(() => {
    if (postId) {
      const element = document.getElementById(`post-${postId}`);
      if (element) element.scrollIntoView({ behavior: "smooth" });
    }
  }, [postId]);

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

  // ---------------- HELPER: LOAD ADMIN FROM LOCALSTORAGE ----------------
  const loadFinanceFromStorage = async () => {
    const stored = localStorage.getItem("registrar") || localStorage.getItem("admin");

    if (!stored) {
      setLoadingAdmin(false);
      return;
    }

    try {
      const financeData = JSON.parse(stored) || {};

      const financeKey = financeData.financeId || financeData.adminId || financeData.id || financeData.uid || "";
      const possibleUserId = financeData.userId || financeData.user_id || financeData.uid || financeData.user || "";

      // If financeKey exists try Finance -> School_Admins
      if (financeKey) {
        let res = null;
        try {
          res = (await axios.get(`${DB_ROOT}/Finance/${financeKey}.json`)) || null;
        } catch (err) {
          res = null;
        }

        if (!res || !res.data) {
          try {
            res = (await axios.get(`${DB_ROOT}/School_Admins/${financeKey}.json`)) || null;
          } catch (err) {
            res = null;
          }
        }

        if (res && res.data) {
          const node = res.data;
          const userId = node.userId || node.user_id || possibleUserId || "";
          if (userId) {
            try {
              const userRes = await axios.get(`${DB_ROOT}/Users/${userId}.json`);
              setFinance({
                financeId: financeKey,
                userId,
                schoolCode: financeData.schoolCode || "",
                name: userRes.data?.name || node.name || financeData.name || "Register Office",
                username: userRes.data?.username || financeData.username || "",
                role: node.role || node.userType || userRes.data?.role || userRes.data?.userType || financeData.role || financeData.userType || "registrar",
                profileImage: userRes.data?.profileImage || node.profileImage || financeData.profileImage || "/default-profile.png",
                isActive: node.isActive || financeData.isActive || false,
              });
            } catch (err) {
              setFinance({
                financeId: financeKey,
                userId,
                schoolCode: financeData.schoolCode || "",
                name: node.name || financeData.name || "Register Office",
                username: node.username || financeData.username || "",
                role: node.role || node.userType || financeData.role || financeData.userType || "registrar",
                profileImage: node.profileImage || financeData.profileImage || "/default-profile.png",
                isActive: node.isActive || financeData.isActive || false,
              });
            }
            setLoadingAdmin(false);
            return;
          }

          // node exists but no linked userId: use node fields
          setFinance({
            financeId: financeKey,
            userId: "",
            schoolCode: financeData.schoolCode || "",
            name: node.name || financeData.name || "Register Office",
            username: node.username || financeData.username || "",
            role: node.role || node.userType || financeData.role || financeData.userType || "registrar",
            profileImage: node.profileImage || financeData.profileImage || "/default-profile.png",
            isActive: node.isActive || financeData.isActive || false,
          });
          setLoadingAdmin(false);
          return;
        }
      }

      // If we don't have financeKey but have a userId, try Users
      if (possibleUserId) {
        try {
          const userRes = await axios.get(`${DB_ROOT}/Users/${possibleUserId}.json`);
          setFinance({
            financeId: financeData.financeId || financeData.adminId || "",
            userId: possibleUserId,
            schoolCode: financeData.schoolCode || "",
            name: userRes.data?.name || financeData.name || "Register Office",
            username: userRes.data?.username || financeData.username || "",
            role: userRes.data?.role || userRes.data?.userType || financeData.role || financeData.userType || "registrar",
            profileImage: userRes.data?.profileImage || financeData.profileImage || "/default-profile.png",
            isActive: financeData.isActive || false,
          });
          setLoadingAdmin(false);
          return;
        } catch (err) {
          // ignore and fallback
        }
      }

      // Fallback: use stored fields without clearing storage (prevents redirect on reload)
      setFinance({
        financeId: financeData.financeId || financeData.adminId || "",
        userId: financeData.userId || "",
        schoolCode: financeData.schoolCode || "",
        name: financeData.name || financeData.username || "Register Office",
        username: financeData.username || "",
        role: financeData.role || financeData.userType || "registrar",
        profileImage: financeData.profileImage || "/default-profile.png",
        isActive: financeData.isActive || false,
      });
    } catch (e) {
      // parsing failed: clear corrupted storage
      try {
        localStorage.removeItem("registrar");
        localStorage.removeItem("admin");
      } catch (err) {}
    }

    setLoadingAdmin(false);
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
    try {
      const res = await axios.get(`${API_BASE}/get_posts`, {
        params: { schoolCode },
      });
      console.log(res.data); // check here
      const sortedPosts = res.data.sort(
        (a, b) => new Date(b.time) - new Date(a.time)
      );
      const enriched = await Promise.all(sortedPosts.map(async (p) => {
        let profile = p.adminProfile || p.adminProfileImage || p.profileImage || "";

        try {
          if (!profile && p.userId) {
            const uRes = await axios.get(`${DB_ROOT}/Users/${p.userId}.json`);
            const u = uRes.data || {};
            profile = u.profileImage || u.profile || u.avatar || "";
          }

          if (!profile && (p.financeId || p.adminId)) {
            const ownerFinanceId = p.financeId || p.adminId;
            const fRes = await axios.get(`${DB_ROOT}/Finance/${ownerFinanceId}.json`);
            const f = fRes.data || {};
            profile = f.profileImage || f.profile || "";
          }
        } catch (err) {
          // ignore profile enrichment failure
        }

        return {
          ...p,
          adminProfile: profile || "/default-profile.png",
        };
      }));

      setPosts(enriched);
    } catch (err) {
      console.error("Error fetching posts:", err);
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

  useEffect(() => {
    const fetchTeachersAndUnread = async () => {
      if (!financeUserId) {
        setRecentContacts([]);
        setTargetOptions(buildRegisterTargetRoleOptions());
        return;
      }

      try {
        const nextRoles = buildRegisterTargetRoleOptions();
        setTargetOptions(nextRoles);
        setTargetRole((prev) => (nextRoles.includes(prev) ? prev : "all"));
        setTeachers([]);
        setUnreadTeachers({});
        setPopupMessages([]);

        const summaries = await fetchConversationSummaries({
          rtdbBase: DB_ROOT,
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
        console.error(err);
      }
    };

    fetchTeachersAndUnread();
  }, [DB_ROOT, financeUserId]);

  const openChatWithUser = async (userId) => {
    setShowMessengerDropdown(false);

    // Fetch chat history
    const res = await axios.get(`${API_BASE}/chat/${admin.userId}/${userId}`);
    setCurrentChat(res.data); // You need a state `currentChat` to render the conversation

    // Mark messages as read
    await axios.post(`${API_BASE}/mark_messages_read`, {
      financeId: finance.userId,
      senderId: userId
    });

    // Refresh unread messages
    setUnreadMessages(prev => prev.filter(m => m.senderId !== userId));
  };

  // ---------------- OPEN POST FROM NOTIFICATION ----------------
  const openPostFromNotif = async (post) => {
    setShowPostDropdown(false);

    try {
      await markPostAsSeen(post.postId);

      // Update post as seen in main feed
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

      // Scroll + highlight
      setTimeout(() => {
        const el = document.getElementById(`post-${post.postId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.backgroundColor = "var(--warning-soft)";
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
        element.style.backgroundColor = "color-mix(in srgb, var(--warning-soft) 72%, var(--surface-panel))";
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
    loadFinanceFromStorage();
    fetchPosts();
  }, []);

  // Add this effect to monitor admin state changes
  useEffect(() => {
    if (loadingAdmin) return;

    if (!admin.userId && !admin.adminId) {
      console.log("No admin found, redirecting to login");
      navigate("/login", { replace: true });
    }
  }, [loadingAdmin, admin.userId, admin.adminId]);

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

  const handlePost = async () => {
    if (!(postText.trim() || postMedia) || isOptimizingMedia) return;

    if (!admin.adminId || !admin.userId) {
      alert("Session expired");
      return;
    }

    // If a media file is selected, upload it to Firebase Storage and get a download URL
    let postUrl = "";
    try {
      if (postMedia) {
        const path = `posts/${Date.now()}_${postMedia.name.replace(/[^a-zA-Z0-9.\-_/]/g, "_")}`;
        const storageRef = sRef(storage, path);
        // upload as blob/file
        await uploadBytes(storageRef, postMedia);
        postUrl = await getDownloadURL(storageRef);
      }
    } catch (err) {
      console.error("Failed to upload media to Firebase Storage:", err);
      // proceed without media URL
    }

    const formData = new FormData();
    formData.append("message", postText);
    formData.append("postUrl", postUrl);

    // keep old admin fields for compatibility
    formData.append("adminId", admin.adminId); // ownership
    formData.append("userId", admin.userId);   // display & likes
    formData.append("adminName", admin.name);
    formData.append("adminProfile", admin.profileImage);

    // new finance fields (for Finance schema)
    formData.append("financeId", admin.adminId || "");
    formData.append("financeName", admin.name || "");
    formData.append("financeProfile", admin.profileImage || "");
    formData.append("schoolCode", schoolCode || "");
    formData.append("targetRole", targetRole || "all");

    await axios.post(`${API_BASE}/create_post`, formData);

    setPostText("");
    setPostMedia(null);
    setPostMediaMeta(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchPosts();
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
    if (!currentLikeActorId) return;

    try {
      const res = await axios.post(`${API_BASE}/like_post`, {
        postId,
        schoolCode,
        userId: currentLikeActorId,
        adminId: admin.adminId,
        financeId: finance.financeId,
      });

      if (res.data.success) {
        const liked = res.data.liked; // boolean returned by backend
        const likeCount = res.data.likeCount; // number returned by backend
        const nextLikes = { ...(res.data.likes || {}) };

        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId === postId
              ? {
                  ...post,
                  likeCount,
                  likes: nextLikes,
                }
              : post
          )
        );
      }
    } catch (err) {
      console.error("Error liking post:", err);
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
        "--surface-panel": BACKGROUND,
        "--surface-accent": "#F1F8FF",
        "--surface-muted": "#F7FBFF",
        "--surface-strong": "#DCEBFF",
        "--page-bg": BACKGROUND,
        "--page-bg-secondary": BACKGROUND,
        "--border-soft": "#D7E7FB",
        "--border-strong": "#B5D2F8",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": PRIMARY,
        "--accent-soft": "#E7F2FF",
        "--accent-strong": "#005FCC",
        "--success": ACCENT,
        "--success-soft": "#E9FBF9",
        "--success-border": "#AAEDE7",
        "--warning": "#DC2626",
        "--warning-soft": "#FEE2E2",
        "--warning-border": "#FCA5A5",
        "--danger": "#b91c1c",
        "--danger-soft": "#FEE2E2",
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

      {/* ---------------- TOP NAVIGATION BAR ---------------- */}
      <nav className="top-navbar" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface-overlay)" }}>
        <h2 style={{ color: "var(--text-primary)", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>

        <div className="nav-right">
          {/* Combined bell: posts + message senders */}
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
              <span
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-5px",
                  background: "var(--danger)",
                  color: "#fff",
                  borderRadius: "50%",
                  padding: "2px 6px",
                  fontSize: "10px",
                  fontWeight: "bold",
                }}
              >
                {totalNotifications}
              </span>
            )}
          </div>

          {/* ---------------- POST NOTIFICATION DROPDOWN ---------------- */}
          {showPostDropdown && (
            <div
              className="notification-dropdown"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "40px",
                right: "0",
                width: "360px",
                maxHeight: "420px",
                overflowY: "auto",
                background: "var(--surface-panel)",
                borderRadius: 10,
                boxShadow: "var(--shadow-panel)",
                border: "1px solid var(--border-soft)",
                zIndex: 1000,
                padding: 6,
              }}
            >
              {totalNotifications === 0 ? (
                <p style={{ padding: "12px", textAlign: "center", color: "var(--text-muted)" }}>
                  No new notifications
                </p>
              ) : (
                <div>
                  {/* Posts section */}
                  {unreadPostList.length > 0 && (
                    <div>
                      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-soft)", color: "var(--text-primary)", fontWeight: 700 }}>Posts</div>
                      {unreadPostList.map(post => (
                        <div
                          key={post.postId}
                          onClick={() => openPostFromNotif(post)}
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
                            {renderProfileAvatar(post.adminProfile, post.adminName, 46)}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong>{post.adminName}</strong>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 13,
                                color: "var(--text-secondary)",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {post.message || "New post"}
                            </p>
                          </div>

                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
                            {new Date(post.time || post.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Messages section */}
                  {messageCount > 0 && (
                    <div>
                      <div style={{ padding: '8px 10px', color: 'var(--text-primary)', fontWeight: 700, background: 'var(--surface-muted)', border: '1px solid var(--border-soft)', borderRadius: 6, margin: '8px 6px' }}>Messages</div>
                      {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                        <div
                          key={userId}
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
                          onClick={async () => {
                            // mark messages seen, remove sender and navigate to all-chat
                            await markMessagesAsSeen(userId);
                            setUnreadSenders(prev => {
                              const copy = { ...prev };
                              delete copy[userId];
                              return copy;
                            });
                            setShowPostDropdown(false);
                            navigate("/all-chat", {
                              state: {
                                user: {
                                  userId,
                                  name: sender.name,
                                  profileImage: sender.profileImage,
                                  type: sender.type
                                }
                              }
                            });
                          }}
                        >
                          {renderProfileAvatar(sender.profileImage, sender.name, 46, 8)}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ display: "block", marginBottom: 4, color: "var(--text-primary)" }}>{sender.name}</strong>
                            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {sender.count} new message{sender.count > 1 && "s"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Messenger */}
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={() => navigate("/all-chat")}
          >
            <FaFacebookMessenger />

            {/* 🔴 MESSAGE COUNT ONLY */}
            {messageCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-5px",
                  background: "var(--danger)",
                  color: "#fff",
                  borderRadius: "50%",
                  padding: "2px 6px",
                  fontSize: "10px",
                  fontWeight: "bold"
                }}
              >
                {messageCount}
              </span>
            )}
          </div>

          {/* Profile */}
          <div className="profile-img" style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
            {renderProfileAvatar(admin.profileImage, admin.name, 38)}
          </div>
          {/* <span>{admin.name}</span> */}
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "18px 14px", minHeight: "100vh", background: "var(--page-bg)", width: "100%", boxSizing: "border-box" }}>
        {/* LEFT SIDEBAR */}
        <div className="google-sidebar" style={{ width: 'clamp(230px, 16vw, 290px)', minWidth: 230, padding: 14, borderRadius: 24, background: 'var(--surface-panel)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-panel)', height: 'calc(100vh - 24px)', overflowY: 'auto', alignSelf: 'flex-start', position: 'sticky', top: 24, scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent', opacity: isOverlayModalOpen ? 0.45 : 1, filter: isOverlayModalOpen ? 'blur(1px)' : 'none', pointerEvents: isOverlayModalOpen ? 'none' : 'auto', transition: 'opacity 180ms ease, filter 180ms ease' }}>
          {/* Sidebar profile */}
          <div className="sidebar-profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 14px', marginBottom: 8, borderRadius: 18, background: 'linear-gradient(180deg, var(--surface-accent) 0%, var(--surface-panel) 100%)', border: '1px solid var(--border-strong)', boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 8%, transparent)' }}>
            <div className="sidebar-img-circle" style={{ width: 58, height: 58, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--border-strong)', boxShadow: 'var(--shadow-glow)' }}>
              {renderProfileAvatar(admin?.profileImage, admin?.name, 58)}
            </div>
            <div style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--surface-accent)', border: '1px solid var(--border-strong)', color: 'var(--accent)', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Register Office</div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center' }}>{admin?.name || "Admin Name"}</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{admin?.adminId || "username"}</p>
          </div>

          {/* Sidebar menu */}
          <div className="sidebar-menu" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
            <div style={sidebarSectionStyle}>
              <button type="button" onClick={() => toggleSidebarSection('dashboard')} style={getSidebarSectionButtonStyle('dashboard')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FaHome style={{ width: 15, height: 15, color: 'var(--accent-strong)' }} /> Dashboard
                </span>
                <FaChevronDown style={{ width: 12, height: 12, color: 'var(--accent)', transform: sidebarSections.dashboard ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }} />
              </button>
              {sidebarSections.dashboard ? (
                <div style={sidebarSectionChildrenStyle}>
                  <Link className="sidebar-btn" to="/dashboard" style={getSidebarLinkStyle('/dashboard')}>
                    Home
                  </Link>
                  <Link className="sidebar-btn" to="/my-posts" style={getSidebarLinkStyle('/my-posts')}>
                    My Posts
                  </Link>
                  <Link className="sidebar-btn" to="/overview" style={getSidebarLinkStyle('/overview')}>
                    Overview
                  </Link>
                </div>
              ) : null}
            </div>

            <div style={sidebarSectionStyle}>
              <button type="button" onClick={() => toggleSidebarSection('academic')} style={getSidebarSectionButtonStyle('academic')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FaUserGraduate style={{ width: 15, height: 15, color: 'var(--accent-strong)' }} /> Academic
                </span>
                <FaChevronDown style={{ width: 12, height: 12, color: 'var(--accent)', transform: sidebarSections.academic ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }} />
              </button>
              {sidebarSections.academic ? (
                <div style={sidebarSectionChildrenStyle}>
                  <Link className="sidebar-btn" to="/academic-years" style={getSidebarLinkStyle('/academic-years')}>
                    Academic Year
                  </Link>
                  <Link className="sidebar-btn" to="/grede-management" style={getSidebarLinkStyle('/grede-management')}>
                    Grade Management
                  </Link>
                  <Link className="sidebar-btn" to="/promotion-system" style={getSidebarLinkStyle('/promotion-system')}>
                    Promotion System
                  </Link>
                </div>
              ) : null}
            </div>

            <div style={sidebarSectionStyle}>
              <button type="button" onClick={() => toggleSidebarSection('student')} style={getSidebarSectionButtonStyle('student')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FaChalkboardTeacher style={{ width: 15, height: 15, color: 'var(--accent-strong)' }} /> Student
                </span>
                <FaChevronDown style={{ width: 12, height: 12, color: 'var(--accent)', transform: sidebarSections.student ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }} />
              </button>
              {sidebarSections.student ? (
                <div style={sidebarSectionChildrenStyle}>
                  <Link className="sidebar-btn" to="/students" style={getSidebarLinkStyle('/students')}>
                    Student
                  </Link>
                  <Link className="sidebar-btn" to="/student-register" style={getSidebarLinkStyle('/student-register')}>
                    Register Student
                  </Link>
                  <Link className="sidebar-btn" to="/parents" style={getSidebarLinkStyle('/parents')}>
                    Student Parent
                  </Link>
                </div>
              ) : null}
            </div>

            <div style={sidebarSectionStyle}>
              <button type="button" onClick={() => toggleSidebarSection('status')} style={getSidebarSectionButtonStyle('status')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FaExchangeAlt style={{ width: 15, height: 15, color: 'var(--accent-strong)' }} /> Student Status
                </span>
                <FaChevronDown style={{ width: 12, height: 12, color: 'var(--accent)', transform: sidebarSections.status ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }} />
              </button>
              {sidebarSections.status ? (
                <div style={sidebarSectionChildrenStyle}>
                  <Link className="sidebar-btn" to="/transfer-withdrawal" style={getSidebarLinkStyle('/transfer-withdrawal')}>
                    Transfer & Withdrawal
                  </Link>
                </div>
              ) : null}
            </div>

            <div style={sidebarSectionStyle}>
              <button type="button" onClick={() => toggleSidebarSection('documents')} style={getSidebarSectionButtonStyle('documents')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FaFolderOpen style={{ width: 15, height: 15, color: 'var(--accent-strong)' }} /> Documents
                </span>
                <FaChevronDown style={{ width: 12, height: 12, color: 'var(--accent)', transform: sidebarSections.documents ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }} />
              </button>
              {sidebarSections.documents ? (
                <div style={sidebarSectionChildrenStyle}>
                  <Link className="sidebar-btn" to="/document-generation" style={getSidebarLinkStyle('/document-generation')}>
                    Document Generation
                  </Link>
                </div>
              ) : null}
            </div>

            <div style={sidebarSectionStyle}>
              <button type="button" onClick={() => toggleSidebarSection('reports')} style={getSidebarSectionButtonStyle('reports')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FaChartLine style={{ width: 15, height: 15, color: 'var(--accent-strong)' }} /> Reports
                </span>
                <FaChevronDown style={{ width: 12, height: 12, color: 'var(--accent)', transform: sidebarSections.reports ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }} />
              </button>
              {sidebarSections.reports ? (
                <div style={sidebarSectionChildrenStyle}>
                  <Link className="sidebar-btn" to="/analytics" style={getSidebarLinkStyle('/analytics')}>
                    Analytics
                  </Link>
                </div>
              ) : null}
            </div>

            <div style={sidebarSectionStyle}>
              <button type="button" onClick={() => toggleSidebarSection('system')} style={getSidebarSectionButtonStyle('system')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FaCog style={{ width: 15, height: 15, color: 'var(--accent-strong)' }} /> System
                </span>
                <FaChevronDown style={{ width: 12, height: 12, color: 'var(--accent)', transform: sidebarSections.system ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }} />
              </button>
              {sidebarSections.system ? (
                <div style={sidebarSectionChildrenStyle}>
                  <Link className="sidebar-btn" to="/settings" style={getSidebarLinkStyle('/settings')}>
                    Settings
                  </Link>
                </div>
              ) : null}
            </div>

            <button
              className="sidebar-btn logout-btn"
              onClick={() => {
                localStorage.removeItem("admin");
                localStorage.removeItem("registrar");
                window.location.href = "/login";
              }}
              style={{ ...sidebarLinkBaseStyle, marginLeft: 0, justifyContent: 'center', color: 'var(--danger)', background: 'var(--danger-soft)', border: '1px solid var(--danger-border)' }}
            >
              <FaSignOutAlt style={{ width: 15, height: 15 }} /> Logout
            </button>
          </div>
        </div>

        {/* MIDDLE FEED COLUMN */}
        <div className="main-content google-main" style={{ flex: '1.08 1 0', minWidth: 0, maxWidth: 'none', margin: '0', boxSizing: 'border-box', alignSelf: 'flex-start', height: 'calc(100vh - 24px)', overflowY: 'auto', position: 'sticky', top: 24, scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent', padding: '0 2px', opacity: isOverlayModalOpen ? 0.45 : 1, filter: isOverlayModalOpen ? 'blur(1px)' : 'none', pointerEvents: isOverlayModalOpen ? 'none' : 'auto', transition: 'opacity 180ms ease, filter 180ms ease' }}>
          {/* Feed header */}
          <div className="section-header-card" style={{ ...FEED_SECTION_STYLE, margin: "0 auto 14px" }}>
            <div className="section-header-card__title" style={{ fontSize: 17 }}>School Updates Feed</div>
            <div className="section-header-card__subtitle">Post announcements, payment reminders, and notices.</div>
          </div>

          {/* Post input box */}
          <div className="post-box" style={{ ...FEED_SECTION_STYLE, ...shellCardStyle, margin: "0 auto 14px", borderRadius: 12, overflow: "hidden", padding: "10px 12px" }}>
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
              {/* Reel button removed as requested */}
            </div>
          </div>

          {/* Posts container */}
          <div className="posts-container" style={{ ...FEED_SECTION_STYLE, display: "flex", flexDirection: "column", gap: 12 }}>
            {posts.map((post) => (
              <div className="post-card facebook-post-card" id={`post-${post.postId}`} key={post.postId} style={{ ...shellCardStyle, borderRadius: 10, overflow: "hidden" }}>
                <div className="post-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "12px 16px 8px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, flex: 1 }}>
                  {renderProfileAvatar(post.adminProfile, post.adminName, 40)}
                  <div className="post-info" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: 15, color: "var(--text-primary)", fontWeight: 700, lineHeight: 1.2 }}>{post.adminName}</h4>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2, fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
                      <span>{post.time}</span>
                      <span>·</span>
                      <span>{post.targetRole && post.targetRole !== "all" ? `Visible to ${post.targetRole}` : "Visible to everyone"}</span>
                    </div>
                  </div>
                  </div>
                  <button
                    type="button"
                    style={{ width: 36, height: 36, border: "none", borderRadius: "50%", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    aria-label="Post options"
                    title="Post options"
                  >
                    <FaEllipsisH style={{ width: 14, height: 14 }} />
                  </button>
                </div>

                {post.message ? (() => {
                  const canExpandPost = shouldShowPostSeeMore(post.message);
                  const isPostExpanded = !!expandedPostDescriptions[post.postId];

                  return (
                    <div style={{ padding: "0 16px 12px", color: "var(--text-primary)", fontSize: 15, lineHeight: 1.3333, wordBreak: "break-word" }}>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          overflow: canExpandPost && !isPostExpanded ? "hidden" : "visible",
                          display: canExpandPost && !isPostExpanded ? "-webkit-box" : "block",
                          WebkitBoxOrient: canExpandPost && !isPostExpanded ? "vertical" : "initial",
                          WebkitLineClamp: canExpandPost && !isPostExpanded ? 3 : "unset",
                        }}
                      >
                        {post.message}
                      </div>
                      {canExpandPost ? (
                        <button
                          type="button"
                          onClick={() => togglePostDescription(post.postId)}
                          style={{
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            marginTop: 4,
                            color: "var(--text-muted)",
                            fontSize: 15,
                            fontWeight: 600,
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
                  <div className="facebook-post-media-wrap" style={{ background: "#000", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img
                      className="facebook-post-media"
                      src={post.postUrl}
                      alt="post media"
                      style={{ width: "100%", height: "auto", maxHeight: "min(78vh, 720px)", objectFit: "contain", display: "block", margin: "0 auto" }}
                    />
                  </div>
                )}

                <div style={{ padding: "10px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13, color: "var(--text-muted)" }}>
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
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT WIDGETS COLUMN */}
        <div className="dashboard-widgets" style={{ width: 'clamp(300px, 21vw, 360px)', minWidth: 300, maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'flex-start', height: 'calc(100vh - 24px)', overflowY: 'auto', position: 'sticky', top: 24, scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent', paddingRight: 2, marginLeft: 'auto', marginRight: 0, opacity: isOverlayModalOpen ? 0.45 : 1, filter: isOverlayModalOpen ? 'blur(1px)' : 'none', pointerEvents: isOverlayModalOpen ? 'none' : 'auto', transition: 'opacity 180ms ease, filter 180ms ease' }}>
          {/* Quick Statistics */}
          <div style={widgetCardStyle}>
            <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Quick Statistics</h4>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'nowrap' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={smallStatStyle}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>My Posts</div>
                  <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{posts.filter(p => p.userId === admin.userId || p.adminId === admin.adminId || p.financeId === admin.adminId).length}</div>
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
                  <strong style={{ color: 'var(--text-primary)' }}>{posts.filter(p => new Date(p.time).toDateString() === new Date().toDateString()).length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', ...softPanelStyle, padding: '7px 8px', fontSize: 10 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Messages</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{messageCount}</strong>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Recent Contacts</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recentContacts.length === 0 ? (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', ...softPanelStyle, padding: '7px 8px' }}>
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
                        style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', ...softPanelStyle, padding: '5px 6px', cursor: 'pointer' }}
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
                    <div style={{ width: 34, height: 34, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent) 20%, transparent) 100%)', color: 'var(--accent-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 30%, transparent), var(--shadow-glow)' }}>
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
                      style={{ width: 28, height: 28, borderRadius: 9, border: '1px solid var(--border-soft)', background: 'var(--surface-panel)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 17, lineHeight: 1, boxShadow: 'var(--shadow-soft)' }}
                      aria-label="Previous month"
                      title="Previous month"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(1)}
                      style={{ width: 28, height: 28, borderRadius: 9, border: '1px solid var(--border-soft)', background: 'var(--surface-panel)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 17, lineHeight: 1, boxShadow: 'var(--shadow-soft)' }}
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
                        ? 'linear-gradient(145deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent) 26%, transparent) 100%)'
                        : isSelected
                          ? 'linear-gradient(145deg, var(--surface-accent) 0%, var(--accent-soft) 55%, color-mix(in srgb, var(--accent) 26%, transparent) 100%)'
                          : isNoClassDay
                            ? 'linear-gradient(145deg, color-mix(in srgb, var(--warning-soft) 78%, var(--surface-panel) 22%) 0%, var(--warning-soft) 100%)'
                            : isAcademicDay
                              ? 'linear-gradient(145deg, color-mix(in srgb, var(--success-soft) 78%, var(--surface-panel) 22%) 0%, var(--success-soft) 100%)'
                              : isWeekend
                                ? 'linear-gradient(145deg, var(--surface-muted) 0%, color-mix(in srgb, var(--surface-muted) 84%, var(--page-bg) 16%) 100%)'
                                : 'linear-gradient(145deg, var(--surface-panel) 0%, var(--surface-muted) 100%)'
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
                              ? '1px solid var(--border-strong)'
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
                              ? 'var(--shadow-glow)'
                              : isHovered
                                ? 'var(--shadow-soft)'
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
                            <div style={{ fontSize: 8, color: isSelected ? 'var(--accent)' : 'var(--text-muted)', lineHeight: 1 }}>{day.gregorianDate.day}/{day.gregorianDate.month}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 6 }}>
                              {day.events.slice(0, 2).map((eventItem) => (
                                <span
                                  key={eventItem.id}
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: '50%',
                                    background: getCalendarEventMeta(eventItem.category).color,
                                    boxShadow: '0 0 0 2px color-mix(in srgb, var(--surface-panel) 84%, transparent)',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--text-secondary)', fontWeight: 800, background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 999, padding: '5px 8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)' }} /> No class
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--text-secondary)', fontWeight: 800, background: 'var(--success-soft)', border: '1px solid var(--success-border)', borderRadius: 999, padding: '5px 8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} /> Academic
                </div>
                {canManageCalendar ? (
                  <button
                    type="button"
                    onClick={handleOpenCalendarEventModal}
                    style={{ width: 30, height: 30, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'linear-gradient(135deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent) 20%, transparent) 100%)', color: 'var(--accent-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-glow)' }}
                    aria-label="Add school calendar event"
                    title="Add school calendar event"
                  >
                    <FaPlus style={{ width: 12, height: 12 }} />
                  </button>
                ) : null}
              </div>

              {calendarActionMessage ? (
                <div style={{ marginTop: 10, borderRadius: 12, border: '1px solid var(--success-border)', background: 'linear-gradient(180deg, color-mix(in srgb, var(--success-soft) 76%, var(--surface-panel) 24%) 0%, var(--success-soft) 100%)', color: 'var(--success)', fontSize: 10, fontWeight: 800, padding: '8px 10px', boxShadow: 'var(--shadow-soft)' }}>
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
                                style={{ height: 26, padding: '0 9px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--surface-panel)', color: 'var(--text-secondary)', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
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

            <div style={{ background: 'linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)', borderRadius: 16, boxShadow: 'var(--shadow-soft)', padding: '11px', border: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Upcoming Deadlines</h4>
                {canManageCalendar ? (
                  <button
                    type="button"
                    onClick={handleOpenDeadlineModal}
                    style={{ width: 28, height: 28, borderRadius: 999, border: '1px solid var(--success-border)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--success-soft) 72%, var(--surface-panel) 28%) 0%, var(--success-soft) 100%)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-soft)' }}
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
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>
                            {eventMeta.label}
                            {eventItem.ethiopianDate?.month && eventItem.ethiopianDate?.day
                              ? ` • ${ETHIOPIAN_MONTHS[eventItem.ethiopianDate.month - 1]} ${eventItem.ethiopianDate.day}`
                              : ''}
                          </div>
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
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

          {/* Quick Links */}
          <div style={{ background: 'linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)', borderRadius: 16, boxShadow: 'var(--shadow-soft)', padding: '13px', border: '1px solid var(--border-soft)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Sponsored Links</h4>
            <ul style={{ margin: '10px 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
              <li style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>Gojo Study App</li>
              <li style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>Finance Portal</li>
              <li style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>HR Management</li>
            </ul>
          </div>

        </div>
      </div>

      {showCreatePostModal ? (
        <>
          <div
            onClick={() => setShowCreatePostModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.18)", backdropFilter: "blur(10px)", zIndex: 1200 }}
          />
          <div style={{ position: "fixed", inset: 0, zIndex: 1201, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, pointerEvents: "none" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "min(640px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "var(--surface-panel)", borderRadius: 28, border: "1px solid var(--border-soft)", boxShadow: "none", pointerEvents: "auto", position: "relative" }}>
              <div style={{ position: "relative", padding: "22px 24px 18px", borderBottom: "1px solid var(--border-soft)", background: "var(--surface-panel)" }}>
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
                    <div style={{ borderRadius: "50%", boxShadow: "var(--shadow-glow)", flexShrink: 0 }}>
                      {renderProfileAvatar(admin.profileImage, admin.name, 48)}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{admin.name || "Register Office"}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Posting from the register dashboard</div>
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
                        return <option key={role} value={role}>{label}</option>;
                      })}
                    </select>
                  </div>
                </div>

                <div style={{ border: "1px solid var(--border-soft)", borderRadius: 24, background: "var(--surface-panel)", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px 12px", borderBottom: "1px solid color-mix(in srgb, var(--border-soft) 80%, transparent 20%)" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>Post message</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{postText.trim().length} characters</div>
                  </div>

                  <textarea
                    placeholder="Write a clear announcement for your school community..."
                    value={postText}
                    onChange={(event) => setPostText(event.target.value)}
                    style={{ minHeight: 220, resize: "vertical", border: "none", background: "transparent", borderRadius: 0, padding: "18px 18px 16px", fontSize: 19, lineHeight: 1.6, outline: "none", color: "var(--text-primary)", width: "100%", boxSizing: "border-box" }}
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

                    {postMedia ? (
                      <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--surface-muted)", borderRadius: 16, border: "1px solid var(--border-soft)", boxSizing: "border-box" }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: String(postMedia.type || "").startsWith("video/") ? "var(--warning-soft)" : "var(--success-soft)", color: String(postMedia.type || "").startsWith("video/") ? "var(--danger)" : "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {String(postMedia.type || "").startsWith("video/") ? <AiFillVideoCamera style={{ fontSize: 20 }} /> : <AiFillPicture style={{ fontSize: 20 }} />}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{postMedia.name}</div>
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
                    ) : null}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingTop: 2 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Your post will appear in the register feed immediately after publishing.
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
                    <button
                      type="button"
                      onClick={() => setShowCreatePostModal(false)}
                      style={{ height: 44, padding: "0 18px", borderRadius: 999, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleSubmitCreatePost}
                      disabled={!canSubmitPost}
                      style={{ minWidth: 160, height: 46, border: "none", background: canSubmitPost ? "var(--accent)" : "var(--surface-strong)", borderRadius: 999, color: canSubmitPost ? "#fff" : "var(--text-muted)", fontSize: 14, fontWeight: 800, letterSpacing: "0.01em", cursor: canSubmitPost ? "pointer" : "not-allowed", boxShadow: canSubmitPost ? "0 8px 18px rgba(0, 122, 251, 0.14)" : "none" }}
                    >
                      {isOptimizingMedia ? "Optimizing..." : "Publish post"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

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
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(-1)}
                      style={{ width: 28, height: 28, borderRadius: 9, border: '1px solid var(--border-soft)', background: 'var(--surface-overlay)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 16, lineHeight: 1, boxShadow: 'var(--shadow-soft)' }}
                      aria-label="Previous Ethiopian month"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(1)}
                      style={{ width: 28, height: 28, borderRadius: 9, border: '1px solid var(--border-soft)', background: 'var(--surface-overlay)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 16, lineHeight: 1, boxShadow: 'var(--shadow-soft)' }}
                      aria-label="Next Ethiopian month"
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 5 }}>
                  {CALENDAR_WEEK_DAYS.map((dayLabel) => (
                    <div key={dayLabel} style={{ textAlign: 'center', fontSize: 8, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                            <div style={{ fontSize: 8, color: isSelectedDay ? 'var(--accent-strong)' : 'var(--text-secondary)', lineHeight: 1 }}>{dayItem.gregorianDate.day}/{dayItem.gregorianDate.month}</div>
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
                  style={{ height: 42, borderRadius: 12, border: '1px solid var(--input-border)', padding: '0 12px', fontSize: 12, color: 'var(--text-primary)', background: 'var(--input-bg)' }}
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
                  style={{ height: 42, borderRadius: 12, border: '1px solid var(--input-border)', padding: '0 12px', fontSize: 12, color: 'var(--text-primary)', background: 'var(--input-bg)' }}
                />
              ) : null}

              <textarea
                value={calendarEventForm.notes}
                onChange={(e) => setCalendarEventForm((prev) => ({ ...prev, notes: e.target.value }))}
                disabled={!canManageCalendar}
                placeholder={calendarModalContext === 'deadline' ? 'Optional deadline note' : 'Optional note'}
                rows={3}
                style={{ borderRadius: 12, border: '1px solid var(--input-border)', padding: '12px', fontSize: 12, color: 'var(--text-primary)', background: 'var(--input-bg)', resize: 'vertical' }}
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
                  style={{ height: 42, padding: '0 14px', borderRadius: 12, border: '1px solid var(--border-soft)', background: 'var(--surface-overlay)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
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

export default Dashboard;