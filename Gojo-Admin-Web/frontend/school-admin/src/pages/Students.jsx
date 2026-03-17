import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, 
  FaSignOutAlt, FaBell, FaFacebookMessenger, FaSearch, FaCalendarAlt, FaCommentDots, FaCheck, FaPaperPlane, FaChartLine, FaChevronDown
} from "react-icons/fa";
import axios from "axios";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { useMemo } from "react";
import { getDatabase, ref, onValue, push, update } from "firebase/database";
import { getFirestore, collection, getDocs } from "firebase/firestore";

import app, { db, firestore } from "../firebase"; // Adjust the path if needed
import { BACKEND_BASE } from "../config.js";
import Sidebar from "../components/Sidebar";


function StudentsPage() {
  const API_BASE = `${BACKEND_BASE}/api`;
  // ------------------ STATES ------------------
  const [students, setStudents] = useState([]); // List of all students
  const [teachers, setTeachers] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("All"); // Grade filter
  const [selectedSection, setSelectedSection] = useState("All"); // Section filter
  const [searchTerm, setSearchTerm] = useState("");
  const [sections, setSections] = useState([]); // Sections available for selected grade
  const [selectedStudent, setSelectedStudent] = useState(null); // Currently selected student
  const [studentChatOpen, setStudentChatOpen] = useState(false); // Toggle chat popup
  const [popupMessages, setPopupMessages] = useState([]); // Messages for chat popup
  const messagesEndRef = useRef(null);
  const studentSelectionRequestRef = useRef(0);
  const [popupInput, setPopupInput] = useState(""); // Input for chat message
  const [details, setDetails] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [studentTab, setStudentTab] = useState("details");
  const [attendance, setAttendance] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState({});
  const [marks, setMarks] = useState({});
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [currentAcademicYear, setCurrentAcademicYear] = useState("");
  const [gradeOptions, setGradeOptions] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [studentFullscreenOpen, setStudentFullscreenOpen] = useState(false);
  const [fullscreenEditing, setFullscreenEditing] = useState(false);
  const [fullscreenSaving, setFullscreenSaving] = useState(false);
  const [fullscreenSectionCollapsed, setFullscreenSectionCollapsed] = useState({});
  const [fullscreenEditForm, setFullscreenEditForm] = useState({ sections: {}, additional: {} });
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(true);
  const [studentMenuOpen, setStudentMenuOpen] = useState(true);
  const navigate = useNavigate();
  const DB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";

  // Prefer the best available session payload. Sometimes `finance` can be stale/empty
  // while `admin` still contains a valid adminId/userId (or vice-versa).
  const getStoredAuth = () => {
    const parse = (raw) => {
      try {
        return JSON.parse(raw || "") || {};
      } catch (e) {
        return {};
      }
    };

    const rawFinance = localStorage.getItem("registrar");
    const rawAdmin = localStorage.getItem("admin");
    const financeObj = parse(rawFinance);
    const adminObj = parse(rawAdmin);

    const hasIdentity = (obj) => Boolean(obj && (obj.financeId || obj.adminId || obj.userId));

    if (hasIdentity(financeObj)) return { raw: rawFinance, data: financeObj, source: "finance" };
    if (hasIdentity(adminObj)) return { raw: rawAdmin, data: adminObj, source: "admin" };

    return { raw: rawFinance || rawAdmin, data: financeObj || adminObj || {}, source: rawFinance ? "registrar" : "admin" };
  };

  const _storedFinance = (() => {
    return getStoredAuth().data || {};
  })();

  const schoolCode = _storedFinance.schoolCode || "";
  const DB_URL = schoolCode
    ? `${DB_BASE}/Platform1/Schools/${schoolCode}`
    : DB_BASE;
  const STUDENTS_CACHE_KEY = `students_page_cache_${schoolCode || "global"}`;

  const readStudentsCache = () => {
    try {
      const rawSession = sessionStorage.getItem(STUDENTS_CACHE_KEY);
      const rawLocal = localStorage.getItem(STUDENTS_CACHE_KEY);
      const parsed = JSON.parse(rawSession || rawLocal || "null");
      if (!parsed || typeof parsed !== "object") return null;

      const cachedAt = Number(parsed.cachedAt || 0);
      if (!cachedAt || Date.now() - cachedAt > 10 * 60 * 1000) return null;

      if (!rawSession && rawLocal) {
        sessionStorage.setItem(STUDENTS_CACHE_KEY, rawLocal);
      }

      return parsed;
    } catch {
      return null;
    }
  };

  const writeStudentsCache = (payload) => {
    try {
      const serialized = JSON.stringify({ ...(payload || {}), cachedAt: Date.now() });
      sessionStorage.setItem(STUDENTS_CACHE_KEY, serialized);
      localStorage.setItem(STUDENTS_CACHE_KEY, serialized);
    } catch {
      // ignore cache write failures
    }
  };

  const [finance, setFinance] = useState({
    financeId: _storedFinance.financeId || _storedFinance.adminId || "",
    userId: _storedFinance.userId || "",
    schoolCode: _storedFinance.schoolCode || "",
    name: _storedFinance.name || _storedFinance.username || "Register Office",
    username: _storedFinance.username || "",
    profileImage: _storedFinance.profileImage || "/default-profile.png",
    isActive: _storedFinance.isActive || false,
  });

  // Compatibility alias: map `finance` to `admin` for older code
  const admin = {
    adminId: finance.financeId || finance.adminId || "",
    userId: finance.userId || "",
    name: finance.name || finance.username || "Register Office",
    profileImage: finance.profileImage || "/default-profile.png",
    isActive: finance.isActive || false,
  };

  // include username for sidbar display (comes from Users node)
  admin.username = finance.username || "";

  const adminId = admin?.adminId || admin?.userId || null;
  const adminUserId = admin?.userId || null;

  const [loadingFinance, setLoadingFinance] = useState(true);
  // LOAD FINANCE/ADMIN FROM LOCALSTORAGE (restored)
  const loadFinanceFromStorage = async () => {
    const storedAuth = getStoredAuth();
    const stored = storedAuth.raw;
    const parsed = storedAuth.data || {};

    if (!stored) {
      setLoadingFinance(false);
      return;
    }

    try {
      const financeData = parsed;
      const financeKey = financeData.financeId || financeData.adminId || financeData.id || financeData.uid || "";
      const possibleUserId = financeData.userId || financeData.user_id || financeData.uid || financeData.user || "";

      if (financeKey) {
        let res = null;
        try {
          res = (await axios.get(`${DB_URL}/Finance/${financeKey}.json`)) || null;
        } catch (err) {
          res = null;
        }

        if (!res || !res.data) {
          try {
            res = (await axios.get(`${DB_URL}/Academics/${financeKey}.json`)) || null;
          } catch (err) {
            res = null;
          }
        }

        if (res && res.data) {
          const node = res.data;
          const userId = node.userId || node.user_id || possibleUserId || "";

          if (userId) {
            try {
              const userRes = await axios.get(`${DB_URL}/Users/${userId}.json`);
              const nextFinance = {
                financeId: financeKey,
                userId,
                schoolCode: financeData.schoolCode || "",
                name: userRes.data?.name || node.name || financeData.name || "Register Office",
                username: userRes.data?.username || financeData.username || "",
                profileImage: userRes.data?.profileImage || node.profileImage || financeData.profileImage || "/default-profile.png",
                isActive: node.isActive || financeData.isActive || false,
              };
              setFinance(nextFinance);
              localStorage.setItem("finance", JSON.stringify({ ...financeData, ...nextFinance }));
              localStorage.setItem("admin", JSON.stringify({ ...financeData, ...nextFinance, adminId: nextFinance.financeId }));
              setLoadingFinance(false);
              return;
            } catch (err) {
              const nextFinance = {
                financeId: financeKey,
                userId,
                schoolCode: financeData.schoolCode || "",
                name: node.name || financeData.name || "Register Office",
                username: node.username || financeData.username || "",
                profileImage: node.profileImage || financeData.profileImage || "/default-profile.png",
                isActive: node.isActive || financeData.isActive || false,
              };
              setFinance(nextFinance);
              localStorage.setItem("finance", JSON.stringify({ ...financeData, ...nextFinance }));
              localStorage.setItem("admin", JSON.stringify({ ...financeData, ...nextFinance, adminId: nextFinance.financeId }));
              setLoadingFinance(false);
              return;
            }
          }
        }
      }

      if (possibleUserId) {
        try {
          const userRes = await axios.get(`${DB_URL}/Users/${possibleUserId}.json`);
          const nextFinance = {
            financeId: financeData.financeId || financeData.adminId || "",
            userId: possibleUserId,
            schoolCode: financeData.schoolCode || "",
            name: userRes.data?.name || financeData.name || "Register Office",
            username: userRes.data?.username || financeData.username || "",
            profileImage: userRes.data?.profileImage || financeData.profileImage || "/default-profile.png",
            isActive: financeData.isActive || false,
          };
          setFinance(nextFinance);
          localStorage.setItem("finance", JSON.stringify({ ...financeData, ...nextFinance }));
          localStorage.setItem("admin", JSON.stringify({ ...financeData, ...nextFinance, adminId: nextFinance.financeId }));
          setLoadingFinance(false);
          return;
        } catch (err) {
          // ignore and fallback to stored values
        }
      }

      const fallbackFinance = {
        financeId: financeData.financeId || financeData.adminId || "",
        userId: financeData.userId || "",
        schoolCode: financeData.schoolCode || "",
        name: financeData.name || financeData.username || "Register Office",
        username: financeData.username || "",
        profileImage: financeData.profileImage || "/default-profile.png",
        isActive: financeData.isActive || false,
      };
      setFinance(fallbackFinance);
      localStorage.setItem("finance", JSON.stringify({ ...financeData, ...fallbackFinance }));
      localStorage.setItem("admin", JSON.stringify({ ...financeData, ...fallbackFinance, adminId: fallbackFinance.financeId }));
    } catch (e) {
      try {
        localStorage.removeItem("registrar");
        localStorage.removeItem("admin");
      } catch (err) {}
    }

    setLoadingFinance(false);
  };
  // UI state helpers (responsive + dropdowns/chat)
  const getIsNarrow = () => (typeof window !== "undefined" ? window.innerWidth <= 800 : false);
  const getIsPortrait = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(orientation: portrait)").matches : false);

  const [isNarrow, setIsNarrow] = useState(getIsNarrow());
  const [isPortrait, setIsPortrait] = useState(getIsPortrait());
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});
  const [attendanceView, setAttendanceView] = useState("daily");
  const [attendanceCourseFilter, setAttendanceCourseFilter] = useState("All");
  const [newMessageText, setNewMessageText] = useState("");
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [activeSemester, setActiveSemester] = useState("semester1");
  const [activeQuarter, setActiveQuarter] = useState("quarter1");
  const semesterQuarters = {
    semester1: ["quarter1", "quarter2"],
    semester2: ["quarter3", "quarter4"],
  };

  const isValidGradeKey = (value) => {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric >= 1 && numeric <= 12;
  };

  const normalizeAcademicYear = (value) => String(value || "").trim().replace(/\//g, "_");
// Place before return (

  const isWebImageUrl = (value) => {
    const normalized = String(value || "").trim();
    return /^https?:\/\//i.test(normalized) || /^data:image\//i.test(normalized);
  };

  const getSafeImage = (...candidates) => {
    for (const candidate of candidates) {
      if (!candidate) continue;
      const normalized = String(candidate).trim();
      if (isWebImageUrl(normalized)) return normalized;
    }
    return "/default-profile.png";
  };

  const [studentMarks, setStudentMarks] = useState({});
  const studentMarksFlattened = useMemo(() => {
    const src = studentMarks || {};
    const out = {};

    Object.entries(src).forEach(([courseId, node]) => {
      const normalized = {};

      if (node && (node.teacherName || node.teacher)) {
        normalized.teacherName = node.teacherName || node.teacher;
      }

      // already has semester nodes
      if (node && (node.semester1 || node.semester2)) {
        if (node.semester1) normalized.semester1 = node.semester1;
        if (node.semester2) normalized.semester2 = node.semester2;
        out[courseId] = normalized;
        return;
      }

      // quarter keys -> place under semesters
      const quarterKeys = Object.keys(node || {}).filter((k) => /^quarter\d+/i.test(k));
      if (quarterKeys.length) {
        normalized.semester1 = normalized.semester1 || {};
        normalized.semester2 = normalized.semester2 || {};
        quarterKeys.forEach((qk) => {
          const qLower = qk.toLowerCase();
          if (/quarter[12]/i.test(qLower)) {
            normalized.semester1[qLower] = node[qk];
          } else {
            normalized.semester2[qLower] = node[qk];
          }
        });
        out[courseId] = normalized;
        return;
      }

      // fallback: flat assessments -> place under semester2.assessments
      if (node && node.assessments) {
        normalized.semester2 = normalized.semester2 || {};
        normalized.semester2.assessments = node.assessments;
        out[courseId] = normalized;
        return;
      }

      // default: copy whatever node was
      out[courseId] = normalized;
    });

    return out;
  }, [studentMarks]);

  const handleSendMessage = () => {
    // now newMessageText is defined
    console.log("Sending message:", newMessageText);
    // your code to send the message
  };

  // load finance/admin on mount
  useEffect(() => {
    loadFinanceFromStorage();
  }, []);

  useEffect(() => {
    const cached = readStudentsCache();
    if (!cached) return;

    if (Array.isArray(cached.studentList) && cached.studentList.length) {
      setStudents(cached.studentList);
      setStudentsLoading(false);
    }

    if (Array.isArray(cached.gradeOptions)) {
      setGradeOptions(cached.gradeOptions);
    }

    if (typeof cached.currentAcademicYear === "string") {
      setCurrentAcademicYear(cached.currentAcademicYear);
    }
  }, []);

  // If we have a `finance.userId`, fetch the Users record to ensure
  // `name`, `username`, and `profileImage` are up-to-date.
  useEffect(() => {
    if (!finance?.userId) return;

    let cancelled = false;

    const refreshUser = async () => {
      try {
        const res = await axios.get(`${DB_URL}/Users/${finance.userId}.json`);
        if (cancelled) return;
        const user = res.data || {};
        setFinance((prev) => ({
          ...prev,
          name: user.name || prev.name,
          username: user.username || prev.username,
          profileImage: user.profileImage || prev.profileImage,
        }));
      } catch (err) {
        // ignore - keep existing values
      }
    };

    refreshUser();
    return () => {
      cancelled = true;
    };
  }, [finance?.userId]);

  const handleClick = () => {
    navigate("/all-chat"); // replace with your target route
  };

  const handleSelectStudent = async (s) => {
    const requestId = studentSelectionRequestRef.current + 1;
    studentSelectionRequestRef.current = requestId;
    setSelectedStudent((prev) => ({ ...(prev || {}), ...s }));
    setRightSidebarOpen(true);
    try {
      // 1️⃣ Fetch user info
      const userRes = await axios.get(`${DB_URL}/Users/${s.userId}.json`);
      const user = userRes.data || {};

      // 2️⃣ Fetch ClassMarks from Firebase
      const marksRes = await axios.get(`${DB_URL}/ClassMarks.json`);
      const classMarks = marksRes.data || {};

      const studentMarksObj = {};
      const courseTeacherMap = {};

      // Loop through all courses
      Object.entries(classMarks).forEach(([courseId, studentsObj]) => {
        // There are two common ways to key student records under a course:
        // 1) by the Students node key (student_123) -> that's stored in s.studentId
        // 2) by a nested object where student objects might include userId properties
        // We'll prefer matching by s.studentId (the RTDB Students key).
        const studentMark =
          studentsObj?.[s.studentId] ||
          // fallback: try to find a student object whose userId matches s.userId
          Object.values(studentsObj || {}).find(
            (st) => st && (st.userId === s.userId || st.studentId === s.studentId)
          );

        if (studentMark) {
          studentMarksObj[courseId] = studentMark;
          courseTeacherMap[courseId] = studentMark.teacherName || "Teacher";
        }
      });

      // 3️⃣ Fetch Attendance (optional)
      const attendanceRes = await axios.get(`${DB_URL}/Attendance.json`);
      const attendanceRaw = attendanceRes.data || {};

      const attendanceData = [];
      Object.entries(attendanceRaw).forEach(([courseId, datesObj]) => {
        Object.entries(datesObj || {}).forEach(([date, studentsObj]) => {
          const status = studentsObj?.[s.studentId];
          if (status) {
            attendanceData.push({
              courseId,
              date,
              status,
              teacherName: courseTeacherMap[courseId] || "Teacher",
            });
          }
        });
      });

      // 4️⃣ Fetch student RTDB record (to read parents / dob if available)
      let rtStudent = {};
      try {
        if (s.studentId) {
          const rtRes = await axios.get(
            `${DB_URL}/Students/${s.studentId}.json`
          );
          rtStudent = rtRes.data || {};
        }
      } catch (err) {
        // ignore
        rtStudent = {};
      }

      // compute age from DOB (check user.dob, rtStudent.dob, or s.dob)
      const dobRaw = user?.dob || rtStudent?.dob || s?.dob;
      const computeAge = (dob) => {
        if (!dob) return null;
        try {
          const birth = new Date(dob);
          const now = new Date();
          let age = now.getFullYear() - birth.getFullYear();
          const m = now.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
          return age;
        } catch (e) {
          return null;
        }
      };

      const age = computeAge(dobRaw);

      // 5️⃣ Resolve parents: collect first parent name & phone and all parents list
      const parentsList = [];
      let parentName = null;
      let parentPhone = null;
      try {
        const parentIds = rtStudent?.parents ? Object.keys(rtStudent.parents) : (s.parents ? Object.keys(s.parents) : []);
        for (const pid of parentIds) {
          try {
            const pRes = await axios.get(`${DB_URL}/Parents/${pid}.json`);
            const parentNode = pRes.data || {};
            const parentUserId = parentNode.userId;
            if (parentUserId) {
              const uRes = await axios.get(`${DB_URL}/Users/${parentUserId}.json`);
              const parentUser = uRes.data || {};
              const pInfo = {
                parentId: pid,
                userId: parentUserId || null,
                name: parentUser.name || parentNode.name || "Parent",
                phone: parentUser.phone || parentUser.phoneNumber || parentNode.phone || null,
                profileImage: parentUser.profileImage || parentNode.profileImage || "/default-profile.png",
              };
              parentsList.push(pInfo);
              if (!parentName) parentName = pInfo.name;
              if (!parentPhone) parentPhone = pInfo.phone;
            }
          } catch (e) {
            // ignore per-parent errors
          }
        }
      } catch (e) {
        // ignore
      }
      // 6️⃣ Set selected student state (include age & parent info)
      if (studentSelectionRequestRef.current !== requestId) {
        return;
      }

      setSelectedStudent((prev) => ({
        ...(prev || {}),
        ...s,
        ...rtStudent,
        ...user,
        marks: studentMarksObj,
        attendance: attendanceData,
        age: age,
        parents: parentsList,
        parentName: parentName,
        parentPhone: parentPhone,
      }));
    } catch (err) {
      if (studentSelectionRequestRef.current === requestId) {
        console.error("Error fetching student data:", err);
      }
    }
  };

 // New: close the right sidebar (keeps selectedStudent in state so it can be reopened)
  const closeRightSidebar = () => {
    setRightSidebarOpen(false);
  };

  // Optional: function to toggle sidebar (can be used by a "Show sidebar" button)
  const openRightSidebar = () => {
    if (selectedStudent) setRightSidebarOpen(true);
  };

  // ---- Student profile edit helpers ----
  const startEditProfile = () => {
    if (!selectedStudent) return;
    setEditForm({ ...(selectedStudent || {}) });
    setEditingProfile(true);
  };

  const cancelEditProfile = () => {
    setEditingProfile(false);
    setEditForm({});
  };

  const saveProfileEdits = async () => {
    if (!selectedStudent) return;
    setSavingProfile(true);
    try {
      const payload = { ...(editForm || {}) };

      // Primary: if we have a RTDB studentId, update the Realtime DB directly
      if (selectedStudent.studentId) {
        // PATCH the Students node
        await axios.patch(`${DB_URL}/Students/${selectedStudent.studentId}.json`, payload);

        // Also update Users node when userId exists (keep profile in sync)
        if (selectedStudent.userId) {
          const userPayload = {};
          ["name", "email", "phone", "profileImage", "username"].forEach((k) => {
            if (typeof payload[k] !== "undefined") userPayload[k] = payload[k];
          });
          if (Object.keys(userPayload).length > 0) {
            await axios.patch(`${DB_URL}/Users/${selectedStudent.userId}.json`, userPayload);
          }
        }

        const updated = { ...(selectedStudent || {}), ...(payload || {}) };
        setSelectedStudent(updated);
        setStudents((prev) => prev.map((p) => (p.studentId === selectedStudent.studentId ? { ...(p || {}), ...(payload || {}) } : p)));
        setEditingProfile(false);
        setEditForm({});
        return;
      }

      // Secondary: if we have only a userId, update Users node
      if (selectedStudent.userId) {
        await axios.patch(`${DB_URL}/Users/${selectedStudent.userId}.json`, payload);
        const updated = { ...(selectedStudent || {}), ...(payload || {}) };
        setSelectedStudent(updated);
        setStudents((prev) => prev.map((p) => (p.userId === selectedStudent.userId ? { ...(p || {}), ...(payload || {}) } : p)));
        setEditingProfile(false);
        setEditForm({});
        return;
      }

      // Fallback: call backend register endpoint (create/update) if RTDB not available
      try {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
        const res = await fetch(`${BACKEND_BASE}/register/student`, { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to save via backend");

        // backend returned created/updated info
        const updated = { ...(selectedStudent || {}), ...(data || payload) };
        setSelectedStudent(updated);
        setStudents((prev) => prev.map((p) => ((p.userId && data.userId && p.userId === data.userId) || (p.studentId && data.studentId && p.studentId === data.studentId)) ? { ...(p || {}), ...(data || payload) } : p));
        setEditingProfile(false);
        setEditForm({});
        return;
      } catch (be) {
        throw be;
      }
    } catch (err) {
      console.error("Save profile error:", err);
      alert("Could not save profile: " + (err.message || err));
    } finally {
      setSavingProfile(false);
    }
  };

  // close dropdowns outside click - unchanged logic retained
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
    const fetchTeachersAndUnread = async () => {
      try {
        const [teachersRes, usersRes] = await Promise.all([
          axios.get(`${DB_URL}/Teachers.json`),
          axios.get(`${DB_URL}/Users.json`)
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
          const chatKey = `${t.userId}_${adminUserId}`;
          const res = await axios.get(`${DB_URL}/Chats/${chatKey}/messages.json`);
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

  // ------------------ FETCH STUDENTS ------------------
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const [studentsRes, schoolInfoRes, gradesRes] = await Promise.all([
          axios.get(`${DB_URL}/Students.json`),
          axios.get(`${DB_URL}/schoolInfo.json`).catch(() => ({ data: {} })),
          axios.get(`${DB_URL}/GradeManagement/grades.json`).catch(() => ({ data: {} })),
        ]);

        const studentsData = studentsRes.data || {};
        const activeAcademicYear = (schoolInfoRes.data || {}).currentAcademicYear || "";
        const gradesData = gradesRes.data || {};
        setCurrentAcademicYear(activeAcademicYear);

        const managedGrades = Object.keys(gradesData)
          .filter((gradeKey) => isValidGradeKey(gradeKey))
          .sort((a, b) => Number(a) - Number(b));
        setGradeOptions(managedGrades);
        setSelectedGrade((prev) => {
          if (prev === "All") return prev;
          return managedGrades.includes(String(prev)) ? prev : "All";
        });

        const studentKeys = Object.keys(studentsData);

        const baseStudentList = studentKeys.map((id) => {
          const student = studentsData[id];
          return {
            studentId: id,
            userId: student.userId,
            name: student.name || student.studentName || "No Name",
            profileImage: getSafeImage(
              student?.basicStudentInformation?.studentPhoto,
              student?.profileImage
            ),
            grade: student.grade,
            section: student.section,
            academicYear: student.academicYear || "",
            email: student.email || ""
          };
        });

        setStudents(baseStudentList);
        setStudentsLoading(false);
        writeStudentsCache({
          studentList: baseStudentList,
          gradeOptions: managedGrades,
          currentAcademicYear: activeAcademicYear,
        });

        try {
          const usersRes = await axios.get(`${DB_URL}/Users.json`);
          const usersData = usersRes.data || {};
          const hydratedStudentList = baseStudentList.map((student) => {
            const user = usersData[student.userId] || {};
            return {
              ...student,
              name: user.name || user.username || student.name || "No Name",
              profileImage: getSafeImage(
                user?.profileImage,
                student?.profileImage
              ),
              email: user.email || student.email || "",
            };
          });

          setStudents(hydratedStudentList);
          writeStudentsCache({
            studentList: hydratedStudentList,
            gradeOptions: managedGrades,
            currentAcademicYear: activeAcademicYear,
          });
        } catch (userErr) {
          // keep base list if users node is slow/unavailable
        }
      } catch (err) {
        console.error("Error fetching students:", err);
      } finally {
        setStudentsLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const previousAcademicYearKey = useMemo(() => {
    const text = String(currentAcademicYear || "").trim();
    if (!text) return "";
    const normalized = text.replace("/", "_");
    const parts = normalized.split("_");
    if (parts.length !== 2) return "";
    const start = Number(parts[0]);
    if (Number.isNaN(start)) return "";
    return `${start - 1}_${start}`;
  }, [currentAcademicYear]);

  const filteredStudentsBase = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return students.filter((s) => {
      if (selectedGrade !== "All" && String(s.grade) !== String(selectedGrade)) return false;
      if (selectedSection !== "All" && String(s.section) !== String(selectedSection)) return false;

      if (!normalizedSearch) return true;

      const haystack = [s.name, s.studentId, s.userId, s.email, s.grade, s.section]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [students, selectedGrade, selectedSection, searchTerm]);

  const currentYearStudents = useMemo(() => {
    if (!currentAcademicYear) return filteredStudentsBase;
    const normalizedCurrentYear = normalizeAcademicYear(currentAcademicYear);
    return filteredStudentsBase.filter(
      (student) => normalizeAcademicYear(student.academicYear) === normalizedCurrentYear
    );
  }, [filteredStudentsBase, currentAcademicYear]);

  const lastYearStudents = useMemo(() => {
    if (!previousAcademicYearKey) return [];
    return filteredStudentsBase.filter(
      (student) => String(student.academicYear || "").trim() === String(previousAcademicYearKey).trim()
    );
  }, [filteredStudentsBase, previousAcademicYearKey]);

  // ------------------ UPDATE SECTIONS WHEN GRADE CHANGES ------------------
  useEffect(() => {
    if (selectedGrade === "All") {
      setSections([]);
    } else {
      const gradeSections = [...new Set(students.filter(s => String(s.grade) === String(selectedGrade)).map(s => s.section))];
      setSections(gradeSections);
      setSelectedSection("All");
    }
  }, [selectedGrade, students]);


  // ---------------- FETCH PERFORMANCE ----------------
  // This effect reads ClassMarks and stores only the entries for the selected student.
  useEffect(() => {
    if (!selectedStudent?.studentId) {
      setStudentMarks({});
      return;
    }

    let cancelled = false;

    async function fetchMarks() {
      try {
        const res = await axios.get(
          `${DB_URL}/ClassMarks.json`
        );

        const marksObj = {};
        Object.entries(res.data || {}).forEach(([courseId, students]) => {
          // Try direct key
          if (students?.[selectedStudent.studentId]) {
            marksObj[courseId] = students[selectedStudent.studentId];
            return;
          }

          // Fallback: try to find by userId inside student nodes
          const found = Object.values(students || {}).find(s => s && (s.userId === selectedStudent.userId || s.studentId === selectedStudent.studentId));
          if (found) marksObj[courseId] = found;
        });

        if (!cancelled) {
          setStudentMarks(marksObj);
        }
      } catch (err) {
        console.error("Marks fetch error:", err);
        if (!cancelled) setStudentMarks({});
      }
    }

    fetchMarks();

    return () => {
      cancelled = true;
    };
  }, [selectedStudent]);

  useEffect(() => {
    if (studentTab !== "payment" || !selectedStudent) return;

    const fetchPaymentHistory = async () => {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const year = new Date().getFullYear();
      const studentKey = selectedStudent?.studentId || selectedStudent?.userId || String(selectedStudent?.id || "");
      const out = {};

      await Promise.all(
        months.map(async (m) => {
          const key = `${year}-${m}`;
          try {
            const res = await axios.get(`${DB_URL}/monthlyPaid/${key}.json`).catch(() => ({ data: {} }));
            const node = res.data || {};
            out[key] = !!(node && (node[studentKey] || node[String(studentKey)]));
          } catch {
            out[key] = false;
          }
        })
      );

      setPaymentHistory(out);
    };

    fetchPaymentHistory();
  }, [studentTab, selectedStudent, DB_URL]);


  //-------------------------Fetch unread status for each student--------------
  useEffect(() => {
    const fetchUnread = async () => {
      const map = {};

      for (const s of students) {
        const key = `${s.studentId}_${admin.userId}`;

        const res = await axios.get(
          `${DB_URL}/Chats/${key}/messages.json`
        );

        const msgs = res.data || {};
        map[s.studentId] = Object.values(msgs).some(
          m => m.senderId === s.studentId && m.seenByAdmin === false
        );

      }

      setUnreadMap(map);
    };

    if (students.length > 0) fetchUnread();
  }, [students]);

  // ---------------- FETCH CHAT MESSAGES ----------------
  useEffect(() => {
    if (!studentChatOpen || !selectedStudent) return;

    const chatKey = getChatKey(selectedStudent.userId, adminUserId);

    const fetchMessages = async () => {
      try {
        const res = await axios.get(
          `${DB_URL}/Chats/${chatKey}/messages.json`
        );

        const msgs = Object.values(res.data || {}).map(m => ({
          ...m,
          sender: m.senderId === adminUserId ? "admin" : "student"
        })).sort((a, b) => a.timeStamp - b.timeStamp);

        setPopupMessages(msgs);
      } catch (err) {
        console.error(err);
      }
    };

    fetchMessages();
  }, [studentChatOpen, selectedStudent, adminUserId]);

  // ---------------- SEND MESSAGE ----------------
  const sendPopupMessage = async () => {
    if (!popupInput.trim() || !selectedStudent) return;

    const newMessage = {
      senderId: adminUserId,
      receiverId: selectedStudent.userId,
      text: popupInput,
      timeStamp: Date.now(),
      seen: false
    };

    try {
      const chatKey = `${selectedStudent.userId}_${adminUserId}`;
      // 1) push message
      const pushRes = await axios.post(
        `${DB_URL}/Chats/${chatKey}/messages.json`,
        {
          senderId: newMessage.senderId,
          receiverId: newMessage.receiverId,
          type: newMessage.type || "text",
          text: newMessage.text || "",
          imageUrl: newMessage.imageUrl || null,
          replyTo: newMessage.replyTo || null,
          seen: false,
          edited: false,
          deleted: false,
          timeStamp: newMessage.timeStamp
        }
      );

      const generatedId = pushRes.data && pushRes.data.name;

      // 2) update lastMessage + participants
      const lastMessage = {
        text: newMessage.text,
        senderId: newMessage.senderId,
        seen: false,
        timeStamp: newMessage.timeStamp,
      };

      await axios.patch(
        `${DB_URL}/Chats/${chatKey}.json`,
        {
          participants: {
            ...(/* keep existing participants if any */ {}),
            [adminUserId]: true,
            [selectedStudent.userId]: true,
          },
          lastMessage,
        }
      );

      // 3) increment unread for receiver
      try {
        const unreadRes = await axios.get(
          `${DB_URL}/Chats/${chatKey}/unread.json`
        );
        const unread = unreadRes.data || {};
        const prev = Number(unread[selectedStudent.userId] || 0);
        const updated = { ...(unread || {}), [selectedStudent.userId]: prev + 1, [adminUserId]: Number(unread[adminUserId] || 0) };
        await axios.put(
          `${DB_URL}/Chats/${chatKey}/unread.json`,
          updated
        );
      } catch (uErr) {
        await axios.put(
          `${DB_URL}/Chats/${chatKey}/unread.json`,
          { [selectedStudent.userId]: 1, [adminUserId]: 0 }
        );
      }

      // 4) update UI
      setPopupMessages(prev => [...prev, { messageId: generatedId || `${Date.now()}`, ...newMessage, sender: "admin" }]);
      setPopupInput("");
    } catch (err) {
      console.error(err);
    }
  };

  // General sendMessage used by the inline chat input (uses `newMessageText`)
  const sendMessage = async () => {
    if (!newMessageText.trim() || !selectedStudent) return;

    const newMessage = {
      senderId: adminUserId,
      receiverId: selectedStudent.userId,
      text: newMessageText,
      timeStamp: Date.now(),
      seen: false,
    };

    try {
      const chatKey = getChatKey(selectedStudent.userId, adminUserId);

      // push message with full schema
      try {
        const pushRes = await axios.post(
          `${DB_URL}/Chats/${chatKey}/messages.json`,
          {
            senderId: newMessage.senderId,
            receiverId: newMessage.receiverId,
            type: newMessage.type || "text",
            text: newMessage.text || "",
            imageUrl: null,
            replyTo: null,
            seen: false,
            edited: false,
            deleted: false,
            timeStamp: newMessage.timeStamp,
          }
        );

        const generatedId = pushRes.data && pushRes.data.name;

        // patch lastMessage + participants
        const lastMessage = { text: newMessage.text, senderId: newMessage.senderId, seen: false, timeStamp: newMessage.timeStamp };
        await axios.patch(
          `${DB_URL}/Chats/${chatKey}.json`,
          {
            participants: { [adminUserId]: true, [selectedStudent.userId]: true },
            lastMessage,
          }
        );

        // update unread
        try {
          const unreadRes = await axios.get(`${DB_URL}/Chats/${chatKey}/unread.json`);
          const unread = unreadRes.data || {};
          const prev = Number(unread[selectedStudent.userId] || 0);
          const updated = { ...(unread || {}), [selectedStudent.userId]: prev + 1, [adminUserId]: Number(unread[adminUserId] || 0) };
          await axios.put(`${DB_URL}/Chats/${chatKey}/unread.json`, updated);
        } catch (uErr) {
          await axios.put(`${DB_URL}/Chats/${chatKey}/unread.json`, { [selectedStudent.userId]: 1, [adminUserId]: 0 });
        }

        setPopupMessages(prev => [...prev, { messageId: generatedId || `${Date.now()}`, ...newMessage, sender: 'admin' }]);
        setNewMessageText("");
      } catch (err) {
        console.error("Failed to send message:", err);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // ---------------- CLOSE DROPDOWN ON OUTSIDE CLICK ----------------
  useEffect(() => {
    const closeDropdown = (e) => {
      if (
        !e.target.closest(".icon-circle") &&
        !e.target.closest(".messenger-dropdown")
      ) {
        setShowMessageDropdown(false);
      }
    };

    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    const onResize = () => {
      try {
        setIsNarrow(getIsNarrow());
        setIsPortrait(getIsPortrait());
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---------------- MARK MESSAGES AS SEEN ----------------
  useEffect(() => {
    if (!studentChatOpen || !selectedStudent) return;

    const chatKey = getChatKey(selectedStudent.userId, adminUserId);
    const messagesRef = ref(dbRT, `Chats/${chatKey}/messages`);

    const handleSnapshot = async (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data)
        .map(([id, msg]) => ({ messageId: id, ...msg }))
        .sort((a, b) => a.timeStamp - b.timeStamp);
      setPopupMessages(list);

      // mark any unseen messages addressed to admin as seen
      const updates = {};
      Object.entries(data).forEach(([msgId, msg]) => {
        if (msg && msg.receiverId === adminUserId && !msg.seen) {
          updates[`Chats/${chatKey}/messages/${msgId}/seen`] = true;
        }
      });

      if (Object.keys(updates).length > 0) {
        try {
          await axios.patch(`${DB_URL}/.json`, updates);
          // reset unread and mark lastMessage seen at chat root
          axios.patch(`${DB_URL}/Chats/${chatKey}.json`, { unread: { [adminUserId]: 0 }, lastMessage: { seen: true } }).catch(() => {});
        } catch (err) {
          console.error('Failed to patch seen updates:', err);
        }
      }
    };

    const unsubscribe = onValue(messagesRef, handleSnapshot);
    return () => unsubscribe();
  }, [studentChatOpen, selectedStudent, adminUserId]);

  const attendanceStats = useMemo(() => {
    if (!selectedStudent?.attendance) return null;

    const total = selectedStudent.attendance.length;
    const present = selectedStudent.attendance.filter(a => a.status === "present").length;
    const absent = total - present;
    const percent = total ? Math.round((present / total) * 100) : 0;

    // Consecutive absences
    let streak = 0;
    [...selectedStudent.attendance]
      .sort((a, b) => b.date.localeCompare(a.date))
      .some(a => {
        if (a.status === "absent") {
          streak++;
          return false;
        }
        return true;
      });

    return { total, present, absent, percent, streak };
  }, [selectedStudent]);

  const attendanceData = React.useMemo(() => {
    if (!selectedStudent?.attendance) return [];

    return selectedStudent.attendance.map(a => ({
      date: a.date || a.created_at,
      courseId: a.courseId || a.course || "Unknown Course",
      teacherName: a.teacherName || a.teacher || "Unknown Teacher",
      status: a.status || a.attendance_status || "absent"
    }));
  }, [selectedStudent]);

  const groupedAttendance = React.useMemo(() => {
    if (!attendanceData.length) return {};

    return attendanceData.reduce((acc, record) => {
      const dateKey = new Date(record.date).toLocaleDateString();

      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(record);

      return acc;
    }, {});
  }, [attendanceData]);


  const toggleExpand = (key) => {
    setExpandedCards((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getProgress = (records) => {
    if (!records || !records.length) return 0;
    const presentCount = records.filter(
      (r) => r.status === "present" || r.status === "late"
    ).length;
    return Math.round((presentCount / records.length) * 100);
  };

  const attendanceBySubject = attendanceData.reduce((acc, cur) => {
    if (!acc[cur.courseId]) acc[cur.courseId] = [];
    acc[cur.courseId].push(cur);
    return acc;
  }, {});

  const formatSubjectName = (courseId = "") => {
    if (!courseId) return "";
    // remove common prefixes/suffixes and underscores, then title-case words
    const clean = String(courseId)
      .replace(/^course_/, "")
      .replace(/_[0-9A-Za-z]+$/, "")
      .replace(/_/g, " ")
      .trim();

    return clean
      .split(/\s+/)
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
      .join(" ");
  };





  const contentLeft = 0;
  const rightSidebarOffset = !isPortrait ? 408 : 2;

  const registrationSections = useMemo(() => {
    if (!selectedStudent) return null;

    return {
      basic: selectedStudent.basicStudentInformation || {},
      parent: selectedStudent.parentGuardianInformation || {},
      address: selectedStudent.addressInformation || {},
      finance: selectedStudent.financeInformation || {},
      health: selectedStudent.healthEmergency || {},
      academic: selectedStudent.academicSetup || {},
      system: selectedStudent.systemAccountInformation || {},
    };
  }, [selectedStudent]);

  const sectionDefinitions = useMemo(() => ([
    { key: "basic", title: "1) Basic Student Information" },
    { key: "parent", title: "2) Parent / Guardian Information", fullWidth: true },
    { key: "address", title: "3) Address Information" },
    { key: "finance", title: "4) Finance Information" },
    { key: "health", title: "5) Health & Emergency" },
    { key: "academic", title: "6) Academic Setup" },
    { key: "system", title: "7) System Account Information" },
  ]), []);

  const excludedAdditionalKeys = useMemo(() => [
    "basicStudentInformation",
    "parentGuardianInformation",
    "addressInformation",
    "financeInformation",
    "healthEmergency",
    "academicSetup",
    "systemAccountInformation",
    "marks",
    "attendance",
    "parents",
    "studentId",
    "userId",
  ], []);

  const stringifyIfObject = (value) => {
    if (value && typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2);
      } catch (e) {
        return "";
      }
    }
    return value ?? "";
  };

  const parseEditableValue = (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        return value;
      }
    }
    return value;
  };

  const normalizeEditableMap = (obj = {}) => {
    const out = {};
    Object.entries(obj || {}).forEach(([key, value]) => {
      out[key] = parseEditableValue(value);
    });
    return out;
  };

  const formatFieldLabel = (fieldKey = "") =>
    String(fieldKey)
      .replace(/([A-Z])/g, " $1")
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (char) => char.toUpperCase());

  const isImageValue = (fieldKey, value) => {
    if (!value || typeof value !== "string") return false;
    const val = value.trim();
    const isUrlLike = /^https?:\/\//i.test(val) || /^data:image\//i.test(val);
    const hasImageExt = /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(val);
    const keyHintsImage = /(image|photo|avatar|nationalid|nid)/i.test(String(fieldKey || ""));
    return (keyHintsImage && isUrlLike) || hasImageExt || /^data:image\//i.test(val);
  };

  const renderDisplayValue = (fieldKey, value) => {
    if (isImageValue(fieldKey, value)) {
      return (
        <img
          src={String(value)}
          alt={formatFieldLabel(fieldKey)}
          style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border-strong)" }}
        />
      );
    }

    if (Array.isArray(value)) {
      if (!value.length) return <span>-</span>;

      return (
        <div style={{ display: "grid", gap: 8 }}>
          {value.map((item, index) => (
            <div
              key={`${String(fieldKey)}_${index}`}
              style={{ background: "var(--surface-muted)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 10px" }}
            >
              {item && typeof item === "object" ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  {Object.entries(item).map(([nestedKey, nestedValue]) => (
                    <div key={`${nestedKey}_${index}`}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>
                        {formatFieldLabel(nestedKey)}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-primary)", wordBreak: "break-word" }}>
                        {renderDisplayValue(nestedKey, nestedValue)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <span>{String(item || "-")}</span>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (value && typeof value === "object") {
      return (
        <div style={{ display: "grid", gap: 6 }}>
          {Object.entries(value).map(([nestedKey, nestedValue]) => (
            <div
              key={nestedKey}
              style={{ background: "var(--surface-muted)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 10px" }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>
                {formatFieldLabel(nestedKey)}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-primary)", wordBreak: "break-word" }}>
                {renderDisplayValue(nestedKey, nestedValue)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === "boolean") {
      return <span>{value ? "Yes" : "No"}</span>;
    }

    return <span>{String(value || "-")}</span>;
  };

  const resetFullscreenEditFormFromSelected = () => {
    if (!selectedStudent) return;
    const sectionsForm = {
      basic: Object.fromEntries(Object.entries(registrationSections?.basic || {}).map(([k, v]) => [k, stringifyIfObject(v)])),
      parent: Object.fromEntries(Object.entries(registrationSections?.parent || {}).map(([k, v]) => [k, stringifyIfObject(v)])),
      address: Object.fromEntries(Object.entries(registrationSections?.address || {}).map(([k, v]) => [k, stringifyIfObject(v)])),
      finance: Object.fromEntries(Object.entries(registrationSections?.finance || {}).map(([k, v]) => [k, stringifyIfObject(v)])),
      health: Object.fromEntries(Object.entries(registrationSections?.health || {}).map(([k, v]) => [k, stringifyIfObject(v)])),
      academic: Object.fromEntries(Object.entries(registrationSections?.academic || {}).map(([k, v]) => [k, stringifyIfObject(v)])),
      system: Object.fromEntries(Object.entries(registrationSections?.system || {}).map(([k, v]) => [k, stringifyIfObject(v)])),
    };

    const additionalSource = Object.fromEntries(
      Object.entries(selectedStudent || {}).filter(([key]) => !excludedAdditionalKeys.includes(key))
    );

    const additionalForm = Object.fromEntries(
      Object.entries(additionalSource).map(([k, v]) => [k, stringifyIfObject(v)])
    );

    setFullscreenEditForm({ sections: sectionsForm, additional: additionalForm });
    setFullscreenSectionCollapsed({
      basic: false,
      parent: false,
      address: false,
      finance: false,
      health: false,
      academic: false,
      system: false,
      additional: false,
    });
  };

  useEffect(() => {
    if (!studentFullscreenOpen || !selectedStudent) return;
    resetFullscreenEditFormFromSelected();
    setFullscreenEditing(false);
  }, [studentFullscreenOpen, selectedStudent, registrationSections, excludedAdditionalKeys]);

  const toggleFullscreenSection = (sectionKey) => {
    setFullscreenSectionCollapsed((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const updateFullscreenSectionField = (sectionKey, fieldKey, value) => {
    setFullscreenEditForm((prev) => ({
      ...prev,
      sections: {
        ...(prev.sections || {}),
        [sectionKey]: {
          ...((prev.sections || {})[sectionKey] || {}),
          [fieldKey]: value,
        },
      },
    }));
  };

  const updateFullscreenAdditionalField = (fieldKey, value) => {
    setFullscreenEditForm((prev) => ({
      ...prev,
      additional: {
        ...(prev.additional || {}),
        [fieldKey]: value,
      },
    }));
  };

  const saveFullscreenEdits = async () => {
    if (!selectedStudent?.studentId) return;

    setFullscreenSaving(true);
    try {
      const normalizedSections = {
        basic: normalizeEditableMap(fullscreenEditForm.sections?.basic || {}),
        parent: normalizeEditableMap(fullscreenEditForm.sections?.parent || {}),
        address: normalizeEditableMap(fullscreenEditForm.sections?.address || {}),
        finance: normalizeEditableMap(fullscreenEditForm.sections?.finance || {}),
        health: normalizeEditableMap(fullscreenEditForm.sections?.health || {}),
        academic: normalizeEditableMap(fullscreenEditForm.sections?.academic || {}),
        system: normalizeEditableMap(fullscreenEditForm.sections?.system || {}),
      };

      const normalizedAdditional = normalizeEditableMap(fullscreenEditForm.additional || {});

      const studentPayload = {
        basicStudentInformation: normalizedSections.basic,
        parentGuardianInformation: normalizedSections.parent,
        addressInformation: normalizedSections.address,
        financeInformation: normalizedSections.finance,
        healthEmergency: normalizedSections.health,
        academicSetup: normalizedSections.academic,
        systemAccountInformation: normalizedSections.system,
        ...normalizedAdditional,
      };

      await axios.patch(`${DB_URL}/Students/${selectedStudent.studentId}.json`, studentPayload);

      if (selectedStudent.userId) {
        const userPayload = {};
        const userFieldCandidates = [
          "name",
          "email",
          "phone",
          "profileImage",
          "username",
          "dob",
          "gender",
          "nationality",
          "nationalIdNumber",
          "nationalIdImageUrl",
        ];

        userFieldCandidates.forEach((field) => {
          if (typeof normalizedAdditional[field] !== "undefined") {
            userPayload[field] = normalizedAdditional[field];
          }
        });

        if (!userPayload.name && normalizedSections.basic?.studentFullName) {
          userPayload.name = normalizedSections.basic.studentFullName;
        }
        if (!userPayload.username && normalizedSections.system?.studentUsername) {
          userPayload.username = normalizedSections.system.studentUsername;
        }

        if (Object.keys(userPayload).length > 0) {
          await axios.patch(`${DB_URL}/Users/${selectedStudent.userId}.json`, userPayload);
        }
      }

      const updatedSelected = {
        ...(selectedStudent || {}),
        ...studentPayload,
        name: normalizedAdditional.name || normalizedSections.basic?.studentFullName || selectedStudent.name,
        profileImage: normalizedAdditional.profileImage || selectedStudent.profileImage,
        email: normalizedAdditional.email || selectedStudent.email,
        phone: normalizedAdditional.phone || selectedStudent.phone,
        username: normalizedAdditional.username || normalizedSections.system?.studentUsername || selectedStudent.username,
      };

      setSelectedStudent(updatedSelected);
      setStudents((prev) =>
        prev.map((item) =>
          item.studentId === selectedStudent.studentId
            ? {
                ...item,
                name: updatedSelected.name || item.name,
                profileImage: updatedSelected.profileImage || item.profileImage,
                email: updatedSelected.email || item.email,
                grade: updatedSelected.grade || item.grade,
                section: updatedSelected.section || item.section,
              }
            : item
        )
      );

      setFullscreenEditing(false);
      alert("Student information updated successfully.");
    } catch (err) {
      console.error("Fullscreen save error:", err);
      alert("Could not save student information: " + (err.message || err));
    } finally {
      setFullscreenSaving(false);
    }
  };

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
  const shellCardStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    borderRadius: 12,
    boxShadow: "var(--shadow-soft)",
  };
  const softPanelStyle = {
    background: "var(--surface-muted)",
    border: "1px solid var(--border-soft)",
    borderRadius: 10,
  };
  const listCardStyle = (isSelected) => ({
    width: isNarrow ? "92%" : "560px",
    minHeight: "86px",
    borderRadius: "14px",
    padding: "12px",
    background: isSelected ? "var(--surface-accent)" : "var(--surface-panel)",
    border: isSelected ? "2px solid var(--accent-strong)" : "1px solid var(--border-soft)",
    boxShadow: isSelected ? "var(--shadow-glow)" : "var(--shadow-soft)",
    cursor: "pointer",
    transition: "all 0.25s ease",
    position: "relative",
  });
  const rightDrawerCardStyle = {
    background: "var(--surface-panel)",
    borderRadius: 12,
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
  };

 return (
   <div className="dashboard-page" style={{ background: "var(--page-bg)", minHeight: "100vh", height: "100vh", overflow: "hidden", color: "var(--text-primary)" }}>
      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "4px 14px", height: "calc(100vh - 73px)", overflow: "hidden", background: "var(--page-bg)", width: "100%", boxSizing: "border-box" }}>
        {/* ---------------- SIDEBAR ---------------- */}
        <Sidebar admin={admin} />
        {/* ---------------- MAIN CONTENT ---------------- */}
        <div
          className={`main-content ${rightSidebarOpen ? "sidebar-open" : ""}`}
          style={{
            flex: "1.08 1 0",
            minWidth: 0,
            maxWidth: "none",
            margin: "0",
            boxSizing: "border-box",
            alignSelf: "stretch",
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarWidth: "thin",
            scrollbarColor: "transparent transparent",
            padding: `0 ${rightSidebarOffset}px 0 2px`,
          }}
        >
          <div className="main-inner" style={{ marginLeft: 0, marginTop: 0 }}>
            <div
              className="section-header-card"
              style={{
                margin: "0 0 12px",
                marginLeft: 0,
                width: "min(100%, 1320px)",
              }}
            >
              <h2 className="section-header-card__title" style={{ fontSize: "20px" }}>Students</h2>
              <div className="section-header-card__meta">
                <span>Total: {filteredStudentsBase.length}</span>
                <span>Current Year: {currentYearStudents.length}</span>
                <span className="section-header-card__chip">
                  {currentAcademicYear
                    ? `Academic Year: ${String(currentAcademicYear).replace("_", "/")}`
                    : "Academic Year: Not Set"}
                </span>
              </div>
            </div>

            {/* Search */}
            <div style={{ display: "flex", justifyContent: isNarrow ? "center" : "flex-start", marginBottom: "10px", paddingLeft: contentLeft }}>
              <div
                style={{
                  width: isNarrow ? "92%" : "560px",
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

            {/* Grade Filter */}
            <div style={{ display: "flex", justifyContent: isNarrow ? "center" : "flex-start", marginBottom: "10px", paddingLeft: contentLeft }}>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  maxWidth: "100%",
                  overflowX: "auto",
                  paddingBottom: 1,
                }}
              >
                {["All", ...gradeOptions].map(g => (
                  <button
                    key={g}
                    onClick={() => setSelectedGrade(g)}
                    style={chipStyle(selectedGrade === g)}
                  >
                    {g === "All" ? "All Grades" : `Grade ${g}`}
                  </button>
                ))}
              </div>
            </div>


            {/* Section Filter */}
            {selectedGrade !== "All" && sections.length > 0 && (
              <div style={{ display: "flex", justifyContent: isNarrow ? "center" : "flex-start", marginBottom: "10px", paddingLeft: contentLeft }}>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    maxWidth: "100%",
                    overflowX: "auto",
                    paddingBottom: 1,
                  }}
                >
                  {["All", ...sections].map(section => (
                    <button
                      key={section}
                      onClick={() => setSelectedSection(section)}
                      style={chipStyle(selectedSection === section)}
                    >
                      {section === "All" ? "All Sections" : `Section ${section}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Students List */}
            {studentsLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: isNarrow ? "center" : "flex-start", gap: "12px", paddingLeft: contentLeft }}>
                {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} style={{ width: isNarrow ? "92%" : "560px", height: "86px", borderRadius: "14px", padding: "12px", background: "var(--surface-panel)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-soft)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-muted)" }} />
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface-muted)" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ width: "60%", height: 12, background: "var(--surface-muted)", borderRadius: 6, marginBottom: 8 }} />
                        <div style={{ width: "40%", height: 10, background: "var(--surface-muted)", borderRadius: 6 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: isNarrow ? "center" : "flex-start", gap: "12px", paddingLeft: contentLeft }}>
                {currentYearStudents.length === 0 ? (
                  <p style={{ width: isNarrow ? "92%" : "560px", textAlign: "center", color: "var(--text-muted)", margin: 0 }}>No current year students for this selection.</p>
                ) : (
                  currentYearStudents.map((s, i) => (
                    <div
                      key={`current-${s.studentId || s.userId || i}`}
                      onClick={() => handleSelectStudent(s)}
                      className="student-card"
                      style={listCardStyle(selectedStudent?.studentId === s.studentId)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingRight: 110 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-accent)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flex: "0 0 auto" }}>
                          {i + 1}
                        </div>
                        <img src={s.profileImage} alt={s.name} style={{ width: "48px", height: "48px", borderRadius: "50%", border: selectedStudent?.studentId === s.studentId ? "3px solid var(--accent)" : "3px solid var(--border-soft)", objectFit: "cover", transition: "all 0.3s ease" }} />
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{ margin: 0, fontSize: "14px", color: "var(--text-primary)", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</h3>
                          <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: 4 }}>
                            Grade {s.grade} • Section {s.section}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        {/* RIGHT SIDEBAR */}
  <div
    style={{
      width: isPortrait ? "100%" : "380px",
      position: "fixed",
      left: isPortrait ? 0 : "auto",
      right: 0,
      top: isPortrait ? 0 : "55px",
      height: isPortrait ? "100vh" : "calc(100vh - 55px)",
      background: "var(--surface-panel)",
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      padding: "14px",
      boxShadow: "var(--shadow-panel)",
      borderLeft: isPortrait ? "none" : "1px solid var(--border-soft)",
      transition: "all 0.35s ease",
      fontSize: "12px",
    }}
  >
    {/* Close button */}
    {selectedStudent && (
      <div style={{ position: "absolute", top: 12, left: 14, zIndex: 2000 }}>
        <button
          onClick={() => {
            studentSelectionRequestRef.current += 1;
            setRightSidebarOpen(false);
            setStudentFullscreenOpen(false);
            setSelectedStudent(null);
          }}
          aria-label="Close sidebar"
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
    )}

    {/* Expand button */}
    {selectedStudent && (
      <div style={{ position: "absolute", top: 8, right: 14, zIndex: 2000 }}>
        <button
          onClick={() => setStudentFullscreenOpen(true)}
          aria-label="Expand student profile"
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

    {/* Header */}
    <div
      style={{
        background: "linear-gradient(135deg, var(--accent-strong), var(--accent))",
        margin: "-14px -14px 12px",
        padding: "16px 10px",
        textAlign: "center",
      }}
    >
      {selectedStudent ? (
        <>
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
            <img
              src={selectedStudent.profileImage}
              alt={selectedStudent.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          <h2 style={{ margin: 0, color: "#ffffff", fontSize: 14, fontWeight: 800 }}>{selectedStudent.name}</h2>
          <p style={{ margin: "4px 0", color: "#dbeafe", fontSize: "10px" }}>{selectedStudent.studentId}</p>
          <p style={{ margin: 0, color: "#dbeafe", fontSize: "10px" }}>
            Grade {selectedStudent.grade} - Section {selectedStudent.section}
          </p>
        </>
      ) : (
        <>
          <div
            style={{
              width: "70px",
              height: "70px",
              margin: "0 auto 10px",
              borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              background: "rgba(255,255,255,0.1)"
            }}
          >
            <FaChalkboardTeacher size={30} />
          </div>

          <h2 style={{ margin: 0, color: "#ffffff", fontSize: 14, fontWeight: 800 }}>
            Students Workspace
          </h2>

          <p style={{ margin: "4px 0", color: "#dbeafe", fontSize: "10px", fontWeight: 600 }}>
            Student Overview
          </p>
        </>
      )}
    </div>

    {/* Tabs */}
    {selectedStudent ? (
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-soft)", marginBottom: "10px" }}>
        {["details", "attendance", "payment"].map((tab) => (
          <button
            key={tab}
            onClick={() => setStudentTab(tab)}
            style={{
              flex: 1,
              padding: "6px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              color: studentTab === tab ? "var(--accent-strong)" : "var(--text-muted)",
              fontSize: "10px",
              borderBottom: studentTab === tab ? "3px solid var(--accent-strong)" : "3px solid transparent",
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>
    ) : null}

    {!selectedStudent ? (
      <div
        style={{
          padding: "10px",
          display: "grid",
          gap: 8,
          gridTemplateColumns: "1fr 1fr",
          marginBottom: "10px"
        }}
      >
        {[
          { label: "Total", value: students.length },
          { label: "Visible", value: filteredStudentsBase.length },
          { label: "Grade", value: selectedGrade === "All" ? "All" : `G${selectedGrade}` },
          { label: "Search", value: searchTerm ? "Active" : "None" }
        ].map((item) => (
          <div
            key={item.label}
            style={{
              ...rightDrawerCardStyle,
              padding: "10px",
              minHeight: 56,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center"
            }}
          >
            <div
              style={{
                fontSize: "9px",
                fontWeight: 800,
                color: "var(--text-muted)",
                letterSpacing: "0.3px",
                textTransform: "uppercase"
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 800,
                color: "var(--text-primary)",
                marginTop: 2
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>
    ) : null}

    {/* Tab Content */}
    <div>
      {/* DETAILS TAB */}
      {studentTab === "details" && selectedStudent && (
        <div
          style={{
            padding: "12px",
            ...rightDrawerCardStyle,
            margin: "0 auto",
            maxWidth: 380,
          }}
        >
          <div>
            {/* STUDENT DETAILS */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3
                style={{
                  margin: 0,
                  marginBottom: 6,
                  color: "var(--text-primary)",
                  fontWeight: 800,
                  letterSpacing: "0.1px",
                  fontSize: 12,
                  textAlign: "left",
                }}
              >
                Student Profile
              </h3>

              <div style={{ display: "flex", gap: 8 }}>
                {!editingProfile ? (
                  <button
                    onClick={startEditProfile}
                    style={{
                      background: "var(--surface-panel)",
                      border: "1px solid var(--border-strong)",
                      color: "var(--accent-strong)",
                      padding: "6px 10px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={saveProfileEdits}
                      disabled={savingProfile}
                      style={{
                        background: "var(--accent-strong)",
                        border: "none",
                        color: "#fff",
                        padding: "6px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      {savingProfile ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEditProfile}
                      style={{
                        background: "var(--surface-panel)",
                        border: "1px solid var(--border-soft)",
                        color: "var(--text-secondary)",
                        padding: "6px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            <div style={{ color: "var(--text-muted)", fontSize: 9, textAlign: "left", marginBottom: 10 }}>
              ID: <b style={{ color: "var(--text-primary)" }}>{selectedStudent?.studentId || "N/A"}</b>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {[
                { label: "Phone", key: "phone", icon: "📱" },
                { label: "Gender", key: "gender", icon: "⚧" },
                { label: "Email", key: "email", icon: "📧" },
                { label: "Grade", key: "grade", icon: "🏫" },
                { label: "Section", key: "section", icon: "🧩" },
                { label: "Age", key: "age", icon: "🎂" },
                { label: "Birth Date", key: "dob", icon: "📅" },
                { label: "Parent Name", key: "parentName", icon: "👤" },
                { label: "Parent Phone", key: "parentPhone", icon: "☎️" },
              ].map(({ label, key, icon }) => {
                const value = selectedStudent?.[key];
                return (
                  <div
                    key={key}
                    style={{
                      alignItems: "center",
                      justifyContent: "flex-start",
                      display: "flex",
                      background: "var(--surface-panel)",
                      padding: "8px",
                      borderRadius: 10,
                      border: "1px solid var(--border-soft)",
                      boxShadow: "none",
                      minHeight: 36,
                    }}
                  >
                    {!editingProfile && (
                      <span
                        style={{
                          fontSize: 14,
                          marginRight: 8,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-muted)",
                        }}
                      >
                        {icon}
                      </span>
                    )}

                    <div style={{ width: "100%" }}>
                      <div
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          letterSpacing: "0.4px",
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        {label}
                      </div>

                      {!editingProfile ? (
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color:
                              label === "Gender"
                                ? String(value || "").toLowerCase() === "male"
                                  ? "var(--success)"
                                  : String(value || "").toLowerCase() === "female"
                                  ? "var(--accent-strong)"
                                  : "var(--text-primary)"
                                : "var(--text-primary)",
                            marginTop: 2,
                            wordBreak: "break-word",
                          }}
                        >
                          {value || <span style={{ color: "var(--text-muted)" }}>N/A</span>}
                        </div>
                      ) : (
                        key === "gender" ? (
                          <select
                            value={typeof editForm[key] !== "undefined" ? editForm[key] : (value || "")}
                            onChange={(e) => setEditForm((p) => ({ ...(p || {}), [key]: e.target.value }))}
                            style={{
                              marginTop: 6,
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "1px solid var(--input-border)",
                              fontSize: 12,
                              background: "var(--input-bg)",
                              color: "var(--text-primary)",
                            }}
                          >
                            <option value="">Select gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        ) : (
                          <input
                            value={typeof editForm[key] !== "undefined" ? editForm[key] : (value || "")}
                            onChange={(e) => setEditForm((p) => ({ ...(p || {}), [key]: e.target.value }))}
                            style={{
                              marginTop: 6,
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "1px solid var(--input-border)",
                              fontSize: 12,
                              background: "var(--input-bg)",
                              color: "var(--text-primary)",
                            }}
                          />
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                background: "var(--surface-panel)",
                borderRadius: 12,
                padding: 10,
                border: "1px solid var(--border-soft)",
                boxShadow: "none",
                marginTop: 10,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.4px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Enrollment Summary
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  `Grade ${selectedStudent?.grade || "-"}`,
                  `Section ${selectedStudent?.section || "-"}`,
                  `Year ${String(selectedStudent?.academicYear || currentAcademicYear || "-").replace("_", "/")}`,
                  `Status ${(selectedStudent?.status || "Active").toString()}`,
                  `Parents ${Array.isArray(selectedStudent?.parents) ? selectedStudent.parents.length : 0}`,
                ].map((item, index) => (
                  <span
                    key={`${item}_${index}`}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid var(--border-soft)",
                      background: "color-mix(in srgb, var(--surface-panel) 78%, white)",
                      color: "var(--text-secondary)",
                      fontSize: 10,
                      fontWeight: 700,
                      lineHeight: 1.2,
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
           
          </div>
        </div>
      )}

      {/* ATTENDANCE TAB */}
      {studentTab === "attendance" && selectedStudent && (
        <div
          style={{
            padding: "12px",
            background: "var(--surface-panel)",
            borderRadius: 12,
            border: "1px solid var(--border-soft)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          {/* VIEW SWITCH */}
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
          {/* SUBJECT CARDS */}
          {Object.entries(attendanceBySubject)
            .filter(
              ([course]) =>
                attendanceCourseFilter === "All" || course === attendanceCourseFilter
            )
            .map(([course, records]) => {
              const today = new Date().toDateString();
              const weekRecords = records.filter(
                (r) => new Date(r.date).getWeek?.() === new Date().getWeek?.()
              );
              const monthRecords = records.filter(
                (r) => new Date(r.date).getMonth() === new Date().getMonth()
              );
              const displayRecords =
                attendanceView === "daily"
                  ? records.filter((r) => new Date(r.date).toDateString() === today)
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
                      marginBottom: 10,
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
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text-secondary)",
                      marginBottom: 12,
                    }}
                  >
                    Click to view {attendanceView.toUpperCase()} details
                  </div>
                  {/* EXPANDED DAYS */}
                  {expandedCards[expandKey] && (
                    <div
                      style={{
                        marginTop: 14,
                        background: "var(--surface-panel)",
                        border: "1px solid var(--border-soft)",
                        borderRadius: 10,
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
                              {new Date(r.date).toDateString()}
                            </span>
                          </div>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 800,
                              background:
                                r.status === "present"
                                  ? "var(--success-soft)"
                                  : r.status === "late"
                                  ? "var(--warning-soft)"
                                  : "var(--danger-soft)",
                              color:
                                r.status === "present"
                                  ? "var(--success)"
                                  : r.status === "late"
                                  ? "var(--warning)"
                                  : "var(--danger)",
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
            })}
        </div>
      )}

      {/* PAYMENT TAB: Read-only monthly payment history */}
      {studentTab === "payment" && (
        <div
          style={{
            position: "relative",
            background: "var(--surface-panel)",
            border: "1px solid var(--border-soft)",
            borderRadius: 12,
            boxShadow: "var(--shadow-soft)",
            padding: 12,
          }}
        >
          <h3 style={{ margin: 0, marginBottom: 10, color: "var(--text-primary)", fontWeight: 800, fontSize: 13, textAlign: "center" }}>
            Monthly Payment History
          </h3>

          {!selectedStudent ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Select a student to view payment history.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.keys(paymentHistory).length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading payment history...</p>
              ) : (
                Object.entries(paymentHistory).map(([monthKey, paid]) => {
                  const [year, monthShort] = monthKey.split("-");
                  return (
                    <div
                      key={monthKey}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: paid ? "var(--success-soft)" : "var(--danger-soft)",
                        border: paid ? "1px solid var(--success)" : "1px solid var(--danger)",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: 10, height: 10, borderRadius: 999, background: paid ? "var(--success)" : "var(--danger)" }} />
                        <div style={{ fontWeight: 700 }}>{monthShort} {year}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: paid ? "var(--success)" : "var(--danger)" }}>{paid ? "Paid" : "Unpaid"}</div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
    {/* Parent Chat Button */}
    {selectedStudent && !studentChatOpen && (
      <div
        onClick={() => {
          if (!selectedStudent?.userId) {
            alert("Please select a student first.");
            return;
          }

          const firstParent = (selectedStudent?.parents || [])[0];
          if (!firstParent?.userId) {
            alert("No parent found for this student.");
            return;
          }

          navigate("/all-chat", {
            state: {
              user: {
                userId: firstParent.userId,
                name: firstParent.name || selectedStudent.parentName || "Parent",
                profileImage: firstParent.profileImage || "/default-profile.png",
                type: "parent",
              },
            },
          });
        }}
        title="Chat with student's parent"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "220px",
          width: "140px",
          height: "48px",
          background: "linear-gradient(135deg, color-mix(in srgb, var(--success) 78%, #0f172a), var(--success))",
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
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontWeight: 800, fontSize: 13 }}>Parent Chat</span>
        </div>
        <span
          style={{
            position: "absolute",
            top: -8,
            right: 8,
            background: "color-mix(in srgb, var(--success) 42%, #04130b)",
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

    {/* Student Chat Button (styled like Parent Chat) */}
    {selectedStudent && !studentChatOpen && (
      <div
        onClick={() => {
          if (!selectedStudent?.userId) {
            alert("Please select a student first.");
            return;
          }
          navigate("/all-chat", {
            state: {
              user: {
                userId: selectedStudent.userId,
                name: selectedStudent.name,
                profileImage: selectedStudent.profileImage,
                type: "student",
              },
            },
          });
        }}
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
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
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
    {studentChatOpen && selectedStudent && (
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "360px",
          height: "480px",
          background: "var(--surface-panel)",
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
            <strong>{selectedStudent.name}</strong>
          <div style={{ display: "flex", gap: "10px" }}>
            {/* Expand */}
            <button
              onClick={() => {
                setStudentChatOpen(false); // properly close popup
                navigate("/all-chat", {
                  state: {
                    user: {
                      userId: selectedStudent.userId,
                      name: selectedStudent.name,
                      profileImage: selectedStudent.profileImage,
                      type: "student",
                    },
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
              onClick={() => setStudentChatOpen(false)}
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
          style={{
            flex: 1,
            padding: "12px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            background: "var(--surface-muted)",
          }}
        >
          {popupMessages.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)" }}>
              Start chatting with {selectedStudent.name}
            </p>
          ) : (
            popupMessages.map((m) => {
              const isAdmin = String(m.senderId) === String(adminUserId);
              return (
                <div
                  key={m.messageId || m.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isAdmin ? "flex-end" : "flex-start",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      maxWidth: "70%",
                      background: isAdmin ? "var(--accent)" : "var(--surface-panel)",
                      color: isAdmin ? "#fff" : "var(--text-primary)",
                      padding: "10px 14px",
                      borderRadius: 18,
                      borderTopRightRadius: isAdmin ? 0 : 18,
                      borderTopLeftRadius: isAdmin ? 18 : 0,
                      boxShadow: "var(--shadow-soft)",
                      wordBreak: "break-word",
                      cursor: "default",
                      position: "relative",
                    }}
                  >
                    {m.text} {" "}
                    {m.edited && (
                      <small style={{ fontSize: 10 }}> (edited)</small>
                    )}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 6,
                        marginTop: 6,
                        fontSize: 11,
                        color: isAdmin ? "#fff" : "var(--text-muted)",
                      }}
                    >
                      <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>
                        {formatDateLabel(m.timeStamp)}
                      </span>
                      <span>{formatTime(m.timeStamp)}</span>
                      {isAdmin && !m.deleted && (
                      <span style={{ display: "flex", gap: 0, alignItems: "center" }}>
                                                          <FaCheck size={10} color={isAdmin ? "#fff" : "var(--text-muted)"} style={{ opacity: 0.90, marginLeft: 2 }} />
                                                          {m.seen && (<FaCheck size={10} color={isAdmin ? "#f8fafc" : "var(--text-muted)"} style={{ marginLeft: -6, opacity: 0.95 }} />)}
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
              borderRadius: "25px",
              border: "1px solid var(--input-border)",
              outline: "none",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
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
              background: "var(--accent)",
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

{selectedStudent && studentFullscreenOpen && (
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
          <img
            src={selectedStudent.profileImage || "/default-profile.png"}
            alt={selectedStudent.name}
            style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.8)", objectFit: "cover" }}
          />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedStudent.name || "Student"}</div>
            <div style={{ fontSize: 12, opacity: 0.95 }}>{selectedStudent.studentId} • Grade {selectedStudent.grade || "-"} • Section {selectedStudent.section || "-"}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!fullscreenEditing ? (
            <button
              onClick={() => setFullscreenEditing(true)}
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
              Edit All Sections
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  resetFullscreenEditFormFromSelected();
                  setFullscreenEditing(false);
                }}
                style={{
                  border: "1px solid rgba(255,255,255,0.45)",
                  background: "rgba(255,255,255,0.14)",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
                disabled={fullscreenSaving}
              >
                Cancel
              </button>
              <button
                onClick={saveFullscreenEdits}
                style={{
                  border: "1px solid rgba(255,255,255,0.45)",
                  background: "#16a34a",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: 700,
                  opacity: fullscreenSaving ? 0.75 : 1,
                }}
                disabled={fullscreenSaving}
              >
                {fullscreenSaving ? "Saving..." : "Save Changes"}
              </button>
            </>
          )}

          <button
            onClick={() => setStudentFullscreenOpen(false)}
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
        {sectionDefinitions.map((section) => {
          const sectionData = fullscreenEditing
            ? (fullscreenEditForm.sections?.[section.key] || {})
            : (registrationSections?.[section.key] || {});
          const isCollapsed = !!fullscreenSectionCollapsed?.[section.key];
          const sectionEntries = Object.entries(sectionData || {});
          const imageEntries = !fullscreenEditing
            ? sectionEntries.filter(([key, value]) => isImageValue(key, value))
            : [];
          const nonImageEntries = !fullscreenEditing
            ? sectionEntries.filter(([key, value]) => !isImageValue(key, value))
            : sectionEntries;

          return (
          <div
            key={section.title}
            style={{
              background: "var(--surface-panel)",
              border: "1px solid var(--border-soft)",
              borderRadius: 12,
              padding: 10,
              boxShadow: "var(--shadow-soft)",
              gridColumn: section.fullWidth ? "1 / -1" : "auto",
            }}
          >
            <button
              type="button"
              onClick={() => toggleFullscreenSection(section.key)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--surface-muted)",
                border: "1px solid var(--border-strong)",
                borderRadius: 10,
                padding: "8px 10px",
                cursor: "pointer",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-strong)" }}>{section.title}</span>
              <FaChevronDown style={{ color: "var(--accent-strong)", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform .2s ease" }} />
            </button>

            {!isCollapsed && (Object.keys(sectionData || {}).length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No data</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {!fullscreenEditing && imageEntries.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                    {imageEntries.map(([key, value]) => (
                      <div key={`image_${key}`} style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>{formatFieldLabel(key)}</div>
                        {renderDisplayValue(key, value)}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  {nonImageEntries.map(([key, value]) => (
                    <div key={key} style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>{formatFieldLabel(key)}</div>
                      <div style={{ fontSize: 12, color: "var(--text-primary)", marginTop: 2, wordBreak: "break-word" }}>
                        {!fullscreenEditing ? (
                          renderDisplayValue(key, value)
                        ) : (
                          <div style={{ display: "grid", gap: 6 }}>
                            <input
                              value={value ?? ""}
                              onChange={(event) => updateFullscreenSectionField(section.key, key, event.target.value)}
                              style={{ width: "100%", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 12, background: "var(--input-bg)", color: "var(--text-primary)" }}
                            />
                            {isImageValue(key, value) ? (
                              <img
                                src={String(value || "")}
                                alt={formatFieldLabel(key)}
                                style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border-strong)" }}
                              />
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )})}

        <div
          style={{
            background: "var(--surface-panel)",
            border: "1px solid var(--border-soft)",
            borderRadius: 12,
            padding: 12,
            boxShadow: "var(--shadow-soft)",
            gridColumn: "1 / -1",
          }}
        >
          <button
            type="button"
            onClick={() => toggleFullscreenSection("additional")}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--surface-muted)",
              border: "1px solid var(--border-strong)",
              borderRadius: 10,
              padding: "8px 10px",
              cursor: "pointer",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-strong)" }}>Additional Student Data</span>
            <FaChevronDown style={{ color: "var(--accent-strong)", transform: fullscreenSectionCollapsed?.additional ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform .2s ease" }} />
          </button>

          {!fullscreenSectionCollapsed?.additional && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              {Object.entries(fullscreenEditing ? (fullscreenEditForm.additional || {}) : Object.fromEntries(
                Object.entries(selectedStudent || {}).filter(([k]) => !excludedAdditionalKeys.includes(k))
              )).map(([key, value]) => (
                <div key={key} style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>{formatFieldLabel(key)}</div>
                  <div style={{ fontSize: 12, color: "var(--text-primary)", marginTop: 2, wordBreak: "break-word" }}>
                    {!fullscreenEditing ? (
                      renderDisplayValue(key, value)
                    ) : (
                      <div style={{ display: "grid", gap: 6 }}>
                        <input
                          value={value ?? ""}
                          onChange={(event) => updateFullscreenAdditionalField(key, event.target.value)}
                          style={{ width: "100%", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 12, background: "var(--input-bg)", color: "var(--text-primary)" }}
                        />
                        {isImageValue(key, value) ? (
                          <img
                            src={String(value || "")}
                            alt={formatFieldLabel(key)}
                            style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border-strong)" }}
                          />
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
)}
    </div>

  </div>
)}
export default StudentsPage;