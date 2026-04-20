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
import RegisterSidebar from "../components/RegisterSidebar";
import ProfileAvatar from "../components/ProfileAvatar";
import {
  buildUserLookupFromNode,
  loadSchoolParentsNode,
  loadSchoolStudentsNode,
  loadSchoolUsersNode,
} from "../utils/registerData";

const DB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";
const getChatId = (a, b) => [a, b].sort().join("_");

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
  const [expandedChildren, setExpandedChildren] = useState({});
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sidebarVisible, setSidebarVisible] = useState(window.innerWidth > 900);
  const [parentFullscreenOpen, setParentFullscreenOpen] = useState(false);
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(true);
  const [studentMenuOpen, setStudentMenuOpen] = useState(true);
  const typingTimeoutRef = useRef(null);
  const [typingUserId, setTypingUserId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Build backward-compatible admin object from `finance` or legacy `admin` in localStorage
  const _stored = (() => {
    const s = localStorage.getItem("registrar") || localStorage.getItem("admin");
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
  const DB = schoolCode ? `${DB_BASE}/Platform1/Schools/${schoolCode}` : DB_BASE;
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

  const maybeMarkLastMessageSeenForAdmin = async (chatKey) => {
    try {
      const res = await axios.get(`${DB}/Chats/${chatKey}/lastMessage.json`).catch(() => ({ data: null }));
      const last = res.data;
      if (!last) return;
      if (String(last.receiverId) === String(admin.userId) && last.seen === false) {
        await axios.patch(`${DB}/Chats/${chatKey}/lastMessage.json`, { seen: true }).catch(() => {});
      }
    } catch (e) {
      // ignore
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
  const contentLeft = isNarrow ? 0 : 90;

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
    const fetchParents = async () => {
      setLoadingParents(true);
      try {
        const [usersNode, parentsData, studentsData] = await Promise.all([
          loadSchoolUsersNode({ rtdbBase: DB }),
          loadSchoolParentsNode({ rtdbBase: DB }),
          loadSchoolStudentsNode({ rtdbBase: DB }),
        ]);

        const users = buildUserLookupFromNode(usersNode);

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
          if (!childLinks.length) return { name: null, relationship: null, childCount: 0 };

          const firstLink = childLinks[0] || {};
          const studentMatch = findStudentMatchById(studentsData, firstLink.studentId);
          const studentRecord = studentMatch?.record;
          if (!studentRecord) {
            return {
              name: null,
              relationship: firstLink.relationship || null,
              childCount: childLinks.length,
            };
          }
          const studentUserId = studentRecord.use || studentRecord.userId || studentRecord.user || null;
          const studentUser = getUserByKeyOrUserId(users, studentUserId);
          const name =
            studentUser?.name ||
            studentUser?.username ||
            studentRecord?.name ||
            studentRecord?.username ||
            null;
          const relationship = firstLink.relationship || null;
          return { name, relationship, childCount: childLinks.length };
        };

        const parentList = Object.keys(users)
          .filter((uid) => users[uid].role === "parent")
          .map((uid) => {
            const u = users[uid] || {};
            const canonicalUserId = u.userId || uid;
            const parentRecord = findParentRecordByUserId(canonicalUserId);
            const firstChild = resolveFirstChildPreview(canonicalUserId);
            return {
              userId: canonicalUserId,
              parentId: parentRecord?.parentId || "N/A",
              name: u.name || u.username || "No Name",
              email: u.email || "N/A",
              childName: firstChild?.name || "N/A",
              childRelationship: firstChild?.relationship || "N/A",
              childCount: firstChild?.childCount || 0,
              profileImage: u.profileImage || "/default-profile.png",
              phone: u.phone || u.phoneNumber || "N/A",
              age: u.age || null,
              city: u.city || (u.address && u.address.city) || null,
              citizenship: u.citizenship || null,
              job: u.job || null,
              address: u.address || null,
            };
          });
        setParents(parentList);
      } catch (err) {
        console.error("Error fetching parents:", err);
        setParents([]);
      } finally {
        setLoadingParents(false);
      }
    };
    fetchParents();
  }, [DB]);

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
    if (!selectedParentId) return;

    let cancelled = false;

    const fetchParentInfoAndChildren = async () => {
      try {
        const [parentsData, usersNode, studentsData] = await Promise.all([
          loadSchoolParentsNode({ rtdbBase: DB }),
          loadSchoolUsersNode({ rtdbBase: DB }),
          loadSchoolStudentsNode({ rtdbBase: DB }),
        ]);
        const usersData = buildUserLookupFromNode(usersNode);
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

        setParentInfo(info);
        setSelectedParent((prev) => {
          if (!prev || String(prev.userId) !== String(selectedParentId)) {
            return prev;
          }
          return { ...prev, ...info };
        });

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
  }, [DB, selectedParentId]);

  // Fetch chat messages in realtime
  useEffect(() => {
    if (!chatId) return;
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
        // also reset unread for admin; only mark lastMessage seen if it was sent to admin
        axios.patch(`${DB}/Chats/${chatId}/unread.json`, { [admin.userId]: 0 }).catch(() => {});
        maybeMarkLastMessageSeenForAdmin(chatId);
        // optimistic local update
        setMessages((prev) => prev.map((m) => (m.receiverId === admin.userId ? { ...m, seen: true } : m)));
      }
    });
    return () => unsubscribe();
  }, [chatId]);

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

  // Mark messages as seen when the chat popup opens or selected parent changes
  useEffect(() => {
    if (!parentChatOpen || !selectedParent || !admin?.userId) return;
    const chatKey = getChatId(admin.userId, selectedParent.userId);

    const markSeen = async () => {
      try {
        const res = await axios.get(`${DB}/Chats/${chatKey}/messages.json`);
        const data = res.data || {};
        const updates = {};
        Object.entries(data).forEach(([msgId, msg]) => {
          if (msg && msg.receiverId === admin.userId && !msg.seen) {
            updates[`${msgId}/seen`] = true;
          }
        });

        if (Object.keys(updates).length > 0) {
          // Patch the messages node with per-message seen updates
          await axios.patch(`${DB}/Chats/${chatKey}/messages.json`, updates).catch(() => {});
        }

        // Optimistically update local state
        setMessages((prev) => prev.map((m) => (m.receiverId === admin.userId ? { ...m, seen: true } : m)));
      } catch (err) {
        console.warn("Failed to mark messages as seen:", err);
      }
    };

    markSeen();
    // also reset unread counter for admin in chat root
    axios.patch(`${DB}/Chats/${chatKey}/unread.json`, { [admin.userId]: 0 }).catch(() => {});
    maybeMarkLastMessageSeenForAdmin(chatKey);
    axios.put(`${DB}/Chats/${chatKey}/typing.json`, null).catch(() => {});
  }, [parentChatOpen, selectedParent, admin]);

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
      unread: { [admin.userId]: 0, [selectedParent.userId]: 0 },
      typing: null,
      lastMessage: null,
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

      // Build a full lastMessage object matching desired DB structure
      const lastMessage = {
        messageId: generatedId,
        senderId: newMsg.senderId,
        receiverId: newMsg.receiverId,
        text: newMsg.text || "",
        type: newMsg.type || "text",
        timeStamp: newMsg.timeStamp,
        seen: false,
        edited: false,
        deleted: false,
      };

      // Ensure chat root contains participants, typing cleared, and full lastMessage
      await axios.patch(`${DB}/Chats/${id}.json`, {
        participants: { [admin.userId]: true, [selectedParent.userId]: true },
        lastMessage,
        typing: null,
      }).catch(() => {});

      // increment unread for receiver (preserve existing unread counts)
      try {
        const unreadRes = await axios.get(`${DB}/Chats/${id}/unread.json`);
        const unread = unreadRes.data || {};
        const prev = Number(unread[selectedParent.userId] || 0);
        const updated = { ...(unread || {}), [selectedParent.userId]: prev + 1, [admin.userId]: Number(unread[admin.userId] || 0) };
        await axios.put(`${DB}/Chats/${id}/unread.json`, updated).catch(() => {});
      } catch (uErr) {
        await axios.put(`${DB}/Chats/${id}/unread.json`, { [selectedParent.userId]: 1, [admin.userId]: 0 }).catch(() => {});
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
    axios.patch(`${DB}/Chats/${id}/unread.json`, { [admin.userId]: 0 }).catch(() => {});
    maybeMarkLastMessageSeenForAdmin(id);
  }, [selectedParent, admin]);

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

  // MAIN CONTENT (Teachers-like layout)
  const mainContentStyle = {
    padding: "10px 20px 52px",
    flex: 1,
    minWidth: 0,
    boxSizing: "border-box",
    height: "100%",
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "flex-start",
  };

  const pageBackground = "linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-secondary) 100%)";

  const panelStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-panel)",
  };

  const elevatedPanelStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
  };

  const heroStyle = {
    position: "relative",
    overflow: "hidden",
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
    background: "var(--surface-overlay)",
    boxShadow: "var(--shadow-panel)",
    borderLeft: isPortrait ? "none" : "1px solid var(--border-soft)",
  };

  const detailsCardStyle = {
    padding: "12px",
    borderRadius: 12,
    margin: "0 auto",
    maxWidth: 380,
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
  };

  const infoTileStyle = {
    alignItems: "center",
    justifyContent: "flex-start",
    display: "flex",
    background: "var(--surface-muted)",
    padding: "8px",
    borderRadius: 10,
    border: "1px solid var(--border-soft)",
    minHeight: 36,
  };

  const statusValueColor = (label, value) => {
    if (label !== "Status") return "var(--text-primary)";
    return value && String(value).toLowerCase() === "active" ? "var(--success)" : "var(--danger)";
  };

  const tabButtonStyle = (isActive) => ({
    flex: 1,
    padding: "6px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    color: isActive ? "var(--accent-strong)" : "var(--text-muted)",
    fontSize: "10px",
    borderBottom: isActive ? "3px solid var(--accent-strong)" : "3px solid transparent",
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
    minHeight: "86px",
    borderRadius: "14px",
    padding: "12px",
    cursor: "pointer",
    transition: "all 0.25s ease",
    width: "100%",
    boxSizing: "border-box",
  };

  const listShellWidth = isPortrait ? "100%" : "min(100%, 640px)";

  const ParentItem = ({ parent, selected, onClick, number }) => (
    <div
      onClick={() => onClick(parent)}
      style={{
        ...parentCardBase,
        padding: "11px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: "#ffffff",
        border: selected ? "1px solid #93c5fd" : "1px solid #e2e8f0",
        boxShadow: selected
          ? "0 14px 28px rgba(37, 99, 235, 0.16), inset 3px 0 0 #2563eb"
          : "0 4px 10px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: selected ? "#007AFB" : "#eef2ff",
          color: selected ? "#fff" : "#334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {number}
      </div>

      <ProfileAvatar
        imageUrl={parent.profileImage}
        name={parent.name}
        size={48}
        style={{
          border: selected ? "2px solid #60a5fa" : "2px solid #e2e8f0",
          background: "#ffffff",
        }}
      />

      <div style={{ minWidth: 0, flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {parent.name}
        </h3>
        <p style={{ margin: "4px 0", color: "#555", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {parent.email && parent.email !== "N/A"
            ? parent.email
            : `${parent.childRelationship || "N/A"}: ${parent.childName || "N/A"}`}
        </p>
        <p style={{ margin: 0, color: "#475569", fontSize: 10, fontWeight: 700 }}>
          {(parent.childCount || 0) === 1 ? "1 Child" : `${parent.childCount || 0} Children`}
        </p>
      </div>
    </div>
  );

  const renderEmptyParentPanel = () => (
    <div
      style={{
        width: isPortrait ? "100%" : "380px",
        height: isPortrait ? "100vh" : "calc(100vh - 55px)",
        position: "fixed",
        right: 0,
        top: isPortrait ? 0 : "55px",
        background: "var(--surface-muted)",
        backgroundImage: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
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
          <FaHome />
        </div>
        <h3 style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", fontWeight: 800 }}>
          Parent Details
        </h3>
        <p style={{ margin: "8px 0 0", color: "var(--text-muted)", fontSize: 11, lineHeight: 1.5 }}>
          Select a parent from the list to view profile details, linked children, status, and message options.
        </p>
      </div>
    </div>
  );

  const renderParentProfilePanel = (isFullscreen = false) => {
    if (!selectedParent) return null;

    const activeParent = parentInfo && String(parentInfo.userId) === String(selectedParent.userId)
      ? { ...selectedParent, ...parentInfo }
      : selectedParent;

    const formattedStatus = activeParent.status
      ? `${String(activeParent.status).charAt(0).toUpperCase()}${String(activeParent.status).slice(1)}`
      : "—";
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
        <h3 style={{ margin: 0, marginBottom: 6, color: "var(--text-primary)", fontWeight: 800, letterSpacing: "0.1px", fontSize: 12, textAlign: "left" }}>
          Parent Profile
        </h3>
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
              <ProfileAvatar
                imageUrl={c.profileImage}
                name={c.name}
                size={44}
                style={{ border: "2px solid var(--accent-strong)" }}
              />
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
            { label: "Status", value: activeParent.status || "Active" },
            { label: "Created", value: activeParent.createdAt ? new Date(activeParent.createdAt).toLocaleString() : "—" },
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
                <ProfileAvatar
                  imageUrl={activeParent.profileImage}
                  name={activeParent.name}
                  size={56}
                  style={{ border: "2px solid rgba(255,255,255,0.8)" }}
                />
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
          right: 0,
          top: isPortrait ? 0 : "55px",
          height: isPortrait ? "100vh" : "calc(100vh - 55px)",
          background: "#ffffff",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          overflowX: "hidden",
          padding: "14px",
          paddingBottom: "130px",
          boxShadow: "var(--shadow-panel)",
          borderLeft: isPortrait ? "none" : "1px solid var(--border-soft)",
          transition: "all 0.35s ease",
          fontSize: "10px",
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
              setSelectedParent(null);
              setParentChatOpen(false);
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

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "14px", overflow: "hidden" }}>
          <div
            style={{
              background: "linear-gradient(135deg, var(--accent-strong), var(--accent))",
              margin: "-14px -14px 12px",
              padding: "16px 10px",
              textAlign: "center",
            }}
          >
            <ProfileAvatar
              imageUrl={activeParent.profileImage}
              name={activeParent.name}
              size={70}
              style={{ margin: "0 auto 10px", border: "3px solid rgba(255,255,255,0.8)" }}
            />
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
        background: "#ffffff",
        minHeight: "100vh",
        height: "100vh",
        overflow: "hidden",
        color: "var(--text-primary)",
        "--surface-panel": "#ffffff",
        "--surface-accent": "#eff6ff",
        "--surface-muted": "#f8fbff",
        "--surface-strong": "#e2e8f0",
        "--surface-overlay": "rgba(255,255,255,0.92)",
        "--page-bg": "#ffffff",
        "--page-bg-secondary": "#f8fbff",
        "--border-soft": "#e2e8f0",
        "--border-strong": "#cbd5e1",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": "#3b82f6",
        "--accent-soft": "#dbeafe",
        "--accent-strong": "#007AFB",
        "--shadow-soft": "0 10px 22px rgba(15, 23, 42, 0.07)",
        "--shadow-panel": "0 16px 34px rgba(15, 23, 42, 0.12)",
        "--shadow-glow": "0 0 0 2px rgba(37, 99, 235, 0.18)",
        "--success": "#16a34a",
        "--success-soft": "#dcfce7",
        "--warning": "#d97706",
        "--warning-soft": "#fef3c7",
        "--danger": "#dc2626",
        "--danger-soft": "#fee2e2",
        "--input-border": "#dbeafe",
        "--input-bg": "#ffffff",
      }}
    >
      <nav className="top-navbar" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface-panel)" }}>
        <h2 style={{ color: "var(--text-primary)", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>

        <div className="nav-right">
          {/* Combined bell: shows posts + message senders in one dropdown */}
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowPostDropdown((prev) => !prev);
            }}
          >
            <FaBell />
            {(
              postNotifications.length + Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)
            ) > 0 && (
              <span className="badge">{postNotifications.length + Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)}</span>
            )}

            {showPostDropdown && (
                <div className="notification-dropdown" onClick={(e) => e.stopPropagation()} style={{
                  position: "absolute",
                  top: "45px",
                  right: "0",
                  width: "360px",
                  maxHeight: "420px",
                  overflowY: "auto",
                  background: "var(--surface-panel)",
                  borderRadius: 10,
                  border: "1px solid var(--border-soft)",
                  boxShadow: "var(--shadow-panel)",
                  zIndex: 1000,
                  padding: 6,
                }}>
                {totalNotifications === 0 ? (
                  <p className="muted">No new notifications</p>
                ) : (
                  <div>
                    {/* Posts section */}
                    {postNotifications.length > 0 && (
                      <div>
                        <div className="notification-section-title">Posts</div>
                        {postNotifications.map((n) => (
                          <div
                            key={n.notificationId}
                            className="notification-row"
                            onClick={async () => {
                              try {
                                await axios.post(`${API_BASE}/mark_post_notification_read`, {
                                  notificationId: n.notificationId,
                                });
                              } catch (err) {
                                console.warn("Failed to mark notification:", err);
                              }

                              setPostNotifications((prev) => prev.filter((notif) => notif.notificationId !== n.notificationId));
                              setShowPostDropdown(false);
                              navigate("/dashboard", {
                                state: {
                                  postId: n.postId,
                                  posterName: n.adminName,
                                  posterProfile: n.adminProfile,
                                },
                              });
                            }}
                            style={{
                              padding: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              cursor: "pointer",
                              borderBottom: "1px solid var(--border-soft)",
                              transition: "background 120ms ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                          >
                            <ProfileAvatar imageUrl={n.adminProfile} name={n.adminName} size={46} borderRadius={8} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: "block", marginBottom: 4 }}>{n.adminName}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{n.message}</p>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>{new Date(n.time || n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Messages section */}
                    {messageCount > 0 && (
                      <div>
                        <div className="notification-section-title" style={{ padding: '8px 10px', color: 'var(--text-primary)', fontWeight: 700, background: 'var(--surface-muted)', borderRadius: 6, margin: '8px 6px' }}>Messages</div>
                        {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                              <div
                                key={userId}
                                className="notification-row"
                                onClick={async () => {
                                  await markMessagesAsSeen(userId);
                                  setUnreadSenders((prev) => {
                                    const copy = { ...prev };
                                    delete copy[userId];
                                    return copy;
                                  });
                                  setShowPostDropdown(false);
                                  navigate("/all-chat", { state: { user: { userId, name: sender.name, profileImage: sender.profileImage, type: sender.type } } });
                                }}
                                style={{
                                  padding: 10,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  cursor: "pointer",
                                  borderBottom: "1px solid var(--border-soft)",
                                  transition: "background 120ms ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                              >
                                <ProfileAvatar imageUrl={sender.profileImage} name={sender.name} size={46} borderRadius={8} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <strong style={{ display: "block", marginBottom: 4 }}>{sender.name}</strong>
                                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{sender.count} new message{sender.count > 1 && "s"}</p>
                                </div>
                              </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Messenger icon: only counts messages and navigates straight to /all-chat */}
          <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/all-chat") }>
            <FaFacebookMessenger />
            {Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0) > 0 && (
              <span className="badge">{Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)}</span>
            )}
          </div>

          <ProfileAvatar imageUrl={admin.profileImage} name={admin.name} size={38} className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px", height: "calc(100vh - 73px)", overflow: "hidden", background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)" }}>
        <RegisterSidebar user={admin} sticky fullHeight />

        {/* MAIN CONTENT */}
        <main className={`main-content ${selectedParent && sidebarVisible && !parentFullscreenOpen ? "sidebar-open" : ""}`} style={mainContentStyle}>
          <div
            className="parent-list-card-responsive"
            style={{
              width: listShellWidth,
              maxWidth: 640,
              position: "relative",
              marginLeft: 0,
              marginRight: isPortrait ? 0 : "24px",
              background: "#ffffff",
              border: "1px solid var(--border-soft)",
              borderRadius: 18,
              boxShadow: "var(--shadow-soft)",
              padding: "14px 14px 22px",
              boxSizing: "border-box",
            }}
          >
            <style>{`
              @media (max-width: 600px) {
                .parent-list-card-responsive {
                  width: 100% !important;
                  max-width: 100% !important;
                  margin-left: 0 !important;
                  margin-right: 0 !important;
                }
              }

              .parent-list-responsive {
                display: flex;
                flex-direction: column;
                margin-top: 12px;
                gap: 12px;
                width: 100%;
                max-width: 100%;
              }

              .parent-list-responsive > div {
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
              }

              @media (max-width: 600px) {
                .parent-list-responsive {
                  width: 100% !important;
                  max-width: 100% !important;
                }

                .parent-list-responsive > div {
                  width: 100% !important;
                  max-width: 100% !important;
                  min-width: 0 !important;
                }
              }
            `}</style>

            <div className="section-header-card" style={{ marginBottom: 12 }}>
              <h2 className="section-header-card__title" style={{ fontSize: 20 }}>Parents</h2>
              <div className="section-header-card__meta">
                <span>Total: {filteredParents.length}</span>
                <span className="section-header-card__chip">Family View</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "10px" }}>
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#f8fbff",
                  border: "1px solid #dbeafe",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
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

            {loadingParents ? <p style={{ color: "var(--text-muted)", marginTop: 2 }}>Loading parents...</p> : null}
            {!loadingParents && filteredParents.length === 0 ? <p style={{ color: "var(--text-muted)", marginTop: 2 }}>No parents found.</p> : null}

            <div className="parent-list-responsive">
              {!loadingParents && filteredParents.map((parent, index) => (
                <ParentItem
                  key={parent.userId || index}
                  parent={parent}
                  number={index + 1}
                  selected={selectedParent?.userId === parent.userId}
                  onClick={(parentRecord) => {
                    setSelectedParent(parentRecord);
                    setSidebarVisible(true);
                  }}
                />
              ))}
              <div aria-hidden="true" style={{ height: 18 }} />
            </div>
          </div>
        </main>

        {/* RIGHT SIDEBAR */}
        {!parentFullscreenOpen && (selectedParent ? renderParentProfilePanel(false) : renderEmptyParentPanel())}
        {selectedParent && parentFullscreenOpen && renderParentProfilePanel(true)}

      </div>
    </div>
  );
}

export default Parent;