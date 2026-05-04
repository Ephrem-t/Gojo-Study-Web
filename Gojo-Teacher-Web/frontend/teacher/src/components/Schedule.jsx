import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaCalendarAlt, FaBookOpen, FaClock } from "react-icons/fa";
import Sidebar from "./Sidebar";
import "../styles/global.css";
import { getRtdbRoot, RTDB_BASE_RAW } from "../api/rtdbScope";
import { getTeacherCourseContext } from "../api/teacherApi";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const normalizeSubject = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const parseGradeSection = (rawValue) => {
  const normalized = String(rawValue || "").trim();
  if (!normalized) return { grade: "", section: "" };

  const compact = normalized.replace(/\s+/g, "");
  const digitsMatch = compact.match(/\d+/);
  const grade = digitsMatch ? digitsMatch[0] : "";

  let section = "";
  if (digitsMatch) {
    const sectionPart = compact.slice((digitsMatch.index || 0) + grade.length);
    section = (sectionPart.match(/[A-Za-z]+/)?.[0] || "").toUpperCase();
  }
  if (!section) section = (compact.match(/[A-Za-z]+/)?.[0] || "").toUpperCase();

  return { grade, section };
};

const toClassKey = (grade, section) => `${String(grade || "").trim()}_${String(section || "").trim().toUpperCase()}`;

function Timetable() {
  const navigate = useNavigate();

  const [teacher, setTeacher] = useState(null);
  const [teacherCourses, setTeacherCourses] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rtdbBase, setRtdbBase] = useState(() => getRtdbRoot());
  const [schoolBaseResolved, setSchoolBaseResolved] = useState(false);

  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [selectedDay, setSelectedDay] = useState("All");

  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== "undefined" ? window.innerWidth > 600 : true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 900 : false);

  useEffect(() => {
    const onResize = () => {
      const width = window.innerWidth;
      setSidebarOpen(width > 600);
      setIsMobile(width <= 900);
      if (width <= 900) setRightSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher") || "null");
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  useEffect(() => {
    const resolveSchoolBase = async () => {
      if (!teacher) return;
      setSchoolBaseResolved(false);

      const rawSchoolCode = String(teacher?.schoolCode || "").trim();
      if (!rawSchoolCode) {
        setRtdbBase(getRtdbRoot());
        setSchoolBaseResolved(true);
        return;
      }

      if (rawSchoolCode.startsWith("ET-")) {
        setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${rawSchoolCode}`);
        setSchoolBaseResolved(true);
        return;
      }

      try {
        const shortCode = rawSchoolCode.toUpperCase();
        const mapRes = await axios.get(`${RTDB_BASE_RAW}/Platform1/schoolCodeIndex/${shortCode}.json`);
        const mappedCode = String(mapRes?.data || "").trim();
        if (mappedCode) {
          setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${mappedCode}`);
          setSchoolBaseResolved(true);
          return;
        }
      } catch {
        // Fallback scan below handles missing mappings.
      }

      try {
        const schoolsRes = await axios.get(`${RTDB_BASE_RAW}/Platform1/Schools.json`);
        const schoolsObj = schoolsRes?.data && typeof schoolsRes.data === "object" ? schoolsRes.data : {};
        const shortCode = rawSchoolCode.toUpperCase();

        const fallbackMatch = Object.entries(schoolsObj).find(([schoolCode, schoolNode]) => {
          const nodeShort = String(
            schoolNode?.schoolInfo?.shortName ||
            schoolNode?.schoolInfo?.shortCode ||
            schoolNode?.schoolCode ||
            ""
          )
            .trim()
            .toUpperCase();

          return nodeShort === shortCode || String(schoolCode || "").toUpperCase().includes(shortCode);
        });

        if (fallbackMatch?.[0]) {
          setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${fallbackMatch[0]}`);
          setSchoolBaseResolved(true);
          return;
        }
      } catch {
        // Keep final fallback below.
      }

      setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${rawSchoolCode}`);
      setSchoolBaseResolved(true);
    };

    resolveSchoolBase();
  }, [teacher]);

  useEffect(() => {
    if (!teacher || !schoolBaseResolved || !rtdbBase) return;

    const fetchWorkspace = async () => {
      setLoading(true);
      setError("");
      try {
        const [scheduleRes, courseContext] = await Promise.all([
          axios.get(`${rtdbBase}/Schedules.json`).catch(() => ({ data: {} })),
          getTeacherCourseContext({ teacher, rtdbBase }),
        ]);

        setSchedule(scheduleRes.data || {});
        setTeacherCourses(courseContext?.courses || []);
      } catch {
        setError("Failed to load timetable workspace.");
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspace();
  }, [teacher, schoolBaseResolved, rtdbBase]);

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  const teacherClassKeys = useMemo(() => {
    const set = new Set();
    (teacherCourses || []).forEach((course) => {
      const grade = String(course?.grade || "").trim();
      const section = String(course?.section || course?.secation || "").trim().toUpperCase();
      if (grade && section) set.add(toClassKey(grade, section));
    });
    return set;
  }, [teacherCourses]);

  const subjectsByClassKey = useMemo(() => {
    const map = {};
    (teacherCourses || []).forEach((course) => {
      const grade = String(course?.grade || "").trim();
      const section = String(course?.section || course?.secation || "").trim().toUpperCase();
      const classKey = toClassKey(grade, section);
      const subject = normalizeSubject(course?.subject || course?.name || "");
      if (!classKey) return;
      if (!map[classKey]) map[classKey] = new Set();
      if (subject) map[classKey].add(subject);
    });
    return map;
  }, [teacherCourses]);

  const isTeacherClass = (gradeLabel) => {
    const { grade, section } = parseGradeSection(gradeLabel);
    const classKey = toClassKey(grade, section);

    if (teacherClassKeys.size > 0) return teacherClassKeys.has(classKey);

    const dayKeys = Object.keys(schedule || {});
    return dayKeys.some((day) => {
      const periods = schedule?.[day]?.[gradeLabel] || {};
      return Object.values(periods).some((info) => String(info?.teacherName || "").trim() === String(teacher?.name || "").trim());
    });
  };

  const isTeacherPeriod = (gradeLabel, info) => {
    const teacherNameMatch = String(info?.teacherName || "").trim() === String(teacher?.name || "").trim();
    if (teacherNameMatch) return true;

    if (!teacherClassKeys.size) return false;

    const { grade, section } = parseGradeSection(gradeLabel);
    const classKey = toClassKey(grade, section);
    if (!teacherClassKeys.has(classKey)) return false;

    const scopedSubjects = subjectsByClassKey[classKey] || new Set();
    if (!scopedSubjects.size) return true;

    const subject = normalizeSubject(info?.subject || "");
    return scopedSubjects.has(subject);
  };

  const scopedSchedule = useMemo(() => {
    const next = {};

    Object.entries(schedule || {}).forEach(([day, classes]) => {
      const filteredClasses = Object.fromEntries(
        Object.entries(classes || {}).filter(([gradeLabel]) => isTeacherClass(gradeLabel))
      );
      if (Object.keys(filteredClasses).length) {
        next[day] = filteredClasses;
      }
    });

    return next;
  }, [schedule, teacherCourses, teacher]);

  const teacherSchedule = useMemo(() => {
    const filtered = {};

    Object.entries(scopedSchedule || {}).forEach(([day, classes]) => {
      Object.entries(classes || {}).forEach(([gradeLabel, periods]) => {
        Object.entries(periods || {}).forEach(([periodName, info]) => {
          if (!isTeacherPeriod(gradeLabel, info)) return;
          if (!filtered[day]) filtered[day] = {};
          if (!filtered[day][periodName]) filtered[day][periodName] = [];

          filtered[day][periodName].push({
            class: gradeLabel,
            subject: info?.subject || "-",
            time: info?.time || periodName.match(/\((.*?)\)/)?.[1] || "N/A",
          });
        });
      });
    });

    return filtered;
  }, [scopedSchedule, teacherCourses, teacher]);

  const { gradeOptions, sectionOptions } = useMemo(() => {
    const gradeSet = new Set();
    const sectionSet = new Set();

    Object.values(scopedSchedule || {}).forEach((classes) => {
      Object.keys(classes || {}).forEach((gradeKey) => {
        const { grade, section } = parseGradeSection(gradeKey);
        if (grade) gradeSet.add(grade);
        if (section) sectionSet.add(section);
      });
    });

    const sortedGrades = [...gradeSet].sort((a, b) => Number(a) - Number(b));

    let relevantSections = [...sectionSet];
    if (selectedGrade !== "All") {
      const scopedSet = new Set();
      Object.values(scopedSchedule || {}).forEach((classes) => {
        Object.keys(classes || {}).forEach((gradeKey) => {
          const { grade, section } = parseGradeSection(gradeKey);
          if (grade === selectedGrade && section) scopedSet.add(section);
        });
      });
      relevantSections = [...scopedSet];
    }

    return {
      gradeOptions: ["All", ...sortedGrades],
      sectionOptions: ["All", ...relevantSections.sort((a, b) => a.localeCompare(b))],
    };
  }, [scopedSchedule, selectedGrade]);

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

  const visibleDays = useMemo(() => {
    return DAYS.filter((day) => {
      if (selectedDay !== "All" && selectedDay !== day) return false;
      if (!scopedSchedule?.[day]) return false;
      return true;
    });
  }, [selectedDay, scopedSchedule]);

  const summary = useMemo(() => {
    let totalPeriods = 0;
    let myPeriods = 0;
    const classesSet = new Set();

    Object.values(scopedSchedule || {}).forEach((classes) => {
      Object.entries(classes || {}).forEach(([gradeLabel, periods]) => {
        classesSet.add(gradeLabel);
        Object.entries(periods || {}).forEach(([, info]) => {
          totalPeriods += 1;
          if (isTeacherPeriod(gradeLabel, info)) myPeriods += 1;
        });
      });
    });

    return {
      classes: classesSet.size,
      totalPeriods,
      myPeriods,
      activeDays: visibleDays.length,
    };
  }, [scopedSchedule, visibleDays, teacherCourses, teacher]);

  const css = `
    body, html, #root { height: 100%; margin: 0; }

    .schedule-page {
      min-height: 100vh;
      background: #ffffff !important;
      color: #0f172a;
    }

    .schedule-main-wrap {
      display: flex;
      margin-top: var(--topbar-height);
      min-height: calc(100vh - var(--topbar-height));
      background: #ffffff !important;
    }

    .schedule-main {
      flex: 1;
      min-width: 0;
      margin-left: calc(var(--sidebar-width, 240px) + 12px);
      padding: 14px;
      transition: margin-right 180ms ease;
      background:
        var(--page-bg),
    }

    .schedule-shell {
      width: 100%;
      max-width: 1320px;
      margin: 0 auto;
      display: grid;
      gap: 12px;
    }

    .schedule-hero {
      border: 1px solid #dbeafe;
      border-radius: 18px;
      padding: 14px;
      background: var(--page-bg);
      box-shadow: 0 12px 28px rgba(2, 132, 199, 0.08);
      display: grid;
      gap: 10px;
    }

    .schedule-hero-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .schedule-title {
      font-size: 24px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.02em;
    }

    .schedule-sub {
      color: #334155;
      font-weight: 600;
      font-size: 13px;
    }

    .schedule-chip-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .schedule-chip {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 11px;
      border-radius: 999px;
      background: #ffffff !important;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .schedule-summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }

    .schedule-summary-card {
      border: 1px solid #dbeafe;
      border-radius: 12px;
      padding: 10px;
      background: #ffffff;
      display: grid;
      gap: 3px;
    }

    .schedule-summary-label {
      font-size: 10px;
      color: #64748b;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .schedule-summary-value {
      font-size: 21px;
      font-weight: 900;
      color: #007AFB;
      line-height: 1.1;
    }

    .schedule-courses {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 10px;
      background: #ffffff;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
      display: grid;
      gap: 8px;
    }

    .schedule-courses-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: #475569;
    }

    .schedule-courses-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }

    .course-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 30px;
      padding: 0 11px;
      border-radius: 999px;
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      color: #0b4a86;
      font-size: 12px;
      font-weight: 700;
    }

    .schedule-filter-card {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #ffffff;
      padding: 10px;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
      display: grid;
      gap: 10px;
    }

    .schedule-filter-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      align-items: start;
    }

    .schedule-filter-panel {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #ffffff;
      padding: 10px;
      display: grid;
      gap: 8px;
    }

    .schedule-filter-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }

    .schedule-filter-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .filter-pill {
      border: 1px solid #dbeafe;
      background: #ffffff;
      color: #334155;
      border-radius: 999px;
      min-height: 30px;
      padding: 0 11px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .filter-pill.is-active {
      border-color: #007AFB;
      background: #dbeafe;
      color: #005ec2;
    }

    .day-card {
      border: 1px solid #dbeafe;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 12px 24px rgba(2, 132, 199, 0.07);
      padding: 10px;
      display: grid;
      gap: 10px;
    }

    .day-title {
      font-size: 17px;
      font-weight: 900;
      color: #007AFB;
      letter-spacing: 0.01em;
    }

    .grade-block {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
    }

    .grade-head {
      min-height: 42px;
      padding: 0 12px;
      display: flex;
      align-items: center;
      background: linear-gradient(90deg, #007AFB 0%, #3698ff 100%);
      color: #ffffff;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .schedule-table {
      width: 100%;
      border-collapse: collapse;
    }

    .schedule-table th {
      text-align: left;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: #64748b;
      background: #f8fbff;
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 12px;
    }

    .schedule-table td {
      padding: 11px 12px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
      font-size: 13px;
      font-weight: 600;
      vertical-align: top;
    }

    .schedule-row-mine {
      background: rgba(0, 122, 251, 0.09);
    }

    .schedule-row-mine td {
      color: #0b4a86;
      font-weight: 800;
    }

    .my-drawer {
      position: fixed;
      right: 12px;
      top: calc(var(--topbar-height) + 10px);
      width: 370px;
      height: calc(100vh - var(--topbar-height) - 20px);
      border-radius: 14px;
      border: 1px solid #dbeafe;
      background: #ffffff;
      box-shadow: 0 18px 30px rgba(15, 23, 42, 0.11);
      overflow: hidden;
      z-index: 220;
      display: flex;
      flex-direction: column;
    }

    .my-drawer-head {
      min-height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 0 12px;
      background: linear-gradient(90deg, #007AFB 0%, #1b88ff 100%);
      color: #ffffff;
    }

    .my-drawer-title {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.03em;
    }

    .drawer-icon-btn {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.55);
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .my-drawer-body {
      padding: 12px;
      overflow-y: auto;
      background: #f8fbff;
      display: grid;
      gap: 10px;
    }

    .my-day-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #ffffff;
      padding: 10px;
      display: grid;
      gap: 8px;
    }

    .my-day-title {
      font-size: 13px;
      font-weight: 900;
      color: #007AFB;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .my-entry {
      border: 1px solid #dbeafe;
      border-radius: 10px;
      padding: 8px;
      background: #eff6ff;
      display: grid;
      gap: 3px;
    }

    .my-entry-period {
      font-size: 12px;
      font-weight: 800;
      color: #005ec2;
    }

    .my-entry-text {
      font-size: 12px;
      font-weight: 600;
      color: #334155;
    }

    .my-toggle-btn {
      position: fixed;
      right: 14px;
      top: calc(var(--topbar-height) + 14px);
      min-width: 82px;
      height: 40px;
      border-radius: 999px;
      border: 1px solid #007AFB;
      background: #007AFB;
      color: #ffffff;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.03em;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
      z-index: 220;
      box-shadow: 0 8px 16px rgba(0, 122, 251, 0.25);
    }

    @media (max-width: 1050px) {
      .schedule-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .my-drawer {
        width: 100vw;
        right: 0;
        top: var(--topbar-height);
        height: calc(100vh - var(--topbar-height));
        border-radius: 0;
      }
    }

    @media (max-width: 900px) {
      .schedule-main {
        margin-left: calc(var(--sidebar-width, 240px) + 8px);
        padding: 10px 2vw;
      }
    }

    @media (max-width: 600px) {
      .schedule-main {
        margin-left: 0;
      }
      .schedule-filter-grid {
        grid-template-columns: 1fr;
      }
      .schedule-title { font-size: 20px; }
      .schedule-summary-grid { grid-template-columns: 1fr; }
      .schedule-table th,
      .schedule-table td { padding: 8px; font-size: 12px; }
    }
  `;

  return (
    <div
      className="schedule-page"
      style={{
        "--surface-panel": "#ffffff",
        "--surface-accent": "#eff6ff",
        "--surface-muted": "#f8fafc",
        "--surface-strong": "#e2e8f0",
        "--page-bg": "#ffffff",
        "--border-soft": "#e2e8f0",
        "--border-strong": "#cbd5e1",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": "#007AFB",
        "--accent-soft": "#dbeafe",
        "--accent-strong": "#005ec2",
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
      }}
    >
      <style>{css}</style>

      <div className="schedule-main-wrap">
        <Sidebar
          active="timetable"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          teacher={teacher}
          handleLogout={handleLogout}
        />

        <main className="schedule-main" style={{ marginRight: rightSidebarOpen && !isMobile ? 392 : 0 }}>
          <div className="schedule-shell">
            <section className="schedule-hero">
              <div className="schedule-hero-head">
                <div>
                  <div className="schedule-title">Teaching Timetable Workspace</div>
                  <div className="schedule-sub">See your own teaching timetable and the full timetable of the grade-sections you teach.</div>
                </div>
                <div className="schedule-chip-row">
                  <span className="schedule-chip"><FaCalendarAlt style={{ marginRight: 6 }} /> Teacher View</span>
                  <span className="schedule-chip">{selectedDay === "All" ? "All Days" : selectedDay}</span>
                </div>
              </div>

              <div className="schedule-summary-grid">
                <div className="schedule-summary-card">
                  <div className="schedule-summary-label">Grade Sections</div>
                  <div className="schedule-summary-value">{summary.classes}</div>
                </div>
                <div className="schedule-summary-card">
                  <div className="schedule-summary-label">Total Periods</div>
                  <div className="schedule-summary-value">{summary.totalPeriods}</div>
                </div>
                <div className="schedule-summary-card">
                  <div className="schedule-summary-label">My Periods</div>
                  <div className="schedule-summary-value">{summary.myPeriods}</div>
                </div>
                <div className="schedule-summary-card">
                  <div className="schedule-summary-label">Active Days</div>
                  <div className="schedule-summary-value">{summary.activeDays}</div>
                </div>
              </div>
            </section>

            <section className="schedule-courses">
              <div className="schedule-courses-title">My Assigned Courses</div>
              <div className="schedule-courses-grid">
                {!teacherCourses.length ? (
                  <span className="course-pill">No course assignment found yet</span>
                ) : (
                  teacherCourses.map((course) => (
                    <span key={course.id} className="course-pill">
                      <FaBookOpen />
                      {course.subject || course.name} · G{course.grade}{String(course.section || "").toUpperCase()}
                    </span>
                  ))
                )}
              </div>
            </section>

            <section className="schedule-filter-card">
              <div className="schedule-filter-grid">
                <div className="schedule-filter-panel">
                  <div className="schedule-filter-title">Filter by Grade</div>
                  <div className="schedule-filter-row">
                    {gradeOptions.map((grade) => (
                      <button
                        key={grade}
                        type="button"
                        className={`filter-pill ${selectedGrade === grade ? "is-active" : ""}`}
                        onClick={() => setSelectedGrade(grade)}
                      >
                        {grade === "All" ? "All Grades" : `Grade ${grade}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="schedule-filter-panel">
                  <div className="schedule-filter-title">Filter by Section</div>
                  <div className="schedule-filter-row">
                    {sectionOptions.map((section) => (
                      <button
                        key={section}
                        type="button"
                        className={`filter-pill ${selectedSection === section ? "is-active" : ""}`}
                        onClick={() => setSelectedSection(section)}
                      >
                        {section === "All" ? "All Sections" : section}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="schedule-filter-title">Filter by Day</div>
              <div className="schedule-filter-row">
                {["All", ...DAYS].map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={`filter-pill ${selectedDay === day ? "is-active" : ""}`}
                    onClick={() => setSelectedDay(day)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </section>

            {loading ? <p style={{ textAlign: "center", color: "#64748b", fontWeight: 700 }}>Loading timetable...</p> : null}
            {error ? <p style={{ textAlign: "center", color: "#b91c1c", fontWeight: 700 }}>{error}</p> : null}

            {!loading && !error && visibleDays.length === 0 ? (
              <div className="day-card">
                <div style={{ color: "#64748b", fontWeight: 700 }}>No timetable found for your current teacher scope.</div>
              </div>
            ) : null}

            {!loading && !error
              ? visibleDays.map((day) => {
                  const classes = scopedSchedule?.[day] || {};
                  return (
                    <section key={day} className="day-card">
                      <div className="day-title">{day}</div>

                      {Object.entries(classes)
                        .filter(([gradeLabel]) => {
                          const { grade, section } = parseGradeSection(gradeLabel);
                          if (selectedGrade !== "All" && grade !== selectedGrade) return false;
                          if (selectedSection !== "All" && section !== selectedSection) return false;
                          return true;
                        })
                        .map(([gradeLabel, periods]) => (
                          <div key={`${day}_${gradeLabel}`} className="grade-block">
                            <div className="grade-head">{gradeLabel} Full Timetable</div>
                            <table className="schedule-table">
                              <thead>
                                <tr>
                                  <th>Period</th>
                                  <th>Subject</th>
                                  <th>Time</th>
                                  <th>Teacher</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(periods || {}).map(([periodName, info]) => {
                                  const mine = isTeacherPeriod(gradeLabel, info);
                                  const time = info?.time || periodName.match(/\((.*?)\)/)?.[1] || "N/A";

                                  return (
                                    <tr key={`${gradeLabel}_${periodName}`} className={mine ? "schedule-row-mine" : ""}>
                                      <td>{periodName}</td>
                                      <td>{info?.subject || "-"}</td>
                                      <td>{time}</td>
                                      <td>{info?.teacherName || "-"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ))}
                    </section>
                  );
                })
              : null}
          </div>
        </main>

        {rightSidebarOpen ? (
          <aside className="my-drawer">
            <div className="my-drawer-head">
              <div className="my-drawer-title">My Course Timetable</div>
              <button type="button" className="drawer-icon-btn" onClick={() => setRightSidebarOpen(false)} title="Close">
                <FaChevronRight />
              </button>
            </div>

            <div className="my-drawer-body">
              {loading ? <div style={{ color: "#64748b", fontWeight: 700 }}>Loading...</div> : null}

              {!loading && Object.keys(teacherSchedule).length === 0 ? (
                <div style={{ color: "#64748b", fontWeight: 700 }}>No personal teaching slots found.</div>
              ) : null}

              {!loading
                ? DAYS.map((day) => {
                    const periods = teacherSchedule?.[day];
                    if (!periods) return null;

                    return (
                      <div key={`my_${day}`} className="my-day-card">
                        <div className="my-day-title">{day}</div>
                        {Object.entries(periods).map(([periodName, entries]) => (
                          <div key={`my_${day}_${periodName}`} className="my-entry">
                            <div className="my-entry-period">{periodName}</div>
                            {entries.map((entry, index) => (
                              <div key={`my_${day}_${periodName}_${index}`} className="my-entry-text">
                                <FaClock style={{ marginRight: 6, color: "#007AFB" }} />
                                <strong>{entry.class}</strong> - {entry.subject} ({entry.time})
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })
                : null}
            </div>
          </aside>
        ) : (
          <button type="button" className="my-toggle-btn" onClick={() => setRightSidebarOpen(true)}>
            <span>My</span>
            <FaChevronLeft />
          </button>
        )}
      </div>
    </div>
  );
}

export default Timetable;
