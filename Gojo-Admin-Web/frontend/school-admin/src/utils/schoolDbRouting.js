import axios from "axios";

const RTDB_ROOTS = [
  "https://gojo-education-default-rtdb.firebaseio.com",
  "https://bale-house-rental-default-rtdb.firebaseio.com",
  "https://ethiostore-17d9f-default-rtdb.firebaseio.com",
];

const DEFAULT_SCHOOL_CODE = "ET-ORO-ADA-GMI";
let isRoutingSetup = false;

function readAdminFromStorage() {
  const candidates = ["admin", "gojo_admin"];
  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Ignore malformed localStorage data.
    }
  }
  return null;
}

export function getActiveSchoolCode() {
  const admin = readAdminFromStorage();
  const schoolCode = admin?.schoolCode;
  return String(schoolCode || DEFAULT_SCHOOL_CODE).trim() || DEFAULT_SCHOOL_CODE;
}

function toSchoolScopedUrl(url) {
  if (typeof url !== "string") {
    return url;
  }

  const matchedRoot = RTDB_ROOTS.find((root) => url.startsWith(root));
  if (!matchedRoot) {
    return url;
  }

  const suffix = url.slice(matchedRoot.length);
  if (suffix.startsWith("/Platform1/")) {
    return url;
  }

  const schoolCode = encodeURIComponent(getActiveSchoolCode());
  if (!suffix || suffix === "/") {
    return `${matchedRoot}/Platform1/Schools/${schoolCode}`;
  }

  if (suffix.startsWith("/")) {
    return `${matchedRoot}/Platform1/Schools/${schoolCode}${suffix}`;
  }

  return `${matchedRoot}/Platform1/Schools/${schoolCode}/${suffix}`;
}

export function schoolNodeBase(schoolCode) {
  const code = encodeURIComponent(String(schoolCode || getActiveSchoolCode()).trim() || DEFAULT_SCHOOL_CODE);
  return `${RTDB_ROOTS[0]}/Platform1/Schools/${code}`;
}

export function setupSchoolScopedRtdbRouting() {
  if (isRoutingSetup) {
    return;
  }

  isRoutingSetup = true;

  axios.interceptors.request.use((config) => {
    if (typeof config.url === "string") {
      config.url = toSchoolScopedUrl(config.url);
    }
    return config;
  });

  if (typeof window === "undefined" || typeof window.fetch !== "function") {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === "string") {
      return originalFetch(toSchoolScopedUrl(input), init);
    }

    if (input instanceof Request) {
      const rewritten = toSchoolScopedUrl(input.url);
      if (rewritten !== input.url) {
        return originalFetch(new Request(rewritten, input), init);
      }
    }

    return originalFetch(input, init);
  };
}
