import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, 
  FaSignOutAlt, FaBell, FaFacebookMessenger, FaSearch, FaCalendarAlt, FaCommentDots 
} from "react-icons/fa";
import axios from "axios";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { useMemo } from "react";


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
  const [attendanceView, setAttendanceView] = useState("daily"); 
  const [attendanceCourseFilter, setAttendanceCourseFilter] = useState("All");

  const [teachers, setTeachers] = useState([]);
const [unreadTeachers, setUnreadTeachers] = useState({});

const [showMessageDropdown, setShowMessageDropdown] = useState(false);
const [selectedTeacher, setSelectedTeacher] = useState(null);
const [teacherChatOpen, setTeacherChatOpen] = useState(false);

const adminUserId = admin.userId;


const handleSelectStudent = async (s) => {
  setLoading(true);

  try {
    // 1️⃣ Fetch student info
    const usersRes = await axios.get(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${s.userId}.json`
    );
    const user = usersRes.data || {};

    // 2️⃣ Fetch ClassMarks
    const marksRes = await axios.get(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/ClassMarks.json`
    );
    const classMarks = marksRes.data || {};

    // 3️⃣ Collect teacher IDs
    const teacherIds = new Set();
    Object.values(classMarks).forEach(course => {
      if (course[s.userId]?.teacherId) {
        teacherIds.add(course[s.userId].teacherId);
      }
    });

    // 4️⃣ Fetch teacher names
    const teacherMap = {};
    await Promise.all([...teacherIds].map(async (tid) => {
      const res = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${tid}.json`
      );
      teacherMap[tid] = res.data?.name || "Teacher";
    }));

    // 5️⃣ Build course → teacher map ✅
    const courseTeacherMap = {};
    Object.keys(classMarks).forEach(courseId => {
      const studentMark = classMarks[courseId][s.userId];
      if (studentMark?.teacherId) {
        courseTeacherMap[courseId] =
          teacherMap[studentMark.teacherId];
      }
    });

    // 6️⃣ Fetch Attendance (NOW teacher map exists ✅)
    const attendanceRes = await axios.get(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Attendance.json`
    );
    const attendanceRaw = attendanceRes.data || {};
    const attendanceData = [];

    Object.entries(attendanceRaw).forEach(([courseId, dates]) => {
      Object.entries(dates || {}).forEach(([date, students]) => {
        if (students[s.userId]) {
          attendanceData.push({
            date,
            courseId,
            status: students[s.userId],
            teacherName: courseTeacherMap[courseId] || "Teacher"
          });
        }
      });
    });








    // 7️⃣ Build marks
    const studentMarks = {};
    Object.keys(classMarks).forEach(courseId => {
      const m = classMarks[courseId][s.userId];
      if (m) {
        studentMarks[courseId] = {
          mark20: m.mark20 || 0,
          mark30: m.mark30 || 0,
          mark50: m.mark50 || 0,
          teacherName: teacherMap[m.teacherId]
        };
      }
    });

    // 8️⃣ Final set
    setSelectedStudent({
      ...s,
      ...user,
      attendance: attendanceData,
      marks: studentMarks
    });

  } catch (err) {
    console.error("Error fetching student data:", err);
  }

  setLoading(false);
};


// Grouped attendance based on the selected view
const groupedAttendance = useMemo(() => {
  if (!selectedStudent?.attendance?.length) return {};

  const grouped = {};

  selectedStudent.attendance.forEach(a => {
    const dateObj = new Date(a.date);
    if (isNaN(dateObj)) return;

    let key = "";

    if (attendanceView === "daily") {
      key = a.date;
    }

    if (attendanceView === "weekly") {
      key = format(
        startOfWeek(dateObj, { weekStartsOn: 1 }),
        "yyyy-MM-dd"
      );
    }

    if (attendanceView === "monthly") {
      key = format(dateObj, "yyyy-MM");
    }

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  });

  return grouped;
}, [selectedStudent, attendanceView]);



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





//-------------------------Fetch unread status for each student--------------

  useEffect(() => {
  const fetchUnread = async () => {
    const map = {};

    for (const s of students) {
      const key = `${s.userId}_${admin.userId}`;
      const res = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key}/messages.json`
      );

      const msgs = res.data || {};
      map[s.userId] = Object.values(msgs).some(
        m => m.senderId === s.userId && m.seenByAdmin === false
      );
    }

    setUnreadMap(map);
  };

  if (students.length > 0) fetchUnread();
}, [students]);

// ------------------ FETCH MESSAGES ------------------
useEffect(() => {
  if (studentChatOpen && selectedStudent) {
    const key = `${selectedStudent.studentId}_${admin.userId}`;

    const fetchMessages = async () => {
      const res = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key}/messages.json`
      );

      const data = res.data || {};
      const messages = Object.entries(data).map(([id, msg]) => ({ id, ...msg }));

      setPopupMessages(messages);

      // MARK STUDENT MESSAGES AS SEEN
      messages.forEach((msg) => {
        if (msg.senderId === selectedStudent.studentId && !msg.seenByAdmin) {
          axios.patch(
            `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key}/messages/${msg.id}.json`,
            { seenByAdmin: true }
          );
        }
      });
    };

    fetchMessages();
  }
}, [studentChatOpen, selectedStudent]);

// ------------------ SEND MESSAGE ------------------
const handleSendMessage = async () => {
  if (!popupInput.trim() || !selectedStudent) return;

  const key = `${selectedStudent.studentId}_${admin.userId}`;
  const newMessage = {
    senderId: admin.userId,
    receiverId: selectedStudent.studentId,
    content: popupInput,
    timeStamp: Date.now(),
    edited: false,
    seenByAdmin: true
  };

  try {
    const res = await axios.post(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key}/messages.json`,
      newMessage
    );

    // Firebase returns name/key of the new message
    setPopupMessages([...popupMessages, { id: res.data.name, ...newMessage }]);
    setPopupInput("");
  } catch (err) {
    console.error("Error sending message:", err);
  }
};
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

  return (
    <div className="dashboard-page">

      {/* ---------------- TOP NAVIGATION BAR ---------------- */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>
        <div className="nav-search">
          <FaSearch className="search-icon" />
          <input type="text" placeholder="Search Teacher and Student..." />
        </div>
        <div className="nav-right">
          <div className="icon-circle"><FaBell /></div>
          <div 
  className="icon-circle" 
  style={{ position: "relative", cursor: "pointer" }}
  onClick={() => setShowMessageDropdown(prev => !prev)}
>
  <FaFacebookMessenger />
  {Object.values(unreadTeachers).reduce((a,b)=>a+b,0) > 0 && (
    <span style={{
      position: "absolute",
      top: "-5px",
      right: "-5px",
      background: "red",
      color: "#fff",
      borderRadius: "50%",
      padding: "2px 6px",
      fontSize: "10px",
      fontWeight: "bold"
    }}>
      {Object.values(unreadTeachers).reduce((a,b)=>a+b,0)}
    </span>
  )}

  {showMessageDropdown && (
    <div style={{
      position: "absolute",
      top: "35px",
      right: "0",
      width: "300px",
      maxHeight: "400px",
      overflowY: "auto",
      background: "#fff",
      border: "1px solid #ddd",
      borderRadius: "8px",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
      zIndex: 1000
    }}>
      {teachers.map(t => {
        const msgs = popupMessages
          .filter(m => m.senderId === t.userId || m.receiverId === t.userId)
          .sort((a,b) => a.timeStamp - b.timeStamp);
        const latestMsg = msgs[msgs.length - 1];

        return (
          <div
            key={t.userId}
            onClick={() => {
              setSelectedTeacher(t);
              setTeacherChatOpen(true);
              setShowMessageDropdown(false);
            }}
            style={{
              padding: "10px",
              borderBottom: "1px solid #eee",
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              background: unreadTeachers[t.userId] > 0 ? "#f0f4ff" : "#fff"
            }}
          >
            <img src={t.profileImage} alt={t.name} style={{ width: "40px", height: "40px", borderRadius: "50%", marginRight: "10px" }} />
            <div style={{ flex: 1 }}>
              <strong>{t.name}</strong>
              <p style={{ margin:0, fontSize:"12px", color:"#555" }}>{latestMsg?.text || "No messages yet"}</p>
            </div>
            {unreadTeachers[t.userId] > 0 && (
              <span style={{
                background: "red",
                color: "#fff",
                borderRadius: "50%",
                padding: "2px 6px",
                fontSize: "10px",
                marginLeft: "5px"
              }}>
                {unreadTeachers[t.userId]}
              </span>
            )}
          </div>
        )
      })}
      {teachers.every(t => !unreadTeachers[t.userId]) && (
        <p style={{ textAlign: "center", padding: "10px", color:"#777" }}>No new messages</p>
      )}
    </div>
  )}
</div>

          <div className="icon-circle"><FaCog /></div>
          <img src={admin.profileImage || "/default-profile.png"} alt="admin" className="profile-img" />
        </div>
      </nav>

      {/* ---------------- DASHBOARD LAYOUT ---------------- */}
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
                     <Link className="sidebar-btn" to="/dashboard"
                      
                      > <FaHome style={{ width: "28px", height:"28px" }}/> Home</Link>
                       <Link className="sidebar-btn" to="/my-posts"><FaFileAlt /> My Posts</Link>
                       <Link className="sidebar-btn" to="/teachers"><FaChalkboardTeacher /> Teachers</Link>
                         <Link className="sidebar-btn" to="/students" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}> <FaChalkboardTeacher /> Students</Link>
                          <Link
                                       className="sidebar-btn"
                                       to="/schedule"
                                       
                                     >
                                       <FaCalendarAlt /> Schedule
                                     </Link>
                          <Link className="sidebar-btn" to="/parents" ><FaChalkboardTeacher /> Parents
                                     </Link>
                                               
                        <Link className="sidebar-btn" to="/settings" >
                                     <FaCog /> Settings
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

        {/* ---------------- MAIN CONTENT ---------------- */}
        <div className="main-content" style={{ padding: "30px", width: "65%", marginLeft: "180px" }}>
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
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px", gap: "12px" }}>
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
    key={s.studentId}
    onClick={() => handleSelectStudent(s)}
    style={{
      width: "500px",
      height: "70px",
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

        {/* ---------------- RIGHT SIDEBAR FOR SELECTED STUDENT ---------------- */}
       {/* ---------------- RIGHT SIDEBAR FOR SELECTED STUDENT ---------------- */}
{selectedStudent && (
  <div style={{
    width: "30%",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    right: 0,
    top: 0,
    background: "#fff",
    boxShadow: "0 0 15px rgba(0,0,0,0.05)",
    zIndex: 10
  }}>
    {/* Scrollable content */}
    <div style={{ overflowY: "auto", padding: "25px", flex: 1 }}>
      {/* Student Info */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{
          background: "#becff7ff",
          padding: "25px 10px",
          height: "200px",
          margin: "50px 1px 20px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.1)"
        }}>
          <div style={{
            width: "100px",
            height: "100px",
            margin: "-20px auto 15px",
            borderRadius: "50%",
            overflow: "hidden",
            border: "4px solid #4b6cb7",
            boxShadow: "0 4px 15px rgba(0,0,0,0.1)"
          }}>
            <img src={selectedStudent.profileImage} alt={selectedStudent.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <h2 style={{ margin: 0, fontSize: "22px", marginTop: "-10px", color: "#333" }}>{selectedStudent.name}</h2>
          <h2 style={{ margin: 0, fontSize: "16px", color: "#585656ff" }}>{selectedStudent.email || "default.student@example.com"}</h2>
        </div>
        <p><strong>Grade:</strong> {selectedStudent.grade}</p>
        <p><strong>Section:</strong> {selectedStudent.section}</p>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", marginBottom: "10px", borderBottom: "1px solid #eee" }}>
          {["details", "attendance", "performance"].map(tab => (
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
                borderBottom: studentTab === tab ? "3px solid #4b6cb7" : "3px solid transparent",
              }}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#888" }}>Loading...</p>
        ) : (
          <>
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




            

{/* ATTENDANCE TAB */}
{studentTab === "attendance" && selectedStudent && (
  <div style={{ padding: "26px", maxHeight: "70vh", overflowY: "auto", background: "#f1f5f9" }}>

    {/* ================= STICKY CONTROLS ================= */}
    <div style={{
      position: "sticky",
      top: 0,
      background: "#f8fafc",
      paddingBottom: "16px",
      zIndex: 10,
      boxShadow: "0 5px 15px rgba(0,0,0,0.05)",
      borderBottomLeftRadius: "16px",
      borderBottomRightRadius: "16px"
    }}>
      {/* View Switch */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "14px" }}>
        {["daily", "weekly", "monthly"].map(v => (
          <button
            key={v}
            onClick={() => setAttendanceView(v)}
            style={{
              padding: "10px 18px",
              borderRadius: "12px",
              border: "none",
              fontWeight: "800",
              cursor: "pointer",
              background: attendanceView === v 
                ? "linear-gradient(90deg,#2563eb,#22c55e)" 
                : "#e5e7eb",
              color: attendanceView === v ? "#fff" : "#111",
              boxShadow: attendanceView === v 
                ? "0 4px 15px rgba(34,197,94,0.4)" 
                : "none",
              transition: "0.3s",
              letterSpacing: "0.5px"
            }}
          >
            {v.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Course Filter */}
      <select
        value={attendanceCourseFilter}
        onChange={e => setAttendanceCourseFilter(e.target.value)}
        style={{
          padding: "10px",
          borderRadius: "12px",
          border: "1px solid #cbd5f5",
          fontWeight: "600",
          background: "#fff",
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
          transition: "0.3s"
        }}
      >
        <option value="All">All Subjects</option>
        {[...new Set(selectedStudent.attendance.map(a => a.courseId))].map(c => (
          <option key={c} value={c}>
            {c.replace("course_", "").replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>

    {/* ================= SUMMARY ================= */}
    {(() => {
      const data = selectedStudent.attendance;
      const total = data.length;
      const present = data.filter(a => a.status === "present").length;
      const percent = Math.round((present / total) * 100);

      const health =
        percent >= 90 ? { label: "Excellent", color: "#16a34a" } :
        percent >= 75 ? { label: "Good", color: "#2563eb" } :
        { label: "At Risk", color: "#dc2626" };

      return (
        <div style={{
          background: "linear-gradient(135deg,#ffffff,#f0f9ff)",
          borderRadius: "22px",
          padding: "22px",
          margin: "22px 0",
          boxShadow: "0 18px 45px rgba(0,0,0,0.08)",
          transition: "0.3s",
          border: `1px solid ${health.color}`
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "14px", color: "#64748b", letterSpacing: "0.5px" }}>
                Attendance Health
              </div>
              <div style={{ fontSize: "28px", fontWeight: "900", color: health.color, letterSpacing: "0.5px" }}>
                {health.label}
              </div>
            </div>
            <div style={{
              fontSize: "32px",
              fontWeight: "900",
              color: `rgba(${health.color === "#16a34a" ? "22,163,52" : health.color === "#2563eb" ? "37,99,235" : "220,38,38"},0.9)`,
              background: "rgba(0,0,0,0.03)",
              borderRadius: "12px",
              padding: "8px 16px",
              boxShadow: `0 0 12px ${health.color}40`
            }}>
              {percent}%
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{
            height: "12px",
            background: "#e5e7eb",
            borderRadius: "999px",
            marginTop: "16px",
            overflow: "hidden",
            boxShadow: "inset 0 2px 5px rgba(0,0,0,0.05)"
          }}>
            <div style={{
              width: `${percent}%`,
              height: "100%",
              background: health.color,
              transition: "width 0.6s",
              borderRadius: "999px"
            }} />
          </div>
        </div>
      );
    })()}

    {/* ================= RECORDS ================= */}
    {Object.entries(groupedAttendance).map(([group, records]) => {
      const filtered = attendanceCourseFilter === "All"
        ? records
        : records.filter(r => r.courseId === attendanceCourseFilter);

      if (!filtered.length) return null;

      return (
        <div key={group} style={{
          background: "#fff",
          borderRadius: "22px",
          padding: "22px",
          marginBottom: "22px",
          boxShadow: "0 15px 40px rgba(0,0,0,0.08)",
          transition: "0.3s",
          borderLeft: "6px solid #2563eb"
        }}>
          <h3 style={{ color: "#2563eb", marginBottom: "14px", letterSpacing: "0.5px" }}>
            📅 {group}
          </h3>

          {filtered.map((r, i) => (
            <div key={i} style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              padding: "14px 0",
              borderBottom: i !== filtered.length - 1 ? "1px solid #e5e7eb" : "none",
              transition: "0.3s"
            }}>
              <div>
                <div style={{ fontWeight: "800", fontSize: "15px" }}>
                  {r.courseId.replace("course_", "").replace(/_/g, " ")}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  👨‍🏫 {r.teacherName}
                </div>
              </div>

              <span style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 16px",
                borderRadius: "999px",
                fontWeight: "900",
                background: r.status === "present" 
                  ? "linear-gradient(90deg,#dcfce7,#bbf7d0)" 
                  : "linear-gradient(90deg,#fee2e2,#fecaca)",
                color: r.status === "present" ? "#166534" : "#991b1b",
                boxShadow: r.status === "present" 
                  ? "0 0 12px #22c55e30" 
                  : "0 0 12px #dc262630",
                transition: "0.3s"
              }}>
                {r.status === "present" ? "✔" : "✖"} {r.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      );
    })}
  </div>
)}









            {/* PERFORMANCE TAB */}
            {studentTab === "performance" && (
              <div>
                {selectedStudent.marks && Object.keys(selectedStudent.marks).length === 0 ? (
                  <p style={{ textAlign: "center", color: "#555" }}>🚫 No Performance Records</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    {Object.entries(selectedStudent.marks).map(([courseId, m], idx) => {
                      const total = (m.mark20 || 0) + (m.mark30 || 0) + (m.mark50 || 0);
                      const percentage = Math.min(total, 100);
                      const statusColor = percentage >= 75 ? "#16a34a" : percentage >= 50 ? "#f59e0b" : "#dc2626";

                      return (
                        <div key={idx} style={{ padding: "18px", borderRadius: "20px", background: "#fff", boxShadow: "0 12px 30px rgba(0,0,0,0.08)" }}>
                          <div style={{ fontSize: "16px", fontWeight: "800", marginBottom: "14px", color: "#2563eb" }}>
                            {courseId.replace("course_", "").replace(/_/g, " ")}
                          </div>

                          {/* Circle Score */}
                          <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                            <div style={{
                              width: "90px",
                              height: "90px",
                              borderRadius: "50%",
                              background: `conic-gradient(${statusColor} ${percentage * 3.6}deg, #e5e7eb 0deg)`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}>
                              <div style={{
                                width: "66px",
                                height: "66px",
                                borderRadius: "50%",
                                background: "#fff",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                              }}>
                                <div style={{ fontSize: "18px", fontWeight: "800", color: statusColor }}>{total}</div>
                                <div style={{ fontSize: "11px", color: "#64748b" }}>/100</div>
                              </div>
                            </div>
                          </div>

                          {/* Individual Marks */}
                          {[{ key: "mark20", label: "Quiz", max: 20, color: "#2563eb" },
                            { key: "mark30", label: "Test", max: 30, color: "#16a34a" },
                            { key: "mark50", label: "Final", max: 50, color: "#ea580c" }].map(({ key, label, max, color }) => (
                            <div key={key} style={{ marginBottom: "10px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "600", color: "#334155" }}>
                                <span>{label}</span>
                                <span>{m[key] || 0} / {max}</span>
                              </div>
                              <div style={{ height: "6px", borderRadius: "999px", background: "#e5e7eb", marginTop: "5px", overflow: "hidden" }}>
                                <div style={{ width: `${((m[key] || 0) / max) * 100}%`, height: "100%", background: color }} />
                              </div>
                            </div>
                          ))}

                          <div style={{ marginTop: "12px", textAlign: "center", fontSize: "13px", fontWeight: "700", color: statusColor }}>
                            {percentage >= 75 ? "Excellent" : percentage >= 50 ? "Good" : "Needs Improvement"}
                          </div>

                        <div style={{ marginTop: "6px", textAlign: "center", fontSize: "12px", color: "#64748b" }}>
  👨‍🏫 {m.teacherName}
</div>


                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>

    {/* ---------------- MESSAGE BUTTON (rigid) ---------------- */}
   {/* ================= FIXED MESSAGE BUTTON ================= */}
   <div
     onClick={() => setStudentChatOpen(true)}
     style={{
       position: "fixed",        // 🔒 RIGID
       bottom: "20px",
       right: "20px",
       width: "48px",
       height: "48px",
       background:
         "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
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
       e.currentTarget.style.boxShadow =
         "0 12px 26px rgba(0,0,0,0.35)";
     }}
     onMouseLeave={(e) => {
       e.currentTarget.style.transform = "scale(1)";
       e.currentTarget.style.boxShadow =
         "0 8px 18px rgba(0,0,0,0.25)";
     }}
   >
     <FaCommentDots size={22} />
   </div>
   
  </div>
)}

      // ---------------- STUDENT CHAT POPUP ----------------
{studentChatOpen && selectedStudent && (
  <div style={{
    position: "fixed",
    bottom: "6px",
    right: "22px",
    width: "320px",
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
    padding: "15px",
    zIndex: 999,
    animation: "fadeIn 0.3s ease"
  }}>
    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ddd", paddingBottom: "10px" }}>
      <strong>{selectedStudent.name}</strong>
      <div style={{ display: "flex", gap: "10px" }}>
        {/* Expand Button */}
        <button
          onClick={() => {
            setStudentChatOpen(false);
            navigate("/all-chat", { 
              state: { 
                user: { userId: selectedStudent.studentId, name: selectedStudent.name }, 
                userType: "student" 
              } 
            });
          }}
          style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}
        >
          <img width="30" height="30" src="https://img.icons8.com/ios-glyphs/30/expand--v1.png" alt="expand" />
        </button>

        <button onClick={() => setStudentChatOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>×</button>
      </div>
    </div>

    {/* Chat Body */}
    <div style={{ height: "260px", overflowY: "auto", padding: "10px" }}>
      {popupMessages.length === 0 ? (
        <p style={{ color: "#aaa", textAlign: "center" }}>No messages yet</p>
      ) : (
        popupMessages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: "10px", textAlign: msg.senderId === admin.userId ? "right" : "left" }}>
            <span style={{
              background: msg.senderId === admin.userId ? "#4b6cb7" : "#eee",
              color: msg.senderId === admin.userId ? "#fff" : "#000",
              padding: "6px 12px",
              borderRadius: "12px",
              display: "inline-block",
              maxWidth: "80%"
            }}>
              {msg.content}
              {msg.edited && <span style={{ fontSize: "10px", opacity: 0.7 }}> (edited)</span>}
            </span>
          </div>
        ))
      )}
    </div>

    {/* Input */}
    <div style={{ display: "flex", marginTop: "8px", gap: "5px" }}>
      <input
        type="text"
        value={popupInput}
        onChange={e => setPopupInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleSendMessage()}
        placeholder="Type a message..."
        style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #ddd" }}
      />
      <button onClick={handleSendMessage} style={{ background: "none", border: "none", color: "#3654dada", cursor: "pointer", fontSize: "30px" }}>➤</button>
    </div>
  </div>
)}

      </div>
    </div>
  );
}

export default StudentsPage;
