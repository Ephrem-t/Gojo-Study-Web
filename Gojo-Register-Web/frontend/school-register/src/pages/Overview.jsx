import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ProfileAvatar from "../components/ProfileAvatar";
import { buildUserLookupFromNode, loadSchoolParentsNode, loadSchoolStudentsNode, loadSchoolUsersNode } from "../utils/registerData";
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
        const [studentsObj, usersNode, parentsObj, postsObj] = await Promise.all([
          loadSchoolStudentsNode({ rtdbBase: DB_URL }),
          loadSchoolUsersNode({ rtdbBase: DB_URL }),
          loadSchoolParentsNode({ rtdbBase: DB_URL }),
          fetchCachedJson(`${DB_URL}/posts.json`, { ttlMs: 60000 }).catch(() => ({})),
        ]);

        const usersObj = buildUserLookupFromNode(usersNode);

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

  const shellCardStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    borderRadius: 16,
    boxShadow: "var(--shadow-soft)",
  };
  const statCardStyle = {
    ...shellCardStyle,
    borderRadius: 14,
    padding: "14px 16px",
  };
  const mutedTextStyle = {
    color: "var(--text-muted)",
  };
  const softRowStyle = {
    display: "grid",
    alignItems: "center",
    gap: 10,
    background: "var(--surface-muted)",
    border: "1px solid var(--border-soft)",
    borderRadius: 10,
    padding: "8px 10px",
  };
  const progressTrackStyle = {
    height: 8,
    background: "var(--surface-strong)",
    borderRadius: 999,
  };

  return (
    <div style={{ padding: "10px 4px 20px", minWidth: 0, boxSizing: "border-box", color: "var(--text-primary)" }}>
      <div style={{ width: "min(100%, 1120px)", margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="section-header-card" style={{ padding: 18 }}>
            <div className="section-header-card__row">
              <div>
                <h1 className="section-header-card__title" style={{ fontSize: 24 }}>Overview</h1>
                <p className="section-header-card__subtitle" style={{ fontSize: 13 }}>Operational snapshot for students, parents and posts.</p>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{loading ? "Loading..." : `Updated: ${new Date().toLocaleString()}`}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { title: "Total Students", value: summary.totalStudents, tone: "var(--accent-strong)" },
              { title: "Active Students", value: summary.activeStudents, tone: "var(--success)" },
              { title: "Inactive Students", value: summary.inactiveStudents, tone: "var(--danger)" },
              { title: "Male Count", value: summary.maleCount, tone: "color-mix(in srgb, var(--success) 82%, var(--text-primary))" },
              { title: "Female Count", value: summary.femaleCount, tone: "color-mix(in srgb, var(--accent) 52%, var(--text-primary))" },
            ].map((card) => (
              <div key={card.title} style={statCardStyle}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{card.title}</div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800, color: card.tone }}>{loading ? "--" : card.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1.4fr 1fr", gap: 12 }}>
            <div style={{ ...shellCardStyle, borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>New Registrations (This Month)</div>
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
                      <ProfileAvatar imageUrl={student.profileImage} name={student.name} size={40} style={{ border: "2px solid var(--border-strong)" }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{student.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{student.studentId}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Registered: {formatDateTime(student.createdAt)}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-strong)", gridColumn: isNarrow ? "2 / 3" : "auto" }}>
                        G{student.grade} • {student.section}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...shellCardStyle, borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginBottom: 10 }}>Grade Distribution</div>
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
  );
}
