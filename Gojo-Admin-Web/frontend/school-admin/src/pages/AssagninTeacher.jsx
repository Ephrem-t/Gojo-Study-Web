import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { FaCog, FaEdit, FaSave, FaTrash } from "react-icons/fa";
import Sidebar from "../components/Sidebar";

const RTDB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";

function AssagninTeacher() {
  const admin = JSON.parse(localStorage.getItem("admin")) || {};
  const schoolCode = String(admin.schoolCode || "").trim();
  const SCHOOL_DB_ROOT = schoolCode
    ? `${RTDB_BASE}/Platform1/Schools/${encodeURIComponent(schoolCode)}`
    : RTDB_BASE;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [gradeSectionMap, setGradeSectionMap] = useState({});
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);

  const getSchoolNodeUrl = (nodeName) => `${SCHOOL_DB_ROOT}/${nodeName}.json`;
  const getRootNodeUrl = (nodeName) => `${RTDB_BASE}/${nodeName}.json`;
  const getSchoolPathUrl = (path) => `${SCHOOL_DB_ROOT}/${path}.json`;
  const getRootPathUrl = (path) => `${RTDB_BASE}/${path}.json`;

  const readSchoolNode = async (nodeName) => {
    if (schoolCode) {
      try {
        const schoolRes = await axios.get(getSchoolNodeUrl(nodeName));
        if (schoolRes.data !== null && schoolRes.data !== undefined) {
          return schoolRes.data;
        }
      } catch (err) {
        // fallback to root for legacy paths
      }
    }

    try {
      const rootRes = await axios.get(getRootNodeUrl(nodeName));
      return rootRes.data ?? {};
    } catch (err) {
      return {};
    }
  };

  const createNodeWithFallback = async (path, payload) => {
    if (schoolCode) {
      try {
        const res = await axios.post(getSchoolPathUrl(path), payload);
        return res?.data?.name || null;
      } catch (err) {
        // fallback to root for legacy paths
      }
    }

    const rootRes = await axios.post(getRootPathUrl(path), payload);
    return rootRes?.data?.name || null;
  };

  const putNodeWithFallback = async (path, payload) => {
    if (schoolCode) {
      try {
        await axios.put(getSchoolPathUrl(path), payload);
        return;
      } catch (err) {
        // fallback to root for legacy paths
      }
    }

    await axios.put(getRootPathUrl(path), payload);
  };

  const deleteNodeWithFallback = async (path) => {
    if (schoolCode) {
      try {
        await axios.delete(getSchoolPathUrl(path));
        return;
      } catch (err) {
        // fallback to root for legacy paths
      }
    }

    await axios.delete(getRootPathUrl(path));
  };

  const addGradeSection = (map, gradeValue, sectionValue) => {
    const grade = String(gradeValue || "").trim();
    const section = String(sectionValue || "").trim().toUpperCase();
    if (!grade || !section) return;

    if (!map[grade]) map[grade] = new Set();
    map[grade].add(section);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");

      try {
        const [gradeMgmtRaw, coursesRaw, teachersRaw, usersRaw, assignmentsRaw] =
          await Promise.all([
            readSchoolNode("GradeManagement"),
            readSchoolNode("Courses"),
            readSchoolNode("Teachers"),
            readSchoolNode("Users"),
            readSchoolNode("TeacherAssignments"),
          ]);

        const classMap = {};

        const gradeMgmt =
          gradeMgmtRaw && typeof gradeMgmtRaw === "object" ? gradeMgmtRaw : {};
        const gradeEntries = Array.isArray(gradeMgmt?.grades)
          ? gradeMgmt.grades
          : Object.values(gradeMgmt?.grades || {});

        gradeEntries.forEach((entry) => {
          if (!entry || typeof entry !== "object") return;

          const grade = entry.grade;
          const sectionsNode = entry.sections;

          if (Array.isArray(sectionsNode)) {
            sectionsNode.forEach((sec) => {
              if (!sec) return;
              if (typeof sec === "string") {
                addGradeSection(classMap, grade, sec);
                return;
              }
              if (typeof sec === "object") {
                addGradeSection(classMap, grade, sec.section || sec.name || sec.code);
              }
            });
            return;
          }

          if (sectionsNode && typeof sectionsNode === "object") {
            Object.entries(sectionsNode).forEach(([sectionKey, sectionValue]) => {
              const sectionName =
                sectionValue && typeof sectionValue === "object"
                  ? sectionValue.section || sectionValue.name || sectionValue.code || sectionKey
                  : sectionKey;
              addGradeSection(classMap, grade, sectionName);
            });
          }
        });

        const coursesNode =
          coursesRaw && typeof coursesRaw === "object" ? coursesRaw : {};
        const courseList = Object.entries(coursesNode).map(([courseId, course]) => ({
          courseId,
          ...course,
        }));

        courseList.forEach((course) => {
          addGradeSection(classMap, course.grade, course.section);
        });

        const usersNode = usersRaw && typeof usersRaw === "object" ? usersRaw : {};
        const teachersNode =
          teachersRaw && typeof teachersRaw === "object" ? teachersRaw : {};

        const teacherList = Object.entries(teachersNode)
          .map(([teacherId, teacher]) => {
            const user =
              usersNode?.[teacher?.userId] ||
              Object.values(usersNode).find(
                (u) => String(u?.userId) === String(teacher?.userId)
              ) ||
              {};

            return {
              teacherId,
              userId: teacher?.userId || "",
              name: user?.name || user?.username || teacher?.name || teacherId,
            };
          })
          .sort((a, b) => String(a.name).localeCompare(String(b.name)));

        const assignmentsNode =
          assignmentsRaw && typeof assignmentsRaw === "object" ? assignmentsRaw : {};
        const assignmentList = Object.entries(assignmentsNode)
          .map(([assignmentId, assignment]) => ({
            assignmentId,
            courseId: assignment?.courseId || "",
            teacherId: assignment?.teacherId || "",
            createdAt: assignment?.createdAt || "",
            updatedAt: assignment?.updatedAt || "",
          }))
          .filter((a) => a.courseId && a.teacherId);

        const normalizedClassMap = {};
        Object.entries(classMap).forEach(([grade, sectionsSet]) => {
          normalizedClassMap[grade] = [...sectionsSet].sort((a, b) => a.localeCompare(b));
        });

        setGradeSectionMap(normalizedClassMap);
        setCourses(courseList);
        setTeachers(teacherList);
        setAssignments(assignmentList);
      } catch (err) {
        console.error("Failed to load assignment data:", err);
        setError("Failed to load data from database.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const gradeOptions = useMemo(
    () =>
      Object.keys(gradeSectionMap).sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return String(a).localeCompare(String(b));
      }),
    [gradeSectionMap]
  );

  const sectionsForGrade = useMemo(
    () => gradeSectionMap?.[selectedGrade] || [],
    [gradeSectionMap, selectedGrade]
  );

  const coursesForSelection = useMemo(
    () =>
      (courses || [])
        .filter(
          (course) =>
            String(course?.grade || "") === String(selectedGrade || "") &&
            String(course?.section || "").toUpperCase() ===
              String(selectedSection || "").toUpperCase()
        )
        .sort((a, b) => String(a.subject || "").localeCompare(String(b.subject || ""))),
    [courses, selectedGrade, selectedSection]
  );

  const courseMap = useMemo(() => {
    const out = {};
    (courses || []).forEach((course) => {
      out[course.courseId] = course;
    });
    return out;
  }, [courses]);

  const teacherMap = useMemo(() => {
    const out = {};
    (teachers || []).forEach((teacher) => {
      out[teacher.teacherId] = teacher;
    });
    return out;
  }, [teachers]);

  const existingAssignmentForCourse = useMemo(
    () => assignments.find((assignment) => assignment.courseId === selectedCourseId) || null,
    [assignments, selectedCourseId]
  );

  const assignmentRows = useMemo(
    () =>
      (assignments || [])
        .map((assignment) => {
          const course = courseMap?.[assignment.courseId] || {};
          const teacher = teacherMap?.[assignment.teacherId] || {};

          return {
            ...assignment,
            grade: course?.grade || "N/A",
            section: course?.section || "N/A",
            subject: course?.subject || course?.name || assignment.courseId,
            teacherName: teacher?.name || assignment.teacherId,
          };
        })
        .sort((a, b) => {
          const ga = Number(a.grade);
          const gb = Number(b.grade);
          if (Number.isFinite(ga) && Number.isFinite(gb) && ga !== gb) return ga - gb;
          if (String(a.section) !== String(b.section)) {
            return String(a.section).localeCompare(String(b.section));
          }
          return String(a.subject).localeCompare(String(b.subject));
        }),
    [assignments, courseMap, teacherMap]
  );

  useEffect(() => {
    setSelectedSection("");
    setSelectedCourseId("");
    setSelectedTeacherId("");
    setEditingAssignmentId(null);
    setMessage("");
    setError("");
  }, [selectedGrade]);

  useEffect(() => {
    setSelectedCourseId("");
    setSelectedTeacherId("");
    setEditingAssignmentId(null);
    setMessage("");
    setError("");
  }, [selectedSection]);

  useEffect(() => {
    if (!selectedCourseId || editingAssignmentId) return;
    const matched = assignments.find((a) => a.courseId === selectedCourseId);
    if (matched) {
      setSelectedTeacherId(matched.teacherId);
    }
  }, [selectedCourseId, assignments, editingAssignmentId]);

  const resetForm = () => {
    setSelectedCourseId("");
    setSelectedTeacherId("");
    setEditingAssignmentId(null);
  };

  const handleEdit = (row) => {
    setSelectedGrade(String(row.grade || ""));
    setSelectedSection(String(row.section || ""));
    setSelectedCourseId(row.courseId);
    setSelectedTeacherId(row.teacherId);
    setEditingAssignmentId(row.assignmentId);
    setMessage("");
    setError("");
  };

  const handleDelete = async (assignmentId) => {
    if (!assignmentId) return;

    setError("");
    setMessage("");

    try {
      await deleteNodeWithFallback(`TeacherAssignments/${assignmentId}`);
      setAssignments((prev) => prev.filter((item) => item.assignmentId !== assignmentId));
      if (editingAssignmentId === assignmentId) {
        resetForm();
      }
      setMessage("Assignment removed successfully.");
    } catch (err) {
      console.error("Failed to delete assignment:", err);
      setError("Failed to delete assignment.");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!selectedGrade || !selectedSection || !selectedCourseId || !selectedTeacherId) {
      setError("Please select grade, section, subject, and teacher.");
      return;
    }

    const payload = {
      courseId: selectedCourseId,
      teacherId: selectedTeacherId,
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);

    try {
      let targetAssignmentId = editingAssignmentId;

      if (!targetAssignmentId) {
        const matched = assignments.find((assignment) => assignment.courseId === selectedCourseId);
        if (matched) {
          targetAssignmentId = matched.assignmentId;
        }
      }

      if (targetAssignmentId) {
        const existing = assignments.find((a) => a.assignmentId === targetAssignmentId);
        await putNodeWithFallback(`TeacherAssignments/${targetAssignmentId}`, {
          courseId: selectedCourseId,
          teacherId: selectedTeacherId,
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: payload.updatedAt,
        });

        setAssignments((prev) =>
          prev.map((item) =>
            item.assignmentId === targetAssignmentId
              ? {
                  ...item,
                  courseId: selectedCourseId,
                  teacherId: selectedTeacherId,
                  updatedAt: payload.updatedAt,
                }
              : item
          )
        );

        setMessage("Assignment updated successfully.");
      } else {
        const createdAt = new Date().toISOString();
        const newId = await createNodeWithFallback("TeacherAssignments", {
          courseId: selectedCourseId,
          teacherId: selectedTeacherId,
          createdAt,
          updatedAt: createdAt,
        });

        if (!newId) {
          throw new Error("Could not create assignment key.");
        }

        setAssignments((prev) => [
          ...prev,
          {
            assignmentId: newId,
            courseId: selectedCourseId,
            teacherId: selectedTeacherId,
            createdAt,
            updatedAt: createdAt,
          },
        ]);

        setMessage("Teacher assigned successfully.");
      }

      resetForm();
    } catch (err) {
      console.error("Failed to save assignment:", err);
      setError("Failed to save assignment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="dashboard-page"
      style={{
        background: "var(--page-bg)",
        minHeight: "100vh",
        height: "100vh",
        overflow: "hidden",
        color: "var(--text-primary)",
      }}
    >
      <div
        className="google-dashboard"
        style={{ display: "flex", gap: 14, padding: "4px 14px", height: "calc(100vh - 73px)", overflow: "hidden", background: "var(--page-bg)", width: "100%", boxSizing: "border-box" }}
      >
        <Sidebar admin={admin} />

        <div
          style={{
            padding: "0 20px 20px",
            flex: 1,
            minWidth: 0,
            boxSizing: "border-box",
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <div
            className="section-header-card"
            style={{ marginBottom: "12px", width: "min(760px, 100%)" }}
          >
            <h2 className="section-header-card__title" style={{ fontSize: "20px" }}>
              Assign Teacher
            </h2>
            <div className="section-header-card__meta">
              <span>Assign a teacher to a specific grade, section, and subject.</span>
            </div>
          </div>

          <div
            style={{
              width: "min(760px, 100%)",
              background: "var(--surface-panel)",
              border: "1px solid var(--border-soft)",
              borderRadius: 14,
              boxShadow: "var(--shadow-soft)",
              padding: 14,
            }}
          >
            {loading ? (
              <p style={{ margin: 0, color: "var(--text-muted)" }}>Loading data...</p>
            ) : (
              <form onSubmit={handleSave}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 10,
                  }}
                >
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      fontWeight: 700,
                    }}
                  >
                    <option value="">Select Grade</option>
                    {gradeOptions.map((grade) => (
                      <option key={grade} value={grade}>
                        Grade {grade}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    disabled={!selectedGrade}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      fontWeight: 700,
                    }}
                  >
                    <option value="">Select Section</option>
                    {sectionsForGrade.map((section) => (
                      <option key={section} value={section}>
                        Section {section}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    disabled={!selectedGrade || !selectedSection}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      fontWeight: 700,
                    }}
                  >
                    <option value="">Select Subject</option>
                    {coursesForSelection.map((course) => (
                      <option key={course.courseId} value={course.courseId}>
                        {course.subject || course.name || course.courseId}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--input-border)",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      fontWeight: 700,
                    }}
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.teacherId} value={teacher.teacherId}>
                        {teacher.name}
                      </option>
                    ))}
                  </select>
                </div>

                {existingAssignmentForCourse && !editingAssignmentId ? (
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--warning)" }}>
                    This subject is already assigned to {teacherMap?.[existingAssignmentForCourse.teacherId]?.name || "a teacher"}. Saving will update the assignment.
                  </p>
                ) : null}

                {error ? <p style={{ margin: "10px 0 0", color: "var(--danger)", fontWeight: 700 }}>{error}</p> : null}
                {message ? <p style={{ margin: "10px 0 0", color: "var(--success)", fontWeight: 700 }}>{message}</p> : null}

                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      background: "var(--accent-strong)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <FaSave /> {saving ? "Saving..." : editingAssignmentId ? "Update Assignment" : "Assign Teacher"}
                  </button>

                  {editingAssignmentId ? (
                    <button
                      type="button"
                      onClick={resetForm}
                      style={{
                        background: "var(--surface-muted)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-soft)",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Cancel Edit
                    </button>
                  ) : null}
                </div>
              </form>
            )}
          </div>

          <div
            style={{
              marginTop: 14,
              width: "min(980px, 100%)",
              background: "var(--surface-panel)",
              border: "1px solid var(--border-soft)",
              borderRadius: 14,
              boxShadow: "var(--shadow-soft)",
              padding: 14,
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 10 }}>Current Teacher Assignments</h3>

            {assignmentRows.length === 0 ? (
              <p style={{ margin: 0, color: "var(--text-muted)" }}>No assignments found.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid var(--border-soft)" }}>Grade</th>
                      <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid var(--border-soft)" }}>Section</th>
                      <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid var(--border-soft)" }}>Subject</th>
                      <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid var(--border-soft)" }}>Teacher</th>
                      <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid var(--border-soft)" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentRows.map((row) => (
                      <tr key={row.assignmentId}>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid var(--border-soft)" }}>Grade {row.grade}</td>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid var(--border-soft)" }}>{row.section}</td>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid var(--border-soft)" }}>{row.subject}</td>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid var(--border-soft)" }}>{row.teacherName}</td>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid var(--border-soft)" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleEdit(row)}
                              style={{
                                border: "1px solid var(--border-soft)",
                                background: "var(--surface-muted)",
                                borderRadius: 8,
                                padding: "6px 8px",
                                cursor: "pointer",
                                color: "var(--text-primary)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <FaEdit /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row.assignmentId)}
                              style={{
                                border: "1px solid var(--danger-border)",
                                background: "var(--danger-soft)",
                                borderRadius: 8,
                                padding: "6px 8px",
                                cursor: "pointer",
                                color: "var(--danger)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <FaTrash /> Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssagninTeacher;
