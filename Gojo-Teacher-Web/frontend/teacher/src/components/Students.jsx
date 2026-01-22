import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaSearch,
  FaBell,
  FaUsers,
  FaClipboardCheck,
  FaStar,
  FaCheckCircle,
  FaTimesCircle,
  FaFacebookMessenger,
  FaCommentDots,
} from "react-icons/fa";
import "../styles/global.css";

// NOTE: we alias `ref` to `dbRef` to avoid confusion with other `ref` variables
import {
  getDatabase,
  ref as dbRef,
  get,
  onValue,
  off,
  update,
} from "firebase/database";
import { db } from "../firebase";

const getChatId = (id1, id2) => {
  return [id1, id2].sort().join("_");
};

const formatTime = (timeStamp) => {
  if (!timeStamp) return "";
  const date = new Date(timeStamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

const API_BASE = "http://127.0.0.1:5000/api";
const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

const StudentItem = ({ student, selected, onClick }) => (
  <div
    onClick={() => onClick(student)}
    style={{
      width: "100%",
      borderRadius: "12px",
      padding: "15px",
      display: "flex",
      alignItems: "center",
      gap: "20px",
      cursor: "pointer",
      background: selected ? "#e0e7ff" : "#fff",
      border: selected ? "2px solid #4b6cb7" : "1px solid #ddd",
      boxShadow: selected ? "0 6px 15px rgba(75,108,183,0.3)" : "0 4px 10px rgba(0,0,0,0.1)",
      transition: "all 0.3s ease",
    }}
  >
    <img
      src={student.profileImage || "/default-profile.png"}
      alt={student.name}
      style={{
        width: "50px",
        height: "50px",
        borderRadius: "50%",
        objectFit: "cover",
        border: selected ? "3px solid #4b6cb7" : "3px solid red",
      }}
    />
    <div>
      <h3 style={{ margin: 0 }}>{student.name}</h3>
      <p style={{ margin: "4px 0", color: "#555" }}>
        Grade {student.grade} - Section {student.section}
      </p>
    </div>
  </div>
);

function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [sections, setSections] = useState([]);

  const [studentTab, setStudentTab] = useState("details");

  const [popupMessages, setPopupMessages] = useState([]);
  const [popupInput, setPopupInput] = useState("");
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState("daily");
  const [assignmentsData, setAssignmentsData] = useState({});
  const [teachersData, setTeachersData] = useState({});
  const [usersData, setUsersData] = useState({});

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

  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);

  const [courses, setCourses] = useState([]);

  const [activeSemester, setActiveSemester] = useState("semester2");

  const [studentMarks, setStudentMarks] = useState({});

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
    setTeacher(storedTeacher);
    // fetch messenger conversations for student page as Dashboard does
    fetchConversations(storedTeacher);
  }, [navigate]);

  // ---------------- LOAD TEACHER INFO ----------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacherInfo(storedTeacher);
  }, [navigate]);

  // mark a post as seen in local storage (students page notifications)
  const getSeenPosts = (teacherId) => {
    return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
  };

  const saveSeenPost = (teacherId, postId) => {
    const seen = getSeenPosts(teacherId);
    if (!seen.includes(postId)) {
      localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seen, postId]));
    }
  };

  // ---------------- FETCH NOTIFICATIONS (ENRICHED WITH ADMIN INFO) ----------------
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // 1) fetch posts
        const res = await axios.get(`${API_BASE}/get_posts`);
        let postsData = res.data || [];

        // normalize to array
        if (!Array.isArray(postsData) && typeof postsData === "object") {
          postsData = Object.values(postsData);
        }

        // 2) fetch School_Admins and Users from RTDB
        const [adminsRes, usersRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/School_Admins.json`),
          axios.get(`${RTDB_BASE}/Users.json`),
        ]);
        const schoolAdmins = adminsRes.data || {};
        const users = usersRes.data || {};

        // build helper maps
        const usersByKey = { ...users };
        const usersByUserId = {};
        Object.values(users).forEach((u) => {
          if (u && u.userId) usersByUserId[u.userId] = u;
        });

        // Resolve helper: adminKey -> { name, profile }
        const resolveAdminInfo = (post) => {
          const adminId = post.adminId || post.posterAdminId || post.poster || post.admin || null;

          // 1) adminId is School_Admins key
          if (adminId && schoolAdmins[adminId]) {
            const schoolAdminRec = schoolAdmins[adminId];
            const userKey = schoolAdminRec.userId;
            const userRec = usersByKey[userKey] || usersByUserId[userKey] || null;
            const name = (userRec && userRec.name) || schoolAdminRec.name || schoolAdminRec.username || post.adminName || "Admin";
            const profile = (userRec && (userRec.profileImage || userRec.profile)) || schoolAdminRec.profileImage || post.adminProfile || "/default-profile.png";
            return { name, profile };
          }

          // 2) adminId might already be a Users key
          if (adminId && usersByKey[adminId]) {
            const userRec = usersByKey[adminId];
            return {
              name: userRec.name || userRec.username || post.adminName || "Admin",
              profile: userRec.profileImage || post.adminProfile || "/default-profile.png",
            };
          }

          // 3) adminId might be a user.userId field value
          if (adminId && usersByUserId[adminId]) {
            const userRec = usersByUserId[adminId];
            return {
              name: userRec.name || userRec.username || post.adminName || "Admin",
              profile: userRec.profileImage || post.adminProfile || "/default-profile.png",
            };
          }

          // 4) Fallback to any admin fields present on the post itself
          return {
            name: post.adminName || post.name || post.username || "Admin",
            profile: post.adminProfile || post.profileImage || "/default-profile.png",
          };
        };

        // build notifications (enriched)
        const latest = postsData
          .slice()
          .sort((a, b) => {
            const ta = a.time ? new Date(a.time).getTime() : a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tb = b.time ? new Date(b.time).getTime() : b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return tb - ta;
          })
          .slice(0, 5)
          .map((post) => {
            const info = resolveAdminInfo(post);
            return {
              id: post.postId || post.id || null,
              title: post.message?.substring(0, 50) || "Untitled post",
              adminName: info.name,
              adminProfile: info.profile,
            };
          });

        setNotifications(latest);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };

    fetchNotifications();
  }, []);

  // Handle notification click
  const handleNotificationClick = (postId, index) => {
    setHighlightedPostId(postId);

    // Scroll the post into view
    const postElement = postRefs.current[postId];
    if (postElement) {
      postElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // Remove clicked notification
    const updatedNotifications = [...notifications];
    updatedNotifications.splice(index, 1);
    setNotifications(updatedNotifications);

    // Close popup
    setShowNotifications(false);

    // Remove highlight after 3 seconds
    setTimeout(() => setHighlightedPostId(null), 3000);
  };

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
  useEffect(() => {
    if (!teacherInfo?.userId) return;

    async function fetchStudents() {
      try {
        setLoading(true);

        const [
          studentsRes,
          usersRes,
          coursesRes,
          assignmentsRes,
          teachersRes,
        ] = await Promise.all([
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Courses.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"),
        ]);

        const teachers = teachersRes.data || {};
        const teacherEntry = Object.entries(teachers).find(([_, t]) => t.userId === teacherInfo.userId);

        if (!teacherEntry) {
          console.warn("Teacher not found in Teachers node");
          setStudents([]);
          return;
        }

        const teacherKey = teacherEntry[0];

        const assignedCourses = Object.values(assignmentsRes.data || {})
          .filter((a) => a.teacherId === teacherKey)
          .map((a) => a.courseId);

        const students = Object.entries(studentsRes.data || {}).map(([studentId, s]) => {
          const user = Object.values(usersRes.data || {}).find((u) => u.userId === s.userId);

          return {
            ...s,
            studentId, // the RTDB key for the student record
            name: user?.name || "Unknown",
            email: user?.email || "",
            profileImage: user?.profileImage || "/default-profile.png",
          };
        }).filter((s) =>
          assignedCourses.some((cid) => {
            const c = coursesRes.data?.[cid];
            return c && c.grade === s.grade && c.section === s.section;
          })
        );

        setStudents(students);
        setError("");
      } catch (e) {
        console.error(e);
        setError("Failed to load students");
      } finally {
        setLoading(false);
      }
    }

    fetchStudents();
  }, [teacherInfo]);

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
      setSelectedSection("All");
    }
  }, [selectedGrade, students]);

  const filteredStudents = students.filter((s) => {
    if (selectedGrade !== "All" && s.grade !== selectedGrade) return false;
    if (selectedSection !== "All" && s.section !== selectedSection) return false;
    return true;
  });

  const grades = [...new Set(students.map((s) => s.grade))].sort();

  // ---------------- FETCH ATTENDANCE ----------------
  useEffect(() => {
    if (!selectedStudent?.studentId) return;

    async function fetchAttendance() {
      setAttendanceLoading(true);

      try {
        const res = await axios.get(
          "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Attendance.json"
        );

        const attendance = [];

        Object.entries(res.data || {}).forEach(([courseId, dates]) => {
          Object.entries(dates || {}).forEach(([date, students]) => {
            const status = students[selectedStudent.studentId];
            if (!status) return;

            attendance.push({
              courseId,
              date,
              status,
            });
          });
        });

        setAttendanceData(attendance);
      } catch (err) {
        console.error("Attendance fetch error:", err);
        setAttendanceData([]);
      } finally {
        setAttendanceLoading(false);
      }
    }

    fetchAttendance();
  }, [selectedStudent]);

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
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentNotes/${selectedStudent?.userId}.json`
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
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentNotes/${selectedStudent?.userId}.json`,
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
    const messagesRef = dbRef(db, `Chats/${chatKey}/messages`);

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
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatId}/messages.json`,
      message
    );

    await axios.patch(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatId}.json`,
      {
        participants: { [senderId]: true, [receiverId]: true },
        lastMessage: { text: newMessageText, senderId, seen: false, timeStamp },
        unread: { [receiverId]: 1 },
      }
    );

    setNewMessageText("");
  };

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

  return (
    <div className="dashboard-page">
      {/* Top Navbar */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>
        <div className="nav-search">
          <FaSearch className="search-icon" />
          <input type="text" placeholder="Search Teacher and Student..." />
        </div>
        <div className="nav-right">
          {/* Notification Bell & Popup */}
          <div className="icon-circle">
            <div
              onClick={() => setShowNotifications(!showNotifications)}
              style={{ cursor: "pointer", position: "relative" }}
            >
              <FaBell size={24} />
              {notifications.length > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -5,
                    right: -5,
                    background: "red",
                    color: "white",
                    borderRadius: "50%",
                    width: 18,
                    height: 18,
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {notifications.length}
                </span>
              )}
            </div>

            {showNotifications && (
              <div
                style={{
                  position: "absolute",
                  top: 30,
                  right: 0,
                  width: 300,
                  maxHeight: 400,
                  overflowY: "auto",
                  background: "#fff",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
                  borderRadius: 8,
                  zIndex: 100,
                }}
              >
                {notifications.length > 0 ? (
                  notifications.map((post, index) => (
  <div
    key={post.id || index}
    onClick={() => {
      // Remove only the clicked notification (by index)
      setNotifications(prev => prev.filter((_, i) => i !== index));
      setShowNotifications(false);

      // Optionally, still navigate and highlight after clicking
      navigate("/dashboard");

      setTimeout(() => {
        const postElement = postRefs.current[post.id];
        if (postElement) {
          postElement.scrollIntoView({ behavior: "smooth", block: "center" });
          setHighlightedPostId(post.id);
          setTimeout(() => setHighlightedPostId(null), 3000);
        }
      }, 150);
    }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "10px 15px",
                        borderBottom: "1px solid #eee",
                        cursor: "pointer",
                      }}
                    >
                      <img
                        src={post.adminProfile}
                        alt={post.adminName}
                        style={{
                          width: 35,
                          height: 35,
                          borderRadius: "50%",
                          marginRight: 10,
                        }}
                      />
                      <div>
                        <strong>{post.adminName}</strong>
                        <p style={{ margin: 0, fontSize: 12 }}>{post.title}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: 15 }}>No notifications</div>
                )}
              </div>
            )}
          </div>

          {/* Messenger (same as Dashboard) */}
          <div className="icon-circle" style={{ position: "relative", marginLeft: 12 }}>
            <div onClick={handleMessengerToggle} style={{ cursor: "pointer", position: "relative" }}>
              <FaFacebookMessenger size={22} />
              {totalUnreadMessages > 0 && (
                <span style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "#0b78f6",
                  color: "#fff",
                  borderRadius: "50%",
                  minWidth: 18,
                  height: 18,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 5px"
                }}>
                  {totalUnreadMessages}
                </span>
              )}
            </div>

            {showMessenger && (
              <div style={{
                position: "absolute",
                top: 34,
                right: 0,
                width: 340,
                maxHeight: 420,
                overflowY: "auto",
                background: "#fff",
                boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                borderRadius: 8,
                zIndex: 200,
                padding: 8
              }}>
                {conversations.length === 0 ? (
                  <div style={{ padding: 14 }}>No unread messages</div>
                ) : conversations.map((conv, idx) => (
                  <div key={conv.chatId || idx}
                       onClick={() => handleOpenConversation(conv, idx)}
                       style={{ display: "flex", gap: 12, alignItems: "center", padding: 10, borderBottom: "1px solid #eee", cursor: "pointer" }}>
                    <img src={conv.profile || "/default-profile.png"} alt={conv.displayName} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{conv.displayName}</strong>
                        {conv.unreadForMe > 0 && (
                          <span style={{ background: "#0b78f6", color: "#fff", padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>
                            {conv.unreadForMe}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>{conv.lastMessageText || "No messages yet"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="icon-circle" onClick={() => navigate("/settings")}><FaCog /></div>
          <img src={teacher?.profileImage || "/default-profile.png"} />

        </div>
      </nav>

      <div className="google-dashboard">
        {/* Sidebar */}
        <div className="google-sidebar">
          {teacher && (
            <div className="sidebar-profile">
              <div className="sidebar-img-circle">
                <img src={teacher.profileImage || "/default-profile.png"} alt="profile" />
              </div>
              <h3>{teacher.name}</h3>
              <p>{teacher.username}</p>
            </div>
          )}
          <div className="sidebar-menu">
            <Link className="sidebar-btn" to="/dashboard">
              <FaHome /> Home
            </Link>

            <Link className="sidebar-btn" to="/students" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}>
              <FaUsers /> Students
            </Link>
            <Link className="sidebar-btn" to="/admins">
              <FaUsers /> Admins
            </Link>
            <Link className="sidebar-btn" to="/parents">
              <FaChalkboardTeacher /> Parents
            </Link>
            <Link className="sidebar-btn" to="/marks">
              <FaClipboardCheck /> Marks
            </Link>
            <Link className="sidebar-btn" to="/attendance">
              <FaUsers /> Attendance
            </Link>
            <Link className="sidebar-btn" to="/schedule" >
              <FaUsers /> Schedule
            </Link>
            
            <button className="sidebar-btn logout-btn" onClick={handleLogout}>
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>
        {/* MAIN CONTENT */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "30px" }}>
          <div style={{ width: "40%", position: "relative" }}>
            <h2 style={{ textAlign: "center", marginBottom: "20px" }}>My Students</h2>

            {/* Grades */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
              <button onClick={() => setSelectedGrade("All")} style={{ padding: "8px 15px", borderRadius: "8px", background: selectedGrade === "All" ? "#4b6cb7" : "#ddd", color: selectedGrade === "All" ? "#fff" : "#000", border: "none" }}>All Grades</button>
              {grades.map(g => (
                <button key={g} onClick={() => setSelectedGrade(g)} style={{ padding: "8px 15px", borderRadius: "8px", background: selectedGrade === g ? "#4b6cb7" : "#ddd", color: selectedGrade === g ? "#fff" : "#000", border: "none" }}>Grade {g}</button>
              ))}
            </div>
            {/* Sections */}
            {selectedGrade !== "All" && (
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
                <button onClick={() => setSelectedSection("All")} style={{ padding: "6px 12px", borderRadius: "8px", background: selectedSection === "All" ? "#4b6cb7" : "#ddd", color: selectedSection === "All" ? "#fff" : "#000", border: "none" }}>All Sections</button>
                {sections.map(sec => (
                  <button key={sec} onClick={() => setSelectedSection(sec)} style={{ padding: "6px 12px", borderRadius: "8px", background: selectedSection === sec ? "#4b6cb7" : "#ddd", color: selectedSection === sec ? "#fff" : "#000", border: "none" }}>Section {sec}</button>
                ))}
              </div>
            )}
            {/* Student list */}
            {loading && <p>Loading students...</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}
            {!loading && !error && filteredStudents.length === 0 && <p>No students found.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredStudents.map((s, index) => (
                <StudentItem
                  key={s.userId || s.id || index}
                  student={s}
                  selected={selectedStudent?.userId === s.userId}
                  onClick={() => setSelectedStudent(s)}
                />
              ))}
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          {/* RIGHT SIDEBAR */}
          {selectedStudent && (
            <div
              style={{
                width: "30%",
                background: "#fff",
                boxShadow: "0 0 15px rgba(0,0,0,0.05)",
                position: "fixed",
                right: 0,
                top: "60px",
                height: "calc(100vh - 60px)",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
              }}
            >
              {/* Student Info */}
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div
                  style={{
                    width: "120px",
                    height: "120px",
                    margin: "0 auto 15px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "4px solid #4b6cb7",
                  }}
                >
                  <img
                    src={selectedStudent.profileImage}
                    alt={selectedStudent.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <h2 style={{ margin: 0, fontSize: "22px" }}>{selectedStudent.name}</h2>
                <p style={{ color: "#555", margin: "5px 0" }}>{selectedStudent.email}</p>
                <p style={{ color: "#555", margin: "5px 0" }}>
                  <strong>Grade:</strong> {selectedStudent.grade}
                </p>
                <p style={{ color: "#555", margin: "5px 0" }}>
                  <strong>Section:</strong> {selectedStudent.section}
                </p>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", marginBottom: "15px" }}>
                {["details", "attendance", "performance"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStudentTab(tab)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontWeight: "600",
                      color: studentTab === tab ? "#4b6cb7" : "#777",
                      borderBottom:
                        studentTab === tab ? "3px solid #4b6cb7" : "3px solid transparent",
                    }}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div>
                {/* DETAILS TAB */}
                {studentTab === "details" && selectedStudent && (
                  <div style={{ padding: "20px", background: "#f8fafc", minHeight: "calc(100vh - 180px)", position: "relative" }}>

                    {/* Personal Information */}
                    <div
                      style={{
                        background: "linear-gradient(180deg, #ffffff, #f8fafc)",
                        borderRadius: "22px",
                        padding: "22px",
                        marginBottom: "24px",
                        boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      {/* Header */}
                      <div
                        style={{
                          textAlign: "center",
                          marginBottom: "20px",
                        }}
                      >
                        <h2
                          style={{
                            fontSize: "20px",
                            fontWeight: "100",
                            color: "#212424ff",
                            marginBottom: "4px",
                            letterSpacing: "0.3px",
                          }}
                        >
                          Personal & Parent Information
                        </h2>

                      </div>

                      {/* Info Grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "14px 20px",
                        }}
                      >
                        <InfoRow label="Full Name" value={selectedStudent.name} />
                        <InfoRow label="Email" value={selectedStudent.email || "N/A"} />

                        <InfoRow label="Grade" value={selectedStudent.grade} />
                        <InfoRow label="Section" value={selectedStudent.section} />

                        <InfoRow label="Age" value={selectedStudent.age || "N/A"} />
                        <InfoRow label="Student ID" value={selectedStudent?.userId} />

                        <InfoRow
                          label="Enrollment Date"
                          value={selectedStudent.enrollmentDate || "N/A"}
                        />

                        <InfoRow
                          label="Parent Name"
                          value={selectedStudent.parentName || "N/A"}
                        />

                        <InfoRow
                          label="Parent Phone"
                          value={selectedStudent.parentPhone || "N/A"}
                        />
                      </div>
                    </div>

                    {/* Teacher Notes */}
                    <div
                      style={{
                        background: "linear-gradient(180deg, #f1f5f9, #ffffff)",
                        borderRadius: "20px",
                        padding: "20px",
                        marginBottom: "24px",
                        boxShadow: "0 15px 40px rgba(15, 23, 42, 0.08)",
                      }}
                    >
                      {/* Header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          fontSize: "18px",
                          fontWeight: "800",
                          color: "#0f172a",
                          marginBottom: "18px",
                          letterSpacing: "0.4px",
                        }}
                      >
                        📝 Teacher Notes
                      </div>

                      {/* Input Area */}
                      <div
                        style={{
                          background: "#ffffff",
                          borderRadius: "16px",
                          padding: "14px",
                          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                          marginBottom: "18px",
                          transition: "all 0.3s ease",
                        }}
                      >
                        <textarea
                          value={newTeacherNote}
                          onChange={(e) => setNewTeacherNote(e.target.value)}
                          placeholder="Write a note about this student… 😊"
                          style={{
                            width: "100%",
                            minHeight: "75px",
                            border: "none",
                            outline: "none",
                            resize: "none",
                            fontSize: "14px",
                            color: "#0f172a",
                            lineHeight: "1.6",
                            background: "transparent",
                          }}
                        />

                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                          <button
                            onClick={saveTeacherNote}
                            disabled={savingNote}
                            style={{
                              padding: "9px 18px",
                              borderRadius: "999px",
                              border: "none",
                              background: "linear-gradient(135deg, #38bdf8, #2563eb)",
                              color: "#fff",
                              fontWeight: "700",
                              fontSize: "13px",
                              cursor: "pointer",
                              opacity: savingNote ? 0.6 : 1,
                              boxShadow: "0 6px 18px rgba(37, 99, 235, 0.4)",
                              transition: "all 0.25s ease",
                            }}
                          >
                            {savingNote ? "Saving…" : "Send"}
                          </button>
                        </div>
                      </div>

                      {/* Notes List */}
                      {teacherNotes.length === 0 ? (
                        <div
                          style={{
                            textAlign: "center",
                            color: "#94a3b8",
                            fontSize: "14px",
                            padding: "12px",
                          }}
                        >
                          No notes yet
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {teacherNotes.map((n) => {
                            const initials = n.teacherName
                              ?.split(" ")
                              .map((w) => w[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase();

                            return (
                              <div
                                key={n.id}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "10px",
                                  animation: "fadeIn 0.3s ease",
                                }}
                              >
                                {/* Avatar */}
                                <div
                                  style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "50%",
                                    background: "linear-gradient(135deg, #60a5fa, #2563eb)",
                                    color: "#fff",
                                    fontWeight: "800",
                                    fontSize: "13px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    boxShadow: "0 4px 12px rgba(37,99,235,0.4)",
                                  }}
                                >
                                  {initials}
                                </div>

                                {/* Message Bubble */}
                                <div
                                  style={{
                                    maxWidth: "80%",
                                    background: "#e0f2fe",
                                    borderRadius: "16px 16px 16px 6px",
                                    padding: "12px 14px",
                                    boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: "700",
                                      color: "#0369a1",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    {n.teacherName}
                                  </div>

                                  <div
                                    style={{
                                      fontSize: "14px",
                                      color: "#0f172a",
                                      lineHeight: "1.6",
                                      whiteSpace: "pre-wrap",
                                    }}
                                  >
                                    {n.note}
                                  </div>

                                  <div
                                    style={{
                                      fontSize: "11px",
                                      color: "#64748b",
                                      marginTop: "6px",
                                      textAlign: "right",
                                    }}
                                  >
                                    {new Date(n.createdAt).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Animation */}
                      <style>
                        {`
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}
                      </style>
                    </div>
                    {/* Achievements */}
                    {selectedStudent.achievements && selectedStudent.achievements.length > 0 && (
                      <div style={{
                        background: "#fff",
                        borderRadius: "15px",
                        padding: "20px",
                        marginBottom: "80px", // extra padding for fixed button
                        boxShadow: "0 8px 25px rgba(0,0,0,0.1)",
                        transition: "all 0.3s ease"
                      }}>
                        <h2 style={{ fontSize: "20px", color: "#d946ef", fontWeight: "700", marginBottom: "12px", textAlign: "center" }}>
                          Achievements
                        </h2>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
                          {selectedStudent.achievements.map((ach, idx) => (
                            <div key={idx} style={{
                              background: "linear-gradient(135deg, #4b6cb7, #182848)",
                              color: "#fff",
                              padding: "6px 14px",
                              borderRadius: "999px",
                              fontSize: "13px",
                              fontWeight: "700",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                              transition: "all 0.3s ease",
                            }}>
                              {ach}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* ATTENDANCE TAB */}
                {studentTab === "attendance" && selectedStudent && (
                  <div style={{ padding: "20px", background: "#f8fafc", minHeight: "calc(100vh - 180px)", position: "relative" }}>

                    {/* Daily / Weekly / Monthly Tabs */}
                    <div style={{ display: "flex", marginBottom: "20px", gap: "10px" }}>
                      {["daily", "weekly", "monthly"].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setAttendanceFilter(tab)}
                          style={{
                            flex: 1,
                            padding: "10px 0",
                            border: "none",
                            borderRadius: "12px",
                            backgroundColor: attendanceFilter === tab ? "#4b6cb7" : "#e5e7eb",
                            color: attendanceFilter === tab ? "#fff" : "#475569",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.3s ease",
                          }}
                        >
                          {tab.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    {/* Attendance Summary with Filter Percentages */}
                    {!attendanceLoading && attendanceData.length > 0 && (
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "20px",
                        padding: "15px 20px",
                        background: "#fff",
                        borderRadius: "15px",
                        boxShadow: "0 8px 25px rgba(0,0,0,0.08)"
                      }}>
                        {["daily", "weekly", "monthly"].map((filter) => {
                          const today = new Date();
                          const filteredData = attendanceData.filter(a => {
                            const recordDate = new Date(a.date);
                            if (filter === "daily") return recordDate.toDateString() === today.toDateString();
                            if (filter === "weekly") {
                              const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
                              const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + 6);
                              return recordDate >= firstDay && recordDate <= lastDay;
                            }
                            if (filter === "monthly") return recordDate.getMonth() === today.getMonth() && recordDate.getFullYear() === today.getFullYear();
                            return true;
                          });
                          const presentCount = filteredData.filter(a => a.status.toLowerCase() === "present").length;
                          const percentage = filteredData.length > 0 ? Math.round((presentCount / filteredData.length) * 100) : 0;

                          return (
                            <div key={filter}>
                              <span style={{ fontSize: "14px", color: "#64748b" }}>{filter.toUpperCase()}</span>
                              <div style={{ fontSize: "18px", fontWeight: "700", color: "#2563eb" }}>{percentage}%</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Attendance Data */}
                    {attendanceLoading && <p style={{ textAlign: "center", color: "#888" }}>Loading attendance...</p>}

                    {!attendanceLoading && attendanceData.length === 0 && (
                      <p style={{ color: "#888", textAlign: "center" }}>🚫 No attendance records found.</p>
                    )}
                    {!attendanceLoading &&
                      attendanceData
                        .filter((a) => {
                          const today = new Date();
                          const recordDate = new Date(a.date);

                          if (attendanceFilter === "daily") {
                            return recordDate.toDateString() === today.toDateString();
                          } else if (attendanceFilter === "weekly") {
                            const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
                            const lastDayOfWeek = new Date(firstDayOfWeek.getFullYear(), firstDayOfWeek.getMonth(), firstDayOfWeek.getDate() + 6);
                            return recordDate >= firstDayOfWeek && recordDate <= lastDayOfWeek;
                          } else if (attendanceFilter === "monthly") {
                            return recordDate.getMonth() === today.getMonth() && recordDate.getFullYear() === today.getFullYear();
                          }
                          return true;
                        })
                        .map((a, index) => (
                          <div
                            key={index}
                            style={{
                              marginBottom: "15px",
                              padding: "15px 20px",
                              borderRadius: "15px",
                              background: "#fff",
                              boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
                              transition: "all 0.3s ease",
                            }}
                          >
                            {/* Subject + Date */}
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
                              <span style={{ fontWeight: "700", fontSize: "16px", color: "#2563eb" }}>{a.subject}</span>
                              <span style={{ fontSize: "13px", color: "#64748b" }}>{a.date}</span>
                            </div>

                            {/* Teacher + Status */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                              <span style={{ fontSize: "14px", color: "#374151" }}>👨‍🏫 {a.teacherName}</span>
                              <span
                                style={{
                                  padding: "5px 16px",
                                  borderRadius: "999px",
                                  fontSize: "14px",
                                  fontWeight: "700",
                                  backgroundColor:
                                    a.status.toLowerCase() === "present"
                                      ? "#16a34a"
                                      : a.status.toLowerCase() === "late"
                                        ? "#f59e0b"
                                        : "#dc2626", // red for absent
                                  color: "#fff",
                                }}
                              >
                                {a.status.toUpperCase()}
                              </span>
                            </div>
                            {/* Progress Bar */}
                            <div style={{ height: "8px", borderRadius: "12px", background: "#e5e7eb", overflow: "hidden" }}>
                              <div
                                style={{
                                  width:
                                    a.status.toLowerCase() === "present"
                                      ? "100%"
                                      : a.status.toLowerCase() === "late"
                                        ? "50%"
                                        : "0%", // 50% for late
                                  height: "100%",
                                  background:
                                    a.status.toLowerCase() === "present"
                                      ? "#16a34a"
                                      : a.status.toLowerCase() === "late"
                                        ? "#f59e0b"
                                        : "#dc2626",
                                  transition: "width 0.4s ease",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                  </div>
                )}

                {/* PERFORMANCE TAB */}
                {studentTab === "performance" && (
                  <div style={{ position: "relative", paddingBottom: "70px", background: "#f8fafc" }}>

                    {/* Semester Tabs */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "40px",
                        marginBottom: "25px",
                        borderBottom: "2px solid #e5e7eb",
                        paddingBottom: "8px",
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
                              fontSize: "16px",
                              fontWeight: "800",
                              color: isActive ? "#2563eb" : "#64748b",
                              paddingBottom: "10px",
                              position: "relative",
                            }}
                          >
                            {sem === "semester1" ? "Semester 1" : "Semester 2"}
                            {isActive && (
                              <span
                                style={{
                                  position: "absolute",
                                  bottom: "-2px",
                                  left: 0,
                                  width: "100%",
                                  height: "4px",
                                  background: "linear-gradient(135deg,#4b6cb7,#1e40af)",
                                  borderRadius: "6px",
                                }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Marks Cards */}
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
                      ) : Object.keys(studentMarksFlattened || {}).length === 0 ? (
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
                                padding: "18px",
                                borderRadius: "20px",
                                background: "#ffffff",
                                boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
                              }}
                            >
                              {/* Course Name */}
                              <div
                                style={{
                                  fontSize: "16px",
                                  fontWeight: "800",
                                  marginBottom: "14px",
                                  color: "#2563eb",
                                  textAlign: "center",
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
                                    background: `conic-gradient(${statusClr} ${percentage * 3.6}deg, #e5e7eb 0deg)`,
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
                                      background: "#fff",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <strong style={{ color: statusClr }}>{total}</strong>
                                    <span style={{ fontSize: "11px" }}>/ {maxTotal}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Assessment Bars */}
                              {Object.entries(assessments).map(([key, a]) => (
                                <div key={key} style={{ marginBottom: "10px" }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      fontSize: "13px",
                                      fontWeight: "600",
                                    }}
                                  >
                                    <span>{a.name}</span>
                                    <span>
                                      {a.score} / {a.max}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      height: "6px",
                                      borderRadius: "999px",
                                      background: "#e5e7eb",
                                      marginTop: "5px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${(a.score / a.max) * 100}%`,
                                        height: "100%",
                                        background: statusClr,
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}

                              {/* Status */}
                              <div
                                style={{
                                  marginTop: "10px",
                                  textAlign: "center",
                                  fontWeight: "700",
                                  color: statusClr,
                                }}
                              >
                                {percentage >= 75
                                  ? "Excellent"
                                  : percentage >= 50
                                    ? "Good"
                                    : "Needs Improvement"}
                              </div>

                              {/* Teacher Name */}
                              <div
                                style={{
                                  marginTop: "6px",
                                  textAlign: "center",
                                  fontSize: "12px",
                                  color: "#64748b",
                                }}
                              >
                                👨‍🏫 {studentCourseData.teacherName || data.teacherName || "N/A"}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* Chat Button */}
              {!chatOpen && (
                <div
                  onClick={() => setChatOpen(true)}
                  style={{
                    position: "fixed",
                    bottom: "20px",
                    right: "20px",
                    width: "50px",
                    height: "50px",
                    background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    cursor: "pointer",
                    zIndex: 1000,
                    boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  <FaCommentDots size={24} />
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
                          navigate("/all-chat", {
                            state: {
                              user: selectedStudent, // user to auto-select
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
                      messages.map((m) => (
                        <div
                          key={m.messageId || m.id}
                          style={{
                            display: "flex",
                            justifyContent:
                              m.senderId === teacher?.userId ? "flex-end" : "flex-start",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              padding: "8px 14px",
                              borderRadius: "20px",
                              background:
                                m.senderId === teacher?.userId ? "#4b6cb7" : "#e5e5ea",
                              color: m.senderId === teacher?.userId ? "#fff" : "#000",
                              maxWidth: "70%",
                              wordWrap: "break-word",
                              transition: "all 0.2s",
                            }}
                          >
                            {m.text}
                          </span>
                        </div>
                      ))
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
                        borderRadius: "999px",
                        border: "1px solid #ccc",
                        outline: "none",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendMessage(newMessageText);
                      }}
                    />
                    <button
                      onClick={() => sendMessage(newMessageText)}
                      style={{
                        background:
                          "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
                        border: "none",
                        borderRadius: "50%",
                        width: "42px",
                        height: "42px",
                        color: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                      }}
                    >
                      ➤
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentsPage;