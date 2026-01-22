import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  FaFileAlt
} from "react-icons/fa";
import { ref, get, set } from "firebase/database";
import { db } from "../firebase";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";



/* ================= CONSTANTS ================= */
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = [
  "P1 (2:00–2:45)",
  "P2 (2:45–3:30)",
  "P3 (3:30–4:15)",
  "Break",
  "P4 (4:30–5:15)",
  "P5 (5:15–6:00)",
  "LUNCH",
  "P6 (7:15–8:00)",
  "P7 (8:00–8:45)",
  "P8 (8:45–9:30)"
];

export default function SchedulePage() {
  const admin = JSON.parse(localStorage.getItem("admin")) || {};

  /* ================= STATE ================= */
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState({});
  const [teacherMap, setTeacherMap] = useState({});
  const [courseTeacherMap, setCourseTeacherMap] = useState({});
  const [schedule, setSchedule] = useState({});
  const [weeklyFrequency, setWeeklyFrequency] = useState({});
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
const [unreadSenders, setUnreadSenders] = useState([]); 
const [teachers, setTeachers] = useState([]);
const [unreadTeachers, setUnreadTeachers] = useState({});
const [popupMessages, setPopupMessages] = useState([]);
const [showMessageDropdown, setShowMessageDropdown] = useState(false);
const [selectedTeacher, setSelectedTeacher] = useState(null);
const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const navigate = useNavigate();
const [postNotifications, setPostNotifications] = useState([]);
const [showPostDropdown, setShowPostDropdown] = useState(false);


const adminId = admin.userId;

const adminUserId = admin.userId;

const MAX_TEACHER_PERIODS_PER_DAY = 4;

const fetchPostNotifications = async () => {
  if (!adminId) return;

  try {
    // 1️⃣ Get post notifications
    const res = await axios.get(
      `http://127.0.0.1:5000/api/get_post_notifications/${adminId}`
    );

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
    await axios.post(
      "http://127.0.0.1:5000/api/mark_post_notification_read",
      {
        notificationId: notification.notificationId,
        adminId: admin.userId,
      }
    );
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
      if (schSnap.exists()) setSchedule(schSnap.val());

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

  const selectedClassKey =
    selectedGrade && selectedSection ? `Grade ${selectedGrade}${selectedSection}` : null;

  const filteredCourses = courses.filter(
    c => c.grade === selectedGrade && c.section === selectedSection
  );

const getTeachersForCourse = (courseId) => {
  const tid = courseTeacherMap[courseId];
  if (!tid) return [];
  return [{ id: tid, name: teacherMap[tid] }];
};


 // ---------------- FETCH UNREAD MESSAGES ----------------
const fetchUnreadMessages = async () => {
  if (!admin.userId) return;

  const senders = {};

  try {
    // 1️⃣ USERS (names & images)
    const usersRes = await axios.get(
      "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"
    );
    const usersData = usersRes.data || {};

 const findUserByUserId = (userId) => {
  return Object.values(usersData).find(u => u.userId === userId);
};



    // helper to read messages from BOTH chat keys
    const getUnreadCount = async (userId) => {
      const key1 = `${admin.userId}_${userId}`;
      const key2 = `${userId}_${admin.userId}`;

      const [r1, r2] = await Promise.all([
        axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`),
        axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`)
      ]);

      const msgs = [
        ...Object.values(r1.data || {}),
        ...Object.values(r2.data || {})
      ];

      return msgs.filter(
        m => m.receiverId === admin.userId && !m.seen
      ).length;
    };

    // 2️⃣ TEACHERS
    const teachersRes = await axios.get(
      "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"
    );

    for (const k in teachersRes.data || {}) {
      const t = teachersRes.data[k];
      const unread = await getUnreadCount(t.userId);

      if (unread > 0) {
       const user = findUserByUserId(t.userId);

senders[t.userId] = {
  type: "teacher",
  name: user?.name || "Teacher",
  profileImage: user?.profileImage || "/default-profile.png",
  count: unread
};
      }
    }

    // 3️⃣ STUDENTS
    const studentsRes = await axios.get(
      "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json"
    );

    for (const k in studentsRes.data || {}) {
      const s = studentsRes.data[k];
      const unread = await getUnreadCount(s.userId);

      if (unread > 0) {
        const user = findUserByUserId(s.userId);

senders[s.userId] = {
  type: "student",
  name: user?.name || s.name || "Student",
  profileImage: user?.profileImage || s.profileImage || "/default-profile.png",
  count: unread
};

      }
    }

    // 4️⃣ PARENTS
    const parentsRes = await axios.get(
      "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Parents.json"
    );

    for (const k in parentsRes.data || {}) {
      const p = parentsRes.data[k];
      const unread = await getUnreadCount(p.userId);

      if (unread > 0) {
       const user = findUserByUserId(p.userId);

senders[p.userId] = {
  type: "parent",
  name: user?.name || p.name || "Parent",
  profileImage: user?.profileImage || p.profileImage || "/default-profile.png",
  count: unread
};

      }
    }

    setUnreadSenders(senders);
  } catch (err) {
    console.error("Unread fetch failed:", err);
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
  if (!admin.userId) return;

  fetchUnreadMessages();
  const interval = setInterval(fetchUnreadMessages, 5000);

  return () => clearInterval(interval);
}, [admin.userId]);





/* ================= AUTO GENERATE RANDOMLY (FIXED) ================= */
/* ================= AUTO GENERATE RANDOMLY (DEADLOCK SAFE) ================= */
const autoGenerate = () => {
  if (!selectedClassKey) {
    alert("Select grade & section first");
    return;
  }

  const MAX_ATTEMPTS = 50;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const freqMapOriginal = { ...weeklyFrequency[selectedClassKey] };
      const classCourses = filteredCourses;

      // Clone schedule
      const data = structuredClone(schedule || {});

      // ================= TRACKERS =================
      // Tracks teacher occupation across all classes and periods
      const teacherTimeSlot = {}; // { day: { period: { teacherId: true } } }

      // Tracks last period of teacher in THIS class to avoid consecutive periods
      const lastTeacherPeriod = {}; // { classKey: { teacherId: periodIndex } }

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

      // Shuffle courses to randomize placement
      const shuffledCourses = [...classCourses].sort(() => Math.random() - 0.5);

      const freqMap = { ...freqMapOriginal };

      for (let day of DAYS) {
        const activePeriods = PERIODS.filter(p => p !== "LUNCH" && p !== "Break");
        let lastSubject = null;

        for (let period of activePeriods) {
          let placed = false;
          const candidates = [...shuffledCourses].sort(() => Math.random() - 0.5);

          for (let course of candidates) {
            const teacherId = courseTeacherMap[course.id];
            if (freqMap[course.id] <= 0) continue;
            if (course.subject === lastSubject) continue;

            // ===== CROSS-CLASS TEACHER CONFLICT =====
            if (teacherId && teacherTimeSlot[day][period]?.[teacherId]) continue;

            // Avoid consecutive periods in the same class
            const lastPeriodIndex = lastTeacherPeriod[selectedClassKey]?.[teacherId];
            if (lastPeriodIndex === activePeriods.indexOf(period) - 1) continue;

            // Max periods/day for the subject
            const maxPerDay = (freqMapOriginal[course.id] > 5) ? 2 : 1;
            const dayCount = Object.values(data[day][selectedClassKey] || {}).filter(
              c => c?.subject === course.subject
            ).length;
            if (dayCount >= maxPerDay) continue;

            // ===== ASSIGN =====
            data[day][selectedClassKey][period] = {
              subject: course.subject,
              teacherId,
              teacherName: teacherMap[teacherId] || "Unassigned"
            };

            // Update trackers
            teacherTimeSlot[day][period] ??= {};
            if (teacherId) {
              teacherTimeSlot[day][period][teacherId] = true;
              lastTeacherPeriod[selectedClassKey] ??= {};
              lastTeacherPeriod[selectedClassKey][teacherId] = activePeriods.indexOf(period);
            }

            freqMap[course.id]--;
            lastSubject = course.subject;
            placed = true;
            break;
          }

          if (!placed) throw new Error("Deadlock: unable to place subjects without violating constraints");
        }
      }

      setSchedule(data);
      calculateTeacherWorkload(data);
      console.log(`✅ Timetable for ${selectedClassKey} generated successfully`);
      return;

    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        alert("Unable to generate timetable after multiple attempts. Try adjusting weekly subject counts or teacher assignments.");
        console.error(err);
      }
    }
  }
};



 const editCell = (day, period) => {
  const cell = schedule?.[day]?.[selectedClassKey]?.[period];
  if (!cell || cell.break) return;

  const course = filteredCourses.find(c => c.subject === cell.subject);

  setEditTarget({
    day,
    period,
    subject: course?.id || "",
    teacherId: cell.teacherId || ""
  });
};

const saveEdit = () => {
  const { day, period, subject, teacherId } = editTarget;
  const course = courses.find(c => c.id === subject);

  const updated = structuredClone(schedule);
  updated[day][selectedClassKey][period] = {
    subject: course.subject,
    teacherId,
    teacherName: teacherMap[teacherId] || "Unassigned"
  };

  setSchedule(updated);
  setEditTarget(null);
  calculateTeacherWorkload(updated);
};

const cancelEdit = () => setEditTarget(null);



  /* ================= TEACHER WORKLOAD ================= */
  const calculateTeacherWorkload = (sched) => {
    const workload = {};
    DAYS.forEach(day => {
      PERIODS.forEach(p => {
        if (p === "LUNCH") return;
        const item = sched[day]?.[selectedClassKey]?.[p];
        if (item?.teacherName) {
          workload[item.teacherName] = (workload[item.teacherName] || 0) + 1;
        }
      });
    });
    const data = Object.entries(workload).map(([name, count]) => ({ name, classes: count }));
    setTeacherWorkload(data);
  };

  const onDragEnd = res => {
    if (!res.destination) return;
    const day = res.source.droppableId;
    const src = res.source.index;
    const dst = res.destination.index;
    const active = PERIODS.filter(p => p !== "LUNCH");
    const p1 = active[src];
    const p2 = active[dst];
    const updated = structuredClone(schedule);
    [updated[day][selectedClassKey][p1], updated[day][selectedClassKey][p2]] =
      [updated[day][selectedClassKey][p2], updated[day][selectedClassKey][p1]];
    setSchedule(updated);
    calculateTeacherWorkload(updated);
  };

  const saveSchedule = async () => {
    await set(ref(db, "Schedules"), schedule);
    alert("Schedule saved successfully");
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
    marginLeft: 400,
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
    gap: 20,
    padding: 24,
    borderRadius: 20,
    background: "linear-gradient(135deg, #e4e6ecff)",
    boxShadow: "0 10px 30px rgba(255, 255, 255, 0.2)",
    color: "#fff",
    fontWeight: 600
  },
  select: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "none",
    minWidth: 180,
    fontSize: 15,
    fontWeight: 600,
    outline: "none",
    cursor: "pointer"
  },

  card: {
    background: "#fff",
    padding: 22,
    borderRadius: 20,
    marginTop: 22,
    boxShadow: "0 12px 25px rgba(0,0,0,0.12)",
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
    background: "linear-gradient(135deg,#eef2ff,#e0e7ff)",
    padding: 16,
    borderRadius: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: 500,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    transition: "0.3s",
  },
  freqItemHover: {
    transform: "translateY(-3px)",
    boxShadow: "0 8px 18px rgba(0,0,0,0.12)"
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

  period: {
    background: "#f0f4f8",
    padding: 18,
    borderRadius: 16,
    minWidth: 160,
    textAlign: "center",
    fontWeight: 600,
    boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
    transition: "0.3s",
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


  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
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

  {/* 🔴 Notification Count */}
  {postNotifications.length > 0 && (
    <span
      style={{
        position: "absolute",
        top: "-5px",
        right: "-5px",
        background: "red",
        color: "#fff",
        borderRadius: "50%",
        padding: "2px 6px",
        fontSize: "10px",
        fontWeight: "bold"
      }}
    >
      {postNotifications.length}
    </span>
  )}

  {/* 🔔 Notification Dropdown */}
  {showPostDropdown && (
    <div
      className="notification-dropdown"
      style={{
        position: "absolute",
        top: "40px",
        right: "0",
        width: "350px",
        maxHeight: "400px",
        overflowY: "auto",
        background: "#fff",
        borderRadius: "10px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.25)",
        zIndex: 1000
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {postNotifications.length === 0 ? (
        <p style={{ padding: "12px", textAlign: "center" }}>
          No new notifications
        </p>
      ) : (
        postNotifications.map(n => (
          <div
            key={n.notificationId}
            style={{
              display: "flex",
              gap: "10px",
              padding: "10px",
              cursor: "pointer",
              borderBottom: "1px solid #eee"
            }}
            onClick={() => handleNotificationClick(n)}
          >
            <img
              src={n.adminProfile || "/default-profile.png"}
              alt={n.adminName}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%"
              }}
            />
            <div>
              <strong>{n.adminName}</strong>
              <p style={{ margin: 0 }}>{n.message}</p>
            </div>
          </div>
        ))
      )}
    </div>
  )}
</div>

  {/* ================= MESSENGER ================= */}
  <div
    className="icon-circle"
    style={{ position: "relative", cursor: "pointer" }}
    onClick={(e) => {
      e.stopPropagation();
      setShowMessageDropdown((prev) => !prev);
    }}
  >
    <FaFacebookMessenger />
  
    {/* 🔴 TOTAL UNREAD COUNT */}
    {Object.keys(unreadSenders).length > 0 && (
      <span
        style={{
          position: "absolute",
          top: "-5px",
          right: "-5px",
          background: "red",
          color: "#fff",
          borderRadius: "50%",
          padding: "2px 6px",
          fontSize: "10px",
          fontWeight: "bold"
        }}
      >
        {Object.values(unreadSenders).reduce((a, b) => a + b.count, 0)}
      </span>
    )}
  
    {/* 📩 DROPDOWN */}
    {showMessageDropdown && (
      <div
        style={{
          position: "absolute",
          top: "40px",
          right: "0",
          width: "300px",
          background: "#fff",
          borderRadius: "10px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.25)",
          zIndex: 1000
        }}
      >
        {Object.keys(unreadSenders).length === 0 ? (
          <p style={{ padding: "12px", textAlign: "center", color: "#777" }}>
            No new messages
          </p>
        ) : (
          Object.entries(unreadSenders).map(([userId, sender]) => (
            <div
              key={userId}
              style={{
                padding: "12px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                borderBottom: "1px solid #eee"
              }}
            onClick={async () => {
  setShowMessageDropdown(false);

  // 1️⃣ Mark messages as seen in DB
  await markMessagesAsSeen(userId);

  // 2️⃣ Remove sender immediately from UI
  setUnreadSenders(prev => {
    const copy = { ...prev };
    delete copy[userId];
    return copy;
  });

  // 3️⃣ Navigate to exact chat
  navigate("/all-chat", {
    state: {
      user: {
        userId,
        name: sender.name,
        profileImage: sender.profileImage,
        type: sender.type
      }
    }
  });
}}

  
  
            >
              <img
                src={sender.profileImage}
                alt={sender.name}
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%"
                }}
              />
              <div>
                <strong>{sender.name}</strong>
                <p style={{ fontSize: "12px", margin: 0 }}>
                  {sender.count} new message{sender.count > 1 && "s"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    )}
  </div>
  {/* ============== END MESSENGER ============== */}
  

  
            <Link className="icon-circle" to="/settings">
                  <FaCog />
                </Link>
            <img src={admin.profileImage || "/default-profile.png"} alt="admin" className="profile-img" />
          </div>
</div>

<div className="google-sidebar">
  {/* PROFILE */}
  <div className="sidebar-profile">
    <div className="sidebar-img-circle">
      <img
        src={admin?.profileImage || "/default-profile.png"}
        alt="profile"
      />
    </div>
    <h3>{admin?.name || "Admin Name"}</h3>
    <p>Admin</p>
  </div>

  {/* MENU */}
  <div className="sidebar-menu">
                                         <Link className="sidebar-btn" to="/dashboard"
                                          
                                          > <FaHome style={{ width: "28px", height:"28px" }}/> Home</Link>
                                           <Link className="sidebar-btn" to="/my-posts"><FaFileAlt /> My Posts</Link>
                                           <Link className="sidebar-btn" to="/teachers" ><FaChalkboardTeacher /> Teachers</Link>
                                             <Link className="sidebar-btn" to="/students" > <FaChalkboardTeacher /> Students</Link>
                                              <Link
                                                           className="sidebar-btn"
                                                           to="/schedule"
                                                           style={{ backgroundColor: "#4b6cb7", color: "#fff" }}
                                                         >
                                                           <FaCalendarAlt /> Schedule
                                                         </Link>
                                              <Link className="sidebar-btn" to="/parents"><FaChalkboardTeacher /> Parents
                                                         </Link>
                                                                   
                                        
                                           <button
                                             className="sidebar-btn logout-btn"
                                             onClick={() => {
                                               localStorage.removeItem("admin");
                                               window.location.href = "/login";
                                             }}
                                           >
                                             <FaSignOutAlt /> Logout
                                           </button>
                                         </div>
</div>


 

 

        {/* MAIN */}
        <div style={styles.main}>
          {/* SELECTOR */}
          <div style={styles.selectorCard}>
            <select style={styles.select} value={selectedGrade} onChange={e => { setSelectedGrade(e.target.value); setSelectedSection(""); }}>
              <option value="">🎓 Select Grade</option>
              {Object.keys(classes).map(g => <option key={g}>{g}</option>)}
            </select>
            <select style={styles.select} value={selectedSection} onChange={e => setSelectedSection(e.target.value)} disabled={!selectedGrade}>
              <option value="">📘 Select Section</option>
              {[...(classes[selectedGrade] || [])].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* SUBJECT FREQUENCY */}
          {selectedClassKey && (
            <div style={styles.card}>
              <h3>📚 {selectedClassKey} – Weekly Subjects</h3>
              <div style={styles.freqGrid}>
                {filteredCourses.map(course => (
                  <div key={course.id} style={styles.freqItem}>
                    <span>{course.subject}</span>
                    <select
                      value={weeklyFrequency[selectedClassKey]?.[course.id] || 0}
                      onChange={e => setWeeklyFrequency(prev => ({
                        ...prev,
                        [selectedClassKey]: { ...prev[selectedClassKey], [course.id]: Number(e.target.value) }
                      }))}
                    >
                      {[...Array(9)].map((_, i) => <option key={i}>{i}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIONS */}
          {selectedClassKey && (
            <>
              <div style={styles.btnRow}>
                <button style={styles.greenBtn} onClick={autoGenerate}><FaMagic /> Auto Generate</button>
                <button style={styles.blueBtn} onClick={saveSchedule}><FaSave /> Save</button>
              </div>

              <DragDropContext onDragEnd={onDragEnd}>
                {DAYS.map(day => (
                  <div key={day} style={styles.card}>
                    <h2>{day}</h2>
                    <Droppable droppableId={day} direction="horizontal">
                      {prov => (
                        <div ref={prov.innerRef} {...prov.droppableProps} style={{ display: "flex", gap: 12, overflowX: "auto" }}>
                       {PERIODS.map((p, i) => {
  if (p === "Break") {
    return (
      <div key={p} style={{ ...styles.lunch, background: "#a5f3fc" }}>
        ☕ Break
      </div>
    );
  }
  if (p === "LUNCH") {
    return (
      <div key={p} style={styles.lunch}>
        🍽 Lunch
      </div>
    );
  }

  const d = schedule[day]?.[selectedClassKey]?.[p];
  return (
    <Draggable draggableId={`${day}-${p}`} index={i} key={p}>
      {prov => (
        <div
          ref={prov.innerRef}
          {...prov.draggableProps}
          {...prov.dragHandleProps}
          onDoubleClick={() => editCell(day, p)}
          style={{
            ...styles.period,
            cursor: "pointer",
            ...prov.draggableProps.style
          }}
        >
          <b>{p}</b>
          <div>{d?.subject}</div>
          <div style={{ color: "#2563eb" }}>{d?.teacherName}</div>
          <small style={{ fontSize: 11, opacity: 0.6 }}>Double-click to edit</small>
        </div>
      )}
    </Draggable>
  );
})}


                          {prov.placeholder}
                        
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
              </DragDropContext>
            </>
          )}
        </div>

        

      </div>
  
  );
}
