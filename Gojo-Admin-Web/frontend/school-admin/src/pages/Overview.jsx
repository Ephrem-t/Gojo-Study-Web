import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";

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
      if (!cachedAt || Date.now() - cachedAt > 60 * 1000) {
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

  useEffect(() => {
    const onResize = () => setIsNarrow(getIsNarrow());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchNodeCount = async (nodeName) => {
      try {
        const res = await axios.get(`${DB_URL}/${nodeName}.json`, {
          params: { shallow: true },
          timeout: 4000,
        });
        return Object.keys(res.data || {}).length;
      } catch (error) {
        const fallbackRes = await axios.get(`${DB_URL}/${nodeName}.json`, {
          timeout: 5000,
        }).catch(() => ({ data: {} }));
        return Object.keys(fallbackRes.data || {}).length;
      }
    };

    const loadOverview = async () => {
      try {
        if (!cachedOverview && isMounted) {
          setLoading(true);
        }

        const [studentsRes, resolvedParentsCount, resolvedPostsCount] = await Promise.all([
          axios.get(`${DB_URL}/Students.json`, { timeout: 5000 }).catch(() => ({ data: {} })),
          fetchNodeCount("Parents"),
          fetchNodeCount("posts"),
        ]);

        const studentsObj = studentsRes.data || {};

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

  const shellCardStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    borderRadius: 16,
    boxShadow: "var(--shadow-soft)",
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
    <div className="dashboard-page" style={{ background: "var(--page-bg)", minHeight: "100vh", height: "100vh", overflow: "hidden", color: "var(--text-primary)" }}>
      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "4px 14px", height: "calc(100vh - 73px)", overflow: "hidden", background: "var(--page-bg)", width: "100%", boxSizing: "border-box" }}>
        <Sidebar admin={stored} />
        <div className="main-content google-main" style={{ flex: "1.08 1 0", minWidth: 0, maxWidth: "none", margin: "0", boxSizing: "border-box", alignSelf: "stretch", height: "100%", overflowY: "auto", overflowX: "hidden", scrollbarWidth: "thin", scrollbarColor: "transparent transparent", padding: "0 2px" }}>
            <div style={{ width: "100%", maxWidth: FEED_MAX_WIDTH, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1.4fr 1fr", gap: 12 }}>
            <div style={{ ...shellCardStyle, borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>New Registrations (This Month)</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)" }}>Latest students added during the current calendar month.</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {loading ? "--" : summary.thisMonthRegistrationCount} registrations • Posts: {loading ? "--" : postsCount}
                </div>
              </div>

              {loading ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading students...</div>
              ) : summary.recentStudents.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No registrations found for this month yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {summary.recentStudents.map((student) => (
                    <div key={student.studentId} style={{ ...softRowStyle, gridTemplateColumns: isNarrow ? "42px 1fr" : "42px 1fr auto" }}>
                      <img src={student.profileImage} alt={student.name} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border-strong)" }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{student.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{student.studentId}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Registered: {formatDateTime(student.createdAt)}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-strong)", gridColumn: isNarrow ? "2 / 3" : "auto", padding: "6px 10px", borderRadius: 999, background: "color-mix(in srgb, var(--accent) 10%, white)", border: "1px solid color-mix(in srgb, var(--accent) 18%, var(--border-soft))" }}>
                        G{student.grade} • {student.section}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...shellCardStyle, borderRadius: 14, padding: 14 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>Grade Distribution</div>
                <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)" }}>Highest-enrollment grades and gender balance.</div>
              </div>
              {loading ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading distribution...</div>
              ) : summary.topGrades.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No distribution data.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    {summary.topGrades.map((row) => {
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
