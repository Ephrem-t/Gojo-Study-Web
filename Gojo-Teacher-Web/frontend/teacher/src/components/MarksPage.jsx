import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FaSave,
  FaHome,
  FaSignOutAlt,
  FaUsers,
  FaChalkboardTeacher,
  FaClipboardCheck
  , FaFileExcel, FaPrint, FaFileDownload,
   FaUserCheck,
  FaCalendarAlt,
  FaBookOpen
} from "react-icons/fa";
import Sidebar from "./Sidebar";
import "../styles/global.css";

import { API_BASE } from "../api/apiConfig";
import { getRtdbRoot, RTDB_BASE_RAW } from "../api/rtdbScope";
import { getTeacherCourseContext } from "../api/teacherApi";
import {
  clearCachedChatSummary,
  fetchTeacherConversationSummaries,
  loadStudentsByGradeSections,
  resolveTeacherSchoolCode,
} from "../utils/teacherData";
const RTDB_BASE = getRtdbRoot();
const TEACHER_BEFORE_APP_NAVIGATION_HANDLER = "__teacherBeforeAppNavigation";

// Format student name: capitalize first letter of each word, rest lowercase
const formatStudentName = (rawName) => {
  if (!rawName) return "";
  return String(rawName)
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
};

const toSubjectKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const getSubjectKeyVariants = (value) => {
  const base = toSubjectKey(value);
  const set = new Set([base]);
  if (base === "mathematics" || base === "math") set.add("maths");
  if (base === "maths") {
    set.add("mathematics");
    set.add("math");
  }
  return Array.from(set).filter(Boolean);
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

const getStudentGrade = (student = {}) =>
  String(
    student?.grade ||
      student?.basicStudentInformation?.grade ||
      student?.academicSetup?.grade ||
      ""
  ).trim();

const getStudentSection = (student = {}) =>
  String(
    student?.section ||
      student?.basicStudentInformation?.section ||
      student?.academicSetup?.section ||
      ""
  )
    .trim()
    .toUpperCase();

const clampScoreToMax = (rawValue, maxValue) => {
  const digits = String(rawValue || "").replace(/[^0-9]/g, "");
  if (!digits) return "";

  const numeric = Number(digits);
  if (!Number.isFinite(numeric)) return "";

  const maxNumeric = Number(maxValue);
  if (!Number.isFinite(maxNumeric) || maxNumeric < 0) return numeric;
  return Math.min(numeric, maxNumeric);
};

const validateMarksAgainstMax = (marks = {}) => {
  const violations = [];
  Object.entries(marks || {}).forEach(([assessmentKey, assessment]) => {
    const scoreRaw = assessment?.score;
    if (scoreRaw === "" || scoreRaw === null || scoreRaw === undefined) return;

    const score = Number(scoreRaw);
    const max = Number(assessment?.max);
    if (!Number.isFinite(score) || !Number.isFinite(max)) return;

    if (score > max) {
      violations.push({
        assessmentKey,
        name: assessment?.name || assessmentKey,
        max,
      });
    }
  });
  return violations;
};

const getViewportWidth = () => (typeof window !== "undefined" ? window.innerWidth : 1024);

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

const findUserByUserId = (usersObj, userId) => {
  if (!usersObj || !userId) return null;
  const normalizedUserId = String(userId || "").trim();
  if (usersObj[normalizedUserId]) return usersObj[normalizedUserId];

  return (
    Object.entries(usersObj).find(([userKey, userValue]) => {
      return (
        String(userKey || "").trim() === normalizedUserId ||
        String(userValue?.userId || "").trim() === normalizedUserId
      );
    })?.[1] || null
  );
};

const MARKS_AUTOSAVE_STORAGE_KEY = "teacher_marks_auto_save_enabled";
const AUTO_SAVE_DELAY_MS = 900;

const getStoredAutoSaveEnabled = () => {
  if (typeof window === "undefined") return true;

  try {
    const raw = localStorage.getItem(MARKS_AUTOSAVE_STORAGE_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
};

const formatAutoSaveTime = (timeStamp) => {
  if (!timeStamp) return "";

  try {
    return new Date(timeStamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

export default function MarksPage() {
  // Sidebar toggle state for mobile (like Dashboard)
  const [sidebarOpen, setSidebarOpen] = useState(() => getViewportWidth() > 600);
  const [teacher, setTeacher] = useState(null);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [assessmentList, setAssessmentList] = useState([]);
  const [assessmentMode, setAssessmentMode] = useState("semester");
  const [studentMarks, setStudentMarks] = useState({});
  const [noStudentsInCourse, setNoStudentsInCourse] = useState(false);
  const [structureSubmitted, setStructureSubmitted] = useState(false);
  const [activeSemester, setActiveSemester] = useState("semester2"); // default
  const [quartersBySem, setQuartersBySem] = useState({ semester1: ["q1", "q2"], semester2: ["q1", "q2"] });
  const [selectedQuarter, setSelectedQuarter] = useState("q1");
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [messageNotifications, setMessageNotifications] = useState([]);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cellErrors, setCellErrors] = useState({});
  const [rtdbBase, setRtdbBase] = useState("");
  const [schoolBaseResolved, setSchoolBaseResolved] = useState(false);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const navigate = useNavigate();
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [isMobile, setIsMobile] = useState(() => getViewportWidth() <= 600);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => getStoredAutoSaveEnabled());
  const [dirtyStudentIds, setDirtyStudentIds] = useState({});
  const [autoSaveStatus, setAutoSaveStatus] = useState("idle");
  const [autoSaveError, setAutoSaveError] = useState("");
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState(null);
  const autoSaveTimerRef = useRef(null);
  const dirtyStudentIdsRef = useRef({});
  const studentMarksRef = useRef({});

  // Responsive handling for sidebar
  useEffect(() => {
    const handleResize = () => {
      const width = getViewportWidth();
      setIsMobile(width <= 600);
      if (width <= 600) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ---------------- LOAD TEACHER ----------------
  useEffect(() => {
    const storedTeacher = getStoredTeacher();
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  const teacherUserId = teacher?.userId;

  useEffect(() => {
    dirtyStudentIdsRef.current = dirtyStudentIds;
  }, [dirtyStudentIds]);

  useEffect(() => {
    studentMarksRef.current = studentMarks;
  }, [studentMarks]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(MARKS_AUTOSAVE_STORAGE_KEY, String(autoSaveEnabled));
  }, [autoSaveEnabled]);

  useEffect(() => {
    const resolveSchoolBase = async () => {
      if (!teacher) return;

      setSchoolBaseResolved(false);

      if (!teacher?.schoolCode) {
        setRtdbBase(RTDB_BASE);
        setSchoolBaseResolved(true);
        return;
      }

      const resolvedSchoolCode = await resolveTeacherSchoolCode(teacher.schoolCode);
      setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${resolvedSchoolCode}`);
      setSchoolBaseResolved(true);
    };

    resolveSchoolBase();
  }, [teacher]);

  // Messenger conversations fetch
  useEffect(() => {
    if (teacher) {
      fetchConversations(teacher);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher]);

  // Fetch teacher's assigned courses (populates Select Course)
  useEffect(() => {
    if (!teacher || !schoolBaseResolved || !rtdbBase) return;
    const fetchCourses = async () => {
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
          const fallbackCourseIds = new Set([
            ...Object.keys(coursesMap || {}),
            ...Object.keys(classMarks || {}),
            ...Object.keys(courseStats || {}),
          ]);

          teacherCourses = Array.from(fallbackCourseIds)
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
                virtual: !stored || !Object.keys(stored).length,
                _marksCount: marksCount,
              };
            })
            .sort((a, b) => (b._marksCount || 0) - (a._marksCount || 0))
            .map(({ _marksCount, ...rest }) => rest);
        }

        setCourses((prev) => {
          if (teacherCourses.length > 0) return teacherCourses;
          return prev;
        });

        if (teacherCourses.length > 0) {
          setSelectedCourseId((prevSelected) => {
            if (prevSelected && teacherCourses.some((c) => c.id === prevSelected)) {
              return prevSelected;
            }
            return teacherCourses[0].id;
          });
        }
      } catch (err) {
        console.error("Error fetching courses:", err);
      }
    };
    fetchCourses();
  }, [teacher, schoolBaseResolved, rtdbBase]);

  // Load marks for course/semester is handled in the effect below
  useEffect(() => {
    if (!selectedCourseId || !schoolBaseResolved || !studentsLoaded) return;
    const loadCourseData = async () => {
      try {
        const course = courses.find((c) => c.id === selectedCourseId);
        if (!course) return;

        const courseDefaults = parseVirtualCourseFromId(selectedCourseId);
        const resolvedCourse = {
          ...course,
          grade: String(course?.grade || courseDefaults.grade || "").trim(),
          section: String(course?.section || course?.secation || courseDefaults.section || "")
            .trim()
            .toUpperCase(),
          subject: course?.subject || course?.name || courseDefaults.subject,
          name: course?.name || course?.subject || courseDefaults.name,
        };

        const subjectVariants = getSubjectKeyVariants(resolvedCourse.subject || resolvedCourse.name || "");
        const [marksRes, templateRes] = await Promise.all([
          axios.get(`${rtdbBase}/ClassMarks/${selectedCourseId}.json`),
          axios.get(
            `${rtdbBase}/AssesmentTemplates/${encodeURIComponent(resolvedCourse.grade)}.json`
          ).catch(() => ({ data: {} })),
        ]);

        const gradeTemplateNode =
          templateRes.data && typeof templateRes.data === "object" ? templateRes.data : {};

        const findSubjectTemplateNode = () => {
          for (const key of subjectVariants) {
            if (gradeTemplateNode[key] && typeof gradeTemplateNode[key] === "object") {
              return gradeTemplateNode[key];
            }
          }

          const entries = Object.entries(gradeTemplateNode || {});
          for (const [nodeKey, subjectNode] of entries) {
            if (!subjectNode || typeof subjectNode !== "object") continue;
            if (subjectVariants.includes(toSubjectKey(nodeKey))) return subjectNode;

            const semEntries = Object.entries(subjectNode).filter(
              ([semKey, semVal]) => /^semester\d+$/i.test(semKey) && semVal && typeof semVal === "object"
            );
            for (const [, semNode] of semEntries) {
              const embeddedSubject = toSubjectKey(semNode?.subject || "");
              if (embeddedSubject && subjectVariants.includes(embeddedSubject)) {
                return subjectNode;
              }
            }
          }

          return null;
        };

        const subjectTemplateNode = findSubjectTemplateNode() || {};
        const availableSemestersFromTemplate = Object.keys(subjectTemplateNode || {}).filter((k) =>
          /^semester\d+$/i.test(k)
        );

        const availableSemestersFromMarks = new Set();
        Object.values(marksRes.data || {}).forEach((studentNode) => {
          Object.keys(studentNode || {}).forEach((k) => {
            if (/^semester\d+$/i.test(k)) availableSemestersFromMarks.add(k);
          });
        });

        const availableSemesters = Array.from(
          new Set([...availableSemestersFromTemplate, ...Array.from(availableSemestersFromMarks)])
        ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        if (availableSemesters.length && !availableSemesters.includes(activeSemester)) {
          setActiveSemester(availableSemesters[0]);
          return;
        }

        const templateSemNode =
          subjectTemplateNode && typeof subjectTemplateNode === "object"
            ? (subjectTemplateNode[activeSemester] && typeof subjectTemplateNode[activeSemester] === "object"
                ? subjectTemplateNode[activeSemester]
                : {})
            : {};
        const hasQuarterTemplate = Object.keys(templateSemNode).some((k) => /^q\d+$/i.test(k));
        const templateMode =
          templateSemNode.mode === "quarter"
            ? "quarter"
            : templateSemNode.mode === "semester"
            ? "semester"
            : hasQuarterTemplate
            ? "quarter"
            : "semester";
        setAssessmentMode(templateMode);

        const normalizedCourseGrade = String(resolvedCourse.grade ?? "").trim();
        const normalizedCourseSection = String(resolvedCourse.section ?? "").trim().toUpperCase();
        const filteredStudents = students.filter(
          (s) =>
            getStudentGrade(s) === normalizedCourseGrade &&
            getStudentSection(s) === normalizedCourseSection
        );
        setNoStudentsInCourse(filteredStudents.length === 0);
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }
        setDirtyStudentIds({});
        setAutoSaveStatus("idle");
        setAutoSaveError("");
        setLastAutoSavedAt(null);

        if (!filteredStudents.length) {
          setStudentMarks({});
          setAssessmentList([]);
          setStructureSubmitted(false);
          setQuartersBySem((p) => ({ ...p, [activeSemester]: ["q1"] }));
          setSelectedQuarter("q1");
          return;
        }

        const initMarks = {};
        let assessmentListFromDB = [];

        const cloneAssessments = (assessments) => {
          const src = assessments && typeof assessments === "object" ? assessments : {};
          const out = {};
          Object.entries(src).forEach(([key, value]) => {
            const item = value && typeof value === "object" ? value : {};
            out[key] = {
              name: String(item.name || "").trim(),
              max: Number(item.max || 0),
              score: item.score === "" ? "" : Number(item.score || 0),
            };
          });
          return out;
        };

        const getTemplateAssessmentsForSelection = () => {
          if (templateMode === "quarter") {
            const quarterNode = templateSemNode?.[selectedQuarter];
            if (quarterNode && typeof quarterNode === "object" && quarterNode.assessments) {
              return cloneAssessments(quarterNode.assessments);
            }
          }
          if (templateSemNode && typeof templateSemNode === "object" && templateSemNode.assessments) {
            return cloneAssessments(templateSemNode.assessments);
          }
          if (templateMode === "quarter") {
            const firstQuarterNode = Object.entries(templateSemNode || {}).find(([k, v]) =>
              /^q\d+$/i.test(k) && v && typeof v === "object" && v.assessments
            );
            if (firstQuarterNode) return cloneAssessments(firstQuarterNode[1].assessments);
          }
          return {};
        };

        const mergeScoresIntoTemplate = (templateAssessments, existingAssessments) => {
          const merged = cloneAssessments(templateAssessments);
          const existing = existingAssessments && typeof existingAssessments === "object" ? existingAssessments : {};
          const existingByName = {};
          Object.values(existing).forEach((item) => {
            const nameKey = String(item?.name || "").trim().toLowerCase();
            if (!nameKey) return;
            existingByName[nameKey] = item;
          });

          Object.entries(merged).forEach(([key, item]) => {
            const byKey = existing[key];
            const byName = existingByName[String(item.name || "").trim().toLowerCase()];
            const picked = byKey && typeof byKey === "object" ? byKey : byName;
            if (!picked || typeof picked !== "object") return;
            const scoreValue = picked.score;
            item.score = scoreValue === "" ? "" : Number(scoreValue || 0);
          });

          return merged;
        };

        const quarterSet = new Set();
        if (templateMode === "quarter") {
          filteredStudents.forEach((s) => {
            const semData = marksRes.data?.[s.id]?.[activeSemester];
            if (semData && typeof semData === "object") {
              Object.keys(semData).forEach((k) => {
                if (k && k.toLowerCase().startsWith("q")) quarterSet.add(k);
              });
            }
          });
          Object.keys(templateSemNode || {}).forEach((k) => {
            if (k && k.toLowerCase().startsWith("q")) quarterSet.add(k);
          });
        }

        const quartersArrRaw = templateMode === "quarter" ? Array.from(quarterSet) : ["q1"];
        if (templateMode === "quarter") {
          const required = ["q1", "q2"];
          required.forEach((rq) => {
            if (!quartersArrRaw.includes(rq)) quartersArrRaw.push(rq);
          });
          if (!quartersArrRaw.includes("avg")) quartersArrRaw.push("avg");
        }

        const quartersArr = quartersArrRaw
          .filter((q) => q !== "avg")
          .sort((a, b) => {
            const na = parseInt(String(a).replace(/^q/i, ""), 10) || 0;
            const nb = parseInt(String(b).replace(/^q/i, ""), 10) || 0;
            return na - nb;
          });
        if (templateMode === "quarter" && !quartersArr.includes("avg")) quartersArr.push("avg");
        setQuartersBySem((p) => ({ ...p, [activeSemester]: quartersArr }));

        // Ensure selectedQuarter exists for this semester
        if (!quartersArr.includes(selectedQuarter)) setSelectedQuarter(quartersArr[0]);

        const templateAssessmentsForSelection = getTemplateAssessmentsForSelection();

        filteredStudents.forEach((s) => {
          const semData = marksRes.data?.[s.id]?.[activeSemester];
          if (templateMode === "quarter" && selectedQuarter === 'avg') {
            // compute average percentage across q1 and q2
            const q1 = semData?.q1?.assessments || {};
            const q2 = semData?.q2?.assessments || {};
            const sumScores = (obj) => Object.values(obj).reduce((sum, it) => sum + (it.score || 0), 0);
            const sumMax = (obj) => Object.values(obj).reduce((sum, it) => sum + (it.max || 0), 0);
            const total1 = sumScores(q1); const max1 = sumMax(q1);
            const total2 = sumScores(q2); const max2 = sumMax(q2);
            const pct1 = max1 > 0 ? (total1 / max1) * 100 : 0;
            const pct2 = max2 > 0 ? (total2 / max2) * 100 : 0;
            const avgPct = (pct1 + pct2) / 2;
            // store as a single assessment column 'avg'
            initMarks[s.id] = { avg: { name: 'Average', max: 100, score: Number(avgPct.toFixed(1)) } };
            if (!assessmentListFromDB.length) assessmentListFromDB = [{ name: 'Average', max: 100 }];
          } else {
            const existingAssessments =
              templateMode === "quarter"
                ? semData?.[selectedQuarter]?.assessments || semData?.assessments || {}
                : semData?.assessments || semData?.[selectedQuarter]?.assessments || {};

            if (Object.keys(templateAssessmentsForSelection).length) {
              initMarks[s.id] = mergeScoresIntoTemplate(templateAssessmentsForSelection, existingAssessments);
              if (!assessmentListFromDB.length) assessmentListFromDB = Object.values(templateAssessmentsForSelection);
            } else if (existingAssessments && Object.keys(existingAssessments).length) {
              const clonedExisting = cloneAssessments(existingAssessments);
              initMarks[s.id] = clonedExisting;
              if (!assessmentListFromDB.length) assessmentListFromDB = Object.values(clonedExisting);
            } else {
              initMarks[s.id] = {};
            }
          }
        });

        setStudentMarks(initMarks);
        setAssessmentList(assessmentListFromDB.map((a) => ({ name: a.name, max: a.max })));
        setStructureSubmitted(assessmentListFromDB.length > 0);
      } catch (err) {
        console.error("Error loading marks:", err);
        setNoStudentsInCourse(false);
        setStructureSubmitted(false);
        setStudentMarks({});
      }
    };
    loadCourseData();
    // include selectedQuarter so loading reflects quarter change
  }, [selectedCourseId, courses, students, activeSemester, selectedQuarter, rtdbBase, schoolBaseResolved, studentsLoaded]);

  // Fetch only the selected course's students.
  useEffect(() => {
    if (!teacherUserId || !schoolBaseResolved || !rtdbBase) return;
    const fetchStudents = async () => {
      setStudentsLoaded(false);
      try {
        const selectedCourse = courses.find((course) => course.id === selectedCourseId) || null;
        if (!selectedCourse) {
          setStudents([]);
          return;
        }

        const normalizedCourseGrade = String(selectedCourse?.grade || "").trim();
        const normalizedCourseSection = String(selectedCourse?.section || selectedCourse?.secation || "")
          .trim()
          .toUpperCase();
        const mappedStudents = await loadStudentsByGradeSections({
          rtdbBase,
          schoolCode: teacher?.schoolCode,
          allowedGradeSections: new Set([`${normalizedCourseGrade}|${normalizedCourseSection}`]),
        });

        setStudents(mappedStudents);
      } catch (err) {
        console.error("Error fetching students:", err);
      } finally {
        setStudentsLoaded(true);
      }
    };
    fetchStudents();
  }, [courses, selectedCourseId, schoolBaseResolved, rtdbBase, teacher?.schoolCode, teacherUserId]);

  const setCellError = (sid, key, message = "") => {
    setCellErrors((prev) => {
      const nextStudentErrors = { ...(prev[sid] || {}) };
      if (message) {
        nextStudentErrors[key] = message;
      } else {
        delete nextStudentErrors[key];
      }

      const next = { ...prev };
      if (Object.keys(nextStudentErrors).length > 0) {
        next[sid] = nextStudentErrors;
      } else {
        delete next[sid];
      }
      return next;
    });
  };

  const setViolationsForStudent = (sid, violations = []) => {
    if (!sid) return;
    violations.forEach((v) => {
      setCellError(sid, v.assessmentKey, `Cannot exceed ${v.max}`);
    });
  };

  const getDirtyStudentIdList = () =>
    Object.entries(dirtyStudentIdsRef.current || {})
      .filter(([, isDirty]) => Boolean(isDirty))
      .map(([studentId]) => studentId);

  const clearDirtyStudentIds = (studentIds = []) => {
    const normalizedIds = [...new Set((studentIds || []).map((studentId) => String(studentId || "").trim()).filter(Boolean))];
    if (!normalizedIds.length) return;

    setDirtyStudentIds((previousDirtyIds) => {
      const nextDirtyIds = { ...(previousDirtyIds || {}) };
      normalizedIds.forEach((studentId) => {
        delete nextDirtyIds[studentId];
      });
      return nextDirtyIds;
    });
  };

  const buildMarksSaveUrl = (studentId, context = {}) => {
    const base = context.rtdbBase || rtdbBase;
    const courseId = context.selectedCourseId || selectedCourseId;
    const semester = context.activeSemester || activeSemester;
    const quarter = context.selectedQuarter || selectedQuarter;
    const mode = context.assessmentMode || assessmentMode;

    if (mode === "quarter") {
      return `${base}/ClassMarks/${courseId}/${studentId}/${semester}/${quarter}.json`;
    }

    return `${base}/ClassMarks/${courseId}/${studentId}/${semester}.json`;
  };

  const persistStudentMarksEntries = async (studentIds = [], options = {}) => {
    const normalizedStudentIds = [...new Set((studentIds || []).map((studentId) => String(studentId || "").trim()).filter(Boolean))];
    if (!normalizedStudentIds.length) return true;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const context = {
      rtdbBase,
      selectedCourseId,
      activeSemester,
      selectedQuarter,
      assessmentMode,
      teacherName: teacher?.name || "",
      ...(options.context || {}),
    };

    if (!context.rtdbBase || !context.selectedCourseId) return false;
    if (!structureSubmitted || !assessmentList.length) {
      if (!options.silent) alert(templateMissingMessage);
      return false;
    }
    if (context.assessmentMode === "quarter" && context.selectedQuarter === "avg") {
      if (!options.silent) alert("Please select a valid course and quarter");
      return false;
    }

    const groupedViolations = normalizedStudentIds.reduce((accumulator, studentId) => {
      const violations = validateMarksAgainstMax(studentMarksRef.current?.[studentId] || {});
      if (violations.length) accumulator[studentId] = violations;
      return accumulator;
    }, {});

    if (Object.keys(groupedViolations).length) {
      Object.entries(groupedViolations).forEach(([studentId, violations]) => {
        setViolationsForStudent(studentId, violations);
      });

      if (options.silent) {
        setAutoSaveStatus("error");
        setAutoSaveError("Auto-save paused. Some marks exceed the allowed maximum.");
      }
      return false;
    }

    if (options.silent) {
      setAutoSaveStatus("saving");
      setAutoSaveError("");
    }

    try {
      await Promise.all(
        normalizedStudentIds.map((studentId) =>
          axios.put(buildMarksSaveUrl(studentId, context), {
            teacherName: context.teacherName,
            assessments: studentMarksRef.current?.[studentId] || {},
          })
        )
      );

      clearDirtyStudentIds(normalizedStudentIds);
      setLastAutoSavedAt(Date.now());
      setAutoSaveStatus("saved");
      setAutoSaveError("");
      return true;
    } catch (err) {
      console.error(options.silent ? "Auto-save failed:" : "Save failed:", err);

      if (options.silent) {
        setAutoSaveStatus("error");
        setAutoSaveError("Auto-save failed. Your recent changes are still pending.");
      } else {
        alert(options.failureMessage || "Failed to save marks");
      }
      return false;
    }
  };

  const flushPendingMarks = async (options = {}) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const dirtyIds = getDirtyStudentIdList();
    if (!dirtyIds.length) return true;

    return persistStudentMarksEntries(dirtyIds, {
      silent: true,
      context: options.context,
    });
  };

  const dirtyStudentCount = Object.keys(dirtyStudentIds || {}).filter((studentId) => dirtyStudentIds[studentId]).length;
  const hasUnsavedChanges = dirtyStudentCount > 0;
  const manualModeSwitchLocked = !autoSaveEnabled && hasUnsavedChanges;
  const manualModeSwitchMessage = "Save All before changing course, semester, or quarter while Auto Save is off.";

  const prepareMarksContextSwitch = async () => {
    if (manualModeSwitchLocked) {
      alert(manualModeSwitchMessage);
      return false;
    }

    return flushPendingMarks();
  };

  const updateScore = (sid, key, value, maxValue) => {
    const digits = String(value || "").replace(/[^0-9]/g, "");
    const maxNumeric = Number(maxValue);
    if (digits && Number.isFinite(maxNumeric) && Number(digits) > maxNumeric) {
      setCellError(sid, key, `Cannot exceed ${maxNumeric}`);
    } else {
      setCellError(sid, key, "");
    }

    const clamped = clampScoreToMax(digits, maxValue);

    // allow empty string while editing (treat as no input), otherwise store numeric
    setStudentMarks((p) => ({
      ...p,
      [sid]: { ...p[sid], [key]: { ...p[sid][key], score: clamped === '' ? '' : Number(clamped) } },
    }));

    setDirtyStudentIds((previousDirtyIds) => ({
      ...(previousDirtyIds || {}),
      [sid]: true,
    }));
    setAutoSaveStatus(autoSaveEnabled ? "pending" : "idle");
    setAutoSaveError("");
  };
  const templateMissingMessage =
    "Assessment template is not available. Ask admin to create it first in AssessmentTemplates.";

  const saveMarks = async (sid) => {
    const didSave = await persistStudentMarksEntries([sid], {
      silent: false,
      failureMessage: "Failed to save marks",
    });

    if (didSave) {
      alert("Marks saved successfully");
    }
  };

  // Save all students' marks at once for the selected course/semester/quarter
  const saveAllMarks = async () => {
    if (noStudentsInCourse) {
      alert("No students are assigned to this course/class yet.");
      return;
    }
    if (!structureSubmitted || !assessmentList.length) {
      alert(templateMissingMessage);
      return;
    }
    if (!selectedCourseId || (assessmentMode === "quarter" && selectedQuarter === 'avg')) {
      alert('Please select a valid course and quarter');
      return;
    }

    const didSave = await persistStudentMarksEntries(Object.keys(studentMarks || {}), {
      silent: false,
      failureMessage: "Failed to save all marks",
    });

    if (didSave) {
      alert('All marks saved successfully');
    }
  };

  useEffect(() => {
    if (!autoSaveEnabled && autoSaveStatus === "pending") {
      setAutoSaveStatus(hasUnsavedChanges ? "idle" : "saved");
    }
  }, [autoSaveEnabled, hasUnsavedChanges, autoSaveStatus]);

  useEffect(() => {
    if (!selectedCourseId || !structureSubmitted || !assessmentList.length || noStudentsInCourse) return undefined;
    if (assessmentMode === "quarter" && selectedQuarter === "avg") return undefined;
    if (!autoSaveEnabled) return undefined;

    const dirtyIds = Object.entries(dirtyStudentIds || {})
      .filter(([, isDirty]) => Boolean(isDirty))
      .map(([studentId]) => studentId);

    if (!dirtyIds.length) return undefined;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void persistStudentMarksEntries(dirtyIds, { silent: true });
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [autoSaveEnabled, dirtyStudentIds, selectedCourseId, activeSemester, selectedQuarter, assessmentMode, structureSubmitted, assessmentList.length, noStudentsInCourse, rtdbBase, teacher?.name]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const handleLogout = async () => {
    const didFlush = await flushPendingMarks();
    if (!didFlush) return;
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleBeforeAppNavigation = async (intent = {}) => {
      if (!hasUnsavedChanges) {
        return true;
      }

      if (!autoSaveEnabled) {
        alert(
          intent.type === "logout"
            ? "Save All before logging out while Auto Save is off."
            : "Save All before leaving the Marks page while Auto Save is off."
        );
        return false;
      }

      return flushPendingMarks();
    };

    window[TEACHER_BEFORE_APP_NAVIGATION_HANDLER] = handleBeforeAppNavigation;

    return () => {
      if (window[TEACHER_BEFORE_APP_NAVIGATION_HANDLER] === handleBeforeAppNavigation) {
        delete window[TEACHER_BEFORE_APP_NAVIGATION_HANDLER];
      }
    };
  }, [autoSaveEnabled, flushPendingMarks, hasUnsavedChanges]);

  // ---------------- NOTIFICATIONS ----------------
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${API_BASE}/get_posts`);
        let postsData = res.data || [];
        if (!Array.isArray(postsData) && typeof postsData === "object") postsData = Object.values(postsData);
        const teacherLocal = getStoredTeacher();
        const seenPosts = getSeenPosts(teacherLocal?.userId);
        const latestPosts = postsData
          .slice()
          .sort((a, b) => ((b.time ? new Date(b.time).getTime() : 0) - (a.time ? new Date(a.time).getTime() : 0)))
          .filter((post) => post.postId && !seenPosts.includes(post.postId))
          .slice(0, 5)
          .map((post) => ({
            type: "post",
            id: post.postId,
            title: post.message?.substring(0, 50) || "Untitled post",
            adminName: post.adminName || "Admin",
            adminProfile: post.adminProfile || "/default-profile.png",
          }));

        const messageNotifs = teacherLocal?.userId
          ? (await fetchTeacherConversationSummaries({
              rtdbBase,
              schoolCode: teacherLocal?.schoolCode,
              teacherUserId: teacherLocal.userId,
              unreadOnly: true,
            })).map((conversation) => ({
              type: "message",
              chatId: conversation.chatId,
              displayName: conversation.displayName,
              profile: conversation.profile,
              lastMessageText: conversation.lastMessageText,
              lastMessageTime: conversation.lastMessageTime,
              unreadForMe: conversation.unreadForMe,
            }))
          : [];

        setNotifications([...latestPosts, ...messageNotifs]);
        setMessageNotifications(messageNotifs);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };
    fetchNotifications();
  }, [rtdbBase]);

  // Messenger fetching
  const fetchConversations = async (currentTeacher = teacher) => {
    try {
      const t = currentTeacher || getStoredTeacher();
      if (!t || !t.userId) {
        setConversations([]);
        return;
      }
      const convs = await fetchTeacherConversationSummaries({
        rtdbBase,
        schoolCode: t?.schoolCode,
        teacherUserId: t.userId,
        unreadOnly: true,
      });
      setConversations(convs);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setConversations([]);
    }
  };
  const handleMessengerToggle = async () => {
    setShowMessenger((s) => !s);
    await fetchConversations();
  };
  const handleOpenConversation = async (conv, index) => {
    if (!teacher || !conv) return;
    const { chatId, contact } = conv;
    // navigate to AllChat with contact + chatId
    navigate("/all-chat", { state: { contact, chatId, tab: "marks" } });
    // clear unread in RTDB for this teacher
    try {
      await axios.put(`${rtdbBase}/Chats/${chatId}/unread/${teacher.userId}.json`, null);
      clearCachedChatSummary({
        rtdbBase,
        chatId,
        teacherUserId: teacher.userId,
      });
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }
    // remove from local UI and close dropdown
    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };
  const totalUnreadMessages = messageNotifications.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);
  const saveStatusText =
    autoSaveStatus === "saving"
      ? `Saving ${dirtyStudentCount || getDirtyStudentIdList().length} mark rows...`
      : autoSaveStatus === "pending"
      ? "Auto-save queued..."
      : autoSaveStatus === "error"
      ? autoSaveError || "Save failed"
      : hasUnsavedChanges
      ? autoSaveEnabled
        ? "Unsaved changes detected"
        : "Unsaved changes"
      : lastAutoSavedAt
      ? `Saved at ${formatAutoSaveTime(lastAutoSavedAt)}`
      : autoSaveEnabled
      ? "Auto-save is on"
      : "Auto-save is off";

  const saveStatusStyle = {
    background:
      autoSaveStatus === "error"
        ? "#fef2f2"
        : autoSaveStatus === "saving" || autoSaveStatus === "pending"
        ? "#eff6ff"
        : hasUnsavedChanges
        ? "#fff7ed"
        : "#f8fafc",
    border:
      autoSaveStatus === "error"
        ? "1px solid #fecaca"
        : autoSaveStatus === "saving" || autoSaveStatus === "pending"
        ? "1px solid #bfdbfe"
        : hasUnsavedChanges
        ? "1px solid #fdba74"
        : "1px solid #e2e8f0",
    color:
      autoSaveStatus === "error"
        ? "#b91c1c"
        : autoSaveStatus === "saving" || autoSaveStatus === "pending"
        ? "#1d4ed8"
        : hasUnsavedChanges
        ? "#9a3412"
        : "#334155",
  };

  // --- Mark notification as seen ---
  const handleNotificationClick = (postId) => {
    if (!teacher || !postId) return;
    saveSeenPost(teacher.userId, postId);
    setNotifications(prev => prev.filter((n) => n.id !== postId));
    setShowNotifications(false);
  };
  function getSeenPosts(teacherId) {
    try {
      return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
    } catch {
      return [];
    }
  }
  function saveSeenPost(teacherId, postId) {
    const seen = getSeenPosts(teacherId);
    if (!seen.includes(postId)) {
      localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seen, postId]));
    }
  }

  // --- Table scroll buttons ---
  const marksWrapperRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollMarks = (direction) => {
    const el = marksWrapperRef.current;
    if (!el) return;
    const amount = Math.max(Math.floor(el.clientWidth * 0.9), 420);
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  };
  const updateScrollButtons = () => {
    const el = marksWrapperRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
  };
  useEffect(() => {
    const el = marksWrapperRef.current;
    if (!el) return;
    updateScrollButtons();
    const onScroll = () => updateScrollButtons();
    const onResize = () => updateScrollButtons();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [structureSubmitted, assessmentList.length]);

  // --- Responsive CSS for mobile table ---
  // Add this CSS to your global.css file if not already present
  // Or you can use a <style> block here
  useEffect(() => {
    const styleId = "responsive-marks-table-style";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      /* Make marks table fluid and match attendance layout */
      .marks-table-wrapper { width: 100% !important; max-width: 100vw !important; overflow-x: auto !important; padding: 0 1rem !important; }
      .marks-table { width: 100% !important; table-layout: auto !important; min-width: 0 !important; border-collapse: collapse !important; }
      .marks-table th, .marks-table td { font-size: 13px !important; padding: 8px !important; white-space: normal !important; word-break: break-word !important; overflow-wrap: anywhere !important; }
      .marks-table td input { width: 100% !important; box-sizing: border-box !important; min-width: 40px !important; }

      /* Remove number input spinner buttons so teachers use keyboard entry only */
      .marks-table td input[type=number]::-webkit-outer-spin-button,
      .marks-table td input[type=number]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .marks-table td input[type=number] { -moz-appearance: textfield; }

      @media (max-width: 600px) {
        .google-main { margin-left: 0 !important; padding-left: 0 !important; width: 100vw !important; max-width: 100vw !important; }
        .marks-table-wrapper { padding: 0 2vw !important; }
        .marks-table th, .marks-table td { font-size: 12px !important; padding: 6px !important; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // --- Export / Print helpers ---
  const buildTableRows = () => {
    const headers = ["Student", ...assessmentList.map(a => `${a.name} (${a.max})`), "Total", "Grade"];
    const rows = [headers];
    Object.entries(studentMarks).forEach(([sid, marks]) => {
      const student = students.find((s) => s.id === sid) || { name: sid };
      const scores = Object.values(marks).map((m) => (m.score != null ? m.score : ""));
      const total = Object.values(marks).reduce((s, a) => s + (a.score || 0), 0);
      const grade =
        total >= 90
          ? "A"
          : total >= 80
          ? "B"
          : total >= 70
          ? "C"
          : total >= 60
          ? "D"
          : "F";
      rows.push([student.name, ...scores, total, grade]);
    });
    return rows;
  };

  const downloadCSV = (filename = "marks.csv") => {
    const rows = buildTableRows();
    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            if (cell == null) return "";
            const cellStr = String(cell);
            return cellStr.includes(",") || cellStr.includes("\n") ? `"${cellStr.replace(/"/g, '""')}"` : cellStr;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadExcel = (filename = "marks.xls") => {
    // Build a richer Excel layout similar to the provided marklist screenshot
    const course = courses.find((c) => c.id === selectedCourseId) || {};
    // No per-semester active index state in this component yet — default to q1
    const activeQuarterIdx = 0;
    // Determine assessment metadata and order
    let assList = assessmentList && assessmentList.length ? assessmentList : [];
    const assessmentKeys = assList.length ? assList.map((_, i) => `a${i + 1}`) : [];
    const headers = ["No", "Name", "Gender", "Age"];
    // include father column if any student has it
    const includeFather = students.some((s) => s.father || s.fatherName || s.parentName);
    if (includeFather) headers.push("Father");
    headers.push(...assList.map((a) => `${a.name} (${a.max})`));
    headers.push("Total", "Percent");

    // collect filtered students in course
    const filteredStudents = students.filter((s) => s.grade === course.grade && s.section === course.section);

    const rows = [headers];
    filteredStudents.forEach((s, idx) => {
      const marks = studentMarks[s.id] || {};
      const scores = assessmentKeys.map((k) => Number(marks[k]?.score ?? 0));
      const maxes = assList.map((a) => Number(a.max || 0));
      const sumScores = scores.reduce((a, b) => a + b, 0);
      const sumMax = maxes.reduce((a, b) => a + b, 0) || 100;
      const percent = sumMax > 0 ? (sumScores / sumMax) * 100 : 0;
      const extra = includeFather ? [s.father || s.fatherName || s.parentName || ''] : [];
      const gender = s.gender || s.sex || '';
      const age = (() => {
        if (s.dob) {
          const d = new Date(s.dob);
          if (!isNaN(d)) return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
        }
        return s.age || '';
      })();
      const row = [idx + 1, s.name, gender, age, ...extra, ...scores, sumScores, `${percent.toFixed(1)}%`];
      rows.push(row);
    });

    // Build HTML with title and info rows
    const totalCols = headers.length;
    let html = `<table border="1" style="border-collapse:collapse;width:100%">`;
    const marklistTitle = `${course.subject || ''} Marklist`;
    html += `<tr><th colspan="${totalCols}" style="text-align:center;font-weight:700;font-size:18px;padding:8px">${marklistTitle}</th></tr>`;
    html += `<tr><td style="padding:6px;font-weight:600">${'Quarter ' + (activeQuarterIdx + 1)}</td><td colspan="${totalCols - 1}" style="padding:6px;text-align:left">Grade ${course.grade || ''} &nbsp;&nbsp; Subject ${course.subject || ''}</td></tr>`;
    html += `<tr><td colspan="${totalCols}" style="text-align:center;font-weight:600;padding:4px">Semester: ${activeSemester}</td></tr>`;
    html += '<tr>' + headers.map(h => `<th style="background:#f3f4f6;padding:8px">${String(h)}</th>`).join('') + '</tr>';
    rows.slice(1).forEach(r => { html += '<tr>' + r.map(c => `<td style="padding:6px">${String(c ?? '').replace(/</g, '&lt;')}</td>`).join('') + '</tr>'; });
    html += `<tr><td colspan="${totalCols}" style="padding-top:16px">&nbsp;</td></tr>`;
    html += `<tr><td colspan="${Math.ceil(totalCols/2)}">Teacher's Name: ____________________</td><td colspan="${Math.floor(totalCols/2)}">Director's Approval: ____________________</td></tr>`;
    html += `<tr><td colspan="${Math.ceil(totalCols/2)}">Signature: __________ Date: ________</td><td colspan="${Math.floor(totalCols/2)}">School Stamp: __________</td></tr>`;
    html += '</table>';

    const uri = 'data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent(html);
    const link = document.createElement('a');
    link.href = uri;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const wrapper = marksWrapperRef.current;
    if (!wrapper) return window.print();
    const html = `<!doctype html><html><head><title>Marks</title><meta charset="utf-8"><style>table{border-collapse:collapse;}td,th{padding:8px;border:1px solid #ccc;}</style></head><body>${wrapper.innerHTML}</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return alert("Pop-up blocked. Please allow popups to print.");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 200);
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
        "--surface-panel": "#ffffff",
        "--surface-accent": "#eff6ff",
        "--surface-muted": "#f8fafc",
        "--surface-strong": "#e2e8f0",
        "--page-bg": "#FFFFFF",
        "--border-soft": "#e2e8f0",
        "--border-strong": "#cbd5e1",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": "#2563eb",
        "--accent-soft": "#dbeafe",
        "--accent-strong": "#007AFB",
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
        "--shadow-soft": "0 10px 24px rgba(15, 23, 42, 0.08)",
        "--shadow-panel": "0 14px 30px rgba(15, 23, 42, 0.10)",
      }}
    >
      <div className="google-dashboard" style={{ display: "flex", gap: 0, padding: 0, height: "calc(100vh - 73px)", overflow: "hidden" }}>
        <Sidebar
          active="marks"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          teacher={teacher}
          handleLogout={handleLogout}
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

        {/* MAIN CONTENT */}
        <div
          className="google-main"
          style={{
            flex: 1,
            width: "100%",
            minWidth: 0,
            height: "100%",
            marginLeft: 0,
            padding: isMobile ? "0 8px" : "0 18px",
            overflowY: "auto",
            overflowX: "hidden",
            textAlign: "left",
            background: "#ffffff",
          }}
        >
          <div className="main-inner" style={{ padding: isMobile ? "10px 0 20px" : "20px 0", width: "100%", maxWidth: "100%", margin: 0 }}>
            <div className="section-header-card" style={{ marginBottom: 16, background: "#ffffff", border: "1px solid #dbeafe", boxShadow: "0 14px 30px rgba(37, 99, 235, 0.10)" }}>
              <h2 className="section-header-card__title" style={{ fontSize: 24 }}>Marks Entry Dashboard</h2>
              <div className="section-header-card__meta">
                <span>{activeSemester === "semester1" ? "Semester 1" : "Semester 2"}</span>
                <span
                  className="section-header-card__chip"
                  style={{
                    ...saveStatusStyle,
                    fontWeight: 800,
                  }}
                >
                  {saveStatusText}
                </span>
                <span className="section-header-card__chip">Teacher View</span>
              </div>
            </div>

            <div
              style={{
                marginBottom: "14px",
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "12px",
                background: "var(--surface-panel)",
                border: "1px solid var(--border-soft)",
                boxShadow: "var(--shadow-soft)",
                borderRadius: 14,
                padding: isMobile ? "12px" : "14px 16px",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  fontWeight: "600",
                  color: "var(--text-secondary)",
                  fontSize: "14px",
                }}
              >
                Select Course:
              </label>
              <select
                value={selectedCourseId}
                disabled={manualModeSwitchLocked}
                onChange={async (e) => {
                  const nextCourseId = e.target.value;
                  const didFlush = await prepareMarksContextSwitch();
                  if (!didFlush) return;
                  setSelectedCourseId(nextCourseId);
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: "12px",
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface-panel)",
                  minWidth: isMobile ? "100%" : "300px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "var(--text-primary)",
                  opacity: manualModeSwitchLocked ? 0.75 : 1,
                  cursor: manualModeSwitchLocked ? "not-allowed" : "pointer",
                }}
              >
                <option value="">-- Select Course --</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.subject} - Grade {c.grade} Section {c.section}
                  </option>
                ))}
              </select>

              <div
                style={{
                  marginLeft: isMobile ? 0 : "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  background: "#ffffff",
                  border: "1px solid #dbeafe",
                  borderRadius: 999,
                  padding: "6px 8px 6px 12px",
                }}
              >
                <span style={{ fontWeight: 800, color: "#334155", fontSize: 12, whiteSpace: "nowrap" }}>
                  Auto Save {autoSaveEnabled ? "On" : "Off"}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoSaveEnabled}
                  onClick={() => setAutoSaveEnabled((previousValue) => !previousValue)}
                  style={{
                    position: "relative",
                    width: 52,
                    height: 30,
                    borderRadius: 999,
                    border: autoSaveEnabled ? "1px solid #007AFB" : "1px solid #cbd5e1",
                    background: autoSaveEnabled ? "#007AFB" : "#e2e8f0",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 3,
                      left: autoSaveEnabled ? 25 : 3,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#ffffff",
                      boxShadow: "0 4px 10px rgba(15, 23, 42, 0.16)",
                      transition: "left 0.2s ease",
                    }}
                  />
                </button>
              </div>

              {manualModeSwitchLocked && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: "#fff7ed",
                    border: "1px solid #fdba74",
                    color: "#9a3412",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {manualModeSwitchMessage}
                </span>
              )}
            </div>
            {/* Semester Tabs */}
            {selectedCourseId && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-start",
                  gap: "10px",
                  marginBottom: "14px",
                  borderBottom: "1px solid var(--border-soft)",
                  paddingBottom: "8px",
                  overflowX: "auto",
                }}
              >
                {["semester1", "semester2"].map((sem) => {
                  const isActive = activeSemester === sem;
                  return (
                    <button
                      key={sem}
                      disabled={manualModeSwitchLocked}
                      onClick={async () => {
                        const didFlush = await prepareMarksContextSwitch();
                        if (!didFlush) return;
                        setActiveSemester(sem);
                        setStructureSubmitted(false);
                        setAssessmentList([]);
                        setStudentMarks({});
                      }}
                      style={{
                        background: isActive ? "var(--accent-soft)" : "var(--surface-panel)",
                        border: isActive ? "1px solid color-mix(in srgb, var(--accent-strong) 34%, white)" : "1px solid var(--border-soft)",
                        fontSize: "13px",
                        fontWeight: "700",
                        color: isActive ? "var(--accent-strong)" : "var(--text-muted)",
                        padding: "8px 12px",
                        borderRadius: 10,
                        whiteSpace: "nowrap",
                        opacity: manualModeSwitchLocked ? 0.65 : 1,
                        cursor: manualModeSwitchLocked ? "not-allowed" : "pointer",
                      }}
                    >
                      {sem === "semester1" ? "Semester 1" : "Semester 2"}
                    </button>
                  );
                })}
              </div>
            )}

    {selectedCourseId && (
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap", background: "var(--surface-panel)", border: "1px solid #dbeafe", borderRadius: 16, boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)", padding: isMobile ? "12px" : "12px 16px" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: 13 }}>
            {assessmentMode === "quarter" ? "Quarter:" : "Mode:"}
          </span>
          {(quartersBySem[activeSemester] || ['q1','q2']).map((q) => (
            <button
              key={q}
              disabled={manualModeSwitchLocked}
              onClick={async () => {
                const didFlush = await prepareMarksContextSwitch();
                if (!didFlush) return;
                setSelectedQuarter(q);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: selectedQuarter === q ? '1px solid color-mix(in srgb, var(--accent-strong) 34%, white)' : '1px solid var(--border-soft)',
                background: selectedQuarter === q ? 'var(--accent-soft)' : 'var(--surface-panel)',
                cursor: manualModeSwitchLocked ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                color: selectedQuarter === q ? 'var(--accent-strong)' : 'var(--text-muted)',
                opacity: manualModeSwitchLocked ? 0.65 : 1,
              }}
            >
              {assessmentMode === "semester" ? "SEM" : q.toUpperCase()}
            </button>
          ))}
          {/* Two quarters by default (q1, q2) - Add Quarter removed */}
        </div>
        {structureSubmitted ? (
          <>
            <div
              style={{
                fontSize: 12,
                color: autoSaveStatus === "error" ? "#b91c1c" : "#475569",
                fontWeight: autoSaveStatus === "error" ? 700 : 600,
              }}
            >
              {autoSaveStatus === "error"
                ? autoSaveError || "Auto-save failed. Use Save All to retry."
                : manualModeSwitchLocked
                ? manualModeSwitchMessage
                : !autoSaveEnabled
                ? "Auto-save is off. Use Save All to keep your updates."
                : hasUnsavedChanges
                ? `Changes save automatically after ${AUTO_SAVE_DELAY_MS / 1000} seconds.`
                : lastAutoSavedAt
                ? `Last saved at ${formatAutoSaveTime(lastAutoSavedAt)}.`
                : "Changes save automatically as you type."}
            </div>
            <button
              onClick={() => downloadExcel()}
              style={{
                padding: "10px 16px",
                background: "var(--accent-strong)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                boxShadow: "0 12px 22px rgba(29, 78, 216, 0.26)"
              }}
              title="Download as Excel"
            >
              <FaFileExcel /> Download Excel
            </button>
            <button
              onClick={() => saveAllMarks()}
              disabled={!structureSubmitted || !assessmentList.length || (assessmentMode === "quarter" && selectedQuarter === 'avg')}
              style={{
                padding: "10px 16px",
                background: !structureSubmitted || !assessmentList.length || (assessmentMode === "quarter" && selectedQuarter === 'avg') ? "var(--surface-strong)" : "var(--accent-strong)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: !structureSubmitted || !assessmentList.length || (assessmentMode === "quarter" && selectedQuarter === 'avg') ? "not-allowed" : "pointer",
                boxShadow: !structureSubmitted || !assessmentList.length || (assessmentMode === "quarter" && selectedQuarter === 'avg') ? "none" : "0 12px 22px rgba(29, 78, 216, 0.26)"
              }}
              title="Save all marks for current quarter"
            >
              <FaSave /> Save All
            </button>
          </>
        ) : null}
      </div>
    )}

            {/* Template Required Notice */}
            {selectedCourseId && noStudentsInCourse && (
              <div
                style={{
                  background: "var(--surface-panel)",
                  padding: isMobile ? "14px" : "20px",
                  borderRadius: "14px",
                  border: "1px solid var(--border-soft)",
                  boxShadow: "var(--shadow-soft)",
                  marginBottom: "18px",
                }}
              >
                <h3 style={{ marginBottom: "10px", color: "var(--text-primary)", fontWeight: "700", fontSize: "18px" }}>
                  No Students Found
                </h3>
                <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  No students are assigned to this course/class yet. Ask admin to enroll students for this grade and section.
                </p>
              </div>
            )}

            {selectedCourseId && !noStudentsInCourse && !structureSubmitted && (
              <div
                style={{
                  background: "var(--surface-panel)",
                  padding: isMobile ? "14px" : "20px",
                  borderRadius: "14px",
                  border: "1px solid var(--border-soft)",
                  boxShadow: "var(--shadow-soft)",
                  marginBottom: "18px",
                }}
              >
                <h3 style={{ marginBottom: "16px", color: "var(--text-primary)", fontWeight: "700", fontSize: "18px" }}>
                  Assessment Template Not Found
                </h3>
                <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Admin has not created an assessment template for this course and semester/quarter yet.
                  Teachers can only enter marks based on admin-created templates.
                </p>
              </div>
            )}

            {structureSubmitted && (
              <div
                className="marks-table-wrapper"
                ref={marksWrapperRef}
                style={{
                  position: "relative",
                  overflowX: "auto",
                  overflowY: "visible",
                  minHeight: 120,
                  width: "100%",
                  maxWidth: "100%",
                  paddingBottom: 32,
                  whiteSpace: "normal",
                  background: "var(--surface-panel)",
                  borderRadius: 16,
                  border: "1px solid #dbeafe",
                  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.10)",
                  marginBottom: 20,
                  padding: isMobile ? 10 : 14
                }}
              >
                  
 
    
                <table
                  className="marks-table"
                  style={{
                    borderCollapse: "collapse",
                    borderSpacing: 0,
                    fontSize: "14px",
                    minWidth: 0,
                    width: "100%",
                    maxWidth: "100%",
                    tableLayout: "fixed",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "linear-gradient(135deg, var(--accent-strong), var(--accent))",
                        color: "#fff",
                        borderRadius: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.6px",
                        fontWeight: "700",
                        fontSize: "12px",
                      }}
                    >
                      <th
                        style={{
                          padding: "12px 8px",
                          textAlign: "center",
                          background: "rgba(255,255,255,0.05)",
                          width: 48,
                          minWidth: 48,
                          maxWidth: 48,
                          whiteSpace: 'nowrap',
                          borderRadius: "16px 0 0 16px",
                          verticalAlign: "middle",
                        }}
                      >
                        No
                      </th>
                      <th
                        style={{
                          padding: "16px 20px",
                          textAlign: "left",
                          background: "rgba(255,255,255,0.1)",
                          width: 240,
                          minWidth: 240,
                          verticalAlign: "middle",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <FaUsers /> Student
                        </span>
                      </th>
                      {assessmentList.map((a, i) => (
                        <th
                          key={i}
                          style={{
                            padding: "16px 18px",
                            background: "rgba(255,255,255,0.05)",
                            textAlign: "center",
                            transition: "0.3s all",
                            verticalAlign: "middle",
                          }}
                        >
                          {a.name} ({a.max})
                        </th>
                      ))}
                      <th
                        style={{
                          padding: "16px 18px",
                          background: "rgba(255,255,255,0.05)",
                          textAlign: "center",
                          verticalAlign: "middle",
                          borderRadius: " 0 16px 16px 0",
                        }}
                      >
                        Total
                      </th>
                      
                      
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(Object.entries(studentMarks)).map(([sid, marks], idx) => {
                      const total = Object.values(marks).reduce((s, a) => s + (a.score || 0), 0);
                      const student = students.find((s) => s.id === sid);
                      return (
                        <tr
                          key={sid}
                          style={{
                            background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                            borderRadius: "12px",
                            marginBottom: "10px",
                            transition: "0.3s all",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#e0e7ff")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "#ffffff" : "#f8fafc")}
                        >
                          <td style={{ padding: "8px 6px", textAlign: 'center', fontWeight: 700, width: 48, minWidth: 48, maxWidth: 48, whiteSpace: 'nowrap', verticalAlign: "middle" }}>{idx + 1}</td>
                          <td
                            style={{
                              padding: "12px",
                              textAlign: "left",
                              width: 240,
                              minWidth: 240,
                              fontWeight: "600",
                              verticalAlign: "middle",
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{formatStudentName(student?.name)}</span>
                          </td>
                          {Object.entries(marks).map(([k, a]) => (
                            <td key={k} style={{ padding: "12px", textAlign: 'center', verticalAlign: "middle" }}>
                              {selectedQuarter === 'avg' ? (
                                <div style={{ fontWeight: 700 }}>{a.score}</div>
                              ) : (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="\d*"
                                  min="0"
                                  max={999}
                                  value={
                                    a.score === "" || a.score === null || a.score === undefined || a.score === 0
                                      ? ""
                                      : a.score
                                  }
                                  placeholder="-"
                                  onChange={(e) => {
                                    let v = String(e.target.value || "").replace(/[^0-9]/g, "");
                                    if (v && v.length > 3) v = v.slice(0, 3);
                                    updateScore(sid, k, v, a?.max);
                                  }}
                                  onKeyDown={(e) => {
                                    const allowed = ['Backspace','ArrowLeft','ArrowRight','Delete','Tab','Enter'];
                                    if (allowed.includes(e.key)) return;
                                    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                                  }}
                                  onWheel={(e) => { e.preventDefault(); e.stopPropagation(); try{ e.currentTarget.blur(); }catch(_){} }}
                                  style={{
                                    width: "66px",
                                    padding: "8px 10px",
                                    borderRadius: "8px",
                                    border: cellErrors?.[sid]?.[k] ? "1px solid #ef4444" : "1px solid var(--border-strong)",
                                    textAlign: "center",
                                    background: "var(--surface-panel)",
                                    fontWeight: "500",
                                  }}
                                />
                              )}
                              {selectedQuarter !== 'avg' ? (
                                <div style={{ marginTop: 4, fontSize: 10, color: cellErrors?.[sid]?.[k] ? "#dc2626" : "#64748b" }}>
                                  {cellErrors?.[sid]?.[k] || `max ${a?.max ?? 0}`}
                                </div>
                              ) : null}
                            </td>
                          ))}
                          <td style={{ padding: "12px", fontWeight: "600", textAlign: "center", verticalAlign: "middle" }}>{total}</td>
                          
                        </tr>
                      );
                    })}
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