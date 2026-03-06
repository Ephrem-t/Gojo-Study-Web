import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaChartLine, FaSignOutAlt, FaCog, FaChevronDown, FaBell, FaFacebookMessenger, FaPlus, FaSyncAlt, FaUsers, FaSearch } from "react-icons/fa";
import { BACKEND_BASE } from "../config";
import axios from "axios";

const PAGE_BG = "linear-gradient(150deg, #f7f8ff 0%, #eef6ff 45%, #f9fcff 100%)";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dde7f5",
  borderRadius: 16,
  boxShadow: "0 12px 32px rgba(16, 24, 40, 0.08)",
};

export default function AcademicYearManagement() {
  const navigate = useNavigate();

  const stored = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("registrar") || localStorage.getItem("admin") || "{}") || {};
    } catch {
      return {};
    }
  }, []);

  const schoolCode = stored.schoolCode || "";
  const DB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";
  const DB_URL = schoolCode ? `${DB_BASE}/Platform1/Schools/${schoolCode}` : DB_BASE;
  const admin = {
    name: stored.name || stored.username || "Register Office",
    adminId: stored.financeId || stored.adminId || stored.userId || "",
    profileImage: stored.profileImage || "/default-profile.png",
    username: stored.username || "",
  };

  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(true);
  const [studentMenuOpen, setStudentMenuOpen] = useState(true);

  const [academicYears, setAcademicYears] = useState({});
  const [currentAcademicYear, setCurrentAcademicYear] = useState("");
  const [startYear, setStartYear] = useState(String(new Date().getFullYear()));
  const [targetRolloverYear, setTargetRolloverYear] = useState("");
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [showRolloverConfirm, setShowRolloverConfirm] = useState(false);
  const [selectedHistoryYear, setSelectedHistoryYear] = useState("");
  const [historyStudentsLoading, setHistoryStudentsLoading] = useState(false);
  const [historyStudents, setHistoryStudents] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historySelectedGrade, setHistorySelectedGrade] = useState("All");
  const [historySelectedSection, setHistorySelectedSection] = useState("All");
  const [selectedHistoryStudent, setSelectedHistoryStudent] = useState(null);

  const yearRows = useMemo(() => {
    return Object.entries(academicYears || {}).sort((a, b) => b[0].localeCompare(a[0]));
  }, [academicYears]);

  const stats = useMemo(() => {
    let activeCount = 0;
    let archivedCount = 0;
    let inactiveCount = 0;

    yearRows.forEach(([, row]) => {
      const status = String(row?.status || "inactive");
      if (status === "active") activeCount += 1;
      else if (status === "archived") archivedCount += 1;
      else inactiveCount += 1;
    });

    return {
      totalYears: yearRows.length,
      activeCount,
      archivedCount,
      historyStudents: historyStudents.length,
      inactiveCount,
    };
  }, [yearRows, historyStudents]);

  const rolloverYearOptions = useMemo(() => {
    return yearRows
      .map(([key]) => key)
      .filter((key) => key !== currentAcademicYear);
  }, [yearRows, currentAcademicYear]);

  const historyGradeOptions = useMemo(() => {
    const set = new Set(
      historyStudents
        .map((row) => String(row?.grade || "").trim())
        .filter(Boolean)
    );
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))];
  }, [historyStudents]);

  const historySectionOptions = useMemo(() => {
    const filteredByGrade = historyStudents.filter((row) => {
      if (historySelectedGrade === "All") return true;
      return String(row?.grade || "").trim() === historySelectedGrade;
    });

    const set = new Set(
      filteredByGrade
        .map((row) => String(row?.section || "").trim())
        .filter(Boolean)
    );

    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))];
  }, [historyStudents, historySelectedGrade]);

  const visibleHistoryStudents = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return historyStudents.filter((row) => {
      const grade = String(row?.grade || "").trim();
      const section = String(row?.section || "").trim();
      const name = String(row?.name || "").toLowerCase();
      const studentId = String(row?.studentId || "").toLowerCase();

      if (historySelectedGrade !== "All" && grade !== historySelectedGrade) return false;
      if (historySelectedSection !== "All" && section !== historySelectedSection) return false;

      if (!q) return true;

      return name.includes(q) || studentId.includes(q) || grade.toLowerCase().includes(q) || section.toLowerCase().includes(q);
    });
  }, [historyStudents, historySearch, historySelectedGrade, historySelectedSection]);

  const setError = (err, fallback) => {
    const msg = err?.response?.data?.message || err?.message || fallback;
    setFeedback({ type: "error", text: msg });
  };

  const setSuccess = (msg) => setFeedback({ type: "success", text: msg });
  const setWarning = (msg) => setFeedback({ type: "warning", text: msg });

  const chipStyle = (active) => ({
    padding: "6px 12px",
    borderRadius: "999px",
    background: active ? "#1d4ed8" : "#eef2ff",
    color: active ? "#fff" : "#1e3a8a",
    cursor: "pointer",
    border: active ? "1px solid #1d4ed8" : "1px solid #dbeafe",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    transition: "all 0.2s ease",
  });

  const formatFieldLabel = (key) => {
    return String(key || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (s) => s.toUpperCase());
  };

  const formatFieldValue = (value) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) {
      if (value.length === 0) return "-";
      const allPrimitive = value.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item));
      return allPrimitive ? value.join(", ") : `${value.length} item(s)`;
    }
    if (typeof value === "object") return "Available";
    const text = String(value).trim();
    return text || "-";
  };

  const fetchAcademicYears = async () => {
    if (!schoolCode) {
      setError(null, "Missing schoolCode in session. Please login again.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_BASE}/api/academic-years`, { params: { schoolCode } });
      const payload = res.data || {};
      setAcademicYears(payload.academicYears || {});
      setCurrentAcademicYear(payload.currentAcademicYear || "");
      setFeedback({ type: "", text: "" });
    } catch (err) {
      setError(err, "Failed to load academic years.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcademicYears();
  }, [schoolCode]);

  const handleCreateYear = async () => {
    const cleanedStartYear = String(startYear || "").trim();
    if (!cleanedStartYear) {
      setWarning("Start year is required.");
      return;
    }

    if (!/^\d{4}$/.test(cleanedStartYear)) {
      setWarning("Start year must be a 4-digit year (example: 2026).");
      return;
    }

    setWorking(true);
    try {
      const res = await axios.post(`${BACKEND_BASE}/api/academic-years/create`, {
        schoolCode,
        startYear: cleanedStartYear,
      });
      setSuccess(res.data?.message || "Academic year created.");
      await fetchAcademicYears();
    } catch (err) {
      setError(err, "Failed to create academic year.");
    } finally {
      setWorking(false);
    }
  };

  const handleActivateYear = async (yearKey) => {
    const confirmed = window.confirm(`Set ${yearKey.replace("_", "/")} as the current academic year?`);
    if (!confirmed) return;

    setWorking(true);
    try {
      const res = await axios.post(`${BACKEND_BASE}/api/academic-years/activate`, {
        schoolCode,
        yearKey,
      });
      setSuccess(res.data?.message || "Academic year activated.");
      await fetchAcademicYears();
    } catch (err) {
      setError(err, "Failed to activate academic year.");
    } finally {
      setWorking(false);
    }
  };

  const handleArchiveYear = async (yearKey) => {
    const confirmed = window.confirm(`Archive ${yearKey.replace("_", "/")}?`);
    if (!confirmed) return;

    setWorking(true);
    try {
      const res = await axios.post(`${BACKEND_BASE}/api/academic-years/archive`, {
        schoolCode,
        yearKey,
      });
      setSuccess(res.data?.message || "Academic year archived.");
      await fetchAcademicYears();
    } catch (err) {
      setError(err, "Failed to archive academic year.");
    } finally {
      setWorking(false);
    }
  };

  const handleRollover = async () => {
    setWorking(true);
    try {
      const res = await axios.post(`${BACKEND_BASE}/api/academic-years/rollover`, {
        schoolCode,
        targetYearKey: targetRolloverYear.trim() || undefined,
      });
      const data = res.data || {};
      setSuccess(`${data.message || "Rollover completed."} Promoted: ${data.promoted || 0}, Graduated: ${data.graduated || 0}, Skipped: ${data.skipped || 0}`);
      setShowRolloverConfirm(false);
      await fetchAcademicYears();
    } catch (err) {
      setError(err, "Failed to run rollover.");
    } finally {
      setWorking(false);
    }
  };

  const openRolloverConfirm = () => {
    if (!targetRolloverYear) {
      setWarning("Please select target rollover year.");
      return;
    }

    if (targetRolloverYear === currentAcademicYear) {
      setWarning("Target year cannot be the same as current year.");
      return;
    }

    setFeedback({ type: "", text: "" });
    setShowRolloverConfirm(true);
  };

  const fetchYearHistoryStudents = async (yearKey) => {
    if (!yearKey) return;

    if (selectedHistoryYear === yearKey) {
      setSelectedHistoryYear("");
      setHistoryStudents([]);
      setHistorySearch("");
      setHistorySelectedGrade("All");
      setHistorySelectedSection("All");
      setSelectedHistoryStudent(null);
      return;
    }

    setSelectedHistoryYear(yearKey);
    setHistorySearch("");
    setHistorySelectedGrade("All");
    setHistorySelectedSection("All");
    setSelectedHistoryStudent(null);
    setHistoryStudentsLoading(true);
    try {
      const [studentsRes, usersRes] = await Promise.all([
        axios.get(`${DB_URL}/YearHistory/${yearKey}/Students.json`).catch(() => ({ data: {} })),
        axios.get(`${DB_URL}/Users.json`).catch(() => ({ data: {} })),
      ]);

      const studentsObj = studentsRes.data || {};
      const usersObj = usersRes.data || {};
      const list = Object.entries(studentsObj).map(([studentId, row]) => {
        const student = row || {};
        const user = usersObj[student.userId] || {};
        return {
          studentId,
          ...student,
          name: user.name || student.name || student.basicStudentInformation?.name || "Student",
          profileImage: user.profileImage || student.profileImage || "/default-profile.png",
          email: user.email || student.email || "",
        };
      });

      setHistoryStudents(list);
    } catch (err) {
      setError(err, "Failed to load YearHistory students.");
    } finally {
      setHistoryStudentsLoading(false);
    }
  };

  return (
    <div className="dashboard-page" style={{ background: PAGE_BG, minHeight: "100vh" }}>
      <style>
        {`
          .ay-grid-two {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }
          .ay-stats {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
          }
          .ay-main-dashboard {
            display: flex;
            gap: 14px;
            padding: 12px;
          }
          @media (max-width: 1180px) {
            .ay-main-dashboard {
              flex-direction: column;
            }
          }
          @media (max-width: 980px) {
            .ay-grid-two {
              grid-template-columns: 1fr;
            }
            .ay-stats {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (max-width: 640px) {
            .ay-stats {
              grid-template-columns: 1fr;
            }
          }
          .ay-student-fullscreen {
            width: 100vw;
            height: 100vh;
            max-width: 100vw;
            max-height: 100vh;
            overflow-y: auto;
            background: linear-gradient(165deg, #f8fbff 0%, #eef4ff 45%, #ffffff 100%);
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .ay-student-header {
            position: sticky;
            top: 0;
            z-index: 2;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(6px);
            border: 1px solid #dbe7ff;
            border-radius: 12px;
            padding: 10px 12px;
          }
          .ay-student-panel {
            border: 1px solid #dbe7ff;
            border-radius: 12px;
            background: #ffffff;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
            padding: 12px;
          }
          .ay-student-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .ay-student-item {
            background: #f8fbff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 9px 10px;
          }
          @media (max-width: 900px) {
            .ay-student-grid {
              grid-template-columns: 1fr;
            }
            .ay-student-fullscreen {
              padding: 12px;
            }
          }
        `}
      </style>

      <nav className="top-navbar" style={{ borderBottom: "1px solid #dbe7fb", background: "#ffffffcc", backdropFilter: "blur(6px)" }}>
        <h2 style={{ color: "#0f172a", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>
        <div className="nav-right">
          <Link className="icon-circle" to="/dashboard"><FaBell /></Link>
          <Link className="icon-circle" to="/all-chat"><FaFacebookMessenger /></Link>
          <Link className="icon-circle" to="/settings"><FaCog /></Link>
          <img src={admin.profileImage} alt="admin" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard ay-main-dashboard">
        <div className="google-sidebar" style={{ width: "220px", padding: "12px", borderRadius: 16, background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 10px 24px rgba(15,23,42,0.06)", height: "fit-content" }}>
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
                <Link className="sidebar-btn" to="/overview" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <FaChartLine style={{ width: 16, height: 16 }} /> Overview
                </Link>
                <Link className="sidebar-btn" to="/academic-years" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, fontWeight: 700, backgroundColor: "#1d4ed8", color: "#fff", borderRadius: 10, boxShadow: "0 8px 18px rgba(29,78,216,0.25)" }}>
                  <FaFileAlt style={{ width: 16, height: 16 }} /> Academic Year
                </Link>
                <Link className="sidebar-btn" to="/grede-management" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaFileAlt style={{ width: 16, height: 16 }} /> Grede Management</Link>
                <Link className="sidebar-btn" to="/promotion-system" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaFileAlt style={{ width: 16, height: 16 }} /> Promotion System</Link>
                <Link className="sidebar-btn" to="/transfer-withdrawal" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaFileAlt style={{ width: 16, height: 16 }} /> Transfer & Withdrawal</Link>
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
            <div style={{ ...cardStyle, padding: 18, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", right: -50, top: -40, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(125, 211, 252, 0.32), rgba(147, 197, 253, 0))" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 24, color: "#0f172a", fontWeight: 900 }}>Academic Year Management</h1>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>Create, activate, archive, and rollover academic years for promotion logic.</p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{currentAcademicYear ? `Current: ${currentAcademicYear.replace("_", "/")}` : "No active year"}</div>
                  <button
                    type="button"
                    onClick={fetchAcademicYears}
                    disabled={loading || working}
                    style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #1d4ed8", background: "#eff6ff", color: "#1d4ed8", borderRadius: 9, padding: "7px 10px", fontSize: 12, fontWeight: 800, cursor: loading || working ? "not-allowed" : "pointer", opacity: loading || working ? 0.6 : 1 }}
                  >
                    <FaSyncAlt /> Refresh
                  </button>
                </div>
              </div>
            </div>

            <div className="ay-stats">
              {[{
                title: "Total Years",
                value: stats.totalYears,
                hint: "Configured academic years",
                color: "#2563eb",
              }, {
                title: "Active",
                value: stats.activeCount,
                hint: "Live years",
                color: "#0f766e",
              }, {
                title: "Archived",
                value: stats.archivedCount,
                hint: "Closed years",
                color: "#c2410c",
              }, {
                title: "History Students",
                value: stats.historyStudents,
                hint: selectedHistoryYear ? selectedHistoryYear.replace("_", "/") : "Current selection",
                color: "#7c3aed",
              }].map((item) => (
                <div key={item.title} style={{ ...cardStyle, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{item.title}</span>
                    <FaUsers style={{ color: item.color }} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: "#0f172a" }}>{item.value}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "#64748b" }}>{item.hint}</div>
                </div>
              ))}
            </div>

            <div className="ay-grid-two">
              <div style={{ ...cardStyle, padding: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>Create New Academic Year</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={startYear}
                    onChange={(e) => setStartYear(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="2026"
                    style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                  />
                  <button
                    onClick={handleCreateYear}
                    disabled={working}
                    style={{ border: "1px solid #1d4ed8", background: "#1d4ed8", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 800, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.75 : 1, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <FaPlus /> Create
                  </button>
                </div>
              </div>

              <div style={{ ...cardStyle, padding: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>Rollover to Next Year</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <select
                    value={targetRolloverYear}
                    onChange={(e) => setTargetRolloverYear(e.target.value)}
                    style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                  >
                    <option value="">Select target year</option>
                    {rolloverYearOptions.map((yearKey) => (
                      <option key={yearKey} value={yearKey}>
                        {yearKey.replace("_", "/")}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={openRolloverConfirm}
                    disabled={working}
                    style={{ border: "1px solid #16a34a", background: "#16a34a", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.75 : 1 }}
                  >
                    Rollover
                  </button>
                </div>
              </div>
            </div>

            {feedback.text ? (
              <div
                style={{
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  border: `1px solid ${feedback.type === "error" ? "#fecaca" : feedback.type === "warning" ? "#fde68a" : "#bfdbfe"}`,
                  background: feedback.type === "error" ? "#fef2f2" : feedback.type === "warning" ? "#fffbeb" : "#eff6ff",
                  color: feedback.type === "error" ? "#991b1b" : feedback.type === "warning" ? "#92400e" : "#1e3a8a",
                }}
              >
                {feedback.text}
              </div>
            ) : null}

            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", fontWeight: 800, color: "#0f172a", borderBottom: "1px solid #e5e7eb" }}>Academic Years</div>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.7fr 1.2fr", padding: "10px 14px", borderBottom: "1px solid #eef2f7", fontSize: 12, fontWeight: 800, color: "#475569" }}>
                <div>Year</div>
                <div>Status</div>
                <div>Current</div>
                <div>Actions</div>
              </div>

              {loading ? (
                <div style={{ padding: 14, fontSize: 13, color: "#64748b" }}>Loading...</div>
              ) : yearRows.length === 0 ? (
                <div style={{ padding: 14, fontSize: 13, color: "#64748b" }}>No academic years created yet.</div>
              ) : (
                yearRows.map(([yearKey, row]) => {
                  const status = String(row?.status || "inactive");
                  const isCurrent = !!row?.isCurrent;
                  const isExpanded = selectedHistoryYear === yearKey;
                  return (
                    <div key={yearKey} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <div
                        onClick={() => fetchYearHistoryStudents(yearKey)}
                        style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.7fr 1.2fr", padding: "10px 14px", alignItems: "center", cursor: "pointer", background: isExpanded ? "#f8fbff" : "transparent" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span
                            aria-hidden="true"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 22,
                              height: 22,
                              borderRadius: 999,
                              border: "1px solid #cbd5e1",
                              background: "#fff",
                              color: "#0f766e",
                              transition: "transform .2s ease",
                              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                              flexShrink: 0,
                            }}
                          >
                            <FaChevronDown style={{ width: 12, height: 12 }} />
                          </span>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {row?.label || yearKey.replace("_", "/")}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: status === "active" ? "#166534" : status === "archived" ? "#9a3412" : "#475569" }}>{status}</div>
                        <div style={{ fontSize: 13 }}>{isCurrent ? "✅" : "—"}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleActivateYear(yearKey);
                          }}
                          disabled={working || isCurrent}
                          style={{ border: "1px solid #2563eb", background: "#2563eb", color: "#fff", borderRadius: 7, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: working || isCurrent ? "not-allowed" : "pointer", opacity: working || isCurrent ? 0.6 : 1 }}
                        >
                          Activate
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveYear(yearKey);
                          }}
                          disabled={working || status === "archived"}
                          style={{ border: "1px solid #b45309", background: "#b45309", color: "#fff", borderRadius: 7, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: working || status === "archived" ? "not-allowed" : "pointer", opacity: working || status === "archived" ? 0.6 : 1 }}
                        >
                          Archive
                        </button>

                        </div>
                      </div>

                      {isExpanded ? (
                        <div style={{ padding: "0 14px 12px", background: "#f8fbff", borderTop: "1px dashed #dbeafe" }}>
                          {historyStudentsLoading ? (
                            <div style={{ paddingTop: 10, fontSize: 13, color: "#64748b" }}>Loading students...</div>
                          ) : historyStudents.length === 0 ? (
                            <div style={{ paddingTop: 10, fontSize: 13, color: "#64748b" }}>No students found for this year.</div>
                          ) : (
                            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  background: "#fff",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: "12px",
                                  padding: "10px 12px",
                                  boxShadow: "0 6px 18px rgba(15,23,42,0.07)",
                                }}
                              >
                                <FaSearch style={{ color: "#6b7280", fontSize: 14 }} />
                                <input
                                  value={historySearch}
                                  onChange={(e) => setHistorySearch(e.target.value)}
                                  placeholder="Search student by name or ID"
                                  style={{ width: "100%", border: "none", outline: "none", fontSize: 13, background: "transparent" }}
                                />
                              </div>

                              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", maxWidth: "100%", overflowX: "auto", paddingBottom: 1 }}>
                                {historyGradeOptions.map((grade) => (
                                  <button
                                    key={grade}
                                    onClick={() => {
                                      setHistorySelectedGrade(grade);
                                      setHistorySelectedSection("All");
                                    }}
                                    style={chipStyle(historySelectedGrade === grade)}
                                  >
                                    {grade === "All" ? "All Grades" : `Grade ${grade}`}
                                  </button>
                                ))}
                              </div>

                              {historySelectedGrade !== "All" && historySectionOptions.length > 1 ? (
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", maxWidth: "100%", overflowX: "auto", paddingBottom: 1 }}>
                                  {historySectionOptions.map((section) => (
                                    <button
                                      key={section}
                                      onClick={() => setHistorySelectedSection(section)}
                                      style={chipStyle(historySelectedSection === section)}
                                    >
                                      {section === "All" ? "All Sections" : `Section ${section}`}
                                    </button>
                                  ))}
                                </div>
                              ) : null}

                              <div style={{ marginTop: 2, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                                Showing {visibleHistoryStudents.length} of {historyStudents.length} students
                              </div>

                              {visibleHistoryStudents.length === 0 ? (
                                <div style={{ padding: "10px 12px", fontSize: 12, color: "#64748b" }}>No students match your search/filter.</div>
                              ) : (
                                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.7fr", padding: "9px 12px", borderBottom: "1px solid #eef2f7", fontSize: 12, fontWeight: 800, color: "#475569" }}>
                                    <div>Student</div>
                                    <div>Grade</div>
                                    <div>Section</div>
                                    <div>Action</div>
                                  </div>

                                  {visibleHistoryStudents.map((student) => (
                                    <div key={student.studentId} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.7fr", padding: "9px 12px", borderTop: "1px solid #f1f5f9", alignItems: "center", gap: 8 }}>
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                          <img
                                            src={student.profileImage || "/default-profile.png"}
                                            alt={student.name || "Student"}
                                            onError={(e) => {
                                              e.currentTarget.onerror = null;
                                              e.currentTarget.src = "/default-profile.png";
                                            }}
                                            style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: "1px solid #dbeafe", flexShrink: 0 }}
                                          />
                                          <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student.name}</div>
                                            <div style={{ fontSize: 11, color: "#64748b" }}>{student.studentId}</div>
                                          </div>
                                        </div>
                                      </div>
                                      <div style={{ fontSize: 12, fontWeight: 700 }}>{student.grade || "—"}</div>
                                      <div style={{ fontSize: 12, fontWeight: 700 }}>{student.section || "—"}</div>
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedHistoryStudent(student)}
                                          style={{
                                            border: "1px solid #1d4ed8",
                                            background: "linear-gradient(180deg, #eff6ff, #dbeafe)",
                                            color: "#1e3a8a",
                                            borderRadius: 8,
                                            padding: "5px 10px",
                                            fontSize: 11,
                                            fontWeight: 800,
                                            cursor: "pointer",
                                            boxShadow: "0 4px 10px rgba(37,99,235,0.22)",
                                          }}
                                        >
                                          Show
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {showRolloverConfirm ? (
        <div
          onClick={() => {
            if (!working) {
              setShowRolloverConfirm(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              boxShadow: "0 18px 36px rgba(15,23,42,0.22)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a", fontWeight: 800 }}>Confirm Academic Year Rollover</h3>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                This will promote students to the next grade, archive yearly snapshots, and reset operational yearly data.
              </p>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, fontSize: 12, color: "#334155" }}>
              <div><strong>From Year:</strong> {currentAcademicYear ? currentAcademicYear.replace("_", "/") : "Current active year"}</div>
              <div><strong>Target Year:</strong> {targetRolloverYear ? targetRolloverYear.replace("_", "/") : "Not selected"}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => {
                  setShowRolloverConfirm(false);
                }}
                disabled={working}
                style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleRollover}
                disabled={working || !targetRolloverYear}
                style={{ border: "1px solid #dc2626", background: "#dc2626", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: working || !targetRolloverYear ? "not-allowed" : "pointer", opacity: working || !targetRolloverYear ? 0.6 : 1 }}
              >
                Confirm Rollover
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedHistoryStudent ? (
        <div
          onClick={() => setSelectedHistoryStudent(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 0,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="ay-student-fullscreen"
          >
            <div className="ay-student-header">
              <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a", fontWeight: 900, letterSpacing: "0.2px" }}>Student Profile</h3>
              <button
                type="button"
                onClick={() => setSelectedHistoryStudent(null)}
                style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
              >
                Close
              </button>
            </div>

            <div className="ay-student-panel" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src={selectedHistoryStudent.profileImage || "/default-profile.png"}
                alt={selectedHistoryStudent.name || "Student"}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/default-profile.png";
                }}
                style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "2px solid #bfdbfe", flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a" }}>{selectedHistoryStudent.name || "Student"}</div>
                <div style={{ marginTop: 2, fontSize: 12, color: "#64748b", fontWeight: 700 }}>{selectedHistoryStudent.studentId || "No student ID"}</div>
              </div>
            </div>

            <div className="ay-student-panel ay-student-grid">
              <div style={{ fontSize: 12, color: "#334155" }}><strong>Grade:</strong> {selectedHistoryStudent.grade || "—"}</div>
              <div style={{ fontSize: 12, color: "#334155" }}><strong>Section:</strong> {selectedHistoryStudent.section || "—"}</div>
              <div style={{ fontSize: 12, color: "#334155" }}><strong>Email:</strong> {selectedHistoryStudent.email || "—"}</div>
              <div style={{ fontSize: 12, color: "#334155" }}><strong>User ID:</strong> {selectedHistoryStudent.userId || "—"}</div>
            </div>

            <div className="ay-student-panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>Student Details</div>

              <div className="ay-student-grid">
                {Object.entries(selectedHistoryStudent.basicStudentInformation || {}).map(([key, value]) => (
                  <div key={`basic-${key}`} className="ay-student-item">
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{formatFieldLabel(key)}</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: "#0f172a", fontWeight: 700 }}>{formatFieldValue(value)}</div>
                  </div>
                ))}
              </div>

              {selectedHistoryStudent.contactInformation ? (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>Contact Information</div>
                  <div className="ay-student-grid">
                    {Object.entries(selectedHistoryStudent.contactInformation).map(([key, value]) => (
                      <div key={`contact-${key}`} className="ay-student-item">
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{formatFieldLabel(key)}</div>
                        <div style={{ marginTop: 2, fontSize: 12, color: "#0f172a", fontWeight: 700 }}>{formatFieldValue(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedHistoryStudent.parentInformation || selectedHistoryStudent.guardianInformation ? (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>Guardian Information</div>
                  <div className="ay-student-grid">
                    {Object.entries(selectedHistoryStudent.parentInformation || selectedHistoryStudent.guardianInformation || {}).map(([key, value]) => (
                      <div key={`guardian-${key}`} className="ay-student-item">
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{formatFieldLabel(key)}</div>
                        <div style={{ marginTop: 2, fontSize: 12, color: "#0f172a", fontWeight: 700 }}>{formatFieldValue(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>Other Information</div>
                <div className="ay-student-grid">
                  {Object.entries(selectedHistoryStudent)
                    .filter(([key, value]) => !["basicStudentInformation", "contactInformation", "parentInformation", "guardianInformation", "profileImage", "name", "studentId"].includes(key) && (typeof value !== "object" || Array.isArray(value)))
                    .map(([key, value]) => (
                      <div key={`other-${key}`} className="ay-student-item">
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{formatFieldLabel(key)}</div>
                        <div style={{ marginTop: 2, fontSize: 12, color: "#0f172a", fontWeight: 700 }}>{formatFieldValue(value)}</div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
