import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { ref, onValue, off, update } from "firebase/database";
import { db, schoolPath } from "../firebase";
import {
  FaHome,
  FaUsers,
  FaClipboardCheck,
  FaSignOutAlt,
  FaSearch,
  FaChalkboardTeacher,
  FaCommentDots,
  FaCheck,
  FaPaperPlane,
   FaUserCheck,
  FaCalendarAlt,
  FaBookOpen
} from "react-icons/fa";
import Sidebar from "./Sidebar";
import "../styles/global.css";

const getChatId = (id1, id2) => [id1, id2].sort().join("_");

const formatTime = (timeStamp) => {
  if (!timeStamp) return "";
  const date = new Date(timeStamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

const formatDateLabel = (ts) => {
  if (!ts) return "";
  const msgDate = new Date(Number(ts));
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMsgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
  const diffMs = startOfToday - startOfMsgDay;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return msgDate.toLocaleDateString();
};

import { API_BASE } from "../api/apiConfig";
import { getRtdbRoot } from "../api/rtdbScope";
const RTDB_BASE = getRtdbRoot();

// Admin item component
const AdminItem = ({ admin, selected, onClick, number }) => (
  <div
    onClick={() => onClick(admin)}
    style={{
      width: "100%",
      borderRadius: "12px",
      padding: "10px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      cursor: "pointer",
      background: selected ? "#e0e7ff" : "var(--surface-panel)",
      border: selected ? "2px solid #4b6cb7" : "1px solid var(--border-soft)",
      boxShadow: selected ? "0 6px 15px rgba(75,108,183,0.3)" : "0 2px 6px rgba(0,0,0,0.06)",
      transition: "all 0.3s ease",
    }}
  >
    <div style={{
      width: 36,
      height: 36,
      borderRadius: "50%",
      background: selected ? "#4b6cb7" : "#f1f5f9",
      color: selected ? "#fff" : "#374151",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 800,
      fontSize: 12,
      flexShrink: 0,
    }}>{number}</div>

    <img
      src={admin.profileImage || "/default-profile.png"}
      alt={admin.name}
      onError={(event) => {
        event.currentTarget.src = "/default-profile.png";
      }}
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        objectFit: "cover",
        border: selected ? "3px solid #4b6cb7" : "3px solid #ddd",
      }}
    />
    <div>
      <h3 style={{ margin: 0, fontSize: 14 }}>{admin.name}</h3>
      <p style={{ margin: "4px 0", color: "#555", fontSize: 11 }}>{admin.username || admin.email}</p>
    </div>
  </div>
);

function AdminPage() {
    // Sidebar open state for mobile
    const [sidebarOpen, setSidebarOpen] = useState(false);
  // ---------------- State ----------------
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [adminTab, setAdminTab] = useState("details");
  const [adminChatOpen, setAdminChatOpen] = useState(false);

  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const messagesEndRef = useRef(null);

  const [teacher, setTeacher] = useState(null);
  const teacherData = JSON.parse(localStorage.getItem("teacher")) || {};
  const teacherUserId = String(teacherData.userId || "");
  const [selectedChatUser, setSelectedChatUser] = useState(null);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const postRefs = useRef({});

  // Messenger states (same behavior as Dashboard)
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]); // conversations with unread messages for this admin

  const navigate = useNavigate();

  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  // fetch conversations when teacher is available
  useEffect(() => {
    if (teacher) fetchConversations(teacher);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher]);

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // ---------------- FETCH ADMINS ----------------
  useEffect(() => {
  async function fetchAdmins() {
    try {
      setLoading(true);
      const [usersRes, schoolAdminsRes] = await Promise.all([
        axios.get(`${RTDB_BASE}/Users.json`),
        axios.get(`${RTDB_BASE}/School_Admins.json`),
      ]);
      const users = usersRes.data || {};
      const schoolAdmins = schoolAdminsRes.data || {};

      // Build a map of userId => schoolAdmin entry
      const adminByUserId = {};
      Object.entries(schoolAdmins).forEach(([adminKey, sa]) => {
        if (sa.userId) adminByUserId[sa.userId] = { ...sa, adminKey };
      });

      const adminsMap = new Map();

      Object.entries(schoolAdmins).forEach(([adminKey, schoolAdmin]) => {
        const linkedUser = Object.values(users).find(
          (user) => String(user.userId || "") === String(schoolAdmin.userId || "")
        ) || {};

        adminsMap.set(adminKey, {
          adminId: adminKey,
          userId: schoolAdmin.userId || linkedUser.userId || "",
          username: linkedUser.username || schoolAdmin.username || "",
          name: linkedUser.name || schoolAdmin.name || schoolAdmin.title || "Admin",
          email: linkedUser.email || schoolAdmin.email || "",
          phone: linkedUser.phone || schoolAdmin.phone || "",
          profileImage: linkedUser.profileImage || schoolAdmin.profileImage || "/default-profile.png",
          role: linkedUser.role || schoolAdmin.role || "school_admin",
          status: schoolAdmin.status || linkedUser.status || "active",
          title: schoolAdmin.title || "",
          schoolAdminKey: adminKey,
        });
      });

      Object.entries(users).forEach(([key, user]) => {
        const role = (user.role || user.userType || "").toLowerCase();
        if (role !== "admin" && role !== "school_admin" && role !== "school_admins") {
          return;
        }

        const schoolAdminInfo = adminByUserId[user.userId];
        const mapKey = (schoolAdminInfo && schoolAdminInfo.adminKey) || key;
        if (!adminsMap.has(mapKey)) {
          adminsMap.set(mapKey, {
            adminId: mapKey,
            ...user,
            status: (schoolAdminInfo && schoolAdminInfo.status) || user.status || "active",
            title: (schoolAdminInfo && schoolAdminInfo.title) || "",
            schoolAdminKey: schoolAdminInfo?.adminKey,
          });
        }
      });

      const adminsArray = Array.from(adminsMap.values());
      setAdmins(adminsArray);
      setError(adminsArray.length === 0 ? "No admins found" : "");
    } catch (err) {
      console.error(err);
      setError("Failed to fetch admins");
    } finally {
      setLoading(false);
    }
  }
  fetchAdmins();
}, []);
  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---------------- Real-time messages for popup/chat window ----------------
  useEffect(() => {
    if (!teacherUserId || !selectedChatUser) return;
    const chatKey = getChatId(teacherUserId, selectedChatUser.userId);
    const messagesRef = ref(db, schoolPath(`Chats/${chatKey}/messages`));
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const msgs = Object.entries(data)
        .map(([id, m]) => ({
          id,
          ...m,
          isTeacher: m.senderId === teacherUserId,
        }))
        .sort((a, b) => a.timeStamp - b.timeStamp);
      setMessages(msgs);

      // mark seen for messages where teacher is receiver and set seenAt
      Object.entries(data).forEach(([id, m]) => {
        if (m && !m.seen && m.receiverId === teacherUserId) {
          const ts = Date.now();
          update(ref(db, schoolPath(`Chats/${chatKey}/messages/${id}`)), { seen: true, seenAt: ts }).catch(() => {});
        }
      });

      // reset unread count for this teacher in this chat
      update(ref(db, schoolPath(`Chats/${chatKey}/unread`)), { [teacherUserId]: 0 }).catch(() => {});
    });

    return () => off(messagesRef);
  }, [teacherUserId, selectedChatUser]);

  // ---------------- Send Message ----------------
  const sendMessage = async () => {
    if (!newMessageText.trim() || !selectedAdmin) return;

    const senderId = teacherUserId;
    const receiverId = selectedAdmin.userId;
    const chatId = getChatId(senderId, receiverId);
    const timeStamp = Date.now();

    const message = {
      senderId,
      receiverId,
      type: "text",
      text: newMessageText,
      imageUrl: null,
      replyTo: null,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp,
    };

    try {
      await axios.post(`${RTDB_BASE}/Chats/${chatId}/messages.json`, message);
      await axios.patch(`${RTDB_BASE}/Chats/${chatId}.json`, {
        participants: { [senderId]: true, [receiverId]: true },
        lastMessage: { text: newMessageText, senderId, seen: false, timeStamp },
        unread: { [senderId]: 0, [receiverId]: 1 },
      });
      setNewMessageText("");
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  // ---------------- FETCH NOTIFICATIONS (ENRICHED WITH ADMIN INFO) ----------------
  
  // ---------------- FETCH NOTIFICATIONS (ENRICHED WITH ADMIN INFO) ----------------
   // ---------------- FETCH NOTIFICATIONS (ENRICHED WITH ADMIN INFO) ----------------
  useEffect(() => {
  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API_BASE}/get_posts`);
      let postsData = res.data || [];
      if (!Array.isArray(postsData) && typeof postsData === "object") {
        postsData = Object.values(postsData);
      }

      const [adminsRes, usersRes] = await Promise.all([
        axios.get(`${RTDB_BASE}/School_Admins.json`),
        axios.get(`${RTDB_BASE}/Users.json`),
      ]);
      const schoolAdmins = adminsRes.data || {};
      const users = usersRes.data || {};

      // Get teacher from localStorage so we know who's seen what
      const teacher = JSON.parse(localStorage.getItem("teacher"));
      const seenPosts = getSeenPosts(teacher?.userId);

      // ...resolveAdminInfo as before...

      const resolveAdminInfo = (post) => {
        const adminId = post.adminId || post.posterAdminId || post.poster || post.admin || null;
        // ...same as your code...
        if (adminId && schoolAdmins[adminId]) {
          const schoolAdminRec = schoolAdmins[adminId];
          const userKey = schoolAdminRec.userId;
          const userRec = users[userKey] || null;
          const name = (userRec && userRec.name) || schoolAdminRec.name || post.adminName || "Admin";
          const profile = (userRec && userRec.profileImage) || schoolAdminRec.profileImage || post.adminProfile || "/default-profile.png";
          return { name, profile };
        }
        return { name: post.adminName || "Admin", profile: post.adminProfile || "/default-profile.png" };
      };

      const latest = postsData
        .slice()
        .sort((a, b) => {
          const ta = a.time ? new Date(a.time).getTime() : 0;
          const tb = b.time ? new Date(b.time).getTime() : 0;
          return tb - ta;
        })
        // ONLY SHOW NOTIFICATIONS FOR UNSEEN POSTS
        .filter((post) => post.postId && !seenPosts.includes(post.postId))
        .slice(0, 5)
        .map((post) => {
          const info = resolveAdminInfo(post);
          return {
            id: post.postId,
            title: post.message?.substring(0, 50) || "Untitled post",
            adminName: info.name,
            adminProfile: info.profile,
          };
        });

      setNotifications(latest);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  fetchNotifications();
}, []);


// --- 3. Handler to remove notification after clicked (and mark seen) ---

const handleNotificationClick = (postId) => {
  if (!teacher || !postId) return;
  // Save to localStorage
  saveSeenPost(teacher.userId, postId);
  // Remove from UI right away
  setNotifications(prev => prev.filter((n) => n.id !== postId));
  setShowNotifications(false); // Optionally close the notification panel
};

function getSeenPosts(teacherId) {
  return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
}

function saveSeenPost(teacherId, postId) {
  const seen = getSeenPosts(teacherId);
  if (!seen.includes(postId)) {
    localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seen, postId]));
  }
}
  // ---------------- MESSENGER: fetch conversations with unread messages (same as Dashboard) ----------------
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

      // build maps
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
          const otherKeyCandidate = Object.keys(participants || {}).find((p) => p !== t.userId);
          if (!otherKeyCandidate) return null;

          let otherPushKey = otherKeyCandidate;
          let otherRecord = usersByKey[otherPushKey];

          if (!otherRecord) {
            const mapped = userKeyByUserId[otherKeyCandidate];
            if (mapped) {
              otherPushKey = mapped;
              otherRecord = usersByKey[mapped];
            }
          }

          if (!otherRecord) {
            otherRecord = { userId: otherKeyCandidate, name: otherKeyCandidate, profileImage: "/default-profile.png" };
          }

          const contact = {
            pushKey: otherPushKey,
            userId: otherRecord.userId || otherKeyCandidate,
            name: otherRecord.name || otherRecord.username || otherKeyCandidate,
            profileImage: otherRecord.profileImage || otherRecord.profile || "/default-profile.png",
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

  const handleMessengerToggle = async () => {
    setShowMessenger((s) => !s);
    await fetchConversations();
  };

  const handleOpenConversation = async (conv, index) => {
    if (!teacher || !conv) return;
    const { chatId, contact } = conv;

    // Navigate to AllChat with contact + chatId and indicate admin tab
    navigate("/all-chat", { state: { contact, chatId, tab: "admin" } });

    // Clear unread for this teacher in DB
    try {
      await axios.put(`${RTDB_BASE}/Chats/${chatId}/unread/${teacher.userId}.json`, null);
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }

    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };

  const totalUnreadMessages = conversations.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);

const [isPortrait, setIsPortrait] = React.useState(window.innerWidth < window.innerHeight);

React.useEffect(() => {
  const handleResize = () => {
    setIsPortrait(window.innerWidth < window.innerHeight);
  };

  // initialize
  handleResize();

  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);

const listShellWidth = isPortrait ? "92%" : "560px";

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredAdmins = admins.filter((a) => {
    if (!normalizedSearch) return true;
    const haystack = [
      a.name,
      a.username,
      a.email,
      a.adminId,
      a.userId,
      a.title,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedSearch);
  });




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
          active="admins"
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

        {/* MAIN */}
        <div style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", overflowX: "hidden", display: "flex", justifyContent: "flex-start", padding: "10px 20px 20px", boxSizing: "border-box" }}>
          <div
            className="admin-list-card-responsive"
            style={{
              width: listShellWidth,
              position: "relative",
              marginLeft: 0,
              marginRight: isPortrait ? 0 : "24px",
            }}
          >
            <style>{`
              @media (max-width: 600px) {
                .admin-list-card-responsive {
                  margin-left: -16px !important;
                  margin-right: auto !important;
                  width: 80vw !important;
                  max-width: 80vw !important;
                }
              }
            `}</style>
            <div className="section-header-card" style={{ marginBottom: 12 }}>
              <h2 className="section-header-card__title" style={{ fontSize: 20 }}>Admins</h2>
              <div className="section-header-card__meta">
                <span>Total: {filteredAdmins.length}</span>
                <span className="section-header-card__chip">Teacher View</span>
              </div>
            </div>

            {/* Search */}
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "10px" }}>
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
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
                  placeholder="Search admins..."
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    fontSize: 13,
                    background: "transparent",
                  }}
                />
              </div>
            </div>

            {loading && <p>Loading admins...</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filteredAdmins.map((a, idx) => (
                <AdminItem
                  key={a.adminId}
                  admin={a}
                  number={idx + 1}
                  selected={selectedAdmin?.adminId === a.adminId}
                  onClick={(admin) => {
                    setSelectedAdmin(admin);
                    setSelectedChatUser(admin);
                  }}
                />
              ))}
            </div>
          </div>

          {selectedAdmin ? (
            <>
              <div
                className="admin-sidebar-overlay"
                onClick={() => setSelectedAdmin(null)}
                style={{ display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 999 }}
              />

              <aside
                className="admin-sidebar"
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
                <button
                  onClick={() => setSelectedAdmin(null)}
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
                      src={selectedAdmin.profileImage || "/default-profile.png"}
                      alt={selectedAdmin.name}
                      onError={(event) => {
                        event.currentTarget.src = "/default-profile.png";
                      }}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 14, color: "#ffffff", fontWeight: 800 }}>{selectedAdmin.name}</h3>
                  <div style={{ color: "#dbeafe", marginTop: 6, fontSize: 10 }}>{selectedAdmin.username || selectedAdmin.email}</div>
                </div>

                <div style={{ display: "flex", marginBottom: "10px", borderBottom: "1px solid var(--border-soft)" }}>
                  {["details", "Plan", "Report"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setAdminTab(tab)}
                      style={{
                        flex: 1,
                        padding: "6px",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 10,
                        color: adminTab === tab ? "var(--accent-strong)" : "var(--text-muted)",
                        borderBottom: adminTab === tab ? "3px solid var(--accent-strong)" : "3px solid transparent",
                      }}
                    >
                      {tab.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div style={{ paddingBottom: 40 }}>
                  {adminTab === "details" && (
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
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            marginBottom: 6,
                            color: "var(--text-primary)",
                          }}
                        >
                          Administrator Details
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
                            ["Admin ID", selectedAdmin.adminId || selectedAdmin.userId],
                            ["Email", selectedAdmin.email],
                            ["Phone", selectedAdmin.phone],
                            ["Gender", selectedAdmin.gender ? (selectedAdmin.gender.charAt(0).toUpperCase() + selectedAdmin.gender.slice(1)) : null],
                            ["Title", selectedAdmin.title],
                            ["Status", selectedAdmin.status ? (selectedAdmin.status.charAt(0).toUpperCase() + selectedAdmin.status.slice(1)) : null],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              style={{
                                padding: 8,
                                borderRadius: 10,
                                background: "var(--surface-panel)",
                                border: "1px solid var(--border-soft)",
                                boxShadow: "none",
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
                                {value || "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {adminTab === "Plan" && (
                    <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, boxShadow: "var(--shadow-soft)", padding: 12 }}>
                      <p>Plan data here.</p>
                    </div>
                  )}
                  {adminTab === "Report" && (
                    <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, boxShadow: "var(--shadow-soft)", padding: 12 }}>
                      <p>Report data here.</p>
                    </div>
                  )}
                </div>

                {!adminChatOpen && selectedAdmin && (
                  <div
                    onClick={() => setAdminChatOpen(true)}
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
                      <span style={{ fontWeight: 800, fontSize: 13 }}>Admin Chat</span>
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
                      A
                    </span>
                  </div>
                )}

                {adminChatOpen && selectedAdmin && teacher && (
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
                      <strong>{selectedAdmin.name}</strong>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          onClick={() => {
                            setAdminChatOpen(false);
                            navigate("/all-chat", { state: { contact: selectedAdmin, tab: "admin" } });
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}
                        >
                          ⤢
                        </button>
                        <button onClick={() => setAdminChatOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>
                          ×
                        </button>
                      </div>
                    </div>

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
                        <p style={{ textAlign: "center", color: "#aaa" }}>Start chatting with {selectedAdmin.name}</p>
                      ) : (
                        messages.map((m) => (
                          <div key={m.id} style={{ display: "flex", flexDirection: m.isTeacher ? "row-reverse" : "row", alignItems: "flex-end", marginBottom: 10 }}>
                            <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: m.isTeacher ? "flex-end" : "flex-start" }}>
                              <div
                                style={{
                                  background: m.isTeacher ? "#4b6cb7" : "#fff",
                                  color: m.isTeacher ? "#fff" : "#0f172a",
                                  padding: "10px 14px",
                                  borderRadius: 18,
                                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                                  wordBreak: "break-word",
                                  position: "relative",
                                  paddingBottom: "26px",
                                }}
                              >
                                <div>{m.text}</div>
                                <div style={{ position: "absolute", right: 8, bottom: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: m.isTeacher ? "rgba(255,255,255,0.9)" : "#64748b" }}>
                                  <span style={{ fontSize: 11 }}>{formatTime(m.timeStamp)}</span>
                                  {m.isTeacher && <FaCheck size={12} color={m.seen ? "#10b981" : "#94a3b8"} />}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>

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
                          if (e.key === "Enter") sendMessage();
                        }}
                      />
                      <button
                        onClick={sendMessage}
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

                <style>{`
                  @media (max-width: 900px), (orientation: portrait) {
                    .admin-sidebar { width: 100vw !important; height: 100vh !important; left: 0 !important; top: 0 !important; border-radius: 0 !important; padding: 14px !important; }
                    .admin-sidebar-overlay { display: block !important; }
                    body.sidebar-open { overflow: hidden !important; }
                  }
                `}</style>
              </aside>
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
                  Admin Details
                </h3>
                <p style={{ margin: "8px 0 0", color: "var(--text-muted)", fontSize: 11, lineHeight: 1.5 }}>
                  Select an admin from the list to view details, plan, report, and chat.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPage;

