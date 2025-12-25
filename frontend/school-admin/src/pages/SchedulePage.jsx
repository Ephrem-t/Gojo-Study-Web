import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaCalendarAlt,
  FaHome,
  FaSave,
  FaMagic,
  FaSignOutAlt,
  FaBell,
  FaCog,
  FaSearch,
  FaFacebookMessenger,
  FaChalkboardTeacher,
  FaFileAlt
} from "react-icons/fa";
import { ref, get, set } from "firebase/database";
import { db } from "../firebase";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

/* ================= CONSTANTS ================= */
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = [
  "P1 (2:00–2:45)",
  "P2 (2:45–3:30)",
  "P3 (3:30–4:15)",
  "P4 (4:15–5:00)",
  "P5 (5:00–5:45)",
  "LUNCH",
  "P6 (7:15–8:00)",
  "P7 (8:00–8:45)",
  "P8 (8:45–9:30)"
];

export default function SchedulePage() {
  const admin = JSON.parse(localStorage.getItem("admin")) || {};

  /* ================= STATE ================= */
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState({});
  const [teacherMap, setTeacherMap] = useState({});
  const [courseTeacherMap, setCourseTeacherMap] = useState({});
  const [schedule, setSchedule] = useState({});
  const [weeklyFrequency, setWeeklyFrequency] = useState({});
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [teacherWorkload, setTeacherWorkload] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [selectedTeacherInfo, setSelectedTeacherInfo] = useState(null);
  const [selectedTeacherDetails, setSelectedTeacherDetails] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
// { day, period, subject, teacherId }

const [teachers, setTeachers] = useState([]);
const [unreadTeachers, setUnreadTeachers] = useState({});
const [popupMessages, setPopupMessages] = useState([]);
const [showMessageDropdown, setShowMessageDropdown] = useState(false);
const [selectedTeacher, setSelectedTeacher] = useState(null);
const [teacherChatOpen, setTeacherChatOpen] = useState(false);


const adminUserId = admin.userId;



  /* ================= FETCH DATABASE ================= */
  const fetchAll = async () => {
    try {
      const usersSnap = await get(ref(db, "Users"));
      const users = usersSnap.exists() ? usersSnap.val() : {};

      const teachersSnap = await get(ref(db, "Teachers"));
      const teachers = teachersSnap.exists() ? teachersSnap.val() : {};
      const tMap = {};
      Object.entries(teachers).forEach(([tid, t]) => {
        if (users[t.userId]) tMap[tid] = users[t.userId].name;
      });

      const coursesSnap = await get(ref(db, "Courses"));
      const coursesData = coursesSnap.exists() ? coursesSnap.val() : {};
      const courseArr = Object.entries(coursesData).map(([id, c]) => ({ id, ...c }));

      const classMap = {};
      courseArr.forEach(c => {
        if (!classMap[c.grade]) classMap[c.grade] = new Set();
        classMap[c.grade].add(c.section);
      });

      const assignsSnap = await get(ref(db, "TeacherAssignments"));
      const assigns = assignsSnap.exists() ? assignsSnap.val() : {};
      const ctMap = {};
      if (assigns && typeof assigns === "object") {
        Object.values(assigns).forEach(a => {
          ctMap[a.courseId] = a.teacherId;
        });
      }

      const schSnap = await get(ref(db, "Schedules"));
      if (schSnap.exists()) setSchedule(schSnap.val());

      setCourses(courseArr);
      setClasses(classMap);
      setTeacherMap(tMap);
      setCourseTeacherMap(ctMap);
      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setLoading(false);
    }
  };

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
        const chatKey = `${adminUserId}_${t.userId}`;
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


  useEffect(() => {
    fetchAll();
  }, []);

  const selectedClassKey =
    selectedGrade && selectedSection ? `Grade ${selectedGrade}${selectedSection}` : null;

  const filteredCourses = courses.filter(
    c => c.grade === selectedGrade && c.section === selectedSection
  );

const getTeachersForCourse = (courseId) => {
  const tid = courseTeacherMap[courseId];
  if (!tid) return [];
  return [{ id: tid, name: teacherMap[tid] }];
};








/* ================= AUTO GENERATE RANDOMLY ================= */
/* ================= AUTO GENERATE RANDOMLY ================= */
const autoGenerate = () => {
  if (!selectedClassKey) return alert("Select grade & section first");

  const data = structuredClone(schedule || {});
  const classCourses = filteredCourses;

  if (!classCourses.length) return alert("No courses available for this class");

  DAYS.forEach(day => {
    if (!data[day]) data[day] = {};
    data[day][selectedClassKey] = {};

    let previousTeacherId = null; // track teacher of previous period

    PERIODS.forEach(p => {
      if (p === "LUNCH") {
        data[day][selectedClassKey][p] = { break: true };
        previousTeacherId = null; // reset after lunch
        return;
      }

      // Filter courses so we don't assign same teacher as previous period
      const availableCourses = classCourses.filter(c => {
        const tid = courseTeacherMap[c.id] || null;
        return tid !== previousTeacherId;
      });

      // If no course avoids repetition, allow all (to avoid deadlock)
      const possibleCourses = availableCourses.length ? availableCourses : classCourses;

      // Pick a random course
      const randomCourse = possibleCourses[Math.floor(Math.random() * possibleCourses.length)];
      const tid = courseTeacherMap[randomCourse.id] || null;
      const tname = teacherMap[tid] || "Unassigned";

      // Assign course to schedule
      data[day][selectedClassKey][p] = {
        subject: randomCourse.subject,
        teacherId: tid,
        teacherName: tname
      };

      previousTeacherId = tid; // update previous teacher
    });
  });

  setSchedule(data);
  calculateTeacherWorkload(data);
};



 const editCell = (day, period) => {
  const cell = schedule?.[day]?.[selectedClassKey]?.[period];
  if (!cell || cell.break) return;

  const course = filteredCourses.find(c => c.subject === cell.subject);

  setEditTarget({
    day,
    period,
    subject: course?.id || "",
    teacherId: cell.teacherId || ""
  });
};

const saveEdit = () => {
  const { day, period, subject, teacherId } = editTarget;
  const course = courses.find(c => c.id === subject);

  const updated = structuredClone(schedule);
  updated[day][selectedClassKey][period] = {
    subject: course.subject,
    teacherId,
    teacherName: teacherMap[teacherId] || "Unassigned"
  };

  setSchedule(updated);
  setEditTarget(null);
  calculateTeacherWorkload(updated);
};

const cancelEdit = () => setEditTarget(null);



  /* ================= TEACHER WORKLOAD ================= */
  const calculateTeacherWorkload = (sched) => {
    const workload = {};
    DAYS.forEach(day => {
      PERIODS.forEach(p => {
        if (p === "LUNCH") return;
        const item = sched[day]?.[selectedClassKey]?.[p];
        if (item?.teacherName) {
          workload[item.teacherName] = (workload[item.teacherName] || 0) + 1;
        }
      });
    });
    const data = Object.entries(workload).map(([name, count]) => ({ name, classes: count }));
    setTeacherWorkload(data);
  };

  const onDragEnd = res => {
    if (!res.destination) return;
    const day = res.source.droppableId;
    const src = res.source.index;
    const dst = res.destination.index;
    const active = PERIODS.filter(p => p !== "LUNCH");
    const p1 = active[src];
    const p2 = active[dst];
    const updated = structuredClone(schedule);
    [updated[day][selectedClassKey][p1], updated[day][selectedClassKey][p2]] =
      [updated[day][selectedClassKey][p2], updated[day][selectedClassKey][p1]];
    setSchedule(updated);
    calculateTeacherWorkload(updated);
  };

  const saveSchedule = async () => {
    await set(ref(db, "Schedules"), schedule);
    alert("Schedule saved successfully");
  };

  

  /* ================= STYLES ================= */
 const styles = {
  page: { display: "flex", minHeight: "100vh", fontFamily: "Poppins, sans-serif", background: "#f0f4f8" },
  
  topNav: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    background: "#4b6cb7",
    color: "#fff",
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 30px",
    zIndex: 1000
  },
  navRight: { display: "flex", alignItems: "center", gap: 20 },

  sidebar: {
    position: "fixed",
    top: 70,
    left: 0,
    bottom: 0,
    width: 300,
    background: "#fff",
    boxShadow: "4px 0 25px rgba(0,0,0,0.1)",
    padding: 20,
    overflowY: "auto"
  },

  main: {
    marginTop: 70,
    marginLeft: 320,
    flex: 1,
    padding: 24,
    overflowY: "auto",
    minHeight: "calc(100vh - 70px)"
  },

  navBtn: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "12px 16px",
    margin: "10px 0",
    borderRadius: 12,
    background: "#eef2ff",
    color: "#111",
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "none",
    transition: "0.3s",
  },
  navBtnHover: {
    background: "#4b6cb7",
    color: "#fff",
  },

  selectorCard: {
    display: "flex",
    gap: 20,
    padding: 24,
    borderRadius: 20,
    background: "linear-gradient(135deg,#667eea,#764ba2)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    color: "#fff",
    fontWeight: 600
  },
  select: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "none",
    minWidth: 180,
    fontSize: 15,
    fontWeight: 600,
    outline: "none",
    cursor: "pointer"
  },

  card: {
    background: "#fff",
    padding: 22,
    borderRadius: 20,
    marginTop: 22,
    boxShadow: "0 12px 25px rgba(0,0,0,0.12)",
    transition: "0.3s",
  },
  cardHover: {
    transform: "translateY(-4px)",
    boxShadow: "0 16px 30px rgba(0,0,0,0.15)",
  },

  freqGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
    gap: 16
  },
  freqItem: {
    background: "linear-gradient(135deg,#eef2ff,#e0e7ff)",
    padding: 16,
    borderRadius: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: 500,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    transition: "0.3s",
  },
  freqItemHover: {
    transform: "translateY(-3px)",
    boxShadow: "0 8px 18px rgba(0,0,0,0.12)"
  },

  btnRow: { display: "flex", gap: 12, margin: "20px 0" },
  greenBtn: {
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
    color: "#fff",
    padding: "12px 22px",
    borderRadius: 14,
    border: "none",
    fontWeight: 600,
    cursor: "pointer",
    transition: "0.3s",
  },
  blueBtn: {
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    color: "#fff",
    padding: "12px 22px",
    borderRadius: 14,
    border: "none",
    fontWeight: 600,
    cursor: "pointer",
    transition: "0.3s",
  },

  period: {
    background: "#f0f4f8",
    padding: 18,
    borderRadius: 16,
    minWidth: 160,
    textAlign: "center",
    fontWeight: 600,
    boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
    transition: "0.3s",
  },
  periodHover: {
    background: "#dbeafe",
    transform: "translateY(-2px)",
    boxShadow: "0 8px 18px rgba(0,0,0,0.1)",
  },

  lunch: {
    background: "#fde68a",
    padding: 18,
    borderRadius: 16,
    fontWeight: "bold",
    textAlign: "center",
    boxShadow: "0 4px 10px rgba(0,0,0,0.08)"
  }
};


  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
{/* TOP NAVBAR */}
<div className="top-navbar">
  <h2>Gojo Dashboard</h2>
  <div className="nav-search">
    <input type="text" placeholder="Search..." />
    <FaSearch className="search-icon" />
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
</div>

<div className="google-sidebar">
  {/* PROFILE */}
  <div className="sidebar-profile">
    <div className="sidebar-img-circle">
      <img
        src={admin?.profileImage || "/default-profile.png"}
        alt="profile"
      />
    </div>
    <h3>{admin?.name || "Admin Name"}</h3>
    <p>Admin</p>
  </div>

  {/* MENU */}
  <div className="sidebar-menu">
                                         <Link className="sidebar-btn" to="/dashboard"
                                          
                                          > <FaHome style={{ width: "28px", height:"28px" }}/> Home</Link>
                                           <Link className="sidebar-btn" to="/my-posts"><FaFileAlt /> My Posts</Link>
                                           <Link className="sidebar-btn" to="/teachers" ><FaChalkboardTeacher /> Teachers</Link>
                                             <Link className="sidebar-btn" to="/students" > <FaChalkboardTeacher /> Students</Link>
                                              <Link
                                                           className="sidebar-btn"
                                                           to="/schedule"
                                                           style={{ backgroundColor: "#4b6cb7", color: "#fff" }}
                                                         >
                                                           <FaCalendarAlt /> Schedule
                                                         </Link>
                                              <Link className="sidebar-btn" to="/parents"><FaChalkboardTeacher /> Parents
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


 

 

        {/* MAIN */}
        <div style={styles.main}>
          {/* SELECTOR */}
          <div style={styles.selectorCard}>
            <select style={styles.select} value={selectedGrade} onChange={e => { setSelectedGrade(e.target.value); setSelectedSection(""); }}>
              <option value="">🎓 Select Grade</option>
              {Object.keys(classes).map(g => <option key={g}>{g}</option>)}
            </select>
            <select style={styles.select} value={selectedSection} onChange={e => setSelectedSection(e.target.value)} disabled={!selectedGrade}>
              <option value="">📘 Select Section</option>
              {[...(classes[selectedGrade] || [])].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* SUBJECT FREQUENCY */}
          {selectedClassKey && (
            <div style={styles.card}>
              <h3>📚 {selectedClassKey} – Weekly Subjects</h3>
              <div style={styles.freqGrid}>
                {filteredCourses.map(course => (
                  <div key={course.id} style={styles.freqItem}>
                    <span>{course.subject}</span>
                    <select
                      value={weeklyFrequency[selectedClassKey]?.[course.id] || 0}
                      onChange={e => setWeeklyFrequency(prev => ({
                        ...prev,
                        [selectedClassKey]: { ...prev[selectedClassKey], [course.id]: Number(e.target.value) }
                      }))}
                    >
                      {[...Array(9)].map((_, i) => <option key={i}>{i}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIONS */}
          {selectedClassKey && (
            <>
              <div style={styles.btnRow}>
                <button style={styles.greenBtn} onClick={autoGenerate}><FaMagic /> Auto Generate</button>
                <button style={styles.blueBtn} onClick={saveSchedule}><FaSave /> Save</button>
              </div>

              <DragDropContext onDragEnd={onDragEnd}>
                {DAYS.map(day => (
                  <div key={day} style={styles.card}>
                    <h2>{day}</h2>
                    <Droppable droppableId={day} direction="horizontal">
                      {prov => (
                        <div ref={prov.innerRef} {...prov.droppableProps} style={{ display: "flex", gap: 12, overflowX: "auto" }}>
                          {PERIODS.filter(p => p !== "LUNCH").map((p, i) => {
                            const d = schedule[day]?.[selectedClassKey]?.[p];
                            return (
                              <Draggable draggableId={`${day}-${p}`} index={i} key={p}>
                                {prov => (
                                  <div
  ref={prov.innerRef}
  {...prov.draggableProps}
  {...prov.dragHandleProps}
  onDoubleClick={() => editCell(day, p)}
  style={{
    ...styles.period,
    cursor: "pointer",
    ...prov.draggableProps.style
  }}
>

                                    <b>{p}</b>

{editTarget &&
 editTarget.day === day &&
 editTarget.period === p ? (
  <>
    <select
      value={editTarget.subject}
      onChange={e =>
        setEditTarget(prev => ({
          ...prev,
          subject: e.target.value,
          teacherId: courseTeacherMap[e.target.value] || ""
        }))
      }
      style={{ width: "100%", marginTop: 6 }}
    >
      <option value="">Select Subject</option>
      {filteredCourses.map(c => (
        <option key={c.id} value={c.id}>{c.subject}</option>
      ))}
    </select>

    <select
      value={editTarget.teacherId}
      onChange={e =>
        setEditTarget(prev => ({ ...prev, teacherId: e.target.value }))
      }
      style={{ width: "100%", marginTop: 6 }}
    >
      <option value="">Select Teacher</option>
      {getTeachersForCourse(editTarget.subject).map(t => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>

    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
      <button onClick={saveEdit} style={{ flex: 1 }}>✔</button>
      <button onClick={cancelEdit} style={{ flex: 1 }}>✖</button>
    </div>
  </>
) : (
  <>
    <div>{d?.subject}</div>
    <div style={{ color: "#2563eb" }}>{d?.teacherName}</div>
    <small style={{ fontSize: 11, opacity: 0.6 }}>
      Double-click to edit
    </small>
  </>
)}

                                    
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {prov.placeholder}
                          <div style={styles.lunch}>🍽 Lunch</div>
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
              </DragDropContext>
            </>
          )}
        </div>

        

      </div>
  
  );
}
