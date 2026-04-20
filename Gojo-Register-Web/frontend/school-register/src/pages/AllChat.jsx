import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPaperPlane } from "react-icons/fa";
import { getDatabase, get, onValue, push, ref, set, update } from "firebase/database";
import axios from "axios";
import "../styles/global.css";
import ProfileAvatar from "../components/ProfileAvatar";
import {
  buildConversationSummaryMap,
  buildUserLookupFromNode,
  fetchConversationSummaries,
  loadSchoolParentsNode,
  loadSchoolStudentsNode,
  loadSchoolTeachersNode,
  loadSchoolUsersNode,
  loadUserRecordsByIds,
} from "../utils/registerData";

const DB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";

function AllChat() {
  const location = useLocation();
  const navigate = useNavigate();

  const stored = (() => {
    const parse = (raw) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    return parse(localStorage.getItem("registrar")) || parse(localStorage.getItem("admin")) || {};
  })();

  const financeUserId = stored.userId || "";
  const financeAccountId = stored.financeId || stored.adminId || "";
  const schoolCode = stored.schoolCode || "";
  const DB_ROOT = schoolCode ? `${DB_BASE}/Platform1/Schools/${schoolCode}` : DB_BASE;
  const DB_PATH = schoolCode ? `Platform1/Schools/${schoolCode}` : "";

  const isSelfUser = (value) => {
    const target = String(value || "");
    if (!target) return false;
    return [financeUserId, financeAccountId]
      .map((v) => String(v || ""))
      .filter(Boolean)
      .includes(target);
  };

  const passedUser = useMemo(() => {
    const normalize = (u, fallbackType = "student") => {
      if (!u?.userId) return null;
      if (isSelfUser(u.userId) || isSelfUser(u.id) || isSelfUser(u.financeId) || isSelfUser(u.adminId)) {
        return null;
      }
      return {
        ...u,
        type: u?.type || fallbackType,
        name: u?.name || u?.username || "User",
        profileImage: u?.profileImage || "/default-profile.png",
      };
    };

    if (location.state?.user) return normalize(location.state.user, location.state?.user?.type || "student");

    if (location.state?.teacher) {
      const t = location.state.teacher;
      return normalize(
        {
          userId: t?.userId || "",
          name: t?.name || t?.username || "Teacher",
          profileImage: t?.profileImage || "/default-profile.png",
          type: location.state?.userType || "teacher",
        },
        "teacher"
      );
    }

    return null;
  }, [location.state, financeUserId, financeAccountId]);

  const getChatKey = (a, b) => [String(a || ""), String(b || "")].sort().join("_");

  const getChatKeyCandidates = (a, b) => {
    const left = String(a || "");
    const right = String(b || "");
    const sorted = getChatKey(left, right);
    const direct = `${left}_${right}`;
    const reverse = `${right}_${left}`;
    return [sorted, direct, reverse].filter((v, i, arr) => v && arr.indexOf(v) === i);
  };

  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedTab, setSelectedTab] = useState(
    passedUser?.type === "parent" || passedUser?.type === "teacher" ? passedUser.type : "student"
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

  const normalizedChatKey = useMemo(() => {
    if (!selectedChatUser?.userId || !financeUserId) return null;
    return getChatKey(financeUserId, selectedChatUser.userId);
  }, [selectedChatUser, financeUserId]);
  const [activeChatKey, setActiveChatKey] = useState(null);

  useEffect(() => {
    if (!passedUser?.userId) return;
    if (isSelfUser(passedUser.userId) || isSelfUser(passedUser.id)) return;
    setSelectedChatUser((prev) =>
      String(prev?.userId || "") === String(passedUser.userId) ? prev : passedUser
    );
    if (["student", "parent", "teacher"].includes(passedUser?.type)) {
      setSelectedTab(passedUser.type);
    }
  }, [passedUser, financeUserId, financeAccountId]);

  const updateUnreadForSelected = async (userId) => {
    if (!financeUserId || !userId) return;
    const key = activeChatKey || getChatKey(financeUserId, userId);
    try {
      await axios.patch(`${DB_ROOT}/Chats/${key}/unread.json`, {
        [financeUserId]: 0,
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const fetchPeople = async () => {
      if (!financeUserId) return;

      try {
        const [studentsData, parentsData, teachersData] = await Promise.all([
          loadSchoolStudentsNode({ rtdbBase: DB_ROOT }),
          loadSchoolParentsNode({ rtdbBase: DB_ROOT }),
          loadSchoolTeachersNode({ rtdbBase: DB_ROOT }),
        ]);

        const userIds = Array.from(
          new Set(
            [...Object.values(studentsData || {}), ...Object.values(parentsData || {}), ...Object.values(teachersData || {})]
              .map((record) => String(record?.userId || "").trim())
              .filter(Boolean)
          )
        );

        let usersById = {};
        if (userIds.length <= 80) {
          usersById = await loadUserRecordsByIds({
            rtdbBase: DB_ROOT,
            schoolCode,
            userIds,
          });
        } else {
          const usersNode = await loadSchoolUsersNode({ rtdbBase: DB_ROOT });
          usersById = buildUserLookupFromNode(usersNode);
        }

        const summaries = await fetchConversationSummaries({
          rtdbBase: DB_ROOT,
          currentUserId: financeUserId,
          includeWithoutLastMessage: true,
        });
        const summariesByUserId = buildConversationSummaryMap(summaries);

        const findUserNode = (userId) => usersById[String(userId || "").trim()] || {};

        const buildList = (sourceMap, type) => {
          const rows = Object.entries(sourceMap || {})
            .map(([id, node]) => {
              const userId = node?.userId;
              if (!userId) return null;
              if (isSelfUser(userId) || isSelfUser(id) || isSelfUser(node?.financeId) || isSelfUser(node?.adminId)) {
                return null;
              }

              const user = findUserNode(userId);
              const summary = summariesByUserId[String(userId || "").trim()] || null;
              const unread = Number(summary?.unreadForMe || 0);

              return {
                id,
                type,
                userId,
                name: user.name || user.username || `${type} ${id}`,
                profileImage: user.profileImage || "/default-profile.png",
                lastSeen: user.lastSeen || null,
                lastMsgTime: Number(summary?.lastMessageTime || 0),
                lastMsgText: summary?.lastMessageText || "",
                unread,
              };
            })
            .filter(Boolean);

          const uniqueByUserId = new Map();
          for (const row of rows) {
            const key = String(row.userId || "");
            const existing = uniqueByUserId.get(key);
            if (!existing) {
              uniqueByUserId.set(key, row);
              continue;
            }

            const shouldReplace = Number(row.lastMsgTime || 0) >= Number(existing.lastMsgTime || 0);
            const merged = shouldReplace ? { ...existing, ...row } : { ...row, ...existing };
            merged.unread = Math.max(Number(existing.unread || 0), Number(row.unread || 0));
            merged.lastMsgTime = Math.max(
              Number(existing.lastMsgTime || 0),
              Number(row.lastMsgTime || 0)
            );
            uniqueByUserId.set(key, merged);
          }

          return Array.from(uniqueByUserId.values()).sort(
            (a, b) => Number(b.lastMsgTime || 0) - Number(a.lastMsgTime || 0)
          );
        };

        const studentList = buildList(studentsData, "student");
        const parentList = buildList(parentsData, "parent");
        const teacherList = buildList(teachersData, "teacher");

        setStudents(studentList);
        setParents(parentList);
        setTeachers(teacherList);

        const allUsers = [...studentList, ...parentList, ...teacherList];
        const selectedIsValid = allUsers.some(
          (u) => String(u?.userId || "") === String(selectedChatUser?.userId || "")
        );

        const hasExplicitTarget = Boolean(passedUser?.userId || location.state?.studentId);

        if (!selectedChatUser || !selectedIsValid) {
          if (location.state?.studentId) {
            const matchedStudent = studentList.find(
              (s) => String(s.id) === String(location.state.studentId)
            );
            if (matchedStudent) {
              setSelectedTab("student");
              setSelectedChatUser(matchedStudent);
              return;
            }
          }

          if (hasExplicitTarget) {
            const first = studentList[0] || parentList[0] || teacherList[0] || null;
            setSelectedChatUser(first);
          } else {
            setSelectedChatUser(null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch chat users:", err);
      }
    };

    fetchPeople();
  }, [DB_ROOT, financeUserId, financeAccountId, location.state?.studentId, passedUser?.userId, selectedChatUser]);

  useEffect(() => {
    if (!financeUserId || !selectedChatUser?.userId || !normalizedChatKey) {
      setActiveChatKey(null);
      return;
    }

    let mounted = true;

    const resolveKey = async () => {
      const dbInst = getDatabase();
      const candidates = getChatKeyCandidates(financeUserId, selectedChatUser.userId);

      for (const key of candidates) {
        const basePath = DB_PATH ? `${DB_PATH}/Chats/${key}` : `Chats/${key}`;
        try {
          const snap = await get(ref(dbInst, basePath));
          if (snap.exists()) {
            if (mounted) setActiveChatKey(key);
            return;
          }
        } catch {
          // try next candidate
        }
      }

      if (mounted) setActiveChatKey(normalizedChatKey);
    };

    resolveKey();

    return () => {
      mounted = false;
    };
  }, [DB_PATH, financeUserId, normalizedChatKey, selectedChatUser]);

  useEffect(() => {
    if (!activeChatKey || !selectedChatUser?.userId || !financeUserId) return;

    const dbInst = getDatabase();
    const basePath = DB_PATH ? `${DB_PATH}/Chats/${activeChatKey}` : `Chats/${activeChatKey}`;
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
          sender: String(m.senderId) === String(financeUserId) ? "registerer" : "user",
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

    updateUnreadForSelected(selectedChatUser.userId);

    return () => {
      unsubMessages();
      unsubTyping();
      unsubLastSeen();
    };
  }, [activeChatKey, selectedChatUser, financeUserId, DB_PATH]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = async () => {
    if (!messageInput.trim() || !activeChatKey || !selectedChatUser?.userId || !financeUserId) return;

    const dbInst = getDatabase();
    const basePath = DB_PATH ? `${DB_PATH}/Chats/${activeChatKey}` : `Chats/${activeChatKey}`;
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
    if (!activeChatKey || !msgId) return;
    const dbInst = getDatabase();
    const basePath = DB_PATH ? `${DB_PATH}/Chats/${activeChatKey}` : `Chats/${activeChatKey}`;
    await update(ref(dbInst, `${basePath}/messages/${msgId}`), { deleted: true });
  };

  const handleTyping = async (e) => {
    const text = e.target.value;
    setMessageInput(text);

    if (!activeChatKey || !financeUserId) return;
    const dbInst = getDatabase();
    const basePath = DB_PATH ? `${DB_PATH}/Chats/${activeChatKey}` : `Chats/${activeChatKey}`;
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

  const activeList =
    selectedTab === "student"
      ? students
      : selectedTab === "parent"
      ? parents
      : teachers;

  const filteredList = activeList.filter((u) =>
    String(u.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pageShellStyle = {
    display: "flex",
    height: "100vh",
    background: "linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-secondary) 100%)",
  };

  const sidebarStyle = {
    width: 300,
    background: "var(--surface-panel)",
    borderRight: "1px solid var(--border-soft)",
    overflowY: "auto",
    padding: 15,
    boxShadow: "var(--shadow-soft)",
  };

  const searchInputStyle = {
    flex: 1,
    padding: 8,
    borderRadius: 20,
    border: "1px solid var(--input-border)",
    outline: "none",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
  };

  const tabButtonStyle = (isActive) => ({
    flex: 1,
    padding: 8,
    borderRadius: 20,
    border: "1px solid transparent",
    cursor: "pointer",
    background: isActive ? "var(--accent-strong)" : "var(--surface-muted)",
    color: isActive ? "#fff" : "var(--text-primary)",
    fontWeight: 700,
  });

  const threadHeaderStyle = {
    padding: 10,
    borderBottom: "1px solid var(--border-soft)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "var(--surface-muted)",
    borderRadius: 10,
    marginBottom: 10,
  };

  const threadBodyStyle = {
    flex: 1,
    overflowY: "auto",
    padding: 15,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    background: "var(--surface-overlay)",
    borderRadius: 10,
    border: "1px solid var(--border-soft)",
  };

  const composerInputStyle = {
    flex: 1,
    padding: "12px 16px",
    borderRadius: 30,
    border: "1px solid var(--input-border)",
    outline: "none",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
  };

  const actionButtonStyle = {
    background: "var(--accent-strong)",
    color: "#fff",
    border: "none",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
  };

  const renderUserList = (users) =>
    users.map((u) => (
      <div
        key={u.userId}
        onClick={async () => {
          setSelectedChatUser(u);
          await updateUnreadForSelected(u.userId);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 10,
          borderRadius: 8,
          background: selectedChatUser?.userId === u.userId ? "var(--accent-soft)" : "var(--surface-panel)",
          border: selectedChatUser?.userId === u.userId ? "1px solid var(--accent-strong)" : "1px solid var(--border-soft)",
          cursor: "pointer",
          marginBottom: 8,
          transition: "0.2s all",
          boxShadow: selectedChatUser?.userId === u.userId ? "var(--shadow-glow)" : "var(--shadow-soft)",
        }}
      >
        {u.unread > 0 && (
          <span
            style={{
              marginRight: 6,
              minWidth: 22,
              height: 22,
              background: "var(--danger)",
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
        <ProfileAvatar imageUrl={u.profileImage} name={u.name} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {u.lastMsgText || "No messages yet"}
          </div>
        </div>
      </div>
    ));

  return (
    <div style={pageShellStyle}>
      <div style={sidebarStyle}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 15 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ ...actionButtonStyle, marginRight: 10 }}
          >
            <FaArrowLeft />
          </button>
          <input
            type="text"
            placeholder="Search student/parent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyle}
          />
        </div>

        <div style={{ display: "flex", marginBottom: 15, gap: 5 }}>
          {["student", "parent", "teacher"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              style={{
                ...tabButtonStyle(selectedTab === tab),
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {renderUserList(filteredList)}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 15, minWidth: 0 }}>
        {selectedChatUser ? (
          <>
            <div style={threadHeaderStyle}>
              <ProfileAvatar imageUrl={selectedChatUser.profileImage} name={selectedChatUser.name} size={40} />
              <div>
                <strong style={{ color: "var(--text-primary)" }}>{selectedChatUser.name}</strong>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {typing
                    ? "Typing..."
                    : lastSeen
                    ? `Last seen: ${new Date(lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                </div>
              </div>
            </div>

            <div style={threadBodyStyle}>
              {messages.length === 0 ? (
                <p style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 20 }}>
                  Start chatting with {selectedChatUser.name}...
                </p>
              ) : (
                messages.map((m) => {
                  const isFinance = m.sender === "registerer";
                  if (m.deleted) return null;

                  return (
                    <div
                      key={m.id}
                      onClick={() => setActiveMessageId(m.id)}
                      style={{ display: "flex", flexDirection: "column", alignItems: isFinance ? "flex-end" : "flex-start", marginBottom: 12 }}
                    >
                      <div
                        style={{
                          background: isFinance ? "var(--accent-strong)" : "var(--surface-panel)",
                          color: isFinance ? "#fff" : "var(--text-primary)",
                          padding: "8px 12px",
                          borderRadius: 16,
                          borderTopRightRadius: isFinance ? 0 : 16,
                          borderTopLeftRadius: isFinance ? 16 : 0,
                          maxWidth: "46%",
                          wordBreak: "break-word",
                          display: "flex",
                          flexDirection: "column",
                          border: isFinance ? "none" : "1px solid var(--border-soft)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
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
                            style={{ fontSize: 12, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-primary)", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}
                          >
                            Edit
                          </button>
                          <button onClick={() => deleteMessage(m.id)} style={{ fontSize: 12, color: "#fff", background: "var(--danger)", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}>
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

            <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--border-soft)" }}>
              <input
                value={messageInput}
                onChange={handleTyping}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message..."
                style={composerInputStyle}
              />
              <button
                onClick={sendMessage}
                style={{ background: "var(--accent-strong)", border: "none", color: "#fff", borderRadius: "50%", width: 45, height: 45, display: "flex", justifyContent: "center", alignItems: "center", boxShadow: "var(--shadow-glow)" }}
              >
                <FaPaperPlane />
              </button>
            </div>
          </>
        ) : (
          <p style={{ color: "var(--text-secondary)", textAlign: "center", marginTop: "50%" }}>
            Select a student or parent to start chatting...
          </p>
        )}
      </div>
    </div>
  );
}

export default AllChat;
