import React, { useEffect, useState, useRef } from "react";
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
import { getRtdbRoot } from "../api/rtdbScope";
import { resolveProfileImage } from "../utils/profileImage";

// NOTE: we alias `ref` to `dbRef` to avoid confusion with other `ref` variables
import {
  getDatabase,
  ref as dbRef,
  get,
  onValue,
  off,
  update,
} from "firebase/database";
import { db, schoolPath } from "../firebase";

// Chat thread key for teacher<->student must be: teacherUserId_studentUserId
// (teacher first, no sorting) so the DB path is predictable.
const getChatId = (teacherUserId, studentUserId) => {
  const t = String(teacherUserId || "").trim();
  const s = String(studentUserId || "").trim();
  return `${t}_${s}`;
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

const RTDB_BASE = getRtdbRoot();

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

const StudentItem = ({ student, selected, onClick, number }) => (
  <div
    onClick={() => onClick(student)}
    style={{
      width: "100%",
      borderRadius: "12px",
      padding: "10px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      cursor: "pointer",
      background: selected ? "#e0e7ff" : "#fff",
      border: selected ? "2px solid #4b6cb7" : "1px solid #ddd",
      boxShadow: selected ? "0 6px 15px rgba(75,108,183,0.3)" : "0 2px 6px rgba(0,0,0,0.06)",
      transition: "all 0.3s ease",
    }}
  >
    <div style={{
      width: 36,
      height: 36,
      borderRadius: "50%",
      background: selected ? "#4b6cb7" : "#f1f5f9",
      color: selected ? "#fff" : "#374151",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 800,
      fontSize: 12,
      flexShrink: 0,
    }}>{number}</div>

    <img
      src={student.profileImage || "/default-profile.png"}
      alt={student.name}
      onError={(event) => {
        event.currentTarget.src = "/default-profile.png";
      }}
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        objectFit: "cover",
        border: selected ? "3px solid #4b6cb7" : "3px solid #ddd",
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
  const [selectedStudentDetails, setSelectedStudentDetails] = useState(null);
  const [teacherNotes, setTeacherNotes] = useState([]);
  const [newTeacherNote, setNewTeacherNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  // default
  const [marksData, setMarksData] = useState({});
  const [teacher, setTeacher] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentChatOpen, setStudentChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const messagesEndRef = useRef(null);
  const teacherData = JSON.parse(localStorage.getItem("teacher")) || {};
  const teacherUserId = String(teacherData.userId || "");
  const [studentMarksFlattened, setStudentMarksFlattened] = useState({});
  const [performance, setPerformance] = useState([]);
const [attendanceView, setAttendanceView] = useState("daily");
  const [attendanceCourseFilter, setAttendanceCourseFilter] = useState("All");
  const [expandedCards, setExpandedCards] = useState({});
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);

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
      if (!t || !t.userId) {
        setConversations([]);
        return;
      }

      // Fetch chats and users
      const [chatsRes, usersRes] = await Promise.all([
        axios.get(`${RTDB_BASE}/Chats.json`),
        axios.get(`${RTDB_BASE}/Users.json`),
      ]);
      const chats = chatsRes.data || {};
      const users = usersRes.data || {};

      // Build user mappings
      const usersByKey = users || {};
      const userKeyByUserId = {};
      Object.entries(usersByKey).forEach(([pushKey, u]) => {
        if (u && u.userId) userKeyByUserId[u.userId] = pushKey;
      });

      const convs = Object.entries(chats)
        .map(([chatId, chat]) => {
          const unreadMap = chat.unread || {};
          const unreadForMe = unreadMap[t.userId] || 0;
          if (!unreadForMe) return null; // only show conversations with unread messages

          const participants = chat.participants || {};
          const otherKeyCandidate = Object.keys(participants || {}).find((p) => p !== t.userId);
          if (!otherKeyCandidate) return null;

          // Resolve other participant to a Users pushKey + record (if possible)
          let otherPushKey = otherKeyCandidate;
          let otherRecord = usersByKey[otherPushKey];

          if (!otherRecord) {
            const mapped = userKeyByUserId[otherKeyCandidate];
            if (mapped) {
              otherPushKey = mapped;
              otherRecord = usersByKey[mapped];
            }
          }

          if (!otherRecord) {
            // fallback minimal record
            otherRecord = { userId: otherKeyCandidate, name: otherKeyCandidate, profileImage: "/default-profile.png" };
          }

          const contact = {
            pushKey: otherPushKey,
            userId: otherRecord.userId || otherKeyCandidate,
            name: otherRecord.name || otherRecord.username || otherKeyCandidate,
            profileImage: otherRecord.profileImage || otherRecord.profile || "/default-profile.png",
          };

          const lastMessage = chat.lastMessage || {};

          return {
            chatId,
            contact,
            displayName: contact.name,
            profile: contact.profileImage,
            lastMessageText: lastMessage.text || "",
            lastMessageTime: lastMessage.timeStamp || lastMessage.time || null,
            lastMessageSeen: Boolean(lastMessage.seen),
            lastMessageSeenAt: lastMessage.seenAt || lastMessage.seenAt || null,
            lastMessageSenderId: lastMessage.senderId || null,
            unreadForMe,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

      setConversations(convs);
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
      await axios.put(`${RTDB_BASE}/Chats/${chatId}/unread/${teacher.userId}.json`, null);
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
    if (!teacherInfo?.userId) return;
    let cancelled = false;

    const fetchStudents = async () => {
      setLoading(true);
      try {
        const [
          studentsRes,
          usersRes,
          coursesRes,
          studentCoursesRes,
          teachersRes,
          courseContext,
        ] = await Promise.all([
          axios.get(`${RTDB_BASE}/Students.json`),
          axios.get(`${RTDB_BASE}/Users.json`),
          axios.get(`${RTDB_BASE}/Courses.json`),
          axios.get(`${RTDB_BASE}/StudentCourses.json`),
          axios.get(`${RTDB_BASE}/Teachers.json`),
          getTeacherCourseContext({ teacher: teacherInfo, rtdbBase: RTDB_BASE }),
        ]);

        const teachers = teachersRes.data || {};
        const teacherIdentifiers = new Set([
          String(teacherInfo.teacherId || "").trim(),
          String(teacherInfo.teacherKey || "").trim(),
          String(teacherInfo.userId || "").trim(),
        ].filter(Boolean));
        const teacherEntry = Object.entries(teachers).find(
          ([key, t]) => teacherIdentifiers.has(String(key || "").trim()) || teacherIdentifiers.has(String(t.userId || "").trim())
        );

        if (!teacherEntry) {
          console.warn("Teacher not found in Teachers node");
          if (!cancelled) {
            setStudents([]);
            setLoading(false);
            setError("No teacher assignment found");
          }
          return;
        }
        const teacherKey = teacherEntry[0];

        const assignedCourses = courseContext.courseIds || [];
        const studentCoursesMap = studentCoursesRes.data || {};
        const assignedCourseIdSet = new Set(assignedCourses.map((courseId) => String(courseId || "").trim()).filter(Boolean));

        const parseGradeSectionFromCourseId = (courseId) => {
          const raw = String(courseId || "").trim();
          const body = raw.startsWith("course_") ? raw.slice("course_".length) : raw;
          const last = body.split("_").filter(Boolean).at(-1) || "";
          const match = last.match(/^(\d+)([A-Za-z].*)$/);
          if (!match) return null;
          return {
            grade: String(match[1] || "").trim(),
            section: String(match[2] || "").trim().toUpperCase(),
          };
        };

        const taughtGradeSectionSet = new Set(
          (courseContext.courses || [])
            .map((course) => ({
              grade: String(course?.grade || "").trim(),
              section: String(course?.section || course?.secation || "").trim().toUpperCase(),
            }))
            .filter((item) => item.grade && item.section)
            .map((item) => `${item.grade}|${item.section}`)
        );

        assignedCourses.forEach((courseId) => {
          const dbCourse = coursesRes.data?.[courseId];
          if (dbCourse) {
            const key = `${String(dbCourse.grade || "").trim()}|${String(dbCourse.section || dbCourse.secation || "").trim().toUpperCase()}`;
            if (key !== "|") taughtGradeSectionSet.add(key);
            return;
          }

          const parsed = parseGradeSectionFromCourseId(courseId);
          if (!parsed) return;
          taughtGradeSectionSet.add(`${parsed.grade}|${parsed.section}`);
        });

        const hasTeacherScope =
          assignedCourseIdSet.size > 0 || taughtGradeSectionSet.size > 0;

        const assignedPairs = [...taughtGradeSectionSet]
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

        const usersObj = usersRes.data || {};
        setUsersData(usersObj);

        // helper to find user record
        const findUser = (userId) => findUserByUserId(usersObj, userId);

        const studentsArr = Object.entries(studentsRes.data || {}).map(([studentId, s]) => {
          const user = findUser(s.userId);

          const normalizedStudentGrade = String(
            s.grade || s.basicStudentInformation?.grade || ""
          ).trim();
          const normalizedStudentSection = String(
            s.section || s.basicStudentInformation?.section || ""
          )
            .trim()
            .toUpperCase();

          const studentCourseNode = studentCoursesMap?.[studentId] || {};
          const studentCourseIds = Object.entries(studentCourseNode)
            .filter(([, enabled]) => Boolean(enabled))
            .map(([courseId]) => String(courseId || "").trim())
            .filter(Boolean);

          const hasAssignedCourseMatch = studentCourseIds.some((courseId) =>
            assignedCourseIdSet.has(courseId)
          );

          const hasGradeSectionMatch = taughtGradeSectionSet.has(
            `${normalizedStudentGrade}|${normalizedStudentSection}`
          );

          const includeStudent = hasTeacherScope
            ? hasAssignedCourseMatch || hasGradeSectionMatch
            : true;

          // attempt to resolve parentName/parentPhone from student raw or user record
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

          // detect DOB/age
          const rawDob = user?.dob || user?.birthDate || s.dob || s.birthDate || null;
          const age = computeAge(rawDob);

          return {
            ...s,
            studentId,
            name: user?.name || s.name || "Unknown",
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
            grade: normalizedStudentGrade || s.grade || "",
            section: normalizedStudentSection || s.section || "",
            dob: rawDob,
            age: age,
            parentName: parentName || null,
            parentPhone: parentPhone || null,
            includeStudent,
            raw: s,
          };
        }).filter((studentItem) => studentItem.includeStudent);

        const fallbackPairs = [...new Set(
          studentsArr
            .map((studentItem) => {
              const normalizedGrade = String(studentItem.grade || "").trim();
              const normalizedSection = String(studentItem.section || "").trim().toUpperCase();
              return normalizedGrade && normalizedSection
                ? `${normalizedGrade}|${normalizedSection}`
                : "";
            })
            .filter(Boolean)
        )]
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

        const effectiveAssignedPairs = hasTeacherScope ? assignedPairs : fallbackPairs;

        if (!cancelled) {
          setStudents(studentsArr);
          setAssignedGradeSections(effectiveAssignedPairs);
          setError("");
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
  }, [teacherInfo]);

  // When user picks a student, set immediate fallback details (so UI won't crash),
  // then fetch Users node and resolve authoritative details (phone/gender/email/parent/dob->age).
  useEffect(() => {
    if (!selectedStudent) {
      setSelectedStudentDetails(null);
      return;
    }

    // immediate fallback derived from selectedStudent to avoid UI errors
    const fallback = {
      fullName: selectedStudent.name || "—",
      phone: selectedStudent.phone || selectedStudent.raw?.phone || "—",
      gender: selectedStudent.gender || selectedStudent.raw?.gender || "—",
      email: selectedStudent.email || "—",
      grade: selectedStudent.grade || "—",
      section: selectedStudent.section || "—",
      parentName: selectedStudent.parentName || selectedStudent.raw?.parentName || "—",
      parentPhone: selectedStudent.parentPhone || selectedStudent.raw?.parentPhone || "—",
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
        // use cached usersData if present, otherwise fetch Users node
        let usersObj = usersData;
        if (!usersObj || Object.keys(usersObj).length === 0) {
          const usersRes = await axios.get(`${RTDB_BASE}/Users.json`);
          usersObj = usersRes.data || {};
          setUsersData(usersObj);
        }

        const userRec = findUserByUserId(usersObj, selectedStudent.userId) || {};
        // Try multiple parent id fields on student or user record
        const parentId =
          selectedStudent.raw?.parentId ||
          selectedStudent.raw?.parentUserId ||
          userRec?.parentId ||
          userRec?.parentUserId ||
          null;

        const parentRec = parentId ? findUserByUserId(usersObj, parentId) : null;

        const parentName =
          parentRec?.name ||
          selectedStudent.raw?.parentName ||
          selectedStudent.parentName ||
          "—";

        const parentPhone =
          parentRec?.phone ||
          selectedStudent.raw?.parentPhone ||
          selectedStudent.parentPhone ||
          "—";

        const phone = userRec?.phone || selectedStudent.phone || selectedStudent.raw?.phone || "—";
        const gender = userRec?.gender || selectedStudent.gender || selectedStudent.raw?.gender || "—";
        const email = userRec?.email || selectedStudent.email || "—";
        const dob = userRec?.dob || userRec?.birthDate || selectedStudent.dob || selectedStudent.raw?.dob || null;
        const age = computeAge(dob) ?? selectedStudent.age ?? "—";
        const parentUserId =
          parentRec?.userId ||
          selectedStudent.raw?.parentUserId ||
          selectedStudent.parentUserId ||
          null;
        const parentProfileImage = resolveProfileImage(
          parentRec?.profileImage,
          parentRec?.profile,
          selectedStudent?.raw?.parentProfileImage,
          selectedStudent?.parentProfileImage
        );

        const details = {
          fullName: userRec?.name || selectedStudent.name || "—",
          phone,
          gender,
          email,
          grade: selectedStudent.grade || "—",
          section: selectedStudent.section || "—",
          parentName,
          parentPhone,
          parentUserId,
          parentProfileImage,
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
          parentRec,
        };

        if (!cancelled) setSelectedStudentDetails(details);
      } catch (err) {
        console.error("Failed to derive student details", err);
        // keep fallback already set
      }
    };

    loadDetails();
    return () => { cancelled = true; };
  }, [selectedStudent, usersData]);

  // Ensure parent info is resolved from Parents node if not already present
  useEffect(() => {
    if (!selectedStudent) return;
    let cancelled = false;

    const resolveParent = async () => {
      try {
        const parentsRes = await axios.get(`${RTDB_BASE}/Parents.json`);
        const parentsObj = parentsRes.data || {};

        // candidate keys that might point to parent record or userId
        const candidates = [
          selectedStudent.raw?.parentId,
          selectedStudent.raw?.parentUserId,
          selectedStudent.parentId,
          selectedStudent.parentUserId,
        ].filter(Boolean);

        let foundParent = null;

        // direct lookup by key
        for (const k of candidates) {
          if (parentsObj[k]) {
            foundParent = parentsObj[k];
            break;
          }
          // also try matching parent.userId === k
          const byUserId = Object.values(parentsObj).find((p) => String(p.userId) === String(k));
          if (byUserId) {
            foundParent = byUserId;
            break;
          }
        }

        // if not found, search children lists for this student
        if (!foundParent) {
          const sid = selectedStudent.studentId || selectedStudent.userId;
          for (const p of Object.values(parentsObj)) {
            const children = p?.children || {};
            const match = Object.values(children).find((c) => String(c?.studentId) === String(sid));
            if (match) {
              foundParent = p;
              break;
            }
          }
        }

        let parentName = null;
        let parentPhone = null;

        if (foundParent) {
          parentName = foundParent.name || foundParent.displayName || null;
          parentPhone = foundParent.phone || foundParent.phoneNumber || foundParent.contact || null;

          // if parent has userId, try to enrich from Users node
          if ((!parentName || !parentPhone) && foundParent.userId) {
            try {
              const usersRes = await axios.get(`${RTDB_BASE}/Users.json`);
              const usersObj = usersRes.data || {};
              const userRec = Object.values(usersObj).find((u) => String(u.userId) === String(foundParent.userId));
              if (userRec) {
                parentName = parentName || userRec.name || null;
                parentPhone = parentPhone || userRec.phone || null;
              }
            } catch (err) {
              // ignore
            }
          }
        }

        if (!cancelled) {
          setSelectedStudentDetails((prev) => ({
            ...(prev || {}),
            parentName: parentName || prev?.parentName || "—",
            parentPhone: parentPhone || prev?.parentPhone || "—",
            parentUserId: foundParent?.userId || prev?.parentUserId || null,
            parentProfileImage: resolveProfileImage(
              foundParent?.profileImage,
              foundParent?.profile,
              prev?.parentProfileImage
            ),
          }));
        }
      } catch (err) {
        console.error("Error resolving parent info:", err);
      }
    };

    resolveParent();
    return () => (cancelled = true);
  }, [selectedStudent]);

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
  if (!selectedStudent?.studentId && !selectedStudent?.userId) {
    setAttendanceRecords([]);
    return;
  }

  let cancelled = false;
  const fetchAttendance = async () => {
    setAttendanceLoading(true);
    try {
      // Fetch attendance + teachers + users to resolve teacher names when available
      const [attendanceRes, teachersRes, usersRes, courseContext] = await Promise.all([
        axios.get(`${RTDB_BASE}/Attendance.json`),
        axios.get(`${RTDB_BASE}/Teachers.json`),
        axios.get(`${RTDB_BASE}/Users.json`),
        getTeacherCourseContext({ teacher: teacherInfo, rtdbBase: RTDB_BASE }),
      ]);
      const raw = attendanceRes.data || {};
      const teachersObj = teachersRes.data || {};
      const usersObj = usersRes.data || {};
      const assignmentsObj = courseContext.assignmentsByCourseId || {};

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
}, [selectedStudent]);

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
    if (!selectedStudent) {
      setStudentMarksFlattened({});
      return;
    }

    const fetchMarksForStudent = async () => {
      setLoading(true);
      try {
        const database = getDatabase();
        const snapshot = await get(dbRef(database, "ClassMarks"));
        if (!snapshot.exists()) {
          setStudentMarksFlattened({});
          setLoading(false);
          return;
        }

        const data = snapshot.val(); // object where keys are course_* and values are student maps
        const flattened = {};

        const candidates = new Set(
          [
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
        setLoading(false);
      }
    };

    fetchMarksForStudent();
  }, [selectedStudent]);

  const statusColor = (status) => (status === "present" ? "#34a853" : status === "absent" ? "#ea4335" : "#fbbc05");

  // ---------------- teacher note ----------------
  useEffect(() => {
    if (!selectedStudent?.userId) return;

    async function fetchTeacherNotes() {
      try {
        const res = await axios.get(
          `${RTDB_BASE}/StudentNotes/${selectedStudent?.userId}.json`
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
        `${RTDB_BASE}/StudentNotes/${selectedStudent?.userId}.json`,
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
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch messages for the selected student
  useEffect(() => {
    if (!teacherUserId || !selectedStudent) return;

    const chatKey = getChatId(teacherUserId, selectedStudent.userId);
    const messagesRef = dbRef(db, schoolPath(`Chats/${chatKey}/messages`));

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const msgs = Object.entries(data)
        .map(([id, m]) => ({
          id,
          ...m,
          isTeacher: m.senderId === teacherUserId,
        }))
        .sort((a, b) => a.timeStamp - b.timeStamp);

      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [teacherUserId, selectedStudent]);

  // Mark messages as seen when chat popup is open and there are unseen messages for this teacher
  useEffect(() => {
    if (!chatOpen || !selectedStudent || !teacherUserId) return;
    if (!messages || messages.length === 0) return;

    const unseen = messages.filter(
      (m) => String(m.receiverId) === String(teacherUserId) && !m.seen
    );
    if (unseen.length === 0) return;

    const chatId = getChatId(teacherUserId, selectedStudent.userId);
    const ts = Date.now();

    const payload = { messages: {}, unread: {} };
    unseen.forEach((m) => {
      // set seen + seenAt on each message
      payload.messages[m.id] = { ...(payload.messages[m.id] || {}), seen: true, seenAt: ts };
    });
    // clear unread for this teacher (remove the key)
    payload.unread[teacherUserId] = null;
    // also mark lastMessage as seen (merge field) so other clients can read it
    payload.lastMessage = { seen: true, seenAt: ts };

    axios
      .patch(`${RTDB_BASE}/Chats/${chatId}.json`, payload)
      .catch((err) => console.error("Failed to mark messages seen:", err));

  }, [chatOpen, messages, selectedStudent, teacherUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const sendMessage = async () => {
    if (!newMessageText.trim() || !selectedStudent) return;

    const senderId = teacherUserId;
    const receiverId = selectedStudent.userId;
    const chatId = getChatId(senderId, receiverId);
    const timeStamp = Date.now();

    const message = {
      senderId,
      receiverId,
      type: "text",
      text: newMessageText,
      seen: false,
      timeStamp,
    };

    await axios.post(
      `${RTDB_BASE}/Chats/${chatId}/messages.json`,
      message
    );

    await axios.patch(
      `${RTDB_BASE}/Chats/${chatId}.json`,
      {
        participants: { [senderId]: true, [receiverId]: true },
        lastMessage: { text: newMessageText, senderId, seen: false, timeStamp },
        unread: { [receiverId]: 1 },
      }
    );

    setNewMessageText("");
  };

  const handleOpenParentChat = () => {
    const parentUserId = String(selectedStudentDetails?.parentUserId || "").trim();
    if (!selectedStudent) {
      alert("Please select a student first.");
      return;
    }
    if (!parentUserId) {
      alert("No parent found for this student.");
      return;
    }

    const parentName = selectedStudentDetails?.parentName || "Parent";
    const parentProfileImage = resolveProfileImage(
      selectedStudentDetails?.parentProfileImage,
      selectedStudentDetails?.parentRec?.profileImage,
      selectedStudentDetails?.parentRec?.profile,
      "/default-profile.png"
    );

    const chatId = getChatId(teacherUserId, parentUserId);
    navigate("/all-chat", {
      state: {
        user: {
          userId: parentUserId,
          name: parentName,
          profileImage: parentProfileImage,
          type: "parent",
        },
        contact: {
          userId: parentUserId,
          name: parentName,
          profileImage: parentProfileImage,
          type: "parent",
        },
        chatId,
        tab: "parent",
      },
    });
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

  const listShellWidth = isPortrait ? "92%" : "560px";

  return (
    <div
      className="dashboard-page"
      style={{
        background: "var(--page-bg)",
        minHeight: "100vh",
        height: "100vh",
        overflow: "hidden",
        color: "var(--text-primary)",
        "--surface-panel": "#ffffff",
        "--surface-accent": "#eff6ff",
        "--surface-muted": "#f8fafc",
        "--surface-strong": "#e2e8f0",
        "--page-bg": "#f5f8ff",
        "--border-soft": "#e2e8f0",
        "--border-strong": "#cbd5e1",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": "#2563eb",
        "--accent-soft": "#dbeafe",
        "--accent-strong": "#1d4ed8",
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
        "--shadow-soft": "0 10px 24px rgba(15, 23, 42, 0.08)",
        "--shadow-panel": "0 14px 30px rgba(15, 23, 42, 0.10)",
        "--shadow-glow": "0 0 0 2px rgba(37, 99, 235, 0.18)",
      }}
    >
      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px", height: "calc(100vh - 73px)", overflow: "hidden" }}>
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
        <div style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", overflowX: "hidden", display: "flex", justifyContent: "flex-start", padding: "10px 20px 20px", boxSizing: "border-box" }}>
           <div
             className="student-list-card-responsive"
             style={{
               width: listShellWidth,
               position: "relative",
               marginLeft: 0,
               marginRight: isPortrait ? 0 : "24px",
             }}
           >
             <style>{`
               @media (max-width: 600px) {
                 .student-list-card-responsive {
                   margin-left: -16px !important;
                   margin-right: auto !important;
                   width: 70vw !important;
                   max-width: 70vw !important;
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
                max-width: 100vw;
                margin-left: 0;
                margin-right: 0;
              }
              @media (max-width: 600px) {
                .student-list-responsive {
                  width: 100vw !important;
                  max-width: 100vw !important;
                  margin-left: 0 !important;
                  margin-right: 0 !important;
                  padding: 0 !important;
                  align-items: flex-start !important;
                }
                .student-list-responsive > div {
                  margin-left: 10px !important;
                  padding-left: 10px !important;
                  width: 100vw !important;
                  max-width: 100vw !important;
                  min-width: 100vw !important;
                  box-sizing: border-box !important;
                }
              }
              @media (min-width: 350px) {
                .student-list-responsive {
                  width: 400px;
                  max-width: 90vw;
                }
              }
               @media (max-width: 600px) {
                 .student-list-card-responsive {
                   margin-left: -32px !important;
                   margin-right: auto !important;
                   width: 80vw !important;
                   max-width: 80vw !important;
                 }
               }
                  width: 500px;
                  max-width: 80vw;
                }
              }
              @media (min-width: 1200px) {
                .student-list-responsive {
                  width: 420px;
                  max-width: 520px;
                  margin-left: 0;
                }
              }
              @media (min-width: 1500px) {
                .student-list-responsive {
                  width: 420px;
                  max-width: 520px;
                  margin-left: 0;
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
      background: "var(--page-bg-secondary, var(--surface-muted))",
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
        <img
          src={selectedStudent.profileImage}
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
      })}
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
                      {["semester1", "semester2"].map((sem) => {
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
                            {sem === "semester1" ? "Semester 1" : "Semester 2"}
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
                      {loading ? (
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
                        Object.entries(studentMarksFlattened).map(([courseKey, studentCourseData], idx) => {
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

                              {/* If quarter data exists, render Quarter 1 & Quarter 2; otherwise fall back to semester assessments */}
                              {(() => {
                                const q1 = data.q1 || data.quarter1 || data.q_1 || null;
                                const q2 = data.q2 || data.quarter2 || data.q_2 || null;

                                const renderQuarterBlock = (label, qdata) => {
                                  const qAss = qdata?.assessments || qdata || {};
                                  const qTotal = Object.values(qAss).reduce((s, a) => s + (a.score || 0), 0);
                                  const qMax = Object.values(qAss).reduce((s, a) => s + (a.max || 0), 0);
                                  const qPct = qMax ? (qTotal / qMax) * 100 : 0;
                                  const clr = qPct >= 75 ? '#16a34a' : qPct >= 50 ? '#f59e0b' : '#dc2626';

                                  return (
                                    <div style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #f1f5f9', background: '#fff' }}>
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

                                if (q1 || q2) {
                                  return (
                                    <div style={{ display: 'flex', gap: 10 }}>
                                      {renderQuarterBlock('Quarter 1', q1)}
                                      {renderQuarterBlock('Quarter 2', q2)}
                                    </div>
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
                  onClick={() => setChatOpen(true)}
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
                    <strong>{selectedStudent.name}</strong>

                    <div style={{ display: "flex", gap: "10px" }}>
                      {/* Expand */}
                      <button
                        onClick={() => {
                          setChatOpen(false); // properly close popup
                          const chatId = getChatId(teacherUserId, selectedStudent.userId);
                          navigate("/all-chat", {
                            state: {
                              user: selectedStudent, // user to auto-select
                              chatId, // open the exact chat thread
                              tab: "student", // tab type
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
                        onClick={() => setChatOpen(false)}
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
                    {messages.length === 0 ? (
                      <p style={{ textAlign: "center", color: "#aaa" }}>
                        Start chatting with {selectedStudent.name}
                      </p>
                    ) : (
                      messages.map((m) => {
                        const isTeacher = String(m.senderId) === String(teacher?.userId);

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

