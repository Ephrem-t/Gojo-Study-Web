import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt } from "react-icons/fa";
import axios from "axios";
import { useNavigate } from "react-router-dom";


function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedTeacher, setSelectedTeacher] = useState(null); // new state
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const navigate = useNavigate();


  const admin = JSON.parse(localStorage.getItem("admin")) || {};

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const teachersRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json");
        const assignmentsRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json");
        const coursesRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Courses.json");
        const usersRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json");

        const teachersData = teachersRes.data || {};
        const assignmentsData = assignmentsRes.data || {};
        const coursesData = coursesRes.data || {};
        const usersData = usersRes.data || {};

        const teacherList = Object.keys(teachersData).map(teacherId => {
          const teacher = teachersData[teacherId];
          const user = usersData[teacher.userId] || {};

          const gradesSubjects = Object.values(assignmentsData)
            .filter(a => a.teacherId === teacherId)
            .map(a => {
              const course = coursesData[a.courseId];
              return course
                ? { grade: course.grade, subject: course.subject, section: course.section }
                : null;
            })
            .filter(Boolean);

          return {
            teacherId,
            name: user.name || "No Name",
            profileImage: user.profileImage || "/default-profile.png",
            gradesSubjects,
          };
        });

        setTeachers(teacherList);
      } catch (err) {
        console.error("Error fetching teachers:", err);
      }
    };

    fetchTeachers();
  }, []);

  const filteredTeachers =
    selectedGrade === "All"
      ? teachers
      : teachers.filter(t => t.gradesSubjects.some(gs => gs.grade === selectedGrade));

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
            <Link className="sidebar-btn" to="/teachers" style={{ background: "#4b6cb7", color: "#fff" }}>
              <FaChalkboardTeacher /> Teachers
            </Link>
            <Link className="sidebar-btn" to="/students">
              <FaChalkboardTeacher /> Students
            </Link>
            <Link className="sidebar-btn" to="/settings">
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
          <h2 style={{ marginBottom: "10px", textAlign: "center" }}>Teachers</h2>

          {/* Grade Filter */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px" }}>
            <div style={{ display: "flex", gap: "12px" }}>
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
                  {g === "All" ? "All Teachers" : `Grade ${g}`}
                </button>
              ))}
            </div>
          </div>

          {/* Teachers List */}
          {filteredTeachers.length === 0 ? (
            <p style={{ textAlign: "center", color: "#555" }}>No teachers found for this grade.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
              {filteredTeachers.map((t) => (
                <div
                  key={t.teacherId}
                  onClick={() => setSelectedTeacher(t)}
                  style={{
                    width: "500px",
                    Height: "50px",
                    border: "1px solid #ddd",
                    borderRadius: "12px",
                    background: selectedTeacher?.teacherId === t.teacherId ? "#e0e7ff" : "#fff",
                    border: selectedTeacher?.teacherId === t.teacherId ? "2px solid #4b6cb7" : "1px solid #ddd",
                    boxShadow: selectedTeacher?.teacherId === t.teacherId ? "0 6px 15px rgba(75,108,183,0.3)" : "0 4px 10px rgba(0,0,0,0.1)",
                    cursor: "pointer",
                    transition: "all 0.3s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                    <img
                      src={t.profileImage}
                      alt={t.name}
                      style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: "50%",
                        marginTop: "-5px",
                        border: selectedTeacher?.teacherId === t.teacherId ? "3px solid #4b6cb7" : "3px solid red",
                        objectFit: "cover",
                        transition: "all 0.3s ease"
                      }}
                    />
                    <h3 style={{ marginTop: "-30px" }}>{t.name}</h3>
                  </div>
                  <div style={{ marginLeft: "70px", marginTop: "-25px", color: "#555" }}>
                    {t.gradesSubjects && t.gradesSubjects.length > 0
                      ? t.gradesSubjects.map(gs => gs.subject).join(", ")
                      : "No assigned courses"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

       {/* RIGHT SIDEBAR FOR SELECTED TEACHER */}
<div
  className="teacher-info-sidebar"
  style={{
    width: "20%",
    padding: "25px",
    borderLeft: "1px solid #ddd",
    background: "#f1f4f8",
    display: selectedTeacher ? "block" : "none",
    boxShadow: "0 0 15px rgba(0,0,0,0.05)",
    borderRadius: "12px 0 0 12px",

    // FIXED SIDEBAR – DOES NOT SCROLL
    position: "fixed",
    right: 0,
    top: "60px",
    height: "calc(100vh - 60px)",
    overflow: "hidden",
    zIndex: 10
  }}
>
  {selectedTeacher && (
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
          src={selectedTeacher.profileImage}
          alt={selectedTeacher.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Name */}
      <h2 style={{ margin: "10px 0", fontSize: "22px", color: "#333" }}>
        {selectedTeacher.name}
      </h2>

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
        <h4 style={{ marginBottom: "10px", color: "#4b6cb7" }}>Teacher Info</h4>

        <p style={{ margin: "6px 0", color: "#555" }}>
          <strong>ID:</strong> {selectedTeacher.teacherId}
        </p>

        {selectedTeacher.gradesSubjects?.length > 0 ? (
          selectedTeacher.gradesSubjects.map((gs, index) => (
            <p key={index} style={{ margin: "4px 0", color: "#555" }}>
              Grade {gs.grade} – Section {gs.section} : {gs.subject}
            </p>
          ))
        ) : (
          <p style={{ color: "#555" }}>No assigned courses</p>
        )}
      </div>

      {/* Message Button */}
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
    marginTop: "450px"
  }}
  onClick={() => setTeacherChatOpen(true)}
>
  Message
</button>

      </div>

    </div>
  )}
</div>
{/* TEACHER CHAT POPUP */}
{/* TEACHER CHAT POPUP */}
{teacherChatOpen && selectedTeacher && (
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
      marginLeft: "1550px",
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
      <strong>{selectedTeacher.name}</strong>

      <div style={{ display: "flex", gap: "10px" }}>
        {/* EXPAND BUTTON */}
        <button
          onClick={() => {
            setTeacherChatOpen(false); // close popup
            navigate("/teacher-chat", {
              state: { teacherId: selectedTeacher.teacherId } // send teacherId to chat page
            });
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
          onClick={() => setTeacherChatOpen(false)}
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
        Start a conversation with {selectedTeacher.name}...
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

export default TeachersPage;
