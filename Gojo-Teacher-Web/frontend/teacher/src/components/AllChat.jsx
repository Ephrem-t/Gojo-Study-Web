import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaPaperPlane, FaCheck } from "react-icons/fa";
import { ref, onValue, push, runTransaction, update } from "firebase/database";
import { db, schoolPath } from "../firebase";
import { getRtdbRoot } from "../api/rtdbScope";

// NOTE: This codebase uses two chat-key conventions:
// - Students/Parents: teacherUserId_otherUserId (teacher first)
// - Admins: [id1,id2].sort().join('_')
const teacherFirstChatId = (teacherUserId, otherUserId) => {
  const t = String(teacherUserId || "").trim();
  const o = String(otherUserId || "").trim();
  return `${t}_${o}`;
};

const sortedChatId = (id1, id2) => {
  const a = String(id1 || "").trim();
  const b = String(id2 || "").trim();
  return [a, b].sort().join("_");
};

const normalizeTab = (tab) => {
  const t = String(tab || "").toLowerCase();
  if (t === "student" || t === "students") return "student";
  if (t === "parent" || t === "parents") return "parent";
  if (t === "admin" || t === "admins") return "admin";
  return null;
};

const getChatIdForTab = (tab, teacherUserId, otherUserId) => {
  const normalized = normalizeTab(tab) || "student";
  return normalized === "admin"
    ? sortedChatId(teacherUserId, otherUserId)
    : teacherFirstChatId(teacherUserId, otherUserId);
};

const RTDB_BASE = getRtdbRoot();

/* ================= FIREBASE ================= */

export default function TeacherAllChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const chatEndRef = useRef(null);

  const teacher = JSON.parse(localStorage.getItem("teacher")) || {};
  const teacherUserId = String(teacher.userId || "");

  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [presence, setPresence] = useState({}); // userId -> presence info (bool or object)
  const [isMobile, setIsMobile] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({}); // userId -> number

  // incoming navigation state (support both { contact } and { user })
  const locationState = location.state || {};
  const incomingContact = locationState.contact || locationState.user || null;
  const incomingChatId = locationState.chatId || null;
  const incomingTab = locationState.tab || null;

  const [selectedTab, setSelectedTab] = useState(normalizeTab(incomingTab) || "student");
  const [selectedChatUser, setSelectedChatUser] = useState(incomingContact || null);
  // Always compute chat key from teacher + selected receiver.
  const [currentChatKey, setCurrentChatKey] = useState(null);

  const [clickedMessageId, setClickedMessageId] = useState(null);
  const [editingMessages, setEditingMessages] = useState({}); // { messageId: true/false }

  const getProfileImage = (user = {}) =>
    user.profileImage || user.profile || user.avatar || "/default-profile.png";

  /* ================= FETCH USERS ================= */
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [studentsRes, parentsRes, adminsRes, usersRes] = await Promise.all([
          fetch(`${RTDB_BASE}/Students.json`).then((r) => r.json()),
          fetch(`${RTDB_BASE}/Parents.json`).then((r) => r.json()),
          fetch(`${RTDB_BASE}/School_Admins.json`).then((r) => r.json()),
          fetch(`${RTDB_BASE}/Users.json`).then((r) => r.json()),
        ]);

        const users = usersRes || {};

        const allStudents = Object.values(studentsRes || {}).map((s) => {
          const u = users[s.userId] || {};
          return { userId: s.userId, name: u.name || s.name || "Student", profileImage: getProfileImage(u) };
        });

        const allParents = Object.values(parentsRes || {}).map((p) => {
          const u = users[p.userId] || {};
          return { userId: p.userId, name: u.name || p.name || "Parent", profileImage: getProfileImage(u) };
        });

        const allAdmins = Object.values(adminsRes || {}).map((a) => {
          const u = users[a.userId] || {};
          return { userId: a.userId, name: a.name || u.name || "Admin", profileImage: getProfileImage(u) };
        });

        setStudents(allStudents);
        setParents(allParents);
        setAdmins(allAdmins);
      } catch (err) {
        console.error("❌ Fetch error:", err);
      }
    };

    fetchUsers();
  }, []);

  /* ================= UNREAD COUNTS LISTENERS ================= */
  useEffect(() => {
    if (!teacherUserId) return;

    const unsubscribers = [];

    const attachUnreadListener = (tab, u) => {
      if (!u || !u.userId) return;
      const chatKey = getChatIdForTab(tab, teacherUserId, u.userId);
      const unreadRef = ref(db, schoolPath(`Chats/${chatKey}/unread/${teacherUserId}`));
      const unsub = onValue(unreadRef, (snap) => {
        const val = snap.val();
        setUnreadCounts((prev) => ({ ...prev, [u.userId]: Number(val) || 0 }));
      });
      unsubscribers.push(unsub);
    };

    students.forEach((s) => attachUnreadListener("student", s));
    parents.forEach((p) => attachUnreadListener("parent", p));
    admins.forEach((a) => attachUnreadListener("admin", a));

    return () => unsubscribers.forEach((u) => u());
  }, [students, parents, admins, teacherUserId]);

  // responsive: detect mobile and auto-collapse sidebar
  useEffect(() => {
    const handleResize = () => {
      const mobile = typeof window !== "undefined" && window.innerWidth < 640;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* ================= AUTO SELECT ================= */
  // If navigation provided a contact, prefer it (incomingContact)
  useEffect(() => {
    if (incomingContact) {
      setSelectedChatUser(incomingContact);
    }
    if (incomingTab) {
      setSelectedTab(normalizeTab(incomingTab) || "student");
    }
    if (incomingChatId) {
      setCurrentChatKey(String(incomingChatId));
      return;
    }
    if (teacherUserId && incomingContact?.userId) {
      const tabForNav = normalizeTab(incomingTab) || "student";
      setCurrentChatKey(getChatIdForTab(tabForNav, teacherUserId, incomingContact.userId));
    } else {
      setCurrentChatKey(null);
    }
  }, [incomingContact, incomingChatId, incomingTab, teacherUserId]);

  // When lists load and no explicit selectedChatUser, auto-pick first item for tab
  // Remove auto-select: user must manually choose who to chat with

  // If navigation gave a user and lists are ready, find the matching entry and select it
  useEffect(() => {
    const incoming = incomingContact;
    if (!incoming) return;
    if (selectedTab === "student" && students.length) {
      const found = students.find((s) => s.userId === incoming.userId);
      if (found) setSelectedChatUser(found);
    }
    if (selectedTab === "parent" && parents.length) {
      const found = parents.find((p) => p.userId === incoming.userId);
      if (found) setSelectedChatUser(found);
    }
    if (selectedTab === "admin" && admins.length) {
      const found = admins.find((a) => a.userId === incoming.userId);
      if (found) setSelectedChatUser(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, parents, admins, incomingContact, selectedTab]);

  /* ================= CHAT LISTENER ================= */
  useEffect(() => {
    if (!selectedChatUser || !teacherUserId) return;

    const chatKey =
      currentChatKey ||
      getChatIdForTab(normalizeTab(selectedTab) || "student", teacherUserId, selectedChatUser.userId);
    setCurrentChatKey(chatKey); // ensure state is in sync

    const chatRef = ref(db, schoolPath(`Chats/${chatKey}/messages`));
    const unsubscribe = onValue(chatRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .filter(([_, m]) => !m.deleted)
        .map(([id, m]) => ({
          id,
          ...m,
          isTeacher: m.senderId === teacherUserId,
        }))
        .sort((a, b) => a.timeStamp - b.timeStamp);

      setMessages(list);

      // mark as seen where teacher is receiver
      Object.entries(data).forEach(([id, m]) => {
        if (m && !m.seen && m.receiverId === teacherUserId) {
          update(ref(db, schoolPath(`Chats/${chatKey}/messages/${id}`)), { seen: true }).catch(console.error);
        }
      });

      // reset unread count for this teacher
      update(ref(db, schoolPath(`Chats/${chatKey}/unread`)), { [teacherUserId]: 0 }).catch(console.error);
    });

    return () => unsubscribe();
  }, [selectedChatUser, teacherUserId, currentChatKey]);

  const getActiveChatKey = () => {
    if (!selectedChatUser || !teacherUserId) return null;
    return (
      currentChatKey ||
      getChatIdForTab(normalizeTab(selectedTab) || "student", teacherUserId, selectedChatUser.userId)
    );
  };

  /* ================= PRESENCE LISTENER ================= */
  useEffect(() => {
    // Listen to presence node in RTDB. If your backend uses a different path, change it.
    try {
      const presenceRef = ref(db, schoolPath(`Presence`));
      const unsub = onValue(presenceRef, (snap) => {
        const data = snap.val() || {};
        setPresence(data);
      });

      return () => unsub();
    } catch (e) {
      // If realtime presence isn't configured, keep presence empty
      console.warn("Presence listener unavailable:", e);
    }
  }, []);

  /* ================= SEND MESSAGE ================= */
  const sendMessage = async () => {
    if (!input.trim() || !selectedChatUser) return;

    const editingId = Object.keys(editingMessages).find((id) => editingMessages[id]);
    const chatKey = getActiveChatKey();
    if (!chatKey) return;

    if (editingId) {
      // Update existing message
      await update(ref(db, schoolPath(`Chats/${chatKey}/messages/${editingId}`)), {
        text: input,
        edited: true,
      });
      setEditingMessages({});
      setClickedMessageId(null);
      setInput("");
    } else {
      // Send new message
      const messagesRef = ref(db, schoolPath(`Chats/${chatKey}/messages`));
      const messageData = {
        senderId: teacherUserId,
        receiverId: selectedChatUser.userId,
        type: "text",
        text: input,
        seen: false,
        edited: false,
        deleted: false,
        timeStamp: Date.now(),
      };

      await push(messagesRef, messageData);

      await update(ref(db, schoolPath(`Chats/${chatKey}/participants`)), {
        [teacherUserId]: true,
        [selectedChatUser.userId]: true,
      });

      await update(ref(db, schoolPath(`Chats/${chatKey}/lastMessage`)), {
        text: input,
        senderId: teacherUserId,
        seen: false,
        timeStamp: messageData.timeStamp,
      });

      // increment unread for receiver
      try {
        await update(ref(db, schoolPath(`Chats/${chatKey}/unread`)), { [teacherUserId]: 0 });
        await runTransaction(
          ref(db, schoolPath(`Chats/${chatKey}/unread/${selectedChatUser.userId}`)),
          (current) => (Number(current) || 0) + 1
        );
      } catch (e) {
        // ignore
      }

      setInput("");
    }
  };

  /* ================= EDIT / DELETE ================= */
  const handleEditMessage = (id, newText) => {
    const chatKey = getActiveChatKey();
    if (!chatKey) return;
    update(ref(db, schoolPath(`Chats/${chatKey}/messages/${id}`)), {
      text: newText,
      edited: true,
    }).catch(console.error);
    setEditingMessages((prev) => ({ ...prev, [id]: false }));
  };

  const handleDeleteMessage = (id) => {
    const chatKey = getActiveChatKey();
    if (!chatKey) return;
    update(ref(db, schoolPath(`Chats/${chatKey}/messages/${id}`)), { deleted: true }).catch(console.error);
  };

  const startEditing = (id, text) => {
    setEditingMessages({ [id]: true });
    setInput(text);
    setClickedMessageId(id);
  };

  const formatTime = (ts) => {
    const date = new Date(ts);
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const list = selectedTab === "student" ? students : selectedTab === "parent" ? parents : admins;

  const isUserOnline = (userId) => {
    if (!userId) return false;
    // try to resolve presence entry for multiple key shapes
    const findPresence = () => {
      // direct key
      if (presence?.[userId] !== undefined) return presence[userId];
      // string form
      const s = String(userId);
      if (presence?.[s] !== undefined) return presence[s];
      // try numeric key
      const n = Number(userId);
      if (!Number.isNaN(n) && presence?.[n] !== undefined) return presence[n];
      // try to find an entry where entry.userId matches
      for (const [, val] of Object.entries(presence || {})) {
        try {
          if (val && (val.userId === userId || String(val.userId) === s)) return val;
        } catch (e) {
          // ignore
        }
      }
      return undefined;
    };

    const p = findPresence();
    if (p == null) return false;
    if (typeof p === 'boolean') return p === true;
    if (typeof p === 'object') {
      if (p.state === 'online' || p.online === true) return true;
      if (p.lastSeen) {
        const last = Number(p.lastSeen) || 0;
        return Date.now() - last < 60_000;
      }
      // if presence value itself is a timestamp
      if (typeof p === 'number') {
        return Date.now() - p < 60_000;
      }
    }
    return false;
  };

  const getLastSeenText = (userId) => {
    const p = presence?.[userId];
    if (!p) return null;
    // accept numeric timestamp or object with common timestamp keys
    let ts = null;
    if (typeof p === 'number' || /^[0-9]+$/.test(String(p))) ts = Number(p);
    if (typeof p === 'object') ts = p.lastSeen || p.timestamp || p.lastActive || p.last_seen || p.time || null;
    if (!ts) return null;
    const diff = Date.now() - Number(ts);
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'last seen just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `last seen ${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `last seen ${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `last seen ${days}d ago`;
    return `last seen on ${new Date(ts).toLocaleDateString()}`;
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100dvh - var(--topbar-height, 0px))', marginTop: 'var(--topbar-height, 0px)', background: 'radial-gradient(circle at top right, rgba(59, 130, 246, 0.16), transparent 38%), linear-gradient(180deg, #f6f9ff 0%, #eef4ff 100%)', fontFamily: 'Inter, sans-serif', position: 'relative', padding: isMobile ? 0 : 14, gap: isMobile ? 0 : 12 }}>
      {/* ===== SIDEBAR / USER LIST ===== */}
      <div
        style={{
          display:
            isMobile && !selectedChatUser
              ? 'flex'
              : isMobile && selectedChatUser
              ? 'none'
              : 'flex',
          alignItems: 'stretch',
          position: isMobile && !selectedChatUser ? 'fixed' : 'static',
          top: isMobile && !selectedChatUser ? 'var(--topbar-height, 0px)' : 0,
          left: 0,
          width: isMobile && !selectedChatUser ? '100vw' : undefined,
          height: isMobile && !selectedChatUser ? 'calc(100dvh - var(--topbar-height, 0px))' : undefined,
          background: isMobile && !selectedChatUser ? '#fff' : undefined,
          zIndex: isMobile && !selectedChatUser ? 100 : undefined,
        }}
      >
        <div
          style={{
            width: isMobile && !selectedChatUser ? '100vw' : sidebarOpen ? (isMobile ? 220 : 280) : 0,
            height: isMobile && !selectedChatUser ? 'calc(100dvh - var(--topbar-height, 0px))' : 'auto',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
            padding: sidebarOpen || (isMobile && !selectedChatUser) ? 16 : 0,
            boxShadow: sidebarOpen || (isMobile && !selectedChatUser) ? '0 16px 30px rgba(15, 23, 42, 0.12)' : 'none',
            border: sidebarOpen || (isMobile && !selectedChatUser) ? '1px solid rgba(191, 219, 254, 0.9)' : 'none',
            borderRadius: isMobile ? 0 : 14,
            display: sidebarOpen || (isMobile && !selectedChatUser) ? 'flex' : 'none',
            flexDirection: 'column',
            transition: 'width 180ms ease',
            overflowY: isMobile && !selectedChatUser ? 'auto' : 'visible',
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button onClick={() => navigate(-1)} style={{ border: "1px solid #bfdbfe", background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)", padding: 6, cursor: "pointer", borderRadius: 999, color: "#1e40af", boxShadow: "0 8px 16px rgba(30, 64, 175, 0.15)" }}>
              <FaArrowLeft size={18} />
            </button>
          <div style={{ display: "flex", gap: 6, margin: "12px 0", alignItems: "center", background: "#ffffff", border: "1px solid #dbeafe", borderRadius: 999, padding: 4, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 14px rgba(15,23,42,0.05)" }}>
            {["student", "parent", "admin"].map((t) => (
              <button
                key={t}
                onClick={() => {
                  setSelectedTab(t);
                  setSelectedChatUser(null);
                  setCurrentChatKey(null);
                }}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: 20,
                  border: "none",
                  background: selectedTab === t ? "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)" : "transparent",
                  color: selectedTab === t ? "#fff" : "#475569",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 800,
                  boxShadow: selectedTab === t ? "0 8px 16px rgba(37,99,235,0.25)" : "none",
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
            </div>
          </div>

          <div style={{ marginTop: 8, overflowY: "auto", flex: 1 }}>
            {list.map((u) => (
              <div
                key={u.userId}
                onClick={() => {
                  setSelectedChatUser(u);
                  setCurrentChatKey(null); // compute chat key automatically for selected pair
                  if (isMobile) setSidebarOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: isMobile ? 18 : 10,
                  borderRadius: 14,
                  cursor: 'pointer',
                  marginBottom: 8,
                  background: selectedChatUser?.userId === u.userId ? 'linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)' : '#ffffff',
                  border: selectedChatUser?.userId === u.userId ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                  boxShadow: selectedChatUser?.userId === u.userId ? '0 10px 20px rgba(37, 99, 235, 0.20)' : '0 4px 10px rgba(15,23,42,0.05)',
                  fontSize: isMobile ? 18 : 15,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={u.profileImage}
                      alt={u.name}
                      onError={(e) => (e.target.src = "/default-profile.png")}
                      style={{ width: isMobile ? 36 : 40, height: isMobile ? 36 : 40, borderRadius: "50%", objectFit: "cover", border: '2px solid #ffffff', boxShadow: '0 4px 10px rgba(15,23,42,0.12)' }}
                    />
                    {/* online dot */}
                    <span style={{
                      position: 'absolute',
                      right: -2,
                      bottom: -2,
                      width: 12,
                      height: 12,
                      borderRadius: 12,
                      border: '2px solid #fff',
                      background: isUserOnline(u.userId) ? '#34D399' : '#cbd5e1'
                    }} />
                  </div>
                  <span style={{ fontWeight: 500, marginLeft: 0 }}>{u.name}</span>
                </div>

                {/* unread badge */}
                {unreadCounts[u.userId] > 0 ? (
                  <div style={{ minWidth: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', color: '#fff', borderRadius: 14, padding: '0 6px', fontSize: 12, fontWeight: 600 }}>
                    {unreadCounts[u.userId] > 99 ? '99+' : unreadCounts[u.userId]}
                  </div>
                ) : (
                  <div style={{ width: 26 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* small toggle bar visible when sidebar is closed */}
        <div style={{ width: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
          <button onClick={() => setSidebarOpen((s) => !s)} style={{ border: '1px solid #bfdbfe', background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)', borderRadius: 10, padding: 4, boxShadow: '0 8px 16px rgba(15, 23, 42, 0.12)', cursor: 'pointer', marginTop: 8, color: '#1e40af' }} aria-label="Toggle sidebar">
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>
      </div>

      {/* ===== CHAT ===== */}
      <div style={{ flex: 1, padding: isMobile ? 10 : 14, display: "flex", flexDirection: "column", background: 'linear-gradient(180deg, #ffffff 0%, #f9fbff 100%)', border: '1px solid #dbeafe', borderRadius: isMobile ? 0 : 16, boxShadow: '0 16px 30px rgba(15, 23, 42, 0.10)' }}>
        {selectedChatUser ? (
          <>
            {/* ===== CHAT HEADER ===== */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderBottom: "1px solid #e2e8f0",
                boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
                background: "linear-gradient(180deg, #ffffff 0%, #f1f5ff 100%)",
                borderRadius: 10,
                marginBottom: 8,
              }}
            >
              {isMobile && (
                <button
                  onClick={() => setSelectedChatUser(null)}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: 4,
                    marginRight: 8,
                    cursor: 'pointer',
                    fontSize: 20,
                  }}
                  aria-label="Back to user list"
                >
                  <FaArrowLeft size={22} />
                </button>
              )}
              <img
                src={selectedChatUser.profileImage}
                alt={selectedChatUser.name}
                onError={(e) => (e.target.src = "/default-profile.png")}
                style={{ width: isMobile ? 40 : 50, height: isMobile ? 40 : 50, borderRadius: "50%", objectFit: "cover", border: '2px solid #ffffff', boxShadow: '0 4px 10px rgba(15,23,42,0.12)' }}
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{selectedChatUser.name}</span>
                <span style={{ fontSize: 12, color: isUserOnline(selectedChatUser.userId) ? '#16A34A' : '#666' }}>
                  {isUserOnline(selectedChatUser.userId) ? 'Online' : (getLastSeenText(selectedChatUser.userId) || (selectedTab.charAt(0).toUpperCase() + selectedTab.slice(1)))}
                </span>
              </div>
            </div>

            {/* ===== CHAT MESSAGES ===== */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", background: 'linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              {messages.map((m) => {
                const isTeacher = m.isTeacher;
                const isEditing = !!editingMessages[m.id];
                const isClicked = clickedMessageId === m.id;

                return (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isTeacher ? "flex-end" : "flex-start", marginBottom: 10 }}>
                    <div
                      onClick={() => setClickedMessageId(m.id)}
                      style={{
                        maxWidth: isMobile ? "85%" : "70%",
                        background: isTeacher ? "linear-gradient(135deg, #1d4ed8, #2563eb 55%, #3b82f6)" : "#ffffff",
                        color: isTeacher ? "#fff" : "#0f172a",
                        padding: "10px 14px",
                        borderRadius: 18,
                        borderTopRightRadius: isTeacher ? 0 : 18,
                        borderTopLeftRadius: isTeacher ? 18 : 0,
                        boxShadow: isTeacher ? "0 10px 18px rgba(37, 99, 235, 0.28)" : "0 6px 12px rgba(15, 23, 42, 0.10)",
                        border: isTeacher ? "none" : "1px solid #e2e8f0",
                        wordBreak: "break-word",
                        cursor: "pointer",
                        position: "relative",
                      }}
                    >
                      {m.text} {m.edited && <small style={{ fontSize: 10 }}> (edited)</small>}

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 4, fontSize: 11, color: isTeacher ? "#fff" : "#888" }}>
                        <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>{formatDateLabel(m.timeStamp)}</span>
                        <span>{formatTime(m.timeStamp)}</span>
                      {isTeacher && !m.deleted && (
  <span style={{ display: "flex", gap: 0 }}>
    <FaCheck size={10} color="#fff" style={{ opacity: 0.8 }} />
    {m.seen && <FaCheck size={10} color="#f3f7f8" style={{ marginLeft: 2, opacity: 0.95 }} />}
  </span>
)}
                      </div>
                    </div>

                    {/* Edit/Delete controls for teacher's message */}
                    {isClicked && isTeacher && !m.deleted && !isEditing && (
                      <div style={{ display: "flex", gap: 6, marginTop: 4, fontSize: 12, justifyContent: isTeacher ? "flex-end" : "flex-start" }}>
                        <button onClick={() => startEditing(m.id, m.text)} style={{ padding: "3px 8px", borderRadius: 999, border: "1px solid #cbd5e1", cursor: "pointer", background: "#f8fafc", color: "#334155", fontWeight: 600 }}>Edit</button>
                        <button onClick={() => handleDeleteMessage(m.id)} style={{ padding: "3px 8px", borderRadius: 999, border: "1px solid #fecaca", cursor: "pointer", background: "#fef2f2", color: "#b91c1c", fontWeight: 600 }}>Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* ===== INPUT ===== */}
            <div style={{ display: "flex", gap: 8, marginTop: 10, padding: 8, borderRadius: 12, background: "#ffffff", border: "1px solid #dbeafe", boxShadow: "0 8px 18px rgba(15,23,42,0.08)" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message..."
                style={{ flex: 1, padding: isMobile ? 10 : 12, borderRadius: 999, border: "1px solid #cbd5e1", outline: "none", background: "#f8fafc", boxShadow: "inset 0 1px 2px rgba(15,23,42,0.06)" }}
              />
              <button onClick={sendMessage} style={{ width: isMobile ? 40 : 45, height: isMobile ? 40 : 45, borderRadius: "50%", background: "linear-gradient(135deg, #1d4ed8, #2563eb 60%, #3b82f6)", border: "none", color: "#fff", display: "flex", justifyContent: "center", alignItems: "center", boxShadow: "0 10px 22px rgba(37, 99, 235, 0.32)" }}>
                <FaPaperPlane />
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: "grid", placeItems: "center", flex: 1 }}>
            <div style={{ textAlign: "center", padding: 24, borderRadius: 16, border: "1px solid #dbeafe", background: "linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)", boxShadow: "0 14px 28px rgba(15,23,42,0.10)" }}>
              <h3 style={{ margin: 0, color: "#0f172a" }}>Select a user to start chatting 💬</h3>
              <div style={{ marginTop: 8, color: "#475569", fontSize: 13 }}>Choose a student, parent, or admin from the left panel.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

