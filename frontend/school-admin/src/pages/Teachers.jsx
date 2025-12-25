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
  FaSearch , FaCalendarAlt, FaCommentDots

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
  const [teacherSchedule, setTeacherSchedule] = useState({}); // store schedule

  const [showMessageDropdown, setShowMessageDropdown] = useState(false);

  const [unreadTeachers, setUnreadTeachers] = useState({});


  const navigate = useNavigate();
 const admin = JSON.parse(localStorage.getItem("admin")) || {};
const adminUserId = admin.userId;   // ✅ now it exists

const weekOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];




  // ---------------- FETCH TEACHERS ----------------
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
              return course ? { grade: course.grade, subject: course.subject, section: course.section } : null;
            })
            .filter(Boolean);

          return {
            teacherId,
            name: user.name || "No Name",
            profileImage: user.profileImage || "/default-profile.png",
            gradesSubjects,
            email: user.email || null,
            userId: teacher.userId
          };
        });

        setTeachers(teacherList);
      } catch (err) {
        console.error("Error fetching teachers:", err);
      }
    };

    fetchTeachers();
  }, []);

  // ---------------- FILTER TEACHERS ----------------
  const filteredTeachers =
    selectedGrade === "All"
      ? teachers
      : teachers.filter(t => t.gradesSubjects.some(gs => gs.grade === selectedGrade));





// ---------------- FETCH TEACHER SCHEDULE ----------------
// ---------------- FETCH TEACHER SCHEDULE (FIXED & WORKING) ----------------
useEffect(() => {
  if (!selectedTeacher || activeTab !== "schedule") return;

  const fetchSchedule = async () => {
    try {
      const res = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Schedules.json"
      );


      const allSchedules = res.data || {};
      const result = {};

      Object.entries(allSchedules).forEach(([day, dayData]) => {
        Object.entries(dayData || {}).forEach(([classKey, periods]) => {
          Object.entries(periods || {}).forEach(([periodKey, entry]) => {
            if (
              entry &&
              entry.teacherId === selectedTeacher.teacherId && // ✅ FIX
              !entry.break
            ) {
              if (!result[day]) result[day] = {};
              if (!result[day][periodKey]) result[day][periodKey] = [];

              result[day][periodKey].push({
                subject: entry.subject,
                class: classKey
              });
            }
          });
        });
      });

      console.log("✅ FINAL TEACHER SCHEDULE:", result);
      setTeacherSchedule(result);
    } catch (err) {
      console.error("❌ Schedule fetch failed:", err);
      setTeacherSchedule({});
    }
  };

  fetchSchedule();
}, [selectedTeacher, activeTab]);




//----------------------Fetch unread messages for teachers--------------------

      useEffect(() => {
  if (!adminUserId || teachers.length === 0) return;

  const fetchUnreadTeachers = async () => {
    const unread = {};

    for (const t of teachers) {
      const chatKey = `${adminUserId}_${t.userId}`;
      try {
        const res = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`
        );

        const msgs = Object.values(res.data || {});
        const count = msgs.filter(
          m => m.receiverId === adminUserId && m.seen === false
        ).length;

        if (count > 0) unread[t.userId] = count;
      } catch (err) {
        console.error(err);
      }
    }

    setUnreadTeachers(unread);
  };

  fetchUnreadTeachers();
}, [teachers, adminUserId]);


  // ---------------- FETCH CHAT MESSAGES ----------------
useEffect(() => {
  if (!teacherChatOpen || !selectedTeacher) return;

  const fetchMessages = async () => {
    try {
      // Always use teacherUserId_adminUserId
      const chatKey = `${selectedTeacher.userId}_${adminUserId}`;

      const res = await axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`);

      const msgs = Object.values(res.data || {}).map(m => ({
        ...m,
        sender: m.senderId === adminUserId ? "admin" : "teacher"
      })).sort((a, b) => a.timeStamp - b.timeStamp);

      setPopupMessages(msgs);
    } catch (err) {
      console.error(err);
      setPopupMessages([]);
    }
  };

  fetchMessages();
}, [teacherChatOpen, selectedTeacher, adminUserId]);
// ---------------- SEND POPUP MESSAGE ----------------


const sendPopupMessage = async () => {
  if (!popupInput.trim() || !selectedTeacher) return;

  const newMessage = {
    senderId: adminUserId,
    receiverId: selectedTeacher.userId,
    text: popupInput,
    timeStamp: Date.now()
  };

  try {
    // Always use teacherUserId_adminUserId
    const chatKey =  `${selectedTeacher.userId}_${adminUserId}`;
    const url = `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`;

    await axios.post(url, newMessage);
    setPopupMessages(prev => [...prev, { ...newMessage, sender: "admin" }]);
    setPopupInput("");
  } catch (err) {
    console.error(err);
  }
};




// ---------------- MARK MESSAGES AS SEEN ----------------


useEffect(() => {
  if (!teacherChatOpen || !selectedTeacher) return;

  const markMessagesAsSeen = async () => {
    const chatKey = `${adminUserId}_${selectedTeacher.userId}`;
    try {
      const res = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`
      );
      const msgs = Object.entries(res.data || {});
      const updates = {};
      msgs.forEach(([key, msg]) => {
        if (msg.receiverId === adminUserId && !msg.seen) updates[key + "/seen"] = true;
      });

      if (Object.keys(updates).length > 0) {
        await axios.patch(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`,
          updates
        );
        // remove badge
        setUnreadTeachers(prev => ({ ...prev, [selectedTeacher.userId]: 0 }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  markMessagesAsSeen();
}, [teacherChatOpen, selectedTeacher, adminUserId]);











  return (
    <div className="dashboard-page">
      {/* ---------------- TOP NAVBAR ---------------- */}
      <nav className="top-navbar">
  <h2>Gojo Dashboard</h2>
  <div className="nav-search">
    <FaSearch className="search-icon" />
    <input type="text" placeholder="Search Teacher and Student..." />
  </div>
  <div className="nav-right">
    <div className="icon-circle"><FaBell /></div>

    {/* ---------- MESSAGE ICON WITH TOTAL UNREAD ---------- */}
   <div 
  className="icon-circle" 
  style={{ position: "relative", cursor: "pointer" }}
  onClick={() => setShowMessageDropdown(prev => !prev)}
>
  <FaFacebookMessenger />
  {Object.values(unreadTeachers).reduce((a, b) => a + b, 0) > 0 && (
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
      {Object.values(unreadTeachers).reduce((a, b) => a + b, 0)}
    </span>
  )}

  {/* ---------- DROPDOWN ---------- */}
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
      {teachers
        .filter(t => unreadTeachers[t.userId] > 0)
        .map(t => {
          const msgs = popupMessages
            .filter(m => m.senderId === t.userId && !m.seen)
            .sort((a, b) => a.timeStamp - b.timeStamp);
          const latestMsg = msgs[msgs.length - 1];

          return (
            <div
              key={t.userId}
              style={{
                padding: "10px",
                borderBottom: "1px solid #eee",
                display: "flex",
                alignItems: "center",
                cursor: "default", // no pointer effect
                background: "#f9f9f9"
              }}
            >
              <img 
                src={t.profileImage} 
                alt={t.name} 
                style={{ width: "40px", height: "40px", borderRadius: "50%", marginRight: "10px" }} 
              />
              <div style={{ flex: 1 }}>
                <strong>{t.name}</strong>
                <p style={{ margin: 0, fontSize: "12px", color: "#555" }}>
                  {latestMsg?.text || "New message"}
                </p>
              </div>
              {latestMsg && (
                <span style={{ fontSize: "10px", color: "#888", marginLeft: "5px" }}>
                  {new Date(latestMsg.timeStamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          );
        })}
      {Object.values(unreadTeachers).reduce((a,b)=>a+b,0) === 0 && (
        <p style={{ textAlign: "center", padding: "10px", color: "#777" }}>No new messages</p>
      )}
    </div>
  )}
</div>



    <div className="icon-circle"><FaCog /></div>
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
                              <Link className="sidebar-btn" to="/dashboard"
                               
                               > <FaHome style={{ width: "28px", height:"28px" }}/> Home</Link>
                                <Link className="sidebar-btn" to="/my-posts"><FaFileAlt /> My Posts</Link>
                                <Link className="sidebar-btn" to="/teachers" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaChalkboardTeacher /> Teachers</Link>
                                  <Link className="sidebar-btn" to="/students" > <FaChalkboardTeacher /> Students</Link>
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
                        border: selectedTeacher?.teacherId === t.teacherId ? "3px solid #4b6cb7" : "3px solid red",
                        objectFit: "cover",
                        transition: "all 0.3s ease"
                      }}
                    />
                    <h3 style={{marginTop: "-35px" }}>{t.name}</h3>


                      {/* ---------- UNREAD BADGE ---------- */}
  {unreadTeachers[t.userId] > 0 && (
  <span style={{
    margin: "10px 10px 10px 200px",
    background: "red",
    color: "#fff",
    borderRadius: "50%",
    padding: "4px 8px",
    fontSize: "12px"
  }}>
    {unreadTeachers[t.userId]}
  </span>
)}
    
</div>
                  <div style={{ marginLeft: "70px", marginTop: "-25px", color: "#555" }}>
                    {t.gradesSubjects.length > 0 ? t.gradesSubjects.map(gs => gs.subject).join(", ") : "No assigned courses"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---------------- RIGHT SIDEBAR ---------------- */}
        {selectedTeacher && (
  <div
    className="teacher-info-sidebar"
    style={{
      width: "30%",
      position: "fixed",
      right: 0,
      top: "70px",
      height: "calc(100vh - 70px)",
      background: "#ffffff",
      boxShadow: "0 0 18px rgba(0,0,0,0.08)",
      borderLeft: "1px solid #e5e7eb",
      zIndex: 20,
      display: "flex",
      flexDirection: "column"
    }}
  >
    {/* ================= SCROLLABLE CONTENT ================= */}
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "25px"
      }}
    >
      {/* ================= HEADER ================= */}
      <div
        style={{
          background: "#e0e7ff",
          margin: "-25px -25px 20px",
          padding: "30px 20px",
          textAlign: "center"
        }}
      >
        <div
          style={{
            width: "110px",
            height: "110px",
            margin: "0 auto 15px",
            borderRadius: "50%",
            overflow: "hidden",
            border: "4px solid #4b6cb7"
          }}
        >
          <img
            src={selectedTeacher.profileImage}
            alt={selectedTeacher.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        <h2 style={{ margin: 0, color: "#111827" }}>
          {selectedTeacher.name}
        </h2>

        <p style={{ margin: "4px 0", color: "#6b7280", fontSize: "14px" }}>
          {selectedTeacher.email || "teacher@example.com"}
        </p>
      </div>

      {/* ================= TABS ================= */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #e5e7eb",
          marginBottom: "15px"
        }}
      >
        {["details", "schedule", "plan"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "12px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              color: activeTab === tab ? "#4b6cb7" : "#6b7280",
              borderBottom:
                activeTab === tab
                  ? "3px solid #4b6cb7"
                  : "3px solid transparent"
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ================= DETAILS TAB ================= */}
      {activeTab === "details" && (
        <div>
          <h4 style={{ color: "#4b6cb7", marginBottom: "10px" }}>
            Teacher Details
          </h4>

          <p><strong>ID:</strong> {selectedTeacher.teacherId}</p>

          {selectedTeacher.gradesSubjects?.length > 0 ? (
            selectedTeacher.gradesSubjects.map((gs, i) => (
              <p key={i} style={{ color: "#374151" }}>
                Grade {gs.grade} – Section {gs.section} • {gs.subject}
              </p>
            ))
          ) : (
            <p style={{ color: "#6b7280" }}>No assigned courses</p>
          )}
        </div>
      )}

      
{/* ================= SCHEDULE TAB ================= */}
{/* ================= SCHEDULE TAB ================= */}
{activeTab === "schedule" && (
  <div style={{ padding: "20px" }}>
    {/* Title */}
    <h4
      style={{
        fontSize: "22px",
        fontWeight: "700",
        textAlign: "center",
        marginBottom: "25px",
        color: "#1e3a8a",
        letterSpacing: "0.5px"
      }}
    >
      Weekly Teaching Schedule
    </h4>

    {/* Empty State */}
    {Object.keys(teacherSchedule).length === 0 ? (
      <div
        style={{
          textAlign: "center",
          padding: "40px",
          borderRadius: "16px",
          background: "#f3f4f6",
          color: "#6b7280",
          fontSize: "15px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
        }}
      >
        📭 No schedule assigned yet
      </div>
    ) : (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)", // TWO COLUMNS
          gap: "24px"
        }}
      >
        {weekOrder
          .filter(day => teacherSchedule[day])
          .map(day => {
            const periods = teacherSchedule[day];

            return (
              <div
                key={day}
                style={{
                  borderRadius: "16px",
                  padding: "18px",
                  background: "#ffffff",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
                  border: "1px solid #e5e7eb",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow =
                    "0 12px 30px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 20px rgba(0,0,0,0.08)";
                }}
              >
                {/* Day Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px"
                  }}
                >
                  <h5
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      color: "#1e3a8a"
                    }}
                  >
                    📆 {day}
                  </h5>

                  <span
                    style={{
                      fontSize: "12px",
                      padding: "5px 12px",
                      borderRadius: "999px",
                      background: "#eef2ff",
                      color: "#1e40af",
                      fontWeight: "500"
                    }}
                  >
                    {Object.keys(periods).length} periods
                  </span>
                </div>

                {/* Periods */}
                {Object.entries(periods).map(([period, entries]) => (
                  <div
                    key={period}
                    style={{
                      marginBottom: "14px",
                      borderRadius: "12px",
                      padding: "12px",
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      transition: "transform 0.2s ease",
                      cursor: "pointer"
                    }}
                    onMouseEnter={e =>
                      (e.currentTarget.style.transform = "translateY(-2px)")
                    }
                    onMouseLeave={e =>
                      (e.currentTarget.style.transform = "translateY(0)")
                    }
                  >
                    {/* Period Header */}
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#374151",
                        marginBottom: "10px"
                      }}
                    >
                      ⏰ {period}
                    </div>

                    {/* Subjects */}
                    {entries.map((e, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 10px",
                          borderRadius: "10px",
                          background: "#ffffff",
                          marginBottom: "6px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                          fontSize: "13px"
                        }}
                      >
                        <span style={{ fontWeight: "500", color: "#111827" }}>
                          📘 {e.subject}
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "500",
                            padding: "3px 8px",
                            borderRadius: "999px",
                            background: "#e0e7ff",
                            color: "#3730a3"
                          }}
                        >
                          {e.class}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
      </div>
    )}
  </div>
)}




      {/* ================= PLAN TAB ================= */}
      {activeTab === "plan" && (
        <p style={{ color: "#6b7280" }}>
          Teacher lesson plans will be shown here.
        </p>
      )}

      {/* ================= MESSAGE BUTTON ================= */}
     

{/* ================= FIXED MESSAGE BUTTON ================= */}
<div
  onClick={() => setTeacherChatOpen(true)}
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
  

    </div>
 
)}

      </div>

      {/* ---------------- MINI POPUP CHAT ---------------- */}
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
          zIndex: 999
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ddd", paddingBottom: "10px" }}>
            <strong>{selectedTeacher.name}</strong>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
  onClick={() => {
    setTeacherChatOpen(false); // close mini popup
    navigate("/all-chat", { state: { user: selectedTeacher } }); // pass teacher as selected user
  }}
  style={{
    background: "none",
    border: "none",
    fontSize: "18px",
    cursor: "pointer"
  }}
>
  ↗
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
                <div key={i} style={{ marginBottom: "8px", textAlign: m.sender === "admin" ? "right" : "left" }}>
                  <span style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    background: m.sender === "admin" ? "#4b6cb7" : "#eee",
                    color: m.sender === "admin" ? "#fff" : "#000",
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
            <button
        onClick={() => sendMessage(newMessageText)}
        style={{
          background: "none",
          border: "none",
          color: "#3654dada",
          cursor: "pointer",
          fontSize: "30px",
        }}
      >
        ➤
      </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeachersPage;
