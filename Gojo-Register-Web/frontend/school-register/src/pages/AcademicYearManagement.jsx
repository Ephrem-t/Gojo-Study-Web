import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaChartLine, FaSignOutAlt, FaCog, FaChevronDown, FaBell, FaFacebookMessenger, FaPlus, FaSyncAlt, FaUsers, FaSearch } from "react-icons/fa";
import { BACKEND_BASE } from "../config";
import axios from "axios";
import { buildUserLookupFromNode, loadSchoolUsersNode } from "../utils/registerData";
import { fetchCachedJson } from "../utils/rtdbCache";
import RegisterSidebar from "../components/RegisterSidebar";
import ProfileAvatar from "../components/ProfileAvatar";

const PAGE_BG = "var(--page-bg)";

const cardStyle = {
  background: "var(--surface-panel)",
  border: "1px solid var(--border-soft)",
  borderRadius: 16,
  boxShadow: "var(--shadow-panel)",
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
  const [rolloverPassword, setRolloverPassword] = useState("");
  const [rolloverPhraseInput, setRolloverPhraseInput] = useState("");
  const [rolloverDelaySeconds, setRolloverDelaySeconds] = useState(3600);
  const [pendingRollover, setPendingRollover] = useState(null);
  const [pendingNow, setPendingNow] = useState(Date.now());
  const [rolloverModalFeedback, setRolloverModalFeedback] = useState({ type: "", text: "" });
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

  const rolloverDelayOptions = useMemo(() => ([
    { label: "1 hour", value: 3600, hint: "Short approval window" },
    { label: "6 hours", value: 21600, hint: "Same working day" },
    { label: "12 hours", value: 43200, hint: "Half day buffer" },
    { label: "1 day", value: 86400, hint: "Full-day safety window" },
  ]), []);

  const expectedRolloverPhrase = useMemo(() => {
    if (!currentAcademicYear || !targetRolloverYear) return "";
    return `ROLL OVER ${currentAcademicYear} TO ${targetRolloverYear}`;
  }, [currentAcademicYear, targetRolloverYear]);

  const parseRolloverDate = (value) => {
    const text = String(value || "").trim();
    if (!text) return null;

    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
    const normalized = hasTimezone ? text : `${text}Z`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatRolloverDateTime = (value) => {
    const parsed = parseRolloverDate(value);
    return parsed ? parsed.toLocaleString() : "Unknown time";
  };

  const pendingCountdownMs = useMemo(() => {
    if (!pendingRollover?.executeAfter) return 0;
    const executeAfter = parseRolloverDate(pendingRollover.executeAfter);
    if (!executeAfter) return 0;
    return Math.max(executeAfter.getTime() - pendingNow, 0);
  }, [pendingRollover, pendingNow]);

  const canExecutePendingRollover = !!pendingRollover?.requestId && pendingCountdownMs <= 0;

  const formatCountdown = (milliseconds) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const segments = [];
    if (days) segments.push(`${days}d`);
    if (days || hours) segments.push(`${String(hours).padStart(2, "0")}h`);
    segments.push(`${String(minutes).padStart(2, "0")}m`);
    segments.push(`${String(seconds).padStart(2, "0")}s`);
    return segments.join(" ");
  };

  const formatDelayLabel = (seconds) => {
    const match = rolloverDelayOptions.find((option) => option.value === Number(seconds));
    return match?.label || `${seconds}s`;
  };

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
  const setRolloverModalError = (err, fallback) => {
    const msg = err?.response?.data?.message || err?.message || fallback;
    setRolloverModalFeedback({ type: "error", text: msg });
  };
  const setRolloverModalWarning = (msg) => setRolloverModalFeedback({ type: "warning", text: msg });
  const clearRolloverModalFeedback = () => setRolloverModalFeedback({ type: "", text: "" });

  const chipStyle = (active) => ({
    padding: "6px 12px",
    borderRadius: "999px",
    background: active ? "var(--accent-strong)" : "var(--surface-accent)",
    color: active ? "#fff" : "var(--accent-strong)",
    cursor: "pointer",
    border: active ? "1px solid var(--accent-strong)" : "1px solid var(--border-strong)",
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

  const fetchPendingRollover = async ({ silent = true } = {}) => {
    if (!schoolCode) return;

    try {
      const res = await axios.get(`${BACKEND_BASE}/api/academic-years/rollover/pending`, {
        params: { schoolCode },
      });
      const nextPending = res.data?.pendingRequest || null;
      setPendingRollover(nextPending);
      if (nextPending?.targetYear) {
        setTargetRolloverYear(nextPending.targetYear);
      }
    } catch (err) {
      if (!silent) {
        setError(err, "Failed to load guarded rollover status.");
      }
    }
  };

  useEffect(() => {
    fetchAcademicYears();
    fetchPendingRollover();
  }, [schoolCode]);

  useEffect(() => {
    if (!pendingRollover?.requestId) return undefined;

    const timer = window.setInterval(() => {
      setPendingNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [pendingRollover?.requestId]);

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
    if (!pendingRollover?.requestId) {
      setRolloverModalWarning("Arm the rollover first.");
      return;
    }

    if (!canExecutePendingRollover) {
      setRolloverModalWarning("The countdown is still active. Wait until the timer completes or cancel the rollover.");
      return;
    }

    clearRolloverModalFeedback();
    setWorking(true);
    try {
      const res = await axios.post(`${BACKEND_BASE}/api/academic-years/rollover`, {
        schoolCode,
        targetYearKey: pendingRollover.targetYear,
        requestId: pendingRollover.requestId,
        actorUserId: stored.userId || admin.userId || "",
      });
      const data = res.data || {};
      setSuccess(`${data.message || "Rollover completed."} Promoted: ${data.promoted || 0}, Graduated: ${data.graduated || 0}, Repeated: ${data.repeated || 0}`);
      setPendingRollover(null);
      setRolloverPhraseInput("");
      setRolloverPassword("");
      clearRolloverModalFeedback();
      setShowRolloverConfirm(false);
      await Promise.all([fetchAcademicYears(), fetchPendingRollover()]);
    } catch (err) {
      setRolloverModalError(err, "Failed to run rollover.");
    } finally {
      setWorking(false);
    }
  };

  const handleArmRollover = async () => {
    if (!targetRolloverYear) {
      setRolloverModalWarning("Please select target rollover year.");
      return;
    }

    if (!rolloverPassword.trim()) {
      setRolloverModalWarning("Re-enter the registerer password to arm the rollover.");
      return;
    }

    if (rolloverPhraseInput.trim() !== expectedRolloverPhrase) {
      setRolloverModalWarning(`Type the exact phrase: ${expectedRolloverPhrase}`);
      return;
    }

    clearRolloverModalFeedback();
    setWorking(true);
    try {
      const res = await axios.post(`${BACKEND_BASE}/api/academic-years/rollover/arm`, {
        schoolCode,
        actorUserId: stored.userId || admin.userId || "",
        actorRegistrarId: stored.registrarId || stored.adminId || admin.adminId || "",
        targetYearKey: targetRolloverYear.trim(),
        confirmationPhrase: rolloverPhraseInput.trim(),
        password: rolloverPassword,
        delaySeconds: Number(rolloverDelaySeconds),
      });

      const data = res.data || {};
      setPendingRollover(data.pendingRequest || null);
      setSuccess(data.message || "Rollover guard armed.");
      setRolloverPassword("");
      setRolloverPhraseInput("");
      clearRolloverModalFeedback();
    } catch (err) {
      const pendingRequest = err?.response?.data?.pendingRequest || null;
      if (pendingRequest?.requestId) {
        setPendingRollover(pendingRequest);
        setTargetRolloverYear(pendingRequest.targetYear || targetRolloverYear);
      }
      setRolloverModalError(err, "Failed to arm rollover guard.");
    } finally {
      setWorking(false);
    }
  };

  const handleCancelPendingRollover = async () => {
    if (!pendingRollover?.requestId) {
      setRolloverModalWarning("No pending rollover to cancel.");
      return;
    }

    clearRolloverModalFeedback();
    setWorking(true);
    try {
      const res = await axios.post(`${BACKEND_BASE}/api/academic-years/rollover/cancel`, {
        schoolCode,
        requestId: pendingRollover.requestId,
        actorUserId: stored.userId || admin.userId || "",
      });
      setSuccess(res.data?.message || "Pending rollover cancelled.");
      setPendingRollover(null);
      setRolloverPassword("");
      setRolloverPhraseInput("");
      clearRolloverModalFeedback();
      setShowRolloverConfirm(false);
      await fetchPendingRollover();
    } catch (err) {
      setRolloverModalError(err, "Failed to cancel pending rollover.");
    } finally {
      setWorking(false);
    }
  };

  const openRolloverConfirm = () => {
    if (pendingRollover?.requestId) {
      clearRolloverModalFeedback();
      setShowRolloverConfirm(true);
      setFeedback({ type: "", text: "" });
      return;
    }

    if (!targetRolloverYear) {
      setWarning("Please select target rollover year.");
      return;
    }

    if (targetRolloverYear === currentAcademicYear) {
      setWarning("Target year cannot be the same as current year.");
      return;
    }

    setFeedback({ type: "", text: "" });
    clearRolloverModalFeedback();
    setRolloverPhraseInput("");
    setRolloverPassword("");
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
      const [studentsObj, usersNode] = await Promise.all([
        fetchCachedJson(`${DB_URL}/YearHistory/${yearKey}/Students.json`, { ttlMs: 60000 }).catch(() => ({})),
        loadSchoolUsersNode({ rtdbBase: DB_URL }),
      ]);

      const usersObj = buildUserLookupFromNode(usersNode);
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
            background: linear-gradient(165deg, var(--page-bg-secondary) 0%, color-mix(in srgb, var(--accent-soft) 42%, var(--page-bg)) 45%, var(--surface-overlay) 100%);
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
            background: color-mix(in srgb, var(--surface-overlay) 90%, transparent);
            backdrop-filter: blur(6px);
            border: 1px solid var(--border-soft);
            border-radius: 12px;
            padding: 10px 12px;
          }
          .ay-student-panel {
            border: 1px solid var(--border-soft);
            border-radius: 12px;
            background: var(--surface-panel);
            box-shadow: var(--shadow-soft);
            padding: 12px;
          }
          .ay-student-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .ay-student-item {
            background: var(--surface-muted);
            border: 1px solid var(--border-soft);
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

      <nav className="top-navbar" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface-overlay)", backdropFilter: "blur(6px)" }}>
        <h2 style={{ color: "var(--text-primary)", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>
        <div className="nav-right">
          <Link className="icon-circle" to="/dashboard"><FaBell /></Link>
          <Link className="icon-circle" to="/all-chat"><FaFacebookMessenger /></Link>
          <ProfileAvatar imageUrl={admin.profileImage} name={admin.name} size={38} className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard ay-main-dashboard">
        <RegisterSidebar user={admin} sticky fullHeight />

        <div className="main-content" style={{ padding: "10px 20px 20px", flex: 1, minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="section-header-card" style={{ padding: 18 }}>
              <div className="section-header-card__row">
                <div>
                  <h1 className="section-header-card__title" style={{ fontSize: 24, fontWeight: 900 }}>Academic Year Management</h1>
                  <p className="section-header-card__subtitle" style={{ fontSize: 13 }}>Create, activate, archive, and rollover academic years for promotion logic.</p>
                </div>

                <div className="section-header-card__actions">
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{currentAcademicYear ? `Current: ${currentAcademicYear.replace("_", "/")}` : "No active year"}</div>
                  <button
                    type="button"
                    onClick={fetchAcademicYears}
                    disabled={loading || working}
                    style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--accent-strong)", background: "var(--surface-accent)", color: "var(--accent-strong)", borderRadius: 9, padding: "7px 10px", fontSize: 12, fontWeight: 800, cursor: loading || working ? "not-allowed" : "pointer", opacity: loading || working ? 0.6 : 1 }}
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
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{item.title}</span>
                    <FaUsers style={{ color: item.color }} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: "var(--text-primary)" }}>{item.value}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}>{item.hint}</div>
                </div>
              ))}
            </div>

            <div className="ay-grid-two">
              <div style={{ ...cardStyle, padding: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-primary)", marginBottom: 10 }}>Create New Academic Year</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={startYear}
                    onChange={(e) => setStartYear(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="2026"
                    style={{ flex: 1, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--text-primary)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                  />
                  <button
                    onClick={handleCreateYear}
                    disabled={working}
                    style={{ border: "1px solid var(--accent-strong)", background: "var(--accent-strong)", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 800, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.75 : 1, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <FaPlus /> Create
                  </button>
                </div>
              </div>

              <div style={{ ...cardStyle, padding: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-primary)", marginBottom: 10 }}>Rollover to Next Year</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <select
                    value={targetRolloverYear}
                    onChange={(e) => setTargetRolloverYear(e.target.value)}
                    disabled={!!pendingRollover?.requestId || working}
                    style={{ border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--text-primary)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
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
                    style={{ border: "1px solid var(--success)", background: "var(--success)", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.75 : 1 }}
                  >
                    {pendingRollover?.requestId ? "Manage Guard" : "Open Guard"}
                  </button>
                </div>
              </div>
            </div>

            {pendingRollover?.requestId ? (
              <div
                style={{
                  ...cardStyle,
                  padding: 16,
                  background: "linear-gradient(145deg, color-mix(in srgb, var(--surface-panel) 86%, #dbeafe 14%), color-mix(in srgb, var(--surface-accent) 62%, var(--surface-panel)))",
                  border: "1px solid color-mix(in srgb, var(--accent-strong) 26%, var(--border-soft))",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.08em", color: "var(--accent-strong)", textTransform: "uppercase" }}>Guarded Rollover Armed</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>{formatCountdown(pendingCountdownMs)}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 650 }}>
                      {canExecutePendingRollover
                          ? "The full waiting time has ended. Final execute is now unlocked."
                        : `The rollover is force-locked until ${formatRolloverDateTime(pendingRollover.executeAfter)}. The registerer must wait the full selected time before rollover is allowed, but can still cancel during the waiting period.`}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={openRolloverConfirm}
                      style={{ border: "1px solid var(--accent-strong)", background: "var(--surface-panel)", color: "var(--accent-strong)", borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                    >
                      Review Guard
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelPendingRollover}
                      disabled={working}
                      style={{ border: "1px solid var(--warning)", background: "var(--warning)", color: "#fff", borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 800, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1 }}
                    >
                      Cancel Pending
                    </button>
                    <button
                      type="button"
                      onClick={handleRollover}
                      disabled={working || !canExecutePendingRollover}
                      style={{ border: "1px solid var(--danger)", background: "var(--danger)", color: "#fff", borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 800, cursor: working || !canExecutePendingRollover ? "not-allowed" : "pointer", opacity: working || !canExecutePendingRollover ? 0.6 : 1 }}
                    >
                      Final Execute
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 14 }}>
                  {/* <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.62)", border: "1px solid var(--border-soft)" }}> */}
                    {/* <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Route</div>
                    <div style={{ marginTop: 4, fontSize: 15, fontWeight: 900, color: "var(--text-primary)" }}>{pendingRollover.currentYear?.replace("_", "/")} → {pendingRollover.targetYear?.replace("_", "/")}</div> */}
                  {/* </div> */}
                  <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.62)", border: "1px solid var(--border-soft)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Delay</div>
                    <div style={{ marginTop: 4, fontSize: 15, fontWeight: 900, color: "var(--text-primary)" }}>{formatDelayLabel(pendingRollover.delaySeconds)}</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.62)", border: "1px solid var(--border-soft)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Armed By</div>
                    <div style={{ marginTop: 4, fontSize: 15, fontWeight: 900, color: "var(--text-primary)" }}>{pendingRollover.initiatedBy?.name || "Registerer"}</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.62)", border: "1px solid var(--border-soft)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Students In Scope</div>
                    <div style={{ marginTop: 4, fontSize: 15, fontWeight: 900, color: "var(--text-primary)" }}>{pendingRollover.preview?.archiveCounts?.students || 0}</div>
                  </div>
                </div>
              </div>
            ) : null}

            {feedback.text ? (
              <div
                style={{
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  border: `1px solid ${feedback.type === "error" ? "var(--danger-border)" : feedback.type === "warning" ? "var(--warning-border)" : "var(--border-strong)"}`,
                  background: feedback.type === "error" ? "var(--danger-soft)" : feedback.type === "warning" ? "var(--warning-soft)" : "var(--surface-accent)",
                  color: feedback.type === "error" ? "var(--danger)" : feedback.type === "warning" ? "var(--warning)" : "var(--accent-strong)",
                }}
              >
                {feedback.text}
              </div>
            ) : null}

            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", fontWeight: 800, color: "var(--text-primary)", borderBottom: "1px solid var(--border-soft)" }}>Academic Years</div>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.7fr 1.2fr", padding: "10px 14px", borderBottom: "1px solid var(--border-soft)", fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>
                <div>Year</div>
                <div>Status</div>
                <div>Current</div>
                <div>Actions</div>
              </div>

              {loading ? (
                <div style={{ padding: 14, fontSize: 13, color: "var(--text-muted)" }}>Loading...</div>
              ) : yearRows.length === 0 ? (
                <div style={{ padding: 14, fontSize: 13, color: "var(--text-muted)" }}>No academic years created yet.</div>
              ) : (
                yearRows.map(([yearKey, row]) => {
                  const status = String(row?.status || "inactive");
                  const isCurrent = !!row?.isCurrent;
                  const isExpanded = selectedHistoryYear === yearKey;
                  return (
                    <div key={yearKey} style={{ borderTop: "1px solid var(--border-soft)" }}>
                      <div
                        onClick={() => fetchYearHistoryStudents(yearKey)}
                        style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.7fr 1.2fr", padding: "10px 14px", alignItems: "center", cursor: "pointer", background: isExpanded ? "var(--surface-muted)" : "transparent" }}
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
                              border: "1px solid var(--border-soft)",
                              background: "var(--surface-panel)",
                              color: "var(--success)",
                              transition: "transform .2s ease",
                              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                              flexShrink: 0,
                            }}
                          >
                            <FaChevronDown style={{ width: 12, height: 12 }} />
                          </span>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
                          style={{ border: "1px solid var(--accent)", background: "var(--accent)", color: "#fff", borderRadius: 7, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: working || isCurrent ? "not-allowed" : "pointer", opacity: working || isCurrent ? 0.6 : 1 }}
                        >
                          Activate
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveYear(yearKey);
                          }}
                          disabled={working || status === "archived"}
                          style={{ border: "1px solid var(--warning)", background: "var(--warning)", color: "#fff", borderRadius: 7, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: working || status === "archived" ? "not-allowed" : "pointer", opacity: working || status === "archived" ? 0.6 : 1 }}
                        >
                          Archive
                        </button>

                        </div>
                      </div>

                      {isExpanded ? (
                        <div style={{ padding: "0 14px 12px", background: "var(--surface-muted)", borderTop: "1px dashed var(--border-strong)" }}>
                          {historyStudentsLoading ? (
                            <div style={{ paddingTop: 10, fontSize: 13, color: "var(--text-muted)" }}>Loading students...</div>
                          ) : historyStudents.length === 0 ? (
                            <div style={{ paddingTop: 10, fontSize: 13, color: "var(--text-muted)" }}>No students found for this year.</div>
                          ) : (
                            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  background: "var(--surface-panel)",
                                  border: "1px solid var(--border-soft)",
                                  borderRadius: "12px",
                                  padding: "10px 12px",
                                  boxShadow: "var(--shadow-soft)",
                                }}
                              >
                                <FaSearch style={{ color: "var(--text-muted)", fontSize: 14 }} />
                                <input
                                  value={historySearch}
                                  onChange={(e) => setHistorySearch(e.target.value)}
                                  placeholder="Search student by name or ID"
                                  style={{ width: "100%", border: "none", outline: "none", fontSize: 13, background: "transparent", color: "var(--text-primary)" }}
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

                              <div style={{ marginTop: 2, fontSize: 12, color: "var(--text-secondary)", fontWeight: 700 }}>
                                Showing {visibleHistoryStudents.length} of {historyStudents.length} students
                              </div>

                              {visibleHistoryStudents.length === 0 ? (
                                <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>No students match your search/filter.</div>
                              ) : (
                                <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, overflow: "hidden", background: "var(--surface-panel)" }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.7fr", padding: "9px 12px", borderBottom: "1px solid var(--border-soft)", fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>
                                    <div>Student</div>
                                    <div>Grade</div>
                                    <div>Section</div>
                                    <div>Action</div>
                                  </div>

                                  {visibleHistoryStudents.map((student) => (
                                    <div key={student.studentId} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.7fr", padding: "9px 12px", borderTop: "1px solid var(--border-soft)", alignItems: "center", gap: 8 }}>
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                          <ProfileAvatar
                                            imageUrl={student.profileImage}
                                            name={student.name || "Student"}
                                            size={30}
                                            style={{ border: "1px solid var(--border-strong)" }}
                                          />
                                          <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student.name}</div>
                                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{student.studentId}</div>
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
                                            border: "1px solid var(--border-strong)",
                                            background: "linear-gradient(180deg, var(--surface-accent), var(--accent-soft))",
                                            color: "var(--accent-strong)",
                                            borderRadius: 8,
                                            padding: "5px 10px",
                                            fontSize: 11,
                                            fontWeight: 800,
                                            cursor: "pointer",
                                            boxShadow: "var(--shadow-glow)",
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
              maxWidth: 760,
              background: "var(--surface-panel)",
              border: "1px solid var(--border-soft)",
              borderRadius: 20,
              boxShadow: "var(--shadow-panel)",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", color: "var(--accent-strong)", textTransform: "uppercase" }}>Protected Academic Rollover</div>
                <h3 style={{ margin: "6px 0 0", fontSize: 22, color: "var(--text-primary)", fontWeight: 900 }}>
                  {pendingRollover?.requestId ? "Countdown Guard Active" : "Arm The Rollover"}
                </h3>
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 620 }}>
                  {pendingRollover?.requestId
                    ? "The rollover is already armed. The registerer must wait the full selected time before execution is permitted. During that waiting time, the request may still be cancelled."
                    : "Type the exact phrase, re-enter the registerer password, choose the forced waiting time, then arm the rollover. As soon as it is armed, the countdown starts and execution stays blocked until the entire time finishes."}
                </p>
              </div>

              {/* <div style={{ padding: "10px 12px", borderRadius: 14, background: "linear-gradient(180deg, var(--surface-accent), var(--surface-muted))", border: "1px solid var(--border-soft)", minWidth: 180 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Route</div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>
                  {(pendingRollover?.currentYear || currentAcademicYear || "----_----").replace("_", "/")} → {(pendingRollover?.targetYear || targetRolloverYear || "----_----").replace("_", "/")}
                </div>
              </div> */}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 14, border: "1px solid var(--border-soft)", background: "var(--surface-muted)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>From Year</div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>{(pendingRollover?.currentYear || currentAcademicYear || "Not set").replace("_", "/")}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 14, border: "1px solid var(--border-soft)", background: "var(--surface-muted)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Target Year</div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>{(pendingRollover?.targetYear || targetRolloverYear || "Not selected").replace("_", "/")}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 14, border: "1px solid var(--border-soft)", background: pendingRollover?.requestId ? "linear-gradient(145deg, color-mix(in srgb, var(--surface-panel) 84%, #dbeafe 16%), var(--surface-accent))" : "var(--surface-muted)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>{pendingRollover?.requestId ? "Countdown" : "Selected Delay"}</div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>{pendingRollover?.requestId ? formatCountdown(pendingCountdownMs) : formatDelayLabel(rolloverDelaySeconds)}</div>
              </div>
            </div>

            {rolloverModalFeedback.text ? (
              <div
                style={{
                  borderRadius: 14,
                  padding: "11px 13px",
                  fontSize: 13,
                  fontWeight: 700,
                  border: `1px solid ${rolloverModalFeedback.type === "error" ? "var(--danger-border)" : "var(--warning-border)"}`,
                  background: rolloverModalFeedback.type === "error" ? "var(--danger-soft)" : "var(--warning-soft)",
                  color: rolloverModalFeedback.type === "error" ? "var(--danger)" : "var(--warning)",
                }}
              >
                {rolloverModalFeedback.text}
              </div>
            ) : null}

            {pendingRollover?.preview ? (
              <div style={{ borderRadius: 16, border: "1px solid var(--border-soft)", background: "linear-gradient(180deg, var(--surface-panel), var(--surface-muted))", padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Students</div>
                  <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{pendingRollover.preview.archiveCounts?.students || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Parents</div>
                  <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{pendingRollover.preview.archiveCounts?.parents || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Class Marks</div>
                  <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{pendingRollover.preview.archiveCounts?.classMarks || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Lesson Plans</div>
                  <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{pendingRollover.preview.archiveCounts?.lessonPlans || 0}</div>
                </div>
              </div>
            ) : null}

            {!pendingRollover?.requestId ? (
              <>
                <div style={{ borderRadius: 16, border: "1px solid var(--border-soft)", background: "linear-gradient(180deg, var(--surface-muted), var(--surface-panel))", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", marginBottom: 8 }}>Exact Confirmation Phrase</div>
                    <div style={{ borderRadius: 12, border: "1px dashed var(--accent-strong)", background: "var(--surface-panel)", padding: "10px 12px", fontSize: 14, fontWeight: 900, color: "var(--accent-strong)", wordBreak: "break-word" }}>
                      {expectedRolloverPhrase || "Select a target year first"}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", marginBottom: 8 }}>Type The Phrase</div>
                      <input
                        value={rolloverPhraseInput}
                        onChange={(e) => setRolloverPhraseInput(e.target.value.toUpperCase())}
                        placeholder="ROLL OVER 2026_2027 TO 2027_2028"
                        style={{ width: "100%", border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--text-primary)", borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 700, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", marginBottom: 8 }}>Registerer Password</div>
                      <input
                        type="password"
                        value={rolloverPassword}
                        onChange={(e) => setRolloverPassword(e.target.value)}
                        placeholder="Re-enter password"
                        style={{ width: "100%", border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--text-primary)", borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 700, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", marginBottom: 8 }}>Countdown Window</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                      {rolloverDelayOptions.map((option) => {
                        const active = rolloverDelaySeconds === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setRolloverDelaySeconds(option.value)}
                            style={{
                              textAlign: "left",
                              border: active ? "1px solid var(--accent-strong)" : "1px solid var(--border-soft)",
                              background: active ? "linear-gradient(180deg, var(--surface-accent), color-mix(in srgb, var(--accent-soft) 45%, var(--surface-panel)))" : "var(--surface-panel)",
                              color: "var(--text-primary)",
                              borderRadius: 14,
                              padding: "11px 12px",
                              cursor: "pointer",
                              boxShadow: active ? "var(--shadow-glow)" : "none",
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 900 }}>{option.label}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{option.hint}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    onClick={() => setShowRolloverConfirm(false)}
                    disabled={working}
                    style={{ border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", borderRadius: 10, padding: "9px 13px", fontSize: 12, fontWeight: 800, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1 }}
                  >
                    Close
                  </button>
                  <button
                    onClick={handleArmRollover}
                    disabled={working || !targetRolloverYear}
                    style={{ border: "1px solid var(--accent-strong)", background: "linear-gradient(180deg, var(--accent-strong), var(--accent))", color: "#fff", borderRadius: 10, padding: "9px 13px", fontSize: 12, fontWeight: 800, cursor: working || !targetRolloverYear ? "not-allowed" : "pointer", opacity: working || !targetRolloverYear ? 0.6 : 1 }}
                  >
                    Arm Guarded Rollover
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ borderRadius: 16, border: "1px solid var(--border-soft)", background: "linear-gradient(180deg, var(--surface-muted), var(--surface-panel))", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Expected Phrase</div>
                  <div style={{ borderRadius: 12, border: "1px dashed var(--accent-strong)", background: "var(--surface-panel)", padding: "10px 12px", fontSize: 14, fontWeight: 900, color: "var(--accent-strong)" }}>
                    {pendingRollover.expectedPhrase}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {canExecutePendingRollover
                      ? "The timer has completed. Final execution is now available."
                      : "Final execution is force-blocked until the full countdown finishes. If anything looks wrong, cancel this pending rollover before the waiting time ends."}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => setShowRolloverConfirm(false)}
                    disabled={working}
                    style={{ border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", borderRadius: 10, padding: "9px 13px", fontSize: 12, fontWeight: 800, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1 }}
                  >
                    Close
                  </button>
                  <button
                    onClick={handleCancelPendingRollover}
                    disabled={working}
                    style={{ border: "1px solid var(--warning)", background: "var(--warning)", color: "#fff", borderRadius: 10, padding: "9px 13px", fontSize: 12, fontWeight: 800, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1 }}
                  >
                    Cancel Pending
                  </button>
                  <button
                    onClick={handleRollover}
                    disabled={working || !canExecutePendingRollover}
                    style={{ border: "1px solid var(--danger)", background: "linear-gradient(180deg, color-mix(in srgb, var(--danger) 88%, #000 12%), var(--danger))", color: "#fff", borderRadius: 10, padding: "9px 13px", fontSize: 12, fontWeight: 800, cursor: working || !canExecutePendingRollover ? "not-allowed" : "pointer", opacity: working || !canExecutePendingRollover ? 0.6 : 1 }}
                  >
                    Final Execute Rollover
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {selectedHistoryStudent ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            background: "linear-gradient(180deg, var(--page-bg-secondary) 0%, var(--page-bg) 100%)",
            overflowY: "auto",
            padding: "16px 20px 24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 1180,
              margin: "0 auto",
              background: "var(--surface-panel)",
              border: "1px solid var(--border-soft)",
              borderRadius: 16,
              boxShadow: "var(--shadow-panel)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                color: "#fff",
                background: "linear-gradient(135deg, var(--accent-strong), var(--accent))",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ProfileAvatar
                  imageUrl={selectedHistoryStudent.profileImage}
                  name={selectedHistoryStudent.name || "Student"}
                  size={56}
                  style={{ border: "2px solid rgba(255,255,255,0.8)" }}
                />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedHistoryStudent.name || "Student"}</div>
                  <div style={{ fontSize: 12, opacity: 0.95 }}>
                    {selectedHistoryStudent.studentId || "No student ID"}
                    {selectedHistoryStudent.grade ? ` • Grade ${selectedHistoryStudent.grade}` : ""}
                    {selectedHistoryStudent.section ? ` • Section ${selectedHistoryStudent.section}` : ""}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedHistoryStudent(null)}
                style={{
                  border: "1px solid rgba(255,255,255,0.45)",
                  background: "rgba(255,255,255,0.14)",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Exit Full Screen
              </button>
            </div>

            <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, padding: 12, boxShadow: "var(--shadow-soft)" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-strong)", marginBottom: 8 }}>Overview</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ padding: 8, borderRadius: 10, border: "1px solid var(--border-soft)", background: "var(--surface-muted)", fontSize: 12, color: "var(--text-secondary)" }}><strong>Grade:</strong> {selectedHistoryStudent.grade || "—"}</div>
                  <div style={{ padding: 8, borderRadius: 10, border: "1px solid var(--border-soft)", background: "var(--surface-muted)", fontSize: 12, color: "var(--text-secondary)" }}><strong>Section:</strong> {selectedHistoryStudent.section || "—"}</div>
                  <div style={{ padding: 8, borderRadius: 10, border: "1px solid var(--border-soft)", background: "var(--surface-muted)", fontSize: 12, color: "var(--text-secondary)" }}><strong>Email:</strong> {selectedHistoryStudent.email || "—"}</div>
                  <div style={{ padding: 8, borderRadius: 10, border: "1px solid var(--border-soft)", background: "var(--surface-muted)", fontSize: 12, color: "var(--text-secondary)" }}><strong>User ID:</strong> {selectedHistoryStudent.userId || "—"}</div>
                </div>
              </div>

              <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, padding: 12, boxShadow: "var(--shadow-soft)" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-strong)", marginBottom: 8 }}>Basic Information</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  {Object.entries(selectedHistoryStudent.basicStudentInformation || {}).map(([key, value]) => (
                    <div key={`basic-${key}`} className="ay-student-item">
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{formatFieldLabel(key)}</div>
                      <div style={{ marginTop: 2, fontSize: 12, color: "var(--text-primary)", fontWeight: 700 }}>{formatFieldValue(value)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedHistoryStudent.parentInformation || selectedHistoryStudent.guardianInformation ? (
                <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, padding: 12, boxShadow: "var(--shadow-soft)" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-strong)", marginBottom: 8 }}>Guardian Information</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                    {Object.entries(selectedHistoryStudent.parentInformation || selectedHistoryStudent.guardianInformation || {}).map(([key, value]) => (
                      <div key={`guardian-${key}`} className="ay-student-item">
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{formatFieldLabel(key)}</div>
                        <div style={{ marginTop: 2, fontSize: 12, color: "var(--text-primary)", fontWeight: 700 }}>{formatFieldValue(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedHistoryStudent.contactInformation ? (
                <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, padding: 12, boxShadow: "var(--shadow-soft)" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-strong)", marginBottom: 8 }}>Contact Information</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                    {Object.entries(selectedHistoryStudent.contactInformation).map(([key, value]) => (
                      <div key={`contact-${key}`} className="ay-student-item">
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{formatFieldLabel(key)}</div>
                        <div style={{ marginTop: 2, fontSize: 12, color: "var(--text-primary)", fontWeight: 700 }}>{formatFieldValue(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, padding: 12, boxShadow: "var(--shadow-soft)", gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-strong)", marginBottom: 8 }}>Other Information</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  {Object.entries(selectedHistoryStudent)
                    .filter(([key, value]) => !["basicStudentInformation", "contactInformation", "parentInformation", "guardianInformation", "profileImage", "name", "studentId"].includes(key) && (typeof value !== "object" || Array.isArray(value)))
                    .map(([key, value]) => (
                      <div key={`other-${key}`} className="ay-student-item">
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{formatFieldLabel(key)}</div>
                        <div style={{ marginTop: 2, fontSize: 12, color: "var(--text-primary)", fontWeight: 700 }}>{formatFieldValue(value)}</div>
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
