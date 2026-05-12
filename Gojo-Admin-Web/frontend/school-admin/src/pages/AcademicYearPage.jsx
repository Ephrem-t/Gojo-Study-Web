import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaChevronDown, FaSearch, FaSyncAlt, FaUsers } from "react-icons/fa";
import ProfileAvatar from "../components/ProfileAvatar";
import { BACKEND_BASE } from "../config.js";

const PAGE_BG = "var(--page-bg)";
const ACADEMIC_YEARS_CACHE_TTL = 60 * 1000;
const YEAR_HISTORY_CACHE_TTL = 2 * 60 * 1000;
const skeletonBaseStyle = {
  background: "linear-gradient(90deg, color-mix(in srgb, var(--surface-muted) 92%, white) 0%, color-mix(in srgb, var(--surface-panel) 72%, white) 50%, color-mix(in srgb, var(--surface-muted) 92%, white) 100%)",
  backgroundSize: "200% 100%",
  animation: "academicYearSkeletonPulse 1.2s ease-in-out infinite",
  borderRadius: 10,
};

const cardStyle = {
  background: "var(--surface-panel)",
  border: "1px solid var(--border-soft)",
  borderRadius: 16,
  boxShadow: "var(--shadow-soft)",
};

const getSafeImageUrl = (value, fallback = "/default-profile.png") => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return fallback;
  }

  const lowerValue = normalizedValue.toLowerCase();
  if (lowerValue.startsWith("file://") || lowerValue.startsWith("content://")) {
    return fallback;
  }

  return normalizedValue;
};

const readSessionCache = (key, ttlMs) => {
  try {
    const rawValue = sessionStorage.getItem(key);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue?.savedAt || Date.now() - parsedValue.savedAt > ttlMs) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsedValue.data ?? null;
  } catch (error) {
    return null;
  }
};

const writeSessionCache = (key, data) => {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        data,
      })
    );
  } catch (error) {
    // Ignore cache write failures.
  }
};

const clearSessionCacheByPrefix = (prefix) => {
  try {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith(prefix)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    // Ignore cache clear failures.
  }
};

export default function AcademicYearPage() {
  const stored = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("admin") || "{}") || {};
    } catch (error) {
      return {};
    }
  }, []);

  const admin = {
    ...stored,
    name: stored.name || stored.username || "School Admin",
    adminId: stored.adminId || stored.userId || "",
    profileImage: getSafeImageUrl(stored.profileImage, "/default-profile.png"),
    username: stored.username || "",
  };
  const PRIMARY = "#007afb";
  const BACKGROUND = "#ffffff";
  const ACCENT = "#00B6A9";

  const schoolCode = stored.schoolCode || "";
  const API_BASE = `${BACKEND_BASE}/api`;
  const academicYearsCacheKey = schoolCode ? `academic-years:v2:${schoolCode}` : "academic-years:v2";
  const yearHistoryCachePrefix = schoolCode ? `academic-year-history:v2:${schoolCode}:` : "academic-year-history:v2:";

  const [academicYears, setAcademicYears] = useState({});
  const [currentAcademicYear, setCurrentAcademicYear] = useState("");
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
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

  const historyGradeOptions = useMemo(() => {
    const values = new Set(
      historyStudents.map((row) => String(row?.grade || "").trim()).filter(Boolean)
    );
    return ["All", ...Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))];
  }, [historyStudents]);

  const historySectionOptions = useMemo(() => {
    const filteredByGrade = historyStudents.filter((row) => {
      if (historySelectedGrade === "All") return true;
      return String(row?.grade || "").trim() === historySelectedGrade;
    });

    const values = new Set(
      filteredByGrade.map((row) => String(row?.section || "").trim()).filter(Boolean)
    );

    return ["All", ...Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))];
  }, [historyStudents, historySelectedGrade]);

  const visibleHistoryStudents = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return historyStudents.filter((row) => {
      const grade = String(row?.grade || "").trim();
      const section = String(row?.section || "").trim();
      const name = String(row?.name || "").toLowerCase();
      const studentId = String(row?.studentId || "").toLowerCase();

      if (historySelectedGrade !== "All" && grade !== historySelectedGrade) return false;
      if (historySelectedSection !== "All" && section !== historySelectedSection) return false;

      if (!query) return true;
      return name.includes(query) || studentId.includes(query) || grade.toLowerCase().includes(query) || section.toLowerCase().includes(query);
    });
  }, [historySearch, historySelectedGrade, historySelectedSection, historyStudents]);

  const setError = (error, fallback) => {
    const message = error?.response?.data?.message || error?.message || fallback;
    setFeedback({ type: "error", text: message });
  };

  const setSuccess = (message) => setFeedback({ type: "success", text: message });
  const setWarning = (message) => setFeedback({ type: "warning", text: message });

  const resetAcademicYearCaches = () => {
    clearSessionCacheByPrefix(academicYearsCacheKey);
    clearSessionCacheByPrefix(yearHistoryCachePrefix);
  };

  const chipStyle = (active) => ({
    padding: "6px 12px",
    borderRadius: 999,
    background: active ? "var(--accent-strong)" : "var(--surface-accent)",
    color: active ? "#fff" : "var(--accent-strong)",
    cursor: "pointer",
    border: active ? "1px solid var(--accent-strong)" : "1px solid var(--border-strong)",
    fontSize: 11,
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
      .replace(/^./, (segment) => segment.toUpperCase());
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
  const renderSkeletonLine = (width, height = 12, extraStyle = {}) => (
    <div style={{ ...skeletonBaseStyle, width, height, ...extraStyle }} />
  );
  const pageCardStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    borderRadius: 16,
    boxShadow: "var(--shadow-soft)",
  };
  const heroCardStyle = {
    ...pageCardStyle,
    padding: 18,
    position: "relative",
    overflow: "hidden",
    background: "linear-gradient(135deg, color-mix(in srgb, var(--surface-panel) 88%, white) 0%, color-mix(in srgb, var(--surface-panel) 94%, var(--surface-accent)) 100%)",
  };

  const fetchAcademicYears = async () => {
    if (!schoolCode) {
      setError(null, "Missing schoolCode in session. Please login again.");
      return;
    }

    const cachedPayload = readSessionCache(academicYearsCacheKey, ACADEMIC_YEARS_CACHE_TTL);
    if (cachedPayload) {
      setAcademicYears(cachedPayload.academicYears || {});
      setCurrentAcademicYear(cachedPayload.currentAcademicYear || "");
      setFeedback({ type: "", text: "" });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/academic-years`, {
        params: { schoolCode },
        timeout: 12000,
      });

      const fetchedAcademicYears = response?.data?.academicYears || {};
      const detectedCurrentAcademicYear = response?.data?.currentAcademicYear || "";

      setAcademicYears(fetchedAcademicYears);
      setCurrentAcademicYear(detectedCurrentAcademicYear);
      writeSessionCache(academicYearsCacheKey, {
        academicYears: fetchedAcademicYears,
        currentAcademicYear: detectedCurrentAcademicYear,
      });
      setFeedback({ type: "", text: "" });
    } catch (error) {
      setError(error, "Failed to load academic years.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcademicYears();
  }, [schoolCode]);

  const handleActivateYear = async (yearKey) => {
    const confirmed = window.confirm(`Set ${yearKey.replace("_", "/")} as the current academic year?`);
    if (!confirmed) return;

    setWorking(true);
    try {
      const response = await axios.post(`${BACKEND_BASE}/api/academic-years/activate`, {
        schoolCode,
        yearKey,
      });
      resetAcademicYearCaches();
      setSuccess(response.data?.message || "Academic year activated.");
      await fetchAcademicYears();
    } catch (error) {
      setError(error, "Failed to activate academic year.");
    } finally {
      setWorking(false);
    }
  };

  const handleArchiveYear = async (yearKey) => {
    const confirmed = window.confirm(`Archive ${yearKey.replace("_", "/")}?`);
    if (!confirmed) return;

    setWorking(true);
    try {
      const response = await axios.post(`${BACKEND_BASE}/api/academic-years/archive`, {
        schoolCode,
        yearKey,
      });
      resetAcademicYearCaches();
      setSuccess(response.data?.message || "Academic year archived.");
      await fetchAcademicYears();
    } catch (error) {
      setError(error, "Failed to archive academic year.");
    } finally {
      setWorking(false);
    }
  };

  const fetchYearHistoryStudents = async (yearKey) => {
    if (!yearKey) return;

    const historyCacheKey = `${yearHistoryCachePrefix}${yearKey}`;

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

    const cachedHistoryStudents = readSessionCache(historyCacheKey, YEAR_HISTORY_CACHE_TTL);
    if (cachedHistoryStudents) {
      setHistoryStudents(cachedHistoryStudents);
      setHistoryStudentsLoading(false);
      return;
    }

    setHistoryStudentsLoading(true);

    try {
      const response = await axios.get(`${API_BASE}/academic-years/history-students`, {
        params: { schoolCode, yearKey },
        timeout: 12000,
      });

      const list = (response?.data?.students || []).map((row) => {
        const student = row || {};
        const studentBasicInfo = student.basicStudentInformation || {};
        return {
          studentId: student.studentId || "",
          ...student,
          grade: student.grade || studentBasicInfo.grade || "",
          section: student.section || studentBasicInfo.section || "",
          name: student.name || studentBasicInfo.name || [studentBasicInfo.firstName, studentBasicInfo.middleName, studentBasicInfo.lastName].filter(Boolean).join(" ") || "Student",
          profileImage: getSafeImageUrl(
            student.profileImage || studentBasicInfo.studentPhoto,
            "/default-profile.png"
          ),
          email: student.email || studentBasicInfo.email || "",
        };
      });

      writeSessionCache(historyCacheKey, list);
      setHistoryStudents(list);
    } catch (error) {
      setError(error, "Failed to load YearHistory students.");
    } finally {
      setHistoryStudentsLoading(false);
    }
  };

  return (
    <div
      className="dashboard-page"
      style={{
        background: BACKGROUND,
        minHeight: "100vh",
        color: "var(--text-primary)",
        "--page-bg": BACKGROUND,
        "--page-bg-secondary": "#F7FBFF",
        "--surface-panel": BACKGROUND,
        "--surface-muted": "#F8FBFF",
        "--surface-accent": "#EAF4FF",
        "--surface-strong": "#D7E7FB",
        "--border-soft": "#D7E7FB",
        "--border-strong": "#B5D2F8",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": PRIMARY,
        "--accent-soft": "#E7F2FF",
        "--accent-strong": PRIMARY,
        "--success": ACCENT,
        "--success-soft": "#E9FBF9",
        "--success-border": "#AAEDE7",
        "--warning": "#DC2626",
        "--warning-soft": "#FEE2E2",
        "--warning-border": "#FCA5A5",
        "--danger": "#b91c1c",
        "--danger-border": "#fca5a5",
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
        "--surface-overlay": "#F1F8FF",
        "--input-bg": BACKGROUND,
        "--input-border": "#B5D2F8",
        "--shadow-soft": "0 10px 24px rgba(0, 122, 251, 0.10)",
        "--shadow-panel": "0 14px 30px rgba(0, 122, 251, 0.14)",
        "--shadow-glow": "0 0 0 2px rgba(0, 122, 251, 0.18)",
      }}
    >
      <style>
        {`
          @keyframes academicYearSkeletonPulse {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
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
        `}
      </style>

      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "18px 14px", minHeight: "100vh", background: "var(--page-bg)", width: "100%", boxSizing: "border-box", alignItems: "flex-start" }}>
        <div
          className="admin-sidebar-spacer"
          style={{
            width: "var(--sidebar-width)",
            minWidth: "var(--sidebar-width)",
            flex: "0 0 var(--sidebar-width)",
            pointerEvents: "none",
          }}
        />

        <div className="main-content google-main" style={{ flex: "1 1 0", minWidth: 0, maxWidth: "none", margin: "0", boxSizing: "border-box", alignSelf: "flex-start", minHeight: "calc(100vh - 24px)", overflowY: "visible", overflowX: "hidden", position: "relative", top: "auto", scrollbarWidth: "thin", scrollbarColor: "transparent transparent", padding: "0 12px 0 2px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 1120, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="section-header-card" style={heroCardStyle}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, var(--accent), var(--accent-strong), color-mix(in srgb, var(--accent) 68%, white))" }} />
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
                    style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--accent-strong)", background: "var(--surface-accent)", color: "var(--accent-strong)", borderRadius: 9, padding: "7px 10px", fontSize: 12, fontWeight: 800, cursor: loading || working ? "not-allowed" : "pointer", opacity: loading || working ? 0.6 : 1, boxShadow: "var(--shadow-glow)" }}
                  >
                    <FaSyncAlt /> Refresh
                  </button>
                </div>
              </div>
            </div>

            <div className="ay-stats">
              {[
                { title: "Total Years", value: stats.totalYears, hint: "Configured academic years", color: "#2563eb" },
                { title: "Active", value: stats.activeCount, hint: "Live years", color: "#0f766e" },
                { title: "Archived", value: stats.archivedCount, hint: "Closed years", color: "#c2410c" },
                { title: "History Students", value: stats.historyStudents, hint: selectedHistoryYear ? selectedHistoryYear.replace("_", "/") : "Current selection", color: "#7c3aed" },
              ].map((item) => (
                <div key={item.title} style={{ ...pageCardStyle, padding: 12, background: "linear-gradient(180deg, var(--surface-panel) 0%, color-mix(in srgb, var(--surface-panel) 82%, var(--surface-accent)) 100%)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{item.title}</span>
                    <FaUsers style={{ color: item.color }} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: "var(--text-primary)" }}>{item.value}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}>{item.hint}</div>
                </div>
              ))}
            </div>

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

            <div style={{ ...pageCardStyle, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", fontWeight: 800, color: "var(--text-primary)", borderBottom: "1px solid var(--border-soft)" }}>Academic Years</div>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.7fr", padding: "10px 14px", borderBottom: "1px solid var(--border-soft)", fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>
                <div>Year</div>
                <div>Status</div>
                <div>Current</div>
              </div>

              {loading ? (
                <div style={{ padding: 14, display: "grid", gap: 10 }}>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={`academic-year-skeleton-${index}`} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.7fr", gap: 12, alignItems: "center" }}>
                      {renderSkeletonLine("72%", 16)}
                      {renderSkeletonLine("48%", 16)}
                      {renderSkeletonLine("28px", 16)}
                    </div>
                  ))}
                </div>
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
                        style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.7fr", padding: "10px 14px", alignItems: "center", cursor: "pointer", background: isExpanded ? "var(--surface-muted)" : "transparent" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span
                            aria-hidden="true"
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 999, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--success)", transition: "transform .2s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
                          >
                            <FaChevronDown style={{ width: 12, height: 12 }} />
                          </span>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {row?.label || yearKey.replace("_", "/")}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: status === "active" ? "#166534" : status === "archived" ? "#9a3412" : "#475569" }}>{status}</div>
                        <div style={{ fontSize: 13 }}>{isCurrent ? "✅" : "—"}</div>
                      </div>

                      {isExpanded ? (
                        <div style={{ padding: "0 14px 12px", background: "var(--surface-muted)", borderTop: "1px dashed var(--border-strong)" }}>
                          {historyStudentsLoading ? (
                            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                              <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, padding: "10px 12px", boxShadow: "var(--shadow-soft)" }}>
                                {renderSkeletonLine("100%", 16)}
                              </div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {Array.from({ length: 4 }).map((_, index) => (
                                  <div key={`history-chip-skeleton-${index}`} style={{ ...skeletonBaseStyle, width: 92, height: 30, borderRadius: 999 }} />
                                ))}
                              </div>
                              <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, overflow: "hidden", background: "var(--surface-panel)" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.7fr", padding: "9px 12px", borderBottom: "1px solid var(--border-soft)", gap: 10 }}>
                                  {renderSkeletonLine("70%")}
                                  {renderSkeletonLine("56%")}
                                  {renderSkeletonLine("56%")}
                                  {renderSkeletonLine("48%")}
                                </div>
                                {Array.from({ length: 4 }).map((_, index) => (
                                  <div key={`history-row-skeleton-${index}`} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.7fr", padding: "12px", borderTop: "1px solid var(--border-soft)", alignItems: "center", gap: 10 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <div style={{ ...skeletonBaseStyle, width: 30, height: 30, borderRadius: "50%" }} />
                                      <div style={{ display: "grid", gap: 6, width: "100%" }}>
                                        {renderSkeletonLine("58%")}
                                        {renderSkeletonLine("34%", 10)}
                                      </div>
                                    </div>
                                    {renderSkeletonLine("40%")}
                                    {renderSkeletonLine("40%")}
                                    {renderSkeletonLine("64px", 28, { borderRadius: 8 })}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : historyStudents.length === 0 ? (
                            <div style={{ paddingTop: 10, fontSize: 13, color: "var(--text-muted)" }}>No students found for this year.</div>
                          ) : (
                            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, padding: "10px 12px", boxShadow: "var(--shadow-soft)" }}>
                                <FaSearch style={{ color: "var(--text-muted)", fontSize: 14 }} />
                                <input
                                  value={historySearch}
                                  onChange={(event) => setHistorySearch(event.target.value)}
                                  placeholder="Search student by name or ID"
                                  style={{ width: "100%", border: "none", outline: "none", fontSize: 13, background: "transparent", color: "var(--text-primary)" }}
                                />
                              </div>

                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: "100%", overflowX: "auto", paddingBottom: 1 }}>
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
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: "100%", overflowX: "auto", paddingBottom: 1 }}>
                                  {historySectionOptions.map((section) => (
                                    <button key={section} onClick={() => setHistorySelectedSection(section)} style={chipStyle(historySelectedSection === section)}>
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
                                          <ProfileAvatar src={getSafeImageUrl(student.profileImage, "/default-profile.png")} name={student.name || "Student"} alt={student.name || "Student"} loading="lazy" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border-strong)", flexShrink: 0 }} />
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
                                          style={{ border: "1px solid var(--border-strong)", background: "linear-gradient(180deg, var(--surface-accent), var(--accent-soft))", color: "var(--accent-strong)", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer", boxShadow: "var(--shadow-glow)" }}
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

      {selectedHistoryStudent ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "linear-gradient(180deg, var(--page-bg-secondary) 0%, var(--page-bg) 100%)", overflowY: "auto", padding: "16px 20px 24px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 16, boxShadow: "var(--shadow-panel)", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 16px", color: "#fff", background: "linear-gradient(135deg, var(--accent-strong), var(--accent))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ProfileAvatar src={getSafeImageUrl(selectedHistoryStudent.profileImage, "/default-profile.png")} name={selectedHistoryStudent.name || "Student"} alt={selectedHistoryStudent.name || "Student"} style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.8)", objectFit: "cover" }} />
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
                style={{ border: "1px solid rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.14)", color: "#fff", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 700 }}
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
                    <div key={`basic-${key}`} style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", borderRadius: 10, padding: "9px 10px" }}>
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
                      <div key={`guardian-${key}`} style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", borderRadius: 10, padding: "9px 10px" }}>
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
                      <div key={`contact-${key}`} style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", borderRadius: 10, padding: "9px 10px" }}>
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
                      <div key={`other-${key}`} style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", borderRadius: 10, padding: "9px 10px" }}>
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
