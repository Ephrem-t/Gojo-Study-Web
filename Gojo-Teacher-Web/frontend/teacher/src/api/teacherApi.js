import axios from "axios";
import { getRtdbRoot } from "./rtdbScope";
import { API_BASE } from "./apiConfig";
import { fetchCachedJson } from "../utils/rtdbCache";
import { extractSchoolCodeFromRtdbBase } from "../utils/teacherData";
const TEACHER_CONTEXT_TTL_MS = 10 * 60 * 1000;
const TEACHER_NODE_TTL_MS = 10 * 60 * 1000;
const teacherCourseContextCache = new Map();
const teacherCourseContextInflight = new Map();

const normalizeCourseFragment = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeTeacherRef = (value) => String(value || "").trim().replace(/^-+/, "").toUpperCase();

const buildTeacherContextCacheKey = (base, teacher = {}) => {
  const teacherRefs = [teacher?.teacherId, teacher?.teacherKey, teacher?.userId, teacher?.username]
    .filter(Boolean)
    .map(normalizeTeacherRef)
    .sort()
    .join("|");

  return `${String(base || "").trim()}|${teacherRefs}`;
};

const getFreshTeacherContextCache = (cacheKey) => {
  const entry = teacherCourseContextCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (Date.now() - Number(entry.cachedAt || 0) > TEACHER_CONTEXT_TTL_MS) {
    return null;
  }

  return entry.data;
};

const writeTeacherContextCache = (cacheKey, data) => {
  teacherCourseContextCache.set(cacheKey, {
    data,
    cachedAt: Date.now(),
  });
  return data;
};

const isRecordObject = (value) => {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !value.error &&
      Object.keys(value).length > 0
  );
};

const normalizeIdentifier = (value) => String(value || "").trim();

const readRecordChildValue = (recordKey, record, childPath) => {
  if (!childPath) {
    return "";
  }

  if (childPath === "$key") {
    return normalizeIdentifier(recordKey);
  }

  const segments = String(childPath || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  let currentValue = record;
  for (const segment of segments) {
    currentValue = currentValue?.[segment];
  }

  return normalizeIdentifier(currentValue);
};

const queryScopedCollection = async ({ base, nodePath, childPath, matchValue, ttlMs = TEACHER_NODE_TTL_MS }) => {
  const normalizedValue = normalizeIdentifier(matchValue);
  const normalizedBase = String(base || "").trim();
  if (!normalizedBase || !normalizedValue) {
    return {};
  }

  const collectionNode = await fetchCachedJson(`${normalizedBase}/${nodePath}.json`, {
    ttlMs,
    fallbackValue: {},
  });

  return Object.entries(collectionNode || {}).reduce((result, [recordKey, record]) => {
    if (!isRecordObject(record)) {
      return result;
    }

    if (
      normalizeIdentifier(recordKey) === normalizedValue ||
      readRecordChildValue(recordKey, record, childPath) === normalizedValue
    ) {
      result[recordKey] = record;
    }

    return result;
  }, {});
};

const resolveTeacherEntrySelective = async (base, schoolCode, teacher = {}) => {
  const directIdentifiers = [teacher?.teacherKey, teacher?.teacherId, teacher?.userId]
    .map(normalizeIdentifier)
    .filter(Boolean);

  for (const identifier of directIdentifiers) {
    const directRecord = await fetchCachedJson(`${base}/Teachers/${encodeURIComponent(identifier)}.json`, {
      ttlMs: TEACHER_NODE_TTL_MS,
      fallbackValue: null,
    });

    if (isRecordObject(directRecord)) {
      return [identifier, directRecord];
    }
  }

  const querySpecs = [
    { childPath: "teacherId", values: [teacher?.teacherId, teacher?.teacherKey, teacher?.userId, teacher?.username] },
    { childPath: "teacherKey", values: [teacher?.teacherKey, teacher?.teacherId, teacher?.userId] },
    { childPath: "userId", values: [teacher?.userId, teacher?.teacherId] },
  ];

  for (const spec of querySpecs) {
    const values = [...new Set((spec.values || []).map(normalizeIdentifier).filter(Boolean))];
    for (const value of values) {
      const records = await queryScopedCollection({
        base,
        nodePath: "Teachers",
        childPath: spec.childPath,
        matchValue: value,
        ttlMs: TEACHER_NODE_TTL_MS,
      });
      const [recordKey, record] = Object.entries(records || {})[0] || [];
      if (isRecordObject(record)) {
        return [String(recordKey || value).trim(), record];
      }
    }
  }

  return ["", {}];
};

const loadTeacherAssignmentsSelective = async (base, teacherRefs) => {
  const assignments = {};
  const querySpecs = ["teacherId", "teacherUserId", "userId", "teacherRecordKey"];
  const normalizedRefs = [...new Set((teacherRefs || []).map(normalizeTeacherRef).filter(Boolean))];

  for (const childPath of querySpecs) {
    for (const teacherRef of normalizedRefs) {
      const records = await queryScopedCollection({
        base,
        nodePath: "TeacherAssignments",
        childPath,
        matchValue: teacherRef,
        ttlMs: TEACHER_NODE_TTL_MS,
      });

      Object.entries(records || {}).forEach(([recordKey, record]) => {
        if (isRecordObject(record)) {
          assignments[recordKey] = record;
        }
      });
    }
  }

  return assignments;
};

const loadCoursesByIds = async (base, courseIds) => {
  const normalizedCourseIds = [...new Set((courseIds || []).map(normalizeIdentifier).filter(Boolean))];
  if (!normalizedCourseIds.length) {
    return {};
  }

  const courseEntries = await Promise.all(
    normalizedCourseIds.map(async (courseId) => {
      const courseRecord = await fetchCachedJson(`${base}/Courses/${encodeURIComponent(courseId)}.json`, {
        ttlMs: TEACHER_NODE_TTL_MS,
        fallbackValue: null,
      });

      return [courseId, isRecordObject(courseRecord) ? courseRecord : {}];
    })
  );

  return courseEntries.reduce((result, [courseId, courseRecord]) => {
    result[courseId] = courseRecord;
    return result;
  }, {});
};

const resolveTeacherEntry = (teachers, teacher) => {
  const identifiers = new Set(
    [teacher?.teacherId, teacher?.teacherKey, teacher?.userId]
      .filter(Boolean)
      .map(normalizeTeacherRef)
  );

  return Object.entries(teachers || {}).find(([key, item]) => {
    const refs = [key, item?.teacherId, item?.userId, item?.teacherKey]
      .filter(Boolean)
      .map(normalizeTeacherRef);
    return refs.some((ref) => identifiers.has(ref));
  });
};

const resolveCourseIdFromAssignment = (courses, assignment = {}, grade, section, subject) => {
  const explicitCourseId = String(assignment?.courseId || "").trim();
  if (explicitCourseId) return explicitCourseId;

  const normalizedGrade = String(grade || assignment?.grade || "").trim();
  const normalizedSection = String(section || assignment?.section || "").trim().toUpperCase();
  const normalizedSubject = normalizeCourseFragment(subject || assignment?.subject);
  const fallbackId = `course_${normalizedSubject}_${normalizedGrade}${normalizedSection}`;

  if (!courses || typeof courses !== "object") return fallbackId;
  if (courses?.[fallbackId]) return fallbackId;

  return Object.entries(courses || {}).find(([, course]) => {
    const courseGrade = String(course?.grade || "").trim();
    const courseSection = String(course?.section || course?.secation || "").trim().toUpperCase();
    const courseSubject = normalizeCourseFragment(course?.subject || course?.name || "");
    return courseGrade === normalizedGrade && courseSection === normalizedSection && courseSubject === normalizedSubject;
  })?.[0] || fallbackId;
};

const humanizeSubject = (value) =>
  normalizeCourseFragment(value)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const parseCourseDefaults = (courseId) => {
  const normalized = String(courseId || "").trim();
  if (!normalized.startsWith("course_")) return {};

  const body = normalized.slice("course_".length);
  const parts = body.split("_").filter(Boolean);
  if (parts.length < 2) return {};

  const gradeSection = parts.at(-1) || "";
  const match = gradeSection.match(/^(\d+)([A-Za-z].*)$/);
  if (!match) return {};

  const subjectFragment = parts.slice(0, -1).join("_");
  return {
    subject: humanizeSubject(subjectFragment),
    name: humanizeSubject(subjectFragment),
    grade: match[1],
    section: match[2].toUpperCase(),
  };
};

export const getTeacherCourseContext = async ({ teacher, rtdbBase } = {}) => {
  const base = rtdbBase || getRtdbRoot();
  const cacheKey = buildTeacherContextCacheKey(base, teacher || {});
  const cachedContext = getFreshTeacherContextCache(cacheKey);
  if (cachedContext) {
    return cachedContext;
  }

  const inflightContext = teacherCourseContextInflight.get(cacheKey);
  if (inflightContext) {
    return inflightContext;
  }

  const schoolCode = extractSchoolCodeFromRtdbBase(base);

  const request = (async () => {
    try {
      const [teacherKeyCandidate, teacherRecordCandidate] = await resolveTeacherEntrySelective(base, schoolCode, teacher || {});
      const teacherRefs = new Set(
        [
          teacherKeyCandidate,
          teacherRecordCandidate?.teacherId,
          teacherRecordCandidate?.userId,
          teacherRecordCandidate?.teacherKey,
          teacher?.teacherId,
          teacher?.teacherKey,
          teacher?.userId,
          teacher?.username,
        ]
          .filter(Boolean)
          .map(normalizeTeacherRef)
      );

      if (!teacherRefs.size) {
        return writeTeacherContextCache(cacheKey, {
          success: false,
          teacherKey: "",
          teacherRecord: {},
          courses: [],
          courseIds: [],
          assignmentsByCourseId: {},
        });
      }

      const assignmentsByCourseId = {};
      const seenCourseIds = new Set();
      const courseIds = [];

      const selectiveAssignments = await loadTeacherAssignmentsSelective(base, [...teacherRefs]);
      Object.values(selectiveAssignments || {}).forEach((assignment) => {
        const teacherId = normalizeTeacherRef(
          assignment?.teacherId || assignment?.teacherUserId || assignment?.userId || assignment?.teacherRecordKey
        );
        const courseId = normalizeIdentifier(assignment?.courseId);
        if (!courseId || (teacherId && !teacherRefs.has(teacherId))) {
          return;
        }

        if (!seenCourseIds.has(courseId)) {
          seenCourseIds.add(courseId);
          courseIds.push(courseId);
        }

        assignmentsByCourseId[courseId] = {
          ...(assignmentsByCourseId[courseId] || {}),
          ...assignment,
        };
      });

      let gradeManagement = {};
      if (!courseIds.length) {
        gradeManagement = await fetchCachedJson(`${base}/GradeManagement/grades.json`, {
          ttlMs: TEACHER_NODE_TTL_MS,
          fallbackValue: {},
        });

        Object.entries(gradeManagement || {}).forEach(([gradeKey, gradeNode]) => {
          const sectionTeachers = gradeNode?.sectionSubjectTeachers || {};
          Object.entries(sectionTeachers).forEach(([sectionKey, subjectMap]) => {
            Object.entries(subjectMap || {}).forEach(([subjectKey, assignment]) => {
              const assignmentRefs = [
                assignment?.teacherId,
                assignment?.teacherRecordKey,
                assignment?.teacherUserId,
                assignment?.userId,
              ]
                .filter(Boolean)
                .map(normalizeTeacherRef);

              if (!assignmentRefs.some((teacherRef) => teacherRefs.has(teacherRef))) {
                return;
              }

              const courseId = resolveCourseIdFromAssignment({}, assignment, gradeKey, sectionKey, subjectKey);
              if (!courseId) {
                return;
              }

              if (!seenCourseIds.has(courseId)) {
                seenCourseIds.add(courseId);
                courseIds.push(courseId);
              }

              assignmentsByCourseId[courseId] = {
                ...(assignmentsByCourseId[courseId] || {}),
                ...assignment,
              };
            });
          });
        });
      }

      if (!courseIds.length) {
        const fallbackAssignments = await fetchCachedJson(`${base}/TeacherAssignments.json`, {
          ttlMs: TEACHER_NODE_TTL_MS,
          fallbackValue: {},
        });

        Object.values(fallbackAssignments || {}).forEach((assignment) => {
          const assignmentTeacherId = normalizeTeacherRef(
            assignment?.teacherId || assignment?.teacherUserId || assignment?.userId || assignment?.teacherRecordKey
          );
          const courseId = normalizeIdentifier(assignment?.courseId);
          if (!courseId || (assignmentTeacherId && !teacherRefs.has(assignmentTeacherId))) {
            return;
          }

          if (!seenCourseIds.has(courseId)) {
            seenCourseIds.add(courseId);
            courseIds.push(courseId);
          }

          assignmentsByCourseId[courseId] = {
            ...(assignmentsByCourseId[courseId] || {}),
            ...assignment,
          };
        });
      }

      const courses = await loadCoursesByIds(base, courseIds);
      const resolvedCourses = courseIds
        .map((courseId) => {
          const storedCourse = courses[courseId] || {};
          const assignment = assignmentsByCourseId[courseId] || {};
          const defaults = parseCourseDefaults(courseId);

          return {
            id: courseId,
            ...storedCourse,
            name: storedCourse.name || defaults.name || humanizeSubject(assignment.subject || courseId),
            subject: storedCourse.subject || defaults.subject || humanizeSubject(assignment.subject || courseId),
            grade: storedCourse.grade || defaults.grade || String(assignment.grade || "").trim(),
            section:
              storedCourse.section ||
              storedCourse.secation ||
              defaults.section ||
              String(assignment.section || "").trim().toUpperCase(),
            virtual: !courses[courseId] || !Object.keys(courses[courseId] || {}).length,
          };
        })
        .filter((course) => course.id);

      return writeTeacherContextCache(cacheKey, {
        success: resolvedCourses.length > 0,
        teacherKey: teacherKeyCandidate || teacher?.teacherKey || teacher?.teacherId || "",
        teacherRecord: teacherRecordCandidate || {},
        courses: resolvedCourses,
        courseIds,
        assignmentsByCourseId,
      });
    } catch (err) {
      console.error("Teacher course context error:", err.response ? err.response.data : err.message);
      return writeTeacherContextCache(cacheKey, {
        success: false,
        teacherKey: "",
        teacherRecord: {},
        courses: [],
        courseIds: [],
        assignmentsByCourseId: {},
      });
    }
  })().finally(() => {
    teacherCourseContextInflight.delete(cacheKey);
  });

  teacherCourseContextInflight.set(cacheKey, request);
  return request;
};

export const loginTeacher = async (username, password) => {
  try {
    const res = await axios.post(`${API_BASE}/teacher_login`, {
      username,
      password,
    }, {
      withCredentials: true,
    });
    return res.data;
  } catch (err) {
    console.error("Login error:", err.response ? err.response.data : err.message);
    return {
      success: false,
      message:
        err.response?.data?.message || "Network error or server not reachable",
    };
  }
};

export const getSchoolOptions = async () => {
  try {
    const res = await axios.get(`${API_BASE}/schools`);
    if (res?.data?.success) {
      return { success: true, schools: res.data.schools || [] };
    }
    return { success: false, schools: [], message: res?.data?.message || "Unable to fetch schools" };
  } catch (err) {
    console.error("School options error:", err.response ? err.response.data : err.message);
    return {
      success: false,
      schools: [],
      message: err.response?.data?.message || "Unable to fetch schools",
    };
  }
};

export const loginTeacherWithSchool = async ({ username, password, schoolCode }) => {
  try {
    const res = await axios.post(`${API_BASE}/teacher_login`, {
      username,
      password,
      schoolCode,
    }, {
      withCredentials: true,
    });
    return res.data;
  } catch (err) {
    console.error("Login error:", err.response ? err.response.data : err.message);
    return {
      success: false,
      message:
        err.response?.data?.message || "Network error or server not reachable",
    };
  }
};

export const getTeacherContext = async ({ teacherId, userId }) => {
  try {
    const res = await axios.get(`${API_BASE}/teacher_context`, {
      params: {
        teacherId,
        userId,
      },
    });
    return res.data;
  } catch (err) {
    console.error("Teacher context error:", err.response ? err.response.data : err.message);
    return { success: false, message: "Unable to resolve teacher context" };
  }
};
