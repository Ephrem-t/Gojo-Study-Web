import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();

  const cardStyle = {
    display: "block",
    textDecoration: "none",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 18,
    color: "#0f172a",
    boxShadow: "0 6px 16px rgba(15,23,42,0.06)",
  };

  return (
    <div className="auth-container">
      <div className="auth-box" style={{ maxWidth: 820 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            style={{ background: "none", border: "none", color: "black", cursor: "pointer", fontSize: 20, width: 10 }}
          >
            ←
          </button>
          <h2 style={{ margin: 0 }}>School Registration Portal</h2>
        </div>

        <p style={{ marginTop: 0, color: "#475569" }}>
          Choose what you want to register.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 12,
            marginTop: 10,
          }}
        >
          <Link to="/registerer-register" style={cardStyle}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Registerer Account</div>
            <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>Create login account for register portal (GSR_... username).</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
