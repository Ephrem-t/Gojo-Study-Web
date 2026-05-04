import { buildSchoolRtdbBase, RTDB_BASE_RAW } from "../api/rtdbScope";
import { loadSchoolInfoNode } from "./registerData";
import { fetchCachedJson } from "./rtdbCache";

const normalizeLookup = (value) => String(value || "").trim().toLowerCase();

export const persistResolvedSchoolSession = (nextSchoolCode, shortName = "") => {
  if (!nextSchoolCode || typeof window === "undefined") return;

  const updateStoredValue = (key) => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || "{}") || {};
      window.localStorage.setItem(
        key,
        JSON.stringify({
          ...parsed,
          schoolCode: nextSchoolCode,
          ...(shortName
            ? {
                shortName,
                schoolShortName: shortName,
              }
            : {}),
        })
      );
    } catch {
      // Ignore malformed local storage.
    }
  };

  updateStoredValue("registrar");
  updateStoredValue("admin");
};

export const resolveSchoolScope = async (requestedSchoolCode) => {
  const normalizedRequestedCode = String(requestedSchoolCode || "").trim();
  const fallbackDbUrl = buildSchoolRtdbBase(normalizedRequestedCode);
  const requestedLookup = normalizeLookup(normalizedRequestedCode);

  if (!normalizedRequestedCode) {
    return {
      schoolCode: "",
      dbUrl: fallbackDbUrl,
      schoolInfo: {},
    };
  }

  const directSchoolInfo = (await loadSchoolInfoNode({ rtdbBase: fallbackDbUrl, force: true })) || {};
  if (Object.keys(directSchoolInfo).length > 0) {
    return {
      schoolCode: normalizedRequestedCode,
      dbUrl: fallbackDbUrl,
      schoolInfo: directSchoolInfo,
    };
  }

  const schoolIndex =
    (await fetchCachedJson(`${RTDB_BASE_RAW}/Platform1/Schools.json?shallow=true`, {
      ttlMs: 60 * 1000,
      fallbackValue: {},
      force: true,
    })) || {};

  for (const candidateSchoolCode of Object.keys(schoolIndex || {})) {
    const candidateDbUrl = buildSchoolRtdbBase(candidateSchoolCode);
    const candidateSchoolInfo = (await loadSchoolInfoNode({ rtdbBase: candidateDbUrl, force: true })) || {};
    const matchesRequestedSchool = [
      candidateSchoolCode,
      candidateSchoolInfo?.schoolCode,
      candidateSchoolInfo?.shortName,
    ].some((value) => normalizeLookup(value) === requestedLookup);

    if (!matchesRequestedSchool) {
      continue;
    }

    return {
      schoolCode: candidateSchoolCode,
      dbUrl: candidateDbUrl,
      schoolInfo: candidateSchoolInfo,
    };
  }

  return {
    schoolCode: normalizedRequestedCode,
    dbUrl: fallbackDbUrl,
    schoolInfo: directSchoolInfo,
  };
};