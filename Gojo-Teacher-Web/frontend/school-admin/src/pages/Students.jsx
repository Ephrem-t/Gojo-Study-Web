import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, 
  FaSignOutAlt, FaBell, FaFacebookMessenger, FaSearch, FaCalendarAlt, FaCommentDots 
} from "react-icons/fa";
import axios from "axios";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { useMemo } from "react";
import { getDatabase, ref, onValue, push, update } from "firebase/database";
import { getFirestore, collection, getDocs } from "firebase/firestore";

import app, { db } from "../firebase"; // Adjust the path if needed


function StudentsPage() {
  // ------------------ STATES ------------------
  const [students, setStudents] = useState([]); // List of all students
  const [selectedGrade, setSelectedGrade] = useState("All"); // Grade filter
  const [selectedSection, setSelectedSection] = useState("All"); // Section filter
  const [sections, setSections] = useState([]); // Sections available for selected grade
  const [selectedStudent, setSelectedStudent] = useState(null); // Currently selected student
  const [studentChatOpen, setStudentChatOpen] = useState(false); // Toggle chat popup
  const [popupMessages, setPopupMessages] = useState([]); // Messages for chat popup
  const [popupInput, setPopupInput] = useState(""); // Input for chat message
  const [details, setDetails] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [studentTab, setStudentTab] = useState("details");
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [unreadMap, setUnreadMap] = useState({});
  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem("admin")) || {}; // Admin info from localStorage

  const [studentMarks, setStudentMarks] = useState({});
  const [attendanceView, setAttendanceView] = useState("daily");
  const [attendanceCourseFilter, setAttendanceCourseFilter] = useState("All");
  const [expandedCards, setExpandedCards] = useState({});
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false); // Right sidebar toggle
  const [teachers, setTeachers] = useState([]);
  const [unreadTeachers, setUnreadTeachers] = useState({});
  const [unreadSenders, setUnreadSenders] = useState([]); 
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const [postNotifications, setPostNotifications] = useState([]);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");
  const [lastMessages, setLastMessages] = useState({});
  // At the top of your StudentsPage component
  const [expandedSubjects, setExpandedSubjects] = useState([]); 

  // Semester selection for performance tab
  const [activeSemester, setActiveSemester] = useState("semester2");

  const adminId = admin.userId;
  const adminUserId = admin.userId;

  const dbRT = getDatabase(app);

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

  useEffect(() => {
    const fetchStudents = async () => {
      const querySnapshot = await getDocs(collection(db, "students"));
      const studentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentsData);
    };

    fetchStudents();
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

  const handleSelectStudent = async (s) => {
    setLoading(true);
    try {
      // 1️⃣ Fetch user info
      const userRes = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${s.userId}.json`
      );
      const user = userRes.data || {};

      // 2️⃣ Fetch ClassMarks from Firebase
      const marksRes = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/ClassMarks.json`
      );
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
      const attendanceRes = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Attendance.json`
      );
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

      // 4️⃣ Set selected student state
      setSelectedStudent({
        ...s,
        ...user,
        marks: studentMarksObj,
        attendance: attendanceData,
      });


   setRightSidebarOpen(true);
    } catch (err) {
      console.error("Error fetching student data:", err);
    } finally {
      setLoading(false);
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
          const chatKey = `${t.userId}_${adminUserId}`;
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

  // ------------------ FETCH STUDENTS ------------------
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const studentsRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json");
        const usersRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json");

        const studentsData = studentsRes.data || {};
        const usersData = usersRes.data || {};

        const studentList = Object.keys(studentsData).map((id) => {
          const student = studentsData[id];
          const user = usersData[student.userId] || {};
          return {
            studentId: id,
            userId: student.userId, // <-- Add this
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
  const filteredStudents = students.filter(s => {
    if (selectedGrade !== "All" && s.grade !== selectedGrade) return false;
    if (selectedSection !== "All" && s.section !== selectedSection) return false;
    return true;
  });


  // ---------------- FETCH PERFORMANCE ----------------
  // This effect reads ClassMarks and stores only the entries for the selected student.
  useEffect(() => {
    if (!selectedStudent?.studentId) {
      setStudentMarks({});
      return;
    }

    let cancelled = false;

    async function fetchMarks() {
      setLoading(true);
      try {
        const res = await axios.get(
          "https://ethiostore-17d9f-default-rtdb.firebaseio.com/ClassMarks.json"
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMarks();

    return () => {
      cancelled = true;
    };
  }, [selectedStudent]);


  //-------------------------Fetch unread status for each student--------------
  useEffect(() => {
    const fetchUnread = async () => {
      const map = {};

      for (const s of students) {
        const key = `${s.studentId}_${admin.userId}`;

        const res = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key}/messages.json`
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

    const chatKey = `${selectedStudent.userId}_${adminUserId}`;

    const fetchMessages = async () => {
      try {
        const res = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`
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
      await axios.post(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`,
        newMessage
      );

      setPopupMessages(prev => [...prev, { ...newMessage, sender: "admin" }]);
      setPopupInput("");
    } catch (err) {
      console.error(err);
    }
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

  // ---------------- MARK MESSAGES AS SEEN ----------------
  useEffect(() => {
    if (!studentChatOpen || !selectedStudent) return;

    const markSeen = async () => {
      const chatKey = `${adminUserId}_${selectedStudent.userId}`;
      try {
        const res = await axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`);
        const msgs = Object.entries(res.data || {});
        const updates = {};
        msgs.forEach(([key, msg]) => {
          if (msg.receiverId === adminUserId && !msg.seen) updates[key + "/seen"] = true;
        });
        if (Object.keys(updates).length > 0) {
          await axios.patch(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`, updates);
          // setUnreadStudents(prev => ({ ...prev, [selectedStudent.userId]: 0 })); // keep if you use unreadStudents
        }
      } catch (err) {
        console.error(err);
      }
    };
    markSeen();
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
    const clean = courseId
      .replace("course_", "")
      .replace(/_[0-9A-Za-z]+$/, "") // remove class like _9A
      .replace(/_/g, " ");

    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };





 return (
    <div className="dashboard-page">
      {/* ---------------- TOP NAVIGATION BAR ---------------- */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>
        
        <div className="nav-right">
          <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setShowPostDropdown(prev => !prev); }}>
            <FaBell />
            {postNotifications.length > 0 && <span className="badge">{postNotifications.length}</span>}
            {showPostDropdown && (
              <div className="notification-dropdown" onClick={(e) => e.stopPropagation()}>
                {postNotifications.length === 0 ? <p style={{ padding: 12, textAlign: "center" }}>No new notifications</p> :
                  postNotifications.map(n => (
                    <div key={n.notificationId} style={{ display: "flex", gap: 10, padding: 10, cursor: "pointer", borderBottom: "1px solid #eee" }} onClick={() => handleNotificationClick(n)}>
                      <img src={n.adminProfile || "/default-profile.png"} alt={n.adminName} style={{ width: 40, height: 40, borderRadius: "50%" }} />
                      <div>
                        <strong>{n.adminName}</strong>
                        <p style={{ margin: 0 }}>{n.message}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setShowMessageDropdown(prev => !prev); }}>
            <FaFacebookMessenger />
            {Object.keys(unreadSenders).length > 0 && <span className="badge">{Object.values(unreadSenders).reduce((a, b) => a + b.count, 0)}</span>}
            {showMessageDropdown && (
              <div className="notification-dropdown messenger-dropdown" onClick={(e) => e.stopPropagation()}>
                {Object.keys(unreadSenders).length === 0 ? <p style={{ padding: 12, textAlign: "center" }}>No new messages</p> :
                  Object.entries(unreadSenders).map(([userId, sender]) => (
                    <div key={userId} style={{ padding: 12, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderBottom: "1px solid #eee" }} onClick={async () => { setShowMessageDropdown(false); await markMessagesAsSeen(userId); navigate("/all-chat", { state: { user: { userId, name: sender.name, profileImage: sender.profileImage, type: sender.type } } }); }}>
                      <img src={sender.profileImage} alt={sender.name} style={{ width: 42, height: 42, borderRadius: "50%" }} />
                      <div>
                        <strong>{sender.name}</strong>
                        <p style={{ fontSize: 12, margin: 0 }}>{sender.count} new message{sender.count > 1 && "s"}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          <Link className="icon-circle" to="/settings"><FaCog /></Link>
          <img src={admin.profileImage || "/default-profile.png"} alt="admin" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex" }}>
        {/* ---------------- SIDEBAR ---------------- */}
        <div className="google-sidebar">
          <div className="sidebar-profile">
            <div className="sidebar-img-circle">
              <img src={admin.profileImage || "/default-profile.png"} alt="profile" />
            </div>
            <h3>{admin.name}</h3>
            <p>{admin.username}</p>
          </div>

          <div className="sidebar-menu">
            <Link className="sidebar-btn" to="/dashboard"> <FaHome style={{ width: "28px", height:"28px" }}/> Home</Link>
            <Link className="sidebar-btn" to="/my-posts"><FaFileAlt /> My Posts</Link>
            <Link className="sidebar-btn" to="/teachers"><FaChalkboardTeacher /> Teachers</Link>
            <Link className="sidebar-btn" to="/students" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaChalkboardTeacher /> Students</Link>
            <Link className="sidebar-btn" to="/schedule"><FaCalendarAlt /> Schedule</Link>
            <Link className="sidebar-btn" to="/parents"><FaChalkboardTeacher /> Parents</Link>
            <button className="sidebar-btn logout-btn" onClick={() => { localStorage.removeItem("admin"); window.location.href = "/login"; }}><FaSignOutAlt /> Logout</button>
          </div>
        </div>

        {/* ---------------- MAIN CONTENT ---------------- */}
        <div className={`main-content ${rightSidebarOpen ? "sidebar-open" : ""}`}>
          <div className="main-inner" style={{ marginLeft: "150px", marginTop: "-80px" }}>
            <h2 style={{ marginBottom: "20px", textAlign: "center" }}>Students</h2>

            {/* Grade Filter */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px", gap: "12px" }}>
              {["All", "9", "10", "11", "12"].map(g => (
                <button key={g} onClick={() => setSelectedGrade(g)} style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  background: selectedGrade === g ? "#4b6cb7" : "#ddd",
                  color: selectedGrade === g ? "#fff" : "#000",
                  cursor: "pointer",
                  border: "none",
                }}>
                  {g === "All" ? "All Grades" : `Grade ${g}`}
                </button>
              ))}
            </div>

            {/* Section Filter */}
            {selectedGrade !== "All" && sections.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px", gap: "12px", }}>
                {["All", ...sections].map(section => (
                  <button key={section} onClick={() => setSelectedSection(section)} style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: selectedSection === section ? "#4b6cb7" : "#ddd",
                    color: selectedSection === section ? "#fff" : "#000",
                    cursor: "pointer",
                    border: "none",
                  }}>
                    {section === "All" ? "All Sections" : `Section ${section}`}
                  </button>
                ))}
              </div>
            )}

            {/* Students List */}
            {filteredStudents.length === 0 ? (
              <p style={{ textAlign: "center", color: "#555" }}>No students found for this selection.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                {filteredStudents.map(s => (
                  <div
                    key={s.userId}
                    onClick={() => handleSelectStudent(s)}
                    className="student-card"
                    style={{
                      width: "700px",
                      height: "100px",
                      borderRadius: "12px",
                      padding: "15px",
                      background: selectedStudent?.studentId === s.studentId ? "#e0e7ff" : "#fff",
                      border: selectedStudent?.studentId === s.studentId ? "2px solid #4b6cb7" : "1px solid #ddd",
                      display: "flex",
                      alignItems: "center",
                      gap: "20px",
                      cursor: "pointer"
                    }}
                  >
                    <img src={s.profileImage} alt={s.name} style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover" }} />
                    <div>
                      <h3 style={{ margin: 0 }}>{s.name}</h3>
                      <p style={{ margin: "4px 0", color: "#555" }}>Grade {s.grade} - Section {s.section}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---------------- RIGHT SIDEBAR FOR SELECTED STUDENT ---------------- */}
        {selectedStudent && (
          <>
            <div className={`sidebar-overlay ${rightSidebarOpen ? "visible" : ""}`} onClick={closeRightSidebar} aria-hidden={!rightSidebarOpen} />
            <aside className={`student-info-sidebar ${rightSidebarOpen ? "open" : "closed"}`} role="dialog" aria-label="Student details" >
              <div className="student-info-header" style={{ position: "relative", marginTop: "-10px", padding: "2px" }}>
                <button className="sidebar-close-btn" aria-label="Close details" onClick={closeRightSidebar}>✕</button>
              </div>

              <div className="student-info-scroll">
                {/* student details content (kept same as your UI) */}
                <div style={{ textAlign: "center", marginBottom: "20px", marginTop: "-90px" }}>
                  <div style={{ background: "#e6eefc", padding: "25px 10px", height: "200px", margin: "50px 1px 20px", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }}>
                    <div style={{ width: "110px", height: "110px", margin: "0 auto 15px", borderRadius: "50%", overflow: "hidden", border: "4px solid #4b6cb7" }}>
                      <img src={selectedStudent.profileImage} alt={selectedStudent.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <h2 style={{ margin: 0, color: "#111827" }}>{selectedStudent.name}</h2>
                    <p style={{ margin: "4px 0", color: "#6b7280", fontSize: "14px" }}>{selectedStudent.email || "teacher@example.com"}</p>
                  </div>

                  <p><strong>Grade:</strong> {selectedStudent.grade}</p>
                  <p><strong>Section:</strong> {selectedStudent.section}</p>
                </div>

                <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: "15px" }}>
                  {["details", "attendance", "performance"].map(tab => (
                    <button key={tab} onClick={() => setStudentTab(tab)} style={{
                      flex: 1, padding: "12px", background: "none", border: "none", cursor: "pointer", fontWeight: 600,
                      color: studentTab === tab ? "#4b6cb7" : "#6b7280",
                      borderBottom: studentTab === tab ? "3px solid #4b6cb7" : "3px solid transparent"
                    }}>{tab.toUpperCase()}</button>
                  ))}
                </div>

            {/* DETAILS TAB */}
  {/* ================= DETAILS TAB ================= */}
{studentTab === "details" && selectedStudent && (
  <div style={{
    padding: "26px",
    maxHeight: "70vh",
    overflowY: "auto",
    background: "#f9fafb",
    borderRadius: "20px"
  }}>
    {/* Sticky Header */}
    <div style={{
      position: "sticky",
      top: 0,
      background: "#f9fafb",
      paddingBottom: "16px",
      zIndex: 10,
      borderBottom: "1px solid #e5e7eb"
    }}>
      <h2 style={{ fontSize: "22px", fontWeight: "900", color: "#2563eb", letterSpacing: "0.5px" }}>
        👤 Student Information
      </h2>
    </div>

    {/* Student Info Grid */}
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "20px",
      marginTop: "20px"
    }}>
      {/* Email */}
      <div style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.05)"
      }}>
        <div style={{ fontSize: "14px", color: "#64748b" }}>📧 Email</div>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111" }}>
          {selectedStudent.email || "N/A"}
        </div>
      </div>

      {/* Age */}
      <div style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.05)"
      }}>
        <div style={{ fontSize: "14px", color: "#64748b" }}>🎂 Age</div>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111" }}>
          {selectedStudent.age || "N/A"}
        </div>
      </div>

      {/* Parent Name */}
      <div style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.05)"
      }}>
        <div style={{ fontSize: "14px", color: "#64748b" }}>👨‍👩‍👧 Parent Name</div>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111" }}>
          {selectedStudent.parentName || "N/A"}
        </div>
      </div>

      {/* Parent Phone */}
      <div style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.05)"
      }}>
        <div style={{ fontSize: "14px", color: "#64748b" }}>📱 Parent Phone</div>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111" }}>
          {selectedStudent.parentPhone || "N/A"}
        </div>
      </div>

      {/* Grade */}
      <div style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.05)"
      }}>
        <div style={{ fontSize: "14px", color: "#64748b" }}>🏫 Grade</div>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111" }}>
          {selectedStudent.grade || "N/A"}
        </div>
      </div>

      {/* Section */}
      <div style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.05)"
      }}>
        <div style={{ fontSize: "14px", color: "#64748b" }}>📚 Section</div>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111" }}>
          {selectedStudent.section || "N/A"}
        </div>
      </div>

      {/* Additional Features */}
      {/* e.g., Student ID */}
      <div style={{
        background: "#f0f9ff",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.05)"
      }}>
        <div style={{ fontSize: "14px", color: "#2563eb" }}>🆔 Student ID</div>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111" }}>
          {selectedStudent.studentId || "N/A"}
        </div>
      </div>

      {/* e.g., Extra Feature: Notes */}
      <div style={{
        background: "#fff7ed",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.05)"
      }}>
        <div style={{ fontSize: "14px", color: "#ea580c" }}>📝 Notes</div>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111" }}>
          {selectedStudent.notes || "No notes available"}
        </div>
      </div>

    </div>
  </div>
)}

{/* ================= ATTENDANCE TAB ================= */}
{studentTab === "attendance" && selectedStudent && (
  <div
    style={{
      padding: 30,
      background: "radial-gradient(circle at top,#eef2ff,#f8fafc)",
      borderRadius: 26,
      fontFamily: "Inter, system-ui",
    }}
  >
    {/* ===== VIEW SWITCH ===== */}
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 16,
        marginBottom: 32,
      }}
    >
      {["daily", "weekly", "monthly"].map((v) => (
        <button
          key={v}
          onClick={() => setAttendanceView(v)}
          style={{
            padding: "12px 28px",
            borderRadius: 999,
            border: "none",
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: 1,
            cursor: "pointer",
            background:
              attendanceView === v
                ? "linear-gradient(135deg,#4f46e5,#2563eb)"
                : "rgba(255,255,255,.8)",
            color: attendanceView === v ? "#fff" : "#1f2937",
            boxShadow:
              attendanceView === v
                ? "0 18px 40px rgba(79,70,229,.45)"
                : "0 6px 14px rgba(0,0,0,.08)",
            transition: "all .3s ease",
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
            style={{
              background:
                "linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,.85))",
              backdropFilter: "blur(14px)",
              borderRadius: 26,
              padding: 26,
              marginBottom: 26,
              boxShadow: "0 30px 60px rgba(0,0,0,.12)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Glow */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at top left,rgba(99,102,241,.15),transparent 60%)",
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
                    fontSize: 20,
                    fontWeight: 900,
                    color: "#1e3a8a",
                  }}
                >
                  📚 {formatSubjectName(course)}
                </h3>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: 13,
                    color: "#64748b",
                  }}
                >
                  👨‍🏫 {records[0]?.teacherName}
                </p>
              </div>

              <div
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 900,
                  background:
                    progress >= 75
                      ? "linear-gradient(135deg,#22c55e,#16a34a)"
                      : progress >= 50
                      ? "linear-gradient(135deg,#facc15,#eab308)"
                      : "linear-gradient(135deg,#ef4444,#dc2626)",
                  color: "#fff",
                  boxShadow: "0 10px 25px rgba(0,0,0,.25)",
                }}
              >
                {progress}%
              </div>
            </div>

            {/* PROGRESS BAR */}
            <div
              onClick={() => toggleExpand(expandKey)}
              style={{
                height: 16,
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
                  background:
                    progress >= 75
                      ? "linear-gradient(90deg,#22c55e,#16a34a)"
                      : progress >= 50
                      ? "linear-gradient(90deg,#facc15,#eab308)"
                      : "linear-gradient(90deg,#ef4444,#dc2626)",
                  transition: "width .5s cubic-bezier(.4,0,.2,1)",
                }}
              />
            </div>

            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
                marginBottom: 12,
                letterSpacing: 0.6,
              }}
            >
              CLICK BAR TO VIEW {attendanceView.toUpperCase()} DETAILS
            </div>

            {/* EXPANDED DAYS */}
            {expandedCards[expandKey] && (
              <div
                style={{
                  marginTop: 14,
                  background: "#f1f5f9",
                  borderRadius: 18,
                  padding: 14,
                }}
              >
                {displayRecords.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 8px",
                      borderBottom:
                        i !== displayRecords.length - 1
                          ? "1px solid #e5e7eb"
                          : "none",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "#1f2937" }}>
                      📅 {new Date(r.date).toDateString()}
                    </span>

                    <span
                      style={{
                        padding: "6px 14px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 900,
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
  <div style={{ position: "relative", paddingBottom: "70px", background: "#f8fafc" }}>
    {/* Semester Tabs */}
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "24px",
        marginBottom: "18px",
        paddingTop: "12px"
      }}
    >
      {["semester1", "semester2"].map((sem) => {
        const active = activeSemester === sem;
        return (
          <button
            key={sem}
            onClick={() => setActiveSemester(sem)}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              fontWeight: 800,
              color: active ? "#2563eb" : "#64748b",
              padding: "8px 12px",
              borderBottom: active ? "3px solid #2563eb" : "3px solid transparent"
            }}
          >
            {sem === "semester1" ? "Semester 1" : "Semester 2"}
          </button>
        );
      })}
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "20px",
        padding: "20px",
      }}
    >
      {loading ? (
        <div style={{ textAlign: "center", gridColumn: "1 / -1", padding: "30px" }}>
          Loading performance...
        </div>
      ) : Object.keys(studentMarks).length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "30px",
            borderRadius: "18px",
            background: "#ffffff",
            color: "#475569",
            fontSize: "16px",
            fontWeight: "600",
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            gridColumn: "1 / -1",
          }}
        >
          🚫 No Performance Records
        </div>
      ) : (
        Object.entries(studentMarks).map(([courseId, studentCourseData], idx) => {
          // studentCourseData should match the structure:
          // { teacherName: "...", semester1: { assessments: {...} }, semester2: { assessments: {...} } }
          const semesterData = studentCourseData?.[activeSemester] || {};
          const assessments = semesterData.assessments || {};
          // assessments is an object like { a1: {name, score, max}, a2: {...} }
          const assessmentList = Object.values(assessments || {});

          const total = assessmentList.reduce((sum, a) => sum + (Number(a.score) || 0), 0);
          const maxTotal = assessmentList.reduce((sum, a) => sum + (Number(a.max) || 0), 0);
          const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

          const statusColor =
            percentage >= 75
              ? "#16a34a"
              : percentage >= 50
              ? "#f59e0b"
              : "#dc2626";

          const courseName = courseId.replace("course_", "").replace(/_/g, " ");

          return (
            <div
              key={`${courseId}-${idx}`}
              style={{
                padding: "18px",
                borderRadius: "20px",
                background: "#ffffff",
                boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
                color: "#0f172a",
                transition: "all 0.3s ease",
              }}
            >
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "800",
                  marginBottom: "14px",
                  textTransform: "capitalize",
                  color: "#2563eb",
                }}
              >
                {courseName}
              </div>

              {/* Score Circle */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                <div
                  style={{
                    width: "90px",
                    height: "90px",
                    borderRadius: "50%",
                    background: `conic-gradient(${statusColor} ${percentage * 3.6}deg, #e5e7eb 0deg)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: "66px",
                      height: "66px",
                      borderRadius: "50%",
                      background: "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ fontSize: "18px", fontWeight: "800", color: statusColor }}>
                      {total}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      / {maxTotal}
                    </div>
                  </div>
                </div>
              </div>

              {/* Marks Bars */}
              {assessmentList.length === 0 ? (
                <div style={{ textAlign: "center", color: "#94a3b8" }}>No assessments for {activeSemester}</div>
              ) : (
                assessmentList.map((a, i) => (
                  <div key={i} style={{ marginBottom: "10px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#334155",
                      }}
                    >
                      <span>{a.name}</span>
                      <span>
                        {Number(a.score) || 0} / {Number(a.max) || 0}
                      </span>
                    </div>
                    <div
                      style={{
                        height: "6px",
                        borderRadius: "999px",
                        background: "#e5e7eb",
                        marginTop: "5px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${((Number(a.score) || 0) / (Number(a.max) || 1)) * 100}%`,
                          height: "100%",
                          background:
                            a.max >= 50
                              ? "#ea580c"
                              : a.max >= 30
                              ? "#16a34a"
                              : "#2563eb",
                        }}
                      />
                    </div>
                  </div>
                ))
              )}

              {/* Status */}
              <div
                style={{
                  marginTop: "12px",
                  textAlign: "center",
                  fontSize: "13px",
                  fontWeight: "700",
                  color: statusColor,
                }}
              >
                {percentage >= 75
                  ? "Excellent"
                  : percentage >= 50
                  ? "Good"
                  : "Needs Improvement"}
              </div>

              {/* Teacher */}
              <div
                style={{
                  marginTop: "6px",
                  textAlign: "center",
                  fontSize: "12px",
                  color: "#64748b",
                }}
              >
                👨‍🏫 {studentCourseData.teacherName || semesterData.teacherName || "N/A"}
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>
)}
         </div>


    {/* ---------------- MESSAGE BUTTON (rigid) ---------------- */}
    <div
      onClick={() => setStudentChatOpen(true)}
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        width: "48px",
        height: "48px",
        background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        cursor: "pointer",
        zIndex: 9999,
        boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.08)";
        e.currentTarget.style.boxShadow = "0 12px 26px rgba(0,0,0,0.35)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 8px 18px rgba(0,0,0,0.25)";
      }}
    >
      <FaCommentDots size={22} />
    </div>

   {/* ----- MESSAGE BUTTON & POPUP (always at same position) ----- */}
{selectedStudent && !studentChatOpen && (
  <div
    onClick={() => setStudentChatOpen(true)}
    style={{
      position: "fixed",
      bottom: "20px",
      right: "20px",
      width: "48px",
      height: "48px",
      background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
      borderRadius: "50%",
      display: "grid",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      cursor: "pointer",
      zIndex: 1000, // less than popup
      boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
      transition: "transform 0.2s ease, box-shadow 0.2s ease",
    }}
    tabIndex={0}
    aria-label="Open student chat"
    onMouseEnter={e => {
      e.currentTarget.style.transform = "scale(1.08)";
      e.currentTarget.style.boxShadow = "0 12px 26px rgba(0,0,0,0.35)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = "scale(1)";
      e.currentTarget.style.boxShadow = "0 8px 18px rgba(0,0,0,0.25)";
    }}
  >
    <FaCommentDots size={22} />
  </div>
)}

{studentChatOpen && selectedStudent && (
  <div
    style={{
      position: "fixed",
      bottom: "12px",
      right: "18px",
      width: "340px",
      background: "#fff",
      borderRadius: "12px",
      boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
      padding: "15px",
      zIndex: 3000, // any number higher than the button
      display: "flex",
      flexDirection: "column",
    }}
  >
    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ddd", paddingBottom: "10px" }}>
      <strong>{selectedStudent.name}</strong>
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={() => {
            setStudentChatOpen(false);
            navigate("/all-chat", {
              state: {
                user: {
                  userId: selectedStudent.userId,
                  name: selectedStudent.name,
                  profileImage: selectedStudent.profileImage || "/default-profile.png",
                },
                userType: "student",
              },
            });
          }}
          style={{background:"none", border:"none", cursor:"pointer"}}
        >
          <img width="30" height="30" src="https://img.icons8.com/ios-glyphs/30/expand--v1.png" alt="expand" />
        </button>
        <button onClick={() => setStudentChatOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>
          ×
        </button>
      </div>
    </div>

    {/* Chat Body */}
    <div style={{ height: "260px", overflowY: "auto", padding: "10px" }}>
      {popupMessages.length === 0 ? (
        <p style={{ color: "#aaa", textAlign: "center" }}>No messages yet</p>
      ) : (
        popupMessages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: "10px", textAlign: msg.senderId === admin.userId ? "right" : "left" }}>
            <span
              style={{
                background: msg.senderId === admin.userId ? "#4b6cb7" : "#eee",
                color: msg.senderId === admin.userId ? "#fff" : "#000",
                padding: "6px 12px",
                borderRadius: "12px",
                display: "inline-block",
                maxWidth: "80%",
              }}
            >
              {msg.text}
              {msg.edited && (
                <span style={{ fontSize: "10px", opacity: 0.7 }}> (edited)</span>
              )}
            </span>
          </div>
        ))
      )}
    </div>

    {/* Input */}
    <div style={{ display: "flex", marginTop: "8px", gap: "5px" }}>
      <input type="text" value={popupInput} onChange={(e) => setPopupInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendPopupMessage()} placeholder="Type a message..." style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #ddd" }} />
      <button onClick={() => sendPopupMessage()} style={{ background: "none", border: "none", color: "#3654dada", cursor: "pointer", fontSize: "30px" }}>
        ➤
      </button>
    </div>
  </div>
)}


          </aside>
        </>



      )}
    </div>

  </div>
)}
export default StudentsPage;