import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";

const RTDB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";
const GRADE_CACHE_KEY = "gojo_admin_grade_section_grades_v1";
const TEACHER_CACHE_KEY = "gojo_admin_grade_section_teachers_v1";
const GRADE_CACHE_TTL_MS = 45 * 1000;
const TEACHER_CACHE_TTL_MS = 45 * 1000;

const readSessionCache = (key, ttlMs) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const ts = Number(parsed.ts || 0);
    if (!ts || Date.now() - ts > ttlMs) return null;
    return parsed.data ?? null;
  } catch {
    return null;
  }
};

const writeSessionCache = (key, data) => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
  }
};

export default function SubjectManagementPage() {
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

  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subjectInputs, setSubjectInputs] = useState({});
  const [savingByGrade, setSavingByGrade] = useState({});
  const [messageByGrade, setMessageByGrade] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [teachersLoading, setTeachersLoading] = useState(true);
  const [selectedTeacherByTarget, setSelectedTeacherByTarget] = useState({});
  const [assignSavingByTarget, setAssignSavingByTarget] = useState({});
  const [assignMessageByTarget, setAssignMessageByTarget] = useState({});
  const [expandedByGrade, setExpandedByGrade] = useState({});

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
      } catch (readError) {
      }
    }

    try {
      const rootRes = await axios.get(getRootNodeUrl(nodeName));
      return rootRes.data ?? {};
    } catch (readError) {
      return {};
    }
  };

  const putNodeWithFallback = async (path, payload) => {
    if (schoolCode) {
      try {
        await axios.put(getSchoolPathUrl(path), payload);
        return;
      } catch (writeError) {
      }
    }

    await axios.put(getRootPathUrl(path), payload);
  };

  const normalizeSubjects = (subjectsNode) => {
    if (!subjectsNode) return [];

    if (Array.isArray(subjectsNode)) {
      return subjectsNode
        .map((subject, index) => {
          if (!subject) return null;
          if (typeof subject === "string") {
            return { key: `item_${index}`, name: subject };
          }
          const name = String(subject.name || subject.subject || "").trim();
          if (!name) return null;
          return { key: String(subject.id || subject.key || `item_${index}`), name };
        })
        .filter(Boolean);
    }

    if (typeof subjectsNode === "object") {
      return Object.entries(subjectsNode)
        .map(([subjectKey, subjectValue]) => {
          if (!subjectValue) return null;
          if (typeof subjectValue === "string") {
            return { key: subjectKey, name: subjectValue };
          }
          const name = String(subjectValue.name || subjectValue.subject || subjectKey).trim();
          if (!name) return null;
          return { key: subjectKey, name };
        })
        .filter(Boolean);
    }

    return [];
  };

  const normalizeGrades = (gradeNode) => {
    const raw = gradeNode && typeof gradeNode === "object" ? gradeNode : {};

    const normalizeSections = (sectionsNode) => {
      if (!sectionsNode) return [];

      if (Array.isArray(sectionsNode)) {
        return sectionsNode
          .map((sectionItem) => {
            if (!sectionItem) return null;
            if (typeof sectionItem === "string") {
              const value = sectionItem.trim().toUpperCase();
              return value ? { key: value, name: value } : null;
            }

            const value = String(sectionItem.section || sectionItem.name || sectionItem.code || "")
              .trim()
              .toUpperCase();
            return value ? { key: value, name: value } : null;
          })
          .filter(Boolean);
      }

      if (typeof sectionsNode === "object") {
        return Object.entries(sectionsNode)
          .map(([sectionKey, sectionValue]) => {
            if (typeof sectionValue === "string") {
              const name = sectionValue.trim().toUpperCase();
              return name ? { key: String(sectionKey), name } : null;
            }

            const name = String(
              sectionValue?.section || sectionValue?.name || sectionValue?.code || sectionKey || ""
            )
              .trim()
              .toUpperCase();
            return name ? { key: String(sectionKey), name } : null;
          })
          .filter(Boolean);
      }

      return [];
    };

    const list = Object.entries(raw).map(([gradeKey, gradeValue]) => {
      const gradeObj = gradeValue && typeof gradeValue === "object" ? gradeValue : {};
      const resolvedGrade = String(gradeObj.grade || gradeKey || "").trim();
      const subjects = normalizeSubjects(gradeObj.subjects);
      const sections = normalizeSections(gradeObj.sections);
      const sectionSubjectTeachers =
        gradeObj.sectionSubjectTeachers && typeof gradeObj.sectionSubjectTeachers === "object"
          ? gradeObj.sectionSubjectTeachers
          : {};

      const uniqueSubjects = [];
      const seen = new Set();
      subjects.forEach((item) => {
        const normalized = item.name.toLowerCase().replace(/\s+/g, " ").trim();
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        uniqueSubjects.push(item);
      });

      return {
        gradeKey: String(gradeKey),
        grade: resolvedGrade,
        sections,
        subjects: uniqueSubjects,
        sectionSubjectTeachers,
      };
    });

    return list.sort((first, second) => {
      const firstNum = Number(first.grade);
      const secondNum = Number(second.grade);
      const firstIsNum = Number.isFinite(firstNum);
      const secondIsNum = Number.isFinite(secondNum);

      if (firstIsNum && secondIsNum) return firstNum - secondNum;
      return String(first.grade).localeCompare(String(second.grade));
    });
  };

  const mergeSectionsFromStudents = (prevGrades, studentsRaw) => {
    const studentsNode = studentsRaw && typeof studentsRaw === "object" ? studentsRaw : {};
    if (!Object.keys(studentsNode).length) return prevGrades;

    const byGrade = {};
    Object.values(studentsNode).forEach((studentItem) => {
      const student = studentItem && typeof studentItem === "object" ? studentItem : {};
      const grade = String(student.grade || "").trim();
      const section = String(student.section || "").trim().toUpperCase();
      if (!grade || !section) return;
      if (!byGrade[grade]) byGrade[grade] = new Set();
      byGrade[grade].add(section);
    });

    return prevGrades.map((gradeItem) => {
      const gradeValue = String(gradeItem.grade || "").trim();
      const discovered = Array.from(byGrade[gradeValue] || []);
      if (!discovered.length) return gradeItem;

      const existingNames = new Set((gradeItem.sections || []).map((item) => String(item.name || "")));
      const extra = discovered
        .filter((name) => !existingNames.has(name))
        .map((name) => ({ key: name, name }));

      if (!extra.length) return gradeItem;
      return { ...gradeItem, sections: [...(gradeItem.sections || []), ...extra] };
    });
  };

  const normalizeTeacherList = (teachersNode, usersNode) => {
    const users = usersNode && typeof usersNode === "object" ? usersNode : {};
    const teachersRaw = teachersNode && typeof teachersNode === "object" ? teachersNode : {};

    return Object.entries(teachersRaw)
      .map(([teacherRecordKey, teacherValue]) => {
        const row = teacherValue && typeof teacherValue === "object" ? teacherValue : {};
        const user = users[row.userId] || {};
        const teacherId = String(row.teacherId || teacherRecordKey || "").trim();
        const name = String(user.name || teacherId || "Teacher").trim();

        if (!teacherId) return null;
        return {
          teacherRecordKey: String(teacherRecordKey),
          teacherId,
          teacherName: name,
          userId: String(row.userId || ""),
        };
      })
      .filter(Boolean)
      .sort((first, second) => first.teacherName.localeCompare(second.teacherName));
  };

  const fetchGrades = async () => {
    let usedCache = false;
    const cachedGradeNode = readSessionCache(GRADE_CACHE_KEY, GRADE_CACHE_TTL_MS);

    if (cachedGradeNode) {
      const normalizedCached = normalizeGrades(cachedGradeNode);
      setGrades(normalizedCached);
      setExpandedByGrade((prev) => {
        const next = { ...prev };
        normalizedCached.forEach((item) => {
          const key = String(item.gradeKey || "");
          if (next[key] === undefined) {
            next[key] = false;
          }
        });
        return next;
      });
      setLoading(false);
      usedCache = true;
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const gradeNode = await readSchoolNode("GradeManagement/grades");
      writeSessionCache(GRADE_CACHE_KEY, gradeNode);
      const normalized = normalizeGrades(gradeNode);
      setGrades(normalized);
      setExpandedByGrade((prev) => {
        const next = { ...prev };
        normalized.forEach((item) => {
          const key = String(item.gradeKey || "");
          if (next[key] === undefined) {
            next[key] = false;
          }
        });
        return next;
      });
    } catch (fetchError) {
      setError("Failed to load grades.");
      setGrades([]);
    } finally {
      if (!usedCache) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchGrades();
  }, []);

  useEffect(() => {
    const fetchTeachers = async () => {
      let usedCache = false;
      const cachedTeacherPayload = readSessionCache(TEACHER_CACHE_KEY, TEACHER_CACHE_TTL_MS);

      if (cachedTeacherPayload) {
        const cachedTeacherList = Array.isArray(cachedTeacherPayload.teachers)
          ? cachedTeacherPayload.teachers
          : [];
        const cachedStudentsNode =
          cachedTeacherPayload.students && typeof cachedTeacherPayload.students === "object"
            ? cachedTeacherPayload.students
            : {};

        setTeachers(cachedTeacherList);
        setGrades((prev) => mergeSectionsFromStudents(prev, cachedStudentsNode));
        setTeachersLoading(false);
        usedCache = true;
      } else {
        setTeachersLoading(true);
      }

      try {
        const [teachersNode, usersNode, studentsNode] = await Promise.all([
          readSchoolNode("Teachers"),
          readSchoolNode("Users"),
          readSchoolNode("Students"),
        ]);

        const teacherList = normalizeTeacherList(teachersNode, usersNode);

        setTeachers(teacherList);
        setGrades((prev) => mergeSectionsFromStudents(prev, studentsNode));

        writeSessionCache(TEACHER_CACHE_KEY, {
          teachers: teacherList,
          students: studentsNode && typeof studentsNode === "object" ? studentsNode : {},
        });
      } catch (teacherError) {
        setTeachers([]);
      } finally {
        if (!usedCache) {
          setTeachersLoading(false);
        }
      }
    };

    fetchTeachers();
  }, []);

  const totalSubjects = useMemo(
    () => grades.reduce((sum, gradeItem) => sum + (gradeItem.subjects?.length || 0), 0),
    [grades]
  );

  const buildSubjectKey = (subjectName) => {
    const normalized = String(subjectName || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-_]/g, "")
      .replace(/\s+/g, "_");

    if (normalized) return normalized;
    return `subject_${Date.now()}`;
  };

  const handleAddSubject = async (gradeItem) => {
    const gradeKey = String(gradeItem.gradeKey || "");
    const draftValue = String(subjectInputs[gradeKey] || "").trim();

    if (!draftValue) {
      setMessageByGrade((prev) => ({
        ...prev,
        [gradeKey]: { type: "error", text: "Enter subject name first." },
      }));
      return;
    }

    const normalizedDraft = draftValue.toLowerCase().replace(/\s+/g, " ").trim();
    const alreadyExists = (gradeItem.subjects || []).some(
      (item) => item.name.toLowerCase().replace(/\s+/g, " ").trim() === normalizedDraft
    );

    if (alreadyExists) {
      setMessageByGrade((prev) => ({
        ...prev,
        [gradeKey]: { type: "error", text: "Subject already exists in this grade." },
      }));
      return;
    }

    setSavingByGrade((prev) => ({ ...prev, [gradeKey]: true }));
    setMessageByGrade((prev) => ({ ...prev, [gradeKey]: null }));

    try {
      const subjectKey = buildSubjectKey(draftValue);
      const payload = {
        name: draftValue,
        createdAt: new Date().toISOString(),
        createdBy: admin.adminId || admin.userId || "admin",
      };

      const writeRequests = [
        putNodeWithFallback(
          `GradeManagement/grades/${encodeURIComponent(gradeKey)}/subjects/${encodeURIComponent(subjectKey)}`,
          payload
        ),
      ];

      const gradeValue = String(gradeItem.grade || gradeKey || "").trim();
      const sections = Array.isArray(gradeItem.sections) ? gradeItem.sections : [];

      sections.forEach((sectionItem) => {
        const sectionKey = String(sectionItem.key || sectionItem.name || "").trim();
        const sectionName = String(sectionItem.name || sectionKey || "").trim().toUpperCase();
        if (!sectionKey || !sectionName || !gradeValue) return;

        const courseId = `course_${subjectKey}_${gradeValue}${sectionName}`;
        writeRequests.push(
          putNodeWithFallback(
            `GradeManagement/grades/${encodeURIComponent(gradeKey)}/sections/${encodeURIComponent(sectionKey)}/courses/${encodeURIComponent(courseId)}`,
            true
          )
        );

        writeRequests.push(
          putNodeWithFallback(
            `Courses/${encodeURIComponent(courseId)}`,
            {
              courseId,
              grade: gradeValue,
              section: sectionName,
              subject: draftValue,
              name: draftValue,
              createdAt: new Date().toISOString(),
              createdBy: admin.adminId || admin.userId || "admin",
            }
          )
        );
      });

      await Promise.all(writeRequests);

      const newSubject = { key: subjectKey, name: draftValue };
      setGrades((prev) =>
        prev.map((item) =>
          String(item.gradeKey) === gradeKey
            ? { ...item, subjects: [...(item.subjects || []), newSubject] }
            : item
        )
      );
      setSubjectInputs((prev) => ({ ...prev, [gradeKey]: "" }));
      setMessageByGrade((prev) => ({
        ...prev,
        [gradeKey]: {
          type: "success",
          text: sections.length
            ? `Subject added and linked to ${sections.length} section course slot(s).`
            : "Subject added.",
        },
      }));
    } catch (writeError) {
      setMessageByGrade((prev) => ({
        ...prev,
        [gradeKey]: { type: "error", text: "Failed to add subject." },
      }));
    } finally {
      setSavingByGrade((prev) => ({ ...prev, [gradeKey]: false }));
    }
  };

  const getAssignedTeacherRecordKey = (gradeItem, sectionKey, subjectKey) => {
    const sectionAssignments =
      gradeItem?.sectionSubjectTeachers?.[sectionKey] &&
      typeof gradeItem.sectionSubjectTeachers[sectionKey] === "object"
        ? gradeItem.sectionSubjectTeachers[sectionKey]
        : {};

    const subjectAssignment =
      sectionAssignments?.[subjectKey] && typeof sectionAssignments[subjectKey] === "object"
        ? sectionAssignments[subjectKey]
        : null;

    return String(subjectAssignment?.teacherRecordKey || "");
  };

  const getAssignedTeacherName = (gradeItem, sectionKey, subjectKey) => {
    const sectionAssignments =
      gradeItem?.sectionSubjectTeachers?.[sectionKey] &&
      typeof gradeItem.sectionSubjectTeachers[sectionKey] === "object"
        ? gradeItem.sectionSubjectTeachers[sectionKey]
        : {};

    const subjectAssignment =
      sectionAssignments?.[subjectKey] && typeof sectionAssignments[subjectKey] === "object"
        ? sectionAssignments[subjectKey]
        : null;

    return String(subjectAssignment?.teacherName || "");
  };

  const handleAssignTeacher = async (gradeItem, sectionKey, subject) => {
    const gradeKey = String(gradeItem.gradeKey || "");
    const normalizedSectionKey = String(sectionKey || "");
    const subjectKey = String(subject.key || "");
    const targetKey = `${gradeKey}|${normalizedSectionKey}|${subjectKey}`;

    const selectedTeacherRecordKey = String(selectedTeacherByTarget[targetKey] || "").trim();
    if (!selectedTeacherRecordKey) {
      setAssignMessageByTarget((prev) => ({
        ...prev,
        [targetKey]: { type: "error", text: "Select teacher first." },
      }));
      return;
    }

    const teacher = teachers.find((item) => String(item.teacherRecordKey) === selectedTeacherRecordKey);
    if (!teacher) {
      setAssignMessageByTarget((prev) => ({
        ...prev,
        [targetKey]: { type: "error", text: "Teacher not found." },
      }));
      return;
    }

    setAssignSavingByTarget((prev) => ({ ...prev, [targetKey]: true }));
    setAssignMessageByTarget((prev) => ({ ...prev, [targetKey]: null }));

    const assignmentPayload = {
      teacherRecordKey: teacher.teacherRecordKey,
      teacherId: teacher.teacherId,
      teacherName: teacher.teacherName,
      teacherUserId: teacher.userId,
      subject: subject.name,
      section: normalizedSectionKey,
      assignedAt: new Date().toISOString(),
      assignedBy: admin.adminId || admin.userId || "admin",
    };

    try {
      await putNodeWithFallback(
        `GradeManagement/grades/${encodeURIComponent(gradeKey)}/sectionSubjectTeachers/${encodeURIComponent(
          normalizedSectionKey
        )}/${encodeURIComponent(subjectKey)}`,
        assignmentPayload
      );

      setGrades((prev) =>
        prev.map((item) => {
          if (String(item.gradeKey) !== gradeKey) return item;

          const current =
            item.sectionSubjectTeachers && typeof item.sectionSubjectTeachers === "object"
              ? item.sectionSubjectTeachers
              : {};
          const sectionAssignments =
            current[normalizedSectionKey] && typeof current[normalizedSectionKey] === "object"
              ? current[normalizedSectionKey]
              : {};

          return {
            ...item,
            sectionSubjectTeachers: {
              ...current,
              [normalizedSectionKey]: {
                ...sectionAssignments,
                [subjectKey]: assignmentPayload,
              },
            },
          };
        })
      );

      setAssignMessageByTarget((prev) => ({
        ...prev,
        [targetKey]: { type: "success", text: "Teacher assigned." },
      }));
    } catch (assignError) {
      setAssignMessageByTarget((prev) => ({
        ...prev,
        [targetKey]: { type: "error", text: "Failed to assign teacher." },
      }));
    } finally {
      setAssignSavingByTarget((prev) => ({ ...prev, [targetKey]: false }));
    }
  };

  const shellCardStyle = {
    borderRadius: 16,
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
  };

  const contentCardStyle = {
    ...shellCardStyle,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-panel) 86%, var(--surface-accent)) 0%, var(--surface-panel) 100%)",
  };

  const statCardStyle = {
    ...shellCardStyle,
    padding: 16,
    display: "grid",
    gap: 4,
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-panel) 92%, var(--surface-accent)) 0%, var(--surface-panel) 100%)",
  };

  const controlFieldStyle = {
    width: "100%",
    border: "1px solid var(--border-soft)",
    background: "var(--surface-panel)",
    color: "var(--text-primary)",
    borderRadius: 10,
    padding: "10px 12px",
    outline: "none",
    fontSize: 13,
    boxSizing: "border-box",
  };

  const actionButtonStyle = {
    border: "1px solid var(--border-soft)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-accent) 80%, var(--surface-panel)) 0%, var(--surface-accent) 100%)",
    color: "var(--text-primary)",
    borderRadius: 10,
    padding: "10px 12px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "var(--shadow-soft)",
  };

  const subjectBlockStyle = {
    borderRadius: 12,
    border: "1px solid var(--border-soft)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-muted) 88%, var(--surface-panel)) 0%, var(--surface-muted) 100%)",
    padding: "12px 12px",
    color: "var(--text-secondary)",
    fontSize: 13,
    display: "grid",
    gap: 10,
  };

  const sectionAssignmentCardStyle = {
    border: "1px solid var(--border-soft)",
    borderRadius: 10,
    padding: 9,
    display: "grid",
    gap: 7,
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-panel) 94%, var(--surface-accent)) 0%, var(--surface-panel) 100%)",
  };

  const badgeStyle = {
    fontSize: 12,
    color: "var(--text-muted)",
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--border-soft)",
    background: "var(--surface-accent)",
    letterSpacing: 0.2,
  };

  const FEED_MAX_WIDTH = "min(1320px, 100%)";

  return (
    <div
      className="dashboard-page"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--page-bg) 96%, var(--surface-accent)) 0%, var(--page-bg) 100%)",
        minHeight: "100vh",
        height: "100vh",
        overflow: "hidden",
        color: "var(--text-primary)",
      }}
    >
      <div
        className="google-dashboard"
        style={{
          display: "flex",
          gap: 14,
          padding: "4px 14px",
          height: "calc(100vh - 73px)",
          overflow: "hidden",
          background: "transparent",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <Sidebar admin={admin} />
        <div
          className="main-content google-main"
          style={{
            padding: "0 2px",
            flex: "1.08 1 0",
            minWidth: 0,
            maxWidth: "none",
            boxSizing: "border-box",
            alignSelf: "stretch",
            margin: "0",
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarWidth: "thin",
            scrollbarColor: "transparent transparent",
          }}
        >
          <div style={{ width: "100%", maxWidth: FEED_MAX_WIDTH, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 56 }}>
            <div
              className="section-header-card"
              style={{
                marginBottom: 14,
                padding: 20,
              }}
            >
              <div
                className="section-header-card__row"
                style={{
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  gap: 10,
                  flexDirection: "column",
                }}
              >
                <div>
                  <h1 className="section-header-card__title" style={{ fontSize: 26, fontWeight: 900, letterSpacing: 0.2 }}>
                    Subject Management
                  </h1>
                  <p className="section-header-card__subtitle" style={{ fontSize: 13, lineHeight: 1.55, maxWidth: 760 }}>
                    Manage subjects by grade and section from one workspace.
                  </p>
                </div>

                <div className="section-header-card__actions">
                  <div style={badgeStyle}>
                    Subject Management Workspace
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <div style={statCardStyle}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800, letterSpacing: 0.3 }}>
                  TOTAL GRADES
                </div>
                <div style={{ fontSize: 24, color: "var(--text-primary)", fontWeight: 900 }}>{grades.length}</div>
              </div>

              <div style={statCardStyle}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800, letterSpacing: 0.3 }}>
                  TOTAL SUBJECTS
                </div>
                <div style={{ fontSize: 24, color: "var(--text-primary)", fontWeight: 900 }}>{totalSubjects}</div>
              </div>

              <div style={statCardStyle}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800, letterSpacing: 0.3 }}>
                  AVAILABLE TEACHERS
                </div>
                <div style={{ fontSize: 24, color: "var(--text-primary)", fontWeight: 900 }}>
                  {teachersLoading ? "…" : teachers.length}
                </div>
              </div>
            </div>

            {error ? (
              <div style={{ ...shellCardStyle, padding: 14, color: "var(--danger, #b42318)", fontWeight: 700 }}>
                {error}
              </div>
            ) : null}

            {loading ? (
              <div style={{ ...shellCardStyle, padding: 14, color: "var(--text-secondary)" }}>Loading grades...</div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: 14,
                  alignItems: "start",
                }}
              >
                {grades.map((gradeItem) => {
                  const gradeKey = String(gradeItem.gradeKey || "");
                  const feedback = messageByGrade[gradeKey];
                  const isSaving = !!savingByGrade[gradeKey];
                  const inputValue = subjectInputs[gradeKey] || "";
                  const isExpanded = expandedByGrade[gradeKey] !== false;
                  const sectionsCount = gradeItem.sections?.length || 0;
                  const subjectsCount = gradeItem.subjects?.length || 0;
                  const totalAssignmentSlots = sectionsCount * subjectsCount;
                  const assignedSlots = (gradeItem.subjects || []).reduce((sum, subject) => {
                    const perSubjectAssigned = (gradeItem.sections || []).filter((sectionItem) => {
                      const sectionKey = String(sectionItem.key || sectionItem.name || "");
                      return Boolean(
                        getAssignedTeacherRecordKey(gradeItem, sectionKey, String(subject.key || ""))
                      );
                    }).length;
                    return sum + perSubjectAssigned;
                  }, 0);

                  return (
                    <div key={gradeKey} style={contentCardStyle}>
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 4,
                          background: "linear-gradient(90deg, var(--accent-strong), var(--accent))",
                        }}
                      />

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>Grade {gradeItem.grade}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedByGrade((prev) => ({
                                ...prev,
                                [gradeKey]: !(prev[gradeKey] !== false),
                              }))
                            }
                            style={{
                              ...actionButtonStyle,
                              padding: "6px 12px",
                              fontSize: 12,
                              boxShadow: "none",
                              fontWeight: 800,
                              borderRadius: 999,
                              background:
                                "linear-gradient(180deg, color-mix(in srgb, var(--surface-accent) 88%, var(--surface-panel)) 0%, color-mix(in srgb, var(--surface-accent) 76%, var(--surface-panel)) 100%)",
                            }}
                          >
                            {isExpanded ? "Collapse ▲" : "Expand ▼"}
                          </button>
                          <div style={badgeStyle}>
                            {gradeItem.subjects.length} subject{gradeItem.subjects.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                        <input
                          value={inputValue}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSubjectInputs((prev) => ({ ...prev, [gradeKey]: value }));
                            setMessageByGrade((prev) => ({ ...prev, [gradeKey]: null }));
                          }}
                          placeholder="Add subject (e.g. Mathematics)"
                          style={controlFieldStyle}
                        />
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleAddSubject(gradeItem)}
                          style={{
                            ...actionButtonStyle,
                            cursor: isSaving ? "not-allowed" : "pointer",
                            opacity: isSaving ? 0.7 : 1,
                          }}
                        >
                          {isSaving ? "Saving..." : "Add"}
                        </button>
                      </div>

                      {isExpanded ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {gradeItem.subjects.length === 0 ? (
                            <div
                              style={{
                                borderRadius: 12,
                                border: "1px dashed var(--border-soft)",
                                background: "var(--surface-muted)",
                                padding: "10px 12px",
                                color: "var(--text-secondary)",
                                fontSize: 13,
                              }}
                            >
                              No subjects yet.
                            </div>
                          ) : (
                            gradeItem.subjects.map((subject) => (
                              <div
                                key={`${gradeKey}-${subject.key}`}
                                style={subjectBlockStyle}
                              >
                                <div style={{ color: "var(--text-primary)", fontWeight: 800, fontSize: 14 }}>{subject.name}</div>

                                {gradeItem.sections?.length ? (
                                  <div style={{ display: "grid", gap: 8 }}>
                                    {gradeItem.sections.map((sectionItem) => {
                                      const sectionKey = String(sectionItem.key || sectionItem.name || "");
                                      const subjectKey = String(subject.key || "");
                                      const targetKey = `${gradeKey}|${sectionKey}|${subjectKey}`;
                                      const assignedTeacherName = getAssignedTeacherName(
                                        gradeItem,
                                        sectionKey,
                                        subjectKey
                                      );
                                      const hasAssignment = Boolean(
                                        getAssignedTeacherRecordKey(gradeItem, sectionKey, subjectKey)
                                      );

                                      return (
                                        <div
                                          key={`${targetKey}-row`}
                                          style={sectionAssignmentCardStyle}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "space-between",
                                              gap: 8,
                                            }}
                                          >
                                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                                              Section {sectionItem.name}
                                            </div>
                                            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>
                                              {assignedTeacherName ? `Assigned: ${assignedTeacherName}` : "Not assigned"}
                                            </div>
                                          </div>

                                          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                                            <select
                                              value={
                                                selectedTeacherByTarget[targetKey] ||
                                                getAssignedTeacherRecordKey(gradeItem, sectionKey, subjectKey) ||
                                                ""
                                              }
                                              onChange={(event) => {
                                                const value = event.target.value;
                                                setSelectedTeacherByTarget((prev) => ({ ...prev, [targetKey]: value }));
                                                setAssignMessageByTarget((prev) => ({ ...prev, [targetKey]: null }));
                                              }}
                                              disabled={teachersLoading || teachers.length === 0}
                                              style={{ ...controlFieldStyle, fontSize: 12, padding: "9px 10px" }}
                                            >
                                              <option value="">Select teacher</option>
                                              {teachers.map((teacher) => (
                                                <option key={teacher.teacherRecordKey} value={teacher.teacherRecordKey}>
                                                  {teacher.teacherName} ({teacher.teacherId})
                                                </option>
                                              ))}
                                            </select>

                                            <button
                                              type="button"
                                              disabled={
                                                teachersLoading ||
                                                teachers.length === 0 ||
                                                !!assignSavingByTarget[targetKey]
                                              }
                                              onClick={() => handleAssignTeacher(gradeItem, sectionKey, subject)}
                                              style={{
                                                ...actionButtonStyle,
                                                padding: "9px 10px",
                                                fontSize: 12,
                                                opacity: teachersLoading || teachers.length === 0 ? 0.6 : 1,
                                              }}
                                            >
                                              {assignSavingByTarget[targetKey]
                                                ? "Saving..."
                                                : hasAssignment
                                                  ? "Edit"
                                                  : "Assign"}
                                            </button>
                                          </div>

                                          {assignMessageByTarget[targetKey]?.text ? (
                                            <div
                                              style={{
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color:
                                                  assignMessageByTarget[targetKey]?.type === "success"
                                                    ? "var(--success, #027a48)"
                                                    : "var(--danger, #b42318)",
                                              }}
                                            >
                                              {assignMessageByTarget[targetKey]?.text}
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      borderRadius: 10,
                                      border: "1px dashed var(--border-soft)",
                                      background: "var(--surface-panel)",
                                      padding: "8px 10px",
                                      color: "var(--text-secondary)",
                                      fontSize: 12,
                                    }}
                                  >
                                    Add sections to this grade first to assign teachers.
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      ) : (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setExpandedByGrade((prev) => ({
                              ...prev,
                              [gradeKey]: true,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setExpandedByGrade((prev) => ({
                                ...prev,
                                [gradeKey]: true,
                              }));
                            }
                          }}
                          style={{
                            borderRadius: 12,
                            border: "1px solid var(--border-soft)",
                            background:
                              "linear-gradient(180deg, color-mix(in srgb, var(--surface-panel) 94%, var(--surface-accent)) 0%, var(--surface-panel) 100%)",
                            padding: "12px 14px",
                            color: "var(--text-secondary)",
                            fontSize: 12,
                            fontWeight: 600,
                            display: "grid",
                            gap: 8,
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ color: "var(--text-primary)", fontWeight: 800 }}>Subjects list collapsed</span>
                            <span>{subjectsCount} subjects · {sectionsCount} sections</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>
                            Assigned {assignedSlots}/{totalAssignmentSlots} teacher slots
                          </div>
                        </div>
                      )}

                      {feedback?.text ? (
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color:
                              feedback.type === "success"
                                ? "var(--success, #027a48)"
                                : "var(--danger, #b42318)",
                          }}
                        >
                          {feedback.text}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}