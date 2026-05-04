import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  FaBookOpen,
  FaCheckCircle,
  FaChevronRight,
  FaClipboardCheck,
  FaHourglassHalf,
  FaTimes,
} from "react-icons/fa";
import { getRtdbRoot, RTDB_BASE_RAW } from "../../api/rtdbScope";
import { getTeacherCourseContext } from "../../api/teacherApi";
import { formatSemesterLabel, normalizeSemesterId, useLessonPlanData } from "../lessonPlan/useLessonPlanData";
import "../../styles/settingsPage.css";

const QUICK_CHECK_COURSE_STORAGE_KEY = "teacher_settings_quick_lesson_course";
const QUICK_CHECK_SEMESTER_STORAGE_KEY = "teacher_settings_quick_lesson_semester";

const resolveAcademicYearFromNode = (yearsNode) => {
  if (!yearsNode || typeof yearsNode !== "object") return "";
  const withCurrent = Object.entries(yearsNode).find(([, value]) => Boolean(value?.isCurrent));
  if (withCurrent?.[0]) return String(withCurrent[0]);
  return String(Object.keys(yearsNode)[0] || "");
};

const normalizeTimestamp = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const formatDateLabel = (isoDate, dayName) => {
  if (!isoDate) return dayName || "Pending day";
  const dateValue = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(dateValue.getTime())) {
    return [dayName, isoDate].filter(Boolean).join(" • ");
  }
  return `${dayName || dateValue.toLocaleDateString([], { weekday: "long" })} • ${dateValue.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })}`;
};

const getStoredCourseId = (teacherUserId) => {
  if (typeof window === "undefined" || !teacherUserId) return "";
  return String(window.localStorage.getItem(`${QUICK_CHECK_COURSE_STORAGE_KEY}_${teacherUserId}`) || "").trim();
};

const setStoredCourseId = (teacherUserId, courseId) => {
  if (typeof window === "undefined" || !teacherUserId || !courseId) return;
  window.localStorage.setItem(`${QUICK_CHECK_COURSE_STORAGE_KEY}_${teacherUserId}`, String(courseId));
};

const getStoredSemesterId = (teacherUserId, courseId) => {
  if (typeof window === "undefined" || !teacherUserId || !courseId) return "";
  return String(window.localStorage.getItem(`${QUICK_CHECK_SEMESTER_STORAGE_KEY}_${teacherUserId}_${courseId}`) || "").trim();
};

const setStoredSemesterId = (teacherUserId, courseId, semesterId) => {
  if (typeof window === "undefined" || !teacherUserId || !courseId || !semesterId) return;
  window.localStorage.setItem(`${QUICK_CHECK_SEMESTER_STORAGE_KEY}_${teacherUserId}_${courseId}`, String(semesterId));
};

export default function QuickLessonPlanCheckModal({
  open,
  teacher,
  onClose,
  flashMessage,
}) {
  const navigate = useNavigate();
  const [teacherKey, setTeacherKey] = useState("");
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [academicYearOptions, setAcademicYearOptions] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [rtdbBase, setRtdbBase] = useState(() => getRtdbRoot());
  const [schoolBaseResolved, setSchoolBaseResolved] = useState(false);
  const [settledFilterKey, setSettledFilterKey] = useState("");
  const [autoSemesterAttempts, setAutoSemesterAttempts] = useState([]);
  const [submittingDate, setSubmittingDate] = useState("");
  const [submittingAll, setSubmittingAll] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  const {
    semesterIds,
    semesterIdsLoading,
    selectedSemesterId,
    setSelectedSemesterId,
    weeks,
    loading,
    saving,
    error,
    dailyLogsByWeek,
    dailyLogsLoadingKey,
    loadWeekDailyLogs,
    submitDailyLog,
    submitDailyLogsBatch,
  } = useLessonPlanData({
    rtdbBase,
    academicYear,
    teacherId: teacherKey,
    course: selectedCourse,
  });

  useEffect(() => {
    let cancelled = false;

    if (!teacher) {
      setTeacherKey("");
      setCourses([]);
      setSelectedCourseId("");
      setAcademicYear("");
      setAcademicYearOptions([]);
      setContextLoading(false);
      setCoursesLoading(false);
      setSchoolBaseResolved(false);
      setSettledFilterKey("");
      setAutoSemesterAttempts([]);
      setSubmittingDate("");
      setSubmittingAll(false);
      return () => {
        cancelled = true;
      };
    }

    const resolveSchoolBase = async () => {
      setContextLoading(true);
      setSchoolBaseResolved(false);
      setSettledFilterKey("");
      setAutoSemesterAttempts([]);
      setSubmittingDate("");
      setSubmittingAll(false);

      const rawSchoolCode = String(teacher?.schoolCode || "").trim();
      if (!rawSchoolCode) {
        if (cancelled) return;
        setRtdbBase(getRtdbRoot());
        setSchoolBaseResolved(true);
        return;
      }

      if (rawSchoolCode.startsWith("ET-")) {
        if (cancelled) return;
        setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${rawSchoolCode}`);
        setSchoolBaseResolved(true);
        return;
      }

      try {
        const shortCode = rawSchoolCode.toUpperCase();
        const mapRes = await axios.get(`${RTDB_BASE_RAW}/Platform1/schoolCodeIndex/${shortCode}.json`);
        const mappedCode = String(mapRes?.data || "").trim();
        if (mappedCode) {
          setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${mappedCode}`);
          setSchoolBaseResolved(true);
          return;
        }
      } catch {
        // fallback below
      }

      if (cancelled) return;
      setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${rawSchoolCode}`);
      setSchoolBaseResolved(true);
    };

    void resolveSchoolBase();

    return () => {
      cancelled = true;
    };
  }, [teacher]);

  useEffect(() => {
    let cancelled = false;

    if (!teacher || !schoolBaseResolved || !rtdbBase) return undefined;

    const loadQuickCheckContext = async () => {
      setContextLoading(true);
      setCoursesLoading(true);

      try {
        const [courseContext, yearLowerRes, yearUpperRes] = await Promise.all([
          getTeacherCourseContext({ teacher, rtdbBase }),
          axios.get(`${rtdbBase}/academicYears.json`).catch(() => ({ data: {} })),
          axios.get(`${rtdbBase}/AcademicYears.json`).catch(() => ({ data: {} })),
        ]);

        const resolvedCourses = Array.isArray(courseContext?.courses) ? courseContext.courses : [];
        const storedCourseId = getStoredCourseId(teacher?.userId);
        if (cancelled) return;

        setCourses(resolvedCourses);
        setTeacherKey(String(courseContext?.teacherKey || teacher?.teacherId || teacher?.teacherKey || ""));
        setSelectedCourseId((previousValue) => {
          if (previousValue && resolvedCourses.some((item) => item.id === previousValue)) return previousValue;
          if (storedCourseId && resolvedCourses.some((item) => item.id === storedCourseId)) return storedCourseId;
          return resolvedCourses[0]?.id || "";
        });

        const yearsNodeLower = yearLowerRes?.data && typeof yearLowerRes.data === "object" ? yearLowerRes.data : {};
        const yearsNodeUpper = yearUpperRes?.data && typeof yearUpperRes.data === "object" ? yearUpperRes.data : {};
        const yearsNode = Object.keys(yearsNodeLower).length ? yearsNodeLower : yearsNodeUpper;
        const years = Object.keys(yearsNode);
        setAcademicYearOptions(years);

        const preferredYear = resolveAcademicYearFromNode(yearsNode);
        setAcademicYear((previousValue) => {
          if (previousValue && years.includes(previousValue)) return previousValue;
          return preferredYear || previousValue || "";
        });
      } finally {
        if (!cancelled) {
          setCoursesLoading(false);
          setContextLoading(false);
        }
      }
    };

    void loadQuickCheckContext();

    return () => {
      cancelled = true;
    };
  }, [teacher, schoolBaseResolved, rtdbBase]);

  useEffect(() => {
    if (!teacher?.userId || !selectedCourseId) return;
    setStoredCourseId(teacher.userId, selectedCourseId);
  }, [selectedCourseId, teacher?.userId]);

  useEffect(() => {
    if (!teacher?.userId || !selectedCourseId || semesterIdsLoading || !semesterIds.length) return;
    const storedSemesterId = normalizeSemesterId(getStoredSemesterId(teacher.userId, selectedCourseId));
    if (storedSemesterId && semesterIds.includes(storedSemesterId) && storedSemesterId !== selectedSemesterId) {
      setSelectedSemesterId(storedSemesterId);
    }
  }, [selectedCourseId, selectedSemesterId, semesterIds, semesterIdsLoading, teacher?.userId, setSelectedSemesterId]);

  useEffect(() => {
    if (!teacher?.userId || !selectedCourseId || !selectedSemesterId) return;
    setStoredSemesterId(teacher.userId, selectedCourseId, selectedSemesterId);
  }, [selectedCourseId, selectedSemesterId, teacher?.userId]);

  useEffect(() => {
    setAutoSemesterAttempts([]);
  }, [selectedCourseId, academicYear, teacherKey]);

  const filterKey = useMemo(() => {
    if (!schoolBaseResolved || !teacherKey || !selectedCourse?.id || !selectedSemesterId) return "";
    return [rtdbBase, teacherKey, selectedCourse.id, academicYear || "root", selectedSemesterId].join("|");
  }, [schoolBaseResolved, rtdbBase, teacherKey, selectedCourse?.id, academicYear, selectedSemesterId]);

  useEffect(() => {
    if (!filterKey) {
      setSettledFilterKey("");
      return;
    }
    setSettledFilterKey((previousValue) => (previousValue === filterKey ? previousValue : ""));
  }, [filterKey]);

  const currentWeek = useMemo(() => {
    if (!weeks.length) return null;
    const meaningfulWeeks = weeks.filter(
      (row) =>
        Number(row.expectedDays || 0) > 0 ||
        row.topic ||
        row.objective ||
        row.assessment ||
        row.material ||
        row.method
    );
    if (!meaningfulWeeks.length) return null;

    const incompleteWeeks = meaningfulWeeks.filter((row) => Number(row.progressPercent || 0) < 100);
    return incompleteWeeks.length ? incompleteWeeks[incompleteWeeks.length - 1] : meaningfulWeeks[meaningfulWeeks.length - 1];
  }, [weeks]);

  useEffect(() => {
    if (!filterKey || contextLoading || coursesLoading || semesterIdsLoading || loading) return;
    setSettledFilterKey(filterKey);
  }, [filterKey, contextLoading, coursesLoading, semesterIdsLoading, loading, error, weeks.length]);

  useEffect(() => {
    if (contextLoading || coursesLoading || semesterIdsLoading || loading) return;
    if (!selectedCourse?.id || semesterIds.length < 2 || currentWeek || weeks.length > 0) return;

    const nextSemesterId = semesterIds.find(
      (semesterId) => semesterId !== selectedSemesterId && !autoSemesterAttempts.includes(semesterId)
    );

    if (!nextSemesterId) return;

    setAutoSemesterAttempts((previousValue) => Array.from(new Set([...previousValue, selectedSemesterId])));
    setSettledFilterKey("");
    setSelectedSemesterId(nextSemesterId);
  }, [
    open,
    contextLoading,
    coursesLoading,
    semesterIdsLoading,
    loading,
    selectedCourse?.id,
    semesterIds,
    selectedSemesterId,
    currentWeek,
    weeks.length,
    autoSemesterAttempts,
    setSelectedSemesterId,
  ]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!currentWeek || contextLoading || semesterIdsLoading || settledFilterKey !== filterKey) return;
    const weekCacheKey = `${currentWeek.monthId}__${currentWeek.weekId}`;
    if (Array.isArray(dailyLogsByWeek[weekCacheKey])) return;
    void loadWeekDailyLogs({ monthId: currentWeek.monthId, weekId: currentWeek.weekId });
  }, [
    currentWeek?.id,
    currentWeek?.monthId,
    currentWeek?.weekId,
    contextLoading,
    semesterIdsLoading,
    settledFilterKey,
    filterKey,
    dailyLogsByWeek,
    loadWeekDailyLogs,
  ]);

  const logsKey = currentWeek ? `${currentWeek.monthId}__${currentWeek.weekId}` : "";
  const logs = logsKey ? dailyLogsByWeek[logsKey] || [] : [];
  const logsLoading = Boolean(logsKey && dailyLogsLoadingKey === logsKey);
  const submittedSet = useMemo(() => new Set(currentWeek?.submittedDays || []), [currentWeek?.submittedDays]);

  const sortedLogs = useMemo(
    () => [...logs].sort((left, right) => normalizeTimestamp(left.date) - normalizeTimestamp(right.date) || String(left.date || "").localeCompare(String(right.date || ""))),
    [logs]
  );

  const submittedLogs = useMemo(
    () => sortedLogs.filter((log) => submittedSet.has(log.date)),
    [sortedLogs, submittedSet]
  );

  const pendingLogs = useMemo(
    () => sortedLogs.filter((log) => !submittedSet.has(log.date)),
    [sortedLogs, submittedSet]
  );

  const expectedDays = Number(currentWeek?.expectedDays || 0);
  const submittedCount = Number(currentWeek?.submittedCount || 0);
  const missingEntriesCount = Math.max(expectedDays - sortedLogs.length, 0);
  const readyToSubmitCount = pendingLogs.length;
  const hasCourseAssignments = courses.length > 0;
  const hasResolvedSelection = Boolean(selectedCourse?.id && selectedSemesterId);
  const isNoLessonRowsError = /no lesson plan rows found/i.test(String(error || ""));
  const showSelectorBar = courses.length > 1 || academicYearOptions.length > 1 || semesterIds.length > 1;
  const isModalLoading = Boolean(
    open && (
      !schoolBaseResolved ||
      contextLoading ||
      coursesLoading ||
      semesterIdsLoading ||
      (!hasResolvedSelection && hasCourseAssignments) ||
      (filterKey && settledFilterKey !== filterKey) ||
      loading
    )
  );

  const handleSubmitOne = async (date) => {
    if (!currentWeek || !date) return;
    setSubmittingDate(date);
    try {
      const submittedDates = await submitDailyLog({ monthId: currentWeek.monthId, weekId: currentWeek.weekId, date });
      flashMessage?.(
        "success",
        submittedDates.length ? `Submitted lesson entry for ${date}.` : `Lesson entry for ${date} was already submitted.`
      );
    } catch (error) {
      console.error("Quick lesson submission failed:", error);
      flashMessage?.("error", "Unable to submit that lesson entry right now.");
    } finally {
      setSubmittingDate("");
    }
  };

  const handleSubmitAllPending = async () => {
    if (!currentWeek || !pendingLogs.length) return;
    setSubmittingAll(true);
    try {
      const submittedDates = await submitDailyLogsBatch({
        monthId: currentWeek.monthId,
        weekId: currentWeek.weekId,
        dates: pendingLogs.map((log) => log.date),
      });

      flashMessage?.(
        "success",
        submittedDates.length
          ? `Submitted ${submittedDates.length} pending lesson entr${submittedDates.length === 1 ? "y" : "ies"} for the current week.`
          : "All pending lesson entries were already submitted."
      );
    } catch (error) {
      console.error("Quick submit all failed:", error);
      flashMessage?.("error", "Some lesson entries could not be submitted.");
    } finally {
      setSubmittingAll(false);
    }
  };

  const openFullLessonPlan = () => {
    onClose?.();
    navigate("/lesson-plan");
  };

  if (!open) return null;

  return (
    <div className="settings-quick-plan-overlay" role="dialog" aria-modal="true" onClick={() => onClose?.()}>
      <div className="settings-quick-plan-modal" onClick={(event) => event.stopPropagation()}>
        <header className="settings-quick-plan-header">
          <div>
            <span className="settings-kicker">Quick Lesson Check</span>
            <h2>Weekly lesson status</h2>
            <p>See what is submitted, what is ready to submit, and what still needs a lesson entry.</p>
          </div>
          <button type="button" className="settings-quick-plan-close" onClick={onClose} aria-label="Close quick lesson plan check">
            <FaTimes />
          </button>
        </header>

        {showSelectorBar ? (
          <div className="settings-quick-plan-controls">
            {academicYearOptions.length > 1 ? (
              <label>
                Academic Year
                <select value={academicYear} onChange={(event) => setAcademicYear(event.target.value)}>
                  <option value="">Select year</option>
                  {academicYearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {courses.length > 1 ? (
              <label>
                Course
                <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} disabled={coursesLoading || contextLoading}>
                  <option value="">{coursesLoading || contextLoading ? "Loading courses..." : "Select course"}</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {(course.subject || course.name || course.id)} {course.grade ? `- G${course.grade}` : ""}{course.section ? `${course.section}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {semesterIds.length > 1 ? (
              <label>
                Semester
                <select value={selectedSemesterId} onChange={(event) => {
                  setSettledFilterKey("");
                  setSelectedSemesterId(event.target.value);
                }}>
                  {semesterIds.map((semesterId) => (
                    <option key={semesterId} value={semesterId}>{formatSemesterLabel(semesterId)}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}

        {isModalLoading ? <div className="settings-empty-state">Loading lesson status...</div> : null}
        {!isModalLoading && !hasCourseAssignments ? <div className="settings-empty-state">No assigned course was found for this teacher.</div> : null}
        {!isModalLoading && hasCourseAssignments && error && !isNoLessonRowsError ? <div className="settings-empty-state">{error}</div> : null}

        {!isModalLoading && hasCourseAssignments && (!error || isNoLessonRowsError) ? (
          currentWeek ? (
            <div className="settings-quick-plan-body">
              <section className="settings-quick-plan-summary">
                <div className="settings-quick-plan-week-card">
                  <div className="settings-quick-plan-week-top">
                    <span className="settings-quick-plan-week-badge">
                      <FaBookOpen />
                      {selectedCourse?.subject || selectedCourse?.name || "Course"}
                    </span>
                    <span className="settings-quick-plan-week-badge subtle">{formatSemesterLabel(selectedSemesterId || "Semester")}</span>
                    {academicYear ? <span className="settings-quick-plan-week-badge subtle">{academicYear}</span> : null}
                  </div>
                  <h3>{currentWeek.monthId} {currentWeek.weekId}</h3>
                  <p>Latest active week for the current selection.</p>

                  <div className="settings-quick-plan-metrics">
                    <article>
                      <span>Submitted</span>
                      <strong>{submittedCount}</strong>
                    </article>
                    <article>
                      <span>Ready to submit</span>
                      <strong>{readyToSubmitCount}</strong>
                    </article>
                    <article>
                      <span>Missing Entries</span>
                      <strong>{missingEntriesCount}</strong>
                    </article>
                  </div>

                  <div className="settings-quick-plan-progress">
                    <div className="settings-quick-plan-progress-bar">
                      <span style={{ width: `${Math.min(100, Number(currentWeek.progressPercent || 0))}%` }} />
                    </div>
                    <small>{currentWeek.progressPercent || 0}% submitted for this week</small>
                  </div>

                  <div className="settings-quick-plan-actions">
                    <button
                      type="button"
                      className="settings-primary-button"
                      onClick={handleSubmitAllPending}
                      disabled={!pendingLogs.length || saving || submittingAll}
                    >
                      <FaClipboardCheck />
                      {submittingAll ? "Submitting..." : "Submit All Ready"}
                    </button>
                    <button type="button" className="settings-secondary-button" onClick={openFullLessonPlan}>
                      Open Lesson Plan
                      <FaChevronRight />
                    </button>
                  </div>
                </div>
              </section>

              <section className="settings-quick-plan-lists">
                <article className="settings-quick-plan-list-card">
                  <div className="settings-quick-plan-list-header">
                    <strong><FaHourglassHalf /> Ready to submit</strong>
                    <span>{pendingLogs.length}</span>
                  </div>

                  {logsLoading ? <div className="settings-empty-state">Loading lesson entries...</div> : null}

                  {!logsLoading ? (
                    pendingLogs.length ? (
                      <div className="settings-quick-plan-list">
                        {pendingLogs.map((log) => (
                          <div key={log.date} className="settings-quick-plan-item">
                            <div>
                              <strong>{formatDateLabel(log.date, log.dayName)}</strong>
                              <span>{log.topic || log.method || "Daily lesson entry ready to submit"}</span>
                            </div>
                            <button
                              type="button"
                              className="settings-primary-button"
                              disabled={saving || submittingDate === log.date || submittingAll}
                              onClick={() => handleSubmitOne(log.date)}
                            >
                              {submittingDate === log.date ? "Submitting..." : "Submit"}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="settings-empty-state">No ready entries for this week.</div>
                    )
                  ) : null}
                </article>

                <article className="settings-quick-plan-list-card">
                  <div className="settings-quick-plan-list-header">
                    <strong><FaCheckCircle /> Submitted this week</strong>
                    <span>{submittedLogs.length}</span>
                  </div>

                  {submittedLogs.length ? (
                    <div className="settings-quick-plan-list">
                      {submittedLogs.map((log) => (
                        <div key={log.date} className="settings-quick-plan-item is-submitted">
                          <div>
                            <strong>{formatDateLabel(log.date, log.dayName)}</strong>
                            <span>{log.topic || log.method || "Submitted lesson entry"}</span>
                          </div>
                          <span className="settings-quick-plan-status">Submitted</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="settings-empty-state">Nothing has been submitted for this week yet.</div>
                  )}
                </article>

                {missingEntriesCount > 0 ? (
                  <article className="settings-quick-plan-note-card">
                    <strong>Missing lesson entries</strong>
                    <p>
                      {missingEntriesCount} expected day{missingEntriesCount === 1 ? " is" : "s are"} still missing a daily lesson entry. Open the full lesson plan page when you need to add or edit them.
                    </p>
                  </article>
                ) : null}
              </section>
            </div>
          ) : (
            <div className="settings-empty-state">
              No lesson week was found for this selection yet. Open the lesson plan page to add or complete it.
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}