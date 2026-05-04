import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { get, ref, set, update } from "firebase/database";
import { FaBookOpen, FaPlus, FaSave } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../styles/global.css";
import { db, schoolPath } from "../firebase";
import { getRtdbRoot, RTDB_BASE_RAW } from "../api/rtdbScope";
import { getTeacherCourseContext } from "../api/teacherApi";

const RTDB_BASE = getRtdbRoot();
const getViewportWidth = () => (typeof window !== "undefined" ? window.innerWidth : 1024);

const initialChapter = { id: "", title: "", contentUrl: "", hasExam: false, order: 1 };
const initialQuestion = {
  question: "",
  options: { A: "", B: "", C: "", D: "" },
  correct: "A",
  points: 1,
  explanation: "",
};

const normalizeCourseSubject = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toTitleCase = (value) =>
  String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const parseVirtualCourseFromId = (courseId) => {
  const normalized = String(courseId || "").trim();
  if (!normalized.startsWith("course_")) {
    return {
      id: normalized,
      subject: normalized,
      name: normalized,
      grade: "",
      section: "",
      virtual: true,
    };
  }

  const body = normalized.slice("course_".length);
  const parts = body.split("_").filter(Boolean);
  const gradeSection = parts.at(-1) || "";
  const match = gradeSection.match(/^(\d+)([A-Za-z].*)$/);
  const subjectRaw = normalizeCourseSubject(parts.slice(0, -1).join(" "));

  return {
    id: normalized,
    subject: toTitleCase(subjectRaw),
    name: toTitleCase(subjectRaw),
    grade: match?.[1] || "",
    section: String(match?.[2] || "").toUpperCase(),
    virtual: true,
  };
};

const getStoredTeacher = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("teacher");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    localStorage.removeItem("teacher");
    return null;
  }
};

function Exam() {
  const [sidebarOpen, setSidebarOpen] = useState(() => getViewportWidth() > 600);
  const [isMobile, setIsMobile] = useState(() => getViewportWidth() <= 600);
  const [teacher, setTeacher] = useState(null);
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [courseError, setCourseError] = useState("");
  const [rtdbBase, setRtdbBase] = useState("");
  const [schoolBaseResolved, setSchoolBaseResolved] = useState(false);

  const [showCurriculumForm, setShowCurriculumForm] = useState(false);
  const [newGrade, setNewGrade] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newChapters, setNewChapters] = useState([{ ...initialChapter }]);
  const [curriculumSaving, setCurriculumSaving] = useState(false);
  const [curriculumSuccess, setCurriculumSuccess] = useState("");
  const [curriculumError, setCurriculumError] = useState("");

  const [chapterId, setChapterId] = useState("");
  const [assessmentType, setAssessmentType] = useState("Exam");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [totalQuestions, setTotalQuestions] = useState(1);
  const [passScore, setPassScore] = useState(1);
  const [published, setPublished] = useState(false);
  const [questions, setQuestions] = useState([{ ...initialQuestion }]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [chapterOptions, setChapterOptions] = useState([]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  const selectedGradeKey = useMemo(() => {
    const gradeValue = String(selectedCourse?.grade || "").trim();
    return gradeValue ? `grade_${gradeValue}` : "";
  }, [selectedCourse]);

  const selectedSubjectKey = useMemo(
    () => String(selectedCourse?.subject || selectedCourse?.name || "").trim().toLowerCase(),
    [selectedCourse]
  );

  useEffect(() => {
    const handleResize = () => {
      const width = getViewportWidth();
      setSidebarOpen(width > 600);
      setIsMobile(width <= 600);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
      handleResize();
      return () => window.removeEventListener("resize", handleResize);
    }

    return undefined;
  }, []);

  useEffect(() => {
    const storedTeacher = getStoredTeacher();
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
        setRtdbBase(RTDB_BASE);
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
      } catch (err) {
        console.error("School code mapping lookup failed:", err);
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
      } catch (err) {
        console.error("School fallback scan failed:", err);
      }

      setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${rawSchoolCode}`);
      setSchoolBaseResolved(true);
    };

    resolveSchoolBase();
  }, [teacher]);

  useEffect(() => {
    if (!teacher || !schoolBaseResolved || !rtdbBase) return;

    const fetchCourses = async () => {
      setCoursesLoading(true);
      setCourseError("");
      try {
        const context = await getTeacherCourseContext({ teacher, rtdbBase });
        let teacherCourses = (context.courses || []).map((course) => {
          const defaults = parseVirtualCourseFromId(course?.id);
          return {
            ...course,
            id: course?.id || defaults.id,
            subject: course?.subject || course?.name || defaults.subject,
            name: course?.name || course?.subject || defaults.name,
            grade: String(course?.grade || defaults.grade || "").trim(),
            section: String(course?.section || course?.secation || defaults.section || "")
              .trim()
              .toUpperCase(),
          };
        });

        if (!teacherCourses.length) {
          const [coursesRes, classMarksRes, courseStatsRes] = await Promise.all([
            axios.get(`${rtdbBase}/Courses.json`).catch(() => ({ data: {} })),
            axios.get(`${rtdbBase}/ClassMarks.json`).catch(() => ({ data: {} })),
            axios.get(`${rtdbBase}/SchoolExams/CourseStats.json`).catch(() => ({ data: {} })),
          ]);

          const coursesMap = coursesRes.data || {};
          const classMarks = classMarksRes.data || {};
          const courseStats = courseStatsRes.data || {};
          const fallbackIds = new Set([
            ...Object.keys(coursesMap),
            ...Object.keys(classMarks),
            ...Object.keys(courseStats),
          ]);

          teacherCourses = Array.from(fallbackIds)
            .filter(Boolean)
            .map((courseId) => {
              const stored = coursesMap?.[courseId] || {};
              const virtual = parseVirtualCourseFromId(courseId);
              const marksCount = Object.keys(classMarks?.[courseId] || {}).length;
              return {
                ...virtual,
                id: courseId,
                subject: stored.subject || stored.name || virtual.subject,
                name: stored.name || stored.subject || virtual.name,
                grade: String(stored.grade || virtual.grade || "").trim(),
                section: String(stored.section || stored.secation || virtual.section || "").trim().toUpperCase(),
                _marksCount: marksCount,
              };
            })
            .sort((a, b) => (b._marksCount || 0) - (a._marksCount || 0))
            .map(({ _marksCount, ...rest }) => rest);
        }

        setCourses((prev) => (teacherCourses.length ? teacherCourses : prev));
        if (teacherCourses.length > 0) {
          setSelectedCourseId((prev) => {
            if (prev && teacherCourses.some((c) => c.id === prev)) return prev;
            return teacherCourses[0].id;
          });
          setCourseError("");
        } else {
          setCourseError("No assigned courses found for this teacher.");
        }
      } catch (err) {
        console.error("Error fetching teacher courses:", err);
        setCourseError("Failed to load courses. Please try again.");
      } finally {
        setCoursesLoading(false);
      }
    };

    fetchCourses();
  }, [teacher, schoolBaseResolved, rtdbBase]);

  useEffect(() => {
    if (!selectedGradeKey || !selectedSubjectKey) {
      setChapterOptions([]);
      setChapterId("");
      return;
    }

    const fetchChapters = async () => {
      try {
        const snapshot = await get(ref(db, schoolPath(`Curriculum/${selectedGradeKey}/${selectedSubjectKey}/chapters`)));
        const data = snapshot.val() || {};
        const chapters = Object.entries(data).map(([id, val]) => ({ id, title: val?.title || id }));
        setChapterOptions(chapters);

        setChapterId((prev) => {
          if (prev && chapters.some((c) => c.id === prev)) return prev;
          return chapters[0]?.id || "";
        });
      } catch {
        setChapterOptions([]);
        setChapterId("");
      }
    };

    fetchChapters();
  }, [selectedGradeKey, selectedSubjectKey]);

  useEffect(() => {
    if (!selectedCourse) {
      setNewGrade("");
      setNewSubject("");
      return;
    }

    setNewGrade(String(selectedCourse.grade || ""));
    setNewSubject(String(selectedCourse.subject || selectedCourse.name || "").trim().toLowerCase());
  }, [selectedCourse]);

  const handleChapterChange = (idx, field, value) => {
    setNewChapters((prev) => {
      const updated = [...prev];
      updated[idx][field] = value;
      return updated;
    });
  };

  const addChapter = () =>
    setNewChapters((prev) => [...prev, { ...initialChapter, order: prev.length + 1 }]);

  const removeChapter = (idx) => {
    if (newChapters.length === 1) return;
    setNewChapters((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleQuestionChange = (idx, field, value) => {
    setQuestions((prev) => {
      const updated = [...prev];
      if (field === "options") {
        updated[idx].options = { ...updated[idx].options, ...value };
      } else {
        updated[idx][field] = value;
      }
      return updated;
    });
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, { ...initialQuestion }]);
    setTotalQuestions((n) => n + 1);
  };

  const removeQuestion = (idx) => {
    if (questions.length === 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    setTotalQuestions((n) => Math.max(1, n - 1));
  };

  const handleCreateCurriculum = async (event) => {
    event.preventDefault();
    setCurriculumSaving(true);
    setCurriculumSuccess("");
    setCurriculumError("");

    try {
      if (!newGrade || !newSubject) throw new Error("Course grade and subject are required");

      const gradeKey = newGrade.startsWith("grade_") ? newGrade : `grade_${newGrade}`;
      const subjectKey = String(newSubject).trim().toLowerCase();
      const chaptersObj = {};

      newChapters.forEach((chapter, index) => {
        if (!chapter.id) throw new Error("Each chapter must include an ID");
        chaptersObj[chapter.id] = {
          ...chapter,
          order: index + 1,
        };
      });

      await update(ref(db, schoolPath(`Curriculum/${gradeKey}/${subjectKey}`)), {
        subjectName: subjectKey,
        totalChapters: newChapters.length,
        chapters: chaptersObj,
      });

      setCurriculumSuccess("Curriculum saved successfully.");
      setNewChapters([{ ...initialChapter }]);
    } catch (err) {
      setCurriculumError(err?.message || "Failed to save curriculum");
    } finally {
      setCurriculumSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSuccess("");
    setError("");

    try {
      if (!selectedGradeKey || !selectedSubjectKey || !chapterId) {
        throw new Error("Course and chapter are required before saving an assessment");
      }

      const examKey = `${selectedSubjectKey}_${selectedGradeKey}`;
      const questionsObj = {};
      questions.forEach((q, index) => {
        questionsObj[`q_${String(index + 1).padStart(3, "0")}`] = q;
      });

      await set(ref(db, schoolPath(`Exams/${examKey}/${chapterId}`)), {
        durationMinutes: Number(durationMinutes),
        totalQuestions: Number(totalQuestions),
        passScore: Number(passScore),
        published,
        assessmentType,
        questions: questionsObj,
        examId: `${examKey}_${chapterId}`,
      });

      setSuccess(`${assessmentType} saved successfully.`);
    } catch (err) {
      setError(err?.message || "Failed to save assessment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="dashboard-page"
      style={{
        background: "#ffffff",
        minHeight: "100vh",
        height: "100vh",
        overflow: "hidden",
        color: "#0f172a",
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
      }}
    >
      <div className="google-dashboard" style={{ display: "flex", gap: 0, padding: 0, height: "calc(100vh - 73px)", overflow: "hidden", background: "#ffffff" }}>
        <Sidebar
          active="exam"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          teacher={teacher}
          handleLogout={() => {
            localStorage.removeItem("teacher");
            navigate("/login");
          }}
        />

        <div
          className="teacher-sidebar-spacer"
          style={{
            width: "var(--sidebar-width)",
            minWidth: "var(--sidebar-width)",
            flex: "0 0 var(--sidebar-width)",
            pointerEvents: "none",
          }}
        />

        <div
          className="google-main"
          style={{
            flex: 1,
            width: "100%",
            minWidth: 0,
            height: "100%",
            marginLeft: 0,
            padding: isMobile ? "0 10px" : "0 18px",
            overflowY: "auto",
            overflowX: "hidden",
            textAlign: "left",
            background: "#ffffff",
          }}
        >
          <div className="main-inner" style={{ padding: isMobile ? "12px 0 26px" : "20px 0 28px", width: "100%", maxWidth: 1180, margin: "0 auto" }}>
            <div
              style={{
                marginBottom: 16,
                background: "linear-gradient(140deg, #ffffff 0%, #f8fbff 100%)",
                border: "1px solid #dbeafe",
                borderRadius: 16,
                boxShadow: "0 14px 30px rgba(15, 23, 42, 0.09)",
                padding: isMobile ? "14px" : "18px 20px",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0f172a", letterSpacing: "0.01em" }}>Assessment Builder</h2>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 999, padding: "6px 10px", fontWeight: 700, fontSize: 12, color: "#1d4ed8" }}>
                  {selectedCourse
                    ? `${selectedCourse.subject || selectedCourse.name} • Grade ${selectedCourse.grade} Section ${selectedCourse.section}`
                    : "No course selected"}
                </span>
                <span style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 999, padding: "6px 10px", fontWeight: 700, fontSize: 12, color: "#334155" }}>
                  Teacher View
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 14, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 10px 20px rgba(15, 23, 42, 0.06)", padding: isMobile ? "12px" : "14px 16px" }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 700, color: "#334155", fontSize: 13 }}>Assigned Course</label>
              <select
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  fontWeight: 600,
                  fontSize: 14,
                  padding: "10px 12px",
                }}
              >
                <option value="">-- Select Course --</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {(course.subject || course.name || "Course")} - Grade {course.grade} Section {course.section}
                  </option>
                ))}
              </select>
              {coursesLoading ? (
                <div style={{ marginTop: 8, color: "#64748b", fontSize: 12, fontWeight: 600 }}>Loading teacher courses...</div>
              ) : null}
              {!coursesLoading && courseError ? (
                <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 12, fontWeight: 700 }}>{courseError}</div>
              ) : null}
            </div>

            <div style={{ marginBottom: 14, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 10px 20px rgba(15, 23, 42, 0.06)", padding: isMobile ? "12px" : "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: showCurriculumForm ? 12 : 0, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                  <FaBookOpen style={{ color: "#2563eb" }} />
                  Curriculum Chapters
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCurriculumForm((value) => !value)}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: showCurriculumForm ? "#eff6ff" : "#ffffff",
                    color: "#1d4ed8",
                    borderRadius: 999,
                    fontWeight: 700,
                    padding: "8px 12px",
                    cursor: "pointer",
                  }}
                >
                  {showCurriculumForm ? "Hide Curriculum Editor" : "Open Curriculum Editor"}
                </button>
              </div>

              {showCurriculumForm && (
                <form onSubmit={handleCreateCurriculum}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13, color: "#334155" }}>Grade</label>
                      <input
                        value={newGrade}
                        onChange={(event) => setNewGrade(event.target.value)}
                        placeholder="e.g. 7"
                        required
                        style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc", padding: "9px 11px", fontSize: 14 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13, color: "#334155" }}>Subject</label>
                      <input
                        value={newSubject}
                        onChange={(event) => setNewSubject(event.target.value)}
                        placeholder="e.g. english"
                        required
                        style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc", padding: "9px 11px", fontSize: 14 }}
                      />
                    </div>
                  </div>

                  {newChapters.map((chapter, idx) => (
                    <div key={`${chapter.id || "chapter"}-${idx}`} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, marginBottom: 10, background: "#f8fafc" }}>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.1fr 2fr", gap: 10, marginBottom: 10 }}>
                        <input
                          value={chapter.id}
                          onChange={(event) => handleChapterChange(idx, "id", event.target.value)}
                          placeholder="Chapter ID (chapter_01)"
                          required
                          style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", padding: "9px 10px", fontSize: 13 }}
                        />
                        <input
                          value={chapter.title}
                          onChange={(event) => handleChapterChange(idx, "title", event.target.value)}
                          placeholder="Chapter title"
                          required
                          style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", padding: "9px 10px", fontSize: 13 }}
                        />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr auto auto", gap: 10, alignItems: "center" }}>
                        <input
                          value={chapter.contentUrl}
                          onChange={(event) => handleChapterChange(idx, "contentUrl", event.target.value)}
                          placeholder="Content URL (optional)"
                          style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", padding: "9px 10px", fontSize: 13 }}
                        />
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#334155" }}>
                          <input
                            type="checkbox"
                            checked={Boolean(chapter.hasExam)}
                            onChange={(event) => handleChapterChange(idx, "hasExam", event.target.checked)}
                          />
                          Has Exam
                        </label>
                        <button
                          type="button"
                          onClick={() => removeChapter(idx)}
                          disabled={newChapters.length === 1}
                          style={{
                            border: "1px solid #fecaca",
                            background: "#fef2f2",
                            color: "#b91c1c",
                            borderRadius: 999,
                            padding: "7px 10px",
                            cursor: newChapters.length === 1 ? "not-allowed" : "pointer",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" onClick={addChapter} style={{ border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "8px 12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <FaPlus /> Add Chapter
                    </button>
                    <button type="submit" disabled={curriculumSaving} style={{ border: "none", background: "#2563eb", color: "#ffffff", borderRadius: 999, padding: "10px 14px", fontWeight: 800, cursor: curriculumSaving ? "not-allowed" : "pointer", boxShadow: "0 10px 18px rgba(37, 99, 235, 0.24)" }}>
                      {curriculumSaving ? "Saving..." : "Save Curriculum"}
                    </button>
                  </div>

                  {curriculumSuccess && <div style={{ marginTop: 10, color: "#15803d", fontWeight: 700 }}>{curriculumSuccess}</div>}
                  {curriculumError && <div style={{ marginTop: 10, color: "#b91c1c", fontWeight: 700 }}>{curriculumError}</div>}
                </form>
              )}
            </div>

            <form onSubmit={handleSubmit} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 10px 20px rgba(15, 23, 42, 0.06)", padding: isMobile ? "12px" : "14px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13, color: "#334155" }}>Grade</label>
                  <input value={selectedCourse?.grade || ""} readOnly style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc", padding: "9px 11px", fontSize: 14, color: "#0f172a" }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13, color: "#334155" }}>Subject</label>
                  <input value={selectedCourse?.subject || selectedCourse?.name || ""} readOnly style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc", padding: "9px 11px", fontSize: 14, color: "#0f172a" }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13, color: "#334155" }}>Chapter</label>
                  <select
                    value={chapterId}
                    onChange={(event) => setChapterId(event.target.value)}
                    required
                    style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc", padding: "9px 11px", fontSize: 14, color: "#0f172a" }}
                  >
                    <option value="">Select Chapter</option>
                    {chapterOptions.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.title} ({chapter.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13, color: "#334155" }}>Assessment Type</label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={assessmentType}
                      onChange={(event) => setAssessmentType(event.target.value)}
                      style={{
                        width: "100%",
                        borderRadius: 12,
                        border: "1px solid #bfdbfe",
                        background: "linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)",
                        padding: "10px 38px 10px 12px",
                        fontSize: 14,
                        fontWeight: 800,
                        color: "#1e3a8a",
                        appearance: "none",
                        boxShadow: "0 8px 16px rgba(29, 78, 216, 0.10)",
                      }}
                    >
                      <option value="Quiz">Quiz</option>
                      <option value="Worksheet">Worksheet</option>
                      <option value="Exam">Exam</option>
                    </select>
                    <span
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#1e40af",
                        fontSize: 12,
                        pointerEvents: "none",
                        fontWeight: 900,
                      }}
                    >
                      ▾
                    </span>
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13, color: "#334155" }}>Duration (minutes)</label>
                  <input type="number" value={durationMinutes} min={1} onChange={(event) => setDurationMinutes(event.target.value)} required style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc", padding: "9px 11px", fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13, color: "#334155" }}>Total Questions</label>
                  <input type="number" value={totalQuestions} min={1} onChange={(event) => setTotalQuestions(event.target.value)} required style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc", padding: "9px 11px", fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13, color: "#334155" }}>Pass Score</label>
                  <input type="number" value={passScore} min={1} onChange={(event) => setPassScore(event.target.value)} required style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc", padding: "9px 11px", fontSize: 14 }} />
                </div>
                <div style={{ display: "flex", alignItems: "end" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, color: "#334155", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px" }}>
                    <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
                    Publish now
                  </label>
                </div>
              </div>

              <h3 style={{ margin: "10px 0 12px", fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Questions</h3>

              {questions.map((question, idx) => (
                <div key={`question-${idx}`} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: isMobile ? 12 : 14, marginBottom: 10, background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10 }}>
                    <span style={{ fontWeight: 800, color: "#1d4ed8" }}>Question {idx + 1}</span>
                    {questions.length > 1 && (
                      <button type="button" onClick={() => removeQuestion(idx)} style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        Remove
                      </button>
                    )}
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13, color: "#334155" }}>Question</label>
                    <input
                      value={question.question}
                      onChange={(event) => handleQuestionChange(idx, "question", event.target.value)}
                      required
                      style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", padding: "9px 11px", fontSize: 14 }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    {Object.keys(question.options).map((option) => (
                      <div key={`${idx}-${option}`}>
                        <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13, color: "#334155" }}>Option {option}</label>
                        <input
                          value={question.options[option]}
                          onChange={(event) => handleQuestionChange(idx, "options", { [option]: event.target.value })}
                          required
                          style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", padding: "9px 11px", fontSize: 14 }}
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13, color: "#334155" }}>Correct Option</label>
                      <select
                        value={question.correct}
                        onChange={(event) => handleQuestionChange(idx, "correct", event.target.value)}
                        style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", padding: "9px 11px", fontSize: 14 }}
                      >
                        {Object.keys(question.options).map((option) => (
                          <option key={`${idx}-correct-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13, color: "#334155" }}>Points</label>
                      <input
                        type="number"
                        value={question.points}
                        min={1}
                        onChange={(event) => handleQuestionChange(idx, "points", event.target.value)}
                        required
                        style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", padding: "9px 11px", fontSize: 14 }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 13, color: "#334155" }}>Explanation (optional)</label>
                    <input
                      value={question.explanation}
                      onChange={(event) => handleQuestionChange(idx, "explanation", event.target.value)}
                      style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", padding: "9px 11px", fontSize: 14 }}
                    />
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                <button type="button" onClick={addQuestion} style={{ border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "8px 12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <FaPlus /> Add Question
                </button>
                <button type="submit" disabled={saving} style={{ border: "none", background: "#1d4ed8", color: "#ffffff", borderRadius: 999, padding: "10px 14px", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", boxShadow: "0 10px 18px rgba(29, 78, 216, 0.24)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <FaSave /> {saving ? "Saving..." : "Save Assessment"}
                </button>
              </div>

              {success && <div style={{ marginTop: 12, color: "#15803d", fontWeight: 700 }}>{success}</div>}
              {error && <div style={{ marginTop: 12, color: "#b91c1c", fontWeight: 700 }}>{error}</div>}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Exam;
