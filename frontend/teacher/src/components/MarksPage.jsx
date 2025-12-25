import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { FaHome, FaCog, FaSignOutAlt, FaSave, FaBell, FaSearch, FaClipboardCheck, FaUsers } from "react-icons/fa";
import "../styles/global.css";

// ---------------- GRADE CALCULATION ----------------
const calculateGrade = (total) => {
  if (total >= 90) return "A";
  if (total >= 80) return "B";
  if (total >= 70) return "C";
  if (total >= 60) return "D";
  return "F";
};

function MarksPage() {
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [marks, setMarks] = useState({});
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [sections, setSections] = useState([]);
  
  const [studentTab, setStudentTab] = useState("performance");
  const [studentChatOpen, setStudentChatOpen] = useState(false);
  const [popupMessages, setPopupMessages] = useState([]);
  const [popupInput, setPopupInput] = useState("");
  
  const [attendanceData, setAttendanceData] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  
  const [attendanceFilter, setAttendanceFilter] = useState("daily");
  const [assignmentsData, setAssignmentsData] = useState({});
  const [teachersData, setTeachersData] = useState({});
  const [usersData, setUsersData] = useState({});
  const [studentMarks, setStudentMarks] = useState({});
  const [teacherNotes, setTeacherNotes] = useState([]);
  const [newTeacherNote, setNewTeacherNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const teacherUserId = teacherInfo?.userId;
  

  // ---------------- LOAD LOGGED-IN TEACHER ----------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacherInfo(storedTeacher);
  }, [navigate]);

  // ---------------- FETCH STUDENTS AND COURSES ----------------
  useEffect(() => {
    if (!teacherInfo) return; // wait until teacher info is loaded

    async function fetchData() {
      try {
        const [
          studentsData,
          usersData,
          coursesData,
          teacherAssignmentsData,
          teachersData,
        ] = await Promise.all([
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Courses.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"),
        ]);

        // Find teacher key
        const teacherEntry = Object.entries(teachersData.data || {}).find(
          ([_, t]) => t.userId === teacherUserId
        );
        if (!teacherEntry) return;
        const teacherKey = teacherEntry[0];

        // Get courses assigned to this teacher
        const assignedCourseIds = Object.values(teacherAssignmentsData.data || {})
          .filter((a) => a.teacherId === teacherKey)
          .map((a) => a.courseId);

        const teacherCourses = assignedCourseIds.map((id) => ({
          id,
          ...coursesData.data[id],
        }));
        setCourses(teacherCourses);

        // Filter students by teacher's grade & section from courses
        const filteredStudents = Object.values(studentsData.data || {}).filter((s) =>
          teacherCourses.some(
            (c) => c.grade === s.grade && c.section === s.section
          )
        ).map((s) => {
          const user = Object.values(usersData.data || {}).find((u) => u.userId === s.userId);
          return {
            ...s,
            name: user?.name || "Unknown",
            username: user?.username || "Unknown",
            profileImage: user?.profileImage || "/default-profile.png",
          };
        });

        setStudents(filteredStudents);
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    }

    fetchData();
  }, [teacherInfo, teacherUserId]);
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

  // ---------------- FETCH EXISTING MARKS ----------------
  useEffect(() => {
    if (!selectedCourseId) return;

    async function fetchMarks() {
      try {
        const res = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/ClassMarks/${selectedCourseId}.json`
        );
        setMarks(res.data || {});
      } catch (err) {
        console.error(err);
        setMarks({});
      }
    }

    fetchMarks();
  }, [selectedCourseId]);

  // ---------------- HANDLE MARK CHANGE ----------------
  const handleMarkChange = (studentId, field, value) => {
    setMarks((prev) => {
      const updated = { ...prev[studentId], [field]: Number(value) };
      const total = (updated.mark20 || 0) + (updated.mark30 || 0) + (updated.mark50 || 0);
      const grade = calculateGrade(total);
      return { ...prev, [studentId]: { ...updated, total, grade } };
    });
  };

  // ---------------- SUBMIT MARKS ----------------
  const submitMarks = async (student) => {
    const data = marks[student.userId];
    if (!data) {
      alert("Please enter marks first");
      return;
    }
    try {
      await axios.put(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/ClassMarks/${selectedCourseId}/${student.userId}.json`,
        { ...data, teacherId: teacherUserId, updatedAt: new Date().toISOString() }
      );
      alert(`Marks saved for ${student.name}`);
    } catch (err) {
      console.error(err);
      alert("Failed to save marks");
    }
  };

  const filteredStudentsByCourse = students.filter((s) => {
    const course = courses.find((c) => c.id === selectedCourseId);
    if (!course) return false;
    return s.grade === course.grade && s.section === course.section;
  });

  if (!teacherInfo) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* TOP NAVBAR */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "60px", background: "#fff", display: "flex", alignItems: "center", padding: "0 30px", borderBottom: "1px solid #eee", zIndex: 1000 }}>
        <h2>Student Marks</h2>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "15px" }}>
          <FaSearch style={{ cursor: "pointer" }} />
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", overflow: "hidden" }}>
            <img src={teacherInfo.profileImage} alt="teacher" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
          </div>
        </div>
      </div>

      {/* LEFT SIDEBAR */}
      <div style={{ width: "300px", marginTop: "60px", position: "fixed", top: 0, left: 0, height: "100vh", background: "#fff", padding: "20px", borderRight: "1px solid #eee" }}>
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
                    
                    <Link className="sidebar-btn" to="/students"><FaUsers /> Students</Link>
                      <Link className="sidebar-btn" to="/admins" ><FaUsers /> Admins</Link>
                    <Link
                             className="sidebar-btn"
                             to="/marks" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}
                             
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
      <div style={{ marginLeft: "300px", marginRight: "250px", paddingTop: "80px", display: "flex", justifyContent: "center", width: "100%" }}>
        <div style={{ width: "900px" }}>
          {/* COURSE SELECT */}
          <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} style={{ padding: "10px", borderRadius: "10px", marginBottom: "20px", border: "1px solid #ddd", width: "100%" }}>
            <option value="">Select Course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.subject} — Grade {c.grade}{c.section}</option>)}
          </select>

          {/* MARKS TABLE */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "25px", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
            <h3 style={{ marginBottom: "20px" }}>Student Marks</h3>
            <table width="100%" style={{ borderCollapse: "collapse", textAlign: "center" }}>
              <thead>
                <tr style={{ background: "#f4f6ff" }}>
                  <th style={thStyle}>Student</th>
                  <th style={thStyle}>20%</th>
                  <th style={thStyle}>30%</th>
                  <th style={thStyle}>50%</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Grade</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudentsByCourse.map(s => {
                  const grade = marks[s.userId]?.grade;
                  const gradeColor = grade === "A" || grade === "B" ? "#22c55e" : grade === "C" ? "#facc15" : grade ? "#ef4444" : "#999";
                  return (
                    <tr key={s.userId} style={{ borderBottom: "1px solid #eee", cursor: "pointer" }} onClick={() => setSelectedStudent(s)}>
                  <td style={{ ...tdStyle, display: "flex", alignItems: "center", gap: "10px" }}>
  <div
    style={{
      width: "35px",
      height: "35px",
      borderRadius: "50%",
      border: "2px solid #e61d03", // red border
      overflow: "hidden"
    }}
  >
    <img
      src={s.profileImage || "/default-profile.png"}
      alt={s.name}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  </div>
  <span>{s.name}</span>
</td>


                      <td style={tdStyle}><input type="number" min="0" max="20" value={marks[s.userId]?.mark20 || ""} onChange={e => handleMarkChange(s.userId, "mark20", e.target.value)} style={inputStyle} /></td>
                      <td style={tdStyle}><input type="number" min="0" max="30" value={marks[s.userId]?.mark30 || ""} onChange={e => handleMarkChange(s.userId, "mark30", e.target.value)} style={inputStyle} /></td>
                      <td style={tdStyle}><input type="number" min="0" max="50" value={marks[s.userId]?.mark50 || ""} onChange={e => handleMarkChange(s.userId, "mark50", e.target.value)} style={inputStyle} /></td>
                      <td style={{ ...tdStyle, fontWeight: "bold" }}>{marks[s.userId]?.total || 0}</td>
                      <td style={{ ...tdStyle, fontWeight: "bold", color: gradeColor }}>{grade || "-"}</td>
                      <td style={tdStyle}><button onClick={() => submitMarks(s)} style={submitBtnStyle}><FaSave /> Submit</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      {/* RIGHT SIDEBAR */}
{/* RIGHT SIDEBAR */}
{/* RIGHT SIDEBAR */}
<div
  style={{
    width: "450px",
    position: "fixed",
    right: 0,
    top: 60,
    bottom: 0,
    background: "#fff",
    borderLeft: "1px solid #eee",
    padding: "20px",
    overflowY: "auto",
  }}
>
  <h3 style={{ marginBottom: "15px", fontSize: "18px", fontWeight: "600", color: "#333" }}>Student Info</h3>
  
  {selectedStudent ? (
    <>
      {/* PROFILE CARD */}
      <div
        style={{
          background: "#f9fafb",
          borderRadius: "15px",
          padding: "20px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.05)",
          textAlign: "center",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            width: "100px",
            height: "100px",
            margin: "0 auto 15px",
            borderRadius: "50%",
            overflow: "hidden",
            border: "3px solid #4b6cb7",
          }}
        >
          <img
            src={selectedStudent.profileImage || "/default-profile.png"}
            alt={selectedStudent.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        <h4 style={{ margin: "5px 0", fontSize: "16px", fontWeight: "600", color: "#111" }}>
          {selectedStudent.name}
        </h4>
        <p style={{ margin: "3px 0", fontSize: "14px", color: "#555" }}>
          <strong>Username:</strong> {selectedStudent.username}
        </p>
        <p style={{ margin: "3px 0", fontSize: "14px", color: "#555" }}>
          <strong>Grade:</strong> {selectedStudent.grade}
        </p>
        <p style={{ margin: "3px 0", fontSize: "14px", color: "#555" }}>
          <strong>Section:</strong> {selectedStudent.section}
        </p>
        {selectedStudent.age && (
          <p style={{ margin: "3px 0", fontSize: "14px", color: "#555" }}>
            <strong>Age:</strong> {selectedStudent.age}
          </p>
        )}
        {selectedStudent.parent && (
          <p style={{ margin: "3px 0", fontSize: "14px", color: "#555" }}>
            <strong>Parent:</strong> {selectedStudent.parent}
          </p>
        )}
      </div>


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
   


        </div>
      )}
    </>
  ) : (
    <p style={{ color: "#888", textAlign: "center", marginTop: "50px" }}>
      Select a student to see info
    </p>
  )}
</div>


    </div>
  );
}

/* ---------------- STYLES ---------------- */
const thStyle = { padding: "14px", fontSize: "14px", fontWeight: "600", color: "#555" };
const tdStyle = { padding: "12px", fontSize: "14px" };
const inputStyle = { width: "70px", padding: "6px", borderRadius: "8px", border: "1px solid #ddd", textAlign: "center", outline: "none" };
const submitBtnStyle = { background: "#4b6cb7", color: "#fff", border: "none", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" };

export default MarksPage;
