import React, { useEffect, useState,useRef } from "react";
import axios from "axios";
import { FaHome, FaFileAlt, FaUpload, FaSignOutAlt, FaSearch, FaUsers, FaClipboardCheck, FaChalkboardTeacher } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../styles/global.css";
import { API_BASE } from "../api/apiConfig";
import { getRtdbRoot } from "../api/rtdbScope";
import { getTeacherCourseContext } from "../api/teacherApi";

const RTDB_BASE = getRtdbRoot();



function TeacherNotesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth > 600 : true
  );
  const [teacher, setTeacher] = useState(null); // single state for teacher
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [noteText, setNoteText] = useState("");
  const [file, setFile] = useState(null);
  const [posts, setPosts] = useState([]);
  const navigate = useNavigate();

const [notifications, setNotifications] = useState([]);
const [showNotifications, setShowNotifications] = useState(false);
const [highlightedPostId, setHighlightedPostId] = useState(null);

// Refs for posts (for scrolling/highlighting)
const postRefs = useRef({});
  const teacherUserId = teacher?.userId; // safe access

  // ---------------- Load Logged-In Teacher ----------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, []);

// Fetch notifications from posts
useEffect(() => {
  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API_BASE}/get_posts`);
      const postsData = res.data || [];

      // Use last 5 posts as notifications
      const latestNotifications = postsData.slice(0, 5).map((post) => ({
        id: post.postId,
        title: post.message?.substring(0, 50) || "Untitled post",
        adminName: post.adminName || "Admin",
        adminProfile: post.adminProfile || "/default-profile.png",
      }));

      setNotifications(latestNotifications);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  fetchNotifications();
}, []);

// Handle notification click
const handleNotificationClick = (postId, index) => {
  setHighlightedPostId(postId);

  // Scroll the post into view
  const postElement = postRefs.current[postId];
  if (postElement) {
    postElement.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Remove clicked notification
  const updatedNotifications = [...notifications];
  updatedNotifications.splice(index, 1);
  setNotifications(updatedNotifications);

  // Close popup
  setShowNotifications(false);

  // Remove highlight after 3 seconds
  setTimeout(() => setHighlightedPostId(null), 3000);
};


  // ---------------- Fetch Courses ----------------
  useEffect(() => {
    if (!teacher) return;

    async function fetchCourses() {
      try {
        const context = await getTeacherCourseContext({ teacher, rtdbBase: RTDB_BASE });
        setCourses(context.courses || []);
      } catch (err) {
        console.error("Error fetching courses:", err);
      }
    }

    fetchCourses();
  }, [teacher]);

  // ---------------- Fetch Posts ----------------
  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await axios.get(
          `${RTDB_BASE}/TeacherPosts.json`
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
        `${RTDB_BASE}/TeacherPosts.json`,
        postData
      );
      alert("Post submitted!");
      setNoteText("");
      setFile(null);
      setPosts(prev => [...prev, { ...postData, id: Date.now() }]); // temporary ID
    } catch (err) {
      console.error(err);
      alert("Failed to submit post");
    }
  };

  // ---------------- Logout ----------------
  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // ---------------- Guard ----------------
  if (!teacher) return null;

  const visiblePosts = posts.filter(
    (post) => post.teacherId === teacherUserId || post.courseId === selectedCourseId
  );

  return (
    <div
      className="dashboard-page"
      style={{
        background: "var(--page-bg)",
        minHeight: "100vh",
        height: "100vh",
        overflow: "hidden",
        color: "var(--text-primary)",
        "--surface-panel": "#ffffff",
        "--surface-accent": "#eff6ff",
        "--surface-muted": "#f8fafc",
        "--surface-strong": "#e2e8f0",
        "--page-bg": "#f5f8ff",
        "--border-soft": "#e2e8f0",
        "--border-strong": "#cbd5e1",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": "#2563eb",
        "--accent-soft": "#dbeafe",
        "--accent-strong": "#1d4ed8",
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
        "--shadow-soft": "0 10px 24px rgba(15, 23, 42, 0.08)",
      }}
    >
      <div
        className="google-dashboard"
        style={{ display: "flex", gap: 12, padding: "12px", height: "calc(100vh - 73px)", overflow: "hidden" }}
      >
        <Sidebar
          active=""
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          teacher={teacher}
          handleLogout={handleLogout}
        />

        <div
          className="teacher-sidebar-spacer"
          style={{
            width: "var(--sidebar-width)",
            minWidth: "var(--sidebar-width)",
            flex: "0 0 var(--sidebar-width)",
            pointerEvents: "none",
          }}
        />

        {/* Main Content */}
        <div
          style={{
            flex: 1,
            width: "100%",
            minWidth: 0,
            height: "100%",
            marginLeft: 0,
            padding: 0,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <div style={{ padding: "16px 18px 20px", width: "100%", maxWidth: 1320, margin: 0 }}>
            <div className="section-header-card" style={{ marginBottom: 14 }}>
              <h2 className="section-header-card__title" style={{ fontSize: 24 }}>Post Notes / Files</h2>
              <div className="section-header-card__meta">
                <span>{teacher?.name || "Teacher"}</span>
                <span>{visiblePosts.length} Posts</span>
                <span className="section-header-card__chip">Teacher View</span>
              </div>
            </div>

            <div
              style={{
                marginBottom: 14,
                background: "linear-gradient(135deg, #eff6ff, #f8fafc)",
                border: "1px solid var(--border-soft)",
                borderRadius: 14,
                padding: "12px 14px",
                color: "var(--text-secondary)",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Create class notes and attach files for your students in one place.
            </div>

            {/* Post Form */}
            <div
              style={{
                marginBottom: "16px",
                background: "var(--surface-panel)",
                padding: "18px 16px",
                borderRadius: "14px",
                border: "1px solid var(--border-soft)",
                boxShadow: "var(--shadow-soft)",
              }}
            >
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: "10px",
                  border: "1px solid var(--border-strong)",
                  fontSize: "13px",
                  marginBottom: "12px",
                  background: "#f8fafc",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <option value="">Select Class & Subject</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.subject} — Grade {c.grade}{c.section}</option>
                ))}
              </select>

              <textarea
                placeholder="Write your note here..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  border: "1px solid var(--border-strong)",
                  marginBottom: "12px",
                  minHeight: "130px",
                  fontSize: "14px",
                  resize: "vertical",
                  background: "#f8fafc",
                }}
              />

              <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                style={{
                  display: "block",
                  marginBottom: "14px",
                  fontSize: "13px",
                  cursor: "pointer",
                  padding: "10px",
                  borderRadius: "10px",
                  border: "1px solid var(--border-strong)",
                  background: "#f8fafc",
                  width: "100%",
                }}
              />

              <button
                onClick={handleSubmit}
                style={{
                  background: "linear-gradient(90deg, var(--accent-strong), var(--accent))",
                  color: "#fff",
                  border: "none",
                  padding: "11px 18px",
                  borderRadius: "999px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 700,
                  width: "100%",
                  boxShadow: "0 8px 18px rgba(29, 78, 216, 0.22)",
                }}
              >
                <FaUpload style={{ marginRight: "8px" }} /> Submit Post
              </button>
            </div>

            {/* Posts List */}
            <div>
              <h3 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "12px", color: "#1e293b" }}>All Posts</h3>

              {visiblePosts.length === 0 && (
                <div
                  style={{
                    background: "var(--surface-panel)",
                    padding: "18px",
                    borderRadius: "14px",
                    border: "1px solid var(--border-soft)",
                    color: "var(--text-muted)",
                    textAlign: "center",
                  }}
                >
                  No posts yet for the selected filter.
                </div>
              )}

              {visiblePosts.map((post, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--surface-panel)",
                    padding: "16px",
                    borderRadius: "14px",
                    marginBottom: "10px",
                    border: "1px solid var(--border-soft)",
                    boxShadow: "0 6px 16px rgba(15, 23, 42, 0.07)",
                  }}
                >
                  <p style={{ marginBottom: "10px", fontSize: "14px", lineHeight: "1.55", color: "#334155" }}>
                    {post.text}
                  </p>

                  {post.fileUrl && (
                    <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "18px", marginRight: "8px" }}>📄</span>
                      <a
                        href={post.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none", fontSize: "13px" }}
                      >
                        View / Download File
                      </a>
                    </div>
                  )}

                  <div style={{ fontSize: "12px", color: "#64748b", textAlign: "right" }}>
                    Posted: {new Date(post.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TeacherNotesPage;
