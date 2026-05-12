import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FaSearch, FaUserShield, FaComments, FaChalkboardTeacher, FaUsers, FaExclamationTriangle, FaPlus } from "react-icons/fa";
import { FIREBASE_DATABASE_URL } from "../config.js";
import {
  buildChatSummaryPath,
  buildChatSummaryUpdate,
  fetchJson,
  mapInBatches,
  parseChatParticipantIds,
} from "../utils/chatRtdb";
import { fetchCachedJson } from "../utils/rtdbCache";

const ROLE_SET_CACHE_TTL_MS = 15 * 60 * 1000;

const RTDB_BASE = FIREBASE_DATABASE_URL;
const DEFAULT_ALERT_KEYWORDS = ["abuse", "insult", "harass", "threat", "meeting outside", "money transfer"];
const ALERT_KEYWORDS_STORAGE_KEY = "message_control_alert_keywords";
const REFRESH_INTERVAL_MS = 3 * 60 * 1000;
const REFRESH_IDLE_GRACE_MS = 5 * 60 * 1000;

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
  const hasLoadedRef = useRef(false);
  const refreshPromiseRef = useRef(null);
  const lastMonitorInteractionAtRef = useRef(Date.now());
  const userRecordCacheRef = useRef(new Map());
  const [selectedConversationMessages, setSelectedConversationMessages] = useState([]);
  const [selectedConversationMessagesLoading, setSelectedConversationMessagesLoading] = useState(false);
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
    const markInteraction = () => {
      lastMonitorInteractionAtRef.current = Date.now();
    };

    const handleVisibilityChange = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") {
        return;
      }
      markInteraction();
    };

    window.addEventListener("focus", markInteraction);
    window.addEventListener("online", markInteraction);
    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("touchstart", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", markInteraction);
      window.removeEventListener("online", markInteraction);
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!schoolCode) {
      setConversations([]);
      setSelectedChatId("");
      setSelectedConversationMessages([]);
      hasLoadedRef.current = false;
      refreshPromiseRef.current = null;
      return;
    }

    const loadMonitorData = async ({ reason = "active" } = {}) => {
      const isVisible = typeof document === "undefined" || document.visibilityState === "visible";
      const isOnline = typeof navigator === "undefined" || navigator.onLine !== false;
      const recentInteraction = Date.now() - lastMonitorInteractionAtRef.current < REFRESH_IDLE_GRACE_MS;
      const isUserDriven = reason !== "passive";

      if (!isUserDriven && (!isVisible || !isOnline || !recentInteraction)) {
        return;
      }

      if (refreshPromiseRef.current) {
        return refreshPromiseRef.current;
      }

      const requestPromise = (async () => {
        setLoading(!hasLoadedRef.current);
        setError("");
        try {
          const readUserRecord = async (userId) => {
            const normalizedUserId = String(userId || "").trim();
            if (!normalizedUserId) {
              return {};
            }

            const cacheKey = `${schoolCode}:${normalizedUserId}`;
            if (userRecordCacheRef.current.has(cacheKey)) {
              return userRecordCacheRef.current.get(cacheKey) || {};
            }

            let record = {};
            try {
              record = await fetchJson(
                `${SCHOOL_DB_ROOT}/Users/${encodeURIComponent(normalizedUserId)}.json`,
                {}
              );
            } catch {
              record = {};
            }

            if (!record || typeof record !== "object" || Array.isArray(record)) {
              record = {};
            }

            if (!Object.keys(record).length) {
              const orderByUserId = encodeURIComponent('"userId"');
              const equalToUserId = encodeURIComponent(`"${normalizedUserId}"`);
              const queriedUsers = await fetchJson(
                `${SCHOOL_DB_ROOT}/Users.json?orderBy=${orderByUserId}&equalTo=${equalToUserId}&limitToFirst=1`,
                {}
              );
              const firstMatch = Object.values(queriedUsers || {}).find(
                (candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate)
              );
              record = firstMatch || {};
            }

            userRecordCacheRef.current.set(cacheKey, record);
            return record;
          };

          const [
            teachersRes,
            studentsRes,
            parentsRes,
            managementRes,
            hrRes,
            registerersRes,
            schoolAdminsRes,
            chatIndex,
          ] = await Promise.all([
            fetchCachedJson(`${SCHOOL_DB_ROOT}/TeacherDirectory.json`, { ttlMs: ROLE_SET_CACHE_TTL_MS, fallbackValue: {} }),
            fetchCachedJson(`${SCHOOL_DB_ROOT}/StudentDirectory.json`, { ttlMs: ROLE_SET_CACHE_TTL_MS, fallbackValue: {} }),
            fetchCachedJson(`${SCHOOL_DB_ROOT}/ParentDirectory.json`, { ttlMs: ROLE_SET_CACHE_TTL_MS, fallbackValue: {} }),
            fetchJson(`${SCHOOL_DB_ROOT}/Management.json`, {}),
            fetchJson(`${SCHOOL_DB_ROOT}/HR.json`, {}),
            fetchJson(`${SCHOOL_DB_ROOT}/Registerers.json`, {}),
            fetchJson(`${SCHOOL_DB_ROOT}/School_Admins.json`, {}),
            fetchJson(`${SCHOOL_DB_ROOT}/Chats.json?shallow=true`, {}),
          ]);

          const chatIds = Object.keys(chatIndex || {});

          const toUserSet = (source) =>
            new Set(
              Object.values(source || {})
                .map((item) => String(item?.userId || "").trim())
                .filter(Boolean)
            );

          const roleSets = {
            teachers: toUserSet(teachersRes),
            students: toUserSet(studentsRes),
            parents: toUserSet(parentsRes),
            registerers: toUserSet(registerersRes),
            finance: toUserSet(hrRes),
            academic: new Set([...toUserSet(managementRes), ...toUserSet(schoolAdminsRes)]),
          };

          const parsedChatMetadata = await mapInBatches(chatIds, 20, async (chatId) => {
            const encodedChatId = encodeURIComponent(chatId);
            const [participantsNode, messageKeys, lastMessageNode] = await Promise.all([
              fetchJson(`${SCHOOL_DB_ROOT}/Chats/${encodedChatId}/participants.json`, {}),
              fetchJson(`${SCHOOL_DB_ROOT}/Chats/${encodedChatId}/messages.json?shallow=true`, {}),
              fetchJson(
                `${SCHOOL_DB_ROOT}/Chats/${encodedChatId}/messages.json?orderBy=${encodeURIComponent('"$key"')}&limitToLast=1`,
                {}
              ),
            ]);
            const participantIds = parseChatParticipantIds(chatId, participantsNode);
            const lastMessageValue = Object.values(lastMessageNode || {})[0] || {};

            return {
              chatId,
              participantIds,
              messageCount: Object.keys(messageKeys || {}).length,
              lastMessageText: String(lastMessageValue?.text || lastMessageValue?.message || "").trim(),
              lastMessageTime: Number(
                lastMessageValue?.timeStamp || lastMessageValue?.timestamp || lastMessageValue?.sentAt || 0
              ),
            };
          });

          const uniqueParticipantIds = Array.from(
            new Set(
              parsedChatMetadata
                .flatMap((chat) => chat?.participantIds || [])
                .map((value) => String(value || "").trim())
                .filter(Boolean)
            )
          );

          const usersById = new Map();
          await mapInBatches(uniqueParticipantIds, 24, async (participantUserId) => {
            const userRecord = await readUserRecord(participantUserId);
            usersById.set(participantUserId, userRecord || {});
            return null;
          });

          const parsedChats = parsedChatMetadata.map((chatMetadata) => {
            const participants = (chatMetadata.participantIds || []).slice(0, 2).map((id) => {
              const userNode = usersById.get(id) || {};
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

            return {
              chatId: chatMetadata.chatId,
              participants,
              category,
              categoryLabel: pairCategoryLabel[category] || "Other",
              messageCount: Number(chatMetadata.messageCount || 0),
              unreadTotal: 0,
              lastMessageText: String(chatMetadata.lastMessageText || "").trim(),
              lastMessageTime: Number(chatMetadata.lastMessageTime || 0),
              messages: [],
            };
          })
            .filter(Boolean)
            .sort((left, right) => Number(right.lastMessageTime || 0) - Number(left.lastMessageTime || 0));

          if (cancelled) {
            return;
          }

          setConversations(parsedChats);
          setSelectedChatId((previousChatId) => {
            if (previousChatId && parsedChats.some((chat) => chat.chatId === previousChatId)) {
              return previousChatId;
            }
            return "";
          });
        } catch (requestError) {
          if (!cancelled) {
            setError("Failed to load chat monitor data.");
          }
        } finally {
          if (!cancelled) {
            hasLoadedRef.current = true;
            setLoading(false);
          }
        }
      })();

      refreshPromiseRef.current = requestPromise;
      requestPromise.finally(() => {
        if (refreshPromiseRef.current === requestPromise) {
          refreshPromiseRef.current = null;
        }
      });

      return requestPromise;
    };

    const runFocusedRefresh = () => {
      lastMonitorInteractionAtRef.current = Date.now();
      void loadMonitorData({ reason: "active" });
    };

    const runPassiveRefresh = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void loadMonitorData({ reason: "passive" });
    };

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      runFocusedRefresh();
    };

    runFocusedRefresh();

    const intervalId = window.setInterval(runPassiveRefresh, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", runFocusedRefresh);
    window.addEventListener("online", runFocusedRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", runFocusedRefresh);
      window.removeEventListener("online", runFocusedRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [SCHOOL_DB_ROOT, schoolCode]);

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
        const flaggedMessages = conversation.chatId === selectedChatId
          ? selectedConversationMessages.filter((message) => {
              const matches = getMatchedKeywords(message?.text, alertKeywords);
              return matches.length > 0;
            })
          : getMatchedKeywords(conversation.lastMessageText, alertKeywords).length > 0
            ? [{ id: `${conversation.chatId}-last-message-flag` }]
            : [];

        return {
          ...conversation,
          flaggedCount: flaggedMessages.length,
        };
      }),
    [alertKeywords, filteredConversations, selectedChatId, selectedConversationMessages]
  );

  const selectedConversation =
    enrichedConversations.find((conversation) => conversation.chatId === selectedChatId) || null;

  const displayedSelectedConversationMessages =
    selectedConversation?.chatId === selectedChatId ? selectedConversationMessages : [];

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
    const selectedConversation = conversations.find((conversation) => conversation.chatId === chatId) || null;
    setSelectedChatId(chatId);
    setSelectedConversationMessages([]);
    setConversations((previousConversations) =>
      previousConversations.map((conversation) =>
        conversation.chatId === chatId
          ? { ...conversation, unreadTotal: 0 }
          : conversation
      )
    );

    try {
      const participants = Array.isArray(selectedConversation?.participants) ? selectedConversation.participants : [];
      await Promise.all(
        participants
          .filter((participant) => String(participant?.userId || "").trim())
          .map((participant) => {
            const otherParticipant = participants.find(
              (candidate) => String(candidate?.userId || "").trim() !== String(participant?.userId || "").trim()
            );
            return axios.patch(
              `${SCHOOL_DB_ROOT}/${buildChatSummaryPath(participant.userId, chatId)}.json`,
              buildChatSummaryUpdate({
                chatId,
                otherUserId: otherParticipant?.userId || "",
                unreadCount: 0,
              })
            );
          })
      );
    } catch {
      // keep UI updated even if remote reset fails
    }
  };

  useEffect(() => {
    if (!selectedChatId || !schoolCode) {
      setSelectedConversationMessages([]);
      setSelectedConversationMessagesLoading(false);
      return;
    }

    let cancelled = false;

    const loadConversationMessages = async () => {
      setSelectedConversationMessagesLoading(true);
      try {
        const messagesNode = await fetchJson(
          `${SCHOOL_DB_ROOT}/Chats/${encodeURIComponent(selectedChatId)}/messages.json`,
          {}
        );

        if (cancelled) {
          return;
        }

        const parsedMessages = Object.entries(messagesNode || {})
          .map(([messageId, messageValue]) => ({
            id: messageId,
            ...messageValue,
            timeStamp: Number(messageValue?.timeStamp || 0),
          }))
          .sort((left, right) => Number(left.timeStamp || 0) - Number(right.timeStamp || 0));

        setSelectedConversationMessages(parsedMessages);
        setConversations((previousConversations) =>
          previousConversations.map((conversation) =>
            conversation.chatId === selectedChatId
              ? { ...conversation, messageCount: parsedMessages.length }
              : conversation
          )
        );
      } catch {
        if (!cancelled) {
          setSelectedConversationMessages([]);
        }
      } finally {
        if (!cancelled) {
          setSelectedConversationMessagesLoading(false);
        }
      }
    };

    loadConversationMessages();

    return () => {
      cancelled = true;
    };
  }, [SCHOOL_DB_ROOT, schoolCode, selectedChatId]);

  const FEED_MAX_WIDTH = "min(1320px, 100%)";
  const PRIMARY = "#007afb";
  const BACKGROUND = "#ffffff";
  const ACCENT = "#00B6A9";
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
  const headerCardStyle = {
    ...shellCardStyle,
    width: "100%",
    maxWidth: FEED_MAX_WIDTH,
    margin: "0 auto",
    alignSelf: "stretch",
    color: "var(--text-primary)",
    padding: "18px 20px",
    position: "relative",
    overflow: "hidden",
    background: "linear-gradient(135deg, color-mix(in srgb, var(--surface-panel) 88%, white) 0%, color-mix(in srgb, var(--surface-panel) 94%, var(--surface-accent)) 100%)",
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
    <div
      className="dashboard-page"
      style={{
        background: BACKGROUND,
        minHeight: "100vh",
        color: "var(--text-primary)",
        "--page-bg": BACKGROUND,
        "--page-bg-secondary": "#F7FBFF",
        "--surface-panel": BACKGROUND,
        "--surface-muted": "#F8FBFF",
        "--surface-accent": "#EAF4FF",
        "--surface-strong": "#D7E7FB",
        "--border-soft": "#D7E7FB",
        "--border-strong": "#B5D2F8",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": PRIMARY,
        "--accent-soft": "#E7F2FF",
        "--accent-strong": PRIMARY,
        "--success": ACCENT,
        "--success-soft": "#E9FBF9",
        "--success-border": "#AAEDE7",
        "--warning": "#DC2626",
        "--warning-soft": "#FEE2E2",
        "--warning-border": "#FCA5A5",
        "--danger": "#b91c1c",
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
      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "18px 14px", minHeight: "100vh", background: "var(--page-bg)", width: "100%", boxSizing: "border-box", alignItems: "flex-start" }}>
        <div
          className="admin-sidebar-spacer"
          style={{
            width: "var(--sidebar-width)",
            minWidth: "var(--sidebar-width)",
            flex: "0 0 var(--sidebar-width)",
            pointerEvents: "none",
          }}
        />

        <div className="main-content" style={{ flex: "1 1 0", minWidth: 0, maxWidth: "none", margin: 0, boxSizing: "border-box", alignSelf: "flex-start", minHeight: "calc(100vh - 24px)", overflowY: "visible", overflowX: "hidden", position: "relative", padding: "0 12px 0 2px", display: "flex", justifyContent: "center" }}>
          <div className="main-inner" style={{ ...FEED_SECTION_STYLE, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 56 }}>
            <div style={headerCardStyle}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, var(--accent), var(--accent-strong), color-mix(in srgb, var(--accent) 68%, white))" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h2 className="section-header-card__title" style={{ fontSize: "24px", margin: 0, fontWeight: 800, letterSpacing: "0.01em" }}>Message Control</h2>
                  <div className="section-header-card__subtitle" style={{ marginTop: 8, color: "var(--text-secondary)", fontSize: 13 }}>
                    Monitor teachers, students, parents, academic office, finance, and registerer chats for educational purpose.
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, color: "var(--accent-strong)", padding: "8px 12px", borderRadius: 999, background: "color-mix(in srgb, var(--surface-muted) 86%, white)", border: "1px solid var(--border-soft)" }}>
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

            <div style={{ ...shellCardStyle, padding: 12, background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-overlay) 100%)", display: "flex", flexDirection: "column", gap: 8, borderRadius: 16 }}>
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
                height: isCompactLayout ? 700 : 620,
                minHeight: 0,
                overflow: "hidden",
                borderRadius: 18,
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
                      {selectedConversationMessagesLoading ? (
                        <div style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 20 }}>Loading messages...</div>
                      ) : displayedSelectedConversationMessages.length === 0 ? (
                        <div style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 20 }}>No messages in this conversation.</div>
                      ) : (
                        displayedSelectedConversationMessages.map((message) => {
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
