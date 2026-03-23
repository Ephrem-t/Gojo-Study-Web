import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  FaHome,
  FaChalkboardTeacher,
  FaSignOutAlt,
  FaSearch,
  FaClipboardCheck,
  FaUsers,
  FaCommentDots,
  FaCheck,
   FaUserCheck,
  FaCalendarAlt,
  FaBookOpen
} from "react-icons/fa";
import Sidebar from "./Sidebar";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { ref, onValue, off } from "firebase/database";
import { db, schoolPath } from "../firebase"; // adjust path if needed
import { getTeacherCourseContext } from "../api/teacherApi";
import { resolveProfileImage } from "../utils/profileImage";
import "../styles/global.css";

/**
 * TeacherParent (responsive)
 *
 * - Keeps existing behavior.
 * - Right sidebar becomes a sheet on small screens / portrait (fills viewport).
 * - Adds overlay and prevents background scroll while sidebar is open.
 * - Adds a close button at the top of the sidebar.
 * - Minor polish to layout so it adapts to narrow viewports.
 */

// Chat thread key for teacher<->parent must be: teacherUserId_parentUserId
// (teacher first, no sorting) so the DB path is predictable.
const getChatId = (teacherUserId, parentUserId) => {
  const t = String(teacherUserId || "").trim();
  const p = String(parentUserId || "").trim();
  return `${t}_${p}`;
};
import { API_BASE } from "../api/apiConfig";
import { getRtdbRoot } from "../api/rtdbScope";
const RTDB_BASE = getRtdbRoot();

const formatTime = (ts) => {
  if (!ts) return "";
  const d = new Date(Number(ts));
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
};

const findUserByUserId = (usersObj, userId) => {
  if (!usersObj || !userId) return null;
  const normalizedUserId = String(userId || "").trim();
  const directByKey = usersObj?.[normalizedUserId];
  if (directByKey) return directByKey;

  return (
    Object.entries(usersObj).find(([userKey, userValue]) => {
      return (
        String(userKey || "").trim() === normalizedUserId ||
        String(userValue?.userId || "").trim() === normalizedUserId
      );
    })?.[1] || null
  );
};

function TeacherParent() {
  // Responsive sidebar state for mobile (match Students.jsx)
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth > 600 : true);
const [teacher, setTeacher] = useState(null);
  const [parents, setParents] = useState([]);
  const [selectedParent, setSelectedParent] = useState(null);
  const [loading, setLoading] = useState(true);
const [activeTab, setActiveTab] = useState("Details"); // default tab
 const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const messagesEndRef = useRef(null);
const [children, setChildren] = useState([]);
 const [notifications, setNotifications] = useState([]);
 const [showNotifications, setShowNotifications] = useState(false);
 const [messageNotifications, setMessageNotifications] = useState([]);
  const [highlightedPostId, setHighlightedPostId] = useState(null);

  const [showMessenger, setShowMessenger] = useState(false);
    const [conversations, setConversations] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const navigate = useNavigate();

  // detect portrait (width < height) and small screens
  const [isPortrait, setIsPortrait] = useState(window.innerWidth < window.innerHeight);
  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerWidth < window.innerHeight);
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // load teacher from localStorage
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // safe teacher id for renders when `teacher` may be null briefly
  const teacherId = teacher?.userId || "";

  // fetch parents & related data
  useEffect(() => {
    if (!teacher) return;
    let cancelled = false;

    const fetchParents = async () => {
      try {
        setLoading(true);

        const [courseContext, coursesRes, studentsRes, usersRes, parentsRes] = await Promise.all([
          getTeacherCourseContext({ teacher, rtdbBase: RTDB_BASE }),
          axios.get(`${RTDB_BASE}/Courses.json`),
          axios.get(`${RTDB_BASE}/Students.json`),
          axios.get(`${RTDB_BASE}/Users.json`),
          axios.get(`${RTDB_BASE}/Parents.json`),
        ]);

        const courses = coursesRes.data || {};
        const students = studentsRes.data || {};
        const users = usersRes.data || {};
        const parentsData = parentsRes.data || {};
        const teacherCourseIds = courseContext.courseIds || [];

        const allowedStudentIds = new Set(
          Object.entries(students)
            .filter(([, student]) =>
              teacherCourseIds.some((courseId) => {
                const course = courses[courseId];
                return course && course.grade === student.grade && course.section === student.section;
              })
            )
            .map(([studentId]) => studentId)
        );

        // Build student->parent map from both legacy Parents.children and current Students.parents.
        const studentToParentMap = {};
        Object.entries(parentsData).forEach(([parentId, parent]) => {
          if (!parent.children) return;
          Object.values(parent.children).forEach((child) => {
            if (!child.studentId) return;
            const rel = child.relationship || child.relation || child.relationToChild || child.type || child.role || null;
            if (!studentToParentMap[child.studentId]) studentToParentMap[child.studentId] = [];
            studentToParentMap[child.studentId].push({ parentId, relationship: rel });
          });
        });

        Object.entries(students).forEach(([studentId, student]) => {
          Object.entries(student.parents || {}).forEach(([parentId, link]) => {
            if (!studentToParentMap[studentId]) studentToParentMap[studentId] = [];
            studentToParentMap[studentId].push({
              parentId,
              relationship: link?.relationship || null,
              userId: link?.userId || null,
            });
          });
        });

        // Build parent->children map with relationship data
        const parentChildrenMap = {};
        Object.entries(students).forEach(([studentId, student]) => {
          if (allowedStudentIds.size && !allowedStudentIds.has(studentId)) return;

          const studentUser = findUserByUserId(users, student.userId);
          const studentName = studentUser?.name || "No Name";
          const studentProfileImage = resolveProfileImage(
            studentUser?.profileImage,
            studentUser?.profile,
            studentUser?.avatar,
            student?.profileImage,
            student?.basicStudentInformation?.studentPhoto,
            student?.studentPhoto,
            "/default-profile.png"
          );

          const parentEntries = studentToParentMap[studentId] || [];
          const uniqueParentEntries = [...new Map(
            parentEntries
              .filter((entry) => entry?.parentId)
              .map((entry) => [String(entry.parentId), entry])
          ).values()];

          uniqueParentEntries.forEach(({ parentId, relationship }) => {
            if (!parentChildrenMap[parentId]) parentChildrenMap[parentId] = [];
            const existingChildIndex = parentChildrenMap[parentId].findIndex(
              (childItem) => String(childItem.studentId) === String(studentId)
            );

            const nextChild = {
              studentId,
              name: studentName,
              grade: student.grade,
              section: student.section,
              profileImage: studentProfileImage,
              userId: student.userId,
                relationship: relationship || "—",
                age: student.age || studentUser?.age || null,
                city: student.city || studentUser?.city || (student.address && student.address.city) || null,
                citizenship: student.citizenship || studentUser?.citizenship || student.nationality || null,
                address: student.address || studentUser?.address || null,
                status: student.status || "Active",
            };

            if (existingChildIndex === -1) {
              parentChildrenMap[parentId].push(nextChild);
            } else {
              const existingChild = parentChildrenMap[parentId][existingChildIndex];
              parentChildrenMap[parentId][existingChildIndex] = {
                ...existingChild,
                ...nextChild,
                relationship: existingChild.relationship || nextChild.relationship || "—",
              };
            }
          });
        });

        const finalParents = Object.keys(parentChildrenMap).map((pid) => {
          const parent = parentsData[pid] || {};
          const parentUser = findUserByUserId(users, parent.userId) || {};
          const childrenList = parentChildrenMap[pid] || [];
          const relationships = Array.from(new Set(childrenList.map((c) => c.relationship).filter(Boolean)));
          return {
            id: pid,
            userId: parent.userId,
            name: parentUser.name || parent.name || "No Name",
            email: parentUser.email || parent.email || "N/A",
            phone: parentUser.phone || parent.phone || "",
            profileImage: resolveProfileImage(
              parentUser.profileImage,
              parentUser.profile,
              parentUser.avatar,
              parent.profileImage,
              parent.profile,
              "/default-profile.png"
            ),
            children: childrenList,
            relationships,
            age: parent.age || parentUser.age || null,
            city: parent.city || parentUser.city || parent.address?.city || null,
            citizenship: parent.citizenship || parentUser.citizenship || parent.nationality || null,
            status: parent.status || "Active",
            createdAt: parent.createdAt,
            address: parent.address || parentUser.address || null,
            extra: parent.extra,
          };
        }).filter((parent) => Array.isArray(parent.children) && parent.children.length > 0);

        if (!cancelled) setParents(finalParents);
      } catch (err) {
        console.error("Error fetching parents:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchParents();
    return () => {
      cancelled = true;
    };
  }, [teacher]);

  // Scroll to bottom when new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // fetch messages when chat popup open for selectedParent
  useEffect(() => {
    if (!selectedParent || !teacher || !chatOpen) return;
    const chatId = getChatId(teacherId, selectedParent.userId);
    const messagesRef = ref(db, schoolPath(`Chats/${chatId}/messages`));
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const msgs = Object.entries(data).map(([id, msg]) => ({ messageId: id, ...msg }));
      msgs.sort((a, b) => a.timeStamp - b.timeStamp);
      setMessages(msgs);
    });
    markAsSeen(chatId);
    return () => off(messagesRef);
  }, [selectedParent, teacher, chatOpen]);

  const sendMessage = async (text) => {
    if (!text?.trim() || !selectedParent || !teacher) return;
    const senderId = teacherId;
    const receiverId = selectedParent.userId;
    const chatId = getChatId(senderId, receiverId);
    const timeStamp = Date.now();
    const message = { senderId, receiverId, type: "text", text, seen: false, timeStamp };
    try {
      await axios.post(`${RTDB_BASE}/Chats/${chatId}/messages.json`, message);
      await axios.patch(`${RTDB_BASE}/Chats/${chatId}.json`, {
        participants: { [senderId]: true, [receiverId]: true },
        lastMessage: { text, senderId, seen: false, timeStamp },
        unread: { [senderId]: 0, [receiverId]: 1 },
      });
      setNewMessageText("");
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  const markAsSeen = async (chatId) => {
    try {
      await axios.patch(`${RTDB_BASE}/Chats/${chatId}/unread.json`, { [teacherId]: 0 });
      await axios.patch(`${RTDB_BASE}/Chats/${chatId}/lastMessage.json`, { seen: true });
    } catch (err) {
      console.error("Mark as seen error:", err);
    }
  };

  // notifications & messenger (kept as in your original)

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Fetch posts
        const res = await axios.get(`${API_BASE}/get_posts`);
        let postsData = res.data || [];
        if (!Array.isArray(postsData) && typeof postsData === "object") postsData = Object.values(postsData);
        const [adminsRes, usersRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/School_Admins.json`),
          axios.get(`${RTDB_BASE}/Users.json`)
        ]);
        const schoolAdmins = adminsRes.data || {};
        const users = usersRes.data || {};
        const teacherLocal = JSON.parse(localStorage.getItem("teacher"));
        const seenPosts = getSeenPosts(teacherLocal?.userId);
        const resolveAdminInfo = (post) => {
          const adminId = post.adminId || post.posterAdminId || post.poster || post.admin || null;
          if (adminId && schoolAdmins[adminId]) {
            const sa = schoolAdmins[adminId];
            const userKey = sa.userId;
            const userRec = users[userKey] || null;
            const name = (userRec && userRec.name) || sa.name || post.adminName || "Admin";
            const profile = (userRec && userRec.profileImage) || sa.profileImage || post.adminProfile || "/default-profile.png";
            return { name, profile };
          }
          return { name: post.adminName || "Admin", profile: post.adminProfile || "/default-profile.png" };
        };
        const latestPosts = postsData
          .slice()
          .sort((a, b) => ((b.time ? new Date(b.time).getTime() : 0) - (a.time ? new Date(a.time).getTime() : 0)))
          .filter((post) => post.postId && !seenPosts.includes(post.postId))
          .slice(0, 5)
          .map((post) => {
            const info = resolveAdminInfo(post);
            return {
              type: "post",
              id: post.postId,
              title: post.message?.substring(0, 50) || "Untitled post",
              adminName: info.name,
              adminProfile: info.profile
            };
          });

        // Fetch unread messages (conversations)
        let messageNotifs = [];
        try {
          const t = teacherLocal;
          if (t && t.userId) {
            const [chatsRes, usersRes] = await Promise.all([
              axios.get(`${RTDB_BASE}/Chats.json`),
              axios.get(`${RTDB_BASE}/Users.json`)
            ]);
            const chats = chatsRes.data || {};
            const users = usersRes.data || {};
            const usersByKey = users || {};
            const userKeyByUserId = {};
            Object.entries(usersByKey).forEach(([pushKey, u]) => { if (u && u.userId) userKeyByUserId[u.userId] = pushKey; });
            messageNotifs = Object.entries(chats)
              .map(([chatId, chat]) => {
                const unreadMap = chat.unread || {};
                const unreadForMe = unreadMap[t.userId] || 0;
                if (!unreadForMe) return null;
                const participants = chat.participants || {};
                const otherKeyCandidate = Object.keys(participants || {}).find((p) => p !== t.userId);
                if (!otherKeyCandidate) return null;
                let otherPushKey = otherKeyCandidate;
                let otherRecord = usersByKey[otherPushKey];
                if (!otherRecord) {
                  const mapped = userKeyByUserId[otherKeyCandidate];
                  if (mapped) { otherPushKey = mapped; otherRecord = usersByKey[mapped]; }
                }
                if (!otherRecord) otherRecord = { userId: otherKeyCandidate, name: otherKeyCandidate, profileImage: "/default-profile.png" };
                const contact = { pushKey: otherPushKey, userId: otherRecord.userId || otherKeyCandidate, name: otherRecord.name || otherRecord.username || otherKeyCandidate, profileImage: otherRecord.profileImage || otherRecord.profile || "/default-profile.png" };
                const lastMessage = chat.lastMessage || {};
                return {
                  type: "message",
                  chatId,
                  displayName: contact.name,
                  profile: contact.profileImage,
                  lastMessageText: lastMessage.text || "",
                  lastMessageTime: lastMessage.timeStamp || lastMessage.time || null,
                  unreadForMe
                };
              })
              .filter(Boolean)
              .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
          }
        } catch (err) {
          console.error("Error fetching message notifications:", err);
        }

        setNotifications([...latestPosts, ...messageNotifs]);
        setMessageNotifications(messageNotifs);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };
    fetchNotifications();
  }, []);

  function getSeenPosts(teacherId) {
    return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
  }
  function saveSeenPost(teacherId, postId) {
    const seen = getSeenPosts(teacherId);
    if (!seen.includes(postId)) localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seen, postId]));
  }

  // messenger conversations fetch
  const fetchConversations = async (currentTeacher = teacher) => {
    try {
      const t = currentTeacher || JSON.parse(localStorage.getItem("teacher"));
      if (!t || !t.userId) {
        setConversations([]);
        return;
      }
      const [chatsRes, usersRes] = await Promise.all([axios.get(`${RTDB_BASE}/Chats.json`), axios.get(`${RTDB_BASE}/Users.json`)]);
      const chats = chatsRes.data || {};
      const users = usersRes.data || {};
      const usersByKey = users || {};
      const userKeyByUserId = {};
      Object.entries(usersByKey).forEach(([pushKey, u]) => { if (u && u.userId) userKeyByUserId[u.userId] = pushKey; });
      const convs = Object.entries(chats)
        .map(([chatId, chat]) => {
          const unreadMap = chat.unread || {};
          const unreadForMe = unreadMap[t.userId] || 0;
          if (!unreadForMe) return null;
          const participants = chat.participants || {};
          const otherKeyCandidate = Object.keys(participants || {}).find((p) => p !== t.userId);
          if (!otherKeyCandidate) return null;
          let otherPushKey = otherKeyCandidate;
          let otherRecord = usersByKey[otherPushKey];
          if (!otherRecord) {
            const mapped = userKeyByUserId[otherKeyCandidate];
            if (mapped) { otherPushKey = mapped; otherRecord = usersByKey[mapped]; }
          }
          if (!otherRecord) otherRecord = { userId: otherKeyCandidate, name: otherKeyCandidate, profileImage: "/default-profile.png" };
          const contact = { pushKey: otherPushKey, userId: otherRecord.userId || otherKeyCandidate, name: otherRecord.name || otherRecord.username || otherKeyCandidate, profileImage: otherRecord.profileImage || otherRecord.profile || "/default-profile.png" };
          const lastMessage = chat.lastMessage || {};
          return { chatId, contact, displayName: contact.name, profile: contact.profileImage, lastMessageText: lastMessage.text || "", lastMessageTime: lastMessage.timeStamp || lastMessage.time || null, unreadForMe };
        })
        .filter(Boolean)
        .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
      setConversations(convs);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setConversations([]);
    }
  };

  const handleMessengerToggle = async () => {
    setShowMessenger((s) => !s);
    await fetchConversations();
  };

  const handleOpenConversation = async (conv, index) => {
    if (!teacher || !conv) return;
    const { chatId, contact } = conv;
    navigate("/all-chat", { state: { contact, chatId, tab: "parents" } });
    try {
      await axios.put(`${RTDB_BASE}/Chats/${chatId}/unread/${teacherId}.json`, null);
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }
    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };

  const totalUnreadMessages = messageNotifications.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);

  // Prevent background scroll while sidebar is open (applies on small screens)
  useEffect(() => {
    if (selectedParent) {
      document.body.classList.add("sidebar-open");
    } else {
      document.body.classList.remove("sidebar-open");
    }
    return () => document.body.classList.remove("sidebar-open");
  }, [selectedParent]);

  const normalizedSearch = (searchTerm || "").trim().toLowerCase();
  const filteredParents = useMemo(() => {
    if (!normalizedSearch) return parents;
    return parents.filter((p) => {
      const childText = (p.children || []).map(c => `${c.name} ${c.studentId} ${c.grade} ${c.section}`).join(" ");
      const hay = `${p.name || ""} ${p.userId || ""} ${p.email || ""} ${p.phone || ""} ${childText}`.toLowerCase();
      return hay.includes(normalizedSearch);
    });
  }, [parents, normalizedSearch]);

  const listShellWidth = isPortrait ? "92%" : "560px";

  // Render
  return (
    <div
      className="dashboard-page"
      style={{
        background: "var(--page-bg)",
        minHeight: "100vh",
        height: "100vh",
        overflow: "hidden",
        color: "var(--text-primary)",
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
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
        "--shadow-soft": "0 10px 24px rgba(15, 23, 42, 0.08)",
        "--shadow-panel": "0 14px 30px rgba(15, 23, 42, 0.10)",
        "--shadow-glow": "0 0 0 2px rgba(37, 99, 235, 0.18)",
      }}
    >
      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px", height: "calc(100vh - 73px)", overflow: "hidden" }}>
        <Sidebar
          active="parents"
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

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", overflowX: "hidden", display: "flex", justifyContent: "flex-start", padding: "10px 20px 20px", boxSizing: "border-box" }}>
          <div
            className="parent-list-card-responsive"
            style={{
              width: listShellWidth,
              position: "relative",
              marginLeft: 0,
              marginRight: isPortrait ? 0 : "24px",
            }}
          >
            <style>{`
              @media (max-width: 600px) {
                .parent-list-card-responsive {
                  margin-left: -16px !important;
                  margin-right: auto !important;
                  width: 80vw !important;
                  max-width: 80vw !important;
                }
              }
            `}</style>
            <div className="section-header-card" style={{ marginBottom: 12 }}>
              <h2 className="section-header-card__title" style={{ fontSize: 20 }}>Parents</h2>
              <div className="section-header-card__meta">
                <span>Total: {filteredParents.length}</span>
                <span className="section-header-card__chip">Teacher View</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "10px" }}>
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "var(--surface-panel)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                <FaSearch style={{ color: "var(--text-muted)", fontSize: 14 }} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search parents..."
                  style={{ width: "100%", border: "none", outline: "none", fontSize: 13, background: "transparent" }}
                />
              </div>
            </div>

              {loading ? (
                <p style={{ textAlign: "center", fontSize: 18, color: "#555" }}>Loading...</p>
              ) : (filteredParents.length === 0) ? (
                <p style={{ textAlign: "center", fontSize: 18, color: "#999" }}>No parents found.</p>
              ) : (
                <>
                  <style>{`
                    .parent-list-responsive {
                      display: flex;
                      flex-direction: column;
                      margin-top: 10px;
                      gap: 10px;
                      width: 100%;
                      max-width: 100vw;
                      margin-left: 0;
                      margin-right: 0;
                    }
                    @media (max-width: 600px) {
                      .parent-list-responsive {
                        width: 100vw !important;
                        max-width: 100vw !important;
                        margin-left: 0 !important;
                        margin-right: 0 !important;
                        padding: 0 !important;
                        align-items: flex-start !important;
                      }
                      .parent-list-responsive > div {
                        margin-left: 10px !important;
                        padding-left: 10px !important;
                        width: 100vw !important;
                        max-width: 100vw !important;
                        min-width: 100vw !important;
                        box-sizing: border-box !important;
                      }
                    }
                    @media (min-width: 350px) {
                      .parent-list-responsive {
                        width: 400px;
                        max-width: 90vw;
                      }
                    }
                    @media (min-width: 1200px) {
                      .parent-list-responsive {
                        width: 420px;
                        max-width: 520px;
                        margin-left: 0;
                      }
                    }
                    @media (min-width: 1500px) {
                      .parent-list-responsive {
                        width: 420px;
                        max-width: 520px;
                        margin-left: 0;
                      }
                    }
                  `}</style>
                  <div className="parent-list-responsive">
                    {filteredParents.map((p, index) => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedParent(p)}
                        className="parent-list-item-responsive"
                        style={{
                          width: "100%",
                          borderRadius: "12px",
                          padding: "10px",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          cursor: "pointer",
                          background: selectedParent?.id === p.id ? "#e0e7ff" : "#fff",
                          border: selectedParent?.id === p.id ? "2px solid #4b6cb7" : "1px solid #ddd",
                          boxShadow: selectedParent?.id === p.id ? "0 6px 15px rgba(75,108,183,0.3)" : "0 2px 6px rgba(0,0,0,0.06)",
                          transition: "all 0.3s ease",
                        }}
                      >
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: selectedParent?.id === p.id ? '#4b6cb7' : '#f1f5f9',
                          color: selectedParent?.id === p.id ? '#fff' : '#374151',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 12,
                          flexShrink: 0,
                        }}>{index + 1}</div>

                        <img
                          src={p.profileImage}
                          alt={p.name}
                          onError={(event) => {
                            event.currentTarget.src = "/default-profile.png";
                          }}
                          style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: selectedParent?.id === p.id ? '3px solid #4b6cb7' : '3px solid #ddd' }}
                        />
                        <div>
                          <h3 style={{ margin: 0, fontSize: 14 }}>{p.name}</h3>
                          <p style={{ margin: '4px 0', color: '#555', fontSize: 11 }}>{p.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

            {/* Responsive Right Sidebar */}
            {selectedParent ? (
              <>
                {/* overlay for mobile/portrait */}
                <div
                  className="parent-sidebar-overlay"
                  onClick={() => setSelectedParent(null)}
                  style={{ display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 999 }}
                />

                <aside
                  className="parent-sidebar"
                  style={{
                    width: isPortrait ? "100%" : "380px",
                    height: isPortrait ? "100vh" : "calc(100vh - 55px)",
                    position: "fixed",
                    right: 0,
                    top: isPortrait ? 0 : "55px",
                    background: "var(--page-bg-secondary, var(--surface-muted))",
                    boxShadow: "var(--shadow-panel)",
                    borderLeft: isPortrait ? "none" : "1px solid var(--border-soft)",
                    zIndex: 1000,
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                    overflowX: "hidden",
                    padding: "14px",
                    paddingBottom: "130px",
                    transition: "all 0.35s ease",
                    fontSize: "10px",
                  }}
                  role="dialog"
                  aria-modal="true"
                >
                  {/* close button */}
                  <button
                    onClick={() => setSelectedParent(null)}
                    style={{
                      position: "absolute",
                      top: 12,
                      left: 14,
                      border: "1px solid rgba(255,255,255,0.42)",
                      background: "rgba(255,255,255,0.18)",
                      cursor: "pointer",
                      fontSize: 24,
                      fontWeight: 700,
                      color: "#ffffff",
                      zIndex: 2000,
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      lineHeight: 1,
                      boxShadow: "0 8px 22px rgba(15, 23, 42, 0.18)",
                    }}
                  >
                    ×
                  </button>

                  <div style={{ textAlign: "center", margin: "-14px -14px 12px", padding: "16px 10px", background: "linear-gradient(135deg, var(--accent-strong), var(--accent))" }}>
                    <div style={{ width: 70, height: 70, margin: "0 auto 10px", borderRadius: "50%", overflow: "hidden", border: "3px solid rgba(255,255,255,0.8)" }}>
                      <img
                        src={selectedParent.profileImage}
                        alt={selectedParent.name}
                        onError={(event) => {
                          event.currentTarget.src = "/default-profile.png";
                        }}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <h3 style={{ margin: 0, fontSize: 14, color: "#ffffff", fontWeight: 800 }}>{selectedParent.name}</h3>
                    <div style={{ color: "#dbeafe", marginTop: 6, fontSize: 10 }}>{selectedParent.email}</div>
                  </div>

                  <div style={{ display: "flex", marginBottom: "10px", borderBottom: "1px solid var(--border-soft)" }}>
                    {["Details", "Children", "Status"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setActiveTab(t)}
                        style={{
                          flex: 1,
                          padding: "6px",
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 10,
                          color: activeTab === t ? "var(--accent-strong)" : "var(--text-muted)",
                          borderBottom: activeTab === t ? "3px solid var(--accent-strong)" : "3px solid transparent",
                        }}
                      >
                        {t.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <div style={{ paddingBottom: 40 }}>
                 {activeTab === "Details" && (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 12,
      padding: 12,
      marginLeft: 0,
      marginRight: 0,
      borderRadius: 12,
      background: "var(--surface-panel)",
      border: "1px solid var(--border-soft)",
      boxShadow: "var(--shadow-soft)",
      margin: "0 auto",
      maxWidth: 380,
    }}
  >
    {/* ================= LEFT COLUMN ================= */}
    <div>
      {/* PARENT DETAILS */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          marginBottom: 6,
          color: "var(--text-primary)",
        }}
      >
        Parent Details
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: 8,
          rowGap: 8,
        }}
      >
        {[
      
          ["Email", selectedParent.email || "N/A"],
          ["Phone", selectedParent.phone || "N/A"],
          ["Relationship(s)", (selectedParent.relationships && selectedParent.relationships.length) ? selectedParent.relationships.join(", ") : "—"],
          ["Age", selectedParent.age || "—"],
          ["City", selectedParent.city || (selectedParent.address && typeof selectedParent.address === 'object' ? selectedParent.address.city : selectedParent.city) || "—"],
          ["Citizenship", selectedParent.citizenship || "—"],
          ["Status", selectedParent.status ? (selectedParent.status.charAt(0).toUpperCase() + selectedParent.status.slice(1)) : "—"],
          ["Address", (typeof selectedParent.address === 'string' ? selectedParent.address : (selectedParent.address && (selectedParent.address.street || selectedParent.address.city || JSON.stringify(selectedParent.address))) ) || "—", true],
        ].map(([label, value, span]) => (
          <div
            key={label}
            style={{
              padding: 8,
              borderRadius: 10,
              background: "var(--surface-panel)",
              border: "1px solid var(--border-soft)",
              boxShadow: "none",
              gridColumn: span ? "span 2" : "span 1",
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.6px",
              }}
            >
              {label}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

     
    </div>
  </div>
)}

       {activeTab === "Children" && (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 20,
      background: "var(--surface-panel)",
      border: "1px solid var(--border-soft)",
      boxShadow: "var(--shadow-soft)",
      padding: 12,
      borderRadius: 12,
    }}
  >
    {selectedParent.children.map((c) => (
      <div
        key={c.studentId}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--surface-panel)",
          borderRadius: 12,
          padding: "12px",
          boxShadow: "none",
          border: "1px solid var(--border-soft)",
          transition: "box-shadow 0.15s, transform 0.12s",
          cursor: "pointer",
        }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,0.08)")}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.05)")}
      >
        {/* Profile Image */}
        <img
          src={c.profileImage}
          alt={c.name}
          onError={(event) => {
            event.currentTarget.src = "/default-profile.png";
          }}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "3px solid var(--accent-strong)",
            objectFit: "cover",
            background: "var(--surface-panel)",
            flexShrink: 0,
          }}
        />
        {/* User Info */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{c.name}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "4px 10px", borderRadius: 999, background: "var(--surface-muted)" }}>Grade: {c.grade}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "4px 8px", borderRadius: 999, background: "var(--surface-muted)" }}>Section: {c.section}</div>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.relationship && `Relation: ${c.relationship}`}</span>
        </div>
      </div>
    ))}
  </div>
)}
                    {activeTab === "Status" && (
                      <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, boxShadow: "var(--shadow-soft)", padding: 12 }}>
                        <p><strong>Status:</strong> {selectedParent.status || "Active"}</p>
                        <p><strong>Created:</strong> {selectedParent.createdAt ? new Date(selectedParent.createdAt).toLocaleString() : "—"}</p>
                      </div>
                    )}
                  </div>


 {/* Chat Button */}
      {!chatOpen && (
        <div
          onClick={() => setChatOpen(true)}
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: "140px",
            height: "48px",
            background: "linear-gradient(135deg, color-mix(in srgb, var(--accent-strong) 45%, #7c3aed), var(--accent))",
            borderRadius: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 10,
            padding: "0 12px",
            color: "#fff",
            cursor: "pointer",
            zIndex: 1000,
            boxShadow: "var(--shadow-glow)",
            transition: "transform 0.16s ease",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "rgba(255,255,255,0.14)",
            }}
          >
            <FaCommentDots size={18} />
          </span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>Parent Chat</span>
          </div>
          <span
            style={{
              position: "absolute",
              top: -8,
              right: 8,
              background: "color-mix(in srgb, var(--accent-strong) 28%, #020617)",
              color: "#fff",
              borderRadius: "999px",
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 6px",
              border: "2px solid #fff",
              lineHeight: 1,
            }}
          >
            P
          </span>
        </div>
      )}


{chatOpen && selectedParent && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: "360px",
            height: "480px",
            background: "var(--surface-panel)",
            borderRadius: "16px",
            boxShadow: "var(--shadow-panel)",
            zIndex: 2000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* HEADER */}
          <div
            style={{
              padding: "14px",
              borderBottom: "1px solid var(--border-soft)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--surface-muted)",
            }}
          >
            <strong>{selectedParent.name}</strong>

            <div style={{ display: "flex", gap: "10px" }}>
              {/* Expand */}
              
              <button
  onClick={() => {
    setChatOpen(false); // properly close popup
    const chatId = getChatId(teacherId, selectedParent.userId);
    navigate("/all-chat", {
      state: {
        user: selectedParent, // user to auto-select
        chatId,               // open the exact chat thread
        tab: "parent",        // tab type
      },
    });
  }}
  style={{
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "18px",
  }}
>
  ⤢
</button>


              {/* Close */}
              <button
                onClick={() => setChatOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              padding: "12px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              background: "var(--surface-muted)",
            }}
          >
            {messages.length === 0 ? (
              <p style={{ textAlign: "center", color: "#aaa" }}>
                Start chatting with {selectedParent.name}
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.messageId}
                    style={{
                    display: "flex",
                    flexDirection: m.senderId === teacherId ? "row-reverse" : "row",
                    alignItems: "flex-end",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: m.senderId === teacherId ? "flex-end" : "flex-start" }}>
                    <div style={{
                      background: m.senderId === teacherId ? "#4b6cb7" : "#fff",
                      color: m.senderId === teacherId ? "#fff" : "#0f172a",
                      padding: "10px 14px",
                      borderRadius: 18,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                      wordBreak: "break-word",
                      position: "relative",
                      paddingBottom: "26px",
                    }}>
                      <div>{m.text}</div>
                      <div style={{ position: "absolute", right: 8, bottom: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: m.senderId === teacherId ? "rgba(255,255,255,0.9)" : "#64748b" }}>
                        <span style={{ fontSize: 11 }}>{formatTime(m.timeStamp)}</span>
                        {m.senderId === teacherId && <FaCheck size={12} color={m.seen ? (m.seenAt ? "#10b981" : "#10b981") : (m.seen ? "#10b981" : "#94a3b8")} />}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "10px",
              borderTop: "1px solid var(--border-soft)",
              display: "flex",
              gap: "8px",
              background: "var(--surface-panel)",
            }}
          >
            <input
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "999px",
                border: "1px solid var(--border-strong)",
                outline: "none",
                background: "var(--surface-panel)",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage(newMessageText);
              }}
            />
            <button
              onClick={() => sendMessage(newMessageText)}
              style={{
                background: "var(--accent-strong)",
                border: "none",
                borderRadius: "50%",
                width: "42px",
                height: "42px",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}




                </aside>

                {/* component-scoped CSS for responsive behavior */}
                <style>{`
                  @media (max-width: 900px), (orientation: portrait) {
                    .parent-sidebar { width: 100vw !important; height: 100vh !important; left: 0 !important; top: 0 !important; border-radius: 0 !important; padding: 14px !important; }
                    .parent-sidebar-overlay { display: block !important; }
                    body.sidebar-open { overflow: hidden !important; }
                  }
                `}</style>
              </>
            ) : (
              <div
                style={{
                  width: isPortrait ? "100%" : "380px",
                  height: isPortrait ? "100vh" : "calc(100vh - 55px)",
                  position: "fixed",
                  right: 0,
                  top: isPortrait ? 0 : "55px",
                  background: "var(--surface-muted)",
                  zIndex: 90,
                  display: "flex",
                  flexDirection: "column",
                  overflowY: "auto",
                  overflowX: "hidden",
                  boxShadow: "var(--shadow-panel)",
                  borderLeft: isPortrait ? "none" : "1px solid var(--border-soft)",
                  transition: "all 0.35s ease",
                  fontSize: 10,
                  padding: "14px",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: 360,
                    borderRadius: 12,
                    border: "1px solid var(--border-soft)",
                    background: "var(--surface-panel)",
                    boxShadow: "var(--shadow-soft)",
                    padding: "18px 14px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      margin: "0 auto 10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--accent-soft)",
                      color: "var(--accent-strong)",
                      fontSize: 24,
                    }}
                  >
                    <FaUsers />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", fontWeight: 800 }}>
                    Parent Details
                  </h3>
                  <p style={{ margin: "8px 0 0", color: "var(--text-muted)", fontSize: 11, lineHeight: 1.5 }}>
                    Select a parent from the list to view details, children, status, and chat.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TeacherParent;

