import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaSignOutAlt,
  FaUsers,
  FaChalkboardTeacher,
  FaClipboardCheck,
  FaChevronLeft,
  FaChevronRight,
  FaUserCheck,
  FaCalendarAlt,
  FaBookOpen
} from "react-icons/fa";
import Sidebar from "./Sidebar";
import "../styles/global.css";
import { API_BASE } from "../api/apiConfig";
import { getRtdbRoot } from "../api/rtdbScope";

// --- API and RTDB endpoints ---
const RTDB_BASE = getRtdbRoot();

// --- Used to sort chat ids for message threading (helper) ---
const getChatId = (id1, id2) => [id1, id2].sort().join("_");

function Schedule() {
  // Sidebar toggle state for mobile (like Dashboard)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 600);
    // Hide sidebar by default on phone size, show on desktop
    useEffect(() => {
      const handleResize = () => {
        if (window.innerWidth <= 600) {
          setSidebarOpen(false);
        } else {
          setSidebarOpen(true);
        }
      };
      window.addEventListener("resize", handleResize);
      handleResize();
      return () => window.removeEventListener("resize", handleResize);
    }, []);
  // ---------------- STATE -----------------------
  const [teacher, setTeacher] = useState(null);
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [selectedDay, setSelectedDay] = useState("All");
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const postRefs = useRef({});
  const navigate = useNavigate();
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 900 : false);
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

  const parseGradeSection = (rawValue) => {
    const normalized = String(rawValue || "").trim();
    if (!normalized) {
      return { grade: "", section: "" };
    }

    const compact = normalized.replace(/\s+/g, "");
    const digitsMatch = compact.match(/\d+/);
    const grade = digitsMatch ? digitsMatch[0] : "";

    let section = "";
    if (digitsMatch) {
      const sectionPart = compact.slice(digitsMatch.index + grade.length);
      section = (sectionPart.match(/[A-Za-z]+/)?.[0] || "").toUpperCase();
    }

    if (!section) {
      section = (compact.match(/[A-Za-z]+/)?.[0] || "").toUpperCase();
    }

    return { grade, section };
  };

  const { gradeOptions, sectionOptions } = useMemo(() => {
    const gradeSet = new Set();
    const sectionSet = new Set();

    Object.values(schedule || {}).forEach((gradesByDay) => {
      Object.keys(gradesByDay || {}).forEach((gradeKey) => {
        const { grade, section } = parseGradeSection(gradeKey);
        if (grade) gradeSet.add(grade);
        if (section) sectionSet.add(section);
      });
    });

    const sortedGrades = [...gradeSet].sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    let relevantSections = [...sectionSet];
    if (selectedGrade !== "All") {
      const scopedSectionSet = new Set();
      Object.values(schedule || {}).forEach((gradesByDay) => {
        Object.keys(gradesByDay || {}).forEach((gradeKey) => {
          const { grade, section } = parseGradeSection(gradeKey);
          if (grade === selectedGrade && section) scopedSectionSet.add(section);
        });
      });
      relevantSections = [...scopedSectionSet];
    }

    const sortedSections = relevantSections.sort((a, b) => a.localeCompare(b));

    return {
      gradeOptions: ["All", ...sortedGrades],
      sectionOptions: ["All", ...sortedSections],
    };
  }, [schedule, selectedGrade]);

  // --------------- RESPONSIVE --------------
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedGrade !== "All" && !gradeOptions.includes(selectedGrade)) {
      setSelectedGrade("All");
    }
  }, [gradeOptions, selectedGrade]);

  useEffect(() => {
    if (selectedSection !== "All" && !sectionOptions.includes(selectedSection)) {
      setSelectedSection("All");
    }
  }, [sectionOptions, selectedSection]);

  // Messenger badge: count unread messages only (from notifications)
  const totalUnreadMessages = notifications.filter((n) => n.type === "message").reduce((sum, n) => sum + (n.unreadForMe || 0), 0);

  // --------------- LOAD TEACHER -------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  // --------------- FETCH SCHEDULE --------------
  useEffect(() => {
    if (!teacher) return;
    async function fetchSchedule() {
      setLoading(true);
      try {
        const res = await axios.get(`${RTDB_BASE}/Schedules.json`);
        setSchedule(res.data || {});
        setError("");
      } catch (err) {
        setError("Failed to load schedule.");
      } finally {
        setLoading(false);
      }
    }
    fetchSchedule();
  }, [teacher]);

  // --------------- LOGOUT HANDLER --------------
  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // --------------- TEACHER PERSONAL SCHEDULE (RIGHT SIDEBAR) --------------
  const getTeacherSchedule = () => {
    if (!teacher || !schedule) return {};
    const filtered = {};
    Object.entries(schedule).forEach(([day, grades]) => {
      Object.entries(grades || {}).forEach(([grade, periods]) => {
        Object.entries(periods || {}).forEach(([periodName, info]) => {
          if (!info?.teacherName) return;
          if (info.teacherName === teacher.name) {
            if (!filtered[day]) filtered[day] = {};
            if (!filtered[day][periodName]) filtered[day][periodName] = [];
            filtered[day][periodName].push({
              class: grade,
              subject: info.subject || "-",
              time: info.time || periodName.match(/\((.*?)\)/)?.[1] || "N/A",
            });
          }
        });
      });
    });
    return filtered;
  };
  const teacherSchedule = getTeacherSchedule();

  // ---------------------- NOTIFICATIONS logic ----------------------
  function getSeenPosts(teacherId) {
    return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
  }
  function saveSeenPost(teacherId, postId) {
    const seen = getSeenPosts(teacherId);
    if (!seen.includes(postId)) {
      localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seen, postId]));
    }
  }
  // --- FETCH NOTIFICATIONS: posts + unread messages ---
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // 1. Fetch posts
        const res = await axios.get(`${API_BASE}/get_posts`);
        let postsData = res.data || [];
        if (!Array.isArray(postsData) && typeof postsData === "object") postsData = Object.values(postsData);

        const [usersRes, chatsRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/Users.json`),
          axios.get(`${RTDB_BASE}/Chats.json`),
        ]);
        const users = usersRes.data || {};
        const chats = chatsRes.data || {};

        // Get teacher from localStorage so we know who's seen what
        const teacher = JSON.parse(localStorage.getItem("teacher"));

        // --- Helper to resolve admin info ---
        // --- Post notifications (latest 5, regardless of seen) ---
        const postNotifs = postsData
          .slice()
          .sort((a, b) => {
            const ta = a.time ? new Date(a.time).getTime() : 0;
            const tb = b.time ? new Date(b.time).getTime() : 0;
            return tb - ta;
          })
          .filter((post) => post.postId)
          .slice(0, 5)
          .map((post) => ({
            id: post.postId,
            type: "post",
            title: post.message?.substring(0, 50) || "Untitled post",
            adminName: post.adminName || "Admin",
            adminProfile: post.adminProfile || "/default-profile.png",
            time: post.time ? new Date(post.time).getTime() : 0,
          }));

        // --- Message notifications (unread only, for this teacher) ---
        let messageNotifs = [];
        if (teacher && teacher.userId) {
          Object.entries(chats).forEach(([chatId, chat]) => {
            const unreadMap = chat.unread || {};
            const unreadForMe = unreadMap[teacher.userId] || 0;
            if (!unreadForMe) return;
            const participants = chat.participants || {};
            const otherKey = Object.keys(participants).find((p) => p !== teacher.userId);
            let otherUser = users[otherKey] || { userId: otherKey, name: otherKey, profileImage: "/default-profile.png" };
            messageNotifs.push({
              chatId,
              type: "message",
              displayName: otherUser.name || otherUser.username || otherKey,
              profile: otherUser.profileImage || otherUser.profile || "/default-profile.png",
              unreadForMe,
              time: chat.lastMessage?.timeStamp ? new Date(chat.lastMessage.timeStamp).getTime() : 0,
            });
          });
        }

        // Merge and sort by recency, then take top 5
        const allNotifs = [...postNotifs, ...messageNotifs]
          .sort((a, b) => (b.time || 0) - (a.time || 0))
          .slice(0, 5);
        setNotifications(allNotifs);
      } catch (err) {}
    };
    fetchNotifications();
  }, []);

  // --- Handler to remove notification after clicked (and mark seen) ---
  const handleNotificationClick = async (notif) => {
    if (!teacher) return;
    if (notif.type === "post" && notif.id) {
      saveSeenPost(teacher.userId, notif.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      setShowNotifications(false);
      // Optionally: navigate to dashboard and highlight post
      navigate("/dashboard");
    } else if (notif.type === "message" && notif.chatId) {
      setNotifications((prev) => prev.filter((n) => n.chatId !== notif.chatId));
      setShowNotifications(false);
      // Mark messages as read in DB
      try {
        await axios.put(`${RTDB_BASE}/Chats/${notif.chatId}/unread/${teacher.userId}.json`, null);
      } catch (err) {}
      navigate("/all-chat");
    }
  };

  // --------------- MESSENGER LOGIC (all unread conversations) ---------------
  // ...existing code...

  // -------------------------- CSS STYLES ----------------------------
  const css = `
    body, html, #root { height: 100%; margin: 0; }
    .gojo-root-dashboard {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: #f5f8ff;
      overflow: hidden;
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
      height: 60px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07);
    }
    .google-sidebar {
      position: fixed;
      top: 60px;
      left: 0;
      width: 220px;
      height: calc(100vh - 60px);
      background: #fff;
      box-shadow: 2px 0 8px rgba(0,0,0,0.04);
      z-index: 900;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 18px;
      overflow-y: auto;
      transition: width 0.2s;
      min-width: 48px;
    }
    .main-area-row {
      display: flex;
      flex: 1;
      flex-direction: row;
      height: 100vh;
      margin-top: var(--topbar-height);
      width: 100%;
      min-width: 0;
    }
    .schedule-main {
      flex: 1;
      margin-left: calc(var(--sidebar-width, 220px) + 12px);
      padding: 18px;
      background: #f5f8ff;
      min-height: calc(100vh - var(--topbar-height));
      overflow-y: auto;
      transition: margin-left 0.2s, margin-right 0.25s ease;
      position: relative;
      z-index: 20;
    }
    .right-sidebar {
      position: fixed;
      top: calc(var(--topbar-height) + 10px);
      right: 12px;
      width: 380px;
      height: calc(100vh - var(--topbar-height) - 20px);
      z-index: 300;
      background: #fff;
      box-shadow: 0 0 24px rgba(15, 23, 42, 0.10);
      display: flex;
      flex-direction: column;
      transition: right 0.2s, left 0.2s, width 0.2s;
      border-left: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
    }
    .close-sidebar-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      background: linear-gradient(90deg, #2563eb, #3b82f6);
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      z-index: 10;
      cursor: pointer;
    }
    @media (max-width: 900px) {
      .schedule-main { margin-left: calc(var(--sidebar-width, 220px) + 8px); padding: 14px 2vw; }
      .right-sidebar { width: 100vw; left: 0; right: initial; top: var(--topbar-height); height: calc(100vh - var(--topbar-height)); border-radius: 0; }
    }
    @media (max-width: 600px) {
      .top-navbar { height: 54px; padding: 0 7px; }
      .main-area-row { margin-top: 54px; }
      .schedule-main { margin-left: 0; padding: 8px 2vw; border-radius: 7px; }
      .right-sidebar { left: 0; right: initial; width: 100vw; height: calc(100vh - 54px); }
      .close-sidebar-btn {
        top: 8px !important;
        right: 8px !important;
        width: 44px !important;
        height: 44px !important;
        font-size: 22px !important;
      }
    }
  `;

  // ----------------- PAGE JSX -------------------
  return (
    <div
      className="gojo-root-dashboard"
      style={{
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
      <style>{css}</style>
      {/* --------- Main Area Row ------- */}
      <div className="main-area-row">
        <Sidebar
          active="schedule"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          teacher={teacher}
          handleLogout={handleLogout}
        />
        {/* ---- Main Content (scrollable) ---- */}
        <div className="schedule-main" style={{ marginRight: rightSidebarOpen && !isMobile ? 404 : 0 }}>
          <div className="schedule-container" style={{ width: "100%", maxWidth: 1280, margin: "0 auto" }}>
            <div className="section-header-card" style={{ marginBottom: 14 }}>
              <h2 className="section-header-card__title" style={{ fontSize: 24 }}>Full Schedule</h2>
              <div className="section-header-card__meta">
                <span style={headerMetaPillStyle}>{selectedGrade === "All" ? "All Grades" : `Grade ${selectedGrade}`}</span>
                <span style={headerMetaPillStyle}>{selectedDay === "All" ? "All Days" : selectedDay}</span>
                <span className="section-header-card__chip">Teacher View</span>
              </div>
            </div>

            {/* Filters */}
            <div style={{
              display: "flex",
              gap: "14px",
              marginBottom: "14px",
              justifyContent: "flex-start",
              flexWrap: "wrap",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: isMobile ? "10px" : "12px 14px",
              boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "260px" }}>
                <label style={{ fontWeight: 700, color: "#334155", fontSize: 13 }}>Grade:</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {gradeOptions.map((grade) => {
                    const isActiveGrade = selectedGrade === grade;
                    return (
                      <button
                        key={grade}
                        onClick={() => setSelectedGrade(grade)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: 999,
                          border: isActiveGrade ? "1px solid #1d4ed8" : "1px solid #e2e8f0",
                          background: isActiveGrade ? "#dbeafe" : "#ffffff",
                          color: isActiveGrade ? "#1e40af" : "#475569",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        {grade === "All" ? "All Grades" : `Grade ${grade}`}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "260px" }}>
                <label style={{ fontWeight: 700, color: "#334155", fontSize: 13 }}>Section:</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {sectionOptions.map((section) => {
                    const isActiveSection = selectedSection === section;
                    return (
                      <button
                        key={section}
                        onClick={() => setSelectedSection(section)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: 999,
                          border: isActiveSection ? "1px solid #1d4ed8" : "1px solid #e2e8f0",
                          background: isActiveSection ? "#dbeafe" : "#ffffff",
                          color: isActiveSection ? "#1e40af" : "#475569",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        {section === "All" ? "All Sections" : section}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginBottom: "14px",
                flexWrap: "wrap",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "8px",
                boxShadow: "0 6px 16px rgba(15, 23, 42, 0.06)",
              }}
            >
              {["All", ...daysOfWeek].map((day) => {
                const isActiveDay = selectedDay === day;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 999,
                      border: isActiveDay ? "1px solid #1d4ed8" : "1px solid #e2e8f0",
                      background: isActiveDay ? "#dbeafe" : "#ffffff",
                      color: isActiveDay ? "#1e40af" : "#475569",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {loading && <p style={{textAlign:"center"}}>Loading schedule...</p>}
            {error && <p style={{color:"red", textAlign:"center"}}>{error}</p>}
            {!loading && daysOfWeek.map(day => {
              if (selectedDay !== "All" && selectedDay !== day) return null;
              const grades = schedule[day];
              if (!grades) return null;
              return (
                <div key={day} style={{ marginBottom: "22px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)", padding: isMobile ? "10px" : "12px" }}>
                  <h3 style={{ color: "#1d4ed8", marginBottom: "10px", fontWeight: 800 }}>{day}</h3>
                  {Object.entries(grades)
                    .filter(([grade]) => selectedGrade === "All" || grade.includes(selectedGrade))
                    .map(([grade, periods]) => {
                      const sectionFromGrade = parseGradeSection(grade).section;
                      if (selectedSection !== "All" && sectionFromGrade !== selectedSection) return null;
                      return (
                        <div key={grade} style={{marginBottom:"18px"}}>
                          <h4 style={{ color: "#334155", marginBottom: "8px", fontWeight: 700 }}>{grade}</h4>
                          <table style={{
                            width:"100%", borderCollapse:"collapse", background:"#fff",
                            borderRadius:"12px", overflow:"hidden", boxShadow:"0 2px 10px rgba(0,0,0,0.06)",
                          }}>
                            <thead style={{ background:"linear-gradient(135deg, #1d4ed8, #2563eb)", color:"#fff" }}>
                              <tr>
                                <th style={{padding:"12px",textAlign:"left"}}>Period</th>
                                <th style={{padding:"12px",textAlign:"left"}}>Subject</th>
                                <th style={{padding:"12px",textAlign:"left"}}>Time</th>
                                <th style={{padding:"12px",textAlign:"left"}}>Teacher</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(periods).map(([periodName, info], idx) => {
                                const isMyClass = info?.teacherName === teacher?.name;
                                const time = info.time || periodName.match(/\((.*?)\)/)?.[1] || "N/A";
                                return (
                                  <tr
                                    key={idx}
                                    style={{
                                      borderBottom: "1px solid #eee",
                                      backgroundColor: isMyClass ? "#dbeafe" : "#f8fafc",
                                      color: isMyClass ? "#1e40af" : "#475569",
                                      fontWeight: isMyClass ? "700" : "400",
                                      borderLeft: isMyClass ? "4px solid #2563eb" : "none",
                                      opacity: 1,
                                    }}
                                  >
                                    <td style={{ padding: "12px" }}>{periodName}</td>
                                    <td style={{ padding: "12px" }}>{info.subject || "-"}</td>
                                    <td style={{ padding: "12px" }}>{time}</td>
                                    <td style={{ padding: "12px" }}>{info.teacherName || "-"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
        {/* ------ Right Sidebar: Teacher's personal schedule ---- */}
        {rightSidebarOpen && (
          <div className="right-sidebar">
            {/* ABSOLUTE close arrow always visible */}
            <button
              title="Close sidebar"
              onClick={() => setRightSidebarOpen(false)}
              className="close-sidebar-btn"
            >
              <FaChevronRight />
            </button>
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "linear-gradient(90deg, #1d4ed8, #2563eb)",
              color: "#fff",
              padding: "12px 48px 12px 16px",
              textAlign: "center",
              fontWeight: "700",
              fontSize: "1.05rem",
              boxShadow: "0 2px 8px rgba(15,23,42,0.12)",
              borderTopLeftRadius: "1px",
              borderTopRightRadius: "1px",
              justifyContent: "flex-start"
            }}>
              My Schedule
            </div>
            <div style={{ padding: "14px", height: "calc(100% - 60px)", overflowY: "auto", background: "#f8fafc" }}>
              {loading ? (
                <p style={{ textAlign: "center", color: "#6b7280" }}>Loading schedule...</p>
              ) : Object.keys(teacherSchedule).length === 0 ? (
                <p style={{ textAlign: "center", color: "#6b7280" }}>No schedule found.</p>
              ) : (
                daysOfWeek.map((day) => {
                  const periods = teacherSchedule[day];
                  if (!periods) return null;
                  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
                  const isToday = today === day;
                  return (
                    <div key={day} style={{
                      marginBottom: "20px",
                      padding: "10px",
                      borderRadius: "12px",
                      background: isToday ? "#e0f2fe" : "#fff",
                      border: "1px solid #e2e8f0",
                      boxShadow: isToday ? "0 8px 16px rgba(59, 130, 246, 0.18)" : "0 4px 10px rgba(0,0,0,0.04)"
                    }}>
                      <h4 style={{ color: "#1e3a8a", marginBottom: "12px", fontWeight: "600", fontSize: "1.05rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "5px" }}>{day}</h4>
                      {Object.entries(periods).map(([periodName, entries]) => (
                        <div key={periodName} style={{ marginBottom: "10px", background: "#f8fafc", padding: "11px 13px", borderRadius: "10px", borderLeft: "4px solid #2563eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", transition: "transform 0.2s, box-shadow 0.2s" }}>
                          <strong style={{ display: "block", marginBottom: "6px", color: "#1e3a8a", fontSize: "0.98rem" }}>{periodName}</strong>
                          <ul style={{ paddingLeft: "18px", margin: 0 }}>
                            {entries.map((entry, idx) => (
                              <li key={idx} style={{ marginBottom: "6px", color: "#374151", fontSize: "0.95rem" }}>
                                <span style={{ fontWeight: "600", color: "#2563eb" }}>{entry.class}</span> - {entry.subject} ({entry.time})
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        {!rightSidebarOpen && (
          <button
            title="Open sidebar"
            onClick={() => setRightSidebarOpen(true)}
            style={{
              position: "fixed",
              top: "calc(var(--topbar-height) + 14px)",
              right: "14px",
              minWidth: "74px",
              height: "40px",
              padding: "0 12px",
              background: "linear-gradient(90deg, #2563eb, #3b82f6)",
              color: "#fff",
              border: "none",
              borderRadius: "999px",
              boxShadow: "0 4px 12px rgba(59,130,246, 0.15)",
              zIndex: 301,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              fontWeight: 700,
              fontSize: "12px",
              cursor: "pointer",
              transition: "right 0.3s"
            }}
          >
            <span>My</span>
            <FaChevronLeft />
          </button>
        )}
      </div>
    </div>
  );
}

export default Schedule;