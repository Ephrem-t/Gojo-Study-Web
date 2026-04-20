import React, { useEffect, useMemo, useState } from "react";
import {
  FaChartLine,
  FaChalkboardTeacher,
  FaChevronDown,
  FaCog,
  FaFileAlt,
  FaHome,
  FaPlus,
  FaSignOutAlt,
  FaSyncAlt,
  FaTrashAlt,
  FaUsers,
} from "react-icons/fa";
import axios from "axios";
import { loadGradeManagementNode, loadSchoolInfoNode, loadSchoolStudentsNode } from "../utils/registerData";

const PAGE_BG = "linear-gradient(150deg, var(--page-bg-secondary) 0%, var(--page-bg) 45%, color-mix(in srgb, var(--page-bg-secondary) 78%, white) 100%)";

const cardStyle = {
  background: "var(--surface-panel)",
  border: "1px solid var(--border-soft)",
  borderRadius: 16,
  boxShadow: "var(--shadow-panel)",
};

const inputStyle = {
  border: "1px solid var(--input-border)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  background: "var(--input-bg)",
  color: "var(--text-primary)",
};

const primaryButtonStyle = {
  border: "1px solid var(--accent-strong)",
  background: "var(--accent-strong)",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 800,
};

const successButtonStyle = {
  border: "1px solid var(--success)",
  background: "var(--success)",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 800,
};

const dangerGhostButtonStyle = {
  border: "1px solid var(--danger)",
  background: "var(--danger-soft)",
  color: "var(--danger)",
  borderRadius: 7,
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 800,
};

const tableHeadStyle = {
  fontSize: 12,
  fontWeight: 900,
  color: "var(--text-secondary)",
};

const toneByStat = {
  blue: "var(--accent-strong)",
  green: "var(--success)",
  purple: "color-mix(in srgb, var(--accent) 72%, var(--text-primary))",
  amber: "var(--warning)",
};

export default function GredeManagement() {
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

  const [gradesMap, setGradesMap] = useState({});
  const [studentsMap, setStudentsMap] = useState({});
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);

  const [newGrade, setNewGrade] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [newSection, setNewSection] = useState("");
  const [newSectionMax, setNewSectionMax] = useState("40");
  const [selectedSection, setSelectedSection] = useState("");
  const [sectionMaxDraft, setSectionMaxDraft] = useState({});

  const [activeAcademicYear, setActiveAcademicYear] = useState("");

  const notify = (type, text) => setFeedback({ type, text });

  const isValidGradeKey = (value) => {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= 12;
  };

  const normalizeGradeInput = (raw) => {
    const digits = String(raw || "").replace(/[^0-9]/g, "");
    if (!digits) return "";
    const normalized = String(Number(digits));
    if (normalized === "0" || normalized === "NaN") return "";
    return normalized;
  };

  const gradeKeys = useMemo(
    () => Object.keys(gradesMap || {}).sort((a, b) => Number(a) - Number(b)),
    [gradesMap]
  );

  const stats = useMemo(() => {
    let totalSections = 0;
    let totalCapacity = 0;

    gradeKeys.forEach((grade) => {
      const sections = (gradesMap[grade] || {}).sections || {};
      totalSections += Object.keys(sections).length;
      Object.values(sections).forEach((sectionNode) => {
        totalCapacity += Number(sectionNode?.maxStudents || 0);
      });
    });

    const activeStudentCount = Object.values(studentsMap || {}).filter((studentNode) => {
      const row = studentNode || {};
      if (!activeAcademicYear) return true;
      return String(row.academicYear || "") === String(activeAcademicYear);
    }).length;

    return {
      totalGrades: gradeKeys.length,
      totalSections,
      totalCapacity,
      activeStudentCount,
    };
  }, [gradeKeys, gradesMap, studentsMap, activeAcademicYear]);

  const sectionStudentList = useMemo(() => {
    if (!selectedGrade || !selectedSection) return [];

    const out = [];
    Object.entries(studentsMap || {}).forEach(([studentId, studentNode]) => {
      const row = studentNode || {};
      if (String(row.grade || "") !== String(selectedGrade)) return;
      if (String(row.section || "").toUpperCase() !== String(selectedSection || "").toUpperCase()) return;
      if (activeAcademicYear && String(row.academicYear || "") !== String(activeAcademicYear)) return;

      out.push({
        studentId,
        name:
          row.name ||
          [row.firstName, row.middleName, row.lastName].filter(Boolean).join(" ") ||
          row.basicStudentInformation?.name ||
          "Student",
        grade: row.grade || "",
        section: row.section || "",
        academicYear: row.academicYear || "",
      });
    });

    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [studentsMap, selectedGrade, selectedSection, activeAcademicYear]);

  const sectionOccupancy = useMemo(() => {
    const occupancy = {};

    Object.values(studentsMap || {}).forEach((studentNode) => {
      const row = studentNode || {};
      if (activeAcademicYear && String(row.academicYear || "") !== String(activeAcademicYear)) return;
      const grade = String(row.grade || "");
      const section = String(row.section || "").toUpperCase();
      if (!grade || !section) return;

      const key = `${grade}__${section}`;
      occupancy[key] = (occupancy[key] || 0) + 1;
    });

    return occupancy;
  }, [studentsMap, activeAcademicYear]);

  const loadData = async () => {
    if (!schoolCode) {
      notify("error", "Missing schoolCode in session. Please login again.");
      return;
    }

    setLoading(true);
    try {
      const [rawGrades, studentsData, schoolInfo] = await Promise.all([
        loadGradeManagementNode({ rtdbBase: DB_URL }),
        loadSchoolStudentsNode({ rtdbBase: DB_URL }),
        loadSchoolInfoNode({ rtdbBase: DB_URL }),
      ]);

      const nextGrades = Object.fromEntries(
        Object.entries(rawGrades).filter(([gradeKey]) => isValidGradeKey(gradeKey))
      );

      setGradesMap(nextGrades);
      setStudentsMap(studentsData || {});
      setActiveAcademicYear(String(schoolInfo?.currentAcademicYear || ""));

      const sorted = Object.keys(nextGrades).sort((a, b) => Number(a) - Number(b));
      const firstGrade = sorted[0] || "";

      setSelectedGrade((prev) => {
        if (prev && nextGrades[prev]) return prev;
        return firstGrade;
      });

      setSelectedSection((prev) => {
        if (!prev) return "";
        const currentGrade = selectedGrade && nextGrades[selectedGrade] ? selectedGrade : firstGrade;
        const sections = (nextGrades[currentGrade] || {}).sections || {};
        return sections[prev] ? prev : "";
      });

      notify("", "");
    } catch (err) {
      notify("error", err?.response?.data?.message || err?.message || "Failed to load grade management data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [schoolCode]);

  useEffect(() => {
    const nextDraft = {};

    gradeKeys.forEach((grade) => {
      const sections = ((gradesMap[grade] || {}).sections || {});
      Object.entries(sections).forEach(([sectionKey, sectionNode]) => {
        nextDraft[`${grade}__${String(sectionKey).toUpperCase()}`] = String(sectionNode?.maxStudents || 40);
      });
    });

    setSectionMaxDraft(nextDraft);
  }, [gradesMap, gradeKeys]);

  const createGrade = async () => {
    const value = normalizeGradeInput(newGrade);
    if (!value) {
      notify("error", "Please enter a grade.");
      return;
    }

    const gradeNum = Number(value);
    if (!Number.isInteger(gradeNum) || gradeNum < 1 || gradeNum > 12) {
      notify("error", "Grade must be from 1 to 12.");
      return;
    }

    const gradeKey = String(gradeNum);
    if (gradesMap[gradeKey]) {
      notify("warning", `Grade ${gradeKey} already exists.`);
      setSelectedGrade(gradeKey);
      return;
    }

    setWorking(true);
    try {
      await axios.patch(`${DB_URL}/GradeManagement/grades/${gradeKey}.json`, {
        grade: gradeKey,
        sections: {},
        createdAt: new Date().toISOString(),
      });
      setNewGrade("");
      setSelectedGrade(gradeKey);
      setSelectedSection("");
      await loadData();
      notify("success", `Grade ${gradeKey} created successfully.`);
    } catch (err) {
      notify("error", err?.response?.data?.message || err?.message || "Failed to create grade.");
    } finally {
      setWorking(false);
    }
  };

  const addSection = async () => {
    if (!selectedGrade) {
      notify("error", "Please choose a grade first.");
      return;
    }

    const sectionKey = String(newSection || "").trim().toUpperCase();
    if (!sectionKey) {
      notify("error", "Please enter section name (A, B, C...).");
      return;
    }

    const maxStudents = Number(newSectionMax || 0);
    if (!Number.isInteger(maxStudents) || maxStudents < 1) {
      notify("error", "Max students must be a positive number.");
      return;
    }

    const existingSections = ((gradesMap[selectedGrade] || {}).sections || {});
    if (existingSections[sectionKey]) {
      notify("warning", `Section ${sectionKey} already exists in Grade ${selectedGrade}.`);
      setSelectedSection(sectionKey);
      return;
    }

    setWorking(true);
    try {
      await axios.patch(`${DB_URL}/GradeManagement/grades/${selectedGrade}/sections/${sectionKey}.json`, {
        section: sectionKey,
        maxStudents,
        createdAt: new Date().toISOString(),
      });

      setNewSection("");
      setNewSectionMax("40");
      setSelectedSection(sectionKey);
      await loadData();
      notify("success", `Section ${sectionKey} added to Grade ${selectedGrade}.`);
    } catch (err) {
      notify("error", err?.response?.data?.message || err?.message || "Failed to add section.");
    } finally {
      setWorking(false);
    }
  };

  const updateSectionMax = async (gradeKey, sectionKey) => {
    const draftKey = `${gradeKey}__${String(sectionKey || "").toUpperCase()}`;
    const maxStudents = Number(sectionMaxDraft[draftKey] || 0);

    if (!Number.isInteger(maxStudents) || maxStudents < 1) {
      notify("error", "Max students must be a positive number.");
      return;
    }

    setWorking(true);
    try {
      await axios.patch(`${DB_URL}/GradeManagement/grades/${gradeKey}/sections/${sectionKey}.json`, {
        maxStudents,
        updatedAt: new Date().toISOString(),
      });

      await loadData();
      notify("success", `Section ${sectionKey} max updated to ${maxStudents}.`);
    } catch (err) {
      notify("error", err?.response?.data?.message || err?.message || "Failed to update max students.");
    } finally {
      setWorking(false);
    }
  };

  const deleteSection = async (gradeKey, sectionKey) => {
    const key = `${gradeKey}__${String(sectionKey || "").toUpperCase()}`;
    const occupied = Number(sectionOccupancy[key] || 0);

    if (occupied > 0) {
      notify("warning", `Section ${sectionKey} has ${occupied} students. Move them before deleting.`);
      return;
    }

    const confirmed = window.confirm(`Delete section ${sectionKey} from Grade ${gradeKey}?`);
    if (!confirmed) return;

    setWorking(true);
    try {
      await axios.delete(`${DB_URL}/GradeManagement/grades/${gradeKey}/sections/${sectionKey}.json`);

      if (selectedGrade === gradeKey && selectedSection === sectionKey) {
        setSelectedSection("");
      }

      await loadData();
      notify("success", `Section ${sectionKey} deleted from Grade ${gradeKey}.`);
    } catch (err) {
      notify("error", err?.response?.data?.message || err?.message || "Failed to delete section.");
    } finally {
      setWorking(false);
    }
  };

  const deleteGrade = async (gradeKey) => {
    const sections = (gradesMap[gradeKey] || {}).sections || {};
    if (Object.keys(sections).length > 0) {
      notify("warning", `Grade ${gradeKey} still has sections. Delete sections first.`);
      return;
    }

    const studentsInGrade = Object.values(studentsMap || {}).filter((studentNode) => {
      const row = studentNode || {};
      if (String(row.grade || "") !== String(gradeKey)) return false;
      if (activeAcademicYear && String(row.academicYear || "") !== String(activeAcademicYear)) return false;
      return true;
    }).length;

    if (studentsInGrade > 0) {
      notify("warning", `Grade ${gradeKey} has ${studentsInGrade} students and cannot be deleted.`);
      return;
    }

    const confirmed = window.confirm(`Delete Grade ${gradeKey}? This action cannot be undone.`);
    if (!confirmed) return;

    setWorking(true);
    try {
      await axios.delete(`${DB_URL}/GradeManagement/grades/${gradeKey}.json`);

      if (selectedGrade === gradeKey) {
        setSelectedGrade("");
        setSelectedSection("");
      }

      await loadData();
      notify("success", `Grade ${gradeKey} deleted.`);
    } catch (err) {
      notify("error", err?.response?.data?.message || err?.message || "Failed to delete grade.");
    } finally {
      setWorking(false);
    }
  };

  const sectionColumns = {
    display: "grid",
    gridTemplateColumns: "0.8fr 1fr 1.2fr 1fr",
    gap: 8,
    alignItems: "center",
  };

  const studentColumns = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 0.7fr 0.7fr",
    gap: 8,
    alignItems: "center",
  };

  return (
    <div style={{ padding: "10px 6px 20px", minWidth: 0, boxSizing: "border-box", color: "var(--text-primary)" }}>
      <style>
        {`
          .grade-actions-wrap {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .gm-top-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }
          .gm-add-section-grid {
            display: grid;
            grid-template-columns: minmax(140px, 1fr) minmax(120px, 1fr) 110px auto;
            gap: 8px;
            align-items: center;
          }
          .gm-max-input {
            width: 100%;
            max-width: 110px;
            justify-self: start;
          }
          .gm-dashboard {
            display: flex;
            gap: 14px;
            padding: 12px;
          }
          .gm-sidebar {
            width: 220px;
          }
          .gm-stats {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
          }
          @media (max-width: 1180px) {
            .gm-dashboard {
              flex-direction: column;
            }
            .gm-sidebar {
              width: auto;
            }
          }
          @media (max-width: 980px) {
            .gm-top-grid {
              grid-template-columns: 1fr;
            }
            .gm-stats {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .gm-add-section-grid {
              grid-template-columns: 1fr 1fr;
            }
            .gm-max-input {
              max-width: 100%;
            }
          }
          @media (max-width: 640px) {
            .grade-actions-wrap {
              flex-direction: column;
              align-items: stretch;
            }
            .gm-stats {
              grid-template-columns: 1fr;
            }
            .gm-add-section-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

      <div style={{ width: "min(100%, 1180px)", margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="section-header-card" style={{ padding: 18 }}>
              <div className="section-header-card__row">
                <div>
                  <h1 className="section-header-card__title" style={{ fontSize: 24, fontWeight: 900 }}>Grede Management</h1>
                  <p className="section-header-card__subtitle" style={{ fontSize: 13 }}>
                    Manage grades and sections with capacity control and live section occupancy.
                  </p>
                </div>

                <div className="section-header-card__actions">
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>
                    {activeAcademicYear ? `Current Year: ${activeAcademicYear.replace("_", "/")}` : "No active academic year"}
                  </div>
                  <button
                    type="button"
                    onClick={loadData}
                    disabled={loading || working}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      border: "1px solid var(--border-strong)",
                      background: "var(--accent-soft)",
                      color: "var(--accent-strong)",
                      borderRadius: 9,
                      padding: "7px 10px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: loading || working ? "not-allowed" : "pointer",
                      opacity: loading || working ? 0.6 : 1,
                    }}
                  >
                    <FaSyncAlt /> Refresh
                  </button>
                </div>
              </div>
            </div>

            <div className="gm-stats">
              {[{
                title: "Total Grades",
                value: stats.totalGrades,
                hint: "Configured levels",
                color: toneByStat.blue,
              }, {
                title: "Total Sections",
                value: stats.totalSections,
                hint: "Across all grades",
                color: toneByStat.green,
              }, {
                title: "Section Capacity",
                value: stats.totalCapacity,
                hint: "Maximum seat count",
                color: toneByStat.purple,
              }, {
                title: "Students (Year)",
                value: stats.activeStudentCount,
                hint: activeAcademicYear ? activeAcademicYear.replace("_", "/") : "All years",
                color: toneByStat.amber,
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

            {feedback.text ? (
              <div
                style={{
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  border: `1px solid ${feedback.type === "error" ? "var(--danger-border)" : feedback.type === "warning" ? "var(--warning-border)" : "var(--border-strong)"}`,
                  background: feedback.type === "error" ? "var(--danger-soft)" : feedback.type === "warning" ? "var(--warning-soft)" : "var(--accent-soft)",
                  color: feedback.type === "error" ? "var(--danger)" : feedback.type === "warning" ? "var(--warning)" : "var(--accent-strong)",
                }}
              >
                {feedback.text}
              </div>
            ) : null}

            <div className="gm-top-grid">
              <div style={{ ...cardStyle, padding: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-primary)", marginBottom: 10 }}>Create Grade (1-12)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <input
                    value={newGrade}
                    onChange={(e) => setNewGrade(normalizeGradeInput(e.target.value))}
                    placeholder="Example: 1"
                    style={{ ...inputStyle, padding: "9px 10px" }}
                  />
                  <button
                    onClick={createGrade}
                    disabled={working}
                    style={{ ...primaryButtonStyle, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.75 : 1, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <FaPlus /> Create
                  </button>
                </div>
              </div>

              <div style={{ ...cardStyle, padding: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-primary)", marginBottom: 10 }}>Add Section & Max Students</div>
                <div className="gm-add-section-grid">
                  <select
                    value={selectedGrade}
                    onChange={(e) => {
                      setSelectedGrade(e.target.value);
                      setSelectedSection("");
                    }}
                    style={inputStyle}
                  >
                    <option value="">Select Grade</option>
                    {gradeKeys.map((grade) => (
                      <option key={grade} value={grade}>Grade {grade}</option>
                    ))}
                  </select>

                  <input
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value.toUpperCase())}
                    placeholder="Section (A/B/C)"
                    style={inputStyle}
                  />

                  <input
                    value={newSectionMax}
                    onChange={(e) => setNewSectionMax(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="Max"
                    className="gm-max-input"
                    style={inputStyle}
                  />

                  <button
                    onClick={addSection}
                    disabled={working || !selectedGrade}
                    style={{ ...successButtonStyle, cursor: working || !selectedGrade ? "not-allowed" : "pointer", opacity: working || !selectedGrade ? 0.75 : 1, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <FaPlus /> Add
                  </button>
                </div>
              </div>
            </div>

            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", fontWeight: 900, color: "var(--text-primary)", borderBottom: "1px solid var(--border-soft)" }}>Grades & Sections</div>

              {loading ? (
                <div style={{ padding: 14, fontSize: 13, color: "var(--text-muted)" }}>Loading...</div>
              ) : gradeKeys.length === 0 ? (
                <div style={{ padding: 14, fontSize: 13, color: "var(--text-muted)" }}>No grades configured yet.</div>
              ) : (
                <>
                  <div style={{ ...sectionColumns, padding: "10px 14px", borderBottom: "1px solid var(--border-soft)", ...tableHeadStyle }}>
                    <div>Grade</div>
                    <div>Section</div>
                    <div>Students / Max</div>
                    <div>Actions</div>
                  </div>

                  {gradeKeys.map((grade) => {
                    const sections = ((gradesMap[grade] || {}).sections || {});
                    const sectionRows = Object.entries(sections).sort((a, b) => String(a[0]).localeCompare(String(b[0])));

                    if (sectionRows.length === 0) {
                      return (
                        <div key={grade} style={{ ...sectionColumns, padding: "10px 14px", borderTop: "1px solid var(--border-soft)" }}>
                          <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>Grade {grade}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>No section</div>
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>-</div>
                          <button
                            onClick={() => deleteGrade(grade)}
                            disabled={working}
                            style={{ ...dangerGhostButtonStyle, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1, width: "fit-content", display: "flex", alignItems: "center", gap: 6 }}
                          >
                            <FaTrashAlt /> Delete Grade
                          </button>
                        </div>
                      );
                    }

                    return sectionRows.map(([sectionKey, sectionNode], idx) => {
                      const maxStudents = Number(sectionNode?.maxStudents || 0);
                      const occupancyKey = `${grade}__${String(sectionKey || "").toUpperCase()}`;
                      const current = Number(sectionOccupancy[occupancyKey] || 0);

                      return (
                        <div key={`${grade}-${sectionKey}`} style={{ ...sectionColumns, padding: "10px 14px", borderTop: "1px solid var(--border-soft)" }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
                            {idx === 0 ? `Grade ${grade}` : ""}
                          </div>

                          <div style={{ fontSize: 12, fontWeight: 800 }}>{sectionKey}</div>

                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: current > maxStudents && maxStudents > 0 ? "var(--danger)" : "var(--success)" }}>
                              {current}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/</span>
                            <input
                              value={sectionMaxDraft[occupancyKey] || ""}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9]/g, "");
                                setSectionMaxDraft((prev) => ({ ...prev, [occupancyKey]: value }));
                              }}
                              style={{ ...inputStyle, width: 76, padding: "5px 8px", fontSize: 12 }}
                            />
                            <button
                              onClick={() => updateSectionMax(grade, sectionKey)}
                              disabled={working}
                              style={{ ...primaryButtonStyle, borderRadius: 7, padding: "5px 8px", fontSize: 11, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1 }}
                            >
                              Save
                            </button>
                          </div>

                          <div className="grade-actions-wrap">
                            <button
                              onClick={() => {
                                setSelectedGrade(String(grade));
                                setSelectedSection(String(sectionKey).toUpperCase());
                              }}
                              style={{ border: "1px solid var(--success)", background: "var(--success)", color: "#fff", borderRadius: 7, padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                            >
                              View
                            </button>

                            <button
                              onClick={() => deleteSection(grade, sectionKey)}
                              disabled={working}
                              style={{ ...dangerGhostButtonStyle, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}
                            >
                              <FaTrashAlt /> Delete
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })}
                </>
              )}
            </div>

            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", fontWeight: 900, color: "var(--text-primary)", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>
                  Section Student List {selectedGrade && selectedSection ? `- Grade ${selectedGrade} / ${selectedSection}` : ""}
                </span>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {activeAcademicYear ? `Year: ${activeAcademicYear.replace("_", "/")}` : "All years"}
                </div>
              </div>

              {!selectedGrade || !selectedSection ? (
                <div style={{ padding: 14, fontSize: 13, color: "var(--text-muted)" }}>Choose a section from the table above to view students.</div>
              ) : sectionStudentList.length === 0 ? (
                <div style={{ padding: 14, fontSize: 13, color: "var(--text-muted)" }}>No students found in this section.</div>
              ) : (
                <>
                  <div style={{ ...studentColumns, padding: "10px 14px", borderBottom: "1px solid var(--border-soft)", ...tableHeadStyle }}>
                    <div>Student</div>
                    <div>Student ID</div>
                    <div>Grade</div>
                    <div>Section</div>
                  </div>
                  {sectionStudentList.map((student) => (
                    <div key={student.studentId} style={{ ...studentColumns, padding: "10px 14px", borderTop: "1px solid var(--border-soft)" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{student.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{student.studentId}</div>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>{student.grade}</div>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>{student.section}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
      </div>
    </div>
  );
}
