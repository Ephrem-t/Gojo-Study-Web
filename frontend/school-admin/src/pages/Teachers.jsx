import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaFacebookMessenger,
  FaSearch
} from "react-icons/fa";
import axios from "axios";

function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const [popupMessages, setPopupMessages] = useState([]);
  const [popupInput, setPopupInput] = useState("");

  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem("admin")) || {};

  // Fetch teachers
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const [teachersRes, assignmentsRes, coursesRes, usersRes] = await Promise.all([
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Courses.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json")
        ]);

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
            email: user.email || null
          };
        });

        setTeachers(teacherList);
      } catch (err) {
        console.error("Error fetching teachers:", err);
      }
    };

    fetchTeachers();
  }, []);

  // Filter teachers by grade
  const filteredTeachers =
    selectedGrade === "All"
      ? teachers
      : teachers.filter(t => t.gradesSubjects.some(gs => gs.grade === selectedGrade));

  // Fetch mini popup messages
  useEffect(() => {
    if (!teacherChatOpen || !selectedTeacher) return;

    const fetchMessages = async () => {
      try {
        const res = await axios.get(
          "https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherMessages.json"
        );
        const all = res.data || {};
        const msgs = Object.values(all).filter(
          m => m.teacherId === selectedTeacher.teacherId
        );
        setPopupMessages(msgs.slice(-20));
      } catch (err) {
        console.error(err);
      }
    };

    fetchMessages();
  }, [teacherChatOpen, selectedTeacher]);

  // Send mini popup message
  const sendPopupMessage = async () => {
    if (!popupInput.trim() || !selectedTeacher) return;

    const msg = {
      teacherId: selectedTeacher.teacherId,
      adminId: admin.adminId,
      text: popupInput,
      time: new Date().toISOString()
    };

    await axios.post(
      "https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherMessages.json",
      msg
    );

    setPopupMessages(prev => [...prev, msg]);
    setPopupInput("");
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
            <Link className="sidebar-btn" to="/students"><FaChalkboardTeacher /> Students</Link>
            <Link className="sidebar-btn" to="/settings"><FaCog /> Settings</Link>
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
        <div className="main-content" style={{ padding: "30px", width: "65%", marginLeft: "180px" }}>
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
                    border: "none"
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
              {filteredTeachers.map(t => (
                <div
                  key={t.teacherId}
                  onClick={() => setSelectedTeacher(t)}
                  style={{
                    width: "500px",
                    height: "70px",
                    border: "1px solid #ddd",
                    borderRadius: "12px",
                    padding: "15px",
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
                    {t.gradesSubjects.length > 0
                      ? t.gradesSubjects.map(gs => gs.subject).join(", ")
                      : "No assigned courses"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        {selectedTeacher && (
          <div
            className="teacher-info-sidebar"
            style={{
              width: "30%",
              padding: "25px",
              background: "#fff",
              boxShadow: "0 0 15px rgba(0,0,0,0.05)",
              position: "fixed",
              right: 0,
              top: "60px",
              height: "calc(100vh - 60px)",
              overflow: "hidden",
              zIndex: 10
            }}
          >
            {/* Teacher Info */}
            <div style={{ textAlign: "center" }}>
              <div style={{ background: "#becff7ff", padding: "25px 10px", height: "200px", width: "calc(100% + 50px)", margin: "-25px -25px 20px", textAlign: "center", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }}>
                <div style={{ width: "100px", height: "100px", margin: "-20px auto 15px", borderRadius: "50%", overflow: "hidden", border: "4px solid #4b6cb7", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }}>
                  <img src={selectedTeacher.profileImage} alt={selectedTeacher.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <h2 style={{ margin: 0, fontSize: "22px", marginTop: "-10px", color: "#000" }}>{selectedTeacher.name}</h2>
                <h2 style={{ margin: 0, fontSize: "12px", color: "#585656" }}>{selectedTeacher.email || "default.teacher@example.com"}</h2>
              </div>

              {/* Tabs */}
              <div style={{ background: "#fff", padding: "15px", marginTop: "-18px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", width: "110%", marginLeft: "-8%" }}>
                <div style={{ display: "flex", borderBottom: "1px solid #eee", marginBottom: "15px" }}>
                  {["details", "schedule", "plan"].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        flex: 1,
                        padding: "10px",
                        border: "none",
                        cursor: "pointer",
                        background: "none",
                        fontWeight: "600",
                        color: activeTab === tab ? "#4b6cb7" : "#777",
                        borderBottom: activeTab === tab ? "3px solid #4b6cb7" : "3px solid transparent"
                      }}
                    >
                      {tab.toUpperCase()}
                    </button>
                  ))}
                </div>

                {activeTab === "details" && (
                  <div>
                    <h4 style={{ color: "#4b6cb7", marginBottom: "10px" }}>Teacher Details</h4>
                    <p style={{ margin: "6px 0", color: "#555" }}><strong>ID:</strong> {selectedTeacher.teacherId}</p>
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
                )}

                {activeTab === "schedule" && (
                  <div>
                    <h4 style={{ color: "#4b6cb7", marginBottom: "10px" }}>Schedule</h4>
                    <p style={{ color: "#555" }}>Teacher schedule will be displayed here.</p>
                  </div>
                )}

                {activeTab === "plan" && (
                  <div>
                    <h4 style={{ color: "#4b6cb7", marginBottom: "10px" }}>Teaching Plan</h4>
                    <p style={{ color: "#555" }}>Teacher lesson plans will be shown here.</p>
                  </div>
                )}

                {/* Message Button */}
                <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
                  <button
                    style={{
                      padding: "10px",
                      width: "120px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#4b6cb7",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: "bold",
                      transition: "0.3s",
                      marginTop: "185px"
                    }}
                    onClick={() => setTeacherChatOpen(true)}
                  >
                    Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MINI POPUP CHAT */}
      {teacherChatOpen && selectedTeacher && (
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
            <strong>{selectedTeacher.name}</strong>
            <div style={{ display: "flex", gap: "10px" }}>
              {/* EXPAND BUTTON: Redirect to AllChat with selected teacher */}
              <button
                onClick={() => {
                  setTeacherChatOpen(false);
                  navigate("/all-chat", { state: { teacher: selectedTeacher } });
                }}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}
              >
                <img width="30" height="30" src="https://img.icons8.com/ios-glyphs/30/expand--v1.png" alt="expand" />
              </button>

              <button
                onClick={() => setTeacherChatOpen(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Chat Body */}
          <div style={{ height: "260px", overflowY: "auto", padding: "10px" }}>
            {popupMessages.length === 0 ? (
              <p style={{ color: "#aaa", textAlign: "center" }}>Start a conversation with {selectedTeacher.name}...</p>
            ) : (
              popupMessages.map((m, i) => (
                <div key={i} style={{ marginBottom: "8px", textAlign: m.adminId === admin.adminId ? "right" : "left" }}>
                  <span style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    background: m.adminId === admin.adminId ? "#4b6cb7" : "#eee",
                    color: m.adminId === admin.adminId ? "#fff" : "#000",
                    display: "inline-block",
                    maxWidth: "80%"
                  }}>{m.text}</span>
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <input
              value={popupInput}
              onChange={e => setPopupInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendPopupMessage()}
              placeholder="Type a message..."
              style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
            />
            <button onClick={sendPopupMessage} style={{ background: "#4b6cb7", padding: "10px 15px", color: "#fff", borderRadius: "8px", border: "none", cursor: "pointer" }}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeachersPage;
