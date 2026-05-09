import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { clearCachedJson, fetchCachedJson, writeCachedJson } from "../../utils/rtdbCache";
import {
  clearSessionResource,
  readSessionResource,
  writeSessionResource,
} from "../../utils/teacherData";

export const ETHIOPIAN_MONTHS = [
  "Meskerem",
  "Tikemt",
  "Hidar",
  "Tahsas",
  "Tir",
  "Yekatit",
  "Megabit",
  "Miazia",
  "Ginbot",
  "Sene",
  "Hamle",
  "Nehase",
  "Pagume",
];

const DEFAULT_SEMESTER_IDS = ["SEM1", "SEM2"];
const templateObjectCache = new Map();
const migratedLessonPlanSemesters = new Set();
const migratedLessonPlanWeeks = new Set();

const getSemesterNumber = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return Number.NaN;
  const match = rawValue.match(/sem(?:ester)?[^0-9]*([0-9]+)/i) || rawValue.match(/(\d+)/);
  return match ? Number(match[1]) : Number.NaN;
};

export const normalizeSemesterId = (value) => {
  const semesterNumber = getSemesterNumber(value);
  if (Number.isFinite(semesterNumber) && semesterNumber > 0) {
    return `SEM${semesterNumber}`;
  }
  return String(value || "").trim().toUpperCase();
};

export const formatSemesterLabel = (value) => {
  const semesterNumber = getSemesterNumber(value);
  if (Number.isFinite(semesterNumber) && semesterNumber > 0) {
    return `Semester ${semesterNumber}`;
  }
  return String(value || "").trim() || "Semester";
};

const toSubjectKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const subjectVariants = (value) => {
  const base = toSubjectKey(value);
  if (!base) return [];
  return Array.from(new Set([base, base.replace(/_/g, "")]));
};

const toWeekOrder = (weekId) => {
  const digits = String(weekId || "").match(/(\d+)/);
  return digits ? Number(digits[1]) : Number.MAX_SAFE_INTEGER;
};

const getMonthOrder = (monthId) => {
  const index = ETHIOPIAN_MONTHS.findIndex((item) => item.toLowerCase() === String(monthId || "").toLowerCase());
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const extractMonthMap = (planNode) => {
  if (!planNode || typeof planNode !== "object") return {};
  if (planNode.months && typeof planNode.months === "object") return planNode.months;

  const directMonths = Object.entries(planNode).filter(([, value]) => value && typeof value === "object" && value.weeks);
  if (directMonths.length) {
    return Object.fromEntries(directMonths);
  }

  return {};
};

const normalizeWeek = (monthId, weekId, weekData = {}, submissionData = {}) => {
  const expectedDays = Number(weekData.expectedDays || 0);
  const submittedDaysMap = submissionData?.submittedDays && typeof submissionData.submittedDays === "object"
    ? submissionData.submittedDays
    : {};
  const submittedDays = Object.keys(submittedDaysMap);
  const submittedCount = submittedDays.length;
  const progressPercent = expectedDays > 0 ? Math.min(100, Math.round((submittedCount / expectedDays) * 100)) : 0;

  return {
    id: `${monthId}__${weekId}`,
    monthId,
    weekId,
    objective: String(weekData.objective || ""),
    topic: String(weekData.topic || ""),
    method: String(weekData.method || ""),
    material: String(weekData.material || ""),
    assessment: String(weekData.assessment || ""),
    expectedDays,
    submittedDays,
    submittedCount,
    progressPercent,
    status: String(submissionData?.status || "incomplete"),
    lastSubmittedAt: submissionData?.lastSubmittedAt || null,
  };
};

const normalizeWeekPayload = (payload = {}) => ({
  objective: String(payload.objective || ""),
  topic: String(payload.topic || ""),
  method: String(payload.method || ""),
  material: String(payload.material || ""),
  assessment: String(payload.assessment || ""),
  expectedDays: Number(payload.expectedDays || 0),
});

const sortWeeks = (rows = []) =>
  [...rows].sort((a, b) => {
    const monthDiff = getMonthOrder(a.monthId) - getMonthOrder(b.monthId);
    if (monthDiff !== 0) return monthDiff;
    return toWeekOrder(a.weekId) - toWeekOrder(b.weekId);
  });

const extractSemesterIds = (templateNode, course) => {
  if (!templateNode || typeof templateNode !== "object") return DEFAULT_SEMESTER_IDS;

  const candidates = subjectVariants(course?.subject || course?.name || course?.title || "");
  let subjectNode = null;

  for (const key of candidates) {
    if (templateNode[key] && typeof templateNode[key] === "object") {
      subjectNode = templateNode[key];
      break;
    }
  }

  if (!subjectNode) {
    subjectNode = Object.entries(templateNode).find(([k, v]) => {
      if (!v || typeof v !== "object") return false;
      return candidates.includes(toSubjectKey(k)) || candidates.includes(toSubjectKey(v.subject || ""));
    })?.[1];
  }

  const source = subjectNode && typeof subjectNode === "object" ? subjectNode : templateNode;
  const semKeys = Array.from(new Set(
    Object.keys(source)
      .filter((key) => /^sem(ester)?\d+/i.test(key))
      .map((key) => normalizeSemesterId(key))
      .filter(Boolean)
  )).sort((a, b) => {
    const an = getSemesterNumber(a);
    const bn = getSemesterNumber(b);
    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
    return String(a).localeCompare(String(b));
  });

  return semKeys.length ? semKeys : DEFAULT_SEMESTER_IDS;
};

const hasResolvedRoots = (roots = {}) =>
  Boolean(roots.templatesRoot || roots.plansRoot || roots.submissionsRoot || roots.dailyLogsRoot);

const rootsMatch = (left = {}, right = {}) =>
  left.templatesRoot === right.templatesRoot &&
  left.plansRoot === right.plansRoot &&
  left.submissionsRoot === right.submissionsRoot &&
  left.dailyLogsRoot === right.dailyLogsRoot;

const dedupeRootVariants = (variants = []) => {
  const seen = new Set();

  return (variants || []).filter((variant) => {
    const variantKey = [
      variant?.templatesRoot,
      variant?.plansRoot,
      variant?.submissionsRoot,
      variant?.dailyLogsRoot,
    ].join("|");

    if (seen.has(variantKey)) {
      return false;
    }

    seen.add(variantKey);
    return true;
  });
};

const buildPlansSemesterBaseUrl = (plansRoot, teacherId, courseId, semesterId) =>
  `${plansRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(courseId)}/${encodeURIComponent(semesterId)}`;

const buildPlansSemesterMonthsUrl = (plansRoot, teacherId, courseId, semesterId) =>
  `${buildPlansSemesterBaseUrl(plansRoot, teacherId, courseId, semesterId)}/months.json`;

const buildPlansSemesterNodeUrl = (plansRoot, teacherId, courseId, semesterId) =>
  `${buildPlansSemesterBaseUrl(plansRoot, teacherId, courseId, semesterId)}.json`;

const buildSubmissionsSemesterUrl = (submissionsRoot, teacherId, courseId, semesterId) =>
  `${submissionsRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(courseId)}/${encodeURIComponent(semesterId)}.json`;

const buildDailyLogsWeekUrl = (dailyLogsRoot, teacherId, courseId, semesterId, monthId, weekId) =>
  `${dailyLogsRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(courseId)}/${encodeURIComponent(semesterId)}/${encodeURIComponent(monthId)}/${encodeURIComponent(weekId)}.json`;

const buildLessonPlanReadCacheKey = (url) => `lesson_plan_read:${String(url || "").trim()}`;

const fetchLessonPlanJson = async (url, options = {}) => {
  const normalizedUrl = String(url || "").trim();
  const ttlMs = Number(options?.ttlMs || 0);
  const force = Boolean(options?.force);
  const fallbackValue = Object.prototype.hasOwnProperty.call(options || {}, "fallbackValue")
    ? options.fallbackValue
    : null;

  if (!normalizedUrl) {
    return fallbackValue;
  }

  const sessionEntry = !force
    ? readSessionResource(buildLessonPlanReadCacheKey(normalizedUrl), { ttlMs })
    : null;
  if (
    sessionEntry &&
    typeof sessionEntry === "object" &&
    Object.prototype.hasOwnProperty.call(sessionEntry, "hasValue")
  ) {
    return sessionEntry.data;
  }

  const data = await fetchCachedJson(normalizedUrl, {
    ttlMs,
    fallbackValue,
    force,
  });
  writeSessionResource(buildLessonPlanReadCacheKey(normalizedUrl), {
    hasValue: true,
    data,
  });

  return data;
};

const writeLessonPlanJsonCache = (url, data) => {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) {
    return data;
  }

  writeCachedJson(normalizedUrl, data);
  writeSessionResource(buildLessonPlanReadCacheKey(normalizedUrl), {
    hasValue: true,
    data,
  });
  return data;
};

const clearLessonPlanJsonCache = (url) => {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) {
    return;
  }

  clearCachedJson(normalizedUrl);
  clearSessionResource(buildLessonPlanReadCacheKey(normalizedUrl));
};

const buildLessonPlanRootsCacheKey = ({ rtdbBase, academicYear, teacherId, courseId, semesterId }) => (
  [
    "lesson_plan_roots",
    String(rtdbBase || "").trim(),
    String(academicYear || "legacy").trim(),
    String(teacherId || "").trim(),
    String(courseId || "").trim(),
    String(semesterId || "").trim(),
  ].join(":")
);

const readPreferredLessonPlanRoots = (params) => {
  const cacheKey = buildLessonPlanRootsCacheKey(params || {});
  const value = readSessionResource(cacheKey, {
    ttlMs: 12 * 60 * 60 * 1000,
  });

  if (!value || typeof value !== "object") {
    return null;
  }

  const nextValue = {
    templatesRoot: String(value.templatesRoot || ""),
    plansRoot: String(value.plansRoot || ""),
    submissionsRoot: String(value.submissionsRoot || ""),
    dailyLogsRoot: String(value.dailyLogsRoot || ""),
  };

  return hasResolvedRoots(nextValue) ? nextValue : null;
};

const writePreferredLessonPlanRoots = (params, roots) => {
  if (!hasResolvedRoots(roots)) {
    return;
  }

  writeSessionResource(buildLessonPlanRootsCacheKey(params || {}), {
    templatesRoot: String(roots.templatesRoot || ""),
    plansRoot: String(roots.plansRoot || ""),
    submissionsRoot: String(roots.submissionsRoot || ""),
    dailyLogsRoot: String(roots.dailyLogsRoot || ""),
  });
};

const clearSemesterPlanCaches = (plansRoot, teacherId, courseId, semesterId) => {
  if (!plansRoot || !teacherId || !courseId || !semesterId) return;
  clearLessonPlanJsonCache(buildPlansSemesterMonthsUrl(plansRoot, teacherId, courseId, semesterId));
  clearLessonPlanJsonCache(buildPlansSemesterNodeUrl(plansRoot, teacherId, courseId, semesterId));
};

const clearSemesterSubmissionCache = (submissionsRoot, teacherId, courseId, semesterId) => {
  if (!submissionsRoot || !teacherId || !courseId || !semesterId) return;
  clearLessonPlanJsonCache(buildSubmissionsSemesterUrl(submissionsRoot, teacherId, courseId, semesterId));
};

const clearWeekDailyLogsCache = (dailyLogsRoot, teacherId, courseId, semesterId, monthId, weekId) => {
  if (!dailyLogsRoot || !teacherId || !courseId || !semesterId || !monthId || !weekId) return;
  clearLessonPlanJsonCache(buildDailyLogsWeekUrl(dailyLogsRoot, teacherId, courseId, semesterId, monthId, weekId));
};

export function useLessonPlanData({ rtdbBase, academicYear, teacherId, course }) {
  const [semesterIds, setSemesterIds] = useState(DEFAULT_SEMESTER_IDS);
  const [selectedSemesterId, setSelectedSemesterId] = useState(DEFAULT_SEMESTER_IDS[0]);
  const [semesterIdsLoading, setSemesterIdsLoading] = useState(false);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dailyLogsByWeek, setDailyLogsByWeek] = useState({});
  const [dailyLogsLoadingKey, setDailyLogsLoadingKey] = useState("");
  const [resolvedRoots, setResolvedRoots] = useState({
    templatesRoot: "",
    plansRoot: "",
    submissionsRoot: "",
    dailyLogsRoot: "",
  });

  const encodedAcademicYear = useMemo(
    () => encodeURIComponent(academicYear || ""),
    [academicYear]
  );

  const canonicalRoots = useMemo(() => {
    if (!rtdbBase) {
      return {
        templatesRoot: "",
        plansRoot: "",
        submissionsRoot: "",
        dailyLogsRoot: "",
      };
    }

    if (!academicYear) {
      return {
        templatesRoot: `${rtdbBase}/AssessmentTemplates`,
        plansRoot: `${rtdbBase}/LessonPlans/TeachersLessonPlans`,
        submissionsRoot: `${rtdbBase}/LessonPlans/LessonSubmissions`,
        dailyLogsRoot: `${rtdbBase}/LessonPlans/LessonDailyLogs`,
      };
    }

    return {
      templatesRoot: `${rtdbBase}/AssessmentTemplates`,
      plansRoot: `${rtdbBase}/AcademicYears/${encodedAcademicYear}/LessonPlans/TeachersLessonPlans`,
      submissionsRoot: `${rtdbBase}/AcademicYears/${encodedAcademicYear}/LessonPlans/LessonSubmissions`,
      dailyLogsRoot: `${rtdbBase}/AcademicYears/${encodedAcademicYear}/LessonPlans/LessonDailyLogs`,
    };
  }, [rtdbBase, academicYear, encodedAcademicYear]);

  const templateRoots = useMemo(() => {
    if (!rtdbBase) return [];

    return [...new Set([
      `${rtdbBase}/AssessmentTemplates`,
      `${rtdbBase}/AssesmentTemplates`,
    ].filter(Boolean))];
  }, [rtdbBase]);

  const legacyRoots = useMemo(() => {
    if (!rtdbBase) {
      return [];
    }

    return dedupeRootVariants([
      canonicalRoots,
      {
        templatesRoot: `${rtdbBase}/AssessmentTemplates`,
        plansRoot: `${rtdbBase}/LessonPlans/TeachersLessonPlans`,
        submissionsRoot: `${rtdbBase}/LessonPlans/LessonSubmissions`,
        dailyLogsRoot: `${rtdbBase}/LessonPlans/LessonDailyLogs`,
      },
    ].filter(Boolean));
  }, [canonicalRoots, rtdbBase]);

  const pathVariants = useMemo(() => {
    return legacyRoots;
  }, [legacyRoots]);

  const firstObjectFromUrls = useCallback(async (urls) => {
    const normalizedUrls = (urls || []).filter(Boolean);
    if (!normalizedUrls.length) return { data: null, url: "" };

    for (const url of normalizedUrls) {
      if (!templateObjectCache.has(url)) {
        const request = fetchLessonPlanJson(url, {
          ttlMs: 15 * 60 * 1000,
          fallbackValue: null,
        })
          .then((data) => {
            if (data && typeof data === "object") {
              return { data, url };
            }
            return { data: null, url: "" };
          })
          .catch(() => ({ data: null, url: "" }));
        templateObjectCache.set(url, request);
      }

      const result = await templateObjectCache.get(url);
      if (result?.data && result?.url) {
        return result;
      }
    }

    return { data: null, url: "" };
  }, []);

  const fetchMonthMapForVariant = useCallback(async ({ variant, semesterId }) => {
    const candidates = [
      buildPlansSemesterMonthsUrl(variant.plansRoot, teacherId, course.id, semesterId),
      buildPlansSemesterNodeUrl(variant.plansRoot, teacherId, course.id, semesterId),
    ];

    for (const url of candidates) {
      try {
        const data = await fetchLessonPlanJson(url, {
          ttlMs: 30 * 1000,
          fallbackValue: null,
        });
        const node = data && typeof data === "object" ? data : null;
        if (!node) continue;

        const monthMap = extractMonthMap(node);
        if (Object.keys(monthMap).length) {
          return { monthMap, matchedUrl: url };
        }
      } catch {
        // try next result
      }
    }

    return { monthMap: {}, matchedUrl: "" };
  }, [teacherId, course?.id]);

  const fetchSubmissionMapForVariant = useCallback(async ({ variant, semesterId }) => {
    if (!variant?.submissionsRoot) {
      return {};
    }

    try {
      const submissionsUrl = buildSubmissionsSemesterUrl(
        variant.submissionsRoot,
        teacherId,
        course.id,
        semesterId
      );
      const data = await fetchLessonPlanJson(submissionsUrl, {
        ttlMs: 30 * 1000,
        fallbackValue: {},
      });
      return data && typeof data === "object"
        ? data
        : {};
    } catch {
      return {};
    }
  }, [teacherId, course?.id]);

  const migrateSemesterToCanonical = useCallback(async ({ sourceVariant, semesterId, monthMap, submissionMap }) => {
    if (
      !academicYear ||
      !teacherId ||
      !course?.id ||
      !semesterId ||
      !canonicalRoots?.plansRoot ||
      !sourceVariant ||
      rootsMatch(sourceVariant, canonicalRoots)
    ) {
      return false;
    }

    const migrationKey = [canonicalRoots.plansRoot, teacherId, course.id, semesterId].join("|");
    if (migratedLessonPlanSemesters.has(migrationKey)) {
      return true;
    }

    const requests = [];
    if (monthMap && Object.keys(monthMap).length) {
      const canonicalMonthsUrl = buildPlansSemesterMonthsUrl(
        canonicalRoots.plansRoot,
        teacherId,
        course.id,
        semesterId
      );
      const canonicalSemesterUrl = buildPlansSemesterNodeUrl(
        canonicalRoots.plansRoot,
        teacherId,
        course.id,
        semesterId
      );
      requests.push(
        axios.put(
          canonicalMonthsUrl,
          monthMap
        )
          .then(() => {
            writeLessonPlanJsonCache(canonicalMonthsUrl, monthMap);
            writeLessonPlanJsonCache(canonicalSemesterUrl, { months: monthMap });
            return true;
          })
          .catch(() => false)
      );
    }

    if (submissionMap && Object.keys(submissionMap).length && canonicalRoots?.submissionsRoot) {
      const canonicalSubmissionsUrl = buildSubmissionsSemesterUrl(
        canonicalRoots.submissionsRoot,
        teacherId,
        course.id,
        semesterId
      );
      requests.push(
        axios.put(
          canonicalSubmissionsUrl,
          submissionMap
        )
          .then(() => {
            writeLessonPlanJsonCache(canonicalSubmissionsUrl, submissionMap);
            return true;
          })
          .catch(() => false)
      );
    }

    if (!requests.length) {
      return false;
    }

    const results = await Promise.all(requests);

    if (results.some(Boolean)) {
      migratedLessonPlanSemesters.add(migrationKey);
      return true;
    }

    return false;
  }, [academicYear, canonicalRoots, teacherId, course?.id]);

  useEffect(() => {
    const loadSemesterIds = async () => {
      if (!rtdbBase || !course?.grade) {
        setSemesterIds(DEFAULT_SEMESTER_IDS);
        setSelectedSemesterId(DEFAULT_SEMESTER_IDS[0]);
        setSemesterIdsLoading(false);
        return;
      }

      setSemesterIdsLoading(true);

      try {
        const gradeKey = encodeURIComponent(course.grade);
        const templateCandidates = templateRoots
          .map((templateRoot) => `${templateRoot}/${gradeKey}.json`)
          .filter(Boolean);

        const { data: templateData } = await firstObjectFromUrls(templateCandidates);
        setResolvedRoots((previousRoots) =>
          rootsMatch(previousRoots, canonicalRoots) ? previousRoots : canonicalRoots
        );

        const nextSemesters = extractSemesterIds(templateData || {}, course);
        setSemesterIds(nextSemesters);
        setSelectedSemesterId((prev) => {
          const normalizedPrev = normalizeSemesterId(prev);
          return nextSemesters.includes(normalizedPrev) ? normalizedPrev : nextSemesters[0];
        });
      } catch {
        setSemesterIds(DEFAULT_SEMESTER_IDS);
        setSelectedSemesterId((prev) => normalizeSemesterId(prev) || DEFAULT_SEMESTER_IDS[0]);
      } finally {
        setSemesterIdsLoading(false);
      }
    };

    void loadSemesterIds();
  }, [rtdbBase, templateRoots, canonicalRoots, firstObjectFromUrls, course?.id, course?.grade, course?.subject, course?.name]);

  const refreshWeeks = useCallback(async () => {
    if (!rtdbBase || !teacherId || !course?.id || !selectedSemesterId) {
      setWeeks([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const preferredRoots = readPreferredLessonPlanRoots({
        rtdbBase,
        academicYear,
        teacherId,
        courseId: course.id,
        semesterId: selectedSemesterId,
      });

      const prioritizedVariants = hasResolvedRoots(preferredRoots || {})
        ? dedupeRootVariants([preferredRoots, resolvedRoots, canonicalRoots, ...pathVariants])
        : hasResolvedRoots(resolvedRoots)
          ? dedupeRootVariants([resolvedRoots, canonicalRoots, ...pathVariants])
          : pathVariants;

      let matchedResult = null;
      for (const variant of prioritizedVariants) {
        const result = await fetchMonthMapForVariant({ variant, semesterId: selectedSemesterId });
        if (Object.keys(result.monthMap).length) {
          matchedResult = { variant, ...result };
          break;
        }
      }

      const monthMap = matchedResult?.monthMap || {};
      const matchedVariant = matchedResult?.variant || null;
      let activeVariant = matchedVariant
        || preferredRoots
        || (hasResolvedRoots(resolvedRoots) ? resolvedRoots : (prioritizedVariants[0] || null));

      let submissionMap = {};
      if (matchedVariant?.submissionsRoot) {
        submissionMap = await fetchSubmissionMapForVariant({
          variant: matchedVariant,
          semesterId: selectedSemesterId,
        });
      } else if (activeVariant?.submissionsRoot) {
        submissionMap = await fetchSubmissionMapForVariant({
          variant: activeVariant,
          semesterId: selectedSemesterId,
        });
      }

      const migratedToCanonical = await migrateSemesterToCanonical({
        sourceVariant: matchedVariant,
        semesterId: selectedSemesterId,
        monthMap,
        submissionMap,
      });

      if (migratedToCanonical) {
        activeVariant = canonicalRoots;
      }

      if (activeVariant) {
        writePreferredLessonPlanRoots({
          rtdbBase,
          academicYear,
          teacherId,
          courseId: course.id,
          semesterId: selectedSemesterId,
        }, activeVariant);
      }

      if (activeVariant && !rootsMatch(resolvedRoots, activeVariant)) {
        setResolvedRoots((previousRoots) => (rootsMatch(previousRoots, activeVariant) ? previousRoots : activeVariant));
      }

      const rows = [];
      Object.entries(monthMap).forEach(([monthId, monthNode]) => {
        const weeksNode = monthNode?.weeks && typeof monthNode.weeks === "object" ? monthNode.weeks : {};
        Object.entries(weeksNode).forEach(([weekId, weekData]) => {
          const submissionWeek = submissionMap?.[monthId]?.[weekId] || {};
          rows.push(normalizeWeek(monthId, weekId, weekData, submissionWeek));
        });
      });

      setWeeks(sortWeeks(rows));
      if (!rows.length) setError("No lesson plan rows found. Use Add Week Plan to create the first lesson entry.");
    } catch {
      setError("Unable to load lesson plans with the selected filters.");
      setWeeks([]);
    } finally {
      setLoading(false);
    }
  }, [rtdbBase, academicYear, pathVariants, canonicalRoots, resolvedRoots, selectedSemesterId, fetchMonthMapForVariant, fetchSubmissionMapForVariant, migrateSemesterToCanonical, teacherId, course?.id]);

  useEffect(() => {
    refreshWeeks();
  }, [refreshWeeks]);

  const saveWeekPlans = useCallback(async (entries = []) => {
    if (!teacherId || !course?.id || !selectedSemesterId) return false;

    const normalizedEntries = (entries || [])
      .map((entry) => {
        const rowId = String(entry?.rowId || "").trim();
        const monthId = String(entry?.monthId || "").trim();
        const weekId = String(entry?.weekId || "").trim();
        if (!monthId || !weekId) return null;

        return {
          rowId,
          monthId,
          weekId,
          payload: normalizeWeekPayload(entry?.payload || {}),
        };
      })
      .filter(Boolean);

    if (!normalizedEntries.length) return true;

    setSaving(true);
    try {
      const plansRoot = canonicalRoots.plansRoot || resolvedRoots.plansRoot;
      await Promise.all(
        normalizedEntries.map((entry) => {
          const weekUrl = `${plansRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/months/${encodeURIComponent(entry.monthId)}/weeks/${encodeURIComponent(entry.weekId)}.json`;
          return axios.patch(weekUrl, entry.payload);
        })
      );
      clearSemesterPlanCaches(plansRoot, teacherId, course.id, selectedSemesterId);
      const updatesByRowId = new Map(
        normalizedEntries.map((entry) => [
          entry.rowId || `${entry.monthId}__${entry.weekId}`,
          entry.payload,
        ])
      );

      setWeeks((previousWeeks) =>
        sortWeeks(
          previousWeeks.map((row) => {
            const nextPayload = updatesByRowId.get(row.id);
            if (!nextPayload) return row;
            return {
              ...row,
              ...nextPayload,
              expectedDays: Number(nextPayload.expectedDays || 0),
            };
          })
        )
      );
      return true;
    } finally {
      setSaving(false);
    }
  }, [canonicalRoots.plansRoot, resolvedRoots.plansRoot, teacherId, course?.id, selectedSemesterId]);

  const updateWeekPlan = useCallback(async (rowId, changes) => {
    const target = weeks.find((row) => row.id === rowId);
    if (!target) return false;

    return saveWeekPlans([
      {
        rowId,
        monthId: target.monthId,
        weekId: target.weekId,
        payload: {
          objective: changes.objective ?? target.objective ?? "",
          topic: changes.topic ?? target.topic ?? "",
          method: changes.method ?? target.method ?? "",
          material: changes.material ?? target.material ?? "",
          assessment: changes.assessment ?? target.assessment ?? "",
          expectedDays: changes.expectedDays ?? target.expectedDays ?? 0,
        },
      },
    ]);
  }, [weeks, saveWeekPlans]);

  const loadWeekDailyLogs = useCallback(async ({ monthId, weekId }) => {
    if (!teacherId || !course?.id || !selectedSemesterId || !monthId || !weekId) return [];
    const cacheKey = `${monthId}__${weekId}`;
    setDailyLogsLoadingKey(cacheKey);

    try {
      const preferredRoots = readPreferredLessonPlanRoots({
        rtdbBase,
        academicYear,
        teacherId,
        courseId: course.id,
        semesterId: selectedSemesterId,
      });

      const prioritizedVariants = hasResolvedRoots(preferredRoots || {})
        ? dedupeRootVariants([preferredRoots, resolvedRoots, canonicalRoots, ...pathVariants])
        : hasResolvedRoots(resolvedRoots)
          ? dedupeRootVariants([resolvedRoots, canonicalRoots, ...pathVariants])
          : pathVariants;

      let node = {};
      let matchedVariant = null;

      for (const variant of prioritizedVariants) {
        if (!variant?.dailyLogsRoot) continue;

        try {
          const url = buildDailyLogsWeekUrl(
            variant.dailyLogsRoot,
            teacherId,
            course.id,
            selectedSemesterId,
            monthId,
            weekId
          );
          const data = await fetchLessonPlanJson(url, {
            ttlMs: 30 * 1000,
            fallbackValue: {},
          });
          const candidateNode = data && typeof data === "object" ? data : {};
          if (Object.keys(candidateNode).length) {
            node = candidateNode;
            matchedVariant = variant;
            break;
          }
        } catch {
          // try next location
        }
      }

      if (
        matchedVariant &&
        !rootsMatch(matchedVariant, canonicalRoots) &&
        canonicalRoots?.dailyLogsRoot &&
        Object.keys(node).length
      ) {
        const migrationKey = [canonicalRoots.dailyLogsRoot, teacherId, course.id, selectedSemesterId, monthId, weekId].join("|");
        if (!migratedLessonPlanWeeks.has(migrationKey)) {
          const canonicalDailyLogsUrl = buildDailyLogsWeekUrl(
            canonicalRoots.dailyLogsRoot,
            teacherId,
            course.id,
            selectedSemesterId,
            monthId,
            weekId
          );
          await axios.put(
            canonicalDailyLogsUrl,
            node
          ).then(() => {
            writeLessonPlanJsonCache(canonicalDailyLogsUrl, node);
          }).catch(() => null);
          migratedLessonPlanWeeks.add(migrationKey);
        }
        writePreferredLessonPlanRoots({
          rtdbBase,
          academicYear,
          teacherId,
          courseId: course.id,
          semesterId: selectedSemesterId,
        }, canonicalRoots);
        setResolvedRoots((previousRoots) => (rootsMatch(previousRoots, canonicalRoots) ? previousRoots : canonicalRoots));
      } else if (matchedVariant && !rootsMatch(resolvedRoots, matchedVariant)) {
        writePreferredLessonPlanRoots({
          rtdbBase,
          academicYear,
          teacherId,
          courseId: course.id,
          semesterId: selectedSemesterId,
        }, matchedVariant);
        setResolvedRoots((previousRoots) => (rootsMatch(previousRoots, matchedVariant) ? previousRoots : matchedVariant));
      }

      const logs = Object.entries(node)
        .map(([date, value]) => ({
          date,
          dayName: String(value?.dayName || ""),
          topic: String(value?.topic || ""),
          method: String(value?.method || ""),
          aids: String(value?.aids || ""),
          assessment: String(value?.assessment || ""),
          note: String(value?.note || ""),
        }))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

      setDailyLogsByWeek((prev) => ({ ...prev, [cacheKey]: logs }));
      return logs;
    } finally {
      setDailyLogsLoadingKey("");
    }
  }, [rtdbBase, academicYear, resolvedRoots, canonicalRoots, pathVariants, teacherId, course?.id, selectedSemesterId]);

  const saveDailyLog = useCallback(async ({ monthId, weekId, date, log }) => {
    if (!teacherId || !course?.id || !selectedSemesterId || !monthId || !weekId || !date) return;

    const dailyRoot = canonicalRoots.dailyLogsRoot || resolvedRoots.dailyLogsRoot;

    const logUrl = `${dailyRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/${encodeURIComponent(monthId)}/${encodeURIComponent(weekId)}/${encodeURIComponent(date)}.json`;

    const payload = {
      dayName: String(log.dayName || ""),
      topic: String(log.topic || ""),
      method: String(log.method || ""),
      aids: String(log.aids || ""),
      assessment: String(log.assessment || ""),
      note: String(log.note || ""),
      createdAt: Date.now(),
    };

    setSaving(true);
    try {
      await axios.put(logUrl, payload);
      clearWeekDailyLogsCache(dailyRoot, teacherId, course.id, selectedSemesterId, monthId, weekId);
      const cacheKey = `${monthId}__${weekId}`;
      const normalizedLog = {
        date,
        dayName: payload.dayName,
        topic: payload.topic,
        method: payload.method,
        aids: payload.aids,
        assessment: payload.assessment,
        note: payload.note,
      };

      setDailyLogsByWeek((previousLogsByWeek) => {
        const previousLogs = Array.isArray(previousLogsByWeek[cacheKey]) ? previousLogsByWeek[cacheKey] : [];
        const nextLogs = [...previousLogs.filter((item) => item.date !== date), normalizedLog].sort((a, b) => String(a.date).localeCompare(String(b.date)));
        return { ...previousLogsByWeek, [cacheKey]: nextLogs };
      });
    } finally {
      setSaving(false);
    }
  }, [canonicalRoots.dailyLogsRoot, resolvedRoots.dailyLogsRoot, teacherId, course?.id, selectedSemesterId]);

  const submitLessonEntries = useCallback(async ({ monthId, weekId, dates }) => {
    if (!teacherId || !course?.id || !selectedSemesterId || !monthId || !weekId) return [];

    const normalizedDates = Array.from(new Set(
      (Array.isArray(dates) ? dates : [dates])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ));

    if (!normalizedDates.length) return [];

    const submissionsRoot = canonicalRoots.submissionsRoot || resolvedRoots.submissionsRoot;
    const submissionUrl = `${submissionsRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/${encodeURIComponent(monthId)}/${encodeURIComponent(weekId)}.json`;

    setSaving(true);
    try {
      const week = weeks.find((item) => item.monthId === monthId && item.weekId === weekId);
      const expectedDays = Number(week?.expectedDays || 0);
      const existingSubmitted = new Set(Array.isArray(week?.submittedDays) ? week.submittedDays : []);
      const newDates = normalizedDates.filter((date) => !existingSubmitted.has(date));

      if (!newDates.length) return [];

      const nextSubmittedSet = new Set([...existingSubmitted, ...newDates]);
      const nextSubmittedDays = Array.from(nextSubmittedSet).sort((left, right) => String(left).localeCompare(String(right)));
      const nextSubmittedCount = nextSubmittedDays.length;
      const nextStatus = expectedDays > 0 && nextSubmittedCount >= expectedDays ? "complete" : "in_progress";
      const lastSubmittedAt = Date.now();

      await axios.patch(submissionUrl, {
        ...newDates.reduce((payload, date) => {
          payload[`submittedDays/${date}`] = true;
          return payload;
        }, {}),
        status: nextStatus,
        lastSubmittedAt,
      });
      clearSemesterSubmissionCache(submissionsRoot, teacherId, course.id, selectedSemesterId);

      setWeeks((previousWeeks) =>
        sortWeeks(
          previousWeeks.map((item) => {
            if (item.monthId !== monthId || item.weekId !== weekId) return item;
            return {
              ...item,
              submittedDays: nextSubmittedDays,
              submittedCount: nextSubmittedCount,
              progressPercent: expectedDays > 0 ? Math.min(100, Math.round((nextSubmittedCount / expectedDays) * 100)) : 0,
              status: nextStatus,
              lastSubmittedAt,
            };
          })
        )
      );

      return newDates;
    } finally {
      setSaving(false);
    }
  }, [canonicalRoots.submissionsRoot, resolvedRoots.submissionsRoot, teacherId, course?.id, selectedSemesterId, weeks]);

  const submitDailyLog = useCallback(async ({ monthId, weekId, date }) => {
    return submitLessonEntries({ monthId, weekId, dates: [date] });
  }, [submitLessonEntries]);

  const submitDailyLogsBatch = useCallback(async ({ monthId, weekId, dates }) => {
    return submitLessonEntries({ monthId, weekId, dates });
  }, [submitLessonEntries]);

  const completeWeek = useCallback(async ({ monthId, weekId }) => {
    const week = weeks.find((item) => item.monthId === monthId && item.weekId === weekId);
    if (!week) return false;
    if (week.submittedCount < week.expectedDays) return false;

    const submissionsRoot = canonicalRoots.submissionsRoot || resolvedRoots.submissionsRoot;
    const submissionUrl = `${submissionsRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/${encodeURIComponent(monthId)}/${encodeURIComponent(weekId)}.json`;

    setSaving(true);
    try {
      await axios.patch(submissionUrl, { status: "complete", lastSubmittedAt: Date.now() });
      clearSemesterSubmissionCache(submissionsRoot, teacherId, course.id, selectedSemesterId);
      await refreshWeeks();
      return true;
    } finally {
      setSaving(false);
    }
  }, [weeks, canonicalRoots.submissionsRoot, resolvedRoots.submissionsRoot, teacherId, course?.id, selectedSemesterId, refreshWeeks]);

  const createWeekPlan = useCallback(async ({ monthId, weekId, payload }) => {
    if (!teacherId || !course?.id || !selectedSemesterId || !monthId || !weekId) return;

    const plansRoot = canonicalRoots.plansRoot || resolvedRoots.plansRoot;
    const weekUrl = `${plansRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/months/${encodeURIComponent(monthId)}/weeks/${encodeURIComponent(weekId)}.json`;

    const body = {
      objective: String(payload?.objective || ""),
      topic: String(payload?.topic || ""),
      method: String(payload?.method || ""),
      material: String(payload?.material || ""),
      assessment: String(payload?.assessment || ""),
      expectedDays: Number(payload?.expectedDays || 5),
      createdAt: payload?.createdAt || Date.now(),
    };

    setSaving(true);
    try {
      await axios.put(weekUrl, body);
      clearSemesterPlanCaches(plansRoot, teacherId, course.id, selectedSemesterId);
      setWeeks((previousWeeks) =>
        sortWeeks([
          ...previousWeeks.filter((row) => row.id !== `${monthId}__${weekId}`),
          normalizeWeek(monthId, weekId, body, {}),
        ])
      );
      setError("");
    } finally {
      setSaving(false);
    }
  }, [canonicalRoots.plansRoot, resolvedRoots.plansRoot, teacherId, course?.id, selectedSemesterId]);

  const deleteWeekPlan = useCallback(async ({ monthId, weekId }) => {
    if (!teacherId || !course?.id || !selectedSemesterId || !monthId || !weekId) return;

    const plansRoot = canonicalRoots.plansRoot || resolvedRoots.plansRoot;
    const dailyRoot = canonicalRoots.dailyLogsRoot || resolvedRoots.dailyLogsRoot;
    const submissionsRoot = canonicalRoots.submissionsRoot || resolvedRoots.submissionsRoot;

    const weekUrl = `${plansRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/months/${encodeURIComponent(monthId)}/weeks/${encodeURIComponent(weekId)}.json`;
    const weekLogsUrl = `${dailyRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/${encodeURIComponent(monthId)}/${encodeURIComponent(weekId)}.json`;
    const weekSubmissionUrl = `${submissionsRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/${encodeURIComponent(monthId)}/${encodeURIComponent(weekId)}.json`;

    setSaving(true);
    try {
      await Promise.all([
        axios.delete(weekUrl),
        axios.delete(weekLogsUrl).catch(() => null),
        axios.delete(weekSubmissionUrl).catch(() => null),
      ]);
      clearSemesterPlanCaches(plansRoot, teacherId, course.id, selectedSemesterId);
      clearSemesterSubmissionCache(submissionsRoot, teacherId, course.id, selectedSemesterId);
      clearWeekDailyLogsCache(dailyRoot, teacherId, course.id, selectedSemesterId, monthId, weekId);
      await refreshWeeks();
    } finally {
      setSaving(false);
    }
  }, [canonicalRoots.plansRoot, canonicalRoots.dailyLogsRoot, canonicalRoots.submissionsRoot, resolvedRoots.plansRoot, resolvedRoots.dailyLogsRoot, resolvedRoots.submissionsRoot, teacherId, course?.id, selectedSemesterId, refreshWeeks]);

  const deleteDailyLog = useCallback(async ({ monthId, weekId, date }) => {
    if (!teacherId || !course?.id || !selectedSemesterId || !monthId || !weekId || !date) return;

    const dailyRoot = canonicalRoots.dailyLogsRoot || resolvedRoots.dailyLogsRoot;
    const submissionsRoot = canonicalRoots.submissionsRoot || resolvedRoots.submissionsRoot;

    const logUrl = `${dailyRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/${encodeURIComponent(monthId)}/${encodeURIComponent(weekId)}/${encodeURIComponent(date)}.json`;
    const submissionUrl = `${submissionsRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/${encodeURIComponent(monthId)}/${encodeURIComponent(weekId)}.json`;

    setSaving(true);
    try {
      await axios.delete(logUrl);
      clearWeekDailyLogsCache(dailyRoot, teacherId, course.id, selectedSemesterId, monthId, weekId);

      const week = weeks.find((item) => item.monthId === monthId && item.weekId === weekId);
      const expectedDays = Number(week?.expectedDays || 0);
      const existingSubmitted = Array.isArray(week?.submittedDays) ? week.submittedDays : [];
      const remainingSubmitted = existingSubmitted.filter((d) => d !== date);

      const nextStatus = expectedDays > 0 && remainingSubmitted.length >= expectedDays
        ? "complete"
        : remainingSubmitted.length > 0
          ? "in_progress"
          : "pending";

      await axios.patch(submissionUrl, {
        [`submittedDays/${date}`]: null,
        status: nextStatus,
        lastSubmittedAt: Date.now(),
      }).catch(() => null);
      clearSemesterSubmissionCache(submissionsRoot, teacherId, course.id, selectedSemesterId);

      await loadWeekDailyLogs({ monthId, weekId });
      await refreshWeeks();
    } finally {
      setSaving(false);
    }
  }, [canonicalRoots.dailyLogsRoot, canonicalRoots.submissionsRoot, resolvedRoots.dailyLogsRoot, resolvedRoots.submissionsRoot, teacherId, course?.id, selectedSemesterId, weeks, loadWeekDailyLogs, refreshWeeks]);

  return {
    semesterIds,
    semesterIdsLoading,
    selectedSemesterId,
    setSelectedSemesterId,
    weeks,
    loading,
    saving,
    error,
    refreshWeeks,
    saveWeekPlans,
    updateWeekPlan,
    dailyLogsByWeek,
    dailyLogsLoadingKey,
    loadWeekDailyLogs,
    saveDailyLog,
    submitDailyLog,
    submitDailyLogsBatch,
    completeWeek,
    createWeekPlan,
    deleteWeekPlan,
    deleteDailyLog,
  };
}
