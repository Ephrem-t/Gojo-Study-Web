import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaChartLine,
  FaExchangeAlt,
  FaFolderOpen,
  FaUserGraduate,
  FaChevronDown,
} from "react-icons/fa";
import ProfileAvatar from "./ProfileAvatar";

const SIDEBAR_SECTIONS = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: FaHome,
    links: [
      { label: "Home", path: "/dashboard" },
      { label: "My Posts", path: "/my-posts" },
      { label: "Overview", path: "/overview" },
    ],
  },
  {
    key: "academic",
    label: "Academic",
    icon: FaUserGraduate,
    links: [
      { label: "Academic Year", path: "/academic-years" },
      { label: "Grade Management", path: "/grede-management" },
      { label: "Promotion System", path: "/promotion-system" },
    ],
  },
  {
    key: "student",
    label: "Student",
    icon: FaChalkboardTeacher,
    links: [
      { label: "Student", path: "/students" },
      { label: "Register Student", path: "/student-register" },
      { label: "Student Parent", path: "/parents" },
    ],
  },
  {
    key: "status",
    label: "Student Status",
    icon: FaExchangeAlt,
    links: [{ label: "Transfer & Withdrawal", path: "/transfer-withdrawal" }],
  },
  {
    key: "documents",
    label: "Documents",
    icon: FaFolderOpen,
    links: [{ label: "Document Generation", path: "/document-generation" }],
  },
  {
    key: "reports",
    label: "Reports",
    icon: FaChartLine,
    links: [{ label: "Analytics", path: "/analytics" }],
  },
  {
    key: "system",
    label: "System",
    icon: FaCog,
    links: [{ label: "Settings", path: "/settings" }],
  },
];

const defaultRootStyle = {
  width: "clamp(220px, 15vw, 280px)",
  minWidth: 220,
  padding: 12,
  borderRadius: 16,
  background: "var(--surface-panel)",
  border: "1px solid var(--border-soft)",
  boxShadow: "var(--shadow-panel)",
  height: "fit-content",
  alignSelf: "flex-start",
  boxSizing: "border-box",
  transition: "opacity 180ms ease, filter 180ms ease",
};

const createDefaultSidebarSections = () => ({
  dashboard: false,
  academic: false,
  student: false,
  status: false,
  documents: false,
  reports: false,
  system: false,
});

let registerSidebarSectionsState = createDefaultSidebarSections();

function RegisterSidebar({
  user,
  style,
  dimmed = false,
  sticky = false,
  fullHeight = false,
  top = 24,
  badgeLabel = "Register Office",
  onLogout,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [sidebarSections, setSidebarSections] = useState(() => ({ ...registerSidebarSectionsState }));

  const profileName = user?.name || user?.username || "Register Office";
  const profileId =
    user?.registrarId ||
    user?.registererId ||
    user?.employeeId ||
    user?.adminId ||
    user?.financeId ||
    user?.userId ||
    user?.username ||
    "username";
  const profileImage = user?.profileImage || "/default-profile.png";

  const rootStyle = {
    ...defaultRootStyle,
    ...(sticky
      ? {
          position: "sticky",
          top,
          overflowY: "auto",
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

  const sidebarSectionStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };
  const sidebarSectionTitleStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 12,
    fontWeight: 800,
    color: "var(--text-primary)",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--border-strong)",
    background: "linear-gradient(135deg, var(--surface-accent) 0%, var(--surface-panel) 100%)",
    cursor: "pointer",
  };
  const sidebarSectionChildrenStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginLeft: 10,
    paddingLeft: 10,
    borderLeft: "2px solid var(--border-strong)",
  };
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
  };
  const sidebarLinkActiveStyle = {
    background: "var(--accent-strong)",
    color: "#ffffff",
    border: "1px solid var(--accent-strong)",
    boxShadow: "var(--shadow-glow)",
  };

  const isSectionActive = (sectionKey) =>
    SIDEBAR_SECTIONS.find((section) => section.key === sectionKey)?.links.some((link) => link.path === currentPath) || false;

  const getSidebarSectionButtonStyle = (sectionKey) =>
    sidebarSections[sectionKey] || isSectionActive(sectionKey)
      ? {
          ...sidebarSectionTitleStyle,
          background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--surface-accent) 100%)",
          border: isSectionActive(sectionKey) ? "2px solid var(--accent)" : "1px solid var(--border-strong)",
          boxShadow: isSectionActive(sectionKey)
            ? "var(--shadow-glow)"
            : "0 10px 22px rgba(15,23,42,0.08)",
          color: "var(--text-primary)",
        }
      : sidebarSectionTitleStyle;

  const getSidebarLinkStyle = (path) =>
    currentPath === path
      ? { ...sidebarLinkBaseStyle, ...sidebarLinkActiveStyle }
      : sidebarLinkBaseStyle;

  const toggleSidebarSection = (sectionKey) => {
    setSidebarSections((prev) => {
      const nextState = {
        ...prev,
        [sectionKey]: !prev[sectionKey],
      };

      registerSidebarSectionsState = nextState;
      return nextState;
    });
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
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <ProfileAvatar
          className="sidebar-img-circle"
          imageUrl={profileImage}
          name={profileName}
          size={58}
          style={{
            border: "3px solid var(--border-strong)",
            boxShadow: "0 10px 20px rgba(15,23,42,0.16)",
          }}
        />
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
          {badgeLabel}
        </div>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--text-primary)", textAlign: "center" }}>{profileName}</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{profileId}</p>
      </div>

      <div className="sidebar-menu" style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
        {SIDEBAR_SECTIONS.map((section) => {
          const SectionIcon = section.icon;
          const isOpen = sidebarSections[section.key];

          return (
            <div key={section.key} style={sidebarSectionStyle}>
              <button type="button" onClick={() => toggleSidebarSection(section.key)} style={getSidebarSectionButtonStyle(section.key)}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <SectionIcon style={{ width: 15, height: 15, color: "var(--accent-strong)" }} /> {section.label}
                </span>
                <FaChevronDown
                  style={{
                    width: 12,
                    height: 12,
                    color: "var(--accent)",
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 160ms ease",
                  }}
                />
              </button>
              {isOpen ? (
                <div style={sidebarSectionChildrenStyle}>
                  {section.links.map((link) => (
                    <Link key={link.path} className="sidebar-btn" to={link.path} style={getSidebarLinkStyle(link.path)}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

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
          }}
        >
          <FaSignOutAlt style={{ width: 15, height: 15 }} /> Logout
        </button>
      </div>
    </div>
  );
}

export default RegisterSidebar;