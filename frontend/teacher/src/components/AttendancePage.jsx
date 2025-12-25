import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { 
  FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, 
  FaSignOutAlt, FaBell, FaUsers, FaClipboardCheck, FaSearch 
} from "react-icons/fa";
import "../styles/global.css";

function AttendancePage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [sections, setSections] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courses, setCourses] = useState([]);
  const navigate = useNavigate();

  const teacherUserId = teacherInfo?.userId;

  // ---------------- LOAD TEACHER INFO ----------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacherInfo(storedTeacher);
  }, [navigate]);

  // ---------------- FETCH COURSES ----------------
useEffect(() => {
  if (!teacherInfo) return;

  const fetchCourses = async () => {
    try {
      // Fetch assignments, courses, and teachers
      const [assignmentsRes, coursesRes, teachersRes] = await Promise.all([
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json"),
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Courses.json"),
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json")
      ]);

      const assignmentsData = assignmentsRes.data || {};
      const coursesData = coursesRes.data || {};
      const teachersData = teachersRes.data || {};

      // Find the Firebase key of the teacher
      const teacherEntry = Object.entries(teachersData)
        .find(([key, value]) => value.userId === teacherInfo.userId);

      if (!teacherEntry) {
        console.warn("Teacher not found in DB!");
        setCourses([]);
        setSelectedCourse(null);
        return;
      }

      const teacherKey = teacherEntry[0];

      // Get assignments for this teacher (matching teacherKey)
      const assigned = Object.values(assignmentsData).filter(
        a => a.teacherId === teacherKey
      );

      // Map assigned courses using Firebase keys
      const teacherCourses = Object.entries(coursesData)
        .filter(([courseKey, course]) => assigned.some(a => a.courseId === courseKey))
        .map(([courseKey, course]) => ({ id: courseKey, ...course }));

      console.log("Courses:", coursesData);
      console.log("Assigned to teacher:", assigned);
      console.log("Teacher Courses:", teacherCourses);

      setCourses(teacherCourses);
      setSelectedCourse(teacherCourses[0] || null);
    } catch (err) {
      console.error("Error fetching courses:", err);
    }
  };

  fetchCourses();
}, [teacherInfo]);



  // ---------------- FETCH STUDENTS ----------------
  useEffect(() => {
    const fetchStudents = async () => {
      if (!teacherUserId) return;

      try {
        setLoading(true);

        const [
          studentsDataRes,
          usersDataRes,
          coursesDataRes,
          teacherAssignmentsRes,
          teachersDataRes
        ] = await Promise.all([
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Courses.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json")
        ]);

        const studentsData = studentsDataRes.data || {};
        const usersData = usersDataRes.data || {};
        const coursesData = coursesDataRes.data || {};
        const teacherAssignmentsData = teacherAssignmentsRes.data || {};
        const teachersData = teachersDataRes.data || {};

        // Get teacher key
        const teacherEntry = Object.entries(teachersData)
          .find(([_, t]) => t.userId === teacherUserId);

        if (!teacherEntry) throw new Error("Teacher not found");
        const teacherKey = teacherEntry[0];

        // Get assigned courses keys
        const assignedCourses = Object.values(teacherAssignmentsData)
          .filter(a => a.teacherId === teacherKey)
          .map(a => a.courseId);

        // Filter students in assigned courses
        const filteredStudents = Object.values(studentsData)
          .filter(s => 
            assignedCourses.some(courseId => {
              const course = coursesData[courseId];
              return course && course.grade === s.grade && course.section === s.section;
            })
          )
          .map(s => {
            const user = Object.values(usersData).find(u => u.userId === s.userId);
            return {
              ...s,
              name: user?.name || "Unknown",
              profileImage: user?.profileImage || "/default-profile.png"
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
    };

    fetchStudents();
  }, [teacherUserId]);

  // ---------------- FETCH ATTENDANCE ----------------
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!selectedCourse) return;

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
      alert("Attendance saved!");
    } catch (err) {
      console.error("Error saving attendance:", err);
      alert("Failed to save attendance");
    }
  };

  // ---------------- FILTER GRADES & SECTIONS ----------------
  useEffect(() => {
    if (selectedGrade === "All") {
      setSections([]);
      setSelectedSection("All");
    } else {
      const gradeSections = [...new Set(students.filter(s => s.grade === selectedGrade).map(s => s.section))];
      setSections(gradeSections);
      setSelectedSection("All");
    }
  }, [selectedGrade, students]);

  const filteredStudents = students.filter(s => {
    if (selectedGrade !== "All" && s.grade !== selectedGrade) return false;
    if (selectedSection !== "All" && s.section !== selectedSection) return false;
    return true;
  });

  const grades = [...new Set(students.map(s => s.grade))].sort();

  // ---------------- RENDER ----------------
  return (
    <div className="dashboard-page">
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
             <Link className="sidebar-btn" to="/notes" ><FaClipboardCheck /> Notes</Link>
            <Link className="sidebar-btn" to="/students"><FaUsers /> Students</Link>
            <Link className="sidebar-btn" to="/admins"><FaUsers /> Admins</Link>
            <Link className="sidebar-btn" to="/marks"><FaClipboardCheck /> Marks</Link>
            <Link className="sidebar-btn" to="/attendance" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaUsers /> Attendance</Link>
            <Link className="sidebar-btn" to="/settings"><FaCog /> Settings</Link>
            <Link className="sidebar-btn" to="/logout"><FaSignOutAlt /> Logout</Link>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "30px"  }}>
          <div style={{ width: "80%", position: "relative", marginLeft: "500px" }}>
            <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Attendance</h2>

            {/* Course Selection */}
            <div style={{ marginBottom: "15px" }}>
              <label>
                Select Course:{" "}
                <select
                  value={selectedCourse?.id || ""}
                  onChange={e => {
                    const course = courses.find(c => c.id === e.target.value);
                    setSelectedCourse(course || null);
                  }}
                  style={{ padding: "6px 10px", borderRadius: "5px" }}
                >
                  <option value="">-- Select Course --</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} - Grade {c.grade} Section {c.section}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Grades & Sections */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "15px", flexWrap: "wrap" }}>
              <button onClick={() => setSelectedGrade("All")} style={{ padding: "8px 15px", borderRadius: "8px", background: selectedGrade === "All" ? "#4b6cb7" : "#ddd", color: selectedGrade === "All" ? "#fff" : "#000", border: "none" }}>All Grades</button>
              {grades.map(g => (
                <button key={g} onClick={() => setSelectedGrade(g)} style={{ padding: "8px 15px", borderRadius: "8px", background: selectedGrade === g ? "#4b6cb7" : "#ddd", color: selectedGrade === g ? "#fff" : "#000", border: "none" }}>Grade {g}</button>
              ))}
            </div>

            {selectedGrade !== "All" && sections.length > 0 && (
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
                <button onClick={() => setSelectedSection("All")} style={{ padding: "6px 12px", borderRadius: "8px", background: selectedSection === "All" ? "#4b6cb7" : "#ddd", color: selectedSection === "All" ? "#fff" : "#000", border: "none" }}>All Sections</button>
                {sections.map(sec => (
                  <button key={sec} onClick={() => setSelectedSection(sec)} style={{ padding: "6px 12px", borderRadius: "8px", background: selectedSection === sec ? "#4b6cb7" : "#ddd", color: selectedSection === sec ? "#fff" : "#000", border: "none" }}>Section {sec}</button>
                ))}
              </div>
            )}

            {/* Date Selection */}
            <div style={{ marginBottom: "15px" }}>
              <label>Date: <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            </div>

            {/* Attendance Table */}
            {loading ? <p>Loading students...</p> :
              error ? <p style={{ color: "red" }}>{error}</p> :
              <table style={{ width: "50%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f4f6ff" }}>
                    <th style={{ padding: "10px", border: "1px solid #ddd" }}>Student</th>
                    <th style={{ padding: "10px", border: "1px solid #ddd" }}>Present</th>
                    <th style={{ padding: "10px", border: "1px solid #ddd" }}>Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(s => (
                    <tr key={s.userId}>
              <td style={{ padding: "10px", border: "1px solid #ddd", display: "flex", alignItems: "center", gap: "10px" }}>
  <div
    style={{
      width: "35px",
      height: "35px",
      borderRadius: "50%",
      overflow: "hidden",
      border: "2px solid #e61d03" // added red border
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


                      <td style={{ padding: "10px", width: "100px", border: "1px solid #ddd" }}>
                        <button
                          style={{
                            background: attendance[s.userId] === "present" ? "green" : "#eee",
                            color: attendance[s.userId] === "present" ? "#fff" : "#000",
                            padding: "5px 10px",
                            border: "none",
                            borderRadius: "5px",
                          }}
                          onClick={() => handleMark(s.userId, "present")}
                        >
                          Present
                        </button>
                      </td>
                      <td style={{ padding: "10px", width: "100px", border: "1px solid #ddd" }}>
                        <button
                          style={{
                            background: attendance[s.userId] === "absent" ? "red" : "#eee",
                            color: attendance[s.userId] === "absent" ? "#fff" : "#000",
                            padding: "5px 10px",
                            border: "none",
                            borderRadius: "5px",
                          }}
                          onClick={() => handleMark(s.userId, "absent")}
                        >
                          Absent
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }

            <button
              style={{ marginTop: "20px", padding: "10px 20px", borderRadius: "8px", background: "#4b6cb7", color: "#fff", border: "none" }}
              onClick={handleSave}
            >
              Save Attendance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AttendancePage;
