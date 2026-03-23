import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPaperPlane, FaCheck } from "react-icons/fa";
import { getDatabase, ref, onValue, push, set, update, get } from "firebase/database";
import { db } from "../firebase";
import "../styles/global.css";

const RTDB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";

function AllChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem("admin")) || {};
  const adminUserId = admin.userId;
  const schoolCode = String(
    admin.schoolCode ||
      (() => {
        try {
          const stored = JSON.parse(localStorage.getItem("gojo_admin") || "{}");
          return stored?.schoolCode || "";
        } catch {
          return "";
        }
      })()
  ).trim();

  const SCHOOL_DB_ROOT = schoolCode
    ? `${RTDB_BASE}/Platform1/Schools/${encodeURIComponent(schoolCode)}`
    : RTDB_BASE;
  const SCHOOL_NODE_PREFIX = schoolCode ? `Platform1/Schools/${schoolCode}` : "";
  const chatsNodePath = SCHOOL_NODE_PREFIX ? `${SCHOOL_NODE_PREFIX}/Chats` : "Chats";
  const usersNodePath = SCHOOL_NODE_PREFIX ? `${SCHOOL_NODE_PREFIX}/Users` : "Users";

  const getChatKey = (a, b) => [a, b].sort().join("_");

  const { userId, userType, name, profileImage } = location.state || {};
  const passedUser = location.state?.user || null;

  // State
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [selectedTab, setSelectedTab] = useState("teacher");
  const [selectedChatUser, setSelectedChatUser] = useState(passedUser);
  const [popupMessages, setPopupMessages] = useState([]);
  const [popupInput, setPopupInput] = useState("");
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [typing, setTyping] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChatKey, setActiveChatKey] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const chatEndRef = useRef(null);
  const typingRef = useRef(null);

  const resolveChatRefKey = async (otherUserId) => {
    if (!otherUserId || !adminUserId) return "";
    const sortedKey = getChatKey(adminUserId, otherUserId);
    const directKey = `${adminUserId}_${otherUserId}`;
    const reverseKey = `${otherUserId}_${adminUserId}`;
    const candidates = Array.from(new Set([sortedKey, directKey, reverseKey]));

    for (const key of candidates) {
      const snap = await get(ref(db, `${chatsNodePath}/${key}/messages`));
      if (snap.exists()) return key;
    }
    return sortedKey;
  };

  // ------------------- Fetch users with unread badge -------------------
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [teachersRes, studentsRes, parentsRes, usersRes, chatsRes] = await Promise.all([
          fetch(`${SCHOOL_DB_ROOT}/Teachers.json`).then(res => res.json()),
          fetch(`${SCHOOL_DB_ROOT}/Students.json`).then(res => res.json()),
          fetch(`${SCHOOL_DB_ROOT}/Parents.json`).then(res => res.json()),
          fetch(`${SCHOOL_DB_ROOT}/Users.json`).then(res => res.json()),
          fetch(`${SCHOOL_DB_ROOT}/Chats.json`).then(res => res.json())
        ]);

        const usersData = usersRes || {};
        const chatsData = chatsRes || {};

        const formatUsers = (listData) =>
          Object.keys(listData || {}).map(id => {
            const userId = listData[id].userId;
            const user = usersData[userId] || {};
            const chatKey = getChatKey(adminUserId, userId);
            const unread = chatsData[chatKey]?.unread?.[adminUserId] || 0;
            const lastMsg = chatsData[chatKey]?.lastMessage || null;

            return {
              id,
              userId,
              name: user.name || "No Name",
              profileImage: user.profileImage || "/default-profile.png",
              lastMsgTime: lastMsg?.timeStamp || 0,
              lastMsgText: lastMsg?.text || "",
              lastSeen: user.lastSeen || null,
              unread,
            };
          }).sort((a, b) => b.lastMsgTime - a.lastMsgTime);

        setTeachers(formatUsers(teachersRes));
        setStudents(formatUsers(studentsRes));
        setParents(formatUsers(parentsRes));
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };

    fetchUsers();
  }, [adminUserId, SCHOOL_DB_ROOT]);

  // ------------------- Select default user -------------------
  useEffect(() => {
    if (!selectedChatUser) {
      const firstUser = teachers[0] || students[0] || parents[0] || null;
      setSelectedChatUser(firstUser);
    }
  }, [teachers, students, parents]);

  // ------------------- Real-time messages -------------------
  useEffect(() => {
    if (!selectedChatUser || !adminUserId) return;

    let isCancelled = false;
    let unsubscribeMessages = null;
    let unsubscribeTyping = null;
    let unsubscribeLastSeen = null;

    const dbCheck = async () => {
      const chatKey = await resolveChatRefKey(selectedChatUser.userId);
      if (!chatKey || isCancelled) return;

      setActiveChatKey(chatKey);

      const dbInst = getDatabase();
      const messagesRef = ref(dbInst, `${chatsNodePath}/${chatKey}/messages`);
      const typingRefDB = ref(dbInst, `${chatsNodePath}/${chatKey}/typing`);
      const lastSeenRef = ref(dbInst, `${usersNodePath}/${selectedChatUser.userId}/lastSeen`);

      unsubscribeMessages = onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        const msgs = data
          ? Object.entries(data).map(([id, m]) => ({ ...m, id, sender: m.senderId === adminUserId ? "admin" : "user" }))
          : [];
        setPopupMessages(msgs.sort((a, b) => a.timeStamp - b.timeStamp));
      });

      unsubscribeTyping = onValue(typingRefDB, (snapshot) => {
        const val = snapshot.val();
        setTyping(selectedChatUser.userId === val?.userId);
      });

      unsubscribeLastSeen = onValue(lastSeenRef, (snapshot) => {
        setLastSeen(snapshot.val());
      });
    };

    dbCheck();

    return () => {
      isCancelled = true;
      if (typeof unsubscribeMessages === "function") unsubscribeMessages();
      if (typeof unsubscribeTyping === "function") unsubscribeTyping();
      if (typeof unsubscribeLastSeen === "function") unsubscribeLastSeen();
    };
  }, [selectedChatUser, adminUserId, chatsNodePath, usersNodePath]);

  // ------------------- Send/Edit message -------------------
  const sendPopupMessage = async () => {
    if (!popupInput.trim() || !selectedChatUser) return;

    const chatRefKey = activeChatKey || await resolveChatRefKey(selectedChatUser.userId);
    if (!chatRefKey) return;

    const messagesRef = ref(db, `${chatsNodePath}/${chatRefKey}/messages`);
    const chatRef = ref(db, `${chatsNodePath}/${chatRefKey}`);

    const newMsg = {
      senderId: adminUserId,
      receiverId: selectedChatUser.userId,
      type: "text",
      text: popupInput,
      imageUrl: null,
      replyTo: null,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp: Date.now()
    };

    if (editingMsgId) {
      await update(ref(db, `${chatsNodePath}/${chatRefKey}/messages/${editingMsgId}`), { text: popupInput, edited: true });
      setEditingMsgId(null);
    } else {
      const msgRef = push(messagesRef);
      await set(msgRef, newMsg);

      await update(chatRef, {
        lastMessage: { ...newMsg, messageId: msgRef.key },
        participants: { [adminUserId]: true, [selectedChatUser.userId]: true },
        unread: { [adminUserId]: 0, [selectedChatUser.userId]: (selectedChatUser.unread || 0) + 1 }
      });
    }

    setPopupInput("");
  };

  // ------------------- Delete message -------------------
  const deleteMessage = async (msgId) => {
    if (!selectedChatUser) return;
    const chatRefKey = activeChatKey || await resolveChatRefKey(selectedChatUser.userId);
    if (!chatRefKey) return;
    const msgRef = ref(db, `${chatsNodePath}/${chatRefKey}/messages/${msgId}`);
    await update(msgRef, { deleted: true });

    // Update lastMessage if deleted
    const lastMsgSnapshot = await get(ref(db, `${chatsNodePath}/${chatRefKey}/lastMessage`));
    if (lastMsgSnapshot.exists() && lastMsgSnapshot.val().messageId === msgId) {
      const messagesSnapshot = await get(ref(db, `${chatsNodePath}/${chatRefKey}/messages`));
      const messages = messagesSnapshot.exists() ? Object.entries(messagesSnapshot.val()).map(([id, m]) => ({ ...m, id })) : [];
      const lastMsg = messages.filter(m => !m.deleted).sort((a, b) => b.timeStamp - a.timeStamp)[0] || null;
      await update(ref(db, `${chatsNodePath}/${chatRefKey}`), { lastMessage: lastMsg ? { ...lastMsg, messageId: lastMsg.id } : null });
    }
  };

  // ------------------- Typing -------------------
  const handleTyping = async (e) => {
    setPopupInput(e.target.value);
    if (!selectedChatUser) return;

    const chatRefKey = activeChatKey || await resolveChatRefKey(selectedChatUser.userId);
    if (!chatRefKey) return;

    const typingRefDB = ref(db, `${chatsNodePath}/${chatRefKey}/typing`);
    await set(typingRefDB, { userId: adminUserId });

    if (typingRef.current) clearTimeout(typingRef.current);
    typingRef.current = setTimeout(async () => {
      await set(typingRefDB, { userId: null });
    }, 2000);
  };

  // ------------------- Scroll to bottom -------------------
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [popupMessages, typing]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = typeof window !== "undefined" && window.innerWidth < 640;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
      if (!mobile) setSidebarOpen(true);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    return new Date(Number(timestamp)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateLabel = (timestamp) => {
    if (!timestamp) return "";
    const msgDate = new Date(Number(timestamp));
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

  const isOnlineFromLastSeen = (seenTs) => {
    if (!seenTs) return false;
    const ts = Number(seenTs);
    if (!Number.isFinite(ts) || ts <= 0) return false;
    return Date.now() - ts < 60_000;
  };

  const getLastSeenText = (seenTs) => {
    const ts = Number(seenTs || 0);
    if (!Number.isFinite(ts) || ts <= 0) return null;
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "last seen just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `last seen ${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `last seen ${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `last seen ${days}d ago`;
    return `last seen on ${new Date(ts).toLocaleDateString()}`;
  };

  const list = (selectedTab === "teacher" ? teachers : selectedTab === "student" ? students : parents)
    .filter((u) => u.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100dvh - var(--topbar-height, 0px))",
        marginTop: "var(--topbar-height, 0px)",
        background:
          "radial-gradient(circle at top right, rgba(59, 130, 246, 0.16), transparent 38%), linear-gradient(180deg, #f6f9ff 0%, #eef4ff 100%)",
        width: "100%",
        boxSizing: "border-box",
        position: "relative",
        padding: isMobile ? 0 : 14,
        gap: isMobile ? 0 : 12,
      }}
    >
      <div
        style={{
          display:
            isMobile && !selectedChatUser
              ? "flex"
              : isMobile && selectedChatUser
              ? "none"
              : "flex",
          alignItems: "stretch",
          position: isMobile && !selectedChatUser ? "fixed" : "static",
          top: isMobile && !selectedChatUser ? "var(--topbar-height, 0px)" : 0,
          left: 0,
          width: isMobile && !selectedChatUser ? "100vw" : undefined,
          height: isMobile && !selectedChatUser ? "calc(100dvh - var(--topbar-height, 0px))" : undefined,
          background: isMobile && !selectedChatUser ? "#fff" : undefined,
          zIndex: isMobile && !selectedChatUser ? 100 : undefined,
        }}
      >
        <div
          style={{
            width: isMobile && !selectedChatUser ? "100vw" : sidebarOpen ? (isMobile ? 220 : 280) : 0,
            height: isMobile && !selectedChatUser ? "calc(100dvh - var(--topbar-height, 0px))" : "auto",
            background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
            padding: sidebarOpen || (isMobile && !selectedChatUser) ? 16 : 0,
            boxShadow: sidebarOpen || (isMobile && !selectedChatUser) ? "0 16px 30px rgba(15, 23, 42, 0.12)" : "none",
            border: sidebarOpen || (isMobile && !selectedChatUser) ? "1px solid rgba(191, 219, 254, 0.9)" : "none",
            borderRadius: isMobile ? 0 : 14,
            display: sidebarOpen || (isMobile && !selectedChatUser) ? "flex" : "none",
            flexDirection: "column",
            transition: "width 180ms ease",
            overflowY: isMobile && !selectedChatUser ? "auto" : "visible",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button onClick={() => navigate(-1)} style={{ border: "1px solid #bfdbfe", background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)", padding: 6, cursor: "pointer", borderRadius: 999, color: "#1e40af", boxShadow: "0 8px 16px rgba(30, 64, 175, 0.15)" }}>
              <FaArrowLeft size={18} />
            </button>
            <div style={{ display: "flex", gap: 6, margin: "12px 0", alignItems: "center", background: "#ffffff", border: "1px solid #dbeafe", borderRadius: 999, padding: 4, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 14px rgba(15,23,42,0.05)" }}>
              {["teacher", "student", "parent"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setSelectedTab(tab);
                    setSelectedChatUser(null);
                    setActiveChatKey("");
                  }}
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRadius: 20,
                    border: "none",
                    background: selectedTab === tab ? "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)" : "transparent",
                    color: selectedTab === tab ? "#fff" : "#475569",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 800,
                    boxShadow: selectedTab === tab ? "0 8px 16px rgba(37,99,235,0.25)" : "none",
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%", marginBottom: 10, padding: 10, borderRadius: 999, border: "1px solid #cbd5e1", outline: "none", background: "#f8fafc", boxShadow: "inset 0 1px 2px rgba(15,23,42,0.06)" }}
          />

          <div style={{ marginTop: 8, overflowY: "auto", flex: 1 }}>
            {list.map((u) => (
              <div
                key={u.userId}
                onClick={() => {
                  setSelectedChatUser(u);
                  setActiveChatKey("");
                  if (isMobile) setSidebarOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: isMobile ? 18 : 10,
                  borderRadius: 14,
                  cursor: "pointer",
                  marginBottom: 8,
                  background: selectedChatUser?.userId === u.userId ? "linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)" : "#ffffff",
                  border: selectedChatUser?.userId === u.userId ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                  boxShadow: selectedChatUser?.userId === u.userId ? "0 10px 20px rgba(37, 99, 235, 0.20)" : "0 4px 10px rgba(15,23,42,0.05)",
                  fontSize: isMobile ? 18 : 15,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ position: "relative" }}>
                    <img
                      src={u.profileImage}
                      alt={u.name}
                      onError={(e) => (e.currentTarget.src = "/default-profile.png")}
                      style={{ width: isMobile ? 36 : 40, height: isMobile ? 36 : 40, borderRadius: "50%", objectFit: "cover", border: "2px solid #ffffff", boxShadow: "0 4px 10px rgba(15,23,42,0.12)" }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: -2,
                        bottom: -2,
                        width: 12,
                        height: 12,
                        borderRadius: 12,
                        border: "2px solid #fff",
                        background: isOnlineFromLastSeen(u.lastSeen) ? "#34D399" : "#cbd5e1",
                      }}
                    />
                  </div>
                  <span style={{ fontWeight: 500 }}>{u.name}</span>
                </div>

                {u.unread > 0 ? (
                  <div style={{ minWidth: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "#ef4444", color: "#fff", borderRadius: 14, padding: "0 6px", fontSize: 12, fontWeight: 600 }}>
                    {u.unread > 99 ? "99+" : u.unread}
                  </div>
                ) : (
                  <div style={{ width: 26 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: 28, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
          <button onClick={() => setSidebarOpen((s) => !s)} style={{ border: "1px solid #bfdbfe", background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)", borderRadius: 10, padding: 4, boxShadow: "0 8px 16px rgba(15, 23, 42, 0.12)", cursor: "pointer", marginTop: 8, color: "#1e40af" }} aria-label="Toggle sidebar">
            {sidebarOpen ? "‹" : "›"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: isMobile ? 10 : 14, display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #ffffff 0%, #f9fbff 100%)", border: "1px solid #dbeafe", borderRadius: isMobile ? 0 : 16, boxShadow: "0 16px 30px rgba(15, 23, 42, 0.10)" }}>
        {selectedChatUser ? (
          <>
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
                  style={{ border: "none", background: "none", padding: 4, marginRight: 8, cursor: "pointer", fontSize: 20 }}
                  aria-label="Back to user list"
                >
                  <FaArrowLeft size={22} />
                </button>
              )}
              <img
                src={selectedChatUser.profileImage}
                alt={selectedChatUser.name}
                onError={(e) => (e.currentTarget.src = "/default-profile.png")}
                style={{ width: isMobile ? 40 : 50, height: isMobile ? 40 : 50, borderRadius: "50%", objectFit: "cover", border: "2px solid #ffffff", boxShadow: "0 4px 10px rgba(15,23,42,0.12)" }}
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{selectedChatUser.name}</span>
                <div style={{ fontSize: 12, color: isOnlineFromLastSeen(lastSeen) ? "#16A34A" : "#666" }}>
                  {typing
                    ? "Typing..."
                    : isOnlineFromLastSeen(lastSeen)
                    ? "Online"
                    : getLastSeenText(lastSeen) || "last seen recently"}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              {popupMessages.length === 0 ? (
                <p style={{ color: "#475569", textAlign: "center", marginTop: 20 }}>Start chatting with {selectedChatUser.name}...</p>
              ) : popupMessages.map(m => {
                const isAdmin = m.sender === "admin";
                const isSelected = activeMessageId === m.id;
                if (m.deleted) return null;

                return (
                  <div
                    key={m.id}
                    onClick={() => setActiveMessageId(m.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isAdmin ? "flex-end" : "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    {/* Message Bubble */}
                    <div
                      style={{
                        maxWidth: isMobile ? "85%" : "70%",
                        background: isAdmin ? "linear-gradient(135deg, #1d4ed8, #2563eb 55%, #3b82f6)" : "#ffffff",
                        color: isAdmin ? "#fff" : "#0f172a",
                        padding: "8px 12px",
                        borderRadius: 16,
                        borderTopRightRadius: isAdmin ? 0 : 16,
                        borderTopLeftRadius: isAdmin ? 16 : 0,
                        boxShadow: isAdmin ? "0 10px 18px rgba(37, 99, 235, 0.28)" : "0 6px 12px rgba(15, 23, 42, 0.10)",
                        border: isAdmin ? "none" : "1px solid #e2e8f0",
                        wordBreak: "break-word",
                        display: "flex",
                        flexDirection: "column",
                        cursor: "pointer",
                        position: "relative",
                      }}
                    >
                      <div>{m.text}</div>
                      {m.edited && <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>edited</div>}
                      <div style={{ fontSize: 10, opacity: 0.9, display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
                        <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>{formatDateLabel(m.timeStamp)}</span>
                        <span>{formatTime(m.timeStamp)}</span>
                        {isAdmin && !m.deleted && (
                          <span style={{ display: "flex", gap: 0 }}>
                            <FaCheck size={10} color="#fff" style={{ opacity: 0.8 }} />
                            {m.seen && <FaCheck size={10} color="#f3f7f8" style={{ marginLeft: 2, opacity: 0.95 }} />}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && isAdmin && (
                      <div style={{ display: "flex", gap: 6, marginTop: 4, fontSize: 12, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => { setPopupInput(m.text); setEditingMsgId(m.id); }}
                          style={{ padding: "3px 8px", borderRadius: 999, border: "1px solid #cbd5e1", cursor: "pointer", background: "#f8fafc", color: "#334155", fontWeight: 600 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMessage(m.id)}
                          style={{ padding: "3px 8px", borderRadius: 999, border: "1px solid #fecaca", cursor: "pointer", background: "#fef2f2", color: "#b91c1c", fontWeight: 600 }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef}></div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10, padding: 8, borderRadius: 12, background: "#ffffff", border: "1px solid #dbeafe", boxShadow: "0 8px 18px rgba(15,23,42,0.08)" }}>
              <input
                value={popupInput}
                onChange={handleTyping}
                onKeyDown={e => e.key === "Enter" && sendPopupMessage()}
                placeholder="Type a message..."
                style={{ flex: 1, padding: isMobile ? 10 : 12, borderRadius: 999, border: "1px solid #cbd5e1", outline: "none", background: "#f8fafc", boxShadow: "inset 0 1px 2px rgba(15,23,42,0.06)" }}
              />
              <button onClick={sendPopupMessage} style={{ width: isMobile ? 40 : 45, height: isMobile ? 40 : 45, borderRadius: "50%", background: "linear-gradient(135deg, #1d4ed8, #2563eb 60%, #3b82f6)", border: "none", color: "#fff", display: "flex", justifyContent: "center", alignItems: "center", boxShadow: "0 10px 22px rgba(37, 99, 235, 0.32)" }}>
                <FaPaperPlane />
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: "grid", placeItems: "center", flex: 1 }}>
            <div style={{ textAlign: "center", padding: 24, borderRadius: 16, border: "1px solid #dbeafe", background: "linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)", boxShadow: "0 14px 28px rgba(15,23,42,0.10)" }}>
              <h3 style={{ margin: 0, color: "#0f172a" }}>Select a user to start chatting 💬</h3>
              <div style={{ marginTop: 8, color: "#475569", fontSize: 13 }}>Choose a teacher, student, or parent from the left panel.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AllChat;