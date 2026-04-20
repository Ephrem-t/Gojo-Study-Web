import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaPaperPlane, FaCheck, FaImage, FaTimes, FaFilter } from "react-icons/fa";
import { ref, onValue, push, runTransaction, update } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, schoolPath, storage } from "../firebase";
import { getRtdbRoot, RTDB_BASE_RAW } from "../api/rtdbScope";
import { getTeacherCourseContext } from "../api/teacherApi";
import { fetchCachedJson } from "../utils/rtdbCache";
import {
  buildUnreadConversationMap,
  extractAllowedGradeSectionsFromCourseContext,
  fetchTeacherConversationSummaries,
  loadParentRecordsByIds,
  loadStudentsByGradeSections,
  loadUserRecordsByIds,
  normalizeIdentifier,
  readSessionResource,
  resolveTeacherSchoolCode,
  writeSessionResource,
} from "../utils/teacherData";
import { resolveProfileImage } from "../utils/profileImage";

// NOTE: This codebase uses two chat-key conventions:
// - Students/Parents: teacherUserId_otherUserId (teacher first)
// - Admins: [id1,id2].sort().join('_')
const teacherFirstChatId = (teacherUserId, otherUserId) => {
  const t = String(teacherUserId || "").trim();
  const o = String(otherUserId || "").trim();
  return `${t}_${o}`;
};

const sortedChatId = (id1, id2) => {
  const a = String(id1 || "").trim();
  const b = String(id2 || "").trim();
  return [a, b].sort().join("_");
};

const normalizeTab = (tab) => {
  const t = String(tab || "").toLowerCase();
  if (t === "student" || t === "students") return "student";
  if (t === "parent" || t === "parents") return "parent";
  if (t === "admin" || t === "admins") return "admin";
  return null;
};

const getChatIdForTab = (tab, teacherUserId, otherUserId) => {
  const normalized = normalizeTab(tab) || "student";
  return normalized === "admin"
    ? sortedChatId(teacherUserId, otherUserId)
    : teacherFirstChatId(teacherUserId, otherUserId);
};

const normalizeGrade = (value) => String(value ?? "").trim();
const normalizeSection = (value) => String(value ?? "").trim().toUpperCase();
const normalizeRole = (value) => String(value || "").trim().toLowerCase();
const normalizeTeacherRef = (value) => String(value || "").trim().replace(/^-+/, "").toUpperCase();
const getStudentUserId = (student = {}) =>
  String(
    student?.userId ||
      student?.systemAccountInformation?.userId ||
      student?.account?.userId ||
      ""
  ).trim();

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
  // file:// and content:// images from mobile clients are not web-loadable in browser.
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

const pickFirstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
};

const CONTACTS_SESSION_TTL_MS = 5 * 60 * 1000;
const UNREAD_SUMMARY_TTL_MS = 20 * 1000;

const buildContactsSessionKey = (schoolCode, tab) => {
  return `all_chat_contacts_${String(schoolCode || "global").toUpperCase()}_${String(tab || "student").toLowerCase()}`;
};

const buildUnreadSessionKey = (schoolCode, teacherUserId, tab) => {
  return `all_chat_unread_${String(schoolCode || "global").toUpperCase()}_${String(teacherUserId || "").trim()}_${String(tab || "student").toLowerCase()}`;
};

const collectStudentParentLinks = (student = {}) => {
  const rawStudent = student?.raw || student || {};
  const links = [];

  const pushLink = (candidate = {}, fallbackParentId = "") => {
    const parentId = normalizeIdentifier(candidate?.parentId || candidate?.id || fallbackParentId);
    const userId = normalizeIdentifier(candidate?.userId || candidate?.parentUserId);
    const name = String(candidate?.name || candidate?.parentName || "").trim();
    const phone = String(candidate?.phone || candidate?.parentPhone || candidate?.phoneNumber || "").trim();
    const profileImage = resolveProfileImage(
      candidate?.profileImage,
      candidate?.profile,
      candidate?.parentProfileImage
    );

    if (!parentId && !userId && !name && !phone && profileImage === DEFAULT_PROFILE_IMAGE) {
      return;
    }

    links.push({
      parentId,
      userId,
      name,
      phone,
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
    const key = `${link.parentId}__${link.userId}__${link.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(link);
  });

  return deduped;
};

/* ================= FIREBASE ================= */

export default function TeacherAllChat() {
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

  const teacher = JSON.parse(localStorage.getItem("teacher")) || {};
  const teacherUserId = String(teacher.userId || "");
  const teacherSchoolCode = String(teacher.schoolCode || "").trim();
  const [resolvedSchoolCode, setResolvedSchoolCode] = useState("");

  useEffect(() => {
    let cancelled = false;

    const resolveSchoolCode = async () => {
      if (!teacherSchoolCode) {
        setResolvedSchoolCode("");
        return;
      }

      const resolved = await resolveTeacherSchoolCode(teacherSchoolCode);
      if (!cancelled) {
        setResolvedSchoolCode(resolved);
      }
    };

    resolveSchoolCode();

    return () => {
      cancelled = true;
    };
  }, [teacherSchoolCode]);

  useEffect(() => {
    if (!resolvedSchoolCode) return;
    const current = JSON.parse(localStorage.getItem("teacher") || "{}");
    if (String(current?.schoolCode || "") === resolvedSchoolCode) return;

    const nextTeacher = {
      ...current,
      schoolCode: resolvedSchoolCode,
    };
    localStorage.setItem("teacher", JSON.stringify(nextTeacher));
  }, [resolvedSchoolCode]);

  const rtdbBase = useMemo(() => {
    if (resolvedSchoolCode) {
      return `${RTDB_BASE_RAW}/Platform1/Schools/${resolvedSchoolCode}`;
    }
    return getRtdbRoot();
  }, [resolvedSchoolCode]);

  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [presence, setPresence] = useState({}); // userId -> presence info (bool or object)
  const [isMobile, setIsMobile] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({}); // userId -> number
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState({ student: false, parent: false, admin: false });
  const [searchText, setSearchText] = useState("");
  const [selectedStudentGrade, setSelectedStudentGrade] = useState("All");
  const [selectedStudentSection, setSelectedStudentSection] = useState("All");
  const [showStudentFilters, setShowStudentFilters] = useState(false);
  const [showSearchFilterCard, setShowSearchFilterCard] = useState(true);

  // incoming navigation state (support both { contact } and { user })
  const locationState = location.state || {};
  const incomingContact = locationState.contact || locationState.user || null;
  const incomingChatId = locationState.chatId || null;
  const incomingTab = locationState.tab || null;

  const [selectedTab, setSelectedTab] = useState(normalizeTab(incomingTab) || "student");
  const [selectedChatUser, setSelectedChatUser] = useState(incomingContact || null);
  // Always compute chat key from teacher + selected receiver.
  const [currentChatKey, setCurrentChatKey] = useState(null);

  const [clickedMessageId, setClickedMessageId] = useState(null);
  const [editingMessages, setEditingMessages] = useState({}); // { messageId: true/false }
  const [imageSending, setImageSending] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [imageMenu, setImageMenu] = useState({ open: false, message: null });
  const [textMenu, setTextMenu] = useState({ open: false, message: null });

  const scopedPath = (path) => schoolPath(path, resolvedSchoolCode || teacherSchoolCode);

  const getProfileImage = (user = {}) =>
    sanitizeProfileImage(user.profileImage || user.profile || user.avatar || DEFAULT_PROFILE_IMAGE);

  const allowedUserIds = useMemo(() => {
    const ids = new Set();
    students.forEach((s) => ids.add(String(s.userId || "")));
    parents.forEach((p) => ids.add(String(p.userId || "")));
    admins.forEach((a) => ids.add(String(a.userId || "")));
    return ids;
  }, [students, parents, admins]);

  const availableStudentGrades = useMemo(() => {
    return [...new Set(students.map((s) => String(s?.grade || "").trim()).filter(Boolean))].sort((a, b) => {
      const numericDiff = Number(a) - Number(b);
      if (!Number.isNaN(numericDiff) && numericDiff !== 0) return numericDiff;
      return a.localeCompare(b);
    });
  }, [students]);

  const availableStudentSections = useMemo(() => {
    const base = selectedStudentGrade === "All"
      ? students
      : students.filter((s) => String(s?.grade || "").trim() === selectedStudentGrade);
    return [...new Set(base.map((s) => String(s?.section || "").trim().toUpperCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [students, selectedStudentGrade]);

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

  const applyContactsForTab = (tab, contacts = []) => {
    const normalizedTab = normalizeTab(tab) || "student";
    const nextContacts = Array.isArray(contacts) ? contacts : [];

    if (normalizedTab === "student") {
      setStudents(nextContacts);
    } else if (normalizedTab === "parent") {
      setParents(nextContacts);
    } else {
      setAdmins(nextContacts);
    }

    writeSessionResource(buildContactsSessionKey(resolvedSchoolCode || teacherSchoolCode, normalizedTab), nextContacts);
    setLoadedTabs((previousState) => ({
      ...previousState,
      [normalizedTab]: true,
    }));
  };

  const loadStudentContacts = async (courseContext) => {
    const allowedGradeSections = extractAllowedGradeSectionsFromCourseContext(courseContext);
    if (!allowedGradeSections.size) {
      return [];
    }

    const studentRows = await loadStudentsByGradeSections({
      rtdbBase,
      schoolCode: resolvedSchoolCode || teacherSchoolCode,
      allowedGradeSections,
    });

    return studentRows.map((studentRow) => ({
      studentKey: studentRow.studentKey,
      userId: studentRow.userId,
      studentId: studentRow.studentId,
      name: studentRow.name,
      profileImage: studentRow.profileImage,
      grade: studentRow.grade,
      section: studentRow.section,
      raw: studentRow.raw,
      user: studentRow.user || null,
      type: "student",
    }));
  };

  const loadParentContacts = async (courseContext) => {
    const studentContacts = students.length ? students : await loadStudentContacts(courseContext);
    if (!students.length && studentContacts.length) {
      writeSessionResource(
        buildContactsSessionKey(resolvedSchoolCode || teacherSchoolCode, "student"),
        studentContacts
      );
    }

    const parentIdentifiers = [...new Set(
      studentContacts
        .flatMap((studentContact) => collectStudentParentLinks(studentContact))
        .flatMap((link) => [link?.parentId, link?.userId])
        .map(normalizeIdentifier)
        .filter(Boolean)
    )];

    if (!parentIdentifiers.length) {
      return [];
    }

    const parentRecordsById = await loadParentRecordsByIds({
      rtdbBase,
      schoolCode: resolvedSchoolCode || teacherSchoolCode,
      parentIds: parentIdentifiers,
    });
    const parentRecordList = Object.values(parentRecordsById || {});
    const parentUserIds = [...new Set(
      parentRecordList
        .map((parentRecord) => normalizeIdentifier(parentRecord?.userId))
        .filter(Boolean)
    )];
    const parentUsersById = await loadUserRecordsByIds({
      rtdbBase,
      schoolCode: resolvedSchoolCode || teacherSchoolCode,
      userIds: parentUserIds,
    });

    const contactsById = new Map();

    studentContacts.forEach((studentContact) => {
      collectStudentParentLinks(studentContact).forEach((link) => {
        const normalizedParentId = normalizeIdentifier(link?.parentId);
        const normalizedParentUserId = normalizeIdentifier(link?.userId);
        const parentRecord = parentRecordList.find((candidateRecord) => {
          const refs = [candidateRecord?.parentId, candidateRecord?.userId]
            .map(normalizeIdentifier)
            .filter(Boolean);
          return refs.includes(normalizedParentId) || refs.includes(normalizedParentUserId);
        }) || null;

        const parentUser = parentUsersById[normalizeIdentifier(parentRecord?.userId)] || null;
        const contactUserId = normalizeIdentifier(
          parentUser?.userId || parentRecord?.userId || normalizedParentUserId || normalizedParentId
        );
        if (!contactUserId) {
          return;
        }

        if (contactsById.has(contactUserId)) {
          return;
        }

        const displayName =
          parentUser?.name ||
          parentRecord?.name ||
          String(link?.name || "").trim() ||
          "Parent";

        contactsById.set(contactUserId, {
          userId: contactUserId,
          parentId: normalizeIdentifier(parentRecord?.parentId || normalizedParentId),
          name: displayName,
          profileImage: resolveAvatarSrc(
            parentUser?.profileImage ||
              parentUser?.profile ||
              parentUser?.avatar ||
              parentRecord?.profileImage ||
              parentRecord?.profile ||
              link?.profileImage,
            displayName
          ),
          type: "parent",
        });
      });
    });

    return [...contactsById.values()].sort((leftContact, rightContact) => leftContact.name.localeCompare(rightContact.name));
  };

  const loadAdminContacts = async () => {
    const [schoolAdminsNode, managementNode, hrNode, registerersNode] = await Promise.all([
      fetchCachedJson(`${rtdbBase}/School_Admins.json`, { ttlMs: CONTACTS_SESSION_TTL_MS, fallbackValue: {} }),
      fetchCachedJson(`${rtdbBase}/Management.json`, { ttlMs: CONTACTS_SESSION_TTL_MS, fallbackValue: {} }),
      fetchCachedJson(`${rtdbBase}/HR.json`, { ttlMs: CONTACTS_SESSION_TTL_MS, fallbackValue: {} }),
      fetchCachedJson(`${rtdbBase}/Registerers.json`, { ttlMs: CONTACTS_SESSION_TTL_MS, fallbackValue: {} }),
    ]);

    const managementCandidates = [];
    Object.entries(schoolAdminsNode || {}).forEach(([recordKey, record]) => {
      managementCandidates.push({ source: "school_admin", recordKey, record });
    });
    Object.entries(managementNode || {}).forEach(([recordKey, record]) => {
      managementCandidates.push({ source: "management", recordKey, record });
    });
    Object.entries(hrNode || {}).forEach(([recordKey, record]) => {
      managementCandidates.push({ source: "hr", recordKey, record });
    });
    Object.entries(registerersNode || {}).forEach(([recordKey, record]) => {
      managementCandidates.push({ source: "registerer", recordKey, record });
    });

    const userIdentifiers = [...new Set(
      managementCandidates
        .flatMap(({ recordKey, record }) => [
          record?.userId,
          record?.userID,
          record?.uid,
          record?.account?.userId,
          record?.systemAccountInformation?.userId,
          recordKey,
          record?.adminId,
          record?.managementId,
          record?.hrId,
          record?.registererId,
        ])
        .map(normalizeIdentifier)
        .filter(Boolean)
    )];

    const usersById = await loadUserRecordsByIds({
      rtdbBase,
      schoolCode: resolvedSchoolCode || teacherSchoolCode,
      userIds: userIdentifiers,
    });

    const contactMap = new Map();
    managementCandidates.forEach(({ source, recordKey, record }) => {
      const userId = pickFirstNonEmpty(
        record?.userId,
        record?.userID,
        record?.uid,
        record?.account?.userId,
        record?.systemAccountInformation?.userId,
        usersById[recordKey]?.userId,
        usersById[record?.adminId || ""]?.userId,
        usersById[record?.managementId || ""]?.userId,
        usersById[record?.hrId || ""]?.userId,
        usersById[record?.registererId || ""]?.userId,
        recordKey
      );
      const user = usersById[userId] || usersById[recordKey] || {};
      const resolvedUserId = normalizeIdentifier(user?.userId || userId);
      if (!resolvedUserId) {
        return;
      }

      if (!isActiveRecord(record || user)) {
        return;
      }

      const eligible = source === "school_admin"
        ? isAcademicAdmin({ schoolAdmin: record, user }) || isManagementEligible({ source, record, user })
        : isManagementEligible({ source, record, user });
      if (!eligible) {
        return;
      }

      if (contactMap.has(resolvedUserId)) {
        return;
      }

      const name = user?.name || record?.name || record?.title || "Management";
      contactMap.set(resolvedUserId, {
        userId: resolvedUserId,
        name,
        profileImage: resolveAvatarSrc(
          user?.profileImage || user?.profile || user?.avatar || record?.profileImage || record?.profile,
          name
        ),
        title: record?.title || user?.title || user?.role || source.replace("_", " "),
        source,
        type: "admin",
      });
    });

    return [...contactMap.values()].sort((leftContact, rightContact) => leftContact.name.localeCompare(rightContact.name));
  };

  /* ================= FETCH USERS ================= */
  useEffect(() => {
    if (!teacherUserId || !resolvedSchoolCode) return;

    const normalizedTab = normalizeTab(selectedTab) || "student";
    const currentContacts = normalizedTab === "student" ? students : normalizedTab === "parent" ? parents : admins;
    const cachedContacts = readSessionResource(
      buildContactsSessionKey(resolvedSchoolCode || teacherSchoolCode, normalizedTab),
      { ttlMs: CONTACTS_SESSION_TTL_MS }
    );

    if (Array.isArray(cachedContacts) && !loadedTabs[normalizedTab]) {
      applyContactsForTab(normalizedTab, cachedContacts);
      return;
    }

    if (loadedTabs[normalizedTab] || currentContacts.length) {
      return;
    }

    let cancelled = false;

    const fetchUsers = async () => {
      try {
        setLoadingContacts(true);
        const courseContext = normalizedTab === "admin"
          ? null
          : await getTeacherCourseContext({ teacher, rtdbBase });

        let nextContacts = [];
        if (normalizedTab === "student") {
          nextContacts = await loadStudentContacts(courseContext);
        } else if (normalizedTab === "parent") {
          nextContacts = await loadParentContacts(courseContext);
        } else {
          nextContacts = await loadAdminContacts();
        }

        if (!cancelled) {
          applyContactsForTab(normalizedTab, nextContacts);
        }
      } catch (err) {
        console.error("❌ Fetch error:", err);
        if (!cancelled) {
          applyContactsForTab(normalizedTab, []);
        }
      } finally {
        if (!cancelled) {
          setLoadingContacts(false);
        }
      }
    };

    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [
    teacherUserId,
    teacherSchoolCode,
    resolvedSchoolCode,
    rtdbBase,
    selectedTab,
    loadedTabs,
    admins,
    parents,
    students,
  ]);

  useEffect(() => {
    if (!selectedChatUser?.userId) return;
    if (!loadedTabs[normalizeTab(selectedTab) || "student"]) return;
    if (!allowedUserIds.has(String(selectedChatUser.userId || ""))) {
      setSelectedChatUser(null);
      setCurrentChatKey(null);
      setMessages([]);
    }
  }, [allowedUserIds, loadedTabs, selectedChatUser, selectedTab]);

  /* ================= UNREAD COUNTS ================= */
  useEffect(() => {
    if (!teacherUserId || !resolvedSchoolCode) return;

    const normalizedTab = normalizeTab(selectedTab) || "student";
    const contacts = normalizedTab === "student" ? students : normalizedTab === "parent" ? parents : admins;
    const cachedUnreadCounts = readSessionResource(
      buildUnreadSessionKey(resolvedSchoolCode || teacherSchoolCode, teacherUserId, normalizedTab),
      { ttlMs: UNREAD_SUMMARY_TTL_MS }
    );

    if (cachedUnreadCounts && typeof cachedUnreadCounts === "object") {
      setUnreadCounts((previousCounts) => ({
        ...previousCounts,
        ...cachedUnreadCounts,
      }));
    }

    if (!contacts.length) {
      return;
    }

    let cancelled = false;

    const refreshUnreadCounts = async () => {
      try {
        const summaries = await fetchTeacherConversationSummaries({
          rtdbBase,
          schoolCode: resolvedSchoolCode || teacherSchoolCode,
          teacherUserId,
          contactCandidates: contacts,
        });
        const resetUnreadCounts = contacts.reduce((result, contact) => {
          const userId = normalizeIdentifier(contact?.userId);
          if (userId) {
            result[userId] = 0;
          }
          return result;
        }, {});
        const nextUnreadCounts = {
          ...resetUnreadCounts,
          ...buildUnreadConversationMap(summaries),
        };
        if (!cancelled) {
          setUnreadCounts((previousCounts) => ({
            ...previousCounts,
            ...nextUnreadCounts,
          }));
          writeSessionResource(
            buildUnreadSessionKey(resolvedSchoolCode || teacherSchoolCode, teacherUserId, normalizedTab),
            nextUnreadCounts
          );
        }
      } catch (error) {
        console.error("Failed to refresh unread counts", error);
      }
    };

    refreshUnreadCounts();
    const intervalId = window.setInterval(refreshUnreadCounts, UNREAD_SUMMARY_TTL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [admins, parents, resolvedSchoolCode, rtdbBase, selectedTab, students, teacherSchoolCode, teacherUserId]);

  // responsive: detect mobile and auto-collapse sidebar
  useEffect(() => {
    const handleResize = () => {
      const mobile = typeof window !== "undefined" && window.innerWidth < 640;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* ================= AUTO SELECT ================= */
  // If navigation provided a contact, prefer it (incomingContact)
  useEffect(() => {
    if (incomingContact) {
      setSelectedChatUser(incomingContact);
    }
    if (incomingTab) {
      setSelectedTab(normalizeTab(incomingTab) || "student");
    }
    if (incomingChatId) {
      setCurrentChatKey(String(incomingChatId));
      return;
    }
    if (teacherUserId && incomingContact?.userId) {
      const tabForNav = normalizeTab(incomingTab) || "student";
      setCurrentChatKey(getChatIdForTab(tabForNav, teacherUserId, incomingContact.userId));
    } else {
      setCurrentChatKey(null);
    }
  }, [incomingContact, incomingChatId, incomingTab, teacherUserId]);

  // When lists load and no explicit selectedChatUser, auto-pick first item for tab
  // Remove auto-select: user must manually choose who to chat with

  // If navigation gave a user and lists are ready, find the matching entry and select it
  useEffect(() => {
    const incoming = incomingContact;
    if (!incoming) return;
    if (selectedTab === "student" && students.length) {
      const found = students.find((s) => s.userId === incoming.userId);
      if (found) setSelectedChatUser(found);
    }
    if (selectedTab === "parent" && parents.length) {
      const found = parents.find((p) => p.userId === incoming.userId);
      if (found) setSelectedChatUser(found);
    }
    if (selectedTab === "admin" && admins.length) {
      const found = admins.find((a) => a.userId === incoming.userId);
      if (found) setSelectedChatUser(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, parents, admins, incomingContact, selectedTab]);

  /* ================= CHAT LISTENER ================= */
  useEffect(() => {
    if (!selectedChatUser || !teacherUserId) return;

    const chatKey =
      currentChatKey ||
      getChatIdForTab(normalizeTab(selectedTab) || "student", teacherUserId, selectedChatUser.userId);
    setCurrentChatKey(chatKey); // ensure state is in sync

    const chatRef = ref(db, scopedPath(`Chats/${chatKey}/messages`));
    const unsubscribe = onValue(chatRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, m]) => ({
          id,
          ...m,
          isTeacher: m.senderId === teacherUserId,
        }))
        .sort((a, b) => a.timeStamp - b.timeStamp);

      setMessages(list);

      // mark as seen where teacher is receiver
      Object.entries(data).forEach(([id, m]) => {
        if (m && !m.seen && m.receiverId === teacherUserId) {
          update(ref(db, scopedPath(`Chats/${chatKey}/messages/${id}`)), { seen: true }).catch(console.error);
        }
      });

      // reset unread count for this teacher
      update(ref(db, scopedPath(`Chats/${chatKey}/unread`)), { [teacherUserId]: 0 }).catch(console.error);
      setUnreadCounts((previousCounts) => ({
        ...previousCounts,
        [selectedChatUser.userId]: 0,
      }));
    });

    return () => unsubscribe();
  }, [selectedChatUser, teacherUserId, currentChatKey]);

  const getActiveChatKey = () => {
    if (!selectedChatUser || !teacherUserId) return null;
    return (
      currentChatKey ||
      getChatIdForTab(normalizeTab(selectedTab) || "student", teacherUserId, selectedChatUser.userId)
    );
  };

  /* ================= PRESENCE LISTENER ================= */
  useEffect(() => {
    // Listen to presence node in RTDB. If your backend uses a different path, change it.
    try {
      const presenceRef = ref(db, scopedPath(`Presence`));
      const unsub = onValue(presenceRef, (snap) => {
        const data = snap.val() || {};
        setPresence(data);
      });

      return () => unsub();
    } catch (e) {
      // If realtime presence isn't configured, keep presence empty
      console.warn("Presence listener unavailable:", e);
    }
  }, []);

  /* ================= SEND MESSAGE ================= */
  const sendMessage = async () => {
    if (!input.trim() || !selectedChatUser) return;
    if (!allowedUserIds.has(String(selectedChatUser.userId || ""))) return;

    const editingId = Object.keys(editingMessages).find((id) => editingMessages[id]);
    const chatKey = getActiveChatKey();
    if (!chatKey) return;

    if (editingId) {
      // Update existing message
      await update(ref(db, scopedPath(`Chats/${chatKey}/messages/${editingId}`)), {
        text: input,
        edited: true,
      });
      setEditingMessages({});
      setClickedMessageId(null);
      setInput("");
    } else {
      // Send new message
      const messagesRef = ref(db, scopedPath(`Chats/${chatKey}/messages`));
      const messageData = {
        senderId: teacherUserId,
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
        [teacherUserId]: true,
        [selectedChatUser.userId]: true,
      });

      await update(ref(db, scopedPath(`Chats/${chatKey}/lastMessage`)), {
        text: input,
        senderId: teacherUserId,
        seen: false,
        timeStamp: messageData.timeStamp,
      });

      // increment unread for receiver
      try {
        await update(ref(db, scopedPath(`Chats/${chatKey}/unread`)), { [teacherUserId]: 0 });
        await runTransaction(
          ref(db, scopedPath(`Chats/${chatKey}/unread/${selectedChatUser.userId}`)),
          (current) => (Number(current) || 0) + 1
        );
      } catch (e) {
        // ignore
      }

      setInput("");
    }
  };

  const sendImageMessage = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file || !selectedChatUser || !teacherUserId) {
      if (event?.target) event.target.value = "";
      return;
    }
    if (!allowedUserIds.has(String(selectedChatUser.userId || ""))) {
      if (event?.target) event.target.value = "";
      return;
    }

    const chatKey = getActiveChatKey();
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
        senderId: teacherUserId,
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
        [teacherUserId]: true,
        [selectedChatUser.userId]: true,
      });

      await update(ref(db, scopedPath(`Chats/${chatKey}/lastMessage`)), {
        seen: false,
        senderId: teacherUserId,
        text: "📷 Image",
        timeStamp,
        type: "image",
      });

      try {
        await update(ref(db, scopedPath(`Chats/${chatKey}/unread`)), { [teacherUserId]: 0 });
        await runTransaction(
          ref(db, scopedPath(`Chats/${chatKey}/unread/${selectedChatUser.userId}`)),
          (current) => (Number(current) || 0) + 1
        );
      } catch (error) {
        // ignore unread transaction errors
      }
    } catch (error) {
      console.error("Image send failed:", error);
    } finally {
      setImageSending(false);
      if (event?.target) event.target.value = "";
    }
  };

  /* ================= EDIT / DELETE ================= */
  const handleEditMessage = (id, newText) => {
    const chatKey = getActiveChatKey();
    if (!chatKey) return;
    update(ref(db, scopedPath(`Chats/${chatKey}/messages/${id}`)), {
      text: newText,
      edited: true,
    }).catch(console.error);
    setEditingMessages((prev) => ({ ...prev, [id]: false }));
  };

  const handleDeleteMessage = (id) => {
    const chatKey = getActiveChatKey();
    if (!chatKey) return;
    update(ref(db, scopedPath(`Chats/${chatKey}/messages/${id}`)), { deleted: true }).catch(console.error);
  };

  const startEditing = (id, text) => {
    setEditingMessages({ [id]: true });
    setInput(text);
    setClickedMessageId(id);
  };

  const formatTime = (ts) => {
    const date = new Date(ts);
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${period}`;
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

  const displayItems = useMemo(() => {
    const items = [];
    let lastLabel = null;
    messages.forEach((m) => {
      const label = formatDateLabel(m.timeStamp);
      if (label && label !== lastLabel) {
        items.push({ type: "date", id: `date-${m.timeStamp}-${label}`, label });
        lastLabel = label;
      }
      items.push({ type: "message", ...m });
    });
    return items;
  }, [messages]);

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
      const link = document.createElement("a");
      link.href = url;
      link.download = `chat-image-${message?.timeStamp || Date.now()}.jpg`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Image download failed:", error);
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
    let base = selectedTab === "student" ? students : selectedTab === "parent" ? parents : admins;

    if (selectedTab === "student") {
      base = base.filter((student) => {
        const grade = String(student?.grade || "").trim();
        const section = String(student?.section || "").trim().toUpperCase();
        if (selectedStudentGrade !== "All" && grade !== selectedStudentGrade) return false;
        if (selectedStudentSection !== "All" && section !== selectedStudentSection) return false;
        return true;
      });
    }

    const q = searchText.trim().toLowerCase();
    if (!q) return base;
    return base.filter((u) => {
      const name = String(u?.name || "").toLowerCase();
      const username = String(u?.username || "").toLowerCase();
      const userId = String(u?.userId || "").toLowerCase();
      const title = String(u?.title || "").toLowerCase();
      return name.includes(q) || username.includes(q) || userId.includes(q) || title.includes(q);
    });
  }, [selectedTab, students, parents, admins, searchText, selectedStudentGrade, selectedStudentSection]);

  const isUserOnline = (userId) => {
    if (!userId) return false;
    // try to resolve presence entry for multiple key shapes
    const findPresence = () => {
      // direct key
      if (presence?.[userId] !== undefined) return presence[userId];
      // string form
      const s = String(userId);
      if (presence?.[s] !== undefined) return presence[s];
      // try numeric key
      const n = Number(userId);
      if (!Number.isNaN(n) && presence?.[n] !== undefined) return presence[n];
      // try to find an entry where entry.userId matches
      for (const [, val] of Object.entries(presence || {})) {
        try {
          if (val && (val.userId === userId || String(val.userId) === s)) return val;
        } catch (e) {
          // ignore
        }
      }
      return undefined;
    };

    const p = findPresence();
    if (p == null) return false;
    if (typeof p === 'boolean') return p === true;
    if (typeof p === 'object') {
      if (p.state === 'online' || p.online === true) return true;
      if (p.lastSeen) {
        const last = Number(p.lastSeen) || 0;
        return Date.now() - last < 60_000;
      }
      // if presence value itself is a timestamp
      if (typeof p === 'number') {
        return Date.now() - p < 60_000;
      }
    }
    return false;
  };

  const getLastSeenText = (userId) => {
    const p = presence?.[userId];
    if (!p) return null;
    // accept numeric timestamp or object with common timestamp keys
    let ts = null;
    if (typeof p === 'number' || /^[0-9]+$/.test(String(p))) ts = Number(p);
    if (typeof p === 'object') ts = p.lastSeen || p.timestamp || p.lastActive || p.last_seen || p.time || null;
    if (!ts) return null;
    const diff = Date.now() - Number(ts);
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'last seen just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `last seen ${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `last seen ${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `last seen ${days}d ago`;
    return `last seen on ${new Date(ts).toLocaleDateString()}`;
  };

  const tabTitle = selectedTab === "admin" ? "Management" : selectedTab.charAt(0).toUpperCase() + selectedTab.slice(1);
  const listCount = list.length;
  const isStudentFilterActive =
    selectedStudentGrade !== "All" || selectedStudentSection !== "All";

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
      {/* ===== SIDEBAR / USER LIST ===== */}
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
              gridTemplateColumns: "repeat(3, minmax(0,1fr))",
              gap: 4,
              paddingBlock: 4,
              paddingInline:2,
              marginBottom: 10,
              alignItems: "center",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 999,
              padding: 4,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
            }}
          >
            {["student", "parent", "admin"].map((t) => (
              <button
                key={t}
                onClick={() => {
                  setSelectedTab(t);
                  setSelectedChatUser(null);
                  setCurrentChatKey(null);
                  if (t !== "student") {
                    setSelectedStudentGrade("All");
                    setSelectedStudentSection("All");
                    setShowStudentFilters(false);
                  }
                }}
                style={{
                  padding: 8,
                  borderRadius: 999,
                  border: "none",
                  background: selectedTab === t ? "#007AFB" : "transparent",
                  color: selectedTab === t ? "#fff" : "#475569",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.2,
                  boxShadow: selectedTab === t ? "0 8px 16px rgba(0,122,251,0.22)" : "none",
                }}
              >
                {t === "admin" ? "Management" : t.charAt(0).toUpperCase() + t.slice(1)}
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
              onChange={(e) => setSearchText(e.target.value)}
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
                    onChange={(e) => {
                      setSelectedStudentGrade(e.target.value);
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
                    onChange={(e) => setSelectedStudentSection(e.target.value)}
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
              {students.length} Students · {parents.length} Parents · {admins.length} Management
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

            {list.map((u) => {
              const isActive = selectedChatUser?.userId === u.userId;
              const unread = unreadCounts[u.userId] || 0;

              return (
                <div
                  key={u.userId}
                  onClick={() => {
                    setSelectedChatUser(u);
                    setCurrentChatKey(null);
                    setUnreadCounts((previousCounts) => ({
                      ...previousCounts,
                      [u.userId]: 0,
                    }));
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
                      <img
                        src={u.profileImage}
                        alt={u.name}
                        onError={(e) => {
                          const fallback = createPlaceholderAvatar(u?.name || "User");
                          if (e.currentTarget.src === fallback) return;
                          e.currentTarget.src = fallback;
                        }}
                        style={{ width: isMobile ? 38 : 42, height: isMobile ? 38 : 42, borderRadius: "50%", objectFit: "cover", border: "2px solid #ffffff", boxShadow: "0 4px 10px rgba(15,23,42,0.12)" }}
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
                          background: isUserOnline(u.userId) ? "#22c55e" : "#cbd5e1",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</span>
                      <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {isUserOnline(u.userId)
                          ? "Online now"
                          : getLastSeenText(u.userId) || (selectedTab === "admin" ? u.title || "Academic admin" : tabTitle)}
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

        {/* small toggle rail visible on desktop when sidebar is collapsed */}
        {!isMobile && (
          <div style={{ width: 44, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 10 }}>
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              style={{
                width: 40,
                height: 74,
                border: "1px solid #007AFB)",
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

      {/* ===== CHAT ===== */}
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
            {/* ===== CHAT HEADER ===== */}
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

                <img
                  src={selectedChatUser.profileImage}
                  alt={selectedChatUser.name}
                  onError={(e) => {
                    const fallback = createPlaceholderAvatar(selectedChatUser?.name || "User");
                    if (e.currentTarget.src === fallback) return;
                    e.currentTarget.src = fallback;
                  }}
                  style={{ width: isMobile ? 42 : 50, height: isMobile ? 42 : 50, borderRadius: "50%", objectFit: "cover", border: "2px solid #ffffff", boxShadow: "0 6px 12px rgba(15,23,42,0.12)" }}
                />

                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedChatUser.name}</span>
                  <span style={{ fontSize: 12, color: isUserOnline(selectedChatUser.userId) ? "#16A34A" : "#64748b" }}>
                    {isUserOnline(selectedChatUser.userId)
                      ? "Online"
                      : getLastSeenText(selectedChatUser.userId) || tabTitle}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#007AFB", background: "#FFFFFF", border: "1px solid #007AFB", padding: "5px 10px", borderRadius: 999 }}>
                  {tabTitle}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#334155", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "5px 10px", borderRadius: 999 }}>
                  {messages.length} messages
                </span>
              </div>
            </div>

            {/* ===== CHAT MESSAGES ===== */}
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
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 12px" }}>
                      <div style={{ flex: 1, height: 1, background: "#dbe7ff" }} />
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{item.label}</span>
                      <div style={{ flex: 1, height: 1, background: "#dbe7ff" }} />
                    </div>
                  );
                }

                const m = item;
                const isTeacher = m.isTeacher;
                const isEditing = !!editingMessages[m.id];
                const isImageMessage = String(m?.type || "").toLowerCase() === "image" && !!m?.imageUrl;
                const isDeletedMessage = !!m?.deleted;
                const prev = index > 0 ? displayItems[index - 1] : null;
                const prevSameSender = prev && prev.type === "message" && prev.senderId === m.senderId;

                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isTeacher ? "flex-end" : "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      onClick={() => handleTextBubbleClick(m.id)}
                      onMouseDown={
                        isTeacher && !m.deleted && !isImageMessage
                          ? () => beginTextLongPress(m)
                          : undefined
                      }
                      onMouseUp={
                        isTeacher && !m.deleted && !isImageMessage
                          ? cancelImageLongPress
                          : undefined
                      }
                      onMouseLeave={
                        isTeacher && !m.deleted && !isImageMessage
                          ? cancelImageLongPress
                          : undefined
                      }
                      onTouchStart={
                        isTeacher && !m.deleted && !isImageMessage
                          ? () => beginTextLongPress(m)
                          : undefined
                      }
                      onTouchEnd={
                        isTeacher && !m.deleted && !isImageMessage
                          ? cancelImageLongPress
                          : undefined
                      }
                      onTouchCancel={
                        isTeacher && !m.deleted && !isImageMessage
                          ? cancelImageLongPress
                          : undefined
                      }
                      onContextMenu={
                        isTeacher && !m.deleted && !isImageMessage
                          ? (event) => {
                              event.preventDefault();
                              setTextMenu({ open: true, message: m });
                            }
                          : undefined
                      }
                      style={{
                        maxWidth: isMobile ? "88%" : "76%",
                        background: isTeacher ? "#007AFB" : "#f6f7fb",
                        color: isTeacher ? "#fff" : "#111827",
                        padding: isImageMessage ? 6 : "9px 13px",
                        borderRadius: 14,
                        borderTopRightRadius: isTeacher ? 6 : 14,
                        borderTopLeftRadius: isTeacher ? 14 : 6,
                        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
                        border: isTeacher ? "none" : "1px solid #e5e7eb",
                        wordBreak: "break-word",
                        cursor: "pointer",
                        position: "relative",
                        overflow: "visible",
                        marginRight: isTeacher ? -12 : 0,
                      }}
                    >
                      {!isTeacher && !prevSameSender ? (
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

                      {isTeacher && !prevSameSender ? (
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
                          <span
                            style={{
                              fontStyle: "italic",
                              color: isTeacher ? "rgba(255,255,255,0.92)" : "#64748b",
                            }}
                          >
                            This message is deleted
                          </span>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              gap: 6,
                              marginTop: 6,
                              fontSize: 10,
                              color: isTeacher ? "rgba(255,255,255,0.85)" : "#64748b",
                            }}
                          >
                            <span>{formatTime(m.timeStamp)}</span>
                            {isTeacher ? (
                              <span style={{ display: "flex", gap: 0 }}>
                                <FaCheck size={10} color="#fff" style={{ opacity: 0.82 }} />
                                {m.seen ? <FaCheck size={10} color="#ffffff" style={{ marginLeft: 2, opacity: 0.98 }} /> : null}
                              </span>
                            ) : null}
                          </div>
                        </>
                      ) : isImageMessage ? (
                        <div
                          style={{ width: isMobile ? 214 : 240, position: "relative" }}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleImageClick(m.imageUrl);
                          }}
                          onMouseDown={() => beginImageLongPress(m)}
                          onMouseUp={cancelImageLongPress}
                          onMouseLeave={cancelImageLongPress}
                          onTouchStart={() => beginImageLongPress(m)}
                          onTouchEnd={cancelImageLongPress}
                          onTouchCancel={cancelImageLongPress}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            setImageMenu({ open: true, message: m });
                          }}
                        >
                          <img
                            src={m.imageUrl}
                            alt="Chat"
                            style={{
                              width: "100%",
                              maxHeight: 220,
                              objectFit: "cover",
                              borderRadius: 12,
                              display: "block",
                              background: isTeacher ? "#0b61c3" : "#e2e8f0",
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
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
                              background: isTeacher ? "rgba(2,6,23,0.24)" : "rgba(255,255,255,0.82)",
                              borderRadius: 999,
                              padding: "2px 8px",
                              fontSize: 10,
                              color: isTeacher ? "#f8fafc" : "#475569",
                            }}
                          >
                            <span>{formatTime(m.timeStamp)}</span>
                            {isTeacher && !m.deleted ? (
                              <span style={{ display: "flex", alignItems: "center" }}>
                                <FaCheck size={10} color="#fff" style={{ opacity: 0.82 }} />
                                {m.seen ? <FaCheck size={10} color="#ffffff" style={{ marginLeft: 2, opacity: 0.98 }} /> : null}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <>
                          {m.text}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              gap: 6,
                              marginTop: 6,
                              fontSize: 10,
                              color: isTeacher ? "rgba(255,255,255,0.85)" : "#64748b",
                            }}
                          >
                            {m.edited ? (
                              <span style={{ fontSize: 10, fontStyle: "italic", opacity: 0.95 }}>
                                edited
                              </span>
                            ) : null}
                            <span>{formatTime(m.timeStamp)}</span>
                            {isTeacher && !m.deleted ? (
                              <span style={{ display: "flex", gap: 0 }}>
                                <FaCheck size={10} color="#fff" style={{ opacity: 0.82 }} />
                                {m.seen ? <FaCheck size={10} color="#ffffff" style={{ marginLeft: 2, opacity: 0.98 }} /> : null}
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

            {/* ===== INPUT ===== */}
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
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
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
                    style={{
                      width: "100%",
                      border: "none",
                      background: "#fff",
                      borderBottom: "1px solid #e2e8f0",
                      padding: "14px 16px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "#0f172a",
                      cursor: "pointer",
                    }}
                  >
                    Download image
                  </button>
                  {imageMenu?.message?.isTeacher ? (
                    <button
                      onClick={() => {
                        if (imageMenu?.message?.id) {
                          handleDeleteMessage(imageMenu.message.id);
                        }
                        setImageMenu({ open: false, message: null });
                      }}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "#fff",
                        borderBottom: "1px solid #e2e8f0",
                        padding: "14px 16px",
                        textAlign: "left",
                        fontWeight: 700,
                        color: "#b91c1c",
                        cursor: "pointer",
                      }}
                    >
                      Delete image
                    </button>
                  ) : null}
                  <button
                    onClick={() => setImageMenu({ open: false, message: null })}
                    style={{
                      width: "100%",
                      border: "none",
                      background: "#fff",
                      padding: "14px 16px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "#475569",
                      cursor: "pointer",
                    }}
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
                    onClick={() => {
                      if (textMenu?.message?.id) {
                        startEditing(textMenu.message.id, textMenu?.message?.text || "");
                      }
                      setTextMenu({ open: false, message: null });
                    }}
                    style={{
                      width: "100%",
                      border: "none",
                      background: "#fff",
                      borderBottom: "1px solid #e2e8f0",
                      padding: "14px 16px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "#0f172a",
                      cursor: "pointer",
                    }}
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
                    style={{
                      width: "100%",
                      border: "none",
                      background: "#fff",
                      borderBottom: "1px solid #e2e8f0",
                      padding: "14px 16px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "#b91c1c",
                      cursor: "pointer",
                    }}
                  >
                    Delete message
                  </button>
                  <button
                    onClick={() => setTextMenu({ open: false, message: null })}
                    style={{
                      width: "100%",
                      border: "none",
                      background: "#fff",
                      padding: "14px 16px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "#475569",
                      cursor: "pointer",
                    }}
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
                Choose from your assigned students, their parents, or academic admins.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

