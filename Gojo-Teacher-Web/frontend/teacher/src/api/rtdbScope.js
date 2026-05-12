import axios from "axios";
import { API_BASE } from "./apiConfig";
import { RTDB_BASE_RAW } from "../config/firebaseClientConfig";
import { handleUnauthorizedTeacherSession } from "../utils/teacherSession";

const API_ROOT = API_BASE.replace(/\/api\/?$/, "");
const RTDB_PROXY_BASE = `${API_BASE}/rtdb-proxy`;
const SESSION_ERROR_CODES = new Set(["teacher_session_required", "teacher_session_scope_violation"]);

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
  "Chat_Summaries",
  "StudentNotes",
  "LessonPlans",
  "LessonPlanSubmissions",
  "AcademicYears",
  "AssessmentTemplates",
  "GradeManagement",
  "StudentCourses",
  "Presence",
  "Curriculum",
  "Exams",
  "Attendance",
  "SchoolExams",
  "Schedules",
  "counters",
  "Users_counters",
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
  const teacher = safeParse(window.localStorage.getItem("teacher"));
  const admin = safeParse(window.localStorage.getItem("admin"));
  return String(teacher.schoolCode || admin.schoolCode || "").trim();
}

function scopePathIfNeeded(path, schoolCode = getSchoolCode()) {
  const normalized = String(path || "").replace(/^\/+/, "");
  if (!normalized) return normalized;
  if (normalized.startsWith("Platform1/Schools/")) return normalized;

  const firstSegment = normalized.split("/")[0];
  const root = firstSegment.replace(/\.json$/i, "");
  if (!SCOPED_ROOTS.has(root) || !schoolCode) return normalized;

  return `Platform1/Schools/${schoolCode}/${normalized}`;
}

export function schoolPath(path, schoolCode) {
  return scopePathIfNeeded(path, schoolCode);
}

export function getRtdbRoot() {
  const schoolCode = getSchoolCode();
  return schoolCode
    ? `${RTDB_BASE_RAW}/Platform1/Schools/${schoolCode}`
    : RTDB_BASE_RAW;
}

function scopeRtdbUrl(url) {
  if (typeof url !== "string") return url;
  if (!url.startsWith(RTDB_BASE_RAW)) return url;

  try {
    const parsed = new URL(url);
    const currentPath = parsed.pathname.replace(/^\/+/, "");
    const scopedPath = scopePathIfNeeded(currentPath);

    if (!scopedPath || scopedPath === currentPath) return url;

    parsed.pathname = `/${scopedPath}`;
    return parsed.toString();
  } catch {
    return url;
  }
}

function isRawRtdbUrl(url) {
  return typeof url === "string" && url.startsWith(RTDB_BASE_RAW);
}

function rewriteRtdbUrl(url) {
  if (!isRawRtdbUrl(url)) return url;

  try {
    const scopedUrl = scopeRtdbUrl(url);
    const parsed = new URL(scopedUrl);
    const scopedPath = parsed.pathname.replace(/^\/+/, "");
    return `${RTDB_PROXY_BASE}/${scopedPath}${parsed.search}`;
  } catch {
    return url;
  }
}

function isBackendApiUrl(url) {
  if (typeof url !== "string") return false;
  if (url.startsWith("/api")) return true;
  if (url.startsWith(API_BASE)) return true;

  try {
    const origin = typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost";
    const parsed = new URL(url, origin);
    return parsed.pathname.startsWith("/api");
  } catch {
    return Boolean(API_ROOT) && url.startsWith(API_ROOT);
  }
}

async function maybeHandleSessionFailure(url, response) {
  if (!response || !isBackendApiUrl(url) || ![401, 403].includes(response.status)) {
    return response;
  }

  try {
    const data = await response.clone().json();
    if (SESSION_ERROR_CODES.has(String(data?.errorCode || "").trim())) {
      handleUnauthorizedTeacherSession();
    }
  } catch {
    // Ignore non-JSON responses.
  }

  return response;
}

export { RTDB_BASE_RAW };

function withSchoolCodeHeader(headersLike, schoolCode = getSchoolCode()) {
  if (!schoolCode) return headersLike;

  const headers = new Headers(headersLike || {});
  if (!headers.has("X-School-Code")) {
    headers.set("X-School-Code", schoolCode);
  }
  return headers;
}

export function installRtdbInterceptors() {
  if (typeof window === "undefined") return;

  if (!window.__gojoFetchScoped && typeof window.fetch === "function") {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input?.url;
      const nextUrl = rewriteRtdbUrl(url);
      const attachSchoolHeader = isRawRtdbUrl(url) || isBackendApiUrl(nextUrl) || isBackendApiUrl(url);

      if (typeof input === "string") {
        const nextInit = attachSchoolHeader
          ? { ...init, headers: withSchoolCodeHeader(init?.headers), credentials: "include" }
          : init;
        return originalFetch(nextUrl, nextInit).then((response) => maybeHandleSessionFailure(nextUrl, response));
      }
      if (input && typeof input.url === "string") {
        if (nextUrl !== input.url || attachSchoolHeader) {
          const nextInit = attachSchoolHeader
            ? { ...init, headers: withSchoolCodeHeader(init?.headers || input.headers), credentials: "include" }
            : init;
          const req = new Request(nextUrl, input);
          return originalFetch(req, nextInit).then((response) => maybeHandleSessionFailure(nextUrl, response));
        }
      }
      return originalFetch(input, init).then((response) => maybeHandleSessionFailure(url, response));
    };
    window.__gojoFetchScoped = true;
  }

  if (!window.__gojoAxiosScoped) {
    axios.interceptors.request.use((config) => {
      if (config && typeof config.url === "string") {
        const originalUrl = config.url;
        config.url = rewriteRtdbUrl(config.url);
        if (isRawRtdbUrl(originalUrl) || isBackendApiUrl(config.url) || isBackendApiUrl(originalUrl)) {
          config.headers = {
            ...(config.headers || {}),
            "X-School-Code": getSchoolCode(),
          };
          config.withCredentials = true;
        }
      }
      return config;
    });
    window.__gojoAxiosScoped = true;
  }

  if (!window.__gojoAxiosSessionAware) {
    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const errorCode = String(error?.response?.data?.errorCode || "").trim();
        if (SESSION_ERROR_CODES.has(errorCode)) {
          handleUnauthorizedTeacherSession();
        }
        return Promise.reject(error);
      }
    );
    window.__gojoAxiosSessionAware = true;
  }
}