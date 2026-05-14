export const FINANCE_RTDB_BASE = "https://gojo-education-default-rtdb.firebaseio.com";

function safeParse(rawValue) {
  if (!rawValue) return {};

  try {
    return JSON.parse(rawValue) || {};
  } catch {
    return {};
  }
}

function hasIdentity(session) {
  return Boolean(session && (session.financeId || session.adminId || session.userId));
}

export function readStoredFinanceSession() {
  if (typeof window === "undefined") {
    return normalizeFinanceSession({});
  }

  const financeSession = safeParse(window.localStorage.getItem("finance"));
  const adminSession = safeParse(window.localStorage.getItem("admin"));
  const baseSession = hasIdentity(financeSession) ? financeSession : adminSession;

  return normalizeFinanceSession(baseSession);
}

export function normalizeFinanceSession(session) {
  const normalized = session || {};

  return {
    financeId: normalized.financeId || normalized.adminId || normalized.id || normalized.uid || "",
    adminId: normalized.adminId || normalized.financeId || normalized.id || normalized.uid || "",
    userId: normalized.userId || normalized.user_id || normalized.user || normalized.uid || "",
    schoolCode: normalized.schoolCode || normalized.school_code || "",
    name: normalized.name || normalized.username || normalized.financeName || "Finance",
    username: normalized.username || "",
    profileImage: normalized.profileImage || normalized.financeProfile || "/default-profile.png",
    token: normalized.token || normalized.accessToken || normalized.idToken || null,
  };
}

export function getFinanceDbRoot(schoolCode) {
  return schoolCode ? `${FINANCE_RTDB_BASE}/Platform1/Schools/${schoolCode}` : FINANCE_RTDB_BASE;
}

export function getFinanceDbPath(schoolCode) {
  return schoolCode ? `Platform1/Schools/${schoolCode}` : "";
}

export function buildChatKey(userA, userB) {
  return [String(userA || ""), String(userB || "")].sort().join("_");
}

export function normalizeUserType(role) {
  const normalizedRole = String(role || "").toLowerCase();

  if (normalizedRole.includes("parent")) return "parent";
  if (normalizedRole.includes("teacher")) return "teacher";
  if (normalizedRole.includes("student")) return "student";
  if (normalizedRole.includes("finance")) return "finance";

  return "user";
}