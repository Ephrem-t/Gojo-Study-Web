import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { FaHome, FaCog, FaSignOutAlt, FaSave, FaBell, FaSearch, FaClipboardCheck, FaUsers, FaChalkboardTeacher, FaFacebookMessenger } from "react-icons/fa";
import "../styles/global.css";

const API_BASE = "http://127.0.0.1:5000/api";
const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";
function AttendancePage() {

  // --- All state declarations at the top ---
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courses, setCourses] = useState([]);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]); // conversations with unread messages for this teacher
  const [teacher, setTeacher] = useState(null);
  // totalUnreadMessages helper
  const totalUnreadMessages = conversations.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);

  // --- Effects and handlers below ---
  // Fetch courses assigned to the teacher
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
          ([_, t]) => t.userId === teacher.userId
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
        // Auto-select first course if not already selected
        if (!selectedCourse && teacherCourses.length > 0) {
          setSelectedCourse(teacherCourses[0]);
        }
      } catch (err) {
        console.error("Error fetching courses:", err);
      }
    };
    fetchCourses();
  }, [teacher]);

  // Fetch students for the selected course
  useEffect(() => {
    if (!selectedCourse) return;
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const [studentsRes, usersRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/Students.json`),
          axios.get(`${RTDB_BASE}/Users.json`),
        ]);
        const studentsData = studentsRes.data || {};
        const usersData = usersRes.data || {};
        // Only students in the selected course's grade and section
        const filtered = Object.entries(studentsData)
          .filter(([, s]) =>
            s.grade === selectedCourse.grade && s.section === selectedCourse.section
          )
          .map(([id, s]) => ({
            studentId: id,
            ...s,
            name: usersData?.[s.userId]?.name || "Unknown",
            profileImage: usersData?.[s.userId]?.profileImage || "/default-profile.png",
          }));
        setStudents(filtered);
        setError("");
      } catch (err) {
        setError("Failed to fetch students. Please try again.");
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [selectedCourse]);

  // Logout handler (fixes ReferenceError)
  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };
  // Messenger toggle handler (fixes ReferenceError)
  const handleMessengerToggle = () => {
    setShowMessenger((prev) => !prev);
  };
  
  
    // Load teacher from localStorage on mount
    useEffect(() => {
      const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
      if (storedTeacher) {
        setTeacher(storedTeacher);
      }
    }, []);
  
   const teacherUserId = teacher?.userId;
    


    // ---------------- LOAD LOGGED-IN TEACHER ----------------
    useEffect(() => {
      const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
      if (!storedTeacher) {
        return;
      }
      setTeacherInfo(storedTeacher);
    }, []);



  // ---------------- FETCH ATTENDANCE ----------------
  useEffect(() => {
    if (!selectedCourse) return;

    const fetchAttendance = async () => {
      try {
        const res = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Attendance/${selectedCourse.id}/${date}.json`
        );
        setAttendance(res.data || {});
      } catch (err) {
        console.error("Error fetching attendance:", err);
        setAttendance({});
      }
    };

    fetchAttendance();
  }, [selectedCourse, date]);

  // ---------------- MARK ATTENDANCE ----------------
const handleMark = (studentId, status) => {
  setAttendance(prev => ({ ...prev, [studentId]: status }));
};


 const handleSave = async () => {
  if (!selectedCourse) {
    alert("Please select a course");
    return;
  }

  try {
    await axios.put(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Attendance/${selectedCourse.id}/${date}.json`,
      attendance
    );
    alert("Attendance saved successfully!");
  } catch (err) {
    console.error("Error saving attendance:", err);
    alert("Failed to save attendance");
  }
};




// Students are now filtered in the fetchStudents effect above


  const grades = [...new Set(students.map(s => s.grade))].sort();



  
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
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/School_Admins.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"),
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



  // ---------------- RENDER ----------------
  // Responsive styles for navbar, sidebar, and main content
  const attendanceResponsiveStyles = `
    .dashboard-page {
      min-height: 100vh;
      background: #f0f4f8;
      display: flex;
      flex-direction: column;
    }
    .top-navbar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      z-index: 1000;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      height: 64px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07);
    }
    .nav-right {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .google-dashboard {
      display: flex;
      flex: 1;
      margin-top: 64px;
      min-height: 0;
    }
    .google-sidebar {
      position: fixed;
      top: 64px;
      left: 0;
      width: 200px;
      height: calc(100vh - 64px);
      background: #fff;
      box-shadow: 2px 0 8px rgba(0,0,0,0.04);
      z-index: 900;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 18px;
      overflow-y: auto;
    }
    .attendance-main-content-responsive {
      margin-left: 220px;
      margin-top: 0;
      width: calc(100vw - 240px);
      min-width: 320px;
      max-width: 100vw;
      background: #fff;
      border-radius: 15px;
      box-shadow: 0 8px 10px rgba(0,0,0,0.1);
      padding: 30px;
      position: relative;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    @media (max-width: 900px) {
      .attendance-main-content-responsive {
        width: 100vw;
        margin-left: 60px;
        min-width: unset;
        max-width: unset;
        padding: 18px 4vw;
      }
      .google-sidebar {
        width: 60px;
        padding: 0;
        align-items: flex-start;
      }
    }
    @media (max-width: 600px) {
      .top-navbar {
        height: 54px;
        padding: 0 8px;
      }
      .google-sidebar {
        top: 54px;
        width: 48px;
        min-width: 48px;
        padding: 0;
        align-items: flex-start;
      }
      .attendance-main-content-responsive {
        width: 100vw;
        margin-left: 48px;
        padding: 10px 2vw;
        border-radius: 8px;
        align-items: flex-start;
      }
      .dashboard-page {
        min-height: 100vh;
      }
      .google-dashboard {
        flex-direction: column;
        margin-top: 54px;
      }
    }
  `;

  return (
    <>
      <style>{attendanceResponsiveStyles}</style>
      <div className="dashboard-page">
             {/* Top Navbar */}
             <nav className="top-navbar">
               <h2>Gojo Dashboard</h2>
             
               <div className="nav-right">
                  <div className="icon-circle">
                                     <div
                                       onClick={() => setShowNotifications(!showNotifications)}
                                       style={{ cursor: "pointer", position: "relative" }}
                                     >
                                       <FaBell size={24} />
                                       {notifications.length > 0 && (
                                         <span style={{
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
                                         }}>{notifications.length}</span>
                                       )}
                                     </div>
                         
                                     {showNotifications && (
                                       <div style={{
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
                                       }}>
                                         {notifications.length > 0 ? (
                                           notifications.map((post, index) => (
                                             <div
                                               key={post.id || index}
                                               onClick={() => {
                                                 navigate("/dashboard");
                                                 setTimeout(() => {
                                                   const postElement = postRefs.current[post.id];
                                                   if (postElement) {
                                                     postElement.scrollIntoView({ behavior: "smooth", block: "center" });
                                                     setHighlightedPostId(post.id);
                                                     setTimeout(() => setHighlightedPostId(null), 3000);
                                                   }
                                                 }, 150);
                                                 // remove after click
                                                 setNotifications(prev => prev.filter((_, i) => i !== index));
                                                 setShowNotifications(false);
                                               }}
                                               style={{
                                                 display: "flex",
                                                 alignItems: "center",
                                                 padding: "10px 15px",
                                                 borderBottom: "1px solid #eee",
                                                 cursor: "pointer",
                                               }}
                                             >
                                               <img src={post.adminProfile} alt={post.adminName} style={{ width: 35, height: 35, borderRadius: "50%", marginRight: 10 }} />
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
                {/* Messenger */}
          <div className="icon-circle" style={{ position: "relative", marginLeft: 12 }}>
            <div onClick={handleMessengerToggle} style={{ cursor: "pointer", position: "relative" }}>
              <FaFacebookMessenger size={22} />
              {totalUnreadMessages > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, background: "#0b78f6", color: "#fff", borderRadius: "50%", minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px", fontSize: 12 }}>
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
                   <Link
                     className="sidebar-btn"
                     to="/dashboard"
                   
                   >
                     <FaHome /> Home
                   </Link>
                   
                   <Link className="sidebar-btn" to="/students"   >
                     <FaUsers /> Students
                   </Link>
                   <Link className="sidebar-btn" to="/admins">
                     <FaUsers /> Admins
                   </Link>
                   <Link
                     className="sidebar-btn"
                     to="/parents"
                     
                   >
                     <FaChalkboardTeacher /> Parents
                   </Link>
                   <Link className="sidebar-btn" to="/marks">
                     <FaClipboardCheck /> Marks
                   </Link>
                   <Link className="sidebar-btn" to="/attendance" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}>
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
       {/* MAIN CONTENT */}
<div
  style={{
    flex: 1,
    display: "flex",
    justifyContent: "flex-start",
    padding: "20px 24px",
    background: "#f0f4f8"
  }}
>
  <div className="attendance-main-content-responsive">
    <h2 style={{ textAlign: "center", marginBottom: "25px", color: "#333" }}>Attendance</h2>

    {/* Course Selection */}
    <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "15px" }}>
      <label style={{ fontWeight: "500", color: "#555" }}>Select Course:</label>
      <select
        value={selectedCourse?.id || ""}
        onChange={e => {
          const course = courses.find(c => c.id === e.target.value);
          setSelectedCourse(course || null);
        }}
        style={{
          padding: "8px 12px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          outline: "none",
          background: "#f9f9f9",
          minWidth: "200px",
          fontWeight: "500"
        }}
      >
        <option value="">-- Select Course --</option>
        {courses.map(c => (
          <option key={c.id} value={c.id}>
            {c.name} - Grade {c.grade} Section {c.section}
          </option>
        ))}
      </select>
    </div>

    {/* Date Selection */}
    <div style={{ marginBottom: "25px", display: "flex", alignItems: "center", gap: "15px" }}>
      <label style={{ fontWeight: "500", color: "#555" }}>Date:</label>
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        style={{
          padding: "8px 12px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          outline: "none",
          background: "#f9f9f9"
        }}
      />
    </div>

    {/* Attendance Table */}
    {loading ? (
      <p>Loading students...</p>
    ) : error ? (
      <p style={{ color: "red" }}>{error}</p>
    ) : (
      <table style={{ width: "100%", borderCollapse: "collapse", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}>
        <thead>
          <tr style={{ background: "#4b6cb7", color: "#fff", textAlign: "left" }}>
            <th style={{ padding: "12px" }}>Student</th>
            <th style={{ padding: "12px", textAlign: "center" }}>Present</th>
            <th style={{ padding: "12px", textAlign: "center" }}>Absent</th>
            <th style={{ padding: "12px", textAlign: "center" }}>Late</th>
          </tr>
        </thead>
        <tbody>
          {students.map(s => (
            <tr key={s.studentId} style={{ borderBottom: "1px solid #eee", transition: "background 0.3s" }} 
                onMouseEnter={e => e.currentTarget.style.background = "#f9f9f9"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <td style={{ padding: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", overflow: "hidden", border: "2px solid #4b6cb7" }}>
                  <img src={s.profileImage || "/default-profile.png"} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <span style={{ fontWeight: "500", color: "#333" }}>{s.name}</span>
              </td>

              {/* Present */}
              <td style={{ padding: "10px", textAlign: "center" }}>
                <button
                  style={{
                    background: attendance[s.studentId] === "present" ? "#28a745" : "#e0e0e0",
                    color: attendance[s.studentId] === "present" ? "#fff" : "#333",
                    padding: "6px 12px",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "0.2s"
                  }}
                  onClick={() => handleMark(s.studentId, "present")}
                >
                  Present
                </button>
              </td>

              {/* Absent */}
              <td style={{ padding: "10px", textAlign: "center" }}>
                <button
                  style={{
                    background: attendance[s.studentId] === "absent" ? "#dc3545" : "#e0e0e0",
                    color: attendance[s.studentId] === "absent" ? "#fff" : "#333",
                    padding: "6px 12px",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "0.2s"
                  }}
                  onClick={() => handleMark(s.studentId, "absent")}
                >
                  Absent
                </button>
              </td>

              {/* Late */}
              {/* Late */}
<td style={{ padding: "10px", textAlign: "center" }}>
  <button
    style={{
      background: attendance[s.studentId] === "late" ? "#ffc107" : "#e0e0e0",
      color: attendance[s.studentId] === "late" ? "#fff" : "#333",
      padding: "6px 12px",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      transition: "0.2s"
    }}
    onClick={() => handleMark(s.studentId, "late")}
  >
    Late
  </button>
</td>

            </tr>
          ))}
        </tbody>
      </table>
    )}

    <div style={{ textAlign: "center" }}>
      <button
        style={{
          marginTop: "25px",
          padding: "12px 25px",
          borderRadius: "10px",
          background: "#4b6cb7",
          color: "#fff",
          fontWeight: "600",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
          transition: "0.3s"
        }}
        onClick={handleSave}
        onMouseEnter={e => e.currentTarget.style.background = "#3a539b"}
        onMouseLeave={e => e.currentTarget.style.background = "#4b6cb7"}
      >
        Save Attendance
      </button>
    </div>
  </div>
</div>

      </div>
    </div>
    </>
  );
}

export default AttendancePage;
