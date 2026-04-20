import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ProfileAvatar from "../components/ProfileAvatar";
import { fetchCachedJson } from "../utils/rtdbCache";

export default function OverviewPage() {
  const getIsNarrow = () => (typeof window !== "undefined" ? window.innerWidth <= 1100 : false);

  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem("registrar") || localStorage.getItem("admin") || "{}") || {};
    } catch (e) {
      return {};
    }
  })();

  const schoolCode = stored.schoolCode || "";
  const DB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";
  const DB_URL = schoolCode ? `${DB_BASE}/Platform1/Schools/${schoolCode}` : DB_BASE;
  const OVERVIEW_CACHE_KEY = schoolCode ? `overview-cache:${schoolCode}` : "";

  const readOverviewCache = () => {
    if (!OVERVIEW_CACHE_KEY || typeof window === "undefined") {
      return null;
    }

    try {
      const cached = JSON.parse(sessionStorage.getItem(OVERVIEW_CACHE_KEY) || "null");
      if (!cached || typeof cached !== "object") {
        return null;
      }

      const cachedAt = Number(cached.cachedAt || 0);
      if (!cachedAt || Date.now() - cachedAt > 5 * 60 * 1000) {
        return null;
      }

      return cached;
    } catch (error) {
      return null;
    }
  };

  const cachedOverview = readOverviewCache();

  const [isNarrow, setIsNarrow] = useState(getIsNarrow());
  const [loading, setLoading] = useState(!cachedOverview);
  const [students, setStudents] = useState(cachedOverview?.students || []);
  const [parentsCount, setParentsCount] = useState(cachedOverview?.parentsCount || 0);
  const [postsCount, setPostsCount] = useState(cachedOverview?.postsCount || 0);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [hoveredTrendKey, setHoveredTrendKey] = useState("");

  useEffect(() => {
    const onResize = () => setIsNarrow(getIsNarrow());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const NODE_CACHE_TTL_MS = 5 * 60 * 1000;

    const fetchNodeCount = async (nodeName) => {
      try {
        const shallowData = await fetchCachedJson(`${DB_URL}/${nodeName}.json?shallow=true`, {
          ttlMs: NODE_CACHE_TTL_MS,
          fallbackValue: null,
        });
        if (shallowData && typeof shallowData === "object") {
          return Object.keys(shallowData || {}).length;
        }
      } catch (error) {
        // fall through to the full-node fallback
      }

      const fallbackNode = await fetchCachedJson(`${DB_URL}/${nodeName}.json`, {
        ttlMs: NODE_CACHE_TTL_MS,
        fallbackValue: {},
      });
      return Object.keys(fallbackNode || {}).length;
    };

    const loadOverview = async () => {
      try {
        if (!cachedOverview && isMounted) {
          setLoading(true);
        }

        const [studentsObj, resolvedParentsCount, resolvedPostsCount] = await Promise.all([
          fetchCachedJson(`${DB_URL}/Students.json`, {
            ttlMs: NODE_CACHE_TTL_MS,
            fallbackValue: {},
          }),
          fetchNodeCount("Parents"),
          fetchNodeCount("posts"),
        ]);

        const studentRows = Object.entries(studentsObj).map(([studentId, studentNode]) => {
          const basicStudentInfo = studentNode?. basicStudentInformation || {};
          return {
            studentId,
            userId: studentNode?.userId || "",
            name: basicStudentInfo?.name || studentNode?.name || studentId || "No Name",
            profileImage:
              basicStudentInfo?.studentPhoto ||
              studentNode?.studentPhoto ||
              studentNode?.profileImage ||
              "/default-profile.png",
            grade: basicStudentInfo?.grade || studentNode?.grade || "-",
            section: basicStudentInfo?.section || studentNode?.section || "-",
            gender: String(basicStudentInfo?.gender || studentNode?.gender || "").trim().toLowerCase(),
            status: String(basicStudentInfo?.status || studentNode?.status || "active").toLowerCase(),
            createdAt: studentNode?.createdAt || studentNode?.registeredAt || basicStudentInfo?.admissionDate || null,
          };
        });

        if (!isMounted) {
          return;
        }

        setStudents(studentRows);
        setParentsCount(resolvedParentsCount);
        setPostsCount(resolvedPostsCount);

        if (OVERVIEW_CACHE_KEY && typeof window !== "undefined") {
          sessionStorage.setItem(
            OVERVIEW_CACHE_KEY,
            JSON.stringify({
              students: studentRows,
              parentsCount: resolvedParentsCount,
              postsCount: resolvedPostsCount,
              cachedAt: Date.now(),
            })
          );
        }
      } catch (error) {
        console.error("Overview fetch error:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadOverview();

    return () => {
      isMounted = false;
    };
  }, [DB_URL, OVERVIEW_CACHE_KEY]);

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

    const gradeAnalytics = Object.entries(gradeCounts)
      .map(([grade, count]) => ({ grade, count }))
      .sort((first, second) => {
        const firstNum = Number(first.grade);
        const secondNum = Number(second.grade);
        const firstIsNum = Number.isFinite(firstNum);
        const secondIsNum = Number.isFinite(secondNum);
        if (firstIsNum && secondIsNum) return firstNum - secondNum;
        if (firstIsNum) return -1;
        if (secondIsNum) return 1;
        return String(first.grade).localeCompare(String(second.grade));
      });

    const maxGradeCount = gradeAnalytics.reduce(
      (maxValue, row) => Math.max(maxValue, Number(row.count || 0)),
      0
    );

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
      });

    const thisMonthRegistrationRate = totalStudents
      ? Math.round((thisMonthRegistrations.length / totalStudents) * 100)
      : 0;

    const monthlyTrendMap = new Map();
    const monthlyTrend = [];
    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date(currentYear, currentMonth - index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString(undefined, { month: "short" });
      const bucket = { key, label, count: 0 };
      monthlyTrend.push(bucket);
      monthlyTrendMap.set(key, bucket);
    }

    students.forEach((student) => {
      if (!student.createdAt) return;
      const registeredDate = new Date(student.createdAt);
      if (Number.isNaN(registeredDate.getTime())) return;
      const key = `${registeredDate.getFullYear()}-${String(registeredDate.getMonth() + 1).padStart(2, "0")}`;
      const target = monthlyTrendMap.get(key);
      if (target) target.count += 1;
    });

    const monthlyTrendMax = monthlyTrend.reduce(
      (maxValue, row) => Math.max(maxValue, Number(row.count || 0)),
      0
    );

    return {
      totalStudents,
      activeStudents,
      inactiveStudents,
      maleCount,
      femaleCount,
      gradeAnalytics,
      maxGradeCount,
      recentStudents,
      thisMonthRegistrationCount: thisMonthRegistrations.length,
      thisMonthRegistrationRate,
      monthlyTrend,
      monthlyTrendMax,
    };
  }, [students]);

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };

  const PRIMARY = "#007afb";
  const BACKGROUND = "#ffffff";
  const ACCENT = "#00B6A9";

  const shellCardStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    borderRadius: 16,
    // boxShadow: "var(--shadow-soft)",
  };
  const FEED_MAX_WIDTH = "min(1320px, 100%)";
  const headerCardStyle = {
    ...shellCardStyle,
    width: "100%",
    maxWidth: FEED_MAX_WIDTH,
    margin: "0 auto 14px",
    alignSelf: "stretch",
    color: "var(--text-primary)",
    padding: "18px 20px",
    position: "relative",
    overflow: "hidden",
    background: "linear-gradient(135deg, color-mix(in srgb, var(--surface-panel) 88%, white) 0%, color-mix(in srgb, var(--surface-panel) 94%, var(--surface-accent)) 100%)",
  };
  const statCardStyle = {
    ...shellCardStyle,
    borderRadius: 14,
    padding: "16px 18px",
    minHeight: 108,
    position: "relative",
    overflow: "hidden",
    background: "linear-gradient(180deg, var(--surface-panel) 0%, color-mix(in srgb, var(--surface-panel) 82%, var(--surface-accent)) 100%)",
  };
  const softRowStyle = {
    display: "grid",
    alignItems: "center",
    gap: 12,
    background: "linear-gradient(180deg, var(--surface-muted) 0%, color-mix(in srgb, var(--surface-muted) 84%, white) 100%)",
    border: "1px solid var(--border-soft)",
    borderRadius: 14,
    padding: "10px 12px",
  };
  const progressTrackStyle = {
    height: 9,
    background: "color-mix(in srgb, var(--surface-strong) 88%, white)",
    borderRadius: 999,
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
            <div style={{ width: "100%", maxWidth: FEED_MAX_WIDTH, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 56 }}>
          <div style={headerCardStyle}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, var(--accent), var(--accent-strong), color-mix(in srgb, var(--accent) 68%, white))" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.01em" }}>Overview</div>
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)", maxWidth: 560, lineHeight: 1.5 }}>Operational snapshot for students, parents and posts.</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, background: "color-mix(in srgb, var(--surface-muted) 86%, white)", border: "1px solid var(--border-soft)", fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: loading ? "var(--warning, #d97706)" : "var(--success)", boxShadow: loading ? "0 0 0 4px color-mix(in srgb, var(--warning, #d97706) 18%, transparent)" : "0 0 0 4px color-mix(in srgb, var(--success) 18%, transparent)" }} />
                {loading ? "Loading..." : `Updated: ${new Date().toLocaleString()}`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, position: "relative", zIndex: 1 }}>
              {[
                `Students: ${loading ? "--" : summary.totalStudents}`,
                `Parents: ${loading ? "--" : parentsCount}`,
                `Posts: ${loading ? "--" : postsCount}`,
              ].map((item) => (
                <div key={item} style={{ padding: "7px 12px", borderRadius: 999, background: "color-mix(in srgb, var(--surface-panel) 72%, white)", border: "1px solid var(--border-soft)", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { title: "Total Students", value: summary.totalStudents, tone: "var(--accent-strong)", note: "Registered learners" },
              { title: "Active Students", value: summary.activeStudents, tone: "var(--success)", note: "Currently active" },
              { title: "Inactive Students", value: summary.inactiveStudents, tone: "var(--danger)", note: "Need follow-up" },
              { title: "Male Count", value: summary.maleCount, tone: "color-mix(in srgb, var(--success) 82%, var(--text-primary))", note: "Current roster" },
              { title: "Female Count", value: summary.femaleCount, tone: "color-mix(in srgb, var(--accent) 52%, var(--text-primary))", note: "Current roster" },
            ].map((card) => (
              <div key={card.title} style={statCardStyle}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${card.tone}, color-mix(in srgb, ${card.tone} 42%, white))` }} />
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.02em" }}>{card.title}</div>
                <div style={{ marginTop: 10, fontSize: 32, lineHeight: 1, fontWeight: 800, color: card.tone }}>{loading ? "--" : card.value}</div>
                <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{card.note}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1.4fr 1fr", gap: 12, alignItems: "start" }}>
            <div style={{ ...shellCardStyle, borderRadius: 18, padding: 16, background: "linear-gradient(180deg, #ffffff 0%, color-mix(in srgb, var(--surface-accent) 26%, white) 100%)", border: "1px solid color-mix(in srgb, var(--accent) 10%, var(--border-soft))" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>New Registrations (This Month)</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)", maxWidth: 440 }}>Latest students added during the current calendar month, paired with a cleaner registration trend snapshot.</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "7px 11px", borderRadius: 999, background: "#ffffff", border: "1px solid color-mix(in srgb, var(--accent) 10%, var(--border-soft))", fontWeight: 700 }}>
                  {loading ? "--" : summary.thisMonthRegistrationCount} registrations • Posts: {loading ? "--" : postsCount}
                </div>
              </div>

              {loading ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading students...</div>
              ) : summary.recentStudents.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "16px 18px", borderRadius: 16, background: "#ffffff", border: "1px solid var(--border-soft)" }}>No registrations found for this month yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {(showAllRecent ? summary.recentStudents : summary.recentStudents.slice(0, 5)).map((student, index) => (
                    <div key={student.studentId} style={{ ...softRowStyle, gridTemplateColumns: isNarrow ? "48px 1fr" : "48px minmax(0, 1fr) auto", padding: "12px 14px", borderRadius: 16, background: "#ffffff", boxShadow: "0 12px 24px rgba(15, 23, 42, 0.04)" }}>
                      <div style={{ position: "relative", width: 46, height: 46 }}>
                        <ProfileAvatar src={student.profileImage} name={student.name} alt={student.name} loading="lazy" style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border-strong)" }} />
                        <div style={{ position: "absolute", right: -2, bottom: -1, minWidth: 18, height: 18, borderRadius: 999, background: "var(--accent-strong)", color: "#ffffff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #ffffff" }}>{index + 1}</div>
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{student.name}</div>
                          <div style={{ padding: "3px 8px", borderRadius: 999, background: "color-mix(in srgb, var(--surface-accent) 78%, white)", border: "1px solid color-mix(in srgb, var(--accent) 10%, var(--border-soft))", fontSize: 10, color: "var(--text-secondary)", fontWeight: 700 }}>{student.studentId}</div>
                        </div>
                        <div style={{ marginTop: 5, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "var(--text-secondary)" }}>
                          <span>Registered: {formatDateTime(student.createdAt)}</span>
                          <span style={{ color: "var(--text-muted)" }}>Status: {student.status || "active"}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, gridColumn: isNarrow ? "2 / 3" : "auto", justifySelf: isNarrow ? "flex-start" : "flex-end" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-strong)", padding: "6px 10px", borderRadius: 999, background: "color-mix(in srgb, var(--accent) 10%, white)", border: "1px solid color-mix(in srgb, var(--accent) 18%, var(--border-soft))" }}>
                          G{student.grade} • {student.section}
                        </div>
                      </div>
                    </div>
                  ))}

                  {summary.recentStudents.length > 5 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllRecent((prev) => !prev)}
                      style={{
                        marginTop: 2,
                        alignSelf: "flex-start",
                        border: "1px solid var(--border-soft)",
                        borderRadius: 999,
                        background: "#ffffff",
                        color: "var(--accent-strong)",
                        fontSize: 12,
                        fontWeight: 800,
                        padding: "7px 12px",
                        cursor: "pointer",
                        // boxShadow: "0 10px 22px rgba(15, 23, 42, 0.05)",
                      }}
                    >
                      {showAllRecent ? "See less" : `See more (${summary.recentStudents.length - 5})`}
                    </button>
                  ) : null}
                </div>
              )}

              <div style={{ borderTop: "1px solid color-mix(in srgb, var(--accent) 10%, var(--border-soft))", paddingTop: 12, marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>Monthly Registration Trend</div>
                {(() => {
                  const trend = summary.monthlyTrend || [];
                  const maxValue = Math.max(summary.monthlyTrendMax || 0, 1);
                  const chartScaleMax = Math.max(1, Math.ceil(maxValue * 1.18));
                  const chartWidth = 100;
                  const chartHeight = 42;
                  const step = trend.length > 1 ? chartWidth / (trend.length - 1) : 0;
                  const pointCoordinates = trend.map((row, index) => {
                    const x = trend.length > 1 ? index * step : chartWidth / 2;
                    const y = chartHeight - (Number(row.count || 0) / chartScaleMax) * chartHeight;
                    return {
                      ...row,
                      x,
                      y,
                    };
                  });
                  const points = pointCoordinates
                    .map((row, index) => {
                      const x = trend.length > 1 ? index * step : chartWidth / 2;
                      return `${x},${row.y}`;
                    })
                    .join(" ");
                  const areaPoints = [
                    `0,${chartHeight}`,
                    ...pointCoordinates.map((row) => `${row.x},${row.y}`),
                    `${chartWidth},${chartHeight}`,
                  ].join(" ");
                  const latestPoint = pointCoordinates[pointCoordinates.length - 1] || null;
                  const activePoint = pointCoordinates.find((row) => row.key === hoveredTrendKey) || latestPoint;
                  const gridValues = [0, 0.33, 0.66, 1].map((ratio) => ({
                    value: Math.round(chartScaleMax * ratio),
                    y: chartHeight - chartHeight * ratio,
                  }));

                  return (
                    <>
                      <div style={{ background: "#ffffff", padding: "6px 0 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                          <div>
                            {/* <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent-strong)", letterSpacing: "0.03em", textTransform: "uppercase" }}>Registration momentum</div> */}
                            {/* <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)" }}>Hover the points to inspect each month.</div> */}
                          </div>
                          <div style={{ padding: "8px 11px", borderRadius: 999, background: "color-mix(in srgb, var(--surface-accent) 55%, white)", border: "1px solid color-mix(in srgb, var(--accent) 10%, var(--border-soft))", fontSize: 11, color: "var(--text-secondary)", fontWeight: 700 }}>
                            {activePoint ? `${activePoint.label}: ${activePoint.count}` : "No trend data"}
                          </div>
                        </div>
                        <svg viewBox={`0 0 ${chartWidth} 52`} style={{ width: "100%", height: 216, display: "block" }}>
                          <defs>
                            <linearGradient id="overviewTrendArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="color-mix(in srgb, var(--accent) 28%, white)" />
                              <stop offset="100%" stopColor="rgba(0, 122, 251, 0.02)" />
                            </linearGradient>
                            <linearGradient id="overviewTrendLine" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="color-mix(in srgb, var(--accent-strong) 88%, white)" />
                              <stop offset="100%" stopColor="var(--accent)" />
                            </linearGradient>
                          </defs>
                          {gridValues.map((row) => (
                            <g key={`grid-${row.y}`}>
                              <line x1="0" y1={row.y} x2={chartWidth} y2={row.y} stroke="color-mix(in srgb, var(--accent) 10%, var(--border-soft))" strokeWidth="0.45" strokeDasharray="2 2" />
                              <text x="0" y={Math.max(3, row.y - 1.4)} fontSize="2.6" fill="var(--text-muted)">{row.value}</text>
                            </g>
                          ))}
                          {activePoint ? (
                            <line x1={activePoint.x} y1="0" x2={activePoint.x} y2={chartHeight} stroke="color-mix(in srgb, var(--accent) 18%, var(--border-soft))" strokeWidth="0.5" strokeDasharray="2 2" />
                          ) : null}
                          <polygon fill="url(#overviewTrendArea)" points={areaPoints} />
                          <polyline fill="none" stroke="url(#overviewTrendLine)" strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round" points={points} />
                          {pointCoordinates.map((row) => (
                            <g
                              key={`${row.key}-point`}
                              onMouseEnter={() => setHoveredTrendKey(row.key)}
                              onMouseLeave={() => setHoveredTrendKey("")}
                              style={{ cursor: "pointer" }}
                            >
                              <circle cx={row.x} cy={row.y} r={activePoint?.key === row.key ? "3.1" : "2.05"} fill="#ffffff" stroke="var(--accent-strong)" strokeWidth={activePoint?.key === row.key ? "1.15" : "0.9"} />
                              <circle cx={row.x} cy={row.y} r={activePoint?.key === row.key ? "1.15" : "0.75"} fill="var(--accent-strong)" />
                              {activePoint?.key === row.key ? (
                                <g>
                                  <rect x={Math.max(0, row.x - 10)} y={Math.max(1, row.y - 9)} width="20" height="6.6" rx="2.2" fill="#ffffff" stroke="color-mix(in srgb, var(--accent) 10%, var(--border-soft))" strokeWidth="0.35" />
                                  <text x={row.x} y={Math.max(5.1, row.y - 4.7)} textAnchor="middle" fontSize="2.45" fill="var(--text-primary)" fontWeight="700">{row.count}</text>
                                </g>
                              ) : null}
                              <text x={row.x} y="49" textAnchor="middle" fontSize="2.7" fill={activePoint?.key === row.key ? "var(--accent-strong)" : "var(--text-secondary)"}>{row.label}</text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div style={{ ...shellCardStyle, borderRadius: 14, padding: 14 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>All Grade Analytics Graph</div>
                <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)" }}>Full-grade enrollment graph and gender split.</div>
              </div>
              {loading ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading distribution...</div>
              ) : summary.gradeAnalytics.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No distribution data.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softRowStyle, gridTemplateColumns: "1fr", padding: "10px 10px 12px" }}>
                    {(() => {
                      const data = summary.gradeAnalytics;
                      const maxValue = Math.max(summary.maxGradeCount || 0, 1);
                      const barGap = 6;
                      const barWidth = data.length ? (100 - barGap * (data.length - 1)) / data.length : 0;

                      return (
                        <>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>Students by Grade (Bar Graph)</div>
                          <svg viewBox="0 0 100 44" style={{ width: "100%", height: 170, display: "block" }}>
                            <line x1="0" y1="40" x2="100" y2="40" stroke="var(--border-strong)" strokeWidth="0.5" />
                            {data.map((row, index) => {
                              const height = Math.max(1.2, (Number(row.count || 0) / maxValue) * 34);
                              const x = index * (barWidth + barGap);
                              const y = 40 - height;
                              return (
                                <g key={`${row.grade}-bar`}>
                                  <rect x={x} y={y} width={barWidth} height={height} rx="0.8" fill="url(#gradeBarGradient)" />
                                  <text x={x + barWidth / 2} y={y - 1.5} textAnchor="middle" fontSize="2.6" fill="var(--text-primary)">{row.count}</text>
                                  <text x={x + barWidth / 2} y="43" textAnchor="middle" fontSize="2.6" fill="var(--text-secondary)">{row.grade}</text>
                                </g>
                              );
                            })}
                            <defs>
                              <linearGradient id="gradeBarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--accent-strong)" />
                                <stop offset="100%" stopColor="var(--accent)" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </>
                      );
                    })()}
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    {summary.gradeAnalytics.map((row) => {
                      const pct = summary.totalStudents ? Math.round((row.count / summary.totalStudents) * 100) : 0;
                      return (
                        <div key={row.grade}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700 }}>Grade {row.grade}</span>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{row.count} ({pct}%)</span>
                          </div>
                          <div style={progressTrackStyle}>
                            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--accent-strong), var(--accent))", borderRadius: 999 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>Gender Split</div>
                    {[
                      { label: "Male", count: summary.maleCount, tone: "color-mix(in srgb, var(--success) 82%, var(--text-primary))" },
                      { label: "Female", count: summary.femaleCount, tone: "color-mix(in srgb, var(--accent) 52%, var(--text-primary))" },
                    ].map((row) => {
                      const pct = summary.totalStudents ? Math.round((row.count / summary.totalStudents) * 100) : 0;
                      return (
                        <div key={row.label} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700 }}>{row.label}</span>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{row.count} ({pct}%)</span>
                          </div>
                          <div style={progressTrackStyle}>
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
