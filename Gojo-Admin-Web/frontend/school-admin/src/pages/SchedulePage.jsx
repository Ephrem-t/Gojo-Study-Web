import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FaCalendarAlt,
  FaHome,
  FaSave,
  FaMagic,
  FaSignOutAlt,
  FaBell,
  FaCog,
  FaSearch,
  FaFacebookMessenger,
  FaChalkboardTeacher,
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

  /* ================= STATE ================= */
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState({});
  const [teacherMap, setTeacherMap] = useState({});
  const [courseTeacherMap, setCourseTeacherMap] = useState({});
  const [schedule, setSchedule] = useState({});
  const scheduleRef = useRef({});
  const [weeklyFrequency, setWeeklyFrequency] = useState({});
  const [globalWeekly, setGlobalWeekly] = useState({});
  // Exceptional subject rules: per class, forbid a subject in one or more periods (across all weekdays).
  // Shape: { [classKey]: Array<{ courseId: string, periods: string[] }> }
  const [exceptionRulesByClass, setExceptionRulesByClass] = useState({});
  // Draft inputs for the exceptional subject UI.
  // draft.period will be an array of selected periods when multi-selecting.
  const [exceptionDraftByClass, setExceptionDraftByClass] = useState({});
  const [classesToGenerate, setClassesToGenerate] = useState([]); // [{ grade, section, classKey }]
  const [generatingAll, setGeneratingAll] = useState(false);
  const [batchGenerateStatus, setBatchGenerateStatus] = useState(null); // { attempt, maxAttempts, elapsedMs, phase }
  const [savingAllAdded, setSavingAllAdded] = useState(false);
  const [weeklySubjectsOpen, setWeeklySubjectsOpen] = useState({}); // { [classKey]: boolean }
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

// Capacity: a teacher cannot teach more than the number of teachable slots in a week.
// With the current timetable config this is 5 days × 7 periods/day = 35.
const getActivePeriods = () => PERIODS.filter((p) => p !== "LUNCH" && p !== "Break");
const getWeeklyTeachableSlots = () => DAYS.length * getActivePeriods().length;
const MAX_TEACHER_PERIODS_PER_WEEK = getWeeklyTeachableSlots();

const normalizeSubject = (value) => (value || "").toString().trim().toLowerCase().replace(/\s+/g, " ");

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
    const [usersRes, adminsRes] = await Promise.all([
      axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"
      ),
      axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/School_Admins.json"
      ),
    ]);

    const users = usersRes.data || {};
    const admins = adminsRes.data || {};

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
      const usersSnap = await get(ref(db, "Users"));
      const users = usersSnap.exists() ? usersSnap.val() : {};

      const teachersSnap = await get(ref(db, "Teachers"));
      const teachers = teachersSnap.exists() ? teachersSnap.val() : {};
      const tMap = {};
      Object.entries(teachers).forEach(([tid, t]) => {
        if (users[t.userId]) tMap[tid] = users[t.userId].name;
      });

      const coursesSnap = await get(ref(db, "Courses"));
      const coursesData = coursesSnap.exists() ? coursesSnap.val() : {};
      const courseArr = Object.entries(coursesData).map(([id, c]) => ({ id, ...c }));

      const classMap = {};
      courseArr.forEach(c => {
        if (!classMap[c.grade]) classMap[c.grade] = new Set();
        classMap[c.grade].add(c.section);
      });

      const assignsSnap = await get(ref(db, "TeacherAssignments"));
      const assigns = assignsSnap.exists() ? assignsSnap.val() : {};
      const ctMap = {};
      if (assigns && typeof assigns === "object") {
        Object.values(assigns).forEach(a => {
          ctMap[a.courseId] = a.teacherId;
        });
      }

      const schSnap = await get(ref(db, "Schedules"));
      if (schSnap.exists()) {
        setSchedule(schSnap.val());
      }

      setCourses(courseArr);
      setClasses(classMap);
      setTeacherMap(tMap);
      setCourseTeacherMap(ctMap);
      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    const schedulesRef = ref(db, "Schedules");
    const unsubscribe = onValue(schedulesRef, (snap) => {
      const data = snap.exists() ? snap.val() : {};
      scheduleRef.current = data;
      setSchedule(data);
    });
    return () => unsubscribe();
  }, []);

const handleClick = () => {
    navigate("/all-chat"); // replace with your target route
  };

  useEffect(() => {
    // Replace with your actual API call
    const fetchUnreadSenders = async () => {
      const response = await fetch("/api/unreadSenders");
      const data = await response.json();
      setUnreadSenders(data);
    };
    fetchUnreadSenders();
  }, []);

useEffect(() => {
  const fetchTeachersAndUnread = async () => {
    try {
      const [teachersRes, usersRes] = await Promise.all([
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"),
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json")
      ]);

      const teachersData = teachersRes.data || {};
      const usersData = usersRes.data || {};

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

      for (const t of teacherList) {
        const chatKey = `${adminUserId}_${t.userId}`;
        const res = await axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`);
        const msgs = Object.values(res.data || {}).map(m => ({
          ...m,
          sender: m.senderId === adminUserId ? "admin" : "teacher"
        }));
        allMessages.push(...msgs);

        const unreadCount = msgs.filter(m => m.receiverId === adminUserId && !m.seen).length;
        if (unreadCount > 0) unread[t.userId] = unreadCount;
      }

      setPopupMessages(allMessages);
      setUnreadTeachers(unread);

    } catch (err) {
      console.error(err);
    }
  };

  fetchTeachersAndUnread();
}, [adminUserId]);


  useEffect(() => {
    fetchAll();
  }, []);

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
      [classKey]: false,
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

    const normalizeWeeklyCountsForClass = (classCourses, rawFreq) => {
      const totalSlots = getWeeklyTeachableSlots();
      const freqByCourseId = {};
      const subjectToCourseId = {};

      (classCourses || []).forEach((c) => {
        const v = Number(rawFreq?.[c.id] ?? 0);
        freqByCourseId[c.id] = Number.isFinite(v) ? Math.max(0, v) : 0;
        subjectToCourseId[(c.subject || "").trim().toLowerCase()] = c.id;
      });

      let sum = Object.values(freqByCourseId).reduce((a, b) => a + (Number(b) || 0), 0);
      let missingFree = 0;

      // If the total doesn't match available slots, mirror the same auto-adjust behavior as autoGenerate (without prompts).
      if (sum > totalSlots) {
        let excess = sum - totalSlots;
        const idsByCount = Object.keys(freqByCourseId)
          .sort((a, b) => (freqByCourseId[b] || 0) - (freqByCourseId[a] || 0));

        while (excess > 0) {
          let changed = false;
          for (const id of idsByCount) {
            if (excess <= 0) break;
            if ((freqByCourseId[id] || 0) > 0) {
              freqByCourseId[id]--;
              excess--;
              changed = true;
            }
          }
          if (!changed) break;
        }
      } else if (sum < totalSlots) {
        missingFree = totalSlots - sum;
      }

      // Enforce generator rule: max 1 per subject per day => max weekly per subject is DAYS.length.
      // Any removed periods become Free Periods.
      (classCourses || []).forEach((c) => {
        const weekly = Number(freqByCourseId?.[c.id] || 0);
        if (!weekly) return;
        const maxWeekly = DAYS.length;
        if (weekly > maxWeekly) {
          missingFree += (weekly - maxWeekly);
          freqByCourseId[c.id] = maxWeekly;
        }
      });

      // Recompute sum after adjustments.
      sum = Object.values(freqByCourseId).reduce((a, b) => a + (Number(b) || 0), 0);
      if (sum > totalSlots) {
        // Safety: if still too high (should be rare), trim again.
        let excess = sum - totalSlots;
        const idsByCount = Object.keys(freqByCourseId)
          .sort((a, b) => (freqByCourseId[b] || 0) - (freqByCourseId[a] || 0));
        for (const id of idsByCount) {
          if (excess <= 0) break;
          const canRemove = Math.min(excess, Number(freqByCourseId[id] || 0));
          if (canRemove > 0) {
            freqByCourseId[id] -= canRemove;
            excess -= canRemove;
          }
        }
      }

      return { freqByCourseId, missingFree };
    };

    const validateExactScheduleForClass = (data, classItem) => {
      const activePeriods = getActivePeriods();
      const classKey = classItem?.classKey;
      if (!classKey) return { ok: false, reason: "Missing classKey" };

      const classCourses = classItem?.classCourses || [];
      const expected = classItem?.freqByCourseId || {};

      const courseIdBySubject = {};
      classCourses.forEach((c) => {
        const s = normalizeSubject(c?.subject);
        if (!s) return;
        courseIdBySubject[s] = c.id;
      });

      const found = {};
      for (const day of DAYS) {
        for (const period of activePeriods) {
          const cell = data?.[day]?.[classKey]?.[period];
          if (!cell?.subject) {
            return { ok: false, reason: `Empty slot at ${day} ${period}` };
          }

          const subjNorm = normalizeSubject(cell.subject);
          const isFree = subjNorm === normalizeSubject(FREE_SUBJECT);
          if (isFree) continue;

          const courseId = courseIdBySubject[subjNorm];
          if (!courseId) {
            return { ok: false, reason: `Unknown subject \"${cell.subject}\" in ${classKey}` };
          }

          // Exact schedule requirement: all non-free lessons must have a teacher assigned.
          if (!cell.teacherId) {
            return { ok: false, reason: `Unassigned teacher for \"${cell.subject}\" in ${classKey} (${day} ${period})` };
          }

          found[courseId] = (found[courseId] || 0) + 1;
        }
      }

      // Weekly exact match: each course appears exactly expected times.
      for (const c of classCourses) {
        const exp = Number(expected?.[c.id] || 0) || 0;
        const got = Number(found?.[c.id] || 0) || 0;
        if (got !== exp) {
          return { ok: false, reason: `${classKey} weekly mismatch for ${c.subject}: expected ${exp}, got ${got}` };
        }
      }

      return { ok: true };
    };


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
      const usersRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"
      );
      const usersData = usersRes.data || {};

      const findUserByUserId = (userId) => {
        return Object.values(usersData).find((u) => u.userId === userId);
      };

      // helper to read messages from BOTH chat keys
      const getUnreadCount = async (userId) => {
        const key1 = `${admin.userId}_${userId}`;
        const key2 = `${userId}_${admin.userId}`;

        const [r1, r2] = await Promise.all([
          axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`),
          axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`),
        ]);

        const msgs = [...Object.values(r1.data || {}), ...Object.values(r2.data || {})];

        return msgs.filter((m) => m.receiverId === admin.userId && !m.seen).length;
      };

      // TEACHERS
      const teachersRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"
      );

      for (const k in teachersRes.data || {}) {
        const t = teachersRes.data[k];
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

  const exceptionRules = Array.isArray(opts.exceptionRules)
    ? opts.exceptionRules
    : (exceptionRulesByClass?.[classKey] || []);

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

  const isCourseForbiddenInPeriod = (courseId, period) => {
    if (!courseId || !period) return false;
    return (exceptionRules || []).some((r) => {
      if (r?.courseId !== courseId) return false;
      if (Array.isArray(r?.periods)) return r.periods.includes(period);
      if (r?.period) return r.period === period;
      return false;
    });
  };

  const isSubjectForbiddenInPeriod = (subject, period) => {
    const s = normalizeSubject(subject);
    if (!s) return false;
    const cid = subjectToCourseId?.[s];
    if (!cid) return false;
    return isCourseForbiddenInPeriod(cid, period);
  };

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
        classCourses.forEach(c => {
          const teacherId = courseTeacherMap[c.id];
          const need = freqMapOriginal[c.id] || 0;
          if (!teacherId || need <= 0) return;
          const free = totalSlots - (busyCount[teacherId] || 0);
          if (need > free) {
            overBooked.push({ subject: c.subject, teacher: teacherMap[teacherId] || teacherId, need, free });
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
      // Strict one-per-day model: each placement consumes at most one "extra" per day.
      const subjectQuota = {};
      classCourses.forEach((course) => {
        const weekly = Number(freqMapOriginal?.[course.id] || 0);
        if (!weekly) return;

        const strictOnePerDay = true;
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

              // Exceptional subject rule: forbid this subject in this period for this class.
              if (!isFree && isCourseForbiddenInPeriod(course.id, period)) {
                reasonCounts.other++;
                continue;
              }

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
          // Pass 3 fallback: kept for backward compatibility (no longer blocks consecutive teacher)
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

              // Exceptional rule: candidate subject cannot be placed in this target period.
              if (candId !== FREE_ID && isCourseForbiddenInPeriod(candId, period)) continue;

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

                // Exceptional rule: moved cell cannot land in forbidden period.
                if (isSubjectForbiddenInPeriod(cell2.subject, period)) continue;

                // 1) Can we move cell2 into the blocked target slot?
                if (!canPlaceSubjectInDay(data, day, cell2.subject)) continue;
                if (cell2.teacherId && teacherTimeSlot?.[day]?.[period]?.[cell2.teacherId]) continue;

                // 2) Can we place the candidate into slot2?
                if (candId !== FREE_ID && !canPlaceSubjectInDay(data, slot2.day, candSubject)) continue;
                if (candId !== FREE_ID && isCourseForbiddenInPeriod(candId, slot2.period)) continue;
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

              // Exceptional rule: candidate subject cannot be placed in this target period.
              if (candId !== FREE_ID && isCourseForbiddenInPeriod(candId, period)) {
                continue;
              }

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

                // Exceptional rule must hold even during swap attempts.
                if (sb?.subject && isSubjectForbiddenInPeriod(sb.subject, a.period)) continue;
                if (sa?.subject && isSubjectForbiddenInPeriod(sa.subject, b.period)) continue;

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
                  if (candId !== FREE_ID && isCourseForbiddenInPeriod(candId, period)) {
                    continue;
                  }
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
          alert("Unable to generate timetable after multiple attempts. Try adjusting weekly subject counts or teacher assignments.");
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
      setBatchGenerateStatus({ attempt: 0, maxAttempts: 0, elapsedMs: 0, phase: "Preparing…" });
      // Let the UI render the loading state before heavy work starts.
      await new Promise((r) => setTimeout(r, 0));

      // Prepare normalized weekly maps per class (so totals match slots, and per-day caps are respected).
      const classItems = classKeys.map(({ grade, section, classKey }) => {
        const classCourses = (courses || []).filter(
          (c) => String(c?.grade) === String(grade) && String(c?.section) === String(section)
        );

        const raw = weeklyFrequency?.[classKey] || {};
        const normalized = normalizeWeeklyCountsForClass(classCourses, raw);
        const freqByCourseId = normalized.freqByCourseId;

        const totalTeacherRequired = classCourses.reduce((acc, c) => {
          const tid = courseTeacherMap?.[c.id];
          if (!tid) return acc;
          return acc + (Number(freqByCourseId?.[c.id] || 0) || 0);
        }, 0);

        const distinctTeachers = new Set(
          classCourses
            .map((c) => courseTeacherMap?.[c.id])
            .filter(Boolean)
        ).size;

        const score = (totalTeacherRequired * 10) + distinctTeachers;

        return { grade, section, classKey, classCourses, freqByCourseId, score };
      });

      const nextWeekly = Object.fromEntries(
        classItems.map((x) => [x.classKey, { ...x.freqByCourseId }])
      );

      // Input validation: each class must have weekly counts totaling > 0.
      // Also: for an exact schedule, each non-free subject must have a teacher assignment.
      const missingWeekly = [];
      const missingTeachers = [];
      classItems.forEach((item) => {
        const sum = Object.values(item.freqByCourseId || {}).reduce((a, b) => a + (Number(b) || 0), 0);
        if (sum <= 0) {
          missingWeekly.push(item.classKey);
        }

        (item.classCourses || []).forEach((c) => {
          const need = Number(item.freqByCourseId?.[c.id] || 0) || 0;
          if (need <= 0) return;
          const tid = courseTeacherMap?.[c.id];
          if (!tid) {
            missingTeachers.push({ classKey: item.classKey, subject: c.subject });
          }
        });
      });

      if (missingWeekly.length) {
        alert(
          `Cannot generate exact timetable: weekly subject counts are missing/zero for:\n\n- ${missingWeekly.slice(0, 12).join("\n- ")}` +
          (missingWeekly.length > 12 ? `\n\n(and ${missingWeekly.length - 12} more...)` : "") +
          `\n\nOpen each class in the list and set weekly counts first (total should be ${getWeeklyTeachableSlots()} for each class).`
        );
        return;
      }

      if (missingTeachers.length) {
        const list = missingTeachers
          .slice(0, 12)
          .map((x) => `- ${x.classKey}: ${x.subject}`)
          .join("\n");
        alert(
          `Cannot generate exact timetable: some subjects have no teacher assignment.\n\n${list}` +
          (missingTeachers.length > 12 ? `\n\n(and ${missingTeachers.length - 12} more...)` : "") +
          `\n\nAssign teachers in TeacherAssignments, then generate again.`
        );
        return;
      }

      // Necessary condition: each teacher must have <= MAX_TEACHER_PERIODS_PER_WEEK total assigned lessons across ALL classes.
      const teacherDemand = {};
      classItems.forEach((item) => {
        (item.classCourses || []).forEach((c) => {
          const tid = courseTeacherMap?.[c.id];
          if (!tid) return;
          const need = Number(item.freqByCourseId?.[c.id] || 0) || 0;
          if (need <= 0) return;
          teacherDemand[tid] = (teacherDemand[tid] || 0) + need;
        });
      });

      const overloaded = Object.entries(teacherDemand)
        .map(([tid, need]) => ({ tid, need: Number(need) || 0 }))
        .filter((x) => x.need > MAX_TEACHER_PERIODS_PER_WEEK)
        .sort((a, b) => b.need - a.need);

      if (overloaded.length) {
        const list = overloaded
          .slice(0, 8)
          .map((x) => {
            const name = teacherMap?.[x.tid] || x.tid;
            return `- ${name}: ${x.need} periods/week (max ${MAX_TEACHER_PERIODS_PER_WEEK})`;
          })
          .join("\n");

        alert(
          `Cannot generate an exact timetable because at least one teacher is overloaded.\n\n${list}` +
          (overloaded.length > 8 ? `\n\n(and ${overloaded.length - 8} more...)` : "") +
          `\n\nFix by changing teacher assignments or reducing weekly counts for subjects taught by these teacher(s).`
        );
        return;
      }

      // Clear all classes before generating to avoid cross-class teacher conflicts.
      const makeEmptyBase = () => Object.fromEntries(DAYS.map((d) => [d, {}]));

      const shuffle = (arr) => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      // Retry batch generation with different class orders until we find an exact schedule.
      // Bounded by attempts and time to avoid freezing the UI.
      const MAX_BATCH_ATTEMPTS = 20000;
      const MAX_BATCH_MS = 30 * 60 * 1000; // allow long search for exact match
      let finalData = null;
      let lastFailure = null;

      const startedAt = Date.now();
      setBatchGenerateStatus({ attempt: 0, maxAttempts: MAX_BATCH_ATTEMPTS, elapsedMs: 0, phase: "Searching…" });
      await new Promise((r) => setTimeout(r, 0));

      for (let batchAttempt = 1; batchAttempt <= MAX_BATCH_ATTEMPTS; batchAttempt++) {
        if ((Date.now() - startedAt) > MAX_BATCH_MS) {
          lastFailure = { ...(lastFailure || {}), timedOut: true, batchAttempt };
          break;
        }

        // Update progress (and yield periodically so the UI keeps updating).
        if (batchAttempt === 1 || batchAttempt % 10 === 0) {
          setBatchGenerateStatus({
            attempt: batchAttempt,
            maxAttempts: MAX_BATCH_ATTEMPTS,
            elapsedMs: Date.now() - startedAt,
            phase: "Searching exact schedule…",
          });
          await new Promise((r) => setTimeout(r, 0));
        }

        const base = makeEmptyBase();
        let data = base;

        // Attempt 1: most constrained classes first; later attempts: shuffle with a bias toward constraints.
        const order = batchAttempt === 1
          ? [...classItems].sort((a, b) => (b.score || 0) - (a.score || 0))
          : shuffle([...classItems]).sort((a, b) => {
              const da = (b.score || 0) - (a.score || 0);
              if (da !== 0) return da;
              return Math.random() - 0.5;
            });

        let ok = true;
        for (const item of order) {
          const out = autoGenerate({
            classKey: item.classKey,
            classCourses: item.classCourses,
            rawFreq: item.freqByCourseId,
            interactive: false,
            returnData: true,
            baseSchedule: data,
          });

          if (!out) {
            ok = false;
            lastFailure = { batchAttempt, classKey: item.classKey };
            break;
          }
          data = out;
        }

        if (ok) {
          // Exact schedule validation across all selected classes.
          let exact = true;
          for (const item of classItems) {
            const res = validateExactScheduleForClass(data, item);
            if (!res.ok) {
              exact = false;
              lastFailure = { batchAttempt, classKey: item.classKey, reason: res.reason };
              break;
            }
          }

          if (exact) {
            finalData = data;
            break;
          }
        }
      }

      if (!finalData) {
        const hintParts = [];
        if (lastFailure?.timedOut) {
          hintParts.push(`Stopped after ~${Math.round((Date.now() - startedAt) / 1000)}s timeout.`);
        }
        if (lastFailure?.classKey) {
          hintParts.push(`Last failed class: ${lastFailure.classKey} (attempt ${lastFailure.batchAttempt}/${MAX_BATCH_ATTEMPTS}).`);
        }
        if (lastFailure?.reason) {
          hintParts.push(`Reason: ${lastFailure.reason}`);
        }
        const hint = hintParts.length ? `\n\n${hintParts.join("\n")}` : "";
        alert(
          `Unable to generate an exact timetable for all added classes after multiple batch attempts.` +
          `${hint}` +
          `\n\nTry: (1) ensure teacher assignments exist for all subjects, (2) reduce high weekly counts, (3) generate fewer classes at once to find the blocking class.`
        );
        return;
      }

      scheduleRef.current = finalData;
      setSchedule(finalData);
      setWeeklyFrequency((prev) => ({ ...prev, ...nextWeekly }));
      if (selectedClassKey) calculateTeacherWorkload(finalData);
      alert("All added class timetables generated. Click 'Save All' to save to the database.");
    } finally {
      setGeneratingAll(false);
      setBatchGenerateStatus(null);
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
      await set(ref(db, "Schedules"), cleaned);
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
        return set(ref(db, `Schedules/${day}/${targetClassKey}`), cleanedBucket);
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

  const downloadAllClassesExcel = async () => {
    try {
      const classList = (classesToGenerateUnique || []).filter((c) => c?.classKey);
      if (!classList.length) {
        alert("Add class(es) first using + Add Class");
        return;
      }

      const data = scheduleRef.current || schedule || {};
      const allPeriods = [...PERIODS];
      const teachablePeriods = PERIODS.filter((p) => p !== "LUNCH" && p !== "Break");

      const parseClassSortKey = (classKey) => {
        const raw = String(classKey || "");
        const m = raw.match(/grade\s*(\d+)\s*([a-z])?/i);
        const gradeNum = m ? Number(m[1]) : Number.POSITIVE_INFINITY;
        const section = (m?.[2] || "").toUpperCase();
        return { gradeNum, section, raw };
      };

      const classKeyToShort = (classKey) => {
        const raw = String(classKey || "");
        const m = raw.match(/grade\s*(\d+)\s*([a-z])?/i);
        if (!m) return raw;
        const g = m[1];
        const s = (m?.[2] || "").toUpperCase();
        return `G${g}${s}`;
      };

      const periodToTimeLabel = (p) => {
        if (p === "Break") return "Break";
        if (p === "LUNCH") return "Lunch";
        const m = String(p).match(/\(([^)]+)\)/);
        return m ? m[1].replace(/–/g, "-") : String(p);
      };

      const sortedClassList = [...classList].sort((a, b) => {
        const ak = parseClassSortKey(a.classKey);
        const bk = parseClassSortKey(b.classKey);
        if (ak.gradeNum !== bk.gradeNum) return ak.gradeNum - bk.gradeNum;
        if (ak.section !== bk.section) return ak.section.localeCompare(bk.section);
        return ak.raw.localeCompare(bk.raw);
      });

      const hasAny = sortedClassList.some(({ classKey }) =>
        DAYS.some((day) =>
          teachablePeriods.some((p) => Boolean(data?.[day]?.[classKey]?.[p]?.subject))
        )
      );

      if (!hasAny) {
        alert("No timetables found yet. Generate first.");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Gojo Admin";
      workbook.created = new Date();

      const schoolName = admin?.schoolName || admin?.school || "School Name";
      const ws = workbook.addWorksheet("All Classes");

      // Columns: A=DAYS, B=GRADE, C..=periods (including Break/Lunch)
      ws.getColumn(1).width = 10;
      ws.getColumn(2).width = 10;
      for (let i = 0; i < allPeriods.length; i++) {
        ws.getColumn(3 + i).width = 14;
      }

      const totalCols = 2 + allPeriods.length;

      // Header rows
      ws.getCell(1, 1).value = "DAYS";
      ws.getCell(1, 2).value = "GRADE";
      ws.getCell(1, 3).value = `TIME AND PERIOD (School: ${schoolName})`;
      ws.mergeCells(1, 3, 1, totalCols);

      ws.getCell(2, 1).value = "";
      ws.getCell(2, 2).value = "";
      allPeriods.forEach((p, idx) => {
        ws.getCell(2, 3 + idx).value = periodToTimeLabel(p);
      });

      ws.views = [{ state: "frozen", ySplit: 2, xSplit: 2 }];

      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
      const headerFont = { bold: true, color: { argb: "FFFFFFFF" } };

      [1, 2].forEach((r) => {
        const row = ws.getRow(r);
        row.height = r === 1 ? 22 : 20;
        for (let c = 1; c <= totalCols; c++) {
          const cell = row.getCell(c);
          cell.fill = headerFill;
          cell.font = headerFont;
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        }
      });

      const border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      const idxBreak = allPeriods.findIndex((x) => x === "Break");
      const idxLunch = allPeriods.findIndex((x) => x === "LUNCH");
      const colBreak = idxBreak >= 0 ? 3 + idxBreak : null;
      const colLunch = idxLunch >= 0 ? 3 + idxLunch : null;

      const fillBreak = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
      const fillLunch = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      const fillFree = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };

      let rowPtr = 3;

      DAYS.forEach((day, dayIndex) => {
        const blockStart = rowPtr;

        // rows for classes
        sortedClassList.forEach(({ classKey }) => {
          const rowVals = [];
          rowVals[1] = ""; // day (merged later)
          rowVals[2] = classKeyToShort(classKey);
          allPeriods.forEach((p, idx) => {
            const col = 3 + idx;
            if (p === "Break" || p === "LUNCH") {
              rowVals[col] = "";
              return;
            }
            const cell = data?.[day]?.[classKey]?.[p];
            rowVals[col] = cell?.subject || "";
          });
          ws.addRow(rowVals);
          rowPtr++;
        });

        const blockEnd = rowPtr - 1;

        // Day label merged down
        ws.mergeCells(blockStart, 1, blockEnd, 1);
        const dayCell = ws.getCell(blockStart, 1);
        dayCell.value = day.toUpperCase();
        dayCell.font = { bold: true, color: { argb: "FF0F172A" } };
        dayCell.alignment = { vertical: "middle", horizontal: "center", textRotation: 90, wrapText: true };

        // Break/Lunch columns merged (vertical labels)
        if (colBreak) {
          ws.mergeCells(blockStart, colBreak, blockEnd, colBreak);
          const c = ws.getCell(blockStart, colBreak);
          c.value = "BREAK";
          c.font = { bold: true, color: { argb: "FF166534" } };
          c.fill = fillBreak;
          c.alignment = { vertical: "middle", horizontal: "center", textRotation: 90, wrapText: true };
        }
        if (colLunch) {
          ws.mergeCells(blockStart, colLunch, blockEnd, colLunch);
          const c = ws.getCell(blockStart, colLunch);
          c.value = "LUNCH";
          c.font = { bold: true, color: { argb: "FF92400E" } };
          c.fill = fillLunch;
          c.alignment = { vertical: "middle", horizontal: "center", textRotation: 90, wrapText: true };
        }

        // Apply borders + alignment + highlights inside the block
        for (let r = blockStart; r <= blockEnd; r++) {
          const row = ws.getRow(r);
          row.height = 22;
          for (let c = 1; c <= totalCols; c++) {
            const cell = row.getCell(c);
            cell.border = border;
            if (c === 2) {
              cell.font = { bold: true, color: { argb: "FF0F172A" } };
              cell.alignment = { vertical: "middle", horizontal: "center" };
            } else if (c >= 3) {
              cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            }
          }
        }

        // Shade the whole Break/Lunch column cells (merged + header already)
        if (colBreak) {
          for (let r = blockStart; r <= blockEnd; r++) {
            ws.getCell(r, colBreak).fill = fillBreak;
          }
        }
        if (colLunch) {
          for (let r = blockStart; r <= blockEnd; r++) {
            ws.getCell(r, colLunch).fill = fillLunch;
          }
        }

        // Highlight Free Period cells
        for (let r = blockStart; r <= blockEnd; r++) {
          for (let i = 0; i < allPeriods.length; i++) {
            const p = allPeriods[i];
            if (p === "Break" || p === "LUNCH") continue;
            const c = ws.getCell(r, 3 + i);
            const txt = String(c.value || "").toLowerCase();
            if (txt.includes("free period") || txt === "free") {
              c.fill = fillFree;
              c.font = { bold: true, color: { argb: "FF0369A1" } };
            }
          }
        }

        // Separator row between days (except after last day)
        if (dayIndex < DAYS.length - 1) {
          ws.addRow([]);
          rowPtr++;
        }
      });

      // Borders for header rows
      for (let r = 1; r <= 2; r++) {
        for (let c = 1; c <= totalCols; c++) {
          ws.getCell(r, c).border = border;
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        "All-Classes-Timetable.xlsx"
      );
    } catch (err) {
      console.error("Download all Excel failed:", err);
      alert(`Failed to download Excel file.\n\n${err?.message || err}`);
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

  const [r1, r2] = await Promise.all([
    axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`),
    axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`)
  ]);

  const updates = {};

  const collectUpdates = (data, basePath) => {
    Object.entries(data || {}).forEach(([msgId, msg]) => {
      if (msg.receiverId === admin.userId && !msg.seen) {
        updates[`${basePath}/${msgId}/seen`] = true;
      }
    });
  };

  collectUpdates(r1.data, `Chats/${key1}/messages`);
  collectUpdates(r2.data, `Chats/${key2}/messages`);

  if (Object.keys(updates).length > 0) {
    await axios.patch(
      "https://ethiostore-17d9f-default-rtdb.firebaseio.com/.json",
      updates
    );
  }
};


  /* ================= STYLES ================= */
 const styles = {
  exceptionPeriodGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 8,
    margin: "10px 0 10px 0",
  },
  exceptionPeriodCheckbox: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "6px 10px",
    fontWeight: 700,
    fontSize: 13,
    color: "#0f172a",
    cursor: "pointer",
    transition: "background 0.2s, border 0.2s",
  },
  page: { display: "flex", minHeight: "100vh", fontFamily: "Poppins, sans-serif", background: "#f0f4f8" },
  
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
    marginTop: 70,
    marginLeft: 240,
    flex: 1,
    padding: 24,
    overflowY: "auto",
    minHeight: "calc(100vh - 70px)"
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
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
      color: "#0f172a",
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
      color: "#0f172a",
    },
    selectorHint: {
      fontSize: 12,
      fontWeight: 600,
      color: "#64748b",
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
      border: "1px solid #e5e7eb",
      minWidth: 200,
      fontSize: 14,
      fontWeight: 700,
      outline: "none",
      cursor: "pointer",
      background: "#ffffff",
      color: "#0f172a",
  },
    selectSmall: {
      padding: "8px 10px",
      borderRadius: 10,
      border: "1px solid #e5e7eb",
      fontSize: 13,
      fontWeight: 700,
      background: "#ffffff",
      color: "#0f172a",
      outline: "none",
      cursor: "pointer",
    },

  card: {
    background: "#fff",
    padding: 22,
    borderRadius: 20,
    marginTop: 22,
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
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
    background: "#f8fafc",
    padding: 14,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: 500,
    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
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
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 220,
  },
  freqSubjectSub: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
  },
  freqItemHover: {
    transform: "translateY(-3px)",
    boxShadow: "0 8px 18px rgba(0,0,0,0.12)"
  },

  globalGradeBlock: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: "1px solid #e5e7eb",
  },
  weeklySubjectsPanel: {
    marginTop: 8,
  },
  exceptionSection: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    boxShadow: "0 6px 16px rgba(15, 23, 42, 0.06)",
  },
  exceptionTitle: {
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 6,
  },
  exceptionHint: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    marginTop: 0,
  },
  exceptionControls: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginTop: 10,
  },
  exceptionMultiSelect: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    fontSize: 13,
    fontWeight: 700,
    background: "#ffffff",
    color: "#0f172a",
    outline: "none",
    cursor: "pointer",
    minWidth: 220,
    height: 120,
  },
  exceptionRuleItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "12px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#f8fafc",
    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
    marginBottom: 10,
  },
  exceptionRuleMeta: {
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
  },
  exceptionRemoveBtn: {
    background: "transparent",
    border: "1px solid #e5e7eb",
    color: "#ef4444",
    cursor: "pointer",
    padding: "8px 10px",
    borderRadius: 12,
    fontWeight: 900,
  },
  timetableTableWrap: {
    overflowX: "auto",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    boxShadow: "0 6px 16px rgba(15, 23, 42, 0.06)",
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
    borderBottom: "1px solid #e5e7eb",
    color: "#0f172a",
    fontWeight: 800,
    background: "#f8fafc",
  },
  timetableRow: {
    background: "#ffffff",
  },
  timetableRowAlt: {
    background: "#f8fafc",
  },
  timetableDayCell: {
    verticalAlign: "top",
    padding: "12px 12px",
    borderBottom: "1px solid #e5e7eb",
    fontWeight: 800,
    color: "#1e293b",
    whiteSpace: "nowrap",
  },
  timetableCell: {
    verticalAlign: "top",
    padding: "12px 12px",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "pre-line",
    color: "#0f172a",
    lineHeight: 1.35,
  },
  globalGradeTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0f172a",
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
    color: "#0f172a",
    letterSpacing: 0.2,
  },
  timetableSubtitle: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: 700,
    color: "#475569",
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

  const batchProgress = (() => {
    const attempt = Number(batchGenerateStatus?.attempt || 0);
    const maxAttempts = Number(batchGenerateStatus?.maxAttempts || 0);
    if (!maxAttempts) return { percent: null, attempt, maxAttempts };
    const percent = Math.min(100, Math.max(0, Math.round((attempt / Math.max(1, maxAttempts)) * 100)));
    return { percent, attempt, maxAttempts };
  })();


  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {generatingAll ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          aria-live="polite"
          aria-busy="true"
        >
          <div
            style={{
              width: "min(560px, 92vw)",
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              padding: 18,
              boxShadow: "0 10px 22px rgba(15, 23, 42, 0.16)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
              Generating schedule…
            </div>
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "#64748b" }}>
              {(batchGenerateStatus?.phase || "Working…") +
                (batchProgress?.maxAttempts
                  ? `  •  Attempt ${batchProgress.attempt}/${batchProgress.maxAttempts}`
                  : batchProgress?.attempt
                    ? `  •  Attempt ${batchProgress.attempt}`
                    : "") +
                `  •  ${Math.max(0, Math.round((batchGenerateStatus?.elapsedMs || 0) / 1000))}s`}
            </div>

            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  width: "100%",
                  height: 12,
                  background: "#e5e7eb",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
                aria-label="Schedule generation progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={batchProgress?.maxAttempts || 0}
                aria-valuenow={batchProgress?.attempt || 0}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${batchProgress?.percent ?? 8}%`,
                    background: "#2563eb",
                    transition: "width 0.15s linear",
                  }}
                />
              </div>
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: "#334155", textAlign: "right" }}>
                {batchProgress?.percent === null ? "" : `${batchProgress.percent}%`}
              </div>
            </div>
          </div>
        </div>
      ) : null}
{/* TOP NAVBAR */}
<div className="top-navbar">
  <h2>Gojo Dashboard</h2>
  
  <div className="nav-right">
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowPostDropdown(prev => !prev);
            }}
          >
            <FaBell />

            {(() => {
              const messageCount = Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0);
              const total = (postNotifications?.length || 0) + messageCount;
              return total > 0 ? (
                <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "red", color: "#fff", borderRadius: "50%", padding: "2px 6px", fontSize: "10px", fontWeight: "bold" }}>{total}</span>
              ) : null;
            })()}

            {showPostDropdown && (
              <div
                className="notification-dropdown"
                style={{ position: "absolute", top: 40, right: 0, width: 360, maxHeight: 420, overflowY: "auto", background: "#fff", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", zIndex: 1000, padding: 6 }}
                onClick={(e) => e.stopPropagation()}
              >
                {((postNotifications?.length || 0) + Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)) === 0 ? (
                  <p style={{ padding: 12, textAlign: "center", color: "#777" }}>No new notifications</p>
                ) : (
                  <div>
                    {/* Posts */}
                    {postNotifications.length > 0 && (
                      <div>
                        <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontWeight: 700 }}>Posts</div>
                        {postNotifications.map(n => (
                          <div key={n.notificationId} style={{ padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderBottom: "1px solid #f0f0f0", transition: "background 120ms ease" }} onMouseEnter={(e) => (e.currentTarget.style.background = '#f6f8fa')} onMouseLeave={(e) => (e.currentTarget.style.background = '')} onClick={() => handleNotificationClick(n)}>
                            <img src={n.adminProfile || "/default-profile.png"} alt={n.adminName} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: "block", marginBottom: 4 }}>{n.adminName}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{n.message}</p>
                            </div>
                            <div style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>{new Date(n.time || n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Messages */}
                    {Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count||0), 0) > 0 && (
                      <div>
                        <div style={{ padding: '8px 10px', color: '#333', fontWeight: 700, background: '#fafafa', borderRadius: 6, margin: '8px 6px' }}>Messages</div>
                        {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                          <div key={userId} style={{ padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderBottom: "1px solid #f0f0f0", transition: "background 120ms ease" }} onMouseEnter={(e) => (e.currentTarget.style.background = '#f6f8fa')} onMouseLeave={(e) => (e.currentTarget.style.background = '')} onClick={async () => { await markMessagesAsSeen(userId); setUnreadSenders(prev => { const copy = { ...prev }; delete copy[userId]; return copy; }); setShowPostDropdown(false); navigate('/all-chat', { state: { user: { userId, name: sender.name, profileImage: sender.profileImage, type: sender.type } } }); }}>
                            <img src={sender.profileImage || "/default-profile.png"} alt={sender.name} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: "block", marginBottom: 4 }}>{sender.name}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{sender.count} new message{sender.count > 1 && 's'}</p>
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

  {/* ================= MESSENGER ================= */}
  <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/all-chat") }>
    <FaFacebookMessenger />
    {Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0) > 0 && (
      <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "red", color: "#fff", borderRadius: "50%", padding: "2px 6px", fontSize: "10px", fontWeight: "bold" }}>{Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)}</span>
    )}
  </div>
  {/* ============== END MESSENGER ============== */}
  

  
            <Link className="icon-circle" to="/settings">
                  <FaCog />
                </Link>
            <img src={admin.profileImage || "/default-profile.png"} alt="admin" className="profile-img" />
          </div>
</div>

<div className="google-sidebar" style={{ width: '220px', padding: '10px' }}>
  <div className="sidebar-profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBottom: 6 }}>
    <div className="sidebar-img-circle" style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '2px solid #e6eefc' }}>
      <img src={admin?.profileImage || "/default-profile.png"} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{admin?.name || "Admin Name"}</h3>
    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{admin?.adminId || "username"}</p>
  </div>

  <div className="sidebar-menu" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
    <Link className="sidebar-btn" to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
      <FaHome style={{ width: 18, height: 18 }} /> Home
    </Link>
    <Link className="sidebar-btn" to="/my-posts" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
      <FaFileAlt style={{ width: 18, height: 18 }} /> My Posts
    </Link>
    <Link className="sidebar-btn" to="/teachers" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
      <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Teachers
    </Link>
    <Link className="sidebar-btn" to="/students" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
      <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Students
    </Link>
    <Link className="sidebar-btn" to="/schedule" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13, backgroundColor: '#4b6cb7', color: '#fff', borderRadius: 8 }}>
      <FaCalendarAlt style={{ width: 18, height: 18 }} /> Schedule
    </Link>
    <Link className="sidebar-btn" to="/parents" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
      <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Parents
    </Link>
    <Link className="sidebar-btn" to="/registration-form" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
      <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Registration Form
    </Link>

    <button
      className="sidebar-btn logout-btn"
      onClick={() => {
        localStorage.removeItem("admin");
        window.location.href = "/login";
      }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}
    >
      <FaSignOutAlt style={{ width: 18, height: 18 }} /> Logout
    </button>
  </div>
</div>


 

 

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
                {Object.keys(classes).map(g => <option key={g}>{g}</option>)}
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

              <button
                style={{ ...styles.purpleBtn }}
                onClick={downloadAllClassesExcel}
                disabled={generatingAll || !(classesToGenerateUnique && classesToGenerateUnique.length)}
              >
                <FaDownload /> Download All Excel
              </button>
            </div>

            {generatingAll && batchGenerateStatus ? (
              <div style={{ ...styles.selectorHint, marginTop: 8 }}>
                {batchGenerateStatus.phase || "Generating…"} Attempt {batchGenerateStatus.attempt}/{batchGenerateStatus.maxAttempts || "?"} — {Math.max(0, Math.round((batchGenerateStatus.elapsedMs || 0) / 1000))}s
              </div>
            ) : null}

            {generatingAll && batchGenerateStatus?.maxAttempts ? (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    width: "100%",
                    height: 10,
                    background: "#e5e7eb",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                  aria-label="Schedule generation progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={batchGenerateStatus.maxAttempts}
                  aria-valuenow={Math.min(batchGenerateStatus.attempt || 0, batchGenerateStatus.maxAttempts || 0)}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(0, Math.round(((batchGenerateStatus.attempt || 0) / (batchGenerateStatus.maxAttempts || 1)) * 100)))}%`,
                      background: "#2563eb",
                      transition: "width 0.15s linear",
                    }}
                  />
                </div>
              </div>
            ) : null}

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
                        {classCourses.map((course) => (
                          <div key={course.id} style={styles.freqItem}>
                            <div style={styles.freqSubject}>
                              <div style={styles.freqSubjectName}>{course.subject}</div>
                              <div style={styles.freqSubjectSub}>Periods per week</div>
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
                        ))}
                      </div>

                      {/* Exceptional subjects: forbid a subject in specific period(s) for this class */}
                      <div style={styles.exceptionSection}>
                        <div style={styles.exceptionTitle}>Exceptional subjects (optional)</div>
                        <div style={styles.exceptionHint}>
                          Choose a subject and one or more periods where it should NOT appear for this class.
                          Hold Ctrl (Windows) / ⌘ (Mac) to select multiple periods.
                        </div>

                        {(() => {
                          const activePeriods = PERIODS.filter((p) => p !== "LUNCH" && p !== "Break");
                          const draft = exceptionDraftByClass?.[classKey] || {};
                          const rules = exceptionRulesByClass?.[classKey] || [];

                          const addRule = () => {
                            const courseId = String(draft.courseId || "").trim();
                            const periods = Array.isArray(draft.period) ? draft.period.filter(Boolean) : (draft.period ? [String(draft.period)] : []);
                            if (!courseId || !periods.length) return;
                            setExceptionRulesByClass((prev) => {
                              const existing = Array.isArray(prev?.[classKey]) ? prev[classKey] : [];
                              // Prevent adding duplicates for same course+period
                              const newPeriods = periods.filter((p) => !existing.some((r) => r.courseId === courseId && Array.isArray(r.periods) ? r.periods.includes(p) : r.period === p));
                              if (!newPeriods.length) return prev;
                              // If there's an existing entry for the same course, merge periods
                              const other = existing.filter((r) => r.courseId !== courseId);
                              const same = existing.find((r) => r.courseId === courseId);
                              const merged = same ? { courseId, periods: Array.from(new Set([...(Array.isArray(same.periods) ? same.periods : same.period ? [same.period] : []), ...newPeriods])) } : { courseId, periods: newPeriods };
                              return {
                                ...(prev || {}),
                                [classKey]: [...other, merged],
                              };
                            });
                            setExceptionDraftByClass((prev) => ({
                              ...(prev || {}),
                              [classKey]: { courseId: "", period: [] },
                            }));
                          };

                          const removeRule = (idx) => {
                            setExceptionRulesByClass((prev) => {
                              const existing = Array.isArray(prev?.[classKey]) ? prev[classKey] : [];
                              const next = existing.filter((_, i) => i !== idx);
                              return { ...(prev || {}), [classKey]: next };
                            });
                          };

                          return (
                            <div>

                              <div style={styles.exceptionControls}>
                                <select
                                  style={{ ...styles.selectSmall, minWidth: 220 }}
                                  value={draft.courseId || ""}
                                  onChange={(e) =>
                                    setExceptionDraftByClass((prev) => ({
                                      ...(prev || {}),
                                      [classKey]: {
                                        ...(prev?.[classKey] || {}),
                                        courseId: e.target.value,
                                      },
                                    }))
                                  }
                                >
                                  <option value="">Select subject</option>
                                  {classCourses.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.subject}
                                    </option>
                                  ))}
                                </select>

                                <div style={styles.exceptionPeriodGrid}>
                                  {activePeriods.map((p) => (
                                    <label key={p} style={styles.exceptionPeriodCheckbox}>
                                      <input
                                        type="checkbox"
                                        checked={Array.isArray(draft.period) ? draft.period.includes(p) : false}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          setExceptionDraftByClass((prev) => {
                                            const prevArr = Array.isArray(prev?.[classKey]?.period) ? prev[classKey].period : [];
                                            const nextArr = checked
                                              ? [...prevArr, p]
                                              : prevArr.filter((x) => x !== p);
                                            return {
                                              ...(prev || {}),
                                              [classKey]: {
                                                ...(prev?.[classKey] || {}),
                                                period: nextArr,
                                              },
                                            };
                                          });
                                        }}
                                      />
                                      {p}
                                    </label>
                                  ))}
                                </div>

                                <button
                                  type="button"
                                  style={{ ...styles.greenBtn, padding: "10px 14px", borderRadius: 12 }}
                                  onClick={addRule}
                                  disabled={!draft.courseId || !(Array.isArray(draft.period) ? draft.period.length : draft.period)}
                                >
                                  + Add exception
                                </button>
                              </div>

                              {rules.length ? (
                                <div style={{ marginTop: 10 }}>
                                  {rules.map((r, idx) => {
                                    const subj = classCourses.find((c) => c.id === r.courseId)?.subject || "(Unknown subject)";
                                    const periods = Array.isArray(r.periods) ? r.periods : (r.period ? [r.period] : []);
                                    return (
                                      <div
                                        key={`${r.courseId}-${periods.join("|")}-${idx}`}
                                        style={styles.exceptionRuleItem}
                                      >
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ fontWeight: 700 }}>{subj}</div>
                                          <div style={styles.exceptionRuleMeta}>Forbidden in: {periods.join(", ")}</div>
                                        </div>
                                        <button
                                          type="button"
                                          style={styles.exceptionRemoveBtn}
                                          onClick={() => removeRule(idx)}
                                          aria-label="Remove exception"
                                        >
                                          <FaTrash />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{ ...styles.selectorHint, marginTop: 10 }}>
                                  No exceptions added for this class.
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
  
  );
}
