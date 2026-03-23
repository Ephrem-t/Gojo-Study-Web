import React from "react";

export default function TeacherTopbar({
  title = "Gojo Teacher Portal",
  children,
  style,
}) {
  return (
    <nav
      className="top-navbar"
      style={{
        borderBottom: "1px solid #e2e8f0",
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(10px)",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 0,
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#0f172a",
            fontWeight: 800,
            letterSpacing: "0.2px",
          }}
        >
          {title}
        </h2>
      </div>

      <div className="nav-right">{children}</div>
    </nav>
  );
}
