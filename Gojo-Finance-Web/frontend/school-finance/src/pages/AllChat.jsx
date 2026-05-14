import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPaperPlane } from "react-icons/fa";
import { getDatabase, get, onValue, push, ref, set, update } from "firebase/database";
import "../styles/global.css";
import { useFinanceShell } from "../context/FinanceShellContext";
import { loadSchoolPeople } from "../utils/chatRtdb";

const DB_BASE = "https://gojo-education-default-rtdb.firebaseio.com";

function AllChat() {
  const location = useLocation();
  const navigate = useNavigate();

  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem("finance") || localStorage.getItem("admin")) || {};
    } catch {
      return {};
    }
  })();

  const financeUserId = stored.userId || "";
  const schoolCode = stored.schoolCode || "";
  const DB_ROOT = schoolCode ? `${DB_BASE}/Platform1/Schools/${schoolCode}` : DB_BASE;
  const DB_PATH = schoolCode ? `Platform1/Schools/${schoolCode}` : "";

  const passedUser = location.state?.user || null;

  const getChatKey = (a, b) => [String(a || ""), String(b || "")].sort().join("_");
  const financeShell = useFinanceShell();
  const conversationSummaries = financeShell?.conversationSummaries || [];
  const markMessagesAsSeen = financeShell?.markMessagesAsSeen;

  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [selectedTab, setSelectedTab] = useState(
    passedUser?.type === "parent" ? "parent" : "student"
  );
  const [selectedChatUser, setSelectedChatUser] = useState(passedUser);

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [typing, setTyping] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const chatEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const chatKey = useMemo(() => {
    if (!selectedChatUser?.userId || !financeUserId) return null;
    return getChatKey(financeUserId, selectedChatUser.userId);
  }, [selectedChatUser, financeUserId]);

  const summaryMap = useMemo(() => {
    const nextMap = new Map();
    (conversationSummaries || []).forEach((summary) => {
      nextMap.set(String(summary?.userId), summary);
    });
    return nextMap;
  }, [conversationSummaries]);

  useEffect(() => {
    let cancelled = false;

    const loadContacts = async () => {
      if (!financeUserId) return;

      try {
        const role = selectedTab === "parent" ? "parent" : "student";
        const users = await loadSchoolPeople(DB_ROOT, role);
        if (cancelled) return;

        const nextContacts = (users || [])
          .filter((user) => String(user?.userId || "") !== String(financeUserId))
          .map((user) => {
            const summary = summaryMap.get(String(user?.userId || ""));

            return {
              id: user?.id || user?.userId || "",
              type: selectedTab,
              userId: user?.userId || "",
              name: user?.name || user?.username || `${selectedTab} ${user?.userId || ""}`,
              profileImage: user?.profileImage || "/default-profile.png",
              lastSeen: user?.lastSeen || null,
              lastMsgTime: Number(summary?.lastTimestamp || 0),
              lastMsgText: summary?.lastMessage?.text || "",
              unread: Number(summary?.unreadCount || 0),
            };
          })
          .sort((left, right) => right.lastMsgTime - left.lastMsgTime);

        if (selectedTab === "student") {
          setStudents(nextContacts);
        } else {
          setParents(nextContacts);
        }

        if (!selectedChatUser) {
          const preferredUser = passedUser?.userId
            ? nextContacts.find((item) => String(item.userId) === String(passedUser.userId))
            : null;
          setSelectedChatUser(preferredUser || nextContacts[0] || null);
        }
      } catch (err) {
        console.error("Failed to fetch chat users:", err);
      }
    };

    loadContacts();

    return () => {
      cancelled = true;
    };
  }, [DB_ROOT, financeUserId, passedUser?.userId, selectedChatUser, selectedTab, summaryMap]);

  useEffect(() => {
    if (!chatKey || !selectedChatUser?.userId || !financeUserId) return;

    const dbInst = getDatabase();
    const basePath = DB_PATH ? `${DB_PATH}/Chats/${chatKey}` : `Chats/${chatKey}`;
    const userPath = DB_PATH ? `${DB_PATH}/Users/${selectedChatUser.userId}/lastSeen` : `Users/${selectedChatUser.userId}/lastSeen`;

    const messagesRef = ref(dbInst, `${basePath}/messages`);
    const typingRef = ref(dbInst, `${basePath}/typing`);
    const lastSeenRef = ref(dbInst, userPath);

    const unsubMessages = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const mapped = Object.entries(data)
        .map(([id, m]) => ({
          ...m,
          id,
          sender: String(m.senderId) === String(financeUserId) ? "finance" : "user",
        }))
        .sort((a, b) => Number(a.timeStamp || 0) - Number(b.timeStamp || 0));
      setMessages(mapped);
    });

    const unsubTyping = onValue(typingRef, (snapshot) => {
      const val = snapshot.val();
      setTyping(Boolean(val?.userId) && String(val.userId) === String(selectedChatUser.userId));
    });

    const unsubLastSeen = onValue(lastSeenRef, (snapshot) => {
      setLastSeen(snapshot.val());
    });

    if (markMessagesAsSeen) {
      markMessagesAsSeen(selectedChatUser.userId);
    }

    return () => {
      unsubMessages();
      unsubTyping();
      unsubLastSeen();
    };
  }, [chatKey, selectedChatUser, financeUserId, DB_PATH, markMessagesAsSeen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = async () => {
    if (!messageInput.trim() || !chatKey || !selectedChatUser?.userId || !financeUserId) return;

    const dbInst = getDatabase();
    const basePath = DB_PATH ? `${DB_PATH}/Chats/${chatKey}` : `Chats/${chatKey}`;
    const messagesRef = ref(dbInst, `${basePath}/messages`);
    const chatRef = ref(dbInst, basePath);

    if (editingMsgId) {
      await update(ref(dbInst, `${basePath}/messages/${editingMsgId}`), {
        text: messageInput,
        edited: true,
      });
      setEditingMsgId(null);
      setMessageInput("");
      return;
    }

    const payload = {
      senderId: financeUserId,
      receiverId: selectedChatUser.userId,
      type: "text",
      text: messageInput,
      imageUrl: null,
      replyTo: null,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp: Date.now(),
    };

    const msgRef = push(messagesRef);
    await set(msgRef, payload);

    let unreadNode = {};
    try {
      const unreadSnap = await get(ref(dbInst, `${basePath}/unread`));
      unreadNode = unreadSnap.val() || {};
    } catch {
      unreadNode = {};
    }

    const nextUnreadForReceiver = Number(unreadNode[selectedChatUser.userId] || 0) + 1;

    await update(chatRef, {
      participants: {
        [financeUserId]: true,
        [selectedChatUser.userId]: true,
      },
      lastMessage: { ...payload, messageId: msgRef.key },
      unread: {
        ...(unreadNode || {}),
        [financeUserId]: 0,
        [selectedChatUser.userId]: nextUnreadForReceiver,
      },
      typing: null,
    });

    setMessageInput("");
  };

  const deleteMessage = async (msgId) => {
    if (!chatKey || !msgId) return;
    const dbInst = getDatabase();
    const basePath = DB_PATH ? `${DB_PATH}/Chats/${chatKey}` : `Chats/${chatKey}`;
    await update(ref(dbInst, `${basePath}/messages/${msgId}`), { deleted: true });
  };

  const handleTyping = async (e) => {
    const text = e.target.value;
    setMessageInput(text);

    if (!chatKey || !financeUserId) return;
    const dbInst = getDatabase();
    const basePath = DB_PATH ? `${DB_PATH}/Chats/${chatKey}` : `Chats/${chatKey}`;
    const typingRef = ref(dbInst, `${basePath}/typing`);

    if (!text.trim()) {
      await set(typingRef, { userId: null });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      return;
    }

    await set(typingRef, { userId: financeUserId });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      await set(typingRef, { userId: null });
    }, 1800);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    return new Date(Number(timestamp)).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const activeList = selectedTab === "student" ? students : parents;

  const filteredList = activeList.filter((u) =>
    String(u.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderUserList = (users) =>
    users.map((u) => (
      <div
        key={u.userId}
        onClick={async () => {
          setSelectedChatUser(u);
          if (markMessagesAsSeen) {
            await markMessagesAsSeen(u.userId);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 10,
          borderRadius: 8,
          background: selectedChatUser?.userId === u.userId ? "#d0e6ff" : "#fff",
          cursor: "pointer",
          marginBottom: 8,
          transition: "0.2s all",
        }}
      >
        {u.unread > 0 && (
          <span
            style={{
              marginRight: 6,
              minWidth: 22,
              height: 22,
              background: "#f44336",
              color: "#fff",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {u.unread > 99 ? "99+" : u.unread}
          </span>
        )}
        <img src={u.profileImage} alt={u.name} style={{ width: 40, height: 40, borderRadius: "50%" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
          <div style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {u.lastMsgText || "No messages yet"}
          </div>
        </div>
      </div>
    ));

  return (
    <div style={{ display: "flex", height: "100vh", background: "#e5ddd5" }}>
      <div style={{ width: 300, background: "#fff", borderRight: "1px solid #ddd", overflowY: "auto", padding: 15 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 15 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: "#2563eb", color: "#fff", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer", marginRight: 10 }}
          >
            <FaArrowLeft />
          </button>
          <input
            type="text"
            placeholder="Search student/parent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, padding: 8, borderRadius: 20, border: "1px solid #ccc", outline: "none" }}
          />
        </div>

        <div style={{ display: "flex", marginBottom: 15, gap: 5 }}>
          {["student", "parent"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              style={{
                flex: 1,
                padding: 8,
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                background: selectedTab === tab ? "#2563eb" : "#f0f0f0",
                color: selectedTab === tab ? "#fff" : "#000",
                fontWeight: 700,
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {renderUserList(filteredList)}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 15 }}>
        {selectedChatUser ? (
          <>
            <div style={{ padding: 10, borderBottom: "1px solid #ddd", display: "flex", alignItems: "center", gap: 10, background: "#f0f2f5", borderRadius: 10, marginBottom: 10 }}>
              <img src={selectedChatUser.profileImage} alt={selectedChatUser.name} style={{ width: 40, height: 40, borderRadius: "50%" }} />
              <div>
                <strong>{selectedChatUser.name}</strong>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {typing
                    ? "Typing..."
                    : lastSeen
                    ? `Last seen: ${new Date(lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 15, display: "flex", flexDirection: "column", gap: 10, background: "#e5ddd5", borderRadius: 10 }}>
              {messages.length === 0 ? (
                <p style={{ color: "#888", textAlign: "center", marginTop: 20 }}>
                  Start chatting with {selectedChatUser.name}...
                </p>
              ) : (
                messages.map((m) => {
                  const isFinance = m.sender === "finance";
                  if (m.deleted) return null;

                  return (
                    <div
                      key={m.id}
                      onClick={() => setActiveMessageId(m.id)}
                      style={{ display: "flex", flexDirection: "column", alignItems: isFinance ? "flex-end" : "flex-start", marginBottom: 12 }}
                    >
                      <div
                        style={{
                          background: isFinance ? "#2563eb" : "#e4e6eb",
                          color: isFinance ? "#fff" : "#000",
                          padding: "8px 12px",
                          borderRadius: 16,
                          borderTopRightRadius: isFinance ? 0 : 16,
                          borderTopLeftRadius: isFinance ? 16 : 0,
                          maxWidth: "46%",
                          wordBreak: "break-word",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <div>{m.text}</div>
                        {m.edited && <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>edited</div>}
                        <div style={{ fontSize: 10, opacity: 0.75, display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
                          <span>{formatTime(m.timeStamp)}</span>
                          {isFinance && <span>{m.seen ? "✔✔" : "✔"}</span>}
                        </div>
                      </div>

                      {activeMessageId === m.id && isFinance && (
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          <button
                            onClick={() => {
                              setMessageInput(m.text || "");
                              setEditingMsgId(m.id);
                            }}
                            style={{ fontSize: 12 }}
                          >
                            Edit
                          </button>
                          <button onClick={() => deleteMessage(m.id)} style={{ fontSize: 12, color: "red" }}>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid #ddd" }}>
              <input
                value={messageInput}
                onChange={handleTyping}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message..."
                style={{ flex: 1, padding: "12px 16px", borderRadius: 30, border: "1px solid #ccc", outline: "none", background: "#fff" }}
              />
              <button
                onClick={sendMessage}
                style={{ background: "#2563eb", border: "none", color: "#fff", borderRadius: "50%", width: 45, height: 45, display: "flex", justifyContent: "center", alignItems: "center" }}
              >
                <FaPaperPlane />
              </button>
            </div>
          </>
        ) : (
          <p style={{ color: "#555", textAlign: "center", marginTop: "50%" }}>
            Select a student or parent to start chatting...
          </p>
        )}
      </div>
    </div>
  );
}

export default AllChat;
