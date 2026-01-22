import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaTrash,
  FaSave,
  FaEdit,
  FaHome,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaSearch,
  FaClipboardCheck,
  FaUsers,
  FaChalkboardTeacher,
  FaFacebookMessenger,
} from "react-icons/fa";
import "../styles/global.css";

const API_BASE = "http://127.0.0.1:5000/api";
const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

export default function MarksPage() {
  const [teacher, setTeacher] = useState(null);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [assessmentList, setAssessmentList] = useState([]);
  const [studentMarks, setStudentMarks] = useState({});
  const [structureSubmitted, setStructureSubmitted] = useState(false);
  const [activeSemester, setActiveSemester] = useState("semester2"); // default
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState(null);

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Messenger state (Dashboard-like)
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]);

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

  useEffect(() => {
    if (teacher) {
      fetchConversations(teacher);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher]);

  useEffect(() => {
    if (!selectedCourseId) return;

    const loadCourseData = async () => {
      try {
        const marksRes = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/ClassMarks/${selectedCourseId}.json`
        );

        const course = courses.find((c) => c.id === selectedCourseId);
        if (!course) return;

        const filteredStudents = students.filter(
          (s) => s.grade === course.grade && s.section === course.section
        );

        const initMarks = {};
        let assessmentListFromDB = [];

        filteredStudents.forEach((s) => {
          const semData = marksRes.data?.[s.id]?.[activeSemester];

          if (semData?.assessments) {
            initMarks[s.id] = semData.assessments;

            if (!assessmentListFromDB.length) {
              assessmentListFromDB = Object.values(semData.assessments);
            }
          } else {
            initMarks[s.id] = {};
          }
        });

        setStudentMarks(initMarks);
        setAssessmentList(
          assessmentListFromDB.map((a) => ({ name: a.name, max: a.max }))
        );
        setStructureSubmitted(assessmentListFromDB.length > 0);
      } catch (err) {
        console.error("Error loading marks:", err);
        setStructureSubmitted(false);
        setStudentMarks({});
      }
    };

    loadCourseData();
  }, [selectedCourseId, courses, students, activeSemester]);

  // ---------------- FETCH COURSES ----------------
  useEffect(() => {
    if (!teacher) return;

    const fetchCourses = async () => {
      try {
        const [assignmentsRes, coursesRes, teachersRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/TeacherAssignments.json`),
          axios.get(`${RTDB_BASE}/Courses.json`),
          axios.get(`${RTDB_BASE}/Teachers.json`),
        ]);

        const teacherEntry = Object.entries(teachersRes.data || {}).find(
          ([_, t]) => t.userId === teacherUserId
        );
        if (!teacherEntry) return;
        const teacherKey = teacherEntry[0];

        const assignedCourses = Object.values(assignmentsRes.data || {})
          .filter((a) => a.teacherId === teacherKey)
          .map((a) => a.courseId);

        const teacherCourses = Object.entries(coursesRes.data || {})
          .filter(([courseKey]) => assignedCourses.includes(courseKey))
          .map(([courseKey, course]) => ({ id: courseKey, ...course }));

        setCourses(teacherCourses);
      } catch (err) {
        console.error("Error fetching courses:", err);
      }
    };

    fetchCourses();
  }, [teacher, teacherUserId]);

  // ---------------- FETCH STUDENTS ----------------
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
        }));

        setStudents(mappedStudents);
      } catch (err) {
        console.error("Error fetching students:", err);
        setStudents([]);
      }
    };

    fetchStudents();
  }, [teacherUserId]);

  // ---------------- RESET ASSESSMENTS ON COURSE CHANGE ----------------
  useEffect(() => {
    if (!selectedCourseId) return;
    setAssessmentList([]);
    setStructureSubmitted(false);
    setStudentMarks({});
  }, [selectedCourseId]);

  // ---------------- ASSESSMENT FUNCTIONS ----------------
  const addAssessment = () => setAssessmentList((p) => [...p, { name: "", max: "" }]);
  const updateAssessment = (i, field, value) => {
    const copy = [...assessmentList];
    copy[i][field] = value;
    setAssessmentList(copy);
  };
  const removeAssessment = (i) =>
    setAssessmentList((p) => p.filter((_, idx) => idx !== i));

  // ---------------- SUBMIT STRUCTURE ----------------
  const submitStructure = async () => {
    if (assessmentList.reduce((sum, a) => sum + Number(a.max || 0), 0) !== 100) {
      alert("Total MAX must be exactly 100");
      return;
    }

    const structureObj = {};
    assessmentList.forEach((a, idx) => {
      structureObj[`a${idx + 1}`] = {
        name: a.name,
        max: Number(a.max),
        score: 0,
      };
    });

    try {
      const course = courses.find((c) => c.id === selectedCourseId);
      if (!course) return;

      const filteredStudents = students.filter(
        (s) => s.grade === course.grade && s.section === course.section
      );

      await Promise.all(
        filteredStudents.map((s) =>
          axios.put(
            `${RTDB_BASE}/ClassMarks/${selectedCourseId}/${s.id}/${activeSemester}.json`,
            {
              teacherName: teacher.name,
              assessments: structureObj,
            }
          )
        )
      );

      const initMarks = {};
      filteredStudents.forEach((s) => {
        initMarks[s.id] = structureObj;
      });

      setStudentMarks(initMarks);
      setStructureSubmitted(true);
      alert("Assessment structure saved!");
    } catch (err) {
      console.error("Error submitting structure:", err);
      alert("Failed to submit structure");
    }
  };

  const updateScore = (sid, key, value) => {
    setStudentMarks((p) => ({
      ...p,
      [sid]: { ...p[sid], [key]: { ...p[sid][key], score: Number(value) } },
    }));
  };

  const saveMarks = async (sid) => {
    try {
      await axios.put(
        `${RTDB_BASE}/ClassMarks/${selectedCourseId}/${sid}/${activeSemester}.json`,
        {
          teacherName: teacher.name,
          assessments: studentMarks[sid],
        }
      );
      alert("Marks saved successfully");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save marks");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // ---------------- FETCH NOTIFICATIONS (ENRICHED WITH ADMIN INFO) ----------------
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${API_BASE}/get_posts`);
        let postsData = res.data || [];

        if (!Array.isArray(postsData) && typeof postsData === "object") {
          postsData = Object.values(postsData);
        }

        const [adminsRes, usersRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/School_Admins.json`),
          axios.get(`${RTDB_BASE}/Users.json`),
        ]);
        const schoolAdmins = adminsRes.data || {};
        const users = usersRes.data || {};

        const usersByKey = { ...users };
        const usersByUserId = {};
        Object.values(users).forEach((u) => {
          if (u && u.userId) usersByUserId[u.userId] = u;
        });

        const resolveAdminInfo = (post) => {
          const adminId = post.adminId || post.posterAdminId || post.poster || post.admin || null;
          if (adminId && schoolAdmins[adminId]) {
            const schoolAdminRec = schoolAdmins[adminId];
            const userKey = schoolAdminRec.userId;
            const userRec = usersByKey[userKey] || usersByUserId[userKey] || null;
            const name = (userRec && userRec.name) || schoolAdminRec.name || schoolAdminRec.username || post.adminName || "Admin";
            const profile = (userRec && (userRec.profileImage || userRec.profile)) || schoolAdminRec.profileImage || post.adminProfile || "/default-profile.png";
            return { name, profile };
          }
          if (adminId && usersByKey[adminId]) {
            const userRec = usersByKey[adminId];
            return { name: userRec.name || userRec.username || post.adminName || "Admin", profile: userRec.profileImage || post.adminProfile || "/default-profile.png" };
          }
          if (adminId && usersByUserId[adminId]) {
            const userRec = usersByUserId[adminId];
            return { name: userRec.name || userRec.username || post.adminName || "Admin", profile: userRec.profileImage || post.adminProfile || "/default-profile.png" };
          }
          return { name: post.adminName || post.name || post.username || "Admin", profile: post.adminProfile || post.profileImage || "/default-profile.png" };
        };

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

  // ---------------- MESSENGER: same behavior as Dashboard ----------------
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

      // build maps
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

  const totalUnreadMessages = conversations.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);

  // ---------------- UI ----------------
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
          <div className="icon-circle" style={{ position: "relative" }}>
            <div onClick={() => setShowNotifications(!showNotifications)} style={{ cursor: "pointer", position: "relative" }}>
              <FaBell size={24} />
              {notifications.length > 0 && (
                <span style={{ position: "absolute", top: -5, right: -5, background: "red", color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {notifications.length}
                </span>
              )}
            </div>

            {showNotifications && (
              <div style={{ position: "absolute", top: 30, right: 0, width: 300, maxHeight: 400, overflowY: "auto", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.2)", borderRadius: 8, zIndex: 100 }}>
                {notifications.length > 0 ? notifications.map((post, index) => (
                  <div key={post.id || index} onClick={() => {
                    navigate("/dashboard");
                    setTimeout(() => {
                      // optional highlight logic if your dashboard exposes post refs
                      setHighlightedPostId(post.id);
                      setTimeout(() => setHighlightedPostId(null), 3000);
                    }, 150);
                    setNotifications(prev => prev.filter((_, i) => i !== index));
                    setShowNotifications(false);
                  }} style={{ display: "flex", alignItems: "center", padding: "10px 15px", borderBottom: "1px solid #eee", cursor: "pointer" }}>
                    <img src={post.adminProfile} alt={post.adminName} style={{ width: 35, height: 35, borderRadius: "50%", marginRight: 10 }} />
                    <div><strong>{post.adminName}</strong><p style={{ margin: 0, fontSize: 12 }}>{post.title}</p></div>
                  </div>
                )) : <div style={{ padding: 15 }}>No notifications</div>}
              </div>
            )}
          </div>

          {/* Messenger (same as Dashboard) */}
          <div className="icon-circle" style={{ position: "relative", marginLeft: 12 }}>
            <div onClick={handleMessengerToggle} style={{ cursor: "pointer", position: "relative" }}>
              <FaFacebookMessenger size={22} />
              {totalUnreadMessages > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, background: "#0b78f6", color: "#fff", borderRadius: "50%", minWidth: 18, height: 18, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>
                  {totalUnreadMessages}
                </span>
              )}
            </div>

            {showMessenger && (
              <div style={{ position: "absolute", top: 34, right: 0, width: 340, maxHeight: 420, overflowY: "auto", background: "#fff", boxShadow: "0 4px 14px rgba(0,0,0,0.12)", borderRadius: 8, zIndex: 200, padding: 8 }}>
                {conversations.length === 0 ? (
                  <div style={{ padding: 14 }}>No unread messages</div>
                ) : conversations.map((conv, idx) => (
                  <div key={conv.chatId || idx} onClick={() => handleOpenConversation(conv, idx)} style={{ display: "flex", gap: 12, alignItems: "center", padding: 10, borderBottom: "1px solid #eee", cursor: "pointer" }}>
                    <img src={conv.profile || "/default-profile.png"} alt={conv.displayName} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{conv.displayName}</strong>
                        {conv.unreadForMe > 0 && <span style={{ background: "#0b78f6", color: "#fff", padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{conv.unreadForMe}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>{conv.lastMessageText || "No messages yet"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
            <div className="icon-circle" onClick={() => navigate("/settings")}><FaCog /></div>
          <img src={teacher?.profileImage || "/default-profile.png"} alt="profile" />
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
           
            <Link className="sidebar-btn" to="/students">
              <FaUsers /> Students
            </Link>
            <Link className="sidebar-btn" to="/admins">
              <FaUsers /> Admins
            </Link>
            <Link className="sidebar-btn" to="/parents">
              <FaChalkboardTeacher /> Parents
            </Link>
            <Link
              className="sidebar-btn"
              to="/marks"
              style={{ backgroundColor: "#4b6cb7", color: "#fff" }}
            >
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
<div
  style={{
    flex: 1,
    display: "flex",
    
    justifyContent: "center",
    padding: "40px",
    marginLeft: "150px",
    
    background: "#eef2f7",
    minHeight: "100vh",
    fontFamily: "'Inter', sans-serif",
  }}
>
  <div style={{ width: "55%" }}>
    {/* Page Title */}
    <h2
      style={{
        textAlign: "center",
        marginBottom: "35px",
        color: "#1e3a8a",
        fontSize: "36px",
        fontWeight: "700",
        letterSpacing: "1px",
      }}
    >
      Marks Entry Dashboard
    </h2>

    {/* Course Selection */}
    <div
      style={{
        marginBottom: "30px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "15px",
      }}
    >
      <label
        style={{
          fontWeight: "600",
          color: "#374151",
          fontSize: "16px",
        }}
      >
        Select Course:
      </label>
      <select
        value={selectedCourseId}
        onChange={(e) => setSelectedCourseId(e.target.value)}
        style={{
          padding: "12px 18px",
          borderRadius: "12px",
          border: "1px solid #cbd5e1",
          background: "#fff",
          minWidth: "300px",
          fontSize: "15px",
          fontWeight: "500",
          boxShadow: "0 6px 15px rgba(0,0,0,0.08)",
          transition: "0.3s all",
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
      justifyContent: "center",
      gap: "40px",
      marginBottom: "35px",
      borderBottom: "2px solid #c7d2fe",
      paddingBottom: "10px",
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
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "18px",
            fontWeight: "700",
            letterSpacing: "1px",
            color: isActive ? "#1e40af" : "#6b7280",
            paddingBottom: "12px",
            position: "relative",
            transition: "0.3s all",
          }}
        >
          {sem === "semester1" ? "Semester 1" : "Semester 2"}

          {/* Active underline */}
          {isActive && (
            <span
              style={{
                position: "absolute",
                left: 0,
                bottom: "-2px",
                width: "100%",
                height: "4px",
                borderRadius: "6px",
                background: "linear-gradient(135deg, #4b6cb7, #1e40af)",
              }}
            />
          )}
        </button>
      );
    })}
  </div>
)}






    {/* Edit Structure */}
    {structureSubmitted && (
      <button
        style={{
          marginBottom: "30px",
          padding: "10px 18px",
          background: "linear-gradient(135deg, #f59e0b, #d97706)",
          color: "#fff",
          borderRadius: "12px",
          border: "none",
          fontWeight: "600",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
          transition: "0.3s all",
        }}
        onClick={() => {
          setStructureSubmitted(false);
          setStudentMarks({});
        }}
      >
        <FaEdit /> Edit Assessment Structure
      </button>
    )}

    {/* Assessment Builder */}
    {selectedCourseId && !structureSubmitted && (
      <div
        style={{
          backdropFilter: "blur(15px)",
          background: "rgba(255, 255, 255, 0.85)",
          padding: "30px",
          borderRadius: "20px",
          boxShadow: "0 15px 30px rgba(0,0,0,0.08)",
          marginBottom: "40px",
          transition: "all 0.3s ease",
        }}
      >
        <h3 style={{ marginBottom: "25px", color: "#1f2937", fontWeight: "600", fontSize: "20px" }}>
          Assessment Structure
        </h3>
        {assessmentList.map((a, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: "12px",
              marginBottom: "18px",
              alignItems: "center",
            }}
          >
            <input
              placeholder="Assessment Name"
              value={a.name}
              onChange={(e) => updateAssessment(i, "name", e.target.value)}
              style={{
                flex: 2,
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid #d1d5db",
                outline: "none",
                boxShadow: "inset 0 3px 6px rgba(0,0,0,0.06)",
                fontWeight: "500",
              }}
            />
            <input
              type="number"
              placeholder="Max"
              value={a.max}
              onChange={(e) => updateAssessment(i, "max", e.target.value)}
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid #d1d5db",
                outline: "none",
                boxShadow: "inset 0 3px 6px rgba(0,0,0,0.06)",
                fontWeight: "500",
              }}
            />
            <button
              onClick={() => removeAssessment(i)}
              style={{
                background: "#ef4444",
                color: "#fff",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 6px 15px rgba(0,0,0,0.12)",
                transition: "0.3s all",
              }}
            >
              <FaTrash />
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: "20px", alignItems: "center", marginTop: "20px" }}>
          <button
            style={{
              padding: "12px 20px",
              borderRadius: "14px",
              background: "#10b981",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
              transition: "0.3s all",
            }}
            onClick={addAssessment}
          >
            <FaPlus /> Add Assessment
          </button>
          <span style={{ fontWeight: "600", color: "#374151", fontSize: "16px" }}>
            Total Max: {assessmentList.reduce((sum, a) => sum + Number(a.max || 0), 0)} / 100
          </span>
        </div>
        <button
          style={{
            marginTop: "30px",
            padding: "14px 20px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #4b6cb7, #1e40af)",
            color: "#fff",
            border: "none",
            fontWeight: "600",
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
            transition: "0.3s all",
            fontSize: "16px",
          }}
          onClick={submitStructure}
        >
          Submit Structure
        </button>
      </div>
    )}

    {/* Student Marks Table */}
    {structureSubmitted && (
      <div
        style={{
          overflowX: "auto",
          backdropFilter: "blur(12px)",
          background: "rgba(255,255,255,0.9)",
          padding: "30px",
          borderRadius: "20px",
          boxShadow: "0 15px 30px rgba(0,0,0,0.12)",
          transition: "0.3s all",
        }}
      >
        <table
          style={{
            width: "100%s",
            borderCollapse: "separate",
            borderSpacing: "0 12px",
            fontSize: "15px",
          }}
        >
         <thead>
  <tr
    style={{
      background: "linear-gradient(135deg, #4b6cb7, #1e3a8a)",
      color: "#fff",
      borderRadius: "16px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      textTransform: "uppercase",
      letterSpacing: "1px",
      fontWeight: "600",
      fontSize: "14px",
    }}
  >
    <th
      style={{
        padding: "16px 20px",
        textAlign: "left",
        borderRadius: "16px 0 0 16px",
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

    <th
      style={{
        padding: "16px 18px",
        background: "rgba(255,255,255,0.05)",
        textAlign: "center",
      }}
    >
      Grade
    </th>

    <th
      style={{
        padding: "16px 20px",
        borderRadius: "0 16px 16px 0",
        background: "rgba(255,255,255,0.1)",
        textAlign: "center",
      }}
    >
      <FaSave /> Save
    </th>
  </tr>
</thead>

          <tbody>
            {Object.entries(studentMarks).map(([sid, marks]) => {
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
              const student = students.find((s) => s.id === sid);
              const gradeColor =
                grade === "A"
                  ? "#16a34a"
                  : grade === "B"
                  ? "#2563eb"
                  : grade === "C"
                  ? "#f59e0b"
                  : grade === "D"
                  ? "#f97316"
                  : "#ef4444";
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
                  <td
                    style={{
                      padding: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      fontWeight: "600",
                    }}
                  >
                    <div
                      style={{
                        width: "45px",
                        height: "45px",
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: "2px solid #4b6cb7",
                      }}
                    >
                      <img
                        src={student?.profileImage || "/default-profile.png"}
                        alt={student?.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    {student?.name}
                  </td>
                  {Object.entries(marks).map(([k, a]) => (
                    <td key={k} style={{ padding: "12px" }}>
                      <input
                        type="number"
                        min="0"
                        max={a.max}
                        value={a.score}
                        onChange={(e) => updateScore(sid, k, e.target.value)}
                        style={{
                          width: "70px",
                          padding: "8px 12px",
                          borderRadius: "10px",
                          border: "1px solid #cbd5e1",
                          textAlign: "center",
                          boxShadow: "inset 0 3px 6px rgba(0,0,0,0.06)",
                          transition: "0.3s all",
                          fontWeight: "500",
                        }}
                      />
                    </td>
                  ))}
                  <td style={{ padding: "12px", fontWeight: "600" }}>{total}</td>
                  <td style={{ padding: "12px", fontWeight: "700", color: gradeColor }}>{grade}</td>
                  <td style={{ padding: "12px" }}>
                    <button
                      style={{
                        padding: "8px 14px",
                        borderRadius: "12px",
                        background: "#2563eb",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        transition: "0.3s all",
                      }}
                      onClick={() => saveMarks(sid)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#1e40af")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
                    >
                      <FaSave />
                    </button>
                  </td>
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
