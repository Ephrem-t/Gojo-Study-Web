import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCalendarAlt,
  FaCog,
  FaSignOutAlt,
  FaFolderOpen,
} from "react-icons/fa";

function RegisterSidebar({
  user,
  style,
  dimmed = false,
  sticky = false,
  fullHeight = false,
  top = 24,
  onLogout,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const profileName = user?.name || user?.username || "Admin Name";
  const profileId =
    user?.adminId ||
    user?.userId ||
    user?.username ||
    "username";
  const profileImage = user?.profileImage || "/default-profile.png";

  const sidebarLinkBaseStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    marginLeft: 10,
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-secondary)",
    borderRadius: 12,
    background: "var(--surface-muted)",
    border: "1px solid var(--border-soft)",
    textDecoration: "none",
  };

  const sidebarLinkActiveStyle = {
    background: "var(--accent-strong)",
    color: "#ffffff",
    border: "1px solid var(--accent-strong)",
    boxShadow: "var(--shadow-glow)",
  };

  const getSidebarLinkStyle = (path) =>
    currentPath === path
      ? { ...sidebarLinkBaseStyle, ...sidebarLinkActiveStyle }
      : sidebarLinkBaseStyle;

  const rootStyle = {
    width: "clamp(230px, 16vw, 290px)",
    minWidth: 230,
    padding: 14,
    borderRadius: 24,
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-panel)",
    height: "calc(100vh - 24px)",
    overflowY: "auto",
    alignSelf: "flex-start",
    boxSizing: "border-box",
    transition: "opacity 180ms ease, filter 180ms ease",
    ...(sticky
      ? {
          position: "sticky",
          top,
          scrollbarWidth: "thin",
          scrollbarColor: "transparent transparent",
        }
      : null),
    ...(fullHeight ? { height: `calc(100vh - ${top}px)` } : null),
    ...(dimmed
      ? {
          opacity: 0.45,
          filter: "blur(1px)",
          pointerEvents: "none",
        }
      : null),
    ...style,
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }

    localStorage.removeItem("admin");
    localStorage.removeItem("registrar");
    navigate("/login", { replace: true });
  };

  return (
    <div className="google-sidebar" style={rootStyle}>
      <div
        className="sidebar-profile"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "16px 14px",
          marginBottom: 8,
          borderRadius: 18,
          background: "linear-gradient(180deg, var(--surface-accent) 0%, var(--surface-panel) 100%)",
          border: "1px solid var(--border-strong)",
          boxShadow: "inset 0 1px 0 color-mix(in srgb, white 8%, transparent)",
        }}
      >
        <div
          className="sidebar-img-circle"
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            overflow: "hidden",
            border: "3px solid var(--border-strong)",
            boxShadow: "0 10px 20px rgba(15,23,42,0.16)",
          }}
        >
          <img src={profileImage} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            background: "var(--surface-accent)",
            border: "1px solid var(--border-strong)",
            color: "var(--accent)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Acadamic Office
        </div>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--text-primary)", textAlign: "center" }}>{profileName}</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{profileId}</p>
      </div>

      <div className="sidebar-menu" style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
        <Link className="sidebar-btn" to="/dashboard" style={getSidebarLinkStyle("/dashboard")}>
          <FaHome style={{ width: 15, height: 15 }} /> Home
        </Link>

        <Link className="sidebar-btn" to="/my-posts" style={getSidebarLinkStyle("/my-posts")}>
          <FaFileAlt style={{ width: 15, height: 15 }} /> My Posts
        </Link>

        <Link className="sidebar-btn" to="/teachers" style={getSidebarLinkStyle("/teachers")}>
          <FaChalkboardTeacher style={{ width: 15, height: 15 }} /> Teachers
        </Link>

        <Link className="sidebar-btn" to="/students" style={getSidebarLinkStyle("/students")}>
          <FaChalkboardTeacher style={{ width: 15, height: 15 }} /> Students
        </Link>

        <Link className="sidebar-btn" to="/schedule" style={getSidebarLinkStyle("/schedule")}>
          <FaCalendarAlt style={{ width: 15, height: 15 }} /> Schedule
        </Link>

        <Link className="sidebar-btn" to="/assign-teacher" style={getSidebarLinkStyle("/assign-teacher")}>
          <FaFileAlt style={{ width: 15, height: 15 }} /> Assign Teacher
        </Link>

        <Link className="sidebar-btn" to="/parents" style={getSidebarLinkStyle("/parents")}>
          <FaChalkboardTeacher style={{ width: 15, height: 15 }} /> Parents
        </Link>

        <Link className="sidebar-btn" to="/registration-form" style={getSidebarLinkStyle("/registration-form")}>
          <FaFileAlt style={{ width: 15, height: 15 }} /> Registration Form
        </Link>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginLeft: 0,
            padding: "8px",
            borderRadius: 12,
            border: "1px solid var(--border-strong)",
            background: "linear-gradient(135deg, var(--surface-accent) 0%, var(--surface-panel) 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              fontWeight: 800,
              color: "var(--text-primary)",
              padding: "2px 4px",
            }}
          >
            <FaFolderOpen style={{ width: 14, height: 14, color: "var(--accent-strong)" }} />
            Message Group
          </div>

          <Link className="sidebar-btn" to="/all-chat" style={getSidebarLinkStyle("/all-chat")}>
            <FaFileAlt style={{ width: 15, height: 15 }} /> Chat
          </Link>

          <Link className="sidebar-btn" to="/message-control" style={getSidebarLinkStyle("/message-control")}>
            <FaCog style={{ width: 15, height: 15 }} /> Message Control
          </Link>
        </div>

        <Link className="sidebar-btn" to="/settings" style={getSidebarLinkStyle("/settings")}>
          <FaCog style={{ width: 15, height: 15 }} /> Settings
        </Link>

        <button
          className="sidebar-btn logout-btn"
          onClick={handleLogout}
          style={{
            ...sidebarLinkBaseStyle,
            marginLeft: 0,
            justifyContent: "center",
            color: "var(--danger)",
            background: "var(--danger-soft)",
            border: "1px solid var(--danger-border)",
            cursor: "pointer",
          }}
        >
          <FaSignOutAlt style={{ width: 15, height: 15 }} /> Logout
        </button>
      </div>
    </div>
  );
}

export default RegisterSidebar;