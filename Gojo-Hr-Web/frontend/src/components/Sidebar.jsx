import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaCalendarAlt,
  FaChalkboardTeacher,
  FaClipboardList,
  FaCog,
  FaFileAlt,
  FaHome,
  FaSignOutAlt,
  FaUserCog,
  FaUsers,
  FaChevronDown,
  FaFacebookMessenger,
} from "react-icons/fa";
import { createProfilePlaceholder, isFallbackProfileImage, resolveProfileImage } from "../utils/profileImage";

const getInitials = (name) =>
  String(name || "HR Office")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "HR";

const createPlaceholderAvatar = (name) => {
  return createProfilePlaceholder(name || getInitials(name));
};

const sanitizeProfileImage = (value) => {
  return resolveProfileImage(value);
};

function SidebarAvatar({ src, name, size = 48 }) {
  const [failed, setFailed] = useState(false);
  const normalizedSrc = sanitizeProfileImage(src);
  const fallbackSrc = createPlaceholderAvatar(name);

  return (
    <img
      src={!normalizedSrc || failed || isFallbackProfileImage(normalizedSrc) ? fallbackSrc : normalizedSrc}
      alt={name || "HR Office"}
      onError={(event) => {
        if (event.currentTarget.src !== fallbackSrc) {
          event.currentTarget.src = fallbackSrc;
        }
        setFailed(true);
      }}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

const SIDEBAR_SECTIONS = [
  {
    key: "dashboard",
    title: "Dashboard",
    icon: FaHome,
    items: [
      { label: "Home", icon: FaHome, action: "view-home", activePath: "/dashboard" },
      { label: "MyPosts", icon: FaFileAlt, action: "view-my-posts", activePath: "/my-posts" },
      { label: "Overview", icon: FaUserCog, action: "view-overview", activePath: "/overview" },
    ],
  },
  {
    key: "employees",
    title: "Employees",
    icon: FaUsers,
    items: [
      { to: "/employees", label: "Employee List", icon: FaChalkboardTeacher },
      { to: "/employees/attendance", label: "Attendance", icon: FaCalendarAlt },
      { to: "/employees/terminated", label: "Terminated", icon: FaUserCog },
      { to: "/register", label: "Registration", icon: FaClipboardList },
    ],
  },
  {
    key: "message-group",
    title: "Message",
    icon: FaFileAlt,
    items: [
      { to: "/all-chat", label: "Chat", icon: FaFacebookMessenger },
    ],
  },
  {
    key: "settings",
    title: "Settings",
    icon: FaCog,
    items: [
      { to: "/settings", label: "HR Settings", icon: FaCog },
      { label: "Logout", icon: FaSignOutAlt, action: "logout" },
    ],
  },
];

const createDefaultSidebarSections = () =>
  SIDEBAR_SECTIONS.reduce((allSections, section) => {
    allSections[section.key] = false;
    return allSections;
  }, {});

const SIDEBAR_SECTIONS_STORAGE_KEY = "hr_sidebar_sections_state";
const DASHBOARD_SIDEBAR_STATE_KEY = "hr_dashboard_sidebar_view_state";

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

const readStoredDashboardSelection = () => {
  try {
    const rawValue = localStorage.getItem(DASHBOARD_SIDEBAR_STATE_KEY);
    if (!rawValue) {
      return {
        dashboardView: "home",
        postFeedView: "all",
      };
    }

    const parsedValue = JSON.parse(rawValue);
    return {
      dashboardView: parsedValue?.dashboardView === "overview" ? "overview" : "home",
      postFeedView: parsedValue?.postFeedView === "mine" ? "mine" : "all",
    };
  } catch (error) {
    return {
      dashboardView: "home",
      postFeedView: "all",
    };
  }
};

let sidebarSectionsState = readStoredSidebarSections();
const SIDEBAR_FIXED_WIDTH = 320;
const SIDEBAR_FIXED_HEIGHT = "calc(100vh - var(--topbar-height, 56px))";

const defaultRootStyle = {
  width: SIDEBAR_FIXED_WIDTH,
  minWidth: SIDEBAR_FIXED_WIDTH,
  maxWidth: SIDEBAR_FIXED_WIDTH,
  marginLeft: -10,
  marginRight: 0,
  marginTop: -18,
  padding: 14,
  borderRadius: 24,
  background: "var(--surface-panel)",
  border: "1px solid var(--border-soft)",
  boxShadow: "var(--shadow-panel)",
  height: SIDEBAR_FIXED_HEIGHT,
  maxHeight: SIDEBAR_FIXED_HEIGHT,
  overflowY: "auto",
  overflowX: "hidden",
  display: "flex",
  flexDirection: "column",
  alignSelf: "flex-start",
  boxSizing: "border-box",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  transition: "opacity 180ms ease, filter 180ms ease",
};

function Sidebar({
  admin,
  style,
  dimmed = false,
  sticky = true,
  fullHeight = true,
  top = 4,
  badgeLabel = "HR Office",
  selectedDashboardView,
  selectedPostFeedView,
  onSelectDashboardView,
  onLogout,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const isDashboardRoute = currentPath === "/dashboard";
  const [sidebarSections, setSidebarSections] = useState(() => ({ ...sidebarSectionsState }));
  const [storedDashboardSelection, setStoredDashboardSelection] = useState(() => readStoredDashboardSelection());
  const displayAdminId = admin?.hrId || admin?.adminId || admin?.username || "username";
  const displayName = admin?.name || "Admin Name";
  const profileImage = admin?.profileImage || admin?.photoURL || "";
  const effectiveDashboardView = selectedDashboardView ?? storedDashboardSelection.dashboardView;
  const effectivePostFeedView = selectedPostFeedView ?? storedDashboardSelection.postFeedView;

  useEffect(() => {
    const syncDashboardSelection = () => {
      setStoredDashboardSelection(readStoredDashboardSelection());
    };

    window.addEventListener("hr-dashboard-view-updated", syncDashboardSelection);
    window.addEventListener("storage", syncDashboardSelection);

    return () => {
      window.removeEventListener("hr-dashboard-view-updated", syncDashboardSelection);
      window.removeEventListener("storage", syncDashboardSelection);
    };
  }, []);

  const sidebarSectionStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  };
  const sidebarSectionTitleStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    width: "100%",
    boxSizing: "border-box",
    minHeight: 36,
    fontSize: 12,
    fontWeight: 800,
    color: "var(--text-primary)",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--border-strong)",
    background: "var(--page-bg)",
    cursor: "pointer",
  };
  const sidebarSectionChildrenStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    marginLeft: 0,
    paddingLeft: 12,
    paddingRight: 2,
    borderLeft: "2px solid var(--border-strong)",
  };
  const sidebarLinkBaseStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    minHeight: 34,
    padding: "8px 10px",
    marginLeft: 0,
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
  const isItemActive = (item) => {
    if (item.action === "view-home") {
      return isDashboardRoute && effectiveDashboardView === "home" && effectivePostFeedView === "all";
    }

    if (item.action === "view-my-posts") {
      return isDashboardRoute && effectiveDashboardView === "home" && effectivePostFeedView === "mine";
    }

    if (item.action === "view-overview") {
      return isDashboardRoute && effectiveDashboardView === "overview";
    }

    if (item.to) {
      return currentPath === item.to;
    }

    return false;
  };
  const isSectionActive = (sectionKey) =>
    SIDEBAR_SECTIONS.find((section) => section.key === sectionKey)?.items.some((item) => isItemActive(item)) || false;
  const getSidebarSectionButtonStyle = (sectionKey) =>
    sidebarSections[sectionKey] || isSectionActive(sectionKey)
      ? {
          ...sidebarSectionTitleStyle,
          background: "var(--page-bg)",
          border: isSectionActive(sectionKey) ? "2px solid var(--accent)" : "1px solid var(--border-strong)",
          boxShadow: isSectionActive(sectionKey)
            ? "var(--shadow-glow)"
            : "0 10px 22px rgba(15,23,42,0.08)",
          color: "var(--text-primary)",
        }
      : sidebarSectionTitleStyle;
  const getSidebarLinkStyle = (item) =>
    isItemActive(item)
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
          height: SIDEBAR_FIXED_HEIGHT,
          maxHeight: SIDEBAR_FIXED_HEIGHT,
          minHeight: 0,
          alignSelf: "stretch",
          overflowY: "auto",
          overscrollBehavior: "none",
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

  const handleItemAction = (item) => {
    if (item.action === "logout") {
      if (onLogout) {
        onLogout();
        return;
      }

      localStorage.removeItem("admin");
      navigate("/login", { replace: true });
      return;
    }

    if (item.action && onSelectDashboardView) {
      onSelectDashboardView(item.action);
      return;
    }

    if (item.action && !onSelectDashboardView) {
      navigate("/dashboard", { replace: false, state: { dashboardAction: item.action } });
    }
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
          background: "var(--page-bg)",
          border: "1px solid var(--border-strong)",
          boxShadow: "inset 0 1px 0 color-mix(in srgb, white 8%, transparent)",
        }}
      >
        <div className="sidebar-img-circle" style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--border-strong)", boxShadow: "var(--shadow-glow)" }}>
          <SidebarAvatar src={profileImage} name={displayName} size={48} />
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
          overflowY: "auto",
          overflowX: "hidden",
          paddingRight: 0,
          msOverflowStyle: "none",
          scrollbarWidth: "none",
          scrollbarColor: "transparent transparent",
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
                  {section.items.map((item) => {
                    const { to, label, icon: Icon, action } = item;

                    if (action) {
                      return (
                        <button
                          key={`${section.key}-${label}`}
                          type="button"
                          className="sidebar-btn"
                          onClick={() => handleItemAction(item)}
                          style={
                            action === "logout"
                              ? {
                                  ...sidebarLinkBaseStyle,
                                  justifyContent: "flex-start",
                                  color: "var(--danger)",
                                  background: "var(--danger-soft)",
                                  border: "1px solid var(--danger-border)",
                                  cursor: "pointer",
                                }
                              : getSidebarLinkStyle(item)
                          }
                        >
                          <Icon style={{ width: 15, height: 15 }} /> {label}
                        </button>
                      );
                    }

                    return (
                      <Link key={to + label} className="sidebar-btn" to={to} style={getSidebarLinkStyle(item)}>
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
