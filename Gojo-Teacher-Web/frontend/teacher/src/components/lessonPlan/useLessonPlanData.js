import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

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

  const baseYearPath = useMemo(() => {
    if (!rtdbBase || !academicYear) return "";
    return `${rtdbBase}/academicYears/${encodeURIComponent(academicYear)}`;
  }, [rtdbBase, academicYear]);

  const pathVariants = useMemo(() => {
    if (!rtdbBase) return [];
    const year = encodeURIComponent(academicYear || "");

    return [
      {
        templatesRoot: `${rtdbBase}/AssesmentTemplates`,
        plansRoot: `${rtdbBase}/LessonPlans/TeachersLessonPlans`,
        submissionsRoot: `${rtdbBase}/LessonPlans/LessonSubmissions`,
        dailyLogsRoot: `${rtdbBase}/LessonPlans/LessonDailyLogs`,
      },
      {
        templatesRoot: `${rtdbBase}/AssessmentTemplates`,
        plansRoot: `${rtdbBase}/LessonPlans/TeachersLessonPlans`,
        submissionsRoot: `${rtdbBase}/LessonPlans/LessonSubmissions`,
        dailyLogsRoot: `${rtdbBase}/LessonPlans/LessonDailyLogs`,
      },
      {
        templatesRoot: academicYear ? `${rtdbBase}/academicYears/${year}/AssessmentTemplates` : "",
        plansRoot: academicYear ? `${rtdbBase}/academicYears/${year}/LessonPlans` : "",
        submissionsRoot: academicYear ? `${rtdbBase}/academicYears/${year}/LessonSubmissions` : "",
        dailyLogsRoot: academicYear ? `${rtdbBase}/academicYears/${year}/LessonDailyLogs` : "",
      },
      {
        templatesRoot: academicYear ? `${rtdbBase}/AcademicYears/${year}/AssessmentTemplates` : "",
        plansRoot: academicYear ? `${rtdbBase}/AcademicYears/${year}/LessonPlans` : "",
        submissionsRoot: academicYear ? `${rtdbBase}/AcademicYears/${year}/LessonSubmissions` : "",
        dailyLogsRoot: academicYear ? `${rtdbBase}/AcademicYears/${year}/LessonDailyLogs` : "",
      },
      {
        templatesRoot: `${rtdbBase}/AssessmentTemplates`,
        plansRoot: `${rtdbBase}/LessonPlans`,
        submissionsRoot: `${rtdbBase}/LessonSubmissions`,
        dailyLogsRoot: `${rtdbBase}/LessonDailyLogs`,
      },
    ];
  }, [rtdbBase, academicYear]);

  const firstObjectFromUrls = useCallback(async (urls) => {
    const normalizedUrls = (urls || []).filter(Boolean);
    if (!normalizedUrls.length) return { data: null, url: "" };

    const results = await Promise.all(
      normalizedUrls.map(async (url) => {
        try {
          const response = await axios.get(url);
          if (response?.data && typeof response.data === "object") {
            return { data: response.data, url };
          }
        } catch {
          // try next result
        }

        return { data: null, url: "" };
      })
    );

    const match = results.find((result) => result.data && result.url);
    if (match) return match;
    return { data: null, url: "" };
  }, []);

  const fetchMonthMapForVariant = useCallback(async ({ variant, semesterId }) => {
    const baseNode = `${variant.plansRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(semesterId)}`;
    const candidates = [`${baseNode}/months.json`, `${baseNode}.json`];
    const results = await Promise.all(
      candidates.map(async (url) => {
        try {
          const response = await axios.get(url);
          const node = response?.data && typeof response.data === "object" ? response.data : null;
          if (!node) return { monthMap: {}, matchedUrl: "" };
          return { monthMap: extractMonthMap(node), matchedUrl: url };
        } catch {
          return { monthMap: {}, matchedUrl: "" };
        }
      })
    );

    return results.find((result) => Object.keys(result.monthMap).length) || { monthMap: {}, matchedUrl: "" };
  }, [teacherId, course?.id]);

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
        const templateCandidates = pathVariants
          .map((variant) => (variant.templatesRoot ? `${variant.templatesRoot}/${gradeKey}.json` : ""))
          .filter(Boolean);

        const { data: templateData, url } = await firstObjectFromUrls(templateCandidates);
        if (templateData && url) {
          const matched = pathVariants.find((variant) => url.startsWith(variant.templatesRoot));
          if (matched) {
            setResolvedRoots((previousRoots) => (rootsMatch(previousRoots, matched) ? previousRoots : matched));
          }
        }

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
  }, [rtdbBase, pathVariants, firstObjectFromUrls, course?.id, course?.grade, course?.subject, course?.name]);

  const refreshWeeks = useCallback(async () => {
    if (!rtdbBase || !teacherId || !course?.id || !selectedSemesterId) {
      setWeeks([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const variantResults = await Promise.all(
        pathVariants.map(async (variant) => ({
          variant,
          ...(await fetchMonthMapForVariant({ variant, semesterId: selectedSemesterId })),
        }))
      );

      const matchedResult = variantResults.find((result) => Object.keys(result.monthMap).length);
      const monthMap = matchedResult?.monthMap || {};
      const matchedVariant = matchedResult?.variant || null;
      const activeVariant = matchedVariant || (hasResolvedRoots(resolvedRoots) ? resolvedRoots : (pathVariants[0] || null));

      if (matchedVariant && !rootsMatch(resolvedRoots, matchedVariant)) {
        setResolvedRoots((previousRoots) => (rootsMatch(previousRoots, matchedVariant) ? previousRoots : matchedVariant));
      }

      let submissionMap = {};
      if (activeVariant?.submissionsRoot) {
        try {
          const submissionsUrl = `${activeVariant.submissionsRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}.json`;
          const submissionsRes = await axios.get(submissionsUrl);
          submissionMap = submissionsRes?.data && typeof submissionsRes.data === "object" ? submissionsRes.data : {};
        } catch {
          submissionMap = {};
        }
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
  }, [rtdbBase, pathVariants, resolvedRoots, selectedSemesterId, fetchMonthMapForVariant, teacherId, course?.id]);

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
      const plansRoot = resolvedRoots.plansRoot || `${baseYearPath}/LessonPlans`;
      await Promise.all(
        normalizedEntries.map((entry) => {
          const weekUrl = `${plansRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/months/${encodeURIComponent(entry.monthId)}/weeks/${encodeURIComponent(entry.weekId)}.json`;
          return axios.patch(weekUrl, entry.payload);
        })
      );
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
  }, [resolvedRoots.plansRoot, baseYearPath, teacherId, course?.id, selectedSemesterId]);

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
      const dailyRoot = resolvedRoots.dailyLogsRoot || `${baseYearPath}/LessonDailyLogs`;
      const url = `${dailyRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/${encodeURIComponent(monthId)}/${encodeURIComponent(weekId)}.json`;
      const response = await axios.get(url);
      const node = response?.data && typeof response.data === "object" ? response.data : {};
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
  }, [resolvedRoots.dailyLogsRoot, baseYearPath, teacherId, course?.id, selectedSemesterId]);

  const saveDailyLog = useCallback(async ({ monthId, weekId, date, log }) => {
    if (!teacherId || !course?.id || !selectedSemesterId || !monthId || !weekId || !date) return;

    const dailyRoot = resolvedRoots.dailyLogsRoot || `${baseYearPath}/LessonDailyLogs`;

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
  }, [resolvedRoots.dailyLogsRoot, baseYearPath, teacherId, course?.id, selectedSemesterId]);

  const submitLessonEntries = useCallback(async ({ monthId, weekId, dates }) => {
    if (!teacherId || !course?.id || !selectedSemesterId || !monthId || !weekId) return [];

    const normalizedDates = Array.from(new Set(
      (Array.isArray(dates) ? dates : [dates])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ));

    if (!normalizedDates.length) return [];

    const submissionsRoot = resolvedRoots.submissionsRoot || `${baseYearPath}/LessonSubmissions`;
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
  }, [resolvedRoots.submissionsRoot, baseYearPath, teacherId, course?.id, selectedSemesterId, weeks]);

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

    const submissionsRoot = resolvedRoots.submissionsRoot || `${baseYearPath}/LessonSubmissions`;
    const submissionUrl = `${submissionsRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/${encodeURIComponent(monthId)}/${encodeURIComponent(weekId)}.json`;

    setSaving(true);
    try {
      await axios.patch(submissionUrl, { status: "complete", lastSubmittedAt: Date.now() });
      await refreshWeeks();
      return true;
    } finally {
      setSaving(false);
    }
  }, [weeks, resolvedRoots.submissionsRoot, baseYearPath, teacherId, course?.id, selectedSemesterId, refreshWeeks]);

  const createWeekPlan = useCallback(async ({ monthId, weekId, payload }) => {
    if (!teacherId || !course?.id || !selectedSemesterId || !monthId || !weekId) return;

    const plansRoot = resolvedRoots.plansRoot || `${baseYearPath}/LessonPlans`;
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
  }, [resolvedRoots.plansRoot, baseYearPath, teacherId, course?.id, selectedSemesterId]);

  const deleteWeekPlan = useCallback(async ({ monthId, weekId }) => {
    if (!teacherId || !course?.id || !selectedSemesterId || !monthId || !weekId) return;

    const plansRoot = resolvedRoots.plansRoot || `${baseYearPath}/LessonPlans`;
    const dailyRoot = resolvedRoots.dailyLogsRoot || `${baseYearPath}/LessonDailyLogs`;
    const submissionsRoot = resolvedRoots.submissionsRoot || `${baseYearPath}/LessonSubmissions`;

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
      await refreshWeeks();
    } finally {
      setSaving(false);
    }
  }, [resolvedRoots.plansRoot, resolvedRoots.dailyLogsRoot, resolvedRoots.submissionsRoot, baseYearPath, teacherId, course?.id, selectedSemesterId, refreshWeeks]);

  const deleteDailyLog = useCallback(async ({ monthId, weekId, date }) => {
    if (!teacherId || !course?.id || !selectedSemesterId || !monthId || !weekId || !date) return;

    const dailyRoot = resolvedRoots.dailyLogsRoot || `${baseYearPath}/LessonDailyLogs`;
    const submissionsRoot = resolvedRoots.submissionsRoot || `${baseYearPath}/LessonSubmissions`;

    const logUrl = `${dailyRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/${encodeURIComponent(monthId)}/${encodeURIComponent(weekId)}/${encodeURIComponent(date)}.json`;
    const submissionUrl = `${submissionsRoot}/${encodeURIComponent(teacherId)}/${encodeURIComponent(course.id)}/${encodeURIComponent(selectedSemesterId)}/${encodeURIComponent(monthId)}/${encodeURIComponent(weekId)}.json`;

    setSaving(true);
    try {
      await axios.delete(logUrl);

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

      await loadWeekDailyLogs({ monthId, weekId });
      await refreshWeeks();
    } finally {
      setSaving(false);
    }
  }, [resolvedRoots.dailyLogsRoot, resolvedRoots.submissionsRoot, baseYearPath, teacherId, course?.id, selectedSemesterId, weeks, loadWeekDailyLogs, refreshWeeks]);

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
