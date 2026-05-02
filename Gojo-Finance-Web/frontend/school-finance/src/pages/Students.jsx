import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, 
  FaSignOutAlt, FaBell, FaFacebookMessenger, FaSearch, FaCalendarAlt, FaCommentDots, FaCheck, FaPaperPlane, FaChartLine
} from "react-icons/fa";
import axios from "axios";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { useMemo } from "react";
import { getDatabase, ref, onValue, push, update } from "firebase/database";

import { db as dbRT } from "../firebase";
import { BACKEND_BASE } from "../config.js";
import { useFinanceShell } from "../context/FinanceShellContext";
import useTopbarNotifications from "../hooks/useTopbarNotifications";
import { getOrLoad } from "../utils/requestCache";


function StudentsPage() {
  const API_BASE = `${BACKEND_BASE}/api`;
  // ------------------ STATES ------------------
  const [students, setStudents] = useState([]); // List of all students
  const [selectedGrade, setSelectedGrade] = useState("All"); // Grade filter
  const [selectedSection, setSelectedSection] = useState("All"); // Section filter
  const [selectedPaidFilter, setSelectedPaidFilter] = useState("all"); // all | paid | unpaid
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'short' })); // Month filter (Jan..Dec)
  const [searchTerm, setSearchTerm] = useState("");
  const [sections, setSections] = useState([]); // Sections available for selected grade
  const [selectedStudent, setSelectedStudent] = useState(null); // Currently selected student
  const [studentChatOpen, setStudentChatOpen] = useState(false); // Toggle chat popup
  const [popupMessages, setPopupMessages] = useState([]); // Messages for chat popup
  const messagesEndRef = useRef(null);
  const [popupInput, setPopupInput] = useState(""); // Input for chat message
  const [details, setDetails] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [studentTab, setStudentTab] = useState("details");
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState({});
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [unreadMap, setUnreadMap] = useState({});
  // Local cached paid/unpaid map (persisted to localStorage)
  const [paidMap, setPaidMap] = useState({});
  const [paymentHistory, setPaymentHistory] = useState({}); // { '2026-Jan': true }
  // pending undoable toggle info { id, prev, newPaid, key, timer, studentName }
  const [undoInfo, setUndoInfo] = useState(null);
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

    const rawFinance = localStorage.getItem("finance");
    const rawAdmin = localStorage.getItem("admin");
    const financeObj = parse(rawFinance);
    const adminObj = parse(rawAdmin);

    const hasIdentity = (obj) => Boolean(obj && (obj.financeId || obj.adminId || obj.userId));

    if (hasIdentity(financeObj)) return { raw: rawFinance, data: financeObj, source: "finance" };
    if (hasIdentity(adminObj)) return { raw: rawAdmin, data: adminObj, source: "admin" };

    return { raw: rawFinance || rawAdmin, data: financeObj || adminObj || {}, source: rawFinance ? "finance" : "admin" };
  };

  const _storedFinance = (() => {
    return getStoredAuth().data || {};
  })();

  const schoolCode = _storedFinance.schoolCode || "";
  const DB_URL = schoolCode
    ? `${DB_BASE}/Platform1/Schools/${schoolCode}`
    : DB_BASE;

  const [finance, setFinance] = useState({
    financeId: _storedFinance.financeId || _storedFinance.adminId || "",
    userId: _storedFinance.userId || "",
    schoolCode: _storedFinance.schoolCode || "",
    name: _storedFinance.name || _storedFinance.username || "Finance",
    username: _storedFinance.username || "",
    profileImage: _storedFinance.profileImage || "/default-profile.png",
    isActive: _storedFinance.isActive || false,
  });

  // Compatibility alias: map `finance` to `admin` for older code
  const admin = {
    adminId: finance.financeId || finance.adminId || "",
    userId: finance.userId || "",
    name: finance.name || finance.username || "Finance",
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
                name: userRes.data?.name || node.name || financeData.name || "Finance",
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
                name: node.name || financeData.name || "Finance",
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
            name: userRes.data?.name || financeData.name || "Finance",
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
        name: financeData.name || financeData.username || "Finance",
        username: financeData.username || "",
        profileImage: financeData.profileImage || "/default-profile.png",
        isActive: financeData.isActive || false,
      };
      setFinance(fallbackFinance);
      localStorage.setItem("finance", JSON.stringify({ ...financeData, ...fallbackFinance }));
      localStorage.setItem("admin", JSON.stringify({ ...financeData, ...fallbackFinance, adminId: fallbackFinance.financeId }));
    } catch (e) {
      try {
        localStorage.removeItem("finance");
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
  const [showPostDropdown, setShowPostDropdown] = useState(false);
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
// Place before return (

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

  const {
    unreadSenders,
    setUnreadSenders,
    unreadPosts: postNotifications,
    totalNotifications,
    messageCount,
    markMessagesAsSeen,
    markPostAsSeen,
    setUnreadPosts: setPostNotifications,
  } = useTopbarNotifications({
    dbRoot: DB_URL,
    currentUserId: admin.userId,
  });
  const financeShell = useFinanceShell();
  const conversationSummaries = financeShell?.conversationSummaries || [];


const handleNotificationClick = async (notification) => {
  try {
    await markPostAsSeen(notification.postId);
  } catch (err) {
    console.warn("Failed to mark notification as seen:", err);
  }

  setPostNotifications((prev) =>
    prev.filter((n) => n.notificationId !== notification.notificationId)
  );

  setShowPostDropdown(false);
  navigate("/dashboard", {
    state: { postId: notification.postId },
  });
};
useEffect(() => {
  if (location.state?.postId) {
    setPostNotifications([]);
  }
}, []);

  const handleSendMessage = () => {
    // now newMessageText is defined
    console.log("Sending message:", newMessageText);
    // your code to send the message
  };

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

  // load finance/admin on mount
  useEffect(() => {
    loadFinanceFromStorage();
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

  // Fetch payment history for selected student when payment tab opens
  useEffect(() => {
    if (studentTab !== "payment" || !selectedStudent) return;

    const fetchPaymentHistory = async (student) => {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      const year = new Date().getFullYear();
      const id = student?.studentId || student?.userId || String(student?.id || "");
      const out = {};

      await Promise.all(
        months.map(async (m) => {
          const key = `${year}-${m}`;
          try {
            const res = await axios.get(`${DB_URL}/monthlyPaid/${key}.json`).catch(() => ({ data: {} }));
            const node = res.data || {};
            // assume node is map of studentId -> true
            out[key] = !!(node && (node[id] || node[id.toString()]));
          } catch (e) {
            out[key] = false;
          }
        })
      );

      setPaymentHistory(out);
    };

    fetchPaymentHistory(selectedStudent);
  }, [studentTab, selectedStudent]);

  // ---------------- MONTHLY PAID MAP (for students list) ----------------
  // Load paid/unpaid map for the currently selected month so the main students
  // list can show who has paid for that month and allow toggling per student.
  useEffect(() => {
    if (!students || students.length === 0) return;

    const loadMonthMap = async () => {
      try {
        const year = new Date().getFullYear();
        const key = `${year}-${selectedMonth}`;
        const res = await axios.get(`${DB_URL}/monthlyPaid/${key}.json`).catch(() => ({ data: {} }));
        const node = res.data || {};
        const map = {};

        // Node is expected to be { studentId: true }
        students.forEach((s) => {
          const id = s.studentId || s.userId || String(s.id || "");
          map[id] = !!(node && (node[id] || node[id.toString()]));
        });

        setPaidMap(map);
      } catch (err) {
        console.error("Error loading monthly paid map:", err);
        setPaidMap({});
      }
    };

    loadMonthMap();
  }, [selectedMonth, students]);

  // Toggle paid/unpaid for a student for the currently selected month.
  // This performs an optimistic UI update and delays the network commit
  // for a short period to allow the user to undo the action.
  const togglePaid = (student) => {
    const id = student.studentId || student.userId || String(student.id || "");
    const year = new Date().getFullYear();
    const key = `${year}-${selectedMonth}`;

    const currentlyPaid = Boolean(paidMap?.[id]);
    const newPaid = !currentlyPaid;

    // Ask for confirmation first (protects against accidental taps)
    const confirmMsg = newPaid
      ? `Mark ${student.name} as PAID for ${selectedMonth} ${year}?`
      : `Mark ${student.name} as UNPAID for ${selectedMonth} ${year}?`;

    if (!window.confirm(confirmMsg)) return;

    // Optimistic UI update
    setPaidMap((prev) => ({ ...prev, [id]: newPaid }));

    // Clear any previous pending toggle (we only keep one undo slot)
    if (undoInfo && undoInfo.timer) {
      clearTimeout(undoInfo.timer);
    }

    // Prepare commit function
    const commit = async () => {
      try {
        if (newPaid) {
          await axios.put(`${DB_URL}/monthlyPaid/${key}/${id}.json`, true);
        } else {
          await axios.put(`${DB_URL}/monthlyPaid/${key}/${id}.json`, null);
        }
      } catch (err) {
        console.error("Error committing paid status:", err);
        // revert optimistic change on failure
        setPaidMap((prev) => ({ ...prev, [id]: currentlyPaid }));
        alert("Failed to update payment status. Please try again.");
      }
      setUndoInfo(null);
    };

    // Show undo banner for 5 seconds before committing
    const timer = setTimeout(commit, 5000);

    setUndoInfo({ id, prev: currentlyPaid, newPaid, key, timer, studentName: student.name });
  };

  const undoLastToggle = () => {
    if (!undoInfo) return;
    // cancel pending commit
    if (undoInfo.timer) clearTimeout(undoInfo.timer);
    // revert optimistic update
    setPaidMap((prev) => ({ ...prev, [undoInfo.id]: undoInfo.prev }));
    setUndoInfo(null);
  };

  const handleClick = () => {
    navigate("/all-chat"); // replace with your target route
  };

  const handleSelectStudent = async (s) => {
    setSelectedStudent((prev) => ({ ...(prev || {}), ...s }));
    setRightSidebarOpen(true);
    try {
      // 1️⃣ Fetch user info
      const userRes = await axios.get(`${DB_URL}/Users/${s.userId}.json`);
      const user = userRes.data || {};

      // 2️⃣ Fetch ClassMarks from Firebase
      const classMarks = await getOrLoad(
        `finance:students:classmarks:${DB_URL}`,
        async () => {
          const response = await axios.get(`${DB_URL}/ClassMarks.json`);
          return response.data || {};
        },
        { ttlMs: 5 * 60 * 1000 }
      );

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
      const attendanceRaw = await getOrLoad(
        `finance:students:attendance:${DB_URL}`,
        async () => {
          const response = await axios.get(`${DB_URL}/Attendance.json`);
          return response.data || {};
        },
        { ttlMs: 5 * 60 * 1000 }
      );

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
      setSelectedStudent((prev) => ({
        ...(prev || {}),
        ...s,
        ...user,
        marks: studentMarksObj,
        attendance: attendanceData,
        age: age,
        parents: parentsList,
        parentName: parentName,
        parentPhone: parentPhone,
      }));
    } catch (err) {
      console.error("Error fetching student data:", err);
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

  // close dropdowns outside click - unchanged logic retained
  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".messenger-dropdown")) {
        setShowMessageDropdown(false);
      }
      if (!e.target.closest(".icon-circle") && !e.target.closest(".notification-dropdown")) {
        setShowPostDropdown(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);



  // ------------------ FETCH STUDENTS ------------------
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setStudentsLoading(true);
        const [studentsData, usersData] = await Promise.all([
          getOrLoad(
            `finance:students:list:${DB_URL}`,
            async () => {
              const response = await axios.get(`${DB_URL}/Students.json`);
              return response.data || {};
            },
            { ttlMs: 5 * 60 * 1000 }
          ),
          getOrLoad(
            `finance:students:users:${DB_URL}`,
            async () => {
              const response = await axios.get(`${DB_URL}/Users.json`);
              return response.data || {};
            },
            { ttlMs: 5 * 60 * 1000 }
          ),
        ]);

        const studentList = Object.keys(studentsData).map((id) => {
          const student = studentsData[id];
          const user = usersData[student.userId] || {};
          return {
            studentId: id,
            userId: student.userId,
            name: user.name || user.username || "No Name",
            profileImage: user.profileImage || "/default-profile.png",
            grade: student.grade,
            section: student.section,
            email: user.email || ""
          };
        });

        setStudents(studentList);
      } catch (err) {
        console.error("Error fetching students:", err);
      } finally {
        setStudentsLoading(false);
      }
    };

    fetchStudents();
  }, []);

  // ------------------ UPDATE SECTIONS WHEN GRADE CHANGES ------------------
  useEffect(() => {
    if (selectedGrade === "All") {
      setSections([]);
    } else {
      const gradeSections = [...new Set(students.filter(s => s.grade === selectedGrade).map(s => s.section))];
      setSections(gradeSections);
      setSelectedSection("All");
    }
  }, [selectedGrade, students]);

  // ------------------ FILTER STUDENTS ------------------
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredStudents = students.filter((s) => {
    if (selectedGrade !== "All" && s.grade !== selectedGrade) return false;
    if (selectedSection !== "All" && s.section !== selectedSection) return false;

    // Paid/unpaid quick filter
    if (selectedPaidFilter && selectedPaidFilter !== "all") {
      const id = s.studentId || s.userId || String(s.id || "");
      const isPaid = Boolean(paidMap?.[id]);
      if (selectedPaidFilter === "paid" && !isPaid) return false;
      if (selectedPaidFilter === "unpaid" && isPaid) return false;
    }

    if (!normalizedSearch) return true;

    const haystack = [s.name, s.studentId, s.userId, s.email, s.grade, s.section]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });


  // ---------------- FETCH PERFORMANCE ----------------
  // This effect reads ClassMarks and stores only the entries for the selected student.
  useEffect(() => {
    setStudentMarks(selectedStudent?.marks || {});
  }, [selectedStudent]);


  //-------------------------Fetch unread status for each student--------------
  useEffect(() => {
    const nextMap = {};

    students.forEach((student) => {
      const summary = conversationSummaries.find(
        (item) => String(item?.userId) === String(student?.userId)
      );

      nextMap[student.studentId] = Number(summary?.unreadCount || 0) > 0;
    });

    setUnreadMap(nextMap);
  }, [conversationSummaries, students]);

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





  const contentLeft = isNarrow ? 0 : 90;
  const paidCount = filteredStudents.filter((s) => paidMap[s.studentId || s.userId]).length;
  const unpaidCount = filteredStudents.length - paidCount;

  const chipStyle = (active) => ({
    padding: "6px 12px",
    borderRadius: "999px",
    background: active ? "#1d4ed8" : "#eef2ff",
    color: active ? "#fff" : "#1e3a8a",
    cursor: "pointer",
    border: active ? "1px solid #1d4ed8" : "1px solid #dbeafe",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    transition: "all 0.2s ease",
  });

 return (
    <div className="dashboard-page" style={{ background: "#f5f8ff", minHeight: "100vh" }}>
      {undoInfo && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 4000, display: 'flex', gap: 8, alignItems: 'center', background: '#111827', color: '#fff', padding: '10px 12px', borderRadius: 10, boxShadow: '0 8px 20px rgba(0,0,0,0.25)' }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{undoInfo.studentName} — {undoInfo.newPaid ? 'Marked PAID' : 'Marked UNPAID'}</div>
          <button onClick={(e) => { e.stopPropagation(); undoLastToggle(); }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Undo</button>
        </div>
      )}
      {/* ---------------- TOP NAVIGATION BAR ---------------- */}
      <nav className="top-navbar" style={{ borderBottom: "1px solid #e5e7eb", background: "#ffffff" }}>
        <h2 style={{ color: "#0f172a", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Finance Portal</h2>
        
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
              <div className="notification-dropdown" onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: 40, right: 0, width: 360, maxHeight: 420, overflowY: "auto", background: "#fff", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", zIndex: 1000, padding: 6 }}>
                {((postNotifications?.length || 0) + Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)) === 0 ? (
                  <p style={{ padding: 12, textAlign: "center", color: "#777" }}>No new notifications</p>
                ) : (
                  <div>
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

          <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/all-chat") }>
            <FaFacebookMessenger />
            {Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0) > 0 && (
              <span className="badge">{Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)}</span>
            )}
          </div>

          <Link className="icon-circle" to="/settings"><FaCog /></Link>
          <img src={admin.profileImage || "/default-profile.png"} alt="admin" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px" }}>
        {/* ---------------- MAIN CONTENT ---------------- */}
        <div
          className={`main-content google-main ${rightSidebarOpen ? "sidebar-open" : ""}`}
          style={{
            padding: "10px 20px 20px",
            flex: 1,
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          <div className="main-inner" style={{ marginLeft: 0, marginTop: 0 }}>
            <div
              style={{
                marginBottom: "12px",
                marginLeft: contentLeft,
                background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
                color: "#fff",
                borderRadius: 14,
                padding: "14px 16px",
                width: isNarrow ? "92%" : "560px",
                boxShadow: "0 14px 28px rgba(30,58,138,0.22)",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800 }}>Student Monthly Payments</h2>
              <div style={{ marginTop: 6, display: "flex", gap: 16, fontSize: 12, opacity: 0.95, flexWrap: "wrap" }}>
                <span>Total: {filteredStudents.length}</span>
                <span>Paid: {paidCount}</span>
                <span>Unpaid: {unpaidCount}</span>
              </div>
            </div>

            {/* Month Filter (horizontal list) */}
            <div style={{ display: "flex", justifyContent: isNarrow ? "center" : "flex-start", marginBottom: "10px", paddingLeft: contentLeft }}>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  overflowX: "visible",
                  justifyContent: "flex-start",
                  paddingBottom: 1,
                }}
              >
                {[
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ].map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMonth(m)}
                    style={chipStyle(selectedMonth === m)}
                  >
                    {m}
                  </button>
                ))}
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
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  boxShadow: "0 6px 18px rgba(15,23,42,0.07)",
                }}
              >
                <FaSearch style={{ color: "#6b7280", fontSize: 14 }} />
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
                {["All","5","6","7","8"].map(g => (
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

            {/* Paid Filter (quick) */}
            <div style={{ display: "flex", justifyContent: isNarrow ? "center" : "flex-start", marginBottom: "10px", paddingLeft: contentLeft }}>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "nowrap",
                  overflowX: "auto",
                  justifyContent: "flex-start",
                  paddingBottom: 1,
                }}
              >
                {[{k: 'all', label: 'All'}, {k: 'paid', label: 'Paid'}, {k: 'unpaid', label: 'Unpaid'}].map((b) => (
                  <button
                    key={b.k}
                    onClick={() => setSelectedPaidFilter(b.k)}
                    style={chipStyle(selectedPaidFilter === b.k)}
                  >
                    {b.label}
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
            {/* Students List */}
            {studentsLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: isNarrow ? "center" : "flex-start", gap: "12px", paddingLeft: contentLeft }}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} style={{ width: isNarrow ? "92%" : "560px", height: "86px", borderRadius: "14px", padding: "12px", background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 8px 18px rgba(15,23,42,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f1f5f9" }} />
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f1f5f9" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ width: "60%", height: 12, background: "#f1f5f9", borderRadius: 6, marginBottom: 8 }} />
                        <div style={{ width: "40%", height: 10, background: "#f1f5f9", borderRadius: 6 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <p style={{ textAlign: "center", color: "#555" }}>No students found for this selection.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: isNarrow ? "center" : "flex-start", gap: "12px", paddingLeft: contentLeft }}>
                {filteredStudents.map((s, i) => (
                  <div
                    key={s.userId}
                    onClick={() => handleSelectStudent(s)}
                    className="student-card"
                    style={{
                      width: isNarrow ? "92%" : "560px",
                      minHeight: "86px",
                      borderRadius: "14px",
                      padding: "12px",
                      background: selectedStudent?.studentId === s.studentId ? "#eef4ff" : "#fff",
                      border: selectedStudent?.studentId === s.studentId ? "2px solid #1d4ed8" : "1px solid #e5e7eb",
                      boxShadow: selectedStudent?.studentId === s.studentId ? "0 10px 24px rgba(29,78,216,0.24)" : "0 8px 18px rgba(15,23,42,0.08)",
                      cursor: "pointer",
                      transition: "all 0.25s ease",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingRight: 110 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: "#dbeafe",
                          color: "#2563eb",
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
                      <img
                        src={s.profileImage}
                        alt={s.name}
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          border: selectedStudent?.studentId === s.studentId ? "3px solid #2563eb" : "3px solid #e5e7eb",
                          objectFit: "cover",
                          transition: "all 0.3s ease",
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: "14px", color: "#0f172a", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</h3>
                        <div style={{ color: "#64748b", fontSize: "11px", marginTop: 4 }}>
                          Grade {s.grade} • Section {s.section}
                        </div>
                      </div>
                    </div>

                    {/* payment toggle button (cached locally) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePaid(s); }}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: 12,
                        padding: "7px 12px",
                        borderRadius: 999,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                        background: paidMap[s.studentId || s.userId] ? "#059669" : "#f97316",
                        color: "#fff",
                        boxShadow: paidMap[s.studentId || s.userId] ? "0 6px 14px rgba(5,150,105,0.24)" : "0 6px 14px rgba(249,115,22,0.24)",
                      }}
                    >
                      {paidMap[s.studentId || s.userId] ? "Paid" : "Unpaid"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        {/* RIGHT SIDEBAR */}
{selectedStudent && (
  <div
    style={{
      width: isPortrait ? "100%" : "380px",
      height: isPortrait ? "100vh" : "calc(100vh - 55px)",
      position: "fixed",
      right: 0,
      top: isPortrait ? 0 : "55px",
      background: "#f8fbff",
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      padding: "14px",
      boxShadow: "0 0 24px rgba(15,23,42,0.12)",
      borderLeft: isPortrait ? "none" : "1px solid #e5e7eb",
      transition: "all 0.35s ease",
      fontSize: "10px",
    }}
  >
    {/* Close button */}
    <div style={{ position: "absolute", top: 0, left: 22, zIndex: 2000 }}>
      <button
        onClick={() => setSelectedStudent(null)}
        aria-label="Close sidebar"
        style={{
          background: "none",
          border: "none",
          fontSize: 28,
          fontWeight: 700,
          color: "#3647b7",
          cursor: "pointer",
          padding: 2,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>

    {/* Header */}
    <div
      style={{
        background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
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
          border: "3px solid rgba(255,255,255,0.85)",
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
    </div>

    {/* Tabs */}
    <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: "10px" }}>
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
            color: studentTab === tab ? "#4b6cb7" : "#6b7280",
            fontSize: "10px",
            borderBottom: studentTab === tab ? "3px solid #4b6cb7" : "3px solid transparent",
          }}
        >
          {tab.toUpperCase()}
        </button>
      ))}
    </div>

    {/* Tab Content */}
    <div>
      {/* DETAILS TAB */}
      {studentTab === "details" && (
        <div
          style={{
            padding: "12px",
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
            margin: "0 auto",
            maxWidth: 380,
          }}
        >
          <div>
            {/* STUDENT DETAILS */}
            <h3
              style={{
                margin: 0,
                marginBottom: 6,
                color: "#0f172a",
                fontWeight: 800,
                letterSpacing: "0.1px",
                fontSize: 12,
                textAlign: "left",
              }}
            >
              Student Profile
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {[
                ["Phone", selectedStudent?.phone],
                ["Gender", selectedStudent?.gender],
                ["Email", selectedStudent?.email],
                ["Grade", selectedStudent?.grade],
                ["Section", selectedStudent?.section],
                ["Age", selectedStudent?.age],
                ["Birth Date", selectedStudent?.dob],
                ["Parent Name", selectedStudent?.parentName],
                ["Parent Phone", selectedStudent?.parentPhone],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    alignItems: "center",
                    justifyContent: "flex-start",
                    display: "flex",
                    background: "#ffffff",
                    padding: "8px",
                    borderRadius: 10,
                    border: "1px solid #eef2f7",
                    boxShadow: "none",
                    minHeight: 36,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        letterSpacing: "0.4px",
                        color: "#64748b",
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "#111",
                        marginTop: 2,
                        wordBreak: "break-word",
                      }}
                    >
                      {value || <span style={{ color: "#cbd5e1" }}>N/A</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
           
          </div>
        </div>
      )}

      {/* ATTENDANCE TAB */}
      {studentTab === "attendance" && selectedStudent && (
        <div
          style={{
            padding: "12px",
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
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
                  background: attendanceView === v ? "#4b6cb7" : "#e5e7eb",
                  color: attendanceView === v ? "#fff" : "#111827",
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
                    background: "#ffffff",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
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
                          color: "#0f172a",
                        }}
                      >
                        {formatSubjectName(course)}
                      </h3>
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: 10,
                          color: "#64748b",
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
                        background: "#e0e7ff",
                        color: "#1e40af",
                        border: "1px solid #c7d2fe",
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
                      background: "#e5e7eb",
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
                        background: "#4b6cb7",
                        transition: "width .3s ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#475569",
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
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
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
                                ? "1px solid #e5e7eb"
                                : "none",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: 10, color: "#1f2937" }}>
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
            })}
        </div>
      )}

      {/* PAYMENT TAB: Monthly paid/unpaid history for selected student */}
      {studentTab === "payment" && (
        <div
          style={{
            position: "relative",
            paddingBottom: "70px",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
            padding: 12,
          }}
        >
          <h3 style={{ margin: 0, marginBottom: 10, color: "#0f172a", fontWeight: 800, fontSize: 13, textAlign: "center" }}>
            Monthly Payment History
          </h3>

          {!selectedStudent ? (
            <p style={{ textAlign: "center", color: "#64748b" }}>Select a student to view payment history.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(paymentHistory).length === 0 ? (
                <p style={{ textAlign: "center", color: "#64748b" }}>Loading payment history...</p>
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
                        background: paid ? "#e6ffef" : "#fff6f6",
                        border: paid ? "1px solid #10b981" : "1px solid #f97316",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: 10, height: 10, borderRadius: 999, background: paid ? "#10b981" : "#f97316" }} />
                        <div style={{ fontWeight: 700 }}>{monthShort} {year}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: paid ? "#065f46" : "#7f1d1d" }}>{paid ? "Paid" : "Unpaid"}</div>
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
    {!studentChatOpen && (
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
          background: "linear-gradient(135deg, #059669, #10b981)",
          borderRadius: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 10,
          padding: "0 12px",
          color: "#fff",
          cursor: "pointer",
          zIndex: 1100,
          boxShadow: "0 10px 24px rgba(5,150,105,0.18)",
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
            background: "rgba(255,255,255,0.12)",
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
            background: "#062f1f",
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
    {!studentChatOpen && (
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
          background: "linear-gradient(135deg, #833ab4, #0259fa)",
          borderRadius: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 10,
          padding: "0 12px",
          color: "#fff",
          cursor: "pointer",
          zIndex: 1000,
          boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
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
            background: "rgba(255,255,255,0.12)",
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
            background: "#0b1220",
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
            background: "#f9f9f9",
          }}
        >
          {popupMessages.length === 0 ? (
            <p style={{ textAlign: "center", color: "#aaa" }}>
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
                      background: isAdmin ? "#4facfe" : "#fff",
                      color: isAdmin ? "#fff" : "#000",
                      padding: "10px 14px",
                      borderRadius: 18,
                      borderTopRightRadius: isAdmin ? 0 : 18,
                      borderTopLeftRadius: isAdmin ? 18 : 0,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
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
                        color: isAdmin ? "#fff" : "#888",
                      }}
                    >
                      <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>
                        {formatDateLabel(m.timeStamp)}
                      </span>
                      <span>{formatTime(m.timeStamp)}</span>
                      {isAdmin && !m.deleted && (
                      <span style={{ display: "flex", gap: 0, alignItems: "center" }}>
                                                          <FaCheck size={10} color={isAdmin ? "#fff" : "#888"} style={{ opacity: 0.90, marginLeft: 2 }} />
                                                          {m.seen && (<FaCheck size={10} color={isAdmin ? "#f3f7f8" : "#ccc"} style={{ marginLeft: -6, opacity: 0.95 }} />)}
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
)}
    </div>

  </div>
)}
export default StudentsPage;