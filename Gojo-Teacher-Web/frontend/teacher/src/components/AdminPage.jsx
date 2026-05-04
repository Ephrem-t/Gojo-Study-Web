import React, { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  ref as dbRef,
  onValue,
  update,
  query as dbQuery,
  orderByChild,
  limitToLast,
  endAt,
  get,
  push,
  runTransaction,
} from "firebase/database";
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

const QUICK_CHAT_HISTORY_LIMIT = 50;

const normalizeIdentifier = (value) => String(value || "").trim();

const mergeChatMessages = (...groups) => {
  const merged = new Map();

  groups
    .flat()
    .filter(Boolean)
    .forEach((message) => {
      const key = String(message?.id || message?.messageId || "").trim();
      if (!key) return;

      const previous = merged.get(key) || {};
      merged.set(key, {
        ...previous,
        ...message,
        id: key,
        messageId: key,
      });
    });

  return [...merged.values()].sort(
    (leftMessage, rightMessage) =>
      Number(leftMessage?.timeStamp || 0) - Number(rightMessage?.timeStamp || 0)
  );
};

const normalizeRole = (value) => String(value || "").trim().toLowerCase();

const isActiveRecord = (record = {}) => {
  const raw = record?.status ?? record?.isActive;
  if (typeof raw === "boolean") return raw;
  const normalized = String(raw || "active").toLowerCase();
  return normalized === "active" || normalized === "true" || normalized === "1";
};

const isAcademicAdmin = ({ schoolAdmin = {}, user = {} } = {}) => {
  const role = normalizeRole(user?.role || user?.userType || schoolAdmin?.role);
  const text = [
    schoolAdmin?.title,
    schoolAdmin?.department,
    schoolAdmin?.office,
    schoolAdmin?.position,
    schoolAdmin?.responsibility,
    user?.title,
    user?.department,
    user?.position,
    user?.responsibility,
    role,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!text.trim()) {
    return role === "admin" || role === "school_admin" || role === "school_admins";
  }

  return ["academic", "academics", "principal", "vice principal", "dean", "curriculum"].some((k) => text.includes(k));
};

const isManagementEligible = ({ source = "", record = {}, user = {} } = {}) => {
  const role = normalizeRole(user?.role || user?.userType || record?.role || source);
  const text = [
    source,
    role,
    record?.title,
    record?.department,
    record?.office,
    record?.position,
    record?.responsibility,
    user?.title,
    user?.department,
    user?.position,
    user?.responsibility,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return [
    "academic",
    "academics",
    "principal",
    "vice principal",
    "dean",
    "curriculum",
    "admin",
    "management",
    "hr",
    "human resource",
    "register",
    "registrar",
  ].some((keyword) => text.includes(keyword));
};

const DEFAULT_PROFILE_IMAGE = "/default-profile.png";

const getInitials = (name) => {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "U";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
};

const createPlaceholderAvatar = (name) => {
  const initials = getInitials(name);
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#2563eb'/>
      <stop offset='100%' stop-color='#0ea5e9'/>
    </linearGradient>
  </defs>
  <rect width='160' height='160' rx='80' fill='url(#g)'/>
  <text x='50%' y='53%' dominant-baseline='middle' text-anchor='middle' fill='white' font-family='Segoe UI, Arial, sans-serif' font-size='56' font-weight='700'>${initials}</text>
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const sanitizeProfileImage = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_PROFILE_IMAGE;

  const lower = raw.toLowerCase();
  if (lower.startsWith("file://") || lower.startsWith("content://")) {
    return DEFAULT_PROFILE_IMAGE;
  }

  return raw;
};

const resolveAvatarSrc = (rawValue, name) => {
  const sanitized = sanitizeProfileImage(rawValue);
  if (!sanitized || sanitized === DEFAULT_PROFILE_IMAGE) {
    return createPlaceholderAvatar(name);
  }
  return sanitized;
};

const normalizeValueForCompare = (value) => String(value ?? "").trim().toLowerCase();

const normalizeFieldLabel = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const formatDateTime = (value) => {
  if (!value && value !== 0) return "";
  const asNumber = Number(value);
  const date = Number.isFinite(asNumber) && asNumber > 0 ? new Date(asNumber) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const uniqueRows = (rows = [], blocked = new Set()) => {
  const seen = new Set();

  return rows.filter((row) => {
    const label = normalizeFieldLabel(row?.label);
    const value = String(row?.value || "").trim();
    if (!label || !value) return false;

    const valueKey = normalizeValueForCompare(value);
    const labelKey = normalizeValueForCompare(label);
    const signature = `${labelKey}__${valueKey}`;

    if (seen.has(signature)) return false;
    if (blocked.has(valueKey)) return false;

    seen.add(signature);
    return true;
  });
};

const getStoredTeacher = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("teacher");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    localStorage.removeItem("teacher");
    return null;
  }
};

const findUserByUserId = (usersObj, userId) => {
  if (!usersObj || !userId) return null;
  const normalizedUserId = String(userId || "").trim();
  if (usersObj[normalizedUserId]) return usersObj[normalizedUserId];

  return (
    Object.entries(usersObj).find(([userKey, userValue]) => {
      return (
        String(userKey || "").trim() === normalizedUserId ||
        String(userValue?.userId || "").trim() === normalizedUserId
      );
    })?.[1] || null
  );
};

const isPortraitViewport = () => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < window.innerHeight;
};

import { API_BASE } from "../api/apiConfig";
import { getRtdbRoot, RTDB_BASE_RAW } from "../api/rtdbScope";

const getResolvedSchoolCodeFromBase = (baseValue, fallback = "") => {
  const base = String(baseValue || "").trim();
  const marker = "/Platform1/Schools/";
  const markerIndex = base.indexOf(marker);

  if (markerIndex >= 0) {
    return base.slice(markerIndex + marker.length).replace(/\/+$/, "");
  }

  return String(fallback || "").trim();
};

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
      background: "#ffffff",
      border: selected ? "1px solid #93c5fd" : "1px solid #e2e8f0",
      boxShadow: selected
        ? "0 14px 28px rgba(37, 99, 235, 0.16), inset 3px 0 0 #2563eb"
        : "0 4px 10px rgba(15, 23, 42, 0.06)",
      transition: "all 0.3s ease",
    }}
  >
    <div style={{
      width: 36,
      height: 36,
      borderRadius: "50%",
      background: selected ? "#1d4ed8" : "#eef2ff",
      color: selected ? "#fff" : "#334155",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 800,
      fontSize: 12,
      flexShrink: 0,
    }}>{number}</div>

    <img
      src={resolveAvatarSrc(admin.profileImage, admin.name)}
      alt={admin.name}
      onError={(event) => {
        const fallback = createPlaceholderAvatar(admin?.name || "Management");
        if (event.currentTarget.src === fallback) return;
        event.currentTarget.src = fallback;
      }}
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        objectFit: "cover",
        border: selected ? "3px solid #2563eb" : "3px solid #dbeafe",
      }}
    />
    <div>
      <h3 style={{ margin: 0, fontSize: 14 }}>{admin.name}</h3>
      <p style={{ margin: "4px 0", color: "#555", fontSize: 11 }}>
        {admin.title || admin.username || admin.email || "Management"}
      </p>
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

  const [newMessageText, setNewMessageText] = useState("");
  const [liveQuickChatMessages, setLiveQuickChatMessages] = useState([]);
  const [olderQuickChatMessages, setOlderQuickChatMessages] = useState([]);
  const [quickChatLoading, setQuickChatLoading] = useState(false);
  const [quickChatLoadingOlder, setQuickChatLoadingOlder] = useState(false);
  const [quickChatHasOlder, setQuickChatHasOlder] = useState(false);
  const [quickChatTarget, setQuickChatTarget] = useState(null);
  const messagesEndRef = useRef(null);
  const quickChatMessagesRef = useRef(null);
  const quickChatScrollRestoreRef = useRef(null);

  const [teacher, setTeacher] = useState(null);
  const [rtdbBase, setRtdbBase] = useState(() => getRtdbRoot());
  const [schoolBaseResolved, setSchoolBaseResolved] = useState(false);
  const teacherUserId = String(teacher?.userId || "");

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const postRefs = useRef({});

  // Messenger states (same behavior as Dashboard)
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]); // conversations with unread messages for this admin

  const navigate = useNavigate();
  const resolvedSchoolCode = useMemo(
    () => getResolvedSchoolCodeFromBase(rtdbBase, teacher?.schoolCode),
    [rtdbBase, teacher?.schoolCode]
  );
  const messages = useMemo(
    () => mergeChatMessages(olderQuickChatMessages, liveQuickChatMessages),
    [olderQuickChatMessages, liveQuickChatMessages]
  );

  useEffect(() => {
    const storedTeacher = getStoredTeacher();
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  useEffect(() => {
    const resolveSchoolBase = async () => {
      if (!teacher) return;
      setSchoolBaseResolved(false);

      const rawSchoolCode = String(teacher?.schoolCode || "").trim();
      if (!rawSchoolCode) {
        setRtdbBase(getRtdbRoot());
        setSchoolBaseResolved(true);
        return;
      }

      if (rawSchoolCode.startsWith("ET-")) {
        setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${rawSchoolCode}`);
        setSchoolBaseResolved(true);
        return;
      }

      try {
        const shortCode = rawSchoolCode.toUpperCase();
        const mapRes = await axios.get(`${RTDB_BASE_RAW}/Platform1/schoolCodeIndex/${shortCode}.json`);
        const mappedCode = String(mapRes?.data || "").trim();
        if (mappedCode) {
          setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${mappedCode}`);
          setSchoolBaseResolved(true);
          return;
        }
      } catch {
        // Fallback scan handles missing mapping entries.
      }

      try {
        const schoolsRes = await axios.get(`${RTDB_BASE_RAW}/Platform1/Schools.json`);
        const schoolsObj = schoolsRes?.data && typeof schoolsRes.data === "object" ? schoolsRes.data : {};
        const shortCode = rawSchoolCode.toUpperCase();
        const fallbackMatch = Object.entries(schoolsObj).find(([schoolCode, schoolNode]) => {
          const nodeShort = String(
            schoolNode?.schoolInfo?.shortName ||
              schoolNode?.schoolInfo?.shortCode ||
              schoolNode?.schoolCode ||
              ""
          )
            .trim()
            .toUpperCase();
          return nodeShort === shortCode || String(schoolCode || "").toUpperCase().includes(shortCode);
        });

        if (fallbackMatch?.[0]) {
          setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${fallbackMatch[0]}`);
          setSchoolBaseResolved(true);
          return;
        }
      } catch {
        // Keep final fallback below.
      }

      setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${rawSchoolCode}`);
      setSchoolBaseResolved(true);
    };

    resolveSchoolBase();
  }, [teacher]);

  // fetch conversations when teacher is available
  useEffect(() => {
    if (teacher) fetchConversations(teacher);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher]);

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  const closeAdminQuickChat = () => {
    setAdminChatOpen(false);
    setQuickChatTarget(null);
  };

  const openAdminQuickChat = () => {
    const targetUserId = normalizeIdentifier(selectedAdmin?.userId);
    if (!targetUserId) return;

    setQuickChatTarget({
      ...selectedAdmin,
      userId: targetUserId,
      profileImage: resolveAvatarSrc(selectedAdmin?.profileImage, selectedAdmin?.name),
    });
    setAdminChatOpen(true);
  };

  // ---------------- FETCH ADMINS ----------------
  useEffect(() => {
    async function fetchAdmins() {
      try {
        if (!schoolBaseResolved || !rtdbBase) return;
        setLoading(true);
        const [usersRes, schoolAdminsRes, managementRes, hrRes, registerersRes] = await Promise.all([
          axios.get(`${rtdbBase}/Users.json`),
          axios.get(`${rtdbBase}/School_Admins.json`),
          axios.get(`${rtdbBase}/Management.json`),
          axios.get(`${rtdbBase}/HR.json`),
          axios.get(`${rtdbBase}/Registerers.json`),
        ]);

        const users = usersRes.data || {};
        const schoolAdmins = schoolAdminsRes.data || {};
        const management = managementRes.data || {};
        const hr = hrRes.data || {};
        const registerers = registerersRes.data || {};

        const managementCandidates = [];
        Object.entries(schoolAdmins).forEach(([recordKey, record]) => {
          managementCandidates.push({ source: "school_admin", recordKey, record });
        });
        Object.entries(management).forEach(([recordKey, record]) => {
          managementCandidates.push({ source: "management", recordKey, record });
        });
        Object.entries(hr).forEach(([recordKey, record]) => {
          managementCandidates.push({ source: "hr", recordKey, record });
        });
        Object.entries(registerers).forEach(([recordKey, record]) => {
          managementCandidates.push({ source: "registerer", recordKey, record });
        });

        const allAdmins = managementCandidates
          .map(({ source, recordKey, record }) => {
            const userId = String(record?.userId || "").trim();
            const user = findUserByUserId(users, userId) || {};
            const resolvedUserId = userId || String(user?.userId || recordKey || "").trim();

            return {
              adminId: record?.adminId || record?.managementId || record?.hrId || record?.registererId || recordKey,
              source,
              recordKey,
              userId: resolvedUserId,
              username: user?.username || record?.username || "",
              name: user?.name || record?.name || record?.title || "Management",
              email: user?.email || record?.email || "",
              phone: user?.phone || record?.phone || "",
              profileImage: resolveAvatarSrc(user.profileImage || user.profile || user.avatar || record.profileImage || record.profile, user?.name || record?.name || record?.title || "Management"),
              title:
                record?.title ||
                user?.title ||
                user?.role ||
                source.replace("_", " "),
              role: user?.role || record?.role || source,
              status: record?.status || user?.status || (user?.isActive === true ? "active" : "inactive"),
              schoolCode: record?.schoolCode || user?.schoolCode || teacher?.schoolCode || "",
              department: record?.department || user?.department || "",
              office: record?.office || user?.office || "",
              position: record?.position || user?.position || "",
              responsibility: record?.responsibility || user?.responsibility || "",
              record,
              user,
            };
          })
          .filter((candidate) => candidate.userId)
          .filter((candidate) => isActiveRecord(candidate.record || candidate.user))
          .filter((candidate) => {
            if (candidate.source === "school_admin") {
              return isAcademicAdmin({ schoolAdmin: candidate.record, user: candidate.user });
            }
            return isManagementEligible({ source: candidate.source, record: candidate.record, user: candidate.user });
          })
          .filter((candidate) => candidate.name || candidate.email || candidate.userId)
          .filter((item, index, array) => array.findIndex((entry) => entry.userId === item.userId) === index)
          .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

        setAdmins(allAdmins);
        setError(allAdmins.length === 0 ? "No management contacts found" : "");
      } catch (err) {
        console.error(err);
        setError("Failed to fetch management contacts");
      } finally {
        setLoading(false);
      }
    }

    fetchAdmins();
  }, [teacher?.schoolCode, schoolBaseResolved, rtdbBase]);

  useEffect(() => {
    if (selectedAdmin || !adminChatOpen) return;
    closeAdminQuickChat();
  }, [selectedAdmin, adminChatOpen]);

  useEffect(() => {
    const restoreSnapshot = quickChatScrollRestoreRef.current;
    const scrollContainer = quickChatMessagesRef.current;

    if (restoreSnapshot && scrollContainer) {
      scrollContainer.scrollTop =
        restoreSnapshot.previousScrollTop +
        (scrollContainer.scrollHeight - restoreSnapshot.previousScrollHeight);
      quickChatScrollRestoreRef.current = null;
      return;
    }

    if (!adminChatOpen) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: messages.length > QUICK_CHAT_HISTORY_LIMIT ? "auto" : "smooth",
      block: "end",
    });
  }, [adminChatOpen, messages]);

  useEffect(() => {
    if (!adminChatOpen || !teacherUserId || !quickChatTarget?.userId || !schoolBaseResolved) {
      setLiveQuickChatMessages([]);
      setOlderQuickChatMessages([]);
      setQuickChatLoading(false);
      setQuickChatLoadingOlder(false);
      setQuickChatHasOlder(false);
      quickChatScrollRestoreRef.current = null;
      return;
    }

    const chatKey = getChatId(teacherUserId, quickChatTarget.userId);
    const messagesRef = dbQuery(
      dbRef(db, schoolPath(`Chats/${chatKey}/messages`, resolvedSchoolCode)),
      orderByChild("timeStamp"),
      limitToLast(QUICK_CHAT_HISTORY_LIMIT)
    );

    setQuickChatLoading(true);

    const unsubscribe = onValue(
      messagesRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        const msgs = Object.entries(data)
          .map(([id, message]) => ({
            id,
            messageId: id,
            ...message,
            isTeacher: String(message?.senderId || "") === String(teacherUserId),
          }))
          .sort(
            (leftMessage, rightMessage) =>
              Number(leftMessage?.timeStamp || 0) - Number(rightMessage?.timeStamp || 0)
          );

        setLiveQuickChatMessages(msgs);
        setQuickChatHasOlder((previousValue) => previousValue || msgs.length >= QUICK_CHAT_HISTORY_LIMIT);
        setQuickChatLoading(false);
      },
      (chatError) => {
        console.error("Failed to load quick chat messages:", chatError);
        setLiveQuickChatMessages([]);
        setOlderQuickChatMessages([]);
        setQuickChatHasOlder(false);
        setQuickChatLoading(false);
      }
    );

    return () => unsubscribe();
  }, [adminChatOpen, teacherUserId, quickChatTarget?.userId, schoolBaseResolved, resolvedSchoolCode]);

  const loadOlderMessages = async () => {
    if (
      quickChatLoading ||
      quickChatLoadingOlder ||
      !adminChatOpen ||
      !teacherUserId ||
      !quickChatTarget?.userId ||
      messages.length === 0
    ) {
      return;
    }

    const oldestMessageTimeStamp = Number(messages[0]?.timeStamp || 0);
    if (!oldestMessageTimeStamp) {
      setQuickChatHasOlder(false);
      return;
    }

    const scrollContainer = quickChatMessagesRef.current;
    if (scrollContainer) {
      quickChatScrollRestoreRef.current = {
        previousScrollHeight: scrollContainer.scrollHeight,
        previousScrollTop: scrollContainer.scrollTop,
      };
    }

    setQuickChatLoadingOlder(true);

    try {
      const chatId = getChatId(teacherUserId, quickChatTarget.userId);
      const olderMessagesRef = dbQuery(
        dbRef(db, schoolPath(`Chats/${chatId}/messages`, resolvedSchoolCode)),
        orderByChild("timeStamp"),
        endAt(oldestMessageTimeStamp - 1),
        limitToLast(QUICK_CHAT_HISTORY_LIMIT)
      );

      const snapshot = await get(olderMessagesRef);
      const data = snapshot.val() || {};
      const olderMessagesPage = Object.entries(data)
        .map(([id, message]) => ({
          id,
          messageId: id,
          ...message,
          isTeacher: String(message?.senderId || "") === String(teacherUserId),
        }))
        .sort(
          (leftMessage, rightMessage) =>
            Number(leftMessage?.timeStamp || 0) - Number(rightMessage?.timeStamp || 0)
        );

      if (!olderMessagesPage.length) {
        setQuickChatHasOlder(false);
        quickChatScrollRestoreRef.current = null;
        return;
      }

      setOlderQuickChatMessages((previousMessages) =>
        mergeChatMessages(olderMessagesPage, previousMessages)
      );
      setQuickChatHasOlder(olderMessagesPage.length >= QUICK_CHAT_HISTORY_LIMIT);
    } catch (chatError) {
      console.error("Failed to load older quick chat messages:", chatError);
      quickChatScrollRestoreRef.current = null;
    } finally {
      setQuickChatLoadingOlder(false);
    }
  };

  useEffect(() => {
    if (!adminChatOpen || !quickChatTarget?.userId || !teacherUserId) return;
    if (!messages || messages.length === 0) return;

    const unseen = messages.filter(
      (message) => String(message?.receiverId || "") === String(teacherUserId) && !message?.seen
    );
    if (unseen.length === 0) return;

    const chatId = getChatId(teacherUserId, quickChatTarget.userId);
    const timeStamp = Date.now();
    const payload = {
      [`unread/${teacherUserId}`]: 0,
      "lastMessage/seen": true,
      "lastMessage/seenAt": timeStamp,
    };

    unseen.forEach((message) => {
      payload[`messages/${message.id}/seen`] = true;
      payload[`messages/${message.id}/seenAt`] = timeStamp;
    });

    update(dbRef(db, schoolPath(`Chats/${chatId}`, resolvedSchoolCode)), payload).catch((chatError) =>
      console.error("Failed to mark messages seen:", chatError)
    );
  }, [adminChatOpen, messages, quickChatTarget?.userId, teacherUserId, resolvedSchoolCode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = String(newMessageText || "").trim();
    if (!text || !quickChatTarget?.userId || !teacherUserId) return;

    const senderId = teacherUserId;
    const receiverId = quickChatTarget.userId;
    const chatId = getChatId(senderId, receiverId);
    const timeStamp = Date.now();

    const message = {
      senderId,
      receiverId,
      type: "text",
      text,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp,
    };

    try {
      await push(dbRef(db, schoolPath(`Chats/${chatId}/messages`, resolvedSchoolCode)), message);

      await update(dbRef(db, schoolPath(`Chats/${chatId}`, resolvedSchoolCode)), {
        [`participants/${senderId}`]: true,
        [`participants/${receiverId}`]: true,
        "lastMessage/text": text,
        "lastMessage/senderId": senderId,
        "lastMessage/seen": false,
        "lastMessage/timeStamp": timeStamp,
        [`unread/${senderId}`]: 0,
      });

      setNewMessageText("");

      await runTransaction(
        dbRef(db, schoolPath(`Chats/${chatId}/unread/${receiverId}`, resolvedSchoolCode)),
        (current) => (Number(current) || 0) + 1
      );
    } catch (err) {
      console.error("Failed to send quick chat message:", err);
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
        axios.get(`${rtdbBase}/School_Admins.json`),
        axios.get(`${rtdbBase}/Users.json`),
      ]);
      const schoolAdmins = adminsRes.data || {};
      const users = usersRes.data || {};

      // Get teacher from localStorage so we know who's seen what
      const currentTeacher = getStoredTeacher();
      const seenPosts = getSeenPosts(currentTeacher?.userId);

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
  try {
    return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
  } catch {
    return [];
  }
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
      const t = currentTeacher || getStoredTeacher();
      if (!t || !t.userId) {
        setConversations([]);
        return;
      }

      const [chatsRes, usersRes] = await Promise.all([axios.get(`${rtdbBase}/Chats.json`), axios.get(`${rtdbBase}/Users.json`)]);
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
      await axios.put(`${rtdbBase}/Chats/${chatId}/unread/${teacher.userId}.json`, null);
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }

    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };

  const totalUnreadMessages = conversations.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);

const [isPortrait, setIsPortrait] = React.useState(() => isPortraitViewport());

React.useEffect(() => {
  const handleResize = () => {
    setIsPortrait(isPortraitViewport());
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

  const detailBlockedValues = useMemo(() => {
    if (!selectedAdmin) return new Set();

    const statusLabel = selectedAdmin.status
      ? `${selectedAdmin.status.charAt(0).toUpperCase()}${selectedAdmin.status.slice(1)}`
      : "";

    const values = [
      selectedAdmin.adminId || selectedAdmin.userId,
      String(selectedAdmin.source || "management").replace("_", " "),
      selectedAdmin.email,
      selectedAdmin.phone,
      selectedAdmin.title,
      selectedAdmin.role,
      selectedAdmin.department,
      selectedAdmin.office,
      selectedAdmin.position,
      selectedAdmin.schoolCode,
      statusLabel,
      selectedAdmin.userId,
    ]
      .map((v) => normalizeValueForCompare(v))
      .filter(Boolean);

    return new Set(values);
  }, [selectedAdmin]);

  const statusRows = useMemo(() => {
    if (!selectedAdmin) return [];

    const record = selectedAdmin.record || {};
    const user = selectedAdmin.user || {};
    const active = isActiveRecord(record) || isActiveRecord(user);

    const rows = [
      { label: "Account Activity", value: active ? "Active" : "Inactive" },
      { label: "Verification", value: user?.isVerified === true || record?.isVerified === true ? "Verified" : "Not verified" },
      { label: "Approval", value: record?.approvalStatus || user?.approvalStatus || "" },
      { label: "Created", value: formatDateTime(record?.createdAt || user?.createdAt) },
      { label: "Last Updated", value: formatDateTime(record?.updatedAt || user?.updatedAt) },
      { label: "Last Login", value: formatDateTime(user?.lastLogin || user?.lastLoginAt || record?.lastLogin || record?.lastLoginAt) },
      { label: "Employment Type", value: record?.employmentType || user?.employmentType || "" },
      { label: "Assigned Campus", value: record?.campus || user?.campus || "" },
      { label: "Shift", value: record?.shift || user?.shift || "" },
      { label: "Responsibility", value: selectedAdmin?.responsibility || "" },
    ];

    return uniqueRows(rows, detailBlockedValues);
  }, [selectedAdmin, detailBlockedValues]);

  const notesRows = useMemo(() => {
    if (!selectedAdmin) return [];

    const record = selectedAdmin.record || {};
    const user = selectedAdmin.user || {};
    const blocked = new Set([...detailBlockedValues]);
    statusRows.forEach((item) => blocked.add(normalizeValueForCompare(item?.value)));

    const candidateEntries = [
      ["Responsibilities", selectedAdmin?.responsibility || record?.responsibility],
      ["Summary", record?.summary || user?.summary],
      ["Bio", record?.bio || user?.bio],
      ["Specialization", record?.specialization || user?.specialization],
      ["Qualification", record?.qualification || user?.qualification],
      ["Experience", record?.experience || user?.experience],
      ["Office Hours", record?.officeHours || user?.officeHours],
      ["Address", record?.address || user?.address],
      ["Notes", record?.notes || user?.notes],
      ["Remarks", record?.remarks || user?.remarks],
      ["Emergency Contact", record?.emergencyContact || user?.emergencyContact],
      ["Alternate Phone", record?.alternatePhone || user?.alternatePhone],
    ];

    const rows = candidateEntries.map(([label, value]) => {
      if (value && typeof value === "object") {
        return { label, value: Object.entries(value).map(([k, v]) => `${normalizeFieldLabel(k)}: ${String(v || "").trim()}`).filter(Boolean).join(" | ") };
      }
      return { label, value: String(value || "").trim() };
    });

    return uniqueRows(rows, blocked);
  }, [selectedAdmin, detailBlockedValues, statusRows]);




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
        "--surface-muted": "#ffffff",
        "--surface-strong": "#e2e8f0",
        "--page-bg": "#ffffff",
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
      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px", height: "calc(100vh - 73px)", overflow: "hidden", background: "#ffffff" }}>
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
        <div style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", overflowX: "hidden", display: "flex", justifyContent: "flex-start", padding: "10px 20px 20px", boxSizing: "border-box", background: "#ffffff" }}>
          <div
            className="admin-list-card-responsive"
            style={{
              width: listShellWidth,
              position: "relative",
              marginLeft: 0,
              marginRight: isPortrait ? 0 : "24px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 18,
              boxShadow: "0 10px 26px rgba(15, 23, 42, 0.08)",
              padding: 14,
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
              <h2 className="section-header-card__title" style={{ fontSize: 20 }}>Management</h2>
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
                  placeholder="Search management..."
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
                      src={resolveAvatarSrc(selectedAdmin.profileImage, selectedAdmin.name)}
                      alt={selectedAdmin.name}
                      onError={(event) => {
                        const fallback = createPlaceholderAvatar(selectedAdmin?.name || "Management");
                        if (event.currentTarget.src === fallback) return;
                        event.currentTarget.src = fallback;
                      }}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 14, color: "#ffffff", fontWeight: 800 }}>{selectedAdmin.name}</h3>
                  <div style={{ color: "#dbeafe", marginTop: 6, fontSize: 10 }}>{selectedAdmin.username || selectedAdmin.email}</div>
                </div>

                <div style={{ display: "flex", marginBottom: "10px", borderBottom: "1px solid var(--border-soft)" }}>
                  {["details", "status", "notes"].map((tab) => (
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
                      {tab === "details" ? "DETAILS" : tab === "status" ? "STATUS" : "NOTES"}
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
                          Management Profile
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
                            ["ID", selectedAdmin.adminId || selectedAdmin.userId],
                            ["Source", String(selectedAdmin.source || "management").replace("_", " ")],
                            ["Email", selectedAdmin.email],
                            ["Phone", selectedAdmin.phone],
                            ["Title", selectedAdmin.title],
                            ["Role", selectedAdmin.role],
                            ["Department", selectedAdmin.department],
                            ["Office", selectedAdmin.office],
                            ["Position", selectedAdmin.position],
                            ["School Code", selectedAdmin.schoolCode],
                            ["Status", selectedAdmin.status ? (selectedAdmin.status.charAt(0).toUpperCase() + selectedAdmin.status.slice(1)) : null],
                            ["User ID", selectedAdmin.userId, true],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              style={{
                                padding: 8,
                                borderRadius: 10,
                                background: "var(--surface-panel)",
                                border: "1px solid var(--border-soft)",
                                boxShadow: "none",
                                gridColumn: label === "User ID" ? "span 2" : "span 1",
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
                                  wordBreak: label === "User ID" ? "break-all" : "normal",
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

                  {adminTab === "status" && (
                    <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, boxShadow: "var(--shadow-soft)", padding: 12, display: "grid", gap: 10 }}>
                      <div
                        style={{
                          borderRadius: 12,
                          border: "1px solid #dbeafe",
                          background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 72%)",
                          padding: "10px 12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#1e3a8a" }}>Current Status</div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: isActiveRecord(selectedAdmin?.record || selectedAdmin?.user) ? "#166534" : "#b91c1c",
                            background: isActiveRecord(selectedAdmin?.record || selectedAdmin?.user) ? "#dcfce7" : "#fee2e2",
                            border: isActiveRecord(selectedAdmin?.record || selectedAdmin?.user) ? "1px solid #86efac" : "1px solid #fecaca",
                            borderRadius: 999,
                            padding: "3px 8px",
                            textTransform: "uppercase",
                            letterSpacing: "0.3px",
                          }}
                        >
                          {isActiveRecord(selectedAdmin?.record || selectedAdmin?.user) ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {statusRows.length === 0 ? (
                        <div style={{ fontSize: 11, color: "#64748b" }}>No additional status information found.</div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {statusRows.map((item, index) => (
                            <div
                              key={`${item.label}-${index}`}
                              style={{
                                padding: 8,
                                borderRadius: 10,
                                border: "1px solid var(--border-soft)",
                                background: "#ffffff",
                              }}
                            >
                              <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.55px" }}>
                                {item.label}
                              </div>
                              <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-primary)", fontWeight: 700, wordBreak: "break-word" }}>
                                {item.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {adminTab === "notes" && (
                    <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, boxShadow: "var(--shadow-soft)", padding: 12, display: "grid", gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>Notes & Context</div>

                      {notesRows.length === 0 ? (
                        <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
                          No unique notes available beyond Details and Status for this management profile.
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {notesRows.map((item, index) => (
                            <div
                              key={`${item.label}-${index}`}
                              style={{
                                borderRadius: 10,
                                border: "1px solid var(--border-soft)",
                                background: "#ffffff",
                                padding: "9px 10px",
                                display: "grid",
                                gap: 4,
                              }}
                            >
                              <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.55px" }}>
                                {item.label}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-primary)", lineHeight: 1.5, wordBreak: "break-word" }}>
                                {item.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!adminChatOpen && selectedAdmin && (
                  <div
                    onClick={openAdminQuickChat}
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
                      <span style={{ fontWeight: 800, fontSize: 13 }}>Management Chat</span>
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
                      background: "#fff",
                      borderRadius: "16px",
                      boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
                      zIndex: 2000,
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "14px",
                        borderBottom: "1px solid #eee",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "#fafafa",
                      }}
                    >
                      <strong>{quickChatTarget?.name || selectedAdmin.name}</strong>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          onClick={() => {
                            const targetUserId = normalizeIdentifier(quickChatTarget?.userId);
                            if (!targetUserId) return;

                            closeAdminQuickChat();
                            const chatId = getChatId(teacherUserId, targetUserId);
                            navigate("/all-chat", {
                              state: {
                                user: quickChatTarget || selectedAdmin,
                                contact: quickChatTarget || selectedAdmin,
                                chatId,
                                tab: "admin",
                              },
                            });
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}
                        >
                          ⤢
                        </button>
                        <button onClick={closeAdminQuickChat} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>
                          ×
                        </button>
                      </div>
                    </div>

                    <div
                      ref={quickChatMessagesRef}
                      style={{
                        flex: 1,
                        padding: "12px",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        background: "#f9f9f9",
                      }}
                    >
                      {(quickChatHasOlder || quickChatLoadingOlder) && !quickChatLoading && (
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                          <button
                            onClick={loadOlderMessages}
                            disabled={quickChatLoadingOlder}
                            style={{
                              border: "1px solid #bfdbfe",
                              background: quickChatLoadingOlder ? "#eff6ff" : "#ffffff",
                              color: "#007AFB",
                              borderRadius: 999,
                              padding: "6px 12px",
                              fontSize: 10,
                              fontWeight: 800,
                              cursor: quickChatLoadingOlder ? "default" : "pointer",
                            }}
                          >
                            {quickChatLoadingOlder ? "Loading older messages..." : "Load older messages"}
                          </button>
                        </div>
                      )}

                      {quickChatLoading ? (
                        <p style={{ textAlign: "center", color: "#64748b" }}>
                          Loading recent chat...
                        </p>
                      ) : messages.length === 0 ? (
                        <p style={{ textAlign: "center", color: "#aaa" }}>
                          Start chatting with {quickChatTarget?.name || selectedAdmin.name}
                        </p>
                      ) : (
                        messages.map((m) => {
                          const isTeacher = String(m?.senderId || "") === String(teacherUserId);

                          return (
                            <div key={m.messageId || m.id} style={{ display: "flex", flexDirection: "column", alignItems: isTeacher ? "flex-end" : "flex-start", marginBottom: 10 }}>
                              <div
                                style={{
                                  maxWidth: "70%",
                                  background: isTeacher ? "#4facfe" : "#fff",
                                  color: isTeacher ? "#fff" : "#000",
                                  padding: "10px 14px",
                                  borderRadius: 18,
                                  borderTopRightRadius: isTeacher ? 0 : 18,
                                  borderTopLeftRadius: isTeacher ? 18 : 0,
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                  wordBreak: "break-word",
                                  cursor: "default",
                                  position: "relative",
                                }}
                              >
                                {m.text} {m.edited && <small style={{ fontSize: 10 }}> (edited)</small>}

                                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 6, fontSize: 11, color: isTeacher ? "#fff" : "#888" }}>
                                  <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>{formatDateLabel(m.timeStamp)}</span>
                                  <span>{formatTime(m.timeStamp)}</span>
                                  {isTeacher && !m.deleted && (
                                    <span style={{ display: "flex", gap: 0, alignItems: "center" }}>
                                      <FaCheck size={12} color={isTeacher ? "#fff" : "#888"} style={{ opacity: 0.85, marginLeft: 6 }} />
                                      {m.seen && <FaCheck size={12} color={isTeacher ? "#f3f7f8" : "#ccc"} style={{ marginLeft: 2, opacity: 0.95 }} />}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    <div
                      style={{
                        padding: "10px",
                        borderTop: "1px solid #eee",
                        display: "flex",
                        gap: "8px",
                        background: "#fff",
                      }}
                    >
                      <input
                        value={newMessageText}
                        onChange={(e) => setNewMessageText(e.target.value)}
                        placeholder="Type a message..."
                        style={{
                          flex: 1,
                          padding: "10px 14px",
                          borderRadius: "25px",
                          border: "1px solid #ccc",
                          outline: "none",
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") sendMessage();
                        }}
                      />
                      <button
                        onClick={() => sendMessage()}
                        style={{
                          width: 45,
                          height: 45,
                          border: "none",
                          borderRadius: "50%",
                          background: "#4facfe",
                          color: "#fff",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          cursor: "pointer",
                        }}
                      >
                        <FaPaperPlane />
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
                  Management Details
                </h3>
                <p style={{ margin: "8px 0 0", color: "var(--text-muted)", fontSize: 11, lineHeight: 1.5 }}>
                  Select a management member to view details and chat.
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

