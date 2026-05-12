import React from "react";

export default function ExamsPage() {
  const admin = (() => {
    try {
      return JSON.parse(localStorage.getItem("admin") || "{}") || {};
    } catch (error) {
      return {};
    }
  })();

  return (
    <div className="dashboard-page" style={{ background: "var(--page-bg)", minHeight: "100vh", height: "100vh", overflow: "hidden", color: "var(--text-primary)" }}>
      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "4px 14px", height: "calc(100vh - 73px)", overflow: "hidden", background: "var(--page-bg)", width: "100%", boxSizing: "border-box" }}>
        <div
          className="admin-sidebar-spacer"
          style={{
            width: "var(--sidebar-width)",
            minWidth: "var(--sidebar-width)",
            flex: "0 0 var(--sidebar-width)",
            pointerEvents: "none",
          }}
        />
        <div className="main-content" style={{ padding: "0 20px 20px", flex: 1, minWidth: 0, boxSizing: "border-box", height: "100%", overflowY: "auto", overflowX: "hidden" }}>
          <div className="main-inner" style={{ marginLeft: 0, marginTop: 0 }}>
            <div className="section-header-card" style={{ width: "min(760px, 100%)", margin: "0 auto 14px", padding: "14px 16px", borderRadius: 16, background: "var(--surface-panel)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-soft)" }}>
              <h2 className="section-header-card__title" style={{ fontSize: "20px", margin: 0 }}>Exams</h2>
              <div className="section-header-card__subtitle" style={{ marginTop: 8, color: "var(--text-secondary)", fontSize: 13 }}>
                Configure exam periods, categories, and exam plans.
              </div>
            </div>
            <div style={{ width: "min(760px, 100%)", margin: "0 auto", borderRadius: 14, padding: "16px", background: "var(--surface-panel)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-soft)", color: "var(--text-secondary)", fontSize: 13 }}>
              Build your exams workflows here.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
