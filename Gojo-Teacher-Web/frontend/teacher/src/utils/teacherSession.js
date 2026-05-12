import axios from "axios";
import { API_BASE } from "../api/apiConfig";

const TEACHER_STORAGE_PREFIXES = [
  "teacher_session_cache_v1:",
  "seen_posts_",
  "teacher_settings_preferences_",
];

const getBrowserWindow = () => (typeof window === "undefined" ? null : window);

export const readTeacherFromStorage = () => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) return null;

  try {
    const rawTeacher = browserWindow.localStorage.getItem("teacher");
    if (!rawTeacher) return null;
    const parsedTeacher = JSON.parse(rawTeacher);
    return parsedTeacher && typeof parsedTeacher === "object" ? parsedTeacher : null;
  } catch {
    return null;
  }
};

export const writeTeacherToStorage = (teacher) => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) return;

  browserWindow.localStorage.setItem("teacher", JSON.stringify(teacher || null));
};

const clearStorageByPrefix = (storage) => {
  if (!storage) return;

  const keysToRemove = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;

    if (key === "teacher" || TEACHER_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
};

export const clearTeacherBrowserState = () => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) return;

  clearStorageByPrefix(browserWindow.localStorage);
  clearStorageByPrefix(browserWindow.sessionStorage);
};

export const requestTeacherLogout = () => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) return Promise.resolve(null);

  if (typeof browserWindow.fetch === "function") {
    return browserWindow
      .fetch(`${API_BASE}/teacher/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        keepalive: true,
      })
      .catch(() => null);
  }

  return axios.post(`${API_BASE}/teacher/logout`, {}, { withCredentials: true }).catch(() => null);
};

export const logoutTeacher = () => {
  const logoutRequest = requestTeacherLogout();
  clearTeacherBrowserState();
  return logoutRequest;
};

export const handleUnauthorizedTeacherSession = () => {
  const browserWindow = getBrowserWindow();
  clearTeacherBrowserState();

  if (!browserWindow) return;
  if (browserWindow.location.pathname.startsWith("/login")) return;

  browserWindow.location.replace("/login");
};

export const registerTeacherSessionGlobals = () => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) return;

  browserWindow.__gojoClearTeacherState = clearTeacherBrowserState;
  browserWindow.__gojoTeacherLogout = logoutTeacher;
  browserWindow.__gojoHandleUnauthorizedTeacherSession = handleUnauthorizedTeacherSession;
};