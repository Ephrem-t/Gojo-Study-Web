import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { FaEdit, FaPlus, FaSave, FaTrash } from "react-icons/fa";

const fieldLabels = [
  ["objective", "Objective"],
  ["topic", "Topic"],
  ["method", "Method"],
  ["material", "Material"],
  ["assessment", "Assessment"],
  ["expectedDays", "Expected Days"],
];

const longTextFields = ["objective", "topic", "method", "material", "assessment"];

const buildDraftFromRow = (row = {}) => ({
  objective: String(row.objective || ""),
  topic: String(row.topic || ""),
  method: String(row.method || ""),
  material: String(row.material || ""),
  assessment: String(row.assessment || ""),
  expectedDays: Number(row.expectedDays || 0),
});

const serializeDraft = (draft = {}) =>
  JSON.stringify({
    objective: String(draft.objective || ""),
    topic: String(draft.topic || ""),
    method: String(draft.method || ""),
    material: String(draft.material || ""),
    assessment: String(draft.assessment || ""),
    expectedDays: Number(draft.expectedDays || 0),
  });

const haveSameKeys = (left = {}, right = {}) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Boolean(right[key]));
};

const LessonPlanTable = React.forwardRef(function LessonPlanTable({
  rows,
  loading,
  saving,
  autoSaveEnabled,
  autoSaveDelayMs,
  onSaveRow,
  onSaveRows,
  onQuickAddToday,
  onCompleteWeek,
  onDeleteWeek,
  onDirtyCountChange,
  onSaveMetaChange,
}, ref) {
  const [rowEdits, setRowEdits] = useState({});
  const [expandedRowId, setExpandedRowId] = useState("");
  const [dirtyRowIds, setDirtyRowIds] = useState({});
  const [localSaveState, setLocalSaveState] = useState("idle");
  const [localSaveError, setLocalSaveError] = useState("");
  const [localLastSavedAt, setLocalLastSavedAt] = useState(null);
  const autoSaveTimerRef = useRef(null);
  const rowEditsRef = useRef({});
  const dirtyRowIdsRef = useRef({});

  useEffect(() => {
    rowEditsRef.current = rowEdits;
  }, [rowEdits]);

  useEffect(() => {
    dirtyRowIdsRef.current = dirtyRowIds;
  }, [dirtyRowIds]);

  useEffect(() => {
    setRowEdits((previousEdits) => {
      const nextEdits = {};
      let hasChanges = Object.keys(previousEdits).length !== rows.length;

      rows.forEach((row) => {
        const baseDraft = buildDraftFromRow(row);
        const previousDraft = previousEdits[row.id];
        const baseSignature = serializeDraft(baseDraft);
        const previousSignature = previousDraft ? serializeDraft(previousDraft) : "";

        if (Boolean(dirtyRowIdsRef.current[row.id]) && previousDraft) {
          nextEdits[row.id] = previousDraft;
          return;
        }

        if (previousDraft && previousSignature === baseSignature) {
          nextEdits[row.id] = previousDraft;
          return;
        }

        nextEdits[row.id] = baseDraft;
        if (!previousDraft || previousSignature !== baseSignature) {
          hasChanges = true;
        }
      });

      return hasChanges ? nextEdits : previousEdits;
    });

    setDirtyRowIds((previousDirtyRows) => {
      const nextDirtyRows = {};

      rows.forEach((row) => {
        const previousDraft = rowEditsRef.current[row.id];
        if (!previousDraft) return;

        if (serializeDraft(previousDraft) !== serializeDraft(buildDraftFromRow(row))) {
          nextDirtyRows[row.id] = true;
        }
      });

      return haveSameKeys(previousDirtyRows, nextDirtyRows) ? previousDirtyRows : nextDirtyRows;
    });
  }, [rows]);

  useEffect(() => {
    onDirtyCountChange?.(Object.keys(dirtyRowIds).length);
  }, [dirtyRowIds, onDirtyCountChange]);

  useEffect(() => {
    onSaveMetaChange?.({
      status: localSaveState,
      error: localSaveError,
      lastSavedAt: localLastSavedAt,
    });
  }, [localSaveState, localSaveError, localLastSavedAt, onSaveMetaChange]);

  const groupedRows = useMemo(() => {
    const map = {};
    rows.forEach((row) => {
      if (!map[row.monthId]) map[row.monthId] = [];
      map[row.monthId].push({ ...row, formState: { ...row } });
    });
    return map;
  }, [rows]);

  const persistRows = async (rowIds = [], options = {}) => {
    const { discardInManualMode = false } = options;
    const normalizedRowIds = [...new Set((rowIds || []).map((rowId) => String(rowId || "").trim()).filter(Boolean))];
    if (!normalizedRowIds.length) return true;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (!autoSaveEnabled && discardInManualMode) {
      const shouldDiscard = window.confirm("You have unsaved annual plan changes. Continue without saving them?");
      if (!shouldDiscard) return false;
      setDirtyRowIds({});
      setLocalSaveState("idle");
      setLocalSaveError("");
      return true;
    }

    const entries = normalizedRowIds
      .map((rowId) => {
        const targetRow = rows.find((row) => row.id === rowId);
        if (!targetRow) return null;

        return {
          rowId,
          monthId: targetRow.monthId,
          weekId: targetRow.weekId,
          payload: buildDraftFromRow(rowEditsRef.current[rowId] || targetRow),
        };
      })
      .filter(Boolean);

    if (!entries.length) return true;

    setLocalSaveState("saving");
    setLocalSaveError("");

    try {
      if (typeof onSaveRows === "function") {
        await onSaveRows(entries);
      } else {
        await Promise.all(
          entries.map((entry) => onSaveRow?.(entry.rowId, entry.payload))
        );
      }

      setDirtyRowIds((previousDirtyRows) => {
        const nextDirtyRows = { ...(previousDirtyRows || {}) };
        normalizedRowIds.forEach((rowId) => {
          delete nextDirtyRows[rowId];
        });
        return nextDirtyRows;
      });
      setLocalLastSavedAt(Date.now());
      setLocalSaveState("saved");
      return true;
    } catch (error) {
      console.error("Failed to save annual lesson plan rows:", error);
      setLocalSaveState("error");
      setLocalSaveError("Annual plan auto-save failed. Your week changes are still pending.");
      return false;
    }
  };

  useImperativeHandle(ref, () => ({
    flushPending: async () => {
      const pendingRowIds = Object.keys(dirtyRowIdsRef.current || {});
      return persistRows(pendingRowIds, { discardInManualMode: true });
    },
  }));

  useEffect(() => {
    if (!autoSaveEnabled && localSaveState === "pending") {
      setLocalSaveState(Object.keys(dirtyRowIds).length ? "idle" : "saved");
    }
  }, [autoSaveEnabled, localSaveState, dirtyRowIds]);

  useEffect(() => {
    if (!autoSaveEnabled) return undefined;

    const pendingRowIds = Object.keys(dirtyRowIds || {});
    if (!pendingRowIds.length) return undefined;

    setLocalSaveState("pending");
    setLocalSaveError("");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void persistRows(pendingRowIds);
    }, autoSaveDelayMs);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [autoSaveEnabled, autoSaveDelayMs, dirtyRowIds, rows]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  if (loading) {
    return <div className="lp-empty">Loading lesson plans...</div>;
  }

  if (!rows.length) {
    return (
      <div className="lp-empty">
        <h3>No lesson plans yet</h3>
        <p>Create weekly plans under the selected semester to populate this table.</p>
      </div>
    );
  }

  return (
    <div className="lp-table-shell">
      {Object.entries(groupedRows).map(([monthId, monthRows]) => (
        <section key={monthId} className="lp-month-section">
          <header className="lp-month-header">
            <span className="lp-month-kicker">Annual Plan</span>
            <span className="lp-month-title">{monthId}</span>
          </header>
          <div className="lp-table-wrap">
            <table className="lp-table">
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Objective</th>
                  <th>Topic</th>
                  <th>Method</th>
                  <th>Material</th>
                  <th>Assessment</th>
                  <th>Expected Days</th>
                  <th>Progress</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((row) => {
                  const canComplete = row.expectedDays > 0 && row.submittedCount >= row.expectedDays;
                  const rowClass = canComplete ? "is-row-complete" : "is-row-pending";
                  const draft = rowEdits[row.id] || buildDraftFromRow(row);

                  const updateDraftField = (field, value) => {
                    const nextDraft = {
                      ...(rowEditsRef.current[row.id] || buildDraftFromRow(row)),
                      [field]: field === "expectedDays" ? Number(value || 0) : value,
                    };

                    const nextIsDirty = serializeDraft(nextDraft) !== serializeDraft(buildDraftFromRow(row));

                    setRowEdits((previousEdits) => ({
                      ...previousEdits,
                      [row.id]: nextDraft,
                    }));
                    setDirtyRowIds((previousDirtyRows) => {
                      const nextDirtyRows = { ...(previousDirtyRows || {}) };
                      if (nextIsDirty) nextDirtyRows[row.id] = true;
                      else delete nextDirtyRows[row.id];
                      return nextDirtyRows;
                    });
                    setLocalSaveState(autoSaveEnabled ? "pending" : "idle");
                    setLocalSaveError("");
                  };

                  return (
                    <React.Fragment key={row.id}>
                      <tr className={rowClass}>
                        <td>
                          <strong>{row.weekId}</strong>
                        </td>
                        {fieldLabels.map(([field]) => (
                          <td key={field}>
                            {field === "expectedDays" ? (
                              <input
                                className="lp-input"
                                value={draft[field] ?? 0}
                                type="number"
                                min={0}
                                onChange={(event) => {
                                  updateDraftField(field, Number(event.target.value || 0));
                                }}
                              />
                            ) : longTextFields.includes(field) ? (
                              <textarea
                                className="lp-input"
                                rows={2}
                                style={{ fontSize: "13px", lineHeight: "1.35" }}
                                value={draft[field] ?? ""}
                                onChange={(event) => {
                                  updateDraftField(field, event.target.value);
                                }}
                              />
                            ) : (
                              <div className="lp-cell-preview" title={draft[field] || ""}>{draft[field] || "-"}</div>
                            )}
                          </td>
                        ))}
                        <td>
                          <ProgressPill
                            submittedCount={row.submittedCount}
                            expectedDays={row.expectedDays}
                            progressPercent={row.progressPercent}
                          />
                        </td>
                        <td>
                          <div className="lp-actions">
                            <button
                              className="lp-btn primary"
                              onClick={() => {
                                void persistRows([row.id]);
                              }}
                              disabled={saving}
                              title="Save this annual plan row"
                            >
                              <FaSave /> Save
                            </button>
                            <button
                              className="lp-btn ghost"
                              onClick={() => setExpandedRowId((prev) => (prev === row.id ? "" : row.id))}
                              disabled={saving}
                              title="Open full editor"
                            >
                              <FaEdit /> Details
                            </button>
                            <button
                              className="lp-btn ghost"
                              onClick={() => onQuickAddToday(row)}
                              disabled={saving}
                              title="Add today's lesson quickly"
                            >
                              <FaPlus /> Daily
                            </button>
                            <button
                              className="lp-btn subtle"
                              onClick={() => onDeleteWeek?.(row)}
                              disabled={saving}
                              title="Delete week"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expandedRowId === row.id ? (
                        <tr>
                          <td colSpan={9}>
                            <div className="lp-row-details">
                              {longTextFields.map((field) => (
                                <label key={field} className="lp-row-details-field">
                                  <span>{field.charAt(0).toUpperCase() + field.slice(1)}</span>
                                  <textarea
                                    rows={3}
                                    value={draft[field] ?? ""}
                                    onChange={(event) => {
                                      updateDraftField(field, event.target.value);
                                    }}
                                  />
                                </label>
                              ))}
                              <div className="lp-row-details-actions">
                                <button
                                  className="lp-btn primary"
                                  disabled={saving}
                                  onClick={async () => {
                                    const didSave = await persistRows([row.id]);
                                    if (didSave) setExpandedRowId("");
                                  }}
                                >
                                  Save Details
                                </button>
                              </div>
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
        </section>
      ))}
    </div>
  );
});

function ProgressPill({ submittedCount, expectedDays, progressPercent }) {
  const safeExpected = Math.max(0, Number(expectedDays || 0));
  const toneClass = safeExpected > 0 && submittedCount >= safeExpected ? "is-complete" : "is-incomplete";

  return (
    <div className={`lp-progress-pill ${toneClass}`}>
      <span>{progressPercent}% completed</span>
      <small>{submittedCount}/{safeExpected || 0} days</small>
    </div>
  );
}

export default LessonPlanTable;
