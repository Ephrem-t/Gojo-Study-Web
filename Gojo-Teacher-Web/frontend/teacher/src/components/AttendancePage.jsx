import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaSignOutAlt,
  FaSave,
  FaClipboardCheck,
  FaUsers,
  FaChalkboardTeacher,
   FaUserCheck,
  FaCalendarAlt,
  FaBookOpen
} from "react-icons/fa";
import Sidebar from "./Sidebar";
import "../styles/global.css";
import { API_BASE } from "../api/apiConfig";
import { getRtdbRoot } from "../api/rtdbScope";
import { getTeacherCourseContext } from "../api/teacherApi";
import { resolveProfileImage } from "../utils/profileImage";
const RTDB_BASE = getRtdbRoot();

export default function AttendancePage() {
  const findUserByUserId = (usersObj, userId) => {
    if (!usersObj || !userId) return null;

    if (usersObj[userId]) return usersObj[userId];

    const targetUserId = String(userId || "").trim();
    const matchByUserId = Object.values(usersObj).find(
      (user) => String(user?.userId || "").trim() === targetUserId
    );

    return matchByUserId || null;
  };

  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 600);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teacher, setTeacher] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courses, setCourses] = useState([]);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [messageNotifications, setMessageNotifications] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [showMessenger, setShowMessenger] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth > 600);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () =>
      window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  useEffect(() => {
    if (!teacher) return;
    const fetchCourses = async () => {
      try {
        const context = await getTeacherCourseContext({ teacher, rtdbBase: RTDB_BASE });
        const teacherCourses = context.courses || [];
        setCourses(teacherCourses);
        if (!selectedCourse && teacherCourses.length > 0) {
          setSelectedCourse(teacherCourses[0]);
        }
      } catch (err) {
        console.error("Error fetching courses:", err);
      }
    };
    fetchCourses();
  }, [teacher]); // eslint-disable-line

  useEffect(() => {
    if (!selectedCourse) return;
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const [studentsRes, usersRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/Students.json`),
          axios.get(`${RTDB_BASE}/Users.json`)
        ]);
        const studentsData = studentsRes.data || {};
        const usersData = usersRes.data || {};
        const filtered = Object.entries(studentsData)
          .filter(([, s]) =>
            s.grade === selectedCourse.grade && s.section === selectedCourse.section
          )
          .map(([id, s]) => {
            const userRec = findUserByUserId(usersData, s.userId) || {};

            return {
              studentId: id,
              ...s,
              name: userRec?.name || s?.name || "Unknown",
              profileImage: resolveProfileImage(
                userRec?.profileImage,
                userRec?.profile,
                userRec?.avatar,
                s?.profileImage,
                s?.basicStudentInformation?.studentPhoto,
                s?.studentPhoto
              ),
            };
          });
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

  useEffect(() => {
    if (!selectedCourse) return;
    const fetchAttendance = async () => {
      try {
        const res = await axios.get(
          `${RTDB_BASE}/Attendance/${selectedCourse.id}/${date}.json`
        );
        setAttendance(res.data || {});
      } catch (err) {
        setAttendance({});
      }
    };
    fetchAttendance();
  }, [selectedCourse, date]);

  const handleMark = (studentId, status) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    if (!selectedCourse) {
      alert("Please select a course");
      return;
    }
    try {
      await axios.put(
        `${RTDB_BASE}/Attendance/${selectedCourse.id}/${date}.json`,
        attendance
      );
      alert("Attendance saved successfully!");
    } catch (err) {
      alert("Failed to save attendance");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // Responsive table CSS, reinforces white background
  useEffect(() => {
    const styleId = "responsive-attendance-table";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      @media (max-width: 600px) {
        .attendance-main-content-responsive {
          margin-left: 0 !important;
          width: 100vw !important;
          max-width: 100vw !important;
          padding: 8px 2vw !important;
          border-radius: 0 !important;
        }
        .attendance-table-wrapper {
          width: 100vw !important;
          max-width: 100vw !important;
          overflow-x: auto !important;
          padding: 0 1vw !important;
          background: #fff !important;
        }
        .attendance-table {
          min-width: 480px !important;
          width: auto !important;
          max-width: 100vw !important;
          table-layout: auto !important;
          overflow-x: auto !important;
          background: #fff !important;
        }
        .attendance-table th, .attendance-table td {
          font-size: 13px !important;
          padding: 7px !important;
          white-space: normal !important;
        }
      }
    `;
    document.head.appendChild(style);
  }, []);

  const isMobile = window.innerWidth <= 600;
  const selectedCourseLabel = selectedCourse
    ? `${selectedCourse.subject || selectedCourse.name || "Course"} • Grade ${selectedCourse.grade} Section ${selectedCourse.section}`
    : "No course selected";

  const getStatusButtonStyle = (studentId, statusType) => {
    const active = attendance[studentId] === statusType;
    const palette =
      statusType === "present"
        ? { activeBg: "#16a34a", activeText: "#ffffff" }
        : statusType === "absent"
          ? { activeBg: "#dc2626", activeText: "#ffffff" }
          : { activeBg: "#d97706", activeText: "#ffffff" };

    return {
      background: active ? palette.activeBg : "#f1f5f9",
      color: active ? palette.activeText : "#334155",
      padding: "8px 14px",
      border: active ? "1px solid transparent" : "1px solid #cbd5e1",
      borderRadius: "999px",
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 12,
      minWidth: 86,
      boxShadow: active ? "0 6px 14px rgba(15, 23, 42, 0.16)" : "none",
      transition: "all 0.15s ease",
    };
  };

  const headerMetaPillStyle = {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#334155",
    fontWeight: 700,
    fontSize: 12,
  };

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
        "--shadow-panel": "0 14px 30px rgba(15, 23, 42, 0.10)",
      }}
    >
      <div className="google-dashboard" style={{ display: "flex", gap: 10, padding: "10px", height: "calc(100vh - 73px)", overflow: "hidden" }}>
        <Sidebar
          active="attendance"
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

        <div
          className="attendance-main-content-responsive"
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
          <div className="main-inner" style={{ padding: isMobile ? "10px 2vw 20px" : "16px 18px", width: "100%", maxWidth: 1500, margin: 0 }}>
            <div className="section-header-card" style={{ marginBottom: 14 }}>
              <h2 className="section-header-card__title" style={{ fontSize: 24 }}>Attendance</h2>
              <div className="section-header-card__meta">
                <span style={headerMetaPillStyle}>{students.length} Students</span>
                <span style={headerMetaPillStyle}>{date}</span>
                <span className="section-header-card__chip">Teacher View</span>
              </div>
            </div>

            <div
              style={{
                marginBottom: 14,
                background: "linear-gradient(135deg, #eff6ff, #f8fafc)",
                border: "1px solid var(--border-soft)",
                borderRadius: 14,
                padding: isMobile ? "10px 12px" : "12px 14px",
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 800, color: "#1e3a8a", fontSize: 12, letterSpacing: "0.02em" }}>ACTIVE COURSE</span>
              <span
                style={{
                  background: "#ffffff",
                  border: "1px solid #dbeafe",
                  color: "#1e40af",
                  borderRadius: 999,
                  padding: "6px 11px",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {selectedCourseLabel}
              </span>
            </div>

            <div
              style={{
                marginBottom: "14px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: "var(--surface-panel)",
                border: "1px solid var(--border-soft)",
                boxShadow: "var(--shadow-soft)",
                borderRadius: 14,
                padding: isMobile ? "12px" : "14px 16px",
                flexWrap: "wrap",
              }}
            >
              <label style={{ fontWeight: 700, color: "var(--text-secondary)", fontSize: 13 }}>Select Course:</label>
              <select
                value={selectedCourse?.id || ""}
                onChange={(e) => {
                  const course = courses.find((c) => c.id === e.target.value);
                  setSelectedCourse(course || null);
                }}
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border-strong)",
                  outline: "none",
                  background: "#f8fafc",
                  minWidth: isMobile ? "100%" : "280px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                <option value="">-- Select Course --</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.subject || c.name || "Course")} - Grade {c.grade} Section {c.section}
                  </option>
                ))}
              </select>

              <label style={{ fontWeight: 700, color: "var(--text-secondary)", fontSize: 13 }}>Date:</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border-strong)",
                  outline: "none",
                  background: "#f8fafc",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                }}
              />
            </div>

            <div
              className="attendance-table-wrapper"
              style={{
                width: "100%",
                maxWidth: "100%",
                overflowX: "auto",
                marginBottom: 20,
                background: "var(--surface-panel)",
                borderRadius: 14,
                border: "1px solid var(--border-soft)",
                boxShadow: "var(--shadow-soft)",
                padding: isMobile ? 8 : 10,
              }}
            >
              {loading ? (
                <p style={{ margin: 0, padding: 10, color: "var(--text-muted)" }}>Loading students...</p>
              ) : error ? (
                <p style={{ margin: 0, padding: 10, color: "#b91c1c" }}>{error}</p>
              ) : (
                <table
                  className="attendance-table"
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: "var(--surface-panel)",
                    minWidth: 720,
                  }}
                >
                  <thead>
                    <tr style={{ background: "linear-gradient(135deg, var(--accent-strong), var(--accent))", color: "#fff", textAlign: "left" }}>
                      <th style={{ padding: "12px", textAlign: "center", width: 56 }}>#</th>
                      <th style={{ padding: "12px" }}>Student</th>
                      <th style={{ padding: "12px", textAlign: "center" }}>Present</th>
                      <th style={{ padding: "12px", textAlign: "center" }}>Absent</th>
                      <th style={{ padding: "12px", textAlign: "center" }}>Late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, idx) => (
                      <tr
                        key={s.studentId}
                        style={{ borderBottom: "1px solid var(--border-soft)", transition: "background 0.2s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "12px", textAlign: "center", fontWeight: 700 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: "50%",
                              background: "#f1f5f9",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              color: "#374151",
                            }}
                          >
                            {idx + 1}
                          </div>
                        </td>

                        <td style={{ padding: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "40px", height: "40px", borderRadius: "50%", overflow: "hidden", border: "2px solid #4b6cb7", background: "#fff" }}>
                            <img
                              src={s.profileImage || "/default-profile.png"}
                              alt={s.name}
                              onError={(event) => {
                                event.currentTarget.src = "/default-profile.png";
                              }}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          </div>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{s.name}</span>
                        </td>

                        <td style={{ padding: "10px", textAlign: "center" }}>
                          <button
                            style={getStatusButtonStyle(s.studentId, "present")}
                            onClick={() => handleMark(s.studentId, "present")}
                          >
                            Present
                          </button>
                        </td>
                        <td style={{ padding: "10px", textAlign: "center" }}>
                          <button
                            style={getStatusButtonStyle(s.studentId, "absent")}
                            onClick={() => handleMark(s.studentId, "absent")}
                          >
                            Absent
                          </button>
                        </td>
                        <td style={{ padding: "10px", textAlign: "center" }}>
                          <button
                            style={getStatusButtonStyle(s.studentId, "late")}
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
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                background: "var(--surface-panel)",
                border: "1px solid var(--border-soft)",
                borderRadius: 12,
                padding: "10px 12px",
                boxShadow: "0 6px 16px rgba(15, 23, 42, 0.06)",
              }}
            >
              <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 12 }}>
                Mark attendance and save for the selected date.
              </span>
              <button
                style={{
                  padding: "11px 18px",
                  borderRadius: "999px",
                  background: "var(--accent-strong)",
                  color: "#fff",
                  fontWeight: "700",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 10px 22px rgba(29, 78, 216, 0.26)",
                  letterSpacing: "0.01em",
                }}
                onClick={handleSave}
              >
                Save Attendance
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}