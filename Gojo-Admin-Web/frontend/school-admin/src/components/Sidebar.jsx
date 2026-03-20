import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaBook,
  FaCalendarAlt,
  FaChartBar,
  FaChalkboardTeacher,
  FaClipboardList,
  FaCog,
  FaFileAlt,
  FaFolderOpen,
  FaHome,
  FaSignOutAlt,
  FaUserCog,
  FaUsers,
  FaChevronDown,
} from "react-icons/fa";

const SIDEBAR_SECTIONS = [
  {
    key: "dashboard",
    title: "Dashboard",
    icon: FaHome,
    items: [
      { to: "/dashboard", label: "Home", icon: FaHome },
      { to: "/my-posts", label: "MyPosts", icon: FaFileAlt },
      { to: "/overview", label: "Overview", icon: FaChartBar },
    ],
  },
  {
    key: "academic-structure",
    title: "Academic Structure",
    icon: FaUserCog,
    items: [
      { to: "/academic-year", label: "Academic Year", icon: FaCalendarAlt },
      { to: "/subject-management", label: "Subject Management", icon: FaBook },
      { to: "/assessment", label: "Assessment", icon: FaClipboardList },
    ],
  },
  {
    key: "teachers",
    title: "Teachers",
    icon: FaChalkboardTeacher,
    items: [
      { to: "/teachers", label: "Teacher List", icon: FaChalkboardTeacher },
    ],
  },
  {
    key: "teaching",
    title: "Students",
    icon: FaBook,
    items: [
      { to: "/students", label: "Students", icon: FaUsers },
      { to: "/schedule", label: "Timetable", icon: FaCalendarAlt },
    ],
  },
  {
    key: "message-group",
    title: "Message",
    icon: FaFolderOpen,
    items: [
      { to: "/all-chat", label: "Chat", icon: FaFileAlt },
      { to: "/message-control", label: "Message Control", icon: FaUserCog },
    ],
  },
  {
    key: "settings",
    title: "Settings",
    icon: FaCog,
    items: [
      { to: "/settings", label: "Academic Settings", icon: FaUserCog },
      { label: "Logout", icon: FaSignOutAlt, action: "logout" },
    ],
  },
];

const createDefaultSidebarSections = () =>
  SIDEBAR_SECTIONS.reduce((allSections, section) => {
    allSections[section.key] = false;
    return allSections;
  }, {});

const SIDEBAR_SECTIONS_STORAGE_KEY = "admin_sidebar_sections_state";

const readStoredSidebarSections = () => {
  const defaultSections = createDefaultSidebarSections();

  try {
    const rawValue = localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY);
    if (!rawValue) {
      return defaultSections;
    }

    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object") {
      return defaultSections;
    }

    return Object.keys(defaultSections).reduce((normalizedValue, sectionKey) => {
      normalizedValue[sectionKey] = Boolean(parsedValue[sectionKey]);
      return normalizedValue;
    }, {});
  } catch (error) {
    return defaultSections;
  }
};

let sidebarSectionsState = readStoredSidebarSections();

const defaultRootStyle = {
  width: "clamp(230px, 16vw, 290px)",
  minWidth: 230,
  marginLeft: -10,
  marginRight: 0,
  padding: 14,
  borderRadius: 24,
  background: "var(--surface-panel)",
  border: "1px solid var(--border-soft)",
  boxShadow: "var(--shadow-panel)",
  height: "calc(100vh - 24px)",
  overflowY: "auto",
  overflowX: "hidden",
  display: "flex",
  flexDirection: "column",
  alignSelf: "flex-start",
  boxSizing: "border-box",
  scrollbarWidth: "thin",
  scrollbarColor: "var(--border-strong) transparent",
  transition: "opacity 180ms ease, filter 180ms ease",
};

function Sidebar({
  admin,
  style,
  dimmed = false,
  sticky = true,
  fullHeight = true,
  top = 4,
  badgeLabel = "Academic Office",
  onLogout,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [sidebarSections, setSidebarSections] = useState(() => ({ ...sidebarSectionsState }));
  const displayAdminId = admin?.adminId || admin?.username || "username";
  const displayName = admin?.name || "Admin Name";
  const profileImage = admin?.profileImage || "/default-profile.png";
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
    textDecoration: "none",
  };
  const sidebarLinkActiveStyle = {
    background: "var(--accent-strong)",
    color: "#ffffff",
    border: "1px solid var(--accent-strong)",
    boxShadow: "var(--shadow-glow)",
  };
  const isSectionActive = (sectionKey) =>
    SIDEBAR_SECTIONS.find((section) => section.key === sectionKey)?.items.some((item) => item.to === currentPath) || false;
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
    setSidebarSections((previousState) => {
      const nextState = {
        ...previousState,
        [sectionKey]: !previousState[sectionKey],
      };

      sidebarSectionsState = nextState;
      try {
        localStorage.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify(nextState));
      } catch (error) {
        // ignore storage write failures
      }
      return nextState;
    });
  };

  const rootStyle = {
    ...defaultRootStyle,
    ...(sticky
      ? {
          position: fullHeight ? "relative" : "sticky",
          top: fullHeight ? "auto" : top,
          left: fullHeight ? "auto" : -10,
        }
      : null),
    ...(fullHeight
      ? {
          height: "calc(100vh - 77px)",
          maxHeight: "calc(100vh - 77px)",
          minHeight: 0,
          alignSelf: "stretch",
          overflowY: "auto",
          overscrollBehavior: "contain",
        }
      : null),
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
          gap: 6,
          padding: "12px 10px",
          marginBottom: 6,
          borderRadius: 14,
          background: "linear-gradient(180deg, var(--surface-accent) 0%, var(--surface-panel) 100%)",
          border: "1px solid var(--border-strong)",
          boxShadow: "inset 0 1px 0 color-mix(in srgb, white 8%, transparent)",
        }}
      >
        <div className="sidebar-img-circle" style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--border-strong)", boxShadow: "var(--shadow-glow)" }}>
          <img src={profileImage} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ padding: "3px 8px", borderRadius: 999, background: "var(--surface-accent)", border: "1px solid var(--border-strong)", color: "var(--accent)", fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>{badgeLabel}</div>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--text-primary)", textAlign: "center" }}>{displayName}</h3>
        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{displayAdminId}</p>
      </div>

      <div
        className="sidebar-menu"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginTop: 12,
          flex: 1,
          minHeight: 0,
          overflow: "visible",
          paddingRight: 2,
        }}
      >
        {SIDEBAR_SECTIONS.map((section) => {
          const SectionIcon = section.icon;
          const isOpen = sidebarSections[section.key];

          return (
            <div key={section.key} style={sidebarSectionStyle}>
              <button type="button" onClick={() => toggleSidebarSection(section.key)} style={getSidebarSectionButtonStyle(section.key)}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <SectionIcon style={{ width: 15, height: 15, color: "var(--accent-strong)" }} /> {section.title}
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
                  {section.items.map(({ to, label, icon: Icon, action }) => {
                    if (action === "logout") {
                      return (
                        <button
                          key={`${section.key}-${label}`}
                          type="button"
                          className="sidebar-btn logout-btn"
                          onClick={handleLogout}
                          style={{
                            ...sidebarLinkBaseStyle,
                            marginLeft: 10,
                            justifyContent: "flex-start",
                            color: "var(--danger)",
                            background: "var(--danger-soft)",
                            border: "1px solid var(--danger-border)",
                            cursor: "pointer",
                          }}
                        >
                          <Icon style={{ width: 15, height: 15 }} /> {label}
                        </button>
                      );
                    }

                    return (
                      <Link key={to + label} className="sidebar-btn" to={to} style={getSidebarLinkStyle(to)}>
                        <Icon style={{ width: 15, height: 15 }} /> {label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Sidebar;
