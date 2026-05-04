import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../styles/global.css";
import { getTeacherCourseContext } from "../api/teacherApi";
import { getRtdbRoot, RTDB_BASE_RAW } from "../api/rtdbScope";
import { resolveProfileImage } from "../utils/profileImage";

const normalizeTeacherRef = (value) => String(value || "").trim().replace(/^-+/, "").toUpperCase();

const toEpochSeconds = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed > 1e12 ? Math.floor(parsed / 1000) : Math.floor(parsed);
};

const parseDateValue = (value) => {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    const numericValue = value > 1e12 ? value : value * 1000;
    const numericDate = new Date(numericValue);
    return Number.isNaN(numericDate.getTime()) ? null : numericDate;
  }

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) {
    const numericValue = asNumber > 1e12 ? asNumber : asNumber * 1000;
    const numericDate = new Date(numericValue);
    if (!Number.isNaN(numericDate.getTime())) return numericDate;
  }

  const parsedDate = new Date(trimmed);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const toDateInput = (value) => {
  if (!value) return "";
  const parsed = parseDateValue(value);
  if (!parsed) return "";
  return parsed.toISOString().slice(0, 10);
};

const getTodayDateInput = () => new Date().toISOString().slice(0, 10);

const formatDate = (value) => {
  if (!value) return "No date";
  const parsed = parseDateValue(value);
  if (!parsed) return "No date";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const createAssessmentId = (courseId) => {
  const stamp = Date.now();
  const coursePart = String(courseId || "course")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `assess_${coursePart}_${stamp}`;
};

const buildQuestionRefsFromIds = (questionIds) => {
  return (questionIds || []).reduce((acc, questionId, index) => {
    const normalizedId = String(questionId || "").trim();
    if (normalizedId) acc[`q${index + 1}`] = normalizedId;
    return acc;
  }, {});
};

const normalizeNodeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const resolveGradeKey = (gradeValue) => {
  const digits = String(gradeValue || "").match(/\d+/)?.[0];
  if (!digits) return "grade_general";
  return `grade${digits}`;
};

const resolveQuestionBucket = (questionType) => {
  const normalizedType = String(questionType || "written").trim().toLowerCase();
  if (["written", "mcq", "true_false", "fill_blank"].includes(normalizedType)) return normalizedType;
  return "written";
};

const QUESTION_BANK_READ_BUCKETS = ["mcq", "true_false", "fill_blank", "written", "grammar", "writing"];

const buildQuestionHashKey = (prompt, questionType) => {
  return normalizeNodeKey(`${prompt}_${questionType}`);
};

const createQuestionBankId = () => `qb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const createEmptyQuestion = () => ({
  prompt: "",
  type: "written",
  points: 1,
  correctAnswer: "",
  options: {
    A: "",
    B: "",
    C: "",
    D: "",
  },
});

const normalizeQuestionForEdit = (item) => {
  const prompt = String(item?.question || item?.prompt || "").trim();
  const type = String(item?.type || "written").trim() || "written";
  const points = Math.max(1, Number(item?.points || 1));
  const correctAnswer = String(item?.correctAnswer || "").trim();
  const options = {
    A: String(item?.options?.A || "").trim(),
    B: String(item?.options?.B || "").trim(),
    C: String(item?.options?.C || "").trim(),
    D: String(item?.options?.D || "").trim(),
  };

  return {
    prompt,
    type,
    points,
    correctAnswer,
    options,
  };
};

const createInitialFormState = () => ({
  title: "",
  type: "",
  dueDate: getTodayDateInput(),
  totalPoints: "",
  passPercent: "",
  timeLimitMinutes: "",
});

function TeacherExam() {
  const [teacher, setTeacher] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth > 600 : true
  );
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [examRecords, setExamRecords] = useState([]);
  const [teacherContext, setTeacherContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [expandedSubmissionsFor, setExpandedSubmissionsFor] = useState("");
  const [expandedQuestionsFor, setExpandedQuestionsFor] = useState("");
  const [questionPreviewByAssessment, setQuestionPreviewByAssessment] = useState({});
  const [questionPreviewErrorByAssessment, setQuestionPreviewErrorByAssessment] = useState({});
  const [loadingQuestionsFor, setLoadingQuestionsFor] = useState("");
  const [activeSection, setActiveSection] = useState("create");
  const [evaluationByExam, setEvaluationByExam] = useState({});
  const [loadingEvaluationExamId, setLoadingEvaluationExamId] = useState("");
  const [evaluationMarks, setEvaluationMarks] = useState({});
  const [savingEvaluationKey, setSavingEvaluationKey] = useState("");
  const [selectedExamDetailId, setSelectedExamDetailId] = useState("");
  const [detailPopupFilter, setDetailPopupFilter] = useState("overview");
  const [selectedSubmissionStudentId, setSelectedSubmissionStudentId] = useState("");
  const [showEditQuestionPopup, setShowEditQuestionPopup] = useState(false);
  const [showDeleteAssessmentPopup, setShowDeleteAssessmentPopup] = useState(false);
  const [deleteAssessmentTarget, setDeleteAssessmentTarget] = useState(null);
  const [deleteUsernameInput, setDeleteUsernameInput] = useState("");
  const [deletePasswordInput, setDeletePasswordInput] = useState("");
  const [deletePopupMessage, setDeletePopupMessage] = useState("");
  const deletePopupCardRef = useRef(null);
  const previousFocusedElementRef = useRef(null);
  const [studentNameById, setStudentNameById] = useState({});
  const [studentProfileById, setStudentProfileById] = useState({});
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(createInitialFormState);
  const [customQuestions, setCustomQuestions] = useState([createEmptyQuestion()]);
  const [createQuestionsCollapsed, setCreateQuestionsCollapsed] = useState(true);
  const [editQuestionsCollapsed, setEditQuestionsCollapsed] = useState(true);
  const [questionItemCollapsedByIndex, setQuestionItemCollapsedByIndex] = useState({ 0: true });
  const [showQuestionBankPicker, setShowQuestionBankPicker] = useState(false);
  const [questionBankLoading, setQuestionBankLoading] = useState(false);
  const [questionBankError, setQuestionBankError] = useState("");
  const [questionBankSearch, setQuestionBankSearch] = useState("");
  const [questionBankTypeFilter, setQuestionBankTypeFilter] = useState("all");
  const [questionBankItems, setQuestionBankItems] = useState([]);
  const [RTDB_BASE, setRTDB_BASE] = useState(() => getRtdbRoot());
  const [schoolBaseResolved, setSchoolBaseResolved] = useState(false);

  const navigate = useNavigate();
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 600;

  const resolveStudentNamesByIds = useCallback(
    async (studentIds) => {
      const normalizedIds = [...new Set((studentIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
      if (!normalizedIds.length) return {};

      const [studentsRes, usersRes] = await Promise.all([
        axios.get(`${RTDB_BASE}/Students.json`).catch(() => ({ data: {} })),
        axios.get(`${RTDB_BASE}/Users.json`).catch(() => ({ data: {} })),
      ]);

      const studentsMap = studentsRes.data || {};
      const usersMap = usersRes.data || {};

      const getUserRecordById = (userId) => {
        const normalizedUserId = String(userId || "").trim();
        if (!normalizedUserId) return null;
        if (usersMap?.[normalizedUserId]) return usersMap[normalizedUserId];
        const found = Object.values(usersMap).find(
          (userRecord) => String(userRecord?.userId || "").trim() === normalizedUserId
        );
        return found || null;
      };

      const getDisplayNameFromRecord = (record) => {
        if (!record || typeof record !== "object") return "";
        const directName =
          record.name ||
          record.fullName ||
          record.studentName ||
          record.displayName ||
          [record.firstName, record.lastName].filter(Boolean).join(" ");
        return String(directName || "").trim();
      };

      const resolvedMap = {};
      const resolvedProfileMap = {};

      normalizedIds.forEach((studentId) => {
        let studentRecord = studentsMap?.[studentId] || null;

        if (!studentRecord) {
          const foundEntry = Object.entries(studentsMap).find(([studentKey, item]) => {
            return (
              String(studentKey || "").trim() === studentId ||
              String(item?.studentId || "").trim() === studentId ||
              String(item?.userId || "").trim() === studentId
            );
          });
          studentRecord = foundEntry?.[1] || null;
        }

        const studentName = getDisplayNameFromRecord(studentRecord);
        const userRecord = getUserRecordById(studentRecord?.userId || studentId);
        const userName = getDisplayNameFromRecord(userRecord);
        const resolvedName = studentName || userName;
        const resolvedProfileImage = resolveProfileImage(
          studentRecord?.profileImage,
          studentRecord?.profile,
          studentRecord?.avatar,
          userRecord?.profileImage,
          userRecord?.profile,
          userRecord?.avatar
        );

        if (resolvedName) {
          resolvedMap[studentId] = resolvedName;
        }
        resolvedProfileMap[studentId] = resolvedProfileImage;
      });

      if (Object.keys(resolvedMap).length) {
        setStudentNameById((previous) => ({ ...previous, ...resolvedMap }));
      }

      if (Object.keys(resolvedProfileMap).length) {
        setStudentProfileById((previous) => ({ ...previous, ...resolvedProfileMap }));
      }

      return resolvedMap;
    },
    [RTDB_BASE]
  );

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
        setRTDB_BASE(getRtdbRoot());
        setSchoolBaseResolved(true);
        return;
      }

      if (rawSchoolCode.startsWith("ET-")) {
        setRTDB_BASE(`${RTDB_BASE_RAW}/Platform1/Schools/${rawSchoolCode}`);
        setSchoolBaseResolved(true);
        return;
      }

      try {
        const shortCode = rawSchoolCode.toUpperCase();
        const mapRes = await axios.get(`${RTDB_BASE_RAW}/Platform1/schoolCodeIndex/${shortCode}.json`);
        const mappedCode = String(mapRes?.data || "").trim();
        if (mappedCode) {
          setRTDB_BASE(`${RTDB_BASE_RAW}/Platform1/Schools/${mappedCode}`);
          setSchoolBaseResolved(true);
          return;
        }
      } catch {
        // Fallback scan below handles missing code-index entries.
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
          setRTDB_BASE(`${RTDB_BASE_RAW}/Platform1/Schools/${fallbackMatch[0]}`);
          setSchoolBaseResolved(true);
          return;
        }
      } catch {
        // Keep last fallback below.
      }

      setRTDB_BASE(`${RTDB_BASE_RAW}/Platform1/Schools/${rawSchoolCode}`);
      setSchoolBaseResolved(true);
    };

    resolveSchoolBase();
  }, [teacher]);

  const loadWorkspace = useCallback(async () => {
    if (!teacher || !schoolBaseResolved || !RTDB_BASE) return;
    setLoading(true);
    setError("");

    try {
      const context = await getTeacherCourseContext({ teacher, rtdbBase: RTDB_BASE });
      let resolvedCourses = context.courses || [];

      if (!resolvedCourses.length) {
        const [coursesRes, classMarksRes, courseStatsRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/Courses.json`).catch(() => ({ data: {} })),
          axios.get(`${RTDB_BASE}/ClassMarks.json`).catch(() => ({ data: {} })),
          axios.get(`${RTDB_BASE}/SchoolExams/CourseStats.json`).catch(() => ({ data: {} })),
        ]);

        const coursesMap = coursesRes.data || {};
        const classMarks = classMarksRes.data || {};
        const courseStats = courseStatsRes.data || {};

        const fallbackCourseIds = new Set([
          ...Object.keys(coursesMap),
          ...Object.keys(classMarks),
          ...Object.keys(courseStats),
        ]);

        resolvedCourses = Array.from(fallbackCourseIds)
          .filter(Boolean)
          .map((courseId) => {
            const stored = coursesMap?.[courseId] || {};
            return {
              id: String(courseId || "").trim(),
              subject: String(stored.subject || stored.name || courseId || "").trim(),
              name: String(stored.name || stored.subject || courseId || "").trim(),
              grade: String(stored.grade || "").trim(),
              section: String(stored.section || stored.secation || "").trim().toUpperCase(),
            };
          });
      }

      const teacherRefs = new Set(
        [
          teacher?.teacherId,
          teacher?.teacherKey,
          teacher?.userId,
          context.teacherKey,
          context.teacherRecord?.teacherId,
          context.teacherRecord?.userId,
        ]
          .filter(Boolean)
          .map(normalizeTeacherRef)
      );

      const [assessmentsRes, submissionsRes] = await Promise.all([
        axios.get(`${RTDB_BASE}/SchoolExams/Assessments.json`).catch(() => ({ data: {} })),
        axios.get(`${RTDB_BASE}/SchoolExams/SubmissionIndex.json`).catch(() => ({ data: {} })),
      ]);

      const assessments = assessmentsRes.data || {};
      const submissionIndex = submissionsRes.data || {};
      const courseIdSet = new Set(resolvedCourses.map((course) => course.id));

      const records = Object.entries(assessments)
        .map(([assessmentId, assessment]) => {
          const courseId = String(assessment?.courseId || "").trim();
          const assessmentTeacherId = normalizeTeacherRef(assessment?.teacherId);
          const submissions = submissionIndex?.[assessmentId] || {};
          const submissionEntries = Object.entries(submissions).map(([studentId, item]) => ({
            studentId,
            submittedAt: item?.submittedAt || item?.updatedAt || item?.createdAt || "",
            score: item?.score,
            percent: item?.percent,
            status: item?.status || "submitted",
          }));

          if (!courseId) return null;
          if (!courseIdSet.has(courseId) && !teacherRefs.has(assessmentTeacherId)) return null;

          const questionRefs = assessment?.questionRefs || {};
          const calculatedQuestionCount = Number(assessment?.questionCount || Object.keys(questionRefs).length || 0);

          return {
            id: assessmentId,
            raw: assessment,
            courseId,
            title: assessment?.title || "Untitled assessment",
            type: assessment?.type || "Exam",
            status: assessment?.status || "draft",
            published: assessment?.status === "active",
            totalPoints: Number(assessment?.totalPoints || 0),
            passPercent: Number(assessment?.passPercent || 0),
            timeLimitMinutes: Number(assessment?.timeLimitMinutes || 0),
            questionCount: calculatedQuestionCount,
            submissionCount: submissionEntries.length,
            submissionEntries,
            dueDate: assessment?.dueDate,
            createdAt: assessment?.createdAt,
            updatedAt: assessment?.updatedAt,
          };
        })
        .filter(Boolean)
        .sort((left, right) => {
          const leftTime = parseDateValue(left.updatedAt || left.createdAt)?.getTime() || 0;
          const rightTime = parseDateValue(right.updatedAt || right.createdAt)?.getTime() || 0;
          return rightTime - leftTime;
        });

      const submissionStudentIds = records
        .flatMap((record) => (record.submissionEntries || []).map((entry) => String(entry.studentId || "").trim()))
        .filter(Boolean);
      if (submissionStudentIds.length) {
        await resolveStudentNamesByIds(submissionStudentIds);
      }

      setTeacherContext(context);
      setCourses(resolvedCourses);
      setSelectedCourseId((previous) => {
        if (previous && resolvedCourses.some((course) => course.id === previous)) return previous;
        return resolvedCourses[0]?.id || "";
      });
      setExamRecords(records);
    } catch {
      setError("Unable to load SchoolExams right now.");
      setCourses([]);
      setExamRecords([]);
    } finally {
      setLoading(false);
    }
  }, [teacher, schoolBaseResolved, RTDB_BASE, resolveStudentNamesByIds]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  const loadQuestionBankForSelectedCourse = useCallback(async () => {
    const gradeKey = resolveGradeKey(selectedCourse?.grade);
    const subjectKey = normalizeNodeKey(selectedCourse?.subject || selectedCourse?.name || "general");

    setQuestionBankLoading(true);
    setQuestionBankError("");

    try {
      const bucketResponses = await Promise.all(
        QUESTION_BANK_READ_BUCKETS.map((bucket) =>
          axios
            .get(`${RTDB_BASE}/SchoolExams/QuestionBank/${gradeKey}/${subjectKey}/${bucket}.json`)
            .catch(() => ({ data: {} }))
            .then((response) => ({ bucket, data: response.data || {} }))
        )
      );

      const merged = {};
      bucketResponses.forEach(({ bucket, data }) => {
        Object.entries(data || {}).forEach(([questionId, rawQuestion]) => {
          if (!questionId || !rawQuestion) return;
          const normalized = normalizeQuestionForEdit(rawQuestion);
          if (!normalized.prompt) return;
          merged[String(questionId).trim()] = {
            ...normalized,
            questionId: String(questionId).trim(),
            sourceBucket: bucket,
            usageCount: Math.max(0, Number(rawQuestion?.usageCount || 0)),
            createdAt: Number(rawQuestion?.createdAt || 0),
          };
        });
      });

      const sorted = Object.values(merged).sort((left, right) => {
        const usageDelta = Number(right.usageCount || 0) - Number(left.usageCount || 0);
        if (usageDelta !== 0) return usageDelta;
        return Number(right.createdAt || 0) - Number(left.createdAt || 0);
      });

      setQuestionBankItems(sorted);
      if (!sorted.length) setQuestionBankError("No question bank items found for this course yet.");
    } catch {
      setQuestionBankItems([]);
      setQuestionBankError("Failed to load question bank.");
    } finally {
      setQuestionBankLoading(false);
    }
  }, [RTDB_BASE, selectedCourse?.grade, selectedCourse?.subject, selectedCourse?.name]);

  const questionBankVisibleItems = useMemo(() => {
    const normalizedSearch = String(questionBankSearch || "").trim().toLowerCase();
    return questionBankItems.filter((item) => {
      const typeMatch = questionBankTypeFilter === "all" || String(item?.type || "").trim() === questionBankTypeFilter;
      if (!typeMatch) return false;
      if (!normalizedSearch) return true;
      const searchable = `${item.prompt || ""} ${item.correctAnswer || ""}`.toLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [questionBankItems, questionBankSearch, questionBankTypeFilter]);

  const handleAddQuestionFromBank = useCallback((bankItem) => {
    const normalized = normalizeQuestionForEdit(bankItem);
    if (!normalized.prompt) return;

    const candidateHash = buildQuestionHashKey(normalized.prompt, normalized.type);
    const hasDuplicate = customQuestions.some((item) => {
      const existing = normalizeQuestionForEdit(item);
      if (!existing.prompt) return false;
      return buildQuestionHashKey(existing.prompt, existing.type) === candidateHash;
    });

    if (hasDuplicate) {
      setActionMessage("This question is already in the assessment.");
      return;
    }

    setCustomQuestions((previous) => {
      const nextIndex = previous.length;
      setQuestionItemCollapsedByIndex((collapsedPrevious) => ({
        ...collapsedPrevious,
        [nextIndex]: true,
      }));
      return [...previous, normalized];
    });
    setCreateQuestionsCollapsed(false);
    setActionMessage("Question added from Question Bank.");
  }, [customQuestions]);

  useEffect(() => {
    setShowQuestionBankPicker(false);
    setQuestionBankSearch("");
    setQuestionBankTypeFilter("all");
    setQuestionBankItems([]);
    setQuestionBankError("");
  }, [selectedCourseId]);

  useEffect(() => {
    if (!showQuestionBankPicker) return;
    loadQuestionBankForSelectedCourse();
  }, [showQuestionBankPicker, loadQuestionBankForSelectedCourse]);

  const filteredExamRecords = useMemo(() => {
    if (!selectedCourseId) return examRecords;
    return examRecords.filter((record) => record.courseId === selectedCourseId);
  }, [examRecords, selectedCourseId]);

  const summary = useMemo(() => {
    const publishedCount = filteredExamRecords.filter((record) => record.published).length;
    const draftCount = filteredExamRecords.length - publishedCount;
    const submissions = filteredExamRecords.reduce((sum, record) => sum + Number(record.submissionCount || 0), 0);

    return {
      total: filteredExamRecords.length,
      published: publishedCount,
      draft: draftCount,
      submissions,
    };
  }, [filteredExamRecords]);

  const sectionFilteredRecords = useMemo(() => {
    if (activeSection === "draft") {
      return filteredExamRecords.filter((record) => String(record.status || "").toLowerCase() === "draft");
    }
    if (activeSection === "removed") {
      return filteredExamRecords.filter((record) => String(record.status || "").toLowerCase() === "removed");
    }
    if (activeSection === "evaluate") {
      return filteredExamRecords.filter(
        (record) =>
          String(record.status || "").toLowerCase() !== "removed" && Number(record.submissionCount || 0) > 0
      );
    }
    return filteredExamRecords.filter((record) => String(record.status || "").toLowerCase() !== "removed");
  }, [filteredExamRecords, activeSection]);

  const assessmentFormValidationHint = useMemo(() => {
    if (!String(selectedCourseId || "").trim()) return "Select a course first.";
    if (!String(form.title || "").trim()) return "Exam title is required.";
    if (!String(form.type || "").trim()) return "Assessment type is required.";
    if (String(form.passPercent ?? "").trim() === "") return "Pass mark is required.";
    if (String(form.timeLimitMinutes ?? "").trim() === "") return "Time limit is required.";

    const passPercent = Number(form.passPercent);
    const timeLimitMinutes = Number(form.timeLimitMinutes);

    if (!Number.isFinite(passPercent) || passPercent < 0 || passPercent > 100) return "Pass mark must be between 0 and 100.";
    if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes < 1) return "Time limit must be at least 1 minute.";

    return "";
  }, [selectedCourseId, form.title, form.type, form.passPercent, form.timeLimitMinutes]);

  const isAssessmentFormComplete = !assessmentFormValidationHint;

  const getStudentDisplayName = useCallback(
    (studentId) => {
      const normalizedId = String(studentId || "").trim();
      return studentNameById[normalizedId] || normalizedId;
    },
    [studentNameById]
  );

  const getStudentProfileImage = useCallback(
    (studentId) => {
      const normalizedId = String(studentId || "").trim();
      return resolveProfileImage(studentProfileById[normalizedId]);
    },
    [studentProfileById]
  );

  const sectionFilterChipStyle = (active) => ({
    padding: "6px 12px",
    borderRadius: "999px",
    background: active ? "var(--accent)" : "var(--accent-soft)",
    color: active ? "#fff" : "var(--accent)",
    cursor: "pointer",
    border: active ? "1px solid var(--accent)" : "1px solid var(--border-strong)",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    transition: "all 0.2s ease",
  });

  const leaderboardRows = useMemo(() => {
    const aggregate = {};
    filteredExamRecords
      .filter((record) => String(record.status || "").toLowerCase() !== "removed")
      .forEach((record) => {
        (record.submissionEntries || []).forEach((entry) => {
          const studentId = String(entry.studentId || "").trim();
          if (!studentId) return;
          if (!aggregate[studentId]) {
            aggregate[studentId] = {
              studentId,
              attempts: 0,
              totalPercent: 0,
              bestPercent: 0,
            };
          }
          const percentValue = Number(entry.percent ?? 0) || 0;
          aggregate[studentId].attempts += 1;
          aggregate[studentId].totalPercent += percentValue;
          aggregate[studentId].bestPercent = Math.max(aggregate[studentId].bestPercent, percentValue);
        });
      });

    return Object.values(aggregate)
      .map((item) => ({
        ...item,
        averagePercent: item.attempts ? Math.round((item.totalPercent / item.attempts) * 10) / 10 : 0,
      }))
      .sort((left, right) => right.averagePercent - left.averagePercent);
  }, [filteredExamRecords]);

  const selectedExamDetail = useMemo(() => {
    if (!selectedExamDetailId) return null;
    return examRecords.find((record) => record.id === selectedExamDetailId) || null;
  }, [examRecords, selectedExamDetailId]);

  const examOverviewAnalytics = useMemo(() => {
    if (!selectedExamDetail) {
      return {
        hasData: false,
        averagePercent: 0,
        highestPercent: 0,
        lowestPercent: 0,
        passRate: 0,
        passCount: 0,
        totalSubmissions: 0,
        chartRows: [],
      };
    }

    const totalPoints = Math.max(0, Number(selectedExamDetail.totalPoints || 0));
    const passPercent = Math.min(100, Math.max(0, Number(selectedExamDetail.passPercent || 0)));

    const scoredRows = (selectedExamDetail.submissionEntries || [])
      .map((entry) => {
        const rawPercent = Number(entry?.percent);
        const rawScore = Number(entry?.score);
        const derivedPercent = totalPoints > 0 && Number.isFinite(rawScore) ? (rawScore / totalPoints) * 100 : 0;
        const percent = Math.min(100, Math.max(0, Number.isFinite(rawPercent) ? rawPercent : derivedPercent));
        const scoreLabel =
          Number.isFinite(rawScore) && totalPoints > 0
            ? `${Math.max(0, Math.round(rawScore * 10) / 10)}/${totalPoints}`
            : `${Math.round(percent)}%`;

        return {
          studentId: String(entry?.studentId || "").trim(),
          studentName: getStudentDisplayName(entry?.studentId),
          percent,
          scoreLabel,
        };
      })
      .filter((row) => row.studentId);

    if (!scoredRows.length) {
      return {
        hasData: false,
        averagePercent: 0,
        highestPercent: 0,
        lowestPercent: 0,
        passRate: 0,
        passCount: 0,
        totalSubmissions: 0,
        chartRows: [],
      };
    }

    const sortedRows = [...scoredRows].sort((left, right) => right.percent - left.percent);
    const totalPercent = sortedRows.reduce((sum, row) => sum + row.percent, 0);
    const averagePercent = Math.round((totalPercent / sortedRows.length) * 10) / 10;
    const highestPercent = Math.round(sortedRows[0].percent * 10) / 10;
    const lowestPercent = Math.round(sortedRows[sortedRows.length - 1].percent * 10) / 10;
    const passCount = sortedRows.filter((row) => row.percent >= passPercent).length;
    const passRate = sortedRows.length ? Math.round((passCount / sortedRows.length) * 1000) / 10 : 0;
    const chartRows = sortedRows.slice(0, 8);

    return {
      hasData: true,
      averagePercent,
      highestPercent,
      lowestPercent,
      passRate,
      passCount,
      totalSubmissions: sortedRows.length,
      chartRows,
    };
  }, [selectedExamDetail, getStudentDisplayName]);

  useEffect(() => {
    if (editingId) return;
    setCustomQuestions([createEmptyQuestion()]);
  }, [selectedCourseId, editingId]);

  useEffect(() => {
    if (editingId) return;
    setShowEditQuestionPopup(false);
  }, [editingId]);

  const resetForm = () => {
    setEditingId("");
    setForm(createInitialFormState());
    setCustomQuestions([createEmptyQuestion()]);
    setCreateQuestionsCollapsed(true);
    setEditQuestionsCollapsed(true);
    setQuestionItemCollapsedByIndex({ 0: true });
  };

  const upsertLocalExamRecord = (assessmentId, payload, existingRaw = null) => {
    const nextRecord = {
      id: assessmentId,
      raw: {
        ...(existingRaw || {}),
        ...payload,
      },
      courseId: payload.courseId,
      title: payload.title || "Untitled assessment",
      type: payload.type || "Exam",
      status: payload.status || "draft",
      published: String(payload.status || "").toLowerCase() === "active",
      totalPoints: Number(payload.totalPoints || 0),
      passPercent: Number(payload.passPercent || 0),
      timeLimitMinutes: Number(payload.timeLimitMinutes || 0),
      questionCount: Number(payload.questionCount || Object.keys(payload.questionRefs || {}).length || 0),
      submissionCount: 0,
      submissionEntries: [],
      dueDate: payload.dueDate,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    };

    setExamRecords((previous) => {
      const existing = previous.find((item) => item.id === assessmentId);
      const mergedRecord = existing
        ? {
            ...existing,
            ...nextRecord,
            submissionCount: existing.submissionCount,
            submissionEntries: existing.submissionEntries,
          }
        : nextRecord;

      const remaining = previous.filter((item) => item.id !== assessmentId);
      return [mergedRecord, ...remaining].sort((left, right) => {
        const leftTime = parseDateValue(left.updatedAt || left.createdAt)?.getTime() || 0;
        const rightTime = parseDateValue(right.updatedAt || right.createdAt)?.getTime() || 0;
        return rightTime - leftTime;
      });
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  const handleFormField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const openExamDetail = (recordId) => {
    setSelectedExamDetailId(recordId);
    setDetailPopupFilter("overview");
    setSelectedSubmissionStudentId("");
    setShowEditQuestionPopup(false);
  };

  const closeExamDetail = () => {
    setSelectedExamDetailId("");
    setDetailPopupFilter("overview");
    setSelectedSubmissionStudentId("");
    setShowEditQuestionPopup(false);
    setShowDeleteAssessmentPopup(false);
    setDeleteAssessmentTarget(null);
    setDeleteUsernameInput("");
    setDeletePasswordInput("");
    setDeletePopupMessage("");
    setExpandedQuestionsFor("");
    setExpandedSubmissionsFor("");
  };

  const loadQuestionsForRecord = async (record) => {
    if (!record?.id) return;

    const existing = questionPreviewByAssessment?.[record.id];
    if (Array.isArray(existing)) {
      setExpandedQuestionsFor(record.id);
      return;
    }

    setLoadingQuestionsFor(record.id);
    setQuestionPreviewErrorByAssessment((previous) => ({
      ...previous,
      [record.id]: "",
    }));

    try {
      const inlineQuestions = Object.values(record.raw?.questions || {})
        .map(normalizeQuestionForEdit)
        .filter((item) => item.prompt);

      if (inlineQuestions.length) {
        setQuestionPreviewByAssessment((previous) => ({
          ...previous,
          [record.id]: inlineQuestions,
        }));
        setExpandedQuestionsFor(record.id);
        return;
      }

      const schoolBankQuestions = await fetchSchoolExamQuestionsFromRefs(record);
      if (schoolBankQuestions.length) {
        setQuestionPreviewByAssessment((previous) => ({
          ...previous,
          [record.id]: schoolBankQuestions,
        }));
        setExpandedQuestionsFor(record.id);
        return;
      }

      setQuestionPreviewByAssessment((previous) => ({
        ...previous,
        [record.id]: [],
      }));
      setExpandedQuestionsFor(record.id);
      setQuestionPreviewErrorByAssessment((previous) => ({
        ...previous,
        [record.id]: "No questions found for this exam.",
      }));
    } catch {
      setQuestionPreviewByAssessment((previous) => ({
        ...previous,
        [record.id]: [],
      }));
      setExpandedQuestionsFor(record.id);
      setQuestionPreviewErrorByAssessment((previous) => ({
        ...previous,
        [record.id]: "Failed to fetch questions.",
      }));
    } finally {
      setLoadingQuestionsFor("");
    }
  };

  useEffect(() => {
    if (!selectedExamDetail) return;
    if (detailPopupFilter !== "questions") return;
    loadQuestionsForRecord(selectedExamDetail);
  }, [selectedExamDetail, detailPopupFilter]);

  useEffect(() => {
    if (!selectedExamDetail) return;
    if (detailPopupFilter !== "submissions") return;
    loadEvaluationForRecord(selectedExamDetail);
  }, [selectedExamDetail, detailPopupFilter]);

  const fetchSchoolExamQuestionsFromRefs = async (record) => {
    const refs = record?.raw?.questionRefs || {};
    const refEntries = Object.entries(refs || {});
    if (!refEntries.length) return [];

    const courseForRecord = courses.find((course) => course.id === record?.courseId) || null;
    const gradeKey = resolveGradeKey(courseForRecord?.grade || selectedCourse?.grade);
    const subjectKey = normalizeNodeKey(courseForRecord?.subject || courseForRecord?.name || selectedCourse?.subject || selectedCourse?.name || "general");

    try {
      const bucketResponses = await Promise.all(
        QUESTION_BANK_READ_BUCKETS.map((bucket) =>
          axios
            .get(`${RTDB_BASE}/SchoolExams/QuestionBank/${gradeKey}/${subjectKey}/${bucket}.json`)
            .catch(() => ({ data: {} }))
        )
      );

      const questionMap = bucketResponses.reduce((acc, response) => ({
        ...acc,
        ...(response.data || {}),
      }), {});

      return refEntries
        .sort((left, right) => {
          const leftOrder = Number(String(left[0] || "").replace(/[^0-9]/g, "")) || 0;
          const rightOrder = Number(String(right[0] || "").replace(/[^0-9]/g, "")) || 0;
          return leftOrder - rightOrder;
        })
        .map(([, questionId]) => normalizeQuestionForEdit(questionMap?.[String(questionId || "").trim()] || null))
        .filter((item) => item.prompt);
    } catch {
      return [];
    }
  };

  const fetchQuestionLookupForRecord = async (record) => {
    const lookup = {};

    const inlineQuestions = record?.raw?.questions || {};
    Object.entries(inlineQuestions).forEach(([questionId, questionItem]) => {
      const normalized = normalizeQuestionForEdit(questionItem);
      if (normalized.prompt) lookup[String(questionId || "").trim()] = normalized;
    });

    const courseForRecord = courses.find((course) => course.id === record?.courseId) || null;
    const gradeKey = resolveGradeKey(courseForRecord?.grade || selectedCourse?.grade);
    const subjectKey = normalizeNodeKey(
      courseForRecord?.subject || courseForRecord?.name || selectedCourse?.subject || selectedCourse?.name || "general"
    );

    const bucketResponses = await Promise.all(
      QUESTION_BANK_READ_BUCKETS.map((bucket) =>
        axios
          .get(`${RTDB_BASE}/SchoolExams/QuestionBank/${gradeKey}/${subjectKey}/${bucket}.json`)
          .catch(() => ({ data: {} }))
      )
    );

    Object.entries(
      bucketResponses.reduce((acc, response) => ({
        ...acc,
        ...(response.data || {}),
      }), {})
    ).forEach(
      ([questionId, questionItem]) => {
        const normalized = normalizeQuestionForEdit(questionItem);
        if (normalized.prompt) lookup[String(questionId || "").trim()] = normalized;
      }
    );

    return lookup;
  };

  const loadEvaluationForRecord = async (record) => {
    if (!record?.id) return;
    if (evaluationByExam[record.id]) return;

    setLoadingEvaluationExamId(record.id);
    try {
      const questionLookup = await fetchQuestionLookupForRecord(record);
      const submissionsRes = await axios
        .get(`${RTDB_BASE}/SchoolExams/AssessmentSubmissions/${record.id}.json`)
        .catch(() => ({ data: {} }));
      const submissionMap = submissionsRes.data || {};
      const resolvedStudentNames = await resolveStudentNamesByIds(Object.keys(submissionMap));

      const rows = Object.entries(submissionMap).map(([studentId, item]) => {
        const answers = item?.answers || {};
        const answerRows = Object.entries(answers).map(([questionId, answerItem]) => {
          const questionMeta = questionLookup[String(questionId || "").trim()] || {};
          const studentAnswer = String(
            answerItem?.value ?? answerItem?.textAnswer ?? answerItem?.answer ?? answerItem ?? ""
          ).trim();
          return {
            questionId,
            prompt: questionMeta.prompt || questionMeta.question || questionId,
            type: questionMeta.type || answerItem?.type || "written",
            correctAnswer: String(questionMeta.correctAnswer || "").trim(),
            studentAnswer,
            points: Math.max(1, Number(questionMeta.points || 1)),
          };
        });

        const totalPoints = answerRows.reduce((sum, answerRow) => sum + Number(answerRow.points || 0), 0);
        return {
          studentId,
          studentName:
            String(item?.studentName || item?.name || "").trim() ||
            resolvedStudentNames[String(studentId || "").trim()] ||
            "",
          submittedAt: item?.submittedAt || item?.updatedAt || item?.createdAt || "",
          answers: answerRows,
          totalPoints,
          currentScore: Number(item?.finalScore ?? item?.teacherScore ?? item?.score ?? 0) || 0,
        };
      });

      const nextMarks = {};
      rows.forEach((row) => {
        (row.answers || []).forEach((answerRow) => {
          const normalizedStudent = String(answerRow.studentAnswer || "").trim().toLowerCase();
          const normalizedCorrect = String(answerRow.correctAnswer || "").trim().toLowerCase();
          const autoMark = normalizedCorrect ? normalizedStudent === normalizedCorrect : null;
          nextMarks[`${record.id}__${row.studentId}__${answerRow.questionId}`] = autoMark;
        });
      });

      setEvaluationMarks((previous) => ({ ...nextMarks, ...previous }));
      setEvaluationByExam((previous) => ({
        ...previous,
        [record.id]: rows,
      }));
    } finally {
      setLoadingEvaluationExamId("");
    }
  };

  const handleMarkAnswer = (assessmentId, studentId, questionId, isCorrect) => {
    const key = `${assessmentId}__${studentId}__${questionId}`;
    setEvaluationMarks((previous) => ({
      ...previous,
      [key]: isCorrect,
    }));
  };

  const handleSaveEvaluation = async (record, studentRow) => {
    const saveKey = `${record.id}__${studentRow.studentId}`;
    setSavingEvaluationKey(saveKey);
    setActionMessage("");

    try {
      const marksPayload = {};
      let earnedScore = 0;
      let totalPoints = 0;

      (studentRow.answers || []).forEach((answerRow) => {
        const itemKey = `${record.id}__${studentRow.studentId}__${answerRow.questionId}`;
        const normalizedStudentAnswer = String(answerRow.studentAnswer || "").trim().toLowerCase();
        const normalizedCorrectAnswer = String(answerRow.correctAnswer || "").trim().toLowerCase();
        const hasSystemCorrectAnswer = Boolean(normalizedCorrectAnswer);
        const markValue = hasSystemCorrectAnswer
          ? normalizedStudentAnswer === normalizedCorrectAnswer
          : evaluationMarks[itemKey] === true;
        const maxPoints = Math.max(1, Number(answerRow.points || 1));
        totalPoints += maxPoints;
        if (markValue) earnedScore += maxPoints;
        marksPayload[answerRow.questionId] = {
          isCorrect: markValue,
          studentAnswer: answerRow.studentAnswer,
          correctAnswer: answerRow.correctAnswer,
          pointsAwarded: markValue ? maxPoints : 0,
          maxPoints,
        };
      });

      const percent = totalPoints ? Math.round((earnedScore / totalPoints) * 100) : 0;
      const nowEpochSeconds = Math.floor(Date.now() / 1000);
      const evaluatorId =
        teacherContext?.teacherRecord?.teacherId || teacherContext?.teacherKey || teacher?.teacherId || teacher?.userId || "";

      await axios.patch(`${RTDB_BASE}/SchoolExams/SubmissionReviews/${record.id}/${studentRow.studentId}.json`, {
        assessmentId: record.id,
        studentId: studentRow.studentId,
        reviewedAt: nowEpochSeconds,
        reviewedBy: String(evaluatorId || "").trim(),
        score: earnedScore,
        percent,
        marks: marksPayload,
      });

      await axios.patch(`${RTDB_BASE}/SchoolExams/SubmissionIndex/${record.id}/${studentRow.studentId}.json`, {
        score: earnedScore,
        percent,
        status: "reviewed",
        updatedAt: nowEpochSeconds,
      });

      await axios.patch(`${RTDB_BASE}/SchoolExams/AssessmentSubmissions/${record.id}/${studentRow.studentId}.json`, {
        teacherScore: earnedScore,
        finalScore: earnedScore,
        status: "reviewed",
        updatedAt: nowEpochSeconds,
      });

      setEvaluationByExam((previous) => ({
        ...previous,
        [record.id]: (previous[record.id] || []).map((row) =>
          row.studentId === studentRow.studentId ? { ...row, currentScore: earnedScore } : row
        ),
      }));

      setActionMessage(`Saved evaluation for ${studentRow.studentName || getStudentDisplayName(studentRow.studentId)}.`);
      await loadWorkspace();
    } catch {
      setActionMessage("Failed to save evaluation.");
    } finally {
      setSavingEvaluationKey("");
    }
  };

  const handleEditAssessment = async (record) => {
    setEditingId(record.id);
    setForm({
      title: record.title || "",
      type: record.type || "Exam",
      dueDate: toDateInput(record.dueDate) || getTodayDateInput(),
      totalPoints: Number(record.totalPoints || 0),
      passPercent: Number(record.passPercent || 0),
      timeLimitMinutes: Number(record.timeLimitMinutes || 0),
    });
    const savedQuestions = Object.values(record.raw?.questions || {})
      .map(normalizeQuestionForEdit)
      .filter((item) => item.prompt);

    if (savedQuestions.length) {
      setCustomQuestions(savedQuestions);
      setQuestionItemCollapsedByIndex(
        savedQuestions.reduce((acc, _, index) => {
          acc[index] = true;
          return acc;
        }, {})
      );
      setActionMessage("");
      return;
    }

    const fetchedSchoolExamQuestions = await fetchSchoolExamQuestionsFromRefs(record);
    if (fetchedSchoolExamQuestions.length) {
      setCustomQuestions(fetchedSchoolExamQuestions);
      setQuestionItemCollapsedByIndex(
        fetchedSchoolExamQuestions.reduce((acc, _, index) => {
          acc[index] = true;
          return acc;
        }, {})
      );
      setActionMessage("Questions fetched from SchoolExams QuestionBank.");
      return;
    }

    setCustomQuestions([createEmptyQuestion()]);
    setQuestionItemCollapsedByIndex({ 0: true });
    setActionMessage("");
  };

  const handleQuestionFieldChange = (index, field, value) => {
    setCustomQuestions((previous) =>
      previous.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    );
  };

  const handleQuestionOptionChange = (index, optionKey, value) => {
    setCustomQuestions((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              options: {
                ...(item.options || {}),
                [optionKey]: value,
              },
            }
          : item
      )
    );
  };

  const handleAddQuestionField = () => {
    setCustomQuestions((previous) => {
      const nextIndex = previous.length;
      setQuestionItemCollapsedByIndex((collapsedPrevious) => ({
        ...collapsedPrevious,
        [nextIndex]: true,
      }));
      return [...previous, createEmptyQuestion()];
    });
  };

  const toggleQuestionItemCollapse = (index) => {
    setQuestionItemCollapsedByIndex((previous) => ({
      ...previous,
      [index]: !previous[index],
    }));
  };

  const handleRemoveQuestionField = (index) => {
    setQuestionItemCollapsedByIndex((previous) => {
      const next = {};
      Object.entries(previous).forEach(([key, value]) => {
        const numericKey = Number(key);
        if (!Number.isFinite(numericKey)) return;
        if (numericKey < index) {
          next[numericKey] = value;
        } else if (numericKey > index) {
          next[numericKey - 1] = value;
        }
      });
      if (!Object.keys(next).length) next[0] = true;
      return next;
    });

    setCustomQuestions((previous) => {
      const next = previous.filter((_, itemIndex) => itemIndex !== index);
      return next.length ? next : [createEmptyQuestion()];
    });
  };

  const syncCourseStats = async (courseId) => {
    const normalizedCourseId = String(courseId || "").trim();
    if (!normalizedCourseId) return false;

    try {
      const [assessmentsRes, submissionsRes] = await Promise.all([
        axios.get(`${RTDB_BASE}/SchoolExams/Assessments.json`).catch(() => ({ data: {} })),
        axios.get(`${RTDB_BASE}/SchoolExams/SubmissionIndex.json`).catch(() => ({ data: {} })),
      ]);

      const allAssessments = assessmentsRes.data || {};
      const submissionIndex = submissionsRes.data || {};

      const assessmentsByCourse = Object.entries(allAssessments).filter(([, assessment]) => {
        return String(assessment?.courseId || "").trim() === normalizedCourseId;
      });

      const activeAssessments = assessmentsByCourse.filter(([, assessment]) => {
        return String(assessment?.status || "").trim().toLowerCase() === "active";
      }).length;

      const totalSubmissions = assessmentsByCourse.reduce((sum, [assessmentId]) => {
        return sum + Object.keys(submissionIndex?.[assessmentId] || {}).length;
      }, 0);

      await axios.put(`${RTDB_BASE}/SchoolExams/CourseStats/${normalizedCourseId}.json`, {
        courseId: normalizedCourseId,
        totalAssessments: assessmentsByCourse.length,
        activeAssessments,
        draftAssessments: Math.max(0, assessmentsByCourse.length - activeAssessments),
        totalSubmissions,
        updatedAt: new Date().toISOString(),
      });

      return true;
    } catch (statsError) {
      console.error("CourseStats sync failed:", statsError);
      return false;
    }
  };

  const handleSaveAssessment = async (event) => {
    event.preventDefault();
    if (!selectedCourseId) {
      setActionMessage("Select a course before creating an exam.");
      return;
    }
    if (!String(form.title || "").trim()) {
      setActionMessage("Exam title is required.");
      return;
    }
    if (!String(form.type || "").trim()) {
      setActionMessage("Assessment type is required.");
      return;
    }
    if (String(form.passPercent ?? "").trim() === "") {
      setActionMessage("Pass mark is required.");
      return;
    }
    if (String(form.timeLimitMinutes ?? "").trim() === "") {
      setActionMessage("Time limit is required.");
      return;
    }

    const normalizedPassPercent = Number(form.passPercent);
    const normalizedTimeLimitMinutes = Number(form.timeLimitMinutes);

    if (!Number.isFinite(normalizedPassPercent) || normalizedPassPercent < 0 || normalizedPassPercent > 100) {
      setActionMessage("Pass mark must be between 0 and 100.");
      return;
    }
    if (!Number.isFinite(normalizedTimeLimitMinutes) || normalizedTimeLimitMinutes < 1) {
      setActionMessage("Time limit must be at least 1 minute.");
      return;
    }

    const assessmentId = editingId || createAssessmentId(selectedCourseId);
    const nowEpochSeconds = Math.floor(Date.now() / 1000);
    const existingRecord = examRecords.find((record) => record.id === assessmentId);
    const teacherId =
      teacherContext?.teacherRecord?.teacherId || teacherContext?.teacherKey || teacher?.teacherId || teacher?.userId;
    const resolvedTeacherId = String(teacherId || "").trim();

    const preparedQuestions = customQuestions
      .map((item) => normalizeQuestionForEdit(item))
      .filter((item) => item.prompt);

    if (!preparedQuestions.length) {
      setActionMessage("Add at least one question before saving.");
      return;
    }

    const duplicateHashSet = new Set();
    const hasDuplicateQuestion = preparedQuestions.some((item) => {
      const hashKey = buildQuestionHashKey(item.prompt, item.type);
      if (duplicateHashSet.has(hashKey)) return true;
      duplicateHashSet.add(hashKey);
      return false;
    });

    if (hasDuplicateQuestion) {
      setActionMessage("Duplicate questions detected. Remove repeated questions before saving.");
      return;
    }

    const invalidQuestion = preparedQuestions.find((item) => {
      if (item.type === "mcq") {
        const hasAllOptions = ["A", "B", "C", "D"].every((key) => String(item.options?.[key] || "").trim());
        const validAnswer = ["A", "B", "C", "D"].includes(String(item.correctAnswer || "").trim().toUpperCase());
        return !hasAllOptions || !validAnswer;
      }
      if (item.type === "true_false") {
        return !["true", "false"].includes(String(item.correctAnswer || "").trim().toLowerCase());
      }
      if (item.type === "fill_blank") {
        return !String(item.correctAnswer || "").trim();
      }
      return false;
    });

    if (invalidQuestion) {
      setActionMessage("Complete question type fields (options/correct answer) before saving.");
      return;
    }

    const gradeKey = resolveGradeKey(selectedCourse?.grade);
    const subjectKey = normalizeNodeKey(selectedCourse?.subject || selectedCourse?.name || "general");

    const questionHashesRes = await axios
      .get(`${RTDB_BASE}/SchoolExams/QuestionHashes.json`)
      .catch(() => ({ data: {} }));
    const existingQuestionHashes = questionHashesRes.data || {};

    const questionItems = {};
    const chosenQuestionIds = [];
    const questionHashUpdates = {};
    const questionUsageUpdates = {};
    const questionBankWrites = [];

    for (const questionItem of preparedQuestions) {
      const normalizedType = String(questionItem.type || "written").trim() || "written";
      const normalizedCorrectAnswer = String(questionItem.correctAnswer || "").trim();
      const normalizedOptions = {
        A: String(questionItem.options?.A || "").trim(),
        B: String(questionItem.options?.B || "").trim(),
        C: String(questionItem.options?.C || "").trim(),
        D: String(questionItem.options?.D || "").trim(),
      };
      const questionHashKey = buildQuestionHashKey(questionItem.prompt, normalizedType);
      const questionId = existingQuestionHashes[questionHashKey] || createQuestionBankId();

      if (!existingQuestionHashes[questionHashKey]) {
        questionHashUpdates[questionHashKey] = questionId;
      }

      const questionBucket = resolveQuestionBucket(normalizedType);
      const questionPath = `${RTDB_BASE}/SchoolExams/QuestionBank/${gradeKey}/${subjectKey}/${questionBucket}/${questionId}.json`;

      const existingQuestionRes = await axios.get(questionPath).catch(() => ({ data: null }));
      const existingQuestion = existingQuestionRes.data || {};
      const usageCount = Math.max(0, Number(existingQuestion?.usageCount || 0)) + 1;

      const questionRecord = {
        questionId,
        question: questionItem.prompt,
        prompt: questionItem.prompt,
        type: normalizedType,
        points: Math.max(1, Number(questionItem.points || 1)),
        createdAt: toEpochSeconds(existingQuestion?.createdAt) || nowEpochSeconds,
        createdBy: existingQuestion?.createdBy || resolvedTeacherId,
        usageCount,
      };

      if (normalizedType === "mcq") {
        questionRecord.options = normalizedOptions;
        questionRecord.correctAnswer = normalizedCorrectAnswer.toUpperCase();
      }

      if (normalizedType === "true_false") {
        questionRecord.options = {
          A: "True",
          B: "False",
        };
        questionRecord.correctAnswer = normalizedCorrectAnswer.toLowerCase() === "true" ? "True" : "False";
      }

      if (normalizedType === "fill_blank") {
        questionRecord.correctAnswer = normalizedCorrectAnswer;
      }

      questionItems[questionId] = questionRecord;
      chosenQuestionIds.push(questionId);
      questionUsageUpdates[questionId] = {
        ...(questionUsageUpdates[questionId] || {}),
        [assessmentId]: true,
      };
      questionBankWrites.push(axios.put(questionPath, questionRecord));
    }

    const finalQuestionCount = preparedQuestions.length;
    const resolvedDueDateInput = String(form.dueDate || "").trim() || getTodayDateInput();

    const nextAssessmentStatus = String(existingRecord?.raw?.status || "draft").toLowerCase();

    const payload = {
      assessmentId,
      courseId: selectedCourseId,
      teacherId: resolvedTeacherId,
      title: String(form.title || "").trim(),
      type: String(form.type || "Exam").trim() || "Exam",
      status: nextAssessmentStatus,
      dueDate: Math.floor(new Date(resolvedDueDateInput).getTime() / 1000),
      questionCount: finalQuestionCount,
      questionRefs: buildQuestionRefsFromIds(chosenQuestionIds),
      questions: questionItems,
      totalPoints: Math.max(0, finalQuestionCount),
      passPercent: Math.min(100, Math.max(0, normalizedPassPercent)),
      timeLimitMinutes: Math.max(1, normalizedTimeLimitMinutes),
      createdAt: toEpochSeconds(existingRecord?.raw?.createdAt) || nowEpochSeconds,
      updatedAt: nowEpochSeconds,
    };

    setBusyAction(assessmentId);
    setActionMessage("");

    try {
      await axios.put(`${RTDB_BASE}/SchoolExams/Assessments/${assessmentId}.json`, payload);
      await axios.patch(`${RTDB_BASE}/SchoolExams/CourseFeed/${selectedCourseId}/${assessmentId}.json`, {
        assessmentId,
        courseId: selectedCourseId,
        title: payload.title,
        type: payload.type,
        status: payload.status,
        dueDate: payload.dueDate,
        updatedAt: nowEpochSeconds,
      });
      await Promise.all(questionBankWrites);
      if (Object.keys(questionHashUpdates).length) {
        await axios.patch(`${RTDB_BASE}/SchoolExams/QuestionHashes.json`, questionHashUpdates);
      }
      await Promise.all(
        Object.entries(questionUsageUpdates).map(([questionId, usageNode]) =>
          axios.patch(`${RTDB_BASE}/SchoolExams/QuestionUsage/${questionId}.json`, usageNode)
        )
      );

      upsertLocalExamRecord(assessmentId, payload, existingRecord?.raw || null);
      const statsSynced = await syncCourseStats(selectedCourseId);

      if (editingId) {
        setActionMessage(statsSynced ? "Assessment updated." : "Assessment updated (CourseStats sync failed).");
      } else {
        setActionMessage(statsSynced ? "Assessment created." : "Assessment created (CourseStats sync failed).");
      }
      resetForm();
      await loadWorkspace();
    } catch {
      setActionMessage("Failed to save assessment.");
    } finally {
      setBusyAction("");
    }
  };

  const handleTogglePublish = async (record) => {
    const nextStatus = record.published ? "draft" : "active";
    const nowEpochSeconds = Math.floor(Date.now() / 1000);
    setBusyAction(record.id);
    setActionMessage("");

    try {
      await axios.patch(`${RTDB_BASE}/SchoolExams/Assessments/${record.id}.json`, {
        status: nextStatus,
        updatedAt: nowEpochSeconds,
      });
      await axios.patch(`${RTDB_BASE}/SchoolExams/CourseFeed/${record.courseId}/${record.id}.json`, {
        status: nextStatus,
        updatedAt: nowEpochSeconds,
      });

      const statsSynced = await syncCourseStats(record.courseId);
      if (nextStatus === "active") {
        setActionMessage(statsSynced ? "Assessment published." : "Assessment published (CourseStats sync failed).");
      } else {
        setActionMessage(statsSynced ? "Assessment moved to draft." : "Assessment moved to draft (CourseStats sync failed).");
      }
      await loadWorkspace();
    } catch {
      setActionMessage("Failed to update publish status.");
    } finally {
      setBusyAction("");
    }
  };

  const verifyTeacherDeleteCredentials = useCallback(
    async (usernameInput, passwordInput) => {
      const normalizedUsername = String(usernameInput || "").trim().toLowerCase();
      const normalizedPassword = String(passwordInput || "");
      if (!normalizedUsername || !normalizedPassword) return false;

      const teacherRefs = new Set(
        [
          teacher?.userId,
          teacher?.teacherId,
          teacher?.teacherKey,
          teacherContext?.teacherKey,
          teacherContext?.teacherRecord?.userId,
          teacherContext?.teacherRecord?.teacherId,
        ]
          .filter(Boolean)
          .map(normalizeTeacherRef)
      );

      const usersRes = await axios.get(`${RTDB_BASE}/Users.json`).catch(() => ({ data: {} }));
      const usersMap = usersRes.data || {};

      const matchedTeacherUser = Object.entries(usersMap).find(([userKey, user]) => {
        const username = String(user?.username || "").trim().toLowerCase();
        const password = String(user?.password || "");
        if (!username || !password) return false;
        if (username !== normalizedUsername || password !== normalizedPassword) return false;

        const userRefs = [userKey, user?.userId, user?.teacherId].filter(Boolean).map(normalizeTeacherRef);
        return userRefs.some((ref) => teacherRefs.has(ref));
      });

      return Boolean(matchedTeacherUser);
    },
    [RTDB_BASE, teacher, teacherContext]
  );

  const openDeleteAssessmentPopup = (record) => {
    if (!record?.id) return;
    setDeleteAssessmentTarget(record);
    setDeleteUsernameInput(String(teacher?.username || ""));
    setDeletePasswordInput("");
    setDeletePopupMessage("");
    setShowDeleteAssessmentPopup(true);
  };

  const closeDeleteAssessmentPopup = () => {
    setShowDeleteAssessmentPopup(false);
    setDeleteAssessmentTarget(null);
    setDeleteUsernameInput("");
    setDeletePasswordInput("");
    setDeletePopupMessage("");
  };

  const handleDeleteAssessment = async (record) => {
    if (!record?.id) return;
    const typedUsername = String(deleteUsernameInput || "").trim();
    const typedPassword = String(deletePasswordInput || "");

    if (!typedUsername || !typedPassword) {
      setDeletePopupMessage("Enter your teacher username and password to confirm delete.");
      return;
    }

    setBusyAction(record.id);
    setActionMessage("");
    setDeletePopupMessage("");

    try {
      const credentialsValid = await verifyTeacherDeleteCredentials(typedUsername, typedPassword);
      if (!credentialsValid) {
        setDeletePopupMessage("Delete blocked: teacher username or password is incorrect.");
        return;
      }

      await Promise.all([
        axios.delete(`${RTDB_BASE}/SchoolExams/Assessments/${record.id}.json`),
        axios.delete(`${RTDB_BASE}/SchoolExams/CourseFeed/${record.courseId}/${record.id}.json`),
        axios.delete(`${RTDB_BASE}/SchoolExams/SubmissionIndex/${record.id}.json`),
        axios.delete(`${RTDB_BASE}/SchoolExams/AssessmentSubmissions/${record.id}.json`),
        axios.delete(`${RTDB_BASE}/SchoolExams/SubmissionReviews/${record.id}.json`),
      ]);

      const statsSynced = await syncCourseStats(record.courseId);
      setActionMessage(
        statsSynced
          ? "Assessment permanently deleted from database."
          : "Assessment deleted from database (CourseStats sync failed)."
      );
      closeDeleteAssessmentPopup();
      if (editingId === record.id) resetForm();
      if (selectedExamDetailId === record.id) closeExamDetail();
      await loadWorkspace();
    } catch {
      setDeletePopupMessage("Failed to permanently delete assessment.");
    } finally {
      setBusyAction("");
    }
  };

  useEffect(() => {
    if (!showDeleteAssessmentPopup || !deleteAssessmentTarget?.id) return;

    const getFocusableElements = () => {
      const cardElement = deletePopupCardRef.current;
      if (!cardElement) return [];
      return Array.from(
        cardElement.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);
    };

    previousFocusedElementRef.current = document.activeElement;
    const initialFocusable = getFocusableElements();
    if (initialFocusable.length) {
      initialFocusable[0].focus();
    }

    const onDeletePopupKeyDown = (event) => {
      if (!showDeleteAssessmentPopup || !deleteAssessmentTarget?.id) return;

      if (event.key === "Tab") {
        const focusable = getFocusableElements();
        if (!focusable.length) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];
        const activeElement = document.activeElement;

        if (event.shiftKey) {
          if (activeElement === firstElement || !focusable.includes(activeElement)) {
            event.preventDefault();
            lastElement.focus();
          }
        } else if (activeElement === lastElement || !focusable.includes(activeElement)) {
          event.preventDefault();
          firstElement.focus();
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (busyAction !== deleteAssessmentTarget.id) {
          closeDeleteAssessmentPopup();
        }
        return;
      }

      if (event.key === "Enter") {
        const elementTag = String(event.target?.tagName || "").toUpperCase();
        if (elementTag === "TEXTAREA") return;
        event.preventDefault();
        if (busyAction !== deleteAssessmentTarget.id) {
          handleDeleteAssessment(deleteAssessmentTarget);
        }
      }
    };

    window.addEventListener("keydown", onDeletePopupKeyDown);
    return () => {
      window.removeEventListener("keydown", onDeletePopupKeyDown);
      const previousElement = previousFocusedElementRef.current;
      if (previousElement && typeof previousElement.focus === "function") {
        previousElement.focus();
      }
    };
  }, [
    showDeleteAssessmentPopup,
    deleteAssessmentTarget,
    busyAction,
    handleDeleteAssessment,
  ]);

  if (!teacher) return null;

  return (
    <>
      <style>{`
        .teacher-exam-pro {
          letter-spacing: 0.01em;
          background: #ffffff !important;
        }

        .teacher-exam-pro.dashboard-page {
          background: #ffffff !important;
        }

        .teacher-exam-pro .google-dashboard {
          background: #ffffff !important;
        }

        .teacher-exam-pro .teacher-sidebar-spacer {
          background: #ffffff !important;
        }

        .teacher-exam-pro .exam-scroll-area {
          scrollbar-width: thin;
          scrollbar-color: var(--border-strong) transparent;
        }

        .teacher-exam-pro .exam-hero {
          border-radius: 18px;
          border: 1px solid var(--border-soft);
          background: linear-gradient(160deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
          padding: 18px 20px;
        }

        .teacher-exam-pro .exam-summary-card {
          border-radius: 16px;
          border: 1px solid var(--border-soft);
          background: var(--surface-panel);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.07);
          transition: transform 160ms ease, box-shadow 160ms ease;
        }

        .teacher-exam-pro .exam-summary-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.1);
        }

        .teacher-exam-pro .exam-panel {
          border-radius: 16px;
          border: 1px solid var(--border-soft);
          background: var(--surface-panel);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.07);
        }

        .teacher-exam-pro .exam-soft-banner {
          border-radius: 14px;
          border: 1px solid var(--border-soft);
          background: linear-gradient(135deg, var(--surface-accent), var(--surface-muted));
          box-shadow: 0 6px 14px rgba(37, 99, 235, 0.07);
        }

        .teacher-exam-pro .exam-input {
          border: 1px solid var(--border-strong) !important;
          border-radius: 10px !important;
          background: #ffffff !important;
          color: var(--text-primary) !important;
          font-weight: 600;
          transition: box-shadow 150ms ease, border-color 150ms ease;
        }

        .teacher-exam-pro .exam-input:focus {
          outline: none;
          border-color: var(--accent-strong) !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
        }

        .teacher-exam-pro .exam-action-btn {
          border-radius: 10px !important;
          transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease;
          box-shadow: 0 5px 12px rgba(15, 23, 42, 0.1);
        }

        .teacher-exam-pro .exam-action-btn:hover {
          transform: translateY(-1px);
          filter: brightness(0.98);
        }

        .teacher-exam-pro .exam-record-card {
          border-radius: 18px !important;
          border: 1px solid var(--border-soft) !important;
          background: var(--page-bg) !important;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08) !important;
          transition: transform 160ms ease, box-shadow 160ms ease;
        }

        .teacher-exam-pro .exam-record-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 30px rgba(15, 23, 42, 0.12) !important;
        }

        .teacher-exam-pro .exam-submission-box {
          border-radius: 12px;
          border: 1px solid var(--border-soft);
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        }

        .teacher-exam-pro .exam-metric-tile {
          border-radius: 12px;
          border: 1px solid var(--border-soft);
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
        }

        .teacher-exam-pro .exam-status-chip {
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          background: var(--chip-bg, #fef3c7);
          color: var(--chip-fg, #92400e);
          border: 1px solid color-mix(in srgb, var(--chip-fg, #92400e) 24%, #ffffff 76%);
        }

        .teacher-exam-pro .exam-meta-stack {
          display: grid;
          gap: 6px;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
        }

        .teacher-exam-pro .exam-meta-label {
          color: var(--text-muted);
          font-weight: 700;
          margin-right: 6px;
        }

        .teacher-exam-pro .exam-source-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid var(--border-soft);
          background: #f8fafc;
          color: var(--text-secondary);
        }

        .teacher-exam-pro .exam-source-pill.is-company {
          background: #ecfdf5;
          color: #166534;
          border-color: #bbf7d0;
        }

        .teacher-exam-pro .exam-source-pill.is-school {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }

        .teacher-exam-pro .exam-questions-workspace {
          display: grid;
          gap: 12px;
        }

        .teacher-exam-pro .exam-questions-workspace-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border: 1px solid rgba(191, 219, 254, 0.8);
          border-radius: 14px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
        }

        .teacher-exam-pro .exam-questions-workspace-title {
          font-size: 13px;
          font-weight: 900;
          color: var(--text-primary);
          letter-spacing: 0.02em;
        }

        .teacher-exam-pro .exam-questions-workspace-sub {
          margin-top: 2px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .teacher-exam-pro .exam-questions-workspace-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #007AFB;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .teacher-exam-pro .exam-questions-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .teacher-exam-pro .exam-questions-metric {
          border: 1px solid rgba(226, 232, 240, 0.9);
          border-radius: 12px;
          padding: 9px 10px;
          background: #ffffff;
          display: grid;
          gap: 3px;
        }

        .teacher-exam-pro .exam-questions-metric-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .teacher-exam-pro .exam-questions-metric-value {
          font-size: 18px;
          font-weight: 900;
          color: var(--text-primary);
          line-height: 1.1;
        }

        .teacher-exam-pro .exam-question-list {
          display: grid;
          gap: 10px;
        }

        .teacher-exam-pro .exam-question-preview-item {
          padding: 12px;
          border: 1px solid rgba(203, 213, 225, 0.9);
          border-radius: 14px;
          background: #ffffff;
          display: grid;
          gap: 9px;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
        }

        .teacher-exam-pro .exam-question-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .teacher-exam-pro .exam-question-meta-left {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .teacher-exam-pro .exam-question-index {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 26px;
          height: 26px;
          border-radius: 999px;
          border: 1px solid #bfdbfe;
          background: #dbeafe;
          color: var(--text-primary);
          font-size: 11px;
          font-weight: 900;
        }

        .teacher-exam-pro .exam-question-type-pill,
        .teacher-exam-pro .exam-question-points-pill {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .teacher-exam-pro .exam-question-type-pill {
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #007AFB;
        }

        .teacher-exam-pro .exam-question-points-pill {
          border: 1px solid #d1d5db;
          background: #f8fafc;
          color: #334155;
        }

        .teacher-exam-pro .exam-question-text {
          color: var(--text-primary);
          font-weight: 700;
          font-size: 14px;
          line-height: 1.5;
        }

        .teacher-exam-pro .exam-choice-list {
          display: grid;
          gap: 6px;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .teacher-exam-pro .exam-choice-list-title {
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .teacher-exam-pro .exam-choice-item {
          font-weight: 600;
          color: var(--text-secondary);
          padding: 6px 8px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
        }

        .teacher-exam-pro .exam-choice-item.is-correct {
          color: #166534;
          border-color: #86efac;
          background: #ecfdf5;
          font-weight: 800;
        }

        .teacher-exam-pro .exam-answer-row {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px dashed #cbd5e1;
          background: #ffffff;
        }

        .teacher-exam-pro .exam-field {
          display: grid;
          gap: 6px;
          min-width: 160px;
        }

        .teacher-exam-pro .exam-field-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.02em;
        }

        .teacher-exam-pro .exam-helper-text {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .teacher-exam-pro {
          font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif;
        }

        .teacher-exam-pro .google-dashboard {
          gap: 14px !important;
          padding: 14px !important;
        }

        .teacher-exam-pro .exam-main-content {
          border: 1px solid var(--border-soft);
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
        }

        .teacher-exam-pro .exam-hero {
          border-radius: 16px !important;
          border: 1px solid var(--border-soft) !important;
          background: #ffffff !important;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06) !important;
          padding: 16px 18px !important;
        }

        .teacher-exam-pro .exam-soft-banner {
          border-radius: 12px !important;
          border: 1px solid var(--border-soft) !important;
          background: #f8fafc !important;
          box-shadow: none !important;
        }

        .teacher-exam-pro .exam-summary-card {
          border-radius: 14px !important;
          border: 1px solid var(--border-soft) !important;
          background: #ffffff !important;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.07) !important;
          position: relative;
          overflow: hidden;
        }

        .teacher-exam-pro .exam-summary-card::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 3px;
          background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 68%, #ffffff 32%));
        }

        .teacher-exam-pro .exam-panel {
          border-radius: 14px !important;
          border: 1px solid var(--border-soft) !important;
          background: #ffffff !important;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06) !important;
        }

        .teacher-exam-pro .exam-scope-panel {
          position: relative;
          overflow: hidden;
          border-radius: 18px !important;
          border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border-soft) 82%) !important;
          background:#FFFFFF;
          // background:
          //   radial-gradient(circle at top right, color-mix(in srgb, var(--accent-soft) 78%, #ffffff 22%), transparent 40%),
          //   linear-gradient(180deg, #ffffff 0%, color-mix(in srgb, var(--accent-soft) 40%, #ffffff 60%) 100%) !important;
          // box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08) !important;
        }

        .teacher-exam-pro .exam-scope-grid {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) minmax(220px, 0.8fr);
          gap: 12px;
          align-items: end;
        }

        .teacher-exam-pro .exam-scope-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }

        .teacher-exam-pro .exam-scope-label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-secondary);
        }

        .teacher-exam-pro .exam-scope-select,
        .teacher-exam-pro .exam-scope-value {
          min-height: 46px;
          padding: 11px 12px;
          border-radius: 12px;
          border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--border-soft) 88%);
          background: #ffffff;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
          font-weight: 700;
          color: var(--text-primary);
          display: flex;
          align-items: center;
        }

        .teacher-exam-pro .exam-scope-value {
          color: var(--text-primary);
          background: color-mix(in srgb, var(--accent-soft) 70%, #ffffff 30%);
        }

        .teacher-exam-pro .exam-scope-value.is-empty {
          color: var(--text-muted);
          background: var(--surface-muted);
          border-color: var(--border-soft);
        }

        @media (max-width: 760px) {
          .teacher-exam-pro .exam-scope-grid {
            grid-template-columns: 1fr;
          }
        }

        .teacher-exam-pro .exam-record-card {
          border-radius: 22px !important;
          border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--border-soft) 88%) !important;
          background: #ffffff !important;
          // background:
            // radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 34%),
            // linear-gradient(180deg, #ffffff 0%, #f8fbff 100%) !important;
          box-shadow: 0 22px 44px rgba(15, 23, 42, 0.1) !important;
          position: relative;
          overflow: hidden;
        }

        .teacher-exam-pro .exam-record-card::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          height: 5px;
          background: linear-gradient(90deg, #1d4ed8 0%, #2563eb 35%, #60a5fa 100%);
        }

        .teacher-exam-pro .exam-record-card::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 22px;
          pointer-events: none;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
        }

        .teacher-exam-pro .exam-record-card:hover {
          transform: translateY(-4px) !important;
          box-shadow: 0 28px 54px rgba(15, 23, 42, 0.14) !important;
        }

        .teacher-exam-pro .exam-input {
          border: 1px solid var(--border-strong) !important;
          border-radius: 10px !important;
          background: #ffffff !important;
          min-height: 40px;
          font-size: 14px;
        }

        .teacher-exam-pro .exam-input:focus {
          border-color: #1e40af !important;
          box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.12) !important;
        }

        .teacher-exam-pro .exam-action-btn {
          border-radius: 12px !important;
          min-height: 40px;
          padding: 10px 14px !important;
          border: 1px solid transparent !important;
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08) !important;
          font-weight: 700 !important;
          transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;
        }

        .teacher-exam-pro .exam-action-btn:hover {
          transform: translateY(-1px) !important;
          filter: saturate(1.04) !important;
          box-shadow: 0 8px 16px rgba(15, 23, 42, 0.1) !important;
        }

        .teacher-exam-pro .exam-action-btn:disabled {
          opacity: 0.72;
          transform: none !important;
          box-shadow: none !important;
          filter: none !important;
        }

        .teacher-exam-pro .btn-primary {
          background: #1d4ed8 !important;
          color: #ffffff !important;
          border-color: #1d4ed8 !important;
        }

        .teacher-exam-pro .btn-success {
          background: #15803d !important;
          color: #ffffff !important;
          border-color: #15803d !important;
        }

        .teacher-exam-pro .btn-warning {
          background: #b45309 !important;
          color: #ffffff !important;
          border-color: #b45309 !important;
        }

        .teacher-exam-pro .btn-danger {
          background: #b91c1c !important;
          color: #ffffff !important;
          border-color: #b91c1c !important;
        }

        .teacher-exam-pro .btn-neutral {
          background: #ffffff !important;
          color: #0f172a !important;
          border-color: var(--border-strong) !important;
        }

        .teacher-exam-pro .btn-soft {
          background: #ffffff !important;
          color: #007AFB !important;
          border-color: #c7d2fe !important;
        }

        .teacher-exam-pro .exam-section-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .teacher-exam-pro .exam-section-tab {
          border: 1px solid var(--border-strong);
          background: var(--accent-soft);
          color: var(--accent);
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
        }

        .teacher-exam-pro .exam-section-tab.is-active {
          background: var(--accent);
          border-color: var(--accent);
          color: #ffffff;
        }

        .teacher-exam-pro .exam-record-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(203, 213, 225, 0.7);
        }

        .teacher-exam-pro .exam-card-clickable {
          display: grid;
          gap: 12px;
          cursor: pointer;
          border-radius: 18px;
          transition: background-color 140ms ease, transform 140ms ease;
        }

        .teacher-exam-pro .exam-card-clickable:hover {
          background: rgba(239, 246, 255, 0.42);
        }

        .teacher-exam-pro .exam-card-clickable:focus-visible {
          outline: 3px solid rgba(59, 130, 246, 0.28);
          outline-offset: 4px;
        }

        .teacher-exam-pro .exam-card-toggle-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          margin-left: 8px;
          font-size: 14px;
          font-weight: 900;
          transform: rotate(0deg);
          transition: transform 180ms ease;
        }

        .teacher-exam-pro .exam-card-toggle-icon.is-open {
          transform: rotate(180deg);
        }

        .teacher-exam-pro .exam-record-title {
          font-size: 22px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.2;
          letter-spacing: -0.02em;
          max-width: 18ch;
        }

        .teacher-exam-pro .exam-record-type {
          margin-top: 8px;
          color: var(--accent-strong);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .teacher-exam-pro .exam-record-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .teacher-exam-pro .exam-metric-tile {
          border-radius: 16px;
          border: 1px solid color-mix(in srgb, var(--accent) 10%, var(--border-soft) 90%);
          background: linear-gradient(
            180deg,
            #ffffff 0%,
            #eef5ff 100%
          );
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 8px 18px rgba(15, 23, 42, 0.06);
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }

        .teacher-exam-pro .exam-metric-tile:hover {
          border-color: color-mix(in srgb, var(--accent) 35%, var(--border-soft) 65%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 12px 22px rgba(15, 23, 42, 0.08);
        }

        .teacher-exam-pro .exam-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          padding-top: 14px;
          border-top: 1px dashed rgba(148, 163, 184, 0.7);
        }

        .teacher-exam-pro .exam-card-summary-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .teacher-exam-pro .exam-card-summary-pill {
          display: inline-flex;
          align-items: center;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid rgba(191, 219, 254, 0.75);
          background: rgba(239, 246, 255, 0.9);
          color: #007AFB;
          font-size: 12px;
          font-weight: 800;
        }

        .teacher-exam-pro .exam-card-details {
          display: grid;
          gap: 12px;
          transform-origin: top;
          animation: examCardExpand 180ms ease;
        }

        .teacher-exam-pro .exam-card-toggle {
          min-width: 124px;
          margin-left: auto;
          justify-content: center;
          font-weight: 800 !important;
        }

        .teacher-exam-pro .exam-card-toggle.is-open {
          background: linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%) !important;
          color: #007AFB !important;
          border-color: #93c5fd !important;
        }

        @keyframes examCardExpand {
          from {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.98);
          }

          to {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        .teacher-exam-pro .exam-meta-stack {
          display: grid;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(248, 250, 252, 0.92) 0%, rgba(241, 245, 249, 0.96) 100%);
          border: 1px solid rgba(226, 232, 240, 0.9);
        }

        .teacher-exam-pro .exam-meta-label {
          display: inline-block;
          min-width: 58px;
          color: var(--text-muted);
          font-weight: 800;
          margin-right: 8px;
        }

        .teacher-exam-pro .exam-card-topline {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 4px 0 2px;
        }

        .teacher-exam-pro .exam-card-topline-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .teacher-exam-pro .exam-top-badge {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid rgba(191, 219, 254, 0.9);
          background: rgba(239, 246, 255, 0.95);
          color:VAR(--accent-strong);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .teacher-exam-pro .exam-card-topline-note {
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
        }

        .teacher-exam-pro .exam-card-course-due-line {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          min-width: 0;
          color: var(--accent-strong);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .teacher-exam-pro .exam-metric-label {
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .teacher-exam-pro .exam-metric-value {
          margin-top: 6px;
          font-size: 22px;
          line-height: 1;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.03em;
        }

        .teacher-exam-pro .exam-metric-helper {
          margin-top: 6px;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
        }

        .teacher-exam-pro .exam-expand-panel {
          border: 1px solid rgba(226, 232, 240, 0.95);
          border-radius: 20px;
          padding: 18px;
          background: #ffffff;
          box-shadow: 0 16px 30px rgba(15, 23, 42, 0.06);
          display: grid;
          gap: 12px;
        }

        .teacher-exam-pro .exam-expand-panel.is-detail-tab {
          min-height: 320px;
          align-content: start;
        }

        .teacher-exam-pro .exam-expand-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .teacher-exam-pro .exam-expand-title {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--accent-strong);
        }

        .teacher-exam-pro .exam-expand-count {
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
        }

        .teacher-exam-pro .exam-expand-body {
          display: grid;
          gap: 10px;
          align-content: start;
        }

        .teacher-exam-pro .exam-submission-row {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) auto auto;
          gap: 12px;
          align-items: center;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: rgba(255, 255, 255, 0.88);
        }

        .teacher-exam-pro .exam-submission-student {
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 800;
        }

        .teacher-exam-pro .exam-submission-score {
          color: var(--accent-strong);
          font-size: 13px;
          font-weight: 800;
        }

        .teacher-exam-pro .exam-submission-date {
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
          text-align: right;
        }

        .teacher-exam-pro .exam-status-chip {
          padding: 8px 12px;
          letter-spacing: 0.1em;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
        }

        .teacher-exam-pro .exam-source-pill {
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border: 1px solid #bfdbfe;
          background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
          color: #1d4ed8;
        }

        .teacher-exam-pro .exam-status-chip.is-active {
          --chip-bg: #dcfce7;
          --chip-fg: #166534;
        }

        .teacher-exam-pro .exam-status-chip.is-draft {
          --chip-bg: #fef3c7;
          --chip-fg: #92400e;
        }

        .teacher-exam-pro .exam-status-chip.is-removed {
          --chip-bg: #fee2e2;
          --chip-fg: #991b1b;
        }

        .teacher-exam-pro .exam-form-shell {
          padding: 18px !important;
          border-radius: 22px !important;
          background: #ffffff !important;
          border: 1px solid rgba(191, 219, 254, 0.65) !important;
          box-shadow: 0 20px 42px rgba(15, 23, 42, 0.08) !important;
          position: relative;
          overflow: hidden;
          text-align: left;
        }

        .teacher-exam-pro .exam-form-shell::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 4px;
          background: linear-gradient(90deg, #1d4ed8, #60a5fa);
        }

        .teacher-exam-pro .exam-form-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(203, 213, 225, 0.8);
        }

        .teacher-exam-pro .exam-form-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          overflow: visible;
        }

        .teacher-exam-pro .exam-form-grid .exam-field-card {
          min-width: 0;
          padding: 10px;
          gap: 6px;
          overflow: hidden;
        }

        .teacher-exam-pro .exam-form-intro {
          display: grid;
          gap: 6px;
          text-align: left;
        }

        .teacher-exam-pro .exam-form-title {
          font-size: 22px;
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.03em;
          color: var(--text-primary);
          text-align: left;
        }

        .teacher-exam-pro .exam-form-subtitle {
          color: #334155;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.65;
          max-width: none;
          padding: 10px 12px;
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(239, 246, 255, 0.72) 0%, rgba(248, 250, 252, 0.96) 100%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
          text-align: left;
          white-space: nowrap;
          overflow: visible;
          text-overflow: clip;
        }

        .teacher-exam-pro .exam-field-card {
          display: grid;
          gap: 8px;
          padding: 14px;
          border-radius: 16px;
          border: 1px solid rgba(191, 219, 254, 0.65);
          background: var(--page-bg);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 8px 16px rgba(15, 23, 42, 0.04);
          transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
          text-align: left;
        }

        .teacher-exam-pro .exam-field-card:focus-within {
          border-color: rgba(59, 130, 246, 0.72);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78), 0 12px 24px rgba(30, 64, 175, 0.09);
          transform: translateY(-1px);
        }

        .teacher-exam-pro .exam-field-label {
          font-size: 11px;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: left;
        }

        .teacher-exam-pro .exam-field-input {
          width: 100%;
          padding: 12px 14px !important;
          border-radius: 14px !important;
          border: 1px solid rgba(203, 213, 225, 0.95) !important;
          background: rgba(255, 255, 255, 0.98) !important;
          color: var(--text-primary) !important;
          font-size: 15px !important;
          font-weight: 700 !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
        }

        .teacher-exam-pro .exam-field-input::placeholder {
          color: #94a3b8;
          font-weight: 600;
        }

        .teacher-exam-pro .exam-field-note {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.55;
          letter-spacing: 0.01em;
          padding: 8px 10px;
          border-radius: 10px;
          background: rgba(248, 250, 252, 0.95);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          justify-content: flex-start;
          text-align: left;
        }

        .teacher-exam-pro .exam-field-note::before {
          content: "•";
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 14px;
          color: #2563eb;
          font-size: 14px;
          font-weight: 900;
          line-height: 1;
          transform: translateY(1px);
        }

        .teacher-exam-pro .exam-tip-banner {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 16px;
          border: 1px solid rgba(191, 219, 254, 0.7);
          background: linear-gradient(180deg, rgba(239, 246, 255, 0.96) 0%, rgba(248, 250, 252, 0.98) 100%);
          color: var(--accent-strong);
          font-size: 13px;
          font-weight: 800;
          justify-content: flex-start;
          text-align: left;
        }

        .teacher-exam-pro .exam-card-summary-row,
        .teacher-exam-pro .exam-card-topline,
        .teacher-exam-pro .exam-card-topline-group,
        .teacher-exam-pro .exam-record-header,
        .teacher-exam-pro .exam-meta-stack,
        .teacher-exam-pro .exam-card-actions,
        .teacher-exam-pro .exam-expand-header,
        .teacher-exam-pro .exam-submission-row {
          text-align: left;
        }

        .teacher-exam-pro .exam-card-summary-row,

        .teacher-exam-pro .exam-card-actions.is-detail {
          padding-top: 0;
          border-top: none;
        }

        .teacher-exam-pro .exam-card-actions.is-detail .exam-action-btn {
          min-width: 138px;
          justify-content: center;
        }

        .teacher-exam-pro .exam-actions-hero {
          border: 1px solid rgba(191, 219, 254, 0.72);
          border-radius: 18px;
          padding: 16px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9);
          display: grid;
          gap: 12px;
        }

        .teacher-exam-pro .exam-actions-hero-title {
          font-size: 16px;
          font-weight: 900;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .teacher-exam-pro .exam-questions-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          border: 1px solid rgba(68, 132, 210, 0.62);
          border-radius: 14px;
          padding: 10px 12px;
          background: #ffffff;
        }

        .teacher-exam-pro .exam-questions-title-stack {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .teacher-exam-pro .exam-questions-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .teacher-exam-pro .exam-questions-title {
          font-size: 13px;
          font-weight: 900;
          color: var(--text-primary);
          letter-spacing: 0.01em;
        }

        .teacher-exam-pro .exam-questions-counter {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 24px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(191, 219, 254, 0.85);
          background: #ffffff;
          color: var(--accent-strong);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .teacher-exam-pro .exam-questions-subtitle {
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
        }

        .teacher-exam-pro .exam-questions-toolbar {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }

        .teacher-exam-pro .exam-questions-list {
          display: grid;
          gap: 12px;
          padding: 2px;
        }

        .teacher-exam-pro .exam-question-bank-panel {
          border: 1px solid rgba(191, 219, 254, 0.7);
          border-radius: 14px;
          padding: 12px;
          background: #ffffff;
          display: grid;
          gap: 10px;
        }

        .teacher-exam-pro .exam-question-bank-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .teacher-exam-pro .exam-question-bank-title {
          font-size: 13px;
          font-weight: 900;
          color: var(--text-primary);
          letter-spacing: 0.01em;
        }

        .teacher-exam-pro .exam-question-bank-controls {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 180px;
          gap: 8px;
        }

        .teacher-exam-pro .exam-question-bank-list {
          display: grid;
          gap: 8px;
          max-height: 260px;
          overflow: auto;
          padding-right: 2px;
        }

        .teacher-exam-pro .exam-question-bank-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          border: 1px solid rgba(226, 232, 240, 0.95);
          border-radius: 12px;
          padding: 10px;
          background: #ffffff;
        }

        .teacher-exam-pro .exam-question-bank-item-main {
          min-width: 0;
          display: grid;
          gap: 6px;
        }

        .teacher-exam-pro .exam-question-bank-item-meta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .teacher-exam-pro .exam-question-bank-item-text {
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 700;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .teacher-exam-pro .exam-question-bank-empty {
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 700;
          padding: 8px;
          border: 1px dashed var(--border-strong);
          border-radius: 10px;
          background: #f8fafc;
        }

        .teacher-exam-pro .exam-actions-hero-sub {
          margin-top: 4px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .teacher-exam-pro .exam-actions-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .teacher-exam-pro .exam-action-tile {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 11px;
          border-radius: 12px;
          border: 1px solid rgba(191, 219, 254, 0.72);
          background: rgba(255, 255, 255, 0.94);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 6px 14px rgba(15, 23, 42, 0.05);
          min-width: 0;
          white-space: nowrap;
        }

        .teacher-exam-pro .exam-action-tile-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .teacher-exam-pro .exam-action-tile .exam-action-btn {
          width: auto;
          min-width: 120px;
          justify-content: center;
        }
        .teacher-exam-pro .exam-card-topline-group,
        .teacher-exam-pro .exam-card-actions {
          justify-content: flex-start;
        }

        .teacher-exam-pro .exam-tip-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 34px;
          height: 34px;
          border-radius: 999px;
          background: linear-gradient(180deg, #1d4ed8 0%, #2563eb 100%);
          color: #ffffff;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          box-shadow: 0 8px 18px rgba(37, 99, 235, 0.24);
        }

        .teacher-exam-pro .exam-questions-shell {
          margin-top: 14px;
          border: 1px solid rgba(191, 219, 254, 0.65);
          border-radius: 18px;
          padding: 14px;
          background: #ffffff;
          // background: linear-gradient(180deg, #ffffff 0%, #fcfdff 100%);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.05);
        }

        .teacher-exam-pro .exam-question-editor {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          align-items: start;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid rgba(203, 213, 225, 0.85);
          background: #ffffff;
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05);
        }

        .teacher-exam-pro .exam-question-editor-main {
          display: grid;
          gap: 14px;
        }

        .teacher-exam-pro .exam-question-prompt-card,
        .teacher-exam-pro .exam-question-inline-card,
        .teacher-exam-pro .exam-question-options-card,
        .teacher-exam-pro .exam-question-answer-card {
          display: grid;
          gap: 8px;
          padding: 0;
          border-radius: 0;
          border: none;
          background: transparent;
          box-shadow: none;
        }

        .teacher-exam-pro .exam-question-section-label {
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .teacher-exam-pro .exam-question-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
          padding-top: 2px;
          border-top: 1px solid rgba(226, 232, 240, 0.9);
        }

        .teacher-exam-pro .exam-question-option-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .teacher-exam-pro .exam-question-option-item {
          display: grid;
          gap: 6px;
        }

        .teacher-exam-pro .exam-question-remove {
          min-width: 90px;
          min-height: 34px;
          padding: 6px 10px !important;
        }

        .teacher-exam-pro .exam-question-editor-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          border-bottom: 1px solid rgba(226, 232, 240, 0.95);
          border-radius: 0;
          padding: 0 0 12px;
          background: transparent;
        }

        .teacher-exam-pro .exam-question-editor-top-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex-wrap: wrap;
        }

        .teacher-exam-pro .exam-question-state {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 9px;
          border-radius: 999px;
          border: 1px solid #d1d5db;
          background: #f8fafc;
          color: #334155;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .teacher-exam-pro .exam-question-state.is-ready {
          background: #dcfce7;
          border-color: #86efac;
          color: #166534;
        }

        .teacher-exam-pro .exam-question-editor-top-right {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }

        .teacher-exam-pro .exam-question-editor-chevron {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 8px;
          border: 1px solid rgba(203, 213, 225, 0.95);
          background: #ffffff;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 900;
        }

        .teacher-exam-pro .exam-question-chip {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: #eff6ff;
          color: var(--accent-strong);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .teacher-exam-pro .exam-collapse-icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1px solid rgba(191, 219, 254, 0.9);
          background: rgba(239, 246, 255, 0.92);
          color: #1d4ed8;
          cursor: pointer;
          transition: all 0.18s ease;
          flex: 0 0 auto;
        }

        .teacher-exam-pro .exam-collapse-icon-btn:hover {
          background: #dbeafe;
        }

        .teacher-exam-pro .exam-collapse-icon {
          font-size: 14px;
          line-height: 1;
          font-weight: 900;
        }

        .teacher-exam-pro .exam-form-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px dashed rgba(148, 163, 184, 0.7);
        }

        @media (max-width: 760px) {
          .teacher-exam-pro .exam-questions-head {
            flex-direction: column;
            align-items: flex-start;
          }

          .teacher-exam-pro .exam-question-bank-controls {
            grid-template-columns: 1fr;
          }

          .teacher-exam-pro .exam-question-bank-item {
            grid-template-columns: 1fr;
          }

          .teacher-exam-pro .exam-questions-toolbar {
            width: 100%;
            justify-content: space-between;
          }

          .teacher-exam-pro .exam-question-editor-top {
            flex-wrap: wrap;
          }

          .teacher-exam-pro .exam-question-editor-top-right {
            width: 100%;
            justify-content: space-between;
          }
        }

        .teacher-exam-pro .exam-inline-edit-actions {
          margin-top: 0;
          padding-top: 10px;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 10px;
          border-top: 1px solid rgba(191, 219, 254, 0.75);
          white-space: nowrap;
        }

        .teacher-exam-pro .exam-inline-edit-actions .exam-action-btn {
          min-width: 190px;
          justify-content: center;
        }

        .teacher-exam-pro .exam-inline-edit-message {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-secondary);
          font-weight: 700;
          font-size: 13px;
        }

        .teacher-exam-pro .exam-eval-panel {
          padding: 18px !important;
          border-radius: 22px !important;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%) !important;
          border: 1px solid rgba(191, 219, 254, 0.65) !important;
          box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08) !important;
        }

        .teacher-exam-pro .exam-eval-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(203, 213, 225, 0.75);
        }

        .teacher-exam-pro .exam-eval-title {
          font-size: 20px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.2;
        }

        .teacher-exam-pro .exam-eval-subtitle {
          margin-top: 6px;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 700;
        }

        .teacher-exam-pro .exam-eval-student-card {
          border: 1px solid rgba(191, 219, 254, 0.65);
          border-radius: 18px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          padding: 14px;
          display: grid;
          gap: 10px;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
        }

        .teacher-exam-pro .exam-eval-student-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(226, 232, 240, 0.9);
        }

        .teacher-exam-pro .exam-eval-student-name {
          font-size: 15px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .teacher-exam-pro .exam-eval-student-score {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 12px;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 800;
        }

        .teacher-exam-pro .exam-eval-answer-title {
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.4;
        }

        .teacher-exam-pro .exam-eval-answer-meta {
          display: grid;
          gap: 4px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .teacher-exam-pro .exam-eval-mark-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .teacher-exam-pro .exam-eval-save-row {
          display: flex;
          justify-content: flex-end;
          padding-top: 4px;
        }

        .teacher-exam-pro .exam-list-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          align-items: stretch;
        }

        .teacher-exam-pro .exam-list-grid > .exam-record-card {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .teacher-exam-pro .exam-list-fullwidth {
          grid-column: 1 / -1;
          width: 100%;
        }

        .teacher-exam-pro .exam-detail-overlay {
          position: fixed;
          inset: 0;
          z-index: 9998;
          background: rgba(15, 23, 42, 0.48);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          box-sizing: border-box;
          animation: examDetailOverlayIn 220ms ease-out;
        }

        .teacher-exam-pro .exam-detail-panel {
          width: min(1420px, calc(100vw - 32px));
          height: calc(100vh - 32px);
          max-height: calc(100vh - 32px);
          overflow: hidden;
          background: #ffffff;
          border-radius: 28px;
          border: 1px solid rgba(191, 219, 254, 0.75);
          // box-shadow: 0 32px 70px rgba(15, 23, 42, 0.32);
          padding: 0;
          box-sizing: border-box;
          animation: examDetailPanelIn 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
          transform-origin: top center;
          display: flex;
          position: relative;
        }

        .teacher-exam-pro .exam-detail-panel::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 5px;
          background: linear-gradient(90deg, #1d4ed8 0%, #2563eb 38%, #60a5fa 100%);
          z-index: 1;
        }

        @keyframes examDetailOverlayIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes examDetailPanelIn {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.992);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .teacher-exam-pro .exam-detail-overlay,
          .teacher-exam-pro .exam-detail-panel {
            animation: none !important;
          }
        }

        @media (max-width: 1080px) {
          .teacher-exam-pro .exam-detail-hero {
            grid-template-columns: 1fr;
          }
        }

        .teacher-exam-pro .exam-detail-shell {
          width: 100%;
          height: 100%;
          overflow-y: auto;
          padding: 20px;
          box-sizing: border-box;
          display: grid;
          gap: 16px;
          align-content: start;
        }

        .teacher-exam-pro .exam-detail-topbar {
          position: sticky;
          top: 0;
          z-index: 2;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(226, 232, 240, 0.95);
          border-radius: 18px;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
          padding: 14px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .teacher-exam-pro .exam-detail-topbar-copy {
          display: grid;
          gap: 4px;
        }

        .teacher-exam-pro .exam-detail-topbar-kicker {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent-strong);
        }

        .teacher-exam-pro .exam-detail-topbar-title {
          font-size: 16px;
          font-weight: 900;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .teacher-exam-pro .exam-detail-close {
          min-height: 38px !important;
          padding: 8px 12px !important;
          border-radius: 10px !important;
        }

        .teacher-exam-pro .exam-detail-header {
          border-radius: 24px;
          border: 1px solid rgba(191, 219, 254, 0.75);
          background:#ffffff;
          // background:
          //   radial-gradient(circle at top right, rgba(219, 234, 254, 0.9), transparent 34%),
          //   linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 22px 42px rgba(15, 23, 42, 0.1);
          padding: 18px;
          display: grid;
          gap: 14px;
        }

        .teacher-exam-pro .exam-detail-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.9fr);
          gap: 14px;
          align-items: start;
        }

        .teacher-exam-pro .exam-detail-maincopy {
          display: grid;
          gap: 10px;
        }

        .teacher-exam-pro .exam-detail-header .exam-card-topline {
          padding: 0;
          gap: 8px;
        }

        .teacher-exam-pro .exam-detail-header .exam-top-badge {
          min-height: 26px;
          padding: 0 10px;
          font-size: 10px;
        }

        .teacher-exam-pro .exam-detail-header .exam-card-topline-note {
          font-size: 11px;
        }

        .teacher-exam-pro .exam-detail-title {
          font-size: clamp(20px, 2.4vw, 28px);
          font-weight: 900;
          line-height: 1.1;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .teacher-exam-pro .exam-detail-title-row {
          display: grid;
          gap: 8px;
        }

        .teacher-exam-pro .exam-detail-status-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .teacher-exam-pro .exam-detail-subtitle {
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
        }

        .teacher-exam-pro .exam-detail-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .teacher-exam-pro .exam-detail-summary-card {
          display: grid;
          gap: 5px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(191, 219, 254, 0.8);
          background: rgba(255, 255, 255, 0.92);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
        }

        .teacher-exam-pro .exam-detail-summary-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .teacher-exam-pro .exam-detail-summary-value {
          font-size: 18px;
          font-weight: 900;
          color: var(--text-primary);
          line-height: 1.1;
        }

        .teacher-exam-pro .exam-detail-summary-helper {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .teacher-exam-pro .exam-detail-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: #ffffff;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.05);
        }

        .teacher-exam-pro .exam-detail-filter-btn {
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid var(--border-strong);
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.18s ease;
        }

        .teacher-exam-pro .exam-detail-filter-btn.is-active {
          background: var(--accent);
          border-color: var(--accent);
          color: #ffffff;
          box-shadow: 0 6px 14px rgba(29, 78, 216, 0.24);
        }

        .teacher-exam-pro .exam-inline-edit-overlay {
          position: fixed;
          inset: 0;
          z-index: 10010;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          box-sizing: border-box;
        }

        .teacher-exam-pro .exam-inline-edit-card {
          width: min(1150px, calc(100vw - 32px));
          max-height: calc(100vh - 40px);
          overflow: auto;
          border-radius: 18px;
          border: 1px solid rgba(191, 219, 254, 0.75);
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 24px 48px rgba(15, 23, 42, 0.24);
          padding: 14px;
          display: grid;
          gap: 12px;
        }

        .teacher-exam-pro .exam-delete-overlay {
          position: fixed;
          inset: 0;
          z-index: 10020;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          box-sizing: border-box;
        }

        .teacher-exam-pro .exam-delete-card {
          width: min(460px, calc(100vw - 32px));
          border-radius: 16px;
          border: 1px solid rgba(254, 202, 202, 0.9);
          background: linear-gradient(180deg, #ffffff 0%, #fff7f7 100%);
          box-shadow: 0 24px 48px rgba(15, 23, 42, 0.28);
          padding: 14px;
          display: grid;
          gap: 10px;
        }

        .teacher-exam-pro .exam-delete-title {
          font-size: 15px;
          font-weight: 900;
          color: #991b1b;
        }

        .teacher-exam-pro .exam-delete-desc {
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 700;
          line-height: 1.5;
        }

        .teacher-exam-pro .exam-delete-form {
          display: grid;
          gap: 8px;
        }

        .teacher-exam-pro .exam-delete-error {
          font-size: 12px;
          font-weight: 800;
          color: #b91c1c;
        }

        .teacher-exam-pro .exam-delete-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(254, 202, 202, 0.85);
        }

        .teacher-exam-pro .exam-inline-edit-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(203, 213, 225, 0.75);
        }

        .teacher-exam-pro .exam-inline-edit-title {
          font-size: 16px;
          font-weight: 900;
          color: var(--text-primary);
        }

        .teacher-exam-pro .exam-overview-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border-soft) 76%);
          background:
            radial-gradient(circle at top right, color-mix(in srgb, var(--accent-soft) 82%, #ffffff 18%), transparent 45%),
            linear-gradient(180deg, #ffffff 0%, color-mix(in srgb, var(--accent-soft) 36%, #ffffff 64%) 100%);
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.07);
        }

        .teacher-exam-pro .exam-overview-kicker {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent-strong);
        }

        .teacher-exam-pro .exam-overview-hero-sub {
          margin-top: 6px;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
        }

        .teacher-exam-pro .exam-overview-meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .teacher-exam-pro .exam-overview-meta-card {
          display: grid;
          gap: 5px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(191, 219, 254, 0.8);
          background: rgba(255, 255, 255, 0.92);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
        }

        .teacher-exam-pro .exam-overview-meta-label {
          font-size: 10px;
          font-weight: 800;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.09em;
        }

        .teacher-exam-pro .exam-overview-meta-value {
          font-size: 13px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.35;
        }

        .teacher-exam-pro .exam-overview-analytics {
          display: grid;
          gap: 10px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(191, 219, 254, 0.8);
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
        }

        .teacher-exam-pro .exam-overview-metrics-inline {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          padding: 2px;
        }

        .teacher-exam-pro .exam-overview-metric-inline {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          min-height: 36px;
          padding: 0 10px;
          border-radius: 12px;
          border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border-soft) 76%);
          background: #ffffff;
          // background:
          //   linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(238, 245, 255, 0.96) 100%);
          box-shadow: 0 6px 12px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.75);
          white-space: nowrap;
          overflow: hidden;
        }

        .teacher-exam-pro .exam-overview-metric-inline-label {
          font-size: 10px;
          font-weight: 800;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .teacher-exam-pro .exam-overview-metric-inline-value {
          font-size: 13px;
          font-weight: 900;
          color: var(--text-primary);
          flex: 0 0 auto;
        }

        .teacher-exam-pro .exam-overview-metric-inline-helper {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-secondary);
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .teacher-exam-pro .exam-overview-metric-inline-helper::before {
          content: "•";
          margin-right: 6px;
          color: color-mix(in srgb, var(--accent) 60%, #ffffff 40%);
        }

        .teacher-exam-pro .exam-overview-analytics-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent-strong);
        }

        .teacher-exam-pro .exam-overview-analytics-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .teacher-exam-pro .exam-overview-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .teacher-exam-pro .exam-overview-legend-chip {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 0 9px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.45);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .teacher-exam-pro .exam-overview-legend-chip.is-high {
          background: #dcfce7;
          color: #166534;
          border-color: #86efac;
        }

        .teacher-exam-pro .exam-overview-legend-chip.is-mid {
          background: #fef9c3;
          color: #854d0e;
          border-color: #fde68a;
        }

        .teacher-exam-pro .exam-overview-legend-chip.is-low {
          background: #fee2e2;
          color: #991b1b;
          border-color: #fecaca;
        }

        .teacher-exam-pro .exam-overview-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .teacher-exam-pro .exam-overview-stat-tile {
          border: 1px solid rgba(191, 219, 254, 0.78);
          border-radius: 12px;
          background: linear-gradient(180deg, #ffffff 0%, #eef5ff 100%);
          padding: 8px 10px;
          display: grid;
          gap: 4px;
        }

        .teacher-exam-pro .exam-overview-stat-label {
          font-size: 10px;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .teacher-exam-pro .exam-overview-stat-value {
          font-size: 16px;
          font-weight: 900;
          color: var(--text-primary);
          line-height: 1.2;
        }

        .teacher-exam-pro .exam-overview-chart {
          display: grid;
          gap: 8px;
          margin-top: 2px;
        }

        .teacher-exam-pro .exam-overview-chart-row {
          display: grid;
          grid-template-columns: auto minmax(120px, 0.8fr) minmax(0, 1.8fr) auto;
          gap: 8px;
          align-items: center;
          border: 1px solid rgba(191, 219, 254, 0.5);
          border-radius: 12px;
          padding: 7px 9px;
          background: rgba(255, 255, 255, 0.72);
          transition: border-color 150ms ease, transform 150ms ease;
        }

        .teacher-exam-pro .exam-overview-chart-row:hover {
          border-color: rgba(96, 165, 250, 0.85);
          transform: translateY(-1px);
        }

        .teacher-exam-pro .exam-overview-rank {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 24px;
          border-radius: 999px;
          background: #dbeafe;
          color: #007AFB;
          border: 1px solid #bfdbfe;
          font-size: 11px;
          font-weight: 900;
        }

        .teacher-exam-pro .exam-overview-chart-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .teacher-exam-pro .exam-overview-chart-track {
          height: 10px;
          border-radius: 999px;
          background: #dbeafe;
          overflow: hidden;
          border: 1px solid #bfdbfe;
        }

        .teacher-exam-pro .exam-overview-chart-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #2563eb 0%, #60a5fa 100%);
          box-shadow: 0 1px 4px rgba(37, 99, 235, 0.28);
        }

        .teacher-exam-pro .exam-overview-chart-fill.is-high {
          background: linear-gradient(90deg, #16a34a 0%, #4ade80 100%);
          box-shadow: 0 1px 4px rgba(22, 163, 74, 0.28);
        }

        .teacher-exam-pro .exam-overview-chart-fill.is-mid {
          background: linear-gradient(90deg, #ca8a04 0%, #facc15 100%);
          box-shadow: 0 1px 4px rgba(202, 138, 4, 0.28);
        }

        .teacher-exam-pro .exam-overview-chart-fill.is-low {
          background: linear-gradient(90deg, #dc2626 0%, #f87171 100%);
          box-shadow: 0 1px 4px rgba(220, 38, 38, 0.28);
        }

        .teacher-exam-pro .exam-overview-chart-value {
          font-size: 11px;
          font-weight: 800;
          color: var(--accent-strong);
          min-width: 64px;
          text-align: right;
        }

        .teacher-exam-pro .exam-eval-answer-row {
          border: 1px solid rgba(226, 232, 240, 0.95);
          border-radius: 14px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.95);
          display: grid;
          gap: 8px;
        }

        @media (max-width: 720px) {
          .teacher-exam-pro .exam-detail-topbar {
            flex-direction: column;
            align-items: flex-start;
          }

          .teacher-exam-pro .exam-questions-workspace-head {
            flex-direction: column;
            align-items: flex-start;
          }

          .teacher-exam-pro .exam-questions-metrics {
            grid-template-columns: 1fr;
          }

          .teacher-exam-pro .exam-detail-summary-grid {
            grid-template-columns: 1fr;
          }

          .teacher-exam-pro .exam-eval-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .teacher-exam-pro .exam-eval-student-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .teacher-exam-pro .exam-eval-save-row {
            justify-content: flex-start;
          }

          .teacher-exam-pro .exam-list-grid {
            grid-template-columns: 1fr;
          }

          .teacher-exam-pro .exam-overview-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .teacher-exam-pro .exam-overview-metrics-inline {
            grid-template-columns: 1fr;
          }

          .teacher-exam-pro .exam-overview-chart-row {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .teacher-exam-pro .exam-overview-chart-value {
            text-align: left;
          }

          .teacher-exam-pro .exam-actions-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            overflow-x: auto;
          }
        }

        @media (min-width: 721px) and (max-width: 1080px) {
          .teacher-exam-pro .exam-list-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
      <div
      className="dashboard-page teacher-exam-pro"
      style={{
        background: "var(--page-bg)",
        minHeight: "100dvh",
        height: "auto",
        overflow: "visible",
        color: "var(--text-primary)",
        "--surface-panel": "#ffffff",
        "--surface-accent": "#f8fafc",
        "--surface-muted": "#f8fafc",
        "--surface-strong": "#ffffff",
        "--page-bg": "#ffffff",
        "--border-soft": "#e5e7eb",
        "--border-strong": "#cbd5e1",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#6b7280",
        "--accent": "#007AFB",
        "--accent-soft": "#e0e7ff",
        "--accent-strong": "#007AFB",
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
        "--shadow-soft": "0 10px 24px rgba(255, 255, 255, 0.08)",
      }}
    >
      <div
        className="google-dashboard"
        style={{
          display: "flex",
          gap: 10,
          padding: "10px",
          marginTop: "var(--topbar-height)",
          minHeight: "calc(100dvh - var(--topbar-height))",
          height: "auto",
          boxSizing: "border-box",
          overflow: "visible",
        }}
      >
        <Sidebar
          active="exam"
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

        <div
          className="exam-main-content exam-scroll-area"
          style={{
            display: "flex",
            flexDirection: "column",
            padding: 0,
            width: "100%",
            minWidth: 0,
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            scrollPaddingBottom: 140,
            marginLeft: 0,
          }}
        >
          <div style={{ padding: isMobile ? "10px 2vw 132px" : "16px 18px 132px", width: "100%", maxWidth: 1500, margin: 0 }}>
            <div className="section-header-card exam-hero" style={{ marginBottom: 14 }}>
              <h2 className="section-header-card__title" style={{ fontSize: 24 }}>School Exams Workspace</h2>
              <div className="section-header-card__meta">
                <span className="section-header-card__chip">{ "Tr. "+teacher?.name || "Teacher"}  </span>
                
                <span className="section-header-card__chip"> {selectedCourse?.subject || "All Subjects"} Exam</span>
              </div>
            </div>

            <div
              className="exam-soft-banner"
              style={{
                marginBottom: 14,
                background: "linear-gradient(135deg, #eff6ff, #f8fafc)",
                border: "1px solid var(--border-soft)",
                borderRadius: 14,
                padding: "12px 14px",
                color: "var(--text-secondary)",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Create exams quickly, publish when ready, and review student submissions in one place.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
              {[
                { label: "Total Exams", value: summary.total },
                { label: "Published", value: summary.published },
                { label: "Draft", value: summary.draft },
                { label: "Submissions", value: summary.submissions },
              ].map((item) => (
                <div
                  key={item.label}
                  className="exam-summary-card"
                  style={{
                    background: "var(--surface-panel)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: 14,
                    padding: "16px 18px",
                    boxShadow: "var(--shadow-soft)",
                  }}
                >
                  <div style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {item.label}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="exam-panel exam-scope-panel" style={{ padding: 16, marginBottom: 14 }}>
              <div className="exam-scope-grid">
                <div className="exam-scope-item" style={{ flex: "1 1 260px" }}>
                  <label className="exam-scope-label">Course</label>
                  <select
                    value={selectedCourseId}
                    onChange={(event) => setSelectedCourseId(event.target.value)}
                    className="exam-input exam-scope-select"
                  >
                    {!courses.length ? (
                      <option value="">No assigned courses found</option>
                    ) : null}
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.subject || course.name} • Grade {course.grade}
                        {course.section || ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="exam-scope-item" style={{ minWidth: 180 }}>
                  <label className="exam-scope-label">Current Scope</label>
                  <div
                    className={`exam-scope-value ${selectedCourse ? "" : "is-empty"}`}
                  >
                    {selectedCourse
                      ? `${selectedCourse.subject || selectedCourse.name}`
                      : "No course selected"}
                  </div>
                </div>
              </div>
            </div>

            <div className="exam-panel" style={{ padding: 12, marginBottom: 14 }}>
              <div className="exam-section-tabs">
                {[
                  ["create", "Create Exam"],
                  ["draft", "Draft Exam"],
                  ["leaderboard", "Students Leaderboard"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`exam-section-tab ${activeSection === key ? "is-active" : ""}`}
                    onClick={() => setActiveSection(key)}
                    style={sectionFilterChipStyle(activeSection === key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {activeSection === "create" || activeSection === "draft" ? (
              <div className="exam-panel" style={{ padding: 12, marginBottom: 14 }}>
                <div style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 700 }}>
                  Grade: {selectedCourse?.grade || "All"} • Section: {selectedCourse?.section || "All"} • Subject: {selectedCourse?.subject || selectedCourse?.name || "All"}
                </div>
              </div>
            ) : null}

            {activeSection === "create" ? (
            <form
              className="exam-panel exam-form-shell"
              onSubmit={handleSaveAssessment}
              style={{
                background: "var(--surface-panel)",
                border: "1px solid var(--border-soft)",
                borderRadius: 14,
                padding: 16,
                boxShadow: "var(--shadow-soft)",
                marginBottom: 14,
              }}
            >
              <div className="exam-form-header">
                <div className="exam-form-intro">
                  <div className="exam-form-title">{editingId ? "Edit Assessment" : "Enter New Assessment"}</div>
                  <div className="exam-form-subtitle">
                    Set the exam details first, then move into question authoring with a cleaner workflow.
                  </div>
                </div>
                {editingId ? (
                  <button
                    type="button"
                    className="exam-action-btn btn-neutral"
                    onClick={resetForm}
                    style={{
                      borderRadius: 10,
                      cursor: "pointer",
                    }}
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>

              <div className="exam-form-grid">
                <div className="exam-field exam-field-card">
                  <label className="exam-field-label">Exam title</label>
                  <input
                    className="exam-input exam-field-input"
                    value={form.title}
                    onChange={(event) => handleFormField("title", event.target.value)}
                    placeholder="Example: Unit 2 Weekly Test"
                    required
                  />
                </div>

                <div className="exam-field exam-field-card">
                  <label className="exam-field-label">Assessment type</label>
                  <select
                    className="exam-input exam-field-input"
                    value={form.type}
                    onChange={(event) => handleFormField("type", event.target.value)}
                    required
                  >
                    <option value="">Assessment type</option>
                    <option value="Quiz">Quiz</option>
                    <option value="Worksheet">Worksheet</option>
                    <option value="Exam">Exam</option>
                  </select>
                </div>

                <div className="exam-field exam-field-card">
                  <label className="exam-field-label">Pass mark (%)</label>
                  <input
                    className="exam-input exam-field-input"
                    type="number"
                    min="0"
                    max="100"
                    value={form.passPercent}
                    onChange={(event) => handleFormField("passPercent", event.target.value)}
                    required
                  />
                </div>

                <div className="exam-field exam-field-card">
                  <label className="exam-field-label">Time limit (minutes)</label>
                  <input
                    className="exam-input exam-field-input"
                    type="number"
                    min="1"
                    value={form.timeLimitMinutes}
                    onChange={(event) => handleFormField("timeLimitMinutes", event.target.value)}
                    required
                  />
                </div>

                <div className="exam-field exam-field-card">
                  <label className="exam-field-label">Due date</label>
                  <input
                    className="exam-input exam-field-input"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => handleFormField("dueDate", event.target.value)}
                  />
                </div>
              </div>

              <div className="exam-tip-banner">
                <span className="exam-tip-badge">Tip</span>
                <span>Fill basic exam info first, then add questions below.</span>
              </div>

              <div className="exam-questions-shell">
                <div
                  className="exam-questions-head"
                  role="button"
                  tabIndex={0}
                  onClick={() => setCreateQuestionsCollapsed((previous) => !previous)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setCreateQuestionsCollapsed((previous) => !previous);
                    }
                  }}
                >
                  <div className="exam-questions-title-stack">
                    <div className="exam-questions-title-row">
                      <span className="exam-questions-title">Questions Builder</span>
                      <span className="exam-questions-counter">
                        {customQuestions.filter((item) => String(item?.prompt || "").trim()).length} Added
                      </span>
                    </div>
                    <div className="exam-questions-subtitle">
                      Create clear, structured questions and define the right answer flow.
                    </div>
                  </div>
                  <div
                    className="exam-questions-toolbar"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      className="exam-action-btn btn-neutral"
                      type="button"
                      onClick={async (event) => {
                        event.stopPropagation();
                        const nextVisible = !showQuestionBankPicker;
                        setShowQuestionBankPicker(nextVisible);
                        if (nextVisible) {
                          setCreateQuestionsCollapsed(false);
                          await loadQuestionBankForSelectedCourse();
                        }
                      }}
                      style={{
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      {showQuestionBankPicker ? "Hide Bank" : "Question Bank"}
                    </button>
                    <button
                      className="exam-action-btn btn-soft"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleAddQuestionField();
                        setCreateQuestionsCollapsed(false);
                      }}
                      style={{
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      + Add Question
                    </button>
                    <button
                      className="exam-collapse-icon-btn"
                      type="button"
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        setCreateQuestionsCollapsed((previous) => !previous);
                      }}
                      aria-label={createQuestionsCollapsed ? "Expand questions" : "Collapse questions"}
                      title={createQuestionsCollapsed ? "Expand" : "Collapse"}
                    >
                      <span className="exam-collapse-icon" aria-hidden="true">
                        {createQuestionsCollapsed ? "▾" : "▴"}
                      </span>
                    </button>
                  </div>
                </div>

                {!createQuestionsCollapsed && showQuestionBankPicker ? (
                  <div className="exam-question-bank-panel">
                    <div className="exam-question-bank-head">
                      <div className="exam-question-bank-title">Add From Question Bank</div>
                      <button
                        className="exam-action-btn btn-neutral"
                        type="button"
                        onClick={loadQuestionBankForSelectedCourse}
                        disabled={questionBankLoading}
                        style={{ borderRadius: 8, cursor: "pointer" }}
                      >
                        {questionBankLoading ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>

                    <div className="exam-question-bank-controls">
                      <input
                        className="exam-input exam-field-input"
                        value={questionBankSearch}
                        onChange={(event) => setQuestionBankSearch(event.target.value)}
                        placeholder="Search question text..."
                      />
                      <select
                        className="exam-input exam-field-input"
                        value={questionBankTypeFilter}
                        onChange={(event) => setQuestionBankTypeFilter(event.target.value)}
                      >
                        <option value="all">All types</option>
                        <option value="mcq">MCQ</option>
                        <option value="true_false">True/False</option>
                        <option value="fill_blank">Fill Blank</option>
                        <option value="written">Written</option>
                      </select>
                    </div>

                    {questionBankError ? (
                      <div className="exam-question-bank-empty">{questionBankError}</div>
                    ) : questionBankLoading ? (
                      <div className="exam-question-bank-empty">Loading question bank...</div>
                    ) : questionBankVisibleItems.length === 0 ? (
                      <div className="exam-question-bank-empty">No matching questions found.</div>
                    ) : (
                      <div className="exam-question-bank-list">
                        {questionBankVisibleItems.slice(0, 40).map((bankQuestion, index) => {
                          const questionHash = buildQuestionHashKey(bankQuestion.prompt, bankQuestion.type);
                          const alreadyAdded = customQuestions.some((item) => {
                            const normalized = normalizeQuestionForEdit(item);
                            if (!normalized.prompt) return false;
                            return buildQuestionHashKey(normalized.prompt, normalized.type) === questionHash;
                          });

                          return (
                            <div key={`${bankQuestion.questionId || "qb"}_${index}`} className="exam-question-bank-item">
                              <div className="exam-question-bank-item-main">
                                <div className="exam-question-bank-item-meta">
                                  <span className="exam-question-type-pill">
                                    {String(bankQuestion.type || "written").replace("_", " ").toUpperCase()}
                                  </span>
                                  <span className="exam-question-points-pill">{bankQuestion.points || 1} pts</span>
                                </div>
                                <div className="exam-question-bank-item-text">{bankQuestion.prompt}</div>
                              </div>
                              <button
                                className="exam-action-btn btn-soft"
                                type="button"
                                disabled={alreadyAdded}
                                onClick={() => handleAddQuestionFromBank(bankQuestion)}
                                style={{ borderRadius: 8, cursor: alreadyAdded ? "not-allowed" : "pointer" }}
                              >
                                {alreadyAdded ? "Added" : "Add"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}

                {!createQuestionsCollapsed ? (
                <div className="exam-questions-list">
                  {customQuestions.map((question, index) => {
                    const questionReady =
                      String(question?.prompt || "").trim() &&
                      (question?.type !== "mcq" || ["A", "B", "C", "D"].every((key) => String(question?.options?.[key] || "").trim()));

                    return (
                      <div
                        key={`question_field_${index}`}
                        className="exam-question-editor"
                      >
                        <div className="exam-question-editor-main">
                          <div
                            className="exam-question-editor-top"
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleQuestionItemCollapse(index)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggleQuestionItemCollapse(index);
                              }
                            }}
                          >
                            <div className="exam-question-editor-top-left">
                              <span className="exam-question-chip">Question {index + 1}</span>
                              <span className={`exam-question-state ${questionReady ? "is-ready" : ""}`}>
                                {questionReady ? "Ready" : "Incomplete"}
                              </span>
                            </div>
                            <div
                              className="exam-question-editor-top-right"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                className="exam-action-btn btn-neutral exam-question-remove"
                                type="button"
                                onClick={() => handleRemoveQuestionField(index)}
                                style={{
                                  borderRadius: 8,
                                  cursor: "pointer",
                                }}
                              >
                                Remove
                              </button>
                              <span className="exam-question-editor-chevron" aria-hidden="true">
                                {questionItemCollapsedByIndex[index] ? "▾" : "▴"}
                              </span>
                            </div>
                          </div>
                          {!questionItemCollapsedByIndex[index] ? (
                          <>
                          <div className="exam-question-prompt-card">
                            <label className="exam-question-section-label">Question prompt</label>
                            <textarea
                              className="exam-input exam-field-input"
                              value={question.prompt}
                              onChange={(event) => handleQuestionFieldChange(index, "prompt", event.target.value)}
                              placeholder={`Question ${index + 1}`}
                              rows={2}
                              style={{ resize: "vertical" }}
                            />
                          </div>

                          <div className="exam-question-grid">
                            <div className="exam-question-inline-card">
                              <label className="exam-question-section-label">Question type</label>
                              <select
                                className="exam-input exam-field-input"
                                value={question.type}
                                onChange={(event) => handleQuestionFieldChange(index, "type", event.target.value)}
                              >
                                <option value="written">Written response</option>
                                <option value="mcq">Multiple choice (A-D)</option>
                                <option value="true_false">True / False</option>
                                <option value="fill_blank">Fill in the blank</option>
                              </select>
                            </div>
                            <div className="exam-question-inline-card">
                              <label className="exam-question-section-label">Points</label>
                              <input
                                className="exam-input exam-field-input"
                                type="number"
                                min="1"
                                value={question.points}
                                onChange={(event) => handleQuestionFieldChange(index, "points", event.target.value)}
                                placeholder="Points"
                              />
                            </div>
                          </div>

                          {question.type === "mcq" ? (
                            <div style={{ display: "grid", gap: 8 }}>
                              <div className="exam-question-options-card">
                                <label className="exam-question-section-label">Answer options</label>
                                <div className="exam-question-option-grid">
                                {[
                                  ["A", "Option A"],
                                  ["B", "Option B"],
                                  ["C", "Option C"],
                                  ["D", "Option D"],
                                ].map(([key, placeholder]) => (
                                  <div key={`mcq_${index}_${key}`} className="exam-question-option-item">
                                    <label className="exam-question-section-label">Option {key}</label>
                                    <input
                                      className="exam-input exam-field-input"
                                      value={question.options?.[key] || ""}
                                      onChange={(event) => handleQuestionOptionChange(index, key, event.target.value)}
                                      placeholder={placeholder}
                                    />
                                  </div>
                                ))}
                                </div>
                              </div>
                              <div className="exam-question-answer-card">
                                <label className="exam-question-section-label">Correct answer</label>
                                <select
                                  className="exam-input exam-field-input"
                                  value={question.correctAnswer}
                                  onChange={(event) => handleQuestionFieldChange(index, "correctAnswer", event.target.value)}
                                  style={{ maxWidth: 220 }}
                                >
                                  <option value="">Correct Answer</option>
                                  <option value="A">A</option>
                                  <option value="B">B</option>
                                  <option value="C">C</option>
                                  <option value="D">D</option>
                                </select>
                              </div>
                            </div>
                          ) : null}

                          {question.type === "true_false" ? (
                            <div className="exam-question-answer-card">
                              <label className="exam-question-section-label">Correct answer</label>
                              <select
                                className="exam-input exam-field-input"
                                value={question.correctAnswer}
                                onChange={(event) => handleQuestionFieldChange(index, "correctAnswer", event.target.value)}
                                style={{ maxWidth: 220 }}
                              >
                                <option value="">Correct Answer</option>
                                <option value="true">True</option>
                                <option value="false">False</option>
                              </select>
                            </div>
                          ) : null}

                          {question.type === "fill_blank" ? (
                            <div className="exam-question-answer-card">
                              <label className="exam-question-section-label">Correct answer</label>
                              <input
                                className="exam-input exam-field-input"
                                value={question.correctAnswer}
                                onChange={(event) => handleQuestionFieldChange(index, "correctAnswer", event.target.value)}
                                placeholder="Correct answer"
                                style={{ maxWidth: 320 }}
                              />
                            </div>
                          ) : null}
                          </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                ) : null}
              </div>

              <div className="exam-form-actions">
                <button
                  className="exam-action-btn btn-primary"
                  type="submit"
                  disabled={Boolean(busyAction) || !isAssessmentFormComplete}
                  style={{
                    borderRadius: 10,
                    cursor: Boolean(busyAction) || !isAssessmentFormComplete ? "not-allowed" : "pointer",
                  }}
                >
                  {editingId ? "Update Assessment" : "Create Assessment"}
                </button>
                {!busyAction && !isAssessmentFormComplete ? (
                  <span style={{ color: "#b91c1c", fontWeight: 700, fontSize: 13 }}>
                    {assessmentFormValidationHint}
                  </span>
                ) : null}
                {actionMessage ? (
                  <span style={{ color: "var(--text-secondary)", fontWeight: 700, fontSize: 13 }}>{actionMessage}</span>
                ) : null}
              </div>
            </form>
            ) : null}

            {activeSection === "leaderboard" ? (
              <div className="exam-panel" style={{ padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 10 }}>
                  Students Leaderboard
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  Grade: {selectedCourse?.grade || "All"} • Section: {selectedCourse?.section || "All"} • Subject: {selectedCourse?.subject || selectedCourse?.name || "All"}
                </div>
                {leaderboardRows.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontWeight: 700 }}>No student results yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {leaderboardRows.map((row, index) => (
                      <div key={row.studentId} className="exam-metric-tile" style={{ padding: "10px 12px", display: "grid", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <img
                              src={getStudentProfileImage(row.studentId)}
                              alt={getStudentDisplayName(row.studentId)}
                              style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border-soft)", flex: "0 0 42px" }}
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = "/default-profile.png";
                              }}
                            />
                            <strong style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              #{index + 1} {getStudentDisplayName(row.studentId)}
                            </strong>
                          </div>
                          <strong>{row.averagePercent}% avg</strong>
                        </div>
                        <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                          Attempts: {row.attempts} • Best: {row.bestPercent}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {activeSection === "evaluate" ? (
              <div style={{ display: "grid", gap: 12, marginBottom: 14 }}>
                {sectionFilteredRecords.length === 0 ? (
                  <div className="exam-panel" style={{ padding: 14 }}>
                    <div style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                      No exams with student submissions yet.
                    </div>
                  </div>
                ) : (
                  sectionFilteredRecords.map((record) => (
                    <div key={`eval_${record.id}`} className="exam-panel exam-eval-panel">
                      <div className="exam-eval-header">
                        <div>
                          <div className="exam-eval-title">{record.title}</div>
                          <div className="exam-eval-subtitle">
                            {record.courseId} • Submissions: {record.submissionCount}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="exam-action-btn btn-soft"
                          onClick={() => loadEvaluationForRecord(record)}
                          disabled={loadingEvaluationExamId === record.id}
                        >
                          {loadingEvaluationExamId === record.id ? "Loading..." : "Open Evaluation"}
                        </button>
                      </div>

                      {(evaluationByExam[record.id] || []).length > 0 ? (
                        <div style={{ display: "grid", gap: 10 }}>
                          {(evaluationByExam[record.id] || []).map((studentRow) => (
                            <div key={`${record.id}_${studentRow.studentId}`} className="exam-eval-student-card">
                              <div className="exam-eval-student-header">
                                <strong className="exam-eval-student-name">
                                  {studentRow.studentName || getStudentDisplayName(studentRow.studentId)}
                                </strong>
                                <span className="exam-eval-student-score">Current score: {studentRow.currentScore}</span>
                              </div>

                              {(studentRow.answers || []).length === 0 ? (
                                <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>No answers submitted.</div>
                              ) : (
                                (studentRow.answers || []).map((answerRow, answerIndex) => {
                                  const answerKey = `${record.id}__${studentRow.studentId}__${answerRow.questionId}`;
                                  const markValue = evaluationMarks[answerKey];
                                  const hasSystemCorrectAnswer = Boolean(String(answerRow.correctAnswer || "").trim());
                                  return (
                                    <div key={`${answerKey}_${answerIndex}`} className="exam-eval-answer-row">
                                      <div className="exam-eval-answer-title">
                                        Q{answerIndex + 1}: {answerRow.prompt}
                                      </div>
                                      <div className="exam-eval-answer-meta">
                                        <div>
                                          Student: <strong>{answerRow.studentAnswer || "--"}</strong>
                                        </div>
                                        <div>
                                          Correct: <strong>{answerRow.correctAnswer || "--"}</strong>
                                        </div>
                                      </div>
                                      {!hasSystemCorrectAnswer ? (
                                        <div className="exam-eval-mark-actions">
                                          <button
                                            type="button"
                                            className={`exam-action-btn ${markValue === true ? "btn-success" : "btn-neutral"}`}
                                            onClick={() => handleMarkAnswer(record.id, studentRow.studentId, answerRow.questionId, true)}
                                          >
                                            Right
                                          </button>
                                          <button
                                            type="button"
                                            className={`exam-action-btn ${markValue === false ? "btn-danger" : "btn-neutral"}`}
                                            onClick={() => handleMarkAnswer(record.id, studentRow.studentId, answerRow.questionId, false)}
                                          >
                                            Wrong
                                          </button>
                                        </div>
                                      ) : (
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
                                          Auto-marked from correct answer key.
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}

                              <div className="exam-eval-save-row">
                                <button
                                  type="button"
                                  className="exam-action-btn btn-primary"
                                  onClick={() => handleSaveEvaluation(record, studentRow)}
                                  disabled={savingEvaluationKey === `${record.id}__${studentRow.studentId}`}
                                >
                                  {savingEvaluationKey === `${record.id}__${studentRow.studentId}` ? "Saving..." : "Save Evaluation"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {activeSection !== "leaderboard" && activeSection !== "evaluate" ? (
            <div className="exam-list-grid">
              {loading ? (
                <div
                  className="exam-list-fullwidth"
                  style={{
                    gridColumn: "1 / -1",
                    background: "var(--surface-panel)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: 14,
                    padding: 18,
                    boxShadow: "var(--shadow-soft)",
                    color: "var(--text-secondary)",
                    fontWeight: 700,
                  }}
                >
                  Loading SchoolExams records...
                </div>
              ) : error ? (
                <div
                  className="exam-list-fullwidth"
                  style={{
                    gridColumn: "1 / -1",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 14,
                    padding: 18,
                    color: "#b91c1c",
                    fontWeight: 700,
                  }}
                >
                  {error}
                </div>
              ) : sectionFilteredRecords.length === 0 ? (
                <div
                  className="exam-list-fullwidth"
                  style={{
                    gridColumn: "1 / -1",
                    background: "var(--surface-panel)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: 14,
                    padding: 18,
                    boxShadow: "var(--shadow-soft)",
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
                    No exams found for this section
                  </div>
                  <div style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                    Switch section or create a new exam.
                  </div>
                </div>
              ) : (
                sectionFilteredRecords.map((record) => (
                  <div
                    key={record.id}
                    className="exam-record-card"
                    style={{
                      background: "var(--surface-panel)",
                      border: "1px solid var(--border-soft)",
                      borderRadius: 16,
                      padding: 18,
                      boxShadow: "var(--shadow-soft)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div className="exam-card-clickable">
                      <div className="exam-card-topline">
                        <span className="exam-card-course-due-line">
                          <span>{record.courseId}</span>
                          <span>•</span>
                          <span>Due {formatDate(record.dueDate)}</span>
                        </span>
                      </div>

                      <div className="exam-record-header">
                        <div>
                          <div className="exam-record-title">{record.title}</div>
                          <div className="exam-record-type">{record.type}</div>
                        </div>
                        <div
                          className={`exam-status-chip ${
                            String(record.status || "").toLowerCase() === "removed"
                              ? "is-removed"
                              : record.published
                              ? "is-active"
                              : "is-draft"
                          }`}
                        >
                          {record.status}
                        </div>
                      </div>

                      <div className="exam-card-summary-row">
                        <button
                          className="exam-action-btn btn-soft exam-card-toggle"
                          type="button"
                          onClick={() => openExamDetail(record.id)}
                          style={{ borderRadius: 10, cursor: "pointer" }}
                        >
                          Open Details
                          <span
                            aria-hidden="true"
                            className="exam-card-toggle-icon"
                          >
                            ▾
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            ) : null}

            {selectedExamDetail ? (
              <div className="exam-detail-overlay" onClick={closeExamDetail}>
                <div className="exam-detail-panel" onClick={(event) => event.stopPropagation()}>
                  <div className="exam-detail-shell">
                    <div className="exam-detail-topbar">
                      <div className="exam-detail-topbar-copy">
                        <div className="exam-detail-topbar-kicker">Assessment Workspace</div>
                        <div className="exam-detail-topbar-title">Exam Detail Workspace</div>
                      </div>
                      <button
                        className="exam-action-btn btn-neutral exam-detail-close"
                        type="button"
                        onClick={closeExamDetail}
                        style={{ cursor: "pointer" }}
                      >
                        Close Detail
                      </button>
                    </div>

                    <div className="exam-detail-header">
                      <div className="exam-detail-hero">
                        <div className="exam-detail-maincopy">
                          <div className="exam-card-topline">
                            <div className="exam-card-topline-group">
                              <span className="exam-top-badge">{selectedExamDetail.courseId}</span>
                              <span className="exam-top-badge">Due {formatDate(selectedExamDetail.dueDate)}</span>
                            </div>
                            <div className="exam-card-topline-note">Created {formatDate(selectedExamDetail.createdAt)}</div>
                          </div>
                          <div className="exam-detail-status-row">
                            <div className="exam-detail-title-row">
                              <div className="exam-detail-title">{selectedExamDetail.title}</div>
                              <div className="exam-detail-subtitle">{selectedExamDetail.type} • Review and controls</div>
                            </div>
                            <span
                              className={`exam-status-chip ${
                                String(selectedExamDetail.status || "").toLowerCase() === "removed"
                                  ? "is-removed"
                                  : selectedExamDetail.published
                                  ? "is-active"
                                  : "is-draft"
                              }`}
                            >
                              {selectedExamDetail.status}
                            </span>
                          </div>
                        </div>

                        <div className="exam-detail-summary-grid">
                          <div className="exam-detail-summary-card">
                            <div className="exam-detail-summary-label">Questions</div>
                            <div className="exam-detail-summary-value">{selectedExamDetail.questionCount}</div>
                            <div className="exam-detail-summary-helper">Items prepared</div>
                          </div>
                          <div className="exam-detail-summary-card">
                            <div className="exam-detail-summary-label">Submissions</div>
                            <div className="exam-detail-summary-value">{selectedExamDetail.submissionCount}</div>
                            <div className="exam-detail-summary-helper">Student attempts</div>
                          </div>
                          <div className="exam-detail-summary-card">
                            <div className="exam-detail-summary-label">Pass Mark</div>
                            <div className="exam-detail-summary-value">{selectedExamDetail.passPercent}%</div>
                            <div className="exam-detail-summary-helper">Required result</div>
                          </div>
                          <div className="exam-detail-summary-card">
                            <div className="exam-detail-summary-label">Type</div>
                            <div className="exam-detail-summary-value">{selectedExamDetail.type}</div>
                            <div className="exam-detail-summary-helper">Assessment format</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="exam-detail-filters">
                      {[
                        ["overview", "Overview"],
                        ["questions", "Questions"],
                        ["submissions", "Submissions"],
                        ["actions", "Actions"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          className={`exam-detail-filter-btn ${detailPopupFilter === key ? "is-active" : ""}`}
                          onClick={() => setDetailPopupFilter(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="exam-card-details">
                      {detailPopupFilter === "overview" ? (
                      <div className="exam-expand-panel is-detail-tab">
                      <div className="exam-expand-header">
                        <div className="exam-expand-title">Overview</div>
                        <div className="exam-expand-count">{selectedExamDetail.status}</div>
                      </div>
                      <div className="exam-expand-body">
                      <div className="exam-overview-metrics-inline">
                        <div className="exam-overview-metric-inline">
                          <span className="exam-overview-metric-inline-label">Questions</span>
                          <span className="exam-overview-metric-inline-value">{selectedExamDetail.questionCount}</span>
                          <span className="exam-overview-metric-inline-helper">Prepared for this assessment</span>
                        </div>
                        <div className="exam-overview-metric-inline">
                          <span className="exam-overview-metric-inline-label">Points</span>
                          <span className="exam-overview-metric-inline-value">{selectedExamDetail.totalPoints}</span>
                          <span className="exam-overview-metric-inline-helper">Total available score</span>
                        </div>
                        <div className="exam-overview-metric-inline">
                          <span className="exam-overview-metric-inline-label">Submissions</span>
                          <span className="exam-overview-metric-inline-value">{selectedExamDetail.submissionCount}</span>
                          <span className="exam-overview-metric-inline-helper">Student attempts received</span>
                        </div>
                        <div className="exam-overview-metric-inline">
                          <span className="exam-overview-metric-inline-label">Pass Mark</span>
                          <span className="exam-overview-metric-inline-value">{selectedExamDetail.passPercent}%</span>
                          <span className="exam-overview-metric-inline-helper">Minimum required result</span>
                        </div>
                      </div>

                      <div className="exam-overview-analytics">
                        <div className="exam-overview-analytics-head">
                          <div className="exam-overview-analytics-title">Student Point Analytics</div>
                          <div className="exam-overview-legend">
                            <span className="exam-overview-legend-chip is-high">High ≥ 75%</span>
                            <span className="exam-overview-legend-chip is-mid">Mid 50–74%</span>
                            <span className="exam-overview-legend-chip is-low">Low &lt; 50%</span>
                          </div>
                        </div>
                        {examOverviewAnalytics.hasData ? (
                          <>
                            <div className="exam-overview-stats-grid">
                              <div className="exam-overview-stat-tile">
                                <div className="exam-overview-stat-label">Average</div>
                                <div className="exam-overview-stat-value">{examOverviewAnalytics.averagePercent}%</div>
                              </div>
                              <div className="exam-overview-stat-tile">
                                <div className="exam-overview-stat-label">Highest</div>
                                <div className="exam-overview-stat-value">{examOverviewAnalytics.highestPercent}%</div>
                              </div>
                              <div className="exam-overview-stat-tile">
                                <div className="exam-overview-stat-label">Lowest</div>
                                <div className="exam-overview-stat-value">{examOverviewAnalytics.lowestPercent}%</div>
                              </div>
                              <div className="exam-overview-stat-tile">
                                <div className="exam-overview-stat-label">Pass Rate</div>
                                <div className="exam-overview-stat-value">{examOverviewAnalytics.passRate}%</div>
                              </div>
                            </div>

                            <div className="exam-overview-chart">
                              {examOverviewAnalytics.chartRows.map((row, index) => (
                                <div key={`${selectedExamDetail.id}_${row.studentId}`} className="exam-overview-chart-row">
                                  <span className="exam-overview-rank">{index + 1}</span>
                                  <div className="exam-overview-chart-label">{row.studentName}</div>
                                  <div className="exam-overview-chart-track">
                                    <div
                                      className={`exam-overview-chart-fill ${
                                        row.percent >= 75 ? "is-high" : row.percent >= 50 ? "is-mid" : "is-low"
                                      }`}
                                      style={{ width: `${Math.max(2, row.percent)}%` }}
                                    />
                                  </div>
                                  <div className="exam-overview-chart-value">{Math.round(row.percent)}% • {row.scoreLabel}</div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                            No submission points yet. Analytics will appear after students submit.
                          </div>
                        )}
                      </div>

                      </div>
                      </div>
                      ) : null}

                      {detailPopupFilter === "actions" ? (
                      <div className="exam-expand-panel is-detail-tab">
                      <div className="exam-expand-header">
                        <div className="exam-expand-title">Actions</div>
                        <div className="exam-expand-count">Manage this assessment</div>
                      </div>
                      <div className="exam-expand-body">
                      <div className="exam-actions-hero">
                        <div>
                          <div className="exam-actions-hero-title">Assessment Controls</div>
                          <div className="exam-actions-hero-sub">Edit, publish, or review this assessment quickly.</div>
                        </div>
                        <span className={`exam-status-chip ${selectedExamDetail.published ? "is-active" : "is-draft"}`}>
                          {selectedExamDetail.published ? "Published" : "Draft"}
                        </span>
                      </div>

                      <div className="exam-actions-grid">
                        <div className="exam-action-tile">
                          <div className="exam-action-tile-label">Edit Content</div>
                          <button
                            className="exam-action-btn btn-neutral"
                            type="button"
                            onClick={async () => {
                              if (selectedExamDetail?.courseId) {
                                setSelectedCourseId(selectedExamDetail.courseId);
                              }
                              await handleEditAssessment(selectedExamDetail);
                              setShowEditQuestionPopup(true);
                            }}
                            disabled={Boolean(busyAction)}
                            style={{ borderRadius: 10, cursor: "pointer" }}
                          >
                            Edit
                          </button>
                        </div>

                        <div className="exam-action-tile">
                          <div className="exam-action-tile-label">Publish State</div>
                          <button
                            className={`exam-action-btn ${selectedExamDetail.published ? "btn-warning" : "btn-success"}`}
                            type="button"
                            onClick={() => handleTogglePublish(selectedExamDetail)}
                            disabled={Boolean(busyAction)}
                            style={{ borderRadius: 10, cursor: "pointer" }}
                          >
                            {busyAction === selectedExamDetail.id
                              ? "Saving..."
                              : selectedExamDetail.published
                              ? "Unpublish"
                              : "Publish"}
                          </button>
                        </div>

                        <div className="exam-action-tile">
                          <div className="exam-action-tile-label">Danger Zone</div>
                          <button
                            className="exam-action-btn btn-danger"
                            type="button"
                            onClick={() => {
                              openDeleteAssessmentPopup(selectedExamDetail);
                            }}
                            disabled={Boolean(busyAction)}
                            style={{ borderRadius: 10, cursor: "pointer" }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      </div>
                      </div>
                      ) : null}

                      {detailPopupFilter === "questions" ? (
                        <div className="exam-expand-panel is-detail-tab">
                          <div className="exam-expand-header">
                            <div className="exam-expand-title">Question Preview</div>
                            <div className="exam-expand-count">
                              {(questionPreviewByAssessment?.[selectedExamDetail.id] || []).length} items
                            </div>
                          </div>
                          <div className="exam-expand-body">
                          <div className="exam-questions-workspace">
                            <div className="exam-questions-workspace-head">
                              <div>
                                <div className="exam-questions-workspace-title">Questions in this assessment</div>
                                <div className="exam-questions-workspace-sub">Clear read-only preview for quick review before publishing.</div>
                              </div>
                              <div className="exam-questions-workspace-count">
                                {(questionPreviewByAssessment?.[selectedExamDetail.id] || []).length} Questions
                              </div>
                            </div>

                            <div className="exam-questions-metrics">
                              <div className="exam-questions-metric">
                                <div className="exam-questions-metric-label">Question Count</div>
                                <div className="exam-questions-metric-value">
                                  {(questionPreviewByAssessment?.[selectedExamDetail.id] || []).length}
                                </div>
                              </div>
                              <div className="exam-questions-metric">
                                <div className="exam-questions-metric-label">Total Points</div>
                                <div className="exam-questions-metric-value">{selectedExamDetail.totalPoints || 0}</div>
                              </div>
                              <div className="exam-questions-metric">
                                <div className="exam-questions-metric-label">Assessment Type</div>
                                <div className="exam-questions-metric-value">{selectedExamDetail.type || "Exam"}</div>
                              </div>
                            </div>

                            {questionPreviewErrorByAssessment?.[selectedExamDetail.id] ? (
                              <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                                {questionPreviewErrorByAssessment[selectedExamDetail.id]}
                              </div>
                            ) : (questionPreviewByAssessment?.[selectedExamDetail.id] || []).length === 0 ? (
                              <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>No questions available.</div>
                            ) : (
                              <div className="exam-question-list">
                                {(questionPreviewByAssessment?.[selectedExamDetail.id] || []).map((question, index) => (
                                  <div
                                    key={`${selectedExamDetail.id}_question_${index}`}
                                    className="exam-question-preview-item"
                                  >
                                    <div className="exam-question-meta-row">
                                      <div className="exam-question-meta-left">
                                        <span className="exam-question-index">{index + 1}</span>
                                        <span className="exam-question-type-pill">
                                          {String(question.type || "written").replace("_", " ").toUpperCase()}
                                        </span>
                                      </div>
                                      <span className="exam-question-points-pill">{question.points} pts</span>
                                    </div>

                                    <div className="exam-question-text">{question.prompt}</div>

                                    {question.type === "mcq" || question.type === "true_false" ? (
                                      <div className="exam-choice-list">
                                        <div className="exam-choice-list-title">Choices</div>
                                        {Object.entries(question.options || {})
                                          .filter(([, value]) => String(value || "").trim())
                                          .map(([key, value]) => (
                                            <div
                                              key={`${selectedExamDetail.id}_question_${index}_${key}`}
                                              className={`exam-choice-item ${
                                                String(question.correctAnswer || "").trim().toUpperCase() === String(key).toUpperCase()
                                                  ? "is-correct"
                                                  : ""
                                              }`}
                                            >
                                              {key}. {String(value || "")}
                                            </div>
                                          ))}
                                      </div>
                                    ) : null}
                                    {question.type === "fill_blank" || question.type === "mcq" || question.type === "true_false" ? (
                                      <div className="exam-answer-row">
                                        Correct Answer: <strong>{String(question.correctAnswer || "--")}</strong>
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          </div>
                        </div>
                      ) : null}

                      {detailPopupFilter === "submissions" ? (
                        <div className="exam-expand-panel is-detail-tab">
                          <div className="exam-expand-header">
                            <div className="exam-expand-title">Student Submissions</div>
                            <div className="exam-expand-count">{selectedExamDetail.submissionEntries.length} records</div>
                          </div>
                          <div className="exam-expand-body">
                          {loadingEvaluationExamId === selectedExamDetail.id ? (
                            <div style={{ color: "var(--text-muted)", fontWeight: 700 }}>Loading submissions...</div>
                          ) : selectedExamDetail.submissionEntries.length === 0 ? (
                            <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>No submissions yet.</div>
                          ) : (
                            ((evaluationByExam[selectedExamDetail.id] || []).length > 0
                              ? evaluationByExam[selectedExamDetail.id]
                              : selectedExamDetail.submissionEntries.map((entry) => ({
                                  studentId: entry.studentId,
                                  studentName: getStudentDisplayName(entry.studentId),
                                  submittedAt: entry.submittedAt,
                                  answers: [],
                                  currentScore: Number(entry.score || 0),
                                }))).map((studentRow) => {
                              const pendingManualCount = (studentRow.answers || []).reduce((count, answerRow) => {
                                const hasSystemCorrectAnswer = Boolean(String(answerRow.correctAnswer || "").trim());
                                if (hasSystemCorrectAnswer) return count;
                                const answerKey = `${selectedExamDetail.id}__${studentRow.studentId}__${answerRow.questionId}`;
                                const markValue = evaluationMarks[answerKey];
                                return markValue === true || markValue === false ? count : count + 1;
                              }, 0);

                              return (
                              <div key={`${selectedExamDetail.id}_${studentRow.studentId}`} className="exam-eval-student-card">
                                <button
                                  type="button"
                                  className="exam-eval-student-header"
                                  onClick={() =>
                                    setSelectedSubmissionStudentId((previous) =>
                                      previous === studentRow.studentId ? "" : studentRow.studentId
                                    )
                                  }
                                  style={{
                                    width: "100%",
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                    textAlign: "left",
                                  }}
                                >
                                  <strong className="exam-eval-student-name">
                                    {studentRow.studentName || getStudentDisplayName(studentRow.studentId)}
                                  </strong>
                                  <span className="exam-eval-student-score">
                                    Score: {Number(studentRow.currentScore || 0)} • {formatDate(studentRow.submittedAt)}
                                  </span>
                                </button>

                                {selectedSubmissionStudentId === studentRow.studentId ? (
                                  <>
                                    {(studentRow.answers || []).length === 0 ? (
                                      <div style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                                        No answer details found for this submission.
                                      </div>
                                    ) : (
                                      (studentRow.answers || []).map((answerRow, answerIndex) => {
                                        const answerKey = `${selectedExamDetail.id}__${studentRow.studentId}__${answerRow.questionId}`;
                                        const markValue = evaluationMarks[answerKey];
                                        const hasSystemCorrectAnswer = Boolean(String(answerRow.correctAnswer || "").trim());

                                        return (
                                          <div key={`${answerKey}_${answerIndex}`} className="exam-eval-answer-row">
                                            <div className="exam-eval-answer-title">
                                              Q{answerIndex + 1}: {answerRow.prompt}
                                            </div>
                                            <div className="exam-eval-answer-meta">
                                              <div>
                                                Student Answer: <strong>{answerRow.studentAnswer || "--"}</strong>
                                              </div>
                                              <div>
                                                Correct Answer: <strong>{answerRow.correctAnswer || "--"}</strong>
                                              </div>
                                              <div>
                                                Question Points: <strong>{Math.max(1, Number(answerRow.points || 1))}</strong>
                                              </div>
                                            </div>

                                            {!hasSystemCorrectAnswer ? (
                                              <div className="exam-eval-mark-actions">
                                                <button
                                                  type="button"
                                                  className={`exam-action-btn ${markValue === true ? "btn-success" : "btn-neutral"}`}
                                                  onClick={() =>
                                                    handleMarkAnswer(
                                                      selectedExamDetail.id,
                                                      studentRow.studentId,
                                                      answerRow.questionId,
                                                      true
                                                    )
                                                  }
                                                >
                                                  Right
                                                </button>
                                                <button
                                                  type="button"
                                                  className={`exam-action-btn ${markValue === false ? "btn-danger" : "btn-neutral"}`}
                                                  onClick={() =>
                                                    handleMarkAnswer(
                                                      selectedExamDetail.id,
                                                      studentRow.studentId,
                                                      answerRow.questionId,
                                                      false
                                                    )
                                                  }
                                                >
                                                  Wrong
                                                </button>
                                              </div>
                                            ) : (
                                              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
                                                Auto-marked from system answer key.
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}

                                    {pendingManualCount > 0 ? (
                                      <div style={{ fontSize: 12, fontWeight: 800, color: "#b45309" }}>
                                        {pendingManualCount} answer{pendingManualCount > 1 ? "s" : ""} still need Right/Wrong review before final save.
                                      </div>
                                    ) : null}

                                    <div className="exam-eval-save-row">
                                      <button
                                        type="button"
                                        className="exam-action-btn btn-primary"
                                        onClick={() => handleSaveEvaluation(selectedExamDetail, studentRow)}
                                        disabled={savingEvaluationKey === `${selectedExamDetail.id}__${studentRow.studentId}`}
                                      >
                                        {savingEvaluationKey === `${selectedExamDetail.id}__${studentRow.studentId}`
                                          ? "Saving..."
                                          : "Save Evaluation"}
                                      </button>
                                    </div>
                                  </>
                                ) : null}
                              </div>
                              );
                            })
                          )}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {showEditQuestionPopup && selectedExamDetail && editingId === selectedExamDetail.id ? (
                      <div className="exam-inline-edit-overlay" onClick={() => setShowEditQuestionPopup(false)}>
                        <div className="exam-inline-edit-card" onClick={(event) => event.stopPropagation()}>
                          <div className="exam-inline-edit-topbar">
                            <div>
                              <div className="exam-inline-edit-title">Edit Assessment Questions</div>
                              <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700 }}>
                                Update questions and settings for {selectedExamDetail.title}
                              </div>
                            </div>
                            <button
                              className="exam-action-btn btn-neutral"
                              type="button"
                              onClick={() => {
                                setShowEditQuestionPopup(false);
                                resetForm();
                              }}
                              style={{ borderRadius: 10, cursor: "pointer" }}
                            >
                              Close
                            </button>
                          </div>

                          <form onSubmit={handleSaveAssessment} style={{ display: "grid", gap: 12 }}>
                            <div className="exam-form-grid" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
                              <div className="exam-field exam-field-card">
                                <label className="exam-field-label">Exam title</label>
                                <input
                                  className="exam-input exam-field-input"
                                  value={form.title}
                                  onChange={(event) => handleFormField("title", event.target.value)}
                                  required
                                />
                              </div>

                              <div className="exam-field exam-field-card">
                                <label className="exam-field-label">Assessment type</label>
                                <input
                                  className="exam-input exam-field-input"
                                  value={form.type}
                                  onChange={(event) => handleFormField("type", event.target.value)}
                                  required
                                />
                              </div>

                              <div className="exam-field exam-field-card">
                                <label className="exam-field-label">Pass mark (%)</label>
                                <input
                                  className="exam-input exam-field-input"
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={form.passPercent}
                                  onChange={(event) => handleFormField("passPercent", event.target.value)}
                                  required
                                />
                              </div>

                              <div className="exam-field exam-field-card">
                                <label className="exam-field-label">Time limit (minutes)</label>
                                <input
                                  className="exam-input exam-field-input"
                                  type="number"
                                  min="1"
                                  value={form.timeLimitMinutes}
                                  onChange={(event) => handleFormField("timeLimitMinutes", event.target.value)}
                                  required
                                />
                              </div>

                              <div className="exam-field exam-field-card">
                                <label className="exam-field-label">Due date</label>
                                <input
                                  className="exam-input exam-field-input"
                                  type="date"
                                  value={form.dueDate}
                                  onChange={(event) => handleFormField("dueDate", event.target.value)}
                                />
                              </div>
                            </div>

                            <div className="exam-questions-shell" style={{ marginTop: 0 }}>
                              <div
                                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8, cursor: "pointer" }}
                                role="button"
                                tabIndex={0}
                                onClick={() => setEditQuestionsCollapsed((previous) => !previous)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setEditQuestionsCollapsed((previous) => !previous);
                                  }
                                }}
                              >
                                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-secondary)" }}>
                                  Questions ({customQuestions.filter((item) => String(item?.prompt || "").trim()).length} added)
                                </div>
                                <div
                                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {!editQuestionsCollapsed ? (
                                    <button
                                      className="exam-action-btn btn-soft"
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleAddQuestionField();
                                      }}
                                      style={{ borderRadius: 8, cursor: "pointer" }}
                                    >
                                      Add Question
                                    </button>
                                  ) : null}
                                  <button
                                    className="exam-collapse-icon-btn"
                                    type="button"
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setEditQuestionsCollapsed((previous) => !previous);
                                    }}
                                    aria-label={editQuestionsCollapsed ? "Expand questions" : "Collapse questions"}
                                    title={editQuestionsCollapsed ? "Expand" : "Collapse"}
                                  >
                                    <span className="exam-collapse-icon" aria-hidden="true">
                                      {editQuestionsCollapsed ? "▾" : "▴"}
                                    </span>
                                  </button>
                                </div>
                              </div>

                              {!editQuestionsCollapsed ? (
                              <div style={{ display: "grid", gap: 8 }}>
                                {customQuestions.map((question, index) => (
                                  <div key={`edit_question_field_${index}`} className="exam-question-editor">
                                    <div className="exam-question-editor-main">
                                      <div
                                        className="exam-question-editor-top"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => toggleQuestionItemCollapse(index)}
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            toggleQuestionItemCollapse(index);
                                          }
                                        }}
                                      >
                                        <span className="exam-question-chip">Question {index + 1}</span>
                                        <span className="exam-question-editor-chevron" aria-hidden="true">
                                          {questionItemCollapsedByIndex[index] ? "▾" : "▴"}
                                        </span>
                                      </div>

                                      {!questionItemCollapsedByIndex[index] ? (
                                      <>
                                      <div className="exam-question-prompt-card">
                                        <label className="exam-question-section-label">Question prompt</label>
                                        <textarea
                                          className="exam-input exam-field-input"
                                          value={question.prompt}
                                          onChange={(event) => handleQuestionFieldChange(index, "prompt", event.target.value)}
                                          rows={2}
                                          style={{ resize: "vertical" }}
                                        />
                                      </div>

                                      <div className="exam-question-grid">
                                        <div className="exam-question-inline-card">
                                          <label className="exam-question-section-label">Question type</label>
                                          <select
                                            className="exam-input exam-field-input"
                                            value={question.type}
                                            onChange={(event) => handleQuestionFieldChange(index, "type", event.target.value)}
                                          >
                                            <option value="written">Written response</option>
                                            <option value="mcq">Multiple choice (A-D)</option>
                                            <option value="true_false">True / False</option>
                                            <option value="fill_blank">Fill in the blank</option>
                                          </select>
                                        </div>
                                        <div className="exam-question-inline-card">
                                          <label className="exam-question-section-label">Points</label>
                                          <input
                                            className="exam-input exam-field-input"
                                            type="number"
                                            min="1"
                                            value={question.points}
                                            onChange={(event) => handleQuestionFieldChange(index, "points", event.target.value)}
                                          />
                                        </div>
                                      </div>

                                      {question.type === "mcq" ? (
                                        <div style={{ display: "grid", gap: 8 }}>
                                          <div className="exam-question-options-card">
                                            <label className="exam-question-section-label">Answer options</label>
                                            <div className="exam-question-option-grid">
                                              {[["A", "Option A"], ["B", "Option B"], ["C", "Option C"], ["D", "Option D"]].map(([key, placeholder]) => (
                                                <div key={`edit_mcq_${index}_${key}`} className="exam-question-option-item">
                                                  <label className="exam-question-section-label">Option {key}</label>
                                                  <input
                                                    className="exam-input exam-field-input"
                                                    value={question.options?.[key] || ""}
                                                    onChange={(event) => handleQuestionOptionChange(index, key, event.target.value)}
                                                    placeholder={placeholder}
                                                  />
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                          <div className="exam-question-answer-card">
                                            <label className="exam-question-section-label">Correct answer</label>
                                            <select
                                              className="exam-input exam-field-input"
                                              value={question.correctAnswer}
                                              onChange={(event) => handleQuestionFieldChange(index, "correctAnswer", event.target.value)}
                                              style={{ maxWidth: 220 }}
                                            >
                                              <option value="">Correct Answer</option>
                                              <option value="A">A</option>
                                              <option value="B">B</option>
                                              <option value="C">C</option>
                                              <option value="D">D</option>
                                            </select>
                                          </div>
                                        </div>
                                      ) : null}

                                      {question.type === "true_false" ? (
                                        <div className="exam-question-answer-card">
                                          <label className="exam-question-section-label">Correct answer</label>
                                          <select
                                            className="exam-input exam-field-input"
                                            value={question.correctAnswer}
                                            onChange={(event) => handleQuestionFieldChange(index, "correctAnswer", event.target.value)}
                                            style={{ maxWidth: 220 }}
                                          >
                                            <option value="">Correct Answer</option>
                                            <option value="true">True</option>
                                            <option value="false">False</option>
                                          </select>
                                        </div>
                                      ) : null}

                                      {question.type === "fill_blank" ? (
                                        <div className="exam-question-answer-card">
                                          <label className="exam-question-section-label">Correct answer</label>
                                          <input
                                            className="exam-input exam-field-input"
                                            value={question.correctAnswer}
                                            onChange={(event) => handleQuestionFieldChange(index, "correctAnswer", event.target.value)}
                                            style={{ maxWidth: 320 }}
                                          />
                                        </div>
                                      ) : null}
                                      </>
                                      ) : null}
                                    </div>

                                    <button
                                      className="exam-action-btn btn-neutral exam-question-remove"
                                      type="button"
                                      onClick={() => handleRemoveQuestionField(index)}
                                      style={{ borderRadius: 8, cursor: "pointer" }}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                              ) : null}
                            </div>

                            <div className="exam-form-actions exam-inline-edit-actions">
                              <button
                                className="exam-action-btn btn-primary"
                                type="submit"
                                disabled={Boolean(busyAction) || !isAssessmentFormComplete}
                                style={{ borderRadius: 10, cursor: Boolean(busyAction) || !isAssessmentFormComplete ? "not-allowed" : "pointer" }}
                              >
                                Update Assessment
                              </button>
                              {actionMessage ? (
                                <span className="exam-inline-edit-message">{actionMessage}</span>
                              ) : null}
                            </div>
                          </form>
                        </div>
                      </div>
                    ) : null}

                    {showDeleteAssessmentPopup && deleteAssessmentTarget ? (
                      <div className="exam-delete-overlay" onClick={closeDeleteAssessmentPopup}>
                        <div className="exam-delete-card" ref={deletePopupCardRef} onClick={(event) => event.stopPropagation()}>
                          <div className="exam-delete-title">Confirm Permanent Delete</div>
                          <div className="exam-delete-desc">
                            You are about to permanently remove <strong>{deleteAssessmentTarget.title}</strong> and its submissions from database.
                            This cannot be undone.
                          </div>

                          <div className="exam-delete-form">
                            <div className="exam-field">
                              <label className="exam-field-label">Teacher Username</label>
                              <input
                                className="exam-input exam-field-input"
                                value={deleteUsernameInput}
                                onChange={(event) => setDeleteUsernameInput(event.target.value)}
                                autoComplete="username"
                                autoFocus
                              />
                            </div>
                            <div className="exam-field">
                              <label className="exam-field-label">Teacher Password</label>
                              <input
                                className="exam-input exam-field-input"
                                type="password"
                                value={deletePasswordInput}
                                onChange={(event) => setDeletePasswordInput(event.target.value)}
                                autoComplete="current-password"
                              />
                            </div>
                          </div>

                          {deletePopupMessage ? <div className="exam-delete-error">{deletePopupMessage}</div> : null}

                          <div className="exam-delete-actions">
                            <button
                              className="exam-action-btn btn-neutral"
                              type="button"
                              onClick={closeDeleteAssessmentPopup}
                              disabled={busyAction === deleteAssessmentTarget.id}
                              style={{ borderRadius: 10, cursor: "pointer" }}
                            >
                              Cancel
                            </button>
                            <button
                              className="exam-action-btn btn-danger"
                              type="button"
                              onClick={() => handleDeleteAssessment(deleteAssessmentTarget)}
                              disabled={busyAction === deleteAssessmentTarget.id}
                              style={{ borderRadius: 10, cursor: "pointer" }}
                            >
                              {busyAction === deleteAssessmentTarget.id ? "Deleting..." : "Delete Permanently"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

export default TeacherExam;
