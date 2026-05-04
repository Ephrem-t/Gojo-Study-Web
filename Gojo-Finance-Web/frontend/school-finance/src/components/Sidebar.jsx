import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaComments,
  FaChartLine,
  FaChalkboardTeacher,
  FaCog,
  FaFileAlt,
  FaHome,
  FaUsers,
  FaSignOutAlt,
} from "react-icons/fa";
import { useFinanceShell } from "../context/FinanceShellContext";
import { normalizeFinanceSession, readStoredFinanceSession } from "../utils/financeSession";

const SIDEBAR_SECTIONS = [
  {
    key: "workspace",
    title: "Workspace",
    icon: FaHome,
    items: [
      { label: "Home", to: "/dashboard", icon: FaHome, paths: ["/dashboard"] },
      { label: "Messages", to: "/all-chat", icon: FaComments, paths: ["/all-chat"] },
      { label: "My Posts", to: "/my-posts", icon: FaFileAlt, paths: ["/my-posts"] },
    ],
  },
  {
    key: "records",
    title: "Records",
    icon: FaUsers,
    items: [
      { label: "Students", to: "/students", icon: FaUsers, paths: ["/students"] },
      { label: "Parents", to: "/parents", icon: FaChalkboardTeacher, paths: ["/parents"] },
      { label: "Analytics", to: "/analytics", icon: FaChartLine, paths: ["/analytics", "/analatics"] },
    ],
  },
  {
    key: "account",
    title: "Account",
    icon: FaCog,
    items: [
      { label: "Settings", to: "/settings", icon: FaCog, paths: ["/settings"] },
    ],
  },
];

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const financeShell = useFinanceShell();
  const session = normalizeFinanceSession(financeShell?.session || readStoredFinanceSession());
  const pathname = String(location.pathname || "").toLowerCase();

  const handleLogout = () => {
    localStorage.removeItem("finance");
    localStorage.removeItem("admin");
    navigate("/login", { replace: true });
  };

  const profileImage = session.profileImage || "/default-profile.png";
  const displayName = session.name || "Finance";
  const displayId = session.username || session.userId || session.financeId || session.adminId || "finance";

  const rootStyle = {
    width: "var(--sidebar-width, clamp(230px, 16vw, 290px))",
    minWidth: "var(--sidebar-width, clamp(230px, 16vw, 290px))",
    height: "calc(100vh - var(--topbar-height, 0px) - 8px)",
    padding: 14,
    background: "#ffffff",
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "stretch",
    position: "fixed",
    top: "calc(var(--topbar-height, 0px) + 8px)",
    left: 12,
    zIndex: 40,
    borderRadius: 18,
    border: "1px solid #dbe2f0",
    boxSizing: "border-box",
    overflowY: "auto",
    overflowX: "hidden",
  };

  const profileCardStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "14px 10px 12px",
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #dbeafe",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  };

  const sectionHeaderStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    width: "100%",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #dbe2f0",
    background: "linear-gradient(135deg, #f8fbff 0%, #ffffff 100%)",
    color: "#0f172a",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    boxSizing: "border-box",
  };

  const linkBaseStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#475569",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 700,
    boxSizing: "border-box",
  };

  const linkActiveStyle = {
    background: "#007AFB",
    color: "#ffffff",
    border: "1px solid #1d4ed8",
    boxShadow: "0 10px 18px rgba(29, 78, 216, 0.24)",
  };

  const logoutStyle = {
    ...linkBaseStyle,
    marginTop: 2,
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    cursor: "pointer",
  };

  return (
    <aside className="google-sidebar finance-shell-sidebar" style={rootStyle}>
      <div className="sidebar-profile finance-shell-profile" style={profileCardStyle}>
        <div
          style={{
            alignSelf: "flex-start",
            padding: "4px 9px",
            borderRadius: 999,
            border: "1px solid #dbeafe",
            background: "#f8fbff",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#007AFB",
          }}
        >
          Finance workspace
        </div>

        <div className="sidebar-img-circle finance-shell-avatar" style={{ width: 78, height: 78, margin: "2px auto 4px", border: "3px solid #dbeafe" }}>
          <img src={profileImage} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>

        <div className="finance-shell-card-copy" style={{ width: "100%", textAlign: "center" }}>
          <h3 className="finance-shell-name" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{displayName}</h3>
          <p className="finance-shell-id" style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>{displayId}</p>
          <div className="finance-shell-status" style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: "#334155" }}>School finance portal</div>
        </div>
      </div>

      <div className="sidebar-menu finance-shell-menu" style={{ display: "flex", flexDirection: "column", marginTop: 4, width: "100%", flex: 1, gap: 10 }}>
        {SIDEBAR_SECTIONS.map((section) => {
          const SectionIcon = section.icon;

          return (
          <div key={section.key} className="finance-shell-section" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="finance-shell-section-title" style={sectionHeaderStyle}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <SectionIcon style={{ width: 14, height: 14 }} />
                <span>{section.title}</span>
              </span>
            </div>
            <div className="finance-shell-section-items" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {section.items.map(({ label, to, icon: Icon, paths }) => {
                const isActive = paths.includes(pathname);

                return (
                  <Link
                    key={to}
                    className={`sidebar-btn finance-shell-btn${isActive ? " finance-shell-btn-active" : ""}`}
                    to={to}
                    style={isActive ? { ...linkBaseStyle, ...linkActiveStyle } : linkBaseStyle}
                  >
                    <Icon style={{ width: 18, height: 18 }} />
                    <span className="finance-shell-btn-label">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )})}

        <button
          className="sidebar-btn logout-btn finance-shell-btn finance-shell-logout"
          onClick={handleLogout}
          type="button"
          style={logoutStyle}
        >
          <FaSignOutAlt style={{ width: 18, height: 18 }} />
          <span className="finance-shell-btn-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
