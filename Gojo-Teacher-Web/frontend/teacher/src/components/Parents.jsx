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
  FaBookOpen,
  FaPaperPlane,
} from "react-icons/fa";
import Sidebar from "./Sidebar";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  ref as dbRef,
  get,
  onValue,
  update,
  push,
  runTransaction,
  query as dbQuery,
  orderByChild,
  limitToLast,
  endAt,
  equalTo,
} from "firebase/database";
import { db, schoolPath } from "../firebase"; // adjust path if needed
import { getTeacherCourseContext } from "../api/teacherApi";
import { resolveProfileImage } from "../utils/profileImage";
import {
  clearCachedChatSummary,
  extractAllowedGradeSectionsFromCourseContext,
  fetchTeacherConversationSummaries,
  loadParentRecordsByIds,
  loadStudentsByGradeSections,
  loadUserRecordsByIds,
  normalizeIdentifier as normalizeScopedIdentifier,
  resolveTeacherSchoolCode,
} from "../utils/teacherData";
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
const QUICK_CHAT_HISTORY_LIMIT = 50;
import { API_BASE } from "../api/apiConfig";
import { getRtdbRoot, RTDB_BASE_RAW } from "../api/rtdbScope";

const formatTime = (ts) => {
  if (!ts) return "";
  const d = new Date(Number(ts));
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
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

const normalizeIdentifier = (value) => String(value || "").trim();

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

const normalizeGrade = (value) => String(value ?? "").trim();
const normalizeSection = (value) => String(value ?? "").trim().toUpperCase();
const normalizeTeacherRef = (value) => String(value || "").trim().replace(/^-+/, "").toUpperCase();
const getStudentUserId = (student = {}) =>
  String(
    student?.userId ||
      student?.systemAccountInformation?.userId ||
      student?.account?.userId ||
      ""
  ).trim();

const isActiveRecord = (record = {}) => {
  const raw = record?.status ?? record?.isActive;
  if (typeof raw === "boolean") return raw;
  const normalized = String(raw || "active").toLowerCase();
  return normalized === "active" || normalized === "true" || normalized === "1";
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

const collectStudentParentLinks = (student = {}) => {
  const rawStudent = student?.raw || student || {};
  const links = [];

  const pushLink = (candidate = {}, fallbackParentId = "") => {
    const parentId = normalizeIdentifier(candidate?.parentId || candidate?.id || fallbackParentId);
    const userId = normalizeIdentifier(candidate?.userId || candidate?.parentUserId);
    const name = String(candidate?.name || candidate?.parentName || "").trim();
    const phone = String(candidate?.phone || candidate?.parentPhone || candidate?.phoneNumber || "").trim();
    const relationship = String(candidate?.relationship || candidate?.relation || "").trim();
    const profileImage = resolveProfileImage(
      candidate?.profileImage,
      candidate?.profile,
      candidate?.parentProfileImage
    );

    if (!parentId && !userId && !name && !phone && !relationship && profileImage === DEFAULT_PROFILE_IMAGE) {
      return;
    }

    links.push({
      parentId,
      userId,
      name,
      phone,
      relationship,
      profileImage,
    });
  };

  pushLink({
    parentId: rawStudent?.parentId,
    userId: rawStudent?.parentUserId,
    name: rawStudent?.parentName,
    phone: rawStudent?.parentPhone,
    parentProfileImage: rawStudent?.parentProfileImage,
  });

  Object.entries(rawStudent?.parents || {}).forEach(([parentKey, link]) => {
    pushLink(link, parentKey);
  });

  const guardianParents = rawStudent?.parentGuardianInformation?.parents;
  if (Array.isArray(guardianParents)) {
    guardianParents.forEach((link) => pushLink(link));
  } else if (guardianParents && typeof guardianParents === "object") {
    Object.entries(guardianParents).forEach(([parentKey, link]) => {
      pushLink(link, parentKey);
    });
  }

  const deduped = [];
  const seen = new Set();
  links.forEach((link) => {
    const key = `${link.parentId}__${link.userId}__${link.name}__${link.relationship}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(link);
  });

  return deduped;
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
  const [liveQuickChatMessages, setLiveQuickChatMessages] = useState([]);
  const [olderQuickChatMessages, setOlderQuickChatMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const messagesEndRef = useRef(null);
  const quickChatMessagesRef = useRef(null);
  const quickChatScrollRestoreRef = useRef(null);
    const userRecordCacheRef = useRef(new Map());
const [children, setChildren] = useState([]);
 const [notifications, setNotifications] = useState([]);
 const [showNotifications, setShowNotifications] = useState(false);
 const [messageNotifications, setMessageNotifications] = useState([]);
  const [highlightedPostId, setHighlightedPostId] = useState(null);

  const [showMessenger, setShowMessenger] = useState(false);
    const [conversations, setConversations] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [resolvedSchoolCode, setResolvedSchoolCode] = useState("");
  const [quickChatLoading, setQuickChatLoading] = useState(false);
  const [quickChatLoadingOlder, setQuickChatLoadingOlder] = useState(false);
  const [quickChatHasOlder, setQuickChatHasOlder] = useState(false);
  const messages = useMemo(
    () => mergeChatMessages(olderQuickChatMessages, liveQuickChatMessages),
    [olderQuickChatMessages, liveQuickChatMessages]
  );
  
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

  useEffect(() => {
    let cancelled = false;

    const resolveSchoolCode = async () => {
      if (!teacher?.schoolCode) {
        setResolvedSchoolCode("");
        return;
      }

      const resolved = await resolveTeacherSchoolCode(teacher.schoolCode);
      if (!cancelled) {
        setResolvedSchoolCode(resolved);
      }
    };

    resolveSchoolCode();

    return () => {
      cancelled = true;
    };
  }, [teacher?.schoolCode]);

  useEffect(() => {
    if (!resolvedSchoolCode) return;
    const current = JSON.parse(localStorage.getItem("teacher") || "{}");
    if (String(current?.schoolCode || "") === resolvedSchoolCode) return;

    const nextTeacher = {
      ...current,
      schoolCode: resolvedSchoolCode,
    };
    localStorage.setItem("teacher", JSON.stringify(nextTeacher));
    setTeacher(nextTeacher);
  }, [resolvedSchoolCode]);

  const RTDB_BASE = useMemo(() => {
    if (resolvedSchoolCode) {
      return `${RTDB_BASE_RAW}/Platform1/Schools/${resolvedSchoolCode}`;
    }
    return getRtdbRoot();
  }, [resolvedSchoolCode]);

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // safe teacher id for renders when `teacher` may be null briefly
  const teacherId = teacher?.userId || "";
  const teacherSchoolCode = String(teacher?.schoolCode || "").trim();
  const scopedParentPath = (path) => schoolPath(path, resolvedSchoolCode || teacherSchoolCode);

  const cacheUserRecord = (recordKey, userRecord) => {
    if (!userRecord || typeof userRecord !== "object") return;

    [recordKey, userRecord?.userId, userRecord?.username]
      .map(normalizeIdentifier)
      .filter(Boolean)
      .forEach((key) => {
        userRecordCacheRef.current.set(key, userRecord);
      });
  };

  const loadUsersByIds = async (userIds = []) => {
    const normalizedUserIds = [...new Set(userIds.map(normalizeIdentifier).filter(Boolean))];
    if (!normalizedUserIds.length) return {};

    const cachedUsers = {};
    const missingUserIds = [];

    normalizedUserIds.forEach((userId) => {
      const cachedRecord = userRecordCacheRef.current.get(userId) || null;
      if (cachedRecord) {
        cachedUsers[userId] = cachedRecord;
        cacheUserRecord(userId, cachedRecord);
        return;
      }
      missingUserIds.push(userId);
    });

    if (!missingUserIds.length) return cachedUsers;

    const fetchedEntries = await Promise.all(
      missingUserIds.map(async (userId) => {
        try {
          const directSnapshot = await get(dbRef(db, scopedParentPath(`Users/${userId}`)));
          if (directSnapshot.exists()) {
            return [userId, directSnapshot.val()];
          }
        } catch (error) {
          // fall through to indexed lookup
        }

        try {
          const lookupSnapshot = await get(
            dbQuery(dbRef(db, scopedParentPath("Users")), orderByChild("userId"), equalTo(userId))
          );
          if (lookupSnapshot.exists()) {
            return [userId, Object.values(lookupSnapshot.val() || {})[0] || null];
          }
        } catch (error) {
          // ignore missing indexed lookup support and return null below
        }

        return [userId, null];
      })
    );

    const fetchedUsers = {};
    fetchedEntries.forEach(([userId, userRecord]) => {
      if (!userRecord) return;
      fetchedUsers[userId] = userRecord;
      cacheUserRecord(userId, userRecord);
    });

    return {
      ...cachedUsers,
      ...fetchedUsers,
    };
  };

  const fetchTeacherChats = async (teacherUserId) => {
    const normalizedTeacherUserId = normalizeIdentifier(teacherUserId);
    if (!normalizedTeacherUserId) return {};

    const chatsRootRef = dbRef(db, scopedParentPath("Chats"));

    for (const expectedValue of [true, "true"]) {
      try {
        const snapshot = await get(
          dbQuery(
            chatsRootRef,
            orderByChild(`participants/${normalizedTeacherUserId}`),
            equalTo(expectedValue)
          )
        );

        if (snapshot.exists()) {
          return snapshot.val() || {};
        }
      } catch (error) {
        // try the next supported participant marker shape
      }
    }

    return {};
  };

  const loadUnreadConversationSummaries = async (currentTeacher = teacher) => {
    const activeTeacher = currentTeacher || JSON.parse(localStorage.getItem("teacher") || "{}");
    const activeTeacherUserId = normalizeIdentifier(activeTeacher?.userId);
    if (!activeTeacherUserId) return [];

    return fetchTeacherConversationSummaries({
      rtdbBase: RTDB_BASE,
      schoolCode: resolvedSchoolCode || activeTeacher?.schoolCode,
      teacherUserId: activeTeacherUserId,
      contactCandidates: parents.map((parent) => ({
        userId: parent.userId,
        name: parent.name,
        profileImage: parent.profileImage,
        type: "parent",
      })),
      unreadOnly: true,
    });
  };

  const closeQuickChat = () => {
    setChatOpen(false);
    setNewMessageText("");
    quickChatScrollRestoreRef.current = null;
  };

  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  // fetch parents & related data
  useEffect(() => {
    if (!teacher || !RTDB_BASE) return;
    let cancelled = false;

    const fetchParents = async () => {
      try {
        setLoading(true);

        const schoolCode = normalizeScopedIdentifier(resolvedSchoolCode || teacher?.schoolCode);
        const courseContext = await getTeacherCourseContext({ teacher, rtdbBase: RTDB_BASE });
        const allowedGradeSections = extractAllowedGradeSectionsFromCourseContext(courseContext);

        if (!allowedGradeSections.size) {
          if (!cancelled) setParents([]);
          return;
        }

        const visibleStudents = await loadStudentsByGradeSections({
          rtdbBase: RTDB_BASE,
          schoolCode,
          allowedGradeSections,
        });

        if (!visibleStudents.length) {
          if (!cancelled) setParents([]);
          return;
        }

        const parentLinksByStudent = visibleStudents.map((studentRow) => ({
          studentRow,
          links: collectStudentParentLinks(studentRow),
        }));

        const parentIdentifiers = [...new Set(
          parentLinksByStudent
            .flatMap(({ links }) => links)
            .flatMap((link) => [link?.parentId, link?.userId])
            .map(normalizeScopedIdentifier)
            .filter(Boolean)
        )];

        const parentRecordsByIdentifier = await loadParentRecordsByIds({
          rtdbBase: RTDB_BASE,
          schoolCode,
          parentIds: parentIdentifiers,
        });
        const parentRecords = [...new Map(
          Object.values(parentRecordsByIdentifier || {})
            .filter(Boolean)
            .map((parentRecord) => {
              const key = `${normalizeScopedIdentifier(parentRecord?.parentId)}__${normalizeScopedIdentifier(parentRecord?.userId)}`;
              return [key, parentRecord];
            })
        ).values()];

        const parentUserIds = [...new Set(
          [
            ...parentLinksByStudent.flatMap(({ links }) => links.map((link) => link?.userId)),
            ...parentRecords.map((parentRecord) => parentRecord?.userId),
          ]
            .map(normalizeScopedIdentifier)
            .filter(Boolean)
        )];
        const parentUsersById = await loadUserRecordsByIds({
          rtdbBase: RTDB_BASE,
          schoolCode,
          userIds: parentUserIds,
        });

        const findParentRecord = (link = {}) => {
          const linkRefs = [link?.parentId, link?.userId].map(normalizeScopedIdentifier).filter(Boolean);
          if (!linkRefs.length) {
            return null;
          }

          return parentRecords.find((parentRecord) => {
            const parentRefs = [parentRecord?.parentId, parentRecord?.userId]
              .map(normalizeScopedIdentifier)
              .filter(Boolean);
            return linkRefs.some((linkRef) => parentRefs.includes(linkRef));
          }) || null;
        };

        const parentsByKey = new Map();

        parentLinksByStudent.forEach(({ studentRow, links }) => {
          const uniqueLinks = [...new Map(
            (links || [])
              .filter((link) => normalizeScopedIdentifier(link?.parentId || link?.userId))
              .map((link) => [`${normalizeScopedIdentifier(link?.parentId || link?.userId)}__${String(link?.relationship || "")}`, link])
          ).values()];

          uniqueLinks.forEach((link) => {
            const parentRecord = findParentRecord(link);
            const parentUser = parentUsersById[normalizeScopedIdentifier(parentRecord?.userId || link?.userId)] || null;
            const parentUserId = normalizeScopedIdentifier(
              parentUser?.userId || parentRecord?.userId || link?.userId
            );
            const parentKey = normalizeScopedIdentifier(
              parentRecord?.parentId || link?.parentId || parentUserId
            );

            if (!parentKey || !parentUserId) {
              return;
            }

            const parentName =
              parentUser?.name ||
              parentRecord?.name ||
              String(link?.name || "").trim() ||
              "Parent";
            const existingParent = parentsByKey.get(parentKey) || {
              id: parentKey,
              userId: parentUserId,
              name: parentName,
              email: parentUser?.email || parentRecord?.email || "N/A",
              phone: parentUser?.phone || parentRecord?.phone || String(link?.phone || "").trim(),
              profileImage: resolveAvatarSrc(
                resolveProfileImage(
                  parentUser?.profileImage,
                  parentUser?.profile,
                  parentUser?.avatar,
                  parentRecord?.profileImage,
                  parentRecord?.profile,
                  link?.profileImage,
                  DEFAULT_PROFILE_IMAGE
                ),
                parentName
              ),
              children: [],
              relationships: [],
              age: parentRecord?.age || parentUser?.age || null,
              city: parentRecord?.city || parentUser?.city || parentRecord?.address?.city || null,
              citizenship: parentRecord?.citizenship || parentUser?.citizenship || parentRecord?.nationality || null,
              status: parentRecord?.status || "Active",
              isActive: typeof parentUser?.isActive === "boolean" ? parentUser.isActive : isActiveRecord(parentRecord || parentUser || {}),
              createdAt: parentRecord?.createdAt || null,
              parentId: parentRecord?.parentId || parentKey,
              username: parentUser?.username || parentRecord?.username || parentRecord?.parentId || parentKey,
              role: parentUser?.role || parentRecord?.role || "parent",
              schoolCode:
                parentRecord?.schoolCode ||
                parentUser?.schoolCode ||
                schoolCode ||
                "",
              occupation: parentRecord?.occupation || parentUser?.occupation || "",
              nationalIdNumber: parentRecord?.nationalIdNumber || parentUser?.nationalIdNumber || "",
              nationalIdImage: parentRecord?.nationalIdImage || parentUser?.nationalIdImage || "",
              address: parentRecord?.address || parentUser?.address || null,
              extra: parentRecord?.extra,
            };

            const studentName = studentRow?.name || "No Name";
            const nextChild = {
              studentId: studentRow?.studentId,
              name: studentName,
              grade: studentRow?.grade || "",
              section: studentRow?.section || "",
              profileImage: resolveAvatarSrc(studentRow?.profileImage, studentName),
              userId: studentRow?.userId,
              relationship: String(link?.relationship || "").trim() || "—",
              age: studentRow?.raw?.age || studentRow?.user?.age || null,
              city: studentRow?.raw?.city || studentRow?.user?.city || studentRow?.raw?.address?.city || null,
              citizenship: studentRow?.raw?.citizenship || studentRow?.user?.citizenship || studentRow?.raw?.nationality || null,
              address: studentRow?.raw?.address || studentRow?.user?.address || null,
              status: studentRow?.raw?.status || "Active",
            };

            const existingChildIndex = existingParent.children.findIndex(
              (childItem) => String(childItem?.studentId || "") === String(nextChild.studentId || "")
            );

            if (existingChildIndex === -1) {
              existingParent.children.push(nextChild);
            } else {
              existingParent.children[existingChildIndex] = {
                ...existingParent.children[existingChildIndex],
                ...nextChild,
              };
            }

            existingParent.relationships = Array.from(new Set([
              ...(existingParent.relationships || []),
              nextChild.relationship,
            ].filter(Boolean)));

            parentsByKey.set(parentKey, existingParent);
          });
        });

        const finalParents = [...parentsByKey.values()]
          .filter((parent) => parent?.userId)
          .filter((parent) => parent?.isActive !== false)
          .filter((parent) => Array.isArray(parent.children) && parent.children.length > 0)
          .sort((leftParent, rightParent) => String(leftParent?.name || "").localeCompare(String(rightParent?.name || "")));

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
  }, [teacher, RTDB_BASE, resolvedSchoolCode]);

  useEffect(() => {
    if (selectedParent || !chatOpen) return;
    closeQuickChat();
  }, [selectedParent, chatOpen]);

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

    if (!chatOpen) return;
    scrollToBottom(messages.length > QUICK_CHAT_HISTORY_LIMIT ? "auto" : "smooth");
  }, [messages, chatOpen]);

  // Fetch recent messages for the selected parent with a capped live listener.
  useEffect(() => {
    if (!chatOpen || !teacherId || !selectedParent?.userId) {
      setLiveQuickChatMessages([]);
      setOlderQuickChatMessages([]);
      setQuickChatLoading(false);
      setQuickChatLoadingOlder(false);
      setQuickChatHasOlder(false);
      quickChatScrollRestoreRef.current = null;
      return;
    }

    const chatId = getChatId(teacherId, selectedParent.userId);
    const messagesRef = dbQuery(
      dbRef(db, scopedParentPath(`Chats/${chatId}/messages`)),
      orderByChild("timeStamp"),
      limitToLast(QUICK_CHAT_HISTORY_LIMIT)
    );

    setLiveQuickChatMessages([]);
    setOlderQuickChatMessages([]);
    setQuickChatHasOlder(false);
    setQuickChatLoadingOlder(false);
    quickChatScrollRestoreRef.current = null;
    setQuickChatLoading(true);

    const unsubscribe = onValue(
      messagesRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        const msgs = Object.entries(data)
          .map(([id, msg]) => ({
            id,
            messageId: id,
            ...msg,
          }))
          .sort((a, b) => Number(a?.timeStamp || 0) - Number(b?.timeStamp || 0));

        setLiveQuickChatMessages(msgs);
        setQuickChatHasOlder((previousValue) => previousValue || msgs.length >= QUICK_CHAT_HISTORY_LIMIT);
        setQuickChatLoading(false);
      },
      (error) => {
        console.error("Failed to load quick chat messages:", error);
        setLiveQuickChatMessages([]);
        setOlderQuickChatMessages([]);
        setQuickChatHasOlder(false);
        setQuickChatLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chatOpen, teacherId, selectedParent?.userId, resolvedSchoolCode, teacherSchoolCode]);

  const loadOlderMessages = async () => {
    if (
      quickChatLoading ||
      quickChatLoadingOlder ||
      !chatOpen ||
      !teacherId ||
      !selectedParent?.userId ||
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
      const chatId = getChatId(teacherId, selectedParent.userId);
      const olderMessagesRef = dbQuery(
        dbRef(db, scopedParentPath(`Chats/${chatId}/messages`)),
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
    } catch (error) {
      console.error("Failed to load older quick chat messages:", error);
      quickChatScrollRestoreRef.current = null;
    } finally {
      setQuickChatLoadingOlder(false);
    }
  };

  // Mark parent messages as seen when the quick chat is open.
  useEffect(() => {
    if (!chatOpen || !selectedParent?.userId || !teacherId) return;
    if (!messages.length) return;

    const unseenMessages = messages.filter(
      (message) => String(message?.receiverId || "") === String(teacherId) && !message?.seen
    );
    if (!unseenMessages.length) return;

    const chatId = getChatId(teacherId, selectedParent.userId);
    const seenAt = Date.now();
    const payload = {
      [`unread/${teacherId}`]: 0,
      "lastMessage/seen": true,
      "lastMessage/seenAt": seenAt,
    };

    unseenMessages.forEach((message) => {
      const messageKey = normalizeIdentifier(message?.id || message?.messageId);
      if (!messageKey) return;
      payload[`messages/${messageKey}/seen`] = true;
      payload[`messages/${messageKey}/seenAt`] = seenAt;
    });

    update(dbRef(db, scopedParentPath(`Chats/${chatId}`)), payload).catch((error) => {
      console.error("Failed to mark messages seen:", error);
    });
  }, [chatOpen, messages, selectedParent?.userId, teacherId, resolvedSchoolCode, teacherSchoolCode]);

  const sendMessage = async (textOverride = "") => {
    const text = String(textOverride || newMessageText || "").trim();
    const receiverId = normalizeIdentifier(selectedParent?.userId);
    if (!text || !receiverId || !teacherId) return;

    const senderId = teacherId;
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
      await push(dbRef(db, scopedParentPath(`Chats/${chatId}/messages`)), message);

      await update(dbRef(db, scopedParentPath(`Chats/${chatId}`)), {
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
        dbRef(db, scopedParentPath(`Chats/${chatId}/unread/${receiverId}`)),
        (current) => (Number(current) || 0) + 1
      );
    } catch (err) {
      console.error("Failed to send quick chat message:", err);
    }
  };

  useEffect(() => {
    if (!teacher?.userId) return;

    let cancelled = false;

    const fetchNotifications = async () => {
      try {
        const teacherLocal = teacher || JSON.parse(localStorage.getItem("teacher") || "{}");
        const schoolCode = normalizeIdentifier(
          resolvedSchoolCode || teacherSchoolCode || teacherLocal?.schoolCode
        );
        if (!teacherLocal?.userId || !schoolCode) return;

        const res = await axios.get(`${API_BASE}/get_posts`, {
          params: {
            viewerRole: "teacher",
            schoolCode,
          },
        });
        let postsData = res.data || [];
        if (!Array.isArray(postsData) && typeof postsData === "object") postsData = Object.values(postsData);
        const seenPosts = getSeenPosts(teacherLocal?.userId);

        const latestPosts = postsData
          .slice()
          .sort((a, b) => ((b.time ? new Date(b.time).getTime() : 0) - (a.time ? new Date(a.time).getTime() : 0)))
          .filter((post) => post.postId && !seenPosts.includes(post.postId))
          .slice(0, 5)
          .map((post) => {
            return {
              type: "post",
              id: post.postId,
              title: post.message?.substring(0, 50) || "Untitled post",
              adminName: post.adminName || "Admin",
              adminProfile: post.adminProfile || DEFAULT_PROFILE_IMAGE,
            };
          });

        const unreadConversations = await loadUnreadConversationSummaries(teacherLocal);
        const messageNotifs = unreadConversations.map((conversation) => ({
          type: "message",
          chatId: conversation.chatId,
          contact: conversation.contact,
          displayName: conversation.displayName,
          profile: conversation.profile,
          lastMessageText: conversation.lastMessageText,
          lastMessageTime: conversation.lastMessageTime,
          unreadForMe: conversation.unreadForMe,
        }));

        if (cancelled) return;
        setNotifications([...latestPosts, ...messageNotifs]);
        setMessageNotifications(messageNotifs);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };

    fetchNotifications();

    return () => {
      cancelled = true;
    };
  }, [teacher, resolvedSchoolCode, teacherSchoolCode]);

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
      const convs = await loadUnreadConversationSummaries(t);
      setConversations(convs);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setConversations([]);
    }
  };

  const handleMessengerToggle = async () => {
    const nextOpen = !showMessenger;
    setShowMessenger(nextOpen);
    if (nextOpen) {
      await fetchConversations();
    }
  };

  const handleOpenConversation = async (conv, index) => {
    if (!teacher || !conv) return;
    const { chatId, contact } = conv;
    navigate("/all-chat", { state: { contact, chatId, tab: "parent" } });
    try {
      await update(dbRef(db, scopedParentPath(`Chats/${chatId}/unread`)), {
        [teacherId]: null,
      });
      clearCachedChatSummary({
        rtdbBase: RTDB_BASE,
        chatId,
        teacherUserId: teacherId,
      });
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
        "--accent-strong": "#007AFB",
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
        "--shadow-soft": "0 10px 24px rgba(15, 23, 42, 0.08)",
        "--shadow-panel": "0 14px 30px rgba(15, 23, 42, 0.10)",
        "--shadow-glow": "0 0 0 2px rgba(37, 99, 235, 0.18)",
      }}
    >
      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px", height: "calc(100vh - 73px)", overflow: "hidden", background: "#ffffff" }}>
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
        <div style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", overflowX: "hidden", display: "flex", justifyContent: "flex-start", padding: "10px 20px 20px", boxSizing: "border-box", background: "#ffffff" }}>
          <div
            className="parent-list-card-responsive"
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
                .parent-list-card-responsive {
                  margin-left: -10px !important;
                  margin-right: auto !important;
                  width: calc(100vw - 18px) !important;
                  max-width: calc(100vw - 18px) !important;
                  border-radius: 14px !important;
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
                      max-width: 100%;
                      margin-left: 0;
                      margin-right: 0;
                      max-height: min(68vh, 640px);
                      overflow-y: auto;
                      padding-right: 2px;
                      padding-bottom: 10px;
                    }
                    @media (max-width: 600px) {
                      .parent-list-responsive {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin-left: 0 !important;
                        margin-right: 0 !important;
                        padding: 0 !important;
                        align-items: flex-start !important;
                      }
                      .parent-list-responsive > div {
                        margin-left: 0 !important;
                        padding-left: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        min-width: 100% !important;
                        box-sizing: border-box !important;
                      }
                    }
                    @media (min-width: 350px) {
                      .parent-list-responsive {
                        width: 100%;
                        max-width: 100%;
                      }
                    }
                    @media (min-width: 1200px) {
                      .parent-list-responsive {
                        width: 100%;
                        max-width: 100%;
                        margin-left: 0;
                      }
                    }
                    @media (min-width: 1500px) {
                      .parent-list-responsive {
                        width: 100%;
                        max-width: 100%;
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
                          borderRadius: "14px",
                          padding: "11px",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          cursor: "pointer",
                          background: "#ffffff",
                          border: selectedParent?.id === p.id ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                          boxShadow: selectedParent?.id === p.id
                            ? "0 14px 28px rgba(37, 99, 235, 0.16), inset 3px 0 0 #2563eb"
                            : "0 4px 10px rgba(15, 23, 42, 0.06)",
                          transition: "all 0.24s ease",
                        }}
                      >
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: selectedParent?.id === p.id ? '#007AFB' : '#eef2ff',
                          color: selectedParent?.id === p.id ? '#fff' : '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 12,
                          flexShrink: 0,
                        }}>{index + 1}</div>

                        <img
                          src={resolveAvatarSrc(p.profileImage, p.name)}
                          alt={p.name}
                          onError={(event) => {
                            const fallback = createPlaceholderAvatar(p?.name || "Parent");
                            if (event.currentTarget.src === fallback) return;
                            event.currentTarget.src = fallback;
                          }}
                          style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: selectedParent?.id === p.id ? '3px solid #007AFB' : '3px solid #dbeafe' }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{ margin: 0, fontSize: 14, color: "#0f172a", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</h3>
                          <p style={{ margin: '4px 0', color: '#64748b', fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.email}</p>
                          <p style={{ margin: 0, color: '#475569', fontSize: 10, fontWeight: 600 }}>
                            {(p.children || []).length} {(p.children || []).length === 1 ? "Child" : "Children"}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div style={{ height: 8 }} />
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
                        src={resolveAvatarSrc(selectedParent.profileImage, selectedParent.name)}
                        alt={selectedParent.name}
                        onError={(event) => {
                          const fallback = createPlaceholderAvatar(selectedParent?.name || "Parent");
                          if (event.currentTarget.src === fallback) return;
                          event.currentTarget.src = fallback;
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
   
  >
    {selectedParent.children.map((c) => (
      <div
        key={c.studentId}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
          borderRadius: 16,
          padding: "14px",
          boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
          border: "1px solid #dbeafe",
          transition: "box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = "0 16px 34px rgba(37, 99, 235, 0.12)";
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.borderColor = "#93c5fd";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = "0 8px 22px rgba(15, 23, 42, 0.06)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.borderColor = "#dbeafe";
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "0 auto auto 0",
            width: 88,
            height: 88,
            background: "radial-gradient(circle, rgba(191,219,254,0.5) 0%, rgba(191,219,254,0) 72%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, position: "relative", zIndex: 1 }}>
          <img
            src={resolveAvatarSrc(c.profileImage, c.name)}
            alt={c.name}
            onError={(event) => {
              const fallback = createPlaceholderAvatar(c?.name || "Student");
              if (event.currentTarget.src === fallback) return;
              event.currentTarget.src = fallback;
            }}
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "3px solid #bfdbfe",
              objectFit: "cover",
              background: "#ffffff",
              flexShrink: 0,
              boxShadow: "0 8px 16px rgba(37, 99, 235, 0.14)",
            }}
          />

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                <div style={{ marginTop: 3, fontSize: 11, color: "#64748b" }}>
                  Student ID: {c.studentId || "—"}
                </div>
              </div>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#007AFB",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 999,
                  padding: "4px 8px",
                }}
              >
                {c.relationship ? `Relation: ${c.relationship}` : "Child"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 11, color: "#1e3a8a", padding: "5px 10px", borderRadius: 999, background: "#eff6ff", border: "1px solid #dbeafe", fontWeight: 700 }}>
                Grade {c.grade || "—"}
              </div>
              <div style={{ fontSize: 11, color: "#334155", padding: "5px 10px", borderRadius: 999, background: "#f8fafc", border: "1px solid #e2e8f0", fontWeight: 700 }}>
                Section {c.section || "—"}
              </div>
              <div style={{ fontSize: 11, color: c.status === "Active" ? "#166534" : "#92400e", padding: "5px 10px", borderRadius: 999, background: c.status === "Active" ? "#dcfce7" : "#fef3c7", border: c.status === "Active" ? "1px solid #86efac" : "1px solid #fcd34d", fontWeight: 700 }}>
                {c.status || "Unknown"}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 8,
            position: "relative",
            zIndex: 1,
          }}
        >
          {[
            ["Age", c.age || "—"],
            ["City", c.city || "—"],
            ["Citizenship", c.citizenship || "—"],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                borderRadius: 10,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                padding: "8px 9px",
                minWidth: 0,
              }}
            >
              <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
              <div style={{ marginTop: 4, fontSize: 11, color: "#0f172a", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            paddingTop: 2,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* <div style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.userId ? `User ID: ${c.userId}` : "User account linked"}
          </div> */}
          <div style={{ width: 36, height: 4, borderRadius: 999, background: "linear-gradient(90deg, #93c5fd 0%, #2563eb 100%)", flexShrink: 0 }} />
        </div>
      </div>
    ))}
  </div>
)}
                    {activeTab === "Status" && (
                      <div
                        style={{
                          background: "var(--surface-panel)",
                          border: "1px solid var(--border-soft)",
                          borderRadius: 12,
                          boxShadow: "var(--shadow-soft)",
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            borderRadius: 12,
                            border: "1px solid #dbeafe",
                            background: " #ffffff",
                            padding: "10px 12px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#1e3a8a" }}>Account Status</div>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: selectedParent?.isActive ? "#166534" : "#b91c1c",
                                background: selectedParent?.isActive ? "#dcfce7" : "#fee2e2",
                                border: selectedParent?.isActive ? "1px solid #86efac" : "1px solid #fecaca",
                                borderRadius: 999,
                                padding: "3px 8px",
                                textTransform: "uppercase",
                                letterSpacing: "0.3px",
                              }}
                            >
                              {selectedParent?.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 10, color: "#334155" }}>
                            Joined: {selectedParent?.createdAt ? new Date(selectedParent.createdAt).toLocaleString() : "—"}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                          }}
                        >
                          {[
                            ["Parent ID", selectedParent?.parentId || selectedParent?.id || "—"],
                            ["Username", selectedParent?.username || "—"],
                            ["Role", String(selectedParent?.role || "parent").toUpperCase()],
                            ["School Code", selectedParent?.schoolCode || "—"],
                            ["User ID", selectedParent?.userId || "—", true],
                          ].map(([label, value, span]) => (
                            <div
                              key={label}
                              style={{
                                padding: 8,
                                borderRadius: 10,
                                border: "1px solid var(--border-soft)",
                                background: "#ffffff",
                                gridColumn: span ? "span 2" : "span 1",
                              }}
                            >
                              <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.55px" }}>{label}</div>
                              <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-primary)", fontWeight: 700, wordBreak: "break-all" }}>{value || "—"}</div>
                            </div>
                          ))}
                        </div>

                        <div
                          style={{
                            border: "1px solid var(--border-soft)",
                            background: "#ffffff",
                            borderRadius: 10,
                            padding: "10px 12px",
                            display: "grid",
                            gap: 6,
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#0f172a" }}>Verification & Profile</div>
                          <div style={{ fontSize: 10, color: "#475569" }}>
                            National ID Number: {selectedParent?.nationalIdNumber ? "Provided" : "Not provided"}
                          </div>
                          <div style={{ fontSize: 10, color: "#475569" }}>
                            National ID Image: {selectedParent?.nationalIdImage ? "Uploaded" : "Not uploaded"}
                          </div>
                          <div style={{ fontSize: 10, color: "#475569" }}>
                            Occupation: {selectedParent?.occupation || "Not specified"}
                          </div>
                        </div>
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
            background: "linear-gradient(135deg, var(--accent-strong), var(--accent))",
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
            background: "#ffffff",
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
    closeQuickChat();
    const chatId = getChatId(teacherId, selectedParent.userId);
    navigate("/all-chat", {
      state: {
        user: selectedParent, // user to auto-select
        contact: selectedParent,
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
                onClick={closeQuickChat}
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
            ref={quickChatMessagesRef}
            style={{
              flex: 1,
              padding: "12px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              background: "#f8fbff",
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
                Start chatting with {selectedParent.name}
              </p>
            ) : (
              messages.map((m) => {
                const isTeacher = String(m?.senderId || "") === String(teacherId);

                return (
                  <div
                    key={m.messageId || m.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isTeacher ? "flex-end" : "flex-start",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "70%",
                        background: isTeacher ? "#007AFB" : "#ffffff",
                        color: isTeacher ? "#ffffff" : "#0f172a",
                        padding: "10px 14px",
                        borderRadius: 18,
                        borderTopRightRadius: isTeacher ? 0 : 18,
                        borderTopLeftRadius: isTeacher ? 18 : 0,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        wordBreak: "break-word",
                        position: "relative",
                      }}
                    >
                      {m.text} {m.edited && <small style={{ fontSize: 10 }}>(edited)</small>}

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: 6,
                          marginTop: 6,
                          fontSize: 11,
                          color: isTeacher ? "#ffffff" : "#888888",
                        }}
                      >
                        <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>
                          {formatDateLabel(m.timeStamp)}
                        </span>
                        <span>{formatTime(m.timeStamp)}</span>
                        {isTeacher && !m.deleted && (
                          <span style={{ display: "flex", gap: 0, alignItems: "center" }}>
                            <FaCheck
                              size={12}
                              color={isTeacher ? "#ffffff" : "#888888"}
                              style={{ opacity: 0.85, marginLeft: 6 }}
                            />
                            {m.seen && (
                              <FaCheck
                                size={12}
                                color={isTeacher ? "#f3f7f8" : "#cccccc"}
                                style={{ marginLeft: 2, opacity: 0.95 }}
                              />
                            )}
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
                if (e.key === "Enter") sendMessage();
              }}
            />
            <button
              onClick={() => sendMessage()}
              style={{
                background: "#007AFB",
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
              <FaPaperPlane />
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

