import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { FaRegHeart, FaHeart, FaCalendarAlt, FaPlus } from "react-icons/fa";
import axios from "axios";
import EthiopicCalendar from "ethiopic-calendar";
import "../styles/global.css";
import { API_BASE } from "../api/apiConfig";
import { db, schoolPath } from "../firebase";
import { ref, get } from "firebase/database";
import { getRtdbRoot } from "../api/rtdbScope";

const RTDB_BASE = getRtdbRoot();

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

const buildDefaultCalendarEvents = (ethiopianYear) =>
  [
    ...DEFAULT_ETHIOPIAN_SPECIAL_DAYS,
    ...buildMovableOrthodoxClosures(ethiopianYear),
    ...buildYearSpecificGovernmentClosures(ethiopianYear),
  ].map((eventItem) => {
    const gregorianDate = EthiopicCalendar.eg(
      ethiopianYear,
      eventItem.month,
      eventItem.day
    );
    const isoDate = `${gregorianDate.year}-${String(gregorianDate.month).padStart(
      2,
      "0"
    )}-${String(gregorianDate.day).padStart(2, "0")}`;

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
      showInUpcomingDeadlines: false,
      source: "default-closure",
    };
  });

function getSafeProfileImage(profileImage) {
  if (!profileImage) return "/default-profile.png";
  if (
    typeof profileImage !== "string" ||
    !profileImage.trim() ||
    profileImage === "null" ||
    profileImage === "undefined"
  ) {
    return "/default-profile.png";
  }
  return profileImage;
}

export default function Dashboard() {
  const CALENDAR_MANAGER_ROLES = new Set([
    "registrar",
    "registerer",
    "admin",
    "school_admin",
    "school-admin",
  ]);
  const CALENDAR_WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 600);
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [posts, setPosts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [calendarViewDate, setCalendarViewDate] = useState(() => ({
    year: EthiopicCalendar.ge(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate()
    ).year,
    month: EthiopicCalendar.ge(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate()
    ).month,
  }));
  const [selectedCalendarIsoDate, setSelectedCalendarIsoDate] = useState("");
  const [hoveredCalendarIsoDate, setHoveredCalendarIsoDate] = useState("");
  const [showAllUpcomingDeadlines, setShowAllUpcomingDeadlines] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarEventsLoading, setCalendarEventsLoading] = useState(false);
  const [calendarEventForm, setCalendarEventForm] = useState({
    title: "",
    category: "no-class",
    subType: "general",
    notes: "",
  });
  const [calendarEventSaving, setCalendarEventSaving] = useState(false);
  const [editingCalendarEventId, setEditingCalendarEventId] = useState("");
  const [calendarActionMessage, setCalendarActionMessage] = useState("");
  const [showCalendarEventModal, setShowCalendarEventModal] = useState(false);
  const [calendarModalContext, setCalendarModalContext] = useState("calendar");
  const postRefs = useRef({});
  const teacherId = teacher?.userId || null;
  const role = String(teacher?.role || teacher?.userType || "teacher").trim().toLowerCase();
  const canManageCalendar = CALENDAR_MANAGER_ROLES.has(role);
  const isOverlayModalOpen = showCalendarEventModal;
  const schoolCode =
    teacher?.schoolCode ||
    JSON.parse(localStorage.getItem("teacher") || "{}").schoolCode ||
    "";
  const DB_ROOT = schoolCode
    ? `${RTDB_BASE}/Platform1/Schools/${schoolCode}`
    : RTDB_BASE;

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
  const FEED_SECTION_STYLE = {
    width: "100%",
    maxWidth: 560,
  };
  const shellCardStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
  };

  const CALENDAR_EVENT_META = {
    academic: {
      label: "Academic",
      color: "var(--success)",
      background: "var(--success-soft)",
      border: "var(--success-border)",
    },
    "no-class": {
      label: "No class",
      color: "var(--warning)",
      background: "var(--warning-soft)",
      border: "var(--warning-border)",
    },
  };

  const getCalendarEventKey = (category) => {
    if (category === "academic") return "academic";
    return "no-class";
  };

  const normalizeCalendarEvent = (eventId, eventValue) => {
    const legacyType = eventValue?.type || "academic";
    const category =
      eventValue?.category ||
      (legacyType === "academic" ? "academic" : "no-class");

    return {
      id: eventId,
      title: eventValue?.title || getCalendarEventMeta(category).label,
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

  const sortCalendarEvents = (events) =>
    [...events].sort((leftEvent, rightEvent) => {
      const dateComparison = String(leftEvent.gregorianDate || "").localeCompare(
        String(rightEvent.gregorianDate || "")
      );
      if (dateComparison !== 0) return dateComparison;
      return String(leftEvent.createdAt || "").localeCompare(
        String(rightEvent.createdAt || "")
      );
    });

  const getCalendarEventMeta = (category) => {
    if (category === "academic") return CALENDAR_EVENT_META.academic;
    return CALENDAR_EVENT_META["no-class"];
  };

  const formatCalendarDeadlineDate = (isoDate) => {
    if (!isoDate) return "";
    const parsedDate = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return "";
    return parsedDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getSeenPosts = (teacherUserId) => {
    return JSON.parse(localStorage.getItem(`seen_posts_${teacherUserId}`)) || [];
  };

  const saveSeenPost = (teacherUserId, postId) => {
    const seen = getSeenPosts(teacherUserId);
    if (!seen.includes(postId)) {
      localStorage.setItem(
        `seen_posts_${teacherUserId}`,
        JSON.stringify([...seen, postId])
      );
    }
  };

  const fetchPostsAndAdmins = async () => {
    try {
      const postsResp = await axios.get(`${API_BASE}/get_posts`);
      let postsData = postsResp.data || [];
      if (!Array.isArray(postsData) && typeof postsData === "object") {
        postsData = Object.values(postsData);
      }

      const finalPosts = postsData.map((post) => {
        const postId = post.postId || post.id || post.key || "";
        let likesArray = [];

        if (Array.isArray(post.likes)) likesArray = post.likes;
        else if (post.likes && typeof post.likes === "object") {
          likesArray = Object.keys(post.likes);
        }

        const timeValue = post.time || post.timestamp || post.createdAt || null;

        return {
          ...post,
          postId,
          adminName: post.adminName || "Admin",
          adminProfile: getSafeProfileImage(post.adminProfile),
          time: timeValue,
          likes: likesArray,
          likeCount: post.likeCount || likesArray.length || 0,
        };
      });

      finalPosts.sort((a, b) => {
        const ta = a.time ? new Date(a.time).getTime() : 0;
        const tb = b.time ? new Date(b.time).getTime() : 0;
        return tb - ta;
      });

      setPosts(finalPosts);

      const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
      const seenPosts = getSeenPosts(storedTeacher?.userId);

      const notifs = finalPosts
        .filter((p) => !seenPosts.includes(p.postId))
        .slice(0, 5)
        .map((p) => ({
          id: p.postId,
          title: p.message?.substring(0, 80) || "Untitled post",
          adminName: p.adminName,
          adminProfile: p.adminProfile,
        }));

      setNotifications(notifs);
    } catch (err) {
      console.error("Error fetching posts/admins handshake:", err);
    }
  };

  const fetchConversations = async (currentTeacher = teacher) => {
    try {
      const t = currentTeacher || JSON.parse(localStorage.getItem("teacher"));
      if (!t || !t.userId) {
        setConversations([]);
        return;
      }

      const [chatsRes, usersRes] = await Promise.all([
        axios.get(`${RTDB_BASE}/Chats.json`),
        axios.get(`${RTDB_BASE}/Users.json`),
      ]);
      const chats = chatsRes.data || {};
      const users = usersRes.data || {};

      const usersByKey = users || {};
      const userKeyByUserId = {};
      Object.entries(usersByKey).forEach(([pushKey, u]) => {
        if (u && u.userId) userKeyByUserId[u.userId] = pushKey;
      });

      const convs = Object.entries(chats)
        .map(([chatId, chat]) => {
          const unreadMap = chat.unread || {};
          const unreadForMe = unreadMap[t.userId] || 0;
          if (!unreadForMe) return null;

          const participants = chat.participants || {};
          const otherKeyCandidate = Object.keys(participants || {}).find(
            (p) => p !== t.userId
          );
          if (!otherKeyCandidate) return null;

          let otherPushKey = otherKeyCandidate;
          let otherRecord = usersByKey[otherPushKey];

          if (!otherRecord) {
            const mappedPushKey = userKeyByUserId[otherKeyCandidate];
            if (mappedPushKey) {
              otherPushKey = mappedPushKey;
              otherRecord = usersByKey[mappedPushKey];
            }
          }

          if (!otherRecord) {
            otherRecord = {
              userId: otherKeyCandidate,
              name: otherKeyCandidate,
              profileImage: "/default-profile.png",
            };
          }

          const contact = {
            pushKey: otherPushKey,
            userId: otherRecord.userId || otherKeyCandidate,
            name: otherRecord.name || otherRecord.username || otherKeyCandidate,
            profileImage: getSafeProfileImage(
              otherRecord.profileImage || otherRecord.profile || ""
            ),
          };

          const lastMessage = chat.lastMessage || {};

          return {
            chatId,
            contact,
            displayName: contact.name,
            profile: contact.profileImage,
            lastMessageText: lastMessage.text || "",
            lastMessageTime: lastMessage.timeStamp || lastMessage.time || null,
            unreadForMe,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

      setConversations(convs);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setConversations([]);
    }
  };

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("teacher"));
    if (!stored) {
      navigate("/login");
      return;
    }

    const fetchTeacherProfile = async () => {
      try {
        const usersRef = ref(db, schoolPath("Users"));
        const snapshot = await get(usersRef);
        const usersData = snapshot.val() || {};

        const teacherEntry = Object.values(usersData).find(
          (u) => u.userId === stored.userId
        );

        if (teacherEntry) {
          const merged = { ...stored, ...teacherEntry };
          setTeacher(merged);
          localStorage.setItem("teacher", JSON.stringify(merged));
        } else {
          setTeacher(stored);
        }
      } catch (err) {
        setTeacher(stored);
      }
    };

    fetchTeacherProfile();
    fetchPostsAndAdmins();
    fetchConversations(stored);
  }, [navigate]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 600) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLike = async (postId) => {
    try {
      if (!teacherId) return;

      const res = await axios.post(`${API_BASE}/like_post`, {
        postId,
        teacherId,
      });

      if (res.data.success) {
        const liked = res.data.liked;
        const likeCount = res.data.likeCount;

        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId === postId
              ? {
                  ...post,
                  likeCount,
                  likes: {
                    ...(post.likes || {}),
                    [teacherId]: liked ? true : undefined,
                  },
                }
              : post
          )
        );
      }
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  const handleNotificationClick = (postId) => {
    if (!teacher) return;
    if (teacherId) saveSeenPost(teacherId, postId);
    setHighlightedPostId(postId);
    const el = postRefs.current[postId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setNotifications((prev) => prev.filter((n) => n.id !== postId));
    setTimeout(() => setHighlightedPostId(null), 3000);
  };

  const handleOpenConversation = async (conv) => {
    if (!teacher || !conv) return;
    const { chatId, contact } = conv;

    navigate("/all-chat", { state: { contact, chatId } });

    try {
      await axios.put(`${RTDB_BASE}/Chats/${chatId}/unread/${teacherId}.json`, null);
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }

    setConversations((prev) => prev.filter((item) => item.chatId !== chatId));
  };

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  const totalUnreadMessages = conversations.reduce(
    (sum, c) => sum + (c.unreadForMe || 0),
    0
  );
  const messageCount = totalUnreadMessages;
  const recentConversations = conversations.slice(0, 5);
  const totalNotifications = notifications.length + totalUnreadMessages;
  const totalPostsToday = posts.filter((post) => {
    const timestamp = post.time ? new Date(post.time) : null;
    if (!timestamp || Number.isNaN(timestamp.getTime())) return false;
    const now = new Date();
    return (
      timestamp.getDate() === now.getDate() &&
      timestamp.getMonth() === now.getMonth() &&
      timestamp.getFullYear() === now.getFullYear()
    );
  }).length;

  const recentContacts = recentConversations
    .map((conv) => ({
      userId: conv.contact?.userId || conv.contact?.pushKey || conv.chatId,
      chatId: conv.chatId,
      name: conv.displayName || "User",
      profileImage: conv.profile || "/default-profile.png",
      type: "user",
      lastMessage:
        conv.lastMessageText ||
        `${Number(conv.unreadForMe || 0)} unread message${
          Number(conv.unreadForMe || 0) === 1 ? "" : "s"
        }`,
    }))
    .slice(0, 4);

  const handleCalendarMonthChange = (offset) => {
    setCalendarViewDate((currentDate) => {
      let nextYear = currentDate.year;
      let nextMonth = currentDate.month + offset;

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

  const calendarNow = new Date();
  const currentEthiopicDate = EthiopicCalendar.ge(
    calendarNow.getFullYear(),
    calendarNow.getMonth() + 1,
    calendarNow.getDate()
  );
  const calendarDaysInMonth =
    calendarViewDate.month === 13
      ? calendarViewDate.year % 4 === 3
        ? 6
        : 5
      : 30;
  const calendarMonthStartGregorian = EthiopicCalendar.eg(
    calendarViewDate.year,
    calendarViewDate.month,
    1
  );
  const calendarMonthEndGregorian = EthiopicCalendar.eg(
    calendarViewDate.year,
    calendarViewDate.month,
    calendarDaysInMonth
  );
  const calendarFirstWeekday = new Date(
    calendarMonthStartGregorian.year,
    calendarMonthStartGregorian.month - 1,
    calendarMonthStartGregorian.day
  ).getDay();
  const isCurrentCalendarMonth =
    calendarViewDate.year === currentEthiopicDate.year &&
    calendarViewDate.month === currentEthiopicDate.month;
  const calendarHighlightedDay = isCurrentCalendarMonth
    ? currentEthiopicDate.day
    : null;

  const calendarMonthLabel = `${ETHIOPIAN_MONTHS[calendarViewDate.month - 1]} ${calendarViewDate.year}`;

  const defaultCalendarEvents = buildDefaultCalendarEvents(calendarViewDate.year);
  const mergedCalendarEvents = sortCalendarEvents([
    ...defaultCalendarEvents,
    ...calendarEvents,
  ]);
  const calendarEventsByDate = mergedCalendarEvents.reduce((eventsMap, eventItem) => {
    const eventDate = String(eventItem.gregorianDate || "");
    if (!eventDate) return eventsMap;
    if (!eventsMap[eventDate]) {
      eventsMap[eventDate] = [];
    }
    eventsMap[eventDate].push(eventItem);
    return eventsMap;
  }, {});

  const calendarDays = Array.from(
    { length: calendarFirstWeekday + calendarDaysInMonth },
    (_, index) => {
      const dayNumber = index - calendarFirstWeekday + 1;
      if (dayNumber < 1 || dayNumber > calendarDaysInMonth) return null;

      const gregorianDate = EthiopicCalendar.eg(
        calendarViewDate.year,
        calendarViewDate.month,
        dayNumber
      );
      const isoDate = `${gregorianDate.year}-${String(gregorianDate.month).padStart(
        2,
        "0"
      )}-${String(gregorianDate.day).padStart(2, "0")}`;

      return {
        ethDay: dayNumber,
        isoDate,
        gregorianDate,
        events: calendarEventsByDate[isoDate] || [],
      };
    }
  );

  const monthlyCalendarEvents = sortCalendarEvents(
    [...calendarDays]
    .filter(Boolean)
    .flatMap((dayItem) => dayItem.events.map((eventItem) => ({ ...eventItem, ethDay: dayItem.ethDay })))
  );

  const selectedCalendarDay =
    calendarDays.find((dayItem) => dayItem?.isoDate === selectedCalendarIsoDate) ||
    null;
  const selectedCalendarEvents = selectedCalendarDay?.events || [];

  const deadlineWindowEnd = new Date(calendarNow);
  deadlineWindowEnd.setDate(deadlineWindowEnd.getDate() + 30);
  const deadlineWindowEndIsoDate = `${deadlineWindowEnd.getFullYear()}-${String(
    deadlineWindowEnd.getMonth() + 1
  ).padStart(2, "0")}-${String(deadlineWindowEnd.getDate()).padStart(2, "0")}`;
  const calendarTodayIsoDate = `${calendarNow.getFullYear()}-${String(
    calendarNow.getMonth() + 1
  ).padStart(2, "0")}-${String(calendarNow.getDate()).padStart(2, "0")}`;

  const upcomingDeadlineEvents = calendarEvents
    .filter(
      (eventItem) =>
        eventItem.showInUpcomingDeadlines &&
        eventItem.category === "academic" &&
        String(eventItem.gregorianDate || "") >= calendarTodayIsoDate &&
        String(eventItem.gregorianDate || "") <= deadlineWindowEndIsoDate
    )
    .sort((a, b) => String(a.gregorianDate || "").localeCompare(String(b.gregorianDate || "")));

  const visibleUpcomingDeadlineEvents = showAllUpcomingDeadlines
    ? upcomingDeadlineEvents
    : upcomingDeadlineEvents.slice(0, 3);

  useEffect(() => {
    const preferredDay =
      calendarDays.find((dayItem) => dayItem?.ethDay === calendarHighlightedDay) ||
      calendarDays.find(Boolean) ||
      null;

    if (!preferredDay) {
      setSelectedCalendarIsoDate("");
      return;
    }

    const stillVisible = calendarDays.some(
      (dayItem) => dayItem?.isoDate === selectedCalendarIsoDate
    );
    if (!stillVisible) {
      setSelectedCalendarIsoDate(preferredDay.isoDate);
    }
  }, [
    calendarViewDate.year,
    calendarViewDate.month,
    calendarHighlightedDay,
    calendarDays.length,
  ]);

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
      const normalizedCategory =
        calendarModalContext === "deadline" ? "academic" : calendarEventForm.category;
      const selectedEventMeta = getCalendarEventMeta(normalizedCategory);
      const payload = {
        title: calendarEventForm.title.trim() || selectedEventMeta.label,
        type: getCalendarEventKey(normalizedCategory),
        category: normalizedCategory,
        subType: "general",
        notes: calendarEventForm.notes.trim(),
        showInUpcomingDeadlines:
          calendarModalContext === "deadline" ||
          Boolean(
            calendarEvents.find((eventItem) => eventItem.id === editingCalendarEventId)
              ?.showInUpcomingDeadlines
          ),
        gregorianDate: selectedCalendarDay.isoDate,
        ethiopianDate: {
          year: calendarViewDate.year,
          month: calendarViewDate.month,
          day: selectedCalendarDay.ethDay,
        },
        createdAt: new Date().toISOString(),
        createdBy: teacherId || "",
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
    if (!canManageCalendar || eventItem.isDefault) return;

    setCalendarModalContext(eventItem.showInUpcomingDeadlines ? "deadline" : "calendar");
    setShowCalendarEventModal(true);

    const ethiopianDate =
      eventItem.ethiopianDate ||
      (() => {
        const [year, month, day] = String(eventItem.gregorianDate || "")
          .split("-")
          .map(Number);
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
    if (!shouldDelete) return;

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
    const selectableCalendarDays = calendarDays.filter(Boolean);
    if (!selectedCalendarIsoDate && selectableCalendarDays.length > 0) {
      setSelectedCalendarIsoDate(selectableCalendarDays[0].isoDate);
    }
    setEditingCalendarEventId("");
    setCalendarEventForm({ title: "", category: "no-class", subType: "general", notes: "" });
    setCalendarModalContext("calendar");
    setShowCalendarEventModal(true);
  };

  const handleOpenDeadlineModal = () => {
    const selectableCalendarDays = calendarDays.filter(Boolean);
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
    if (!calendarActionMessage) return undefined;
    const timeoutId = window.setTimeout(() => {
      setCalendarActionMessage("");
    }, 2600);
    return () => window.clearTimeout(timeoutId);
  }, [calendarActionMessage]);

  useEffect(() => {
    setShowAllUpcomingDeadlines(false);
    loadCalendarEvents();
  }, [schoolCode]);

  return (
    <div
      className="dashboard-page"
      style={{
        background: "#f5f8ff",
        minHeight: "100vh",
        height: "100vh",
        overflow: "hidden",
        "--surface-panel": "#ffffff",
        "--surface-accent": "#eff6ff",
        "--surface-muted": "#f8fafc",
        "--surface-strong": "#e2e8f0",
        "--page-bg": "#f5f8ff",
        "--border-soft": "#e2e8f0",
        "--border-strong": "#cbd5e1",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": "#2563eb",
        "--accent-soft": "#dbeafe",
        "--accent-strong": "#1d4ed8",
        "--success": "#15803d",
        "--success-soft": "#dcfce7",
        "--success-border": "#86efac",
        "--warning": "#a16207",
        "--warning-soft": "#fef9c3",
        "--warning-border": "#facc15",
        "--danger": "#b91c1c",
        "--danger-border": "#fca5a5",
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
        "--surface-overlay": "#f1f5f9",
        "--input-bg": "#ffffff",
        "--input-border": "#cbd5e1",
        "--shadow-soft": "0 10px 24px rgba(15, 23, 42, 0.08)",
        "--shadow-panel": "0 14px 30px rgba(15, 23, 42, 0.10)",
        "--shadow-glow": "0 0 0 2px rgba(37, 99, 235, 0.18)",
      }}
    >
      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "18px 14px", minHeight: "100vh", background: "var(--page-bg)", width: "100%", boxSizing: "border-box" }}>
        <Sidebar
          active="dashboard"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          teacher={teacher}
          handleLogout={handleLogout}
        />

        <div
          className="teacher-sidebar-spacer"
          style={{
            width: "var(--sidebar-width)",
            minWidth: "var(--sidebar-width)",
            flex: "0 0 var(--sidebar-width)",
            pointerEvents: "none",
          }}
        />

        <div className="main-content google-main" style={{ flex: "1 1 0", minWidth: 0, maxWidth: "none", margin: "0", boxSizing: "border-box", alignSelf: "flex-start", height: "calc(100vh - 24px)", overflowY: "auto", overflowX: "hidden", position: "sticky", top: 24, scrollbarWidth: "thin", scrollbarColor: "transparent transparent", padding: "0 12px 0 2px", display: "flex", justifyContent: "center", opacity: isOverlayModalOpen ? 0.45 : 1, filter: isOverlayModalOpen ? "blur(1px)" : "none", pointerEvents: isOverlayModalOpen ? "none" : "auto", transition: "opacity 180ms ease, filter 180ms ease" }}>
          <div style={{ width: "100%", maxWidth: FEED_SECTION_STYLE.maxWidth }}>
          <div className="section-header-card" style={{ ...FEED_SECTION_STYLE, margin: "0 auto 14px" }}>
            <div className="section-header-card__title" style={{ fontSize: 17 }}>School Updates Feed</div>
            <div className="section-header-card__subtitle">Post announcements, payment reminders, and notices.</div>
          </div>

          <div className="posts-container" style={{ ...FEED_SECTION_STYLE, display: "flex", flexDirection: "column", gap: 12 }}>
            {posts.length === 0 ? (
              <div style={{ ...shellCardStyle, borderRadius: 10, padding: "16px", fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>
                No posts available right now.
              </div>
            ) : posts.map((post) => {
              const isLikedByTeacher = Array.isArray(post.likes)
                ? post.likes.includes(teacherId)
                : Boolean(post.likes && teacherId && post.likes[teacherId]);

              return (
                <div
                  className="post-card facebook-post-card"
                  key={post.postId}
                  id={`post-${post.postId}`}
                  ref={(el) => (postRefs.current[post.postId] = el)}
                  style={{ ...shellCardStyle, borderRadius: 10, overflow: "hidden", border: highlightedPostId === post.postId ? "2px solid #4b6cb7" : shellCardStyle.border, backgroundColor: highlightedPostId === post.postId ? "#fff9c4" : "var(--surface-panel)", transition: "background-color 0.4s, border 0.2s" }}
                >
                  <div className="post-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "12px 16px 8px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, flex: 1 }}>
                      <div className="img-circle" style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                        <img src={getSafeProfileImage(post.adminProfile)} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div className="post-info" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <h4 style={{ margin: 0, fontSize: 15, color: "var(--text-primary)", fontWeight: 700, lineHeight: 1.2 }}>{post.adminName || "Admin"}</h4>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2, fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
                          <span>{post.time ? new Date(post.time).toLocaleString() : ""}</span>
                          <span>·</span>
                          <span>Visible to everyone</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {post.message ? (
                    <div style={{ padding: "0 16px 12px", color: "var(--text-primary)", fontSize: 15, lineHeight: 1.3333, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                      {post.message}
                    </div>
                  ) : null}

                  {post.postUrl ? (
                    <div className="facebook-post-media-wrap" style={{ background: "#000", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img className="facebook-post-media" src={post.postUrl} alt="post media" style={{ width: "100%", height: "auto", maxHeight: "min(78vh, 720px)", objectFit: "contain", display: "block", margin: "0 auto" }} />
                    </div>
                  ) : null}

                  <div className="post-actions" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, padding: "0 16px 12px" }}>
                    <button
                      onClick={() => handleLike(post.postId)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 12px",
                        background: "#f0f2f5",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: isLikedByTeacher ? "#e0245e" : "#555",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {isLikedByTeacher ? (
                        <FaHeart style={{ color: "#e0245e", fontSize: "14px" }} />
                      ) : (
                        <FaRegHeart style={{ fontSize: "14px" }} />
                      )}
                      {isLikedByTeacher ? "Liked" : "Like"}
                      <span style={{ marginLeft: 6, fontSize: "13px", color: "#777" }}>
                        {post.likeCount || 0}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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

        <div className="dashboard-widgets" style={{ width: "clamp(300px, 21vw, 360px)", minWidth: 300, maxWidth: 360, flex: "0 0 clamp(300px, 21vw, 360px)", display: "flex", flexDirection: "column", gap: 12, alignSelf: "flex-start", height: "calc(100vh -  60px)", overflowY: "auto", overflowX: "hidden", position: "fixed", top: 74, right: 14, scrollbarWidth: "thin", scrollbarColor: "transparent transparent", paddingRight: 2, paddingLeft: 12, marginLeft: 10, marginRight: 0, borderLeft: "1px solid var(--border-soft)", opacity: isOverlayModalOpen ? 0.45 : 1, filter: isOverlayModalOpen ? "blur(1px)" : "none", pointerEvents: isOverlayModalOpen ? "none" : "auto", transition: "opacity 180ms ease, filter 180ms ease", zIndex: 20 }}>
          <div style={widgetCardStyle}>
            <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>Quick Statistics</h4>
            <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", justifyContent: "center", flexWrap: "nowrap" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={smallStatStyle}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>Total Posts</div>
                  <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{posts.length}</div>
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
                  <strong style={{ color: "var(--text-primary)" }}>{totalPostsToday}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", ...softPanelStyle, padding: "7px 8px", fontSize: 10 }}>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Messages</span>
                  <strong style={{ color: "var(--text-primary)" }}>{messageCount}</strong>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>Recent Contacts</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {recentContacts.length === 0 ? (
                    <div style={{ fontSize: 10, color: "var(--text-muted)", ...softPanelStyle, padding: "7px 8px" }}>
                      No recent chats yet
                    </div>
                  ) : (
                    recentContacts.map((contact) => {
                      const conv = conversations.find((item) => item.chatId === contact.chatId);
                      return (
                        <button
                          key={contact.userId}
                          type="button"
                          onClick={() => handleOpenConversation(conv)}
                          style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", textAlign: "left", ...softPanelStyle, padding: "5px 6px", cursor: "pointer" }}
                        >
                          <img
                            src={contact.profileImage || "/default-profile.png"}
                            alt={contact.name}
                            style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {contact.name}
                            </div>
                            <div style={{ fontSize: 9, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {contact.lastMessage || "Open chat"}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div style={{ background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)", borderRadius: 20, boxShadow: "var(--shadow-panel)", padding: "10px", border: "1px solid var(--border-soft)", overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", top: -40, right: -30, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 16%, transparent) 0%, transparent 72%)", pointerEvents: "none" }} />
              <div style={{ margin: "-10px -10px 10px", padding: "12px 10px 10px", background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--surface-muted) 55%, var(--surface-panel) 100%)", borderBottom: "1px solid var(--border-soft)", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 12, background: "linear-gradient(135deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent) 20%, transparent) 100%)", color: "var(--accent-strong)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 1px 0 color-mix(in srgb, white 30%, transparent), var(--shadow-glow)" }}>
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
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(-1)}
                      style={{ width: 28, height: 28, borderRadius: 9, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 17, lineHeight: 1, boxShadow: "var(--shadow-soft)" }}
                      aria-label="Previous month"
                      title="Previous month"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(1)}
                      style={{ width: 28, height: 28, borderRadius: 9, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 17, lineHeight: 1, boxShadow: "var(--shadow-soft)" }}
                      aria-label="Next month"
                      title="Next month"
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <div style={{ padding: "4px 8px", borderRadius: 999, background: "var(--surface-panel)", border: "1px solid var(--border-soft)", fontSize: 9, color: "var(--accent-strong)", fontWeight: 800 }}>
                      {monthlyCalendarEvents.length} event{monthlyCalendarEvents.length === 1 ? "" : "s"}
                    </div>
                    <div style={{ padding: "4px 8px", borderRadius: 999, background: canManageCalendar ? "var(--success-soft)" : "var(--warning-soft)", border: canManageCalendar ? "1px solid var(--success-border)" : "1px solid var(--warning-border)", fontSize: 9, color: canManageCalendar ? "var(--success)" : "var(--warning)", fontWeight: 800 }}>
                      {canManageCalendar ? "Manage access" : "View only"}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: "linear-gradient(180deg, var(--surface-muted) 0%, color-mix(in srgb, var(--surface-muted) 92%, var(--page-bg) 8%) 100%)", border: "1px solid var(--border-soft)", borderRadius: 16, padding: "10px", boxShadow: "inset 0 1px 0 color-mix(in srgb, white 22%, transparent)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, marginBottom: 6 }}>
                  {CALENDAR_WEEK_DAYS.map((day) => (
                    <div key={day} style={{ textAlign: "center", fontSize: 9, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.03em", textTransform: "uppercase" }}>
                      {day}
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
                  {calendarDays.map((day, index) => {
                    const isToday = day?.ethDay === calendarHighlightedDay;
                    const dayOfWeek = index % 7;
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const primaryEvent = day?.events?.[0] || null;
                    const isNoClassDay = primaryEvent?.category === "no-class";
                    const isAcademicDay = primaryEvent?.category === "academic";
                    const isSelected = day?.isoDate === selectedCalendarIsoDate;
                    const isHovered = day?.isoDate === hoveredCalendarIsoDate;
                    const dayBackground = day
                      ? isToday
                        ? "linear-gradient(145deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent) 26%, transparent) 100%)"
                        : isSelected
                          ? "linear-gradient(145deg, var(--surface-accent) 0%, var(--accent-soft) 55%, color-mix(in srgb, var(--accent) 26%, transparent) 100%)"
                          : isNoClassDay
                            ? "linear-gradient(145deg, color-mix(in srgb, var(--warning-soft) 78%, var(--surface-panel) 22%) 0%, var(--warning-soft) 100%)"
                            : isAcademicDay
                              ? "linear-gradient(145deg, color-mix(in srgb, var(--success-soft) 78%, var(--surface-panel) 22%) 0%, var(--success-soft) 100%)"
                              : isWeekend
                                ? "linear-gradient(145deg, var(--surface-muted) 0%, color-mix(in srgb, var(--surface-muted) 84%, var(--page-bg) 16%) 100%)"
                                : "linear-gradient(145deg, var(--surface-panel) 0%, var(--surface-muted) 100%)"
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
                        style={{
                          minHeight: 0,
                          aspectRatio: "1 / 1",
                          borderRadius: 10,
                          border: isToday
                            ? "1px solid var(--accent)"
                            : isSelected
                              ? "1px solid var(--accent-strong)"
                              : isHovered
                                ? "1px solid var(--border-strong)"
                                : isNoClassDay
                                  ? "1px solid var(--warning-border)"
                                  : "1px solid transparent",
                          background: dayBackground,
                          color: isToday ? "var(--accent-strong)" : day ? "var(--text-secondary)" : "transparent",
                          fontSize: 10,
                          fontWeight: isToday ? 800 : 700,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 1,
                          padding: "5px 2px",
                          boxShadow: day && !isToday
                            ? isSelected
                              ? "var(--shadow-glow)"
                              : isHovered
                                ? "var(--shadow-soft)"
                                : "var(--shadow-soft)"
                            : "none",
                          cursor: day ? "pointer" : "default",
                          outline: "none",
                          transform: day && isSelected
                            ? "translateY(-2px) scale(1.03)"
                            : day && isHovered
                              ? "translateY(-1px) scale(1.015)"
                              : "translateY(0) scale(1)",
                          transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease",
                          position: "relative",
                          overflow: "hidden",
                        }}
                        disabled={!day}
                      >
                        {day ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 800, color: isToday || isSelected ? "var(--accent-strong)" : "var(--text-primary)", lineHeight: 1 }}>{day.ethDay}</div>
                            <div style={{ fontSize: 8, color: isSelected ? "var(--accent)" : "var(--text-muted)", lineHeight: 1 }}>{day.gregorianDate.day}/{day.gregorianDate.month}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 2, minHeight: 6 }}>
                              {day.events.slice(0, 2).map((eventItem) => (
                                <span
                                  key={eventItem.id}
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: "50%",
                                    background: getCalendarEventMeta(eventItem.category).color,
                                    boxShadow: "0 0 0 2px color-mix(in srgb, var(--surface-panel) 84%, transparent)",
                                  }}
                                />
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
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "var(--text-secondary)", fontWeight: 800, background: "var(--warning-soft)", border: "1px solid var(--warning-border)", borderRadius: 999, padding: "5px 8px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--warning)" }} /> No class
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "var(--text-secondary)", fontWeight: 800, background: "var(--success-soft)", border: "1px solid var(--success-border)", borderRadius: 999, padding: "5px 8px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }} /> Academic
                </div>
                {canManageCalendar ? (
                  <button
                    type="button"
                    onClick={handleOpenCalendarEventModal}
                    style={{ width: 30, height: 30, borderRadius: 999, border: "1px solid var(--border-strong)", background: "linear-gradient(135deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent) 20%, transparent) 100%)", color: "var(--accent-strong)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "var(--shadow-glow)" }}
                    aria-label="Add school calendar event"
                    title="Add school calendar event"
                  >
                    <FaPlus style={{ width: 12, height: 12 }} />
                  </button>
                ) : null}
              </div>

              {calendarActionMessage ? (
                <div style={{ marginTop: 10, borderRadius: 12, border: "1px solid var(--success-border)", background: "linear-gradient(180deg, color-mix(in srgb, var(--success-soft) 76%, var(--surface-panel) 24%) 0%, var(--success-soft) 100%)", color: "var(--success)", fontSize: 10, fontWeight: 800, padding: "8px 10px", boxShadow: "var(--shadow-soft)" }}>
                  {calendarActionMessage}
                </div>
              ) : null}

              <div style={{ marginTop: 12, background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)", border: "1px solid var(--border-soft)", borderRadius: 14, padding: "10px", boxShadow: "var(--shadow-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "var(--text-primary)" }}>
                      {selectedCalendarDay
                        ? `${ETHIOPIAN_MONTHS[calendarViewDate.month - 1]} ${selectedCalendarDay.ethDay}, ${calendarViewDate.year}`
                        : "Select a date"}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                      {selectedCalendarDay
                        ? `Gregorian ${selectedCalendarDay.gregorianDate.day}/${selectedCalendarDay.gregorianDate.month}/${selectedCalendarDay.gregorianDate.year}`
                        : "Choose a day to view or add calendar events."}
                    </div>
                  </div>
                  {calendarEventsLoading && (
                    <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700 }}>Loading...</div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {selectedCalendarEvents.length === 0 ? (
                    <div style={{ fontSize: 9, color: "var(--text-muted)", background: "var(--surface-muted)", borderRadius: 10, border: "1px solid var(--border-soft)", padding: "7px 9px" }}>
                      No school events on this day.
                    </div>
                  ) : (
                    selectedCalendarEvents.map((eventItem) => {
                      const eventMeta = getCalendarEventMeta(eventItem.category);

                      return (
                        <div
                          key={eventItem.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 7,
                            background: eventMeta.background,
                            border: `1px solid ${eventMeta.border}`,
                            borderRadius: 10,
                            padding: "7px 8px",
                          }}
                        >
                          <span style={{ width: 8, height: 8, marginTop: 4, borderRadius: "50%", background: eventMeta.color, flexShrink: 0 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-primary)" }}>{eventItem.title}</div>
                              {eventItem.isDefault ? (
                                <span style={{ padding: "2px 6px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent-strong)", fontSize: 9, fontWeight: 800 }}>Default</span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>{eventMeta.label}</div>
                            {eventItem.notes ? (
                              <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 3 }}>{eventItem.notes}</div>
                            ) : null}
                          </div>
                          {canManageCalendar && !eventItem.isDefault ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => handleEditCalendarEvent(eventItem)}
                                style={{ height: 26, padding: "0 9px", borderRadius: 8, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", fontSize: 9, fontWeight: 800, cursor: "pointer" }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCalendarEvent(eventItem)}
                                style={{ height: 26, padding: "0 9px", borderRadius: 8, border: "1px solid var(--danger-border)", background: "var(--surface-panel)", color: "var(--danger)", fontSize: 9, fontWeight: 800, cursor: "pointer" }}
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

            <div style={{ background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)", borderRadius: 16, boxShadow: "var(--shadow-soft)", padding: "11px", border: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>Upcoming Deadlines</h4>
                {canManageCalendar ? (
                  <button
                    type="button"
                    onClick={handleOpenDeadlineModal}
                    style={{ width: 28, height: 28, borderRadius: 999, border: "1px solid var(--success-border)", background: "linear-gradient(135deg, color-mix(in srgb, var(--success-soft) 72%, var(--surface-panel) 28%) 0%, var(--success-soft) 100%)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "var(--shadow-soft)" }}
                    aria-label="Add upcoming deadline"
                    title="Add upcoming deadline"
                  >
                    <FaPlus style={{ width: 11, height: 11 }} />
                  </button>
                ) : null}
              </div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {calendarEventsLoading ? (
                  <div style={{ padding: "8px 9px", borderRadius: 10, border: "1px solid var(--border-soft)", background: "var(--surface-muted)", fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>
                    Loading deadlines...
                  </div>
                ) : upcomingDeadlineEvents.length === 0 ? (
                  <div style={{ padding: "8px 9px", borderRadius: 10, border: "1px solid var(--border-soft)", background: "var(--surface-muted)", fontSize: 10, color: "var(--text-muted)" }}>
                    No upcoming deadlines in the next 30 days.
                    {canManageCalendar ? (
                      <button
                        type="button"
                        onClick={handleOpenDeadlineModal}
                        style={{ marginTop: 8, height: 28, padding: "0 10px", borderRadius: 999, border: "1px solid var(--success-border)", background: "var(--surface-panel)", color: "var(--success)", fontSize: 9, fontWeight: 800, cursor: "pointer" }}
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
                          padding: "8px 9px",
                          borderRadius: 10,
                          border: `1px solid ${eventMeta.border}`,
                          background: eventMeta.background,
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: eventMeta.color, flexShrink: 0 }} />
                            <span>{eventItem.title?.trim() || eventItem.notes?.trim() || "Academic deadline"}</span>
                          </div>
                          <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 3 }}>
                            {eventMeta.label}
                          </div>
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
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
                    style={{ alignSelf: "flex-start", height: 28, padding: "0 10px", borderRadius: 999, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--accent-strong)", fontSize: 9, fontWeight: 800, cursor: "pointer" }}
                  >
                    {showAllUpcomingDeadlines ? "See less" : `See more (${upcomingDeadlineEvents.length - 3})`}
                  </button>
                ) : null}
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
                      <button
                        type="button"
                        onClick={() => handleCalendarMonthChange(-1)}
                        style={{ width: 28, height: 28, borderRadius: 9, border: "1px solid var(--border-soft)", background: "var(--surface-overlay)", color: "var(--text-primary)", cursor: "pointer", fontSize: 16, lineHeight: 1, boxShadow: "var(--shadow-soft)" }}
                        aria-label="Previous Ethiopian month"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCalendarMonthChange(1)}
                        style={{ width: 28, height: 28, borderRadius: 9, border: "1px solid var(--border-soft)", background: "var(--surface-overlay)", color: "var(--text-primary)", cursor: "pointer", fontSize: 16, lineHeight: 1, boxShadow: "var(--shadow-soft)" }}
                        aria-label="Next Ethiopian month"
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, marginBottom: 5 }}>
                    {CALENDAR_WEEK_DAYS.map((dayLabel) => (
                      <div key={dayLabel} style={{ textAlign: "center", fontSize: 8, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {dayLabel}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
                    {calendarDays.map((dayItem, index) => {
                      const isSelectedDay = dayItem?.isoDate === selectedCalendarIsoDate;
                      const hasEvents = (dayItem?.events?.length || 0) > 0;
                      const isTodayDay = dayItem?.ethDay === calendarHighlightedDay;
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
                          style={{
                            minHeight: 0,
                            aspectRatio: "1 / 1",
                            borderRadius: 10,
                            border: isTodayDay ? "1px solid var(--accent)" : isSelectedDay ? "1px solid var(--accent-strong)" : hasEvents ? "1px solid var(--warning-border)" : "1px solid transparent",
                            background: cellBackground,
                            color: !dayItem ? "transparent" : isSelectedDay || isTodayDay ? "var(--accent-strong)" : "var(--text-primary)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 1,
                            cursor: dayItem && canManageCalendar ? "pointer" : "default",
                            boxShadow: isSelectedDay
                              ? "0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent), 0 12px 22px color-mix(in srgb, var(--accent-strong) 18%, transparent)"
                              : isTodayDay
                                ? "0 10px 18px color-mix(in srgb, var(--accent-strong) 14%, transparent)"
                                : "var(--shadow-soft)",
                            padding: "4px 2px",
                            overflow: "hidden",
                            position: "relative",
                            transform: isSelectedDay ? "translateY(-1px) scale(1.02)" : "translateY(0) scale(1)",
                            transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease",
                          }}
                        >
                          {dayItem ? (
                            <>
                              <div style={{ fontSize: 11, fontWeight: 800, lineHeight: 1 }}>{dayItem.ethDay}</div>
                              <div style={{ fontSize: 8, color: isSelectedDay ? "var(--accent-strong)" : "var(--text-secondary)", lineHeight: 1 }}>{dayItem.gregorianDate.day}/{dayItem.gregorianDate.month}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 2, minHeight: 6 }}>
                                {dayItem.events.slice(0, 2).map((eventItem) => (
                                  <span
                                    key={eventItem.id}
                                    style={{
                                      width: 5,
                                      height: 5,
                                      borderRadius: "50%",
                                      background: getCalendarEventMeta(eventItem.category).color,
                                      boxShadow: "0 0 0 2px color-mix(in srgb, var(--surface-panel) 82%, transparent)",
                                    }}
                                  />
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
                  <div style={{ height: 42, borderRadius: 12, border: "1px solid var(--success-border)", padding: "0 12px", fontSize: 12, color: "var(--success)", background: "var(--success-soft)", display: "flex", alignItems: "center", fontWeight: 800 }}>
                    Academic deadline
                  </div>
                ) : (
                  <select
                    value={calendarEventForm.category}
                    onChange={(e) => setCalendarEventForm((prev) => ({ ...prev, category: e.target.value, subType: "general" }))}
                    disabled={!canManageCalendar}
                    style={{ height: 42, borderRadius: 12, border: "1px solid var(--input-border)", padding: "0 12px", fontSize: 12, color: "var(--text-primary)", background: "var(--input-bg)" }}
                  >
                    <option value="no-class">No class day</option>
                    <option value="academic">Academic day</option>
                  </select>
                )}

                {calendarModalContext === "deadline" ? (
                  <input
                    type="text"
                    value={calendarEventForm.title}
                    onChange={(e) => setCalendarEventForm((prev) => ({ ...prev, title: e.target.value }))}
                    disabled={!canManageCalendar}
                    placeholder="Deadline title"
                    style={{ height: 42, borderRadius: 12, border: "1px solid var(--input-border)", padding: "0 12px", fontSize: 12, color: "var(--text-primary)", background: "var(--input-bg)" }}
                  />
                ) : null}

                <textarea
                  value={calendarEventForm.notes}
                  onChange={(e) => setCalendarEventForm((prev) => ({ ...prev, notes: e.target.value }))}
                  disabled={!canManageCalendar}
                  placeholder={calendarModalContext === "deadline" ? "Optional deadline note" : "Optional note"}
                  rows={3}
                  style={{ borderRadius: 12, border: "1px solid var(--input-border)", padding: "12px", fontSize: 12, color: "var(--text-primary)", background: "var(--input-bg)", resize: "vertical" }}
                />

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={handleCreateCalendarEvent}
                    disabled={calendarEventSaving || !selectedCalendarDay || !canManageCalendar}
                    style={{
                      flex: "1 1 180px",
                      height: 42,
                      borderRadius: 12,
                      border: "none",
                      background: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? "var(--surface-strong)" : "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? "not-allowed" : "pointer",
                      boxShadow: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? "none" : "0 12px 18px color-mix(in srgb, var(--accent-strong) 18%, transparent)",
                    }}
                  >
                    {calendarEventSaving ? "Saving..." : editingCalendarEventId ? "Update calendar event" : "Save calendar event"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseCalendarEventModal}
                    style={{ height: 42, padding: "0 14px", borderRadius: 12, border: "1px solid var(--border-soft)", background: "var(--surface-overlay)", color: "var(--text-primary)", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                  >
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
            .right-widgets-spacer,
            .dashboard-widgets {
              display: none !important;
            }
          }
          @media (max-width: 600px) {
            .teacher-sidebar-spacer {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
