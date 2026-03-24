import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FaSave,
  FaHome,
  FaSignOutAlt,
  FaUsers,
  FaChalkboardTeacher,
  FaClipboardCheck
  , FaFileExcel, FaPrint, FaFileDownload,
   FaUserCheck,
  FaCalendarAlt,
  FaBookOpen
} from "react-icons/fa";
import Sidebar from "./Sidebar";
import "../styles/global.css";

import { API_BASE } from "../api/apiConfig";
import { getRtdbRoot } from "../api/rtdbScope";
import { getTeacherCourseContext } from "../api/teacherApi";
const RTDB_BASE = getRtdbRoot();

// Format student name: capitalize first letter of each word, rest lowercase
const formatStudentName = (rawName) => {
  if (!rawName) return "";
  return String(rawName)
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
};

const toSubjectKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const getSubjectKeyVariants = (value) => {
  const base = toSubjectKey(value);
  const set = new Set([base]);
  if (base === "mathematics" || base === "math") set.add("maths");
  if (base === "maths") {
    set.add("mathematics");
    set.add("math");
  }
  return Array.from(set).filter(Boolean);
};

export default function MarksPage() {
  // Sidebar toggle state for mobile (like Dashboard)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 600);
  const [teacher, setTeacher] = useState(null);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [assessmentList, setAssessmentList] = useState([]);
  const [assessmentMode, setAssessmentMode] = useState("semester");
  const [studentMarks, setStudentMarks] = useState({});
  const [noStudentsInCourse, setNoStudentsInCourse] = useState(false);
  const [structureSubmitted, setStructureSubmitted] = useState(false);
  const [activeSemester, setActiveSemester] = useState("semester2"); // default
  const [quartersBySem, setQuartersBySem] = useState({ semester1: ["q1", "q2"], semester2: ["q1", "q2"] });
  const [selectedQuarter, setSelectedQuarter] = useState("q1");
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [messageNotifications, setMessageNotifications] = useState([]);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]);

  // Responsive handling for sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 600) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ---------------- LOAD TEACHER ----------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  const teacherUserId = teacher?.userId;

  // Messenger conversations fetch
  useEffect(() => {
    if (teacher) {
      fetchConversations(teacher);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher]);

  // Fetch teacher's assigned courses (populates Select Course)
  useEffect(() => {
    if (!teacher) return;
    const fetchCourses = async () => {
      try {
        const context = await getTeacherCourseContext({ teacher, rtdbBase: RTDB_BASE });
        const teacherCourses = context.courses || [];
        setCourses(teacherCourses);
        if (!selectedCourseId && teacherCourses.length > 0) setSelectedCourseId(teacherCourses[0].id);
      } catch (err) {
        console.error("Error fetching courses:", err);
      }
    };
    fetchCourses();
  }, [teacher]);

  // Load marks for course/semester is handled in the effect below
  useEffect(() => {
    if (!selectedCourseId) return;
    const loadCourseData = async () => {
      try {
        const course = courses.find((c) => c.id === selectedCourseId);
        if (!course) return;

        const subjectVariants = getSubjectKeyVariants(course.subject || course.name || "");
        const [marksRes, templateRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/ClassMarks/${selectedCourseId}.json`),
          axios.get(
            `${RTDB_BASE}/AssesmentTemplates/${encodeURIComponent(course.grade)}.json`
          ).catch(() => ({ data: {} })),
        ]);

        const gradeTemplateNode =
          templateRes.data && typeof templateRes.data === "object" ? templateRes.data : {};

        const findSubjectTemplateNode = () => {
          for (const key of subjectVariants) {
            if (gradeTemplateNode[key] && typeof gradeTemplateNode[key] === "object") {
              return gradeTemplateNode[key];
            }
          }

          const entries = Object.entries(gradeTemplateNode || {});
          for (const [nodeKey, subjectNode] of entries) {
            if (!subjectNode || typeof subjectNode !== "object") continue;
            if (subjectVariants.includes(toSubjectKey(nodeKey))) return subjectNode;

            const semEntries = Object.entries(subjectNode).filter(
              ([semKey, semVal]) => /^semester\d+$/i.test(semKey) && semVal && typeof semVal === "object"
            );
            for (const [, semNode] of semEntries) {
              const embeddedSubject = toSubjectKey(semNode?.subject || "");
              if (embeddedSubject && subjectVariants.includes(embeddedSubject)) {
                return subjectNode;
              }
            }
          }

          return null;
        };

        const subjectTemplateNode = findSubjectTemplateNode() || {};
        const templateSemNode =
          subjectTemplateNode && typeof subjectTemplateNode === "object"
            ? (subjectTemplateNode[activeSemester] && typeof subjectTemplateNode[activeSemester] === "object"
                ? subjectTemplateNode[activeSemester]
                : {})
            : {};
        const hasQuarterTemplate = Object.keys(templateSemNode).some((k) => /^q\d+$/i.test(k));
        const templateMode =
          templateSemNode.mode === "quarter"
            ? "quarter"
            : templateSemNode.mode === "semester"
            ? "semester"
            : hasQuarterTemplate
            ? "quarter"
            : "semester";
        setAssessmentMode(templateMode);

        const normalizedCourseGrade = String(course.grade ?? "").trim();
        const normalizedCourseSection = String(course.section ?? "").trim().toLowerCase();
        const filteredStudents = students.filter(
          (s) =>
            String(s.grade ?? "").trim() === normalizedCourseGrade &&
            String(s.section ?? "").trim().toLowerCase() === normalizedCourseSection
        );
        setNoStudentsInCourse(filteredStudents.length === 0);

        if (!filteredStudents.length) {
          setStudentMarks({});
          setAssessmentList([]);
          setStructureSubmitted(false);
          setQuartersBySem((p) => ({ ...p, [activeSemester]: ["q1"] }));
          setSelectedQuarter("q1");
          return;
        }

        const initMarks = {};
        let assessmentListFromDB = [];

        const cloneAssessments = (assessments) => {
          const src = assessments && typeof assessments === "object" ? assessments : {};
          const out = {};
          Object.entries(src).forEach(([key, value]) => {
            const item = value && typeof value === "object" ? value : {};
            out[key] = {
              name: String(item.name || "").trim(),
              max: Number(item.max || 0),
              score: item.score === "" ? "" : Number(item.score || 0),
            };
          });
          return out;
        };

        const getTemplateAssessmentsForSelection = () => {
          if (templateMode === "quarter") {
            const quarterNode = templateSemNode?.[selectedQuarter];
            if (quarterNode && typeof quarterNode === "object" && quarterNode.assessments) {
              return cloneAssessments(quarterNode.assessments);
            }
          }
          if (templateSemNode && typeof templateSemNode === "object" && templateSemNode.assessments) {
            return cloneAssessments(templateSemNode.assessments);
          }
          if (templateMode === "quarter") {
            const firstQuarterNode = Object.entries(templateSemNode || {}).find(([k, v]) =>
              /^q\d+$/i.test(k) && v && typeof v === "object" && v.assessments
            );
            if (firstQuarterNode) return cloneAssessments(firstQuarterNode[1].assessments);
          }
          return {};
        };

        const mergeScoresIntoTemplate = (templateAssessments, existingAssessments) => {
          const merged = cloneAssessments(templateAssessments);
          const existing = existingAssessments && typeof existingAssessments === "object" ? existingAssessments : {};
          const existingByName = {};
          Object.values(existing).forEach((item) => {
            const nameKey = String(item?.name || "").trim().toLowerCase();
            if (!nameKey) return;
            existingByName[nameKey] = item;
          });

          Object.entries(merged).forEach(([key, item]) => {
            const byKey = existing[key];
            const byName = existingByName[String(item.name || "").trim().toLowerCase()];
            const picked = byKey && typeof byKey === "object" ? byKey : byName;
            if (!picked || typeof picked !== "object") return;
            const scoreValue = picked.score;
            item.score = scoreValue === "" ? "" : Number(scoreValue || 0);
          });

          return merged;
        };

        const quarterSet = new Set();
        if (templateMode === "quarter") {
          filteredStudents.forEach((s) => {
            const semData = marksRes.data?.[s.id]?.[activeSemester];
            if (semData && typeof semData === "object") {
              Object.keys(semData).forEach((k) => {
                if (k && k.toLowerCase().startsWith("q")) quarterSet.add(k);
              });
            }
          });
          Object.keys(templateSemNode || {}).forEach((k) => {
            if (k && k.toLowerCase().startsWith("q")) quarterSet.add(k);
          });
        }

        const quartersArrRaw = templateMode === "quarter" ? Array.from(quarterSet) : ["q1"];
        if (templateMode === "quarter") {
          const required = ["q1", "q2"];
          required.forEach((rq) => {
            if (!quartersArrRaw.includes(rq)) quartersArrRaw.push(rq);
          });
          if (!quartersArrRaw.includes("avg")) quartersArrRaw.push("avg");
        }

        const quartersArr = quartersArrRaw
          .filter((q) => q !== "avg")
          .sort((a, b) => {
            const na = parseInt(String(a).replace(/^q/i, ""), 10) || 0;
            const nb = parseInt(String(b).replace(/^q/i, ""), 10) || 0;
            return na - nb;
          });
        if (templateMode === "quarter" && !quartersArr.includes("avg")) quartersArr.push("avg");
        setQuartersBySem((p) => ({ ...p, [activeSemester]: quartersArr }));

        // Ensure selectedQuarter exists for this semester
        if (!quartersArr.includes(selectedQuarter)) setSelectedQuarter(quartersArr[0]);

        const templateAssessmentsForSelection = getTemplateAssessmentsForSelection();

        filteredStudents.forEach((s) => {
          const semData = marksRes.data?.[s.id]?.[activeSemester];
          if (templateMode === "quarter" && selectedQuarter === 'avg') {
            // compute average percentage across q1 and q2
            const q1 = semData?.q1?.assessments || {};
            const q2 = semData?.q2?.assessments || {};
            const sumScores = (obj) => Object.values(obj).reduce((sum, it) => sum + (it.score || 0), 0);
            const sumMax = (obj) => Object.values(obj).reduce((sum, it) => sum + (it.max || 0), 0);
            const total1 = sumScores(q1); const max1 = sumMax(q1);
            const total2 = sumScores(q2); const max2 = sumMax(q2);
            const pct1 = max1 > 0 ? (total1 / max1) * 100 : 0;
            const pct2 = max2 > 0 ? (total2 / max2) * 100 : 0;
            const avgPct = (pct1 + pct2) / 2;
            // store as a single assessment column 'avg'
            initMarks[s.id] = { avg: { name: 'Average', max: 100, score: Number(avgPct.toFixed(1)) } };
            if (!assessmentListFromDB.length) assessmentListFromDB = [{ name: 'Average', max: 100 }];
          } else {
            const existingAssessments =
              templateMode === "quarter"
                ? semData?.[selectedQuarter]?.assessments || semData?.assessments || {}
                : semData?.assessments || semData?.[selectedQuarter]?.assessments || {};

            if (Object.keys(templateAssessmentsForSelection).length) {
              initMarks[s.id] = mergeScoresIntoTemplate(templateAssessmentsForSelection, existingAssessments);
              if (!assessmentListFromDB.length) assessmentListFromDB = Object.values(templateAssessmentsForSelection);
            } else if (existingAssessments && Object.keys(existingAssessments).length) {
              const clonedExisting = cloneAssessments(existingAssessments);
              initMarks[s.id] = clonedExisting;
              if (!assessmentListFromDB.length) assessmentListFromDB = Object.values(clonedExisting);
            } else {
              initMarks[s.id] = {};
            }
          }
        });

        setStudentMarks(initMarks);
        setAssessmentList(assessmentListFromDB.map((a) => ({ name: a.name, max: a.max })));
        setStructureSubmitted(assessmentListFromDB.length > 0);
      } catch (err) {
        console.error("Error loading marks:", err);
        setNoStudentsInCourse(false);
        setStructureSubmitted(false);
        setStudentMarks({});
      }
    };
    loadCourseData();
    // include selectedQuarter so loading reflects quarter change
  }, [selectedCourseId, courses, students, activeSemester, selectedQuarter]);

  // Fetch all students (mapped with user profiles)
  useEffect(() => {
    if (!teacherUserId) return;
    const fetchStudents = async () => {
      try {
        const [studentsRes, usersRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/Students.json`),
          axios.get(`${RTDB_BASE}/Users.json`),
        ]);
        const studentsData = studentsRes.data || {};
        const usersData = usersRes.data || {};
        const mappedStudents = Object.entries(studentsData).map(([id, s]) => ({
          id,
          ...s,
          name: usersData?.[s.userId]?.name || "Unknown",
          profileImage: usersData?.[s.userId]?.profileImage || "/default-profile.png",
          gender: usersData?.[s.userId]?.gender || usersData?.[s.userId]?.sex || "",
          dob: usersData?.[s.userId]?.dob || "",
          age: usersData?.[s.userId]?.age || "",
        }));
        setStudents(mappedStudents);
      } catch (err) {
        console.error("Error fetching students:", err);
      }
    };
    fetchStudents();
  }, [teacherUserId]);

  const updateScore = (sid, key, value) => {
    // allow empty string while editing (treat as no input), otherwise store numeric
    setStudentMarks((p) => ({
      ...p,
      [sid]: { ...p[sid], [key]: { ...p[sid][key], score: value === '' ? '' : Number(value) } },
    }));
  };
  const templateMissingMessage =
    "Assessment template is not available. Ask admin to create it first in AssessmentTemplates.";

  const saveMarks = async (sid) => {
    if (!structureSubmitted || !assessmentList.length) {
      alert(templateMissingMessage);
      return;
    }
    try {
      // Save into the currently selected quarter (per-quarter model)
      await axios.put(
        assessmentMode === "quarter"
          ? `${RTDB_BASE}/ClassMarks/${selectedCourseId}/${sid}/${activeSemester}/${selectedQuarter}.json`
          : `${RTDB_BASE}/ClassMarks/${selectedCourseId}/${sid}/${activeSemester}.json`,
        {
          teacherName: teacher?.name || "",
          assessments: studentMarks[sid],
        }
      );
      alert("Marks saved successfully");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save marks");
    }
  };

  // Save all students' marks at once for the selected course/semester/quarter
  const saveAllMarks = async () => {
    if (noStudentsInCourse) {
      alert("No students are assigned to this course/class yet.");
      return;
    }
    if (!structureSubmitted || !assessmentList.length) {
      alert(templateMissingMessage);
      return;
    }
    if (!selectedCourseId || (assessmentMode === "quarter" && selectedQuarter === 'avg')) {
      alert('Please select a valid course and quarter');
      return;
    }
    try {
      const entries = Object.entries(studentMarks || {});
      await Promise.all(
        entries.map(([sid, marks]) =>
          axios.put(
            assessmentMode === "quarter"
              ? `${RTDB_BASE}/ClassMarks/${selectedCourseId}/${sid}/${activeSemester}/${selectedQuarter}.json`
              : `${RTDB_BASE}/ClassMarks/${selectedCourseId}/${sid}/${activeSemester}.json`,
            { teacherName: teacher?.name || '', assessments: marks }
          )
        )
      );
      alert('All marks saved successfully');
    } catch (err) {
      console.error('Save all failed:', err);
      alert('Failed to save all marks');
    }
  };
  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // ---------------- NOTIFICATIONS ----------------
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Fetch posts
        const res = await axios.get(`${API_BASE}/get_posts`);
        let postsData = res.data || [];
        if (!Array.isArray(postsData) && typeof postsData === "object") postsData = Object.values(postsData);
        const [adminsRes, usersRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/School_Admins.json`),
          axios.get(`${RTDB_BASE}/Users.json`)
        ]);
        const schoolAdmins = adminsRes.data || {};
        const users = usersRes.data || {};
        const teacherLocal = JSON.parse(localStorage.getItem("teacher"));
        const seenPosts = getSeenPosts(teacherLocal?.userId);
        const resolveAdminInfo = (post) => {
          const adminId = post.adminId || post.posterAdminId || post.poster || post.admin || null;
          if (adminId && schoolAdmins[adminId]) {
            const sa = schoolAdmins[adminId];
            const userKey = sa.userId;
            const userRec = users[userKey] || null;
            const name = (userRec && userRec.name) || sa.name || post.adminName || "Admin";
            const profile = (userRec && userRec.profileImage) || sa.profileImage || post.adminProfile || "/default-profile.png";
            return { name, profile };
          }
          return { name: post.adminName || "Admin", profile: post.adminProfile || "/default-profile.png" };
        };
        const latestPosts = postsData
          .slice()
          .sort((a, b) => ((b.time ? new Date(b.time).getTime() : 0) - (a.time ? new Date(a.time).getTime() : 0)))
          .filter((post) => post.postId && !seenPosts.includes(post.postId))
          .slice(0, 5)
          .map((post) => {
            const info = resolveAdminInfo(post);
            return {
              type: "post",
              id: post.postId,
              title: post.message?.substring(0, 50) || "Untitled post",
              adminName: info.name,
              adminProfile: info.profile
            };
          });

        // Fetch unread messages (conversations)
        let messageNotifs = [];
        try {
          const t = teacherLocal;
          if (t && t.userId) {
            const [chatsRes, usersRes] = await Promise.all([
              axios.get(`${RTDB_BASE}/Chats.json`),
              axios.get(`${RTDB_BASE}/Users.json`)
            ]);
            const chats = chatsRes.data || {};
            const users = usersRes.data || {};
            const usersByKey = users || {};
            const userKeyByUserId = {};
            Object.entries(usersByKey).forEach(([pushKey, u]) => { if (u && u.userId) userKeyByUserId[u.userId] = pushKey; });
            messageNotifs = Object.entries(chats)
              .map(([chatId, chat]) => {
                const unreadMap = chat.unread || {};
                const unreadForMe = unreadMap[t.userId] || 0;
                if (!unreadForMe) return null;
                const participants = chat.participants || {};
                const otherKeyCandidate = Object.keys(participants || {}).find((p) => p !== t.userId);
                if (!otherKeyCandidate) return null;
                let otherPushKey = otherKeyCandidate;
                let otherRecord = usersByKey[otherPushKey];
                if (!otherRecord) {
                  const mapped = userKeyByUserId[otherKeyCandidate];
                  if (mapped) { otherPushKey = mapped; otherRecord = usersByKey[mapped]; }
                }
                if (!otherRecord) otherRecord = { userId: otherKeyCandidate, name: otherKeyCandidate, profileImage: "/default-profile.png" };
                const contact = { pushKey: otherPushKey, userId: otherRecord.userId || otherKeyCandidate, name: otherRecord.name || otherRecord.username || otherKeyCandidate, profileImage: otherRecord.profileImage || otherRecord.profile || "/default-profile.png" };
                const lastMessage = chat.lastMessage || {};
                return {
                  type: "message",
                  chatId,
                  displayName: contact.name,
                  profile: contact.profileImage,
                  lastMessageText: lastMessage.text || "",
                  lastMessageTime: lastMessage.timeStamp || lastMessage.time || null,
                  unreadForMe
                };
              })
              .filter(Boolean)
              .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
          }
        } catch (err) {
          console.error("Error fetching message notifications:", err);
        }
        setNotifications([...latestPosts, ...messageNotifs]);
        setMessageNotifications(messageNotifs);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };
    fetchNotifications();
  }, []);

  // Messenger fetching
  const fetchConversations = async (currentTeacher = teacher) => {
    try {
      const t = currentTeacher || JSON.parse(localStorage.getItem("teacher"));
      if (!t || !t.userId) {
        setConversations([]);
        return;
      }
      const [chatsRes, usersRes] = await Promise.all([axios.get(`${RTDB_BASE}/Chats.json`), axios.get(`${RTDB_BASE}/Users.json`)]);
      const chats = chatsRes.data || {};
      const users = usersRes.data || {};
      const usersByKey = users || {};
      const userKeyByUserId = {};
      Object.entries(usersByKey).forEach(([pushKey, u]) => {
        if (u && u.userId) userKeyByUserId[u.userId] = pushKey;
      });
      const convs = Object.entries(chats)
        .map(([chatId, chat]) => {
          const unreadMap = chat.unread || {};
          const unreadForMe = unreadMap[t.userId] || 0;
          if (!unreadForMe) return null;
          const participants = chat.participants || {};
          const otherKeyCandidate = Object.keys(participants || {}).find((p) => p !== t.userId);
          if (!otherKeyCandidate) return null;
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
    // navigate to AllChat with contact + chatId
    navigate("/all-chat", { state: { contact, chatId, tab: "marks" } });
    // clear unread in RTDB for this teacher
    try {
      await axios.put(`${RTDB_BASE}/Chats/${chatId}/unread/${teacher.userId}.json`, null);
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }
    // remove from local UI and close dropdown
    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };
  const totalUnreadMessages = messageNotifications.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);

  // --- Mark notification as seen ---
  const handleNotificationClick = (postId) => {
    if (!teacher || !postId) return;
    saveSeenPost(teacher.userId, postId);
    setNotifications(prev => prev.filter((n) => n.id !== postId));
    setShowNotifications(false);
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

  // --- Table scroll buttons ---
  const marksWrapperRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollMarks = (direction) => {
    const el = marksWrapperRef.current;
    if (!el) return;
    const amount = Math.max(Math.floor(el.clientWidth * 0.9), 420);
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  };
  const updateScrollButtons = () => {
    const el = marksWrapperRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
  };
  useEffect(() => {
    const el = marksWrapperRef.current;
    if (!el) return;
    updateScrollButtons();
    const onScroll = () => updateScrollButtons();
    const onResize = () => updateScrollButtons();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [structureSubmitted, assessmentList.length]);

  // --- Responsive CSS for mobile table ---
  // Add this CSS to your global.css file if not already present
  // Or you can use a <style> block here
  useEffect(() => {
    const styleId = "responsive-marks-table-style";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      /* Make marks table fluid and match attendance layout */
      .marks-table-wrapper { width: 100% !important; max-width: 100vw !important; overflow-x: auto !important; padding: 0 1rem !important; }
      .marks-table { width: 100% !important; table-layout: auto !important; min-width: 0 !important; border-collapse: collapse !important; }
      .marks-table th, .marks-table td { font-size: 13px !important; padding: 8px !important; white-space: normal !important; word-break: break-word !important; overflow-wrap: anywhere !important; }
      .marks-table td input { width: 100% !important; box-sizing: border-box !important; min-width: 40px !important; }

      /* Remove number input spinner buttons so teachers use keyboard entry only */
      .marks-table td input[type=number]::-webkit-outer-spin-button,
      .marks-table td input[type=number]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .marks-table td input[type=number] { -moz-appearance: textfield; }

      @media (max-width: 600px) {
        .google-main { margin-left: 0 !important; padding-left: 0 !important; width: 100vw !important; max-width: 100vw !important; }
        .marks-table-wrapper { padding: 0 2vw !important; }
        .marks-table th, .marks-table td { font-size: 12px !important; padding: 6px !important; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // --- Export / Print helpers ---
  const buildTableRows = () => {
    const headers = ["Student", ...assessmentList.map(a => `${a.name} (${a.max})`), "Total", "Grade"];
    const rows = [headers];
    Object.entries(studentMarks).forEach(([sid, marks]) => {
      const student = students.find((s) => s.id === sid) || { name: sid };
      const scores = Object.values(marks).map((m) => (m.score != null ? m.score : ""));
      const total = Object.values(marks).reduce((s, a) => s + (a.score || 0), 0);
      const grade =
        total >= 90
          ? "A"
          : total >= 80
          ? "B"
          : total >= 70
          ? "C"
          : total >= 60
          ? "D"
          : "F";
      rows.push([student.name, ...scores, total, grade]);
    });
    return rows;
  };

  const downloadCSV = (filename = "marks.csv") => {
    const rows = buildTableRows();
    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            if (cell == null) return "";
            const cellStr = String(cell);
            return cellStr.includes(",") || cellStr.includes("\n") ? `"${cellStr.replace(/"/g, '""')}"` : cellStr;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadExcel = (filename = "marks.xls") => {
    // Build a richer Excel layout similar to the provided marklist screenshot
    const course = courses.find((c) => c.id === selectedCourseId) || {};
    // No per-semester active index state in this component yet — default to q1
    const activeQuarterIdx = 0;
    // Determine assessment metadata and order
    let assList = assessmentList && assessmentList.length ? assessmentList : [];
    const assessmentKeys = assList.length ? assList.map((_, i) => `a${i + 1}`) : [];
    const headers = ["No", "Name", "Gender", "Age"];
    // include father column if any student has it
    const includeFather = students.some((s) => s.father || s.fatherName || s.parentName);
    if (includeFather) headers.push("Father");
    headers.push(...assList.map((a) => `${a.name} (${a.max})`));
    headers.push("Total", "Percent");

    // collect filtered students in course
    const filteredStudents = students.filter((s) => s.grade === course.grade && s.section === course.section);

    const rows = [headers];
    filteredStudents.forEach((s, idx) => {
      const marks = studentMarks[s.id] || {};
      const scores = assessmentKeys.map((k) => Number(marks[k]?.score ?? 0));
      const maxes = assList.map((a) => Number(a.max || 0));
      const sumScores = scores.reduce((a, b) => a + b, 0);
      const sumMax = maxes.reduce((a, b) => a + b, 0) || 100;
      const percent = sumMax > 0 ? (sumScores / sumMax) * 100 : 0;
      const extra = includeFather ? [s.father || s.fatherName || s.parentName || ''] : [];
      const gender = s.gender || s.sex || '';
      const age = (() => {
        if (s.dob) {
          const d = new Date(s.dob);
          if (!isNaN(d)) return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
        }
        return s.age || '';
      })();
      const row = [idx + 1, s.name, gender, age, ...extra, ...scores, sumScores, `${percent.toFixed(1)}%`];
      rows.push(row);
    });

    // Build HTML with title and info rows
    const totalCols = headers.length;
    let html = `<table border="1" style="border-collapse:collapse;width:100%">`;
    const marklistTitle = `${course.subject || ''} Marklist`;
    html += `<tr><th colspan="${totalCols}" style="text-align:center;font-weight:700;font-size:18px;padding:8px">${marklistTitle}</th></tr>`;
    html += `<tr><td style="padding:6px;font-weight:600">${'Quarter ' + (activeQuarterIdx + 1)}</td><td colspan="${totalCols - 1}" style="padding:6px;text-align:left">Grade ${course.grade || ''} &nbsp;&nbsp; Subject ${course.subject || ''}</td></tr>`;
    html += `<tr><td colspan="${totalCols}" style="text-align:center;font-weight:600;padding:4px">Semester: ${activeSemester}</td></tr>`;
    html += '<tr>' + headers.map(h => `<th style="background:#f3f4f6;padding:8px">${String(h)}</th>`).join('') + '</tr>';
    rows.slice(1).forEach(r => { html += '<tr>' + r.map(c => `<td style="padding:6px">${String(c ?? '').replace(/</g, '&lt;')}</td>`).join('') + '</tr>'; });
    html += `<tr><td colspan="${totalCols}" style="padding-top:16px">&nbsp;</td></tr>`;
    html += `<tr><td colspan="${Math.ceil(totalCols/2)}">Teacher's Name: ____________________</td><td colspan="${Math.floor(totalCols/2)}">Director's Approval: ____________________</td></tr>`;
    html += `<tr><td colspan="${Math.ceil(totalCols/2)}">Signature: __________ Date: ________</td><td colspan="${Math.floor(totalCols/2)}">School Stamp: __________</td></tr>`;
    html += '</table>';

    const uri = 'data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent(html);
    const link = document.createElement('a');
    link.href = uri;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const wrapper = marksWrapperRef.current;
    if (!wrapper) return window.print();
    const html = `<!doctype html><html><head><title>Marks</title><meta charset="utf-8"><style>table{border-collapse:collapse;}td,th{padding:8px;border:1px solid #ccc;}</style></head><body>${wrapper.innerHTML}</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return alert("Pop-up blocked. Please allow popups to print.");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 200);
  };

  const isMobile = window.innerWidth <= 600;

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
      }}
    >
      <div className="google-dashboard" style={{ display: "flex", gap: 0, padding: 0, height: "calc(100vh - 73px)", overflow: "hidden" }}>
        <Sidebar
          active="marks"
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
        <div
          className="google-main"
          style={{
            flex: 1,
            width: "100%",
            minWidth: 0,
            height: "100%",
            marginLeft: 0,
            padding: isMobile ? "0 8px" : "0 18px",
            overflowY: "auto",
            overflowX: "hidden",
            textAlign: "left",
          }}
        >
          <div className="main-inner" style={{ padding: isMobile ? "10px 0 20px" : "20px 0", width: "100%", maxWidth: "100%", margin: 0 }}>
            <div className="section-header-card" style={{ marginBottom: 16 }}>
              <h2 className="section-header-card__title" style={{ fontSize: 24 }}>Marks Entry Dashboard</h2>
              <div className="section-header-card__meta">
                <span>{activeSemester === "semester1" ? "Semester 1" : "Semester 2"}</span>
                <span className="section-header-card__chip">Teacher View</span>
              </div>
            </div>

            <div
              style={{
                marginBottom: "14px",
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "12px",
                background: "var(--surface-panel)",
                border: "1px solid var(--border-soft)",
                boxShadow: "var(--shadow-soft)",
                borderRadius: 14,
                padding: isMobile ? "12px" : "14px 16px",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  fontWeight: "600",
                  color: "var(--text-secondary)",
                  fontSize: "14px",
                }}
              >
                Select Course:
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "12px",
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface-panel)",
                  minWidth: isMobile ? "100%" : "300px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">-- Select Course --</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.subject} - Grade {c.grade} Section {c.section}
                  </option>
                ))}
              </select>
            </div>
            {/* Semester Tabs */}
            {selectedCourseId && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-start",
                  gap: "10px",
                  marginBottom: "14px",
                  borderBottom: "1px solid var(--border-soft)",
                  paddingBottom: "8px",
                  overflowX: "auto",
                }}
              >
                {["semester1", "semester2"].map((sem) => {
                  const isActive = activeSemester === sem;
                  return (
                    <button
                      key={sem}
                      onClick={() => {
                        setActiveSemester(sem);
                        setStructureSubmitted(false);
                        setAssessmentList([]);
                        setStudentMarks({});
                      }}
                      style={{
                        background: isActive ? "var(--accent-soft)" : "var(--surface-panel)",
                        border: isActive ? "1px solid color-mix(in srgb, var(--accent-strong) 34%, white)" : "1px solid var(--border-soft)",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "700",
                        color: isActive ? "var(--accent-strong)" : "var(--text-muted)",
                        padding: "8px 12px",
                        borderRadius: 10,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sem === "semester1" ? "Semester 1" : "Semester 2"}
                    </button>
                  );
                })}
              </div>
            )}

    {selectedCourseId && (
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap", background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 14, boxShadow: "var(--shadow-soft)", padding: isMobile ? "12px" : "12px 16px" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: 13 }}>
            {assessmentMode === "quarter" ? "Quarter:" : "Mode:"}
          </span>
          {(quartersBySem[activeSemester] || ['q1','q2']).map((q) => (
            <button
              key={q}
              onClick={() => setSelectedQuarter(q)}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: selectedQuarter === q ? '1px solid color-mix(in srgb, var(--accent-strong) 34%, white)' : '1px solid var(--border-soft)',
                background: selectedQuarter === q ? 'var(--accent-soft)' : 'var(--surface-panel)',
                cursor: 'pointer',
                fontWeight: 700,
                color: selectedQuarter === q ? 'var(--accent-strong)' : 'var(--text-muted)',
              }}
            >
              {assessmentMode === "semester" ? "SEM" : q.toUpperCase()}
            </button>
          ))}
          {/* Two quarters by default (q1, q2) - Add Quarter removed */}
        </div>
        {structureSubmitted ? (
          <>
            <button
              onClick={() => downloadExcel()}
              style={{
                padding: "10px 16px",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer"
              }}
              title="Download as Excel"
            >
              <FaFileExcel /> Download Excel
            </button>
            <button
              onClick={() => saveAllMarks()}
              disabled={!structureSubmitted || !assessmentList.length || (assessmentMode === "quarter" && selectedQuarter === 'avg')}
              style={{
                padding: "10px 16px",
                background: !structureSubmitted || !assessmentList.length || (assessmentMode === "quarter" && selectedQuarter === 'avg') ? "var(--surface-strong)" : "var(--accent-strong)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: !structureSubmitted || !assessmentList.length || (assessmentMode === "quarter" && selectedQuarter === 'avg') ? "not-allowed" : "pointer"
              }}
              title="Save all marks for current quarter"
            >
              <FaSave /> Save All
            </button>
          </>
        ) : null}
      </div>
    )}

            {/* Template Required Notice */}
            {selectedCourseId && noStudentsInCourse && (
              <div
                style={{
                  background: "var(--surface-panel)",
                  padding: isMobile ? "14px" : "20px",
                  borderRadius: "14px",
                  border: "1px solid var(--border-soft)",
                  boxShadow: "var(--shadow-soft)",
                  marginBottom: "18px",
                }}
              >
                <h3 style={{ marginBottom: "10px", color: "var(--text-primary)", fontWeight: "700", fontSize: "18px" }}>
                  No Students Found
                </h3>
                <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  No students are assigned to this course/class yet. Ask admin to enroll students for this grade and section.
                </p>
              </div>
            )}

            {selectedCourseId && !noStudentsInCourse && !structureSubmitted && (
              <div
                style={{
                  background: "var(--surface-panel)",
                  padding: isMobile ? "14px" : "20px",
                  borderRadius: "14px",
                  border: "1px solid var(--border-soft)",
                  boxShadow: "var(--shadow-soft)",
                  marginBottom: "18px",
                }}
              >
                <h3 style={{ marginBottom: "16px", color: "var(--text-primary)", fontWeight: "700", fontSize: "18px" }}>
                  Assessment Template Not Found
                </h3>
                <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Admin has not created an assessment template for this course and semester/quarter yet.
                  Teachers can only enter marks based on admin-created templates.
                </p>
              </div>
            )}

            {structureSubmitted && (
              <div
                className="marks-table-wrapper"
                ref={marksWrapperRef}
                style={{
                  position: "relative",
                  overflowX: "auto",
                  overflowY: "visible",
                  minHeight: 120,
                  width: "100%",
                  maxWidth: "100%",
                  paddingBottom: 32,
                  whiteSpace: "normal",
                  background: "var(--surface-panel)",
                  borderRadius: 14,
                  border: "1px solid var(--border-soft)",
                  boxShadow: "var(--shadow-soft)",
                  marginBottom: 20,
                  padding: isMobile ? 10 : 14
                }}
              >
                  
 
    
                <table
                  className="marks-table"
                  style={{
                    borderCollapse: "collapse",
                    borderSpacing: "0 12px",
                    fontSize: "14px",
                    minWidth: 0,
                    width: "100%",
                    maxWidth: "100%",
                    tableLayout: "fixed",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "linear-gradient(135deg, var(--accent-strong), var(--accent))",
                        color: "#fff",
                        borderRadius: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.6px",
                        fontWeight: "700",
                        fontSize: "12px",
                      }}
                    >
                      <th
                        style={{
                          padding: "12px 8px",
                          textAlign: "center",
                          background: "rgba(255,255,255,0.05)",
                          width: 48,
                          minWidth: 48,
                          maxWidth: 48,
                          whiteSpace: 'nowrap',
                          borderRadius: "16px 0 0 16px",
                        }}
                      >
                        No
                      </th>
                      <th
                        style={{
                          padding: "16px 20px",
                          textAlign: "left",
                          background: "rgba(255,255,255,0.1)",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <FaUsers /> Student
                        </span>
                      </th>
                      {assessmentList.map((a, i) => (
                        <th
                          key={i}
                          style={{
                            padding: "16px 18px",
                            background: "rgba(255,255,255,0.05)",
                            textAlign: "center",
                            transition: "0.3s all",
                          }}
                        >
                          {a.name} ({a.max})
                        </th>
                      ))}
                      <th
                        style={{
                          padding: "16px 18px",
                          background: "rgba(255,255,255,0.05)",
                          textAlign: "center",
                        }}
                      >
                        Total
                      </th>
                      
                      
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(Object.entries(studentMarks)).map(([sid, marks], idx) => {
                      const total = Object.values(marks).reduce((s, a) => s + (a.score || 0), 0);
                      const student = students.find((s) => s.id === sid);
                      return (
                        <tr
                          key={sid}
                          style={{
                            background: "#f9fafb",
                            borderRadius: "12px",
                            marginBottom: "10px",
                            transition: "0.3s all",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#e0e7ff")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#f9fafb")}
                        >
                          <td style={{ padding: "8px 6px", textAlign: 'center', fontWeight: 700, width: 48, minWidth: 48, maxWidth: 48, whiteSpace: 'nowrap' }}>{idx + 1}</td>
                          <td
                            style={{
                              padding: "12px",
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              fontWeight: "600",
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{formatStudentName(student?.name)}</span>
                          </td>
                          {Object.entries(marks).map(([k, a]) => (
                            <td key={k} style={{ padding: "12px", textAlign: 'center' }}>
                              {selectedQuarter === 'avg' ? (
                                <div style={{ fontWeight: 700 }}>{a.score}</div>
                              ) : (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="\d*"
                                  min="0"
                                  max={999}
                                  value={
                                    a.score === "" || a.score === null || a.score === undefined || a.score === 0
                                      ? ""
                                      : a.score
                                  }
                                  placeholder="-"
                                  onChange={(e) => {
                                    let v = String(e.target.value || "").replace(/[^0-9]/g, "");
                                    if (v && v.length > 3) v = v.slice(0, 3);
                                    updateScore(sid, k, v);
                                  }}
                                  onKeyDown={(e) => {
                                    const allowed = ['Backspace','ArrowLeft','ArrowRight','Delete','Tab','Enter'];
                                    if (allowed.includes(e.key)) return;
                                    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                                  }}
                                  onWheel={(e) => { e.preventDefault(); e.stopPropagation(); try{ e.currentTarget.blur(); }catch(_){} }}
                                  style={{
                                    width: "66px",
                                    padding: "8px 10px",
                                    borderRadius: "8px",
                                    border: "1px solid var(--border-strong)",
                                    textAlign: "center",
                                    background: "var(--surface-panel)",
                                    fontWeight: "500",
                                  }}
                                />
                              )}
                            </td>
                          ))}
                          <td style={{ padding: "12px", fontWeight: "600" }}>{total}</td>
                          
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}