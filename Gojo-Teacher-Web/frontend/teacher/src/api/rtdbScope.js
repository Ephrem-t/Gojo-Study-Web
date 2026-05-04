import axios from "axios";
import { API_BASE } from "./apiConfig";
import { RTDB_BASE_RAW } from "../config/firebaseClientConfig";

const API_ROOT = API_BASE.replace(/\/api\/?$/, "");

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

function isBackendApiUrl(url) {
  return typeof url === "string" && url.startsWith(API_ROOT);
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
      const nextUrl = scopeRtdbUrl(url);
      const attachSchoolHeader = isBackendApiUrl(url);

      if (typeof input === "string") {
        const nextInit = attachSchoolHeader
          ? { ...init, headers: withSchoolCodeHeader(init?.headers) }
          : init;
        return originalFetch(nextUrl, nextInit);
      }
      if (input && typeof input.url === "string") {
        if (nextUrl !== input.url || attachSchoolHeader) {
          const nextInit = attachSchoolHeader
            ? { ...init, headers: withSchoolCodeHeader(init?.headers || input.headers) }
            : init;
          const req = new Request(nextUrl, input);
          return originalFetch(req, nextInit);
        }
      }
      return originalFetch(input, init);
    };
    window.__gojoFetchScoped = true;
  }

  if (!window.__gojoAxiosScoped) {
    axios.interceptors.request.use((config) => {
      if (config && typeof config.url === "string") {
        config.url = scopeRtdbUrl(config.url);
        if (isBackendApiUrl(config.url)) {
          config.headers = {
            ...(config.headers || {}),
            "X-School-Code": getSchoolCode(),
          };
        }
      }
      return config;
    });
    window.__gojoAxiosScoped = true;
  }
}