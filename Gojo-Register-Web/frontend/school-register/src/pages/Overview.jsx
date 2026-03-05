import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaChartLine,
  FaSignOutAlt,
  FaCog,
  FaChevronDown,
  FaBell,
  FaFacebookMessenger,
} from "react-icons/fa";
import axios from "axios";

export default function OverviewPage() {
  const navigate = useNavigate();
  const getIsNarrow = () => (typeof window !== "undefined" ? window.innerWidth <= 1100 : false);

  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem("registrar") || localStorage.getItem("admin") || "{}") || {};
    } catch (e) {
      return {};
    }
  })();

  const admin = {
    name: stored.name || stored.username || "Register Office",
    adminId: stored.financeId || stored.adminId || stored.userId || "",
    username: stored.username || "",
    profileImage: stored.profileImage || "/default-profile.png",
  };

  const schoolCode = stored.schoolCode || "";
  const DB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";
  const DB_URL = schoolCode ? `${DB_BASE}/Platform1/Schools/${schoolCode}` : DB_BASE;

  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(true);
  const [studentMenuOpen, setStudentMenuOpen] = useState(true);
  const [isNarrow, setIsNarrow] = useState(getIsNarrow());
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [parentsCount, setParentsCount] = useState(0);
  const [postsCount, setPostsCount] = useState(0);

  useEffect(() => {
    const onResize = () => setIsNarrow(getIsNarrow());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const loadOverview = async () => {
      try {
        setLoading(true);
        const [studentsRes, usersRes, parentsRes, postsRes] = await Promise.all([
          axios.get(`${DB_URL}/Students.json`).catch(() => ({ data: {} })),
          axios.get(`${DB_URL}/Users.json`).catch(() => ({ data: {} })),
          axios.get(`${DB_URL}/Parents.json`).catch(() => ({ data: {} })),
          axios.get(`${DB_URL}/posts.json`).catch(() => ({ data: {} })),
        ]);

        const studentsObj = studentsRes.data || {};
        const usersObj = usersRes.data || {};
        const parentsObj = parentsRes.data || {};
        const postsObj = postsRes.data || {};

        const studentRows = Object.entries(studentsObj).map(([studentId, studentNode]) => {
          const user = usersObj?.[studentNode?.userId] || {};
          return {
            studentId,
            userId: studentNode?.userId || "",
            name: user?.name || user?.username || "No Name",
            profileImage: user?.profileImage || "/default-profile.png",
            grade: studentNode?.grade || "-",
            section: studentNode?.section || "-",
            gender: String(studentNode?.gender || user?.gender || "").trim().toLowerCase(),
            status: String(studentNode?.status || "active").toLowerCase(),
            createdAt: studentNode?.createdAt || studentNode?.registeredAt || user?.createdAt || null,
          };
        });

        setStudents(studentRows);
        setParentsCount(Object.keys(parentsObj || {}).length);
        setPostsCount(Object.keys(postsObj || {}).length);
      } catch (error) {
        console.error("Overview fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadOverview();
  }, [DB_URL]);

  const summary = useMemo(() => {
    const totalStudents = students.length;
    const activeStudents = students.filter((s) => s.status !== "inactive").length;
    const inactiveStudents = totalStudents - activeStudents;
    const maleCount = students.filter((s) => ["male", "m", "boy"].includes(String(s.gender || "").toLowerCase())).length;
    const femaleCount = students.filter((s) => ["female", "f", "girl"].includes(String(s.gender || "").toLowerCase())).length;

    const gradeCounts = {};
    students.forEach((s) => {
      const gradeKey = String(s.grade || "-");
      gradeCounts[gradeKey] = (gradeCounts[gradeKey] || 0) + 1;
    });

    const topGrades = Object.entries(gradeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([grade, count]) => ({ grade, count }));

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthRegistrations = students.filter((student) => {
      if (!student.createdAt) return false;
      const registeredDate = new Date(student.createdAt);
      if (Number.isNaN(registeredDate.getTime())) return false;
      return registeredDate.getMonth() === currentMonth && registeredDate.getFullYear() === currentYear;
    });

    const recentStudents = [...thisMonthRegistrations]
      .sort((a, b) => {
        const x = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const y = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return y - x;
      })
      .slice(0, 8);

    const thisMonthRegistrationRate = totalStudents
      ? Math.round((thisMonthRegistrations.length / totalStudents) * 100)
      : 0;

    return {
      totalStudents,
      activeStudents,
      inactiveStudents,
      maleCount,
      femaleCount,
      topGrades,
      recentStudents,
      thisMonthRegistrationCount: thisMonthRegistrations.length,
      thisMonthRegistrationRate,
    };
  }, [students]);

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };

  return (
    <div className="dashboard-page" style={{ background: "#f5f8ff", minHeight: "100vh" }}>
      <nav className="top-navbar" style={{ borderBottom: "1px solid #e5e7eb", background: "#ffffff" }}>
        <h2 style={{ color: "#0f172a", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>
        <div className="nav-right">
          <Link className="icon-circle" to="/dashboard"><FaBell /></Link>
          <Link className="icon-circle" to="/all-chat"><FaFacebookMessenger /></Link>
          <Link className="icon-circle" to="/settings"><FaCog /></Link>
          <img src={admin.profileImage} alt="admin" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", flexDirection: isNarrow ? "column" : "row", gap: 14, padding: "12px" }}>
        <div className="google-sidebar" style={{ width: isNarrow ? "100%" : "220px", flex: "0 0 auto", padding: "12px", borderRadius: 16, background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 10px 24px rgba(15,23,42,0.06)", height: "fit-content" }}>
          <div className="sidebar-profile" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingBottom: 6 }}>
            <div className="sidebar-img-circle" style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", border: "2px solid #e6eefc" }}>
              <img src={admin.profileImage} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{admin.name}</h3>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{admin.username || admin.adminId || "register"}</p>
          </div>

          <div className="sidebar-menu" style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            <button
              type="button"
              className="sidebar-btn"
              onClick={() => setDashboardMenuOpen((prev) => !prev)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "10px 12px",
                fontSize: 13,
                fontWeight: 700,
                background: "linear-gradient(135deg, #eff6ff, #eef2ff)",
                color: "#1e3a8a",
                borderRadius: 12,
                border: "1px solid #c7d2fe",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FaHome style={{ width: 18, height: 18 }} /> Dashboard
              </span>
              <FaChevronDown style={{ transform: dashboardMenuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s ease" }} />
            </button>

            {dashboardMenuOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 10, paddingLeft: 10, borderLeft: "2px solid #dbeafe" }}>
                <Link className="sidebar-btn" to="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <FaHome style={{ width: 16, height: 16 }} /> Home
                </Link>
                <Link className="sidebar-btn" to="/my-posts" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <FaFileAlt style={{ width: 16, height: 16 }} /> My Posts
                </Link>
                <Link className="sidebar-btn" to="/overview" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, fontWeight: 700, backgroundColor: "#1d4ed8", color: "#fff", borderRadius: 10, boxShadow: "0 8px 18px rgba(29,78,216,0.25)" }}>
                  <FaChartLine style={{ width: 16, height: 16 }} /> Overview
                </Link>
                <Link className="sidebar-btn" to="/academic-years" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <FaFileAlt style={{ width: 16, height: 16 }} /> Academic Year
                </Link>
                <Link className="sidebar-btn" to="/grede-management" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaFileAlt style={{ width: 16, height: 16 }} /> Grede Management</Link>
              </div>
            )}

            <button
              type="button"
              className="sidebar-btn"
              onClick={() => setStudentMenuOpen((prev) => !prev)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "10px 12px",
                fontSize: 13,
                fontWeight: 700,
                background: "linear-gradient(135deg, #eff6ff, #eef2ff)",
                color: "#1e3a8a",
                borderRadius: 12,
                border: "1px solid #c7d2fe",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Students
              </span>
              <FaChevronDown style={{ transform: studentMenuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s ease" }} />
            </button>

            {studentMenuOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 10, paddingLeft: 10, borderLeft: "2px solid #dbeafe" }}>
                <Link className="sidebar-btn" to="/students" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <FaChalkboardTeacher style={{ width: 16, height: 16 }} /> Student
                </Link>
                <Link className="sidebar-btn" to="/student-register" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <FaFileAlt style={{ width: 16, height: 16 }} /> Register Student
                </Link>
                <Link className="sidebar-btn" to="/parents" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <FaFileAlt style={{ width: 16, height: 16 }} /> Student Parent
                </Link>
              </div>
            )}

            <Link className="sidebar-btn" to="/analytics" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", fontSize: 13 }}>
              <FaChartLine style={{ width: 18, height: 18 }} /> Analytics
            </Link>

            <button
              className="sidebar-btn logout-btn"
              onClick={() => {
                localStorage.removeItem("registrar");
                localStorage.removeItem("admin");
                navigate("/login");
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", fontSize: 13 }}
            >
              <FaSignOutAlt style={{ width: 18, height: 18 }} /> Logout
            </button>
          </div>
        </div>

        <div className="main-content" style={{ padding: "10px 20px 20px", flex: 1, minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, boxShadow: "0 10px 24px rgba(15,23,42,0.06)", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 24, color: "#0f172a", fontWeight: 800 }}>Overview</h1>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>Operational snapshot for students, parents and posts.</p>
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{loading ? "Loading..." : `Updated: ${new Date().toLocaleString()}`}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { title: "Total Students", value: summary.totalStudents, tone: "#1d4ed8" },
              { title: "Active Students", value: summary.activeStudents, tone: "#16a34a" },
              { title: "Inactive Students", value: summary.inactiveStudents, tone: "#dc2626" },
              { title: "👦 Male Count", value: summary.maleCount, tone: "#0f766e" },
              { title: "👧 Female Count", value: summary.femaleCount, tone: "#be185d" },
            ].map((card) => (
              <div key={card.title} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, boxShadow: "0 8px 20px rgba(15,23,42,0.06)", padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{card.title}</div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800, color: card.tone }}>{loading ? "--" : card.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1.4fr 1fr", gap: 12 }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, boxShadow: "0 8px 20px rgba(15,23,42,0.06)", padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>New Registrations (This Month)</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {loading ? "--" : summary.thisMonthRegistrationCount} registrations • Posts: {loading ? "--" : postsCount}
                </div>
              </div>

              {loading ? (
                <div style={{ fontSize: 13, color: "#64748b" }}>Loading students...</div>
              ) : summary.recentStudents.length === 0 ? (
                <div style={{ fontSize: 13, color: "#64748b" }}>No registrations found for this month yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {summary.recentStudents.map((student) => (
                    <div key={student.studentId} style={{ display: "grid", gridTemplateColumns: isNarrow ? "42px 1fr" : "42px 1fr auto", alignItems: "center", gap: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px" }}>
                      <img src={student.profileImage} alt={student.name} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "2px solid #dbeafe" }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{student.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{student.studentId}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>Registered: {formatDateTime(student.createdAt)}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", gridColumn: isNarrow ? "2 / 3" : "auto" }}>
                        G{student.grade} • {student.section}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, boxShadow: "0 8px 20px rgba(15,23,42,0.06)", padding: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>Grade Distribution</div>
              {loading ? (
                <div style={{ fontSize: 13, color: "#64748b" }}>Loading distribution...</div>
              ) : summary.topGrades.length === 0 ? (
                <div style={{ fontSize: 13, color: "#64748b" }}>No distribution data.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    {summary.topGrades.map((row) => {
                      const pct = summary.totalStudents ? Math.round((row.count / summary.totalStudents) * 100) : 0;
                      return (
                        <div key={row.grade}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>Grade {row.grade}</span>
                            <span style={{ fontSize: 12, color: "#64748b" }}>{row.count} ({pct}%)</span>
                          </div>
                          <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999 }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#1d4ed8,#3b82f6)", borderRadius: 999 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Gender Split</div>
                    {[
                      { label: "Male", count: summary.maleCount, tone: "#0f766e" },
                      { label: "Female", count: summary.femaleCount, tone: "#be185d" },
                    ].map((row) => {
                      const pct = summary.totalStudents ? Math.round((row.count / summary.totalStudents) * 100) : 0;
                      return (
                        <div key={row.label} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>{row.label}</span>
                            <span style={{ fontSize: 12, color: "#64748b" }}>{row.count} ({pct}%)</span>
                          </div>
                          <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999 }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: row.tone, borderRadius: 999 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
