import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FaSave,
  FaMagic,
  FaBell,
  FaCog,
  FaFacebookMessenger,
  FaFileAlt,
  FaTrash,
  FaDownload
} from "react-icons/fa";
import { ref, get, set, onValue } from "firebase/database";
import { db } from "../firebase";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BACKEND_BASE } from "../config.js";
import Sidebar from "../components/Sidebar";

/* ================= CONSTANTS ================= */
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = [
  "P1 (2:30–3:15)",
  "P2 (3:15–4:00)",
  "P3 (4:00–4:45)",
  "Break",
  "P4 (5:10–5:55)",
  "P5 (5:55–6:40)",
  "LUNCH",
  "P6 (7:35–8:20)",
  "P7 (8:20–9:05)",
];

const FREE_ID = "__FREE__";
const FREE_SUBJECT = "Free Period";

const sanitizeForFirebase = (value) => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitizeForFirebase);
  const out = {};
  Object.entries(value).forEach(([k, v]) => {
    out[k] = sanitizeForFirebase(v);
  });
  return out;
};

export default function SchedulePage() {
  const admin = JSON.parse(localStorage.getItem("admin")) || {};
  const API_BASE = `${BACKEND_BASE}/api`;
  const [schoolCode, setSchoolCode] = useState(() => String(admin.schoolCode || "").trim());
  const RTDB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";
  const SCHOOL_DB_ROOT = schoolCode
    ? `${RTDB_BASE}/Platform1/Schools/${encodeURIComponent(schoolCode)}`
    : RTDB_BASE;

  const getSchoolNodeUrl = (nodeName) => `${SCHOOL_DB_ROOT}/${nodeName}.json`;
  const getSchoolNodePath = (nodeName) =>
    schoolCode ? `Platform1/Schools/${schoolCode}/${nodeName}` : nodeName;

  const readSchoolNode = async (nodeName) => {
    if (!schoolCode) {
      console.warn(`Missing schoolCode. Cannot read school node: ${nodeName}`);
      return {};
    }

    try {
      const schoolRes = await axios.get(getSchoolNodeUrl(nodeName));
      return schoolRes.data ?? {};
    } catch (err) {
      console.error(`Failed to read school node ${nodeName}:`, err);
      return {};
    }
  };

  const fetchChatMessages = async (chatKey) => {
    const encodedChatKey = encodeURIComponent(chatKey);

    if (schoolCode) {
      try {
        const schoolRes = await axios.get(
          `${SCHOOL_DB_ROOT}/Chats/${encodedChatKey}/messages.json`
        );
        if (schoolRes.data !== null && schoolRes.data !== undefined) {
          return schoolRes.data;
        }
      } catch (err) {
        // fallback to root for legacy chat paths
      }
    }

    try {
      const rootRes = await axios.get(
        `${RTDB_BASE}/Chats/${encodedChatKey}/messages.json`
      );
      return rootRes.data ?? {};
    } catch (err) {
      return {};
    }
  };

  const patchScopedRoot = async (updates) => {
    if (!updates || Object.keys(updates).length === 0) return;

    if (schoolCode) {
      try {
        await axios.patch(`${SCHOOL_DB_ROOT}/.json`, updates);
        return;
      } catch (err) {
        // fallback to root for legacy chat paths
      }
    }

    await axios.patch(`${RTDB_BASE}/.json`, updates);
  };

  /* ================= STATE ================= */
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState({});
  const [teacherMap, setTeacherMap] = useState({});
  const [courseTeacherMap, setCourseTeacherMap] = useState({});
  const [schedule, setSchedule] = useState({});
  const scheduleRef = useRef({});
  const [weeklyFrequency, setWeeklyFrequency] = useState({});
  const [globalWeekly, setGlobalWeekly] = useState({});
  const [classesToGenerate, setClassesToGenerate] = useState([]); // [{ grade, section, classKey }]
  const [generatingAll, setGeneratingAll] = useState(false);
  const [savingAllAdded, setSavingAllAdded] = useState(false);
  const [weeklySubjectsOpen, setWeeklySubjectsOpen] = useState({}); // { [classKey]: boolean }
  const [gradeOptions, setGradeOptions] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [teacherWorkload, setTeacherWorkload] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [selectedTeacherInfo, setSelectedTeacherInfo] = useState(null);
  const [selectedTeacherDetails, setSelectedTeacherDetails] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
// { day, period, subject, teacherId }
const [unreadSenders, setUnreadSenders] = useState({}); 
const [teachers, setTeachers] = useState([]);
const [unreadTeachers, setUnreadTeachers] = useState({});
const [popupMessages, setPopupMessages] = useState([]);
const [showMessageDropdown, setShowMessageDropdown] = useState(false);
const [selectedTeacher, setSelectedTeacher] = useState(null);
const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const navigate = useNavigate();
const [postNotifications, setPostNotifications] = useState([]);
const [showPostDropdown, setShowPostDropdown] = useState(false);
const [dragHint, setDragHint] = useState(null);


const adminId = admin.userId;

const adminUserId = admin.userId;

const MAX_TEACHER_PERIODS_PER_DAY = 4;

const fetchPostNotifications = async () => {
  if (!adminId) return;

  try {
    // 1️⃣ Get post notifications
    const res = await axios.get(`${API_BASE}/get_post_notifications/${adminId}`);

    let notifications = Array.isArray(res.data)
      ? res.data
      : Object.values(res.data || {});

    if (notifications.length === 0) {
      setPostNotifications([]);
      return;
    }

    // 2️⃣ Fetch Users & School_Admins
    const [usersRaw, adminsRaw] = await Promise.all([
      readSchoolNode("Users"),
      readSchoolNode("School_Admins"),
    ]);

    const users = usersRaw && typeof usersRaw === "object" ? usersRaw : {};
    const admins = adminsRaw && typeof adminsRaw === "object" ? adminsRaw : {};

    // 3️⃣ Helpers
    const findAdminUser = (adminId) => {
      const admin = admins[adminId];
      if (!admin) return null;

      return Object.values(users).find(
        (u) => u.userId === admin.userId
      );
    };

    // 4️⃣ Enrich notifications
    const enriched = notifications.map((n) => {
      const posterUser = findAdminUser(n.adminId);

      return {
        ...n,
        notificationId:
          n.notificationId ||
          n.id ||
          `${n.postId}_${n.adminId}`,

        adminName: posterUser?.name || "Unknown Admin",
        adminProfile:
          posterUser?.profileImage || "/default-profile.png",
      };
    });

    setPostNotifications(enriched);
  } catch (err) {
    console.error("Post notification fetch failed", err);
    setPostNotifications([]);
  }
};


useEffect(() => {
  if (!adminId) return;

  fetchPostNotifications();
  const interval = setInterval(fetchPostNotifications, 5000);

  return () => clearInterval(interval);
}, [adminId]);


const handleNotificationClick = async (notification) => {
  try {
    await axios.post(`${API_BASE}/mark_post_notification_read`, {
      notificationId: notification.notificationId,
      adminId: admin.userId,
    });
  } catch (err) {
    console.warn("Failed to delete notification:", err);
  }

  // 🔥 REMOVE FROM UI IMMEDIATELY
  setPostNotifications((prev) =>
    prev.filter((n) => n.notificationId !== notification.notificationId)
  );

  setShowPostDropdown(false);

  // ➜ Navigate to post
  navigate("/dashboard", {
    state: { postId: notification.postId },
  });
};
useEffect(() => {
  if (location.state?.postId) {
    setPostNotifications([]);
  }
}, []);

useEffect(() => {
  const closeDropdown = (e) => {
    if (
      !e.target.closest(".icon-circle") &&
      !e.target.closest(".notification-dropdown")
    ) {
      setShowPostDropdown(false);
    }
  };

  document.addEventListener("click", closeDropdown);
  return () => document.removeEventListener("click", closeDropdown);
}, []);

  /* ================= FETCH DATABASE ================= */
  const fetchAll = async () => {
    try {
      const [usersRaw, teachersRaw, schedulesRaw, gradeMgmtRaw] =
        await Promise.all([
          readSchoolNode("Users"),
          readSchoolNode("Teachers"),
          readSchoolNode("Schedules"),
          readSchoolNode("GradeManagement"),
        ]);

      const users = usersRaw && typeof usersRaw === "object" ? usersRaw : {};
      const teachers =
        teachersRaw && typeof teachersRaw === "object" ? teachersRaw : {};
      const tMap = {};
      Object.entries(teachers).forEach(([tid, t]) => {
        if (users[t.userId]) tMap[tid] = users[t.userId].name;
      });

      const classMap = {};
      const gradeSet = new Set();
      const ctMap = {};
      const courseArr = [];
      const seenCourseIds = new Set();

      const normalizeToken = (value) =>
        String(value || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");

      const makeCourseId = (gradeValue, sectionValue, subjectToken) =>
        `gm_${normalizeToken(gradeValue)}_${normalizeToken(sectionValue)}_${normalizeToken(subjectToken)}`;

      const toSectionList = (sectionsNode) => {
        if (Array.isArray(sectionsNode)) {
          return sectionsNode
            .map((sec) => {
              if (!sec) return "";
              if (typeof sec === "string") return sec;
              if (typeof sec === "object") return sec.section || sec.name || sec.code || "";
              return "";
            })
            .map((s) => String(s || "").trim().toUpperCase())
            .filter(Boolean);
        }

        if (sectionsNode && typeof sectionsNode === "object") {
          return Object.entries(sectionsNode)
            .map(([sectionKey, sectionValue]) => {
              if (sectionValue && typeof sectionValue === "object") {
                return sectionValue.section || sectionValue.name || sectionValue.code || sectionKey;
              }
              return sectionKey;
            })
            .map((s) => String(s || "").trim().toUpperCase())
            .filter(Boolean);
        }

        return [];
      };

      const toSubjectList = (subjectsNode) => {
        if (Array.isArray(subjectsNode)) {
          return subjectsNode
            .map((subjectItem) => {
              if (!subjectItem) return null;
              if (typeof subjectItem === "string") {
                return { key: normalizeToken(subjectItem), name: subjectItem };
              }
              if (typeof subjectItem === "object") {
                const displayName = subjectItem.name || subjectItem.subject || subjectItem.code || "";
                const subjectKey = normalizeToken(subjectItem.key || subjectItem.id || displayName);
                if (!subjectKey || !displayName) return null;
                return { key: subjectKey, name: displayName };
              }
              return null;
            })
            .filter(Boolean);
        }

        if (subjectsNode && typeof subjectsNode === "object") {
          return Object.entries(subjectsNode)
            .map(([subjectKey, subjectValue]) => {
              if (subjectValue && typeof subjectValue === "object") {
                const displayName = subjectValue.name || subjectValue.subject || subjectKey;
                return {
                  key: normalizeToken(subjectKey || displayName),
                  name: displayName,
                };
              }
              if (typeof subjectValue === "string") {
                return {
                  key: normalizeToken(subjectKey || subjectValue),
                  name: subjectValue,
                };
              }
              return {
                key: normalizeToken(subjectKey),
                name: subjectKey,
              };
            })
            .filter((x) => x.key && x.name);
        }

        return [];
      };

      const resolveTeacherId = (assignment) => {
        const raw = assignment?.teacherId || assignment?.teacherRecordKey || "";
        return String(raw || "").trim().replace(/^-+/, "");
      };

      const addClassOption = (gradeValue, sectionValue) => {
        const grade = String(gradeValue || "").trim();
        const section = String(sectionValue || "").trim().toUpperCase();
        if (!grade) return;
        gradeSet.add(grade);
        if (!section) return;
        if (!classMap[grade]) classMap[grade] = new Set();
        classMap[grade].add(section);
      };

      // Primary source: GradeManagement/grades from DB
      const gradeMgmt = gradeMgmtRaw && typeof gradeMgmtRaw === "object" ? gradeMgmtRaw : {};
      const gradeNode = gradeMgmt?.grades;
      const gradeEntries = Array.isArray(gradeNode)
        ? gradeNode
        : Object.entries(gradeNode || {}).map(([gradeKey, gradeValue]) => ({
            grade: gradeValue?.grade ?? gradeKey,
            ...(gradeValue && typeof gradeValue === "object" ? gradeValue : {}),
          }));

      gradeEntries.forEach((entry, index) => {
        if (!entry || typeof entry !== "object") return;
        const grade = String(entry.grade ?? (Array.isArray(gradeNode) ? "" : String(index + 1))).trim();
        if (grade) {
          gradeSet.add(grade);
        }
        const sectionSubjectTeachers =
          entry.sectionSubjectTeachers && typeof entry.sectionSubjectTeachers === "object"
            ? entry.sectionSubjectTeachers
            : {};

        const sections = toSectionList(entry.sections);
        Object.keys(sectionSubjectTeachers || {}).forEach((sectionKey) => {
          const section = String(sectionKey || "").trim().toUpperCase();
          if (section) sections.push(section);
        });

        const uniqueSections = [...new Set(sections.filter(Boolean))];
        uniqueSections.forEach((section) => addClassOption(grade, section));

        const subjects = toSubjectList(entry.subjects);
        const subjectMap = new Map(subjects.map((s) => [normalizeToken(s.key || s.name), s]));

        Object.entries(sectionSubjectTeachers).forEach(([sectionKey, subjectTeacherNode]) => {
          const section = String(sectionKey || "").trim().toUpperCase();
          if (!section || !subjectTeacherNode || typeof subjectTeacherNode !== "object") return;

          Object.entries(subjectTeacherNode).forEach(([subjectKey, assignment]) => {
            const displayName =
              (assignment && typeof assignment === "object" && (assignment.subject || assignment.name))
                ? (assignment.subject || assignment.name)
                : subjectKey;
            const token = normalizeToken(displayName || subjectKey);
            if (!token) return;
            if (!subjectMap.has(token)) {
              subjectMap.set(token, { key: token, name: displayName || subjectKey });
            }
          });
        });

        const mergedSubjects = [...subjectMap.values()];

        uniqueSections.forEach((section) => {
          mergedSubjects.forEach((subjectItem) => {
            const courseId = makeCourseId(grade, section, subjectItem.key || subjectItem.name);
            if (seenCourseIds.has(courseId)) return;
            seenCourseIds.add(courseId);
            courseArr.push({
              id: courseId,
              grade,
              section,
              name: subjectItem.name,
              subject: subjectItem.name,
            });
          });
        });

        Object.entries(sectionSubjectTeachers).forEach(([sectionKey, subjectTeacherNode]) => {
          const section = String(sectionKey || "").trim().toUpperCase();
          if (!section || !subjectTeacherNode || typeof subjectTeacherNode !== "object") return;

          Object.entries(subjectTeacherNode).forEach(([subjectKey, assignment]) => {
            if (!assignment || typeof assignment !== "object") return;
            const subjectToken = normalizeToken(assignment.subject || subjectKey);
            const teacherId = resolveTeacherId(assignment);
            if (!subjectToken || !teacherId) return;
            const courseId = makeCourseId(grade, section, subjectToken);
            ctMap[courseId] = teacherId;
          });
        });
      });

      const parsedGrades = [...gradeSet].filter(Boolean).sort((a, b) => {
        const aNum = Number(a);
        const bNum = Number(b);
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
        return String(a).localeCompare(String(b));
      });

      courseArr.sort((a, b) => {
        const gradeDiff = Number(a.grade) - Number(b.grade);
        if (!Number.isNaN(gradeDiff) && gradeDiff !== 0) return gradeDiff;
        const gradeCmp = String(a.grade).localeCompare(String(b.grade));
        if (gradeCmp !== 0) return gradeCmp;
        const sectionCmp = String(a.section).localeCompare(String(b.section));
        if (sectionCmp !== 0) return sectionCmp;
        return String(a.subject).localeCompare(String(b.subject));
      });

      if (schedulesRaw && typeof schedulesRaw === "object") {
        setSchedule(schedulesRaw);
      }

      setCourses(courseArr);
      setClasses(classMap);
      setGradeOptions(parsedGrades);
      setTeacherMap(tMap);
      setCourseTeacherMap(ctMap);
      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    const connectScheduleListener = async () => {
      if (!schoolCode) {
        console.warn("Missing schoolCode. Schedule listener disabled.");
        return;
      }

      const targetPath = getSchoolNodePath("Schedules");

      if (cancelled) return;

      unsubscribe = onValue(ref(db, targetPath), (snap) => {
        const data = snap.exists() ? snap.val() : {};
        scheduleRef.current = data;
        setSchedule(data);
      });
    };

    connectScheduleListener();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [schoolCode]);

const handleClick = () => {
    navigate("/all-chat"); // replace with your target route
  };

  useEffect(() => {
    if (schoolCode) return;
    const identity = admin.adminId || admin.userId;
    if (!identity) return;

    const recoverSchoolCode = async () => {
      try {
        const res = await axios.get(`${API_BASE}/admin/${encodeURIComponent(identity)}`);
        const profile = res?.data?.admin || {};
        const resolvedCode = String(profile.schoolCode || "").trim();
        if (!resolvedCode) return;

        setSchoolCode(resolvedCode);
        const existing = JSON.parse(localStorage.getItem("admin") || "{}");
        localStorage.setItem(
          "admin",
          JSON.stringify({
            ...existing,
            schoolCode: resolvedCode,
          })
        );
      } catch (err) {
        console.warn("Failed to recover schoolCode for SchedulePage", err);
      }
    };

    recoverSchoolCode();
  }, [schoolCode, admin.adminId, admin.userId, API_BASE]);

useEffect(() => {
  const fetchTeachersAndUnread = async () => {
    if (!schoolCode || !adminUserId) return;
    try {
      const [teachersRaw, usersRaw] = await Promise.all([
        readSchoolNode("Teachers"),
        readSchoolNode("Users")
      ]);

      const teachersData =
        teachersRaw && typeof teachersRaw === "object" ? teachersRaw : {};
      const usersData = usersRaw && typeof usersRaw === "object" ? usersRaw : {};

      const teacherList = Object.keys(teachersData).map(tid => {
        const teacher = teachersData[tid];
        const user = usersData[teacher.userId] || {};
        return {
          teacherId: tid,
          userId: teacher.userId,
          name: user.name || "No Name",
          profileImage: user.profileImage || "/default-profile.png"
        };
      });

      setTeachers(teacherList);

      // fetch unread messages
      const unread = {};
      const allMessages = [];

      const chatResults = await Promise.all(
        teacherList.map(async (t) => {
          const chatKey = `${adminUserId}_${t.userId}`;
          const chatData = await fetchChatMessages(chatKey);
          const msgs = Object.values(chatData || {}).map((m) => ({
            ...m,
            sender: m.senderId === adminUserId ? "admin" : "teacher",
          }));
          return { userId: t.userId, msgs };
        })
      );

      chatResults.forEach(({ userId, msgs }) => {
        allMessages.push(...msgs);
        const unreadCount = msgs.filter((m) => m.receiverId === adminUserId && !m.seen).length;
        if (unreadCount > 0) unread[userId] = unreadCount;
      });

      setPopupMessages(allMessages);
      setUnreadTeachers(unread);

    } catch (err) {
      console.error(err);
    }
  };

  fetchTeachersAndUnread();
}, [adminUserId, schoolCode]);


  useEffect(() => {
    if (!schoolCode) return;
    fetchAll();
  }, [schoolCode]);

  useEffect(() => {
    scheduleRef.current = schedule || {};
  }, [schedule]);

  const selectedClassKey =
    selectedGrade && selectedSection ? `Grade ${selectedGrade}${selectedSection}` : null;

  const normalizeClassKey = (value) =>
    (value || "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const dedupeClassList = (list) => {
    const seen = new Set();
    const out = [];
    for (const item of list || []) {
      const key = normalizeClassKey(item?.classKey);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  };

  const classesToGenerateUnique = dedupeClassList(classesToGenerate);

  const removeClassFromGenerate = (classKey) => {
    setClassesToGenerate((prev) => dedupeClassList((prev || []).filter((c) => c?.classKey !== classKey)));
    setWeeklySubjectsOpen((prev) => {
      if (!prev) return {};
      const next = { ...prev };
      delete next[classKey];
      return next;
    });
  };

  const addSelectedClassToGenerate = () => {
    if (!selectedGrade || !selectedSection) {
      alert("Select grade & section first");
      return;
    }

    const grade = String(selectedGrade).trim();
    const section = String(selectedSection).trim().toUpperCase();
    const classKey = `Grade ${grade}${section}`;
    setClassesToGenerate((prev) => {
      const list = [...(prev || []), { grade, section, classKey }];
      return dedupeClassList(list);
    });

    setWeeklySubjectsOpen((prev) => ({
      ...prev,
      [classKey]: true,
    }));
  };

  const filteredCourses = courses.filter(
    c => c.grade === selectedGrade && c.section === selectedSection
  );

const getTeachersForCourse = (courseId) => {
  const tid = courseTeacherMap[courseId];
  if (!tid) return [];
  return [{ id: tid, name: teacherMap[tid] }];
};

  const normalizeSubjectKey = (value) =>
    (value || "").toString().trim().toLowerCase().replace(/\s+/g, " ");

  const getGradeSubjectList = () => {
    const out = {};
    (courses || []).forEach((c) => {
      if (!c?.grade) return;
      if (!c?.subject) return;
      const g = String(c.grade);
      out[g] ??= new Set();
      out[g].add(normalizeSubjectKey(c.subject));
    });
    return out;
  };

  const getDisplaySubjectForGrade = (grade, subjectKey) => {
    const match = (courses || []).find(
      (c) => String(c?.grade) === String(grade) && normalizeSubjectKey(c?.subject) === subjectKey
    );
    return match?.subject || subjectKey;
  };

  const gradeSubjectsByGrade = getGradeSubjectList();


 // ---------------- FETCH UNREAD MESSAGES ----------------
  const fetchUnreadMessages = async () => {
    if (!admin.userId) return;

    const senders = {};

    try {
      // USERS (names & images)
      const usersRaw = await readSchoolNode("Users");
      const usersData = usersRaw && typeof usersRaw === "object" ? usersRaw : {};

      const findUserByUserId = (userId) => {
        return Object.values(usersData).find((u) => u.userId === userId);
      };

      // helper to read messages from BOTH chat keys
      const getUnreadCount = async (userId) => {
        const key1 = `${admin.userId}_${userId}`;
        const key2 = `${userId}_${admin.userId}`;

        const [m1, m2] = await Promise.all([
          fetchChatMessages(key1),
          fetchChatMessages(key2),
        ]);

        const msgs = [...Object.values(m1 || {}), ...Object.values(m2 || {})];

        return msgs.filter((m) => m.receiverId === admin.userId && !m.seen).length;
      };

      // TEACHERS
      const teachersRaw = await readSchoolNode("Teachers");
      const teachersData =
        teachersRaw && typeof teachersRaw === "object" ? teachersRaw : {};

      for (const k in teachersData) {
        const t = teachersData[k];
        if (!t?.userId) continue;
        const unread = await getUnreadCount(t.userId);
        if (unread <= 0) continue;

        const user = findUserByUserId(t.userId);
        senders[t.userId] = {
          type: "teacher",
          name: user?.name || t.name || "Teacher",
          profileImage: user?.profileImage || t.profileImage || "/default-profile.png",
          count: unread,
        };
      }

      setUnreadSenders(senders);
    } catch (err) {
      console.error("Unread fetch failed:", err);
    }
  };

  // ---------------- CLOSE DROPDOWN ON OUTSIDE CLICK ----------------
  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".messenger-dropdown")) {
        setShowMessageDropdown(false);
      }
    };

    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    if (!admin.userId) return;

    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 5000);

    return () => clearInterval(interval);
  }, [admin.userId]);





/* ================= AUTO GENERATE RANDOMLY (FIXED) ================= */
/* ================= AUTO GENERATE RANDOMLY (DEADLOCK SAFE) ================= */
const autoGenerate = (opts = {}) => {
  const classKey = opts.classKey ?? selectedClassKey;
  const interactive = opts.interactive ?? true;
  const returnData = Boolean(opts.returnData);
  const classCourses = opts.classCourses ?? filteredCourses;
  const rawFreq = opts.rawFreq ?? (weeklyFrequency?.[classKey] || {});
  const baseScheduleInput = opts.baseSchedule ?? (scheduleRef.current || schedule || {});

  if (!classKey) {
    alert("Select grade & section first");
    return;
  }

  const activePeriods = PERIODS.filter(p => p !== "LUNCH" && p !== "Break");
  const totalSlots = DAYS.length * activePeriods.length;

  // Tough classes with tight cross-grade teacher constraints may need more random restarts.
  const MAX_ATTEMPTS = 200;

  // `classCourses` and `rawFreq` can be provided for batch generation.

  // Strict rule: max 1 per subject per day (never relaxed).
  const maxPerDayByCourseId = {};
  const subjectToCourseId = {};

  // Only keep frequencies for this class's courses.
  const freqMapOriginal = {};
  classCourses.forEach(c => {
    const v = Number(rawFreq?.[c.id] ?? 0);
    freqMapOriginal[c.id] = Number.isFinite(v) ? Math.max(0, v) : 0;
    subjectToCourseId[(c.subject || "").trim().toLowerCase()] = c.id;
    maxPerDayByCourseId[c.id] = 1;
  });

  const sumFreq = Object.values(freqMapOriginal).reduce((a, b) => a + (Number(b) || 0), 0);
  if (sumFreq <= 0) {
    if (interactive) {
      alert(`Set weekly subject counts first. Total must be ${totalSlots} periods/week for ${classKey}.`);
    }
    return;
  }

  // If the total doesn't match available slots, offer to auto-adjust.
  let missingFree = 0;
  if (sumFreq !== totalSlots) {
    const diff = sumFreq - totalSlots;
    const msg = diff > 0
      ? `Weekly subject total is ${sumFreq}, but this timetable has ${totalSlots} teachable periods/week.\n\nClick OK to auto-reduce counts by ${diff} (you can still edit later), or Cancel to adjust manually.`
      : `Weekly subject total is ${sumFreq}, but this timetable has ${totalSlots} teachable periods/week.\n\nClick OK to auto-fill the remaining ${Math.abs(diff)} periods as "${FREE_SUBJECT}", or Cancel to adjust manually.`;

    if (interactive) {
      if (!window.confirm(msg)) return;
    }

    if (diff > 0) {
      // Reduce counts greedily from the largest buckets.
      let excess = diff;
      const idsByCount = Object.keys(freqMapOriginal)
        .sort((a, b) => (freqMapOriginal[b] || 0) - (freqMapOriginal[a] || 0));

      while (excess > 0) {
        let changed = false;
        for (const id of idsByCount) {
          if (excess <= 0) break;
          if ((freqMapOriginal[id] || 0) > 0) {
            freqMapOriginal[id]--;
            excess--;
            changed = true;
          }
        }
        if (!changed) break;
      }

      // Persist the adjusted counts to the UI.
      if (interactive) {
        setWeeklyFrequency(prev => ({
          ...prev,
          [classKey]: { ...freqMapOriginal }
        }));
      }
    } else {
      missingFree = Math.abs(diff);
    }
  }

  // Feasibility check: no subject more than once per day.
  // With 5 weekdays, max weekly count per subject is 5.
  const perDayImpossible = [];
  classCourses.forEach(c => {
    const weekly = freqMapOriginal[c.id] || 0;
    if (weekly <= 0) return;
    const maxWeekly = DAYS.length;
    if (weekly > maxWeekly) {
      perDayImpossible.push({ id: c.id, subject: c.subject, weekly, maxWeekly });
    }
  });

  if (perDayImpossible.length) {
    const list = perDayImpossible
      .map(x => `- ${x.subject}: ${x.weekly} (max ${x.maxWeekly} with current per-day rule)`)
      .join("\n");

    if (interactive) {
      const ok = window.confirm(
        `Some weekly subject counts are impossible with the rule of max 1 per day.\n\n${list}` +
        `\n\nClick OK to auto-reduce them to the maximum allowed and fill the removed periods with "${FREE_SUBJECT}".\n` +
        `Cancel to adjust counts manually.`
      );
      if (!ok) return;
    }

    let removed = 0;
    perDayImpossible.forEach(x => {
      removed += Math.max(0, (freqMapOriginal[x.id] || 0) - x.maxWeekly);
      freqMapOriginal[x.id] = x.maxWeekly;
    });
    if (removed > 0) {
      missingFree += removed;
      if (interactive) {
        setWeeklyFrequency(prev => ({
          ...prev,
          [classKey]: { ...freqMapOriginal }
        }));
      }
    }
  }

  const normalizeSubject = (value) => (value || "").trim().toLowerCase();

  const getMaxPerDayForCourseId = (courseId) => {
    const v = Number(maxPerDayByCourseId?.[courseId] ?? 1);
    return Number.isFinite(v) && v > 0 ? v : 1;
  };

  const getMaxPerDayForSubject = (subject) => {
    const s = normalizeSubject(subject);
    if (!s) return 1;
    if (s === normalizeSubject(FREE_SUBJECT)) return Number.POSITIVE_INFINITY;
    const cid = subjectToCourseId?.[s];
    return getMaxPerDayForCourseId(cid);
  };

  const countSubjectInDayForClass = (dataRef, day, classKey, subject) => {
    const subjectKey = normalizeSubject(subject);
    let count = 0;
    for (const period of activePeriods) {
      const cell = dataRef?.[day]?.[classKey]?.[period];
      if (normalizeSubject(cell?.subject) === subjectKey) count++;
    }
    return count;
  };

  const countSubjectInDay = (dataRef, day, subject) =>
    countSubjectInDayForClass(dataRef, day, classKey, subject);

  const findClassUsingTeacherAt = (dataRef, day, period, teacherId) => {
    if (!teacherId) return null;
    const dayBucket = dataRef?.[day] || {};
    for (const classKey of Object.keys(dayBucket)) {
      const cell = dayBucket?.[classKey]?.[period];
      if (cell?.teacherId === teacherId) return classKey;
    }
    return null;
  };

  const tryFreeTeacherBySwappingWithinDay = (dataRef, teacherTimeSlotRef, day, targetPeriod, teacherId) => {
    const conflictClassKey = findClassUsingTeacherAt(dataRef, day, targetPeriod, teacherId);
    if (!conflictClassKey) return false;

    const conflictCell = dataRef?.[day]?.[conflictClassKey]?.[targetPeriod];
    if (!conflictCell?.teacherId) return false;

    // Try swapping the conflicting cell with another period in the SAME DAY
    // where the teacher is free (cross-class), and the other cell's teacher is also
    // free at the target period. This preserves each class's per-day subject counts.
    for (const altPeriod of activePeriods) {
      if (altPeriod === targetPeriod) continue;

      const altCell = dataRef?.[day]?.[conflictClassKey]?.[altPeriod];
      if (!altCell?.subject) continue;

      // teacherId must be free at altPeriod (cross-class)
      if (teacherTimeSlotRef?.[day]?.[altPeriod]?.[teacherId]) continue;

      const altTeacherId = altCell?.teacherId;
      if (altTeacherId && teacherTimeSlotRef?.[day]?.[targetPeriod]?.[altTeacherId]) continue;

      // Apply swap in data
      dataRef[day][conflictClassKey][targetPeriod] = altCell;
      dataRef[day][conflictClassKey][altPeriod] = conflictCell;

      // Update teacherTimeSlotRef in-place
      teacherTimeSlotRef[day] ??= {};
      teacherTimeSlotRef[day][targetPeriod] ??= {};
      teacherTimeSlotRef[day][altPeriod] ??= {};

      // Remove old bookings
      if (teacherId) delete teacherTimeSlotRef[day][targetPeriod][teacherId];
      if (altTeacherId) delete teacherTimeSlotRef[day][altPeriod][altTeacherId];

      // Add new bookings
      if (altTeacherId) teacherTimeSlotRef[day][targetPeriod][altTeacherId] = true;
      if (teacherId) teacherTimeSlotRef[day][altPeriod][teacherId] = true;

      return true;
    }

    return false;
  };

  const tryFreeTeacherByMovingAcrossDays = (dataRef, teacherTimeSlotRef, day, targetPeriod, teacherId) => {
    const conflictClassKey = findClassUsingTeacherAt(dataRef, day, targetPeriod, teacherId);
    if (!conflictClassKey) return false;

    const conflictCell = dataRef?.[day]?.[conflictClassKey]?.[targetPeriod];
    if (!conflictCell?.teacherId) return false;

    // Move the conflicting teacher's lesson to another weekday at the same period,
    // preferably into a Free Period slot, without creating subject-duplicates in that class/day.
    for (const otherDay of DAYS) {
      if (otherDay === day) continue;
      if (teacherTimeSlotRef?.[otherDay]?.[targetPeriod]?.[teacherId]) continue;

      const otherCell = dataRef?.[otherDay]?.[conflictClassKey]?.[targetPeriod];
      if (!otherCell?.subject) continue;

      const isOtherFree = normalizeSubject(otherCell.subject) === normalizeSubject(FREE_SUBJECT);
      if (!isOtherFree) continue;

      // Avoid duplicating the conflict subject in the destination day for that class.
      if (countSubjectInDayForClass(dataRef, otherDay, conflictClassKey, conflictCell.subject) >= 1) continue;

      // Also, the teacher of the destination cell (Free) is none, so no conflict there.

      // Apply swap (day <-> otherDay) for that period
      dataRef[otherDay][conflictClassKey][targetPeriod] = conflictCell;
      dataRef[day][conflictClassKey][targetPeriod] = otherCell;

      // Update teacherTimeSlotRef
      teacherTimeSlotRef[day] ??= {};
      teacherTimeSlotRef[day][targetPeriod] ??= {};
      teacherTimeSlotRef[otherDay] ??= {};
      teacherTimeSlotRef[otherDay][targetPeriod] ??= {};

      delete teacherTimeSlotRef[day][targetPeriod][teacherId];
      teacherTimeSlotRef[otherDay][targetPeriod][teacherId] = true;

      return true;
    }

    return false;
  };

  const rebuildUsedByDayForDay = (dataRef, day, subjectQuotaRef) => {
    classCourses.forEach((course) => {
      const q = subjectQuotaRef[course.id];
      if (!q) return;
      const count = countSubjectInDay(dataRef, day, course.subject);
      q.usedByDay[day] = count;
      q.extraUsedByDay[day] = count > 0;
    });
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Clone the latest schedule snapshot (includes other grades/sections)
      const data = structuredClone(baseScheduleInput || {});

      // IMPORTANT: clear existing timetable for the selected class before generating.
      // Otherwise the generator self-conflicts (teacher already marked busy in the same slot).
      DAYS.forEach(day => {
        data[day] ??= {};
        data[day][classKey] = {};
      });

      // ================= TRACKERS =================
      // Tracks teacher occupation across all classes and periods
      const teacherTimeSlot = {}; // { day: { period: { teacherId: true } } }

      // Tracks last period of teacher in THIS class to avoid consecutive periods.
      // IMPORTANT: this must be per-day; otherwise a teacher teaching Period-1 on Mon
      // blocks them from teaching Period-2 on Tue (same indices) which causes deadlocks.
      const lastTeacherPeriodByDay = {}; // { day: { classKey: { teacherId: periodIndex } } }

      DAYS.forEach(day => {
        if (!data[day]) data[day] = {};
        teacherTimeSlot[day] ??= {};
        Object.keys(classes).forEach(grade => {
          [...classes[grade]].forEach(section => {
            const key = `Grade ${grade}${section}`;
            if (!data[day][key]) data[day][key] = {};
          });
        });
      });

      // Initialize teacherTimeSlot from already scheduled classes
      DAYS.forEach(day => {
        PERIODS.forEach(period => {
          if (period === "LUNCH") return;
          Object.keys(classes).forEach(grade => {
            [...classes[grade]].forEach(section => {
              const key = `Grade ${grade}${section}`;
              const cell = data[day][key]?.[period];
              if (cell?.teacherId) {
                teacherTimeSlot[day][period] ??= {};
                teacherTimeSlot[day][period][cell.teacherId] = true;
              }
            });
          });
        });
      });

      // Feasibility check: teacher availability (necessary condition).
      // If a subject requires a teacher more times than they are free, generation cannot succeed.
      if (attempt === 1) {
        const busyCount = {};
        const daysWithAnyFreeSlot = {}; // { teacherId: numberOfDaysWithAtLeastOneFreeActivePeriod }

        // Precompute: for each teacherId, how many days they have at least one free active period.
        Object.keys(teacherMap || {}).forEach((tid) => {
          let dayFreeCount = 0;
          DAYS.forEach((day) => {
            const hasFree = activePeriods.some((period) => !teacherTimeSlot?.[day]?.[period]?.[tid]);
            if (hasFree) dayFreeCount += 1;
          });
          daysWithAnyFreeSlot[tid] = dayFreeCount;
        });

        DAYS.forEach(day => {
          activePeriods.forEach(period => {
            const map = teacherTimeSlot?.[day]?.[period];
            if (!map) return;
            Object.keys(map).forEach(tid => {
              busyCount[tid] = (busyCount[tid] || 0) + 1;
            });
          });
        });

        const overBooked = [];
        const dayLimited = [];
        classCourses.forEach(c => {
          const teacherId = courseTeacherMap[c.id];
          const need = freqMapOriginal[c.id] || 0;
          if (!teacherId || need <= 0) return;
          const free = totalSlots - (busyCount[teacherId] || 0);
          if (need > free) {
            overBooked.push({ subject: c.subject, teacher: teacherMap[teacherId] || teacherId, need, free });
          }

          // With rule: max 1 occurrence per subject per day, the teacher must have
          // at least `need` different weekdays with some free slot.
          const daysFree = Number(daysWithAnyFreeSlot?.[teacherId] || 0);
          if (need > daysFree) {
            dayLimited.push({ subject: c.subject, teacher: teacherMap[teacherId] || teacherId, need, daysFree });
          }
        });

        if (overBooked.length) {
          const list = overBooked
            .slice(0, 8)
            .map(x => `- ${x.subject} (${x.teacher}): needs ${x.need}, but only ${x.free} free slots`) 
            .join("\n");
          alert(
            `Warning: some teacher assignments appear impossible with other classes already scheduled.\n\n${list}` +
            `\n\nFix by changing teacher assignments, clearing other classes' schedules, or reducing weekly counts for those subjects.`
          );
        }

        if (dayLimited.length) {
          const list = dayLimited
            .slice(0, 8)
            .map(x => `- ${x.subject} (${x.teacher}): needs ${x.need} days, but teacher is only free on ${x.daysFree} days`)
            .join("\n");

          alert(
            `Note: the strict rule "max 1 per subject per day" cannot fit some weekly counts due to teacher weekday availability.\n\n${list}` +
            `\n\nTo keep max-1/day strictly, change teacher assignments, clear other classes' schedules, or lower weekly counts.`
          );
        }
      }

      // Shuffle courses to randomize placement
      const baseCourses = [...classCourses];
      if (missingFree > 0) {
        baseCourses.push({ id: FREE_ID, subject: FREE_SUBJECT });
      }
      const shuffledCourses = [...baseCourses].sort(() => Math.random() - 0.5);

      const freqMap = { ...freqMapOriginal };
      if (missingFree > 0) freqMap[FREE_ID] = missingFree;

      // Dynamic fair distribution quotas per subject (prevents deadlocks).
      // - weekly=5  => base=1, extra=0  => max 1/day (so it becomes 1 per day)
      // - weekly=6  => base=1, extra=1  => 1 per day, then one day gets a 2nd period
      // - weekly=11 => base=2, extra=1  => 2 per day, then one day gets a 3rd period
      // We also try to enforce "finish base across all days before using extras" first,
      // but relax that rule as a fallback to avoid generation failure.
      const subjectQuota = {};
      classCourses.forEach((course) => {
        const weekly = Number(freqMapOriginal?.[course.id] || 0);
        if (!weekly) return;

        // Enforce: no subject more than once per day
        const strictOnePerDay = true;
        // Represent all weekly counts as one-per-day caps.
        let basePerDay = 0;
        let extra = weekly; // at most one extra per day will be consumed
        subjectQuota[course.id] = {
          basePerDay,
          extraRemaining: extra,
          extraUsedByDay: Object.fromEntries(DAYS.map(d => [d, false])),
          usedByDay: Object.fromEntries(DAYS.map(d => [d, 0])),
          strictOnePerDay
        };
      });

      // Distribute auto-filled Free Periods across the week:
      // - 1 per day, then if more remain add another 1 per day, etc.
      // This prevents Free Periods from clustering into a single day.
      const freeTotal = Number(freqMap?.[FREE_ID] || 0);
      if (freeTotal > 0) {
        // Fair round-robin: 1 per day for all days, then 2 per day, etc.
        const freeQuotaByDay = Object.fromEntries(DAYS.map(d => [d, 0]));
        for (let i = 0; i < freeTotal; i++) {
          const day = DAYS[i % DAYS.length];
          freeQuotaByDay[day] += 1;
        }

        let placedFree = 0;
        DAYS.forEach((day) => {
          const quota = Math.min(activePeriods.length, Number(freeQuotaByDay[day] || 0));
          if (quota <= 0) return;

          // Pick periods to minimize adjacent Free Periods.
          // For 7 teachable periods/day, we can pick up to 4 without adjacency.
          const indices = activePeriods.map((_, idx) => idx);
          const evens = indices.filter(i => i % 2 === 0).sort(() => Math.random() - 0.5);
          const odds = indices.filter(i => i % 2 === 1).sort(() => Math.random() - 0.5);
          const useEvensFirst = Math.random() < 0.5;
          const ordered = useEvensFirst ? [...evens, ...odds] : [...odds, ...evens];
          const chosenPeriods = ordered
            .slice(0, quota)
            .map(i => activePeriods[i]);

          chosenPeriods.forEach((period) => {
            data[day][classKey][period] = {
              subject: FREE_SUBJECT,
              teacherId: null,
              teacherName: "Unassigned",
            };
            placedFree++;
          });
        });

        freqMap[FREE_ID] = Math.max(0, freeTotal - placedFree);
      }

      for (let day of DAYS) {
        let lastSubject = null;

        for (let period of activePeriods) {
          // If this slot was pre-filled (e.g. Free Period distribution), respect it.
          // Also update lastSubject so "subject - Free Period - subject" doesn't get blocked
          // by the consecutive-subject rule.
          const existing = data?.[day]?.[classKey]?.[period];
          if (existing?.subject) {
            lastSubject = normalizeSubject(existing.subject);
            continue;
          }

          let placed = false;
          // Heuristic: try higher-remaining-frequency courses first to avoid ending with
          // a single blocked subject late in the day.
          const candidates = [...shuffledCourses].sort((a, b) => {
            const da = (freqMap[a.id] || 0);
            const db = (freqMap[b.id] || 0);
            if (db !== da) return db - da;

            // Tie-break: prefer subjects that still have room today.
            const qa = subjectQuota[a.id];
            const qb = subjectQuota[b.id];
            const ra = qa ? Math.max(0, (qa.basePerDay + ((qa.extraUsedByDay[day] || qa.extraRemaining > 0) ? 1 : 0)) - (qa.usedByDay[day] || 0)) : 0;
            const rb = qb ? Math.max(0, (qb.basePerDay + ((qb.extraUsedByDay[day] || qb.extraRemaining > 0) ? 1 : 0)) - (qb.usedByDay[day] || 0)) : 0;
            if (rb !== ra) return rb - ra;

            // Prefer subjects that have been used less on this specific day to spread across weekdays
            const usedA = qa ? (qa.usedByDay?.[day] || 0) : 0;
            const usedB = qb ? (qb.usedByDay?.[day] || 0) : 0;
            if (usedA !== usedB) return usedA - usedB;

            return Math.random() - 0.5;
          });

          const reasonCounts = {
            noRemainingCount: 0,
            sameAsLastSubject: 0,
            teacherConflict: 0,
            consecutiveTeacher: 0,
            subjectMaxPerDay: 0,
            other: 0,
          };

          const unassignedSubjects = new Set();

          const tryPlace = (allowConsecutiveFree, allowEarlyExtras, allowConsecutiveTeacher) => {
            for (let course of candidates) {
              const teacherId = courseTeacherMap[course.id];
              const isFree = course.id === FREE_ID;

              if ((freqMap[course.id] || 0) <= 0) {
                reasonCounts.noRemainingCount++;
                continue;
              }

              // Avoid consecutive identical subjects.
              // Free Period is also avoided consecutively unless we must allow it.
              if (normalizeSubject(course.subject) === lastSubject) {
                if (!isFree || !allowConsecutiveFree) {
                  reasonCounts.sameAsLastSubject++;
                  continue;
                }
              }

              // Enforce per-day caps for subjects.
              if (!isFree) {
                const maxPerDay = getMaxPerDayForCourseId(course.id);
                if (countSubjectInDay(data, day, course.subject) >= maxPerDay) {
                  reasonCounts.subjectMaxPerDay++;
                  continue;
                }
                const q = subjectQuota[course.id];
                if (q) {
                  // Enforce no subject more than once per day
                  if (Number(q.usedByDay?.[day] || 0) >= 1) {
                    reasonCounts.subjectMaxPerDay++;
                    continue;
                  }
                  const usedToday = Number(q.usedByDay?.[day] || 0);
                  const base = Number(q.basePerDay || 0);
                  const alreadyUsedExtraToday = Boolean(q.extraUsedByDay?.[day]);
                  const allDaysMetBase = base <= 0
                    ? true
                    : DAYS.every(d => Number(q.usedByDay?.[d] || 0) >= base);

                  // If below base, always allowed.
                  if (usedToday < base) {
                    // ok
                  } else if (usedToday === base) {
                    // Would require consuming an extra for this day.
                    if (alreadyUsedExtraToday || (q.extraRemaining || 0) <= 0) {
                      reasonCounts.subjectMaxPerDay++;
                      continue;
                    }
                    // Prefer: only start using extras after the base is covered across all days.
                    if (!allowEarlyExtras && !allDaysMetBase) {
                      reasonCounts.subjectMaxPerDay++;
                      continue;
                    }
                  } else {
                    // usedToday > base => can only happen if this day already consumed the extra.
                    reasonCounts.subjectMaxPerDay++;
                    continue;
                  }
                }
              }

              if (course.id !== FREE_ID && !teacherId) {
                unassignedSubjects.add(course.subject);
              }

              // ===== CROSS-CLASS TEACHER CONFLICT =====
              if (teacherId && teacherTimeSlot[day][period]?.[teacherId]) {
                const freed =
                  tryFreeTeacherBySwappingWithinDay(data, teacherTimeSlot, day, period, teacherId) ||
                  tryFreeTeacherByMovingAcrossDays(data, teacherTimeSlot, day, period, teacherId);

                if (!freed) {
                  reasonCounts.teacherConflict++;
                  continue;
                }
              }

              // Avoid consecutive periods in the same class
              if (teacherId) {
                const lastPeriodIndex = lastTeacherPeriodByDay?.[day]?.[classKey]?.[teacherId];
                if (!allowConsecutiveTeacher && lastPeriodIndex === activePeriods.indexOf(period) - 1) {
                  reasonCounts.consecutiveTeacher++;
                  continue;
                }
              }

              // (Max/day handled by subjectQuota above.)

              // ===== ASSIGN =====
              data[day][classKey][period] = {
                subject: course.subject,
                teacherId: teacherId || null,
                teacherName: teacherMap[teacherId] || "Unassigned"
              };

              // Update trackers
              teacherTimeSlot[day][period] ??= {};
              if (teacherId) {
                teacherTimeSlot[day][period][teacherId] = true;
                lastTeacherPeriodByDay[day] ??= {};
                lastTeacherPeriodByDay[day][classKey] ??= {};
                lastTeacherPeriodByDay[day][classKey][teacherId] = activePeriods.indexOf(period);
              }

              freqMap[course.id]--;
              if (!isFree) {
                const q = subjectQuota[course.id];
                if (q) {
                  const usedBefore = Number(q.usedByDay?.[day] || 0);
                  const base = Number(q.basePerDay || 0);
                  // If this placement is the (base+1)th today, consume an extra for this day.
                  if (usedBefore === base && !q.extraUsedByDay[day]) {
                    q.extraUsedByDay[day] = true;
                    q.extraRemaining = Math.max(0, Number(q.extraRemaining || 0) - 1);
                  }
                  q.usedByDay[day] = usedBefore + 1;
                }
              }
              lastSubject = normalizeSubject(course.subject);
              placed = true;
              break;
            }
          };

          // Pass 1: do not allow consecutive Free Periods.
          // Also prefer: don't use "extra" periods for a subject until it's placed base-per-day.
          tryPlace(false, false, false);
          // Pass 2 fallback: allow early extras (still no consecutive Free Periods).
          if (!placed) tryPlace(false, true, false);
          // Pass 3 fallback: allow consecutive teacher periods within the same class (still respects cross-class conflicts)
          if (!placed) tryPlace(false, true, true);

          if (!placed) {
            // Deadlock recovery
            // 1) Try targeted relocation: move an already-placed lesson into this slot,
            //    and place the needed subject into the vacated slot (keeps counts, avoids clashes).
            // 2) If that fails, fall back to local randomized swaps.
            const candidatesIds = Object.keys(freqMap).filter(id => (Number(freqMap[id]) || 0) > 0);
            const occupiedSlots = [];
            for (const dd of DAYS) {
              for (const pp of activePeriods) {
                const it = data?.[dd]?.[classKey]?.[pp];
                if (it && it.subject) occupiedSlots.push({ day: dd, period: pp });
              }
            }

            let swapSuccess = false;
            const MAX_SWAP_TRIES = 400;
            const randInt = (n) => Math.floor(Math.random() * n);

            const canPlaceSubjectInDay = (dataRef, dd, subject) => {
              const s = normalizeSubject(subject);
              if (!s) return true;
              const maxPerDay = getMaxPerDayForSubject(subject);
              if (!Number.isFinite(maxPerDay)) return true;
              return countSubjectInDay(dataRef, dd, subject) < maxPerDay;
            };

            const applyTeacherMove = (from, to, cell) => {
              // Remove teacher from old slot
              if (cell?.teacherId) {
                if (teacherTimeSlot?.[from.day]?.[from.period]) {
                  delete teacherTimeSlot[from.day][from.period][cell.teacherId];
                }
              }
              // Add teacher to new slot
              teacherTimeSlot[to.day] ??= {};
              teacherTimeSlot[to.day][to.period] ??= {};
              if (cell?.teacherId) {
                teacherTimeSlot[to.day][to.period][cell.teacherId] = true;
              }
            };

            const rebuildTeacherTimeSlotAll = (dataRef) => {
              DAYS.forEach(dd => {
                teacherTimeSlot[dd] = {};
                PERIODS.forEach(pp => {
                  teacherTimeSlot[dd][pp] = {};
                });
              });

              for (const dd of DAYS) {
                const dayBucket = dataRef?.[dd] || {};
                for (const classKey of Object.keys(dayBucket)) {
                  const classBucket = dayBucket?.[classKey];
                  if (!classBucket || typeof classBucket !== "object") continue;
                  for (const pp of PERIODS) {
                    if (pp === "LUNCH" || pp === "Break") continue;
                    const cell = classBucket?.[pp];
                    if (!cell?.teacherId) continue;
                    teacherTimeSlot[dd][pp] ??= {};
                    teacherTimeSlot[dd][pp][cell.teacherId] = true;
                  }
                }
              }
            };

            const rebuildLastTeacherForClassDay = (dataRef, dd) => {
              lastTeacherPeriodByDay[dd] ??= {};
              lastTeacherPeriodByDay[dd][classKey] = {};
              activePeriods.forEach((pp, idx) => {
                const cell = dataRef?.[dd]?.[classKey]?.[pp];
                if (!cell?.teacherId) return;
                lastTeacherPeriodByDay[dd][classKey][cell.teacherId] = idx;
              });
            };

            // Targeted relocation attempt
            for (const candId of candidatesIds) {
              if (swapSuccess) break;
              const candTeacher = courseTeacherMap[candId];
              const candSubject = candId === FREE_ID
                ? FREE_SUBJECT
                : (courses.find(c => c.id === candId)?.subject || "");

              // Don't place a real subject twice in the same day
              if (candId !== FREE_ID && !canPlaceSubjectInDay(data, day, candSubject)) continue;

              // Teacher must be free at the target period (cross-class).
              // Do not rearrange other classes.
              if (candTeacher && teacherTimeSlot?.[day]?.[period]?.[candTeacher]) continue;

              for (const slot2 of occupiedSlots) {
                if (swapSuccess) break;
                if (slot2.day === day && slot2.period === period) continue;

                const cell2 = data?.[slot2.day]?.[classKey]?.[slot2.period];
                if (!cell2?.subject) continue;

                // 1) Can we move cell2 into the blocked target slot?
                if (!canPlaceSubjectInDay(data, day, cell2.subject)) continue;
                if (cell2.teacherId && teacherTimeSlot?.[day]?.[period]?.[cell2.teacherId]) continue;

                // 2) Can we place the candidate into slot2?
                if (candId !== FREE_ID && !canPlaceSubjectInDay(data, slot2.day, candSubject)) continue;
                if (candTeacher && teacherTimeSlot?.[slot2.day]?.[slot2.period]?.[candTeacher]) continue;

                // Apply: move cell2 -> target, place candidate -> slot2
                data[day][classKey][period] = cell2;
                applyTeacherMove({ day: slot2.day, period: slot2.period }, { day, period }, cell2);

                data[slot2.day][classKey][slot2.period] = {
                  subject: candSubject,
                  teacherId: candTeacher || null,
                  teacherName: teacherMap[candTeacher] || "Unassigned",
                };
                applyTeacherMove({ day, period }, { day: slot2.day, period: slot2.period }, {
                  teacherId: candTeacher || null,
                });

                // Decrement remaining for the candidate only (cell2 is just moved)
                freqMap[candId] = Math.max(0, Number(freqMap[candId] || 0) - 1);

                // Rebuild per-day usage counters for affected days
                const daysToUpdate = new Set([day, slot2.day]);
                daysToUpdate.forEach(d => rebuildUsedByDayForDay(data, d, subjectQuota));

                // Keep cross-class teacher conflicts and consecutive-teacher tracker consistent
                rebuildTeacherTimeSlotAll(data);
                rebuildLastTeacherForClassDay(data, day);
                rebuildLastTeacherForClassDay(data, slot2.day);

                swapSuccess = true;
              }
            }

            // Random swap fallback (legacy)
            for (const candId of candidatesIds) {
              if (swapSuccess) break;
              const candTeacher = courseTeacherMap[candId];
              const candSubject = courses.find(c => c.id === candId)?.subject || "";

              // If course has no teacher, placing it directly will help.
              if (!candTeacher) {
                if (candSubject && countSubjectInDay(data, day, candSubject) >= getMaxPerDayForSubject(candSubject)) {
                  continue;
                }
                data[day][classKey][period] = {
                  subject: candSubject,
                  teacherId: null,
                  teacherName: "Unassigned"
                };
                freqMap[candId]--;
                if (subjectQuota[candId]) {
                  subjectQuota[candId].usedByDay[day] = 1;
                  subjectQuota[candId].extraUsedByDay[day] = true;
                }
                swapSuccess = true;
                break;
              }

              for (let t = 0; t < MAX_SWAP_TRIES && !swapSuccess; t++) {
                if (occupiedSlots.length < 2) break;
                const i = randInt(occupiedSlots.length);
                const j = randInt(occupiedSlots.length - 1);
                const a = occupiedSlots[i];
                const b = occupiedSlots[j >= i ? j+1 : j];

                // avoid touching the target slot
                if ((a.day === day && a.period === period) || (b.day === day && b.period === period)) continue;

                const cloneData = structuredClone(data);

                // swap subjects between a and b
                const sa = cloneData[a.day][classKey][a.period];
                const sb = cloneData[b.day][classKey][b.period];
                cloneData[a.day][classKey][a.period] = sb;
                cloneData[b.day][classKey][b.period] = sa;

                if (sb?.subject && countSubjectInDay(cloneData, a.day, sb.subject) > getMaxPerDayForSubject(sb.subject)) continue;
                if (sa?.subject && countSubjectInDay(cloneData, b.day, sa.subject) > getMaxPerDayForSubject(sa.subject)) continue;
                if (candSubject && countSubjectInDay(cloneData, day, candSubject) >= getMaxPerDayForSubject(candSubject)) continue;

                // rebuild teacherTimeSlot for clone across ALL classes (cross-class conflict)
                const tts = {};
                for (const dd of DAYS) {
                  tts[dd] = {};
                  for (const pp of PERIODS) tts[dd][pp] = {};
                }
                for (const dd of DAYS) {
                  const dayBucket = cloneData?.[dd] || {};
                  for (const classKey of Object.keys(dayBucket)) {
                    const classBucket = dayBucket?.[classKey];
                    if (!classBucket || typeof classBucket !== "object") continue;
                    for (const pp of PERIODS) {
                      if (pp === "LUNCH" || pp === "Break") continue;
                      const cell = classBucket?.[pp];
                      if (!cell?.teacherId) continue;
                      tts[dd][pp] ??= {};
                      tts[dd][pp][cell.teacherId] = true;
                    }
                  }
                }

                // check if candidate teacher is free at target in clone
                if (!tts[day][period] || !tts[day][period][candTeacher]) {
                  // Apply swap in-place on the real `data` (do not reassign const variable)
                  const sa_real = data[a.day][classKey][a.period];
                  const sb_real = data[b.day][classKey][b.period];
                  data[a.day][classKey][a.period] = sb_real;
                  data[b.day][classKey][b.period] = sa_real;

                  // Rebuild teacherTimeSlot from updated data across ALL classes
                  DAYS.forEach(dd => {
                    teacherTimeSlot[dd] = {};
                    PERIODS.forEach(pp => {
                      teacherTimeSlot[dd][pp] = {};
                    });
                  });
                  for (const dd of DAYS) {
                    const dayBucket = data?.[dd] || {};
                    for (const classKey of Object.keys(dayBucket)) {
                      const classBucket = dayBucket?.[classKey];
                      if (!classBucket || typeof classBucket !== "object") continue;
                      for (const pp of PERIODS) {
                        if (pp === "LUNCH" || pp === "Break") continue;
                        const cell = classBucket?.[pp];
                        if (!cell?.teacherId) continue;
                        teacherTimeSlot[dd][pp] ??= {};
                        teacherTimeSlot[dd][pp][cell.teacherId] = true;
                      }
                    }
                  }

                  // Place candidate in target slot
                  data[day][classKey][period] = {
                    subject: candSubject,
                    teacherId: candTeacher || null,
                    teacherName: teacherMap[candTeacher] || "Unassigned"
                  };

                  // decrement freq for candidate
                  freqMap[candId] = Math.max(0, Number(freqMap[candId] || 0) - 1);
                  const daysToUpdate = new Set([a.day, b.day, day]);
                  daysToUpdate.forEach(d => rebuildUsedByDayForDay(data, d, subjectQuota));
                  swapSuccess = true;
                }
              }
            }

            if (!swapSuccess) {
              const err = new Error("Deadlock: unable to place subjects without violating constraints");

              const remainingIds = Object.keys(freqMap).filter(id => (Number(freqMap[id]) || 0) > 0);
              const remainingDetails = remainingIds.slice(0, 8).map((id) => {
                const subj = id === FREE_ID ? FREE_SUBJECT : (courses.find(c => c.id === id)?.subject || id);
                const tid = courseTeacherMap?.[id];
                const tname = tid ? (teacherMap?.[tid] || tid) : "Unassigned";
                const busy = tid ? Boolean(teacherTimeSlot?.[day]?.[period]?.[tid]) : false;
                const usedToday = subj ? countSubjectInDay(data, day, subj) : 0;
                const busyWhere = tid
                  ? Object.keys((data?.[day] || {})).find((ck) => data?.[day]?.[ck]?.[period]?.teacherId === tid)
                  : null;
                return {
                  id,
                  subject: subj,
                  teacher: tname,
                  busy,
                  busyWhere,
                  usedToday,
                };
              });

              err.meta = {
                selectedClassKey: classKey,
                attempt,
                day,
                period,
                lastSubject,
                remainingTotal: Object.values(freqMap).reduce((a, b) => a + (Number(b) || 0), 0),
                reasonCounts,
                unassignedSubjects: Array.from(unassignedSubjects),
                remainingDetails,
              };
              throw err;
            }
          }
        }
      }

      // Final safety check: do not accept any cross-grade/section teacher overlaps.
      const clashes = findTeacherClashes(data);
      if (clashes.length) {
        const err = new Error("Teacher overlap detected across classes");
        err.meta = {
          selectedClassKey: classKey,
          attempt,
          clashCount: clashes.length,
          firstClash: clashes[0],
        };
        throw err;
      }

      scheduleRef.current = data;
      if (returnData) {
        return data;
      }
      setSchedule(data);
      calculateTeacherWorkload(data);
      console.log(`✅ Timetable for ${classKey} generated successfully`);
      return;

    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        const meta = err?.meta;
        if (!interactive) {
          console.error(err);
          return;
        }

        if (meta) {
          const topReasons = Object.entries(meta.reasonCounts || {})
            .sort((a, b) => (b[1] || 0) - (a[1] || 0))
            .filter(([, v]) => (v || 0) > 0)
            .slice(0, 4)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n");

          const unassigned = (meta.unassignedSubjects || []).length
            ? `\n\nCourses missing teacher assignment (these often cause conflicts):\n- ${meta.unassignedSubjects.join("\n- ")}`
            : "";

          const remaining = (meta.remainingDetails || []).length
            ? `\n\nTop remaining subjects (first 8):\n` +
              meta.remainingDetails.map((x) => {
                const where = x.busyWhere ? ` (busy in ${x.busyWhere})` : "";
                const used = x.usedToday ? `, used today: ${x.usedToday}` : "";
                const busy = x.busy ? "BUSY" : "free";
                return `- ${x.subject} — ${x.teacher} (${busy}${where}${used})`;
              }).join("\n")
            : "";

          alert(
            `Unable to generate timetable after multiple attempts.\n\n` +
            `Stopped at: ${meta.day} / ${meta.period}\n` +
            `Remaining periods to place: ${meta.remainingTotal}\n\n` +
            `Most common blockers at that slot:\n${topReasons || "(no details)"}` +
            `${unassigned}` +
            `${remaining}\n\n` +
            `Rules enforced: max 1 subject per day, no consecutive Free periods.\n\n` +
            `Try: (1) ensure weekly subject total = ${totalSlots}, (2) reduce high-frequency subjects, (3) change teacher assignments so the same teacher isn't needed in two classes at the same time.`
          );
        } else {
          alert("Unable to generate timetable after multiple attempts. Rules enforced: max 1 subject per day, no consecutive Free periods. Try adjusting weekly subject counts or teacher assignments.");
        }

        console.error(err);
      }
    }
  }
};

  const applyGlobalWeeklyToAllClasses = () => {
    const next = {};
    Object.keys(classes || {}).forEach((grade) => {
      const sections = [...(classes?.[grade] || [])];
      sections.forEach((section) => {
        const classKey = `Grade ${grade}${section}`;
        const classCourses = (courses || []).filter(
          (c) => String(c?.grade) === String(grade) && String(c?.section) === String(section)
        );
        const map = {};
        classCourses.forEach((c) => {
          const subjectKey = normalizeSubjectKey(c.subject);
          const v = Number(globalWeekly?.[grade]?.[subjectKey] ?? 0);
          map[c.id] = Number.isFinite(v) ? Math.max(0, v) : 0;
        });
        next[classKey] = map;
      });
    });
    setWeeklyFrequency((prev) => ({ ...prev, ...next }));
  };

  const generateAllClasses = async () => {
    if (generatingAll) return;

    // Only generate for the classes the user explicitly added.
    const classKeys = (() => {
      const list = (classesToGenerate && classesToGenerate.length) ? [...classesToGenerate] : [];
      const seen = new Set();
      const deduped = [];
      for (const item of list) {
        const key = normalizeClassKey(item?.classKey);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
      }
      return deduped;
    })();

    if (!classKeys.length) {
      alert("Add class(es) first using + Add Class");
      return;
    }

    try {
      setGeneratingAll(true);

      // Clear all classes before generating to avoid cross-class teacher conflicts.
      const base = {};
      DAYS.forEach((day) => {
        base[day] = {};
      });

      const nextWeekly = {};
      let data = base;
      const failures = [];

      for (const { grade, section, classKey } of classKeys) {
        const classCourses = (courses || []).filter(
          (c) => String(c?.grade) === String(grade) && String(c?.section) === String(section)
        );

        const raw = weeklyFrequency?.[classKey] || {};
        const freqByCourseId = {};
        classCourses.forEach((c) => {
          const v = Number(raw?.[c.id] ?? 0);
          freqByCourseId[c.id] = Number.isFinite(v) ? Math.max(0, v) : 0;
        });
        nextWeekly[classKey] = { ...freqByCourseId };

        const out = autoGenerate({
          classKey,
          classCourses,
          rawFreq: freqByCourseId,
          interactive: false,
          returnData: true,
          baseSchedule: data,
        });

        if (!out) {
          failures.push(classKey);
          continue;
        }
        data = out;
      }

      scheduleRef.current = data;
      setSchedule(data);
      setWeeklyFrequency((prev) => ({ ...prev, ...nextWeekly }));
      if (selectedClassKey) calculateTeacherWorkload(data);

      if (failures.length) {
        alert(
          `Generated timetables, but some classes failed:\n\n- ${failures.slice(0, 12).join("\n- ")}` +
            (failures.length > 12 ? `\n\n(and ${failures.length - 12} more...)` : "")
        );
        return;
      }

      alert("All added class timetables generated. Click 'Save All' to save to the database.");
    } finally {
      setGeneratingAll(false);
    }
  };

  const saveAllAddedClasses = async () => {
    if (savingAllAdded) return;

    const classKeys = (() => {
      const list = (classesToGenerate && classesToGenerate.length) ? [...classesToGenerate] : [];
      const seen = new Set();
      const deduped = [];
      for (const item of list) {
        const key = normalizeClassKey(item?.classKey);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(key);
      }
      return deduped;
    })();

    if (!classKeys.length) {
      alert("Add class(es) first using + Add Class");
      return;
    }

    try {
      setSavingAllAdded(true);
      const data = scheduleRef.current || schedule || {};
      const cleaned = sanitizeForFirebase(data);
      await set(ref(db, getSchoolNodePath("Schedules")), cleaned);
      alert("Saved all added class timetables to the database.");
    } catch (err) {
      console.error("Save all failed:", err);
      alert("Failed to save. Please try again.");
    } finally {
      setSavingAllAdded(false);
    }
  };

  const onDragEnd = res => {
    setDragHint(null);
    if (!res.destination) return;
    if (!selectedClassKey) return;
    const srcDay = res.source.droppableId;
    const dstDay = res.destination.droppableId;
    const src = res.source.index;
    const dst = res.destination.index;
    const active = PERIODS.filter(p => p !== "LUNCH" && p !== "Break");
    const p1 = active[src];
    const p2 = active[dst];
    if (!p1 || !p2) return;
    const updated = structuredClone(schedule);
    if (!updated?.[srcDay]?.[selectedClassKey]) return;
    if (!updated?.[dstDay]?.[selectedClassKey]) return;

    const isTeacherBusy = (targetDay, targetPeriod, teacherId, excludeClassKey) => {
      if (!teacherId) return false;
      const dayBucket = updated?.[targetDay] || {};
      return Object.keys(dayBucket).some((classKey) => {
        if (classKey === excludeClassKey) return false;
        return dayBucket?.[classKey]?.[targetPeriod]?.teacherId === teacherId;
      });
    };

    const cell1 = updated[srcDay][selectedClassKey][p1];
    const cell2 = updated[dstDay][selectedClassKey][p2];
    const t1 = cell1?.teacherId || null;
    const t2 = cell2?.teacherId || null;

    if (t1 && isTeacherBusy(dstDay, p2, t1, selectedClassKey)) {
      alert("Cannot swap: teacher in the first period is already teaching another class at the target period.");
      return;
    }
    if (t2 && isTeacherBusy(srcDay, p1, t2, selectedClassKey)) {
      alert("Cannot swap: teacher in the second period is already teaching another class at the target period.");
      return;
    }

    [updated[srcDay][selectedClassKey][p1], updated[dstDay][selectedClassKey][p2]] =
      [updated[dstDay][selectedClassKey][p2], updated[srcDay][selectedClassKey][p1]];
    setSchedule(updated);
    calculateTeacherWorkload(updated);
  };

  const onDragUpdate = (res) => {
    if (!selectedClassKey) {
      setDragHint(null);
      return;
    }
    if (!res.destination) {
      setDragHint(null);
      return;
    }

    const day = res.destination.droppableId;
    const active = PERIODS.filter(p => p !== "LUNCH" && p !== "Break");
    const srcPeriod = active[res.source.index];
    const dstPeriod = active[res.destination.index];
    if (!srcPeriod || !dstPeriod) {
      setDragHint(null);
      return;
    }

    const srcDay = res.source.droppableId;
    const dstDay = res.destination.droppableId;
    const srcBucket = schedule?.[srcDay] || {};
    const dstBucket = schedule?.[dstDay] || {};
    const classSrcBucket = srcBucket?.[selectedClassKey] || {};
    const classDstBucket = dstBucket?.[selectedClassKey] || {};
    const cellSrc = classSrcBucket?.[srcPeriod];
    const cellDst = classDstBucket?.[dstPeriod];
    const t1 = cellSrc?.teacherId || null;
    const t2 = cellDst?.teacherId || null;

    const isTeacherBusy = (targetDay, targetPeriod, teacherId) => {
      if (!teacherId) return false;
      const dayBucket = schedule?.[targetDay] || {};
      return Object.keys(dayBucket).some((classKey) => {
        if (classKey === selectedClassKey) return false;
        return dayBucket?.[classKey]?.[targetPeriod]?.teacherId === teacherId;
      });
    };

    const invalid =
      (t1 && isTeacherBusy(dstDay, dstPeriod, t1)) ||
      (t2 && isTeacherBusy(srcDay, srcPeriod, t2));

    setDragHint({ day: dstDay, period: dstPeriod, status: invalid ? "invalid" : "valid" });
  };

  const saveSchedule = async (classKeyOverride) => {
    try {
      const data = scheduleRef.current || schedule || {};
      if (!data || Object.keys(data).length === 0) {
        alert("No schedule to save yet.");
        return;
      }

      const targetClassKey = classKeyOverride || selectedClassKey;
      if (!targetClassKey) {
        alert("Select grade & section first");
        return;
      }

      const perDayWrites = DAYS.map((day) => {
        const classBucket = data?.[day]?.[targetClassKey] || {};
        const cleanedBucket = sanitizeForFirebase(classBucket);
        return set(
          ref(db, `${getSchoolNodePath("Schedules")}/${day}/${targetClassKey}`),
          cleanedBucket
        );
      });

      await Promise.all(perDayWrites);
      alert("Class timetable saved successfully");
    } catch (err) {
      console.error("Schedule save failed:", err);
      alert(
        `Failed to save schedule.\n\n${err?.message || err}` +
        `\n\nCommon causes: Firebase rules deny write, or the schedule contains invalid values (e.g., undefined).`
      );
    }
  };

  const downloadScheduleExcel = async (classKeyOverride, gradeOverride, sectionOverride) => {
    try {
      const targetClassKey = classKeyOverride || selectedClassKey;
      const targetGrade = gradeOverride || selectedGrade;
      const targetSection = sectionOverride || selectedSection;

      if (!targetClassKey) {
        alert("Select grade & section first");
        return;
      }

      const classHasAny = DAYS.some(day => {
        return PERIODS.some(p => {
          if (p === "LUNCH") return false;
          if (p === "Break") return false;
          return Boolean((scheduleRef.current || schedule)?.[day]?.[targetClassKey]?.[p]?.subject);
        });
      });

      if (!classHasAny) {
        alert("No timetable found for this class yet. Generate or fill it first.");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Gojo Admin";
      workbook.created = new Date();

      const schoolName = admin?.schoolName || admin?.school || "School Name";

      const sheetName = targetClassKey.length > 31
        ? targetClassKey.slice(0, 31)
        : targetClassKey;
      const ws = workbook.addWorksheet(sheetName);

      const headerRowIndex = 5;
      const totalColumns = DAYS.length + 1;

      ws.addRow([`School: ${schoolName}`]);
      ws.mergeCells(1, 1, 1, totalColumns);

      ws.addRow([`Grade: ${targetGrade || ""}`]);
      ws.mergeCells(2, 1, 2, totalColumns);

      ws.addRow([`Section: ${targetSection || ""}`]);
      ws.mergeCells(3, 1, 3, totalColumns);

      ws.addRow([]);

      const header = ["Period", ...DAYS];
      ws.addRow(header);

      ws.views = [{ state: "frozen", ySplit: headerRowIndex, xSplit: 1 }];

      PERIODS.forEach(p => {
        const row = [p];

        if (p === "Break") {
          DAYS.forEach(() => row.push("Break"));
          ws.addRow(row);
          return;
        }
        if (p === "LUNCH") {
          DAYS.forEach(() => row.push("Lunch"));
          ws.addRow(row);
          return;
        }

        DAYS.forEach(day => {
          const cell = (scheduleRef.current || schedule)?.[day]?.[targetClassKey]?.[p];
          const subject = cell?.subject || "";
          const teacher = cell?.teacherName ? `(${cell.teacherName})` : "";
          row.push(subject ? `${subject}${teacher ? `\n${teacher}` : ""}` : "");
        });
        ws.addRow(row);
      });

      // Column widths
      ws.getColumn(1).width = 20;
      for (let i = 2; i <= DAYS.length + 1; i++) {
        ws.getColumn(i).width = 28;
      }

      // Top info styling
      const titleRow = ws.getRow(1);
      titleRow.height = 28;
      titleRow.getCell(1).font = { bold: true, size: 18, color: { argb: "FF0F172A" } };
      titleRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };

      const infoRow2 = ws.getRow(2);
      infoRow2.height = 18;
      infoRow2.getCell(1).font = { bold: true, size: 12, color: { argb: "FF334155" } };
      infoRow2.getCell(1).alignment = { vertical: "middle", horizontal: "center" };

      const infoRow3 = ws.getRow(3);
      infoRow3.height = 18;
      infoRow3.getCell(1).font = { bold: true, size: 12, color: { argb: "FF334155" } };
      infoRow3.getCell(1).alignment = { vertical: "middle", horizontal: "center" };

      ws.getRow(4).height = 10;

      // Style header
      const headerRow = ws.getRow(headerRowIndex);
      headerRow.height = 22;
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      // Style cells + borders
      const border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (rowNumber > headerRowIndex) row.height = 44;
        row.eachCell({ includeEmpty: true }, (cell) => {
          if (rowNumber >= headerRowIndex) cell.border = border;
          if (rowNumber > headerRowIndex) {
            cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          }
        });
      });

      // Highlight Break/Lunch rows
      const breakRowIndex = PERIODS.findIndex(x => x === "Break");
      if (breakRowIndex >= 0) {
        const r = ws.getRow(headerRowIndex + 1 + breakRowIndex);
        r.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
          cell.font = { bold: true };
        });
      }
      const lunchRowIndex = PERIODS.findIndex(x => x === "LUNCH");
      if (lunchRowIndex >= 0) {
        const r = ws.getRow(headerRowIndex + 1 + lunchRowIndex);
        r.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
          cell.font = { bold: true };
        });
      }

      const filenameSafeClass = targetClassKey.replace(/[\\/:*?"<>|]/g, "-");
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }),
        `${filenameSafeClass}-timetable.xlsx`
      );
    } catch (err) {
      console.error("Excel download failed:", err);
      alert(`Failed to download Excel file.\n\n${err?.message || err}`);
    }
  };

  const downloadSchedulePdf = (classKeyOverride, gradeOverride, sectionOverride) => {
    try {
      const targetClassKey = classKeyOverride || selectedClassKey;
      const targetGrade = gradeOverride || selectedGrade;
      const targetSection = sectionOverride || selectedSection;

      if (!targetClassKey) {
        alert("Select grade & section first");
        return;
      }

      const classHasAny = DAYS.some(day => {
        return PERIODS.some(p => {
          if (p === "LUNCH") return false;
          if (p === "Break") return false;
          return Boolean((scheduleRef.current || schedule)?.[day]?.[targetClassKey]?.[p]?.subject);
        });
      });

      if (!classHasAny) {
        alert("No timetable found for this class yet. Generate or fill it first.");
        return;
      }

      const schoolName = admin?.schoolName || admin?.school || "School Name";
      const filenameSafeClass = targetClassKey.replace(/[\\/:*?"<>|]/g, "-");
      const fileName = `${filenameSafeClass}-timetable.pdf`;

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const marginX = 40;
      const headerY = 32;
      const headerHeight = 56;

      // Header bar
      doc.setFillColor(29, 78, 216);
      doc.rect(marginX, headerY, doc.internal.pageSize.getWidth() - marginX * 2, headerHeight, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text("Class Timetable", marginX + 16, headerY + 24);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(`School: ${schoolName}`, marginX + 16, headerY + 42);
      doc.text(`Grade: ${targetGrade || ""}   Section: ${targetSection || ""}`, marginX + 250, headerY + 42);
      doc.text(`Class: ${targetClassKey}`, marginX + 520, headerY + 42);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, headerY + headerHeight + 18);

      const head = [["Period", ...DAYS]];
      const body = PERIODS.map(p => {
        if (p === "Break") return ["Break", ...DAYS.map(() => "Break")];
        if (p === "LUNCH") return ["Lunch", ...DAYS.map(() => "Lunch")];

        return [
          p,
          ...DAYS.map(day => {
            const cell = (scheduleRef.current || schedule)?.[day]?.[targetClassKey]?.[p];
            const subject = cell?.subject || "";
            const teacher = cell?.teacherName ? `(${cell.teacherName})` : "";
            return subject ? `${subject}${teacher ? `\n${teacher}` : ""}` : "";
          })
        ];
      });

      autoTable(doc, {
        startY: headerY + headerHeight + 28,
        head,
        body,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 9.5,
          cellPadding: 6,
          valign: "middle",
          lineColor: [226, 232, 240],
          lineWidth: 0.7,
        },
        headStyles: {
          fillColor: [29, 78, 216],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          textColor: [15, 23, 42],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 90, fontStyle: "bold" },
        },
        didParseCell: (data) => {
          if (data.section !== "body") return;
          const rowLabel = String(data.row.raw?.[0] || "");
          if (rowLabel.toLowerCase() === "break") {
            data.cell.styles.fillColor = [209, 250, 229];
            data.cell.styles.fontStyle = "bold";
          }
          if (rowLabel.toLowerCase() === "lunch") {
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.fontStyle = "bold";
          }
          const cellText = String(data.cell.raw || "");
          if (cellText.toLowerCase().includes("free period")) {
            data.cell.styles.fillColor = [224, 242, 254];
            data.cell.styles.textColor = [3, 105, 161];
            data.cell.styles.fontStyle = "bold";
          }
        }
      });

      doc.save(fileName);
    } catch (err) {
      console.error("PDF download failed:", err);
      alert(`Failed to download PDF file.\n\n${err?.message || err}`);
    }
  };

  const downloadAllClassesPdf = () => {
    try {
      const classList = (classesToGenerateUnique || []).filter((c) => c?.classKey);
      if (!classList.length) {
        alert("Add class(es) first using + Add Class");
        return;
      }

      const data = scheduleRef.current || schedule || {};
      const activePeriods = PERIODS.filter(p => p !== "LUNCH" && p !== "Break");

      const hasAny = classList.some(({ classKey }) =>
        DAYS.some(day =>
          activePeriods.some(p => Boolean(data?.[day]?.[classKey]?.[p]?.subject))
        )
      );

      if (!hasAny) {
        alert("No timetables found yet. Generate first.");
        return;
      }

      const schoolName = admin?.schoolName || admin?.school || "School Name";
      const fileName = "All-Classes-Timetable.pdf";

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const marginX = 32;
      const headerY = 24;
      const headerHeight = 52;

      doc.setFillColor(29, 78, 216);
      doc.rect(marginX, headerY, doc.internal.pageSize.getWidth() - marginX * 2, headerHeight, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text("All Classes Timetable", marginX + 14, headerY + 22);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(`School: ${schoolName}`, marginX + 14, headerY + 40);
      doc.text(`Classes: ${classList.length}`, marginX + 320, headerY + 40);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, headerY + headerHeight + 16);

      const head = [["Class", "Day", ...activePeriods]];
      const body = [];

      classList.forEach(({ classKey }) => {
        DAYS.forEach((day) => {
          const row = [
            classKey,
            day,
            ...activePeriods.map((p) => {
              const cell = data?.[day]?.[classKey]?.[p];
              const subject = cell?.subject || "";
              const teacher = cell?.teacherName ? `(${cell.teacherName})` : "";
              return subject ? `${subject}${teacher ? `\n${teacher}` : ""}` : "";
            })
          ];
          body.push(row);
        });
      });

      autoTable(doc, {
        startY: headerY + headerHeight + 24,
        head,
        body,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8.5,
          cellPadding: 4,
          valign: "middle",
          lineColor: [226, 232, 240],
          lineWidth: 0.6,
        },
        headStyles: {
          fillColor: [29, 78, 216],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 110, fontStyle: "bold" },
          1: { cellWidth: 70, fontStyle: "bold" },
        },
        didParseCell: (tableData) => {
          if (tableData.section !== "body") return;
          const dayLabel = String(tableData.row.raw?.[1] || "");
          if (dayLabel === "Monday") {
            tableData.cell.styles.fillColor = [224, 242, 254];
          }
          const cellText = String(tableData.cell.raw || "");
          if (cellText.toLowerCase().includes("free period")) {
            tableData.cell.styles.fillColor = [224, 242, 254];
            tableData.cell.styles.textColor = [3, 105, 161];
            tableData.cell.styles.fontStyle = "bold";
          }
        }
      });

      doc.save(fileName);
    } catch (err) {
      console.error("Download all PDF failed:", err);
      alert(`Failed to download PDF file.\n\n${err?.message || err}`);
    }
  };

  const analyzeGenerateProblems = (classKeyOverride, gradeOverride, sectionOverride) => {
    const targetClassKey = classKeyOverride || selectedClassKey;
    const targetGrade = gradeOverride || selectedGrade;
    const targetSection = sectionOverride || selectedSection;
    if (!targetClassKey) { alert('Select grade & section first'); return; }
    const activePeriods = PERIODS.filter(p => p !== 'LUNCH' && p !== 'Break');
    const totalSlots = DAYS.length * activePeriods.length;

    const rawFreq = weeklyFrequency?.[targetClassKey] || {};
    const freqMapLocal = {};
    const classCourses = (courses || []).filter(
      (c) => String(c?.grade) === String(targetGrade) && String(c?.section) === String(targetSection)
    );
    classCourses.forEach(c => { freqMapLocal[c.subject] = Number(rawFreq?.[c.id] || 0); });
    const sumFreq = Object.values(freqMapLocal).reduce((a,b) => a + (Number(b)||0), 0);

    const missingTeachers = classCourses.filter(c => !courseTeacherMap[c.id]).map(c => c.subject);

    // teacher -> courses (ids)
    const teacherCourses = {};
    Object.entries(courseTeacherMap).forEach(([courseId, tid]) => {
      const course = courses.find(x => x.id === courseId);
      if (!course) return;
      teacherCourses[tid] ??= [];
      teacherCourses[tid].push(`${course.grade}-${course.section}: ${course.subject}`);
    });

    const teacherOverloads = Object.entries(teacherCourses)
      .map(([t, list]) => ({ teacherId: t, count: list.length, list }))
      .sort((a,b) => b.count - a.count)
      .slice(0,10);

    let msg = `Class: ${targetClassKey}\nWeekly slots: ${totalSlots}\nSum of weekly frequencies: ${sumFreq}\n\n`;
    if (sumFreq !== totalSlots) msg += `WARNING: weekly total mismatch (must equal ${totalSlots})\n\n`;

    if (missingTeachers.length) {
      msg += `Subjects without assigned teacher:\n- ${missingTeachers.join('\n- ')}\n\n`;
    }

    msg += `Top subjects by requested frequency:\n`;
    Object.entries(freqMapLocal).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,8).forEach(([s,v]) => { msg += `- ${s}: ${v}\n`; });

    msg += `\nTop teachers by number of assigned courses:\n`;
    teacherOverloads.forEach(t => { msg += `- ${t.teacherId}: ${t.count}\n  ${t.list.slice(0,4).join('\n  ')}\n`; });

    alert(msg);
  };

  const findTeacherClashes = (data) => {
    const clashes = [];
    const scheduleData = data || {};

    DAYS.forEach((day) => {
      PERIODS.forEach((period) => {
        if (period === "LUNCH" || period === "Break") return;
        const teacherToClasses = {};
        const dayBucket = scheduleData?.[day] || {};

        Object.keys(dayBucket).forEach((classKey) => {
          const cell = dayBucket?.[classKey]?.[period];
          if (!cell?.teacherId) return;
          const tid = cell.teacherId;
          teacherToClasses[tid] ??= [];
          teacherToClasses[tid].push({
            classKey,
            subject: cell.subject || "",
          });
        });

        Object.entries(teacherToClasses).forEach(([tid, items]) => {
          if (items.length <= 1) return;
          clashes.push({
            day,
            period,
            teacherId: tid,
            teacherName: teacherMap?.[tid] || tid,
            items,
          });
        });
      });
    });

    return clashes;
  };

  const detectTeacherClashes = () => {
    const data = scheduleRef.current || schedule || {};
    const clashes = findTeacherClashes(data);

    if (!clashes.length) {
      alert("✅ No teacher overlaps found across grades/sections.");
      return;
    }

    const lines = clashes
      .slice(0, 40)
      .map((c) => {
        const where = c.items
          .map((x) => `${x.classKey} (${x.subject})`)
          .join(" | ");
        return `- ${c.day} / ${c.period} — ${c.teacherName}: ${where}`;
      })
      .join("\n");

    alert(
      `❌ Teacher overlaps found (${clashes.length}).\n\n${lines}` +
        (clashes.length > 40 ? "\n\n(Showing first 40)" : "")
    );
  };

  const checkMoreThanOnePerDay = (classKey) => {
    if (!classKey) {
      alert("Select grade & section first");
      return;
    }

    const data = scheduleRef.current || schedule || {};
    const issues = [];

    DAYS.forEach((day) => {
      const counts = {};
      PERIODS.forEach((p) => {
        if (p === "LUNCH" || p === "Break") return;
        const subject = (data?.[day]?.[classKey]?.[p]?.subject || "").toString().trim();
        if (!subject) return;
        if (subject === FREE_SUBJECT) return;
        counts[subject] = (counts[subject] || 0) + 1;
      });

      Object.entries(counts).forEach(([subject, count]) => {
        if (count > 1) {
          issues.push(`${day}: ${subject} (${count})`);
        }
      });
    });

    if (!issues.length) {
      alert("✅ No subject appears more than once per day for this class.");
      return;
    }

    alert(
      `❌ Subjects appearing more than once per day:\n\n${issues.slice(0, 40).join("\n")}` +
        (issues.length > 40 ? "\n\n(Showing first 40)" : "")
    );
  };

  const markMessagesAsSeen = async (userId) => {
  const key1 = `${admin.userId}_${userId}`;
  const key2 = `${userId}_${admin.userId}`;

  const [m1, m2] = await Promise.all([
    fetchChatMessages(key1),
    fetchChatMessages(key2)
  ]);

  const updates = {};

  const collectUpdates = (data, basePath) => {
    Object.entries(data || {}).forEach(([msgId, msg]) => {
      if (msg.receiverId === admin.userId && !msg.seen) {
        updates[`${basePath}/${msgId}/seen`] = true;
      }
    });
  };

  collectUpdates(m1, `Chats/${key1}/messages`);
  collectUpdates(m2, `Chats/${key2}/messages`);

  if (Object.keys(updates).length > 0) {
    await patchScopedRoot(updates);
  }
};


  /* ================= STYLES ================= */
 const styles = {
  page: { display: "flex", minHeight: "100vh", fontFamily: "Poppins, sans-serif", background: "var(--page-bg)", color: "var(--text-primary)" },
  
  topNav: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    background: "#e3e6ecff",
    color: "#fff",
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 30px",
    zIndex: 1000
  },
  navRight: { display: "flex", alignItems: "center", gap: 20 },

  sidebar: {
    position: "fixed",
    top: 70,
    left: 0,
    bottom: 0,
    width: 300,
    background: "#fff",
    boxShadow: "4px 0 25px rgba(0,0,0,0.1)",
    padding: 20,
    overflowY: "auto"
  },

  main: {
    marginTop: 0,
    marginLeft: 0,
    flex: 1,
    padding: "10px 20px 20px",
    overflowY: "auto",
    minHeight: "100%",
    boxSizing: "border-box"
  },

  navBtn: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "12px 16px",
    margin: "10px 0",
    borderRadius: 12,
    background: "#eef2ff",
    color: "#111",
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "none",
    transition: "0.3s",
  },
  navBtnHover: {
    background: "#ffffffff",
    color: "#fff",
  },

  selectorCard: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      padding: 20,
      borderRadius: 16,
      background: "var(--surface-panel)",
      border: "1px solid var(--border-soft)",
      boxShadow: "var(--shadow-soft)",
      color: "var(--text-primary)",
  },
    selectorLeft: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
      minWidth: 180,
    },
    selectorTitle: {
      fontSize: 16,
      fontWeight: 800,
      color: "var(--text-primary)",
    },
    selectorHint: {
      fontSize: 12,
      fontWeight: 600,
      color: "var(--text-muted)",
    },
    selectorRight: {
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      justifyContent: "flex-end",
      flex: 1,
    },
  select: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid var(--input-border)",
      minWidth: 200,
      fontSize: 14,
      fontWeight: 700,
      outline: "none",
      cursor: "pointer",
      background: "var(--input-bg)",
      color: "var(--text-primary)",
  },
    selectSmall: {
      padding: "8px 10px",
      borderRadius: 10,
      border: "1px solid var(--input-border)",
      fontSize: 13,
      fontWeight: 700,
      background: "var(--input-bg)",
      color: "var(--text-primary)",
      outline: "none",
      cursor: "pointer",
    },

  card: {
    background: "var(--surface-panel)",
    padding: 22,
    borderRadius: 20,
    marginTop: 22,
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
    transition: "0.3s",
  },
  cardHover: {
    transform: "translateY(-4px)",
    boxShadow: "0 16px 30px rgba(0,0,0,0.15)",
  },

  freqGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
    gap: 16
  },
  freqItem: {
    background: "var(--surface-muted)",
    padding: 14,
    borderRadius: 14,
    border: "1px solid var(--border-soft)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: 500,
    boxShadow: "var(--shadow-soft)",
    transition: "0.3s",
  },
  freqSubject: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  freqSubjectName: {
    fontWeight: 800,
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 220,
  },
  freqSubjectSub: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text-muted)",
  },
  freqItemHover: {
    transform: "translateY(-3px)",
    boxShadow: "0 8px 18px rgba(0,0,0,0.12)"
  },

  globalGradeBlock: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: "1px solid var(--border-soft)",
  },
  weeklySubjectsPanel: {
    marginTop: 8,
  },
  timetableTableWrap: {
    overflowX: "auto",
    borderRadius: 14,
    border: "1px solid var(--border-soft)",
    background: "var(--surface-panel)",
    boxShadow: "var(--shadow-soft)",
  },
  timetableTable: {
    width: "100%",
    minWidth: 800,
    borderCollapse: "separate",
    borderSpacing: 0,
  },
  timetableHeadCell: {
    textAlign: "left",
    padding: "12px 12px",
    borderBottom: "1px solid var(--border-soft)",
    color: "var(--text-primary)",
    fontWeight: 800,
    background: "var(--surface-muted)",
  },
  timetableRow: {
    background: "var(--surface-panel)",
  },
  timetableRowAlt: {
    background: "var(--surface-muted)",
  },
  timetableDayCell: {
    verticalAlign: "top",
    padding: "12px 12px",
    borderBottom: "1px solid var(--border-soft)",
    fontWeight: 800,
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
  },
  timetableCell: {
    verticalAlign: "top",
    padding: "12px 12px",
    borderBottom: "1px solid var(--border-soft)",
    whiteSpace: "pre-line",
    color: "var(--text-primary)",
    lineHeight: 1.35,
  },
  globalGradeTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "var(--text-primary)",
    marginBottom: 12,
  },

  btnRow: { display: "flex", gap: 12, margin: "20px 0" },
  greenBtn: {
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
    color: "#fff",
    padding: "12px 22px",
    borderRadius: 14,
    border: "none",
    fontWeight: 600,
    cursor: "pointer",
    transition: "0.3s",
  },
  blueBtn: {
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    color: "#fff",
    padding: "12px 22px",
    borderRadius: 14,
    border: "none",
    fontWeight: 600,
    cursor: "pointer",
    transition: "0.3s",
  },
  timetableTitle: {
    marginTop: 14,
    fontSize: 28,
    fontWeight: 800,
    color: "var(--text-primary)",
    letterSpacing: 0.2,
  },
  timetableSubtitle: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: 700,
    color: "var(--text-secondary)",
  },
  purpleBtn: {
    background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
    color: "#fff",
    padding: "12px 22px",
    borderRadius: 14,
    border: "none",
    fontWeight: 600,
    cursor: "pointer",
    transition: "0.3s",
  },

  period: {
    background: "#ffffff",
    padding: 14,
    borderRadius: 14,
    minWidth: 170,
    textAlign: "left",
    fontWeight: 700,
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
    transition: "0.3s",
  },
  periodName: {
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  periodSubject: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: 900,
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  periodTeacher: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 800,
    color: "#2563eb",
  },
  periodEmpty: {
    background: "#f8fafc",
    color: "#94a3b8",
  },
  periodFree: {
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
  },
  pill: {
    fontSize: 11,
    fontWeight: 900,
    padding: "3px 8px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#0369a1",
  },
  pillFree: {
    background: "#dcfce7",
    color: "#166534",
  },
  dayHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  dayTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },
  dayHint: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
  },
  periodRow: {
    display: "flex",
    gap: 12,
    overflowX: "auto",
    paddingBottom: 6,
  },
  periodHover: {
    background: "#dbeafe",
    transform: "translateY(-2px)",
    boxShadow: "0 8px 18px rgba(0,0,0,0.1)",
  },

  lunch: {
    background: "#fde68a",
    padding: 18,
    borderRadius: 16,
    fontWeight: "bold",
    textAlign: "center",
    boxShadow: "0 4px 10px rgba(0,0,0,0.08)"
  }
};

  const hasAnySelectedScheduleEntries =
    !!selectedClassKey &&
    DAYS.some((day) =>
      PERIODS.some(
        (p) =>
          p !== "LUNCH" &&
          p !== "Break" &&
          Boolean(schedule?.[day]?.[selectedClassKey]?.[p]?.subject)
      )
    );


  return (
    <div className="dashboard-page" style={{ background: "var(--page-bg)", minHeight: "100vh", height: "100vh", overflow: "hidden", color: "var(--text-primary)" }}>
<div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "4px 14px", height: "calc(100vh - 73px)", overflow: "hidden", background: "var(--page-bg)", width: "100%", boxSizing: "border-box" }}>
  <Sidebar admin={admin} />

        {/* MAIN */}
        <div style={styles.main}>
          {/* SELECTOR */}
          <div style={styles.selectorCard}>
            <div style={styles.selectorLeft}>
              <div style={styles.selectorTitle}>Class timetable</div>
              <div style={styles.selectorHint}>Pick a grade and section to view/edit.</div>
            </div>
            <div style={styles.selectorRight}>
              <select style={styles.select} value={selectedGrade} onChange={e => { setSelectedGrade(e.target.value); setSelectedSection(""); }}>
                <option value="">🎓 Select Grade</option>
                {gradeOptions.map(g => <option key={g}>{g}</option>)}
              </select>
              <select style={styles.select} value={selectedSection} onChange={e => setSelectedSection(e.target.value)} disabled={!selectedGrade}>
                <option value="">📘 Select Section</option>
                {[...(classes[selectedGrade] || [])].map(s => <option key={s}>{s}</option>)}
              </select>

              <button
                style={{ ...styles.blueBtn, padding: "10px 16px", borderRadius: 12 }}
                onClick={addSelectedClassToGenerate}
                disabled={!selectedGrade || !selectedSection}
              >
                + Add Class
              </button>
            </div>
          </div>

          <div>
            <div style={styles.timetableTitle}>Timetable</div>
            {selectedClassKey && (
              <div style={styles.timetableSubtitle}>{selectedClassKey}</div>
            )}
          </div>

          {/* BATCH GENERATE */}
          <div style={styles.card}>
            <h3>🧩 Generate Multiple Classes</h3>
            <div style={styles.selectorHint}>
              Step 1: Select a Grade & Section. Step 2: Fill the Weekly Subjects for that class. Step 3: Click “Add Class”.
              Repeat for other classes. Finally click “Generate All Classes”.
            </div>

            {(classesToGenerateUnique && classesToGenerateUnique.length) ? (
              <div style={{ ...styles.selectorHint, marginTop: 8 }}>
                Classes to generate: {classesToGenerateUnique.map((x) => x.classKey).join(", ")}
              </div>
            ) : (
              <div style={{ ...styles.selectorHint, marginTop: 8 }}>
                Add class(es) to see multiple Weekly Subjects at once.
              </div>
            )}

            {(classesToGenerateUnique && classesToGenerateUnique.length) ? (
              <div style={{ ...styles.selectorHint, marginTop: 6 }}>
                Timetables listed below for: {classesToGenerateUnique.map((x) => x.classKey).join(", ")}
              </div>
            ) : null}

            <div style={{ ...styles.btnRow, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
              <button
                style={{ ...styles.greenBtn, opacity: generatingAll ? 0.7 : 1 }}
                onClick={generateAllClasses}
                disabled={generatingAll || !(classesToGenerateUnique && classesToGenerateUnique.length)}
              >
                <FaMagic /> {generatingAll ? "Generating…" : "Generate All"}
              </button>

              <button
                style={{ ...styles.blueBtn, opacity: savingAllAdded ? 0.7 : 1 }}
                onClick={saveAllAddedClasses}
                disabled={savingAllAdded || generatingAll || !(classesToGenerateUnique && classesToGenerateUnique.length)}
              >
                <FaSave /> {savingAllAdded ? "Saving…" : "Save All"}
              </button>

              <button
                style={{ ...styles.purpleBtn, background: "#0ea5e9" }}
                onClick={downloadAllClassesPdf}
                disabled={generatingAll || !(classesToGenerateUnique && classesToGenerateUnique.length)}
              >
                <FaDownload /> Download All PDF
              </button>
            </div>

            {(classesToGenerateUnique || []).map(({ grade, section, classKey }) => {
              const classCourses = (courses || []).filter(
                (c) => String(c?.grade) === String(grade) && String(c?.section) === String(section)
              );

              const isWeeklyOpen = weeklySubjectsOpen?.[classKey] ?? true;
              const weeklyPanelId = `weekly-subjects-${String(classKey).replace(/[^a-z0-9]+/gi, "-")}`;
              const toggleWeeklyOpen = () =>
                setWeeklySubjectsOpen((prev) => ({
                  ...(prev || {}),
                  [classKey]: !(prev?.[classKey] ?? true),
                }));

              return (
                <div key={classKey} style={styles.globalGradeBlock}>
                  <div
                    style={{
                      ...styles.globalGradeTitle,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: isWeeklyOpen ? 12 : 0,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isWeeklyOpen}
                    aria-controls={weeklyPanelId}
                    onClick={toggleWeeklyOpen}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleWeeklyOpen();
                      }
                    }}
                  >
                    <div style={{ minWidth: 0 }}>📚 {classKey} – Weekly Subjects</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        aria-label={`Remove ${classKey}`}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ef4444",
                          fontSize: 16,
                          lineHeight: 1,
                          cursor: "pointer",
                          padding: "2px 6px",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeClassFromGenerate(classKey);
                        }}
                      >
                        <FaTrash />
                      </button>
                      <div
                        style={{
                          ...styles.blueBtn,
                          padding: "6px 10px",
                          borderRadius: 10,
                          fontSize: 12,
                          whiteSpace: "nowrap",
                          pointerEvents: "none",
                        }}
                      >
                        {isWeeklyOpen ? "Hide" : "Show"}
                      </div>
                    </div>
                  </div>

                  {isWeeklyOpen ? (
                    <div style={styles.weeklySubjectsPanel}>
                      <div style={{ ...styles.btnRow, gap: 8, justifyContent: "flex-start", marginBottom: 12 }}>
                        <button style={styles.blueBtn} onClick={() => saveSchedule(classKey)}><FaSave /> Save</button>
                        <button style={styles.purpleBtn} onClick={() => downloadScheduleExcel(classKey, grade, section)}><FaFileAlt /> Download Excel</button>
                        <button style={{ ...styles.purpleBtn, background: "#0ea5e9" }} onClick={() => downloadSchedulePdf(classKey, grade, section)}><FaFileAlt /> Download PDF</button>
                        <button style={{ ...styles.purpleBtn, background: '#10b981' }} onClick={() => analyzeGenerateProblems(classKey, grade, section)}>🔎 Analyze Problems</button>
                        <button style={{ ...styles.purpleBtn, background: "#0f766e" }} onClick={() => checkMoreThanOnePerDay(classKey)}>Check 1/day</button>
                        <button style={{ ...styles.purpleBtn, background: '#ef4444' }} onClick={detectTeacherClashes}>🧑‍🏫 Detect Teacher Clashes</button>
                      </div>

                      <div id={weeklyPanelId} style={styles.freqGrid}>
                        {classCourses.map((course) => {
                          const isUnassigned = !courseTeacherMap?.[course.id];
                          return (
                          <div
                            key={course.id}
                            style={
                              isUnassigned
                                ? {
                                    ...styles.freqItem,
                                    border: "1px solid #ef4444",
                                    background: "#fef2f2",
                                  }
                                : styles.freqItem
                            }
                          >
                            <div style={styles.freqSubject}>
                              <div style={styles.freqSubjectName}>{course.subject}</div>
                              <div style={styles.freqSubjectSub}>Periods per week</div>
                              {!courseTeacherMap?.[course.id] ? (
                                <div style={{ ...styles.freqSubjectSub, color: "#ef4444" }}>
                                  Teacher not assigned
                                </div>
                              ) : null}
                            </div>
                            <select
                              style={styles.selectSmall}
                              value={weeklyFrequency?.[classKey]?.[course.id] || 0}
                              onChange={(e) =>
                                setWeeklyFrequency((prev) => ({
                                  ...prev,
                                  [classKey]: {
                                    ...(prev?.[classKey] || {}),
                                    [course.id]: Number(e.target.value),
                                  },
                                }))
                              }
                            >
                              {[...Array(9)].map((_, i) => <option key={i}>{i}</option>)}
                            </select>
                          </div>
                        )})}
                      </div>

                    </div>
                  ) : null}
                </div>
              );
            })}

            {(classesToGenerateUnique && classesToGenerateUnique.length) ? (
              <div style={{ ...styles.card, marginTop: 16 }}>
                <h3>🗓️ Timetables (Added Classes)</h3>
                <div style={styles.selectorHint}>All added class timetables listed below.</div>

                {(classesToGenerateUnique || []).map(({ classKey, grade, section }) => {
                  const activePeriods = PERIODS.filter(p => p !== "LUNCH" && p !== "Break");

                  return (
                    <div key={`${classKey}-table`} style={styles.globalGradeBlock}>
                      <div style={{ ...styles.globalGradeTitle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span>{classKey} – Timetable</span>
                        <button
                          type="button"
                          aria-label={`Download ${classKey} timetable`}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#2563eb",
                            cursor: "pointer",
                            fontSize: 16,
                          }}
                          onClick={() => downloadSchedulePdf(classKey, grade, section)}
                        >
                          <FaDownload />
                        </button>
                      </div>

                      <div style={styles.timetableTableWrap}>
                        <table style={styles.timetableTable}>
                          <thead>
                            <tr>
                              <th style={styles.timetableHeadCell}>Day</th>
                              {activePeriods.map((p) => (
                                <th key={p} style={styles.timetableHeadCell}>{p}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {DAYS.map((day, rowIndex) => (
                              <tr key={`${classKey}-${day}-row`} style={rowIndex % 2 === 0 ? styles.timetableRow : styles.timetableRowAlt}>
                                <td style={styles.timetableDayCell}>{day}</td>
                                {activePeriods.map((p) => {
                                  const cell = schedule?.[day]?.[classKey]?.[p];
                                  const subject = (cell?.subject || "").toString().trim();
                                  const teacher = (cell?.teacherName || "").toString().trim();
                                  const text = subject ? (teacher ? `${subject}\n${teacher}` : subject) : "";
                                  return (
                                    <td key={p} style={styles.timetableCell}>
                                      {text}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

        </div>

        

      </div>

    </div>
  
  );
}