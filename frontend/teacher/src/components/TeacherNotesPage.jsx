import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaHome, FaFileAlt, FaUpload, FaCog, FaSignOutAlt, FaSearch, FaBell, FaUsers, FaClipboardCheck } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";

function TeacherNotesPage() {
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [noteText, setNoteText] = useState("");
  const [file, setFile] = useState(null);
  const [posts, setPosts] = useState([]);
  const navigate = useNavigate();

  const teacherUserId = teacherInfo?.userId;

  // ---------------- Load Logged-In Teacher ----------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacherInfo(storedTeacher);
  }, [navigate]);

  // ---------------- Fetch Courses ----------------
  useEffect(() => {
    if (!teacherInfo) return;

    async function fetchCourses() {
      try {
        const [coursesRes, assignmentsRes, teachersRes] = await Promise.all([
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Courses.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"),
        ]);

        const teacherKeyEntry = Object.entries(teachersRes.data || {}).find(
          ([key, teacher]) => teacher.userId === teacherInfo.userId
        );
        if (!teacherKeyEntry) return;
        const teacherKey = teacherKeyEntry[0];

        const teacherAssignments = Object.values(assignmentsRes.data || {}).filter(
          a => a.teacherId === teacherKey
        );

        const teacherCourses = teacherAssignments.map(a => ({
          id: a.courseId,
          ...coursesRes.data[a.courseId]
        }));

        setCourses(teacherCourses);
      } catch (err) {
        console.error("Error fetching courses:", err);
      }
    }

    fetchCourses();
  }, [teacherInfo]);

  // ---------------- Fetch Posts ----------------
  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await axios.get(
          "https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherPosts.json"
        );
        setPosts(Object.entries(res.data || {}).map(([id, post]) => ({ id, ...post })));
      } catch (err) {
        console.error(err);
      }
    }

    fetchPosts();
  }, []);

  // ---------------- Submit Post ----------------
  const handleSubmit = async () => {
    if (!selectedCourseId || (!noteText && !file)) {
      alert("Please select a class and enter a note or upload a file");
      return;
    }

    let fileUrl = "";
    if (file) {
      fileUrl = URL.createObjectURL(file);
    }

    const postData = {
      teacherId: teacherUserId,
      courseId: selectedCourseId,
      text: noteText,
      fileUrl,
      createdAt: new Date().toISOString(),
    };

    try {
      await axios.post(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherPosts.json",
        postData
      );
      alert("Post submitted!");
      setNoteText("");
      setFile(null);
      setPosts(prev => [...prev, postData]);
    } catch (err) {
      console.error(err);
      alert("Failed to submit post");
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
         {/* ---------------- TOP NAVBAR ---------------- */}
       <div
  style={{
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: "70px",
    background: "linear-gradient(90deg, #4b6cb7 0%, #182848 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 30px",
    color: "#fff",
    zIndex: 1000,
    boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
    borderBottomLeftRadius: "12px",
    borderBottomRightRadius: "12px",
  }}
>
  {/* Title */}
  <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 600, letterSpacing: "1px" }}>Teacher Notes</h2>

  {/* Right section: icons + profile */}
  <div style={{ display: "flex", alignItems: "center", gap: "25px" }}>
    
    {/* Search */}
    <FaSearch
      style={{
        cursor: "pointer",
        fontSize: "18px",
        transition: "transform 0.2s",
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.2)")}
      onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
    />

    {/* Notifications */}
    <FaBell
      style={{
        cursor: "pointer",
        fontSize: "18px",
        transition: "transform 0.2s",
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.2)")}
      onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
    />

    {/* Profile */}
    <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.1)", padding: "5px 12px", borderRadius: "25px", backdropFilter: "blur(5px)" }}>
      <img
        src={teacherInfo?.profileImage || "/default-profile.png"}
        alt={teacherInfo?.name}
        style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", border: "2px solid #fff" }}
      />
      <span style={{ fontWeight: 500 }}>{teacherInfo?.name}</span>
    </div>
  </div>
</div>

      {/* ---------------- LEFT SIDEBAR ---------------- */}
      <div style={{ width: "300px", marginTop: "40px", position: "fixed", top: 0, left: 0, height: "100vh", background: "#fff", padding: "20px", borderRight: "1px solid #eee" }}>
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
          <Link className="sidebar-btn" to="/notes" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaClipboardCheck /> Notes</Link>
          <Link className="sidebar-btn" to="/students"><FaUsers /> Students</Link>
          <Link className="sidebar-btn" to="/admins" style={{ background: "#4b6cb7", color: "#fff" }}><FaUsers /> Admins</Link>
          <Link className="sidebar-btn" to="/marks"><FaClipboardCheck /> Marks</Link>
          <Link className="sidebar-btn" to="/attendance"><FaUsers /> Attendance</Link>
          <Link className="sidebar-btn" to="/settings"><FaCog /> Settings</Link>
          <Link className="sidebar-btn" to="/logout"><FaSignOutAlt /> Logout</Link>
        </div>
      </div>

     {/* ---------------- MAIN CONTENT ---------------- */}
<div style={{
  marginLeft: "500px",
  width: "40%", // reduced width for better focus
  padding: "100px 30px 50px",
  background: "#f3f4f6",
  minHeight: "100vh",
  fontFamily: "'Inter', sans-serif",
}}>

  {/* ---------------- PAGE HEADER ---------------- */}
  <div style={{
    marginBottom: "30px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "linear-gradient(90deg, #e0e7ff, #c7d2fe)",
    padding: "20px 25px",
    borderRadius: "18px",
    boxShadow: "0 5px 20px rgba(0,0,0,0.08)",
    transition: "all 0.3s",
  }}>
    <h2 style={{ fontSize: "28px", fontWeight: 700, color: "#1e293b" }}>Post Notes / Files</h2>
    <span style={{ color: "#475569", fontSize: "16px", fontWeight: 500 }}>
      {teacherInfo?.name}, share notes with your students
    </span>
  </div>

  {/* ---------------- POST FORM ---------------- */}
  <div style={{
    marginBottom: "40px",
    background: "#fff",
    padding: "30px 25px",
    borderRadius: "18px",
    boxShadow: "0 6px 25px rgba(0,0,0,0.08)",
  }}>
    
    {/* Course Selector */}
    <select
      value={selectedCourseId}
      onChange={(e) => setSelectedCourseId(e.target.value)}
      style={{
        width: "100%",
        padding: "14px 16px",
        borderRadius: "12px",
        border: "1px solid #cbd5e1",
        fontSize: "15px",
        marginBottom: "18px",
        background: "#f8fafc",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      <option value="">Select Class & Subject</option>
      {courses.map(c => (
        <option key={c.id} value={c.id}>
          {c.subject} — Grade {c.grade}{c.section}
        </option>
      ))}
    </select>

    {/* Note Textarea */}
    <textarea
      placeholder="Write your note here..."
      value={noteText}
      onChange={(e) => setNoteText(e.target.value)}
      style={{
        width: "100%",
        padding: "18px",
        borderRadius: "15px",
        border: "1px solid #cbd5e1",
        marginBottom: "18px",
        minHeight: "140px",
        fontSize: "15px",
        resize: "vertical",
        background: "#f8fafc",
        boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
      }}
    />

    {/* File Upload */}
    <input
      type="file"
      onChange={(e) => setFile(e.target.files[0])}
      style={{
        display: "block",
        marginBottom: "25px",
        fontSize: "15px",
        cursor: "pointer",
        padding: "10px",
        borderRadius: "12px",
        border: "1px solid #cbd5e1",
        background: "#f8fafc",
        width: "100%",
      }}
    />

    {/* Submit Button */}
    <button
      onClick={handleSubmit}
      style={{
        background: "linear-gradient(90deg, #4b6cb7, #182848)",
        color: "#fff",
        border: "none",
        padding: "14px 30px",
        borderRadius: "15px",
        cursor: "pointer",
        fontSize: "16px",
        fontWeight: 600,
        width: "100%",
        transition: "all 0.3s",
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
      onMouseLeave={e => e.currentTarget.style.opacity = 1}
    >
      <FaUpload style={{ marginRight: "10px" }} /> Submit Post
    </button>
  </div>

  {/* ---------------- POSTS LIST ---------------- */}
  <div>
    <h3 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "20px", color: "#1e293b" }}>All Posts</h3>

    {posts
      .filter(post => post.teacherId === teacherUserId || post.courseId === selectedCourseId)
      .map((post, idx) => (
        <div
          key={idx}
          style={{
            background: "#fff",
            padding: "20px 25px",
            borderRadius: "18px",
            marginBottom: "18px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
            transition: "all 0.3s",
            cursor: "pointer"
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          <p style={{ marginBottom: "12px", fontSize: "15px", lineHeight: "1.6", color: "#334155" }}>
            {post.text}
          </p>

          {post.fileUrl && (
            <div style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "10px",
            }}>
              <span style={{ fontSize: "20px", marginRight: "10px" }}>📄</span>
              <a
                href={post.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                style={{
                  color: "#2563eb",
                  fontWeight: 600,
                  textDecoration: "none",
                  fontSize: "15px",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
              >
                View / Download File
              </a>
            </div>
          )}

          <div style={{ fontSize: "13px", color: "#64748b", textAlign: "right" }}>
            Posted: {new Date(post.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
  </div>
</div>



    </div>
  );
}

export default TeacherNotesPage;
