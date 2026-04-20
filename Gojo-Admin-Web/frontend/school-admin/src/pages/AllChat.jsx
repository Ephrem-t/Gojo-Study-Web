import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPaperPlane, FaCheck, FaImage, FaTimes, FaFilter } from "react-icons/fa";
import { ref, onValue, push, runTransaction, update, get, set } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { FIREBASE_DATABASE_URL } from "../config.js";
import {
  fetchJson,
  formatLastMessagePreview,
  mapInBatches,
  resolveExistingChatKey,
} from "../utils/chatRtdb";
import ProfileAvatar from "../components/ProfileAvatar";
import "../styles/global.css";

const RTDB_BASE = FIREBASE_DATABASE_URL;
const DEFAULT_PROFILE_IMAGE = "/default-profile.png";

const sortedChatId = (id1, id2) => {
  const a = String(id1 || "").trim();
  const b = String(id2 || "").trim();
  return [a, b].sort().join("_");
};

const normalizeTab = (tab) => {
  const value = String(tab || "").toLowerCase();
  if (value === "teacher" || value === "teachers") return "teacher";
  if (value === "student" || value === "students") return "student";
  if (value === "parent" || value === "parents") return "parent";
  if (
    value === "management" ||
    value === "managements" ||
    value === "office" ||
    value === "offices" ||
    value === "hr" ||
    value === "finance" ||
    value === "registerer" ||
    value === "registerers" ||
    value === "registrar"
  ) {
    return "management";
  }
  return null;
};

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
    return DEFAULT_PROFILE_IMAGE;
  }
  return sanitized;
};

const loadImageFromFile = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image file"));
    };
    image.src = objectUrl;
  });

const compressImageToJpeg = async (file, { maxWidth = 1280, maxHeight = 1280, quality = 0.72 } = {}) => {
  const image = await loadImageFromFile(file);

  let width = image.naturalWidth || image.width;
  let height = image.naturalHeight || image.height;

  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.max(1, Math.round(width * ratio));
  height = Math.max(1, Math.round(height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable");
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (output) => {
        if (!output) {
          reject(new Error("Image compression failed"));
          return;
        }
        resolve(output);
      },
      "image/jpeg",
      quality
    );
  });

  return blob;
};

const isActiveRecord = (record = {}) => {
  const raw = record?.status ?? record?.isActive;
  if (typeof raw === "boolean") return raw;
  const normalized = String(raw || "active").toLowerCase();
  return normalized === "active" || normalized === "true" || normalized === "1";
};

const pickFirstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
};

const uniqueNonEmptyValues = (values) => {
  const seen = new Set();
  const normalizedValues = [];

  values.forEach((value) => {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) return;

    const normalizedKey = normalizedValue.toLowerCase();
    if (seen.has(normalizedKey)) return;

    seen.add(normalizedKey);
    normalizedValues.push(normalizedValue);
  });

  return normalizedValues;
};

const pickPreferredSchoolScopeCode = (candidateCodes) => {
  const normalizedCandidates = uniqueNonEmptyValues(candidateCodes);
  return (
    normalizedCandidates.find((candidateCode) => String(candidateCode || "").toUpperCase().startsWith("ET-")) ||
    normalizedCandidates.find((candidateCode) => String(candidateCode || "").includes("-")) ||
    normalizedCandidates[0] ||
    ""
  );
};

const officeRoleLabel = (role) => {
  if (role === "hr") return "HR";
  if (role === "finance") return "Finance";
  if (role === "registerer") return "Registerer";
  return "Management";
};

export default function AllChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const chatEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const contactScrollRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const lastContactScrollTopRef = useRef(0);
  const suppressAutoCardToggleRef = useRef(false);
  const autoCardToggleTimeoutRef = useRef(null);

  const admin = JSON.parse(localStorage.getItem("admin") || localStorage.getItem("gojo_admin") || "{}") || {};
  const adminUserId = String(admin.userId || "").trim();
  const schoolCode = String(admin.schoolCode || "").trim();
  const [resolvedSchoolScopeCode, setResolvedSchoolScopeCode] = useState(() =>
    schoolCode.includes("-") ? schoolCode : ""
  );
  const effectiveSchoolScopeCode = String(resolvedSchoolScopeCode || schoolCode || "").trim();
  const schoolNodePrefix = effectiveSchoolScopeCode ? `Platform1/Schools/${effectiveSchoolScopeCode}` : "";
  const schoolDbRoot = effectiveSchoolScopeCode ? `${RTDB_BASE}/Platform1/Schools/${encodeURIComponent(effectiveSchoolScopeCode)}` : RTDB_BASE;
  const scopedPath = (path) => (schoolNodePrefix ? `${schoolNodePrefix}/${path}` : path);

  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [managements, setManagements] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [presence, setPresence] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedStudentGrade, setSelectedStudentGrade] = useState("All");
  const [selectedStudentSection, setSelectedStudentSection] = useState("All");
  const [showStudentFilters, setShowStudentFilters] = useState(false);
  const [showSearchFilterCard, setShowSearchFilterCard] = useState(true);

  const incomingState = location.state || {};
  const incomingContact = incomingState.contact || incomingState.user || null;
  const incomingTab = normalizeTab(incomingState.tab || incomingState.userType || incomingContact?.type) || "teacher";

  const [selectedTab, setSelectedTab] = useState(incomingTab);
  const [selectedChatUser, setSelectedChatUser] = useState(incomingContact || null);
  const [currentChatKey, setCurrentChatKey] = useState(null);
  const [clickedMessageId, setClickedMessageId] = useState(null);
  const [editingMessages, setEditingMessages] = useState({});
  const [imageSending, setImageSending] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [imageMenu, setImageMenu] = useState({ open: false, message: null });
  const [textMenu, setTextMenu] = useState({ open: false, message: null });

  const resolveLegacyChatKey = async (otherUserId) => {
    if (!otherUserId || !adminUserId) return null;
    const sortedKey = sortedChatId(adminUserId, otherUserId);
    const directKey = `${adminUserId}_${otherUserId}`;
    const reverseKey = `${otherUserId}_${adminUserId}`;
    const candidates = Array.from(new Set([sortedKey, directKey, reverseKey]));

    for (const key of candidates) {
      try {
        const snapshot = await get(ref(db, scopedPath(`Chats/${key}/messages`)));
        if (snapshot.exists()) return key;
      } catch {
        // ignore candidate lookup failures
      }
    }

    return sortedKey;
  };

  const allowedUserIds = useMemo(() => {
    const ids = new Set();
    teachers.forEach((user) => ids.add(String(user.userId || "")));
    students.forEach((user) => ids.add(String(user.userId || "")));
    parents.forEach((user) => ids.add(String(user.userId || "")));
    managements.forEach((user) => ids.add(String(user.userId || "")));
    return ids;
  }, [teachers, students, parents, managements]);

  const availableStudentGrades = useMemo(() => {
    return [...new Set(students.map((student) => String(student?.grade || "").trim()).filter(Boolean))].sort((a, b) => {
      const numericDiff = Number(a) - Number(b);
      if (!Number.isNaN(numericDiff) && numericDiff !== 0) return numericDiff;
      return a.localeCompare(b);
    });
  }, [students]);

  const availableStudentSections = useMemo(() => {
    const base = selectedStudentGrade === "All"
      ? students
      : students.filter((student) => String(student?.grade || "").trim() === selectedStudentGrade);
    return [...new Set(base.map((student) => String(student?.section || "").trim().toUpperCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [students, selectedStudentGrade]);

  useEffect(() => {
    let cancelled = false;

    const resolveSchoolScopeCode = async () => {
      const seedCodes = uniqueNonEmptyValues([schoolCode]);
      if (seedCodes.length === 0) {
        if (!cancelled) {
          setResolvedSchoolScopeCode("");
        }
        return;
      }

      const seedSet = new Set(seedCodes.map((value) => value.toLowerCase()));
      const resolvedCandidates = [...seedCodes];

      try {
        const schoolIndexRes = await fetch(`${RTDB_BASE}/Platform1/Schools.json?shallow=true`);
        const schoolIndexData = await schoolIndexRes.json();
        const schoolKeys = Object.keys(schoolIndexData || {});
        const normalizedSeedValues = Array.from(seedSet);

        schoolKeys.forEach((schoolKey) => {
          const normalizedKey = String(schoolKey || "").trim().toLowerCase();
          if (!normalizedKey) {
            return;
          }

          const matchesSeed = normalizedSeedValues.some(
            (seedValue) =>
              normalizedKey === seedValue ||
              normalizedKey.endsWith(`-${seedValue}`) ||
              normalizedKey.startsWith(`${seedValue}-`) ||
              normalizedKey.includes(`-${seedValue}-`)
          );

          if (matchesSeed) {
            resolvedCandidates.push(schoolKey);
          }
        });

        if (schoolKeys.length > 0 && schoolKeys.length <= 60) {
          const schoolInfoResponses = await Promise.all(
            schoolKeys.map((schoolKey) =>
              fetch(`${RTDB_BASE}/Platform1/Schools/${encodeURIComponent(schoolKey)}/schoolInfo.json`)
                .then((response) => response.json())
                .then((schoolInfo) => ({ schoolKey, schoolInfo }))
                .catch(() => ({ schoolKey, schoolInfo: null }))
            )
          );

          schoolInfoResponses.forEach(({ schoolKey, schoolInfo }) => {
            const aliases = uniqueNonEmptyValues([
              schoolKey,
              schoolInfo?.schoolCode,
              schoolInfo?.shortName,
            ]);

            if (
              aliases.some((alias) => seedSet.has(String(alias || "").trim().toLowerCase()))
            ) {
              resolvedCandidates.push(...aliases);
            }
          });
        }
      } catch {
        // Ignore school-scope resolution failures and continue with stored school code.
      }

      if (!cancelled) {
        setResolvedSchoolScopeCode(pickPreferredSchoolScopeCode(resolvedCandidates) || seedCodes[0] || "");
      }
    };

    resolveSchoolScopeCode();

    return () => {
      cancelled = true;
    };
  }, [schoolCode]);

  useEffect(() => {
    if (selectedStudentSection === "All") return;
    if (!availableStudentSections.includes(selectedStudentSection)) {
      setSelectedStudentSection("All");
    }
  }, [availableStudentSections, selectedStudentSection]);

  useEffect(() => {
    return () => {
      if (autoCardToggleTimeoutRef.current) {
        clearTimeout(autoCardToggleTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    suppressAutoCardToggleRef.current = false;
    if (autoCardToggleTimeoutRef.current) {
      clearTimeout(autoCardToggleTimeoutRef.current);
      autoCardToggleTimeoutRef.current = null;
    }
    setShowSearchFilterCard(true);
    lastContactScrollTopRef.current = 0;
  }, [selectedTab]);

  const setSearchFilterCardVisibility = (nextVisible) => {
    if (showSearchFilterCard === nextVisible) return;

    suppressAutoCardToggleRef.current = true;
    if (autoCardToggleTimeoutRef.current) {
      clearTimeout(autoCardToggleTimeoutRef.current);
    }

    setShowSearchFilterCard(nextVisible);

    autoCardToggleTimeoutRef.current = setTimeout(() => {
      suppressAutoCardToggleRef.current = false;
      autoCardToggleTimeoutRef.current = null;
    }, 280);
  };

  const handleContactListScroll = (event) => {
    const target = event?.currentTarget;
    if (!target) return;

    const currentTop = Number(target.scrollTop || 0);
    const previousTop = lastContactScrollTopRef.current;
    const delta = currentTop - previousTop;
    const maxScrollable = Math.max(0, Number(target.scrollHeight || 0) - Number(target.clientHeight || 0));
    const nearTop = currentTop <= 8;
    const nearBottom = maxScrollable - currentTop <= 6;

    if (maxScrollable <= 8) {
      setSearchFilterCardVisibility(true);
      lastContactScrollTopRef.current = currentTop;
      return;
    }

    if (suppressAutoCardToggleRef.current) {
      lastContactScrollTopRef.current = currentTop;
      return;
    }

    if (nearTop) {
      setSearchFilterCardVisibility(true);
      lastContactScrollTopRef.current = currentTop;
      return;
    }

    if (delta > 14 && showSearchFilterCard && !nearBottom) {
      setSearchFilterCardVisibility(false);
    } else if (delta < -14 && !showSearchFilterCard) {
      setSearchFilterCardVisibility(true);
    }

    lastContactScrollTopRef.current = currentTop;
  };

  useEffect(() => {
    if (!adminUserId) return;

    const fetchUsers = async () => {
      setLoadingContacts(true);
      try {
        const [teachersRes, studentsRes, parentsRes, hrRes, financeRes, registerersRes, usersRes, chatIndexRes] = await Promise.all([
          fetchJson(`${schoolDbRoot}/Teachers.json`, {}),
          fetchJson(`${schoolDbRoot}/Students.json`, {}),
          fetchJson(`${schoolDbRoot}/Parents.json`, {}),
          fetchJson(`${schoolDbRoot}/HR.json`, {}),
          fetchJson(`${schoolDbRoot}/Finance.json`, {}),
          fetchJson(`${schoolDbRoot}/Registerers.json`, {}),
          fetchJson(`${schoolDbRoot}/Users.json`, {}),
          fetchJson(`${schoolDbRoot}/Chats.json?shallow=true`, {}),
        ]);

        const usersMap = usersRes && typeof usersRes === "object" ? usersRes : {};
        const chatKeyIndex = new Set(Object.keys(chatIndexRes || {}));

        const buildLastMessageMeta = async (otherUserId) => {
          const resolvedChatKey = resolveExistingChatKey(chatKeyIndex, adminUserId, otherUserId);
          if (!resolvedChatKey || !chatKeyIndex.has(resolvedChatKey)) {
            return {
              chatKey: "",
              lastMsgTime: 0,
              lastMsgText: "",
              unread: 0,
            };
          }

          const encodedChatKey = encodeURIComponent(resolvedChatKey);
          const [lastMessage, unreadValue] = await Promise.all([
            fetchJson(`${schoolDbRoot}/Chats/${encodedChatKey}/lastMessage.json`, null),
            fetchJson(`${schoolDbRoot}/Chats/${encodedChatKey}/unread/${encodeURIComponent(adminUserId)}.json`, 0),
          ]);

          return {
            chatKey: resolvedChatKey,
            lastMsgTime: Number(lastMessage?.timeStamp || 0),
            lastMsgText: formatLastMessagePreview(lastMessage),
            unread: Number(unreadValue || 0),
          };
        };

        const hydrateChatPreviewMeta = async (records) => {
          const hydratedRecords = await mapInBatches(records, 24, async (record) => ({
            ...record,
            ...(await buildLastMessageMeta(record.userId)),
          }));

          return hydratedRecords;
        };

        const teacherRecords = Object.entries(teachersRes || {})
          .map(([teacherId, teacherNode]) => {
            const userId = String(teacherNode?.userId || "").trim();
            if (!userId) return null;
            const user = usersMap?.[userId] || {};
            return {
              id: teacherId,
              teacherId,
              userId,
              type: "teacher",
              name: pickFirstNonEmpty(user?.name, teacherNode?.name, teacherId, "Teacher"),
              profileImage: resolveAvatarSrc(user?.profileImage || teacherNode?.profileImage, pickFirstNonEmpty(user?.name, teacherNode?.name, "Teacher")),
              lastSeen: user?.lastSeen || null,
              isActive: isActiveRecord({ ...teacherNode, ...user }),
            };
          })
          .filter(Boolean)
          .filter((record) => record.isActive);

        const mappedTeachers = (await hydrateChatPreviewMeta(teacherRecords))
          .sort((a, b) => b.lastMsgTime - a.lastMsgTime);

        const studentRecords = Object.entries(studentsRes || {})
          .map(([studentId, studentNode]) => {
            const basic = studentNode?.basicStudentInformation || {};
            const userId = String(studentNode?.userId || basic?.userId || "").trim();
            if (!userId) return null;
            const user = usersMap?.[userId] || {};
            const name = pickFirstNonEmpty(basic?.name, studentNode?.name, user?.name, studentId, "Student");
            return {
              id: studentId,
              studentId,
              userId,
              type: "student",
              name,
              grade: pickFirstNonEmpty(basic?.grade, studentNode?.grade),
              section: pickFirstNonEmpty(basic?.section, studentNode?.section).toUpperCase(),
              profileImage: resolveAvatarSrc(basic?.studentPhoto || studentNode?.studentPhoto || studentNode?.profileImage || user?.profileImage, name),
              lastSeen: user?.lastSeen || null,
              isActive: isActiveRecord({ ...studentNode, ...user, status: basic?.status || studentNode?.status || user?.status }),
            };
          })
          .filter(Boolean)
          .filter((record) => record.isActive);

        const mappedStudents = (await hydrateChatPreviewMeta(studentRecords))
          .sort((a, b) => b.lastMsgTime - a.lastMsgTime);

        const parentRecords = Object.entries(parentsRes || {})
          .map(([parentId, parentNode]) => {
            const userId = String(parentNode?.userId || "").trim();
            if (!userId) return null;
            const user = usersMap?.[userId] || {};
            const name = pickFirstNonEmpty(user?.name, parentNode?.name, parentId, "Parent");
            return {
              id: parentId,
              parentId,
              userId,
              type: "parent",
              name,
              profileImage: resolveAvatarSrc(user?.profileImage || parentNode?.profileImage, name),
              lastSeen: user?.lastSeen || null,
              isActive: isActiveRecord({ ...parentNode, ...user }),
            };
          })
          .filter(Boolean)
          .filter((record) => record.isActive);

        const mappedParents = (await hydrateChatPreviewMeta(parentRecords))
          .sort((a, b) => b.lastMsgTime - a.lastMsgTime);

        const mapOfficeRecords = (source, officeRole) =>
          Object.entries(source || {})
            .map(([roleNodeId, roleNode]) => {
              const userId = String(roleNode?.userId || "").trim();
              if (!userId) return null;
              const user = usersMap?.[userId] || {};
              const name = pickFirstNonEmpty(user?.name, roleNode?.name, roleNodeId, officeRoleLabel(officeRole));
              return {
                id: roleNodeId,
                roleNodeId,
                userId,
                type: "management",
                officeRole,
                name,
                profileImage: resolveAvatarSrc(user?.profileImage || roleNode?.profileImage, name),
                lastSeen: user?.lastSeen || null,
                isActive: isActiveRecord({ ...roleNode, ...user }),
              };
            })
            .filter(Boolean)
            .filter((record) => record.isActive);

        const managementRecords = [
          ...mapOfficeRecords(hrRes, "hr"),
          ...mapOfficeRecords(financeRes, "finance"),
          ...mapOfficeRecords(registerersRes, "registerer"),
        ];

        const mappedManagements = (await hydrateChatPreviewMeta(managementRecords))
          .sort((a, b) => b.lastMsgTime - a.lastMsgTime || a.name.localeCompare(b.name));

        setTeachers(mappedTeachers);
        setStudents(mappedStudents);
        setParents(mappedParents);
        setManagements(mappedManagements);
        setUnreadCounts(
          [...mappedTeachers, ...mappedStudents, ...mappedParents, ...mappedManagements].reduce((acc, item) => {
            acc[item.userId] = Number(item.unread || 0);
            return acc;
          }, {})
        );
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoadingContacts(false);
      }
    };

    fetchUsers();
  }, [adminUserId, schoolDbRoot]);

  useEffect(() => {
    if (!selectedChatUser?.userId) return;
    if (loadingContacts) return;
    if (allowedUserIds.size === 0) return;
    if (!allowedUserIds.has(String(selectedChatUser.userId || ""))) {
      setSelectedChatUser(null);
      setCurrentChatKey(null);
      setMessages([]);
    }
  }, [allowedUserIds, loadingContacts, selectedChatUser]);

  useEffect(() => {
    if (!adminUserId) return;

    const unsubscribers = [];
    const allUsers = [...teachers, ...students, ...parents, ...managements];

    allUsers.forEach((user) => {
      if (!user?.userId || !user?.chatKey) return;
      const chatKey = user.chatKey;
      const unreadRef = ref(db, scopedPath(`Chats/${chatKey}/unread/${adminUserId}`));
      const unsubscribe = onValue(unreadRef, (snapshot) => {
        setUnreadCounts((prev) => ({
          ...prev,
          [user.userId]: Number(snapshot.val() || 0),
        }));
      });
      unsubscribers.push(unsubscribe);
    });

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [teachers, students, parents, managements, adminUserId, schoolNodePrefix]);

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

  useEffect(() => {
    if (!incomingContact) return;
    setSelectedChatUser(incomingContact);
    setCurrentChatKey(null);
    setSelectedTab(normalizeTab(incomingState.tab || incomingState.userType || incomingContact?.type) || "teacher");
  }, [incomingContact, incomingState.tab, incomingState.userType]);

  useEffect(() => {
    const incoming = incomingContact;
    if (!incoming?.userId) return;
    const bucket =
      selectedTab === "teacher"
        ? teachers
        : selectedTab === "student"
        ? students
        : selectedTab === "parent"
        ? parents
        : managements;
    const found = bucket.find((item) => String(item.userId || "") === String(incoming.userId || ""));
    if (found) {
      setSelectedChatUser(found);
    }
  }, [incomingContact, selectedTab, teachers, students, parents, managements]);

  useEffect(() => {
    if (!selectedChatUser || !adminUserId) return;

    let cancelled = false;
    let unsubscribeMessages = null;
    let unsubscribePresence = null;

    const connect = async () => {
      const chatKey = currentChatKey || await resolveLegacyChatKey(selectedChatUser.userId);
      if (!chatKey || cancelled) return;

      setCurrentChatKey(chatKey);

      const messagesRef = ref(db, scopedPath(`Chats/${chatKey}/messages`));
      const lastSeenRef = ref(db, scopedPath(`Users/${selectedChatUser.userId}/lastSeen`));

      unsubscribeMessages = onValue(messagesRef, async (snapshot) => {
        const data = snapshot.val() || {};
        const list = Object.entries(data)
          .map(([id, message]) => ({
            id,
            ...message,
            isAdmin: String(message.senderId) === String(adminUserId),
          }))
          .sort((a, b) => Number(a.timeStamp || 0) - Number(b.timeStamp || 0));

        setMessages(list);

        const updates = {};
        Object.entries(data).forEach(([messageId, message]) => {
          if (String(message?.receiverId) === String(adminUserId) && !message?.seen) {
            updates[`${scopedPath(`Chats/${chatKey}/messages/${messageId}/seen`)}`] = true;
          }
        });

        try {
          await update(ref(db), {
            ...updates,
            [scopedPath(`Chats/${chatKey}/unread/${adminUserId}`)]: 0,
          });
        } catch {
          // ignore read receipt write failures
        }
      });

      unsubscribePresence = onValue(lastSeenRef, (snapshot) => {
        setPresence((prev) => ({
          ...prev,
          [selectedChatUser.userId]: snapshot.val(),
        }));
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (typeof unsubscribeMessages === "function") unsubscribeMessages();
      if (typeof unsubscribePresence === "function") unsubscribePresence();
    };
  }, [selectedChatUser, adminUserId, currentChatKey, schoolNodePrefix]);

  useEffect(() => {
    try {
      const presenceRef = ref(db, scopedPath("Presence"));
      const unsubscribe = onValue(presenceRef, (snapshot) => {
        setPresence(snapshot.val() || {});
      });
      return () => unsubscribe();
    } catch (error) {
      console.warn("Presence listener unavailable:", error);
    }
  }, [schoolNodePrefix]);

  const getActiveChatKey = async () => {
    if (!selectedChatUser || !adminUserId) return null;
    if (currentChatKey) return currentChatKey;
    const resolved = await resolveLegacyChatKey(selectedChatUser.userId);
    setCurrentChatKey(resolved);
    return resolved;
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedChatUser) return;
    if (!allowedUserIds.has(String(selectedChatUser.userId || ""))) return;

    const editingId = Object.keys(editingMessages).find((id) => editingMessages[id]);
    const chatKey = await getActiveChatKey();
    if (!chatKey) return;

    if (editingId) {
      await update(ref(db, scopedPath(`Chats/${chatKey}/messages/${editingId}`)), {
        text: input,
        edited: true,
      });
      setEditingMessages({});
      setClickedMessageId(null);
      setInput("");
      return;
    }

    const messagesRef = ref(db, scopedPath(`Chats/${chatKey}/messages`));
    const messageData = {
      senderId: adminUserId,
      receiverId: selectedChatUser.userId,
      type: "text",
      text: input,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp: Date.now(),
    };

    await push(messagesRef, messageData);

    await update(ref(db, scopedPath(`Chats/${chatKey}/participants`)), {
      [adminUserId]: true,
      [selectedChatUser.userId]: true,
    });

    await update(ref(db, scopedPath(`Chats/${chatKey}/lastMessage`)), {
      text: input,
      senderId: adminUserId,
      seen: false,
      timeStamp: messageData.timeStamp,
    });

    try {
      await runTransaction(ref(db, scopedPath(`Chats/${chatKey}/unread/${selectedChatUser.userId}`)), (current) => Number(current || 0) + 1);
      await set(ref(db, scopedPath(`Chats/${chatKey}/typing`)), { userId: null });
    } catch {
      // ignore unread increment failures
    }

    setInput("");
  };

  const sendImageMessage = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file || !selectedChatUser || !adminUserId) {
      if (event?.target) event.target.value = "";
      return;
    }
    if (!allowedUserIds.has(String(selectedChatUser.userId || ""))) {
      if (event?.target) event.target.value = "";
      return;
    }

    const chatKey = await getActiveChatKey();
    if (!chatKey) {
      if (event?.target) event.target.value = "";
      return;
    }

    try {
      setImageSending(true);

      const compressedBlob = await compressImageToJpeg(file, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.72,
      });

      const messagesRef = ref(db, scopedPath(`Chats/${chatKey}/messages`));
      const messageRef = push(messagesRef);
      const messageId = messageRef.key;
      const timeStamp = Date.now();

      const uploadRef = storageRef(storage, `chatImages/${chatKey}/${messageId}.jpg`);
      await uploadBytes(uploadRef, compressedBlob, { contentType: "image/jpeg" });
      const imageUrl = await getDownloadURL(uploadRef);

      const messageData = {
        messageId,
        senderId: adminUserId,
        receiverId: selectedChatUser.userId,
        type: "image",
        text: "",
        imageUrl,
        seen: false,
        edited: false,
        deleted: false,
        timeStamp,
      };

      await update(messageRef, messageData);

      await update(ref(db, scopedPath(`Chats/${chatKey}/participants`)), {
        [adminUserId]: true,
        [selectedChatUser.userId]: true,
      });

      await update(ref(db, scopedPath(`Chats/${chatKey}/lastMessage`)), {
        seen: false,
        senderId: adminUserId,
        text: "📷 Image",
        timeStamp,
        type: "image",
      });

      try {
        await runTransaction(ref(db, scopedPath(`Chats/${chatKey}/unread/${selectedChatUser.userId}`)), (current) => Number(current || 0) + 1);
      } catch {
        // ignore unread increment failures
      }
    } catch (error) {
      console.error("Image send failed:", error);
    } finally {
      setImageSending(false);
      if (event?.target) event.target.value = "";
    }
  };

  const handleEditMessage = (id) => {
    const message = messages.find((item) => item.id === id);
    if (!message) return;
    setEditingMessages({ [id]: true });
    setClickedMessageId(id);
    setInput(String(message.text || ""));
  };

  const handleDeleteMessage = async (id) => {
    const chatKey = await getActiveChatKey();
    if (!chatKey) return;
    await update(ref(db, scopedPath(`Chats/${chatKey}/messages/${id}`)), { deleted: true });
  };

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

  const displayItems = useMemo(() => {
    const items = [];
    let lastLabel = null;
    messages.forEach((message) => {
      const label = formatDateLabel(message.timeStamp);
      if (label && label !== lastLabel) {
        items.push({ type: "date", id: `date-${message.id}`, label });
        lastLabel = label;
      }
      items.push({ type: "message", ...message });
    });
    return items;
  }, [messages]);

  const isOnlineFromLastSeen = (seenTs) => {
    const ts = Number(seenTs || 0);
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

  const beginImageLongPress = (message) => {
    clearTimeout(longPressTimerRef.current);
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setImageMenu({ open: true, message });
    }, 520);
  };

  const cancelImageLongPress = () => {
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const beginTextLongPress = (message) => {
    clearTimeout(longPressTimerRef.current);
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setTextMenu({ open: true, message });
    }, 520);
  };

  const handleTextBubbleClick = (messageId) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    setClickedMessageId(messageId);
  };

  const handleImageClick = (imageUrl) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    setPreviewImageUrl(imageUrl);
  };

  const handleDownloadImage = async (message) => {
    try {
      const url = String(message?.imageUrl || "").trim();
      if (!url) return;
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `chat-image-${message?.timeStamp || Date.now()}.jpg`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  useEffect(() => {
    return () => {
      clearTimeout(longPressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const list = useMemo(() => {
    let base =
      selectedTab === "teacher"
        ? teachers
        : selectedTab === "student"
        ? students
        : selectedTab === "parent"
        ? parents
        : managements;

    if (selectedTab === "student") {
      if (selectedStudentGrade !== "All") {
        base = base.filter((student) => String(student?.grade || "").trim() === selectedStudentGrade);
      }
      if (selectedStudentSection !== "All") {
        base = base.filter((student) => String(student?.section || "").trim().toUpperCase() === selectedStudentSection);
      }
    }

    const query = searchText.trim().toLowerCase();
    if (!query) return base;
    return base.filter((user) => {
      const haystack = [user?.name, user?.grade, user?.section, user?.officeRole, officeRoleLabel(user?.officeRole)]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });
  }, [selectedTab, teachers, students, parents, managements, searchText, selectedStudentGrade, selectedStudentSection]);

  const isUserOnline = (userId) => {
    if (!userId) return false;
    const direct = presence?.[userId];
    if (typeof direct === "boolean") return direct;
    if (typeof direct === "number") return isOnlineFromLastSeen(direct);
    if (typeof direct === "object" && direct) {
      const ts = direct?.lastSeen || direct?.timeStamp || direct?.timestamp || 0;
      if (direct?.online === true) return true;
      return isOnlineFromLastSeen(ts);
    }
    const lastSeen = teachers.concat(students, parents, managements).find((user) => String(user.userId || "") === String(userId || ""))?.lastSeen;
    return isOnlineFromLastSeen(lastSeen);
  };

  const tabTitle = selectedTab === "management" ? "Management" : selectedTab.charAt(0).toUpperCase() + selectedTab.slice(1);
  const listCount = list.length;
  const isStudentFilterActive = selectedStudentGrade !== "All" || selectedStudentSection !== "All";

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100dvh - var(--topbar-height, 0px))",
        marginTop: "var(--topbar-height, 0px)",
        background: "#ffffff",
        position: "relative",
        padding: isMobile ? 0 : 14,
        gap: isMobile ? 0 : 12,
        fontFamily: "Segoe UI, Arial, sans-serif",
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
            width: isMobile && !selectedChatUser ? "100vw" : sidebarOpen ? (isMobile ? 230 : 320) : 0,
            height: isMobile && !selectedChatUser ? "calc(100dvh - var(--topbar-height, 0px))" : "auto",
            background: "#ffffff",
            padding: sidebarOpen || (isMobile && !selectedChatUser) ? 16 : 0,
            boxShadow: sidebarOpen || (isMobile && !selectedChatUser) ? "0 16px 30px rgba(15, 23, 42, 0.08)" : "none",
            border: sidebarOpen || (isMobile && !selectedChatUser) ? "1px solid #e2e8f0" : "none",
            borderRadius: isMobile ? 0 : 22,
            display: sidebarOpen || (isMobile && !selectedChatUser) ? "flex" : "none",
            flexDirection: "column",
            transition: "width 180ms ease",
            overflowY: isMobile && !selectedChatUser ? "auto" : "visible",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                border: "1px solid #dbeafe",
                background: "#ffffff",
                padding: 8,
                cursor: "pointer",
                borderRadius: 999,
                color: "#007AFB",
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
              }}
              aria-label="Go back"
            >
              <FaArrowLeft size={16} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Chats</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>Telegram-like focus, school-safe communication</div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0,1fr))",
              gap: 4,
              paddingBlock: 4,
              paddingInline: 2,
              marginBottom: 10,
              alignItems: "center",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 999,
              padding: 4,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
            }}
          >
            {["teacher", "student", "parent", "management"].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setSelectedTab(tab);
                  setSelectedChatUser(null);
                  setCurrentChatKey(null);
                  if (tab !== "student") {
                    setShowStudentFilters(false);
                    setSelectedStudentGrade("All");
                    setSelectedStudentSection("All");
                  }
                }}
                style={{
                  padding: 8,
                  borderRadius: 999,
                  border: "none",
                  background: selectedTab === tab ? "#007AFB" : "transparent",
                  color: selectedTab === tab ? "#fff" : "#475569",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.2,
                  boxShadow: selectedTab === tab ? "0 8px 16px rgba(0,122,251,0.22)" : "none",
                }}
              >
                {tab === "management" ? "Mgmt" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div
            style={{
              marginTop: showSearchFilterCard ? 6 : 0,
              marginBottom: showSearchFilterCard ? 10 : 2,
              padding: showSearchFilterCard ? "10px 12px" : "0px 12px",
              background: "#ffffff",
              border: showSearchFilterCard ? "1px solid #e2e8f0" : "1px solid transparent",
              borderRadius: 14,
              maxHeight: showSearchFilterCard ? 360 : 0,
              opacity: showSearchFilterCard ? 1 : 0,
              overflow: "hidden",
              transform: showSearchFilterCard ? "translateY(0)" : "translateY(-8px)",
              transition: "max-height 220ms ease, opacity 200ms ease, transform 220ms ease, margin 220ms ease, padding 220ms ease, border-color 220ms ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, color: "#334155", fontSize: 12, fontWeight: 700 }}>
              <span>{tabTitle} Contacts</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {selectedTab === "student" ? (
                  <button
                    onClick={() => setShowStudentFilters((value) => !value)}
                    style={{
                      border: "1px solid #bfdbfe",
                      background: showStudentFilters ? "#007AFB" : "#ffffff",
                      color: showStudentFilters ? "#ffffff" : "#007AFB",
                      fontSize: 10,
                      fontWeight: 800,
                      borderRadius: 999,
                      padding: "4px 10px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <FaFilter size={11} />
                    {showStudentFilters ? "Hide Filters" : "Filters"}
                    {!showStudentFilters && isStudentFilterActive ? (
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 999,
                          background: showStudentFilters ? "#ffffff" : "#007AFB",
                          boxShadow: "0 0 0 2px rgba(37,99,235,0.18)",
                        }}
                      />
                    ) : null}
                  </button>
                ) : null}
                <span style={{ color: "#007AFB" }}>{listCount}</span>
              </div>
            </div>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={`Search ${selectedTab}s...`}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", background: "#fff", outline: "none", fontSize: 13 }}
            />

            {selectedTab === "student" && showStudentFilters ? (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px",
                  border: "1px solid #dbeafe",
                  borderRadius: 12,
                  background: "#ffffff",
                  boxShadow: "0 5px 12px rgba(15,23,42,0.06)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#007AFB" }}>Filter Students</span>
                  <button
                    onClick={() => {
                      setSelectedStudentGrade("All");
                      setSelectedStudentSection("All");
                    }}
                    style={{
                      border: "1px solid #bfdbfe",
                      background: "#ffffff",
                      color: "#007AFB",
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: "pointer",
                      padding: "3px 8px",
                      borderRadius: 999,
                    }}
                  >
                    Reset
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  <select
                    value={selectedStudentGrade}
                    onChange={(event) => {
                      setSelectedStudentGrade(event.target.value);
                      setSelectedStudentSection("All");
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: 12,
                      color: "#0f172a",
                      fontWeight: 500,
                      outline: "none",
                    }}
                  >
                    <option value="All">All Grades</option>
                    {availableStudentGrades.map((grade) => (
                      <option key={grade} value={grade}>{`Grade ${grade}`}</option>
                    ))}
                  </select>

                  <select
                    value={selectedStudentSection}
                    onChange={(event) => setSelectedStudentSection(event.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: 12,
                      color: "#0f172a",
                      fontWeight: 500,
                      outline: "none",
                    }}
                  >
                    <option value="All">All Sections</option>
                    {availableStudentSections.map((section) => (
                      <option key={section} value={section}>{`Section ${section}`}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {selectedTab === "student" && !showStudentFilters && isStudentFilterActive ? (
              <div
                style={{
                  marginTop: 8,
                  padding: "7px 8px",
                  borderRadius: 10,
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 10, color: "#1e3a8a", fontWeight: 700 }}>
                  Active filter: {selectedStudentGrade !== "All" ? `Grade ${selectedStudentGrade}` : "All Grades"}
                  {" · "}
                  {selectedStudentSection !== "All" ? `Section ${selectedStudentSection}` : "All Sections"}
                </span>
                <button
                  onClick={() => {
                    setSelectedStudentGrade("All");
                    setSelectedStudentSection("All");
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#007AFB",
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Reset
                </button>
              </div>
            ) : null}

            <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
              {teachers.length} Teachers · {students.length} Students · {parents.length} Parents · {managements.length} Management
            </div>
          </div>

          <div
            ref={contactScrollRef}
            onScroll={handleContactListScroll}
            style={{ marginTop: 4, overflowY: "auto", flex: 1, paddingRight: 2 }}
          >
            {loadingContacts ? (
              <div style={{ padding: "12px 8px", color: "#64748b", fontSize: 13 }}>Loading permitted contacts...</div>
            ) : list.length === 0 ? (
              <div style={{ padding: "12px 8px", color: "#64748b", fontSize: 13 }}>
                {searchText.trim() ? "No matching contacts." : `No permitted ${selectedTab} contacts.`}
              </div>
            ) : null}

            {list.map((user) => {
              const isActive = selectedChatUser?.userId === user.userId;
              const unread = unreadCounts[user.userId] || 0;

              return (
                <div
                  key={user.userId}
                  onClick={() => {
                    setSelectedChatUser(user);
                    setCurrentChatKey(null);
                    if (isMobile) setSidebarOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: isMobile ? 16 : 11,
                    borderRadius: 14,
                    cursor: "pointer",
                    marginBottom: 9,
                    background: "#ffffff",
                    border: isActive ? "1px solid #93c5fd" : "1px solid #e5e7eb",
                    boxShadow: isActive ? "inset 3px 0 0 #007AFB, 0 8px 18px rgba(0,122,251,0.12)" : "0 2px 8px rgba(15,23,42,0.05)",
                    transition: "all 160ms ease",
                    fontSize: isMobile ? 17 : 14,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <ProfileAvatar src={user.profileImage} name={user.name} alt={user.name} loading="lazy" style={{ width: isMobile ? 38 : 42, height: isMobile ? 38 : 42, borderRadius: "50%", objectFit: "cover", border: "2px solid #ffffff", boxShadow: "0 4px 10px rgba(15,23,42,0.12)" }} />
                      <span
                        style={{
                          position: "absolute",
                          right: -2,
                          bottom: -2,
                          width: 12,
                          height: 12,
                          borderRadius: 12,
                          border: "2px solid #fff",
                          background: isUserOnline(user.userId) ? "#22c55e" : "#cbd5e1",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</span>
                      <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {isUserOnline(user.userId)
                          ? "Online now"
                          : getLastSeenText(presence?.[user.userId] || user.lastSeen) || (selectedTab === "student" ? `Grade ${user.grade || "-"} · ${user.section || "-"}` : selectedTab === "management" ? officeRoleLabel(user.officeRole) : tabTitle)}
                      </span>
                    </div>
                  </div>

                  {unread > 0 ? (
                    <div
                      style={{
                        minWidth: 26,
                        height: 26,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#ef4444",
                        color: "#fff",
                        borderRadius: 14,
                        padding: "0 6px",
                        fontSize: 11,
                        fontWeight: 800,
                        boxShadow: "0 4px 10px rgba(239,68,68,0.25)",
                      }}
                    >
                      {unread > 99 ? "99+" : unread}
                    </div>
                  ) : (
                    <div style={{ width: 26 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {!isMobile && (
          <div style={{ width: 44, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 10 }}>
            <button
              onClick={() => setSidebarOpen((value) => !value)}
              style={{
                width: 40,
                height: 74,
                border: "1px solid #007AFB",
                background: "linear-gradient(180deg, rgba(255,255,255,0.98) 90%, #e5eaf0 100%)",
                borderRadius: 18,
                padding: 0,
                boxShadow: "0 14px 24px rgba(15, 23, 42, 0.1)",
                cursor: "pointer",
                color: "#007AFB",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
              }}
              title={sidebarOpen ? "Collapse contacts" : "Expand contacts"}
              aria-label="Toggle sidebar"
            >
              <span
                aria-hidden="true"
                style={{
                  width: 4,
                  height: 24,
                  borderRadius: 999,
                  background: "linear-gradient(180deg, #bfdbfe 0%, #60a5fa 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  fontSize: 18,
                  lineHeight: 1,
                  fontWeight: 800,
                  letterSpacing: "-0.08em",
                  transform: sidebarOpen ? "translateX(-1px)" : "translateX(1px)",
                }}
              >
                {sidebarOpen ? "‹" : "›"}
              </span>
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          padding: isMobile ? 10 : 14,
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: isMobile ? 0 : 18,
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
        }}
      >
        {selectedChatUser ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                borderBottom: "1px solid #eef2f7",
                boxShadow: "none",
                background: "#ffffff",
                borderRadius: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                {isMobile && (
                  <button
                    onClick={() => setSelectedChatUser(null)}
                    style={{ border: "none", background: "none", padding: 4, cursor: "pointer", color: "#1d4ed8" }}
                    aria-label="Back to user list"
                  >
                    <FaArrowLeft size={20} />
                  </button>
                )}

                <ProfileAvatar src={selectedChatUser.profileImage} name={selectedChatUser.name} alt={selectedChatUser.name} style={{ width: isMobile ? 42 : 50, height: isMobile ? 42 : 50, borderRadius: "50%", objectFit: "cover", border: "2px solid #ffffff", boxShadow: "0 6px 12px rgba(15,23,42,0.12)" }} />

                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedChatUser.name}</span>
                  <span style={{ fontSize: 12, color: isUserOnline(selectedChatUser.userId) ? "#16A34A" : "#64748b" }}>
                    {isUserOnline(selectedChatUser.userId)
                      ? "Online"
                      : getLastSeenText(presence?.[selectedChatUser.userId] || selectedChatUser.lastSeen) || tabTitle}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#007AFB", background: "#FFFFFF", border: "1px solid #007AFB", padding: "5px 10px", borderRadius: 999 }}>
                  {selectedTab === "management" ? officeRoleLabel(selectedChatUser?.officeRole) : tabTitle}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#334155", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "5px 10px", borderRadius: 999 }}>
                  {messages.length} messages
                </span>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                background: "#ffffff",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
              }}
            >
              {displayItems.map((item, index) => {
                if (item.type === "date") {
                  return (
                    <div key={item.id} style={{ display: "flex", justifyContent: "center", margin: "8px 0 10px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 999, padding: "6px 12px" }}>
                        {item.label}
                      </div>
                    </div>
                  );
                }

                const message = item;
                const isAdmin = message.isAdmin;
                const isEditing = !!editingMessages[message.id];
                const isImageMessage = String(message?.type || "").toLowerCase() === "image" && !!message?.imageUrl;
                const isDeletedMessage = !!message?.deleted;
                const prev = index > 0 ? displayItems[index - 1] : null;
                const prevSameSender = prev && prev.type === "message" && prev.senderId === message.senderId;

                return (
                  <div
                    key={message.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isAdmin ? "flex-end" : "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      onClick={() => handleTextBubbleClick(message.id)}
                      onMouseDown={isAdmin && !message.deleted && !isImageMessage ? () => beginTextLongPress(message) : undefined}
                      onMouseUp={isAdmin && !message.deleted && !isImageMessage ? cancelImageLongPress : undefined}
                      onMouseLeave={isAdmin && !message.deleted && !isImageMessage ? cancelImageLongPress : undefined}
                      onTouchStart={isAdmin && !message.deleted && !isImageMessage ? () => beginTextLongPress(message) : undefined}
                      onTouchEnd={isAdmin && !message.deleted && !isImageMessage ? cancelImageLongPress : undefined}
                      onTouchCancel={isAdmin && !message.deleted && !isImageMessage ? cancelImageLongPress : undefined}
                      onContextMenu={isAdmin && !message.deleted && !isImageMessage ? (event) => {
                        event.preventDefault();
                        setTextMenu({ open: true, message });
                      } : undefined}
                      style={{
                        maxWidth: isMobile ? "88%" : "76%",
                        background: isAdmin ? "#007AFB" : "#f6f7fb",
                        color: isAdmin ? "#fff" : "#111827",
                        padding: isImageMessage ? 6 : "9px 13px",
                        borderRadius: 14,
                        borderTopRightRadius: isAdmin ? 6 : 14,
                        borderTopLeftRadius: isAdmin ? 14 : 6,
                        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
                        border: isAdmin ? "none" : "1px solid #e5e7eb",
                        wordBreak: "break-word",
                        cursor: "pointer",
                        position: "relative",
                        overflow: "visible",
                        marginRight: isAdmin ? -12 : 0,
                      }}
                    >
                      {!isAdmin && !prevSameSender ? (
                        <div
                          style={{
                            position: "absolute",
                            left: -6,
                            bottom: -2,
                            width: 0,
                            height: 0,
                            borderLeft: "6px solid transparent",
                            borderRight: "6px solid transparent",
                            borderBottom: "8px solid #f6f7fb",
                            transform: "rotate(180deg)",
                          }}
                        />
                      ) : null}

                      {isAdmin && !prevSameSender ? (
                        <div
                          style={{
                            position: "absolute",
                            right: -20,
                            bottom: -2,
                            width: 0,
                            height: 0,
                            borderLeft: "6px solid transparent",
                            borderRight: "6px solid transparent",
                            borderBottom: "8px solid #007AFB",
                          }}
                        />
                      ) : null}

                      {isDeletedMessage ? (
                        <>
                          <span style={{ fontStyle: "italic", color: isAdmin ? "rgba(255,255,255,0.92)" : "#64748b" }}>
                            This message is deleted
                          </span>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 6, fontSize: 10, color: isAdmin ? "rgba(255,255,255,0.85)" : "#64748b" }}>
                            <span>{formatTime(message.timeStamp)}</span>
                            {isAdmin ? (
                              <span style={{ display: "flex", gap: 0 }}>
                                <FaCheck size={10} color="#fff" style={{ opacity: 0.82 }} />
                                {message.seen ? <FaCheck size={10} color="#ffffff" style={{ marginLeft: 2, opacity: 0.98 }} /> : null}
                              </span>
                            ) : null}
                          </div>
                        </>
                      ) : isImageMessage ? (
                        <div
                          style={{ width: isMobile ? 214 : 240, position: "relative" }}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleImageClick(message.imageUrl);
                          }}
                          onMouseDown={() => beginImageLongPress(message)}
                          onMouseUp={cancelImageLongPress}
                          onMouseLeave={cancelImageLongPress}
                          onTouchStart={() => beginImageLongPress(message)}
                          onTouchEnd={cancelImageLongPress}
                          onTouchCancel={cancelImageLongPress}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            setImageMenu({ open: true, message });
                          }}
                        >
                          <img
                            src={message.imageUrl}
                            alt="Chat"
                            style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12, display: "block", background: isAdmin ? "#0b61c3" : "#e2e8f0" }}
                            onError={(event) => {
                              event.currentTarget.style.opacity = 0.45;
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              right: 8,
                              bottom: 8,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              background: isAdmin ? "rgba(2,6,23,0.24)" : "rgba(255,255,255,0.82)",
                              borderRadius: 999,
                              padding: "2px 8px",
                              fontSize: 10,
                              color: isAdmin ? "#f8fafc" : "#475569",
                            }}
                          >
                            <span>{formatTime(message.timeStamp)}</span>
                            {isAdmin && !message.deleted ? (
                              <span style={{ display: "flex", alignItems: "center" }}>
                                <FaCheck size={10} color="#fff" style={{ opacity: 0.82 }} />
                                {message.seen ? <FaCheck size={10} color="#ffffff" style={{ marginLeft: 2, opacity: 0.98 }} /> : null}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <>
                          {message.text}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 6, fontSize: 10, color: isAdmin ? "rgba(255,255,255,0.85)" : "#64748b" }}>
                            {message.edited ? <span style={{ fontSize: 10, fontStyle: "italic", opacity: 0.95 }}>edited</span> : null}
                            <span>{formatTime(message.timeStamp)}</span>
                            {isAdmin && !message.deleted ? (
                              <span style={{ display: "flex", gap: 0 }}>
                                <FaCheck size={10} color="#fff" style={{ opacity: 0.82 }} />
                                {message.seen ? <FaCheck size={10} color="#ffffff" style={{ marginLeft: 2, opacity: 0.98 }} /> : null}
                              </span>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>

                    {isEditing ? null : null}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10, padding: 8, borderRadius: 14, background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 6px 14px rgba(15,23,42,0.06)" }}>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={sendImageMessage}
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                style={{
                  width: isMobile ? 42 : 46,
                  height: isMobile ? 42 : 46,
                  borderRadius: "50%",
                  background: "#eff6ff",
                  border: "1px solid #dbeafe",
                  color: "#007AFB",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  cursor: imageSending ? "not-allowed" : "pointer",
                  opacity: imageSending ? 0.65 : 1,
                }}
                disabled={imageSending}
                aria-label="Attach image"
              >
                <FaImage />
              </button>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && sendMessage()}
                placeholder={Object.values(editingMessages).some(Boolean) ? "Edit your message..." : "Type a message..."}
                style={{ flex: 1, padding: isMobile ? 10 : 12, borderRadius: 999, border: "1px solid #d1d5db", outline: "none", background: "#ffffff", boxShadow: "inset 0 1px 2px rgba(15,23,42,0.04)" }}
              />
              <button
                onClick={sendMessage}
                style={{
                  width: isMobile ? 42 : 46,
                  height: isMobile ? 42 : 46,
                  borderRadius: "50%",
                  background: "#007AFB",
                  border: "none",
                  color: "#fff",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  boxShadow: "0 8px 18px rgba(0, 122, 251, 0.25)",
                  cursor: "pointer",
                }}
                aria-label="Send message"
                disabled={imageSending}
              >
                <FaPaperPlane />
              </button>
            </div>

            {previewImageUrl ? (
              <div
                onClick={() => setPreviewImageUrl("")}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(2,6,23,0.85)",
                  zIndex: 1200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 20,
                }}
              >
                <button
                  onClick={() => setPreviewImageUrl("")}
                  style={{
                    position: "absolute",
                    top: 18,
                    right: 18,
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.35)",
                    background: "rgba(15,23,42,0.5)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                  aria-label="Close image"
                >
                  <FaTimes />
                </button>
                <img
                  src={previewImageUrl}
                  alt="Preview"
                  onClick={(event) => event.stopPropagation()}
                  style={{ maxWidth: "92vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 14 }}
                />
              </div>
            ) : null}

            {imageMenu.open ? (
              <div
                onClick={() => setImageMenu({ open: false, message: null })}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(2,6,23,0.45)",
                  zIndex: 1250,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  padding: 18,
                }}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    width: "min(420px, 96vw)",
                    background: "#fff",
                    borderRadius: 16,
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 20px 45px rgba(2,6,23,0.3)",
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={async () => {
                      await handleDownloadImage(imageMenu.message);
                      setImageMenu({ open: false, message: null });
                    }}
                    style={{ width: "100%", border: "none", background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 16px", textAlign: "left", fontWeight: 700, color: "#0f172a", cursor: "pointer" }}
                  >
                    Download image
                  </button>
                  {imageMenu?.message?.isAdmin ? (
                    <button
                      onClick={() => {
                        if (imageMenu?.message?.id) {
                          handleDeleteMessage(imageMenu.message.id);
                        }
                        setImageMenu({ open: false, message: null });
                      }}
                      style={{ width: "100%", border: "none", background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 16px", textAlign: "left", fontWeight: 700, color: "#b91c1c", cursor: "pointer" }}
                    >
                      Delete image
                    </button>
                  ) : null}
                  <button
                    onClick={() => setImageMenu({ open: false, message: null })}
                    style={{ width: "100%", border: "none", background: "#fff", padding: "14px 16px", textAlign: "left", fontWeight: 700, color: "#475569", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {textMenu.open ? (
              <div
                onClick={() => setTextMenu({ open: false, message: null })}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(2,6,23,0.45)",
                  zIndex: 1251,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  padding: 18,
                }}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{ width: "min(420px, 96vw)", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 20px 45px rgba(2,6,23,0.3)", overflow: "hidden" }}
                >
                  <button
                    onClick={() => {
                      if (textMenu?.message?.id) {
                        handleEditMessage(textMenu.message.id);
                      }
                      setTextMenu({ open: false, message: null });
                    }}
                    style={{ width: "100%", border: "none", background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 16px", textAlign: "left", fontWeight: 700, color: "#0f172a", cursor: "pointer" }}
                  >
                    Edit message
                  </button>
                  <button
                    onClick={() => {
                      if (textMenu?.message?.id) {
                        handleDeleteMessage(textMenu.message.id);
                      }
                      setTextMenu({ open: false, message: null });
                    }}
                    style={{ width: "100%", border: "none", background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 16px", textAlign: "left", fontWeight: 700, color: "#b91c1c", cursor: "pointer" }}
                  >
                    Delete message
                  </button>
                  <button
                    onClick={() => setTextMenu({ open: false, message: null })}
                    style={{ width: "100%", border: "none", background: "#fff", padding: "14px 16px", textAlign: "left", fontWeight: 700, color: "#475569", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div style={{ display: "grid", placeItems: "center", flex: 1 }}>
            <div style={{ textAlign: "center", maxWidth: 420, padding: 26, borderRadius: 18, border: "1px solid #e2e8f0", background: "#ffffff", boxShadow: "0 8px 22px rgba(15,23,42,0.06)" }}>
              <h3 style={{ margin: 0, color: "#0f172a", fontSize: 22 }}>Select a contact to start chatting</h3>
              <div style={{ marginTop: 8, color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
                Choose from teachers, students, or parents in your school workspace.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
