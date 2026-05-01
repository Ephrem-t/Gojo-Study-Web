import React, { useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  FaChevronLeft,
  FaChevronRight,
  FaCheckCircle,
  FaClock
} from "react-icons/fa";
import axios from "axios";
import { getDatabase, ref, onValue } from "firebase/database";
import app from "../firebase";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { BACKEND_BASE } from "../config.js";
import LessonPlanInsightsModal from "../components/LessonPlanInsightsModal";
import ProfileAvatar from "../components/ProfileAvatar";
import { fetchJson, getSafeProfileImage, mapInBatches, parseChatParticipantIds } from "../utils/chatRtdb";
import { fetchCachedJson, readCachedJson, writeCachedJson } from "../utils/rtdbCache";




const NOTIFICATION_REFRESH_MS = 60000;

function TeachersPage() {
  const API_BASE = `${BACKEND_BASE}/api`;
  const bootstrapAdmin = (() => {
    try {
      return JSON.parse(localStorage.getItem("admin") || "{}") || {};
    } catch {
      return {};
    }
  })();
  const bootstrapSchoolCode = String(bootstrapAdmin.schoolCode || "").trim();
  const TEACHERS_CACHE_KEY = `teachers_page_cache_${bootstrapSchoolCode || "global"}`;
  const TEACHERS_UI_STATE_KEY = `teachers_page_ui_${bootstrapSchoolCode || "global"}`;
  const readBootstrapTeachersCache = () => {
    try {
      const rawSession = sessionStorage.getItem(TEACHERS_CACHE_KEY);
      const rawLocal = localStorage.getItem(TEACHERS_CACHE_KEY);
      const parsed = JSON.parse(rawSession || rawLocal || "null");
      if (!parsed || typeof parsed !== "object") return null;
      if (!rawSession && rawLocal) {
        sessionStorage.setItem(TEACHERS_CACHE_KEY, rawLocal);
      }
      return parsed;
    } catch {
      return null;
    }
  };
  const bootstrapCache = readBootstrapTeachersCache();
  const readBootstrapUiState = () => {
    try {
      const rawSession = sessionStorage.getItem(TEACHERS_UI_STATE_KEY);
      const rawLocal = localStorage.getItem(TEACHERS_UI_STATE_KEY);
      const parsed = JSON.parse(rawSession || rawLocal || "null");
      if (!parsed || typeof parsed !== "object") return null;
      if (!rawSession && rawLocal) {
        sessionStorage.setItem(TEACHERS_UI_STATE_KEY, rawLocal);
      }
      return parsed;
    } catch {
      return null;
    }
  };
  const bootstrapUiState = readBootstrapUiState();

  const [teachers, setTeachers] = useState(Array.isArray(bootstrapCache?.teacherList) ? bootstrapCache.teacherList : []);
  const [loadingTeachers, setLoadingTeachers] = useState(!bootstrapCache);
  const [selectedGrade, setSelectedGrade] = useState(
    typeof bootstrapUiState?.selectedGrade === "string" && bootstrapUiState.selectedGrade.trim()
      ? bootstrapUiState.selectedGrade
      : "All"
  );
  const [gradeOptions, setGradeOptions] = useState(Array.isArray(bootstrapCache?.gradeOptions) ? bootstrapCache.gradeOptions : []);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [searchTerm, setSearchTerm] = useState(
    typeof bootstrapUiState?.searchTerm === "string" ? bootstrapUiState.searchTerm : ""
  );
  const [popupMessages, setPopupMessages] = useState([]);
  const [popupInput, setPopupInput] = useState("");
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [typingUserId, setTypingUserId] = useState(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [popupMessages, teacherChatOpen]);
  const [teacherSchedule, setTeacherSchedule] = useState({}); // store schedule
  const [teacherDailyPlans, setTeacherDailyPlans] = useState([]);
  const [planSidebarTab, setPlanSidebarTab] = useState('daily'); // daily | weekly | monthly
  const [planWeeks, setPlanWeeks] = useState([]);
  const [planCurrentWeeks, setPlanCurrentWeeks] = useState([]); // per-course current week blocks
  const [planCurrentWeekIndex, setPlanCurrentWeekIndex] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');
  const [planSubmittedKeys, setPlanSubmittedKeys] = useState([]);
  const [planSubmittedEntries, setPlanSubmittedEntries] = useState([]);
  const [planSidebarOpen, setPlanSidebarOpen] = useState(true);
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const [planSelectedCourseId, setPlanSelectedCourseId] = useState('all');
  const [planCourseLabelMap, setPlanCourseLabelMap] = useState({});
  const [planAnnualOpen, setPlanAnnualOpen] = useState(false);
  const [planShowSubmittedTable, setPlanShowSubmittedTable] = useState(false);

  const [showMessageDropdown, setShowMessageDropdown] = useState(false);

  const [unreadTeachers, setUnreadTeachers] = useState({});
  const [unreadSenders, setUnreadSenders] = useState({}); 
  const [postNotifications, setPostNotifications] = useState([]);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [selectedTeacherUser, setSelectedTeacherUser] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminModalUsername, setAdminModalUsername] = useState("");
  const [adminModalPassword, setAdminModalPassword] = useState("");
  const [adminModalError, setAdminModalError] = useState("");
  const [adminVerifying, setAdminVerifying] = useState(false);
  const [pendingToggle, setPendingToggle] = useState(null); // { userId, curBool, newActive }
  const [teachersInitialized, setTeachersInitialized] = useState(Boolean(bootstrapCache));

  // open modal to confirm toggle and collect admin credentials
  const handleToggleActiveTeacher = async () => {
    if (!selectedTeacherUser?.userId && !selectedTeacher?.userId) return;
    const userId = selectedTeacherUser?.userId || selectedTeacher?.userId;
    if (!userId) return;

    const currentVal = selectedTeacherUser?.isActive ?? selectedTeacher?.isActive;
    const curBool = currentVal === true || String(currentVal) === "true";
    const newActive = !curBool;

    setPendingToggle({ userId, curBool, newActive });
    setAdminModalUsername("");
    setAdminModalPassword("");
    setAdminModalError("");
    setShowAdminModal(true);
  };

  const closeAdminModal = () => {
    setShowAdminModal(false);
    setPendingToggle(null);
    setAdminModalError("");
  };

  const submitAdminModal = async () => {
    if (!pendingToggle) return;
    const { userId, curBool, newActive } = pendingToggle;
    if (!adminModalUsername || !adminModalPassword) {
      setAdminModalError('Enter admin username and password');
      return;
    }

    setAdminVerifying(true);
    setDeactivating(true);

    try {
      const verifyRes = await axios.post(`${API_BASE}/login`, { username: String(adminModalUsername).trim(), password: String(adminModalPassword) });
      if (!verifyRes?.data?.success) {
        setAdminModalError(verifyRes?.data?.message || 'Admin credentials verification failed');
        setAdminVerifying(false);
        setDeactivating(false);
        return;
      }
    } catch (verErr) {
      console.error('Admin credential verification failed', verErr);
      setAdminModalError('Failed to verify admin credentials. Check server or try again.');
      setAdminVerifying(false);
      setDeactivating(false);
      return;
    }

    const teacherId =
      (selectedTeacher && selectedTeacher.teacherId) ||
      (selectedTeacherUser && selectedTeacherUser.teacherId) ||
      Object.values(teachers || {}).find((teacher) => teacher.userId === userId)?.teacherId ||
      "";
    const optimisticUsersMap = {
      ...(usersByUserId || {}),
      [userId]: { ...((usersByUserId || {})[userId] || {}), isActive: newActive },
    };
    const optimisticTeachers = Array.isArray(teachers)
      ? teachers.map((teacher) => (teacher.userId === userId ? { ...teacher, isActive: newActive } : teacher))
      : teachers;

    // optimistic UI update
    setSelectedTeacherUser((prev) => (prev ? { ...prev, isActive: newActive } : prev));
    setUsersByUserId(optimisticUsersMap);
    setTeachers(optimisticTeachers);

    try {
      let usersItemUrl = `${SCHOOL_DB_ROOT}/Users/${encodeURIComponent(userId)}.json`;
      const directUserRes = await axios.get(usersItemUrl).catch(() => ({ data: null }));

      if (!directUserRes?.data) {
        const resp = await axios.get(`${SCHOOL_DB_ROOT}/Users.json`);
        const allUsers = resp.data || {};
        const normalize = (v) => String(v || "").replace(/^[-]+/, "").trim();
        const pushKeys = Object.keys(allUsers || {}).filter((pk) => {
          const rec = allUsers[pk] || {};
          const recUserId = normalize(rec.userId || pk);
          const recUsername = String(rec.username || "").trim();
          return recUserId === userId || recUsername === userId || pk === userId;
        });

        if (pushKeys.length === 0) {
          console.error('submitAdminModal: user push-key not found for', userId, allUsers);
          throw new Error('user_record_not_found');
        }

        usersItemUrl = `${SCHOOL_DB_ROOT}/Users/${encodeURIComponent(pushKeys[0])}.json`;
      }

      await axios.patch(usersItemUrl, { isActive: newActive });
      if (teacherId) {
        await axios.patch(`${SCHOOL_DB_ROOT}/TeacherDirectory/${encodeURIComponent(teacherId)}.json`, { isActive: newActive }).catch(() => undefined);
        writeTeacherDirectoryEntryToCache(teacherId, (previousEntry) => ({
          ...previousEntry,
          isActive: newActive,
        }));
      }
      setPopupMessages((msgs) => ([{ text: newActive ? 'Teacher activated.' : 'Teacher deactivated.', type: 'success', ts: Date.now() }, ...msgs]));

      // If we just deactivated the teacher, also unassign them from courses/grade assignments
      if (newActive === false) {
        try {
          if (teacherId) {
            // 1) Remove TeacherAssignments entries that reference this teacherId
            try {
              const taRes = await axios.get(`${SCHOOL_DB_ROOT}/TeacherAssignments.json`);
              const taData = taRes.data || {};
              for (const [taKey, taVal] of Object.entries(taData)) {
                if (!taVal) continue;
                if (String(taVal.teacherId || "").trim() === String(teacherId).trim()) {
                  await axios.delete(`${SCHOOL_DB_ROOT}/TeacherAssignments/${encodeURIComponent(taKey)}.json`);
                }
              }
            } catch (e) {
              console.error('Failed removing TeacherAssignments for', teacherId, e);
            }

            // 2) Delete GradeManagement sectionSubjectTeachers entries that reference this teacher
            try {
              const gmRes = await axios.get(`${SCHOOL_DB_ROOT}/GradeManagement/grades.json`);
              const gmData = gmRes.data || {};
              for (const [gradeKey, gradeNode] of Object.entries(gmData)) {
                const sst = gradeNode?.sectionSubjectTeachers || {};
                for (const [sectionKey, subjectsNode] of Object.entries(sst || {})) {
                  for (const [subjectKey, assign] of Object.entries(subjectsNode || {})) {
                    if (!assign) continue;
                    const assignedTeacherId = String(assign.teacherId || assign.teacherRecordKey || "").trim();
                    if (assignedTeacherId && assignedTeacherId === String(teacherId).trim()) {
                      const deleteUrl = `${SCHOOL_DB_ROOT}/GradeManagement/grades/${encodeURIComponent(gradeKey)}/sectionSubjectTeachers/${encodeURIComponent(sectionKey)}/${encodeURIComponent(subjectKey)}.json`;
                      try {
                        await axios.delete(deleteUrl);
                      } catch (err) {
                        console.error('Failed deleting sectionSubjectTeachers entry', deleteUrl, err?.response?.data || err.message || err);
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Failed clearing GradeManagement assignments for', teacherId, e);
            }

            // 3) Update local UI state to remove their grades/subjects
            const clearedTeachers = Array.isArray(optimisticTeachers)
              ? optimisticTeachers.map((teacher) => (
                  teacher.teacherId === teacherId ? { ...teacher, gradesSubjects: [], subjectsUnique: [] } : teacher
                ))
              : optimisticTeachers;
            const clearedUsersMap = {
              ...optimisticUsersMap,
              [userId]: { ...(optimisticUsersMap[userId] || {}), isActive: false },
            };
            setTeachers(clearedTeachers);
            setUsersByUserId(clearedUsersMap);
            writeTeacherDirectoryEntryToCache(teacherId, (previousEntry) => ({
              ...previousEntry,
              isActive: false,
              gradesSubjects: [],
              subjectsUnique: [],
            }));
            persistTeachersCache(clearedTeachers, clearedUsersMap, gradeOptions);
          }
        } catch (e) {
          console.error('Error during unassign steps for deactivated teacher', e);
          setPopupMessages((msgs) => ([{ text: 'Teacher deactivated but failed to fully unassign from courses.', type: 'warning', ts: Date.now() }, ...msgs]));
        }
      } else {
        persistTeachersCache(optimisticTeachers, optimisticUsersMap, gradeOptions);
      }
    } catch (err) {
      console.error('submitAdminModal error:', err);
      // revert optimistic changes on failure
      setSelectedTeacherUser((prev) => (prev ? { ...prev, isActive: curBool } : prev));
      setUsersByUserId((prev) => ({ ...(prev || {}), [userId]: { ...((prev || {})[userId] || {}), isActive: curBool } }));
      setTeachers((prev) => (Array.isArray(prev) ? prev.map(t => t.userId === userId ? { ...t, isActive: curBool } : t) : prev));
      setPopupMessages((msgs) => ([{ text: err?.message === 'user_record_not_found' ? 'User record not found in Users node.' : `Failed to update teacher status: ${err?.message || 'network error'}`, type: 'error', ts: Date.now() }, ...msgs]));
    } finally {
      setAdminVerifying(false);
      setDeactivating(false);
      closeAdminModal();
    }
  };
  
  const [usersByUserId, setUsersByUserId] = useState(
    bootstrapCache?.usersMap && typeof bootstrapCache.usersMap === "object" ? bootstrapCache.usersMap : {}
  );
  const [isPortrait, setIsPortrait] = useState(typeof window !== "undefined" ? window.innerWidth < window.innerHeight : false);
  const [isNarrow, setIsNarrow] = useState(typeof window !== "undefined" ? window.innerWidth < 900 : false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [teachersRefreshNonce, setTeachersRefreshNonce] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const admin = bootstrapAdmin;
  const adminUserId = admin.userId;
  const adminId = admin.userId;
  const schoolCode = String(admin.schoolCode || "").trim();
  const dbRT = getDatabase(app);
  const weekOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const nowDate = new Date(nowTick);
  const currentDayName = nowDate.toLocaleDateString("en-US", { weekday: "long" });
  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const RTDB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";
  const SCHOOL_DB_ROOT = schoolCode
    ? `${RTDB_BASE}/Platform1/Schools/${encodeURIComponent(schoolCode)}`
    : RTDB_BASE;
  const TEACHER_DIRECTORY_URL = `${SCHOOL_DB_ROOT}/TeacherDirectory.json`;
  const PRIMARY = "#007afb";
  const BACKGROUND = "#ffffff";
  const ACCENT = "#00B6A9";

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

  const headerCardStyle = {
    ...shellCardStyle,
    borderRadius: 14,
    padding: "16px 18px 14px",
    position: "relative",
    overflow: "hidden",
    background: "linear-gradient(135deg, color-mix(in srgb, var(--surface-panel) 88%, white) 0%, color-mix(in srgb, var(--surface-panel) 94%, var(--surface-accent)) 100%)",
  };

  const contentWidth = isNarrow
    ? "100%"
    : !isPortrait
      ? "min(760px, max(320px, calc(100vw - 560px)))"
      : "760px";
  const FEED_MAX_WIDTH = "min(1320px, 100%)";
  const rightSidebarOffset = !isPortrait ? 408 : 2;
  const sidebarTeacherName = selectedTeacher?.name || "Teachers Workspace";
  const sidebarTeacherImage = selectedTeacher?.profileImage || "/default-profile.png";
  const sidebarTeacherEmail = selectedTeacherUser?.email || selectedTeacher?.email || "";
  const listCardStyle = (isSelected) => ({
    width: contentWidth,
    maxWidth: "100%",
    minHeight: isNarrow ? "76px" : "88px",
    borderRadius: "16px",
    padding: isNarrow ? "9px 10px" : "12px 14px",
    background: isSelected ? "var(--surface-accent)" : "var(--surface-panel)",
    border: isSelected ? "2px solid var(--accent-strong)" : "1px solid var(--border-soft)",
    boxShadow: isSelected ? "var(--shadow-glow)" : "var(--shadow-soft)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    boxSizing: "border-box",
    transition: "all 0.25s ease",
  });

  const rightDrawerCardStyle = {
    background: "var(--surface-panel)",
    borderRadius: 12,
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
  };

  const tabButtonStyle = (tab) => ({
    flex: 1,
    padding: "8px",
    background: activeTab === tab ? "var(--surface-accent)" : "transparent",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    color: activeTab === tab ? "var(--accent-strong)" : "var(--text-muted)",
    fontSize: "11px",
    borderBottom:
      activeTab === tab
        ? "2px solid var(--accent-strong)"
        : "2px solid transparent",
    transition: "all 0.2s ease",
  });

  const contentLeft = 0;

  const isValidGradeKey = (value) => {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric >= 1 && numeric <= 12;
  };

  const getSchoolNodeUrl = (nodeName) => `${SCHOOL_DB_ROOT}/${nodeName}.json`;
  const getRootNodeUrl = (nodeName) => `${RTDB_BASE}/${nodeName}.json`;
  const readSchoolNode = async (nodeName) => {
    if (schoolCode) {
      try {
        const schoolRes = await axios.get(getSchoolNodeUrl(nodeName), { timeout: 6000 });
        const schoolData = schoolRes.data;
        const hasSchoolData = Array.isArray(schoolData)
          ? schoolData.length > 0
          : schoolData && typeof schoolData === "object"
            ? Object.keys(schoolData).length > 0
            : schoolData !== null && schoolData !== undefined;
        if (hasSchoolData) {
          return schoolData;
        }
      } catch (err) {
        // fallback to root for legacy paths
      }
    }

    try {
      const rootRes = await axios.get(getRootNodeUrl(nodeName), { timeout: 6000 });
      return rootRes.data || {};
    } catch (err) {
      return {};
    }
  };

  const readTeachersCache = () => {
    try {
      const rawSession = sessionStorage.getItem(TEACHERS_CACHE_KEY);
      const rawLocal = localStorage.getItem(TEACHERS_CACHE_KEY);
      const parsed = JSON.parse(rawSession || rawLocal || "null");
      if (!parsed || typeof parsed !== "object") return null;
      if (!rawSession && rawLocal) {
        sessionStorage.setItem(TEACHERS_CACHE_KEY, rawLocal);
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const writeTeachersCache = (payload) => {
    try {
      const value = JSON.stringify({ ...payload, fetchedAt: Date.now() });
      sessionStorage.setItem(
        TEACHERS_CACHE_KEY,
        value
      );
      localStorage.setItem(TEACHERS_CACHE_KEY, value);
    } catch {
      // ignore cache write errors
    }
  };

  const persistTeachersCache = (teacherList, usersMapValue = usersByUserId, gradeOptionsValue = gradeOptions) => {
    writeTeachersCache({
      teacherList,
      gradeOptions: Array.isArray(gradeOptionsValue) ? gradeOptionsValue : [],
      usersMap: usersMapValue && typeof usersMapValue === "object" ? usersMapValue : {},
    });
  };

  const writeTeacherDirectoryEntryToCache = (teacherId, updater) => {
    if (!teacherId) {
      return;
    }

    const currentDirectory = readCachedJson(TEACHER_DIRECTORY_URL, {
      ttlMs: 15 * 60 * 1000,
    });
    if (!currentDirectory || typeof currentDirectory !== "object") {
      return;
    }

    const previousEntry = currentDirectory[teacherId] || {};
    writeCachedJson(TEACHER_DIRECTORY_URL, {
      ...currentDirectory,
      [teacherId]: typeof updater === "function" ? updater(previousEntry) : { ...previousEntry, ...(updater || {}) },
    });
  };

  const handleRefreshTeachers = () => {
    try {
      sessionStorage.removeItem(TEACHERS_CACHE_KEY);
      localStorage.removeItem(TEACHERS_CACHE_KEY);
    } catch {
      // ignore
    }
    setLoadingTeachers(true);
    setTeachersRefreshNonce((prev) => prev + 1);
  };

  useEffect(() => {
    const tick = () => setNowTick(Date.now());
    const intervalId = setInterval(tick, 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    try {
      const value = JSON.stringify({ selectedGrade, searchTerm });
      sessionStorage.setItem(TEACHERS_UI_STATE_KEY, value);
      localStorage.setItem(TEACHERS_UI_STATE_KEY, value);
    } catch {
      // ignore UI state cache write errors
    }
  }, [selectedGrade, searchTerm, TEACHERS_UI_STATE_KEY]);

  const getPeriodRangeMinutes = (label) => {
    if (!label) return null;
    const text = String(label);
    const match = text.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const toMinutes = (hStr, mStr) => {
      let h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      if (h < 8) h += 12; // afternoon/evening schedule without AM/PM
      return h * 60 + m;
    };
    const start = toMinutes(match[1], match[2]);
    const end = toMinutes(match[3], match[4]);
    if (start === null || end === null) return null;
    return { start, end };
  };

  const downloadTeacherTimetablePdf = () => {
    try {
      if (!selectedTeacher) return;
      if (!teacherSchedule || Object.keys(teacherSchedule).length === 0) return;

      const teacherName = (selectedTeacher?.name || "Teacher").toString().trim();
      const safeName = teacherName.replace(/[<>:"/\\|?*]+/g, "").trim() || "Teacher";
      const fileName = `${safeName}_Weekly_Timetable.pdf`;

      const days = weekOrder.filter((d) => teacherSchedule[d]);
      const periodKeySet = new Set();
      days.forEach((day) => {
        const periods = teacherSchedule?.[day] || {};
        Object.keys(periods).forEach((p) => periodKeySet.add(p));
      });

      const sortPeriodKeys = (keys) => {
        return [...keys].sort((a, b) => {
          const sa = String(a || "");
          const sb = String(b || "");
          const na = (sa.match(/\d+/) || [null])[0];
          const nb = (sb.match(/\d+/) || [null])[0];
          if (na !== null && nb !== null) {
            const ia = parseInt(na, 10);
            const ib = parseInt(nb, 10);
            if (!Number.isNaN(ia) && !Number.isNaN(ib) && ia !== ib) return ia - ib;
          }
          return sa.localeCompare(sb);
        });
      };

      const periodKeys = sortPeriodKeys(Array.from(periodKeySet));

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const marginX = 40;
      const titleY = 40;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Weekly Teaching Timetable", marginX, titleY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const metaStartY = titleY + 18;
      const emailText = (selectedTeacherUser?.email || selectedTeacher?.email || "").toString();
      const subjectsText = (selectedTeacher?.subjectsUnique || []).join(", ");
      doc.text(`Teacher: ${teacherName}`, marginX, metaStartY);
      doc.text(`Email: ${emailText}`, marginX, metaStartY + 14);
      doc.text(`Subjects: ${subjectsText}`, marginX, metaStartY + 28);
      doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, metaStartY + 42);

      const tableHead = [["Period", ...days]];
      const tableBody = periodKeys.map((periodKey) => {
        return [
          periodKey,
          ...days.map((day) => {
            const entries = teacherSchedule?.[day]?.[periodKey] || [];
            if (!Array.isArray(entries) || entries.length === 0) return "";
            const labels = entries
              .map((e) => {
                const subject = (e?.subject || "").toString().trim();
                const cls = (e?.class || "").toString().trim();
                if (subject && cls) return `${subject} (${cls})`;
                return subject || cls;
              })
              .filter(Boolean);
            return Array.from(new Set(labels)).join("\n");
          }),
        ];
      });

      autoTable(doc, {
        startY: metaStartY + 60,
        head: tableHead,
        body: tableBody,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 4,
          valign: "top",
        },
        headStyles: {
          fillColor: [30, 64, 175],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 90 },
        },
      });

      doc.save(fileName);
    } catch (e) {
      console.error("Failed to export teacher timetable:", e);
    }
  };

  const dayOrder = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
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


  // ---------------- FETCH TEACHERS ----------------
  useEffect(() => {
    const fetchTeachers = async () => {
      const isLikelyIdOrMissingName = (nameValue, teacherIdValue) => {
        const name = String(nameValue || "").trim();
        const teacherId = String(teacherIdValue || "").trim();
        if (!name) return true;
        if (name === teacherId) return true;
        if (name.toLowerCase() === "unknown teacher") return true;
        return false;
      };

      const normalizeProfileImage = (value) => {
        const raw = String(value || "").trim();
        if (!raw) return "";
        if (/^(https?:\/\/|data:|blob:|\/)/i.test(raw)) return raw;
        return "";
      };

      const resolveProfileImage = (...candidates) => {
        for (const candidate of candidates) {
          const normalized = normalizeProfileImage(candidate);
          if (normalized) return normalized;
        }
        return "/default-profile.png";
      };

      const cached = readTeachersCache();
      if (cached) {
        const cachedUsersMap = cached.usersMap && typeof cached.usersMap === "object" ? cached.usersMap : {};
        const cachedTeacherList = (Array.isArray(cached.teacherList) ? cached.teacherList : [])
          .filter((teacherItem) => {
            const userId = String(teacherItem?.userId || "").trim();
            return !!cachedUsersMap[userId];
          })
          .map((teacherItem) => {
            const user = cachedUsersMap[String(teacherItem?.userId || "").trim()] || {};
            const currentName = String(teacherItem?.name || "").trim();
            const currentTeacherId = String(teacherItem?.teacherId || "").trim();
            const shouldReplaceWithUserName = !currentName || currentName === currentTeacherId;
            return {
              ...teacherItem,
              name: shouldReplaceWithUserName ? (user.name || teacherItem.name || "Unknown Teacher") : teacherItem.name,
              profileImage: resolveProfileImage(teacherItem?.profileImage, user.profileImage),
            };
          });
        setTeachers(cachedTeacherList);
        setGradeOptions(Array.isArray(cached.gradeOptions) ? cached.gradeOptions : []);
        setUsersByUserId(cachedUsersMap);
        setSelectedGrade((prev) => {
          if (prev === "All") return prev;
          return (cached.gradeOptions || []).includes(String(prev)) ? prev : "All";
        });
        setLoadingTeachers(false);

        const cachedFetchedAt = Number(cached.fetchedAt || 0);
        if (cachedFetchedAt && Date.now() - cachedFetchedAt < 5 * 60 * 1000) {
          setTeachersInitialized(true);
          return;
        }
      }

      setLoadingTeachers(true);

      try {
        const teacherDirectoryData = await fetchCachedJson(TEACHER_DIRECTORY_URL, {
          ttlMs: 15 * 60 * 1000,
          fallbackValue: {},
        });

        const teacherSummaryList = Object.entries(teacherDirectoryData || {})
          .map(([teacherId, teacher]) => {
            const userId = String(teacher?.userId || "").trim();
            if (!userId) {
              return null;
            }

            const gradesSubjects = Array.isArray(teacher?.gradesSubjects)
              ? teacher.gradesSubjects
                  .map((entry) => ({
                    courseId: String(entry?.courseId || "").trim(),
                    grade: String(entry?.grade || "").trim(),
                    section: String(entry?.section || "").trim(),
                    subject: String(entry?.subject || "").trim(),
                  }))
                  .filter((entry) => entry.grade && entry.section && entry.subject)
              : [];

            const subjectsUnique = Array.isArray(teacher?.subjectsUnique)
              ? teacher.subjectsUnique.filter(Boolean).map((subject) => String(subject).trim()).filter(Boolean)
              : Array.from(
                  new Set(
                    gradesSubjects
                      .map((entry) => String(entry?.subject || "").trim())
                      .filter(Boolean)
                  )
                );

            return {
              teacherId: String(teacher?.teacherId || teacherId || "").trim(),
              userId,
              name: String(teacher?.name || "").trim() || "Unknown Teacher",
              profileImage: resolveProfileImage(teacher?.profileImage),
              gradesSubjects,
              subjectsUnique,
              email: teacher?.email || null,
              phone: teacher?.phone || null,
              gender: teacher?.gender || null,
              isActive: teacher?.isActive !== false,
            };
          })
          .filter(Boolean)
          .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || "")));

        if (teacherSummaryList.length > 0) {
          const summaryUsersMap = teacherSummaryList.reduce((accumulator, teacher) => {
            accumulator[teacher.userId] = {
              userId: teacher.userId,
              teacherId: teacher.teacherId,
              role: "teacher",
              name: teacher.name,
              profileImage: teacher.profileImage,
              email: teacher.email,
              phone: teacher.phone,
              gender: teacher.gender,
              isActive: teacher.isActive,
            };
            return accumulator;
          }, {});

          const resolvedGrades = Array.from(
            new Set(
              teacherSummaryList
                .flatMap((teacher) => teacher?.gradesSubjects || [])
                .map((gradeSubjectItem) => String(gradeSubjectItem?.grade || "").trim())
                .filter((gradeValue) => isValidGradeKey(gradeValue))
            )
          ).sort((a, b) => Number(a) - Number(b));

          setTeachers(teacherSummaryList);
          setGradeOptions(resolvedGrades);
          setUsersByUserId(summaryUsersMap);
          setSelectedGrade((prev) => {
            if (prev === "All") return prev;
            return resolvedGrades.includes(String(prev)) ? prev : "All";
          });
          setLoadingTeachers(false);
          setTeachersInitialized(true);
          persistTeachersCache(teacherSummaryList, summaryUsersMap, resolvedGrades);
          return;
        }

        const [teachersData, assignmentsData, coursesData, gradesData, employeesData, usersData] = await Promise.all([
          readSchoolNode("Teachers"),
          readSchoolNode("TeacherAssignments"),
          readSchoolNode("Courses"),
          readSchoolNode("GradeManagement/grades"),
          readSchoolNode("Employees"),
          readSchoolNode("Users"),
        ]);

        const buildEmployeeDisplayName = (employee) => {
          const personal = employee?.personal || {};
          const candidates = [
            employee?.name,
            employee?.fullName,
            personal?.fullName,
            [personal?.firstName, personal?.middleName, personal?.lastName].filter(Boolean).join(" "),
            personal?.firstName,
          ];
          return candidates
            .map((value) => String(value || "").trim())
            .find((value) => Boolean(value)) || "";
        };

        const buildEmployeeProfileImage = (employee) => {
          const profileData = employee?.profileData || {};
          return resolveProfileImage(
            employee?.profileImage,
            profileData?.profileImage,
            profileData?.photoUrl,
            profileData?.avatar,
            employee?.photoUrl,
            employee?.avatar
          );
        };

        const normalizeId = (id) => String(id || "").replace(/^[-]+/, "").trim();
        const usersMap = Object.entries(usersData || {}).reduce((acc, [userKey, userRecord]) => {
          const userId = normalizeId(userRecord?.userId || userKey);
          if (!userId) return acc;
          if (String(userRecord?.role || "").toLowerCase() !== "teacher") return acc;
          acc[userId] = {
            ...(userRecord || {}),
            userId,
          };
          return acc;
        }, {});

        const teacherSeedMap = { ...(teachersData || {}) };
        const employeeNameByTeacherId = {};
        const employeeProfileImageByTeacherId = {};
        Object.entries(employeesData || {}).forEach(([employeeId, employee]) => {
          const teacherId = String(employee?.teacherId || "").trim();
          if (!teacherId) return;
          const existing = teacherSeedMap[teacherId] || {};
          const employeeUserId = String(employee?.userId || "").trim();
          const employeeDisplayName = buildEmployeeDisplayName(employee);
          if (employeeDisplayName) {
            employeeNameByTeacherId[teacherId] = employeeDisplayName;
          }
          const employeeProfileImage = buildEmployeeProfileImage(employee);
          if (employeeProfileImage && employeeProfileImage !== "/default-profile.png") {
            employeeProfileImageByTeacherId[teacherId] = employeeProfileImage;
          }

          teacherSeedMap[teacherId] = {
            ...existing,
            teacherId,
            employeeId: existing.employeeId || employeeId,
            userId: String(existing.userId || "").trim() || employeeUserId || null,
            status: existing.status || employee?.status || "active",
          };
        });

        const toSubjectKey = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
        const toSectionKey = (value) => String(value || "").trim().toUpperCase();
        const toGradeKey = (value) => String(value || "").trim();

        const courseLookupByTuple = {};
        Object.entries(coursesData || {}).forEach(([courseId, course]) => {
          const grade = toGradeKey(course?.grade);
          const section = toSectionKey(course?.section);
          const subject = toSubjectKey(course?.subject || course?.name);
          if (!grade || !section || !subject) return;
          const tupleKey = `${grade}__${section}__${subject}`;
          if (!courseLookupByTuple[tupleKey]) {
            courseLookupByTuple[tupleKey] = courseId;
          }
        });

        const assignmentsByTeacher = {};
        const pushTeacherAssignment = (teacherIdValue, assignmentValue) => {
          const teacherId = String(teacherIdValue || "").trim();
          if (!teacherId) return;
          if (!assignmentsByTeacher[teacherId]) assignmentsByTeacher[teacherId] = [];
          assignmentsByTeacher[teacherId].push(assignmentValue);
        };

        Object.values(assignmentsData || {}).forEach((assignment) => {
          const teacherId = String(assignment?.teacherId || "").trim();
          const courseId = String(assignment?.courseId || "").trim();
          if (!teacherId || !courseId) return;
          const course = coursesData?.[courseId] || {};
          pushTeacherAssignment(teacherId, {
            courseId,
            grade: course?.grade,
            section: course?.section,
            subject: course?.subject || course?.name,
          });
        });

        Object.entries(gradesData || {}).forEach(([gradeKey, gradeNode]) => {
          const sectionSubjectTeachers = gradeNode?.sectionSubjectTeachers;
          if (!sectionSubjectTeachers || typeof sectionSubjectTeachers !== "object") return;

          Object.entries(sectionSubjectTeachers).forEach(([sectionKey, subjectsNode]) => {
            if (!subjectsNode || typeof subjectsNode !== "object") return;

            Object.entries(subjectsNode).forEach(([subjectKey, assignment]) => {
              if (!assignment || typeof assignment !== "object") return;

              const teacherId = String(
                assignment?.teacherId || assignment?.teacherRecordKey || ""
              ).trim();
              if (!teacherId) return;

              const subjectName = String(assignment?.subject || subjectKey || "").trim();
              const grade = toGradeKey(assignment?.grade || gradeKey);
              const section = toSectionKey(assignment?.section || sectionKey);
              const tupleKey = `${grade}__${section}__${toSubjectKey(subjectName)}`;
              const resolvedCourseId = courseLookupByTuple[tupleKey] || "";

              pushTeacherAssignment(teacherId, {
                courseId: resolvedCourseId,
                grade,
                section,
                subject: subjectName,
              });
            });
          });
        });

        const teacherListRaw = Object.keys(teacherSeedMap)
          .map((teacherId) => {
            const teacher = teacherSeedMap[teacherId] || {};
            const normalizedUserId = normalizeId(teacher?.userId);
            const user = usersMap[normalizedUserId] || {};
            if (!user.userId) return null;
            const teacherDisplayName =
              String(user?.name || "").trim() ||
              String(teacher?.name || "").trim() ||
              String(employeeNameByTeacherId[teacherId] || "").trim() ||
              "Unknown Teacher";
            const teacherProfileImage = resolveProfileImage(
              teacher?.profileImage,
              employeeProfileImageByTeacherId[teacherId],
              user?.profileImage
            );

            const gradesSubjectsRaw = (assignmentsByTeacher[teacherId] || [])
              .map((entry) => {
                const courseId = String(entry?.courseId || "").trim();
                const course = courseId ? coursesData?.[courseId] : null;
                return {
                  courseId,
                  grade: entry?.grade ?? course?.grade,
                  subject: entry?.subject ?? course?.subject ?? course?.name,
                  section: entry?.section ?? course?.section,
                };
              })
              .filter((entry) => {
                return Boolean(
                  String(entry?.grade || "").trim() &&
                    String(entry?.section || "").trim() &&
                    String(entry?.subject || "").trim()
                );
              });

            // Deduplicate: show each course only once (prevents repeated subjects)
            const seenCourseKeys = new Set();
            const gradesSubjects = [];
            gradesSubjectsRaw.forEach((gs) => {
              const key = gs.courseId || `${gs.grade}-${gs.section}-${gs.subject}`;
              if (seenCourseKeys.has(key)) return;
              seenCourseKeys.add(key);
              gradesSubjects.push(gs);
            });

            // Deduplicate subjects for display (one subject name only once)
            const seenSubjects = new Set();
            const subjectsUnique = [];
            gradesSubjects.forEach((gs) => {
              const rawSubject = (gs?.subject ?? "").toString().trim();
              if (!rawSubject) return;
              const normalized = rawSubject.toLowerCase().replace(/\s+/g, " ");
              if (seenSubjects.has(normalized)) return;
              seenSubjects.add(normalized);
              subjectsUnique.push(rawSubject);
            });

            return {
              teacherId,
              name: teacherDisplayName,
              profileImage: teacherProfileImage,
              gradesSubjects,
              subjectsUnique,
              email: user.email || null,
              userId: normalizedUserId
            };
          })
          .filter(Boolean);

        // Deduplicate by userId: only one entry per userId
        const seenUserIds = new Set();
        const teacherList = teacherListRaw.filter((teacher) => {
          const userId = String(teacher.userId || "").trim();
          if (seenUserIds.has(userId)) return false;
          seenUserIds.add(userId);
          return true;
        });

        setTeachers(teacherList);

        const managedGrades = Object.keys(gradesData || {})
          .filter((gradeKey) => isValidGradeKey(gradeKey))
          .sort((a, b) => Number(a) - Number(b));

        const fallbackFromAssignments = Array.from(
          new Set(
            teacherList
              .flatMap((teacherItem) => teacherItem?.gradesSubjects || [])
              .map((gradeSubjectItem) => String(gradeSubjectItem?.grade || "").trim())
              .filter((gradeValue) => isValidGradeKey(gradeValue))
          )
        ).sort((a, b) => Number(a) - Number(b));

        const resolvedGrades = managedGrades.length ? managedGrades : fallbackFromAssignments;
        setGradeOptions(resolvedGrades);
        setSelectedGrade((prev) => {
          if (prev === "All") return prev;
          return resolvedGrades.includes(String(prev)) ? prev : "All";
        });

        setLoadingTeachers(false);

        setUsersByUserId(usersMap);

        const hydratedTeachers = teacherList.map((teacherItem) => {
          const user = usersMap[String(teacherItem?.userId || "").trim()] || {};
          return {
            ...teacherItem,
            name: user.name || teacherItem.name,
            profileImage: resolveProfileImage(teacherItem?.profileImage, user.profileImage),
            email: user.email || teacherItem.email || null,
          };
        });

        // If no Teachers node records are present, fall back to Users entries
        let finalTeachers = hydratedTeachers;
        if ((!Array.isArray(finalTeachers) || finalTeachers.length === 0) && Object.keys(usersMap || {}).length > 0) {
          const fromUsers = Object.values(usersMap).map((u) => ({
            teacherId: u.username || u.teacherId || u.userId || null,
            name: u.name || (u.username || u.userId) || "Unknown Teacher",
            profileImage: resolveProfileImage(u.profileImage),
            gradesSubjects: [],
            subjectsUnique: [],
            email: u.email || null,
            userId: u.userId,
            // mark source so we know it's from Users fallback
            _fromUsersFallback: true,
          }));
          finalTeachers = fromUsers;
        }

        setTeachers(finalTeachers);
        setTeachersInitialized(true);

        persistTeachersCache(finalTeachers, usersMap, resolvedGrades);
      } catch (err) {
        console.error("Error fetching teachers:", err);
      } finally {
        setLoadingTeachers(false);
      }
    };

    fetchTeachers();
  }, [teachersRefreshNonce]);

  useEffect(() => {
    if (!selectedTeacher?.userId) {
      setSelectedTeacherUser(null);
      return;
    }

    setSelectedTeacherUser(usersByUserId[selectedTeacher.userId] || null);
  }, [selectedTeacher, usersByUserId]);

  // ---------------- FILTER TEACHERS ----------------
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (teacher) => {
    if (!normalizedSearch) return true;
    const name = (teacher?.name || "").toLowerCase();
    const subjects = (teacher?.subjectsUnique || []).join(" ").toLowerCase();
    const grades = (teacher?.gradesSubjects || [])
      .map((gs) => `${gs.grade ?? ""}${gs.section ?? ""} ${gs.subject ?? ""}`)
      .join(" ")
      .toLowerCase();
    return name.includes(normalizedSearch) || subjects.includes(normalizedSearch) || grades.includes(normalizedSearch);
  };

  const isTeacherInactive = (t) => {
    try {
      const u = (usersByUserId || {})[String(t?.userId || "")] || {};
      const userVal = u?.isActive;
      if (userVal !== undefined && userVal !== null) {
        if (typeof userVal === "string") return userVal === "false" || userVal === "0";
        return userVal === false || userVal === 0;
      }
      const tVal = t?.isActive;
      if (tVal !== undefined && tVal !== null) {
        if (typeof tVal === "string") return tVal === "false" || tVal === "0";
        return tVal === false || tVal === 0;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const filteredTeachers =
    selectedGrade === "All"
      ? teachers.filter(matchesSearch)
      : selectedGrade === "Deactive"
        ? teachers.filter((t) => isTeacherInactive(t)).filter(matchesSearch)
        : selectedGrade === "Unassigned"
          ? teachers.filter((t) => !(Array.isArray(t.gradesSubjects) && t.gradesSubjects.length)).filter(matchesSearch)
          : teachers
              .filter((t) => (t.gradesSubjects || []).some((gs) => String(gs.grade) === String(selectedGrade)))
              .filter(matchesSearch);

  // Ensure selected teacher remains visible even if filters exclude them
  const displayedTeachers = (() => {
    const list = Array.isArray(filteredTeachers) ? [...filteredTeachers] : [];
    try {
      const sel = selectedTeacher || (selectedTeacherUser ? teachers.find(tt => tt.userId === selectedTeacherUser.userId) : null);
      if (sel) {
        const exists = list.some((x) => (x.teacherId && sel.teacherId && x.teacherId === sel.teacherId) || (x.userId && sel.userId && x.userId === sel.userId));
        if (!exists) {
          // prepend selected teacher so UI keeps showing details
          list.unshift(sel);
        }
      }
    } catch (e) {
      // ignore
    }
    return list;
  })();

  // debug: why filteredTeachers may be empty
  useEffect(() => {
    try {
      console.debug('Teachers filter debug', {
        selectedGrade,
        gradeOptions,
        teachersCount: Array.isArray(teachers) ? teachers.length : 0,
        filteredCount: Array.isArray(filteredTeachers) ? filteredTeachers.length : 0,
        searchTerm,
        sampleTeachers: Array.isArray(teachers) ? teachers.slice(0,3) : []
      });
    } catch (e) {}
  }, [selectedGrade, gradeOptions, teachers, filteredTeachers, searchTerm]);



// ---------------- FETCH TEACHER SCHEDULE ----------------
// ---------------- FETCH TEACHER SCHEDULE (FIXED & WORKING) ----------------
useEffect(() => {
  if (!selectedTeacher || activeTab !== "schedule") return;

  const fetchSchedule = async () => {
    try {
      const res = await axios.get(getSchoolNodeUrl("Schedules")).catch(async () => {
        return axios.get(getRootNodeUrl("Schedules"));
      });


      const allSchedules = res.data || {};
      const result = {};

      Object.entries(allSchedules).forEach(([day, dayData]) => {
        Object.entries(dayData || {}).forEach(([classKey, periods]) => {
          Object.entries(periods || {}).forEach(([periodKey, entry]) => {
            if (
              entry &&
              entry.teacherId === selectedTeacher.teacherId && // ✅ FIX
              !entry.break
            ) {
              if (!result[day]) result[day] = {};
              if (!result[day][periodKey]) result[day][periodKey] = [];

              result[day][periodKey].push({
                subject: entry.subject,
                class: classKey
              });
            }
          });
        });
      });

      console.log("✅ FINAL TEACHER SCHEDULE:", result);
      setTeacherSchedule(result);
    } catch (err) {
      console.error("❌ Schedule fetch failed:", err);
      setTeacherSchedule({});
    }
  };

  fetchSchedule();
}, [selectedTeacher, activeTab]);


useEffect(() => {
    // Replace with your actual API call
    const fetchUnreadSenders = async () => {
      const response = await fetch("/api/unreadSenders");
      const data = await response.json();
      setUnreadSenders(data);
    };
    fetchUnreadSenders();
  }, []);


// Fetch teacher daily lesson plan from RTDB LessonPlans node when Plan tab is active
useEffect(() => {
  if (!selectedTeacher || activeTab !== "plan") {
    setTeacherDailyPlans([]);
    setPlanWeeks([]);
    setPlanCurrentWeeks([]);
    setPlanCurrentWeekIndex(null);
    setPlanSubmittedKeys([]);
    setPlanSubmittedEntries([]);
    setPlanSelectedCourseId('all');
    setPlanCourseLabelMap({});
    setPlanAnnualOpen(false);
    setPlanShowSubmittedTable(false);
    setPlanError('');
    setPlanLoading(false);
    return;
  }

  const fetchLessonPlans = async () => {
    try {
      setPlanLoading(true);
      setPlanError('');
      const teacherUserId = selectedTeacher.userId;
      const teacherId = selectedTeacher.teacherId;
      if (!teacherUserId && !teacherId) {
        setTeacherDailyPlans([]);
        setPlanWeeks([]);
        setPlanCurrentWeeks([]);
        setPlanCurrentWeekIndex(null);
        return;
      }
      const today = new Date();
      const todayISO = today.toISOString().slice(0, 10);
      const todayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayIndex = today.getDay();
      const getScheduledIndex = (dayName) => {
        const lname = (dayName || '').toString().toLowerCase();
        return Object.prototype.hasOwnProperty.call(dayOrder, lname) ? dayOrder[lname] : null;
      };

      const normalizeWeekForKey = (val) => {
        if (val === undefined || val === null) return '';
        const s = String(val).trim();
        if (!s) return '';
        const m = s.match(/\d+/);
        return m ? m[0] : s;
      };

      const normalizeDayForKey = (dayName) => {
        return String(dayName || '').trim().toLowerCase();
      };

      const canonicalSubmissionKey = (teacherId, courseId, weekVal, dayName) => {
        const t = String(teacherId || '').trim();
        const c = String(courseId || '').trim();
        return `${t}::${c}::${normalizeWeekForKey(weekVal)}::${normalizeDayForKey(dayName)}`;
      };

      const normalizeISODate = (val) => {
        if (!val) return '';
        const s = String(val).trim();
        // Accept YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        // Try Date parsing as fallback
        const dt = new Date(s);
        if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
        return '';
      };

      const isPastISODate = (iso) => {
        const d = normalizeISODate(iso);
        if (!d) return false;
        // String compare works for ISO yyyy-mm-dd
        return d < todayISO;
      };

      const normalizeWeekDays = (input) => {
        if (!input) return [];
        if (Array.isArray(input)) {
          return input.map(d => ({
            dayName: (d.dayName || d.name || d.day || d.label || '').toString(),
            date: normalizeISODate(d.date || d.dayDate || d.isoDate || d.dayISO || ''),
            topic: d.topic || d.subject || d.title || '',
            method: d.method || d.methods || '',
            aids: d.aids || d.material || d.materials || '',
            assessment: d.assessment || d.assess || d.evaluation || '',
            note: d.note || d.notes || '',
          }));
        }
        if (typeof input === 'object') {
          return Object.keys(input).map((key) => {
            const val = input[key] || {};
            const dateFromKey = /^\d{4}-\d{2}-\d{2}$/.test(String(key || '').trim()) ? String(key).trim() : '';
            if (typeof val === 'string') return { dayName: key, date: dateFromKey, topic: val, method: '', aids: '', assessment: '', note: '' };
            return {
              dayName: (val.dayName || val.name || key).toString(),
              date: normalizeISODate(val.date || val.dayDate || val.isoDate || val.dayISO || dateFromKey || ''),
              topic: val.topic || val.subject || '',
              method: val.method || val.methods || '',
              aids: val.aids || val.material || '',
              assessment: val.assessment || val.assess || '',
              note: val.note || val.notes || '',
            };
          });
        }
        return [];
      };

      const getDayNameFromIso = (isoValue) => {
        const iso = normalizeISODate(isoValue);
        if (!iso) return '';
        const dt = new Date(`${iso}T00:00:00`);
        if (Number.isNaN(dt.getTime())) return '';
        return dt.toLocaleDateString('en-US', { weekday: 'long' });
      };

      const normalizeSemesterToken = (value) => {
        const raw = String(value || '').trim().toLowerCase().replace(/[_\s-]+/g, '');
        if (!raw) return '';
        if (raw === 'sem1' || raw === 'semester1') return 'semester1';
        if (raw === 'sem2' || raw === 'semester2') return 'semester2';
        return raw;
      };

      const normalizeTopicToken = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

      const buildLessonFeedbackKey = ({ courseId, semesterKey, monthKey, weekKey, dateKey, topic }) => {
        return [
          String(courseId || '').trim(),
          normalizeSemesterToken(semesterKey),
          String(monthKey || '').trim().toLowerCase(),
          normalizeWeekForKey(weekKey),
          normalizeISODate(dateKey),
          normalizeTopicToken(topic),
        ].join('::');
      };

      const normalizeUnderstandingLevel = (level, label) => {
        const raw = String(level || label || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        if (!raw) return 'unknown';
        if (raw.includes('excellent') || raw.includes('outstanding')) return 'excellent';
        if (raw.includes('good') || raw.includes('very_good')) return 'good';
        if (raw.includes('partial') || raw.includes('medium') || raw.includes('fair')) return 'partial';
        if (raw.includes('dont_understand') || raw.includes("don't_understand") || raw.includes('poor')) return 'dont_understand';
        return 'unknown';
      };

      const summarizeFeedbackEntries = (entries) => {
        const safeEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
        const responseCount = safeEntries.length;
        const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const understandingCounts = {
          excellent: 0,
          good: 0,
          partial: 0,
          dont_understand: 0,
          unknown: 0,
        };

        let ratingTotal = 0;
        safeEntries.forEach((entry) => {
          const rating = Number(entry?.teacherRating || 0);
          if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
            ratingCounts[rating] += 1;
            ratingTotal += rating;
          }

          const understandingKey = normalizeUnderstandingLevel(entry?.understandingLevel, entry?.understandingLabel);
          understandingCounts[understandingKey] = (understandingCounts[understandingKey] || 0) + 1;
        });

        const dominantUnderstandingKey = Object.entries(understandingCounts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

        const dominantUnderstandingLabel = {
          excellent: 'Excellent',
          good: 'Good',
          partial: 'Partially understood',
          dont_understand: "Don't understand",
          unknown: 'No signal',
        }[dominantUnderstandingKey] || 'No signal';

        return {
          responseCount,
          averageRating: responseCount ? Number((ratingTotal / responseCount).toFixed(1)) : 0,
          ratingCounts,
          understandingCounts,
          dominantUnderstandingKey,
          dominantUnderstandingLabel,
        };
      };

      const parseLessonFeedbackPointer = (rawKey, fallbackCourseId = '') => {
        const pointer = String(rawKey || '').trim();
        if (!pointer) {
          return {
            courseId: String(fallbackCourseId || '').trim(),
            semesterKey: '',
            monthKey: '',
            weekKey: '',
            dateKey: '',
            topic: '',
          };
        }

        const parts = pointer.split('__');
        const [courseIdPart, semesterKey = '', monthKey = '', weekKey = '', dateKey = '', ...topicParts] = parts;
        const hasStructuredPointer = parts.length >= 6;
        const resolvedCourseId = String(hasStructuredPointer ? (courseIdPart || fallbackCourseId || '') : (fallbackCourseId || courseIdPart || '')).trim();
        let topic = topicParts.join('__');

        if (hasStructuredPointer && topic) {
          try {
            topic = decodeURIComponent(topic);
          } catch {
            topic = topic.replace(/%20/g, ' ');
          }
        }

        return {
          courseId: resolvedCourseId,
          semesterKey: hasStructuredPointer ? semesterKey : '',
          monthKey: hasStructuredPointer ? monthKey : '',
          weekKey: hasStructuredPointer ? weekKey : '',
          dateKey: hasStructuredPointer ? dateKey : '',
          topic: hasStructuredPointer ? topic : '',
        };
      };

      const isFeedbackEntryRecord = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        return [
          value.teacherRating,
          value.understandingLevel,
          value.understandingLabel,
          value.teacherId,
          value.courseId,
        ].some((field) => field !== undefined && field !== null && String(field).trim() !== '');
      };

      const collectLessonFeedbackEntries = (root) => {
        const collected = [];

        const pushEntry = (studentId, entry, lessonKey = '', fallbackCourseId = '') => {
          if (!isFeedbackEntryRecord(entry)) return;
          const pointerParts = parseLessonFeedbackPointer(lessonKey, entry?.courseId || fallbackCourseId);
          collected.push({
            ...entry,
            ...pointerParts,
            courseId: String(entry?.courseId || pointerParts.courseId || fallbackCourseId || '').trim(),
            lessonKey: String(lessonKey || '').trim(),
            studentId: String(studentId || '').trim(),
          });
        };

        Object.entries(root || {}).forEach(([studentId, studentNode]) => {
          if (!studentNode || typeof studentNode !== 'object') return;

          Object.entries(studentNode).forEach(([firstKey, firstValue]) => {
            if (!firstValue || typeof firstValue !== 'object') return;

            if (isFeedbackEntryRecord(firstValue)) {
              pushEntry(studentId, firstValue, firstKey, firstValue?.courseId || '');
              return;
            }

            Object.entries(firstValue).forEach(([secondKey, secondValue]) => {
              if (!secondValue || typeof secondValue !== 'object') return;
              pushEntry(studentId, secondValue, secondKey, firstKey);
            });
          });
        });

        return collected;
      };

      const pickAcademicYearKey = (obj, preferred = null) => {
        if (!obj || typeof obj !== 'object') return null;
        const keys = Object.keys(obj);
        if (!keys.length) return null;
        if (preferred && obj[preferred]) return preferred;
        // RTDB keys cannot contain '/', so try common variants
        if (preferred) {
          const variants = [
            preferred,
            preferred.replaceAll('/', '_'),
            preferred.replaceAll('/', '-'),
            preferred.replaceAll('/', ''),
          ];
          for (const v of variants) {
            if (obj[v]) return v;
          }
        }
        // heuristic: choose lexicographically latest
        return keys.sort().slice(-1)[0];
      };

      const parsePreferredAcademicYear = (preferred) => {
        const s = String(preferred || '').trim();
        const m = s.match(/^(\d{4})\s*\/\s*(\d{2,4})$/);
        if (!m) return null;
        const yearKey = m[1];
        let termKey = m[2];
        // store as 2-digit if given as 4-digit (e.g., 2026 -> 26)
        if (termKey.length === 4) termKey = termKey.slice(2);
        return { yearKey, termKey };
      };

      const resolveAcademicYearNode = (root, preferred) => {
        if (!root || typeof root !== 'object') return { node: {}, path: [] };

        // 1) direct key match (e.g., "2025_26" or "202526")
        const directKey = pickAcademicYearKey(root, preferred);
        if (directKey && root[directKey] && typeof root[directKey] === 'object') {
          const directNode = root[directKey];
          if (directNode.courses && typeof directNode.courses === 'object') return { node: directNode, path: [directKey] };
        }

        // 2) nested structure: root["2025"]["26"].courses
        const parsed = parsePreferredAcademicYear(preferred);
        if (parsed && root[parsed.yearKey] && typeof root[parsed.yearKey] === 'object') {
          const yearLevel = root[parsed.yearKey];
          if (yearLevel[parsed.termKey] && typeof yearLevel[parsed.termKey] === 'object') {
            const nestedNode = yearLevel[parsed.termKey];
            if (nestedNode.courses && typeof nestedNode.courses === 'object') return { node: nestedNode, path: [parsed.yearKey, parsed.termKey] };
          }
          // try any child that contains courses
          for (const subKey of Object.keys(yearLevel || {})) {
            const nestedNode = yearLevel?.[subKey];
            if (nestedNode && typeof nestedNode === 'object' && nestedNode.courses && typeof nestedNode.courses === 'object') {
              return { node: nestedNode, path: [parsed.yearKey, subKey] };
            }
          }
        }

        // 3) heuristic: find first node in root (or its first child) that has courses
        for (const k of Object.keys(root || {})) {
          const v = root?.[k];
          if (v && typeof v === 'object') {
            if (v.courses && typeof v.courses === 'object') return { node: v, path: [k] };
            for (const sk of Object.keys(v || {})) {
              const vv = v?.[sk];
              if (vv && typeof vv === 'object' && vv.courses && typeof vv.courses === 'object') return { node: vv, path: [k, sk] };
            }
          }
        }

        return { node: {}, path: [] };
      };

      // Like resolveAcademicYearNode, but does NOT require a `.courses` child.
      // Used for nodes like LessonPlanSubmissions where the year node directly contains courseIds.
      const resolveAcademicYearNodeAny = (root, preferred) => {
        if (!root || typeof root !== 'object') return { node: {}, path: [] };

        // 1) nested structure: root["2025"]["26"] (matches the provided LessonPlanSubmissions schema)
        const parsed = parsePreferredAcademicYear(preferred);
        if (parsed && root[parsed.yearKey] && typeof root[parsed.yearKey] === 'object') {
          const yearLevel = root[parsed.yearKey];
          if (yearLevel[parsed.termKey] && typeof yearLevel[parsed.termKey] === 'object') {
            return { node: yearLevel[parsed.termKey], path: [parsed.yearKey, parsed.termKey] };
          }
          // fallback to any child node
          for (const subKey of Object.keys(yearLevel || {})) {
            const nestedNode = yearLevel?.[subKey];
            if (nestedNode && typeof nestedNode === 'object') {
              return { node: nestedNode, path: [parsed.yearKey, subKey] };
            }
          }
        }

        // 2) direct key match (e.g., "2025_26" or "202526").
        // IMPORTANT: avoid heuristically picking the latest key when preferred doesn't match,
        // otherwise we can stop at the year container (e.g., "2025") and miss the term node ("26").
        if (preferred) {
          const variants = [
            preferred,
            String(preferred).replaceAll('/', '_'),
            String(preferred).replaceAll('/', '-'),
            String(preferred).replaceAll('/', ''),
          ];
          const directKey = variants.find((k) => root[k] && typeof root[k] === 'object');
          if (directKey) return { node: root[directKey], path: [directKey] };
        }

        // 3) if preferred was not found, choose the latest top-level key as year node
        // (new structure commonly uses keys like 2027_2028)
        const topLevelKeys = Object.keys(root || {});
        if (topLevelKeys.length) {
          const latestKey = topLevelKeys.sort().slice(-1)[0];
          const latestNode = root?.[latestKey];
          if (latestNode && typeof latestNode === 'object') {
            return { node: latestNode, path: [latestKey] };
          }
        }

        // 4) heuristic: pick first object-ish node
        for (const k of Object.keys(root || {})) {
          const v = root?.[k];
          if (v && typeof v === 'object') {
            // If it looks like a year container, try one level down
            for (const sk of Object.keys(v || {})) {
              const vv = v?.[sk];
              if (vv && typeof vv === 'object') return { node: vv, path: [k, sk] };
            }
            return { node: v, path: [k] };
          }
        }

        return { node: {}, path: [] };
      };

      const isLikelyCourseEntry = (entryKey, entryValue) => {
        if (!entryValue || typeof entryValue !== 'object') return false;
        const key = String(entryKey || '').trim();
        if (key.startsWith('course_')) return true;
        if (entryValue.weeks || entryValue.annual || entryValue.dailyLogs || entryValue.submissions) return true;
        return Object.keys(entryValue || {}).some((childKey) => String(childKey || '').startsWith('week_'));
      };

      const isCourseCollectionNode = (node) => {
        if (!node || typeof node !== 'object') return false;
        return Object.entries(node).some(([entryKey, entryValue]) => isLikelyCourseEntry(entryKey, entryValue));
      };

      const resolvePlanCourseCollection = (root, preferred) => {
        if (!root || typeof root !== 'object') return {};

        if (root.courses && isCourseCollectionNode(root.courses)) {
          return root.courses;
        }

        if (isCourseCollectionNode(root)) {
          return root;
        }

        const resolved = resolveAcademicYearNode(root, preferred);
        if (resolved?.node?.courses && isCourseCollectionNode(resolved.node.courses)) {
          return resolved.node.courses;
        }
        if (resolved?.node && isCourseCollectionNode(resolved.node)) {
          return resolved.node;
        }

        const resolvedAny = resolveAcademicYearNodeAny(root, preferred);
        if (resolvedAny?.node?.courses && isCourseCollectionNode(resolvedAny.node.courses)) {
          return resolvedAny.node.courses;
        }
        if (resolvedAny?.node && isCourseCollectionNode(resolvedAny.node)) {
          return resolvedAny.node;
        }

        for (const value of Object.values(root || {})) {
          if (!value || typeof value !== 'object') continue;
          if (value.courses && isCourseCollectionNode(value.courses)) {
            return value.courses;
          }
          if (isCourseCollectionNode(value)) {
            return value;
          }
        }

        return {};
      };

      const ALL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const inferMonthFromWeekDays = (weekDays) => {
        const d = (weekDays || []).find((x) => normalizeISODate(x?.date));
        const iso = normalizeISODate(d?.date);
        if (!iso) return '';
        const dt = new Date(`${iso}T00:00:00`);
        if (Number.isNaN(dt.getTime())) return '';
        return ALL_MONTHS[dt.getMonth()] || '';
      };

      const schoolInfo = await readSchoolNode("schoolInfo");
      const currentAcademicYear = String(schoolInfo?.currentAcademicYear || '').trim();
      const preferredAcademicYear = currentAcademicYear || '2025/26';

      // Load teacher lesson-plan root from both normalized and legacy structures.
      // IMPORTANT: keys may be teacherId (Teachers node key) or userId (legacy).
      const candidatePlanKeys = Array.from(new Set([
        String(teacherId || '').trim(),
        String(teacherUserId || '').trim(),
      ].filter(Boolean)));

      const candidatePlanRoots = [];
      const candidateDailyLogRoots = [];
      for (const k of candidatePlanKeys) {
        // eslint-disable-next-line no-await-in-loop
        const results = await Promise.all([
          axios.get(`${SCHOOL_DB_ROOT}/schoolLessonPlan/${encodeURIComponent(k)}.json`).catch(() => ({ data: null })),
          axios.get(`${RTDB_BASE}/schoolLessonPlan/${encodeURIComponent(k)}.json`).catch(() => ({ data: null })),
          axios.get(`${SCHOOL_DB_ROOT}/LessonPlans/TeachersLessonPlans/${encodeURIComponent(k)}.json`).catch(() => ({ data: null })),
          axios.get(`${RTDB_BASE}/LessonPlans/TeachersLessonPlans/${encodeURIComponent(k)}.json`).catch(() => ({ data: null })),
          axios.get(`${SCHOOL_DB_ROOT}/LessonPlans/LessonDailyLogs/${encodeURIComponent(k)}.json`).catch(() => ({ data: null })),
          axios.get(`${RTDB_BASE}/LessonPlans/LessonDailyLogs/${encodeURIComponent(k)}.json`).catch(() => ({ data: null })),
          axios.get(`${SCHOOL_DB_ROOT}/LessonPlans/${encodeURIComponent(k)}.json`).catch(() => ({ data: null })),
          axios.get(`${RTDB_BASE}/LessonPlans/${encodeURIComponent(k)}.json`).catch(() => ({ data: null })),
        ]);

        results.forEach((res, index) => {
          if (res && res.data && typeof res.data === 'object' && Object.keys(res.data).length) {
            if (index === 4 || index === 5) {
              candidateDailyLogRoots.push(res.data);
            } else {
              candidatePlanRoots.push(res.data);
            }
          }
        });
      }

      let teacherPlansRoot = {};
      for (const rootCandidate of candidatePlanRoots) {
        const coursesCandidate = resolvePlanCourseCollection(rootCandidate, preferredAcademicYear);
        if (coursesCandidate && typeof coursesCandidate === 'object' && Object.keys(coursesCandidate).length) {
          teacherPlansRoot = rootCandidate;
          break;
        }
      }
      if (!Object.keys(teacherPlansRoot).length && candidatePlanRoots.length) {
        teacherPlansRoot = candidatePlanRoots[0] || {};
      }

      const coursesNode = resolvePlanCourseCollection(teacherPlansRoot, preferredAcademicYear);
      const dailyLogsRoot = candidateDailyLogRoots.find((rootCandidate) => {
        const resolved = resolvePlanCourseCollection(rootCandidate, preferredAcademicYear);
        return resolved && typeof resolved === 'object' && Object.keys(resolved).length > 0;
      }) || candidateDailyLogRoots[0] || {};
      const dailyLogsCourseNode = resolvePlanCourseCollection(dailyLogsRoot, preferredAcademicYear);

      // Submissions are keyed by teacherId in LessonPlanSubmissions (per provided schema)
      const teacherSubmissionId = String(teacherId || teacherUserId || '').trim();

      const feedbackRoots = [];
      const feedbackResults = await Promise.all([
        axios.get(`${SCHOOL_DB_ROOT}/LessonPlans/StudentWhatLearn.json`).catch(() => ({ data: null })),
        axios.get(`${RTDB_BASE}/LessonPlans/StudentWhatLearn.json`).catch(() => ({ data: null })),
        axios.get(`${SCHOOL_DB_ROOT}/StudentWhatLearn.json`).catch(() => ({ data: null })),
        axios.get(`${RTDB_BASE}/StudentWhatLearn.json`).catch(() => ({ data: null })),
      ]);

      feedbackResults.forEach((res) => {
        if (res && res.data && typeof res.data === 'object' && Object.keys(res.data).length) {
          feedbackRoots.push(res.data);
        }
      });

      const feedbackBucketsByLessonKey = {};
      const seenFeedbackEntries = new Set();

      feedbackRoots.forEach((feedbackRoot) => {
        collectLessonFeedbackEntries(feedbackRoot).forEach((entry) => {
          const entryTeacherId = String(entry?.teacherId || '').trim();
          if (teacherSubmissionId && entryTeacherId && entryTeacherId !== teacherSubmissionId) return;

          const feedbackKey = buildLessonFeedbackKey({
            courseId: entry?.courseId,
            semesterKey: entry?.normalizedSemesterKey || entry?.semesterKey,
            monthKey: entry?.monthKey,
            weekKey: entry?.weekKey,
            dateKey: entry?.dateKey,
            topic: entry?.topic,
          });

          if (!feedbackKey.replace(/:/g, '').trim()) return;

          const dedupeKey = [
            String(entry?.studentId || '').trim(),
            String(entry?.lessonKey || '').trim(),
            String(entry?.courseId || '').trim(),
            String(entry?.teacherId || '').trim(),
            String(entry?.createdAt || '').trim(),
            String(entry?.updatedAt || '').trim(),
            String(entry?.teacherRating || '').trim(),
            String(entry?.understandingLevel || entry?.understandingLabel || '').trim(),
          ].join('::');

          if (seenFeedbackEntries.has(dedupeKey)) return;
          seenFeedbackEntries.add(dedupeKey);

          if (!feedbackBucketsByLessonKey[feedbackKey]) {
            feedbackBucketsByLessonKey[feedbackKey] = [];
          }
          feedbackBucketsByLessonKey[feedbackKey].push(entry);
        });
      });

      const feedbackSummaryByLessonKey = Object.entries(feedbackBucketsByLessonKey).reduce((acc, [lessonKey, entries]) => {
        acc[lessonKey] = summarizeFeedbackEntries(entries);
        return acc;
      }, {});

      // Load submissions (optional, for status)
      // Support both node names: LessonPlanSubmissions (legacy) and LessonPlanSubmission (current)
      // Support both teacher key styles: selectedTeacher.userId and selectedTeacher.teacherId
      let submittedKeySet = new Set();
      const submittedEntriesByKey = {};
      try {
        const candidateTeacherKeys = Array.from(new Set([
          String(teacherUserId || '').trim(),
          String(selectedTeacher?.teacherId || '').trim(),
        ].filter(Boolean)));

        const submissionRoots = [];

        for (const tKey of candidateTeacherKeys) {
          const urls = [
            `${SCHOOL_DB_ROOT}/LessonPlanSubmissions/${encodeURIComponent(tKey)}.json`,
            `${SCHOOL_DB_ROOT}/LessonPlanSubmission/${encodeURIComponent(tKey)}.json`,
            `${SCHOOL_DB_ROOT}/LessonPlans/LessonSubmissions/${encodeURIComponent(tKey)}.json`,
            `${RTDB_BASE}/LessonPlanSubmissions/${encodeURIComponent(tKey)}.json`,
            `${RTDB_BASE}/LessonPlanSubmission/${encodeURIComponent(tKey)}.json`,
            `${RTDB_BASE}/LessonPlans/LessonSubmissions/${encodeURIComponent(tKey)}.json`,
          ];

          const results = await Promise.all(
            urls.map((u) => axios.get(u).catch(() => ({ data: null })))
          );

          results.forEach((r) => {
            if (r && r.data && typeof r.data === 'object') submissionRoots.push(r.data);
          });
        }

        submissionRoots.forEach((submissionsRoot) => {
          const submissionsCourseNode = resolvePlanCourseCollection(submissionsRoot, preferredAcademicYear);
          Object.values(submissionsCourseNode || {}).forEach((courseSubNode) => {
            if (!courseSubNode || typeof courseSubNode !== 'object') return;
            Object.values(courseSubNode).forEach((sub) => {
              if (!sub) return;
              // Store canonicalized submission keys so matching is robust
              if (sub.key) {
                const raw = String(sub.key).trim();
                submittedKeySet.add(raw);
                const parts = raw.split('::');
                if (parts.length >= 4) {
                  const [tId, cId, wk, dn] = parts.map((p) => String(p ?? '').trim());
                  const canonical = canonicalSubmissionKey(tId, cId, wk, dn);
                  submittedKeySet.add(canonical);
                  const submittedAt = String(sub.submittedAt || sub.createdAt || sub.updatedAt || '').trim();
                  submittedEntriesByKey[canonical] = {
                    key: canonical,
                    teacherId: tId,
                    courseId: cId,
                    week: normalizeWeekForKey(wk),
                    dayName: dn,
                    submittedAt,
                    childKey: sub.childKey || '',
                  };
                }
              }

              // Also derive the canonical key from structured fields (preferred, matches your DB sample)
              if (sub.teacherId || sub.courseId || sub.week || sub.dayName) {
                const canonical = canonicalSubmissionKey(sub.teacherId, sub.courseId, sub.week, sub.dayName);
                submittedKeySet.add(canonical);
                const submittedAt = String(sub.submittedAt || sub.createdAt || sub.updatedAt || '').trim();
                submittedEntriesByKey[canonical] = {
                  key: canonical,
                  teacherId: String(sub.teacherId || '').trim() || teacherSubmissionId,
                  courseId: String(sub.courseId || '').trim(),
                  week: normalizeWeekForKey(sub.week),
                  dayName: normalizeDayForKey(sub.dayName),
                  submittedAt,
                  childKey: sub.childKey || '',
                };
              }

              // If childKey exists like teacherId__courseId__week__Monday, derive from it too
              if (sub.childKey) {
                const ck = String(sub.childKey).trim();
                const parts = ck.split('__').map((p) => String(p ?? '').trim());
                if (parts.length >= 4) {
                  const [tId, cId, wk, dn] = parts;
                  const canonical = canonicalSubmissionKey(tId, cId, wk, dn);
                  submittedKeySet.add(canonical);
                  const submittedAt = String(sub.submittedAt || sub.createdAt || sub.updatedAt || '').trim();
                  submittedEntriesByKey[canonical] = {
                    key: canonical,
                    teacherId: tId,
                    courseId: cId,
                    week: normalizeWeekForKey(wk),
                    dayName: normalizeDayForKey(dn),
                    submittedAt,
                    childKey: ck,
                  };
                }
              }
            });
          });

          Object.entries(submissionsCourseNode || {}).forEach(([courseId, semesterNode]) => {
            if (!semesterNode || typeof semesterNode !== 'object') return;
            Object.entries(semesterNode).forEach(([semesterKey, monthNode]) => {
              if (!monthNode || typeof monthNode !== 'object') return;
              Object.entries(monthNode).forEach(([monthKey, weekNode]) => {
                if (!weekNode || typeof weekNode !== 'object') return;
                Object.entries(weekNode).forEach(([weekKey, submissionWeek]) => {
                  if (!submissionWeek || typeof submissionWeek !== 'object') return;
                  const submittedDays = submissionWeek?.submittedDays && typeof submissionWeek.submittedDays === 'object'
                    ? submissionWeek.submittedDays
                    : {};
                  Object.entries(submittedDays).forEach(([dateKey, submittedValue]) => {
                    if (!submittedValue) return;
                    const logMeta = dailyLogsCourseNode?.[courseId]?.[semesterKey]?.[monthKey]?.[weekKey]?.[dateKey] || {};
                    const dayName = String(logMeta?.dayName || getDayNameFromIso(dateKey) || '').trim();
                    const canonical = canonicalSubmissionKey(teacherSubmissionId, courseId, weekKey, dayName || dateKey);
                    submittedKeySet.add(canonical);
                    submittedEntriesByKey[canonical] = {
                      key: canonical,
                      teacherId: teacherSubmissionId,
                      courseId: String(courseId || '').trim(),
                      week: normalizeWeekForKey(weekKey),
                      dayName: normalizeDayForKey(dayName || dateKey),
                      submittedAt: String(submissionWeek?.lastSubmittedAt || '').trim(),
                      date: normalizeISODate(dateKey),
                      childKey: `${teacherSubmissionId}__${courseId}__${weekKey}__${dayName || dateKey}`,
                    };
                  });
                });
              });
            });
          });
        });

        // Also collect submissions embedded in normalized plan structure:
        // schoolLessonPlan/<teacher>/<year>/courses/<courseId>/submissions/entries
        Object.entries(coursesNode || {}).forEach(([courseId, courseEntry]) => {
          const entriesNode = courseEntry?.submissions?.entries;
          if (!entriesNode) return;

          const entries = Array.isArray(entriesNode)
            ? entriesNode.filter(Boolean)
            : (typeof entriesNode === 'object' ? Object.values(entriesNode).filter(Boolean) : []);

          entries.forEach((sub) => {
            if (!sub || typeof sub !== 'object') return;

            const subTeacherId = String(sub.teacherId || teacherSubmissionId || '').trim();
            const subCourseId = String(sub.courseId || courseId || '').trim();
            const subWeek = normalizeWeekForKey(sub.week);
            const subDayName = normalizeDayForKey(sub.dayName || sub.day || '');
            const submittedAt = String(sub.submittedAt || sub.createdAt || sub.updatedAt || '').trim();

            if (subTeacherId && subCourseId && subWeek && subDayName) {
              const canonical = canonicalSubmissionKey(subTeacherId, subCourseId, subWeek, subDayName);
              submittedKeySet.add(canonical);
              submittedEntriesByKey[canonical] = {
                key: canonical,
                teacherId: subTeacherId,
                courseId: subCourseId,
                week: subWeek,
                dayName: subDayName,
                submittedAt,
                childKey: sub.childKey || '',
              };
            }

            if (sub.key) {
              const raw = String(sub.key).trim();
              submittedKeySet.add(raw);
              const parts = raw.split('::').map((p) => String(p ?? '').trim());
              if (parts.length >= 4) {
                const [tId, cId, wk, dn] = parts;
                const canonical = canonicalSubmissionKey(tId, cId, wk, dn);
                submittedKeySet.add(canonical);
                submittedEntriesByKey[canonical] = {
                  key: canonical,
                  teacherId: tId,
                  courseId: cId,
                  week: normalizeWeekForKey(wk),
                  dayName: normalizeDayForKey(dn),
                  submittedAt,
                  childKey: sub.childKey || '',
                };
              }
            }
          });
        });
      } catch (e) {
        // ignore missing submissions
        submittedKeySet = new Set();
      }

      setPlanSubmittedKeys(Array.from(submittedKeySet));
      const submittedEntries = Object.values(submittedEntriesByKey).sort((a, b) => {
        const aTs = a?.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bTs = b?.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        if (aTs !== bTs) return bTs - aTs;
        const aw = Number(String(a?.week ?? '').match(/\d+/)?.[0] ?? 0);
        const bw = Number(String(b?.week ?? '').match(/\d+/)?.[0] ?? 0);
        return bw - aw;
      });
      setPlanSubmittedEntries(submittedEntries);

      const extractWeeksFromCourse = (courseId, courseEntry, courseDailyLogsEntry) => {
        if (!courseEntry) return [];
        const out = [];

        const pushWeek = (weekObj, weekFallback = '') => {
          if (!weekObj) return;
          const weekNumber = weekObj.week || weekObj.weekNumber || weekFallback || '';
          const semesterKey = weekObj.semester || weekObj.semesterKey || '';
          const monthKey = (weekObj.month || weekObj.monthName || '').toString() || inferMonthFromWeekDays(weekObj.weekDays || weekObj.days || weekObj.daily || []);
          const normalizedSemesterKey = normalizeSemesterToken(semesterKey);
          const weekDays = normalizeWeekDays(weekObj.weekDays || weekObj.days || weekObj.daily || []).map((day) => {
            const feedbackKey = buildLessonFeedbackKey({
              courseId: courseId || weekObj.courseId,
              semesterKey: normalizedSemesterKey,
              monthKey,
              weekKey: weekNumber,
              dateKey: day?.date,
              topic: day?.topic,
            });

            return {
              ...day,
              semesterKey,
              normalizedSemesterKey,
              monthKey,
              weekKey: weekNumber,
              feedback: feedbackSummaryByLessonKey[feedbackKey] || null,
            };
          });
          if (!weekDays.length && !(weekObj.topic || weekObj.weekTopic)) return;
          out.push({
            month: monthKey,
            week: weekNumber,
            topic: weekObj.topic || weekObj.weekTopic || '',
            objective: weekObj.objective || weekObj.objectives || weekObj.weekObjective || weekObj.weekObjectives || '',
            method: weekObj.method || weekObj.teachingMethod || weekObj.methods || '',
            material: weekObj.material || weekObj.materials || weekObj.aids || weekObj.resources || '',
            assessment: weekObj.assessment || weekObj.evaluation || weekObj.assessments || '',
            weekDays,
            courseId: courseId || weekObj.courseId || null,
            semesterKey,
            normalizedSemesterKey,
          });
        };

        Object.entries(courseEntry || {}).forEach(([semesterKey, semesterNode]) => {
          if (!semesterNode || typeof semesterNode !== 'object') return;
          const monthsNode = semesterNode?.months && typeof semesterNode.months === 'object'
            ? semesterNode.months
            : semesterNode;

          Object.entries(monthsNode || {}).forEach(([monthKey, monthNode]) => {
            if (!monthNode || typeof monthNode !== 'object') return;
            const weeksNode = monthNode?.weeks && typeof monthNode.weeks === 'object'
              ? monthNode.weeks
              : monthNode;

            Object.entries(weeksNode || {}).forEach(([weekKey, weekObj]) => {
              if (!weekObj || typeof weekObj !== 'object') return;
              const dailyWeekNode = courseDailyLogsEntry?.[semesterKey]?.[monthKey]?.[weekKey] || {};
              const weekDays = normalizeWeekDays(dailyWeekNode);
              pushWeek(
                {
                  ...weekObj,
                  semester: semesterKey,
                  month: monthKey,
                  week: weekObj?.week || weekKey,
                  weekDays,
                },
                weekObj?.week || weekKey
              );
            });
          });
        });

        // annual rows
        if (courseEntry.annual && typeof courseEntry.annual === 'object') {
          const annualRows = Array.isArray(courseEntry.annual.annualRows)
            ? courseEntry.annual.annualRows
            : (Array.isArray(courseEntry.annual.rows) ? courseEntry.annual.rows : []);
          annualRows.forEach((r) => pushWeek(r, r.week || ''));
        }

        // normalized weeks node: courses/<courseId>/weeks/<weekKey>
        if (courseEntry.weeks && typeof courseEntry.weeks === 'object') {
          Object.entries(courseEntry.weeks).forEach(([wkKey, wkObj]) => {
            if (!wkObj || typeof wkObj !== 'object') return;
            const fallback = String(wkKey || '').replace(/^week_?/i, '');
            pushWeek(wkObj, wkObj.week || fallback);
          });
        }

        // week_{x}
        Object.keys(courseEntry).forEach((k) => {
          if (!k) return;
          if (k.startsWith('week_')) {
            const wk = courseEntry[k];
            const fallback = k.replace(/^week_/, '');
            if (wk && typeof wk === 'object') pushWeek(wk, wk.week || fallback);
          }
        });

        if (!out.length && courseDailyLogsEntry && typeof courseDailyLogsEntry === 'object') {
          Object.entries(courseDailyLogsEntry).forEach(([semesterKey, monthNode]) => {
            if (!monthNode || typeof monthNode !== 'object') return;
            Object.entries(monthNode).forEach(([monthKey, weekNode]) => {
              if (!weekNode || typeof weekNode !== 'object') return;
              Object.entries(weekNode).forEach(([weekKey, dailyWeekNode]) => {
                const weekDays = normalizeWeekDays(dailyWeekNode);
                if (!weekDays.length) return;
                pushWeek(
                  {
                    semester: semesterKey,
                    month: monthKey,
                    week: weekKey,
                    topic: weekDays[0]?.topic || '',
                    method: weekDays[0]?.method || '',
                    material: weekDays[0]?.aids || '',
                    assessment: weekDays[0]?.assessment || '',
                    weekDays,
                  },
                  weekKey
                );
              });
            });
          });
        }

        return out;
      };

      // Extract weeks across all courses
      let weeks = [];
      Object.entries(coursesNode || {}).forEach(([courseId, courseEntry]) => {
        weeks = weeks.concat(extractWeeksFromCourse(courseId, courseEntry, dailyLogsCourseNode?.[courseId] || {}));
      });

      // Dedupe loosely by courseId+week+month+topic
      const seen = new Set();
      weeks = weeks.filter((w) => {
        const key = `${String(w.courseId)}::${String(w.week)}::${String(w.month)}::${String(w.topic)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setPlanWeeks(weeks);

      // Per-course current week (the one containing today's weekday; fallback to first)
      const currentWeeks = [];
      const dailyPlans = [];
      const coursesGrouped = (weeks || []).reduce((acc, w) => {
        const cid = String(w.courseId || 'unknown');
        if (!acc[cid]) acc[cid] = [];
        acc[cid].push(w);
        return acc;
      }, {});

      Object.entries(coursesGrouped).forEach(([courseId, courseWeeks]) => {
        let idx = null;
        for (let i = 0; i < courseWeeks.length; i++) {
          if ((courseWeeks[i].weekDays || []).some(d => normalizeISODate(d.date) === todayISO)) {
            idx = i;
            break;
          }
          if ((courseWeeks[i].weekDays || []).some(d => (d.dayName || '').toString().toLowerCase() === todayName)) {
            idx = i;
            break;
          }
        }
        if (idx === null && courseWeeks.length) idx = 0;
        if (idx === null) return;

        const wk = courseWeeks[idx];
        currentWeeks.push(wk);

        (wk.weekDays || []).forEach((d) => {
          const scheduledIndex = getScheduledIndex(d.dayName || '');
          const submissionKey = canonicalSubmissionKey(teacherSubmissionId, courseId, wk.week || '', d.dayName || '');
          const submitted = submittedKeySet.has(submissionKey) || submittedKeySet.has(String(submissionKey).replace(/::([a-z]+)$/i, (m) => m));
          const status = submitted
            ? 'submitted'
            : (d.date && isPastISODate(d.date))
              ? 'missed'
              : (scheduledIndex !== null && scheduledIndex < todayIndex)
                ? 'missed'
                : 'pending';

          const matchesToday = (d.date && normalizeISODate(d.date) === todayISO)
            || scheduledIndex === todayIndex
            || (d.dayName || '').toString().toLowerCase() === todayName;

          if (matchesToday) {
            dailyPlans.push({
              ...d,
              courseId,
              week: wk.week || '',
              month: wk.month || '',
              status,
              key: submissionKey,
              scheduledIndex,
            });
          }
        });
      });

      // Dedupe daily plans (can match by both date and weekday)
      const seenDaily = new Set();
      const dedupedDailyPlans = dailyPlans.filter((p) => {
        const k = String(p.key || '');
        if (!k) return true;
        if (seenDaily.has(k)) return false;
        seenDaily.add(k);
        return true;
      });

      setPlanCurrentWeeks(currentWeeks);
      // Keep legacy state for compatibility (first current week)
      setPlanCurrentWeekIndex(currentWeeks.length ? 0 : null);
      setTeacherDailyPlans(dedupedDailyPlans);
    } catch (err) {
      console.error('Failed to fetch LessonPlans', err);
      setTeacherDailyPlans([]);
      setPlanWeeks([]);
      setPlanCurrentWeeks([]);
      setPlanCurrentWeekIndex(null);
      setPlanSubmittedKeys([]);
      setPlanSubmittedEntries([]);
      setPlanError('Failed to load lesson plans from database.');
    } finally {
      setPlanLoading(false);
    }
  };

  fetchLessonPlans();
}, [selectedTeacher, activeTab, planRefreshKey]);

// Fetch course labels for Plan tab dropdown (based on courseIds present in plan data)
useEffect(() => {
  if (!selectedTeacher || activeTab !== 'plan') return;

  const ids = Array.from(new Set([
    ...(Array.isArray(planWeeks) ? planWeeks.map((w) => String(w?.courseId || '')).filter(Boolean) : []),
    ...(Array.isArray(planCurrentWeeks) ? planCurrentWeeks.map((w) => String(w?.courseId || '')).filter(Boolean) : []),
  ]));

  if (!ids.length) {
    setPlanCourseLabelMap({});
    setPlanSelectedCourseId('all');
    return;
  }

  let cancelled = false;

  const run = async () => {
    try {
      const courses = await readSchoolNode("Courses");
      const map = {};
      ids.forEach((courseId) => {
        const c = courses?.[courseId];
        if (!c) return;
        const subject = (c.subject || '').toString().trim() || courseId;
        const grade = c.grade ? `Grade ${c.grade}` : '';
        const section = c.section ? `${c.section}` : '';
        const meta = [grade, section].filter(Boolean).join(' ');
        map[courseId] = meta ? `${subject} • ${meta}` : subject;
      });

      if (cancelled) return;
      setPlanCourseLabelMap(map);
      setPlanSelectedCourseId((prev) => {
        if (prev === 'all') return prev;
        return ids.includes(prev) ? prev : 'all';
      });
    } catch (e) {
      if (cancelled) return;
      setPlanCourseLabelMap({});
      setPlanSelectedCourseId('all');
    }
  };

  run();
  return () => { cancelled = true; };
}, [selectedTeacher, activeTab, planWeeks, planCurrentWeeks, RTDB_BASE]);


// helper: canonical chat key (sorted so it's consistent)
const getChatKey = (userA, userB) => {
  // ensure stable ordering: "lower_higher"
  return [userA, userB].sort().join("_");
};

const ensureChatRoot = async (chatKey, otherUserId) => {
  if (!adminUserId || !otherUserId) return;
  try {
    const res = await axios.get(`${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}.json`).catch(() => ({ data: null }));
    const existing = res.data || {};
    const participants = { ...(existing.participants || {}), [adminUserId]: true, [otherUserId]: true };

    const unread = { ...(existing.unread || {}) };
    if (unread[adminUserId] === undefined) unread[adminUserId] = 0;
    if (unread[otherUserId] === undefined) unread[otherUserId] = 0;

    const patch = { participants, unread };
    if (existing.typing === undefined) patch.typing = null;
    if (existing.lastMessage === undefined) patch.lastMessage = null;

    await axios.patch(`${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}.json`, patch).catch(() => {});
  } catch (e) {
    // ignore
  }
};

const maybeMarkLastMessageSeenForAdmin = async (chatKey) => {
  try {
    const res = await axios.get(`${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/lastMessage.json`).catch(() => ({ data: null }));
    const last = res.data;
    if (!last) return;
    if (String(last.receiverId) === String(adminUserId) && last.seen === false) {
      await axios.patch(`${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/lastMessage.json`, { seen: true }).catch(() => {});
    }
  } catch (e) {
    // ignore
  }
};

const clearTyping = (chatKey) => {
  axios.put(`${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/typing.json`, null).catch(() => {});
};

const handleTyping = (text) => {
  if (!adminUserId || !selectedTeacher?.userId) return;
  const chatKey = getChatKey(selectedTeacher.userId, adminUserId);

  if (!text || !text.trim()) {
    clearTyping(chatKey);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    return;
  }

  axios.put(`${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/typing.json`, { userId: adminUserId }).catch(() => {});

  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  typingTimeoutRef.current = setTimeout(() => {
    clearTyping(chatKey);
    typingTimeoutRef.current = null;
  }, 1800);
};

//----------------------Fetch unread messages for teachers--------------------

      useEffect(() => {
  if (!adminUserId || teachers.length === 0) return;

  const fetchUnreadTeachers = async () => {
    const unread = {};

    for (const t of teachers) {
      const chatKey = getChatKey(adminUserId, t.userId);
      try {
        const res = await axios.get(
          `${RTDB_BASE}/Chats/${chatKey}/messages.json`
        );

        const msgs = Object.values(res.data || {});
        const count = msgs.filter(
          m => m.receiverId === adminUserId && m.seen === false
        ).length;

        if (count > 0) unread[t.userId] = count;
      } catch (err) {
        console.error(err);
      }
    }

    setUnreadTeachers(unread);
  };

  fetchUnreadTeachers();
}, [teachers, adminUserId]);


// (Popup messages are handled by the realtime subscription below)

// ---------------- SEND POPUP MESSAGE ----------------
const sendPopupMessage = async () => {
  if (!popupInput.trim() || !selectedTeacher) return;

  const chatKey = getChatKey(selectedTeacher.userId, adminUserId);
  const timestamp = Date.now();

  const newMessage = {
    senderId: adminUserId,
    receiverId: selectedTeacher.userId,
    type: "text",
    text: popupInput,
    imageUrl: null,
    replyTo: null,
    seen: false,
    edited: false,
    deleted: false,
    timeStamp: timestamp
  };

  try {
    // Ensure chat root exists in the correct schema
    await ensureChatRoot(chatKey, selectedTeacher.userId);

    // 1) Push message to messages node (POST -> returns a name/key)
    const pushRes = await axios.post(
      `${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/messages.json`,
      newMessage
    );
    const generatedId = pushRes.data && pushRes.data.name;

    // 2) Update lastMessage with full schema
    const lastMessage = {
      messageId: generatedId || `${timestamp}`,
      senderId: newMessage.senderId,
      receiverId: newMessage.receiverId,
      text: newMessage.text || "",
      type: newMessage.type || "text",
      timeStamp: newMessage.timeStamp,
      seen: false,
      edited: false,
      deleted: false,
    };

    await axios.put(
      `${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/lastMessage.json`,
      lastMessage
    ).catch(() => {});

    // 3) Increment unread count for receiver (non-atomic: read -> increment -> write)
    try {
      const unreadRes = await axios.get(
        `${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/unread.json`
      );
      const unread = unreadRes.data || {};
      const prev = Number(unread[selectedTeacher.userId] || 0);
      const updated = { ...(unread || {}), [selectedTeacher.userId]: prev + 1, [adminUserId]: Number(unread[adminUserId] || 0) };
      await axios.put(
        `${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/unread.json`,
        updated
      );
    } catch (uErr) {
      // if unread node missing or failed, set it
      await axios.put(
        `${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/unread.json`,
        { [selectedTeacher.userId]: 1, [adminUserId]: 0 }
      );
    }

    // Clear typing after sending
    clearTyping(chatKey);

    // 4) Optimistically update UI
    setPopupMessages(prev => [
      ...prev,
      { messageId: generatedId || `${timestamp}`, ...newMessage, sender: "admin" }
    ]);
    setPopupInput("");
  } catch (err) {
    console.error("Failed to send message:", err);
  }
};


const getUnreadCount = async (userId) => {
  const chatKey = getChatKey(userId, adminUserId);

  try {
    const res = await axios.get(
      `${RTDB_BASE}/Chats/${chatKey}/messages.json`
    );

    const msgs = Object.values(res.data || {});
    return msgs.filter(m => m.receiverId === adminUserId && !m.seen).length;
  } catch (err) {
    console.error(err);
    return 0;
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


// ---------------- MARK MESSAGES AS SEEN ----------------


useEffect(() => {
  if (!teacherChatOpen || !selectedTeacher) return;

  const chatKey = getChatKey(selectedTeacher.userId, adminUserId);
  const messagesRef = ref(dbRT, `Chats/${chatKey}/messages`);

  const handleSnapshot = async (snapshot) => {
    const data = snapshot.val() || {};
    const list = Object.entries(data)
      .map(([id, msg]) => ({ messageId: id, ...msg }))
      .sort((a, b) => a.timeStamp - b.timeStamp);
    setPopupMessages(list);

    const updates = {};
    Object.entries(data).forEach(([msgId, msg]) => {
      if (msg && msg.receiverId === adminUserId && !msg.seen) {
        updates[`Chats/${chatKey}/messages/${msgId}/seen`] = true;
      }
    });

    if (Object.keys(updates).length > 0) {
      try {
        await axios.patch(`${RTDB_BASE}/.json`, updates);
        setUnreadTeachers(prev => ({ ...prev, [selectedTeacher.userId]: 0 }));
        await ensureChatRoot(chatKey, selectedTeacher.userId);
        await axios.put(`${RTDB_BASE}/Chats/${encodeURIComponent(chatKey)}/unread/${adminUserId}.json`, 0).catch(() => {});
        await maybeMarkLastMessageSeenForAdmin(chatKey);
      } catch (err) {
        console.error('Failed to patch seen updates:', err);
      }
    }
  };

  const unsubscribe = onValue(messagesRef, handleSnapshot);
  return () => unsubscribe();
}, [teacherChatOpen, selectedTeacher, adminUserId]);


useEffect(() => {
  if (!teacherChatOpen || !selectedTeacher) {
    setTypingUserId(null);
    return;
  }

  const chatKey = getChatKey(selectedTeacher.userId, adminUserId);
  const typingRef = ref(dbRT, `Chats/${chatKey}/typing`);

  const unsubscribe = onValue(typingRef, (snapshot) => {
    const data = snapshot.val();
    setTypingUserId(data?.userId || null);
  });

  return () => {
    unsubscribe();
    setTypingUserId(null);
  };
}, [teacherChatOpen, selectedTeacher, adminUserId]);



 const fetchPostNotifications = async () => {
  if (!adminId || !schoolCode) {
    setPostNotifications([]);
    return;
  }

  try {
    const postsNode = await fetchJson(
      `${SCHOOL_DB_ROOT}/Posts.json?orderBy=%22%24key%22&limitToLast=25`,
      {}
    );

    const notifications = Object.entries(postsNode || {})
      .map(([postId, postValue]) => ({ postId, ...postValue }))
      .filter((postValue) => postValue && typeof postValue === "object")
      .filter((postValue) => !postValue?.seenBy || !postValue.seenBy[admin.userId])
      .sort(
        (leftPost, rightPost) =>
          new Date(rightPost.time || rightPost.createdAt || 0).getTime() -
          new Date(leftPost.time || leftPost.createdAt || 0).getTime()
      )
      .slice(0, 25)
      .map((postValue) => ({
        ...postValue,
        notificationId:
          postValue?.notificationId ||
          postValue?.id ||
          `${postValue.postId}_${postValue.adminId || postValue.userId || "admin"}`,
        adminName: postValue?.adminName || "Admin",
        adminProfile: getSafeProfileImage(
          postValue?.adminProfile || postValue?.adminProfileImage || postValue?.profileImage,
          "/default-profile.png"
        ),
      }));

    setPostNotifications(notifications);
  } catch (err) {
    console.error("Post notification fetch failed", err);
    setPostNotifications([]);
  }
};


  useEffect(() => {
    if (!adminId || !schoolCode) return undefined;

    const runRefresh = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      fetchPostNotifications();
    };

    runRefresh();
    const interval = window.setInterval(runRefresh, NOTIFICATION_REFRESH_MS);
    window.addEventListener("focus", runRefresh);
    document.addEventListener("visibilitychange", runRefresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", runRefresh);
      document.removeEventListener("visibilitychange", runRefresh);
    };
  }, [adminId, schoolCode]);

 const handleNotificationClick = async (notification) => {
  try {
    await axios.put(
      `${SCHOOL_DB_ROOT}/Posts/${encodeURIComponent(notification.postId)}/seenBy/${encodeURIComponent(admin.userId)}.json`,
      true
    );
  } catch (err) {
    console.warn("Failed to mark post as seen:", err);
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


  const toggleDropdown = () => {
    setShowMessageDropdown((prev) => !prev);
  };

  useEffect(() => {
    const closeDropdown = (e) => {
      setShowMessageDropdown(false);
    };

    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    const fetchUnreadSenders = async () => {
      try {
        const response = await fetch("/api/unreadSenders");
        const data = await response.json();
        setUnreadSenders(data);
      } catch (err) {
        // ignore
      }
    };
    fetchUnreadSenders();
  }, []);

  const handleClick = () => {
    navigate("/all-chat");
  };

  // ---------------- FETCH UNREAD MESSAGES ----------------
  const fetchUnreadMessages = async () => {
    if (!admin.userId) return;

    try {
      const [usersData, teachersData, studentsData, parentsData, chatIndex] = await Promise.all([
        readSchoolNode("Users"),
        readSchoolNode("Teachers"),
        readSchoolNode("Students"),
        readSchoolNode("Parents"),
        fetchJson(`${RTDB_BASE}/Chats.json?shallow=true`, {}),
      ]);

      const usersById = Object.values(usersData || {}).reduce((acc, userRecord) => {
        const userId = String(userRecord?.userId || "").trim();
        if (!userId) return acc;
        acc[userId] = userRecord;
        return acc;
      }, {});

      const teachersByUserId = Object.values(teachersData || {}).reduce((acc, teacherRecord) => {
        const userId = String(teacherRecord?.userId || "").trim();
        if (userId) acc[userId] = teacherRecord;
        return acc;
      }, {});
      const studentsByUserId = Object.values(studentsData || {}).reduce((acc, studentRecord) => {
        const userId = String(studentRecord?.userId || studentRecord?.basicStudentInformation?.userId || "").trim();
        if (userId) acc[userId] = studentRecord;
        return acc;
      }, {});
      const parentsByUserId = Object.values(parentsData || {}).reduce((acc, parentRecord) => {
        const userId = String(parentRecord?.userId || "").trim();
        if (userId) acc[userId] = parentRecord;
        return acc;
      }, {});

      const candidateChatKeys = Object.keys(chatIndex || {}).filter((chatKey) =>
        parseChatParticipantIds(chatKey).includes(String(admin.userId || ""))
      );

      const unreadEntries = await mapInBatches(candidateChatKeys, 20, async (chatKey) => {
        const participantIds = parseChatParticipantIds(chatKey);
        const otherUserId = participantIds.find((participantId) => String(participantId || "") !== String(admin.userId || ""));
        if (!otherUserId) {
          return null;
        }

        const encodedChatKey = encodeURIComponent(chatKey);
        const [unreadValue, lastMessage] = await Promise.all([
          fetchJson(`${RTDB_BASE}/Chats/${encodedChatKey}/unread/${encodeURIComponent(admin.userId)}.json`, 0),
          fetchJson(`${RTDB_BASE}/Chats/${encodedChatKey}/lastMessage.json`, null),
        ]);

        const unreadCount = Number(unreadValue || 0);
        if (!Number.isFinite(unreadCount) || unreadCount <= 0) {
          return null;
        }

        return {
          otherUserId,
          unreadCount,
          lastMessageTime: Number(lastMessage?.timeStamp || 0),
        };
      });

      const appendUnreadSenders = (collection, type, fallbackNameResolver, fallbackImageResolver) => {
        Object.values(collection || {}).forEach((item) => {
          const userId = String(item?.userId || "").trim();
          if (!userId) return;

          const unread = Number(
            unreadEntries.find((entry) => String(entry?.otherUserId || "") === userId)?.unreadCount || 0
          );
          if (unread <= 0) return;

          const user = usersById[userId] || {};
          senders[userId] = {
            type,
            name: user?.name || fallbackNameResolver(item),
            profileImage: user?.profileImage || fallbackImageResolver(item),
            count: unread,
          };
        });
      };

      const senders = {};
      appendUnreadSenders(teachersData, "teacher", () => "Teacher", () => "/default-profile.png");
      appendUnreadSenders(studentsData, "student", (item) => item?.name || "Student", (item) => item?.profileImage || "/default-profile.png");
      appendUnreadSenders(parentsData, "parent", (item) => item?.name || "Parent", (item) => item?.profileImage || "/default-profile.png");

      unreadEntries
        .filter(Boolean)
        .sort((leftEntry, rightEntry) => Number(rightEntry.lastMessageTime || 0) - Number(leftEntry.lastMessageTime || 0))
        .forEach((entry) => {
          const userId = String(entry.otherUserId || "");
          if (!userId || senders[userId]) {
            return;
          }

          const userRecord = usersById[userId] || {};
          const teacherRecord = teachersByUserId[userId] || {};
          const studentRecord = studentsByUserId[userId] || {};
          const parentRecord = parentsByUserId[userId] || {};
          const matchedRecord = teacherRecord.userId ? teacherRecord : studentRecord.userId ? studentRecord : parentRecord.userId ? parentRecord : {};
          const senderType = teacherRecord.userId ? "teacher" : studentRecord.userId ? "student" : parentRecord.userId ? "parent" : "teacher";

          senders[userId] = {
            type: senderType,
            name: userRecord?.name || matchedRecord?.name || userRecord?.username || userId,
            profileImage: getSafeProfileImage(
              userRecord?.profileImage || matchedRecord?.profileImage || matchedRecord?.studentPhoto,
              "/default-profile.png"
            ),
            count: entry.unreadCount,
          };
        });

      setUnreadSenders(senders);
    } catch (err) {
      console.error("Unread fetch failed:", err);
    }
  };

  // ---------------- CLOSE DROPDOWN WHEN CLICKING OUTSIDE ----------------
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
    if (!admin.userId) return undefined;

    const runRefresh = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      fetchUnreadMessages();
    };

    runRefresh();
    const interval = window.setInterval(runRefresh, NOTIFICATION_REFRESH_MS);
    window.addEventListener("focus", runRefresh);
    document.addEventListener("visibilitychange", runRefresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", runRefresh);
      document.removeEventListener("visibilitychange", runRefresh);
    };
  }, [admin.userId]);

  const markMessagesAsSeen = async (userId) => {
    const key1 = `${admin.userId}_${userId}`;
    const key2 = `${userId}_${admin.userId}`;

    const [r1, r2] = await Promise.all([
      axios.get(
        `${RTDB_BASE}/Chats/${key1}/messages.json`
      ),
      axios.get(
        `${RTDB_BASE}/Chats/${key2}/messages.json`
      ),
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
        `${RTDB_BASE}/.json`,
        updates
      );
    }
  };

  // badge counts (match MyPosts UI)
  const messageCount = Object.values(unreadSenders || {}).reduce((acc, s) => acc + (s.count || 0), 0);
  const totalNotifications = (postNotifications?.length || 0) + messageCount;














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

        {/* ---------------- MAIN CONTENT ---------------- */}
        <div
          className="main-content google-main"
          style={{
            flex: "1 1 0",
            minWidth: 0,
            maxWidth: "none",
            margin: "0",
            boxSizing: "border-box",
            alignSelf: "flex-start",
            minHeight: "calc(100vh - 24px)",
            overflowY: "visible",
            overflowX: "hidden",
            position: "relative",
            scrollbarWidth: "thin",
            scrollbarColor: "transparent transparent",
            padding: `0 ${rightSidebarOffset}px 0 2px`,
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
                  <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.01em" }}>Teachers</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)", maxWidth: 620, lineHeight: 1.5 }}>
                    Manage faculty, schedules, lesson plans, and communication from the same premium admin workspace used across the rest of the platform.
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, position: "relative", zIndex: 1 }}>
                <div style={{ padding: "7px 12px", borderRadius: 999, background: "color-mix(in srgb, var(--surface-panel) 72%, white)", border: "1px solid var(--border-soft)", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
                  Total: {filteredTeachers.length}
                </div>
                <div style={{ padding: "7px 12px", borderRadius: 999, background: "color-mix(in srgb, var(--surface-panel) 72%, white)", border: "1px solid var(--border-soft)", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
                  {selectedGrade === "All" ? "All Grades" : selectedGrade === "Deactive" ? "Deactivated" : selectedGrade === "Unassigned" ? "Unassigned" : `Grade ${selectedGrade}`}
                </div>
                <button
                  type="button"
                  onClick={handleRefreshTeachers}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 999,
                    background: "color-mix(in srgb, var(--surface-panel) 72%, white)",
                    border: "1px solid var(--border-soft)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>

          {/* Search */}
          <div style={{ display: "flex", justifyContent: isNarrow ? "center" : "flex-start", marginBottom: "10px", paddingLeft: contentLeft }}>
            <div
              style={{
                width: contentWidth,
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
                placeholder="Search teachers by name, subject, or grade"
                style={{
                  border: "none",
                  outline: "none",
                  width: "100%",
                  fontSize: 13,
                  color: "var(--text-primary)",
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
              {(["All", "Deactive", "Unassigned", ...gradeOptions]).map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGrade(g)}
                  style={chipStyle(selectedGrade === g)}
                >
                  {g === "All" ? "All Teachers" : g === "Deactive" ? "Deactivated" : g === "Unassigned" ? "Unassigned" : `Grade ${g}`}
                </button>
              ))}
            </div>
          </div>

          {/* Teachers List */}
          {(!teachersInitialized || (loadingTeachers && displayedTeachers.length === 0)) ? (
            <p style={{ width: contentWidth, textAlign: "center", color: "var(--text-muted)", margin: "0 auto" }}>Loading teachers...</p>
          ) : displayedTeachers.length === 0 ? (
            <p style={{ width: contentWidth, textAlign: "center", color: "var(--text-muted)", margin: "0 auto" }}>No teachers found for this grade.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: isNarrow ? "center" : "flex-start", gap: "12px", paddingLeft: contentLeft }}>
              {displayedTeachers.map((t, i) => (
                <div
                  key={t.teacherId}
                  onClick={() => setSelectedTeacher(t)}
                  className="teacher-card"
                  style={listCardStyle(selectedTeacher?.teacherId === t.teacherId)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: isNarrow ? 8 : 12, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: isNarrow ? 30 : 36,
                        height: isNarrow ? 30 : 36,
                        borderRadius: isNarrow ? 8 : 10,
                        background: "var(--surface-accent)",
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: isNarrow ? 11 : 13,
                        flex: "0 0 auto",
                      }}
                    >
                      {i + 1}
                    </div>
                    <ProfileAvatar src={t.profileImage} name={t.name} alt={t.name} loading="lazy" style={{ width: isNarrow ? 40 : 48, height: isNarrow ? 40 : 48, borderRadius: "50%", border: selectedTeacher?.teacherId === t.teacherId ? "2px solid var(--accent)" : "2px solid var(--border-soft)", objectFit: "cover", transition: "all 0.3s ease", flex: "0 0 auto" }} />
                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: isNarrow ? "12px" : "14px", color: "var(--text-primary)", fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</h3>
                      {unreadTeachers[t.userId] > 0 && (
                        <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 12, padding: isNarrow ? '1px 5px' : '2px 6px', fontSize: isNarrow ? 10 : 11, fontWeight: 700, marginLeft: 8 }}>{unreadTeachers[t.userId]}</span>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: isNarrow ? "10px" : "11px", marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.subjectsUnique?.length > 0 ? t.subjectsUnique.join(', ') : 'No assigned courses'}
                    </div>
                    </div>
                  </div>

                  <div style={{ flex: "0 0 auto", marginLeft: isNarrow ? 4 : 8 }}>
                    <span
                      style={{
                        padding: isNarrow ? "4px 8px" : "5px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--border-soft)",
                        background: "color-mix(in srgb, var(--surface-panel) 78%, white)",
                        color: "var(--text-secondary)",
                        fontSize: isNarrow ? 9 : 10,
                        fontWeight: 800,
                        letterSpacing: "0.2px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.subjectsUnique?.length || 0} Subject{(t.subjectsUnique?.length || 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* ---------------- RIGHT SIDEBAR ---------------- */}
    <div
      className="teacher-info-sidebar"
      style={{
      width: isPortrait ? "100%" : "380px",
      position: "fixed",
      left: isPortrait ? 0 : "auto",
      right: isPortrait ? 0 : 14,
      top: isPortrait ? 0 : "calc(var(--topbar-height) + 18px)",
      height: isPortrait ? "100vh" : "calc(100vh - var(--topbar-height) - 36px)",
      maxHeight: isPortrait ? "100vh" : "calc(100vh - var(--topbar-height) - 36px)",
      background: "var(--surface-panel)",
      boxShadow: "var(--shadow-panel)",
      border: isPortrait ? "none" : "1px solid var(--border-soft)",
      borderRadius: isPortrait ? 0 : 18,
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      fontSize: "12px",
      overflowY: "auto",
      padding: "14px",
    }}
  >
    {/* CLOSE BUTTON */}
    {selectedTeacher && (
      <div style={{ position: "absolute", top: 12, left: 14, zIndex: 2000 }}>
        <button
          onClick={() => setSelectedTeacher(null)}
          aria-label="Close sidebar"
          style={{
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "color-mix(in srgb, var(--surface-panel) 22%, transparent)",
            border: "1px solid color-mix(in srgb, var(--surface-panel) 45%, transparent)",
            borderRadius: 999,
            backdropFilter: "blur(6px)",
            fontSize: 24,
            fontWeight: 700,
            color: "var(--on-accent)",
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
            boxShadow: "var(--shadow-soft)",
          }}
        >
          ×
        </button>
      </div>
    )}
    {/* ================= SCROLLABLE CONTENT ================= */}
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "0"
      }}
    >
      {/* ================= HEADER ================= */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--accent-strong), var(--accent))",
          margin: "-14px -14px 12px",
          padding: "16px 10px",
          textAlign: "center"
        }}
      >
        {selectedTeacher ? (
          <>
            <div
              style={{
                width: "70px",
                height: "70px",
                margin: "0 auto 10px",
                borderRadius: "50%",
                overflow: "hidden",
                border: "3px solid color-mix(in srgb, var(--surface-panel) 78%, transparent)"
              }}
            >
              <ProfileAvatar src={sidebarTeacherImage} name={sidebarTeacherName} alt={sidebarTeacherName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>

            <h2 style={{ margin: 0, color: "var(--on-accent)", fontSize: 14, fontWeight: 800 }}>
              {sidebarTeacherName}
            </h2>

            {sidebarTeacherEmail ? (
              <p style={{ margin: "4px 0", color: "color-mix(in srgb, var(--on-accent) 82%, transparent)", fontSize: "10px" }}>
                {sidebarTeacherEmail}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <div
              style={{
                width: "70px",
                height: "70px",
                margin: "0 auto 10px",
                borderRadius: "50%",
                border: "3px solid color-mix(in srgb, var(--surface-panel) 78%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--on-accent)",
                background: "color-mix(in srgb, var(--surface-panel) 16%, transparent)"
              }}
            >
              <FaChalkboardTeacher size={30} />
            </div>

            <h2 style={{ margin: 0, color: "var(--on-accent)", fontSize: 14, fontWeight: 800 }}>
              {sidebarTeacherName}
            </h2>

            <p style={{ margin: "4px 0", color: "color-mix(in srgb, var(--on-accent) 82%, transparent)", fontSize: "10px", fontWeight: 600 }}>
              Faculty Overview
            </p>
          </>
        )}
      </div>

      {/* ================= TABS ================= */}
      {selectedTeacher ? (
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border-soft)",
            marginBottom: "10px"
          }}
        >
          {["details", "schedule", "plan"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={tabButtonStyle(tab)}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
      ) : null}

      {!selectedTeacher ? (
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
            { label: "Total", value: teachers.length },
            { label: "Visible", value: filteredTeachers.length },
            { label: "Grade", value: selectedGrade === "All" ? "All" : selectedGrade === "Deactive" ? "Deactivated" : selectedGrade === "Unassigned" ? "Unassigned" : `G${selectedGrade}` },
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



     
{/* ================= DETAILS TAB ================= */}


{activeTab === "details" && selectedTeacher && (() => {
  const teacherIdLabel = String(selectedTeacher.teacherId || "").replace(/^[-]+/, "") || "N/A";
  const statusValue = selectedTeacherUser?.isActive === false ? "Inactive" : "Active";
  const statusTone = statusValue === "Active" ? "var(--success)" : "var(--danger)";
  const subjectList = Array.from(new Set((selectedTeacher?.subjectsUnique || []).map((item) => String(item || "").trim()).filter(Boolean)));
  const classMap = new Map();

  (selectedTeacher?.gradesSubjects || []).forEach((gs) => {
    const grade = String(gs?.grade ?? "").trim();
    const section = String(gs?.section ?? "").trim();
    const subject = String(gs?.subject ?? "").trim();
    if (!grade) return;
    const classKey = section ? `Grade ${grade}${section}` : `Grade ${grade}`;
    if (!classMap.has(classKey)) classMap.set(classKey, new Set());
    if (subject) classMap.get(classKey).add(subject);
  });

  const classEntries = Array.from(classMap.entries())
    .map(([label, subjects]) => ({
      label,
      subjects: Array.from(subjects).sort((a, b) => a.localeCompare(b)).join(", "),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  const contactRows = [
    { label: "Email", value: selectedTeacherUser?.email || selectedTeacher.email || "N/A" },
    { label: "Phone", value: selectedTeacherUser?.phone || selectedTeacher.phone || selectedTeacher.phoneNumber || "N/A" },
    { label: "Gender", value: selectedTeacherUser?.gender || selectedTeacher.gender || "N/A" },
  ];

  const sectionCardStyle = {
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    border: "1px solid var(--border-soft)",
    borderRadius: 16,
    padding: 14,
    boxShadow: "var(--shadow-soft)",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        margin: "0 auto",
        maxWidth: 380,
      }}
    >
      <div
        style={{
          ...rightDrawerCardStyle,
          borderRadius: 18,
          overflow: "hidden",
          background: "linear-gradient(180deg, #ffffff 0%, #f9fbff 100%)",
        }}
      >
        <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--border-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>Teacher profile</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>Clear profile, contact, and teaching assignment summary.</div>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: statusTone, fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: statusTone }} />
              {statusValue}
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "var(--surface-soft)", border: "1px solid var(--border-soft)" }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.45px" }}>Teacher ID</div>
              <div style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 900, marginTop: 4 }}>{teacherIdLabel}</div>
            </div>
            <button
              type="button"
              disabled={deactivating}
              style={{
                background: selectedTeacherUser?.isActive === false ? "var(--success)" : "var(--danger)",
                color: "#fff",
                border: "none",
                padding: "9px 14px",
                borderRadius: "12px",
                fontWeight: 800,
                fontSize: "11px",
                cursor: deactivating ? "not-allowed" : "pointer",
                opacity: deactivating ? 0.7 : 1,
                whiteSpace: "nowrap",
              }}
              onClick={handleToggleActiveTeacher}
            >
              {deactivating
                ? (selectedTeacherUser?.isActive === false ? "Activating..." : "Deactivating...")
                : (selectedTeacherUser?.isActive === false ? "Activate" : "Deactivate")}
            </button>
          </div>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {[
              { label: "Subjects", value: subjectList.length || 0 },
              { label: "Classes", value: classEntries.length || 0 },
              { label: "Status", value: statusValue },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: "var(--surface-soft)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 14,
                  padding: "12px 10px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{item.label}</div>
                <div style={{ fontSize: item.label === "Status" ? 13 : 22, fontWeight: 900, color: item.label === "Status" ? statusTone : "var(--text-primary)", marginTop: 6 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div style={sectionCardStyle}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.45px", marginBottom: 10 }}>Contact</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {contactRows.map((item) => (
                <div key={item.label} style={{ display: "grid", gridTemplateColumns: "86px 1fr", gap: 12, alignItems: "start", paddingBottom: 10, borderBottom: "1px solid color-mix(in srgb, var(--border-soft) 70%, white)" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.35px" }}>{item.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-word", lineHeight: 1.45 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={sectionCardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.45px" }}>Teaching load</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#005bc2" }}>{classEntries.length} class{classEntries.length === 1 ? "" : "es"}</div>
            </div>

            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: classEntries.length ? 12 : 0 }}>
              {subjectList.length ? subjectList.join(", ") : "No assigned subjects yet."}
            </div>

            {classEntries.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {classEntries.map((entry) => (
                  <div key={entry.label} style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 12, alignItems: "start", padding: "10px 12px", borderRadius: 14, background: "var(--surface-soft)", border: "1px solid var(--border-soft)" }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "var(--text-primary)" }}>{entry.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45 }}>{entry.subjects || "No subjects recorded"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px 12px", borderRadius: 14, background: "var(--surface-soft)", border: "1px dashed var(--border-soft)" }}>
                No class assignments yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
})()}

      
{/* ================= SCHEDULE TAB ================= */}
{/* ================= SCHEDULE TAB ================= */}
{activeTab === "schedule" && selectedTeacher && (
  <div style={{ padding: "8px", ...rightDrawerCardStyle }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
      <h4
        style={{
          fontSize: "12px",
          fontWeight: "800",
          color: "var(--text-primary)",
          letterSpacing: "0.1px",
          margin: 0
        }}
      >
        Weekly Teaching Schedule
      </h4>

      <button
        type="button"
        className="btn btn-sm"
        style={{
          background: "var(--accent-strong)",
          color: "#ffffff",
          border: "none",
          padding: "5px 8px",
          borderRadius: "10px",
          fontWeight: 800,
          fontSize: "9px",
          letterSpacing: "0.2px",
          boxShadow: "none",
          textTransform: "none"
        }}
        onClick={downloadTeacherTimetablePdf}
        disabled={!teacherSchedule || Object.keys(teacherSchedule).length === 0}
      >
        Download PDF
      </button>
    </div>

    {/* Empty State */}
    {Object.keys(teacherSchedule).length === 0 ? (
      <div
        style={{
          textAlign: "center",
          padding: "12px",
          borderRadius: "12px",
          background: "var(--surface-muted)",
          border: "1px solid var(--border-soft)",
          color: "var(--text-muted)",
          fontSize: "10px",
          boxShadow: "none"
        }}
      >
        No schedule assigned yet
      </div>
    ) : (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)", // TWO COLUMNS
          gap: "6px"
        }}
      >
        {weekOrder
          .filter(day => teacherSchedule[day])
          .map(day => {
            const periods = teacherSchedule[day];
            const isToday = currentDayName === day;

            return (
              <div
                key={day}
                style={{
                  borderRadius: "12px",
                  padding: "7px",
                  background: "var(--surface-panel)",
                  boxShadow: "var(--shadow-soft)",
                  border: isToday ? "1px solid var(--accent-strong)" : "1px solid var(--border-soft)"
                }}
              >
                {/* Day Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px"
                  }}
                >
                  <h5
                    style={{
                      fontSize: "12px",
                      fontWeight: "800",
                      color: "var(--text-primary)"
                    }}
                  >
                    {day}
                  </h5>

                  <span
                    style={{
                      fontSize: "10px",
                      padding: "4px 6px",
                      borderRadius: "999px",
                      background: "var(--surface-accent)",
                      color: "var(--text-secondary)",
                      fontWeight: "700"
                    }}
                  >
                    {Object.keys(periods).length} periods
                  </span>
                </div>

                {/* Periods */}
                {Object.entries(periods).map(([period, entries]) => {
                  const range = getPeriodRangeMinutes(period);
                  const isCurrentPeriod = isToday && range && currentMinutes >= range.start && currentMinutes < range.end;

                  return (
                  <div
                    key={period}
                    style={{
                      marginBottom: "6px",
                      borderRadius: "12px",
                      padding: "8px",
                      background: isCurrentPeriod ? "var(--surface-accent)" : "var(--surface-muted)",
                      border: isCurrentPeriod ? "1px solid var(--accent-strong)" : "1px solid var(--border-soft)"
                    }}
                  >
                    {/* Period Header */}
                    <div
                      style={{
                        fontSize: "9px",
                        fontWeight: "800",
                        color: "var(--text-primary)",
                        marginBottom: "4px"
                      }}
                    >
                      <span>{period}</span>
                      {isCurrentPeriod && (
                        <span
                          style={{
                            marginLeft: "8px",
                            fontSize: "8px",
                            padding: "1px 4px",
                            borderRadius: "999px",
                            background: "var(--accent-strong)",
                            color: "#ffffff",
                            fontWeight: "700"
                          }}
                        >
                          NOW
                        </span>
                      )}
                    </div>

                    {/* Subjects */}
                    {entries.map((e, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "4px 6px",
                          borderRadius: "8px",
                          background: "var(--surface-panel)",
                          marginBottom: "4px",
                          border: "1px solid var(--border-soft)",
                          boxShadow: "none",
                          fontSize: "10px"
                        }}
                      >
                        <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>
                          {e.subject}
                        </span>
                        <span
                          style={{
                            fontSize: "8px",
                            fontWeight: "500",
                            padding: "1px 4px",
                            borderRadius: "999px",
                            background: "var(--surface-accent)",
                            color: "var(--text-secondary)"
                          }}
                        >
                          {e.class}
                        </span>
                      </div>
                    ))}
                  </div>
                  );
                })}
              </div>
            );
          })}
      </div>
    )}
  </div>
)}




      {/* ================= PLAN TAB ================= */}
      {activeTab === "plan" && selectedTeacher && (() => {
        const teacherUserId = selectedTeacher?.userId;
        const teacherSubmissionId = String(selectedTeacher?.teacherId || teacherUserId || '').trim();
        const today = new Date();
        const todayISO = today.toISOString().slice(0, 10);
        const todayIndex = today.getDay();
        const todayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const currentMonthName = today.toLocaleDateString('en-US', { month: 'long' });
        const normalizeWeekForKey = (val) => {
          if (val === undefined || val === null) return '';
          const s = String(val).trim();
          if (!s) return '';
          const m = s.match(/\d+/);
          return m ? m[0] : s;
        };

        const normalizeDayForKey = (dayName) => String(dayName || '').trim().toLowerCase();

        const canonicalSubmissionKey = (teacherId, courseId, weekVal, dayName) => {
          const t = String(teacherId || '').trim();
          const c = String(courseId || '').trim();
          return `${t}::${c}::${normalizeWeekForKey(weekVal)}::${normalizeDayForKey(dayName)}`;
        };

        const submittedKeySet = new Set(
          (planSubmittedKeys || []).flatMap((k) => {
            const raw = String(k).trim();
            const parts = raw.split('::');
            if (parts.length >= 4) {
              const [tId, cId, wk, dn] = parts.map((p) => String(p ?? '').trim());
              return [raw, canonicalSubmissionKey(tId, cId, wk, dn)];
            }
            return [raw];
          })
        );

        const allCourseIds = Array.from(new Set([
          ...(Array.isArray(planWeeks) ? planWeeks.map((w) => String(w?.courseId || '')).filter(Boolean) : []),
          ...(Array.isArray(planCurrentWeeks) ? planCurrentWeeks.map((w) => String(w?.courseId || '')).filter(Boolean) : []),
          ...(Array.isArray(teacherDailyPlans) ? teacherDailyPlans.map((p) => String(p?.courseId || '')).filter(Boolean) : []),
        ]));

        const courseOptions = [
          { value: 'all', label: 'All Subjects' },
          ...allCourseIds.map((id) => ({
            value: id,
            label: planCourseLabelMap?.[id] || id,
          })),
        ];

        const selectedCourseLabel = planSelectedCourseId === 'all'
          ? 'All Subjects'
          : (planCourseLabelMap?.[planSelectedCourseId] || planSelectedCourseId);

        const visibleDailyPlans = planSelectedCourseId === 'all'
          ? (teacherDailyPlans || [])
          : (teacherDailyPlans || []).filter((p) => String(p?.courseId || '') === String(planSelectedCourseId));

        const visibleCurrentWeeks = planSelectedCourseId === 'all'
          ? (planCurrentWeeks || [])
          : (planCurrentWeeks || []).filter((w) => String(w?.courseId || '') === String(planSelectedCourseId));

        const visiblePlanWeeks = planSelectedCourseId === 'all'
          ? (planWeeks || [])
          : (planWeeks || []).filter((w) => String(w?.courseId || '') === String(planSelectedCourseId));

        const fetchedPlanRows = (visiblePlanWeeks || [])
          .slice()
          .sort((a, b) => {
            const aw = Number(String(a?.week ?? '').match(/\d+/)?.[0] ?? 0);
            const bw = Number(String(b?.week ?? '').match(/\d+/)?.[0] ?? 0);
            if (aw !== bw) return bw - aw;
            const am = String(a?.month || '').toLowerCase();
            const bm = String(b?.month || '').toLowerCase();
            return am.localeCompare(bm);
          })
          .slice(0, 8);

        const getScheduledIndex = (dayName) => {
          const lname = (dayName || '').toString().toLowerCase();
          return Object.prototype.hasOwnProperty.call(dayOrder, lname) ? dayOrder[lname] : null;
        };

        const buildSubmissionKeyCandidates = (courseId, weekVal, dayName, dayIdx = null) => {
          const teacherToken = teacherSubmissionId || 'anon';
          const courseToken = courseId || 'nocourse';
          const dayToken = String(dayName || dayIdx || '').trim();
          const raw = `${teacherToken}::${courseToken}::${weekVal || ''}::${dayToken}`;
          const canonical = canonicalSubmissionKey(teacherToken, courseToken, weekVal || '', dayToken);
          return Array.from(new Set([raw, canonical].filter(Boolean)));
        };

        const buildSubmissionKey = (courseId, weekVal, dayName, dayIdx = null) => {
          const candidates = buildSubmissionKeyCandidates(courseId, weekVal, dayName, dayIdx);
          return candidates[1] || candidates[0] || '';
        };

        const getDayStatus = (courseId, weekVal, day, dayIdx = null) => {
          const dayName = (day?.dayName || '').toString();
          const iso = (day?.date || '').toString().slice(0, 10);
          const scheduledIndex = getScheduledIndex(dayName);
          const candidateKeys = buildSubmissionKeyCandidates(courseId, weekVal, dayName, dayIdx);
          const matchedKey = candidateKeys.find((k) => submittedKeySet.has(k)) || buildSubmissionKey(courseId, weekVal, dayName, dayIdx);
          const submitted = candidateKeys.some((k) => submittedKeySet.has(k));
          if (submitted) return { status: 'submitted', key: matchedKey };

          // Prefer ISO date if present, otherwise fallback to weekday ordering
          if (iso && iso < todayISO) return { status: 'missed', key: matchedKey };
          if (scheduledIndex !== null && scheduledIndex < todayIndex) return { status: 'missed', key: matchedKey };
          return { status: 'pending', key: matchedKey };
        };

        const activeWeekBlock = (visibleCurrentWeeks || [])[0] || null;
        const activeWeekDays = activeWeekBlock?.weekDays || [];

        const weekStats = (() => {
          const stats = { submitted: 0, missed: 0, pending: 0, total: 0 };
          (activeWeekDays || []).forEach((d, di) => {
            const ds = getDayStatus(activeWeekBlock?.courseId, activeWeekBlock?.week, d, di);
            stats[ds.status] = (stats[ds.status] || 0) + 1;
            stats.total += 1;
          });
          return stats;
        })();

        const monthIndexFromLabel = (label) => {
          if (!label) return null;
          const raw = String(label).trim();
          if (!raw) return null;

          const digits = raw.replace(/[^0-9]/g, '');
          if (digits) {
            const m = parseInt(digits, 10);
            if (m >= 1 && m <= 12) return m - 1;
          }

          const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          const idx = monthNames.findIndex((m) => m.toLowerCase() === raw.toLowerCase());
          if (idx !== -1) return idx;

          const tryDt = new Date(`${raw} 1, 2026`);
          if (!Number.isNaN(tryDt.getTime())) return tryDt.getMonth();
          return null;
        };

        const monthlyGroups = (visiblePlanWeeks || []).reduce((acc, row) => {
          const monthKey = String(row?.month || '').trim() || 'Unspecified';
          if (!acc[monthKey]) acc[monthKey] = [];
          acc[monthKey].push(row);
          return acc;
        }, {});

        const currentMonthKey = (() => {
          const keys = Object.keys(monthlyGroups || {});
          if (!keys.length) return null;
          const nowIdx = new Date().getMonth();
          const exact = keys.find((k) => k.toLowerCase().trim() === currentMonthName.toLowerCase());
          if (exact) return exact;
          return keys.find((k) => monthIndexFromLabel(k) === nowIdx) || null;
        })();

        const currentMonthWeeks = currentMonthKey ? (monthlyGroups?.[currentMonthKey] || []) : [];

        const monthlyCount = currentMonthWeeks.length;

        const monthStats = (() => {
          const stats = { submitted: 0, missed: 0, pending: 0, total: 0, topics: [] };
          (currentMonthWeeks || []).forEach((w) => {
            if (w?.topic) stats.topics.push(w.topic);
            (w?.weekDays || []).forEach((d, di) => {
              const ds = getDayStatus(w?.courseId, w?.week, d, di);
              stats[ds.status] = (stats[ds.status] || 0) + 1;
              stats.total += 1;
              if (d?.topic) stats.topics.push(d.topic);
            });
          });
          // de-dupe topics
          stats.topics = Array.from(new Set(stats.topics.filter(Boolean)));
          return stats;
        })();

        const monthPct = monthStats.total ? Math.round((monthStats.submitted / monthStats.total) * 100) : 0;
        const weekCompletionRate = weekStats.total ? Math.round((weekStats.submitted / weekStats.total) * 100) : 0;

        const submittedByKeyLookup = (() => {
          const out = {};
          (planSubmittedEntries || []).forEach((entry) => {
            const key = String(entry?.key || '').trim();
            if (!key) return;
            out[key] = entry;
          });
          return out;
        })();

        const planMetaByKey = (() => {
          const out = {};
          (planWeeks || []).forEach((wk) => {
            const courseId = String(wk?.courseId || '').trim();
            (wk?.weekDays || []).forEach((d, di) => {
              const keys = buildSubmissionKeyCandidates(courseId, wk?.week, d?.dayName || '', di);
              keys.forEach((key) => {
                if (out[key]) return;
                out[key] = {
                  topic: d?.topic || wk?.topic || '',
                  method: d?.method || wk?.method || '',
                  aids: d?.aids || wk?.material || wk?.materials || wk?.aids || '',
                  assessment: d?.assessment || wk?.assessment || '',
                  date: d?.date || '',
                  month: wk?.month || '',
                };
              });
            });
          });
          return out;
        })();

        const monthIndexMap = {
          january: 1,
          february: 2,
          march: 3,
          april: 4,
          may: 5,
          june: 6,
          july: 7,
          august: 8,
          september: 9,
          october: 10,
          november: 11,
          december: 12,
        };

        const getMonthIndex = (m) => {
          const key = (m || '').toString().trim().toLowerCase();
          return monthIndexMap[key] || 999;
        };

        const annualWeeks = Array.isArray(visiblePlanWeeks) ? visiblePlanWeeks : [];
        const annualByMonth = annualWeeks.reduce((acc, w) => {
          const monthKey = (w?.month || '').toString().trim() || 'Other';
          if (!acc[monthKey]) acc[monthKey] = [];
          acc[monthKey].push(w);
          return acc;
        }, {});

        const annualMonthKeys = Object.keys(annualByMonth).sort((a, b) => {
          const ai = getMonthIndex(a);
          const bi = getMonthIndex(b);
          if (ai !== bi) return ai - bi;
          return a.localeCompare(b);
        });

        const getWeekSortValue = (w) => {
          const raw = w?.week;
          if (raw === undefined || raw === null) return 9999;
          const n = Number(raw);
          if (!Number.isNaN(n)) return n;
          const m = String(raw).match(/\d+/);
          return m ? Number(m[0]) : 9999;
        };

        const downloadAnnualExcel = () => {
          try {
            const normalizeText = (v) => {
              if (v === undefined || v === null) return '';
              if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean).join('; ');
              return String(v).trim();
            };

            const uniqJoin = (vals) => {
              const out = Array.from(new Set((vals || []).map((x) => normalizeText(x)).filter(Boolean)));
              return out.join('; ');
            };

            const escapeHtml = (s) => {
              return String(s ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            };

            const rows = [];
            annualMonthKeys.forEach((mKey) => {
              const monthWeeks = (annualByMonth[mKey] || []).slice().sort((a, b) => getWeekSortValue(a) - getWeekSortValue(b));
              monthWeeks.forEach((wk) => {
                const weekLabel = wk?.week ? `Week ${wk.week}` : '-';
                const days = Array.isArray(wk?.weekDays) ? wk.weekDays : [];

                const topic = normalizeText(wk?.topic) || uniqJoin(days.map((d) => d?.topic));
                const objective =
                  normalizeText(wk?.objective) ||
                  normalizeText(wk?.objectives) ||
                  uniqJoin(days.map((d) => d?.objective ?? d?.objectives));
                const method = normalizeText(wk?.method) || uniqJoin(days.map((d) => d?.method));
                const material =
                  normalizeText(wk?.material) ||
                  normalizeText(wk?.materials) ||
                  normalizeText(wk?.aids) ||
                  uniqJoin(days.map((d) => d?.material ?? d?.materials ?? d?.aids));
                const assessment = normalizeText(wk?.assessment) || uniqJoin(days.map((d) => d?.assessment));

                const agg = (() => {
                  const c = { submitted: 0, missed: 0, pending: 0, total: 0 };
                  (days || []).forEach((d) => {
                    const ds = getDayStatus(wk?.courseId, wk?.week, d);
                    c[ds.status] = (c[ds.status] || 0) + 1;
                    c.total += 1;
                  });
                  return c;
                })();

                const status = agg.missed > 0 ? 'missed' : (agg.submitted > 0 ? 'submitted' : 'pending');

                rows.push({
                  month: mKey,
                  week: weekLabel,
                  topic,
                  objective,
                  method,
                  material,
                  assessment,
                  status,
                });
              });
            });

            if (!rows.length) return;

            const teacherLabel = (selectedTeacher?.fullName || selectedTeacher?.name || selectedTeacher?.userId || 'teacher').toString();
            const safeTeacher = teacherLabel.replace(/[\\/:*?"<>|]/g, '_');
            const safeCourse = (selectedCourseLabel || 'all').toString().replace(/[\\/:*?"<>|]/g, '_');
            const dateStamp = new Date().toISOString().slice(0, 10);
            const filename = `Annual_Lesson_Plan_${safeTeacher}_${safeCourse}_${dateStamp}.xls`;

            const exportYear = '2025/26';

            const selectedLabel = (selectedCourseLabel || '').toString();
            const parsed = (() => {
              if (!selectedLabel || planSelectedCourseId === 'all') {
                return { subject: 'All Subjects', gradeSection: '' };
              }

              // Expected label format: "Subject • Grade X Section" (best-effort parsing)
              const parts = selectedLabel.split('•').map((s) => s.trim()).filter(Boolean);
              const subject = parts[0] || selectedLabel;
              const meta = parts[1] || '';
              if (!meta) return { subject, gradeSection: '' };

              const m = meta.match(/Grade\s*(\d+)\s*(.*)$/i);
              if (!m) return { subject, gradeSection: meta };
              const grade = m[1] ? `Grade ${m[1]}` : '';
              const section = (m[2] || '').trim();
              const gradeSection = [grade, section].filter(Boolean).join(' ');
              return { subject, gradeSection };
            })();

            const css = `
              table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 12pt; }
              th, td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
              th { background: #f1f5f9; font-weight: 700; }
            `;

            const header = ['Month', 'Week', 'Topic', 'Objective', 'Method', 'Material', 'Assessment'];
            const metaHtml = `
              <div style="font-family: Calibri, Arial, sans-serif; font-size: 12pt;">
                <div><strong>Teacher Name:</strong> ${escapeHtml(teacherLabel)}</div>
                <div><strong>Grade &amp; Section:</strong> ${escapeHtml(parsed.gradeSection || '-')}</div>
                <div><strong>Subject:</strong> ${escapeHtml(parsed.subject || selectedLabel || '-')}</div>
                <div><strong>Year:</strong> ${escapeHtml(exportYear)}</div>
              </div>
              <br />
            `;
            const tableHtml = `
              <table>
                <thead>
                  <tr>${header.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
                </thead>
                <tbody>
                  ${rows.map((r) => {
                    const bg = r.status === 'missed' ? '#FEE2E2' : (r.status === 'submitted' ? '#DCFCE7' : '#FFFFFF');
                    return (
                    `<tr style="background-color:${bg};">
                      <td>${escapeHtml(r.month)}</td>
                      <td>${escapeHtml(r.week)}</td>
                      <td>${escapeHtml(r.topic || '-') }</td>
                      <td>${escapeHtml(r.objective || '-') }</td>
                      <td>${escapeHtml(r.method || '-') }</td>
                      <td>${escapeHtml(r.material || '-') }</td>
                      <td>${escapeHtml(r.assessment || '-') }</td>
                    </tr>`
                    );
                  }).join('')}
                </tbody>
              </table>
            `;

            const html = `
              <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                  <meta charset="utf-8" />
                  <style>${css}</style>
                </head>
                <body>
                  ${metaHtml}
                  ${tableHtml}
                </body>
              </html>
            `;

            const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          } catch (e) {
            console.error('Failed to export annual plan', e);
          }
        };

        const renderPlanSidebarContent = () => {
          if (planSidebarTab === 'daily') {
            const submittedDailyPlans = (() => {
              const out = (planSubmittedEntries || [])
                .filter((entry) => {
                  if (planSelectedCourseId === 'all') return true;
                  return String(entry?.courseId || '') === String(planSelectedCourseId);
                })
                .map((entry) => {
                  const key = String(entry?.key || '').trim();
                  const meta = planMetaByKey[key] || {};
                  const fallbackDayName = String(entry?.dayName || '').trim();
                  const displayDay = fallbackDayName
                    ? `${fallbackDayName.charAt(0).toUpperCase()}${fallbackDayName.slice(1)}`
                    : '';
                  return {
                    key,
                    courseId: entry?.courseId || '',
                    week: entry?.week || '',
                    month: meta?.month || '',
                    dayName: displayDay || 'Submitted',
                    date: meta?.date || '',
                    topic: meta?.topic || '',
                    method: meta?.method || '',
                    aids: meta?.aids || '',
                    assessment: meta?.assessment || '',
                    submittedAt: entry?.submittedAt || '',
                    status: 'submitted',
                  };
                });

              // Prefer sorting by ISO date (desc), then week (desc)
              out.sort((a, b) => {
                const aSubmit = a?.submittedAt ? new Date(a.submittedAt).getTime() : 0;
                const bSubmit = b?.submittedAt ? new Date(b.submittedAt).getTime() : 0;
                if (aSubmit !== bSubmit) return bSubmit - aSubmit;
                const aISO = (a?.date || '').toString().slice(0, 10);
                const bISO = (b?.date || '').toString().slice(0, 10);
                if (aISO && bISO && aISO !== bISO) return bISO.localeCompare(aISO);
                const aw = Number(String(a?.week ?? '').match(/\d+/)?.[0] ?? 0);
                const bw = Number(String(b?.week ?? '').match(/\d+/)?.[0] ?? 0);
                return bw - aw;
              });

              return out;
            })();

            return (
              <div className="space-y-3" style={{ width: '100%', minWidth: 0 }}>
                <div style={{ background: 'var(--surface-panel)', borderRadius: 14, padding: 12, border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="font-semibold" style={{ margin: 0, fontSize: 15, color: 'var(--text-primary)' }}>Fetched Plans</h3>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Loaded</div>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{visiblePlanWeeks.length}</div>
                    </div>
                  </div>

                  {fetchedPlanRows.length ? (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {fetchedPlanRows.map((w, idx) => {
                        const dayCount = Array.isArray(w?.weekDays) ? w.weekDays.length : 0;
                        const label = planCourseLabelMap?.[String(w?.courseId || '')] || String(w?.courseId || '');
                        return (
                          <div key={`${w?.courseId || 'course'}-${w?.week || idx}-${idx}`} style={{ padding: 10, borderRadius: 12, background: 'var(--surface-soft)', border: '1px solid var(--border-soft)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12 }}>{label || 'Course'}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{w?.week ? `Week ${w.week}` : 'Week -'}{w?.month ? ` • ${w.month}` : ''}</div>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5 }}>{w?.topic || 'No topic set'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{dayCount} day(s) fetched</div>
                          </div>
                        );
                      })}
                      {visiblePlanWeeks.length > fetchedPlanRows.length && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                          Showing latest {fetchedPlanRows.length} fetched plans.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px 10px', borderRadius: 12, background: 'var(--surface-soft)', border: '1px dashed var(--border-soft)', marginTop: 10 }}>
                      No fetched plans found for this subject.
                    </div>
                  )}
                </div>

                <div style={{ background: 'var(--surface-panel)', borderRadius: 8, padding: 6, boxShadow: 'var(--shadow-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="font-semibold" style={{ margin: 0, fontSize: 11 }}>Submitted Daily Plans</h3>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Total</div>
                      <div style={{ fontWeight: 800, color: 'var(--success)' }}>{submittedDailyPlans.length}</div>
                    </div>
                  </div>

                  {submittedDailyPlans.length ? (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {submittedDailyPlans.map((p, idx) => (
                          <div key={p?.key || idx} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 14, background: 'color-mix(in srgb, var(--success) 12%, var(--surface-panel))', border: '1px solid color-mix(in srgb, var(--success) 35%, var(--border-soft))', alignItems: 'center', boxShadow: 'var(--shadow-soft)' }}>
                            <div style={{ width: 8, height: 48, borderRadius: 6, background: 'var(--success)' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.dayName || `Submitted ${idx + 1}`}</div>
                                  <div style={{ fontSize: 11, color: 'var(--success)' }}>
                                  {p.week ? `Week: ${p.week}` : 'Week: -'}
                                  {p?.date ? ` • ${String(p.date).slice(0, 10)}` : ''}
                                  {p?.submittedAt ? ` • ${new Date(p.submittedAt).toLocaleString()}` : ''}
                                </div>
                            </div>
                              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{p.topic || 'No topic provided'}</div>
                              <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 6 }}>
                              {p.method ? `Method: ${p.method}` : p.aids ? `Material: ${p.aids}` : p.assessment ? `Assessment: ${p.assessment}` : 'Quick note: -'}
                            </div>
                          </div>
                            <div style={{ background: 'var(--success)', color: 'var(--on-accent)', padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                            Submitted
                          </div>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => setPlanShowSubmittedTable((prev) => !prev)}
                          style={{
                            border: '1px solid color-mix(in srgb, var(--success) 40%, var(--border-soft))',
                            background: 'var(--surface-panel)',
                            color: 'var(--success)',
                            borderRadius: 8,
                            padding: '4px 8px',
                            fontSize: 9,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {planShowSubmittedTable ? 'Hide Submitted Details' : 'Show Submitted Details'}
                        </button>
                      </div>

                      {planShowSubmittedTable && (
                        <div style={{ marginTop: 8, border: '1px solid color-mix(in srgb, var(--success) 40%, var(--border-soft))', borderRadius: 14, overflowX: 'auto', background: 'var(--surface-panel)', boxShadow: 'var(--shadow-soft)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                            <thead>
                              <tr style={{ background: 'color-mix(in srgb, var(--success) 12%, var(--surface-panel))' }}>
                                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, color: 'var(--success)', borderBottom: '1px solid color-mix(in srgb, var(--success) 24%, var(--border-soft))' }}>Subject</th>
                                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, color: 'var(--success)', borderBottom: '1px solid color-mix(in srgb, var(--success) 24%, var(--border-soft))' }}>Week</th>
                                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, color: 'var(--success)', borderBottom: '1px solid color-mix(in srgb, var(--success) 24%, var(--border-soft))' }}>Day</th>
                                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, color: 'var(--success)', borderBottom: '1px solid color-mix(in srgb, var(--success) 24%, var(--border-soft))' }}>Plan Date</th>
                                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, color: 'var(--success)', borderBottom: '1px solid color-mix(in srgb, var(--success) 24%, var(--border-soft))' }}>Submitted At</th>
                                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, color: 'var(--success)', borderBottom: '1px solid color-mix(in srgb, var(--success) 24%, var(--border-soft))' }}>Topic</th>
                              </tr>
                            </thead>
                            <tbody>
                              {submittedDailyPlans.map((p, idx) => (
                                <tr key={`${p?.key || 'submitted'}-${idx}`} style={{ background: idx % 2 ? 'var(--surface-panel)' : 'color-mix(in srgb, var(--success) 6%, var(--surface-panel))' }}>
                                  <td style={{ padding: '6px 8px', fontSize: 9, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-soft)' }}>
                                    {planCourseLabelMap?.[String(p?.courseId || '')] || String(p?.courseId || '-')} 
                                  </td>
                                  <td style={{ padding: '6px 8px', fontSize: 9, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-soft)' }}>{p?.week ? `Week ${p.week}` : '-'}</td>
                                  <td style={{ padding: '6px 8px', fontSize: 9, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-soft)' }}>{p?.dayName || '-'}</td>
                                  <td style={{ padding: '6px 8px', fontSize: 9, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-soft)' }}>{p?.date ? String(p.date).slice(0, 10) : '-'}</td>
                                  <td style={{ padding: '6px 8px', fontSize: 9, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-soft)' }}>{p?.submittedAt ? new Date(p.submittedAt).toLocaleString() : '-'}</td>
                                  <td style={{ padding: '6px 8px', fontSize: 9, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-soft)' }}>{p?.topic || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '18px 12px', borderRadius: 14, background: 'var(--surface-soft)', border: '1px dashed var(--border-soft)' }}>No submitted daily plans yet.</div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="font-semibold" style={{ fontSize: 11 }}>Today's Plan</h3>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Today</div>
                    <div style={{ fontWeight: 700 }}>{(visibleDailyPlans || []).length}</div>
                  </div>
                </div>

                {(visibleDailyPlans && visibleDailyPlans.length > 0) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {visibleDailyPlans.map((p, idx) => {
                      const status = p?.status || 'pending';
                      const color = status === 'submitted' ? 'var(--success)' : status === 'missed' ? 'var(--danger)' : 'var(--text-muted)';
                      return (
                        <div key={p?.key || idx} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 14, background: 'var(--surface-panel)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-soft)', alignItems: 'center' }}>
                          <div style={{ width: 8, height: 48, borderRadius: 6, background: color }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.dayName || `Plan ${idx + 1}`}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.week ? `Week: ${p.week}` : 'Week: -'}</div>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{p.topic || 'No topic provided'}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                              {p.method ? `Method: ${p.method}` : p.aids ? `Aids: ${p.aids}` : p.assessment ? `Assessment: ${p.assessment}` : 'Quick note: -'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                            <div style={{ background: color, color: 'var(--on-accent)', padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                              {status === 'submitted' ? 'Submitted' : status === 'missed' ? 'Missed' : 'Pending'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '18px 12px', borderRadius: 14, background: 'var(--surface-soft)', border: '1px dashed var(--border-soft)' }}>No plans for today.</div>
                )}
              </div>
            );
          }

          if (planSidebarTab === 'weekly') {
            const weekDays = Array.isArray(activeWeekDays) ? activeWeekDays : [];
            if (!weekDays.length) return (<div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No weekly plan found.</div>);

            return (
              <div className="sidebar-week-list" style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', minWidth: 0 }}>
                <div style={{ background: 'var(--surface-panel)', borderRadius: 14, padding: 12, border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="font-semibold" style={{ margin: 0, fontSize: 15, color: 'var(--text-primary)' }}>Fetched Plans</h3>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Loaded</div>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{visiblePlanWeeks.length}</div>
                    </div>
                  </div>

                  {fetchedPlanRows.length ? (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {fetchedPlanRows.slice(0, 5).map((w, idx) => {
                        const dayCount = Array.isArray(w?.weekDays) ? w.weekDays.length : 0;
                        const label = planCourseLabelMap?.[String(w?.courseId || '')] || String(w?.courseId || '');
                        return (
                          <div key={`weekly-${w?.courseId || 'course'}-${w?.week || idx}-${idx}`} style={{ padding: 10, borderRadius: 12, background: 'var(--surface-soft)', border: '1px solid var(--border-soft)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12 }}>{label || 'Course'}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{w?.week ? `Week ${w.week}` : 'Week -'}{w?.month ? ` • ${w.month}` : ''}</div>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5 }}>{w?.topic || 'No topic set'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{dayCount} day(s) fetched</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px 10px', borderRadius: 12, background: 'var(--surface-soft)', border: '1px dashed var(--border-soft)', marginTop: 10 }}>
                      No fetched plans found for this subject.
                    </div>
                  )}
                </div>

                <h3 className="font-semibold" style={{ margin: 0, marginBottom: 10, fontSize: 15, color: 'var(--text-primary)' }}>Week Plan</h3>
                {weekDays.map((d, i) => {
                  const ds = getDayStatus(activeWeekBlock?.courseId, activeWeekBlock?.week, d, i);
                  const status = ds.status;
                  const statusColor = status === 'submitted' ? 'var(--success)' : status === 'missed' ? 'var(--danger)' : 'var(--text-muted)';
                  const cardBg = status === 'submitted' ? 'color-mix(in srgb, var(--success) 12%, var(--surface-panel))' : status === 'missed' ? 'color-mix(in srgb, var(--danger) 12%, var(--surface-panel))' : 'var(--surface-panel)';
                  return (
                    <div key={i} className={`sidebar-week-card ${status}`} style={{ display: 'flex', gap: 18, color: 'var(--text-secondary)', padding: 12, borderRadius: 14, background: cardBg, alignItems: 'center', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-soft)' }}>
                      <div style={{ width: 10, height: 46, borderRadius: 6, background: status === 'submitted' ? 'linear-gradient(180deg,color-mix(in srgb, var(--success) 45%, var(--surface-panel)),var(--success))' : status === 'missed' ? 'linear-gradient(180deg,color-mix(in srgb, var(--danger) 45%, var(--surface-panel)),var(--danger))' : 'linear-gradient(180deg,var(--border-soft),var(--text-muted))' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.dayName || `Day ${i + 1}`}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{activeWeekBlock?.week ? `Week ${activeWeekBlock.week}` : ''}</div>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{d.topic || activeWeekBlock?.topic || 'No topic set'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <div style={{ background: statusColor, color: 'var(--on-accent)', padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{status === 'submitted' ? 'Submitted' : status === 'missed' ? 'Missed' : 'Pending'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }

          // monthly
          return (
            <div className="space-y-2" style={{ width: '100%', minWidth: 0 }}>
              <div style={{ background: 'var(--surface-panel)', borderRadius: 14, padding: 12, border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="font-semibold" style={{ margin: 0, fontSize: 15, color: 'var(--text-primary)' }}>Fetched Plans</h3>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Loaded</div>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{visiblePlanWeeks.length}</div>
                  </div>
                </div>

                {fetchedPlanRows.length ? (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {fetchedPlanRows.slice(0, 5).map((w, idx) => {
                      const dayCount = Array.isArray(w?.weekDays) ? w.weekDays.length : 0;
                      const label = planCourseLabelMap?.[String(w?.courseId || '')] || String(w?.courseId || '');
                      return (
                        <div key={`monthly-${w?.courseId || 'course'}-${w?.week || idx}-${idx}`} style={{ padding: 10, borderRadius: 12, background: 'var(--surface-soft)', border: '1px solid var(--border-soft)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12 }}>{label || 'Course'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{w?.week ? `Week ${w.week}` : 'Week -'}{w?.month ? ` • ${w.month}` : ''}</div>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5 }}>{w?.topic || 'No topic set'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{dayCount} day(s) fetched</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px 10px', borderRadius: 12, background: 'var(--surface-soft)', border: '1px dashed var(--border-soft)', marginTop: 10 }}>
                    No fetched plans found for this subject.
                  </div>
                )}
              </div>

              <h3 className="font-semibold" style={{ margin: 0, marginBottom: 10, fontSize: 15, color: 'var(--text-primary)' }}>This Month</h3>
              {!currentMonthWeeks.length && <div className="text-xs text-gray-500" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '18px 12px', borderRadius: 14, background: 'var(--surface-soft)', border: '1px dashed var(--border-soft)' }}>No plans for this month.</div>}

              {!!currentMonthWeeks.length && (
                <div style={{ padding: 12, borderRadius: 14, background: 'var(--surface-panel)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-soft)', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{currentMonthName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{currentMonthWeeks.length} week(s) • {monthStats.total} day(s)</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Completed</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{monthPct}%</div>
                    </div>
                  </div>

                  <div style={{ height: 8, background: 'var(--surface-strong)', borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${monthPct}%`, height: '100%', background: 'linear-gradient(90deg,var(--accent),var(--accent-strong))' }} />
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--success)' }}>Submitted: <strong>{monthStats.submitted}</strong></div>
                      <div style={{ fontSize: 12, color: 'var(--danger)' }}>Missed: <strong>{monthStats.missed}</strong></div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pending: <strong>{monthStats.pending}</strong></div>
                    </div>
                  </div>

                  {monthStats.topics && monthStats.topics.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Topics this month</div>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {monthStats.topics.slice(0, 3).map((t, i) => (<li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t}</li>))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        };

        return (
          <>
            <LessonPlanInsightsModal
              open={planAnnualOpen}
              onClose={() => setPlanAnnualOpen(false)}
              teacherName={selectedTeacher?.name || 'Teacher'}
              selectedCourseId={planSelectedCourseId}
              onCourseChange={setPlanSelectedCourseId}
              courseOptions={courseOptions}
              selectedCourseLabel={selectedCourseLabel}
              annualWeeks={annualWeeks}
              annualByMonth={annualByMonth}
              annualMonthKeys={annualMonthKeys}
              currentMonthName={currentMonthName}
              currentMonthWeeks={currentMonthWeeks}
              visibleDailyPlans={visibleDailyPlans}
              planLoading={planLoading}
              planError={planError}
              downloadAnnualExcel={downloadAnnualExcel}
              getDayStatus={getDayStatus}
            />

            <div className="right-sidebar" style={{ width: '100%', minWidth: 320, padding: 14, background: 'var(--surface-soft)', border: '1px solid var(--border-soft)', borderRadius: 20, boxShadow: 'var(--shadow-panel)', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0, fontSize: 12 }}>
              {planSidebarOpen ? (
                <>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    aria-label="Close plan sidebar"
                    onClick={() => setPlanSidebarOpen(false)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      border: '1px solid var(--border-soft)',
                      background: 'var(--surface-panel)',
                      color: 'var(--text-secondary)',
                      boxShadow: 'var(--shadow-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <FaChevronRight />
                  </button>
                </div>
                <div style={{ position: 'sticky', top: 8, zIndex: 250, display: 'flex', justifyContent: 'flex-end', paddingBottom: 6 }}>
                  <button
                    onClick={() => setPlanAnnualOpen(true)}
                    style={{
                      borderRadius: 999,
                      padding: '10px 14px',
                      background: 'var(--surface-panel)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-soft)',
                      boxShadow: 'var(--shadow-panel)',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    Annual Lesson Plan
                  </button>
                </div>
                <div style={{ background: 'var(--surface-panel)', padding: 16, borderRadius: 16, border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ background: 'color-mix(in srgb, var(--accent) 14%, var(--surface-panel))', padding: 9, borderRadius: 10 }}><FaCalendarAlt color="var(--accent-strong)" /></div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Lesson Overview</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{today.toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>This Week</div>
                        <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text-primary)' }}>{weekStats.total}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, whiteSpace: 'nowrap' }}>Subject</div>
                    <select
                      value={planSelectedCourseId}
                      onChange={(e) => setPlanSelectedCourseId(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border-soft)',
                        background: 'var(--surface-soft)',
                        outline: 'none',
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                      }}
                    >
                      {courseOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    Showing: <strong style={{ color: 'var(--text-primary)' }}>{selectedCourseLabel}</strong>
                  </div>

                  <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, background: 'var(--surface-soft)', border: '1px solid var(--border-soft)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Weekly progress</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{weekCompletionRate}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-strong)', overflow: 'hidden' }}>
                      <div style={{ width: `${weekCompletionRate}%`, height: '100%', background: 'linear-gradient(90deg, var(--text-primary), var(--accent-strong))' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <div style={{ flex: 1, padding: 10, borderRadius: 12, textAlign: 'center', border: '1px solid color-mix(in srgb, var(--success) 35%, var(--border-soft))', boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--surface-panel) 20%, transparent)', background: 'color-mix(in srgb, var(--success) 12%, var(--surface-panel))' }}>
                      <div style={{ fontSize: 12, color: 'var(--success)' }}><FaCheckCircle /></div>
                      <div style={{ fontWeight: 800, color: 'var(--success)' }}>{weekStats.submitted}</div>
                      <div style={{ fontSize: 11, color: 'var(--success)' }}>Submitted</div>
                    </div>
                    <div style={{ flex: 1, padding: 10, borderRadius: 12, textAlign: 'center', border: '1px solid color-mix(in srgb, var(--danger) 35%, var(--border-soft))', boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--surface-panel) 20%, transparent)', background: 'color-mix(in srgb, var(--danger) 10%, var(--surface-panel))' }}>
                      <div style={{ fontSize: 12, color: 'var(--danger)' }}><FaClock /></div>
                      <div style={{ fontWeight: 800, color: 'var(--danger)' }}>{weekStats.missed}</div>
                      <div style={{ fontSize: 11, color: 'var(--danger)' }}>Missed</div>
                    </div>
                    <div style={{ flex: 1, padding: 10, borderRadius: 12, textAlign: 'center', border: '1px solid var(--border-soft)', boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--surface-panel) 20%, transparent)', background: 'var(--surface-soft)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>•</div>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{weekStats.pending}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pending</div>
                    </div>
                  </div>

                  {planError && (
                    <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'color-mix(in srgb, var(--danger) 10%, var(--surface-panel))', color: 'var(--danger)', fontSize: 13 }}>
                      {planError}
                    </div>
                  )}

                  {planLoading && (
                    <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'var(--surface-soft)', color: 'var(--text-muted)', fontSize: 13 }}>
                      Loading lesson plans...
                    </div>
                  )}
                </div>

                <div style={{ background: 'var(--surface-panel)', border: '1px solid var(--border-soft)', borderRadius: 16, boxShadow: 'var(--shadow-soft)', display: 'flex', gap: 6, alignItems: 'center', padding: 4, width: '100%', minWidth: 0 }}>
                  <button
                    onClick={() => setPlanSidebarTab('daily')}
                    className={"btn " + (planSidebarTab === 'daily' ? 'btn-primary' : 'btn-ghost')}
                    style={{
                      flex: 1,
                      borderRadius: 999,
                      padding: '9px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      background: planSidebarTab === 'daily' ? 'var(--text-primary)' : 'transparent',
                      color: planSidebarTab === 'daily' ? 'var(--on-accent)' : 'var(--text-muted)',
                      border: 'none',
                      boxShadow: planSidebarTab === 'daily' ? 'var(--shadow-soft)' : 'none',
                      minWidth: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setPlanSidebarTab('weekly')}
                    className={"btn " + (planSidebarTab === 'weekly' ? 'btn-primary' : 'btn-ghost')}
                    style={{
                      flex: 1,
                      borderRadius: 999,
                      padding: '9px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      background: planSidebarTab === 'weekly' ? 'var(--text-primary)' : 'transparent',
                      color: planSidebarTab === 'weekly' ? 'var(--on-accent)' : 'var(--text-muted)',
                      border: 'none',
                      boxShadow: planSidebarTab === 'weekly' ? 'var(--shadow-soft)' : 'none',
                      minWidth: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setPlanSidebarTab('monthly')}
                    className={"btn " + (planSidebarTab === 'monthly' ? 'btn-primary' : 'btn-ghost')}
                    style={{
                      flex: 1,
                      borderRadius: 999,
                      padding: '9px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      background: planSidebarTab === 'monthly' ? 'var(--text-primary)' : 'transparent',
                      color: planSidebarTab === 'monthly' ? 'var(--on-accent)' : 'var(--text-muted)',
                      border: 'none',
                      boxShadow: planSidebarTab === 'monthly' ? 'var(--shadow-soft)' : 'none',
                      minWidth: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Monthly
                  </button>
                </div>

                <div style={{ background: 'var(--surface-panel)', border: '1px solid var(--border-soft)', borderRadius: 16, boxShadow: 'var(--shadow-soft)', padding: 12, overflowY: 'auto', overflowX: 'hidden', maxHeight: isPortrait ? '56vh' : '56vh', width: '100%', minWidth: 0 }}>
                  {renderPlanSidebarContent()}
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Monthly entries: <strong style={{ color: 'var(--text-primary)' }}>{monthlyCount}</strong></div>
                  <div>
                    <button className="btn btn-ghost" onClick={() => setPlanRefreshKey((k) => k + 1)}>Refresh</button>
                  </div>
                </div>
              </>
              ) : (
                <button
                  aria-label="Open plan sidebar"
                  onClick={() => setPlanSidebarOpen(true)}
                  style={{
                    minWidth: 92,
                    height: 42,
                    padding: '0 14px',
                    borderRadius: 999,
                    border: '1px solid var(--border-soft)',
                    background: 'var(--surface-panel)',
                    color: 'var(--text-primary)',
                    boxShadow: 'var(--shadow-panel)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    alignSelf: 'flex-end',
                  }}
                >
                  <span>Plan</span>
                  <FaChevronLeft />
                </button>
              )}
            </div>
          </>
        );
      })()}

      {/* ================= MESSAGE BUTTON ================= */}
     

{/* ================= FIXED MESSAGE BUTTON ================= */}
{selectedTeacher && (
<div
  onClick={() => setTeacherChatOpen(true)}
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
  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1) ")}
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
    <span style={{ fontWeight: 800, fontSize: 13 }}>Teacher Chat</span>
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
    T
  </span>
</div>
) }


</div>
  

    </div>
 

      </div>

      {/* ---------------- MINI POPUP CHAT ---------------- */}
      {teacherChatOpen && selectedTeacher && (
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
            <div style={{ display: "flex", flexDirection: "column" }}>
              <strong>{selectedTeacher.name}</strong>
              {typingUserId && String(typingUserId) !== String(adminUserId) && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Typing...</span>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  if (selectedTeacher?.userId && adminUserId) {
                    clearTyping(getChatKey(selectedTeacher.userId, adminUserId));
                  }
                  setTeacherChatOpen(false);
                  navigate("/all-chat", { state: { user: selectedTeacher, tab: "teacher" } });
                }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}
              >
                ⤢
              </button>
              <button
                onClick={() => {
                  if (selectedTeacher?.userId && adminUserId) {
                    clearTyping(getChatKey(selectedTeacher.userId, adminUserId));
                  }
                  setTeacherChatOpen(false);
                }}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", background: "var(--surface-muted)" }}>
            {popupMessages.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Start chatting with {selectedTeacher.name}</p>
            ) : (
              popupMessages.map((m) => {
                const isAdmin = String(m.senderId) === String(adminUserId) || m.sender === "admin";
                return (
                  <div key={m.messageId || m.id} style={{ display: "flex", flexDirection: "column", alignItems: isAdmin ? "flex-end" : "flex-start", marginBottom: 10 }}>
                    <div style={{ maxWidth: "70%", background: isAdmin ? "var(--accent)" : "var(--surface-panel)", color: isAdmin ? "#fff" : "var(--text-primary)", padding: "10px 14px", borderRadius: 18, borderTopRightRadius: isAdmin ? 0 : 18, borderTopLeftRadius: isAdmin ? 18 : 0, boxShadow: "var(--shadow-soft)", wordBreak: "break-word", cursor: "default", position: "relative" }}>
                      {m.text} {m.edited && (<small style={{ fontSize: 10 }}> (edited)</small>)}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 6, fontSize: 11, color: isAdmin ? "#fff" : "var(--text-muted)" }}>
                        <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>{formatDateLabel(m.timeStamp)}</span>
                        <span>{formatTime(m.timeStamp)}</span>
                        {isAdmin && !m.deleted && (
                          <span style={{ display: "flex", gap: 0, alignItems: "center" }}>
                            <FaCheck size={10} color={isAdmin ? "#fff" : "#888"} style={{ opacity: 0.85, marginLeft: 4 }} />
                            {m.seen && (<FaCheck size={10} color={isAdmin ? "#f3f7f8" : "#ccc"} style={{ marginLeft: 2, opacity: 0.95 }} />)}
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
          <div style={{ padding: "10px", borderTop: "1px solid #eee", display: "flex", gap: "8px", background: "#fff" }}>
            <input
              value={popupInput}
              onChange={(e) => {
                const value = e.target.value;
                setPopupInput(value);
                handleTyping(value);
              }}
              placeholder="Type a message..."
              style={{ flex: 1, padding: "10px 14px", borderRadius: "25px", border: "1px solid var(--input-border)", outline: "none", background: "var(--input-bg)", color: "var(--text-primary)" }}
              onKeyDown={(e) => { if (e.key === "Enter") sendPopupMessage(); }}
            />
            <button onClick={() => sendPopupMessage()} style={{ width: 45, height: 45, borderRadius: "50%", background: "var(--accent)", border: "none", color: "#fff", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
              <FaPaperPlane />
            </button>
          </div>
        </div>
      )}
      {/* Admin confirm modal */}
      {showAdminModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ width: 420, maxWidth: '92%', background: 'var(--surface-panel)', borderRadius: 12, padding: 18, boxShadow: '0 12px 40px rgba(0,0,0,0.35)', border: '1px solid var(--border-soft)' }}>
            <h3 style={{ margin: 0, marginBottom: 8 }}>{pendingToggle?.newActive ? 'Confirm Activation' : 'Confirm Deactivation'}</h3>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>{pendingToggle?.newActive ? 'You are about to activate this teacher. Please enter admin credentials to confirm.' : 'You are about to deactivate this teacher and unassign their subjects. Enter admin credentials to confirm.'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input autoFocus placeholder="Admin username" value={adminModalUsername} onChange={(e) => setAdminModalUsername(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', outline: 'none' }} />
              <input placeholder="Admin password" type="password" value={adminModalPassword} onChange={(e) => setAdminModalPassword(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', outline: 'none' }} />
              {adminModalError && (<div style={{ color: '#b91c1c', fontSize: 13 }}>{adminModalError}</div>)}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                <button onClick={closeAdminModal} style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border-soft)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={submitAdminModal} disabled={adminVerifying} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>{adminVerifying ? 'Verifying...' : 'Confirm'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeachersPage;