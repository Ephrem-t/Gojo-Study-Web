import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { FaCalendarDay, FaFileExcel, FaFilePdf, FaTimes, FaTrash } from "react-icons/fa";

const emptyDraft = (dateValue = "") => ({
  date: dateValue,
  dayName: "",
  topic: "",
  method: "",
  aids: "",
  assessment: "",
  note: "",
});

const serializeDailyDraft = (draft = {}) =>
  JSON.stringify({
    date: String(draft.date || ""),
    dayName: String(draft.dayName || ""),
    topic: String(draft.topic || ""),
    method: String(draft.method || ""),
    aids: String(draft.aids || ""),
    assessment: String(draft.assessment || ""),
    note: String(draft.note || ""),
  });

const toDayName = (isoDate) => {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { weekday: "long" });
};

const ethiopianMonths = [
  "Meskerem",
  "Tikimt",
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

const getEthiopianFormatter = () => {
  try {
    return new Intl.DateTimeFormat("en-ET-u-ca-ethiopic", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  } catch {
    return null;
  }
};

const ethiopianFormatter = getEthiopianFormatter();
const canUseEthiopianCalendar = Boolean(ethiopianFormatter);

const getEthiopianPartsFromGregorian = (isoDate) => {
  if (!canUseEthiopianCalendar || !isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const parts = ethiopianFormatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value || 0);
  const month = Number(parts.find((part) => part.type === "month")?.value || 0);
  const day = Number(parts.find((part) => part.type === "day")?.value || 0);
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const isEthiopianLeapYear = (year) => year % 4 === 3;

const maxEthiopianDays = (year, month) => {
  if (month >= 1 && month <= 12) return 30;
  if (month === 13) return isEthiopianLeapYear(year) ? 6 : 5;
  return 30;
};

const toGregorianIsoFromEthiopian = ({ year, month, day }) => {
  if (!canUseEthiopianCalendar || !year || !month || !day) return "";
  const start = new Date(Date.UTC(year + 7, 7, 25));

  for (let offset = 0; offset < 460; offset += 1) {
    const probe = new Date(start);
    probe.setUTCDate(start.getUTCDate() + offset);
    const probeIso = probe.toISOString().slice(0, 10);
    const probeEth = getEthiopianPartsFromGregorian(probeIso);
    if (!probeEth) continue;
    if (probeEth.year === year && probeEth.month === month && probeEth.day === day) {
      return probeIso;
    }
  }

  return "";
};

const DailyLogsPanel = React.forwardRef(function DailyLogsPanel({
  open,
  week,
  logs,
  loading,
  saving,
  autoSaveEnabled,
  autoSaveDelayMs,
  onClose,
  onSave,
  onSubmitDay,
  onDeleteDay,
  defaultDate,
  onDirtyCountChange,
  onSaveMetaChange,
  onExportExcel,
  onExportPdf,
}, ref) {
  const [draft, setDraft] = useState(emptyDraft(defaultDate));
  const [ethiopianDate, setEthiopianDate] = useState(() => getEthiopianPartsFromGregorian(defaultDate) || {
    year: "",
    month: "",
    day: "",
  });
  const [savedDraftSignature, setSavedDraftSignature] = useState(() => serializeDailyDraft(emptyDraft(defaultDate)));
  const [localSaveState, setLocalSaveState] = useState("idle");
  const [localSaveError, setLocalSaveError] = useState("");
  const [localLastSavedAt, setLocalLastSavedAt] = useState(null);
  const draftRef = useRef(emptyDraft(defaultDate));
  const autoSaveTimerRef = useRef(null);

  const weekTitle = useMemo(() => {
    if (!week) return "";
    return `${week.monthId} - ${week.weekId}`;
  }, [week]);

  useEffect(() => {
    setDraft(emptyDraft(defaultDate));
    setEthiopianDate(getEthiopianPartsFromGregorian(defaultDate) || {
      year: "",
      month: "",
      day: "",
    });
    setSavedDraftSignature(serializeDailyDraft(emptyDraft(defaultDate)));
    setLocalSaveState("idle");
    setLocalSaveError("");
    setLocalLastSavedAt(null);
  }, [week?.id, defaultDate]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const normalizedDraft = useMemo(() => ({
    date: String(draft.date || ""),
    dayName: String(draft.dayName || toDayName(draft.date) || ""),
    topic: String(draft.topic || ""),
    method: String(draft.method || ""),
    aids: String(draft.aids || ""),
    assessment: String(draft.assessment || ""),
    note: String(draft.note || ""),
  }), [draft]);

  const hasMeaningfulDraftContent = useMemo(() => {
    return Boolean(
      String(normalizedDraft.topic || "").trim() ||
      String(normalizedDraft.method || "").trim() ||
      String(normalizedDraft.aids || "").trim() ||
      String(normalizedDraft.assessment || "").trim() ||
      String(normalizedDraft.note || "").trim() ||
      (String(normalizedDraft.dayName || "").trim() && String(normalizedDraft.dayName || "").trim() !== toDayName(normalizedDraft.date))
    );
  }, [normalizedDraft]);

  const draftIsDirty = hasMeaningfulDraftContent && serializeDailyDraft(normalizedDraft) !== savedDraftSignature;
  const draftCanPersist = Boolean(normalizedDraft.date) && hasMeaningfulDraftContent;

  useEffect(() => {
    onDirtyCountChange?.(draftIsDirty ? 1 : 0);
  }, [draftIsDirty, onDirtyCountChange]);

  useEffect(() => {
    onSaveMetaChange?.({
      status: localSaveState,
      error: localSaveError,
      lastSavedAt: localLastSavedAt,
    });
  }, [localSaveState, localSaveError, localLastSavedAt, onSaveMetaChange]);

  const persistDraft = async () => {
    if (!draftCanPersist) return false;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const nextDraft = {
      ...draftRef.current,
      dayName: draftRef.current.dayName || toDayName(draftRef.current.date),
    };

    setLocalSaveState("saving");
    setLocalSaveError("");

    try {
      await onSave(nextDraft);
      setSavedDraftSignature(serializeDailyDraft(nextDraft));
      setLocalLastSavedAt(Date.now());
      setLocalSaveState("saved");
      return true;
    } catch (error) {
      console.error("Failed to save daily lesson draft:", error);
      setLocalSaveState("error");
      setLocalSaveError("Daily lesson auto-save failed. Your changes are still pending.");
      return false;
    }
  };

  const flushPending = async () => {
    if (!draftIsDirty) return true;

    if (!autoSaveEnabled) {
      const shouldDiscard = window.confirm("You have unsaved daily lesson changes. Continue without saving them?");
      if (!shouldDiscard) return false;
      const resetDraft = emptyDraft(defaultDate);
      setDraft(resetDraft);
      setSavedDraftSignature(serializeDailyDraft(resetDraft));
      setEthiopianDate(getEthiopianPartsFromGregorian(defaultDate) || {
        year: "",
        month: "",
        day: "",
      });
      setLocalSaveState("idle");
      setLocalSaveError("");
      return true;
    }

    if (!draftCanPersist) {
      const shouldDiscard = window.confirm("This daily lesson draft cannot be auto-saved yet. Continue and discard it?");
      if (!shouldDiscard) return false;
      const resetDraft = emptyDraft(defaultDate);
      setDraft(resetDraft);
      setSavedDraftSignature(serializeDailyDraft(resetDraft));
      setEthiopianDate(getEthiopianPartsFromGregorian(defaultDate) || {
        year: "",
        month: "",
        day: "",
      });
      setLocalSaveState("idle");
      setLocalSaveError("");
      return true;
    }

    return persistDraft();
  };

  useImperativeHandle(ref, () => ({
    flushPending,
  }));

  useEffect(() => {
    if (!autoSaveEnabled && localSaveState === "pending") {
      setLocalSaveState(draftIsDirty ? "idle" : "saved");
    }
  }, [autoSaveEnabled, localSaveState, draftIsDirty]);

  useEffect(() => {
    if (!autoSaveEnabled) return undefined;
    if (!draftIsDirty || !draftCanPersist) return undefined;

    setLocalSaveState("pending");
    setLocalSaveError("");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void persistDraft();
    }, autoSaveDelayMs);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [autoSaveEnabled, autoSaveDelayMs, draftIsDirty, draftCanPersist, normalizedDraft]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const handleCloseRequest = async () => {
    const didClose = await flushPending();
    if (didClose) onClose();
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const submittedSet = useMemo(() => new Set(Array.isArray(week?.submittedDays) ? week.submittedDays : []), [week?.submittedDays]);
  const currentEth = getEthiopianPartsFromGregorian(todayIso);
  const yearOptions = useMemo(() => {
    if (!currentEth?.year) return [];
    return Array.from({ length: 8 }, (_, index) => currentEth.year - 3 + index);
  }, [currentEth?.year]);

  const onEthiopianDateChange = (patch) => {
    const next = {
      year: Number(ethiopianDate.year || 0),
      month: Number(ethiopianDate.month || 0),
      day: Number(ethiopianDate.day || 0),
      ...patch,
    };

    const dayMax = maxEthiopianDays(next.year || 0, next.month || 0);
    if (next.day > dayMax) {
      next.day = dayMax;
    }

    setEthiopianDate(next);

    if (next.year && next.month && next.day) {
      const iso = toGregorianIsoFromEthiopian(next);
      setDraft((prev) => ({ ...prev, date: iso, dayName: toDayName(iso) }));
    } else {
      setDraft((prev) => ({ ...prev, date: "", dayName: "" }));
    }
  };

  const statusForDate = (isoDate) => {
    const safe = String(isoDate || "").slice(0, 10);
    if (!safe) return "pending";
    if (submittedSet.has(safe)) return "submitted";
    if (safe < todayIso) return "missed";
    return "pending";
  };

  if (!open || !week) return null;

  return (
    <div className="lp-panel-overlay" role="dialog" aria-modal="true">
      <div className="lp-panel">
        <header className="lp-panel-header">
          <div>
            <h3>Daily Lessons</h3>
            <p>{weekTitle}</p>
            <div className="lp-panel-week-meta">
              {week?.topic ? <span>Topic: {week.topic}</span> : null}
              {week?.objective ? <span>Objective: {week.objective}</span> : null}
              <span>Expected Days: {week?.expectedDays || 0}</span>
              <span>Submitted: {week?.submittedCount || 0}</span>
            </div>
            <div className="lp-panel-export-actions">
              <button className="lp-btn ghost" onClick={onExportExcel} disabled={!logs.length}>
                <FaFileExcel /> Daily Excel
              </button>
              <button className="lp-btn ghost" onClick={onExportPdf} disabled={!logs.length}>
                <FaFilePdf /> Daily PDF
              </button>
            </div>
          </div>
          <button className="lp-icon-btn" onClick={() => {
            void handleCloseRequest();
          }}>
            <FaTimes />
          </button>
        </header>

        <div className="lp-panel-content">
          <section className="lp-mini-table">
            <div className="lp-mini-table-head">
              <strong>Timeline</strong>
              <span>{logs.length} log(s)</span>
            </div>
            {loading ? (
              <div className="lp-empty compact">Loading logs...</div>
            ) : logs.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Topic</th>
                    <th>Method</th>
                    <th>Assessment</th>
                    <th>Status</th>
                    <th>Submit</th>
                    <th>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((item) => {
                    const status = statusForDate(item.date);
                    return (
                    <tr key={item.date}>
                      <td>{item.date}</td>
                      <td>{item.dayName || "-"}</td>
                      <td>{item.topic || "-"}</td>
                      <td>{item.method || "-"}</td>
                      <td>{item.assessment || "-"}</td>
                      <td>
                        <span className={`lp-status-badge ${status}`}>
                          {status === "submitted" ? "Submiited" : status === "missed" ? "Missed" : "Pending"}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`lp-btn ${status === "pending" ? "primary" : "disabled"}`}
                          disabled={status !== "pending" || saving}
                          onClick={() => onSubmitDay?.(item.date)}
                        >
                          Submit
                        </button>
                      </td>
                      <td>
                        <button
                          className="lp-btn subtle"
                          disabled={saving}
                          onClick={() => onDeleteDay?.(item.date)}
                          title="Delete this day"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            ) : (
              <div className="lp-empty compact">
                No daily logs yet. Add today or any future date from the form.
              </div>
            )}
          </section>

          <section className="lp-form-card">
            <div className="lp-mini-table-head">
              <strong>Add or Edit Daily Log</strong>
              <button
                className="lp-btn ghost"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setDraft(emptyDraft(today));
                  setEthiopianDate(getEthiopianPartsFromGregorian(today) || {
                    year: "",
                    month: "",
                    day: "",
                  });
                }}
                disabled={saving}
              >
                <FaCalendarDay /> Add Today's Lesson
              </button>
            </div>

            <div className="lp-form-grid">
              <label>
                Date (Ethiopian Calendar)
                {canUseEthiopianCalendar ? (
                  <>
                    <div className="lp-ethiopian-date-grid">
                      <select
                        value={ethiopianDate.year || ""}
                        onChange={(event) => onEthiopianDateChange({ year: Number(event.target.value || 0) })}
                      >
                        <option value="">Year</option>
                        {yearOptions.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>

                      <select
                        value={ethiopianDate.month || ""}
                        onChange={(event) => onEthiopianDateChange({ month: Number(event.target.value || 0) })}
                      >
                        <option value="">Month</option>
                        {ethiopianMonths.map((name, index) => (
                          <option key={name} value={index + 1}>{name}</option>
                        ))}
                      </select>

                      <select
                        value={ethiopianDate.day || ""}
                        onChange={(event) => onEthiopianDateChange({ day: Number(event.target.value || 0) })}
                      >
                        <option value="">Day</option>
                        {Array.from(
                          {
                            length: maxEthiopianDays(
                              Number(ethiopianDate.year || 0),
                              Number(ethiopianDate.month || 0)
                            ),
                          },
                          (_, index) => index + 1
                        ).map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>
                    <small className="lp-calendar-hint">Gregorian Save Date: {draft.date || "-"}</small>
                  </>
                ) : (
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(event) => {
                      const nextDate = event.target.value;
                      setDraft((prev) => ({ ...prev, date: nextDate, dayName: toDayName(nextDate) }));
                    }}
                  />
                )}
              </label>
              <label>
                Day Name
                <input
                  type="text"
                  value={draft.dayName}
                  onChange={(event) => setDraft((prev) => ({ ...prev, dayName: event.target.value }))}
                  placeholder="Monday"
                />
              </label>
              <label>
                Topic
                <input
                  type="text"
                  value={draft.topic}
                  onChange={(event) => setDraft((prev) => ({ ...prev, topic: event.target.value }))}
                />
              </label>
              <label>
                Method
                <input
                  type="text"
                  value={draft.method}
                  onChange={(event) => setDraft((prev) => ({ ...prev, method: event.target.value }))}
                />
              </label>
              <label>
                Aids
                <input
                  type="text"
                  value={draft.aids}
                  onChange={(event) => setDraft((prev) => ({ ...prev, aids: event.target.value }))}
                />
              </label>
              <label>
                Assessment
                <input
                  type="text"
                  value={draft.assessment}
                  onChange={(event) => setDraft((prev) => ({ ...prev, assessment: event.target.value }))}
                />
              </label>
              <label className="full">
                Note
                <textarea
                  rows={3}
                  value={draft.note}
                  onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder="Short reflection, gaps, next class actions..."
                />
              </label>
            </div>

            <div className="lp-panel-actions">
              <button className="lp-btn subtle" onClick={() => {
                void handleCloseRequest();
              }} disabled={saving}>Cancel</button>
              <button
                className="lp-btn primary"
                disabled={!draft.date || !hasMeaningfulDraftContent || saving}
                onClick={() => {
                  void persistDraft();
                }}
              >
                Save Daily Log
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
});

export default DailyLogsPanel;
