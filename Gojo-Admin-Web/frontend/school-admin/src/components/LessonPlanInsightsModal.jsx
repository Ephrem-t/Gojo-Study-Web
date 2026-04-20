import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const UNDERSTANDING_META = {
  excellent: { label: "Excellent", color: "#007afb" },
  good: { label: "Good", color: "#39a0ff" },
  partial: { label: "Partial", color: "#8cc5ff" },
  dont_understand: { label: "Needs support", color: "#d65454" },
  unknown: { label: "No signal", color: "#c6d8ef" },
};

const normalizeText = (value) => {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? "").trim()).filter(Boolean).join(", ");
  }
  return String(value).trim();
};

const uniqJoin = (values) => {
  return Array.from(new Set((values || []).map((value) => normalizeText(value)).filter(Boolean))).join(", ");
};

const getWeekLabel = (week) => (week?.week ? `Week ${week.week}` : "Week");

const mergeFeedbackSummaries = (summaries) => {
  const safeSummaries = Array.isArray(summaries) ? summaries.filter(Boolean) : [];
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const understandingCounts = {
    excellent: 0,
    good: 0,
    partial: 0,
    dont_understand: 0,
    unknown: 0,
  };

  let responseCount = 0;
  let ratingTotal = 0;

  safeSummaries.forEach((summary) => {
    const summaryResponses = Number(summary?.responseCount || 0);
    responseCount += summaryResponses;
    ratingTotal += Number(summary?.averageRating || 0) * summaryResponses;

    Object.keys(ratingCounts).forEach((key) => {
      ratingCounts[key] += Number(summary?.ratingCounts?.[key] || 0);
    });

    Object.keys(understandingCounts).forEach((key) => {
      understandingCounts[key] += Number(summary?.understandingCounts?.[key] || 0);
    });
  });

  const dominantUnderstandingKey = Object.entries(understandingCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";

  return {
    responseCount,
    averageRating: responseCount ? Number((ratingTotal / responseCount).toFixed(1)) : 0,
    ratingCounts,
    understandingCounts,
    dominantUnderstandingKey,
    dominantUnderstandingLabel: UNDERSTANDING_META[dominantUnderstandingKey]?.label || "No signal",
  };
};

const collectWeekInsight = (week) => mergeFeedbackSummaries((week?.weekDays || []).map((day) => day?.feedback));

const MetricCard = ({ label, value, hint }) => (
  <div
    style={{
      background: "linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%)",
      border: "1px solid var(--border-soft)",
      borderRadius: 16,
      padding: 14,
      boxShadow: "var(--shadow-soft)",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      minHeight: 96,
    }}
  >
    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
    <div style={{ fontSize: 24, lineHeight: 1, fontWeight: 900, color: "var(--text-primary)" }}>{value}</div>
    {hint ? <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{hint}</div> : null}
  </div>
);

const StackedUnderstandingBar = ({ summary }) => {
  const total = Number(summary?.responseCount || 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", width: "100%", height: 12, borderRadius: 999, overflow: "hidden", background: "#e9f2ff" }}>
        {Object.entries(UNDERSTANDING_META).map(([key, meta]) => {
          const count = Number(summary?.understandingCounts?.[key] || 0);
          if (!count || !total) return null;
          return <div key={key} style={{ width: `${(count / total) * 100}%`, background: meta.color }} />;
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        {Object.entries(UNDERSTANDING_META).map(([key, meta]) => {
          const count = Number(summary?.understandingCounts?.[key] || 0);
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-secondary)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: meta.color, flexShrink: 0 }} />
              <span>{meta.label}</span>
              <strong style={{ marginLeft: "auto", color: "var(--text-primary)" }}>{count}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RatingBars = ({ summary }) => {
  const maxCount = Math.max(1, ...Object.values(summary?.ratingCounts || {}));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[5, 4, 3, 2, 1].map((rating) => {
        const count = Number(summary?.ratingCounts?.[rating] || 0);
        return (
          <div key={rating} style={{ display: "grid", gridTemplateColumns: "42px 1fr 28px", alignItems: "center", gap: 10, fontSize: 11 }}>
            <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{rating}★</div>
            <div style={{ height: 10, borderRadius: 999, background: "#eaf2ff", overflow: "hidden" }}>
              <div
                style={{
                  width: `${(count / maxCount) * 100}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: rating >= 4 ? "#007afb" : rating === 3 ? "#69b3ff" : "#d65454",
                }}
              />
            </div>
            <div style={{ textAlign: "right", color: "var(--text-secondary)" }}>{count}</div>
          </div>
        );
      })}
    </div>
  );
};

const FeedbackPanel = ({ title, summary, subtitle }) => {
  const hasResponses = Number(summary?.responseCount || 0) > 0;

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
        border: "1px solid var(--border-soft)",
        borderRadius: 16,
        padding: 16,
        boxShadow: "var(--shadow-soft)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{subtitle}</div> : null}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: hasResponses ? "#005bc2" : "var(--text-muted)" }}>
          {hasResponses ? `${summary.responseCount} responses` : "No feedback yet"}
        </div>
      </div>

      {!hasResponses ? (
        <div style={{ padding: 14, borderRadius: 14, background: "#f8fbff", border: "1px dashed #d6e9ff", color: "var(--text-secondary)", fontSize: 12 }}>
          Student feedback appears here after learners submit what they understood from the lesson topic.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(240px, 0.8fr)", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 28, lineHeight: 1, fontWeight: 900, color: "var(--text-primary)" }}>{summary.averageRating.toFixed(1)}</span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>average teacher rating</span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#005bc2", fontWeight: 800 }}>{summary.dominantUnderstandingLabel}</span>
            </div>
            <StackedUnderstandingBar summary={summary} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Rating spread</div>
            <RatingBars summary={summary} />
          </div>
        </div>
      )}
    </div>
  );
};

const TopicRatingChart = ({ data, chartType, title, subtitle, emptyMessage }) => {
  const safeData = Array.isArray(data) ? data : [];
  const hasResponses = safeData.some((entry) => Number(entry?.responses || 0) > 0);

  if (!safeData.length || !hasResponses) {
    return (
      <div style={{ padding: 14, borderRadius: 14, background: "#f8fbff", border: "1px dashed #d6e9ff", color: "var(--text-secondary)", fontSize: 12 }}>
        {emptyMessage || "Rating graph will appear after lessons receive student feedback."}
      </div>
    );
  }

  const tooltipFormatter = (value, name) => {
    if (name === "rating") return [`${Number(value || 0).toFixed(1)} / 5`, "Average rating"];
    if (name === "responses") return [value, "Responses"];
    return [value, name];
  };

  const commonAxisStyle = {
    fontSize: 11,
    fill: "#58708d",
  };

  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid var(--border-soft)",
        background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
        boxShadow: "var(--shadow-soft)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>{title || "Topic rating graph"}</div>
          {subtitle ? <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{subtitle}</div> : null}
        </div>
        <div style={{ fontSize: 11, color: "#005bc2", fontWeight: 800 }}>
          {chartType === "bar" ? "Bar graph" : "Line graph"}
        </div>
      </div>

      <div style={{ width: "100%", height: Math.max(320, safeData.length * 54) }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={safeData} layout="vertical" margin={{ top: 8, right: 24, left: 20, bottom: 8 }}>
              <CartesianGrid stroke="#e3eefc" strokeDasharray="4 4" />
              <XAxis type="number" domain={[0, 5]} tickCount={6} style={commonAxisStyle} />
              <YAxis type="category" dataKey="topicLabel" width={180} style={commonAxisStyle} />
              <Tooltip
                formatter={tooltipFormatter}
                contentStyle={{ borderRadius: 14, border: "1px solid #d6e9ff", boxShadow: "0 12px 24px rgba(10, 46, 94, 0.12)" }}
                labelStyle={{ color: "#0c2340", fontWeight: 800 }}
              />
              <Bar dataKey="rating" radius={[0, 10, 10, 0]} fill="#007afb" />
            </BarChart>
          ) : (
            <LineChart data={safeData} margin={{ top: 8, right: 24, left: 8, bottom: 42 }}>
              <CartesianGrid stroke="#e3eefc" strokeDasharray="4 4" />
              <XAxis dataKey="shortTopic" interval={0} angle={-18} textAnchor="end" height={68} style={commonAxisStyle} />
              <YAxis domain={[0, 5]} tickCount={6} style={commonAxisStyle} />
              <Tooltip
                formatter={tooltipFormatter}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.topicLabel || "Topic"}
                contentStyle={{ borderRadius: 14, border: "1px solid #d6e9ff", boxShadow: "0 12px 24px rgba(10, 46, 94, 0.12)" }}
                labelStyle={{ color: "#0c2340", fontWeight: 800 }}
              />
              <Line type="monotone" dataKey="rating" stroke="#007afb" strokeWidth={3} dot={{ r: 4, fill: "#007afb" }} activeDot={{ r: 6 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const LessonPlanInsightsModal = ({
  open,
  onClose,
  teacherName,
  selectedCourseId,
  onCourseChange,
  courseOptions,
  selectedCourseLabel,
  annualWeeks,
  annualByMonth,
  annualMonthKeys,
  currentMonthName,
  currentMonthWeeks,
  visibleDailyPlans,
  planLoading,
  planError,
  downloadAnnualExcel,
  getDayStatus,
}) => {
  const [viewMode, setViewMode] = useState("annual");
  const [dailyChartType, setDailyChartType] = useState("bar");
  const [annualTimelineMode, setAnnualTimelineMode] = useState("daily");
  const [annualTimelineChartType, setAnnualTimelineChartType] = useState("line");
  const [expandedAnnualWeeks, setExpandedAnnualWeeks] = useState({});
  const [expandedMonthlyWeeks, setExpandedMonthlyWeeks] = useState({});

  const overallInsight = useMemo(() => mergeFeedbackSummaries((annualWeeks || []).flatMap((week) => (week?.weekDays || []).map((day) => day?.feedback))), [annualWeeks]);

  const totalDayPlans = useMemo(() => (annualWeeks || []).reduce((sum, week) => sum + (Array.isArray(week?.weekDays) ? week.weekDays.length : 0), 0), [annualWeeks]);

  const monthlyInsights = useMemo(() => {
    return (currentMonthWeeks || []).map((week) => ({
      week,
      summary: collectWeekInsight(week),
      statusSummary: (week?.weekDays || []).reduce(
        (acc, day) => {
          const state = getDayStatus?.(week?.courseId, week?.week, day)?.status || "pending";
          acc[state] = (acc[state] || 0) + 1;
          acc.total += 1;
          return acc;
        },
        { submitted: 0, pending: 0, missed: 0, total: 0 }
      ),
    }));
  }, [currentMonthWeeks, getDayStatus]);

  const orderedAnnualWeeks = useMemo(() => {
    return (annualMonthKeys || []).flatMap((monthKey) => annualByMonth?.[monthKey] || []);
  }, [annualByMonth, annualMonthKeys]);

  const annualDailyRatingSeries = useMemo(() => {
    return orderedAnnualWeeks.flatMap((week, weekIndex) => {
      const weekLabel = `${week?.month || "Month"} ${getWeekLabel(week)}`;
      return (week?.weekDays || []).map((day, dayIndex) => {
        const topic = normalizeText(day?.topic) || `Lesson ${weekIndex + 1}.${dayIndex + 1}`;
        const feedback = day?.feedback || null;
        const responses = Number(feedback?.responseCount || 0);

        return {
          id: `${week?.month || "month"}-${week?.week || weekIndex}-${day?.date || dayIndex}-${topic}`,
          topicLabel: `${topic} (${weekLabel})`,
          shortTopic: topic.length > 20 ? `${topic.slice(0, 20)}...` : topic,
          rating: responses ? Number(feedback?.averageRating || 0) : 0,
          responses,
          date: normalizeText(day?.date) || "No date",
          weekLabel,
        };
      });
    });
  }, [orderedAnnualWeeks]);

  const annualWeeklyRatingSeries = useMemo(() => {
    return orderedAnnualWeeks.map((week, index) => {
      const feedback = collectWeekInsight(week);
      const label = `${week?.month || "Month"} ${getWeekLabel(week)}`;
      return {
        id: `${label}-${index}`,
        topicLabel: label,
        shortTopic: label,
        rating: feedback.responseCount ? Number(feedback.averageRating || 0) : 0,
        responses: Number(feedback.responseCount || 0),
        date: label,
      };
    });
  }, [orderedAnnualWeeks]);

  const dailyRatingSeries = useMemo(() => {
    return (visibleDailyPlans || [])
      .map((day, index) => {
        const topic = normalizeText(day?.topic) || `Lesson ${index + 1}`;
        const summary = day?.feedback || null;
        const averageRating = Number(summary?.averageRating || 0);
        const responseCount = Number(summary?.responseCount || 0);

        return {
          id: `${day?.date || index}-${topic}`,
          topicLabel: topic,
          shortTopic: topic.length > 20 ? `${topic.slice(0, 20)}...` : topic,
          rating: responseCount ? averageRating : 0,
          responses: responseCount,
          date: normalizeText(day?.date) || "No date",
        };
      });
  }, [visibleDailyPlans]);

  const viewButtons = [
    { id: "annual", label: "Annual view" },
    { id: "monthly", label: "Monthly rhythm" },
    { id: "daily", label: "Daily lessons" },
  ];

  const toggleMonthlyWeek = (weekKey) => {
    setExpandedMonthlyWeeks((current) => ({
      ...current,
      [weekKey]: !current?.[weekKey],
    }));
  };

  const toggleAnnualWeek = (weekKey) => {
    setExpandedAnnualWeeks((current) => ({
      ...current,
      [weekKey]: !current?.[weekKey],
    }));
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5000,
        background: "rgba(11, 36, 71, 0.35)",
        backdropFilter: "blur(6px)",
        padding: 18,
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #f7fbff 0%, #ffffff 18%, #ffffff 100%)",
          borderRadius: 24,
          overflow: "hidden",
          border: "1px solid rgba(0, 122, 251, 0.14)",
          boxShadow: "0 30px 80px rgba(10, 46, 94, 0.24)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #dcecff",
            background: "linear-gradient(135deg, rgba(0, 122, 251, 0.09), rgba(255, 255, 255, 0.96) 60%)",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#005bc2", textTransform: "uppercase", letterSpacing: 0.9 }}>Lesson plan insights</div>
              <div style={{ fontSize: 28, lineHeight: 1.05, fontWeight: 900, color: "var(--text-primary)", marginTop: 4 }}>{selectedCourseLabel}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{teacherName}</div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {viewButtons.map((button) => {
                const active = viewMode === button.id;
                return (
                  <button
                    key={button.id}
                    type="button"
                    onClick={() => setViewMode(button.id)}
                    style={{
                      border: active ? "1px solid #007afb" : "1px solid #d6e9ff",
                      background: active ? "#007afb" : "rgba(255,255,255,0.92)",
                      color: active ? "#ffffff" : "#24568f",
                      borderRadius: 999,
                      padding: "8px 14px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {button.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <select
              value={selectedCourseId}
              onChange={(event) => onCourseChange?.(event.target.value)}
              style={{
                minWidth: 240,
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid #d6e9ff",
                background: "#ffffff",
                fontSize: 12,
                color: "var(--text-primary)",
                outline: "none",
                fontWeight: 700,
              }}
            >
              {(courseOptions || []).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={downloadAnnualExcel}
              disabled={!annualWeeks?.length}
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                border: "1px solid #c8e0ff",
                background: annualWeeks?.length ? "#e8f3ff" : "#f2f5f9",
                color: annualWeeks?.length ? "#005bc2" : "#8ca3bf",
                fontSize: 12,
                fontWeight: 800,
                cursor: annualWeeks?.length ? "pointer" : "not-allowed",
              }}
            >
              Export Excel
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                border: "1px solid #0c2340",
                background: "#0c2340",
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div style={{ padding: 18, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <MetricCard label="Weeks" value={annualWeeks?.length || 0} />
            <MetricCard label="Daily lessons" value={totalDayPlans} />
            <MetricCard label="Responses" value={overallInsight.responseCount} />
            <MetricCard label="Avg rating" value={overallInsight.responseCount ? overallInsight.averageRating.toFixed(1) : "0.0"} />
          </div>

          <FeedbackPanel
            title="Student understanding signal"
            summary={overallInsight}
          />

          {!planLoading && !!annualWeeks?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "var(--text-primary)" }}>Annual improvement graph</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Daily or weekly rating trend</div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {[
                    { id: "daily", label: "Daily" },
                    { id: "weekly", label: "Weekly" },
                  ].map((option) => {
                    const active = annualTimelineMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setAnnualTimelineMode(option.id)}
                        style={{
                          border: active ? "1px solid #007afb" : "1px solid #d6e9ff",
                          background: active ? "#007afb" : "#ffffff",
                          color: active ? "#ffffff" : "#24568f",
                          borderRadius: 999,
                          padding: "7px 12px",
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                  {[
                    { id: "line", label: "Line" },
                    { id: "bar", label: "Bar" },
                  ].map((option) => {
                    const active = annualTimelineChartType === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setAnnualTimelineChartType(option.id)}
                        style={{
                          border: active ? "1px solid #0c2340" : "1px solid #d6e9ff",
                          background: active ? "#0c2340" : "#ffffff",
                          color: active ? "#ffffff" : "#24568f",
                          borderRadius: 999,
                          padding: "7px 12px",
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <TopicRatingChart
                data={annualTimelineMode === "daily" ? annualDailyRatingSeries : annualWeeklyRatingSeries}
                chartType={annualTimelineChartType}
                title={annualTimelineMode === "daily" ? "Daily lesson rating timeline" : "Weekly rating timeline"}
                emptyMessage={annualTimelineMode === "daily"
                  ? "This daily annual graph will appear after lesson topics receive student feedback."
                  : "This weekly annual graph will appear after lesson weeks receive student feedback."}
              />
            </div>
          ) : null}

          {planError ? (
            <div style={{ padding: 16, borderRadius: 18, background: "#fff5f5", border: "1px solid #f3cbcb", color: "#a33e3e", fontSize: 12 }}>{planError}</div>
          ) : null}

          {planLoading ? (
            <div style={{ padding: 16, borderRadius: 18, background: "#f8fbff", border: "1px solid #dcecff", color: "var(--text-secondary)", fontSize: 12 }}>
              Loading lesson plan insights...
            </div>
          ) : null}

          {!planLoading && !annualWeeks?.length ? (
            <div style={{ padding: 18, borderRadius: 18, background: "#f8fbff", border: "1px solid #dcecff", color: "var(--text-secondary)", fontSize: 12 }}>
              No annual lesson plan was found for this subject selection.
            </div>
          ) : null}

          {!planLoading && !!annualWeeks?.length && viewMode === "annual" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {(annualMonthKeys || []).map((monthKey) => {
                const monthWeeks = (annualByMonth?.[monthKey] || []).slice();
                const monthInsight = mergeFeedbackSummaries(monthWeeks.flatMap((week) => (week?.weekDays || []).map((day) => day?.feedback)));

                return (
                  <div key={monthKey} style={{ border: "1px solid #dcecff", borderRadius: 18, background: "#ffffff", boxShadow: "var(--shadow-soft)", overflow: "hidden" }}>
                    <div style={{ padding: "14px 16px", borderBottom: "1px solid #e6f1ff", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 900, color: "var(--text-primary)" }}>{monthKey}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{monthWeeks.length} planned week(s)</div>
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#005bc2" }}>
                          {monthInsight.responseCount} student responses
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-secondary)" }}>
                          {monthInsight.dominantUnderstandingLabel}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: 16 }}>
                      <div style={{ overflowX: "auto", borderRadius: 16, border: "1px solid #e1edff", background: "#ffffff" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
                          <thead>
                            <tr style={{ background: "#f4f9ff" }}>
                              {[
                                "Week",
                                "Topic",
                                "Objective",
                                "Method",
                                "Assessment",
                                "Rating",
                                "Responses",
                                "Submission",
                                "Understanding",
                                "Details",
                              ].map((heading) => (
                                <th
                                  key={heading}
                                  style={{
                                    textAlign: "left",
                                    padding: "14px 16px",
                                    fontSize: 11,
                                    fontWeight: 900,
                                    color: "#5a7391",
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                    borderBottom: "1px solid #e6f1ff",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {heading}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {monthWeeks.map((week, index) => {
                              const rowKey = `${monthKey}-${week?.week || index}`;
                              const isOpen = !!expandedAnnualWeeks?.[rowKey];
                              const weekInsight = collectWeekInsight(week);
                              const days = Array.isArray(week?.weekDays) ? week.weekDays : [];
                              const statusSummary = days.reduce(
                                (acc, day) => {
                                  const state = getDayStatus?.(week?.courseId, week?.week, day)?.status || "pending";
                                  acc[state] = (acc[state] || 0) + 1;
                                  acc.total += 1;
                                  return acc;
                                },
                                { submitted: 0, pending: 0, missed: 0, total: 0 }
                              );
                              const topicText = normalizeText(week?.topic) || uniqJoin(days.map((day) => day?.topic)) || "No topic recorded";
                              const objectiveText = normalizeText(week?.objective) || uniqJoin(days.map((day) => day?.objective)) || "No objective recorded";
                              const methodText = normalizeText(week?.method) || uniqJoin(days.map((day) => day?.method)) || "Not recorded";
                              const assessmentText = normalizeText(week?.assessment) || uniqJoin(days.map((day) => day?.assessment)) || "Not recorded";

                              return (
                                <React.Fragment key={rowKey}>
                                  <tr
                                    onClick={() => toggleAnnualWeek(rowKey)}
                                    style={{
                                      background: index % 2 === 0 ? "#ffffff" : "#fbfdff",
                                      borderBottom: isOpen ? "none" : (index === monthWeeks.length - 1 ? "none" : "1px solid #eef5ff"),
                                      cursor: "pointer",
                                    }}
                                  >
                                    <td style={{ padding: "16px", verticalAlign: "top" }}>
                                      <div style={{ fontSize: 13, fontWeight: 900, color: "var(--text-primary)" }}>{getWeekLabel(week)}</div>
                                    </td>
                                    <td style={{ padding: "16px", verticalAlign: "top", fontSize: 12, color: "var(--text-primary)", fontWeight: 700, lineHeight: 1.55 }}>{topicText}</td>
                                    <td style={{ padding: "16px", verticalAlign: "top", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>{objectiveText}</td>
                                    <td style={{ padding: "16px", verticalAlign: "top", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>{methodText}</td>
                                    <td style={{ padding: "16px", verticalAlign: "top", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>{assessmentText}</td>
                                    <td style={{ padding: "16px", verticalAlign: "top" }}>
                                      <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)" }}>{weekInsight.responseCount ? weekInsight.averageRating.toFixed(1) : "0.0"}</div>
                                      <div style={{ fontSize: 11, color: "#5b7390", marginTop: 4 }}>out of 5.0</div>
                                    </td>
                                    <td style={{ padding: "16px", verticalAlign: "top" }}>
                                      <div style={{ fontSize: 13, fontWeight: 900, color: "#005bc2" }}>{weekInsight.responseCount}</div>
                                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>student response(s)</div>
                                    </td>
                                    <td style={{ padding: "16px", verticalAlign: "top" }}>
                                      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 170 }}>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: "#0b8f55" }}>{statusSummary.submitted} submitted</span>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: "#7088a5" }}>{statusSummary.pending} pending</span>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: "#b54848" }}>{statusSummary.missed} missed</span>
                                      </div>
                                    </td>
                                    <td style={{ padding: "16px", verticalAlign: "top" }}>
                                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#005bc2", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" }}>
                                        <span style={{ width: 8, height: 8, borderRadius: 999, background: UNDERSTANDING_META[weekInsight.dominantUnderstandingKey]?.color || "#007afb" }} />
                                        {weekInsight.dominantUnderstandingLabel}
                                      </div>
                                    </td>
                                    <td style={{ padding: "16px", verticalAlign: "top" }}>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          toggleAnnualWeek(rowKey);
                                        }}
                                        style={{
                                          border: "1px solid #d6e9ff",
                                          background: isOpen ? "#0c2340" : "#ffffff",
                                          color: isOpen ? "#ffffff" : "#24568f",
                                          borderRadius: 999,
                                          padding: "8px 12px",
                                          fontSize: 11,
                                          fontWeight: 900,
                                          cursor: "pointer",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {isOpen ? "Hide details" : "Show daily details"}
                                      </button>
                                    </td>
                                  </tr>

                                  {isOpen ? (
                                    <tr style={{ background: "#f8fbff" }}>
                                      <td colSpan={10} style={{ padding: "0 16px 18px 16px", borderBottom: index === monthWeeks.length - 1 ? "none" : "1px solid #eef5ff" }}>
                                        <div style={{ borderRadius: 16, border: "1px solid #dcecff", background: "#ffffff", overflow: "hidden", marginTop: 2 }}>
                                          <div style={{ padding: "12px 14px", borderBottom: "1px solid #eaf2ff", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--text-primary)" }}>Daily lesson plan details</div>
                                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{days.length} lesson day(s)</div>
                                          </div>

                                          {!days.length ? (
                                            <div style={{ padding: 16, fontSize: 12, color: "var(--text-secondary)" }}>No daily lesson plan details recorded for this week.</div>
                                          ) : (
                                            <div style={{ overflowX: "auto" }}>
                                              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
                                                <thead>
                                                  <tr style={{ background: "#fbfdff" }}>
                                                    {[
                                                      "Date",
                                                      "Topic",
                                                      "Method",
                                                      "Assessment",
                                                      "Aids / Notes",
                                                      "Status",
                                                      "Rating",
                                                    ].map((heading) => (
                                                      <th
                                                        key={heading}
                                                        style={{
                                                          textAlign: "left",
                                                          padding: "12px 14px",
                                                          fontSize: 10,
                                                          fontWeight: 900,
                                                          color: "#5a7391",
                                                          textTransform: "uppercase",
                                                          letterSpacing: 0.5,
                                                          borderBottom: "1px solid #edf4ff",
                                                        }}
                                                      >
                                                        {heading}
                                                      </th>
                                                    ))}
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {days.map((day, dayIndex) => {
                                                    const dayStatus = getDayStatus?.(week?.courseId, week?.week, day) || { status: "pending", statusLabel: "Pending" };
                                                    const dayFeedback = day?.feedback || null;
                                                    const statusBackground = dayStatus.status === "submitted" ? "#effcf5" : dayStatus.status === "missed" ? "#fff6f6" : "#f4f8fc";
                                                    const statusColor = dayStatus.status === "submitted" ? "#0b8f55" : dayStatus.status === "missed" ? "#b54848" : "#7088a5";

                                                    return (
                                                      <tr key={`${rowKey}-${day?.date || dayIndex}`} style={{ borderBottom: dayIndex === days.length - 1 ? "none" : "1px solid #f0f5fd" }}>
                                                        <td style={{ padding: "14px", fontSize: 12, color: "var(--text-primary)", verticalAlign: "top", whiteSpace: "nowrap" }}>{normalizeText(day?.date) || "No date"}</td>
                                                        <td style={{ padding: "14px", fontSize: 12, color: "var(--text-primary)", verticalAlign: "top", fontWeight: 700 }}>{normalizeText(day?.topic) || "No topic recorded"}</td>
                                                        <td style={{ padding: "14px", fontSize: 12, color: "var(--text-secondary)", verticalAlign: "top" }}>{normalizeText(day?.method) || "Not recorded"}</td>
                                                        <td style={{ padding: "14px", fontSize: 12, color: "var(--text-secondary)", verticalAlign: "top" }}>{normalizeText(day?.assessment) || "Not recorded"}</td>
                                                        <td style={{ padding: "14px", fontSize: 12, color: "var(--text-secondary)", verticalAlign: "top" }}>{normalizeText(day?.aids) || normalizeText(day?.note) || "No supporting notes"}</td>
                                                        <td style={{ padding: "14px", verticalAlign: "top" }}>
                                                          <span style={{ display: "inline-flex", alignItems: "center", padding: "7px 11px", borderRadius: 999, background: statusBackground, color: statusColor, fontSize: 11, fontWeight: 900 }}>
                                                            {dayStatus.statusLabel || dayStatus.status}
                                                          </span>
                                                        </td>
                                                        <td style={{ padding: "14px", verticalAlign: "top" }}>
                                                          <div style={{ fontSize: 12, fontWeight: 900, color: "#005bc2" }}>
                                                            {dayFeedback?.responseCount ? `${dayFeedback.averageRating.toFixed(1)} / 5` : "No feedback"}
                                                          </div>
                                                          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                                                            {dayFeedback?.responseCount ? `${dayFeedback.responseCount} response(s)` : "Waiting for students"}
                                                          </div>
                                                        </td>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ) : null}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!planLoading && !!annualWeeks?.length && viewMode === "monthly" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <FeedbackPanel
                title={`${currentMonthName || "Current month"} pacing`}
                summary={mergeFeedbackSummaries(monthlyInsights.map((item) => item.summary))}
              />

              <div
                style={{
                  borderRadius: 18,
                  border: "1px solid #dcecff",
                  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
                  boxShadow: "var(--shadow-soft)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid #e6f1ff",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: "var(--text-primary)" }}>Weekly lesson plan table</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Expand any week for daily details</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#005bc2" }}>
                    {monthlyInsights.length} week(s)
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                    <thead>
                      <tr style={{ background: "#f4f9ff" }}>
                        {[
                          "Week",
                          "Lesson focus",
                          "Student rating",
                          "Responses",
                          "Submission",
                          "Understanding",
                          "Details",
                        ].map((heading) => (
                          <th
                            key={heading}
                            style={{
                              textAlign: "left",
                              padding: "14px 16px",
                              fontSize: 11,
                              fontWeight: 900,
                              color: "#5a7391",
                              textTransform: "uppercase",
                              letterSpacing: 0.55,
                              borderBottom: "1px solid #e6f1ff",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyInsights.map(({ week, summary, statusSummary }, index) => {
                        const rowKey = `${week?.month || currentMonthName || "month"}-${week?.week || index}`;
                        const isOpen = !!expandedMonthlyWeeks?.[rowKey];
                        const dailyPlans = Array.isArray(week?.weekDays) ? week.weekDays : [];
                        const focusText = normalizeText(week?.objective) || normalizeText(week?.topic) || uniqJoin(dailyPlans.map((day) => day?.topic)) || "Weekly lesson focus not filled";
                        const submissionText = `${statusSummary.submitted} submitted / ${statusSummary.pending} pending / ${statusSummary.missed} missed`;

                        return (
                          <React.Fragment key={rowKey}>
                            <tr style={{ borderBottom: isOpen ? "none" : "1px solid #eef5ff", background: index % 2 === 0 ? "#ffffff" : "#fbfdff" }}>
                              <td style={{ padding: "16px", verticalAlign: "top" }}>
                                <div style={{ fontSize: 13, fontWeight: 900, color: "var(--text-primary)" }}>{getWeekLabel(week)}</div>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>{currentMonthName || week?.month || "Current month"}</div>
                              </td>
                              <td style={{ padding: "16px", verticalAlign: "top" }}>
                                <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700, lineHeight: 1.55 }}>{focusText}</div>
                              </td>
                              <td style={{ padding: "16px", verticalAlign: "top" }}>
                                <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{summary.responseCount ? summary.averageRating.toFixed(1) : "0.0"}</div>
                                <div style={{ fontSize: 11, color: "#5b7390", marginTop: 4 }}>out of 5.0</div>
                              </td>
                              <td style={{ padding: "16px", verticalAlign: "top" }}>
                                <div style={{ fontSize: 13, fontWeight: 900, color: "#005bc2" }}>{summary.responseCount}</div>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>student response(s)</div>
                              </td>
                              <td style={{ padding: "16px", verticalAlign: "top" }}>
                                <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700, lineHeight: 1.6 }}>{submissionText}</div>
                              </td>
                              <td style={{ padding: "16px", verticalAlign: "top" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#005bc2", fontSize: 11, fontWeight: 900 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: 999, background: UNDERSTANDING_META[summary.dominantUnderstandingKey]?.color || "#007afb" }} />
                                  {summary.dominantUnderstandingLabel}
                                </div>
                              </td>
                              <td style={{ padding: "16px", verticalAlign: "top" }}>
                                <button
                                  type="button"
                                  onClick={() => toggleMonthlyWeek(rowKey)}
                                  style={{
                                    border: "1px solid #d6e9ff",
                                    background: isOpen ? "#0c2340" : "#ffffff",
                                    color: isOpen ? "#ffffff" : "#24568f",
                                    borderRadius: 999,
                                    padding: "8px 12px",
                                    fontSize: 11,
                                    fontWeight: 900,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {isOpen ? "Hide details" : "Show daily details"}
                                </button>
                              </td>
                            </tr>

                            {isOpen ? (
                              <tr style={{ background: "#f8fbff" }}>
                                <td colSpan={7} style={{ padding: "0 16px 18px 16px", borderBottom: "1px solid #eef5ff" }}>
                                  <div style={{ borderRadius: 16, border: "1px solid #dcecff", background: "#ffffff", overflow: "hidden", marginTop: 2 }}>
                                    <div style={{ padding: "12px 14px", borderBottom: "1px solid #eaf2ff", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                      <div style={{ fontSize: 13, fontWeight: 900, color: "var(--text-primary)" }}>Daily lesson plan details</div>
                                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{dailyPlans.length} lesson day(s)</div>
                                    </div>

                                    {!dailyPlans.length ? (
                                      <div style={{ padding: 16, fontSize: 12, color: "var(--text-secondary)" }}>No daily lesson plan details recorded for this week.</div>
                                    ) : (
                                      <div style={{ overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
                                          <thead>
                                            <tr style={{ background: "#fbfdff" }}>
                                              {[
                                                "Date",
                                                "Topic",
                                                "Method",
                                                "Assessment",
                                                "Aids / Notes",
                                                "Status",
                                                "Rating",
                                              ].map((heading) => (
                                                <th
                                                  key={heading}
                                                  style={{
                                                    textAlign: "left",
                                                    padding: "12px 14px",
                                                    fontSize: 10,
                                                    fontWeight: 900,
                                                    color: "#5a7391",
                                                    textTransform: "uppercase",
                                                    letterSpacing: 0.5,
                                                    borderBottom: "1px solid #edf4ff",
                                                  }}
                                                >
                                                  {heading}
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {dailyPlans.map((day, dayIndex) => {
                                              const dayStatus = getDayStatus?.(week?.courseId, week?.week, day) || { status: "pending", statusLabel: "Pending" };
                                              const dayFeedback = day?.feedback || null;
                                              const statusBackground = dayStatus.status === "submitted" ? "#effcf5" : dayStatus.status === "missed" ? "#fff6f6" : "#f4f8fc";
                                              const statusColor = dayStatus.status === "submitted" ? "#0b8f55" : dayStatus.status === "missed" ? "#b54848" : "#7088a5";

                                              return (
                                                <tr key={`${rowKey}-${day?.date || dayIndex}`} style={{ borderBottom: dayIndex === dailyPlans.length - 1 ? "none" : "1px solid #f0f5fd" }}>
                                                  <td style={{ padding: "14px", fontSize: 12, color: "var(--text-primary)", verticalAlign: "top", whiteSpace: "nowrap" }}>{normalizeText(day?.date) || "No date"}</td>
                                                  <td style={{ padding: "14px", fontSize: 12, color: "var(--text-primary)", verticalAlign: "top", fontWeight: 700 }}>{normalizeText(day?.topic) || "No topic recorded"}</td>
                                                  <td style={{ padding: "14px", fontSize: 12, color: "var(--text-secondary)", verticalAlign: "top" }}>{normalizeText(day?.method) || "Not recorded"}</td>
                                                  <td style={{ padding: "14px", fontSize: 12, color: "var(--text-secondary)", verticalAlign: "top" }}>{normalizeText(day?.assessment) || "Not recorded"}</td>
                                                  <td style={{ padding: "14px", fontSize: 12, color: "var(--text-secondary)", verticalAlign: "top" }}>{normalizeText(day?.aids) || normalizeText(day?.note) || "No supporting notes"}</td>
                                                  <td style={{ padding: "14px", verticalAlign: "top" }}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", padding: "7px 11px", borderRadius: 999, background: statusBackground, color: statusColor, fontSize: 11, fontWeight: 900 }}>
                                                      {dayStatus.statusLabel || dayStatus.status}
                                                    </span>
                                                  </td>
                                                  <td style={{ padding: "14px", verticalAlign: "top" }}>
                                                    <div style={{ fontSize: 12, fontWeight: 900, color: "#005bc2" }}>
                                                      {dayFeedback?.responseCount ? `${dayFeedback.averageRating.toFixed(1)} / 5` : "No feedback"}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                                                      {dayFeedback?.responseCount ? `${dayFeedback.responseCount} response(s)` : "Waiting for students"}
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {!planLoading && !!annualWeeks?.length && viewMode === "daily" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <FeedbackPanel
                title="Daily delivery board"
                summary={mergeFeedbackSummaries((visibleDailyPlans || []).map((day) => day?.feedback))}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "var(--text-primary)" }}>Daily topic rating graph</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Bar or line comparison</div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {[
                    { id: "bar", label: "Bar" },
                    { id: "line", label: "Line" },
                  ].map((option) => {
                    const active = dailyChartType === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setDailyChartType(option.id)}
                        style={{
                          border: active ? "1px solid #007afb" : "1px solid #d6e9ff",
                          background: active ? "#007afb" : "#ffffff",
                          color: active ? "#ffffff" : "#24568f",
                          borderRadius: 999,
                          padding: "7px 12px",
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <TopicRatingChart
                data={dailyRatingSeries}
                chartType={dailyChartType}
                title="Topic rating graph"
                emptyMessage="Rating graph will appear after daily lessons receive student feedback."
              />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
                {(visibleDailyPlans || []).map((day, index) => {
                  const statusMeta = getDayStatus?.(day?.courseId, day?.week, day) || { status: "pending", statusLabel: "Pending" };
                  const feedback = day?.feedback;
                  const statusColor = statusMeta.status === "submitted" ? "#0b8f55" : statusMeta.status === "missed" ? "#b54848" : "#8aa0bb";
                  const statusBackground = statusMeta.status === "submitted" ? "#effcf5" : statusMeta.status === "missed" ? "#fff6f6" : "#f4f8fc";
                  const topic = normalizeText(day?.topic) || "No topic recorded";

                  return (
                    <div key={`${day?.date || index}-${topic}`} style={{ borderRadius: 20, border: "1px solid #dcecff", background: "#ffffff", boxShadow: "var(--shadow-soft)", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>{topic}</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{normalizeText(day?.date) || "Date not recorded"}</div>
                        </div>
                        <div style={{ padding: "8px 12px", borderRadius: 999, background: statusBackground, color: statusColor, fontSize: 11, fontWeight: 900 }}>
                          {statusMeta.statusLabel || statusMeta.status}
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                        <div style={{ borderRadius: 14, background: "#f8fbff", border: "1px solid #e6f1ff", padding: 12 }}>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase" }}>Method</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{normalizeText(day?.method) || "Not recorded"}</div>
                        </div>
                        <div style={{ borderRadius: 14, background: "#f8fbff", border: "1px solid #e6f1ff", padding: 12 }}>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase" }}>Assessment</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{normalizeText(day?.assessment) || "Not recorded"}</div>
                        </div>
                      </div>

                      <div style={{ borderRadius: 14, background: "#f8fbff", border: "1px solid #e6f1ff", padding: 12 }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase" }}>Teaching aids and notes</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{normalizeText(day?.aids) || normalizeText(day?.note) || "No supporting notes recorded."}</div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Student feedback</div>
                          <div style={{ fontSize: 11, color: "#005bc2", fontWeight: 900 }}>
                            {feedback?.responseCount ? `${feedback.averageRating.toFixed(1)}★ average` : "Waiting for responses"}
                          </div>
                        </div>
                        <StackedUnderstandingBar summary={feedback || { responseCount: 0, understandingCounts: {} }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default LessonPlanInsightsModal;