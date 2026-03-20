import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FaSearch, FaUserShield, FaComments, FaChalkboardTeacher, FaUsers, FaExclamationTriangle, FaPlus } from "react-icons/fa";
import Sidebar from "../components/Sidebar";

const RTDB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";
const DEFAULT_ALERT_KEYWORDS = ["abuse", "insult", "harass", "threat", "meeting outside", "money transfer"];
const ALERT_KEYWORDS_STORAGE_KEY = "message_control_alert_keywords";

const readStoredAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem("admin") || "{}") || {};
  } catch {
    return {};
  }
};

const normalizeRole = (value) => String(value || "").trim().toLowerCase();

const roleChipStyle = (role) => {
  if (role === "teacher") return { color: "#1d4ed8", background: "#dbeafe", border: "1px solid #93c5fd" };
  if (role === "student") return { color: "#0f766e", background: "#ccfbf1", border: "1px solid #5eead4" };
  if (role === "parent") return { color: "#7c2d12", background: "#ffedd5", border: "1px solid #fdba74" };
  if (role === "finance") return { color: "#4c1d95", background: "#ede9fe", border: "1px solid #c4b5fd" };
  if (role === "registerer") return { color: "#1e3a8a", background: "#dbeafe", border: "1px solid #bfdbfe" };
  if (role === "academic") return { color: "#854d0e", background: "#fef9c3", border: "1px solid #fde68a" };
  return { color: "var(--text-secondary)", background: "var(--surface-muted)", border: "1px solid var(--border-soft)" };
};

const getPairCategory = (leftRole, rightRole) => {
  const roleA = normalizeRole(leftRole);
  const roleB = normalizeRole(rightRole);
  const roles = new Set([roleA, roleB]);
  const hasOfficeRole = [roleA, roleB].some((role) => ["academic", "finance", "registerer"].includes(role));

  if (roles.has("teacher") && roles.has("student")) return "teacher-student";
  if (roles.has("teacher") && roles.has("parent")) return "teacher-parent";
  if (hasOfficeRole && roles.has("student")) return "office-student";
  if (hasOfficeRole && roles.has("parent")) return "office-parent";
  return "other";
};

const pairCategoryLabel = {
  all: "All",
  "teacher-student": "Teachers vs Students",
  "teacher-parent": "Teachers vs Parents",
  "office-student": "Academic/Finance/Registerer vs Students",
  "office-parent": "Academic/Finance/Registerer vs Parents",
  other: "Other",
};

const formatTime = (value) => {
  const ts = Number(value || 0);
  if (!Number.isFinite(ts) || ts <= 0) return "";
  return new Date(ts).toLocaleString();
};

const extractKeywords = (rawValue) =>
  Array.from(
    new Set(
      String(rawValue || "")
        .split(/[\n,]/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  );

const getMatchedKeywords = (textValue, keywords) => {
  const normalizedText = String(textValue || "").toLowerCase();
  if (!normalizedText || keywords.length === 0) return [];
  return keywords.filter((keyword) => normalizedText.includes(keyword));
};

const resolveUserRole = (userId, userNode, roleSets) => {
  if (roleSets.teachers.has(userId)) return "teacher";
  if (roleSets.students.has(userId)) return "student";
  if (roleSets.parents.has(userId)) return "parent";
  if (roleSets.registerers.has(userId)) return "registerer";
  if (roleSets.finance.has(userId)) return "finance";
  if (roleSets.academic.has(userId)) return "academic";

  const role = normalizeRole(userNode?.role || userNode?.userType || "");
  const username = String(userNode?.username || "").toUpperCase();

  if (role.includes("teacher") || username.startsWith("GET_")) return "teacher";
  if (role.includes("student") || username.startsWith("GMIS_")) return "student";
  if (role.includes("parent") || username.startsWith("GMIP_")) return "parent";
  if (role.includes("register") || username.startsWith("GSR_")) return "registerer";
  if (role.includes("finance") || username.startsWith("GMIF_") || username.startsWith("GEH_")) return "finance";
  if (
    role.includes("academic") ||
    role.includes("admin") ||
    username.startsWith("GEM_") ||
    username.startsWith("GMIA_")
  ) {
    return "academic";
  }

  return role || "user";
};

export default function MessageControl() {
  const admin = readStoredAdmin();
  const schoolCode = String(admin?.schoolCode || "").trim();
  const SCHOOL_DB_ROOT = schoolCode
    ? `${RTDB_BASE}/Platform1/Schools/${encodeURIComponent(schoolCode)}`
    : RTDB_BASE;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pairFilter, setPairFilter] = useState("all");
  const [conversations, setConversations] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState("");
  const [keywordsInput, setKeywordsInput] = useState(DEFAULT_ALERT_KEYWORDS.join(", "));
  const [draftKeywordsInput, setDraftKeywordsInput] = useState("");
  const [showKeywordModal, setShowKeywordModal] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const hasLoadedRef = useRef(false);
  const [isCompactLayout, setIsCompactLayout] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1180;
  });

  const alertKeywords = useMemo(() => extractKeywords(keywordsInput), [keywordsInput]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ALERT_KEYWORDS_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;
      const normalized = extractKeywords(parsed.join(","));
      if (normalized.length > 0) {
        setKeywordsInput(normalized.join(", "));
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    const onResize = () => {
      setIsCompactLayout(window.innerWidth < 1180);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!schoolCode) return;
    const timerId = window.setInterval(() => {
      setRefreshTick((value) => value + 1);
    }, 7000);

    return () => window.clearInterval(timerId);
  }, [schoolCode]);

  useEffect(() => {
    if (!schoolCode) {
      setConversations([]);
      setSelectedChatId("");
      hasLoadedRef.current = false;
      return;
    }

    const loadMonitorData = async () => {
      setLoading(!hasLoadedRef.current);
      setError("");
      try {
        const [
          chatsRes,
          usersRes,
          teachersRes,
          studentsRes,
          parentsRes,
          managementRes,
          hrRes,
          registerersRes,
          schoolAdminsRes,
        ] = await Promise.all([
          axios.get(`${SCHOOL_DB_ROOT}/Chats.json`).catch(() => ({ data: {} })),
          axios.get(`${SCHOOL_DB_ROOT}/Users.json`).catch(() => ({ data: {} })),
          axios.get(`${SCHOOL_DB_ROOT}/Teachers.json`).catch(() => ({ data: {} })),
          axios.get(`${SCHOOL_DB_ROOT}/Students.json`).catch(() => ({ data: {} })),
          axios.get(`${SCHOOL_DB_ROOT}/Parents.json`).catch(() => ({ data: {} })),
          axios.get(`${SCHOOL_DB_ROOT}/Management.json`).catch(() => ({ data: {} })),
          axios.get(`${SCHOOL_DB_ROOT}/HR.json`).catch(() => ({ data: {} })),
          axios.get(`${SCHOOL_DB_ROOT}/Registerers.json`).catch(() => ({ data: {} })),
          axios.get(`${SCHOOL_DB_ROOT}/School_Admins.json`).catch(() => ({ data: {} })),
        ]);

        const chats = chatsRes.data || {};
        const users = usersRes.data || {};

        const toUserSet = (source) =>
          new Set(
            Object.values(source || {})
              .map((item) => String(item?.userId || "").trim())
              .filter(Boolean)
          );

        const roleSets = {
          teachers: toUserSet(teachersRes.data),
          students: toUserSet(studentsRes.data),
          parents: toUserSet(parentsRes.data),
          registerers: toUserSet(registerersRes.data),
          finance: toUserSet(hrRes.data),
          academic: new Set([...toUserSet(managementRes.data), ...toUserSet(schoolAdminsRes.data)]),
        };

        const parsedChats = Object.entries(chats)
          .map(([chatId, chatNode]) => {
            const participantsFromNode = Object.keys(chatNode?.participants || {});
            const participantsFromKey = String(chatId || "").split("_").filter(Boolean);
            const participantIds = Array.from(new Set([...participantsFromNode, ...participantsFromKey]));

            const messages = Object.entries(chatNode?.messages || {})
              .map(([messageId, messageValue]) => ({
                id: messageId,
                ...messageValue,
                timeStamp: Number(messageValue?.timeStamp || 0),
              }))
              .sort((left, right) => Number(left.timeStamp || 0) - Number(right.timeStamp || 0));

            const lastMessageFromNode = chatNode?.lastMessage || null;
            const lastMessageFromMessages = messages[messages.length - 1] || null;
            const lastMessage = lastMessageFromNode || lastMessageFromMessages;

            const participants = participantIds.slice(0, 2).map((id) => {
              const userNode = users[id] || {};
              const role = resolveUserRole(id, userNode, roleSets);

              return {
                userId: id,
                role,
                name: userNode?.name || userNode?.username || id,
                profileImage: userNode?.profileImage || "/default-profile.png",
              };
            });

            const leftRole = participants[0]?.role || "user";
            const rightRole = participants[1]?.role || "user";
            const category = getPairCategory(leftRole, rightRole);
            const unreadNode = chatNode?.unread || {};
            const unreadTotal = Object.values(unreadNode).reduce(
              (sum, value) => sum + Number(value || 0),
              0
            );

            return {
              chatId,
              participants,
              category,
              categoryLabel: pairCategoryLabel[category] || "Other",
              messageCount: messages.length,
              unreadTotal,
              lastMessageText: String(lastMessage?.text || "").trim() || "No text",
              lastMessageTime: Number(lastMessage?.timeStamp || 0),
              messages,
            };
          })
          .sort((left, right) => Number(right.lastMessageTime || 0) - Number(left.lastMessageTime || 0));

        setConversations(parsedChats);
        setSelectedChatId((previousChatId) => {
          if (previousChatId && parsedChats.some((chat) => chat.chatId === previousChatId)) {
            return previousChatId;
          }
          return "";
        });
      } catch (requestError) {
        setError("Failed to load chat monitor data.");
      } finally {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    };

    loadMonitorData();
  }, [SCHOOL_DB_ROOT, schoolCode, refreshTick]);

  const filteredConversations = useMemo(() => {
    const query = String(searchQuery || "").trim().toLowerCase();

    return conversations.filter((conversation) => {
      const matchesPair = pairFilter === "all" || conversation.category === pairFilter;
      if (!matchesPair) return false;
      if (!query) return true;

      const participantText = conversation.participants
        .map((participant) => `${participant.name} ${participant.role}`)
        .join(" ")
        .toLowerCase();

      return participantText.includes(query) || conversation.lastMessageText.toLowerCase().includes(query);
    }).sort((left, right) => Number(right.lastMessageTime || 0) - Number(left.lastMessageTime || 0));
  }, [conversations, pairFilter, searchQuery]);

  const enrichedConversations = useMemo(
    () =>
      filteredConversations.map((conversation) => {
        const flaggedMessages = conversation.messages.filter((message) => {
          const matches = getMatchedKeywords(message?.text, alertKeywords);
          return matches.length > 0;
        });

        return {
          ...conversation,
          flaggedCount: flaggedMessages.length,
        };
      }),
    [filteredConversations, alertKeywords]
  );

  const selectedConversation =
    enrichedConversations.find((conversation) => conversation.chatId === selectedChatId) || null;

  const stats = useMemo(() => {
    const base = {
      total: conversations.length,
      monitoredMessages: conversations.reduce((acc, chat) => acc + Number(chat.messageCount || 0), 0),
      teacherStudent: conversations.filter((chat) => chat.category === "teacher-student").length,
      teacherParent: conversations.filter((chat) => chat.category === "teacher-parent").length,
      office: conversations.filter((chat) => chat.category === "office-student" || chat.category === "office-parent").length,
    };
    return base;
  }, [conversations]);

  const flaggedSummary = useMemo(() => {
    const flaggedConversations = enrichedConversations.filter((conversation) => conversation.flaggedCount > 0).length;
    const flaggedMessages = enrichedConversations.reduce((sum, conversation) => sum + Number(conversation.flaggedCount || 0), 0);
    return { flaggedConversations, flaggedMessages };
  }, [enrichedConversations]);

  const handleSelectConversation = async (chatId) => {
    setSelectedChatId(chatId);
    setConversations((previousConversations) =>
      previousConversations.map((conversation) =>
        conversation.chatId === chatId
          ? { ...conversation, unreadTotal: 0 }
          : conversation
      )
    );

    try {
      const unreadSnapshot = await axios
        .get(`${SCHOOL_DB_ROOT}/Chats/${chatId}/unread.json`)
        .catch(() => ({ data: {} }));
      const unreadNode = unreadSnapshot.data || {};
      const resetPayload = Object.keys(unreadNode).reduce((payload, key) => {
        payload[key] = 0;
        return payload;
      }, {});

      if (Object.keys(resetPayload).length > 0) {
        await axios.patch(`${SCHOOL_DB_ROOT}/Chats/${chatId}/unread.json`, resetPayload);
      }
    } catch {
      // keep UI updated even if remote reset fails
    }
  };

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
  const statCardStyle = {
    ...shellCardStyle,
    padding: "8px 10px",
    borderRadius: 12,
    minWidth: 0,
  };

  const handleOpenKeywordModal = () => {
    setDraftKeywordsInput(keywordsInput);
    setShowKeywordModal(true);
  };

  const handleSaveKeywords = () => {
    const normalized = extractKeywords(draftKeywordsInput);
    const nextValue = (normalized.length > 0 ? normalized : DEFAULT_ALERT_KEYWORDS).join(", ");
    setKeywordsInput(nextValue);
    try {
      localStorage.setItem(ALERT_KEYWORDS_STORAGE_KEY, JSON.stringify(extractKeywords(nextValue)));
    } catch {
      // ignore storage errors
    }
    setShowKeywordModal(false);
  };

  return (
    <div className="dashboard-page" style={{ background: "var(--page-bg)", minHeight: "100vh", height: "100vh", overflow: "hidden", color: "var(--text-primary)" }}>
      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "4px 14px", height: "calc(100vh - 73px)", overflow: "hidden", background: "var(--page-bg)", width: "100%", boxSizing: "border-box" }}>
        <Sidebar admin={admin} />
        <div className="main-content" style={{ margin: 0, padding: "0 2px 20px", flex: 1, minWidth: 0, boxSizing: "border-box", height: "100%", overflowY: "auto", overflowX: "hidden" }}>
          <div className="main-inner" style={{ ...FEED_SECTION_STYLE, marginTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="section-header-card" style={{ ...shellCardStyle, margin: 0, padding: "16px", background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-accent) 100%)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h2 className="section-header-card__title" style={{ fontSize: "20px", margin: 0 }}>Message Control</h2>
                  <div className="section-header-card__subtitle" style={{ marginTop: 8, color: "var(--text-secondary)", fontSize: 13 }}>
                    Monitor teachers, students, parents, academic office, finance, and registerer chats for educational purpose.
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, color: "var(--accent-strong)", padding: "8px 12px", borderRadius: 999, background: "var(--surface-panel)", border: "1px solid var(--border-soft)" }}>
                  <FaUserShield /> Admin Monitoring
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 6 }}>
              <div style={statCardStyle}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Total Conversations</div>
                <div style={{ marginTop: 2, fontSize: 15, fontWeight: 900, color: "var(--text-primary)" }}>{stats.total}</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Total Messages</div>
                <div style={{ marginTop: 2, fontSize: 15, fontWeight: 900, color: "var(--text-primary)" }}>{stats.monitoredMessages}</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Teacher↔Student</div>
                <div style={{ marginTop: 2, fontSize: 15, fontWeight: 900, color: "var(--text-primary)" }}>{stats.teacherStudent}</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Teacher↔Parent</div>
                <div style={{ marginTop: 2, fontSize: 15, fontWeight: 900, color: "var(--text-primary)" }}>{stats.teacherParent}</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Office↔Students/Parents</div>
                <div style={{ marginTop: 2, fontSize: 15, fontWeight: 900, color: "var(--text-primary)" }}>{stats.office}</div>
              </div>
              <div style={{ borderRadius: 12, padding: "8px 10px", minWidth: 0, background: "linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%)", border: "1px solid #fdba74", boxShadow: "var(--shadow-soft)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9a3412", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Flagged Conversations</div>
                <div style={{ marginTop: 2, fontSize: 15, fontWeight: 900, color: "#7c2d12" }}>{flaggedSummary.flaggedConversations}</div>
              </div>
            </div>

            <div style={{ ...shellCardStyle, padding: 12, background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-overlay) 100%)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                  <FaExclamationTriangle style={{ color: "#ea580c" }} /> Alert Keywords Control
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleOpenKeywordModal}
                    style={{ width: 30, height: 30, borderRadius: 999, border: "1px solid #fdba74", background: "linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%)", color: "#9a3412", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 16px rgba(234, 88, 12, 0.16)" }}
                    title="Manage alert keywords"
                    aria-label="Manage alert keywords"
                  >
                    <FaPlus />
                  </button>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#9a3412", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 999, padding: "4px 10px" }}>
                    {flaggedSummary.flaggedMessages} flagged messages
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Enter comma-separated or line-separated keywords. Messages containing these terms will be flagged for admin review.
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {alertKeywords.slice(0, 8).map((word) => (
                  <span key={word} style={{ fontSize: 10, fontWeight: 800, color: "#9a3412", background: "#ffedd5", border: "1px solid #fdba74", borderRadius: 999, padding: "2px 8px" }}>
                    {word}
                  </span>
                ))}
                {alertKeywords.length > 8 ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)" }}>+{alertKeywords.length - 8} more</span>
                ) : null}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setPairFilter("all");
                  }}
                  style={{ height: 30, padding: "0 12px", borderRadius: 999, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  Reset Filters
                </button>
                <button
                  type="button"
                  onClick={() => setKeywordsInput(DEFAULT_ALERT_KEYWORDS.join(", "))}
                  style={{ height: 30, padding: "0 12px", borderRadius: 999, border: "1px solid #fdba74", background: "#fff7ed", color: "#9a3412", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  Reset Keywords
                </button>
              </div>
            </div>

            {showKeywordModal ? (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 1300,
                  background: "color-mix(in srgb, var(--text-primary) 26%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                }}
                onClick={() => setShowKeywordModal(false)}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    width: "min(560px, 100%)",
                    borderRadius: 18,
                    border: "1px solid var(--border-soft)",
                    background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-overlay) 100%)",
                    boxShadow: "var(--shadow-panel)",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                      <FaExclamationTriangle style={{ color: "#ea580c" }} /> Manage Alert Keywords
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowKeywordModal(false)}
                      style={{ height: 30, padding: "0 10px", borderRadius: 999, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                    >
                      Close
                    </button>
                  </div>

                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      Add words separated by comma or new line.
                    </div>
                    <textarea
                      value={draftKeywordsInput}
                      onChange={(event) => setDraftKeywordsInput(event.target.value)}
                      rows={6}
                      style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border-soft)", background: "var(--surface-muted)", color: "var(--text-primary)", padding: 10, resize: "vertical", outline: "none", fontSize: 12 }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setDraftKeywordsInput(DEFAULT_ALERT_KEYWORDS.join(", "))}
                        style={{ height: 32, padding: "0 12px", borderRadius: 999, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                      >
                        Default
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveKeywords}
                        style={{ height: 32, padding: "0 14px", borderRadius: 999, border: "1px solid #fdba74", background: "linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%)", color: "#9a3412", cursor: "pointer", fontSize: 11, fontWeight: 800 }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div
              style={{
                ...shellCardStyle,
                color: "var(--text-secondary)",
                fontSize: 13,
                display: "grid",
                gridTemplateColumns: isCompactLayout ? "1fr" : "340px minmax(0, 1fr)",
                height: isCompactLayout ? 700 : 560,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <div style={{ borderRight: isCompactLayout ? "none" : "1px solid var(--border-soft)", borderBottom: isCompactLayout ? "1px solid var(--border-soft)" : "none", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-overlay) 100%)" }}>
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 10 }}>
                  <div style={{ padding: 2, marginBottom: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ position: "relative" }}>
                      <FaSearch style={{ position: "absolute", left: 10, top: 11, color: "var(--text-muted)", fontSize: 13 }} />
                      <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search participant or message..."
                        style={{ width: "100%", height: 34, borderRadius: 999, border: "1px solid var(--border-soft)", background: "var(--surface-muted)", color: "var(--text-primary)", padding: "0 12px 0 30px", outline: "none" }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isCompactLayout ? "repeat(2, minmax(0, 1fr))" : "1fr", gap: 6 }}>
                      {[
                        "all",
                        "teacher-student",
                        "teacher-parent",
                        "office-student",
                        "office-parent",
                      ].map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setPairFilter(key)}
                          style={{
                            height: 30,
                            borderRadius: 8,
                            border: pairFilter === key ? "1px solid var(--accent-strong)" : "1px solid var(--border-soft)",
                            background: pairFilter === key ? "var(--accent-soft)" : "var(--surface-panel)",
                            color: pairFilter === key ? "var(--accent-strong)" : "var(--text-secondary)",
                            fontWeight: 700,
                            fontSize: 11,
                            cursor: "pointer",
                            textAlign: "left",
                            padding: "0 10px",
                          }}
                        >
                          {pairCategoryLabel[key]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {loading ? (
                    <div style={{ padding: 10, color: "var(--text-muted)" }}>Loading chats...</div>
                  ) : enrichedConversations.length === 0 ? (
                    <div style={{ padding: 10, color: "var(--text-muted)" }}>No conversations found.</div>
                  ) : (
                    enrichedConversations.map((conversation) => {
                      const first = conversation.participants[0];
                      const second = conversation.participants[1];
                      const active = selectedConversation?.chatId === conversation.chatId;

                      return (
                        <button
                          key={conversation.chatId}
                          type="button"
                          onClick={() => handleSelectConversation(conversation.chatId)}
                          style={{ width: "100%", textAlign: "left", borderRadius: 12, border: active ? "1px solid var(--accent-strong)" : "1px solid var(--border-soft)", background: active ? "var(--accent-soft)" : "var(--surface-panel)", boxShadow: active ? "var(--shadow-glow)" : "none", padding: 10, marginBottom: 8, cursor: "pointer" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {first?.name || "User"} ↔ {second?.name || "User"}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              {Number(conversation.unreadTotal || 0) > 0 ? (
                                <div style={{ minWidth: 22, height: 22, borderRadius: 999, padding: "0 7px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800 }}>
                                  {conversation.unreadTotal > 99 ? "99+" : conversation.unreadTotal}
                                </div>
                              ) : null}
                              {conversation.flaggedCount > 0 ? (
                                <div style={{ fontSize: 10, fontWeight: 800, color: "#9a3412", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 999, padding: "2px 6px" }}>
                                  {conversation.flaggedCount} flagged
                                </div>
                              ) : null}
                              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{conversation.messageCount}</div>
                            </div>
                          </div>

                          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {[first, second].map((participant, index) => (
                              <span key={`${conversation.chatId}-${participant?.userId || `participant-${index}`}`} style={{ ...roleChipStyle(participant?.role), fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>
                                {participant?.role || "user"}
                              </span>
                            ))}
                          </div>

                          <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {conversation.lastMessageText}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", background: "var(--surface-panel)" }}>
                {error ? (
                  <div style={{ padding: 14, color: "var(--danger)", borderBottom: "1px solid var(--border-soft)" }}>{error}</div>
                ) : null}

                {!selectedConversation ? (
                  <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--text-muted)", padding: 20 }}>
                    Select a conversation to monitor.
                  </div>
                ) : (
                  <>
                    <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", flexShrink: 0, background: "linear-gradient(180deg, var(--surface-muted) 0%, var(--surface-panel) 100%)" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                          <FaComments /> {selectedConversation.participants[0]?.name || "User"} ↔ {selectedConversation.participants[1]?.name || "User"}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 10, color: "var(--text-muted)" }}>
                          {selectedConversation.categoryLabel} · Last activity: {formatTime(selectedConversation.lastMessageTime) || "N/A"}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "var(--text-secondary)", fontWeight: 700 }}>
                        <FaChalkboardTeacher /> <span>{selectedConversation.messageCount} messages</span>
                        {selectedConversation.flaggedCount > 0 ? (
                          <span style={{ color: "#9a3412", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 999, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <FaExclamationTriangle /> {selectedConversation.flaggedCount} flagged
                          </span>
                        ) : null}
                        <FaUsers /> <span>Education Review</span>
                      </div>
                    </div>

                    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12, background: "linear-gradient(180deg, var(--surface-overlay) 0%, var(--surface-panel) 100%)" }}>
                      {selectedConversation.messages.length === 0 ? (
                        <div style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 20 }}>No messages in this conversation.</div>
                      ) : (
                        selectedConversation.messages.map((message) => {
                          const sender = selectedConversation.participants.find((participant) => String(participant.userId) === String(message.senderId));
                          const isFirst = String(message.senderId) === String(selectedConversation.participants[0]?.userId || "");
                          const messageText = message.deleted ? "[deleted message]" : message.text || "[no text]";
                          const messageKeywordHits = getMatchedKeywords(messageText, alertKeywords);
                          const isFlaggedMessage = messageKeywordHits.length > 0;

                          return (
                            <div key={message.id} style={{ display: "flex", justifyContent: isFirst ? "flex-start" : "flex-end", marginBottom: 8 }}>
                              <div style={{ maxWidth: "76%", borderRadius: 12, padding: "8px 10px", background: isFlaggedMessage ? "#fff7ed" : isFirst ? "var(--surface-panel)" : "var(--accent-soft)", border: isFlaggedMessage ? "1px solid #fdba74" : "1px solid var(--border-soft)", boxShadow: "var(--shadow-soft)" }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", marginBottom: 4 }}>
                                  {sender?.name || message.senderId} ({sender?.role || "user"})
                                </div>
                                <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.35 }}>
                                  {messageText}
                                </div>
                                {isFlaggedMessage ? (
                                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {messageKeywordHits.map((word) => (
                                      <span key={`${message.id}-${word}`} style={{ fontSize: 10, fontWeight: 800, color: "#9a3412", background: "#ffedd5", border: "1px solid #fdba74", borderRadius: 999, padding: "2px 7px" }}>
                                        {word}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-muted)", textAlign: "right" }}>{formatTime(message.timeStamp)}</div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
