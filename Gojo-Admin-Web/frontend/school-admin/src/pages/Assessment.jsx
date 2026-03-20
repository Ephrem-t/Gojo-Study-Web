import React, { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";

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

  return (
    <div className="dashboard-page" style={{ background: "var(--page-bg)", minHeight: "100vh", height: "100vh", overflow: "hidden", color: "var(--text-primary)" }}>
      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "4px 14px", height: "calc(100vh - 73px)", overflow: "hidden", background: "var(--page-bg)", width: "100%", boxSizing: "border-box" }}>
        <Sidebar admin={admin} />
        <div className="main-content google-main" style={{ padding: "0 2px", flex: "1.08 1 0", minWidth: 0, maxWidth: "none", boxSizing: "border-box", alignSelf: "stretch", margin: 0, height: "100%", overflowY: "auto", overflowX: "hidden" }}>
          <div style={{ width: "100%", maxWidth: "min(1320px, 100%)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 56 }}>
            <div className="section-header-card" style={{ marginBottom: 14, padding: 20 }}>
              <div className="section-header-card__row" style={{ justifyContent: "flex-start", alignItems: "flex-start", gap: 10, flexDirection: "column" }}>
                <div>
                  <h1 className="section-header-card__title" style={{ fontSize: 26, fontWeight: 900, letterSpacing: 0.2 }}>
                    Assessment
                  </h1>
                  <p className="section-header-card__subtitle" style={{ fontSize: 13, lineHeight: 1.55, maxWidth: 760 }}>
                    Manage student assessments and evaluation records.
                  </p>
                </div>

                <div className="section-header-card__actions">
                  <div style={{ display: "inline-flex", alignItems: "center", padding: "8px 14px", borderRadius: 999, border: "1px solid var(--border-strong)", background: "var(--surface-accent)", color: "var(--accent)", fontSize: 12, fontWeight: 800, letterSpacing: 0.2 }}>
                    Assessment Workspace
                  </div>
                </div>
              </div>
            </div>

            <div style={{ width: "min(980px, 100%)", margin: 0, borderRadius: 14, padding: "16px", background: "var(--surface-panel)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-soft)", color: "var(--text-secondary)", fontSize: 13 }}>
              {loading ? (
                <div>Loading grades and subjects...</div>
              ) : error ? (
                <div style={{ color: "var(--danger, #b42318)", fontWeight: 700 }}>{error}</div>
              ) : gradeRows.length === 0 ? (
                <div>No grades found.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Grade</div>
                      <select
                        value={selectedGrade}
                        onChange={(event) => setSelectedGrade(event.target.value)}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface-panel)", color: "var(--text-primary)" }}
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
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface-panel)", color: "var(--text-primary)" }}
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

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>Assessment Mode:</div>
                    <button
                      type="button"
                      onClick={() => setAssessmentMode("semester")}
                      style={{ padding: "8px 12px", borderRadius: 10, border: assessmentMode === "semester" ? "1px solid color-mix(in srgb, var(--accent-strong) 34%, white)" : "1px solid var(--border-soft)", background: assessmentMode === "semester" ? "var(--accent-soft)" : "var(--surface-panel)", color: assessmentMode === "semester" ? "var(--accent-strong)" : "var(--text-muted)", fontWeight: 700, cursor: "pointer" }}
                    >
                      Semester-only
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssessmentMode("quarter")}
                      style={{ padding: "8px 12px", borderRadius: 10, border: assessmentMode === "quarter" ? "1px solid color-mix(in srgb, var(--accent-strong) 34%, white)" : "1px solid var(--border-soft)", background: assessmentMode === "quarter" ? "var(--accent-soft)" : "var(--surface-panel)", color: assessmentMode === "quarter" ? "var(--accent-strong)" : "var(--text-muted)", fontWeight: 700, cursor: "pointer" }}
                    >
                      Quarter-based
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["semester1", "semester2"].map((semesterKey) => {
                      const isActive = activeSemester === semesterKey;
                      return (
                        <button
                          key={semesterKey}
                          type="button"
                          onClick={() => setActiveSemester(semesterKey)}
                          style={{ padding: "8px 12px", borderRadius: 10, border: isActive ? "1px solid color-mix(in srgb, var(--accent-strong) 34%, white)" : "1px solid var(--border-soft)", background: isActive ? "var(--accent-soft)" : "var(--surface-panel)", color: isActive ? "var(--accent-strong)" : "var(--text-muted)", fontWeight: 700, cursor: "pointer" }}
                        >
                          {semesterKey === "semester1" ? "Semester 1" : "Semester 2"}
                        </button>
                      );
                    })}
                  </div>

                  {assessmentMode === "quarter" ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>Quarter:</div>
                    {quarters.map((quarter) => {
                      const isActive = selectedQuarter === quarter;
                      return (
                        <button
                          key={quarter}
                          type="button"
                          onClick={() => setSelectedQuarter(quarter)}
                          style={{ padding: "8px 12px", borderRadius: 10, border: isActive ? "1px solid color-mix(in srgb, var(--accent-strong) 34%, white)" : "1px solid var(--border-soft)", background: isActive ? "var(--accent-soft)" : "var(--surface-panel)", color: isActive ? "var(--accent-strong)" : "var(--text-muted)", fontWeight: 700, cursor: "pointer" }}
                        >
                          {quarter.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                  ) : (
                    <div style={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                      Semester-only mode.
                    </div>
                  )}

                  <div style={{ border: "1px solid var(--border-soft)", borderRadius: 12, padding: 12, background: "var(--surface-muted)", display: "grid", gap: 10 }}>
                    <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>Assessment Structure (Class Mark)</div>
                    {assessmentList.map((assessment, index) => (
                      <div key={index} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <input
                          value={assessment.name}
                          onChange={(event) => updateAssessment(index, "name", event.target.value)}
                          placeholder="Assessment Name"
                          style={{ flex: 2, minWidth: 220, padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface-panel)" }}
                        />
                        <input
                          type="number"
                          value={assessment.max}
                          onChange={(event) => updateAssessment(index, "max", event.target.value)}
                          placeholder="Max"
                          style={{ width: 110, padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface-panel)" }}
                        />
                        <button
                          type="button"
                          onClick={() => removeAssessment(index)}
                          style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-primary)", fontWeight: 700, cursor: "pointer" }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={addAssessment}
                        style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-primary)", fontWeight: 700, cursor: "pointer" }}
                      >
                        Add Assessment
                      </button>

                      <div style={{ color: "var(--text-secondary)", fontWeight: 700 }}>
                        Total Max: {assessmentList.reduce((sum, item) => sum + Number(item.max || 0), 0)} / 100
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={saveAssessmentStructure}
                      disabled={saving || !selectedSubject}
                      style={{ padding: "10px 14px", borderRadius: 10, border: "none", background: saving ? "var(--surface-strong)" : "var(--accent-strong)", color: "#fff", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer" }}
                    >
                      {saving ? "Saving..." : "Save Semester / Quarter Assessment"}
                    </button>
                    {saveMessage ? (
                      <div style={{ color: saveMessage.toLowerCase().includes("failed") || saveMessage.toLowerCase().includes("must") || saveMessage.toLowerCase().includes("select") || saveMessage.toLowerCase().includes("add at least") ? "var(--danger, #b42318)" : "var(--text-secondary)", fontWeight: 700 }}>
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
