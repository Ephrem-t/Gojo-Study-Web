import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, 
  FaSignOutAlt, FaBell, FaFacebookMessenger, FaSearch 
} from "react-icons/fa";
import axios from "axios";

function StudentsPage() {
  // ------------------ STATES ------------------
  const [students, setStudents] = useState([]); // List of all students
  const [selectedGrade, setSelectedGrade] = useState("All"); // Grade filter
  const [selectedSection, setSelectedSection] = useState("All"); // Section filter
  const [sections, setSections] = useState([]); // Sections available for selected grade
  const [selectedStudent, setSelectedStudent] = useState(null); // Currently selected student
  const [studentChatOpen, setStudentChatOpen] = useState(false); // Toggle chat popup
  const [studentTab, setStudentTab] = useState("details"); // Tab in sidebar (details/attendance/performance)
  const [popupMessages, setPopupMessages] = useState([]); // Messages for chat popup
  const [popupInput, setPopupInput] = useState(""); // Input for chat message

  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem("admin")) || {}; // Admin info from localStorage

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

  // ------------------ FETCH MESSAGES FOR CHAT POPUP ------------------
 useEffect(() => {
  if (studentChatOpen && selectedStudent) {
    const fetchMessages = async () => {
      try {
        const url = `https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentMessages.json`;
        const res = await axios.get(url);
        const allMessages = Object.values(res.data || {})
          .filter(m => m.studentId === selectedStudent.studentId);
        setPopupMessages(allMessages);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };
    fetchMessages();
  }
}, [studentChatOpen, selectedStudent]);


  // ------------------ SEND MESSAGE ------------------
  const handleSendMessage = async () => {
    if (!popupInput.trim()) return;

   const newMessage = {
  studentId: selectedStudent.studentId,
  adminId: admin.adminId,
  content: popupInput,
  timestamp: new Date().toISOString(),
};

    try {
      // Push message to Firebase
      await axios.post(
  `https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentMessages.json`,
  newMessage
);
      setPopupMessages([...popupMessages, newMessage]);
      setPopupInput(""); // Clear input
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

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
          <div className="icon-circle"><FaFacebookMessenger /></div>
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
            <Link className="sidebar-btn" to="/dashboard"><FaHome /> Home</Link>
            <Link className="sidebar-btn" to="/my-posts"><FaFileAlt /> My Posts</Link>
            <Link className="sidebar-btn" to="/teachers"><FaChalkboardTeacher /> Teachers</Link>
            <Link className="sidebar-btn" to="/students" style={{ background: "#4b6cb7", color: "#fff" }}>
              <FaChalkboardTeacher /> Students
            </Link>
            <Link className="sidebar-btn" to="/settings"><FaCog /> Settings</Link>
            <button className="sidebar-btn logout-btn" onClick={() => { localStorage.removeItem("admin"); window.location.href = "/login"; }}>
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
                <div key={s.studentId} onClick={() => setSelectedStudent(s)} style={{
                  width: "500px",
                  height: "70px",
                  borderRadius: "12px",
                  padding: "15px",
                  background: selectedStudent?.studentId === s.studentId ? "#e0e7ff" : "#fff",
                  border: selectedStudent?.studentId === s.studentId ? "2px solid #4b6cb7" : "1px solid #ddd",
                  display: "flex",
                  alignItems: "center",
                  gap: "20px",
                  boxShadow: selectedStudent?.studentId === s.studentId ? "0 6px 15px rgba(75,108,183,0.3)" : "0 4px 10px rgba(0,0,0,0.1)",
                  cursor: "pointer",
                  transition: "all 0.3s ease"
                }}>
                  <img src={s.profileImage} alt={s.name} style={{
                    width: "50px",
                    height: "50px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: selectedStudent?.studentId === s.studentId ? "3px solid #4b6cb7" : "3px solid red",
                    transition: "all 0.3s ease"
                  }} />
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
        {selectedStudent && (
          <div className="student-info-sidebar" style={{
            width: "30%",
            padding: "25px",
            background: "#fff",
            display: "block",
            boxShadow: "0 0 15px rgba(0,0,0,0.05)",
            position: "fixed",
            right: 0,
            top: "60px",
            height: "calc(100vh - 60px)",
            overflow: "hidden",
            zIndex: 10
          }}>
            {/* Student Avatar & Info */}
            <div style={{ textAlign: "center" }}>
              <div style={{
                background: "#becff7ff",
                padding: "25px 10px",
                height: "200px",
                width: "calc(100% + 50px)",
                margin: "-25px -25px 20px",
                textAlign: "center",
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
                <h2 style={{ margin: "0", fontSize: "22px", marginTop: "-10px", color: "#333" }}>{selectedStudent.name}</h2>
                <h2 style={{ margin: "0", fontSize: "16px", marginTop: "0", color: "#585656ff" }}>
                  {selectedStudent.email || "default.student@example.com"}
                </h2>
              </div>
              <p style={{ color: "#555", fontSize: "16px", margin: "5px 0" }}><strong>Grade:</strong> {selectedStudent.grade}</p>
              <p style={{ color: "#555", fontSize: "16px", margin: "5px 0 20px 0" }}><strong>Section:</strong> {selectedStudent.section}</p>
            </div>

            {/* ---------------- TABS ---------------- */}
            <div style={{ background: "#fff", borderRadius: "10px", padding: "15px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", width: "100%", textAlign: "left" }}>
              <div style={{ display: "flex", borderBottom: "1px solid #eee", marginBottom: "15px" }}>
                {["details", "attendance", "performance"].map((tab) => (
                  <button key={tab} onClick={() => setStudentTab(tab)} style={{
                    flex: 1,
                    padding: "10px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontWeight: "600",
                    color: studentTab === tab ? "#4b6cb7" : "#777",
                    borderBottom: studentTab === tab ? "3px solid #4b6cb7" : "3px solid transparent",
                  }}>{tab.toUpperCase()}</button>
                ))}
              </div>

              {studentTab === "details" && (
                <div>
                  <h4 style={{ marginBottom: "10px", color: "#4b6cb7" }}>Student Details</h4>
                  <p style={{ margin: "6px 0", color: "#555" }}><strong>ID:</strong> {selectedStudent.studentId}</p>
                  <p style={{ margin: "6px 0", color: "#555" }}>Additional details can go here.</p>
                </div>
              )}
              {studentTab === "attendance" && (
                <div>
                  <h4 style={{ marginBottom: "10px", color: "#4b6cb7" }}>Attendance</h4>
                  <p style={{ color: "#555" }}>Student attendance data will be shown here.</p>
                </div>
              )}
              {studentTab === "performance" && (
                <div>
                  <h4 style={{ marginBottom: "10px", color: "#4b6cb7" }}>Performance</h4>
                  <p style={{ color: "#555" }}>Student performance reports will be displayed here.</p>
                </div>
              )}
            </div>

            {/* ---------------- MESSAGE BUTTON ---------------- */}
            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
              <button style={{
                padding: "10px",
                width: "120px",
                borderRadius: "8px",
                border: "none",
                background: "#4b6cb7",
                color: "#fff",
                cursor: "pointer",
                fontWeight: "bold",
                transition: "0.3s",
                marginTop: "140px"
              }} onClick={() => setStudentChatOpen(true)}>Message</button>
            </div>
          </div>
        )}

        {/* ---------------- STUDENT CHAT POPUP ---------------- */}
        {studentChatOpen && selectedStudent && (
          <div style={{
            position: "fixed",
            bottom: "6px",
            width: "320px",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
            padding: "15px",
            zIndex: 999,
            right: "22px",
            animation: "fadeIn 0.3s ease"
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ddd", paddingBottom: "10px" }}>
              <strong>{selectedStudent.name}</strong>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => {
                  setStudentChatOpen(false);
                  navigate("/all-chat", { state: { studentId: selectedStudent.studentId, userType: "student" } });
                }} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}>
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
                popupMessages.map((msg, index) => (
                  <div key={index} style={{ marginBottom: "10px", textAlign: msg.sender === "admin" ? "right" : "left" }}>
                    <span style={{
                      background: msg.sender === "admin" ? "#4b6cb7" : "#eee",
                      color: msg.sender === "admin" ? "#fff" : "#000",
                      padding: "6px 12px",
                      borderRadius: "12px",
                      display: "inline-block"
                    }}>{msg.text}</span>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div style={{ display: "flex", marginTop: "8px", gap: "5px" }}>
              <input type="text" value={popupInput} onChange={e => setPopupInput(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #ddd" }} />
              <button onClick={handleSendMessage} style={{ padding: "8px 12px", background: "#4b6cb7", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Send</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default StudentsPage;
