import axios from "axios";
import { getRtdbRoot } from "./rtdbScope";

const API_BASE = "http://127.0.0.1:5000/api";

const normalizeCourseFragment = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeTeacherRef = (value) => String(value || "").trim().replace(/^-+/, "").toUpperCase();

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

const resolveCourseIdFromAssignment = (courses, grade, section, subject) => {
  const normalizedGrade = String(grade || "").trim();
  const normalizedSection = String(section || "").trim().toUpperCase();
  const normalizedSubject = normalizeCourseFragment(subject);
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

  try {
    const [coursesRes, teachersRes, assignmentsRes, gradeManagementRes] = await Promise.all([
      axios.get(`${base}/Courses.json`),
      axios.get(`${base}/Teachers.json`),
      axios.get(`${base}/TeacherAssignments.json`),
      axios.get(`${base}/GradeManagement/grades.json`),
    ]);

    const courses = coursesRes.data || {};
    const teachers = teachersRes.data || {};
    const assignments = assignmentsRes.data || {};
    const gradeManagement = gradeManagementRes.data || {};

    const teacherEntry = resolveTeacherEntry(teachers, teacher || {});
    if (!teacherEntry) {
      return { success: false, teacherKey: "", courses: [], courseIds: [], assignmentsByCourseId: {} };
    }

    const [teacherKey, teacherRecord] = teacherEntry;
    const teacherRefs = new Set(
      [teacherKey, teacherRecord?.teacherId, teacherRecord?.userId, teacher?.teacherId, teacher?.teacherKey, teacher?.userId]
        .filter(Boolean)
        .map(normalizeTeacherRef)
    );

    const courseIds = [];
    const seenCourseIds = new Set();
    const assignmentsByCourseId = {};

    Object.values(assignments).forEach((assignment) => {
      const teacherId = normalizeTeacherRef(assignment?.teacherId);
      const courseId = String(assignment?.courseId || "").trim();
      if (!courseId || !teacherRefs.has(teacherId)) return;
      if (!seenCourseIds.has(courseId)) {
        seenCourseIds.add(courseId);
        courseIds.push(courseId);
      }
      assignmentsByCourseId[courseId] = assignment;
    });

    Object.entries(gradeManagement).forEach(([gradeKey, gradeNode]) => {
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

          if (!assignmentRefs.some((ref) => teacherRefs.has(ref))) return;

          const courseId = resolveCourseIdFromAssignment(
            courses,
            gradeKey,
            assignment?.section || sectionKey,
            assignment?.subject || subjectKey
          );

          if (!courseId) return;

          if (!seenCourseIds.has(courseId)) {
            seenCourseIds.add(courseId);
            courseIds.push(courseId);
          }
          assignmentsByCourseId[courseId] = { ...(assignmentsByCourseId[courseId] || {}), ...assignment };
        });
      });
    });

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
          section: storedCourse.section || storedCourse.secation || defaults.section || String(assignment.section || "").trim().toUpperCase(),
          virtual: !courses[courseId],
        };
      })
      .filter((course) => course.id);

    return {
      success: true,
      teacherKey,
      teacherRecord,
      courses: resolvedCourses,
      courseIds,
      assignmentsByCourseId,
    };
  } catch (err) {
    console.error("Teacher course context error:", err.response ? err.response.data : err.message);
    return { success: false, teacherKey: "", courses: [], courseIds: [], assignmentsByCourseId: {} };
  }
};

export const loginTeacher = async (username, password) => {
  try {
    const res = await axios.post(`${API_BASE}/teacher_login`, {
      username,
      password,
    });
    return res.data;
  } catch (err) {
    console.error("Login error:", err.response ? err.response.data : err.message);
    return { success: false, message: "Network error or server not reachable" };
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
