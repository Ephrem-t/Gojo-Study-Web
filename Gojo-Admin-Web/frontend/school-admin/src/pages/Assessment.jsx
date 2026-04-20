import React, { useEffect, useState } from "react";
import axios from "axios";

const RTDB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";
const ALL_GRADES_VALUE = "__ALL_GRADES__";
const ALL_SUBJECTS_VALUE = "__ALL_SUBJECTS__";

export default function AssessmentPage() {
  const admin = (() => {
    try {
      return JSON.parse(localStorage.getItem("admin") || "{}") || {};
    } catch (error) {
      return {};
    }
  })();

  const schoolCode = String(admin.schoolCode || "").trim();
  const SCHOOL_DB_ROOT = schoolCode
    ? `${RTDB_BASE}/Platform1/Schools/${encodeURIComponent(schoolCode)}`
    : RTDB_BASE;

  const [gradeRows, setGradeRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGrade, setSelectedGrade] = useState(ALL_GRADES_VALUE);
  const [selectedSubject, setSelectedSubject] = useState(ALL_SUBJECTS_VALUE);
  const [activeSemester, setActiveSemester] = useState("semester1");
  const [assessmentMode, setAssessmentMode] = useState("semester");
  const [quarters, setQuarters] = useState(["q1", "q2"]);
  const [selectedQuarter, setSelectedQuarter] = useState("q1");
  const [assessmentList, setAssessmentList] = useState([{ name: "", max: "" }]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const PRIMARY = "#007afb";
  const BACKGROUND = "#ffffff";
  const ACCENT = "#00B6A9";

  useEffect(() => {
    let mounted = true;

    const normalizeSubjects = (subjectsNode) => {
      if (!subjectsNode || typeof subjectsNode !== "object") return [];
      return Object.values(subjectsNode)
        .map((item) => String(item?.name || item?.subject || "").trim())
        .filter(Boolean);
    };

    const loadGradeSubjects = async () => {
      setLoading(true);
      setError("");

      try {
        const gradeRes = await axios.get(`${SCHOOL_DB_ROOT}/GradeManagement/grades.json`, { timeout: 7000 });
        const gradesNode = gradeRes.data && typeof gradeRes.data === "object" ? gradeRes.data : {};

        const rowsFromGradeManagement = Object.entries(gradesNode).map(([gradeKey, gradeValue]) => {
          const gradeObj = gradeValue && typeof gradeValue === "object" ? gradeValue : {};
          const subjects = normalizeSubjects(gradeObj.subjects);
          return {
            grade: String(gradeObj.grade || gradeKey || "").trim(),
            subjects,
          };
        });

        let rows = rowsFromGradeManagement;

        const hasAnySubjects = rows.some((row) => row.subjects.length > 0);
        if (!hasAnySubjects) {
          const coursesRes = await axios.get(`${SCHOOL_DB_ROOT}/Courses.json`, { timeout: 7000 }).catch(() => ({ data: {} }));
          const coursesNode = coursesRes.data && typeof coursesRes.data === "object" ? coursesRes.data : {};
          const subjectsByGrade = {};

          Object.values(coursesNode).forEach((courseValue) => {
            const course = courseValue && typeof courseValue === "object" ? courseValue : {};
            const grade = String(course.grade || "").trim();
            const subject = String(course.subject || course.name || "").trim();
            if (!grade || !subject) return;
            if (!subjectsByGrade[grade]) subjectsByGrade[grade] = new Set();
            subjectsByGrade[grade].add(subject);
          });

          const fromCourses = Object.entries(subjectsByGrade).map(([grade, subjectSet]) => ({
            grade,
            subjects: Array.from(subjectSet),
          }));

          if (fromCourses.length) {
            rows = rows.map((row) => {
              if (row.subjects.length) return row;
              const match = fromCourses.find((item) => item.grade === row.grade);
              return match ? { ...row, subjects: match.subjects } : row;
            });

            const missingGrades = fromCourses.filter((item) => !rows.some((row) => row.grade === item.grade));
            rows = [...rows, ...missingGrades];
          }
        }

        rows.sort((first, second) => {
          const firstNum = Number(first.grade);
          const secondNum = Number(second.grade);
          const firstIsNum = Number.isFinite(firstNum);
          const secondIsNum = Number.isFinite(secondNum);
          if (firstIsNum && secondIsNum) return firstNum - secondNum;
          return String(first.grade).localeCompare(String(second.grade));
        });

        if (!mounted) return;
        setGradeRows(rows);
      } catch (loadError) {
        if (!mounted) return;
        setError("Unable to load grades and subjects.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadGradeSubjects();

    return () => {
      mounted = false;
    };
  }, [SCHOOL_DB_ROOT]);

  const toSubjectKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

  const subjectOptions = selectedGrade === ALL_GRADES_VALUE
    ? Array.from(
        new Set(
          gradeRows.flatMap((row) => (Array.isArray(row.subjects) ? row.subjects : []))
        )
      )
    : gradeRows.find((row) => row.grade === selectedGrade)?.subjects || [];

  useEffect(() => {
    if (!gradeRows.length) return;
    if (
      !selectedGrade ||
      (selectedGrade !== ALL_GRADES_VALUE && !gradeRows.some((row) => row.grade === selectedGrade))
    ) {
      setSelectedGrade(gradeRows[0].grade || "");
    }
  }, [gradeRows, selectedGrade]);

  useEffect(() => {
    if (!selectedGrade) {
      setSelectedSubject("");
      return;
    }
    if (selectedGrade === ALL_GRADES_VALUE) {
      if (selectedSubject !== ALL_SUBJECTS_VALUE) {
        setSelectedSubject(ALL_SUBJECTS_VALUE);
      }
      return;
    }
    const subjects = selectedGrade === ALL_GRADES_VALUE
      ? subjectOptions
      : gradeRows.find((row) => row.grade === selectedGrade)?.subjects || [];
    if (!subjects.length) {
      setSelectedSubject(selectedGrade === ALL_GRADES_VALUE ? ALL_SUBJECTS_VALUE : "");
      return;
    }
    if (!selectedSubject || (!subjects.includes(selectedSubject) && selectedSubject !== ALL_SUBJECTS_VALUE)) {
      setSelectedSubject(selectedGrade === ALL_GRADES_VALUE ? ALL_SUBJECTS_VALUE : subjects[0]);
    }
  }, [selectedGrade, selectedSubject, gradeRows, subjectOptions]);

  useEffect(() => {
    let mounted = true;

    const loadQuarterState = async () => {
      if (!selectedGrade || !selectedSubject || selectedGrade === ALL_GRADES_VALUE || selectedSubject === ALL_SUBJECTS_VALUE) {
        setQuarters(["q1", "q2"]);
        setSelectedQuarter("q1");
        setAssessmentList([{ name: "", max: "" }]);
        return;
      }

      try {
        const subjectKey = toSubjectKey(selectedSubject);
        const semRes = await axios.get(
          `${SCHOOL_DB_ROOT}/AssesmentTemplates/${encodeURIComponent(selectedGrade)}/${encodeURIComponent(subjectKey)}/${activeSemester}.json`,
          { timeout: 7000 }
        );

        const semNode = semRes.data && typeof semRes.data === "object" ? semRes.data : {};
        const hasSemesterOnly = Boolean(semNode.assessments && typeof semNode.assessments === "object");
        const hasQuarterBased = Object.keys(semNode).some((key) => /^q\d+$/i.test(key));

        if (!mounted) return;
        setAssessmentMode(hasSemesterOnly ? "semester" : hasQuarterBased ? "quarter" : "semester");
        setQuarters(["q1", "q2"]);
        setSelectedQuarter((prev) => (["q1", "q2"].includes(prev) ? prev : "q1"));
      } catch {
        if (!mounted) return;
        setAssessmentMode("semester");
        setQuarters(["q1", "q2"]);
        setSelectedQuarter("q1");
      }
    };

    loadQuarterState();

    return () => {
      mounted = false;
    };
  }, [SCHOOL_DB_ROOT, selectedGrade, selectedSubject, activeSemester]);

  useEffect(() => {
    let mounted = true;

    const loadExistingStructure = async () => {
      if (
        !selectedGrade ||
        !selectedSubject ||
        !selectedQuarter ||
        selectedGrade === ALL_GRADES_VALUE ||
        selectedSubject === ALL_SUBJECTS_VALUE
      ) {
        setAssessmentList([{ name: "", max: "" }]);
        return;
      }

      try {
        const subjectKey = toSubjectKey(selectedSubject);
        const targetUrl = assessmentMode === "semester"
          ? `${SCHOOL_DB_ROOT}/AssesmentTemplates/${encodeURIComponent(selectedGrade)}/${encodeURIComponent(subjectKey)}/${activeSemester}.json`
          : `${SCHOOL_DB_ROOT}/AssesmentTemplates/${encodeURIComponent(selectedGrade)}/${encodeURIComponent(subjectKey)}/${activeSemester}/${selectedQuarter}.json`;
        const res = await axios.get(targetUrl, { timeout: 7000 });
        const node = res.data && typeof res.data === "object" ? res.data : {};
        const assessments = node.assessments && typeof node.assessments === "object" ? node.assessments : {};

        const parsed = Object.values(assessments)
          .map((item) => ({
            name: String(item?.name || "").trim(),
            max: item?.max ?? "",
          }))
          .filter((item) => item.name);

        if (!mounted) return;
        setAssessmentList(parsed.length ? parsed : [{ name: "", max: "" }]);
      } catch {
        if (!mounted) return;
        setAssessmentList([{ name: "", max: "" }]);
      }
    };

    loadExistingStructure();

    return () => {
      mounted = false;
    };
  }, [SCHOOL_DB_ROOT, selectedGrade, selectedSubject, activeSemester, selectedQuarter, assessmentMode]);

  const addAssessment = () => {
    setAssessmentList((prev) => [...prev, { name: "", max: "" }]);
  };

  const updateAssessment = (index, field, value) => {
    setAssessmentList((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const removeAssessment = (index) => {
    setAssessmentList((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length ? next : [{ name: "", max: "" }];
    });
  };

  const saveAssessmentStructure = async () => {
    setSaveMessage("");

    if (!selectedGrade || !selectedSubject) {
      setSaveMessage("Select grade and subject first.");
      return;
    }

    if (assessmentMode === "quarter" && !selectedQuarter) {
      setSaveMessage("Select quarter.");
      return;
    }

    const cleaned = assessmentList
      .map((item) => ({
        name: String(item.name || "").trim(),
        max: Number(item.max || 0),
      }))
      .filter((item) => item.name && item.max > 0);

    if (!cleaned.length) {
      setSaveMessage("Add at least one assessment with valid max.");
      return;
    }

    const totalMax = cleaned.reduce((sum, item) => sum + item.max, 0);
    if (totalMax !== 100) {
      setSaveMessage("Total max must be exactly 100.");
      return;
    }

    const targetPairsRaw = (() => {
      if (selectedGrade === ALL_GRADES_VALUE && selectedSubject === ALL_SUBJECTS_VALUE) {
        return gradeRows.flatMap((row) =>
          (Array.isArray(row.subjects) ? row.subjects : []).map((subject) => ({
            grade: String(row.grade || "").trim(),
            subject: String(subject || "").trim(),
          }))
        );
      }

      if (selectedGrade === ALL_GRADES_VALUE) {
        return gradeRows
          .filter((row) => (Array.isArray(row.subjects) ? row.subjects : []).includes(selectedSubject))
          .map((row) => ({
            grade: String(row.grade || "").trim(),
            subject: String(selectedSubject || "").trim(),
          }));
      }

      if (selectedSubject === ALL_SUBJECTS_VALUE) {
        const subjects = gradeRows.find((row) => row.grade === selectedGrade)?.subjects || [];
        return subjects.map((subject) => ({
          grade: String(selectedGrade || "").trim(),
          subject: String(subject || "").trim(),
        }));
      }

      return [
        {
          grade: String(selectedGrade || "").trim(),
          subject: String(selectedSubject || "").trim(),
        },
      ];
    })();

    const targetPairsMap = new Map();
    targetPairsRaw.forEach((pair) => {
      if (!pair.grade || !pair.subject) return;
      targetPairsMap.set(`${pair.grade}__${pair.subject.toLowerCase()}`, pair);
    });
    const targetPairs = Array.from(targetPairsMap.values());

    if (!targetPairs.length) {
      setSaveMessage("No grade/subject targets found for this selection.");
      return;
    }

    const assessmentsObject = {};
    cleaned.forEach((item, idx) => {
      assessmentsObject[`a${idx + 1}`] = {
        name: item.name,
        max: item.max,
        score: 0,
      };
    });

    setSaving(true);
    try {
      const templateWrites = [];

      targetPairs.forEach((pair) => {
        const subjectKey = toSubjectKey(pair.subject);
        const savePath = assessmentMode === "semester"
          ? `${SCHOOL_DB_ROOT}/AssesmentTemplates/${encodeURIComponent(pair.grade)}/${encodeURIComponent(subjectKey)}/${activeSemester}.json`
          : `${SCHOOL_DB_ROOT}/AssesmentTemplates/${encodeURIComponent(pair.grade)}/${encodeURIComponent(subjectKey)}/${activeSemester}/${selectedQuarter}.json`;

        templateWrites.push(
          axios.put(savePath, {
            grade: pair.grade,
            subject: pair.subject,
            semester: activeSemester,
            quarter: assessmentMode === "quarter" ? selectedQuarter : null,
            mode: assessmentMode,
            assessments: assessmentsObject,
            totalMax,
            updatedAt: new Date().toISOString(),
            updatedBy: admin?.adminId || admin?.name || "admin",
          })
        );
      });

      if (templateWrites.length) {
        await Promise.all(templateWrites);
      }

      setSaveMessage(
        `Saved ${targetPairs.length} template structure(s) in AssesmentTemplates.`
      );
    } catch {
      setSaveMessage("Failed to save assessment structure.");
    } finally {
      setSaving(false);
    }
  };

  const totalConfiguredSubjects = gradeRows.reduce(
    (sum, row) => sum + (Array.isArray(row.subjects) ? row.subjects.length : 0),
    0
  );
  const currentTotalMax = assessmentList.reduce((sum, item) => sum + Number(item.max || 0), 0);
  const saveMessageTone = saveMessage.toLowerCase();
  const hasSaveError =
    saveMessageTone.includes("failed") ||
    saveMessageTone.includes("must") ||
    saveMessageTone.includes("select") ||
    saveMessageTone.includes("add at least") ||
    saveMessageTone.includes("no grade/subject");

  const shellCardStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    borderRadius: 16,
  };

  const heroCardStyle = {
    ...shellCardStyle,
    width: "100%",
    maxWidth: "min(1320px, 100%)",
    margin: "0 auto 14px",
    padding: 20,
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--surface-panel) 88%, white) 0%, color-mix(in srgb, var(--surface-panel) 94%, var(--surface-accent)) 100%)",
  };

  const statCardStyle = {
    ...shellCardStyle,
    padding: "16px 18px",
    minHeight: 108,
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(180deg, var(--surface-panel) 0%, color-mix(in srgb, var(--surface-panel) 82%, var(--surface-accent)) 100%)",
  };

  const contentCardStyle = {
    ...shellCardStyle,
    width: "100%",
    maxWidth: "min(1320px, 100%)",
    margin: "0 auto",
    padding: 20,
    display: "grid",
    gap: 16,
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-panel) 86%, var(--surface-accent)) 0%, var(--surface-panel) 100%)",
    boxShadow: "var(--shadow-soft)",
  };

  const controlFieldStyle = {
    width: "100%",
    border: "1px solid var(--border-soft)",
    background: "var(--surface-panel)",
    color: "var(--text-primary)",
    borderRadius: 12,
    padding: "11px 12px",
    outline: "none",
    fontSize: 13,
    boxSizing: "border-box",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72)",
  };

  const filterGroupStyle = {
    border: "1px solid color-mix(in srgb, var(--accent) 8%, var(--border-soft))",
    borderRadius: 16,
    padding: 16,
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-muted) 90%, white) 0%, var(--surface-panel) 100%)",
    display: "grid",
    gap: 12,
  };

  const chipButtonStyle = (isActive) => ({
    padding: "8px 12px",
    borderRadius: 10,
    border: isActive
      ? "1px solid color-mix(in srgb, var(--accent-strong) 34%, white)"
      : "1px solid var(--border-soft)",
    background: isActive ? "var(--accent-soft)" : "var(--surface-panel)",
    color: isActive ? "var(--accent-strong)" : "var(--text-muted)",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: isActive ? "0 8px 20px rgba(0, 122, 251, 0.10)" : "none",
  });

  const actionButtonStyle = {
    border: "1px solid var(--border-soft)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-accent) 78%, white) 0%, color-mix(in srgb, var(--surface-accent) 96%, var(--surface-panel)) 100%)",
    color: "var(--accent-strong)",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(0, 122, 251, 0.08)",
  };

  const FEED_MAX_WIDTH = "min(1320px, 100%)";

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

        <div className="main-content google-main" style={{ flex: "1 1 0", minWidth: 0, maxWidth: "none", margin: 0, boxSizing: "border-box", alignSelf: "flex-start", minHeight: "calc(100vh - 24px)", overflowY: "visible", overflowX: "hidden", position: "relative", padding: "0 12px 0 2px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: FEED_MAX_WIDTH, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 56 }}>
            <div style={heroCardStyle}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, var(--accent), var(--accent-strong), color-mix(in srgb, var(--accent) 68%, white))" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.01em" }}>Assessment</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)", maxWidth: 620, lineHeight: 1.5 }}>
                    Configure semester and quarter assessment structures with the same streamlined workspace used across the rest of the admin pages.
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, background: "color-mix(in srgb, var(--surface-muted) 86%, white)", border: "1px solid var(--border-soft)", fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: loading ? "var(--warning)" : "var(--success)", boxShadow: loading ? "0 0 0 4px color-mix(in srgb, var(--warning) 18%, transparent)" : "0 0 0 4px color-mix(in srgb, var(--success) 18%, transparent)" }} />
                  {loading ? "Loading workspace..." : `${gradeRows.length} grades ready`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, position: "relative", zIndex: 1 }}>
                {["Assessment Workspace", activeSemester === "semester1" ? "Semester 1" : "Semester 2", assessmentMode === "quarter" ? "Quarter-based" : "Semester-only"].map((item) => (
                  <div key={item} style={{ padding: "7px 12px", borderRadius: 999, background: "color-mix(in srgb, var(--surface-panel) 72%, white)", border: "1px solid var(--border-soft)", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
              {[
                { title: "Grades", value: loading ? "--" : gradeRows.length, note: "Available grade levels", tone: "var(--accent-strong)" },
                { title: "Subjects", value: loading ? "--" : totalConfiguredSubjects, note: "Mapped subject entries", tone: "var(--success)" },
                { title: "Class Mark", value: `${currentTotalMax}/100`, note: "Current assessment total", tone: currentTotalMax === 100 ? "var(--success)" : "var(--text-primary)" },
              ].map((card) => (
                <div key={card.title} style={statCardStyle}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${card.tone}, color-mix(in srgb, ${card.tone} 42%, white))` }} />
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.02em" }}>{card.title}</div>
                  <div style={{ marginTop: 10, fontSize: 31, lineHeight: 1, fontWeight: 800, color: card.tone }}>{card.value}</div>
                  <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{card.note}</div>
                </div>
              ))}
            </div>

            <div style={contentCardStyle}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 72%, white))" }} />
              {loading ? (
                <div style={{ paddingTop: 6, color: "var(--text-secondary)", fontSize: 13, fontWeight: 700 }}>Loading grades and subjects...</div>
              ) : error ? (
                <div style={{ color: "var(--danger, #b42318)", fontWeight: 700, paddingTop: 6 }}>{error}</div>
              ) : gradeRows.length === 0 ? (
                <div style={{ paddingTop: 6, color: "var(--text-secondary)", fontSize: 13, fontWeight: 700 }}>No grades found.</div>
              ) : (
                <div style={{ display: "grid", gap: 16, position: "relative", zIndex: 1 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Grade</div>
                      <select
                        value={selectedGrade}
                        onChange={(event) => setSelectedGrade(event.target.value)}
                        style={controlFieldStyle}
                      >
                        <option value={ALL_GRADES_VALUE}>All Grades</option>
                        {gradeRows.map((row) => (
                          <option key={row.grade} value={row.grade}>{`Grade ${row.grade}`}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Subject</div>
                      <select
                        value={selectedSubject}
                        onChange={(event) => setSelectedSubject(event.target.value)}
                        disabled={selectedGrade === ALL_GRADES_VALUE}
                        style={{ ...controlFieldStyle, opacity: selectedGrade === ALL_GRADES_VALUE ? 0.75 : 1, cursor: selectedGrade === ALL_GRADES_VALUE ? "not-allowed" : "pointer" }}
                      >
                        <option value={ALL_SUBJECTS_VALUE}>All Subjects</option>
                        {subjectOptions.length ? (
                          subjectOptions.map((subject) => (
                            <option key={subject} value={subject}>{subject}</option>
                          ))
                        ) : (
                          <option value="">No subjects assigned</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
                    <div style={filterGroupStyle}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>Assessment Mode</div>
                        <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)" }}>Choose how templates should be stored for the active period.</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <button type="button" onClick={() => setAssessmentMode("semester")} style={chipButtonStyle(assessmentMode === "semester")}>
                          Semester-only
                        </button>
                        <button type="button" onClick={() => setAssessmentMode("quarter")} style={chipButtonStyle(assessmentMode === "quarter")}>
                          Quarter-based
                        </button>
                      </div>
                    </div>

                    <div style={filterGroupStyle}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>Academic Period</div>
                        <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)" }}>Switch semester and optionally pin a quarter when needed.</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {["semester1", "semester2"].map((semesterKey) => {
                          const isActive = activeSemester === semesterKey;
                          return (
                            <button
                              key={semesterKey}
                              type="button"
                              onClick={() => setActiveSemester(semesterKey)}
                              style={chipButtonStyle(isActive)}
                            >
                              {semesterKey === "semester1" ? "Semester 1" : "Semester 2"}
                            </button>
                          );
                        })}
                      </div>

                      {assessmentMode === "quarter" ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 12 }}>Quarter</div>
                          {quarters.map((quarter) => {
                            const isActive = selectedQuarter === quarter;
                            return (
                              <button
                                key={quarter}
                                type="button"
                                onClick={() => setSelectedQuarter(quarter)}
                                style={chipButtonStyle(isActive)}
                              >
                                {quarter.toUpperCase()}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontWeight: 700, color: "var(--text-secondary)", fontSize: 12 }}>
                          Semester-only mode is active.
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ ...filterGroupStyle, gap: 12, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 15 }}>Assessment Structure (Class Mark)</div>
                        <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)" }}>Build the weighted assessment mix and keep the class mark at exactly 100.</div>
                      </div>
                      <div style={{ fontSize: 12, color: currentTotalMax === 100 ? "var(--success)" : "var(--text-secondary)", fontWeight: 800, padding: "7px 11px", borderRadius: 999, background: "#ffffff", border: "1px solid color-mix(in srgb, var(--accent) 10%, var(--border-soft))" }}>
                        Total Max: {currentTotalMax} / 100
                      </div>
                    </div>

                    {assessmentList.map((assessment, index) => (
                      <div key={index} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "12px 12px", borderRadius: 14, border: "1px solid color-mix(in srgb, var(--accent) 8%, var(--border-soft))", background: "#ffffff" }}>
                        <input
                          value={assessment.name}
                          onChange={(event) => updateAssessment(index, "name", event.target.value)}
                          placeholder="Assessment Name"
                          style={{ ...controlFieldStyle, flex: 2, minWidth: 220 }}
                        />
                        <input
                          type="number"
                          value={assessment.max}
                          onChange={(event) => updateAssessment(index, "max", event.target.value)}
                          placeholder="Max"
                          style={{ ...controlFieldStyle, width: 110 }}
                        />
                        <button
                          type="button"
                          onClick={() => removeAssessment(index)}
                          style={{ ...actionButtonStyle, color: "var(--text-primary)", boxShadow: "none" }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={addAssessment}
                        style={actionButtonStyle}
                      >
                        Add Assessment
                      </button>

                      <div style={{ color: "var(--text-secondary)", fontWeight: 700, fontSize: 12 }}>
                        Use percentages that add up to exactly 100 before saving.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={saveAssessmentStructure}
                      disabled={saving || !selectedSubject}
                      style={{ padding: "11px 16px", borderRadius: 12, border: "none", background: saving ? "var(--surface-strong)" : "var(--accent-strong)", color: "#fff", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 14px 28px rgba(0, 122, 251, 0.16)" }}
                    >
                      {saving ? "Saving..." : "Save Semester / Quarter Assessment"}
                    </button>
                    {saveMessage ? (
                      <div style={{ color: hasSaveError ? "var(--danger, #b42318)" : "var(--text-secondary)", fontWeight: 700, fontSize: 12 }}>
                        {saveMessage}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
