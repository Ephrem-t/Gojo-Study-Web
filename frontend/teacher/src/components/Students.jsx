import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaSearch, FaBell } from "react-icons/fa";
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
  const navigate = useNavigate();

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
        const res = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json");
        const usersRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json");

        const studentsData = Object.values(res.data || {});
        const usersData = usersRes.data || {};

        const mappedStudents = studentsData.map(s => {
          const user = Object.values(usersData).find(u => u.userId === s.userId);
          return {
            ...s,
            name: user?.name || "Unknown",
            profileImage: user?.profileImage || "/default-profile.png",
            email: user?.email || "default.student@example.com",
          };
        });

        setStudents(mappedStudents);
        setError("");
      } catch (err) {
        console.error(err);
        setError("Failed to fetch students");
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, []);

  // ---------------- GRADE → SECTION ----------------
  useEffect(() => {
    if (selectedGrade === "All") {
      setSections([]);
      setSelectedSection("All");
    } else {
      const secs = [...new Set(students.filter(s => s.grade === selectedGrade).map(s => s.section))];
      setSections(secs);
      setSelectedSection("All");
    }
  }, [selectedGrade, students]);

  const filteredStudents = students.filter(s => {
    if (selectedGrade !== "All" && s.grade !== selectedGrade) return false;
    if (selectedSection !== "All" && s.section !== selectedSection) return false;
    return true;
  });

  const grades = [...new Set(students.map(s => s.grade))].sort();

  // ---------------- FETCH MESSAGES ----------------
  useEffect(() => {
    if (!selectedStudent || !teacherUserId) return;

    async function fetchMessages() {
      try {
        const key = `${selectedStudent.userId}_${teacherUserId}`;
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
    };

    try {
      const key = `${selectedStudent.userId}_${teacherUserId}`;
      await axios.post(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key}/messages.json`, newMessage);
      setPopupMessages([...popupMessages, { ...newMessage, sender: "teacher" }]);
      setPopupInput("");
    } catch (err) {
      console.error(err);
    }
  };

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
            <Link className="sidebar-btn" to="/dashboard"><FaHome /> Home</Link>
            <Link className="sidebar-btn" to="/my-posts"><FaFileAlt /> My Posts</Link>
            <Link className="sidebar-btn" to="/teachers"><FaChalkboardTeacher /> Teachers</Link>
            <Link className="sidebar-btn" to="/students" style={{ background: "#4b6cb7", color: "#fff" }}><FaChalkboardTeacher /> Students</Link>
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
          {selectedStudent && (
            <div style={{ width: "30%", padding: "25px", background: "#fff", boxShadow: "0 0 15px rgba(0,0,0,0.05)", position: "fixed", right: 0, top: "60px", height: "calc(100vh - 60px)", overflowY: "auto", zIndex: 10 }}>
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ width: "120px", height: "120px", margin: "0 auto 15px", borderRadius: "50%", overflow: "hidden", border: "4px solid #4b6cb7" }}>
                  <img src={selectedStudent.profileImage} alt={selectedStudent.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <h2 style={{ margin: 0, fontSize: "22px" }}>{selectedStudent.name}</h2>
                <p style={{ color: "#555", margin: "5px 0" }}>{selectedStudent.email}</p>
                <p style={{ color: "#555", margin: "5px 0" }}><strong>Grade:</strong> {selectedStudent.grade}</p>
                <p style={{ color: "#555", margin: "5px 0" }}><strong>Section:</strong> {selectedStudent.section}</p>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", marginBottom: "15px" }}>
                {["details", "attendance", "performance"].map(tab => (
                  <button key={tab} onClick={() => setStudentTab(tab)} style={{ flex: 1, padding: "10px", border: "none", background: "none", cursor: "pointer", fontWeight: "600", color: studentTab === tab ? "#4b6cb7" : "#777", borderBottom: studentTab === tab ? "3px solid #4b6cb7" : "3px solid transparent" }}>{tab.toUpperCase()}</button>
                ))}
              </div>

              <div>
                {studentTab === "details" && <div><p><strong>ID:</strong> {selectedStudent.userId}</p></div>}
                {studentTab === "attendance" && <div><p>Attendance data here.</p></div>}
                {studentTab === "performance" && <div><p>Performance data here.</p></div>}
              </div>

              <div style={{ marginTop: "20px", textAlign: "center" }}>
                <button onClick={() => setStudentChatOpen(true)} style={{ padding: "10px 20px", borderRadius: "8px", background: "#4b6cb7", color: "#fff", border: "none", cursor: "pointer" }}>Message</button>
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
