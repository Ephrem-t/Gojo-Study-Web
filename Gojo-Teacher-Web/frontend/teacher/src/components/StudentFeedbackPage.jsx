import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  FaChartBar,
  FaChartLine,
  FaFilter,
  FaStar,
} from "react-icons/fa";
import Sidebar from "./Sidebar";
import { getRtdbRoot, RTDB_BASE_RAW } from "../api/rtdbScope";
import { getTeacherCourseContext } from "../api/teacherApi";
import { fetchCachedJson } from "../utils/rtdbCache";
import { loadUserRecordsByIds, resolveTeacherSchoolCode } from "../utils/teacherData";
import { formatSemesterLabel, normalizeSemesterId } from "./lessonPlan/useLessonPlanData";
import "../styles/studentFeedbackPage.css";

const UNDERSTANDING_META = {
  excellent: { label: "Excellent", tone: "excellent", color: "#159a75", axisLabel: "Excellent" },
  good: { label: "Good", tone: "good", color: "#007afb", axisLabel: "Good" },
  okay: { label: "Okay", tone: "okay", color: "#f2ab1d", axisLabel: "Okay" },
  needs_help: { label: "Needs Help", tone: "needs-help", color: "#f27a3b", axisLabel: "Help" },
  dont_understand: { label: "Don't Understand", tone: "dont-understand", color: "#d94f2a", axisLabel: "Unclear" },
};

const UNDERSTANDING_ORDER = ["excellent", "good", "okay", "needs_help", "dont_understand"];
const GENDER_ORDER = ["male", "female", "unknown"];
const UNDERSTANDING_SCORE_MAP = {
  excellent: 5,
  good: 4,
  okay: 3,
  needs_help: 2,
  dont_understand: 1,
};
const FOCUS_OPTIONS = [
  { id: "all", label: "All feedback" },
  { id: "needs-support", label: "Needs support" },
  { id: "strong", label: "Strong only" },
];
const DATE_RANGE_OPTIONS = [
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
  { id: "all", label: "All time" },
];
const CHART_VIEW_OPTIONS = [
  { id: "bar", label: "Bar", Icon: FaChartBar },
  { id: "line", label: "Line", Icon: FaChartLine },
];

const FEEDBACK_DATE_RANGE_STORAGE_KEY = "teacher-feedback-date-range";
const FEEDBACK_UNDERSTANDING_VIEW_STORAGE_KEY = "teacher-feedback-understanding-view";
const FEEDBACK_IMPROVEMENT_VIEW_STORAGE_KEY = "teacher-feedback-improvement-view";
const FEEDBACK_TOPIC_VIEW_STORAGE_KEY = "teacher-feedback-topic-view";
const FEEDBACK_GENDER_VIEW_STORAGE_KEY = "teacher-feedback-gender-view";

const normalizeTeacherRef = (value) => String(value || "").trim().replace(/^-+/, "").toUpperCase();

const normalizeGender = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.startsWith("m")) return "male";
  if (normalized.startsWith("f")) return "female";
  return "unknown";
};

const formatGenderLabel = (value) => {
  if (value === "male") return "Male";
  if (value === "female") return "Female";
  return "Unspecified";
};

const humanizeTopic = (value) => {
  const rawValue = String(value || "");
  const normalized = rawValue.replace(/\+/g, "%20");
  try {
    return decodeURIComponent(normalized);
  } catch {
    return rawValue;
  }
};

const formatCourseLabel = (course = {}) => {
  const subject = String(course.subject || course.name || course.id || "Course").trim();
  const grade = String(course.grade || "").trim();
  const section = String(course.section || course.secation || "").trim().toUpperCase();
  return `${subject}${grade ? ` • Grade ${grade}` : ""}${section ? ` ${section}` : ""}`;
};

const parseFeedbackKey = (entryKey, fallbackCourseId = "") => {
  const parts = String(entryKey || "").split("__");
  const [rawCourseId = fallbackCourseId, rawSemesterId = "", rawMonthId = "", rawWeekId = "", rawDate = "", ...topicParts] = parts;

  return {
    courseId: String(fallbackCourseId || rawCourseId || "").trim(),
    semesterId: normalizeSemesterId(rawSemesterId),
    monthId: String(rawMonthId || "").trim(),
    weekId: String(rawWeekId || "").trim(),
    date: String(rawDate || "").trim(),
    lessonTopic: humanizeTopic(topicParts.join("__")),
  };
};

const normalizeUnderstandingLevel = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) return "";
  if (normalized === "dontunderstand") return "dont_understand";
  if (normalized === "needshelp") return "needs_help";
  return normalized;
};

const formatUnderstandingLabel = (value) => {
  const normalized = normalizeUnderstandingLevel(value);
  if (UNDERSTANDING_META[normalized]?.label) return UNDERSTANDING_META[normalized].label;
  return String(value || "Not shared");
};

const formatDateLabel = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "-";
  const parsed = new Date(`${rawValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return rawValue;
  return parsed.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

const formatDateTimeLabel = (value) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return "-";
  return new Date(numericValue).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatWindowDateLabel = (value) => {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatLessonPlanContext = ({ courseLabel, semesterId, monthId, weekId }) => {
  return [courseLabel, formatSemesterLabel(semesterId), String(monthId || "").trim(), String(weekId || "").trim()]
    .filter(Boolean)
    .join(" • ");
};

const buildAxisLabelLines = (value) => String(value || "").split(" ").filter(Boolean);

const formatDateAxisLines = (value) => {
  if (!value) return ["-"];
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return [String(value)];
  return [
    parsed.toLocaleDateString([], { month: "short" }),
    parsed.toLocaleDateString([], { day: "numeric" }),
  ];
};

const getAverage = (sum, count) => (count > 0 ? Number((sum / count).toFixed(1)) : 0);

const getLearningIndex = ({ understandingLevel, teacherRating }) => {
  const understandingScore = UNDERSTANDING_SCORE_MAP[normalizeUnderstandingLevel(understandingLevel)];
  const ratingScore = Number(teacherRating || 0);
  const scoreSources = [understandingScore, ratingScore].filter((score) => Number.isFinite(score) && score > 0);

  if (!scoreSources.length) return 0;

  const averageFivePointScore = scoreSources.reduce((sum, score) => sum + score, 0) / scoreSources.length;
  return Number((averageFivePointScore * 2).toFixed(1));
};

const getPercent = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);

const getSupportStatus = ({ understandingLevel, teacherRating }) => {
  const normalizedLevel = normalizeUnderstandingLevel(understandingLevel);
  const safeRating = Number(teacherRating || 0);

  if (normalizedLevel === "dont_understand" || normalizedLevel === "needs_help" || (safeRating > 0 && safeRating <= 2)) {
    return "needs-support";
  }

  if (normalizedLevel === "excellent" || normalizedLevel === "good" || safeRating >= 4) {
    return "strong";
  }

  return "watch";
};

const sortByNumericDesc = (left, right, key) => Number(right?.[key] || 0) - Number(left?.[key] || 0);

const getDominantUnderstandingKey = (counts = {}) => {
  let bestKey = "";
  let bestValue = 0;

  UNDERSTANDING_ORDER.forEach((key) => {
    const value = Number(counts?.[key] || 0);
    if (value > bestValue) {
      bestKey = key;
      bestValue = value;
    }
  });

  return bestKey;
};

const formatGenderMix = (counts = {}) => {
  return `M ${Number(counts?.male || 0)} • F ${Number(counts?.female || 0)} • U ${Number(counts?.unknown || 0)}`;
};

const getStoredPreference = (key, fallbackValue, options) => {
  if (typeof window === "undefined") return fallbackValue;
  const storedValue = window.localStorage.getItem(key);
  return options.some((option) => option.id === storedValue) ? storedValue : fallbackValue;
};

const getEntryDateObject = (entry) => {
  const rawDate = String(entry?.date || "").trim();
  if (rawDate) {
    const parsed = new Date(`${rawDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    }
  }

  const fallbackTimestamp = Number(entry?.updatedAt || entry?.createdAt || 0);
  if (Number.isFinite(fallbackTimestamp) && fallbackTimestamp > 0) {
    const parsed = new Date(fallbackTimestamp);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    }
  }

  return null;
};

const shiftDays = (value, dayOffset) => {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

function CartesianChart({
  rows,
  mode,
  valueFormatter,
  axisValueFormatter = valueFormatter,
  scaleMax,
  lineColor,
  ariaLabel,
  emptyMessage,
  xAxisLabel,
  yAxisLabel,
  tickValues,
  chartWidth = 500,
  chartHeight = 308,
  chartPadding,
  showDetailCard = false,
  renderDetailCard,
}) {
  const [activeKey, setActiveKey] = useState("");
  const [hoveredKey, setHoveredKey] = useState("");
  const hasDetailCard = showDetailCard || typeof renderDetailCard === "function";

  useEffect(() => {
    if (!rows.length) {
      if (activeKey) setActiveKey("");
      if (hoveredKey) setHoveredKey("");
      return;
    }

    if (hasDetailCard && !rows.some((row) => row.key === activeKey)) {
      setActiveKey(rows[0].key);
    }

    if (!hasDetailCard && activeKey && !rows.some((row) => row.key === activeKey)) {
      setActiveKey("");
    }

    if (hoveredKey && !rows.some((row) => row.key === hoveredKey)) {
      setHoveredKey("");
    }
  }, [rows, activeKey, hoveredKey, hasDetailCard]);

  if (!rows.length) {
    return <div className="sf-inline-empty">{emptyMessage}</div>;
  }

  const activeRow = rows.find((row) => row.key === activeKey) || (hasDetailCard ? rows[0] : null);
  const hoveredRow = rows.find((row) => row.key === hoveredKey) || null;
  const width = chartWidth;
  const height = chartHeight;
  const left = Number(chartPadding?.left ?? 62);
  const right = Number(chartPadding?.right ?? 30);
  const top = Number(chartPadding?.top ?? 28);
  const bottom = Number(chartPadding?.bottom ?? 88);
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const plotLeft = left + Math.min(Math.max(plotWidth * 0.05, 12), 24);
  const plotRight = width - right - Math.min(Math.max(plotWidth * 0.05, 12), 24);
  const valuePlotWidth = Math.max(plotRight - plotLeft, 1);
  const resolvedTickValues = Array.isArray(tickValues) && tickValues.length
    ? tickValues
    : [0, 0.25, 0.5, 0.75, 1].map((ratio) => Number((Math.max(Number(scaleMax || 0), 1) * ratio).toFixed(2)));
  const safeMax = Math.max(
    Number(scaleMax || 0),
    ...resolvedTickValues.map((value) => Number(value || 0)),
    ...rows.map((row) => Number(row.value || 0)),
    1
  );
  const baselineY = top + plotHeight;
  const xStep = rows.length > 1 ? valuePlotWidth / (rows.length - 1) : 0;
  const barSlotWidth = valuePlotWidth / Math.max(rows.length, 1);
  const barWidth = Math.min(Math.max(barSlotWidth * 0.48, 22), 48);
  const maxAxisLabelLines = rows.reduce((longest, row) => {
    const axisLines = Array.isArray(row.axisLabelLines) && row.axisLabelLines.length
      ? row.axisLabelLines
      : [row.axisLabel || row.label];
    return Math.max(longest, axisLines.length);
  }, 1);
  const xAxisTickY = baselineY + 20;
  const xAxisCaptionY = Math.min(height - 14, xAxisTickY + Math.max(maxAxisLabelLines - 1, 0) * 12 + 26);
  const points = rows.map((row, index) => {
    const x = mode === "bar"
      ? plotLeft + barSlotWidth * index + barSlotWidth / 2
      : rows.length === 1
        ? plotLeft + valuePlotWidth / 2
        : plotLeft + index * xStep;
    const y = top + plotHeight - (Number(row.value || 0) / safeMax) * plotHeight;
    return {
      ...row,
      x,
      y,
    };
  });
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = points.length
    ? `M ${points[0].x} ${baselineY} L ${points[0].x} ${points[0].y} ${points
        .slice(1)
        .map((point) => `L ${point.x} ${point.y}`)
        .join(" ")} L ${points[points.length - 1].x} ${baselineY} Z`
    : "";
  const detailRow = activeRow || rows[0];
  const tooltipRow = hoveredRow;
  const tooltipPoint = tooltipRow ? points.find((point) => point.key === tooltipRow.key) || null : null;
  const tooltipStyle = tooltipPoint
    ? {
        left: `${(tooltipPoint.x / width) * 100}%`,
        top: `${(tooltipPoint.y / height) * 100}%`,
      }
    : null;
  const tooltipClassName = [
    "sf-chart-hover-card",
    tooltipPoint && tooltipPoint.x > width * 0.72 ? "is-align-right" : "",
    tooltipPoint && tooltipPoint.y < top + 26 ? "is-below" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const handlePointEnter = (key) => {
    setActiveKey(key);
    setHoveredKey(key);
  };
  const handlePointLeave = () => {
    setHoveredKey("");
  };
  const renderedDetailCard = hasDetailCard && detailRow
    ? typeof renderDetailCard === "function"
      ? renderDetailCard(detailRow, valueFormatter(detailRow.value))
      : (
        <div className="sf-chart-inspector">
          <div className="sf-chart-inspector-copy">
            <strong>{detailRow.label}</strong>
            <small>{detailRow.description || "Selected data point"}</small>
          </div>
          <span className="sf-chart-inspector-value">{valueFormatter(detailRow.value)}</span>
        </div>
      )
    : null;

  return (
    <div className="sf-chart-shell">
      <div className="sf-chart-frame">
        <svg
          className="sf-line-chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          onMouseLeave={handlePointLeave}
        >
        {resolvedTickValues.map((tickValue) => {
          const y = top + plotHeight - (tickValue / safeMax) * plotHeight;
          return (
            <g key={tickValue}>
              <line x1={left} y1={y} x2={width - right} y2={y} className="sf-grid-line" />
              <text x={left - 8} y={y + 4} textAnchor="end" className="sf-axis-tick">
                {axisValueFormatter(tickValue)}
              </text>
            </g>
          );
        })}

        <line x1={left} y1={top} x2={left} y2={baselineY} className="sf-axis-line" />
        <line x1={left} y1={baselineY} x2={width - right} y2={baselineY} className="sf-axis-line" />

        {mode === "bar"
          ? points.map((point) => {
              const rectHeight = Math.max(baselineY - point.y, 0);
              const rectX = point.x - barWidth / 2;
              const rectY = baselineY - rectHeight;
              const isActive = point.key === activeRow?.key;

              return (
                <g
                  key={point.key}
                  tabIndex="0"
                  role="button"
                  aria-label={`${point.label} ${valueFormatter(point.value)}`}
                  onMouseEnter={() => handlePointEnter(point.key)}
                  onFocus={() => handlePointEnter(point.key)}
                  onBlur={handlePointLeave}
                  onClick={() => handlePointEnter(point.key)}
                >
                  <rect
                    x={rectX}
                    y={rectY}
                    width={barWidth}
                    height={rectHeight}
                    rx="12"
                    className={`sf-bar-rect${isActive ? " is-active" : ""}`}
                    fill={point.color || lineColor}
                  />
                  <title>{[`${point.label}: ${valueFormatter(point.value)}`, point.description].filter(Boolean).join(" • ")}</title>
                </g>
              );
            })
          : null}

        {mode === "line" ? (
          <>
            {areaPath ? <path d={areaPath} fill={lineColor} fillOpacity="0.14" /> : null}
            {linePath ? <path d={linePath} fill="none" stroke={lineColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
            {points.map((point) => {
              const isActive = point.key === activeRow?.key;
              return (
                <g
                  key={point.key}
                  tabIndex="0"
                  role="button"
                  aria-label={`${point.label} ${valueFormatter(point.value)}`}
                  onMouseEnter={() => handlePointEnter(point.key)}
                  onFocus={() => handlePointEnter(point.key)}
                  onBlur={handlePointLeave}
                  onClick={() => handlePointEnter(point.key)}
                >
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isActive ? "6" : "5"}
                    fill="#ffffff"
                    stroke={point.color || lineColor}
                    strokeWidth="3"
                  />
                  <title>{[`${point.label}: ${valueFormatter(point.value)}`, point.description].filter(Boolean).join(" • ")}</title>
                </g>
              );
            })}
          </>
        ) : null}

        {points.map((point) => {
          const axisLines = Array.isArray(point.axisLabelLines) && point.axisLabelLines.length
            ? point.axisLabelLines
            : [point.axisLabel || point.label];

          return (
            <text key={`${point.key}-axis`} x={point.x} y={baselineY + 16} textAnchor="middle" className="sf-axis-tick is-x">
              {axisLines.map((line, index) => (
                <tspan key={`${point.key}-axis-${index}`} x={point.x} dy={index === 0 ? 0 : 11}>
                  {line}
                </tspan>
              ))}
            </text>
          );
        })}

        <text x={(left + width - right) / 2} y={xAxisCaptionY} textAnchor="middle" className="sf-axis-caption">
          {xAxisLabel}
        </text>
        <text x="24" y={height / 2} textAnchor="middle" className="sf-axis-caption" transform={`rotate(-90 24 ${height / 2})`}>
          {yAxisLabel}
        </text>
        </svg>

        {tooltipRow && tooltipStyle ? (
          <div className={tooltipClassName} style={tooltipStyle}>
            <strong>{tooltipRow.label}</strong>
            <span>{valueFormatter(tooltipRow.value)}</span>
            {tooltipRow.description ? <small>{tooltipRow.description}</small> : null}
          </div>
        ) : null}
      </div>

      {renderedDetailCard}
    </div>
  );
}

function ChartModeToggle({ value, onChange, ariaLabel }) {
  return (
    <div className="sf-toggle-group is-icon-toggle" role="tablist" aria-label={ariaLabel}>
      {CHART_VIEW_OPTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`sf-toggle-button is-icon${value === id ? " is-active" : ""}`}
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          aria-label={`${label} chart`}
          title={`${label} chart`}
        >
          <Icon aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function StudentFeedbackPage() {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("all");
  const [selectedSemesterId, setSelectedSemesterId] = useState("all");
  const [focusFilter, setFocusFilter] = useState("all");
  const [dateRange, setDateRange] = useState(() => getStoredPreference(FEEDBACK_DATE_RANGE_STORAGE_KEY, "week", DATE_RANGE_OPTIONS));
  const [understandingChartMode, setUnderstandingChartMode] = useState(() =>
    getStoredPreference(FEEDBACK_UNDERSTANDING_VIEW_STORAGE_KEY, "bar", CHART_VIEW_OPTIONS)
  );
  const [improvementChartMode, setImprovementChartMode] = useState(() =>
    getStoredPreference(FEEDBACK_IMPROVEMENT_VIEW_STORAGE_KEY, "line", CHART_VIEW_OPTIONS)
  );
  const [topicChartMode, setTopicChartMode] = useState(() =>
    getStoredPreference(FEEDBACK_TOPIC_VIEW_STORAGE_KEY, "bar", CHART_VIEW_OPTIONS)
  );
  const [genderChartMode, setGenderChartMode] = useState(() =>
    getStoredPreference(FEEDBACK_GENDER_VIEW_STORAGE_KEY, "bar", CHART_VIEW_OPTIONS)
  );
  const [collapsedCards, setCollapsedCards] = useState({
    improvement: false,
    topics: false,
    gender: false,
    courseSignals: false,
    ratings: false,
  });
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth > 600 : true
  );
  const [rtdbBase, setRtdbBase] = useState(() => getRtdbRoot());
  const [schoolBaseResolved, setSchoolBaseResolved] = useState(false);

  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher") || "null");
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FEEDBACK_DATE_RANGE_STORAGE_KEY, dateRange);
  }, [dateRange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FEEDBACK_UNDERSTANDING_VIEW_STORAGE_KEY, understandingChartMode);
  }, [understandingChartMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FEEDBACK_IMPROVEMENT_VIEW_STORAGE_KEY, improvementChartMode);
  }, [improvementChartMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FEEDBACK_TOPIC_VIEW_STORAGE_KEY, topicChartMode);
  }, [topicChartMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FEEDBACK_GENDER_VIEW_STORAGE_KEY, genderChartMode);
  }, [genderChartMode]);

  const toggleCollapsedCard = (cardKey) => {
    setCollapsedCards((previousValue) => ({
      ...previousValue,
      [cardKey]: !previousValue[cardKey],
    }));
  };

  useEffect(() => {
    const handleResize = () => {
      setLeftSidebarOpen(window.innerWidth > 600);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const resolveSchoolBase = async () => {
      if (!teacher) return;
      setSchoolBaseResolved(false);

      if (!teacher?.schoolCode) {
        setRtdbBase(getRtdbRoot());
        setSchoolBaseResolved(true);
        return;
      }

      const resolvedSchoolCode = await resolveTeacherSchoolCode(teacher.schoolCode);
      setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${resolvedSchoolCode}`);
      setSchoolBaseResolved(true);
    };

    resolveSchoolBase();
  }, [teacher]);

  useEffect(() => {
    if (!teacher || !schoolBaseResolved || !rtdbBase) return;

    let cancelled = false;

    const loadFeedbackWorkspace = async () => {
      setLoading(true);
      setError("");

      try {
        const [courseContext, feedbackNode] = await Promise.all([
          getTeacherCourseContext({ teacher, rtdbBase }),
          fetchCachedJson(`${rtdbBase}/LessonPlans/StudentWhatLearn.json`, {
            ttlMs: 60 * 1000,
            fallbackValue: {},
          }),
        ]);

        if (cancelled) return;

        const resolvedCourses = Array.isArray(courseContext?.courses) ? courseContext.courses : [];
        const resolvedTeacherKey = String(courseContext?.teacherKey || teacher?.teacherId || teacher?.teacherKey || "").trim();
        const teacherRefs = new Set(
          [resolvedTeacherKey, teacher?.teacherId, teacher?.teacherKey, teacher?.userId]
            .filter(Boolean)
            .map(normalizeTeacherRef)
        );
        const assignedCourseIds = new Set(resolvedCourses.map((course) => String(course.id || "").trim()).filter(Boolean));
        const feedbackEntries = feedbackNode && typeof feedbackNode === "object" ? feedbackNode : {};
        const relevantStudentIds = new Set();
        const entrySeeds = [];

        Object.entries(feedbackEntries).forEach(([studentId, studentEntries]) => {
          if (!studentEntries || typeof studentEntries !== "object") return;

          Object.entries(studentEntries).forEach(([entryKey, rawEntry]) => {
            const entry = rawEntry && typeof rawEntry === "object" ? rawEntry : {};
            const parsed = parseFeedbackKey(entryKey, entry?.courseId);
            const entryTeacherRef = normalizeTeacherRef(entry?.teacherId);
            const courseId = String(entry?.courseId || parsed.courseId || "").trim();
            const belongsToTeacher = entryTeacherRef
              ? teacherRefs.has(entryTeacherRef)
              : assignedCourseIds.has(courseId);

            if (!belongsToTeacher) return;

            relevantStudentIds.add(String(studentId || "").trim());
            const courseRecord = resolvedCourses.find((course) => course.id === courseId) || { id: courseId };
            const understandingLevel = normalizeUnderstandingLevel(entry?.understandingLevel);
            const teacherRating = Number(entry?.teacherRating || 0);
            const supportStatus = getSupportStatus({ understandingLevel, teacherRating });

            entrySeeds.push({
              id: `${studentId}__${entryKey}`,
              studentId,
              courseId,
              courseLabel: formatCourseLabel(courseRecord),
              semesterId: normalizeSemesterId(parsed.semesterId),
              monthId: parsed.monthId,
              weekId: parsed.weekId,
              date: parsed.date,
              lessonTopic: parsed.lessonTopic || humanizeTopic(entry?.topic || ""),
              teacherRating,
              understandingLevel,
              understandingLabel: formatUnderstandingLabel(understandingLevel),
              supportStatus,
              createdAt: Number(entry?.createdAt || 0),
              updatedAt: Number(entry?.updatedAt || 0),
            });
          });
        });

        const studentEntries = await Promise.all(
          [...relevantStudentIds].map(async (studentId) => {
            const studentRecord = await fetchCachedJson(`${rtdbBase}/Students/${encodeURIComponent(studentId)}.json`, {
              ttlMs: 5 * 60 * 1000,
              fallbackValue: null,
            });
            return [studentId, studentRecord && typeof studentRecord === "object" ? studentRecord : null];
          })
        );
        const studentsById = studentEntries.reduce((result, [studentId, studentRecord]) => {
          if (studentRecord) {
            result[studentId] = studentRecord;
          }
          return result;
        }, {});
        const usersByUserId = await loadUserRecordsByIds({
          rtdbBase,
          schoolCode: teacher?.schoolCode,
          userIds: [...new Set(
            Object.values(studentsById)
              .map((studentRecord) => String(studentRecord?.userId || studentRecord?.systemAccountInformation?.userId || studentRecord?.account?.userId || "").trim())
              .filter(Boolean)
          )],
        });

        const normalizedEntries = entrySeeds.map((entrySeed) => {
          const studentRecord = studentsById[entrySeed.studentId] || {};
          const userRecord = usersByUserId[String(studentRecord?.userId || studentRecord?.systemAccountInformation?.userId || studentRecord?.account?.userId || "").trim()] || {};
          return {
            ...entrySeed,
            gender: normalizeGender(studentRecord?.gender || studentRecord?.Gender || userRecord?.gender || userRecord?.Gender),
          };
        });

        normalizedEntries.sort((left, right) => {
          const updatedDiff = Number(right.updatedAt || right.createdAt || 0) - Number(left.updatedAt || left.createdAt || 0);
          if (updatedDiff !== 0) return updatedDiff;
          return String(right.date || "").localeCompare(String(left.date || ""));
        });

        setCourses(resolvedCourses);
        setEntries(normalizedEntries);
        setSelectedCourseId((previousValue) => {
          if (previousValue === "all") return "all";
          return resolvedCourses.some((course) => course.id === previousValue) ? previousValue : "all";
        });
      } catch (loadError) {
        if (cancelled) return;
        console.error("Failed to load student feedback page:", loadError);
        setError("Unable to load student feedback right now.");
        setEntries([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadFeedbackWorkspace();

    return () => {
      cancelled = true;
    };
  }, [teacher, schoolBaseResolved, rtdbBase]);

  const availableSemesters = useMemo(() => {
    const semesterValues = entries.map((entry) => entry.semesterId).filter(Boolean);
    return Array.from(new Set(semesterValues)).sort((left, right) => left.localeCompare(right));
  }, [entries]);

  const scopedEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (selectedCourseId !== "all" && entry.courseId !== selectedCourseId) return false;
      if (selectedSemesterId !== "all" && entry.semesterId !== selectedSemesterId) return false;
      if (focusFilter === "needs-support" && entry.supportStatus !== "needs-support") return false;
      if (focusFilter === "strong" && entry.supportStatus !== "strong") return false;
      return true;
    });
  }, [entries, selectedCourseId, selectedSemesterId, focusFilter]);

  const rangeAnchorDate = useMemo(() => {
    const datedEntries = scopedEntries
      .map((entry) => getEntryDateObject(entry))
      .filter(Boolean);

    if (!datedEntries.length) return null;

    return new Date(Math.max(...datedEntries.map((entryDate) => entryDate.getTime())));
  }, [scopedEntries]);

  const filteredEntries = useMemo(() => {
    if (!scopedEntries.length) return [];
    if (dateRange === "all" || !rangeAnchorDate) return scopedEntries;

    const startDate = shiftDays(rangeAnchorDate, dateRange === "week" ? -6 : -29);

    return scopedEntries.filter((entry) => {
      const entryDate = getEntryDateObject(entry);
      if (!entryDate) return false;
      return entryDate >= startDate && entryDate <= rangeAnchorDate;
    });
  }, [scopedEntries, dateRange, rangeAnchorDate]);

  const rangeSummaryLabel = useMemo(() => {
    const rangeSource = dateRange === "all" ? scopedEntries : filteredEntries;
    const datedEntries = rangeSource
      .map((entry) => getEntryDateObject(entry))
      .filter(Boolean);

    if (!datedEntries.length) return "No dated feedback";

    const startDate = new Date(Math.min(...datedEntries.map((entryDate) => entryDate.getTime())));
    const endDate = new Date(Math.max(...datedEntries.map((entryDate) => entryDate.getTime())));
    const labelPrefix = dateRange === "week" ? "Weekly window" : dateRange === "month" ? "Monthly window" : "All time";

    return `${labelPrefix} • ${formatWindowDateLabel(startDate)} - ${formatWindowDateLabel(endDate)}`;
  }, [dateRange, filteredEntries, scopedEntries]);

  const lessonSummaryRows = useMemo(() => {
    const lessonMap = new Map();

    filteredEntries.forEach((entry) => {
      const lessonKey = [entry.courseId, entry.semesterId, entry.monthId, entry.weekId, entry.date, entry.lessonTopic].join("__");
      const existing = lessonMap.get(lessonKey) || {
        lessonKey,
        courseId: entry.courseId,
        courseLabel: entry.courseLabel,
        semesterId: entry.semesterId,
        monthId: entry.monthId,
        weekId: entry.weekId,
        date: entry.date,
        lessonTopic: entry.lessonTopic || "Untitled lesson",
        totalResponses: 0,
        supportResponses: 0,
        ratingSum: 0,
        ratedResponses: 0,
        understandingCounts: {},
        genderCounts: { male: 0, female: 0, unknown: 0 },
        updatedAt: 0,
      };

      existing.totalResponses += 1;
      if (entry.supportStatus === "needs-support") {
        existing.supportResponses += 1;
      }
      if (entry.teacherRating > 0) {
        existing.ratingSum += Number(entry.teacherRating || 0);
        existing.ratedResponses += 1;
      }
      if (entry.understandingLevel) {
        existing.understandingCounts[entry.understandingLevel] = Number(existing.understandingCounts[entry.understandingLevel] || 0) + 1;
      }
      existing.genderCounts[entry.gender] = Number(existing.genderCounts[entry.gender] || 0) + 1;
      existing.updatedAt = Math.max(existing.updatedAt, Number(entry.updatedAt || entry.createdAt || 0));
      lessonMap.set(lessonKey, existing);
    });

    return Array.from(lessonMap.values())
      .map((row) => {
        const dominantUnderstandingKey = getDominantUnderstandingKey(row.understandingCounts);
        return {
          ...row,
          dominantUnderstandingKey,
          dominantUnderstandingLabel: dominantUnderstandingKey
            ? formatUnderstandingLabel(dominantUnderstandingKey)
            : "Not shared",
          averageRating: row.ratedResponses > 0 ? row.ratingSum / row.ratedResponses : 0,
          supportRate: getPercent(row.supportResponses, row.totalResponses),
        };
      })
      .sort((leftRow, rightRow) => Number(rightRow.updatedAt || 0) - Number(leftRow.updatedAt || 0));
  }, [filteredEntries]);

  const understandingRows = useMemo(() => {
    return UNDERSTANDING_ORDER.map((key) => {
      const count = filteredEntries.filter((entry) => entry.understandingLevel === key).length;
      return {
        key,
        label: UNDERSTANDING_META[key].label,
        tone: UNDERSTANDING_META[key].tone,
        color: UNDERSTANDING_META[key].color,
        count,
        percent: getPercent(count, totalResponses),
      };
    });
  }, [filteredEntries, totalResponses]);

  const understandingChartRows = useMemo(() => {
    return understandingRows.map((row) => ({
      key: row.key,
      label: row.label,
      axisLabel: row.label,
      axisLabelLines: buildAxisLabelLines(row.label),
      value: row.percent,
      color: row.color,
      description: `${row.count} responses`,
    }));
  }, [understandingRows]);

  const ratingRows = useMemo(() => {
    return [5, 4, 3, 2, 1].map((star) => {
      const count = filteredEntries.filter((entry) => Number(entry.teacherRating || 0) === star).length;
      return {
        key: String(star),
        label: `${star} Star`,
        count,
        percent: getPercent(count, ratedResponses),
      };
    });
  }, [filteredEntries, ratedResponses]);

  const genderSummary = useMemo(() => {
    return GENDER_ORDER.map((genderKey) => {
      const genderEntries = filteredEntries.filter((entry) => entry.gender === genderKey);
      const genderSupportEntries = genderEntries.filter((entry) => entry.supportStatus === "needs-support");
      return {
        key: genderKey,
        label: formatGenderLabel(genderKey),
        totalResponses: genderEntries.length,
        supportResponses: genderSupportEntries.length,
        supportRate: getPercent(genderSupportEntries.length, genderEntries.length),
      };
    });
  }, [filteredEntries]);

  const genderChartRows = useMemo(() => {
    return genderSummary.map((row) => ({
      key: row.key,
      label: row.label,
      axisLabel: row.label === "Unspecified" ? "Other" : row.label,
      axisLabelLines: [row.label === "Unspecified" ? "Other" : row.label],
      value: row.supportRate,
      color: row.key === "female" ? "#ea5b2a" : row.key === "male" ? "#007afb" : "#8ca3bf",
      description: `${row.supportResponses} flagged from ${row.totalResponses} responses`,
    }));
  }, [genderSummary]);

  const priorityGender = useMemo(() => {
    const ranked = genderSummary
      .filter((row) => row.totalResponses > 0)
      .sort((left, right) => {
        const rateDiff = Number(right.supportRate || 0) - Number(left.supportRate || 0);
        if (rateDiff !== 0) return rateDiff;
        return Number(right.supportResponses || 0) - Number(left.supportResponses || 0);
      });
    return ranked[0] || null;
  }, [genderSummary]);

  const courseRows = useMemo(() => {
    const courseMapLocal = new Map();

    filteredEntries.forEach((entry) => {
      const existing = courseMapLocal.get(entry.courseId) || {
        courseId: entry.courseId,
        courseLabel: entry.courseLabel,
        totalResponses: 0,
        ratingSum: 0,
        ratedResponses: 0,
        supportResponses: 0,
      };

      existing.totalResponses += 1;
      if (entry.teacherRating > 0) {
        existing.ratingSum += Number(entry.teacherRating || 0);
        existing.ratedResponses += 1;
      }
      if (entry.supportStatus === "needs-support") {
        existing.supportResponses += 1;
      }
      courseMapLocal.set(entry.courseId, existing);
    });

    return Array.from(courseMapLocal.values())
      .map((row) => ({
        ...row,
        averageRating: getAverage(row.ratingSum, row.ratedResponses),
        supportRate: getPercent(row.supportResponses, row.totalResponses),
      }))
      .sort((left, right) => sortByNumericDesc(left, right, "supportRate") || sortByNumericDesc(left, right, "totalResponses"))
      .slice(0, 6);
  }, [filteredEntries]);

  const topicRows = useMemo(() => {
    const topicMap = new Map();

    filteredEntries.forEach((entry) => {
      const topicKey = `${entry.courseId}__${entry.semesterId}__${entry.monthId}__${entry.weekId}__${entry.lessonTopic}`;
      const existing = topicMap.get(topicKey) || {
        topicKey,
        courseLabel: entry.courseLabel,
        semesterId: entry.semesterId,
        lessonTopic: entry.lessonTopic || "Untitled lesson",
        monthId: entry.monthId,
        weekId: entry.weekId,
        totalResponses: 0,
        supportResponses: 0,
      };

      existing.totalResponses += 1;
      if (entry.supportStatus === "needs-support") {
        existing.supportResponses += 1;
      }
      topicMap.set(topicKey, existing);
    });

    return Array.from(topicMap.values())
      .map((row) => ({
        ...row,
        supportRate: getPercent(row.supportResponses, row.totalResponses),
      }))
      .sort((left, right) => sortByNumericDesc(left, right, "supportRate") || sortByNumericDesc(left, right, "totalResponses"))
      .slice(0, 6);
  }, [filteredEntries]);

  const topicChartRows = useMemo(() => {
    return topicRows.map((row, index) => ({
      key: row.topicKey,
      label: row.lessonTopic,
      axisLabel: `Plan ${index + 1}`,
      axisLabelLines: ["Plan", String(index + 1)],
      value: row.supportRate,
      color: "#ea5b2a",
      description: `${row.courseLabel} • ${row.totalResponses} responses`,
    }));
  }, [topicRows]);

  const improvementChartRows = useMemo(() => {
    const timelineMap = new Map();

    filteredEntries.forEach((entry) => {
      const entryDate = getEntryDateObject(entry);
      if (!entryDate) return;

      const key = String(entry.date || entryDate.toISOString().slice(0, 10));
      const existing = timelineMap.get(key) || {
        key,
        date: new Date(entryDate),
        totalResponses: 0,
        supportResponses: 0,
        scoreSum: 0,
        scoredResponses: 0,
        lessonKeys: new Set(),
        lessonPlans: new Map(),
      };

      existing.totalResponses += 1;
      if (entry.supportStatus === "needs-support") {
        existing.supportResponses += 1;
      }

      const lessonKey = [entry.courseId, entry.semesterId, entry.monthId, entry.weekId, entry.lessonTopic].join("__");
      existing.lessonKeys.add(lessonKey);
      if (!existing.lessonPlans.has(lessonKey)) {
        existing.lessonPlans.set(lessonKey, {
          key: lessonKey,
          title: entry.lessonTopic || "Untitled lesson",
          context: formatLessonPlanContext(entry),
        });
      }
      const scoreValue = getLearningIndex(entry);

      if (scoreValue > 0) {
        existing.scoreSum += scoreValue;
        existing.scoredResponses += 1;
      }
      timelineMap.set(key, existing);
    });

    return Array.from(timelineMap.values())
      .sort((left, right) => left.date.getTime() - right.date.getTime())
      .slice(-10)
      .map((row) => ({
        key: row.key,
        label: formatDateLabel(row.key),
        axisLabel: formatWindowDateLabel(row.date),
        axisLabelLines: formatDateAxisLines(row.date),
        value: getAverage(row.scoreSum, row.scoredResponses),
        color: "#159a75",
        totalResponses: row.totalResponses,
        supportResponses: row.supportResponses,
        lessonPlans: Array.from(row.lessonPlans.values()),
        description: `${row.lessonKeys.size} daily plans • ${row.totalResponses} responses • ${row.supportResponses} need support`,
      }));
  }, [filteredEntries]);

  const renderDailyImprovementDetailCard = (detailRow, formattedValue) => (
    <div className="sf-chart-inspector is-daily">
      <div className="sf-chart-inspector-copy">
        <strong>{detailRow.label}</strong>
        <small>{detailRow.description || "Selected daily plan"}</small>

        <div className="sf-daily-inspector-meta">
          <span className="sf-daily-inspector-pill is-primary">{formattedValue} learning index</span>
          <span className="sf-daily-inspector-pill">{detailRow.totalResponses} responses</span>
          <span className="sf-daily-inspector-pill is-warning">{detailRow.supportResponses} need support</span>
        </div>
      </div>

      <div className="sf-daily-plan-list">
        {detailRow.lessonPlans?.length ? (
          detailRow.lessonPlans.map((lessonPlan) => (
            <article key={lessonPlan.key} className="sf-daily-plan-card">
              <strong>{lessonPlan.title}</strong>
              <small>{lessonPlan.context}</small>
            </article>
          ))
        ) : (
          <div className="sf-inline-empty">No daily lesson plans were grouped for this date.</div>
        )}
      </div>
    </div>
  );

  const feedbackHeadline = useMemo(() => {
    const topTopic = topicRows[0];
    if (topTopic && topTopic.supportResponses > 0) {
      return `${topTopic.courseLabel} needs the closest follow-up on ${topTopic.lessonTopic} with ${topTopic.supportRate}% of current responses flagged for support.`;
    }

    if (priorityGender && priorityGender.supportResponses > 0) {
      return `${priorityGender.label} responses currently carry the highest support share at ${priorityGender.supportRate}% in this view.`;
    }

    if (totalResponses > 0) {
      return `${getPercent(strongEntriesCount, totalResponses)}% of current feedback is landing in the strong range, so the overall signal is stable.`;
    }

    return "No feedback has been recorded for the current filter yet.";
  }, [priorityGender, strongEntriesCount, topicRows, totalResponses]);

  const handleLogout = async () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  if (!teacher) return null;

  return (
    <div className="dashboard-page student-feedback-page">
      <div className="google-dashboard student-feedback-shell">
        <Sidebar
          active="student-feedback"
          sidebarOpen={leftSidebarOpen}
          setSidebarOpen={setLeftSidebarOpen}
          teacher={teacher}
          handleLogout={handleLogout}
        />

        <div
          className="teacher-sidebar-spacer"
          style={{
            width: "var(--sidebar-width, clamp(230px, 16vw, 290px))",
            minWidth: "var(--sidebar-width, clamp(230px, 16vw, 290px))",
            flex: "0 0 var(--sidebar-width, clamp(230px, 16vw, 290px))",
            pointerEvents: "none",
            background: "#ffffff",
          }}
        />

        <main className="student-feedback-main">
          <section className="sf-card sf-hero">
            <div>
              <span className="sf-kicker">Student Feedback</span>
              <h1>Lesson feedback analytics</h1>
              <p>
                Read the class response quickly with clean visual graphs, lesson-level signals, and time-window controls. This view stays aggregate and does not show individual learners.
              </p>

              <div className="sf-hero-meta">
                <span className="sf-hero-chip">{courses.length} assigned courses</span>
                <span className="sf-hero-chip">{rangeSummaryLabel}</span>
                <span className="sf-hero-chip">Last update {lastUpdatedLabel}</span>
              </div>
            </div>

            {/* <div className="sf-hero-pulse">
              <div className="sf-pulse-icon">
                <FaChartBar />
              </div>
              <div>
                <strong>Teaching signal</strong>
                <p>{feedbackHeadline}</p>
              </div>
            </div> */}
          </section>

          <section className="sf-card sf-toolbar">
            <div className="sf-toolbar-head">
              <div className="sf-toolbar-title">
                <FaFilter />
                <span>Filter feedback</span>
              </div>
              <div className="sf-toolbar-note">{rangeSummaryLabel}</div>
            </div>

            <div className="sf-toolbar-controls">
              <label>
                Course
                <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)}>
                  <option value="all">All assigned courses</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{formatCourseLabel(course)}</option>
                  ))}
                </select>
              </label>

              <label>
                Semester
                <select value={selectedSemesterId} onChange={(event) => setSelectedSemesterId(event.target.value)}>
                  <option value="all">All semesters</option>
                  {availableSemesters.map((semesterId) => (
                    <option key={semesterId} value={semesterId}>{formatSemesterLabel(semesterId)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="sf-toolbar-switches">
              <div className="sf-switch-cluster">
                <span className="sf-switch-label">Date range</span>
                <div className="sf-focus-pills" role="tablist" aria-label="Analytics date range">
                  {DATE_RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`sf-chip${dateRange === option.id ? " is-active" : ""}`}
                      onClick={() => setDateRange(option.id)}
                      aria-pressed={dateRange === option.id}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sf-switch-cluster">
                <span className="sf-switch-label">Focus</span>
                <div className="sf-focus-pills" role="tablist" aria-label="Feedback focus filters">
                  {FOCUS_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`sf-chip${focusFilter === option.id ? " is-active" : ""}`}
                      onClick={() => setFocusFilter(option.id)}
                      aria-pressed={focusFilter === option.id}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {loading ? <div className="sf-card sf-empty-state">Loading student feedback...</div> : null}
          {!loading && error ? <div className="sf-card sf-empty-state">{error}</div> : null}
          {!loading && !error && !entries.length ? (
            <div className="sf-card sf-empty-state">
              No student feedback was found for this teacher yet.
            </div>
          ) : null}
          {!loading && !error && entries.length && !filteredEntries.length ? (
            <div className="sf-card sf-empty-state">
              No feedback matches the current filters. Try another course, semester, range, or focus.
            </div>
          ) : null}

          {!loading && !error && filteredEntries.length ? (
            <>
              <section className="sf-summary-grid">
                <article className="sf-card sf-metric-card">
                  <span>Total responses</span>
                  <strong>{totalResponses}</strong>
                  <small>All feedback entries in the active view</small>
                </article>

                <article className="sf-card sf-metric-card">
                  <span>Average rating</span>
                  <strong>{averageRating.toFixed(1)}</strong>
                  <small>{ratedResponses} rated responses</small>
                </article>

                <article className="sf-card sf-metric-card is-warning">
                  <span>Support share</span>
                  <strong>{supportShare}%</strong>
                  <small>{supportEntries.length} responses need follow-up</small>
                </article>

                <article className="sf-card sf-metric-card">
                  <span>Active lessons</span>
                  <strong>{activeLessons}</strong>
                  <small>Aggregated lesson summaries in this filter</small>
                </article>
              </section>

              <section className="sf-visual-grid">
                <article className="sf-card sf-chart-card">
                  <div className="sf-card-header">
                    <div>
                      <h2>Understanding mix</h2>
                      <span>Full understanding levels with x-y graph controls</span>
                    </div>

                    <ChartModeToggle
                      value={understandingChartMode}
                      onChange={setUnderstandingChartMode}
                      ariaLabel="Understanding graph mode"
                    />
                  </div>

                  <CartesianChart
                    rows={understandingChartRows}
                    mode={understandingChartMode}
                    valueFormatter={(value) => `${Math.round(Number(value || 0))}%`}
                    scaleMax={100}
                    lineColor="#007afb"
                    ariaLabel="Understanding mix chart"
                    emptyMessage="No understanding data is available in this filter."
                    xAxisLabel="Understanding level"
                    yAxisLabel="Share of feedback"
                  />
                </article>

                <article className="sf-card sf-chart-card is-full-span">
                  <div className="sf-card-header">
                    <div>
                      <h2>Daily improvement</h2>
                      <span>Daily plans on the x-axis and class learning score on the y-axis</span>
                    </div>

                    <div className="sf-card-actions">
                      <ChartModeToggle
                        value={improvementChartMode}
                        onChange={setImprovementChartMode}
                        ariaLabel="Daily improvement graph mode"
                      />
                      <button
                        type="button"
                        className="sf-collapse-button"
                        onClick={() => toggleCollapsedCard("improvement")}
                        aria-expanded={!collapsedCards.improvement}
                      >
                        {collapsedCards.improvement ? "Expand" : "Collapse"}
                      </button>
                    </div>
                  </div>

                  {!collapsedCards.improvement ? (
                    <CartesianChart
                      rows={improvementChartRows}
                      mode={improvementChartMode}
                      valueFormatter={(value) => `${Number(value || 0).toFixed(1)}/10`}
                      axisValueFormatter={(value) => `${Math.round(Number(value || 0))}`}
                      tickValues={[0, 2, 4, 6, 8, 10]}
                      scaleMax={10}
                      lineColor="#159a75"
                      ariaLabel="Daily improvement chart"
                      emptyMessage="No daily feedback points are available in this filter."
                      xAxisLabel="Daily plans"
                      yAxisLabel="Learning index"
                      chartWidth={920}
                      chartHeight={382}
                      chartPadding={{ left: 88, right: 44, top: 34, bottom: 112 }}
                      showDetailCard
                      renderDetailCard={renderDailyImprovementDetailCard}
                    />
                  ) : (
                    <div className="sf-card-collapsed-note">Daily improvement graph is collapsed.</div>
                  )}
                </article>

                <article className="sf-card sf-chart-card">
                  <div className="sf-card-header">
                    <div>
                      <h2>Topics needing follow-up</h2>
                      <span>Interactive lesson-level concern view</span>
                    </div>

                    <div className="sf-card-actions">
                      <ChartModeToggle
                        value={topicChartMode}
                        onChange={setTopicChartMode}
                        ariaLabel="Topic graph mode"
                      />
                      <button
                        type="button"
                        className="sf-collapse-button"
                        onClick={() => toggleCollapsedCard("topics")}
                        aria-expanded={!collapsedCards.topics}
                      >
                        {collapsedCards.topics ? "Expand" : "Collapse"}
                      </button>
                    </div>
                  </div>

                  {!collapsedCards.topics ? (
                    <CartesianChart
                      rows={topicChartRows}
                      mode={topicChartMode}
                      valueFormatter={(value) => `${Math.round(Number(value || 0))}%`}
                      scaleMax={100}
                      lineColor="#ea5b2a"
                      ariaLabel="Topics needing follow-up chart"
                      emptyMessage="No lesson topics stand out in the current filter."
                      xAxisLabel="Topic rank"
                      yAxisLabel="Support share"
                    />
                  ) : (
                    <div className="sf-card-collapsed-note">Topics needing follow-up graph is collapsed.</div>
                  )}
                </article>

                <article className="sf-card sf-chart-card">
                  <div className="sf-card-header">
                    <div>
                      <h2>Support by gender</h2>
                      <span>Switch between bar and line views with x-y axes</span>
                    </div>

                    <div className="sf-card-actions">
                      <ChartModeToggle
                        value={genderChartMode}
                        onChange={setGenderChartMode}
                        ariaLabel="Gender graph mode"
                      />
                      <button
                        type="button"
                        className="sf-collapse-button"
                        onClick={() => toggleCollapsedCard("gender")}
                        aria-expanded={!collapsedCards.gender}
                      >
                        {collapsedCards.gender ? "Expand" : "Collapse"}
                      </button>
                    </div>
                  </div>

                  {!collapsedCards.gender ? (
                    <CartesianChart
                      rows={genderChartRows}
                      mode={genderChartMode}
                      valueFormatter={(value) => `${Math.round(Number(value || 0))}%`}
                      scaleMax={100}
                      lineColor="#007afb"
                      ariaLabel="Support by gender chart"
                      emptyMessage="No gender-based support data is available in this filter."
                      xAxisLabel="Gender group"
                      yAxisLabel="Support share"
                    />
                  ) : (
                    <div className="sf-card-collapsed-note">Support by gender graph is collapsed.</div>
                  )}
                </article>
              </section>

              <section className="sf-details-grid">
                <article className="sf-card sf-chart-card">
                  <div className="sf-card-header">
                    <div>
                      <h2>Course signals</h2>
                      <span>Courses ranked by support share</span>
                    </div>

                    <div className="sf-card-actions">
                      <button
                        type="button"
                        className="sf-collapse-button"
                        onClick={() => toggleCollapsedCard("courseSignals")}
                        aria-expanded={!collapsedCards.courseSignals}
                      >
                        {collapsedCards.courseSignals ? "Expand" : "Collapse"}
                      </button>
                    </div>
                  </div>

                  {!collapsedCards.courseSignals ? (
                    <div className="sf-ranked-list">
                      {courseRows.map((row) => (
                        <div key={row.courseId} className="sf-ranked-row">
                          <div className="sf-ranked-head">
                            <div>
                              <strong>{row.courseLabel}</strong>
                              <small>{row.totalResponses} responses</small>
                            </div>
                            <div className="sf-ranked-metrics">
                              <span><FaStar /> {row.averageRating.toFixed(1)}</span>
                              <span className="is-support">{row.supportRate}% support</span>
                            </div>
                          </div>
                          <div className="sf-ranked-track">
                            <span className="sf-ranked-fill is-support" style={{ width: `${row.supportRate}%` }} />
                          </div>
                        </div>
                      ))}
                      {!courseRows.length ? <div className="sf-inline-empty">No course-level summary is available in this filter.</div> : null}
                    </div>
                  ) : (
                    <div className="sf-card-collapsed-note">Course signals graph is collapsed.</div>
                  )}
                </article>

                <article className="sf-card sf-chart-card">
                  <div className="sf-card-header">
                    <div>
                      <h2>Rating distribution</h2>
                      <span>A quick read on how lessons are being scored</span>
                    </div>

                    <div className="sf-card-actions">
                      <button
                        type="button"
                        className="sf-collapse-button"
                        onClick={() => toggleCollapsedCard("ratings")}
                        aria-expanded={!collapsedCards.ratings}
                      >
                        {collapsedCards.ratings ? "Expand" : "Collapse"}
                      </button>
                    </div>
                  </div>

                  {!collapsedCards.ratings ? (
                    <div className="sf-bar-list">
                      {ratingRows.map((row) => (
                        <div key={row.key} className="sf-bar-row">
                          <div className="sf-bar-label is-rating">
                            <span>{row.label}</span>
                            <strong>{row.count}</strong>
                          </div>
                          <div className="sf-bar-track">
                            <span className="sf-bar-fill is-rating" style={{ width: `${row.percent}%` }} />
                          </div>
                          <small>{row.percent}%</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="sf-card-collapsed-note">Rating distribution graph is collapsed.</div>
                  )}
                </article>
              </section>

              <section className="sf-card sf-table-card">
                <div className="sf-card-header">
                  <div>
                    <h2>Recent lesson feedback</h2>
                    <span>Aggregated lesson summaries only</span>
                  </div>
                  <div className="sf-toolbar-note">No individual student names are shown here.</div>
                </div>

                <div className="sf-feedback-table-wrap">
                  <table className="sf-feedback-table">
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Lesson</th>
                        <th>Date</th>
                        <th>Responses</th>
                        <th>Avg rating</th>
                        <th>Dominant understanding</th>
                        <th>Support rate</th>
                        <th>Gender mix</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lessonSummaryRows.slice(0, 12).map((row) => (
                        <tr key={row.lessonKey}>
                          <td>{row.courseLabel}</td>
                          <td>
                            <div className="sf-table-primary">{row.lessonTopic}</div>
                            <div className="sf-table-secondary">{formatSemesterLabel(row.semesterId)} • {row.monthId} {row.weekId}</div>
                          </td>
                          <td>{formatDateLabel(row.date)}</td>
                          <td>{row.totalResponses}</td>
                          <td>{row.averageRating > 0 ? row.averageRating.toFixed(1) : "-"}</td>
                          <td>
                            <span className={`sf-status-pill is-${UNDERSTANDING_META[row.dominantUnderstandingKey]?.tone || "neutral"}`}>
                              {row.dominantUnderstandingLabel}
                            </span>
                          </td>
                          <td>
                            <span className={`sf-status-pill is-${row.supportRate >= 50 ? "needs-support" : row.supportRate >= 25 ? "watch" : "strong"}`}>
                              {row.supportRate}%
                            </span>
                          </td>
                          <td>{formatGenderMix(row.genderCounts)}</td>
                          <td>{formatDateTimeLabel(row.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default StudentFeedbackPage;