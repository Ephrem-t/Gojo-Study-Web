import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt } from "react-icons/fa";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [sections, setSections] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null); // new state
  const [studentChatOpen, setStudentChatOpen] = useState(false);
  const navigate = useNavigate();
  


  const admin = JSON.parse(localStorage.getItem("admin")) || {};

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
          };
        });

        setStudents(studentList);
      } catch (err) {
        console.error("Error fetching students:", err);
      }
    };

    fetchStudents();
  }, []);

  useEffect(() => {
    if (selectedGrade === "All") {
      setSections([]);
    } else {
      const gradeSections = [
        ...new Set(students.filter(s => s.grade === selectedGrade).map(s => s.section))
      ];
      setSections(gradeSections);
      setSelectedSection("All");
    }
  }, [selectedGrade, students]);

  const filteredStudents = students.filter(s => {
    if (selectedGrade !== "All" && s.grade !== selectedGrade) return false;
    if (selectedSection !== "All" && s.section !== selectedSection) return false;
    return true;
  });

  return (
    <div className="dashboard-page">
      {/* NAVBAR */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>
        <div className="nav-right">
          <img src={admin.profileImage || "/default-profile.png"} alt="admin" />
          <span>{admin.name}</span>
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex" }}>
        {/* SIDEBAR */}
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

        {/* MAIN CONTENT */}
        <div className="main-content" style={{ padding: "30px", width: "65%", marginLeft: "350px" }}>
          <h2 style={{ marginBottom: "20px", textAlign: "center" }}>Students</h2>

          {/* Grade Filter */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "15px", gap: "12px" }}>
            {["All", "9", "10", "11", "12"].map(g => (
              <button
                key={g}
                onClick={() => setSelectedGrade(g)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  background: selectedGrade === g ? "#4b6cb7" : "#ddd",
                  color: selectedGrade === g ? "#fff" : "#000",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                {g === "All" ? "All Grades" : `Grade ${g}`}
              </button>
            ))}
          </div>

          {/* Section Filter */}
          {selectedGrade !== "All" && sections.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px", gap: "12px" }}>
              {["All", ...sections].map(section => (
                <button
                  key={section}
                  onClick={() => setSelectedSection(section)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: selectedSection === section ? "#4b6cb7" : "#ddd",
                    color: selectedSection === section ? "#fff" : "#000",
                    cursor: "pointer",
                    border: "none",
                  }}
                >
                  {section === "All" ? "All Sections" : `Section ${section}`}
                </button>
              ))}
            </div>
          )}

          {/* Students List */}
          {filteredStudents.length === 0 ? (
            <p style={{ textAlign: "center", color: "#555" }}>No students found for this selection.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "15px" }}>
             {filteredStudents.map(s => (
  <div
    key={s.studentId}
    onClick={() => setSelectedStudent(s)}
    style={{
      width: "600px",
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
    }}
  >
    <img
      src={s.profileImage}
      alt={s.name}
      style={{
        width: "50px",
        height: "50px",
        borderRadius: "50%",
        objectFit: "cover",
        border: selectedStudent?.studentId === s.studentId ? "3px solid #4b6cb7" : "3px solid red",
        transition: "all 0.3s ease"
      }}
    />
    <div>
      <h3 style={{ margin: 0 }}>{s.name}</h3>
      <p style={{ margin: "4px 0", color: "#555" }}>
        Grade {s.grade} - Section {s.section}
      </p>
    </div>
  </div>
))}

            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR FOR SELECTED STUDENT */}
      {/* RIGHT SIDEBAR FOR SELECTED STUDENT */}
{/* RIGHT SIDEBAR FOR SELECTED STUDENT */}
<div
  className="student-info-sidebar"
  style={{
    width: "20%",
    padding: "25px",
    borderLeft: "1px solid #ddd",
    background: "#f1f4f8",
    display: selectedStudent ? "block" : "none",
    boxShadow: "0 0 15px rgba(0,0,0,0.05)",
    borderRadius: "12px 0 0 12px",

    // FIXED SIDEBAR — WILL NOT SCROLL
    position: "fixed",
    right: 0,
    top: "60px",
    height: "calc(100vh - 60px)",
    overflow: "hidden",
    zIndex: 10
  }}
>
  {selectedStudent && (
    <div style={{ textAlign: "center" }}>
      {/* Avatar */}
      <div
        style={{
          width: "120px",
          height: "120px",
          margin: "0 auto 20px",
          borderRadius: "50%",
          overflow: "hidden",
          border: "4px solid #4b6cb7",
          boxShadow: "0 4px 15px rgba(0,0,0,0.1)"
        }}
      >
        <img
          src={selectedStudent.profileImage}
          alt={selectedStudent.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Name */}
      <h2 style={{ margin: "10px 0", fontSize: "22px", color: "#333" }}>
        {selectedStudent.name}
      </h2>

      {/* Grade & Section */}
      <p style={{ color: "#555", fontSize: "16px", margin: "5px 0" }}>
        <strong>Grade:</strong> {selectedStudent.grade}
      </p>
      <p style={{ color: "#555", fontSize: "16px", margin: "5px 0 20px 0" }}>
        <strong>Section:</strong> {selectedStudent.section}
      </p>

      {/* Info Card */}
      <div
        style={{
          background: "#fff",
          borderRadius: "10px",
          padding: "15px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          textAlign: "left"
        }}
      >
        <h4 style={{ marginBottom: "10px", color: "#4b6cb7" }}>
          Student Info
        </h4>
        <p style={{ margin: "6px 0", color: "#555" }}>
          <strong>ID:</strong> {selectedStudent.studentId}
        </p>
        <p style={{ margin: "6px 0", color: "#555" }}>
          Additional details can go here.
        </p>
      </div>

      {/* Action Button */}
      <div
        style={{
          marginTop: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}
      >
       <button
  style={{
    padding: "10px",
    borderRadius: "8px",
    border: "none",
    background: "#4b6cb7",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "0.3s",
    marginTop: "400px"
  }}
  onClick={() => setStudentChatOpen(true)}
>
  Message
</button>

      </div>
    </div>
  )}
</div>


{/* CHAT POPUP (Instagram Style) */}
{/* STUDENT CHAT POPUP */}
{studentChatOpen && selectedStudent && (
  <div
    style={{
      position: "fixed",
      bottom: "90px",
      width: "320px",
      background: "#fff",
      borderRadius: "12px",
      boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
      padding: "15px",
      zIndex: 999,
      right: "25px",
      animation: "fadeIn 0.3s ease"
    }}
  >
    {/* Header */}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #ddd",
        paddingBottom: "10px"
      }}
    >
      <strong>{selectedStudent.name}</strong>

      <div style={{ display: "flex", gap: "10px" }}>
        {/* EXPAND BUTTON */}
        <button
          onClick={() => {
            setStudentChatOpen(false);
            navigate("/student-chat", { state: { studentId: selectedStudent.studentId } });
          }}
          style={{
            background: "none",
            border: "none",
            fontSize: "18px",
            cursor: "pointer"
          }}
        >
          <img
            width="30"
            height="30"
            src="https://img.icons8.com/ios-glyphs/30/expand--v1.png"
            alt="expand"
          />
        </button>

        {/* CLOSE BUTTON */}
        <button
          onClick={() => setStudentChatOpen(false)}
          style={{
            background: "none",
            border: "none",
            fontSize: "20px",
            cursor: "pointer"
          }}
        >
          ×
        </button>
      </div>
    </div>

    {/* Chat Body */}
    <div
      style={{
        height: "260px",
        overflowY: "auto",
        padding: "10px"
      }}
    >
      <p style={{ color: "#aaa", textAlign: "center" }}>
        Start a conversation with {selectedStudent.name}...
      </p>
    </div>

    {/* Chat Input */}
    <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
      <input
        type="text"
        placeholder="Type a message..."
        style={{
          flex: 1,
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #ccc"
        }}
      />
      <button
        style={{
          background: "#4b6cb7",
          padding: "10px 15px",
          color: "#fff",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer"
        }}
      >
        Send
      </button>
    </div>
  </div>
)}


      </div>
    </div>
  );
}

export default StudentsPage;
