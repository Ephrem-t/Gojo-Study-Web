import React, { useEffect, useState, useRef, useMemo } from "react";
import { FaChevronRight } from "react-icons/fa";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import {
  FaHome,
  FaSearch,
  FaFileAlt,
  FaChalkboardTeacher,
  FaSignOutAlt,
  FaUsers,
  FaClipboardCheck,
  FaStar,
  FaCheckCircle,
  FaCheck,
  FaTimesCircle,
  FaCommentDots,
  FaFacebookMessenger,
  FaUserCheck,
  FaCalendarAlt,
  FaBookOpen,
  FaPaperPlane,
} from "react-icons/fa";
import "../styles/global.css";
import { API_BASE } from "../api/apiConfig";
import { getTeacherContext, getTeacherCourseContext } from "../api/teacherApi";
import { getRtdbRoot, RTDB_BASE_RAW } from "../api/rtdbScope";
import { resolveProfileImage } from "../utils/profileImage";
import {
  clearCachedChatSummary,
  fetchTeacherConversationSummaries,
  readSessionResource,
  resolveTeacherSchoolCode,
  writeSessionResource,
} from "../utils/teacherData";
import ProfileAvatar from "./ProfileAvatar";

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
import { db, schoolPath } from "../firebase";

const STUDENT_CONVERSATIONS_SESSION_TTL_MS = 20 * 1000;
const EMPTY_TEACHER_COURSE_CONTEXT = {
  success: false,
  teacherKey: "",
  teacherRecord: null,
  courses: [],
  courseIds: [],
  assignmentsByCourseId: {},
};

const normalizeGrade = (value) => String(value ?? "").trim();
const normalizeSection = (value) => String(value ?? "").trim().toUpperCase();
const buildGradeSectionKey = (grade, section) => `${normalizeGrade(grade)}|${normalizeSection(section)}`;
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
// helper: ISO week number for a Date
const getWeekNumber = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return weekNo;
};

// place this inside StudentsPage (above the JSX that uses it)
const formatSubjectName = (courseId = "") => {
  if (!courseId) return "Unknown";
  // remove common prefixes/suffixes and underscores, then title-case words
  const clean = String(courseId)
    .replace(/^course_/, "")
    .replace(/_[0-9A-Za-z]+$/, "") // remove trailing class id like _9A if present
    .replace(/_/g, " ")
    .trim();

  // Title-case each word and return
  return clean
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");

};

// compute age helper
const computeAge = (rawDob) => {
  if (!rawDob) return null;
  let d;
  if (typeof rawDob === "number") d = new Date(rawDob);
  else d = new Date(String(rawDob));
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
};

// helpers for message time display (copied from AllChat)
const formatTime = (ts) => {
  if (!ts) return "";
  const date = new Date(Number(ts));
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
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

      const buildStudentConversationsSessionKey = (schoolCode, teacherUserId) => {
        return `students_unread_conversations_${String(schoolCode || "global").toUpperCase()}_${String(teacherUserId || "").trim()}`;
      };
    });

  return [...merged.values()].sort(
    (leftMessage, rightMessage) =>
      Number(leftMessage?.timeStamp || 0) - Number(rightMessage?.timeStamp || 0)
  );
};

// find user by userId in Users node object
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

const normalizeIdentifier = (value) => String(value || "").trim();

const findUserByIdentifiers = (usersObj, ...identifiers) => {
  if (!usersObj) return null;

  const wanted = new Set(
    identifiers
      .flat()
      .map(normalizeIdentifier)
      .filter(Boolean)
  );

  if (!wanted.size) return null;

  for (const identifier of wanted) {
    if (usersObj?.[identifier]) return usersObj[identifier];
  }

  return (
    Object.entries(usersObj).find(([userKey, userValue]) => {
      const refs = [
        userKey,
        userValue?.userId,
        userValue?.parentId,
        userValue?.studentId,
        userValue?.teacherId,
        userValue?.adminId,
        userValue?.managementId,
        userValue?.hrId,
        userValue?.registererId,
        userValue?.employeeId,
        userValue?.username,
      ]
        .map(normalizeIdentifier)
        .filter(Boolean);

      return refs.some((ref) => wanted.has(ref));
    })?.[1] || null
  );
};

const collectStudentParentLinks = (student = {}, userRec = null) => {
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

    if (!parentId && !userId && !name && !phone && profileImage === "/default-profile.png") {
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

  pushLink({
    parentId: student?.parentId,
    userId: student?.parentUserId,
    name: student?.parentName,
    phone: student?.parentPhone,
    parentProfileImage: student?.parentProfileImage,
  });

  pushLink({
    parentId: userRec?.parentId,
    userId: userRec?.parentUserId,
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

const resolveStudentParentInfo = ({ student, usersObj = {}, parentsObj = {} } = {}) => {
  if (!student) return null;

  const userRec = findUserByIdentifiers(usersObj, student?.userId) || null;
  const parentLinks = collectStudentParentLinks(student, userRec);

  const parentMatchesStudent = (parent = {}) => {
    const studentId = normalizeIdentifier(student?.studentId || student?.raw?.studentId);
    const studentUserId = normalizeIdentifier(student?.userId || student?.raw?.userId);
    const children = parent?.children || {};

    return Object.values(children).some((child) => {
      const childStudentId = normalizeIdentifier(child?.studentId);
      const childUserId = normalizeIdentifier(child?.userId);
      return (
        (studentId && childStudentId === studentId) ||
        (studentId && childUserId === studentId) ||
        (studentUserId && childUserId === studentUserId) ||
        (studentUserId && childStudentId === studentUserId)
      );
    });
  };

  let parentRec = null;
  let parentUserRec = null;
  let matchedLink = null;

  for (const link of parentLinks) {
    const parentId = normalizeIdentifier(link.parentId);
    const parentUserId = normalizeIdentifier(link.userId);

    if (parentId && parentsObj?.[parentId]) {
      parentRec = parentsObj[parentId];
    }

    if (!parentRec && (parentId || parentUserId)) {
      parentRec =
        Object.entries(parentsObj || {}).find(([parentKey, parentValue]) => {
          const refs = [parentKey, parentValue?.parentId, parentValue?.userId]
            .map(normalizeIdentifier)
            .filter(Boolean);
          return refs.some((ref) => ref === parentId || ref === parentUserId);
        })?.[1] || null;
    }

    parentUserRec = findUserByIdentifiers(
      usersObj,
      parentUserId,
      parentRec?.userId,
      parentId,
      parentRec?.parentId
    );

    if (parentRec || parentUserRec) {
      matchedLink = link;
      break;
    }
  }

  if (!parentRec) {
    const fallbackParentEntry =
      Object.entries(parentsObj || {}).find(([, parent]) => parentMatchesStudent(parent)) || null;

    if (fallbackParentEntry) {
      matchedLink = matchedLink || { parentId: fallbackParentEntry[0] };
      parentRec = fallbackParentEntry[1];
      parentUserRec = findUserByIdentifiers(
        usersObj,
        parentRec?.userId,
        fallbackParentEntry[0],
        parentRec?.parentId
      );
    }
  }

  if (!matchedLink && parentLinks.length) {
    matchedLink = parentLinks[0];
  }

  const parentUserId = normalizeIdentifier(
    parentUserRec?.userId || parentRec?.userId || matchedLink?.userId
  );
  const parentId = normalizeIdentifier(
    parentRec?.parentId || matchedLink?.parentId
  );
  const parentName =
    parentUserRec?.name ||
    parentRec?.name ||
    parentRec?.displayName ||
    matchedLink?.name ||
    "";
  const parentPhone =
    parentUserRec?.phone ||
    parentRec?.phone ||
    parentRec?.phoneNumber ||
    parentRec?.contact ||
    matchedLink?.phone ||
    "";
  const parentProfileImage = resolveProfileImage(
    parentUserRec?.profileImage,
    parentUserRec?.profile,
    parentRec?.profileImage,
    parentRec?.profile,
    matchedLink?.profileImage
  );

  if (!parentId && !parentUserId && !parentName && !parentPhone) {
    return null;
  }

  return {
    parentId,
    parentUserId,
    parentName,
    parentPhone,
    parentProfileImage,
    parentRec,
    parentUserRec,
    parentLink: matchedLink,
    userRec,
  };
};

const formatQuarterLabel = (quarterKey) => {
  const quarterNumber = parseInt(String(quarterKey).replace(/^q/i, ""), 10);
  return Number.isFinite(quarterNumber)
    ? `Quarter ${quarterNumber}`
    : String(quarterKey).toUpperCase();
};

const StudentItem = ({ student, selected, onClick, number }) => (
  <div
    onClick={() => onClick(student)}
    style={{
      width: "100%",
      borderRadius: "14px",
      padding: "11px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      cursor: "pointer",
      background: "#ffffff",
      border: selected ? "1px solid #93c5fd" : "1px solid #e2e8f0",
      boxShadow: selected
        ? "0 14px 28px rgba(37, 99, 235, 0.16), inset 3px 0 0 #2563eb"
        : "0 4px 10px rgba(15, 23, 42, 0.06)",
      transition: "all 0.24s ease",
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

    <ProfileAvatar
      src={student.profileImage}
      name={student.name}
      alt={student.name}
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        objectFit: "cover",
        border: selected ? "2px solid #60a5fa" : "2px solid #e2e8f0",
      }}
    />
    <div>
      <h3 style={{ margin: 0, fontSize: 14 }}>{student.name}</h3>
      <p style={{ margin: "4px 0", color: "#555", fontSize: 11 }}>
        Grade {student.grade} - Section {student.section}
      </p>
    </div>
  </div>
);

function StudentsPage() {
  // Responsive sidebar state for mobile
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth > 600 : true);
  // Keep sidebar closed by default on phones and open on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 600) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [assignedGradeSections, setAssignedGradeSections] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sections, setSections] = useState([]);

  const [studentTab, setStudentTab] = useState("details");

  const [popupMessages, setPopupMessages] = useState([]);
  const [popupInput, setPopupInput] = useState("");
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState("daily");
  const [assignmentsData, setAssignmentsData] = useState({});
  const [teachersData, setTeachersData] = useState({});
  const [usersData, setUsersData] = useState({});
  const [parentsData, setParentsData] = useState({});
  const [selectedStudentDetails, setSelectedStudentDetails] = useState(null);
  const [teacherNotes, setTeacherNotes] = useState([]);
  const [newTeacherNote, setNewTeacherNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  // default
  const [marksData, setMarksData] = useState({});
  const [teacher, setTeacher] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentChatOpen, setStudentChatOpen] = useState(false);
  const [liveQuickChatMessages, setLiveQuickChatMessages] = useState([]);
  const [olderQuickChatMessages, setOlderQuickChatMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [quickChatLoading, setQuickChatLoading] = useState(false);
  const [quickChatLoadingOlder, setQuickChatLoadingOlder] = useState(false);
  const [quickChatHasOlder, setQuickChatHasOlder] = useState(false);
  const [quickChatTarget, setQuickChatTarget] = useState(null);
  const [quickChatTab, setQuickChatTab] = useState("student");
  const [teacherCourseContext, setTeacherCourseContext] = useState(EMPTY_TEACHER_COURSE_CONTEXT);
  const [teacherCourseContextReady, setTeacherCourseContextReady] = useState(false);
  const messagesEndRef = useRef(null);
  const quickChatMessagesRef = useRef(null);
  const quickChatScrollRestoreRef = useRef(null);
  const userRecordCacheRef = useRef(new Map());
  const parentRecordCacheRef = useRef(new Map());
  const teacherRecordCacheRef = useRef(new Map());
  const attendanceCourseCacheRef = useRef(new Map());
  const teacherData = JSON.parse(localStorage.getItem("teacher")) || {};
  const teacherUserId = String(teacherData.userId || "");
  const teacherSchoolCode = String(teacherData.schoolCode || "").trim();
  const [studentMarksFlattened, setStudentMarksFlattened] = useState({});
  const [performance, setPerformance] = useState([]);
const [attendanceView, setAttendanceView] = useState("daily");
  const [attendanceCourseFilter, setAttendanceCourseFilter] = useState("All");
  const [expandedCards, setExpandedCards] = useState({});
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [marksLoading, setMarksLoading] = useState(false);
  const [activeQuarterViews, setActiveQuarterViews] = useState({});

  const [courses, setCourses] = useState([]);

  const [activeSemester, setActiveSemester] = useState("semester2");

  const [studentMarks, setStudentMarks] = useState({});
// state: attendance entries for the selected student (normalized)
const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  // Refs for posts (for scrolling/highlighting)
  const postRefs = useRef({});
  const navigate = useNavigate();

  // Messenger states (same behavior as Dashboard)
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]); // only conversations that have unread messages for me
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

    const currentTeacher = JSON.parse(localStorage.getItem("teacher") || "{}");
    if (String(currentTeacher?.schoolCode || "") !== resolvedSchoolCode) {
      localStorage.setItem(
        "teacher",
        JSON.stringify({
          ...currentTeacher,
          schoolCode: resolvedSchoolCode,
        })
      );
    }

    setTeacher((prev) => (prev ? { ...prev, schoolCode: resolvedSchoolCode } : prev));
    setTeacherInfo((prev) => (prev ? { ...prev, schoolCode: resolvedSchoolCode } : prev));
  }, [resolvedSchoolCode]);

  const rtdbBase = useMemo(() => {
    if (resolvedSchoolCode) {
      return `${RTDB_BASE_RAW}/Platform1/Schools/${resolvedSchoolCode}`;
    }
    return getRtdbRoot();
  }, [resolvedSchoolCode]);

  const scopedStudentPath = (path) => schoolPath(path, resolvedSchoolCode || teacherSchoolCode);
  const messages = useMemo(
    () => mergeChatMessages(olderQuickChatMessages, liveQuickChatMessages),
    [olderQuickChatMessages, liveQuickChatMessages]
  );

  const cacheUserRecord = (recordKey, userRecord) => {
    if (!userRecord || typeof userRecord !== "object") return;

    [recordKey, userRecord?.userId, userRecord?.username]
      .map(normalizeIdentifier)
      .filter(Boolean)
      .forEach((key) => {
        userRecordCacheRef.current.set(key, userRecord);
      });
  };

  const cacheParentRecord = (recordKey, parentRecord) => {
    if (!parentRecord || typeof parentRecord !== "object") return;

    [recordKey, parentRecord?.parentId, parentRecord?.userId]
      .map(normalizeIdentifier)
      .filter(Boolean)
      .forEach((key) => {
        parentRecordCacheRef.current.set(key, parentRecord);
      });
  };

  const cacheTeacherRecord = (recordKey, teacherRecord) => {
    if (!teacherRecord || typeof teacherRecord !== "object") return;

    [recordKey, teacherRecord?.teacherId, teacherRecord?.teacherKey, teacherRecord?.userId]
      .map(normalizeIdentifier)
      .filter(Boolean)
      .forEach((key) => {
        teacherRecordCacheRef.current.set(key, teacherRecord);
      });
  };

  const closeQuickChat = () => {
    setChatOpen(false);
    setQuickChatTarget(null);
    setQuickChatTab("student");
  };

  const openQuickChat = (target, tab = "student") => {
    const targetUserId = normalizeIdentifier(target?.userId);
    if (!targetUserId) return;

    setQuickChatTarget({
      ...target,
      userId: targetUserId,
      type: tab,
    });
    setQuickChatTab(tab);
    setChatOpen(true);
  };

  const loadUsersByIds = async (userIds = []) => {
    const normalizedUserIds = [...new Set(userIds.map(normalizeIdentifier).filter(Boolean))];
    if (!normalizedUserIds.length) return {};

    const cachedUsers = {};
    const missingUserIds = [];

    normalizedUserIds.forEach((userId) => {
      const cachedRecord = userRecordCacheRef.current.get(userId) || usersData?.[userId] || null;
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
          const directSnapshot = await get(dbRef(db, scopedStudentPath(`Users/${userId}`)));
          if (directSnapshot.exists()) {
            return [userId, directSnapshot.val()];
          }
        } catch (error) {
          // fall through to indexed lookup
        }

        try {
          const lookupSnapshot = await get(
            dbQuery(dbRef(db, scopedStudentPath("Users")), orderByChild("userId"), equalTo(userId))
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

    if (Object.keys(fetchedUsers).length) {
      setUsersData((previousUsers) => ({
        ...(previousUsers || {}),
        ...fetchedUsers,
      }));
    }

    return {
      ...cachedUsers,
      ...fetchedUsers,
    };
  };

  const loadTeachersByIds = async (teacherIds = []) => {
    const normalizedTeacherIds = [...new Set(teacherIds.map(normalizeIdentifier).filter(Boolean))];
    if (!normalizedTeacherIds.length) return {};

    const cachedTeachers = {};
    const missingTeacherIds = [];

    normalizedTeacherIds.forEach((teacherId) => {
      const cachedRecord = teacherRecordCacheRef.current.get(teacherId) || teachersData?.[teacherId] || null;
      if (cachedRecord) {
        cachedTeachers[teacherId] = cachedRecord;
        cacheTeacherRecord(teacherId, cachedRecord);
        return;
      }
      missingTeacherIds.push(teacherId);
    });

    if (!missingTeacherIds.length) return cachedTeachers;

    const fetchedEntries = await Promise.all(
      missingTeacherIds.map(async (teacherId) => {
        try {
          const directSnapshot = await get(dbRef(db, scopedStudentPath(`Teachers/${teacherId}`)));
          if (directSnapshot.exists()) {
            return [teacherId, directSnapshot.val()];
          }
        } catch (error) {
          // fall through to indexed lookups
        }

        try {
          const teacherLookupSnapshot = await get(
            dbQuery(dbRef(db, scopedStudentPath("Teachers")), orderByChild("teacherId"), equalTo(teacherId))
          );
          if (teacherLookupSnapshot.exists()) {
            return [teacherId, Object.values(teacherLookupSnapshot.val() || {})[0] || null];
          }
        } catch (error) {
          // continue to userId lookup below
        }

        try {
          const userLookupSnapshot = await get(
            dbQuery(dbRef(db, scopedStudentPath("Teachers")), orderByChild("userId"), equalTo(teacherId))
          );
          if (userLookupSnapshot.exists()) {
            return [teacherId, Object.values(userLookupSnapshot.val() || {})[0] || null];
          }
        } catch (error) {
          // ignore missing indexed lookup support and return null below
        }

        return [teacherId, null];
      })
    );

    const fetchedTeachers = {};
    fetchedEntries.forEach(([teacherId, teacherRecord]) => {
      if (!teacherRecord) return;
      fetchedTeachers[teacherId] = teacherRecord;
      cacheTeacherRecord(teacherId, teacherRecord);
    });

    if (Object.keys(fetchedTeachers).length) {
      setTeachersData((previousTeachers) => ({
        ...(previousTeachers || {}),
        ...fetchedTeachers,
      }));
    }

    return {
      ...cachedTeachers,
      ...fetchedTeachers,
    };
  };

  const loadParentsForStudent = async (student, usersObj = {}) => {
    if (!student) return {};

    const parentLinks = collectStudentParentLinks(
      student,
      findUserByIdentifiers({ ...(usersData || {}), ...(usersObj || {}) }, student?.userId) || null
    );
    const parentIdentifiers = [...new Set(
      parentLinks.flatMap((link) => [link?.parentId, link?.userId]).map(normalizeIdentifier).filter(Boolean)
    )];

    if (!parentIdentifiers.length) return {};

    const cachedParents = {};
    const missingParentIdentifiers = [];

    parentIdentifiers.forEach((parentIdentifier) => {
      const cachedRecord = parentRecordCacheRef.current.get(parentIdentifier) || parentsData?.[parentIdentifier] || null;
      if (cachedRecord) {
        cachedParents[parentIdentifier] = cachedRecord;
        cacheParentRecord(parentIdentifier, cachedRecord);
        return;
      }
      missingParentIdentifiers.push(parentIdentifier);
    });

    if (!missingParentIdentifiers.length) return cachedParents;

    const fetchedEntries = await Promise.all(
      missingParentIdentifiers.map(async (parentIdentifier) => {
        try {
          const directSnapshot = await get(dbRef(db, scopedStudentPath(`Parents/${parentIdentifier}`)));
          if (directSnapshot.exists()) {
            return [parentIdentifier, directSnapshot.val()];
          }
        } catch (error) {
          // fall through to indexed lookups
        }

        try {
          const parentIdLookupSnapshot = await get(
            dbQuery(dbRef(db, scopedStudentPath("Parents")), orderByChild("parentId"), equalTo(parentIdentifier))
          );
          if (parentIdLookupSnapshot.exists()) {
            return [parentIdentifier, Object.values(parentIdLookupSnapshot.val() || {})[0] || null];
          }
        } catch (error) {
          // continue to userId lookup below
        }

        try {
          const userLookupSnapshot = await get(
            dbQuery(dbRef(db, scopedStudentPath("Parents")), orderByChild("userId"), equalTo(parentIdentifier))
          );
          if (userLookupSnapshot.exists()) {
            return [parentIdentifier, Object.values(userLookupSnapshot.val() || {})[0] || null];
          }
        } catch (error) {
          // ignore missing indexed lookup support and return null below
        }

        return [parentIdentifier, null];
      })
    );

    const fetchedParents = {};
    fetchedEntries.forEach(([parentIdentifier, parentRecord]) => {
      if (!parentRecord) return;
      fetchedParents[parentIdentifier] = parentRecord;
      cacheParentRecord(parentIdentifier, parentRecord);
    });

    if (Object.keys(fetchedParents).length) {
      setParentsData((previousParents) => ({
        ...(previousParents || {}),
        ...fetchedParents,
      }));
    }

    return {
      ...cachedParents,
      ...fetchedParents,
    };
  };

  const loadAttendanceByCourseIds = async (courseIds = []) => {
    const normalizedCourseIds = [...new Set(courseIds.map(normalizeIdentifier).filter(Boolean))];
    if (!normalizedCourseIds.length) return {};

    const schoolScopeKey = normalizeIdentifier(resolvedSchoolCode || teacherSchoolCode || "default");
    const cachedAttendance = {};
    const missingCourseIds = [];

    normalizedCourseIds.forEach((courseId) => {
      const cacheKey = `${schoolScopeKey}::${courseId}`;
      if (attendanceCourseCacheRef.current.has(cacheKey)) {
        cachedAttendance[courseId] = attendanceCourseCacheRef.current.get(cacheKey) || {};
        return;
      }
      missingCourseIds.push(courseId);
    });

    if (!missingCourseIds.length) return cachedAttendance;

    const fetchedEntries = await Promise.all(
      missingCourseIds.map(async (courseId) => {
        try {
          const courseAttendanceSnapshot = await get(dbRef(db, scopedStudentPath(`Attendance/${courseId}`)));
          return [courseId, courseAttendanceSnapshot.exists() ? courseAttendanceSnapshot.val() || {} : {}];
        } catch (error) {
          return [courseId, {}];
        }
      })
    );

    const fetchedAttendance = {};
    fetchedEntries.forEach(([courseId, courseAttendance]) => {
      const cacheKey = `${schoolScopeKey}::${courseId}`;
      attendanceCourseCacheRef.current.set(cacheKey, courseAttendance || {});
      fetchedAttendance[courseId] = courseAttendance || {};
    });

    return {
      ...cachedAttendance,
      ...fetchedAttendance,
    };
  };

  useEffect(() => {
    Object.entries(usersData || {}).forEach(([recordKey, userRecord]) => {
      cacheUserRecord(recordKey, userRecord);
    });
  }, [usersData]);

  useEffect(() => {
    Object.entries(parentsData || {}).forEach(([recordKey, parentRecord]) => {
      cacheParentRecord(recordKey, parentRecord);
    });
  }, [parentsData]);

  useEffect(() => {
    Object.entries(teachersData || {}).forEach(([recordKey, teacherRecord]) => {
      cacheTeacherRecord(recordKey, teacherRecord);
    });
  }, [teachersData]);

  useEffect(() => {
    if (!teacherInfo?.userId || !rtdbBase) {
      setTeacherCourseContext(EMPTY_TEACHER_COURSE_CONTEXT);
      setTeacherCourseContextReady(false);
      return;
    }

    let cancelled = false;

    const loadTeacherCourseContext = async () => {
      setTeacherCourseContextReady(false);
      const nextContext = await getTeacherCourseContext({ teacher: teacherInfo, rtdbBase });
      if (cancelled) return;
      setTeacherCourseContext(nextContext || EMPTY_TEACHER_COURSE_CONTEXT);
      setTeacherCourseContextReady(true);
    };

    loadTeacherCourseContext();

    return () => {
      cancelled = true;
    };
  }, [teacherInfo, rtdbBase]);

  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login"); // redirect if not logged in
      return;
    }
    const bootstrapTeacher = async () => {
      let nextTeacher = storedTeacher;

      if (!storedTeacher.schoolCode) {
        const context = await getTeacherContext({
          teacherId: storedTeacher.teacherId || storedTeacher.teacherKey || storedTeacher.username,
          userId: storedTeacher.userId,
        });

        if (context.success && context.teacher) {
          nextTeacher = { ...storedTeacher, ...context.teacher };
          localStorage.setItem("teacher", JSON.stringify(nextTeacher));
        }
      }

      setTeacher(nextTeacher);
      fetchConversations(nextTeacher);
    };

    bootstrapTeacher();
  }, [navigate]);

  // ---------------- LOAD TEACHER INFO ----------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    const bootstrapTeacherInfo = async () => {
      if (storedTeacher.schoolCode) {
        setTeacherInfo(storedTeacher);
        return;
      }

      const context = await getTeacherContext({
        teacherId: storedTeacher.teacherId || storedTeacher.teacherKey || storedTeacher.username,
        userId: storedTeacher.userId,
      });

      if (context.success && context.teacher) {
        const nextTeacher = { ...storedTeacher, ...context.teacher };
        localStorage.setItem("teacher", JSON.stringify(nextTeacher));
        setTeacherInfo(nextTeacher);
        return;
      }

      setTeacherInfo(storedTeacher);
      setError("Teacher school context is missing. Log in again if students stay empty.");
    };

    bootstrapTeacherInfo();
  }, [navigate]);

  // ---------------- FETCH NOTIFICATIONS (ENRICHED WITH ADMIN INFO) ----------------
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${API_BASE}/get_posts`);
        let postsData = res.data || [];
        if (!Array.isArray(postsData) && typeof postsData === "object") {
          postsData = Object.values(postsData);
        }

        // Get teacher from localStorage so we know who's seen what
        const teacher = JSON.parse(localStorage.getItem("teacher"));
        const seenPosts = getSeenPosts(teacher?.userId);

        const latest = postsData
          .slice()
          .sort((a, b) => {
            const ta = a.time ? new Date(a.time).getTime() : 0;
            const tb = b.time ? new Date(b.time).getTime() : 0;
            return tb - ta;
          })
          .filter((post) => post.postId && !seenPosts.includes(post.postId))
          .slice(0, 5)
          .map((post) => ({
            id: post.postId,
            title: post.message?.substring(0, 50) || "Untitled post",
            adminName: post.adminName || "Admin",
            adminProfile: post.adminProfile || "/default-profile.png",
          }));

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
    return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
  }

  function saveSeenPost(teacherId, postId) {
    const seen = getSeenPosts(teacherId);
    if (!seen.includes(postId)) {
      localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seen, postId]));
    }
  }

  // ---------------- MESSENGER FUNCTIONS (same behavior as Dashboard) ----------------
  const fetchConversations = async (currentTeacher = teacher) => {
    try {
      const t = currentTeacher || JSON.parse(localStorage.getItem("teacher"));
      if (!t || !t.userId || !rtdbBase) {
        setConversations([]);
        return;
      }

      const cacheKey = buildStudentConversationsSessionKey(resolvedSchoolCode || t.schoolCode, t.userId);
      const cachedConversations = readSessionResource(cacheKey, {
        ttlMs: STUDENT_CONVERSATIONS_SESSION_TTL_MS,
      });
      if (Array.isArray(cachedConversations)) {
        setConversations(cachedConversations);
        return;
      }

      const convs = await fetchTeacherConversationSummaries({
        rtdbBase,
        schoolCode: resolvedSchoolCode || t.schoolCode,
        teacherUserId: t.userId,
        unreadOnly: true,
      });

      setConversations(convs);
      writeSessionResource(cacheKey, convs);
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

    // navigate to AllChat, pass full contact and chatId
    navigate("/all-chat", { state: { contact, chatId, tab: "student" } });

    // clear unread in RTDB for this teacher
    try {
      await axios.put(`${rtdbBase}/Chats/${chatId}/unread/${teacher.userId}.json`, null);
      clearCachedChatSummary({
        rtdbBase,
        chatId,
        teacherUserId: teacher.userId,
      });
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }

    // remove from UI
    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };

  const totalUnreadMessages = conversations.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);

  // ---------------- FETCH STUDENTS ----------------
  // FETCH STUDENTS + USERS + COURSES + ASSIGNMENTS + TEACHERS
  useEffect(() => {
    if (!teacherInfo?.userId || !resolvedSchoolCode || !rtdbBase || !teacherCourseContextReady) return;
    let cancelled = false;

    const fetchStudents = async () => {
      setLoading(true);
      try {
        const courseContext = teacherCourseContext || EMPTY_TEACHER_COURSE_CONTEXT;

        const allowedGradeSections = new Set(
          (courseContext?.courses || [])
            .map((course) => buildGradeSectionKey(course?.grade, course?.section || course?.secation))
            .filter((value) => value !== "|")
        );

        (courseContext?.courseIds || []).forEach((courseId) => {
          const raw = String(courseId || "").trim();
          const body = raw.startsWith("course_") ? raw.slice("course_".length) : raw;
          const last = body.split("_").filter(Boolean).at(-1) || "";
          const match = last.match(/^(\d+)([A-Za-z].*)$/);
          if (!match) return;
          const grade = String(match[1] || "").trim();
          const section = String(match[2] || "").trim().toUpperCase();
          if (grade && section) {
            allowedGradeSections.add(`${grade}|${section}`);
          }
        });

        if (!allowedGradeSections.size) {
          if (!cancelled) {
            setStudents([]);
            setAssignedGradeSections([]);
            setError("No teacher assignment found");
          }
          return;
        }

        const allowedGrades = [...new Set(
          [...allowedGradeSections]
            .map((gradeSectionKey) => String(gradeSectionKey || "").split("|")[0])
            .filter(Boolean)
        )];

        const studentSnapshots = await Promise.all(
          allowedGrades.flatMap((gradeValue) => [
            get(
              dbQuery(
                dbRef(db, scopedStudentPath("Students")),
                orderByChild("grade"),
                equalTo(gradeValue)
              )
            ).catch(() => null),
            get(
              dbQuery(
                dbRef(db, scopedStudentPath("Students")),
                orderByChild("basicStudentInformation/grade"),
                equalTo(gradeValue)
              )
            ).catch(() => null),
          ])
        );

        const allStudentsNode = {};
        studentSnapshots.forEach((snapshot) => {
          if (!snapshot?.exists()) return;
          Object.assign(allStudentsNode, snapshot.val() || {});
        });

        if (!Object.keys(allStudentsNode).length) {
          const fallbackStudentsSnapshot = await get(dbRef(db, scopedStudentPath("Students"))).catch(() => null);
          Object.assign(allStudentsNode, fallbackStudentsSnapshot?.exists() ? fallbackStudentsSnapshot.val() || {} : {});
        }

        const filteredStudentEntries = Object.entries(allStudentsNode)
          .filter(([, studentRecord]) => {
            const studentUserId = getStudentUserId(studentRecord);
            if (!studentUserId) return false;
            if (!isActiveRecord(studentRecord)) return false;

            const key = buildGradeSectionKey(
              studentRecord.grade || studentRecord?.basicStudentInformation?.grade,
              studentRecord.section || studentRecord?.basicStudentInformation?.section
            );

            return allowedGradeSections.has(key);
          });

        const usersObj = await loadUsersByIds(filteredStudentEntries.map(([, studentRecord]) => getStudentUserId(studentRecord)));
        const findUser = (userId) => findUserByUserId({ ...(usersData || {}), ...(usersObj || {}) }, userId);

        const studentsArr = filteredStudentEntries
          .map(([studentId, s]) => {
            const studentUserId = getStudentUserId(s);
            const user = findUser(studentUserId);

            const normalizedStudentGrade = normalizeGrade(s.grade || s.basicStudentInformation?.grade);
            const normalizedStudentSection = normalizeSection(s.section || s.basicStudentInformation?.section);

            const parentName =
              s.parentName ||
              s.parent?.name ||
              user?.parentName ||
              s.rawParentName ||
              null;

            const parentPhone =
              s.parentPhone ||
              s.parent?.phone ||
              user?.parentPhone ||
              s.rawParentPhone ||
              null;

            const rawDob = user?.dob || user?.birthDate || s.dob || s.birthDate || null;
            const age = computeAge(rawDob);

            return {
              ...s,
              studentId: s.studentId || studentId,
              userId: studentUserId,
              name: user?.name || s.name || s?.basicStudentInformation?.name || "Unknown",
              email: user?.email || s.email || "",
              profileImage: resolveProfileImage(
                user?.profileImage,
                user?.profile,
                user?.avatar,
                s?.profileImage,
                s?.basicStudentInformation?.studentPhoto,
                s?.studentPhoto
              ),
              phone: user?.phone || s.phone || "",
              gender: user?.gender || s.gender || "",
              grade: normalizedStudentGrade,
              section: normalizedStudentSection,
              dob: rawDob,
              age,
              parentName: parentName || null,
              parentPhone: parentPhone || null,
              raw: s,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        const assignedPairs = [...allowedGradeSections]
          .map((value) => {
            const [grade, section] = String(value || "").split("|");
            return {
              grade: String(grade || "").trim(),
              section: String(section || "").trim().toUpperCase(),
            };
          })
          .filter((item) => item.grade && item.section)
          .sort((a, b) => {
            const gradeDiff = Number(a.grade) - Number(b.grade);
            if (!Number.isNaN(gradeDiff) && gradeDiff !== 0) return gradeDiff;
            if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
            return a.section.localeCompare(b.section);
          });

        if (!cancelled) {
          setStudents(studentsArr);
          setAssignedGradeSections(assignedPairs);
          setError(assignedPairs.length ? "" : "No teacher assignment found");
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Failed to load students");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStudents();
    return () => (cancelled = true);
  }, [teacherInfo, resolvedSchoolCode, rtdbBase, teacherCourseContext, teacherCourseContextReady]);

  // When user picks a student, set immediate fallback details (so UI won't crash),
  // then fetch Users node and resolve authoritative details (phone/gender/email/parent/dob->age).
  useEffect(() => {
    if (!selectedStudent) {
      setSelectedStudentDetails(null);
      return;
    }

    const fallbackParentInfo = resolveStudentParentInfo({
      student: selectedStudent,
      usersObj: usersData || {},
    });

    // immediate fallback derived from selectedStudent to avoid UI errors
    const fallback = {
      fullName: selectedStudent.name || "—",
      phone: selectedStudent.phone || selectedStudent.raw?.phone || "—",
      gender: selectedStudent.gender || selectedStudent.raw?.gender || "—",
      email: selectedStudent.email || "—",
      grade: selectedStudent.grade || "—",
      section: selectedStudent.section || "—",
      parentName:
        fallbackParentInfo?.parentName ||
        selectedStudent.parentName ||
        selectedStudent.raw?.parentName ||
        "—",
      parentPhone:
        fallbackParentInfo?.parentPhone ||
        selectedStudent.parentPhone ||
        selectedStudent.raw?.parentPhone ||
        "—",
      parentId: fallbackParentInfo?.parentId || selectedStudent.parentId || null,
      parentUserId: fallbackParentInfo?.parentUserId || selectedStudent.parentUserId || null,
      parentProfileImage:
        fallbackParentInfo?.parentProfileImage || selectedStudent.parentProfileImage || "/default-profile.png",
      dob: selectedStudent.dob || selectedStudent.raw?.dob || "—",
      age: selectedStudent.age ?? computeAge(selectedStudent.dob || selectedStudent.raw?.dob) ?? "—",
      profileImage: resolveProfileImage(
        selectedStudent.profileImage,
        selectedStudent.raw?.profileImage,
        selectedStudent.raw?.basicStudentInformation?.studentPhoto,
        selectedStudent.raw?.studentPhoto
      ),
    };

    setSelectedStudentDetails(fallback);

    let cancelled = false;
    const loadDetails = async () => {
      try {
        let usersObj = usersData || {};
        if (!findUserByIdentifiers(usersObj, selectedStudent.userId)) {
          const fetchedUsers = await loadUsersByIds([selectedStudent.userId]);
          usersObj = {
            ...(usersObj || {}),
            ...(fetchedUsers || {}),
          };
        }

        const userRec = findUserByIdentifiers(usersObj, selectedStudent.userId) || {};
        const parentInfo = resolveStudentParentInfo({
          student: selectedStudent,
          usersObj,
        });

        const phone = userRec?.phone || selectedStudent.phone || selectedStudent.raw?.phone || "—";
        const gender = userRec?.gender || selectedStudent.gender || selectedStudent.raw?.gender || "—";
        const email = userRec?.email || selectedStudent.email || "—";
        const dob = userRec?.dob || userRec?.birthDate || selectedStudent.dob || selectedStudent.raw?.dob || null;
        const age = computeAge(dob) ?? selectedStudent.age ?? "—";

        const details = {
          fullName: userRec?.name || selectedStudent.name || "—",
          phone,
          gender,
          email,
          grade: selectedStudent.grade || "—",
          section: selectedStudent.section || "—",
          parentId: parentInfo?.parentId || null,
          parentName:
            parentInfo?.parentName ||
            selectedStudent.raw?.parentName ||
            selectedStudent.parentName ||
            "—",
          parentPhone:
            parentInfo?.parentPhone ||
            selectedStudent.raw?.parentPhone ||
            selectedStudent.parentPhone ||
            "—",
          parentUserId: parentInfo?.parentUserId || null,
          parentProfileImage:
            parentInfo?.parentProfileImage ||
            selectedStudent?.raw?.parentProfileImage ||
            selectedStudent?.parentProfileImage ||
            "/default-profile.png",
          dob: dob || "—",
          age,
          profileImage: resolveProfileImage(
            userRec?.profileImage,
            userRec?.profile,
            userRec?.avatar,
            selectedStudent.profileImage,
            selectedStudent.raw?.profileImage,
            selectedStudent.raw?.basicStudentInformation?.studentPhoto,
            selectedStudent.raw?.studentPhoto
          ),
          userRec,
          parentRec: parentInfo?.parentRec || null,
          parentUserRec: parentInfo?.parentUserRec || null,
        };

        if (!cancelled) setSelectedStudentDetails(details);
      } catch (err) {
        console.error("Failed to derive student details", err);
        // keep fallback already set
      }
    };

    loadDetails();
    return () => { cancelled = true; };
  }, [selectedStudent, usersData, rtdbBase]);

  // Ensure parent info is resolved from Parents node if not already present
  useEffect(() => {
    if (!selectedStudent) return;
    let cancelled = false;

    const resolveParent = async () => {
      try {
        let usersObj = usersData || {};
        if (!findUserByIdentifiers(usersObj, selectedStudent.userId)) {
          const fetchedStudentUsers = await loadUsersByIds([selectedStudent.userId]);
          usersObj = {
            ...(usersObj || {}),
            ...(fetchedStudentUsers || {}),
          };
        }

        const parentsObj = await loadParentsForStudent(selectedStudent, usersObj);
        const parentUserIds = Object.values(parentsObj || {})
          .map((parentRecord) => normalizeIdentifier(parentRecord?.userId))
          .filter(Boolean);

        if (parentUserIds.length) {
          const fetchedParentUsers = await loadUsersByIds(parentUserIds);
          usersObj = {
            ...(usersObj || {}),
            ...(fetchedParentUsers || {}),
          };
        }

        const parentInfo = resolveStudentParentInfo({
          student: selectedStudent,
          usersObj,
          parentsObj,
        });

        if (!cancelled) {
          setSelectedStudentDetails((prev) => ({
            ...(prev || {}),
            parentId: parentInfo?.parentId || prev?.parentId || null,
            parentName: parentInfo?.parentName || prev?.parentName || "—",
            parentPhone: parentInfo?.parentPhone || prev?.parentPhone || "—",
            parentUserId: parentInfo?.parentUserId || prev?.parentUserId || null,
            parentProfileImage: resolveProfileImage(
              parentInfo?.parentProfileImage,
              prev?.parentProfileImage
            ),
            parentRec: parentInfo?.parentRec || prev?.parentRec || null,
            parentUserRec: parentInfo?.parentUserRec || prev?.parentUserRec || null,
          }));
        }
      } catch (err) {
        console.error("Error resolving parent info:", err);
      }
    };

    resolveParent();
    return () => (cancelled = true);
  }, [selectedStudent, rtdbBase, usersData]);

  useEffect(() => {
    const chatContainer = document.querySelector(".chat-messages");
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [popupMessages]);

  useEffect(() => {
    if (selectedGrade === "All") {
      setSections([]);
      setSelectedSection("All");
    } else {
      const gradeSections = [
        ...new Set(
          students.filter((s) => s.grade === selectedGrade).map((s) => s.section)
        ),
      ];
      setSections(gradeSections);

      if (!gradeSections.length) {
        setSelectedSection("All");
      } else if (selectedSection !== "All" && !gradeSections.includes(selectedSection)) {
        setSelectedSection(gradeSections[0]);
      }
    }
  }, [selectedGrade, students, selectedSection]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredStudents = students.filter((s) => {
    if (selectedGrade !== "All" && s.grade !== selectedGrade) return false;
    if (selectedSection !== "All" && s.section !== selectedSection) return false;
    if (!normalizedSearch) return true;

    const haystack = [
      s.name,
      s.studentId,
      s.userId,
      s.email,
      s.grade,
      s.section,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });

  const grades = [...new Set(students.map((s) => s.grade))].sort();
  const assignedGrades = [...new Set(assignedGradeSections.map((item) => item.grade))].sort((leftGrade, rightGrade) => {
    const numericDiff = Number(leftGrade) - Number(rightGrade);
    if (!Number.isNaN(numericDiff) && numericDiff !== 0) return numericDiff;
    return String(leftGrade).localeCompare(String(rightGrade));
  });
  const assignedSectionsForSelectedGrade =
    selectedGrade === "All"
      ? []
      : [...new Set(
          assignedGradeSections
            .filter((item) => String(item.grade) === String(selectedGrade))
            .map((item) => item.section)
        )].sort();
  const selectedFilterLabel =
    selectedGrade === "All"
      ? "All grades"
      : selectedSection === "All"
      ? `Grade ${selectedGrade} (select section)`
      : `Grade ${selectedGrade} - Section ${selectedSection}`;



// Fetch and normalize attendance for selectedStudent
useEffect(() => {
  if (
    (!selectedStudent?.studentId && !selectedStudent?.userId) ||
    !rtdbBase ||
    !teacherInfo?.userId ||
    !teacherCourseContextReady
  ) {
    setAttendanceRecords([]);
    return;
  }

  let cancelled = false;
  const fetchAttendance = async () => {
    setAttendanceLoading(true);
    try {
      const selectedGradeKey = normalizeGrade(selectedStudent?.grade || selectedStudent?.raw?.basicStudentInformation?.grade);
      const selectedSectionKey = normalizeSection(selectedStudent?.section || selectedStudent?.raw?.basicStudentInformation?.section);
      const relevantCourses = (teacherCourseContext?.courses || []).filter((course) => {
        const courseGrade = normalizeGrade(course?.grade);
        const courseSection = normalizeSection(course?.section || course?.secation);

        if (selectedGradeKey && courseGrade && selectedGradeKey !== courseGrade) return false;
        if (selectedSectionKey && courseSection && selectedSectionKey !== courseSection) return false;
        return true;
      });

      const relevantCourseIds = [...new Set(
        (relevantCourses.length ? relevantCourses : teacherCourseContext?.courses || [])
          .map((course) => normalizeIdentifier(course?.id || course?.courseId))
          .filter(Boolean)
      )];

      if (!relevantCourseIds.length) {
        if (!cancelled) setAttendanceRecords([]);
        return;
      }

      const assignmentsObj = teacherCourseContext?.assignmentsByCourseId || {};
      const teacherIds = relevantCourseIds
        .map((courseId) => assignmentsObj?.[courseId]?.teacherId || assignmentsObj?.[courseId]?.teacherRecordKey)
        .map(normalizeIdentifier)
        .filter(Boolean);

      const [raw, teachersObj] = await Promise.all([
        loadAttendanceByCourseIds(relevantCourseIds),
        loadTeachersByIds(teacherIds),
      ]);

      const teacherUserIds = Object.values(teachersObj || {})
        .map((teacherRecord) => normalizeIdentifier(teacherRecord?.userId))
        .filter(Boolean);
      const fetchedTeacherUsers = teacherUserIds.length ? await loadUsersByIds(teacherUserIds) : {};
      const usersObj = {
        ...(usersData || {}),
        ...(fetchedTeacherUsers || {}),
      };

      // Normalized list for this student
      const normalized = [];

      // Attendance structure (common patterns):
      // Attendance: { courseId: { dateISO: { studentId: { status, teacherName, subject } } } }
      // Also sometimes students stored as { studentId: "present" } or { status: "present" }
      Object.entries(raw).forEach(([courseId, dates]) => {
        if (!dates || typeof dates !== "object") return;
        Object.entries(dates).forEach(([dateKey, studentsMap]) => {
          if (!studentsMap || typeof studentsMap !== "object") return;

          // studentsMap might be { studentId: "present", ... } or { studentId: { status: "...", teacherName: "..."} }
          const studentEntry = studentsMap[selectedStudent.studentId] ?? studentsMap[selectedStudent.userId];

          // If not found with those keys, there might be a nested structure: { students: { studentId: {...} } }
          let record = studentEntry;
          if (!record && studentsMap.students) {
            record = studentsMap.students[selectedStudent.studentId] ?? studentsMap.students[selectedStudent.userId];
          }

          if (!record) {
            // also check each student entry for keys like userId inside object
            const found = Object.entries(studentsMap).find(([k, v]) => {
              if (!v || typeof v !== "object") return false;
              if (v.userId && (String(v.userId) === String(selectedStudent.userId) || String(v.userId) === String(selectedStudent.studentId))) return true;
              return false;
            });
            if (found) record = found[1];
          }

          if (!record) return;

          // Normalize status / teacherName / subject
          let status = "absent";
          let teacherName = "";
          let subject = courseId;

          if (typeof record === "string") {
            status = record;
          } else if (typeof record === "object") {
            status = record.status || record.attendance_status || Object.values(record)[0] || "present";

            // Resolve teacher name: prefer explicit teacherName, then teacherId -> Teachers -> Users, then teacherUserId/userId fields
            teacherName = record.teacherName || record.teacher || record.tutor || "";

            if (!teacherName) {
              // record.teacherId might be a Teachers push key
              const teacherId = record.teacherId || record.teacherKey || null;
              if (teacherId && teachersObj[teacherId]) {
                const tRec = teachersObj[teacherId];
                // try to get user linked to teacher
                if (tRec.userId) {
                  const userRec = Object.values(usersObj).find((u) => String(u?.userId) === String(tRec.userId));
                  teacherName = userRec?.name || tRec.name || teacherName;
                } else {
                  teacherName = tRec.name || teacherName;
                }
              }
            }

            if (!teacherName) {
              // sometimes record may store teacherUserId / teacherUser
              const teacherUserId = record.teacherUserId || record.teacherUser || record.takenBy || null;
              if (teacherUserId) {
                const userRec = Object.values(usersObj).find((u) => String(u?.userId) === String(teacherUserId));
                if (userRec) teacherName = userRec.name || teacherName;
              }
            }

            subject = record.subject || courseId;
          }

          // If teacherName is still missing, try to infer from resolved teacher-course assignments.
          if (!teacherName) {
            const assignment = assignmentsObj[courseId];
            const assignedTeacherKey = assignment?.teacherId || assignment?.teacherRecordKey;
            if (assignedTeacherKey) {
              const tRec = teachersObj[assignedTeacherKey];
              if (tRec) {
                if (tRec.userId) {
                  const userRec = Object.values(usersObj).find((u) => String(u?.userId) === String(tRec.userId));
                  teacherName = userRec?.name || tRec.name || teacherName;
                } else {
                  teacherName = tRec.name || teacherName;
                }
              }
            }
          }

          // store normalized record
          normalized.push({
            courseId,
            date: dateKey,
            status: String(status).toLowerCase(),
            teacherName,
            subject,
          });
        });
      });

      if (!cancelled) {
        // sort newest -> oldest
        normalized.sort((a, b) => new Date(b.date) - new Date(a.date));
        setAttendanceRecords(normalized);
      }
    } catch (err) {
      console.error("Attendance fetch error:", err);
      if (!cancelled) setAttendanceRecords([]);
    } finally {
      if (!cancelled) setAttendanceLoading(false);
    }
  };

  fetchAttendance();
  return () => {
    cancelled = true;
  };
}, [selectedStudent, rtdbBase, teacherInfo, teacherCourseContext, teacherCourseContextReady, usersData]);

// Derived data used by the UI (attendanceBySubject, getProgress, etc.)
const attendanceData = React.useMemo(() => {
  // attendanceRecords already only contains entries for selectedStudent
  return attendanceRecords.map((r) => ({
    date: r.date,
    courseId: r.courseId,
    teacherName: r.teacherName || "",
    status: r.status || "absent",
  }));
}, [attendanceRecords]);

const attendanceBySubject = React.useMemo(() => {
  if (!attendanceData || attendanceData.length === 0) return {};
  return attendanceData.reduce((acc, rec) => {
    const key = rec.courseId || rec.subject || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(rec);
    return acc;
  }, {});
}, [attendanceData]);

const getProgress = (records) => {
  if (!records || records.length === 0) return 0;
  const presentCount = records.filter((r) => r.status === "present" || r.status === "late").length;
  return Math.round((presentCount / records.length) * 100);
};

const getLatestRecordDate = (records = []) => {
  return records.reduce((latest, record) => {
    const recordDate = new Date(record?.date);
    if (Number.isNaN(recordDate.getTime())) return latest;
    if (!latest || recordDate > latest) return recordDate;
    return latest;
  }, null);
};

// Expose getWeekNumber for the UI usage (used when computing weekRecords)
const _getWeekNumber = getWeekNumber


// inside StudentsPage component (above the JSX that uses it)
const toggleExpand = (key) => {
  setExpandedCards((prev) => ({
    ...prev,
    [key]: !prev[key],
  }));
};


  const handleLogout = () => {
    localStorage.removeItem("teacher"); // or "user", depending on your auth
    navigate("/login");
  };

  // ---------------- FETCH PERFORMANCE (FIXED)
  useEffect(() => {
    // we only need to fetch marks when a student is selected
    if (!selectedStudent || !resolvedSchoolCode) {
      setStudentMarksFlattened({});
      return;
    }

    const fetchMarksForStudent = async () => {
      setMarksLoading(true);
      try {
        const scopedSnapshot = await get(dbRef(db, schoolPath("ClassMarks", resolvedSchoolCode)));
        const legacySnapshot = scopedSnapshot.exists() ? null : await get(dbRef(db, "ClassMarks"));
        const snapshot = scopedSnapshot.exists() ? scopedSnapshot : legacySnapshot;

        if (!snapshot || !snapshot.exists()) {
          setStudentMarksFlattened({});
          return;
        }

        const data = snapshot.val(); // object where keys are course_* and values are student maps
        const flattened = {};

        const candidates = new Set(
          [
            selectedStudent.id,
            selectedStudent.studentId,
            selectedStudent.userId,
            selectedStudent.userId ? `student_${selectedStudent.userId}` : null,
          ].filter(Boolean)
        );

        Object.entries(data).forEach(([courseKey, studentsMap]) => {
          if (!studentsMap || typeof studentsMap !== "object") return;

          const foundEntry = Object.entries(studentsMap).find(([studentKey, studentData]) => {
            if (candidates.has(studentKey)) return true;
            if (studentData && typeof studentData === "object") {
              if (studentData.userId && candidates.has(studentData.userId)) return true;
              if (studentData.studentId && candidates.has(studentData.studentId)) return true;
            }
            return false;
          });

          if (foundEntry) {
            const [, studentData] = foundEntry;
            flattened[courseKey] = studentData;
          }
        });

        setStudentMarksFlattened(flattened);
      } catch (err) {
        console.error("Failed to fetch marks:", err);
        setStudentMarksFlattened({});
      } finally {
        setMarksLoading(false);
      }
    };

    fetchMarksForStudent();
  }, [selectedStudent, resolvedSchoolCode]);

  const availableSemesters = useMemo(() => {
    const semesters = new Set();

    Object.values(studentMarksFlattened || {}).forEach((studentCourseData) => {
      if (!studentCourseData || typeof studentCourseData !== "object") return;
      Object.keys(studentCourseData).forEach((key) => {
        if (/^semester\d+$/i.test(String(key || ""))) {
          semesters.add(String(key));
        }
      });
    });

    return [...semesters].sort((leftSemester, rightSemester) => {
      const leftNumber = parseInt(String(leftSemester).replace(/\D+/g, ""), 10) || 0;
      const rightNumber = parseInt(String(rightSemester).replace(/\D+/g, ""), 10) || 0;
      return leftNumber - rightNumber;
    });
  }, [studentMarksFlattened]);

  useEffect(() => {
    if (!availableSemesters.length) return;
    if (!availableSemesters.includes(activeSemester)) {
      setActiveSemester(availableSemesters[0]);
    }
  }, [activeSemester, availableSemesters]);

  useEffect(() => {
    setActiveQuarterViews({});
  }, [selectedStudent?.userId]);

  const semesterTabs = availableSemesters.length
    ? availableSemesters
    : ["semester1", "semester2"];

  const statusColor = (status) => (status === "present" ? "#34a853" : status === "absent" ? "#ea4335" : "#fbbc05");

  // ---------------- teacher note ----------------
  useEffect(() => {
    if (!selectedStudent?.userId) return;

    async function fetchTeacherNotes() {
      try {
        const res = await axios.get(
          `${rtdbBase}/StudentNotes/${selectedStudent?.userId}.json`
        );

        if (!res.data) {
          setTeacherNotes([]);
          return;
        }

        const notesArr = Object.entries(res.data).map(([id, note]) => ({
          id,
          ...note,
        }));

        // newest first
        notesArr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setTeacherNotes(notesArr);
      } catch (err) {
        console.error("Failed to fetch teacher notes", err);
        setTeacherNotes([]);
      }
    }

    fetchTeacherNotes();
  }, [selectedStudent]);

  const saveTeacherNote = async () => {
    if (!newTeacherNote.trim() || !teacherInfo || !selectedStudent) return;

    setSavingNote(true);

    const noteData = {
      teacherId: teacherInfo.userId,
      teacherName: teacherInfo.name,
      note: newTeacherNote.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      await axios.post(
        `${rtdbBase}/StudentNotes/${selectedStudent?.userId}.json`,
        noteData
      );

      setTeacherNotes((prev) => [noteData, ...prev]);
      setNewTeacherNote("");
    } catch (err) {
      console.error("Error saving note", err);
    } finally {
      setSavingNote(false);
    }
  };

  // Scroll chat to bottom when messages change
  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  useEffect(() => {
    if (selectedStudent || !chatOpen) return;
    closeQuickChat();
  }, [selectedStudent, chatOpen]);

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
  }, [messages]);

  // Fetch messages for the selected student
  useEffect(() => {
    if (!chatOpen || !teacherUserId || !quickChatTarget?.userId) {
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
      dbRef(db, scopedStudentPath(`Chats/${chatKey}/messages`)),
      orderByChild("timeStamp"),
      limitToLast(QUICK_CHAT_HISTORY_LIMIT)
    );

    setQuickChatLoading(true);

    const unsubscribe = onValue(
      messagesRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        const msgs = Object.entries(data)
          .map(([id, m]) => ({
            id,
            messageId: id,
            ...m,
            isTeacher: String(m?.senderId || "") === String(teacherUserId),
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
  }, [chatOpen, teacherUserId, quickChatTarget?.userId, resolvedSchoolCode, teacherSchoolCode]);

  const loadOlderMessages = async () => {
    if (
      quickChatLoading ||
      quickChatLoadingOlder ||
      !chatOpen ||
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
        dbRef(db, scopedStudentPath(`Chats/${chatId}/messages`)),
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
        .sort((leftMessage, rightMessage) => Number(leftMessage?.timeStamp || 0) - Number(rightMessage?.timeStamp || 0));

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

  // Mark messages as seen when chat popup is open and there are unseen messages for this teacher
  useEffect(() => {
    if (!chatOpen || !quickChatTarget?.userId || !teacherUserId) return;
    if (!messages || messages.length === 0) return;

    const unseen = messages.filter(
      (m) => String(m?.receiverId || "") === String(teacherUserId) && !m?.seen
    );
    if (unseen.length === 0) return;

    const chatId = getChatId(teacherUserId, quickChatTarget.userId);
    const ts = Date.now();

    const payload = {
      [`unread/${teacherUserId}`]: 0,
      "lastMessage/seen": true,
      "lastMessage/seenAt": ts,
    };
    unseen.forEach((m) => {
      payload[`messages/${m.id}/seen`] = true;
      payload[`messages/${m.id}/seenAt`] = ts;
    });

    update(dbRef(db, scopedStudentPath(`Chats/${chatId}`)), payload)
      .catch((err) => console.error("Failed to mark messages seen:", err));

  }, [chatOpen, messages, quickChatTarget?.userId, teacherUserId, resolvedSchoolCode, teacherSchoolCode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
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
      await push(dbRef(db, scopedStudentPath(`Chats/${chatId}/messages`)), message);

      await update(dbRef(db, scopedStudentPath(`Chats/${chatId}`)), {
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
        dbRef(db, scopedStudentPath(`Chats/${chatId}/unread/${receiverId}`)),
        (current) => (Number(current) || 0) + 1
      );
    } catch (err) {
      console.error("Failed to send quick chat message:", err);
    }
  };

  const handleOpenParentChat = async () => {
    let parentTarget = selectedStudentDetails;

    if (!selectedStudent) {
      alert("Please select a student first.");
      return;
    }

    if (!String(parentTarget?.parentUserId || "").trim()) {
      try {
        let usersObj = usersData || {};
        if (!findUserByIdentifiers(usersObj, selectedStudent.userId)) {
          const fetchedStudentUsers = await loadUsersByIds([selectedStudent.userId]);
          usersObj = {
            ...(usersObj || {}),
            ...(fetchedStudentUsers || {}),
          };
        }

        const parentsObj = await loadParentsForStudent(selectedStudent, usersObj);
        const parentUserIds = Object.values(parentsObj || {})
          .map((parentRecord) => normalizeIdentifier(parentRecord?.userId))
          .filter(Boolean);

        if (parentUserIds.length) {
          const fetchedParentUsers = await loadUsersByIds(parentUserIds);
          usersObj = {
            ...(usersObj || {}),
            ...(fetchedParentUsers || {}),
          };
        }

        const parentInfo = resolveStudentParentInfo({
          student: selectedStudent,
          usersObj,
          parentsObj,
        });

        if (parentInfo) {
          parentTarget = {
            ...(parentTarget || {}),
            ...parentInfo,
          };

          setSelectedStudentDetails((prev) => ({
            ...(prev || {}),
            parentId: parentInfo.parentId || prev?.parentId || null,
            parentName: parentInfo.parentName || prev?.parentName || "—",
            parentPhone: parentInfo.parentPhone || prev?.parentPhone || "—",
            parentUserId: parentInfo.parentUserId || prev?.parentUserId || null,
            parentProfileImage: parentInfo.parentProfileImage || prev?.parentProfileImage || "/default-profile.png",
            parentRec: parentInfo.parentRec || prev?.parentRec || null,
            parentUserRec: parentInfo.parentUserRec || prev?.parentUserRec || null,
          }));
        }
      } catch (error) {
        console.error("Failed to resolve parent chat target:", error);
      }
    }

    const parentUserId = String(parentTarget?.parentUserId || "").trim();
    if (!parentUserId) {
      alert("No parent found for this student.");
      return;
    }

    const parentName = parentTarget?.parentName || "Parent";
    const parentProfileImage = resolveProfileImage(
      parentTarget?.parentProfileImage,
      parentTarget?.parentRec?.profileImage,
      parentTarget?.parentRec?.profile,
      parentTarget?.parentUserRec?.profileImage,
      parentTarget?.parentUserRec?.profile,
      "/default-profile.png"
    );

    openQuickChat(
      {
        userId: parentUserId,
        name: parentName,
        profileImage: parentProfileImage,
        type: "parent",
      },
      "parent"
    );
  };

const [isPortrait, setIsPortrait] = React.useState(
  window.innerWidth < window.innerHeight
);

React.useEffect(() => {
  const handleResize = () => {
    setIsPortrait(window.innerWidth < window.innerHeight);
  };

  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);




  useEffect(() => {
    const chatContainer = document.querySelector(".chat-messages");
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [popupMessages]);

  const InfoRow = ({ label, value }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        padding: "12px 14px",
        borderRadius: "14px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
        transition: "all 0.25s ease",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          color: "#64748b",
          fontWeight: "600",
          marginBottom: "4px",
          textTransform: "uppercase",
          letterSpacing: "0.6px",
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontSize: "15px",
          color: "#0f172a",
          fontWeight: "700",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );

  const chipStyle = (active) => ({
    padding: "6px 12px",
    borderRadius: "999px",
    background: active ? "var(--accent-strong)" : "var(--surface-accent)",
    color: active ? "#fff" : "var(--accent-strong)",
    cursor: "pointer",
    border: active ? "1px solid var(--accent-strong)" : "1px solid var(--border-strong)",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    transition: "all 0.2s ease",
  });

  const listShellWidth = isPortrait ? "100%" : "min(100%, 640px)";

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
        "--page-bg": "#ffffff",
        "--border-soft": "#e2e8f0",
        "--border-strong": "#cbd5e1",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": "#3b82f6",
        "--accent-soft": "#dbeafe",
        "--accent-strong": "#007AFB",
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
        "--shadow-soft": "0 10px 22px rgba(15, 23, 42, 0.07)",
        "--shadow-panel": "0 16px 34px rgba(15, 23, 42, 0.12)",
        "--shadow-glow": "0 0 0 2px rgba(37, 99, 235, 0.18)",
      }}
    >
      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px", height: "calc(100vh - 73px)", overflow: "hidden", background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)" }}>
        <Sidebar
          active="students"
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
        <div style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", overflowX: "hidden", display: "flex", justifyContent: "flex-start", alignItems: "flex-start", padding: "10px 20px 52px", boxSizing: "border-box" }}>
           <div
             className="student-list-card-responsive"
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
                 .student-list-card-responsive {
                   width: 100% !important;
                   max-width: 100% !important;
                   margin-left: 0 !important;
                   margin-right: 0 !important;
                 }
               }
             `}</style>
            <div className="section-header-card" style={{ marginBottom: 12 }}>
              <h2 className="section-header-card__title" style={{ fontSize: 20 }}>Students</h2>
              <div className="section-header-card__meta">
                <span>Total: {filteredStudents.length}</span>
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
                  placeholder="Search students..."
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

            {/* Grades */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  setSelectedGrade("All");
                  setSelectedSection("All");
                }}
                style={chipStyle(selectedGrade === "All" && selectedSection === "All")}
              >
                All Grades
              </button>
              {assignedGrades.map((gradeValue) => (
                <button
                  key={`grade-${gradeValue}`}
                  onClick={() => {
                    const firstSectionForGrade = assignedGradeSections
                      .filter((item) => String(item.grade) === String(gradeValue))
                      .map((item) => item.section)
                      .find(Boolean);

                    setSelectedGrade(gradeValue);
                    setSelectedSection(firstSectionForGrade || "All");
                  }}
                  style={chipStyle(selectedGrade === gradeValue)}
                >
                  {`Grade ${gradeValue}`}
                </button>
              ))}
            </div>
            {/* Sections */}
            {selectedGrade !== "All" && (
              <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                <button
                  onClick={() => setSelectedSection("All")}
                  style={{
                    ...chipStyle(selectedSection === "All"),
                    boxShadow: selectedSection === "All" ? "0 0 0 2px var(--accent-soft)" : "none",
                    transform: selectedSection === "All" ? "translateY(-1px)" : "none",
                  }}
                >
                  All Sections
                </button>
                {assignedSectionsForSelectedGrade.map(sec => (
                  <button key={sec} onClick={() => setSelectedSection(sec)} style={chipStyle(selectedSection === sec)}>Section {sec}</button>
                ))}
              </div>
            )}
            {/* Student list */}
            <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
              {selectedFilterLabel}
            </div>
            {loading && <p style={{ color: "var(--text-muted)", marginTop: 2 }}>Loading students...</p>}
            {error && <p style={{ color: "#dc2626", marginTop: 2 }}>{error}</p>}
            {!loading && !error && selectedGrade !== "All" && selectedSection === "All" && (
              <p style={{ color: "var(--text-muted)", marginTop: 2 }}>{`Showing all students in Grade ${selectedGrade}. Select a section to narrow down.`}</p>
            )}
            {!loading && !error && filteredStudents.length === 0 && <p style={{ color: "var(--text-muted)", marginTop: 2 }}>No students found.</p>}
            <style>{`
              .student-list-responsive {
                display: flex;
                flex-direction: column;
                margin-top: 12px;
                gap: 12px;
                width: 100%;
                max-width: 100%;
                margin-left: 0;
                margin-right: 0;
              }

              .student-list-responsive > div {
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
              }

              @media (max-width: 600px) {
                .student-list-responsive {
                  width: 100% !important;
                  max-width: 100% !important;
                }

                .student-list-responsive > div {
                  width: 100% !important;
                  max-width: 100% !important;
                  min-width: 0 !important;
                }
              }
            `}</style>
            <div className="student-list-responsive">
              {filteredStudents.map((s, index) => (
                <StudentItem
                  key={s.userId || s.id || index}
                  student={s}
                  number={index + 1}
                  selected={selectedStudent?.userId === s.userId}
                  onClick={() => setSelectedStudent(s)}
                />
              ))}
              <div aria-hidden="true" style={{ height: 18 }} />
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
{selectedStudent ? (
  <div
    style={{
      width: isPortrait ? "100%" : "380px",
      height: isPortrait ? "100vh" : "calc(100vh - 55px)",
      position: "fixed",
      right: 0,
      top: isPortrait ? 0 : "55px",
      background: "#ffffff",
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      overflowX: "hidden",
      boxShadow: "var(--shadow-panel)",
      borderLeft: isPortrait ? "none" : "1px solid var(--border-soft)",
      transition: "all 0.35s ease",
      fontSize: "10px",
      padding: "14px",
      paddingBottom: "130px",
    }}
  >

    {/* Close button */}
   <button
  onClick={() => setSelectedStudent(null)}
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


    {/* Student Info */}
    <div style={{ textAlign: "center", margin: "-14px -14px 12px", padding: "16px 10px", background: "linear-gradient(135deg, var(--accent-strong), var(--accent))" }}>
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
        <ProfileAvatar
          src={selectedStudentDetails?.profileImage || selectedStudent.profileImage}
          name={selectedStudent.name}
          alt={selectedStudent.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <h2 style={{ margin: 0, fontSize: 14, color: "#ffffff", fontWeight: 800 }}>{selectedStudent.name}</h2>
      <p style={{ color: "#dbeafe", margin: "4px 0", fontSize: 10 }}>{selectedStudent.studentId}</p>
      <p style={{ color: "#dbeafe", margin: "4px 0", fontSize: 10 }}>
        <strong>Grade:</strong> {selectedStudent.grade}{selectedStudent.section}
      </p>
      
    </div>

    {/* Tabs */}
    <div style={{ display: "flex", marginBottom: "10px", borderBottom: "1px solid var(--border-soft)" }}>
      {["details", "attendance", "performance"].map((tab) => (
        <button
          key={tab}
          onClick={() => setStudentTab(tab)}
          style={{
            flex: 1,
            padding: "6px",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 10,
            color: studentTab === tab ? "var(--accent-strong)" : "var(--text-muted)",
            borderBottom:
              studentTab === tab ? "3px solid var(--accent-strong)" : "3px solid transparent",
          }}
        >
          {tab.toUpperCase()}
        </button>
      ))}
    </div>

              {/* Tab Content */}
              <div>
                {/* DETAILS TAB */}
              {/* DETAILS TAB */}
{studentTab === "details" && (
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
      {/* STUDENT DETAILS */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          marginBottom: 6,
          letterSpacing: "0.1px",
          color: "var(--text-primary)",
        }}
      >
        Student Profile
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          
        }}
      >
        {[
          ["Phone", selectedStudentDetails?.phone],
          ["Gender", selectedStudentDetails?.gender],
          ["Email", selectedStudentDetails?.email],
          ["Grade", selectedStudentDetails?.grade],
          ["Section", selectedStudentDetails?.section],
          ["Age", selectedStudentDetails?.age],
          ["Birth Date", selectedStudentDetails?.dob],
          ["Parent Name", selectedStudentDetails?.parentName],
          ["Parent Phone", selectedStudentDetails?.parentPhone],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              alignItems: "center",
              justifyContent: "flex-start",
              display: "flex",
              padding: 8,
              borderRadius: 10,
              border: "1px solid var(--border-soft)",
              background: "var(--surface-panel)",
              boxShadow: "none",
              minHeight: 36,
            }}
          >
            <div style={{ width: "100%" }}
            >
              <div
              style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.4px",
                  color: "var(--text-muted)",
                textTransform: "uppercase",
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
              {value || "—"}
            </div>
            </div>
          </div>
        ))}
      </div>

      {/* ================= TEACHER NOTES (UNDER DETAILS) ================= */}
      <div style={{ marginTop: 36 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            marginBottom: 6,
            color: "var(--text-primary)",
          }}
        >
          Teacher Comments
        </div>

        {/* NOTE INPUT */}
        <div
          style={{
            background: "var(--surface-panel)",
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--border-soft)",
            boxShadow: "none",
          }}
        >
          <textarea
            value={newTeacherNote}
            onChange={(e) => setNewTeacherNote(e.target.value)}
            placeholder="Write an important comment about the student..."
            style={{
              width: "100%",
              minHeight: 30,
              border: "none",
              outline: "none",
              resize: "vertical",
              fontSize: 11,
              lineHeight: 1.4,
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button
              onClick={saveTeacherNote}
              disabled={savingNote}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "none",
                background: "var(--accent-strong)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 10,
                cursor: "pointer",
                boxShadow: "none",
              }}
            >
              {savingNote ? "Saving..." : "Add Comment"}
            </button>
          </div>
        </div>

        {/* NOTES LIST */}
        <div
          style={{
            marginTop: 10,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {teacherNotes.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 12,
                color: "var(--text-muted)",
                background: "var(--surface-panel)",
                borderRadius: 10,
                border: "1px solid var(--border-soft)",
              }}
            >
              No teacher comments yet
            </div>
          ) : (
            teacherNotes.map((n) => (
              <div key={n.id} style={{ display: "flex", gap: 12 }}>
                {/* Avatar */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--accent-strong)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 12,
                  }}
                >
                  {n.teacherName
                    ?.split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "T"}
                </div>

                {/* Note Bubble */}
                <div
                  style={{
                    flex: 1,
                    background: "var(--surface-panel)",
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid var(--border-soft)",
                    boxShadow: "none",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 11 }}>
                    {n.teacherName}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11 }}>{n.note}</div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 10,
                      color: "var(--text-muted)",
                      textAlign: "right",
                    }}
                  >
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>

 
  </div>
)}

                {/* ATTENDANCE TAB */}
             {/* ================= ATTENDANCE TAB ================= */}
{studentTab === "attendance" && selectedStudent && (
  <div
    style={{
      padding: 12,
      background: "var(--surface-panel)",
      borderRadius: 12,
      border: "1px solid var(--border-soft)",
      boxShadow: "var(--shadow-soft)",
    }}
  >
    {attendanceLoading && (
      <div style={{ marginBottom: 10, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
        Loading attendance...
      </div>
    )}
    {/* ===== VIEW SWITCH ===== */}
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 6,
        marginBottom: 10,
      }}
    >
      {["daily", "weekly", "monthly"].map((v) => (
        <button
          key={v}
          onClick={() => setAttendanceView(v)}
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            border: "none",
            fontWeight: 700,
            fontSize: 10,
            cursor: "pointer",
            background: attendanceView === v ? "var(--accent-strong)" : "var(--surface-strong)",
            color: attendanceView === v ? "#fff" : "var(--text-primary)",
          }}
        >
          {v.toUpperCase()}
        </button>
      ))}
    </div>

    {/* ===== SUBJECT CARDS ===== */}
    {(() => {
      const subjectEntries = Object.entries(attendanceBySubject).filter(
        ([course]) => attendanceCourseFilter === "All" || course === attendanceCourseFilter
      );

      if (subjectEntries.length === 0) {
        return (
          <div
            style={{
              marginTop: 8,
              border: "1px dashed #bfdbfe",
              borderRadius: 12,
              padding: "18px 12px",
              textAlign: "center",
              background: "#f8fbff",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)" }}>
              No attendance records
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.45 }}>
              There are no attendance entries yet for this student.
            </div>
          </div>
        );
      }

      return subjectEntries.map(([course, records]) => {
        const latestRecordDate = getLatestRecordDate(records) || new Date();
        const latestDateLabel = latestRecordDate.toDateString();
        const latestWeek = _getWeekNumber(latestRecordDate);
        const latestMonth = latestRecordDate.getMonth();
        const latestYear = latestRecordDate.getFullYear();

        const dayRecords = records.filter((r) => {
          const recordDate = new Date(r.date);
          return !Number.isNaN(recordDate.getTime()) && recordDate.toDateString() === latestDateLabel;
        });
        const weekRecords = records.filter((r) => {
          const recordDate = new Date(r.date);
          return (
            !Number.isNaN(recordDate.getTime()) &&
            recordDate.getFullYear() === latestYear &&
            _getWeekNumber(recordDate) === latestWeek
          );
        });
        const monthRecords = records.filter((r) => {
          const recordDate = new Date(r.date);
          return (
            !Number.isNaN(recordDate.getTime()) &&
            recordDate.getFullYear() === latestYear &&
            recordDate.getMonth() === latestMonth
          );
        });

        const displayRecords =
          attendanceView === "daily"
            ? dayRecords
            : attendanceView === "weekly"
            ? weekRecords
            : monthRecords;

        const progress = getProgress(displayRecords);
        const expandKey = `${attendanceView}-${course}`;

        return (
          <div
            key={course}
            onClick={() => toggleExpand(expandKey)}
            style={{
              cursor: "pointer",
              background: "var(--surface-panel)",
              borderRadius: 12,
              padding: 12,
              marginBottom: 10,
              border: "1px solid var(--border-soft)",
              boxShadow: "var(--shadow-soft)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Glow */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "transparent",
                pointerEvents: "none",
              }}
            />

            {/* HEADER */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 800,
                    color: "var(--text-primary)",
                  }}
                >
                  {formatSubjectName(course)}
                </h3>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: 10,
                    color: "var(--text-muted)",
                  }}
                >
                  {records[0]?.teacherName}
                </p>
              </div>

              <div
                style={{
                  padding: "4px 8px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 800,
                  background: "var(--accent-soft)",
                  color: "var(--accent-strong)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                {progress}%
              </div>
            </div>

            {/* PROGRESS BAR */}
            <div
              onClick={() => toggleExpand(expandKey)}
              style={{
                height: 8,
                background: "var(--surface-strong)",
                borderRadius: 999,
                cursor: "pointer",
                overflow: "hidden",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: "var(--accent-strong)",
                  transition: "width .3s ease",
                }}
              />
            </div>

            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "var(--text-secondary)",
                marginBottom: 8,
                letterSpacing: 0.3,
              }}
            >
              Click to view {attendanceView.toUpperCase()} details
            </div>

            {/* EXPANDED DAYS */}
            {expandedCards[expandKey] && (
              <div
                style={{
                  marginTop: 8,
                  background: "var(--surface-muted)",
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                {displayRecords.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 6px",
                      borderBottom:
                        i !== displayRecords.length - 1
                          ? "1px solid var(--border-soft)"
                          : "none",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 10, color: "var(--text-primary)" }}>
                        📅 {new Date(r.date).toDateString()}
                      </span>
                     
                    </div>

                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 800,
                        background:
                          r.status === "present"
                            ? "#dcfce7"
                            : r.status === "late"
                            ? "#fef3c7"
                            : "#fee2e2",
                        color:
                          r.status === "present"
                            ? "#166534"
                            : r.status === "late"
                            ? "#92400e"
                            : "#991b1b",
                      }}
                    >
                      {r.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      });
    })()}
  </div>
)}

                  {/* PERFORMANCE TAB */}
             {/* PERFORMANCE TAB */}
                {studentTab === "performance" && (
                  <div style={{ position: "relative", paddingBottom: "30px", background: "var(--surface-panel)", borderRadius: 12, border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-soft)", padding: 12 }}>

                    {/* Semester Tabs */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "12px",
                        marginBottom: "12px",
                        borderBottom: "1px solid var(--border-soft)",
                        paddingBottom: "6px",
                      }}
                    >
                      {semesterTabs.map((sem) => {
                        const isActive = activeSemester === sem;
                        return (
                          <button
                            key={sem}
                            onClick={() => setActiveSemester(sem)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "10px",
                              fontWeight: 700,
                              color: isActive ? "var(--accent-strong)" : "var(--text-muted)",
                              padding: "6px 8px",
                              borderBottom: isActive ? "2px solid var(--accent-strong)" : "2px solid transparent",
                            }}
                          >
                            {String(sem).replace(/semester(\d+)/i, "Semester $1")}
                          </button>
                        );
                      })}
                    </div>

                    {/* Marks Cards */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gap: "10px",
                        padding: "10px",
                      }}
                    >
                      {marksLoading ? (
                        <div style={{ textAlign: "center", gridColumn: "1 / -1", padding: 12, color: "var(--text-muted)", fontSize: 11 }}>
                          Loading performance...
                        </div>
                      ) : Object.keys(studentMarksFlattened || {}).length === 0 ? (
                        <div
                          style={{
                            textAlign: "center",
                            padding: 12,
                            borderRadius: 12,
                            background: "var(--surface-panel)",
                            color: "var(--text-secondary)",
                            fontSize: 11,
                            fontWeight: 600,
                            border: "1px solid var(--border-soft)",
                            gridColumn: "1 / -1",
                          }}
                        >
                          No performance records
                        </div>
                      ) : (
                        !availableSemesters.includes(activeSemester) ? (
                          <div
                            style={{
                              textAlign: "center",
                              padding: 12,
                              borderRadius: 12,
                              background: "var(--surface-panel)",
                              color: "var(--text-secondary)",
                              fontSize: 11,
                              fontWeight: 600,
                              border: "1px solid var(--border-soft)",
                              gridColumn: "1 / -1",
                            }}
                          >
                            No performance records for {String(activeSemester).replace(/semester(\d+)/i, "Semester $1")}
                          </div>
                        ) :
                        Object.entries(studentMarksFlattened)
                          .filter(([, studentCourseData]) => Boolean(studentCourseData?.[activeSemester]))
                          .map(([courseKey, studentCourseData], idx) => {
                          // studentCourseData should be the student's object under a course:
                          // { teacherName: "...", semester1: { assessments: {...} }, semester2: { ... } }
                          const data = studentCourseData?.[activeSemester];
                          if (!data) return null;

                          const assessments = data.assessments || {};
                          const total = Object.values(assessments).reduce(
                            (sum, a) => sum + (a.score || 0),
                            0
                          );
                          const maxTotal = Object.values(assessments).reduce(
                            (sum, a) => sum + (a.max || 0),
                            0
                          );
                          const percentage = maxTotal ? (total / maxTotal) * 100 : 0;

                          const statusClr =
                            percentage >= 75
                              ? "#16a34a"
                              : percentage >= 50
                                ? "#f59e0b"
                                : "#dc2626";

                          // Format course name nicely
                          const courseName = courseKey
                            .replace("course_", "")
                            .replace(/_/g, " ")
                            .toUpperCase();

                          const quarterEntriesPreview = Object.entries(data || {})
                            .filter(([k, v]) => /^q\d+$/i.test(k) && v && typeof v === "object")
                            .sort((a, b) => {
                              const na = parseInt(String(a[0]).replace(/^q/i, ""), 10) || 0;
                              const nb = parseInt(String(b[0]).replace(/^q/i, ""), 10) || 0;
                              return na - nb;
                            });
                          const hasQuarterFormatPreview = quarterEntriesPreview.length > 0;

                          return (
                            <div
                              key={`${courseKey}-${idx}`}
                              style={{
                                padding: 12,
                                borderRadius: 12,
                                background: "var(--surface-panel)",
                                border: "1px solid var(--border-soft)",
                                boxShadow: "var(--shadow-soft)",
                              }}
                            >
                              {/* Course Name */}
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  marginBottom: 10,
                                  color: "var(--text-primary)",
                                  textAlign: "left",
                                }}
                              >
                                {courseName}
                              </div>

                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "3px 8px",
                                  borderRadius: 999,
                                  fontSize: 10,
                                  fontWeight: 800,
                                  marginBottom: 10,
                                  color: hasQuarterFormatPreview ? "#007AFB" : "#0f766e",
                                  background: hasQuarterFormatPreview ? "#dbeafe" : "#ccfbf1",
                                  border: "1px solid var(--border-soft)",
                                }}
                              >
                                {hasQuarterFormatPreview ? "Format: Quarter-based" : "Format: Semester-based"}
                              </div>

                              {/* Render by saved format: quarter-based or semester-based */}
                              {(() => {
                                const quarterEntries = quarterEntriesPreview;
                                const hasQuarterFormat = hasQuarterFormatPreview;
                                const quarterStateKey = `${courseKey}__${activeSemester}`;
                                const defaultQuarterKey = quarterEntries[0]?.[0] || "";
                                const selectedQuarterKey = quarterEntries.some(([quarterKey]) => quarterKey === activeQuarterViews[quarterStateKey])
                                  ? activeQuarterViews[quarterStateKey]
                                  : defaultQuarterKey;
                                const selectedQuarterData = quarterEntries.find(([quarterKey]) => quarterKey === selectedQuarterKey)?.[1] || null;

                                const renderQuarterBlock = (quarterKey, qdata) => {
                                  const label = formatQuarterLabel(quarterKey);

                                  const qAss = qdata?.assessments || qdata || {};
                                  const qTotal = Object.values(qAss).reduce((s, a) => s + (a.score || 0), 0);
                                  const qMax = Object.values(qAss).reduce((s, a) => s + (a.max || 0), 0);
                                  const qPct = qMax ? (qTotal / qMax) * 100 : 0;
                                  const clr = qPct >= 75 ? '#16a34a' : qPct >= 50 ? '#f59e0b' : '#dc2626';

                                  return (
                                    <div style={{ flex: 1, minWidth: 0, padding: 8, borderRadius: 8, border: '1px solid #f1f5f9', background: '#fff' }}>
                                      <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 8 }}>{label}</div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700 }}>{qTotal} / {qMax}</div>
                                        <div style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, color: clr, border: '1px solid #e5e7eb' }}>{Math.round(qPct)}%</div>
                                      </div>
                                      <div style={{ height: 6, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden', marginBottom: 8 }}>
                                        <div style={{ width: `${Math.max(0, Math.min(100, qPct))}%`, height: '100%', background: clr }} />
                                      </div>
                                      {Object.entries(qAss).length === 0 ? (
                                        <div style={{ color: '#8b8f95', fontSize: 12 }}>No marks</div>
                                      ) : (
                                        Object.entries(qAss).map(([k, a]) => (
                                          <div key={k} style={{ marginBottom: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: '#111827' }}>
                                              <span>{a.name || k}</span>
                                              <span>{(a.score === '' || a.score === null || a.score === undefined || a.score === 0) ? '-' : a.score} / {a.max}</span>
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  );
                                };

                                if (hasQuarterFormat) {
                                  return (
                                    <>
                                      <div
                                        style={{
                                          display: 'flex',
                                          flexWrap: 'wrap',
                                          gap: 8,
                                          marginBottom: 12,
                                        }}
                                      >
                                        {quarterEntries.map(([quarterKey]) => {
                                          const isQuarterActive = selectedQuarterKey === quarterKey;
                                          return (
                                            <button
                                              key={quarterKey}
                                              onClick={() =>
                                                setActiveQuarterViews((prev) => ({
                                                  ...prev,
                                                  [quarterStateKey]: quarterKey,
                                                }))
                                              }
                                              style={{
                                                padding: '5px 10px',
                                                borderRadius: 999,
                                                border: isQuarterActive ? '1px solid var(--accent-strong)' : '1px solid var(--border-soft)',
                                                background: isQuarterActive ? 'var(--accent-strong)' : 'var(--surface-accent)',
                                                color: isQuarterActive ? '#ffffff' : 'var(--accent-strong)',
                                                fontSize: 10,
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              {formatQuarterLabel(quarterKey)}
                                            </button>
                                          );
                                        })}
                                      </div>

                                      {selectedQuarterData ? renderQuarterBlock(selectedQuarterKey, selectedQuarterData) : null}
                                      <div style={{ marginTop: 8, textAlign: 'left', fontSize: 10, color: '#64748b' }}>
                                        {selectedQuarterData?.teacherName || studentCourseData.teacherName || data.teacherName || 'N/A'}
                                      </div>
                                    </>
                                  );
                                }

                                // fallback: semester-level summary and assessments
                                return (
                                  <>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>Total</div>
                                      <div style={{ fontSize: 11, fontWeight: 800, color: '#111827' }}>{total} / {maxTotal}</div>
                                      <div style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, border: '1px solid #e5e7eb', color: statusClr, background: '#ffffff' }}>{Math.round(percentage)}%</div>
                                    </div>
                                    <div style={{ height: 8, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden', marginBottom: 12 }}>
                                      <div style={{ width: `${Math.max(0, Math.min(100, percentage))}%`, height: '100%', background: statusClr }} />
                                    </div>
                                    {Object.entries(assessments).map(([key, a]) => (
                                      <div key={key} style={{ marginBottom: 8 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: '#111827' }}>
                                          <span>{a.name}</span>
                                          <span>{(a.score === '' || a.score === null || a.score === undefined || a.score === 0) ? '-' : a.score} / {a.max}</span>
                                        </div>
                                      </div>
                                    ))}
                                    <div style={{ marginTop: 8, textAlign: 'left', fontWeight: 700, fontSize: 10, color: statusClr }}>
                                      {percentage >= 75 ? 'Excellent' : percentage >= 50 ? 'Good' : 'Needs Improvement'}
                                    </div>
                                    <div style={{ marginTop: 6, textAlign: 'left', fontSize: 10, color: '#64748b' }}>{studentCourseData.teacherName || data.teacherName || 'N/A'}</div>
                                  </>
                                );
                              })()}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
                     </div>
              {/* Parent Chat Button */}
              {!chatOpen && (
                <div
                  onClick={handleOpenParentChat}
                  title="Chat with student's parent"
                  style={{
                    position: "fixed",
                    bottom: "20px",
                    right: "220px",
                    width: "140px",
                    height: "48px",
                    background: "linear-gradient(135deg, color-mix(in srgb, var(--success, #22c55e) 78%, #0f172a), var(--success, #22c55e))",
                    borderRadius: "28px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    gap: 10,
                    padding: "0 12px",
                    color: "#fff",
                    cursor: "pointer",
                    zIndex: 1100,
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
                    <FaFacebookMessenger size={18} />
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>Parent Chat</span>
                  </div>
                  <span
                    style={{
                      position: "absolute",
                      top: -8,
                      right: 8,
                      background: "color-mix(in srgb, var(--success, #22c55e) 42%, #04130b)",
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

              {/* Student Chat Button */}
              {!chatOpen && (
                <div
                  onClick={() =>
                    openQuickChat(
                      {
                        userId: selectedStudent?.userId,
                        name: selectedStudent?.name,
                        profileImage: resolveProfileImage(
                          selectedStudentDetails?.profileImage,
                          selectedStudent?.profileImage,
                          "/default-profile.png"
                        ),
                        type: "student",
                      },
                      "student"
                    )
                  }
                  title="Chat with student"
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
                    <span style={{ fontWeight: 800, fontSize: 13 }}>Student Chat</span>
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
                    S
                  </span>
                </div>
              )}
              {/* Chat Popup */}
              {chatOpen && selectedStudent && (
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
                  {/* HEADER */}
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
                    <strong>{quickChatTarget?.name || selectedStudent.name}</strong>

                    <div style={{ display: "flex", gap: "10px" }}>
                      {/* Expand */}
                      <button
                        onClick={() => {
                          const targetUserId = normalizeIdentifier(quickChatTarget?.userId);
                          if (!targetUserId) return;

                          closeQuickChat();
                          const chatId = getChatId(teacherUserId, targetUserId);
                          navigate("/all-chat", {
                            state: {
                              user: quickChatTarget || selectedStudent,
                              contact: quickChatTarget || selectedStudent,
                              chatId, // open the exact chat thread
                              tab: quickChatTab || "student", // tab type
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
                        Start chatting with {quickChatTarget?.name || selectedStudent.name}
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
                                  <span style={{ display: "flex", gap: 0, alignItems: 'center' }}>
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

                  {/* Input */}
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
                        borderRadius: "50%",
                        background: "#4facfe",
                        border: "none",
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
            </div>
          ) : (
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
                  <FaUsers />
                </div>
                <h3 style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", fontWeight: 800 }}>
                  Student Details
                </h3>
                <p style={{ margin: "8px 0 0", color: "var(--text-muted)", fontSize: 11, lineHeight: 1.5 }}>
                  Select a student from the list to view profile, attendance, performance, and chat.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentsPage;

