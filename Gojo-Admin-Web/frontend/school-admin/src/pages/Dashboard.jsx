import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import "../styles/global.css";
import { AiFillPicture, AiFillVideoCamera } from "react-icons/ai";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaBell, FaFacebookMessenger, FaCalendarAlt, FaPlus, FaEllipsisH, FaThumbsUp } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { BACKEND_BASE } from "../config.js";
import EthiopicCalendar from "ethiopic-calendar";

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

function Dashboard() {
  const API_BASE = `${BACKEND_BASE}/api`;
  const DB_URL = "https://bale-house-rental-default-rtdb.firebaseio.com";
  // ---------------- STATE ----------------
  const _storedAdmin = (() => {
    try {
      return JSON.parse(localStorage.getItem("admin")) || {};
    } catch (e) {
      return {};
    }
  })();

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

  const schoolCode = admin.schoolCode || _storedAdmin.schoolCode || "";
  const DB_ROOT = schoolCode ? `${DB_URL}/Platform1/Schools/${schoolCode}` : DB_URL;

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);
  const [targetRole, setTargetRole] = useState("all");
  const [targetOptions, setTargetOptions] = useState(["all"]);
  const fileInputRef = useRef(null);

  const [unreadMessages, setUnreadMessages] = useState([]);
  const [showMessengerDropdown, setShowMessengerDropdown] = useState(false);

  const [teachers, setTeachers] = useState([]);
  const [unreadTeachers, setUnreadTeachers] = useState({});
  const [popupMessages, setPopupMessages] = useState([]);
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [expandedPostDescriptions, setExpandedPostDescriptions] = useState({});
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const [unreadSenders, setUnreadSenders] = useState({}); 
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

  const adminUserId = admin.userId;
  const currentCalendarRole = String(admin.role || _storedAdmin.role || _storedAdmin.userType || "admin").trim().toLowerCase();
  const canManageCalendar = CALENDAR_MANAGER_ROLES.has(currentCalendarRole);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [unreadPostList, setUnreadPostList] = useState([]);
  const currentLikeActorId = admin.userId || admin.adminId || "";

  const navigate = useNavigate();
  const currentPath = location.pathname;

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

  const getSidebarLinkStyle = (path) =>
    currentPath === path
      ? { ...sidebarLinkBaseStyle, ...sidebarLinkActiveStyle }
      : sidebarLinkBaseStyle;

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

      const lookupId = adminData.userId || adminData.adminId;
      if (!lookupId) {
        localStorage.removeItem("admin");
        setLoadingAdmin(false);
        return;
      }

      const profileRes = await axios.get(`${API_BASE}/admin/${lookupId}`);
      const profile = profileRes.data?.admin;

      if (!profileRes.data?.success || !profile) {
        localStorage.removeItem("admin");
        setLoadingAdmin(false);
        return;
      }

      setAdmin({
        adminId: profile.adminId || adminData.adminId,
        userId: profile.userId || adminData.userId,
        schoolCode: profile.schoolCode || adminData.schoolCode || "",
        name: profile.name || "Admin",
        username: profile.username || "",
        role: profile.role || adminData.role || adminData.userType || "admin",
        profileImage: profile.profileImage || "/default-profile.png",
      });

    } catch (e) {
      localStorage.removeItem("admin");
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
    setPostsLoading(true);

    try {
      const normalizePostsNode = (postsNode) => {
        if (!postsNode || typeof postsNode !== "object") {
          return [];
        }

        if (postsNode.postId && (postsNode.message || postsNode.postUrl)) {
          return [{ postId: postsNode.postId, ...postsNode }];
        }

        return Object.entries(postsNode)
          .filter(([, value]) => value && typeof value === "object")
          .filter(([, value]) => value.postId || value.message || value.postUrl)
          .map(([key, value]) => ({
            postId: value.postId || key,
            ...value,
          }));
      };

      const normalizePostsResponse = (payload) => {
        if (Array.isArray(payload)) {
          return payload.filter((postItem) => postItem && typeof postItem === "object");
        }

        if (payload && typeof payload === "object") {
          return normalizePostsNode(payload);
        }

        return [];
      };

      const res = await axios.get(`${API_BASE}/get_posts`, {
        params: { schoolCode },
      });

      let sourcePosts = normalizePostsResponse(res.data);

      if (sourcePosts.length === 0 && schoolCode) {
        const fallbackRes = await axios.get(`${DB_ROOT}/Posts.json`).catch(() => ({ data: {} }));
        sourcePosts = normalizePostsNode(fallbackRes.data || {});
      }

      const sortedPosts = sourcePosts.sort(
        (a, b) => new Date(b.time) - new Date(a.time)
      );

      const enrichedPosts = await Promise.all(
        sortedPosts.map(async (postItem) => {
          let profile = postItem.adminProfile || postItem.adminProfileImage || postItem.profileImage || "";

          try {
            if (!profile && postItem.userId) {
              const userRes = await axios.get(`${DB_ROOT}/Users/${postItem.userId}.json`);
              const userNode = userRes.data || {};
              profile = userNode.profileImage || userNode.profile || userNode.avatar || "";
            }

            if (!profile && postItem.adminId) {
              const schoolAdminRes = await axios.get(`${DB_ROOT}/School_Admins/${postItem.adminId}.json`);
              const schoolAdminNode = schoolAdminRes.data || {};

              if (schoolAdminNode.userId) {
                const ownerUserRes = await axios.get(`${DB_ROOT}/Users/${schoolAdminNode.userId}.json`);
                const ownerUserNode = ownerUserRes.data || {};
                profile = ownerUserNode.profileImage || ownerUserNode.profile || "";
              }
            }
          } catch (err) {
            // Keep fallback profile when enrichment fails.
          }

          return {
            ...postItem,
            adminProfile: profile || "/default-profile.png",
            schoolCode: postItem.schoolCode || schoolCode,
          };
        })
      );

      setPosts(enrichedPosts);
    } catch (err) {
      console.error("Error fetching posts:", err);
    } finally {
      setPostsLoading(false);
    }
  };

  // ---------------- FETCH UNREAD MESSAGES ----------------
  const fetchUnreadMessages = async () => {
    if (!admin.adminId) return;

    const senders = {};

    try {
      // 1️⃣ USERS (names & images)
      const usersRes = await axios.get(
        "https://bale-house-rental-default-rtdb.firebaseio.com/Users.json"
      );
      const usersData = usersRes.data || {};

      const findUserByUserId = (userId) => {
        return Object.values(usersData).find(u => u.userId === userId);
      };

      // helper to read messages from BOTH chat keys
      const getUnreadCount = async (userId) => {
        const key1 = `${admin.userId}_${userId}`;
        const key2 = `${userId}_${admin.userId}`;

        const [r1, r2] = await Promise.all([
          axios.get(`https://bale-house-rental-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`),
          axios.get(`https://bale-house-rental-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`)
        ]);

        const msgs = [
          ...Object.values(r1.data || {}),
          ...Object.values(r2.data || {})
        ];

        return msgs.filter(
          m => m.receiverId === admin.userId && !m.seen
        ).length;
      };

      // 2️⃣ TEACHERS
      const teachersRes = await axios.get(
        "https://bale-house-rental-default-rtdb.firebaseio.com/Teachers.json"
      );

      for (const k in teachersRes.data || {}) {
        const t = teachersRes.data[k];
        const unread = await getUnreadCount(t.userId);

        if (unread > 0) {
         const user = findUserByUserId(t.userId);

          senders[t.userId] = {
            type: "teacher",
            name: user?.name || "Teacher",
            profileImage: user?.profileImage || "/default-profile.png",
            count: unread
          };
        }
      }

      // 3️⃣ STUDENTS
      const studentsRes = await axios.get(
        "https://bale-house-rental-default-rtdb.firebaseio.com/Students.json"
      );

      for (const k in studentsRes.data || {}) {
        const s = studentsRes.data[k];
        const unread = await getUnreadCount(s.userId);

        if (unread > 0) {
          const user = findUserByUserId(s.userId);

          senders[s.userId] = {
            type: "student",
            name: user?.name || s.name || "Student",
            profileImage: user?.profileImage || s.profileImage || "/default-profile.png",
            count: unread
          };
        }
      }

      // 4️⃣ PARENTS
      const parentsRes = await axios.get(
        "https://bale-house-rental-default-rtdb.firebaseio.com/Parents.json"
      );

      for (const k in parentsRes.data || {}) {
        const p = parentsRes.data[k];
        const unread = await getUnreadCount(p.userId);

        if (unread > 0) {
         const user = findUserByUserId(p.userId);

          senders[p.userId] = {
            type: "parent",
            name: user?.name || p.name || "Parent",
            profileImage: user?.profileImage || p.profileImage || "/default-profile.png",
            count: unread
          };
        }
      }

      setUnreadSenders(senders);
    } catch (err) {
      console.error("Unread fetch failed:", err);
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
    if (!admin.adminId) return;

    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 5000);

    return () => clearInterval(interval);
  }, [admin.adminId]);

  /// ---------------- FETCH POST NOTIFICATIONS ----------------
  useEffect(() => {
    if (!admin.userId || !schoolCode) return;

    const fetchUnreadPosts = async () => {
      try {
        const normalizePostsNode = (postsNode) => {
          if (!postsNode || typeof postsNode !== "object") {
            return [];
          }

          if (postsNode.postId && (postsNode.message || postsNode.postUrl)) {
            return [{ postId: postsNode.postId, ...postsNode }];
          }

          return Object.entries(postsNode)
            .filter(([, value]) => value && typeof value === "object")
            .filter(([, value]) => value.postId || value.message || value.postUrl)
            .map(([key, value]) => ({
              postId: value.postId || key,
              ...value,
            }));
        };

        const postsRes = await axios.get(`${DB_ROOT}/Posts.json`).catch(() => ({ data: {} }));
        const allPosts = normalizePostsNode(postsRes.data || {});

        const unread = allPosts.filter(
          (postValue) => !postValue?.seenBy || !postValue.seenBy[admin.userId]
        );

        if (unread.length === 0) {
          setUnreadPostList([]);
          return;
        }

        const usersRes = await axios.get(`${DB_ROOT}/Users.json`).catch(() => ({ data: {} }));
        const usersData = usersRes.data || {};

        const findUserByUserId = (userId) =>
          Object.values(usersData).find((userNode) => String(userNode?.userId) === String(userId));

        const enriched = await Promise.all(
          unread.map(async (postItem) => {
            let profile = postItem.adminProfile || "/default-profile.png";
            let ownerName = postItem.adminName || "Admin";

            try {
              if (postItem.userId) {
                const ownerUser = findUserByUserId(postItem.userId) || usersData[postItem.userId] || {};
                profile = ownerUser.profileImage || profile;
                ownerName = ownerUser.name || ownerName;
              }

              if ((!postItem.userId || ownerName === "Admin") && postItem.adminId) {
                const schoolAdminRes = await axios.get(`${DB_ROOT}/School_Admins/${postItem.adminId}.json`).catch(() => ({ data: null }));
                const schoolAdminNode = schoolAdminRes.data || {};
                if (schoolAdminNode.userId) {
                  const ownerUser = findUserByUserId(schoolAdminNode.userId) || usersData[schoolAdminNode.userId] || {};
                  profile = ownerUser.profileImage || profile;
                  ownerName = ownerUser.name || ownerName;
                }
              }
            } catch (err) {
              // Keep fallback name/profile when enrichment fails.
            }

            return {
              ...postItem,
              adminName: ownerName,
              adminProfile: profile,
            };
          })
        );

        setUnreadPostList(enriched);
      } catch (err) {
        console.error(err);
      }
    };

    fetchUnreadPosts();
  }, [admin.userId, schoolCode]);

  useEffect(() => {
    const fetchTeachersAndUnread = async () => {
      try {
        const [teachersRes, usersRes] = await Promise.all([
          axios.get("https://bale-house-rental-default-rtdb.firebaseio.com/Teachers.json"),
          axios.get("https://bale-house-rental-default-rtdb.firebaseio.com/Users.json")
        ]);

        const teachersData = teachersRes.data || {};
        const usersData = usersRes.data || {};

        const teacherList = Object.keys(teachersData).map(tid => {
          const teacher = teachersData[tid];
          const user = usersData[teacher.userId] || {};
          return {
            teacherId: tid,
            userId: teacher.userId,
            name: user.name || "No Name",
            profileImage: user.profileImage || "/default-profile.png"
          };
        });

        const roleSet = new Set(
          Object.values(usersData || {})
            .map((u) => String(u?.role || u?.userType || "").trim().toLowerCase())
            .filter(Boolean)
        );
        const orderedRoles = ["student", "parent", "teacher", "registerer", "finance", "admin"].filter((r) => roleSet.has(r));
        const extraRoles = Array.from(roleSet).filter((r) => !orderedRoles.includes(r)).sort();
        const nextRoles = ["all", ...orderedRoles, ...extraRoles];
        setTargetOptions(nextRoles);
        setTargetRole((prev) => (nextRoles.includes(prev) ? prev : "all"));

        setTeachers(teacherList);

        // fetch unread messages
        const unread = {};
        const allMessages = [];

        for (const t of teacherList) {
          const chatKey = `${adminUserId}_${t.userId}`;
          const res = await axios.get(`https://bale-house-rental-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`);
          const msgs = Object.values(res.data || {}).map(m => ({
            ...m,
            sender: m.senderId === adminUserId ? "admin" : "teacher"
          }));
          allMessages.push(...msgs);

          const unreadCount = msgs.filter(m => m.receiverId === adminUserId && !m.seen).length;
          if (unreadCount > 0) unread[t.userId] = unreadCount;
        }

        setPopupMessages(allMessages);
        setUnreadTeachers(unread);

      } catch (err) {
        console.error(err);
      }
    };

    fetchTeachersAndUnread();
  }, [adminUserId]);

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
    if (!loadingAdmin) {
      fetchPosts();
    }
  }, [loadingAdmin, schoolCode, admin.userId]);

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

  const handlePost = async () => {
    if (!postText && !postMedia) return;

    if (!admin.adminId || !admin.userId) {
      alert("Session expired");
      return;
    }

    const formData = new FormData();
    formData.append("message", postText);

    // ✅ CORRECT
    formData.append("adminId", admin.adminId); // ownership
    formData.append("userId", admin.userId);   // display & likes
    formData.append("adminName", admin.name);
    formData.append("adminProfile", admin.profileImage);
    formData.append("schoolCode", schoolCode || "");
    formData.append("targetRole", targetRole || "all");

    if (postMedia) formData.append("post_media", postMedia);

    await axios.post(`${API_BASE}/create_post`, formData);

    setPostText("");
    setPostMedia(null);
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
      // ✅ Use full backend URL
      const res = await axios.post(`${API_BASE}/like_post`, {
        postId,
        adminId: admin.userId || admin.adminId,
        userId: admin.userId,
        schoolCode,
      });

      if (res.data.success) {
        const liked = res.data.liked; // boolean returned by backend
        const likeCount = res.data.likeCount; // number returned by backend

        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId === postId
              ? {
                  ...post,
                  likeCount,
                  likes: {
                    ...post.likes,
                    [currentLikeActorId]: liked ? true : undefined,
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
      axios.get(`https://bale-house-rental-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`),
      axios.get(`https://bale-house-rental-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`)
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
        "https://bale-house-rental-default-rtdb.firebaseio.com/.json",
        updates
      );
    }
  };

  // counts for badges
  const messageCount = Object.values(unreadSenders || {}).reduce((acc, s) => acc + (s.count || 0), 0);
  const totalNotifications = (unreadPostList?.length || 0) + messageCount;
  const isOverlayModalOpen = showCalendarEventModal;
  const canSubmitPost = Boolean(postText.trim() || postMedia);
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
  const widgetCardStyle = {
    background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-accent) 100%)",
    borderRadius: 16,
    boxShadow: "var(--shadow-soft)",
    padding: "11px",
    border: "1px solid var(--border-soft)",
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
  const recentContacts = Object.entries(unreadSenders || {})
    .map(([userId, sender]) => ({
      userId,
      name: sender?.name || "User",
      profileImage: sender?.profileImage || "/default-profile.png",
      type: sender?.type || "user",
      count: Number(sender?.count || 0),
      lastMessage: `${Number(sender?.count || 0)} unread message${Number(sender?.count || 0) === 1 ? "" : "s"}`,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
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

  // ---------------- RENDER ----------------
  return (
    <div className="dashboard-page">

      {/* ---------------- TOP NAVIGATION BAR ---------------- */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>

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
                  background: "red",
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
                background: "#fff",
                borderRadius: 10,
                boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                zIndex: 1000,
                padding: 6,
              }}
            >
              {totalNotifications === 0 ? (
                <p style={{ padding: "12px", textAlign: "center", color: "#777" }}>
                  No new notifications
                </p>
              ) : (
                <div>
                  {/* Posts section */}
                  {unreadPostList.length > 0 && (
                    <div>
                      <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontWeight: 700 }}>Posts</div>
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
                            borderBottom: "1px solid #f0f0f0",
                            transition: "background 120ms ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                        >
                          <img
                            src={post.adminProfile || "/default-profile.png"}
                            alt=""
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 8,
                              objectFit: "cover",
                            }}
                          />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong>{post.adminName}</strong>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 13,
                                color: "#555",
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

                          <div style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>
                            {new Date(post.time || post.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Messages section */}
                  {messageCount > 0 && (
                    <div>
                      <div style={{ padding: '8px 10px', color: '#333', fontWeight: 700, background: '#fafafa', borderRadius: 6, margin: '8px 6px' }}>Messages</div>
                      {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                        <div
                          key={userId}
                          style={{
                            padding: 10,
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            cursor: "pointer",
                            borderBottom: "1px solid #f0f0f0",
                            transition: "background 120ms ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
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
                          <img
                            src={sender.profileImage}
                            alt={sender.name}
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 8,
                              objectFit: "cover",
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ display: "block", marginBottom: 4 }}>{sender.name}</strong>
                            <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
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
                  background: "red",
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

          {/* Settings */}
          <Link className="icon-circle" to="/settings">
            <FaCog />
          </Link>

          {/* Profile */}
          <img
            src={admin.profileImage || "/default-profile.png"}
            alt="admin"
            className="profile-img"
          />
          {/* <span>{admin.name}</span> */}
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "18px 14px", minHeight: "100vh", background: "var(--page-bg)", width: "100%", boxSizing: "border-box" }}>
        {/* LEFT SIDEBAR */}
        <div className="google-sidebar" style={{ width: 'clamp(230px, 16vw, 290px)', minWidth: 230, padding: 14, borderRadius: 24, background: 'var(--surface-panel)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-panel)', height: 'calc(100vh - 24px)', overflowY: 'auto', alignSelf: 'flex-start', position: 'sticky', top: 24, scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent', opacity: isOverlayModalOpen ? 0.45 : 1, filter: isOverlayModalOpen ? 'blur(1px)' : 'none', pointerEvents: isOverlayModalOpen ? 'none' : 'auto', transition: 'opacity 180ms ease, filter 180ms ease' }}>
          {/* Sidebar profile */}
          <div className="sidebar-profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 14px', marginBottom: 8, borderRadius: 18, background: 'linear-gradient(180deg, var(--surface-accent) 0%, var(--surface-panel) 100%)', border: '1px solid var(--border-strong)', boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 8%, transparent)' }}>
            <div className="sidebar-img-circle" style={{ width: 58, height: 58, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--border-strong)', boxShadow: 'var(--shadow-glow)' }}>
              <img src={admin?.profileImage || "/default-profile.png"} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--surface-accent)', border: '1px solid var(--border-strong)', color: 'var(--accent)', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Acadamic Office</div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center' }}>{admin?.name || "Admin Name"}</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{admin?.adminId || "username"}</p>
          </div>

          {/* Sidebar menu */}
          <div className="sidebar-menu" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
            <Link className="sidebar-btn" to="/dashboard" style={getSidebarLinkStyle('/dashboard')}>
              <FaHome style={{ width: 15, height: 15 }} /> Home
            </Link>

            <Link className="sidebar-btn" to="/my-posts" style={getSidebarLinkStyle('/my-posts')}>
              <FaFileAlt style={{ width: 15, height: 15 }} /> My Posts
            </Link>

            <Link className="sidebar-btn" to="/teachers" style={getSidebarLinkStyle('/teachers')}>
              <FaChalkboardTeacher style={{ width: 15, height: 15 }} /> Teachers
            </Link>

            <Link className="sidebar-btn" to="/students" style={getSidebarLinkStyle('/students')}>
              <FaChalkboardTeacher style={{ width: 15, height: 15 }} /> Students
            </Link>

            <Link className="sidebar-btn" to="/schedule" style={getSidebarLinkStyle('/schedule')}>
              <FaCalendarAlt style={{ width: 15, height: 15 }} /> Schedule
            </Link>

            <Link className="sidebar-btn" to="/parents" style={getSidebarLinkStyle('/parents')}>
              <FaChalkboardTeacher style={{ width: 15, height: 15 }} /> Parents
            </Link>

            <Link className="sidebar-btn" to="/registration-form" style={getSidebarLinkStyle('/registration-form')}>
              <FaFileAlt style={{ width: 15, height: 15 }} /> Registration Form
            </Link>

            <Link className="sidebar-btn" to="/settings" style={getSidebarLinkStyle('/settings')}>
              <FaCog style={{ width: 15, height: 15 }} /> Settings
            </Link>

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
              <img
                src={admin.profileImage || "/default-profile.png"}
                alt="me"
                style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border-soft)", flexShrink: 0 }}
              />
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
            </div>
          </div>

          {/* Posts container */}
          <div className="posts-container" style={{ ...FEED_SECTION_STYLE, maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
            {postsLoading ? (
              <div style={{ ...shellCardStyle, borderRadius: 10, padding: "16px", fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>
                Loading posts...
              </div>
            ) : posts.length === 0 ? (
              <div style={{ ...shellCardStyle, borderRadius: 10, padding: "16px", fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>
                No posts available right now.
              </div>
            ) : posts.map((post) => (
              <div className="post-card facebook-post-card" id={`post-${post.postId}`} key={post.postId} style={{ ...shellCardStyle, borderRadius: 10, overflow: "hidden" }}>
                <div className="post-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "12px 16px 8px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, flex: 1 }}>
                    <div className="img-circle" style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                      <img
                        src={post.adminProfile || "/default-profile.png"}
                        alt="profile"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
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
                  <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{myPostsCount}</div>
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
                        <img
                          src={contact.profileImage || '/default-profile.png'}
                          alt={contact.name}
                          style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                        />
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
                    <button type="button" onClick={() => handleCalendarMonthChange(-1)} style={{ width: 28, height: 28, borderRadius: 9, border: '1px solid var(--border-soft)', background: 'var(--surface-panel)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 17, lineHeight: 1, boxShadow: 'var(--shadow-soft)' }} aria-label="Previous month" title="Previous month">‹</button>
                    <button type="button" onClick={() => handleCalendarMonthChange(1)} style={{ width: 28, height: 28, borderRadius: 9, border: '1px solid var(--border-soft)', background: 'var(--surface-panel)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 17, lineHeight: 1, boxShadow: 'var(--shadow-soft)' }} aria-label="Next month" title="Next month">›</button>
                  </div>
                </div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ padding: '4px 8px', borderRadius: 999, background: 'var(--surface-panel)', border: '1px solid var(--border-soft)', fontSize: 9, color: 'var(--accent-strong)', fontWeight: 800 }}>{monthlyCalendarEvents.length} event{monthlyCalendarEvents.length === 1 ? '' : 's'}</div>
                    <div style={{ padding: '4px 8px', borderRadius: 999, background: canManageCalendar ? 'var(--success-soft)' : 'var(--warning-soft)', border: canManageCalendar ? '1px solid var(--success-border)' : '1px solid var(--warning-border)', fontSize: 9, color: canManageCalendar ? 'var(--success)' : 'var(--warning)', fontWeight: 800 }}>{canManageCalendar ? 'Manage access' : 'View only'}</div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'linear-gradient(180deg, var(--surface-muted) 0%, color-mix(in srgb, var(--surface-muted) 92%, var(--page-bg) 8%) 100%)', border: '1px solid var(--border-soft)', borderRadius: 16, padding: '10px', boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 22%, transparent)' }}>
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
                        style={{ minHeight: 0, aspectRatio: '1 / 1', borderRadius: 10, border: isToday ? '1px solid var(--accent)' : isSelected ? '1px solid var(--accent-strong)' : isHovered ? '1px solid var(--border-strong)' : isNoClassDay ? '1px solid var(--warning-border)' : '1px solid transparent', background: dayBackground, color: isToday ? 'var(--accent-strong)' : day ? 'var(--text-secondary)' : 'transparent', fontSize: 10, fontWeight: isToday ? 800 : 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '5px 2px', boxShadow: day && !isToday ? (isSelected ? 'var(--shadow-glow)' : 'var(--shadow-soft)') : 'none', cursor: day ? 'pointer' : 'default', outline: 'none', transform: day && isSelected ? 'translateY(-2px) scale(1.03)' : day && isHovered ? 'translateY(-1px) scale(1.015)' : 'translateY(0) scale(1)', transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease', position: 'relative', overflow: 'hidden' }}
                        disabled={!day}
                      >
                        {day ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 800, color: isToday || isSelected ? 'var(--accent-strong)' : 'var(--text-primary)', lineHeight: 1 }}>{day.ethDay}</div>
                            <div style={{ fontSize: 8, color: isSelected ? 'var(--accent)' : 'var(--text-muted)', lineHeight: 1 }}>{day.gregorianDate.day}/{day.gregorianDate.month}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 6 }}>
                              {day.events.slice(0, 2).map((eventItem) => (
                                <span key={eventItem.id} style={{ width: 5, height: 5, borderRadius: '50%', background: getCalendarEventMeta(eventItem.category).color, boxShadow: '0 0 0 2px color-mix(in srgb, var(--surface-panel) 84%, transparent)' }} />
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--text-secondary)', fontWeight: 800, background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 999, padding: '5px 8px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)' }} /> No class</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--text-secondary)', fontWeight: 800, background: 'var(--success-soft)', border: '1px solid var(--success-border)', borderRadius: 999, padding: '5px 8px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} /> Academic</div>
                {canManageCalendar ? (
                  <button type="button" onClick={handleOpenCalendarEventModal} style={{ width: 30, height: 30, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'linear-gradient(135deg, var(--accent-soft) 0%, color-mix(in srgb, var(--accent) 20%, transparent) 100%)', color: 'var(--accent-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-glow)' }} aria-label="Add school calendar event" title="Add school calendar event"><FaPlus style={{ width: 12, height: 12 }} /></button>
                ) : null}
              </div>

              {calendarActionMessage ? (
                <div style={{ marginTop: 10, borderRadius: 12, border: '1px solid var(--success-border)', background: 'linear-gradient(180deg, color-mix(in srgb, var(--success-soft) 76%, var(--surface-panel) 24%) 0%, var(--success-soft) 100%)', color: 'var(--success)', fontSize: 10, fontWeight: 800, padding: '8px 10px', boxShadow: 'var(--shadow-soft)' }}>{calendarActionMessage}</div>
              ) : null}

              <div style={{ marginTop: 12, background: 'linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)', border: '1px solid var(--border-soft)', borderRadius: 14, padding: '10px', boxShadow: 'var(--shadow-soft)' }}>
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
                        <div key={eventItem.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, background: eventMeta.background, border: `1px solid ${eventMeta.border}`, borderRadius: 10, padding: '7px 8px' }}>
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

            <div style={{ background: 'linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)', borderRadius: 16, boxShadow: 'var(--shadow-soft)', padding: '11px', border: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Upcoming Deadlines</h4>
                {canManageCalendar ? <button type="button" onClick={handleOpenDeadlineModal} style={{ width: 28, height: 28, borderRadius: 999, border: '1px solid var(--success-border)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--success-soft) 72%, var(--surface-panel) 28%) 0%, var(--success-soft) 100%)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-soft)' }} aria-label="Add upcoming deadline" title="Add upcoming deadline"><FaPlus style={{ width: 11, height: 11 }} /></button> : null}
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {calendarEventsLoading ? (
                  <div style={{ padding: '8px 9px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--surface-muted)', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>Loading deadlines...</div>
                ) : upcomingDeadlineEvents.length === 0 ? (
                  <div style={{ padding: '8px 9px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--surface-muted)', fontSize: 10, color: 'var(--text-muted)' }}>
                    No upcoming deadlines in the next 30 days.
                    {canManageCalendar ? <button type="button" onClick={handleOpenDeadlineModal} style={{ marginTop: 8, height: 28, padding: '0 10px', borderRadius: 999, border: '1px solid var(--success-border)', background: 'var(--surface-panel)', color: 'var(--success)', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>Add deadline</button> : null}
                  </div>
                ) : (
                  visibleUpcomingDeadlineEvents.map((eventItem) => {
                    const eventMeta = getCalendarEventMeta(eventItem.category);
                    return (
                      <div key={`deadline-${eventItem.id}`} style={{ padding: '8px 9px', borderRadius: 10, border: `1px solid ${eventMeta.border}`, background: eventMeta.background, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
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

      {showCreatePostModal && (
        <>
          <div
            onClick={() => setShowCreatePostModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "color-mix(in srgb, var(--surface-overlay) 84%, transparent)",
              backdropFilter: "blur(6px)",
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
                width: "min(500px, 100%)",
                maxHeight: "90vh",
                overflowY: "auto",
                background: "var(--surface-panel)",
                borderRadius: 18,
                border: "1px solid var(--border-soft)",
                boxShadow: "var(--shadow-panel)",
                pointerEvents: "auto",
              }}
            >
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 20px 13px", borderBottom: "1px solid var(--border-soft)" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2, letterSpacing: "-0.01em" }}>Create post</div>
                <button
                  type="button"
                  onClick={() => setShowCreatePostModal(false)}
                  style={{ position: "absolute", right: 16, top: 10, border: "1px solid var(--border-soft)", background: "var(--surface-muted)", width: 40, height: 40, borderRadius: "50%", fontSize: 22, color: "var(--text-secondary)", cursor: "pointer", lineHeight: 1 }}
                  aria-label="Close create post modal"
                  title="Close"
                >
                  ×
                </button>
              </div>

              <div style={{ padding: "16px 16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img
                    src={admin.profileImage || "/default-profile.png"}
                    alt="me"
                    style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>{admin.name || "Admin"}</div>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      style={{ height: 28, borderRadius: 6, border: "1px solid var(--input-border)", background: "var(--input-bg)", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", padding: "0 28px 0 10px", width: "fit-content", minWidth: 118 }}
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
                    minHeight: 210,
                    resize: "vertical",
                    border: "none",
                    background: "transparent",
                    borderRadius: 0,
                    padding: 0,
                    fontSize: 28,
                    lineHeight: 1.3333,
                    outline: "none",
                    color: "var(--text-primary)",
                  }}
                />

                <div style={{ border: "1px solid var(--border-soft)", borderRadius: 12, padding: "8px 12px", boxShadow: "var(--shadow-soft)", background: "var(--surface-overlay)" }}>
                  <div className="fb-post-bottom" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ marginRight: "auto", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Add to your post</div>
                    <label className="fb-upload" title="Upload media" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", background: "transparent", cursor: "pointer", color: "var(--success)", fontSize: 24 }}>
                      <AiFillPicture className="fb-icon" />
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          setPostMedia(file || null);
                        }}
                        accept="image/*,video/*"
                      />
                    </label>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", color: "var(--danger)", fontSize: 22, background: "transparent", opacity: 0.9 }}>
                      <AiFillVideoCamera />
                    </div>

                    {postMedia && (
                      <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface-muted)", borderRadius: 10, boxSizing: "border-box" }}>
                        <AiFillPicture style={{ color: "var(--success)", fontSize: 18, flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {postMedia.name}
                        </span>
                        <button
                          onClick={() => {
                            setPostMedia(null);
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
                  className="telegram-send-icon"
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
                  Post
                </button>
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
    </div>
  );
}

export default Dashboard;