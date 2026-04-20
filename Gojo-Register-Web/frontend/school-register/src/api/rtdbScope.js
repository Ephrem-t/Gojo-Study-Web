const RTDB_BASE_RAW = "https://bale-house-rental-default-rtdb.firebaseio.com";

const SCOPED_ROOTS = new Set([
  "Users",
  "Students",
  "Parents",
  "Teachers",
  "School_Admins",
  "TeacherAssignments",
  "Courses",
  "ClassMarks",
  "Posts",
  "TeacherPosts",
  "Chats",
  "StudentNotes",
  "LessonPlans",
  "LessonPlanSubmissions",
  "GradeManagement",
  "StudentCourses",
  "Presence",
  "Curriculum",
  "Exams",
  "Attendance",
  "Schedules",
  "CalendarEvents",
  "AcademicYears",
  "YearHistory",
  "GeneratedDocuments",
  "monthlyPaid",
  "Finance",
  "Academics",
  "schoolInfo",
]);

function safeParse(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

export function getSchoolCode() {
  if (typeof window === "undefined") return "";

  const registrar = safeParse(window.localStorage.getItem("registrar"));
  const admin = safeParse(window.localStorage.getItem("admin"));
  return String(registrar.schoolCode || admin.schoolCode || "").trim();
}

export function schoolPath(path, schoolCode = getSchoolCode()) {
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  if (!normalizedPath) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("Platform1/Schools/")) {
    return normalizedPath;
  }

  const root = normalizedPath.split("/")[0].replace(/\.json$/i, "");
  if (!schoolCode || !SCOPED_ROOTS.has(root)) {
    return normalizedPath;
  }

  return `Platform1/Schools/${schoolCode}/${normalizedPath}`;
}

export function buildSchoolRtdbBase(schoolCode = getSchoolCode()) {
  const normalizedSchoolCode = String(schoolCode || "").trim();
  return normalizedSchoolCode
    ? `${RTDB_BASE_RAW}/Platform1/Schools/${encodeURIComponent(normalizedSchoolCode)}`
    : RTDB_BASE_RAW;
}

export function extractSchoolCodeFromRtdbBase(rtdbBase) {
  const normalizedBase = String(rtdbBase || "");
  const match = normalizedBase.match(/\/Platform1\/Schools\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

export { RTDB_BASE_RAW };