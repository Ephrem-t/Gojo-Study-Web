import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
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
  const teacherId = "-Og0ocvOvNZCR_m2-DCX";
  const teacherUserId = "-Og0ocoJTv29t9XHH8_2";

  const [teacherProfile, setTeacherProfile] = useState(null);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [marks, setMarks] = useState({});
  const [selectedStudent, setSelectedStudent] = useState(null);

  // ---------------- FETCH TEACHER PROFILE ----------------
  useEffect(() => {
    async function fetchTeacher() {
      try {
        const usersRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json");
        const teacher = Object.values(usersRes.data || {}).find(u => u.userId === teacherUserId);
        if (teacher) {
          setTeacherProfile({
            name: teacher.name,
            username: teacher.username,
            profileImage: teacher.profileImage || "/default-profile.png"
          });
        }
      } catch (err) {
        console.error("Failed to fetch teacher profile", err);
      }
    }
    fetchTeacher();
  }, []);

  // ---------------- FETCH STUDENTS ----------------
  useEffect(() => {
    async function fetchStudents() {
      const studentsRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json");
      const usersRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json");

      const studentList = Object.entries(studentsRes.data || {}).map(([id, s]) => {
        const user = Object.values(usersRes.data || {}).find((u) => u.userId === s.userId);
        return {
          id,
          ...s,
          name: user?.name || "Unknown",
          username: user?.username || "Unknown",
        };
      });

      setStudents(studentList);
    }

    fetchStudents();
  }, []);

  // ---------------- FETCH TEACHER COURSES ----------------
  useEffect(() => {
    async function fetchCourses() {
      const assignmentsRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json");
      const assigned = Object.values(assignmentsRes.data || {}).filter(a => a.teacherId === teacherId);

      const coursesRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Courses.json");
      const teacherCourses = assigned.map(a => ({ id: a.courseId, ...coursesRes.data[a.courseId] }));
      setCourses(teacherCourses);
    }

    fetchCourses();
  }, []);

  // ---------------- FETCH EXISTING MARKS ----------------
  useEffect(() => {
    if (!selectedCourseId) return;

    async function fetchMarks() {
      try {
        const res = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/ClassMarks/${selectedCourseId}.json`
        );
        setMarks(res.data || {});
      } catch (error) {
        console.error("Failed to fetch marks:", error);
        setMarks({});
      }
    }

    fetchMarks();
  }, [selectedCourseId]);

  // ---------------- FILTER STUDENTS BY COURSE ----------------
  const filteredStudents = students.filter((s) => {
    if (!selectedCourseId) return false;
    const course = courses.find((c) => c.id === selectedCourseId);
    return s.grade === course?.grade && s.section === course?.section;
  });

  // ---------------- HANDLE MARK CHANGE ----------------
  const handleMarkChange = (studentId, field, value) => {
    setMarks((prev) => {
      const updated = { ...prev[studentId], [field]: Number(value) };
      const total = (updated.mark20 || 0) + (updated.mark30 || 0) + (updated.mark50 || 0);
      const grade = calculateGrade(total);
      return { ...prev, [studentId]: { ...updated, total, grade } };
    });
  };

  // ---------------- SUBMIT PER STUDENT ----------------
  const submitMarks = async (student) => {
    const data = marks[student.id];
    if (!data) {
      alert("Please enter marks first");
      return;
    }

    try {
      await axios.put(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/ClassMarks/${selectedCourseId}/${student.id}.json`,
        { ...data, teacherId, updatedAt: new Date().toISOString() }
      );
      alert(`Marks saved for ${student.name}`);
    } catch (err) {
      console.error(err);
      alert("Failed to save marks");
    }
  };

  if (!teacherProfile) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
       {/* ---------------- TOP NAVBAR ---------------- */}
      <div style={{ position: "fixed", top: 0, left: "0", right: 0, height: "60px", background: "#fff", display: "flex", alignItems: "center", padding: "0 30px", borderBottom: "1px solid #eee", zIndex: 1000 }}>
        <h2>Student Marks</h2>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "15px" }}>
          <FaSearch style={{ cursor: "pointer" }} />
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", overflow: "hidden" }}>
            <img src={teacherProfile.profileImage} alt="teacher" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", borderColor: "blue" }} />
          </div>
        </div>
      </div>
      {/* ---------------- LEFT SIDEBAR ---------------- */}
      <div style={{ width: "300px", marginTop: "50px", position: "fixed", top: 0, left: 0, height: "100vh", background: "#fff", padding: "20px", borderRight: "1px solid #eee" }}>
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "50%", overflow: "hidden", margin: "0 auto 10px" }}>
            <img src={teacherProfile.profileImage} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <h3>{teacherProfile.name}</h3>
          <p>@{teacherProfile.username}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Link className="sidebar-btn" to="/dashboard" ><FaHome /> Home</Link>
          <Link className="sidebar-btn" to="/students"><FaUsers />Students</Link>
          <Link className="sidebar-btn" to="/marks" style={{ background: "#4b6cb7", color: "#fff" }}><FaClipboardCheck />Marks</Link>
          <Link to="/attendance" className="sidebar-btn">
                                      <FaUsers /> Attendance
                                    </Link>
          <Link className="sidebar-btn" to="/settings"><FaCog /> Settings</Link>
          <Link className="sidebar-btn" to="/logout"><FaSignOutAlt /> Logout</Link>
        </div>
      </div>

      
      {/* ---------------- MAIN CONTENT ---------------- */}
      <div style={{ marginLeft: "600px", marginRight: "250px", paddingTop: "80px", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "700px" }}>
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
                {filteredStudents.map(s => {
                  const grade = marks[s.id]?.grade;
                  const gradeColor = grade === "A" || grade === "B" ? "#22c55e" : grade === "C" ? "#facc15" : grade ? "#ef4444" : "#999";
                  const isSelected = selectedStudent?.id === s.id;

                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid #eee", cursor: "pointer", background: isSelected ? "#e0e7ff" : "#fff" }} onClick={() => setSelectedStudent(s)}>
                      <td style={tdStyle}>{s.name}</td>
                      <td style={tdStyle}><input type="number" min="0" max="20" value={marks[s.id]?.mark20 || ""} onChange={e => handleMarkChange(s.id, "mark20", e.target.value)} style={inputStyle} /></td>
                      <td style={tdStyle}><input type="number" min="0" max="30" value={marks[s.id]?.mark30 || ""} onChange={e => handleMarkChange(s.id, "mark30", e.target.value)} style={inputStyle} /></td>
                      <td style={tdStyle}><input type="number" min="0" max="50" value={marks[s.id]?.mark50 || ""} onChange={e => handleMarkChange(s.id, "mark50", e.target.value)} style={inputStyle} /></td>
                      <td style={{ ...tdStyle, fontWeight: "bold" }}>{marks[s.id]?.total || 0}</td>
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

      {/* ---------------- RIGHT SIDEBAR ---------------- */}
      <div style={{ width: "350px", position: "fixed", right: 0, top: 60, bottom: 0, background: "#f9fafb", borderLeft: "1px solid #eee", padding: "20px" }}>
        <h3>Student Info</h3>
        {selectedStudent ? (
          <div>
            <p><strong>Name:</strong> {selectedStudent.name}</p>
            <p><strong>Username:</strong> {selectedStudent.username}</p>
            <p><strong>Grade:</strong> {selectedStudent.grade}</p>
            <p><strong>Section:</strong> {selectedStudent.section}</p>
            <p><strong>Status:</strong> {selectedStudent.status}</p>
          </div>
        ) : <p>Select a student to see info</p>}
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
