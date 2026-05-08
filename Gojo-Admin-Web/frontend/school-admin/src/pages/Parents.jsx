import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaFacebookMessenger,
  FaSearch,
  FaCalendarAlt,
  FaCommentDots,
  FaPaperPlane,
  FaCheck,
  FaChartLine,
  FaChevronDown,
} from "react-icons/fa";
import axios from "axios";
import { getDatabase, ref as rdbRef, onValue } from "firebase/database";
import { BACKEND_BASE } from "../config.js";
import useTopbarNotifications from "../hooks/useTopbarNotifications";
import ProfileAvatar from "../components/ProfileAvatar";
import { fetchCachedJson } from "../utils/rtdbCache";
import {
  buildChatSummaryPath,
  buildChatSummaryUpdate,
  normalizeChatSummaryValue,
} from "../utils/chatRtdb";
import { schoolNodeBase } from "../utils/schoolDbRouting";

const getChatId = (a, b) => [a, b].sort().join("_");
const BIG_NODE_CACHE_TTL_MS = 5 * 60 * 1000;
const DIRECTORY_CACHE_TTL_MS = 15 * 60 * 1000;

const normalizeText = (value) => String(value || "").trim();

const uniqueTextValues = (values = []) => {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).reduce((result, value) => {
    const text = normalizeText(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) {
      return result;
    }
    seen.add(key);
    result.push(text);
    return result;
  }, []);
};

const normalizeParentDirectoryChild = (child = {}) => ({
  studentId: normalizeText(child?.studentId),
  userId: normalizeText(child?.userId),
  name: normalizeText(child?.name) || "N/A",
  email: normalizeText(child?.email) || "N/A",
  grade: normalizeText(child?.grade) || "N/A",
  section: normalizeText(child?.section) || "N/A",
  relationship: normalizeText(child?.relationship) || "N/A",
  profileImage: normalizeText(child?.profileImage) || "/default-profile.png",
});

const normalizeParentDirectoryEntry = (parentKey, parentValue = {}) => {
  const children = Array.isArray(parentValue?.children)
    ? parentValue.children.map((child) => normalizeParentDirectoryChild(child)).filter((child) => child.studentId)
    : Object.values(parentValue?.children || {})
        .map((child) => normalizeParentDirectoryChild(child))
        .filter((child) => child.studentId);
  const relationships = uniqueTextValues([
    ...(Array.isArray(parentValue?.relationships) ? parentValue.relationships : []),
    ...children.map((child) => child.relationship),
  ]);
  const firstChild = children[0] || {};
  const isActive = parentValue?.isActive !== false;

  return {
    directoryKey: normalizeText(parentKey),
    userId: normalizeText(parentValue?.userId) || normalizeText(parentKey),
    parentId: normalizeText(parentValue?.parentId) || "N/A",
    name: normalizeText(parentValue?.name) || normalizeText(parentValue?.username) || "No Name",
    username: normalizeText(parentValue?.username) || null,
    email: normalizeText(parentValue?.email) || "N/A",
    childName: normalizeText(parentValue?.childName) || firstChild.name || "N/A",
    childRelationship: normalizeText(parentValue?.childRelationship) || firstChild.relationship || "N/A",
    profileImage: normalizeText(parentValue?.profileImage) || "/default-profile.png",
    phone: normalizeText(parentValue?.phone) || "N/A",
    age: parentValue?.age ?? null,
    city: normalizeText(parentValue?.city) || (parentValue?.address && parentValue.address.city) || null,
    citizenship: normalizeText(parentValue?.citizenship) || null,
    job: normalizeText(parentValue?.job) || null,
    address: parentValue?.address || null,
    isActive,
    status: normalizeText(parentValue?.status) || (isActive ? "Active" : "Inactive"),
    additionalInfo: normalizeText(parentValue?.additionalInfo) || "N/A",
    createdAt: parentValue?.createdAt || parentValue?.updatedAt || null,
    relationships,
    children,
    detailsLoaded: true,
  };
};

const sortParentsByName = (items = []) =>
  [...items].sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || "")));

function Parent() {
  const API_BASE = `${BACKEND_BASE}/api`;
  const [parents, setParents] = useState([]);
  const [loadingParents, setLoadingParents] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [parentTab, setParentTab] = useState("Details");
  const [parentChatOpen, setParentChatOpen] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");
  const [parentInfo, setParentInfo] = useState(null);
  const [children, setChildren] = useState([]);
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sidebarVisible, setSidebarVisible] = useState(window.innerWidth > 900);
  const [parentFullscreenOpen, setParentFullscreenOpen] = useState(false);
  const [togglingParentActive, setTogglingParentActive] = useState(false);
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(true);
  const [studentMenuOpen, setStudentMenuOpen] = useState(true);
  const typingTimeoutRef = useRef(null);
  const usersDataRef = useRef({});
  const parentsDataRef = useRef({});
  const studentsDataRef = useRef({});
  const [typingUserId, setTypingUserId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Build the admin object from the Admin session for the Admin web app.
  const _stored = (() => {
    const s = localStorage.getItem("admin");
    if (!s) return {};
    try {
      return JSON.parse(s) || {};
    } catch (e) {
      return {};
    }
  })();

  const admin = {
    adminId: _stored.financeId || _stored.adminId || _stored.userId || "",
    userId: _stored.userId || _stored.financeId || _stored.adminId || "",
    name: _stored.name || _stored.username || "Admin",
    profileImage: _stored.profileImage || "/default-profile.png",
    token: _stored.token || _stored.accessToken || _stored.idToken || null,
  };
  const schoolCode = _stored.schoolCode || "";
  const DB = schoolNodeBase(schoolCode);
  const PARENT_DIRECTORY_URL = `${DB}/ParentDirectory.json`;
  // expose username (from Users node) for sidebar display
  admin.username = _stored.username || "";
  const adminId = admin.userId;
  const selectedParentId = selectedParent?.userId || null;
  const chatId = admin?.userId && selectedParent?.userId ? getChatId(admin.userId, selectedParent.userId) : null;
  const {
    unreadSenders,
    setUnreadSenders,
    unreadPosts: postNotifications,
    setUnreadPosts: setPostNotifications,
    messageCount,
    totalNotifications,
    markMessagesAsSeen,
    markPostAsSeen,
  } = useTopbarNotifications({
    dbRoot: DB,
    currentUserId: admin.userId,
  });

  const maybeMarkLastMessageSeenForAdmin = async (chatKey, otherUserId = "") => {
    try {
      const summaryPath = `${DB}/${buildChatSummaryPath(admin.userId, chatKey)}.json`;
      const res = await axios.get(summaryPath).catch(() => ({ data: null }));
      const summary = normalizeChatSummaryValue(res.data, {
        chatId: chatKey,
        otherUserId,
      });
      const shouldMarkSeen = Boolean(summary.chatId) && summary.lastSenderId && String(summary.lastSenderId) !== String(admin.userId) && !summary.lastMessageSeen;

      await axios.patch(
        summaryPath,
        buildChatSummaryUpdate({
          chatId: chatKey,
          otherUserId,
          unreadCount: 0,
          ...(shouldMarkSeen
            ? {
                lastMessageSeen: true,
                lastMessageSeenAt: Date.now(),
              }
            : {}),
        })
      ).catch(() => {});
    } catch (e) {
      // ignore
    }
  };

  const updateParentInState = (parentUserId, updater) => {
    setParents((previousParents) =>
      previousParents.map((parentItem) =>
        String(parentItem?.userId || "") === String(parentUserId || "")
          ? { ...parentItem, ...(typeof updater === "function" ? updater(parentItem) : updater) }
          : parentItem
      )
    );

    setSelectedParent((previousParent) => {
      if (!previousParent || String(previousParent.userId || "") !== String(parentUserId || "")) {
        return previousParent;
      }

      return { ...previousParent, ...(typeof updater === "function" ? updater(previousParent) : updater) };
    });

    setParentInfo((previousParentInfo) => {
      if (!previousParentInfo || String(previousParentInfo.userId || "") !== String(parentUserId || "")) {
        return previousParentInfo;
      }

      return { ...previousParentInfo, ...(typeof updater === "function" ? updater(previousParentInfo) : updater) };
    });
  };

  const toggleParentActive = async () => {
    if (!selectedParent?.userId || togglingParentActive) return;

    const nextIsActive = selectedParent.isActive === false;
    const payload = {
      isActive: nextIsActive,
      status: nextIsActive ? "Active" : "Inactive",
    };
    const parentUserId = selectedParent.userId;
    const parentId = selectedParent.parentId && selectedParent.parentId !== "N/A" ? selectedParent.parentId : "";
    const directoryKey = selectedParent.directoryKey || parentUserId;

    setTogglingParentActive(true);
    try {
      await Promise.all([
        axios.patch(`${DB}/Users/${parentUserId}.json`, payload).catch(() => undefined),
        parentId ? axios.patch(`${DB}/Parents/${parentId}.json`, payload).catch(() => undefined) : Promise.resolve(),
        axios.patch(`${DB}/Parents/${parentUserId}.json`, payload).catch(() => undefined),
        axios.patch(`${DB}/ParentDirectory/${directoryKey}.json`, payload).catch(() => undefined),
        directoryKey !== parentUserId
          ? axios.patch(`${DB}/ParentDirectory/${parentUserId}.json`, payload).catch(() => undefined)
          : Promise.resolve(),
      ]);

      updateParentInState(parentUserId, payload);
    } catch (error) {
      console.error("Parent active toggle error:", error);
      alert(`Could not ${nextIsActive ? "activate" : "deactivate"} parent: ${error.message || error}`);
    } finally {
      setTogglingParentActive(false);
    }
  };

  const messagesEndRef = useRef(null);
  const formatDateLabel = (ts) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleDateString(); } catch { return ""; }
  };
  const formatTime = (ts) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ""; }
  };
  const [windowW, setWindowW] = useState(window.innerWidth);

  const isNarrow = windowW < 900;

  // Portrait detection helper used in sidebar layout
  const isPortrait = windowW <= 600;
  const contentLeft = 0;

  const loadParentDatasets = async (options = {}) => {
    const force = Boolean(options?.force);
    const hasCachedDatasets =
      Object.keys(usersDataRef.current || {}).length > 0 &&
      Object.keys(parentsDataRef.current || {}).length > 0 &&
      Object.keys(studentsDataRef.current || {}).length > 0;

    if (!force && hasCachedDatasets) {
      return {
        usersData: usersDataRef.current,
        parentsData: parentsDataRef.current,
        studentsData: studentsDataRef.current,
      };
    }

    const [usersData, parentsData, studentsData] = await Promise.all([
      fetchCachedJson(`${DB}/Users.json`, {
        ttlMs: BIG_NODE_CACHE_TTL_MS,
        fallbackValue: {},
        force,
      }),
      fetchCachedJson(`${DB}/Parents.json`, {
        ttlMs: BIG_NODE_CACHE_TTL_MS,
        fallbackValue: {},
        force,
      }),
      fetchCachedJson(`${DB}/Students.json`, {
        ttlMs: BIG_NODE_CACHE_TTL_MS,
        fallbackValue: {},
        force,
      }),
    ]);

    usersDataRef.current = usersData || {};
    parentsDataRef.current = parentsData || {};
    studentsDataRef.current = studentsData || {};

    return {
      usersData: usersDataRef.current,
      parentsData: parentsDataRef.current,
      studentsData: studentsDataRef.current,
    };
  };

  const getUserByKeyOrUserId = (usersData, maybeUserId) => {
    if (!maybeUserId) return null;
    return (
      usersData?.[maybeUserId] ||
      Object.values(usersData || {}).find((u) => String(u?.userId) === String(maybeUserId)) ||
      null
    );
  };

  const findStudentMatchById = (studentsData, maybeStudentId) => {
    if (!maybeStudentId) return null;

    if (studentsData?.[maybeStudentId]) {
      return { key: maybeStudentId, record: studentsData[maybeStudentId] };
    }

    const matchedEntry = Object.entries(studentsData || {}).find(
      ([studentKey, studentRecord]) =>
        String(studentKey) === String(maybeStudentId) ||
        String(studentRecord?.studentId || studentRecord?.id || "") === String(maybeStudentId) ||
        String(studentRecord?.use || studentRecord?.userId || studentRecord?.user || "") === String(maybeStudentId)
    );

    if (!matchedEntry) return null;

    return { key: matchedEntry[0], record: matchedEntry[1] };
  };

  const getResolvedParentChildLinks = ({
    parentRecord,
    parentRecordKey,
    parentUserId,
    studentsData,
  }) => {
    const parentIds = new Set(
      [parentRecordKey, parentRecord?.parentId].filter(Boolean).map((value) => String(value))
    );
    const parentUserIds = new Set(
      [parentUserId, parentRecord?.userId].filter(Boolean).map((value) => String(value))
    );
    const childMap = new Map();

    const addChildLink = (rawLink, fallbackStudentId = null) => {
      const studentMatch = findStudentMatchById(
        studentsData,
        rawLink?.studentId || rawLink?.student_id || rawLink?.id || fallbackStudentId
      );

      if (!studentMatch?.record) return;

      const canonicalStudentId =
        studentMatch.record?.studentId ||
        studentMatch.record?.id ||
        studentMatch.key;

      if (!canonicalStudentId) return;

      const childKey = String(canonicalStudentId);
      const existing = childMap.get(childKey) || {};

      childMap.set(childKey, {
        studentId: childKey,
        relationship:
          rawLink?.relationship ||
          rawLink?.relation ||
          rawLink?.childRelationship ||
          existing.relationship ||
          null,
      });
    };

    Object.values(parentRecord?.children || {}).forEach((childLink) => addChildLink(childLink));

    Object.entries(studentsData || {}).forEach(([studentKey, studentRecord]) => {
      const studentParents = studentRecord?.parents || {};

      Object.entries(studentParents).forEach(([studentParentKey, studentParentLink]) => {
        const matchesParent =
          parentIds.has(String(studentParentKey)) ||
          parentIds.has(String(studentParentLink?.parentId || "")) ||
          parentUserIds.has(String(studentParentLink?.userId || ""));

        if (!matchesParent) return;

        addChildLink(
          {
            studentId: studentRecord?.studentId || studentKey,
            relationship: studentParentLink?.relationship,
          },
          studentKey
        );
      });

      const guardianParents = Array.isArray(studentRecord?.parentGuardianInformation?.parents)
        ? studentRecord.parentGuardianInformation.parents
        : Object.values(studentRecord?.parentGuardianInformation?.parents || {});

      guardianParents.forEach((guardianLink) => {
        const matchesParent =
          parentIds.has(String(guardianLink?.parentId || "")) ||
          parentUserIds.has(String(guardianLink?.userId || guardianLink?.systemAccountInformation?.userId || ""));

        if (!matchesParent) return;

        addChildLink(
          {
            studentId: studentRecord?.studentId || studentKey,
            relationship: guardianLink?.relationship,
          },
          studentKey
        );
      });
    });

    return Array.from(childMap.values());
  };

  // Window resize handling for responsiveness
  useEffect(() => {
    const onResize = () => setWindowW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Keep sidebarVisible default based on screen size
  useEffect(() => {
    setSidebarVisible(windowW > 900);
  }, [windowW]);

  useEffect(() => {
    if (!selectedParent) {
      setParentFullscreenOpen(false);
    }
  }, [selectedParent]);

  // Fetch parents
  useEffect(() => {
    let cancelled = false;

    const fetchParents = async () => {
      setLoadingParents(true);
      try {
        const parentDirectoryData = await fetchCachedJson(PARENT_DIRECTORY_URL, {
          ttlMs: DIRECTORY_CACHE_TTL_MS,
          fallbackValue: {},
        });
        const directoryParentList = sortParentsByName(
          Object.entries(parentDirectoryData || {})
            .map(([parentKey, parentValue]) => normalizeParentDirectoryEntry(parentKey, parentValue))
            .filter((parentValue) => parentValue.userId)
        );

        if (directoryParentList.length > 0) {
          if (cancelled) return;
          setParents(directoryParentList);
          setSelectedParent((previousParent) => {
            if (!previousParent?.userId) return previousParent;
            return directoryParentList.find((parentValue) => String(parentValue.userId) === String(previousParent.userId)) || previousParent;
          });
          return;
        }

        const { usersData: users, parentsData, studentsData } = await loadParentDatasets();

        const findParentRecordByUserId = (canonicalUserId) => {
          if (!canonicalUserId) return null;
          return (
            parentsData?.[canonicalUserId] ||
            Object.entries(parentsData || {}).find(
              ([parentKey, p]) =>
                String(parentKey) === String(canonicalUserId) ||
                String(p?.userId) === String(canonicalUserId)
            )?.[1] ||
            null
          );
        };

        const resolveFirstChildPreview = (canonicalUserId) => {
          const parentRecord = findParentRecordByUserId(canonicalUserId);
          const parentRecordEntry = Object.entries(parentsData || {}).find(
            ([parentKey, parentValue]) =>
              String(parentKey) === String(canonicalUserId) ||
              String(parentValue?.userId) === String(canonicalUserId)
          );
          const childLinks = getResolvedParentChildLinks({
            parentRecord,
            parentRecordKey: parentRecordEntry?.[0] || parentRecord?.parentId || canonicalUserId,
            parentUserId: canonicalUserId,
            studentsData,
          });
          if (!childLinks.length) return null;

          const firstLink = childLinks[0] || {};
          const studentMatch = findStudentMatchById(studentsData, firstLink.studentId);
          const studentRecord = studentMatch?.record;
          if (!studentRecord) return null;
          const studentUserId = studentRecord.use || studentRecord.userId || studentRecord.user || null;
          const studentUser = getUserByKeyOrUserId(users, studentUserId);
          const name =
            studentUser?.name ||
            studentUser?.username ||
            studentRecord?.name ||
            studentRecord?.username ||
            null;
          const relationship = firstLink.relationship || null;
          return { name, relationship };
        };

        const parentList = Object.keys(users)
          .filter((uid) => users[uid].role === "parent")
          .map((uid) => {
            const u = users[uid] || {};
            const canonicalUserId = u.userId || uid;
            const parentRecord = findParentRecordByUserId(canonicalUserId);
            const firstChild = resolveFirstChildPreview(canonicalUserId);
            return {
              directoryKey: canonicalUserId,
              userId: canonicalUserId,
              parentId: parentRecord?.parentId || "N/A",
              name: u.name || u.username || "No Name",
              username: u.username || null,
              email: u.email || "N/A",
              childName: firstChild?.name || "N/A",
              childRelationship: firstChild?.relationship || "N/A",
              profileImage: u.profileImage || "/default-profile.png",
              phone: u.phone || u.phoneNumber || "N/A",
              age: u.age || null,
              city: u.city || (u.address && u.address.city) || null,
              citizenship: u.citizenship || null,
              job: u.job || null,
              address: u.address || null,
              isActive: u.isActive ?? parentRecord?.isActive ?? true,
              status: parentRecord?.status || (u.isActive === false ? "Inactive" : "Active"),
              createdAt: parentRecord?.createdAt || u.createdAt || null,
              detailsLoaded: false,
            };
          });

        if (cancelled) return;
        setParents(sortParentsByName(parentList));
      } catch (err) {
        console.error("Error fetching parents:", err);
        if (cancelled) return;
        setParents([]);
      } finally {
        if (!cancelled) {
          setLoadingParents(false);
        }
      }
    };
    fetchParents();

    return () => {
      cancelled = true;
    };
  }, [PARENT_DIRECTORY_URL]);

  // Mark post notification & navigate
  const handleNotificationClick = async (notification) => {
    try {
      await markPostAsSeen(notification.postId);
    } catch (err) {
      console.warn("Failed to mark notification:", err);
    }
    setPostNotifications((prev) =>
      prev.filter((n) => n.notificationId !== notification.notificationId)
    );
    setShowPostDropdown(false);
    navigate("/dashboard", { state: { postId: notification.postId } });
  };

  useEffect(() => {
    if (location.state?.postId) setPostNotifications([]);
  }, [location.state]);

  // Close messenger dropdown if clicked outside
  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".messenger-dropdown")) {
        setShowMessageDropdown(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  // Fetch parent info & children
  useEffect(() => {
    if (!selectedParentId) {
      setParentInfo(null);
      setChildren([]);
      return;
    }

    if (selectedParent?.detailsLoaded) {
      setParentInfo(selectedParent);
      setChildren(Array.isArray(selectedParent.children) ? selectedParent.children : []);
      return;
    }

    let cancelled = false;

    const fetchParentInfoAndChildren = async () => {
      try {
        const { parentsData, usersData, studentsData } = await loadParentDatasets();
        const parentRecordEntry =
          Object.entries(parentsData).find(
            ([parentKey, p]) =>
              String(p?.userId) === String(selectedParentId) ||
              String(parentKey) === String(selectedParentId)
          ) || [];
        const parentRecordKey = parentRecordEntry[0] || null;
        const parentRecord = parentRecordEntry[1] || null;
        const userInfo = getUserByKeyOrUserId(usersData, selectedParentId) || {};
        const resolvedChildLinks = getResolvedParentChildLinks({
          parentRecord,
          parentRecordKey,
          parentUserId: selectedParentId,
          studentsData,
        });

        // compute age from possible DOB fields or explicit age field
        const dobRaw = userInfo?.dob || userInfo?.birthDate || parentRecord?.dob || parentRecord?.birthDate || null;
        const computeAge = (dob) => {
          if (!dob) return null;
          try {
            const d = typeof dob === "number" ? new Date(dob) : new Date(String(dob));
            const now = new Date();
            let age = now.getFullYear() - d.getFullYear();
            const m = now.getMonth() - d.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
            return age;
          } catch (e) {
            return null;
          }
        };

        const age = parentRecord?.age || userInfo?.age || computeAge(dobRaw) || null;

        // derive relationships from child links if present
        const rels = resolvedChildLinks.map((childLink) => childLink.relationship).filter(Boolean);

        const info = {
          userId: selectedParentId,
          parentId: parentRecord?.parentId || selectedParent?.parentId || "N/A",
          name: userInfo.name || userInfo.username || "No Name",
          username: userInfo.username || null,
          email: userInfo.email || "N/A",
          phone: userInfo.phone || parentRecord?.phone || "N/A",
          isActive: userInfo.isActive ?? parentRecord?.isActive ?? true,
          job: userInfo.job || parentRecord?.job || null,
          relationships: rels,
          age: age ?? "—",
          city: parentRecord?.city || (parentRecord?.address && parentRecord.address.city) || userInfo.city || "—",
          citizenship: parentRecord?.citizenship || userInfo.citizenship || "—",
          status: parentRecord?.status || (userInfo.isActive ? "Active" : "Inactive") || "N/A",
          address: parentRecord?.address || userInfo.address || null,
          additionalInfo: parentRecord?.additionalInfo || "N/A",
          createdAt: parentRecord?.createdAt || userInfo.createdAt || "N/A",
          profileImage: userInfo.profileImage || "/default-profile.png",
        };

        if (cancelled) return;

        const childrenList = resolvedChildLinks
          .map((childLink) => {
            const studentMatch = findStudentMatchById(studentsData, childLink.studentId);
            const studentRecord = studentMatch?.record;
            if (!studentRecord) return null;
            const studentUserId = studentRecord.use || studentRecord.userId || studentRecord.user || null;
            const studentUser = getUserByKeyOrUserId(usersData, studentUserId) || {};
            return {
              studentId: studentRecord.studentId || studentMatch?.key || childLink.studentId,
              name: studentUser.name || studentUser.username || studentRecord.name || studentRecord.username || "N/A",
              email: studentUser.email || "N/A",
              grade: studentRecord.grade || "N/A",
              section: studentRecord.section || "N/A",
              parentPhone: parentRecord.phone || "N/A",
              relationship: childLink.relationship || "N/A",
              profileImage: studentUser.profileImage || studentRecord.profileImage || "/default-profile.png",
            };
          })
          .filter(Boolean);

        const hydratedParent = {
          ...info,
          children: childrenList,
          detailsLoaded: true,
        };

        setParentInfo(hydratedParent);
        setSelectedParent((prev) => {
          if (!prev || String(prev.userId) !== String(selectedParentId)) {
            return prev;
          }
          return { ...prev, ...hydratedParent };
        });

        if (cancelled) return;

        setChildren(childrenList);
      } catch (err) {
        console.error("Error fetching parent info and children:", err);

        if (cancelled) return;

        setParentInfo(null);
        setChildren([]);
      }
    };

    fetchParentInfoAndChildren();

    return () => {
      cancelled = true;
    };
  }, [DB, selectedParent, selectedParentId]);

  // Fetch chat messages in realtime
  useEffect(() => {
    if (!chatId || !parentChatOpen) {
      setMessages([]);
      return;
    }
    const db = getDatabase();
    const messagesRef = rdbRef(db, `Chats/${chatId}/messages`);
    const unsubscribe = onValue(messagesRef, async (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data)
        .map(([id, msg]) => ({ messageId: id, ...msg }))
        .sort((a, b) => a.timeStamp - b.timeStamp);
      setMessages(list);

      // mark unseen messages addressed to admin as seen
      const updates = {};
      Object.entries(data).forEach(([msgId, msg]) => {
        if (msg && msg.receiverId === admin.userId && !msg.seen) {
          updates[`${msgId}/seen`] = true;
        }
      });

      if (Object.keys(updates).length > 0) {
        try {
          await axios.patch(`${DB}/Chats/${chatId}/messages.json`, updates).catch(() => {});
        } catch (err) {
          console.warn('Failed to patch parent seen updates', err);
        }
      }

      maybeMarkLastMessageSeenForAdmin(chatId, selectedParent?.userId).catch(() => {});

      if (Object.keys(updates).length > 0) {
        // optimistic local update
        setMessages((prev) => prev.map((m) => (m.receiverId === admin.userId ? { ...m, seen: true } : m)));
      }
    });
    return () => unsubscribe();
  }, [DB, admin.userId, chatId, parentChatOpen, selectedParent?.userId]);

  // Listen to typing in realtime (only while popup open)
  useEffect(() => {
    if (!chatId || !parentChatOpen) {
      setTypingUserId(null);
      return;
    }
    const db = getDatabase();
    const typingRef = rdbRef(db, `Chats/${chatId}/typing`);
    const unsub = onValue(typingRef, (snapshot) => {
      const t = snapshot.val();
      setTypingUserId(t && t.userId ? t.userId : null);
    });
    return () => unsub();
  }, [chatId, parentChatOpen]);

  // Typing handler: write typing.userId to chat root while admin types
  const handleTyping = (text) => {
    if (!admin?.userId || !selectedParent?.userId) return;
    const chatKey = getChatId(admin.userId, selectedParent.userId);

    // If input cleared, clear typing immediately
    if (!text || !text.trim()) {
      axios.put(`${DB}/Chats/${chatKey}/typing.json`, null).catch(() => {});
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }

    // write typing user
    axios.put(`${DB}/Chats/${chatKey}/typing.json`, { userId: admin.userId }).catch(() => {});

    // debounce clearing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      axios.put(`${DB}/Chats/${chatKey}/typing.json`, null).catch(() => {});
      typingTimeoutRef.current = null;
    }, 1800);
  };

  // Clear typing when popup closes or selectedParent changes
  useEffect(() => {
    if (!parentChatOpen && selectedParent && admin?.userId) {
      const chatKey = getChatId(admin.userId, selectedParent.userId);
      axios.put(`${DB}/Chats/${chatKey}/typing.json`, null).catch(() => {});
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [parentChatOpen, selectedParent, admin]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, parentChatOpen]);

  // Ensure chat object exists
  const initChatIfMissing = async () => {
    if (!chatId) return;
    await axios.patch(`${DB}/Chats/${chatId}.json`, {
      participants: { [admin.userId]: true, [selectedParent.userId]: true },
      typing: null,
    }).catch(() => {});
  };

  // Send message
  const sendMessage = async (text) => {
    if (!text || !text.trim() || !selectedParent) return;
    if (!admin?.userId || !selectedParent?.userId) return;
    const id = getChatId(admin.userId, selectedParent.userId);
    await initChatIfMissing();

    // build message payload
    const newMsg = {
      senderId: admin.userId,
      receiverId: selectedParent.userId,
      type: "text",
      text,
      imageUrl: null,
      replyTo: null,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp: Date.now(),
    };

    try {
      // push message (let Firebase generate id)
      const pushRes = await axios.post(`${DB}/Chats/${id}/messages.json`, newMsg).catch(() => ({ data: null }));
      const generatedId = pushRes?.data?.name || `${Date.now()}`;

      // Ensure chat root contains participants and typing cleared.
      await axios.patch(`${DB}/Chats/${id}.json`, {
        participants: { [admin.userId]: true, [selectedParent.userId]: true },
        typing: null,
      }).catch(() => {});

      await Promise.all([
        axios.patch(
          `${DB}/${buildChatSummaryPath(admin.userId, id)}.json`,
          buildChatSummaryUpdate({
            chatId: id,
            otherUserId: selectedParent.userId,
            unreadCount: 0,
            lastMessageText: newMsg.text || "",
            lastMessageType: newMsg.type || "text",
            lastMessageTime: newMsg.timeStamp,
            lastSenderId: admin.userId,
            lastMessageSeen: false,
            lastMessageSeenAt: null,
          })
        ),
        axios.patch(
          `${DB}/${buildChatSummaryPath(selectedParent.userId, id)}.json`,
          buildChatSummaryUpdate({
            chatId: id,
            otherUserId: admin.userId,
            lastMessageText: newMsg.text || "",
            lastMessageType: newMsg.type || "text",
            lastMessageTime: newMsg.timeStamp,
            lastSenderId: admin.userId,
            lastMessageSeen: false,
            lastMessageSeenAt: null,
          })
        ),
      ]).catch(() => {});

      // increment unread for receiver summary
      try {
        const summaryRes = await axios.get(`${DB}/${buildChatSummaryPath(selectedParent.userId, id)}.json`);
        const summary = normalizeChatSummaryValue(summaryRes.data, {
          chatId: id,
          otherUserId: admin.userId,
        });
        await axios.patch(
          `${DB}/${buildChatSummaryPath(selectedParent.userId, id)}.json`,
          buildChatSummaryUpdate({
            chatId: id,
            otherUserId: admin.userId,
            unreadCount: Number(summary.unreadCount || 0) + 1,
          })
        ).catch(() => {});
      } catch (uErr) {
        await axios.patch(
          `${DB}/${buildChatSummaryPath(selectedParent.userId, id)}.json`,
          buildChatSummaryUpdate({
            chatId: id,
            otherUserId: admin.userId,
            unreadCount: 1,
          })
        ).catch(() => {});
      }

      // update local UI state immediately and clear typing indicator
      setNewMessageText("");
      // clear typing flag now that message was sent
      axios.put(`${DB}/Chats/${id}/typing.json`, null).catch(() => {});
    } catch (err) {
      console.error("Failed to send parent message:", err);
    }
  };

  // Mark as seen when selectedParent changes
  useEffect(() => {
    if (!selectedParent || !admin?.userId) return;
    const id = getChatId(admin.userId, selectedParent.userId);
    maybeMarkLastMessageSeenForAdmin(id, selectedParent.userId).catch(() => {});
  }, [DB, selectedParent, admin]);

  // allow rendering even if no admin/userId is present; effects will no-op when adminId is falsy

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredParents = useMemo(() => {
    if (!normalizedSearch) return parents;
    return (parents || []).filter((p) => {
      const hay = [
        p?.name,
        p?.email,
        p?.phone,
        p?.city,
        p?.job,
        p?.citizenship,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(normalizedSearch);
    });
  }, [parents, normalizedSearch]);

  const PRIMARY = "#007afb";
  const BACKGROUND = "#ffffff";
  const ACCENT = "#00B6A9";
  const rightSidebarOffset = !isPortrait ? 408 : 2;
  const FEED_MAX_WIDTH = "min(1320px, 100%)";
  const contentWidth = isNarrow
    ? "100%"
    : !isPortrait
      ? "min(760px, max(320px, calc(100vw - 560px)))"
      : "760px";

  const shellCardStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    borderRadius: 12,
    boxShadow: "var(--shadow-soft)",
  };

  const headerCardStyle = {
    ...shellCardStyle,
    borderRadius: 14,
    padding: "16px 18px 14px",
    position: "relative",
    overflow: "hidden",
    background: "linear-gradient(135deg, color-mix(in srgb, var(--surface-panel) 88%, white) 0%, color-mix(in srgb, var(--surface-panel) 94%, var(--surface-accent)) 100%)",
  };

  const elevatedPanelStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
  };

  const searchShellStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
  };

  const sidebarShellStyle = {
    background: "var(--surface-panel)",
    boxShadow: "var(--shadow-panel)",
    border: isPortrait ? "none" : "1px solid var(--border-soft)",
    borderRadius: isPortrait ? 0 : 18,
  };

  const detailsCardStyle = {
    padding: "14px",
    borderRadius: 16,
    margin: "0 auto",
    maxWidth: 380,
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
  };

  const infoTileStyle = {
    alignItems: "center",
    justifyContent: "flex-start",
    display: "flex",
    background: "var(--surface-soft)",
    padding: "10px",
    borderRadius: 14,
    border: "1px solid var(--border-soft)",
    minHeight: 52,
  };

  const statusValueColor = (label, value) => {
    if (label !== "Status") return "var(--text-primary)";
    return value && String(value).toLowerCase() === "active" ? "var(--success)" : "var(--danger)";
  };

  const tabButtonStyle = (isActive) => ({
    flex: 1,
    padding: "8px",
    background: isActive ? "var(--surface-accent)" : "transparent",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    color: isActive ? "var(--accent-strong)" : "var(--text-muted)",
    fontSize: "11px",
    borderBottom: isActive ? "2px solid var(--accent-strong)" : "2px solid transparent",
    transition: "all 0.2s ease",
  });

  const chatFabStyle = {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "56px",
    height: "56px",
    background: "var(--accent-strong)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    cursor: "pointer",
    zIndex: 1000,
    boxShadow: "var(--shadow-glow)",
    transition: "transform 0.2s ease",
  };

  const chatWindowStyle = {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "360px",
    height: "480px",
    background: "var(--surface-panel)",
    borderRadius: "16px",
    boxShadow: "var(--shadow-panel)",
    border: "1px solid var(--border-soft)",
    zIndex: 2000,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const chatInputStyle = {
    flex: 1,
    padding: "10px 14px",
    borderRadius: "25px",
    border: "1px solid var(--input-border)",
    outline: "none",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
  };

  const actionCircleButtonStyle = {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--text-secondary)",
  };

  const parentCardBase = {
    maxWidth: "100%",
    minHeight: "86px",
    borderRadius: "14px",
    padding: "12px",
    cursor: "pointer",
    transition: "all 0.25s ease",
    width: "100%",
    boxSizing: "border-box",
    position: "relative",
  };

  const renderParentProfilePanel = (isFullscreen = false) => {
    if (!selectedParent) return null;

    const activeParent = parentInfo && String(parentInfo.userId) === String(selectedParent.userId)
      ? { ...selectedParent, ...parentInfo }
      : selectedParent;

    const formattedStatus = activeParent.status
      ? `${String(activeParent.status).charAt(0).toUpperCase()}${String(activeParent.status).slice(1)}`
      : "—";
    const parentIsActive = activeParent.isActive !== false;
    const formattedRelationships = Array.isArray(activeParent.relationships) && activeParent.relationships.length > 0
      ? Array.from(new Set(activeParent.relationships.filter(Boolean))).join(", ")
      : (activeParent.childRelationship && activeParent.childRelationship !== "N/A" ? activeParent.childRelationship : "—");
    const formattedAddress = typeof activeParent.address === "string"
      ? activeParent.address
      : activeParent.address && typeof activeParent.address === "object"
        ? [
            activeParent.address.street,
            activeParent.address.subCity,
            activeParent.address.city,
            activeParent.address.state,
            activeParent.address.region,
          ].filter(Boolean).join(", ") || JSON.stringify(selectedParent.address)
        : "—";
    const formattedCreatedAt = activeParent.createdAt && activeParent.createdAt !== "N/A"
      ? new Date(activeParent.createdAt).toLocaleString()
      : "—";
    const profileItems = [
      { label: "Parent ID", value: activeParent.parentId || "—" },
      { label: "Username", value: activeParent.username || "—" },
      { label: "Email", value: activeParent.email || "N/A" },
      { label: "Phone", value: activeParent.phone || "N/A" },
      { label: "Age", value: activeParent.age || "—" },
      { label: "City", value: activeParent.city || (activeParent.address && typeof activeParent.address === "object" ? activeParent.address.city : activeParent.city) || "—" },
      { label: "Citizenship", value: activeParent.citizenship || "—" },
      { label: "Job", value: activeParent.job || "—" },
      { label: "Status", value: formattedStatus },
      { label: "Relationship", value: formattedRelationships },
      { label: "Children", value: children.length || "0" },
      { label: "Created", value: formattedCreatedAt },
      { label: "Address", value: formattedAddress, fullWidth: true },
      { label: "Additional Info", value: activeParent.additionalInfo && activeParent.additionalInfo !== "N/A" ? activeParent.additionalInfo : "—", fullWidth: true },
    ];

    const detailsSection = (
      <div style={detailsCardStyle}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Parent profile
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>Cleaner guardian and contact snapshot.</div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: parentIsActive ? "var(--success)" : "var(--danger)", fontSize: 11, fontWeight: 900 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: parentIsActive ? "var(--success)" : "var(--danger)" }} />
            {parentIsActive ? "Active" : "Inactive"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button
            type="button"
            onClick={toggleParentActive}
            disabled={togglingParentActive}
            style={{
              border: "none",
              borderRadius: 10,
              padding: "8px 12px",
              background: parentIsActive ? "#ff4d4f" : "var(--accent-strong)",
              color: "#fff",
              cursor: togglingParentActive ? "not-allowed" : "pointer",
              fontSize: 11,
              fontWeight: 800,
              opacity: togglingParentActive ? 0.75 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {togglingParentActive ? "Saving..." : parentIsActive ? "Deactivate" : "Activate"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
          {[
            { label: "Children", value: children.length || 0 },
            { label: "Status", value: parentIsActive ? "Active" : "Inactive" },
            { label: "Relation", value: formattedRelationships === "—" ? "N/A" : formattedRelationships.split(",")[0] },
          ].map((item) => (
            <div key={item.label} style={{ background: "var(--surface-soft)", border: "1px solid var(--border-soft)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{item.label}</div>
              <div style={{ fontSize: item.label === "Relation" ? 12 : 20, fontWeight: 900, color: statusValueColor(item.label === "Status" ? "Status" : item.label, item.value), marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 14px", borderRadius: 14, background: "var(--surface-soft)", border: "1px solid var(--border-soft)", marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.45px" }}>Parent ID</div>
          <div style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 900, marginTop: 4 }}>{activeParent.parentId || "N/A"}</div>
        </div>

        <div style={{ ...detailsCardStyle, padding: 14, boxShadow: "none", margin: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.45px", marginBottom: 10 }}>Profile details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {profileItems.map((item) => (
              <div key={item.label} style={{ ...infoTileStyle, gridColumn: item.fullWidth ? "1 / -1" : "auto" }}>
                <div>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.4px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: statusValueColor(item.label, item.value), marginTop: 2, wordBreak: "break-word" }}>
                    {item.value || <span style={{ color: "var(--text-muted)" }}>N/A</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    const childrenSection = (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children.length === 0 ? (
          <div style={{ padding: 10, borderRadius: 12, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-muted)" }}>
            No children found.
          </div>
        ) : (
          children.map((c) => (
            <div
              key={c.studentId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px",
                borderRadius: 12,
                ...elevatedPanelStyle,
              }}
            >
              <ProfileAvatar src={c.profileImage} name={c.name} alt={c.name} loading="lazy" style={{ width: 44, height: 44, borderRadius: 22, objectFit: "cover", border: "2px solid var(--accent-strong)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-primary)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  Grade {c.grade}{c.section ? ` • ${c.section}` : ""}
                  {` • Relation: ${c.relationship || "N/A"}`}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );

    const statusSection = (
      <div style={{ padding: "12px", borderRadius: 12, border: "1px solid var(--border-soft)", background: "var(--surface-panel)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Status", value: selectedParent.status || "Active" },
            { label: "Created", value: selectedParent.createdAt ? new Date(selectedParent.createdAt).toLocaleString() : "—" },
          ].map((item) => (
            <div key={item.label} style={{ padding: 8, borderRadius: 10, border: "1px solid var(--border-soft)", background: "var(--surface-muted)" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.4px", color: "var(--text-muted)", textTransform: "uppercase" }}>{item.label}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-primary)", marginTop: 2, wordBreak: "break-word" }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    );

    if (isFullscreen) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            background: "linear-gradient(180deg, var(--page-bg-secondary) 0%, var(--page-bg) 100%)",
            overflowY: "auto",
            padding: "16px 20px 24px",
          }}
        >
          <div
            style={{
              maxWidth: 1180,
              margin: "0 auto",
              background: "var(--surface-panel)",
              border: "1px solid var(--border-soft)",
              borderRadius: 16,
              boxShadow: "var(--shadow-panel)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                color: "#fff",
                background: "linear-gradient(135deg, var(--accent-strong), var(--accent))",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ProfileAvatar src={activeParent.profileImage} name={activeParent.name} alt={activeParent.name} style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.8)", objectFit: "cover" }} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{activeParent.name || "Parent"}</div>
                  <div style={{ fontSize: 12, opacity: 0.95 }}>
                    {activeParent.parentId || "No Parent ID"}
                    {activeParent.phone ? ` • ${activeParent.phone}` : ""}
                    {activeParent.email ? ` • ${activeParent.email}` : ""}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => setParentFullscreenOpen(false)}
                  style={{
                    border: "1px solid rgba(255,255,255,0.45)",
                    background: "rgba(255,255,255,0.14)",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Exit Full Screen
                </button>
              </div>
            </div>

            <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, padding: 10, boxShadow: "var(--shadow-soft)" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-strong)", marginBottom: 8 }}>Parent Details</div>
                {detailsSection}
              </div>

              <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, padding: 10, boxShadow: "var(--shadow-soft)" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-strong)", marginBottom: 8 }}>Status</div>
                {statusSection}
              </div>

              <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, padding: 10, boxShadow: "var(--shadow-soft)", gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-strong)", marginBottom: 8 }}>Children</div>
                {childrenSection}
              </div>
            </div>
          </div>
        </div>
      );
    }

    const panelStyle = isFullscreen
      ? {
          position: "fixed",
          inset: 12,
          background: "var(--page-bg-secondary)",
          zIndex: 1400,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: isPortrait ? 0 : 24,
          border: isPortrait ? "none" : "1px solid var(--border-soft)",
          boxShadow: "var(--shadow-panel)",
          fontSize: "10px",
        }
      : {
          width: isPortrait ? "100%" : "380px",
          position: "fixed",
          left: isPortrait ? 0 : "auto",
          right: isPortrait ? 0 : 14,
          top: isPortrait ? 0 : "calc(var(--topbar-height) + 18px)",
          height: isPortrait ? "100vh" : "calc(100vh - var(--topbar-height) - 36px)",
          maxHeight: isPortrait ? "100vh" : "calc(100vh - var(--topbar-height) - 36px)",
          ...sidebarShellStyle,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          padding: "14px",
          fontSize: "12px",
        };

    return (
      <aside className="parent-info-sidebar" style={panelStyle}>
        <div style={{ position: "absolute", top: 12, left: 14, zIndex: 999 }}>
          <button
            onClick={() => {
              if (isFullscreen) {
                setParentFullscreenOpen(false);
                return;
              }
              setParentFullscreenOpen(false);
              setSidebarVisible(false);
            }}
            aria-label={isFullscreen ? "Close expanded parent profile" : "Close sidebar"}
            style={{
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.42)",
              borderRadius: 999,
              backdropFilter: "blur(6px)",
              fontSize: 24,
              fontWeight: 700,
              color: "#ffffff",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
              boxShadow: "0 8px 22px rgba(15, 23, 42, 0.18)",
            }}
          >
            ×
          </button>
        </div>

        {!isFullscreen && (
          <div style={{ position: "absolute", top: 8, right: 14, zIndex: 999 }}>
            <button
              onClick={() => setParentFullscreenOpen(true)}
              aria-label="Expand parent profile"
              title="Expand"
              style={{
                border: "1px solid var(--border-strong)",
                background: "var(--surface-panel)",
                color: "var(--accent-strong)",
                borderRadius: 8,
                padding: "4px 8px",
                fontSize: 14,
                cursor: "pointer",
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              ⤢
            </button>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div
            style={{
              background: "linear-gradient(135deg, var(--accent-strong), var(--accent))",
              margin: "-14px -14px 12px",
              padding: "16px 10px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "70px",
                height: "70px",
                margin: "0 auto 10px",
                borderRadius: "50%",
                overflow: "hidden",
                border: "3px solid rgba(255,255,255,0.8)",
              }}
            >
              <ProfileAvatar src={selectedParent.profileImage} name={selectedParent.name} alt={selectedParent.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <h2 style={{ margin: 0, color: "#ffffff", fontSize: 14, fontWeight: 800 }}>{selectedParent.name}</h2>
            <p style={{ margin: "4px 0", color: "#dbeafe", fontSize: "10px" }}>{selectedParent.parentId || "No Parent ID"}</p>
            <p style={{ margin: 0, color: "#dbeafe", fontSize: "10px" }}>
              {selectedParent.phone || "No phone"}
              {selectedParent.email ? ` • ${selectedParent.email}` : ""}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--border-soft)",
              marginBottom: "10px",
              flexShrink: 0,
              background: "var(--surface-panel)",
            }}
          >
            {[
              { key: "Details", label: "DETAILS" },
              { key: "Children", label: "CHILDREN" },
              { key: "Status", label: "STATUS" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setParentTab(t.key)}
                style={tabButtonStyle(parentTab === t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", paddingBottom: 40, paddingRight: 2 }}>
            {parentTab === "Details" && detailsSection}
            {parentTab === "Children" && childrenSection}
            {parentTab === "Status" && statusSection}
          </div>

          {!parentChatOpen && (
            <div onClick={() => setParentChatOpen(true)} style={chatFabStyle}>
              <FaCommentDots size={30} />
            </div>
          )}

          {parentChatOpen && (
            <div style={chatWindowStyle}>
              <div style={{ padding: "14px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "color-mix(in srgb, var(--accent-soft) 78%, var(--surface-panel) 22%)" }}>
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                  <strong style={{ color: "var(--text-primary)" }}>{selectedParent.name}</strong>
                  {typingUserId && String(typingUserId) === String(selectedParent.userId) && (
                    <small style={{ color: "var(--accent-strong)", marginTop: 4 }}>Typing…</small>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => {
                      setParentChatOpen(false);
                      navigate("/all-chat", { state: { user: selectedParent, tab: "parent" } });
                    }}
                    style={{ ...actionCircleButtonStyle, fontSize: "18px" }}
                  >
                    ⤢
                  </button>
                  <button onClick={() => setParentChatOpen(false)} style={{ ...actionCircleButtonStyle, fontSize: "20px" }}>×</button>
                </div>
              </div>

              <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", background: "var(--surface-muted)" }}>
                {messages.length === 0 ? (
                  <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Start chatting with {selectedParent.name}</p>
                ) : (
                  messages.map((m) => {
                    const isAdmin = String(m.senderId) === String(admin.userId);
                    return (
                      <div key={m.messageId || m.id} style={{ display: "flex", flexDirection: "column", alignItems: isAdmin ? "flex-end" : "flex-start", marginBottom: 10 }}>
                        <div style={{ maxWidth: "70%", background: isAdmin ? "var(--accent-strong)" : "var(--surface-panel)", color: isAdmin ? "#fff" : "var(--text-primary)", padding: "10px 14px", borderRadius: 18, borderTopRightRadius: isAdmin ? 0 : 18, borderTopLeftRadius: isAdmin ? 18 : 0, boxShadow: "0 1px 3px rgba(0,0,0,0.10)", wordBreak: "break-word", cursor: "default", position: "relative", border: isAdmin ? "none" : "1px solid var(--border-soft)" }}>
                          {m.text} {m.edited && (<small style={{ fontSize: 10 }}> (edited)</small>)}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 6, fontSize: 11, color: isAdmin ? "#fff" : "var(--text-muted)" }}>
                            <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>{formatDateLabel(m.timeStamp)}</span>
                            <span>{formatTime(m.timeStamp)}</span>
                            {isAdmin && !m.deleted && (
                              <span style={{ display: "flex", gap: 0, alignItems: "center" }}>
                                <FaCheck size={10} color={isAdmin ? "#fff" : "var(--text-muted)"} style={{ opacity: 0.90, marginLeft: 2 }} />
                                {m.seen && (<FaCheck size={10} color={isAdmin ? "color-mix(in srgb, white 90%, var(--accent-soft) 10%)" : "var(--border-strong)"} style={{ marginLeft: -6, opacity: 0.95 }} />)}
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

              <div style={{ padding: "10px", borderTop: "1px solid var(--border-soft)", display: "flex", gap: "8px", background: "var(--surface-panel)" }}>
                <input value={newMessageText} onChange={(e) => { setNewMessageText(e.target.value); handleTyping(e.target.value); }} placeholder="Type a message..." style={chatInputStyle} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(newMessageText); }} />
                <button onClick={() => sendMessage(newMessageText)} style={{ width: 45, height: 45, borderRadius: "50%", background: "var(--accent-strong)", border: "none", color: "#fff", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
                  <FaPaperPlane />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    );
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
        "--surface-soft": "#F8FBFF",
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
        "--on-accent": "#ffffff",
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

        {/* MAIN CONTENT */}
        <main
          className={`main-content ${selectedParent && sidebarVisible && !parentFullscreenOpen ? "sidebar-open" : ""}`}
          style={{
            flex: "1 1 0",
            minWidth: 0,
            maxWidth: "none",
            margin: 0,
            boxSizing: "border-box",
            alignSelf: "flex-start",
            minHeight: "calc(100vh - 24px)",
            overflowY: "visible",
            overflowX: "hidden",
            position: "relative",
            padding: `0 ${selectedParent && sidebarVisible && !parentFullscreenOpen ? rightSidebarOffset : 2}px 0 2px`,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div className="main-inner" style={{ width: "100%", maxWidth: FEED_MAX_WIDTH, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 56 }}>
            <div
              className="section-header-card"
              style={headerCardStyle}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, var(--accent), var(--accent-strong), color-mix(in srgb, var(--accent) 68%, white))" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.01em" }}>Parents</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)", maxWidth: 620, lineHeight: 1.5 }}>
                    Manage parent accounts, child links, activation status, and communication from the same admin workspace as the Students page.
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, position: "relative", zIndex: 1 }}>
                {[
                  { label: `Total: ${parents.length}` },
                  { label: `Visible: ${filteredParents.length}` },
                  { label: `Active: ${parents.filter((parent) => parent.isActive !== false).length}` },
                ].map((item) => (
                  <div key={item.label} style={{ padding: "7px 12px", borderRadius: 999, background: "color-mix(in srgb, var(--surface-panel) 72%, white)", border: "1px solid var(--border-soft)", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: isNarrow ? "center" : "flex-start", marginBottom: "10px", paddingLeft: contentLeft }}>
              <div
                style={{
                  width: contentWidth,
                  ...searchShellStyle,
                }}
              >
                <FaSearch style={{ color: "var(--text-muted)", fontSize: "12px" }} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search parents by name, email, phone"
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: "13px",
                    color: "var(--text-primary)",
                    background: "transparent",
                  }}
                />
              </div>
            </div>

            {loadingParents ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: isNarrow ? "center" : "flex-start", gap: "12px", paddingLeft: contentLeft }}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} style={{ width: contentWidth, minHeight: "86px", borderRadius: "14px", padding: "12px", background: "var(--surface-panel)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-soft)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-muted)" }} />
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface-muted)" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ width: "55%", height: 12, background: "var(--surface-muted)", borderRadius: 6, marginBottom: 8 }} />
                        <div style={{ width: "45%", height: 10, background: "var(--surface-muted)", borderRadius: 6 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredParents.length === 0 ? (
              <p style={{ width: contentWidth, marginLeft: contentLeft, textAlign: "center", color: "var(--text-secondary)" }}>No parents found.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: isNarrow ? "center" : "flex-start", gap: "12px", paddingLeft: contentLeft }}>
                {filteredParents.map((p, i) => (
                  <div
                    key={p.userId}
                    onClick={() => { setSelectedParent(p); setSidebarVisible(true); }}
                    style={{
                      ...parentCardBase,
                      width: contentWidth,
                      background: selectedParent?.userId === p.userId ? "var(--surface-accent)" : "var(--surface-panel)",
                      border: selectedParent?.userId === p.userId ? "2px solid var(--accent-strong)" : "1px solid var(--border-soft)",
                      boxShadow: selectedParent?.userId === p.userId ? "var(--shadow-glow)" : "var(--shadow-soft)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingRight: 94 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: "color-mix(in srgb, var(--accent-soft) 75%, var(--surface-panel) 25%)",
                          color: "var(--accent-strong)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: 13,
                          flex: "0 0 auto",
                        }}
                      >
                        {i + 1}
                      </div>
                      <ProfileAvatar src={p.profileImage} name={p.name} alt={p.name} loading="lazy" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: selectedParent?.userId === p.userId ? "3px solid var(--accent-strong)" : "3px solid var(--border-soft)", transition: "all 0.3s ease" }} />
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: "14px", color: "var(--text-primary)", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.name}
                        </h3>
                        <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.email && p.email !== "N/A" ? p.email : `${p.childRelationship || "N/A"}: ${p.childName || "N/A"}`}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        top: 14,
                        right: 12,
                        padding: "5px 9px",
                        borderRadius: 999,
                        background: p.isActive === false ? "var(--warning-soft)" : "var(--success-soft)",
                        color: p.isActive === false ? "var(--danger)" : "var(--success)",
                        border: p.isActive === false ? "1px solid var(--warning-border)" : "1px solid var(--success-border)",
                        fontSize: 10,
                        fontWeight: 900,
                        lineHeight: 1,
                      }}
                    >
                      {p.isActive === false ? "Inactive" : "Active"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* RIGHT SIDEBAR */}
        {selectedParent && sidebarVisible && !parentFullscreenOpen && renderParentProfilePanel(false)}
        {selectedParent && parentFullscreenOpen && renderParentProfilePanel(true)}

      </div>
    </div>
  );
}

export default Parent;