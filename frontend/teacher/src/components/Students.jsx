import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaSearch, FaBell, FaUsers, FaClipboardCheck, FaStar, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import "../styles/global.css";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [sections, setSections] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentTab, setStudentTab] = useState("details");
  const [studentChatOpen, setStudentChatOpen] = useState(false);
  const [popupMessages, setPopupMessages] = useState([]);
  const [popupInput, setPopupInput] = useState("");
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const navigate = useNavigate();
  const [attendanceFilter, setAttendanceFilter] = useState("daily");
  const [assignmentsData, setAssignmentsData] = useState({});
  const [teachersData, setTeachersData] = useState({});
  const [usersData, setUsersData] = useState({});
  const [studentMarks, setStudentMarks] = useState({});
  const [teacherNotes, setTeacherNotes] = useState([]);
  const [newTeacherNote, setNewTeacherNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const teacherUserId = teacherInfo?.userId; // ✅ teacher ID from logged-in teacher

  // ---------------- LOAD TEACHER INFO ----------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacherInfo(storedTeacher);
  }, [navigate]);

  // ---------------- FETCH STUDENTS ----------------
 useEffect(() => {
    async function fetchStudents() {
      try {
        setLoading(true);
        const [
          studentsData,
          usersData,
          coursesData,
          teacherAssignmentsData,
          teachersData,
        ] = await Promise.all([
          axios.get(
            "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json"
          ),
          axios.get(
            "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"
          ),
          axios.get(
            "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Courses.json"
          ),
          axios.get(
            "https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json"
          ),
          axios.get(
            "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"
          ),
        ]);

        const teacherEntry = Object.entries(
          teachersData.data || teachersData
        ).find(([_, value]) => value.userId === teacherUserId);

        if (!teacherEntry) throw new Error("Teacher key not found");

        const teacherKey = teacherEntry[0];

        const assignedCourses = Object.values(
          teacherAssignmentsData.data || teacherAssignmentsData
        )
          .filter((a) => a.teacherId === teacherKey)
          .map((a) => a.courseId);

        const filteredStudents = Object.values(
          studentsData.data || studentsData
        )
          .filter((s) =>
            assignedCourses.some((courseId) => {
              const course = (coursesData.data || coursesData)[courseId];
              return (
                course &&
                course.grade === s.grade &&
                course.section === s.section
              );
            })
          )
          .map((s) => {
            const user = Object.values(usersData.data || usersData).find(
              (u) => u.userId === s.userId
            );
            return {
              ...s,
              name: user?.name || "Unknown",
              username: user?.username || "Unknown",
              profileImage: user?.profileImage || "/default-profile.png",
            };
          });

        setStudents(filteredStudents);
        setError("");
      } catch (err) {
        console.error("Error fetching students:", err);
        setError("Failed to fetch students. Please try again.");
        setStudents([]);
      } finally {
        setLoading(false);
      }
    }

    fetchStudents();
  }, [teacherUserId]);

  useEffect(() => {
    if (selectedGrade === "All") {
      setSections([]);
      setSelectedSection("All");
    } else {
      const gradeSections = [
        ...new Set(
          students
            .filter((s) => s.grade === selectedGrade)
            .map((s) => s.section)
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



  // ---------------- FETCH attendance ----------------
// ---------------- FETCH attendance ----------------
useEffect(() => {
  if (!selectedStudent) return;

  async function fetchAttendance() {
    try {
      setAttendanceLoading(true);

      const [
        attendanceRes,
        assignmentsRes,
        teachersRes,
        usersRes,
        coursesRes,
      ] = await Promise.all([
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Attendance.json"),
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json"),
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"),
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"),
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Courses.json"),
      ]);

      const attendanceDB = attendanceRes.data || {};
      const assignments = assignmentsRes.data || {};
      const teachers = teachersRes.data || {};
      const users = usersRes.data || {};
      const courses = coursesRes.data || {};

      // helper → resolve teacher name by course
      const getTeacherNameByCourse = (courseId) => {
        const assignment = Object.values(assignments).find(
          (a) => a.courseId === courseId
        );
        if (!assignment) return "Unknown Teacher";

        const teacher = teachers[assignment.teacherId];
        if (!teacher) return "Unknown Teacher";

        const user = users[teacher.userId];
        return user?.name || "Unknown Teacher";
      };

      const attendance = [];

      Object.entries(attendanceDB).forEach(([courseId, dates]) => {
        Object.entries(dates).forEach(([date, students]) => {
          const status = students[selectedStudent.userId];
          if (!status) return;

          attendance.push({
            subject:
              courses[courseId]?.subject ||
              courseId.replace("course_", "").replace(/_/g, " "),
            date,
            studentName: selectedStudent.name,
            status, // ✅ present / absent
            teacherName: getTeacherNameByCourse(courseId), // ✅ FIXED
          });
        });
      });

      setAttendanceData(attendance);
    } catch (err) {
      console.error("Attendance error:", err);
      setAttendanceData([]);
    } finally {
      setAttendanceLoading(false);
    }
  }

  fetchAttendance();
}, [selectedStudent]);



// Filter attendance based on selected tab
const filteredAttendance = attendanceData.filter((a) => {
  const today = new Date();
  const attDate = new Date(a.date);

  if (attendanceFilter === "daily") {
    return (
      attDate.getFullYear() === today.getFullYear() &&
      attDate.getMonth() === today.getMonth() &&
      attDate.getDate() === today.getDate()
    );
  } else if (attendanceFilter === "weekly") {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Sunday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Saturday
    return attDate >= weekStart && attDate <= weekEnd;
  } else if (attendanceFilter === "monthly") {
    return attDate.getFullYear() === today.getFullYear() && attDate.getMonth() === today.getMonth();
  }
  return true;
});

  
  // ---------------- FETCH performance ----------------
// ---------------- FETCH STUDENT MARKS ----------------
// ---------------- FETCH STUDENT MARKS ----------------
useEffect(() => {
  if (!selectedStudent) return;

  async function fetchMarks() {
    try {
      const [resMarks, resAssignments, resTeachers, resUsers] = await Promise.all([
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/ClassMarks.json"),
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json"),
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"),
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"),
      ]);

      const marksData = resMarks.data || {};
      const assignments = resAssignments.data || {};
      const teachers = resTeachers.data || {};
      const users = resUsers.data || {};

      const marks = {};

      Object.entries(marksData).forEach(([courseId, studentMarks]) => {
        Object.entries(studentMarks).forEach(([studentKey, mark]) => {
          if (studentKey !== selectedStudent.userId) return;

          // Find teacher for this course
          const assignment = Object.values(assignments).find(a => a.courseId === courseId);
          let teacherName = "Unknown";
          if (assignment) {
            const teacher = teachers[assignment.teacherId];
            if (teacher) {
              const teacherUser = users[teacher.userId];
              teacherName = teacherUser?.name || "Unknown";
            }
          }

          marks[courseId] = {
            mark20: mark.mark20 || 0,
            mark30: mark.mark30 || 0,
            mark50: mark.mark50 || 0,
            teacherName,
          };
        });
      });

      setStudentMarks(marks);
    } catch (err) {
      console.error("Error fetching marks:", err);
      setStudentMarks({});
    }
  }

  fetchMarks();
}, [selectedStudent]);

 // ---------------- teacher note ----------------
useEffect(() => {
  if (!selectedStudent?.userId) return;

  async function fetchTeacherNotes() {
    try {
      const res = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentNotes/${selectedStudent.userId}.json`
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

 // ---------------- teacher note visible----------------

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
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentNotes/${selectedStudent.userId}.json`,
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




  // ---------------- FETCH MESSAGES ----------------
  useEffect(() => {
    if (!selectedStudent || !teacherUserId) return;

    async function fetchMessages() {
      try {
        const key = `${teacherUserId}_${selectedStudent.userId}`;
        const res = await axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key}/messages.json`);
        const msgs = Object.values(res.data || {})
          .map(m => ({ ...m, sender: m.senderId === teacherUserId ? "teacher" : "student" }))
          .sort((a, b) => a.timeStamp - b.timeStamp);
        setPopupMessages(msgs);
      } catch (err) {
        console.error(err);
        setPopupMessages([]);
      }
    }

    fetchMessages();
  }, [selectedStudent, teacherUserId]);

  // ---------------- SEND MESSAGE ----------------
  const handleSendMessage = async () => {
    if (!popupInput.trim() || !teacherUserId) return;

    const newMessage = {
      senderId: teacherUserId,
      receiverId: selectedStudent.userId,
      text: popupInput,
      timeStamp: Date.now(),
      seen: "false",
    };

    try {
      const key = `${teacherUserId}_${selectedStudent.userId}`;
      await axios.post(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key}/messages.json`, newMessage);
      setPopupMessages([...popupMessages, { ...newMessage, sender: "teacher" }]);
      setPopupInput("");
    } catch (err) {
      console.error(err);
    }
  };


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
      {/* TOP NAVBAR */}
      <nav className="top-navbar">
        <h2>Teacher Dashboard</h2>
        <div className="nav-right" style={{ display: "flex", gap: "15px" }}>
          <FaSearch />
          <FaBell />
          <FaCog />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex" }}>
        {/* SIDEBAR */}
        <div className="google-sidebar">
          {teacherInfo && (
            <div style={{ textAlign: "center", padding: "20px", borderBottom: "1px solid #ddd" }}>
              <div style={{ width: "80px", height: "80px", margin: "0 auto 10px", borderRadius: "50%", overflow: "hidden", border: "3px solid #4b6cb7" }}>
                <img src={teacherInfo.profileImage || "/default-profile.png"} alt={teacherInfo.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <h3 style={{ margin: "5px 0", fontSize: "18px" }}>{teacherInfo.name}</h3>
              <p style={{ fontSize: "14px", color: "#555" }}>{teacherInfo.username || teacherInfo.email}</p>
            </div>
          )}

          <div className="sidebar-menu">
             <Link className="sidebar-btn" to="/dashboard" ><FaHome /> Home</Link>
            <Link className="sidebar-btn" to="/notes" ><FaClipboardCheck /> Notes</Link>
            
            <Link className="sidebar-btn" to="/students" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaUsers /> Students</Link>
              <Link className="sidebar-btn" to="/admins" ><FaUsers /> Admins</Link>
            <Link
                     className="sidebar-btn"
                     to="/marks"
                     
                   ><FaClipboardCheck />
                     Marks
                   </Link>
                   <Link to="/attendance" className="sidebar-btn">
                                                        <FaUsers /> Attendance
                                                      </Link>
            <Link className="sidebar-btn" to="/settings"><FaCog /> Settings</Link>
            <Link className="sidebar-btn" to="/logout"><FaSignOutAlt /> Logout</Link>
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
              {filteredStudents.map(s => (
                <StudentItem key={s.userId} student={s} selected={selectedStudent?.userId === s.userId} onClick={setSelectedStudent} />
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
    <InfoRow label="Student ID" value={selectedStudent.userId} />

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

    {/* Fixed Message Button */}
    <div
  style={{
    position: "fixed",
    bottom: "20px",
    right: "35px",
    width: "calc(30% - 70px)",
    zIndex: 1000,
  }}
>
  <button
    onClick={() => setStudentChatOpen(true)}
    style={{
      marginLeft: "360px",
      width: "30%",
      padding: "16px 0",
      borderRadius: "50px",
      background: "#4978e8ff",
      backgroundSize: "600% 600%",
      color: "#fff",
      fontSize: "16px",
      fontWeight: "800",
      border: "none",
      cursor: "pointer",
      boxShadow:
        "0 0 10px #4b6cb7, 0 0 20px #4b6cb7, 0 0 30px #3b6ccfff inset",
      position: "relative",
      overflow: "hidden",
      transition: "all 0.3s ease",
      animation: "gradientShift 5s ease infinite",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "scale(1.08) translateY(-2px)";
      e.currentTarget.style.boxShadow =
        "0 0 15px #4b6cb7, 0 0 30px #4b6cb7, 0 0 40px #3760b3ff inset";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "scale(1) translateY(0)";
      e.currentTarget.style.boxShadow =
        "0 0 10px #4b6cb7, 0 0 20px #4b6cb7, 0 0 30px #3b6fd6ff inset";
    }}
  >
    <span
      style={{
        display: "inline-block",
        position: "relative",
        animation: "iconBounce 1.5s infinite",
      }}
    >
      💬 Parent
    </span>

    {/* Gradient Animation Keyframes */}
    <style>
      {`
        @keyframes gradientShift {
          0% {background-position: 0% 50%;}
          50% {background-position: 100% 50%;}
          100% {background-position: 0% 50%;}
        }
        @keyframes iconBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}
    </style>
  </button>
</div>




<div
  style={{
    position: "fixed",
    bottom: "20px",
    right: "35px",
    width: "calc(30% - 70px)",
    zIndex: 1000,
  }}
>
  <button
    onClick={() => setStudentChatOpen(true)}
    style={{
      marginLeft: 0,
      width: "30%",
      padding: "16px 0",
      borderRadius: "50px",
      background: "#4978e8ff",
      backgroundSize: "600% 600%",
      color: "#fff",
      fontSize: "16px",
      fontWeight: "800",
      border: "none",
      cursor: "pointer",
      boxShadow:
        "0 0 10px #4b6cb7, 0 0 20px #4b6cb7, 0 0 30px #3b6ccfff inset",
      position: "relative",
      overflow: "hidden",
      transition: "all 0.3s ease",
      animation: "gradientShift 5s ease infinite",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "scale(1.08) translateY(-2px)";
      e.currentTarget.style.boxShadow =
        "0 0 15px #4b6cb7, 0 0 30px #4b6cb7, 0 0 40px #3760b3ff inset";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "scale(1) translateY(0)";
      e.currentTarget.style.boxShadow =
        "0 0 10px #4b6cb7, 0 0 20px #4b6cb7, 0 0 30px #3b6fd6ff inset";
    }}
  >
    <span
      style={{
        display: "inline-block",
        position: "relative",
        animation: "iconBounce 1.5s infinite",
      }}
    >
      💬 Message
    </span>

    {/* Gradient Animation Keyframes */}
    <style>
      {`
        @keyframes gradientShift {
          0% {background-position: 0% 50%;}
          50% {background-position: 100% 50%;}
          100% {background-position: 0% 50%;}
        }
        @keyframes iconBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}
    </style>
  </button>
</div>








  </div>
)}


     {/* ATTENDANCE TAB */}
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
                  backgroundColor: a.status.toLowerCase() === "present" ? "#16a34a" : "#dc2626",
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
                  width: a.status.toLowerCase() === "present" ? "100%" : "0%",
                  height: "100%",
                  background: a.status.toLowerCase() === "present" ? "#16a34a" : "#dc2626",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        ))}

     {/* Fixed Message Button */}
    <div
  style={{
    position: "fixed",
    bottom: "20px",
    right: "35px",
    width: "calc(30% - 70px)",
    zIndex: 1000,
  }}
>
  <button
    onClick={() => setStudentChatOpen(true)}
    style={{
      marginLeft: "360px",
      width: "30%",
      padding: "16px 0",
      borderRadius: "50px",
      background: "#4978e8ff",
      backgroundSize: "600% 600%",
      color: "#fff",
      fontSize: "16px",
      fontWeight: "800",
      border: "none",
      cursor: "pointer",
      boxShadow:
        "0 0 10px #4b6cb7, 0 0 20px #4b6cb7, 0 0 30px #3b6ccfff inset",
      position: "relative",
      overflow: "hidden",
      transition: "all 0.3s ease",
      animation: "gradientShift 5s ease infinite",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "scale(1.08) translateY(-2px)";
      e.currentTarget.style.boxShadow =
        "0 0 15px #4b6cb7, 0 0 30px #4b6cb7, 0 0 40px #3760b3ff inset";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "scale(1) translateY(0)";
      e.currentTarget.style.boxShadow =
        "0 0 10px #4b6cb7, 0 0 20px #4b6cb7, 0 0 30px #3b6fd6ff inset";
    }}
  >
    <span
      style={{
        display: "inline-block",
        position: "relative",
        animation: "iconBounce 1.5s infinite",
      }}
    >
      💬 Message
    </span>

    {/* Gradient Animation Keyframes */}
    <style>
      {`
        @keyframes gradientShift {
          0% {background-position: 0% 50%;}
          50% {background-position: 100% 50%;}
          100% {background-position: 0% 50%;}
        }
        @keyframes iconBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}
    </style>
  </button>
</div>
  </div>
)}



      {/* PERFORMANCE TAB */}
      {studentTab === "performance" && (
        <div
          style={{
            position: "relative",
            paddingBottom: "70px",
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "20px",
              padding: "20px",
            }}
          >
            {Object.keys(studentMarks).length === 0 ? (
              <>
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
                  }}
                >
                  🚫 No Performance Records
                </div>

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
                  }}
                >
                  🚫 No Performance Records
                </div>
              </>
            ) : (
              Object.entries(studentMarks).map(([courseId, marks], idx) => {
                const total =
                  (marks.mark20 || 0) + (marks.mark30 || 0) + (marks.mark50 || 0);
                const percentage = Math.min(total, 100);
                const statusColor =
                  percentage >= 75
                    ? "#16a34a"
                    : percentage >= 50
                    ? "#f59e0b"
                    : "#dc2626";

                return (
                  <div
                    key={idx}
                    style={{
                      padding: "18px",
                      borderRadius: "20px",
                      background: "#ffffff",
                      boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
                      color: "#0f172a",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-6px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    {/* Course Name */}
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: "800",
                        marginBottom: "14px",
                        textTransform: "capitalize",
                        color: "#2563eb",
                      }}
                    >
                      {courseId.replace("course_", "").replace(/_/g, " ")}
                    </div>

                    {/* Score Circle */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        marginBottom: "16px",
                      }}
                    >
                      <div
                        style={{
                          width: "90px",
                          height: "90px",
                          borderRadius: "50%",
                          background: `conic-gradient(
                          ${statusColor} ${percentage * 3.6}deg,
                          #e5e7eb 0deg
                        )`,
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
                          <div
                            style={{
                              fontSize: "18px",
                              fontWeight: "800",
                              color: statusColor,
                            }}
                          >
                            {total}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            / 100
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Marks Bars */}
                    {[
                      { key: "mark20", label: "Quiz", max: 20, color: "#2563eb" },
                      { key: "mark30", label: "Test", max: 30, color: "#16a34a" },
                      { key: "mark50", label: "Final", max: 50, color: "#ea580c" },
                    ].map(({ key, label, max, color }) => (
                      <div key={key} style={{ marginBottom: "10px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "13px",
                            fontWeight: "600",
                            color: "#334155",
                          }}
                        >
                          <span>{label}</span>
                          <span>
                            {marks[key]} / {max}
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
                              width: `${(marks[key] / max) * 100}%`,
                              height: "100%",
                              background: color,
                            }}
                          />
                        </div>
                      </div>
                    ))}

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
                      👨‍🏫 {marks.teacherName}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Fixed Message Button */}
    <div
  style={{
    position: "fixed",
    bottom: "20px",
    right: "35px",
    width: "calc(30% - 70px)",
    zIndex: 1000,
  }}
>
  <button
    onClick={() => setStudentChatOpen(true)}
    style={{
      marginLeft: "360px",
      width: "30%",
      padding: "16px 0",
      borderRadius: "50px",
      background: "#4978e8ff",
      backgroundSize: "600% 600%",
      color: "#fff",
      fontSize: "16px",
      fontWeight: "800",
      border: "none",
      cursor: "pointer",
      boxShadow:
        "0 0 10px #4b6cb7, 0 0 20px #4b6cb7, 0 0 30px #3b6ccfff inset",
      position: "relative",
      overflow: "hidden",
      transition: "all 0.3s ease",
      animation: "gradientShift 5s ease infinite",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "scale(1.08) translateY(-2px)";
      e.currentTarget.style.boxShadow =
        "0 0 15px #4b6cb7, 0 0 30px #4b6cb7, 0 0 40px #3760b3ff inset";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "scale(1) translateY(0)";
      e.currentTarget.style.boxShadow =
        "0 0 10px #4b6cb7, 0 0 20px #4b6cb7, 0 0 30px #3b6fd6ff inset";
    }}
  >
    <span
      style={{
        display: "inline-block",
        position: "relative",
        animation: "iconBounce 1.5s infinite",
      }}
    >
      💬 Message
    </span>

    {/* Gradient Animation Keyframes */}
    <style>
      {`
        @keyframes gradientShift {
          0% {background-position: 0% 50%;}
          50% {background-position: 100% 50%;}
          100% {background-position: 0% 50%;}
        }
        @keyframes iconBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}
    </style>
  </button>
</div>


        </div>
      )}
    </div>
  </div>
)}


          {/* CHAT POPUP */}
          {studentChatOpen && selectedStudent && (
            <div style={{ position: "fixed", bottom: "6px", width: "320px", background: "#fff", borderRadius: "12px", boxShadow: "0 8px 25px rgba(0,0,0,0.15)", padding: "15px", zIndex: 999, right: "22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ddd", paddingBottom: "10px" }}>
                <strong>{selectedStudent.name}</strong>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => navigate("/teacher-chat", { state: { studentId: selectedStudent.userId, userType: "student" } })} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}>↗</button>
                  <button onClick={() => setStudentChatOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>×</button>
                </div>
              </div>
              <div style={{ height: "260px", overflowY: "auto", padding: "10px" }}>
                {popupMessages.length === 0 ? <p style={{ color: "#aaa", textAlign: "center" }}>No messages yet</p> :
                  popupMessages.map((msg, i) => (
                    <div key={i} style={{ marginBottom: "10px", textAlign: msg.sender === "teacher" ? "right" : "left" }}>
                      <span style={{ background: msg.sender === "teacher" ? "#4b6cb7" : "#eee", color: msg.sender === "teacher" ? "#fff" : "#000", padding: "6px 12px", borderRadius: "12px", display: "inline-block" }}>{msg.text}</span>
                    </div>
                  ))}
              </div>
              <div style={{ display: "flex", marginTop: "8px", gap: "5px" }}>
                <input type="text" value={popupInput} onChange={e => setPopupInput(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #ddd" }} />
                <button onClick={handleSendMessage} style={{ padding: "8px 12px", background: "#4b6cb7", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Send</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default StudentsPage;
