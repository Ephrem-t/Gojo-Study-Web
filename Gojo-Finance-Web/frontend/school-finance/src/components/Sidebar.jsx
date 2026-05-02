import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaChartLine,
  FaChalkboardTeacher,
  FaFileAlt,
  FaHome,
  FaSignOutAlt,
} from "react-icons/fa";
import { useFinanceShell } from "../context/FinanceShellContext";
import { normalizeFinanceSession, readStoredFinanceSession } from "../utils/financeSession";

const menuItems = [
  { label: "Home", to: "/dashboard", icon: FaHome, paths: ["/dashboard"] },
  { label: "My Posts", to: "/my-posts", icon: FaFileAlt, paths: ["/my-posts"] },
  { label: "Students", to: "/students", icon: FaChalkboardTeacher, paths: ["/students"] },
  { label: "Parents", to: "/parents", icon: FaChalkboardTeacher, paths: ["/parents"] },
  { label: "Analytics", to: "/analytics", icon: FaChartLine, paths: ["/analytics", "/analatics"] },
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

  return (
    <aside className="google-sidebar finance-shell-sidebar">
      <div className="sidebar-profile finance-shell-profile">
        <div className="sidebar-img-circle finance-shell-avatar">
          <img src={profileImage} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <h3 className="finance-shell-name">{displayName}</h3>
        <p className="finance-shell-id">{displayId}</p>
      </div>

      <div className="sidebar-menu finance-shell-menu">
        {menuItems.map(({ label, to, icon: Icon, paths }) => {
          const isActive = paths.includes(pathname);

          return (
            <Link
              key={to}
              className={`sidebar-btn finance-shell-btn${isActive ? " finance-shell-btn-active" : ""}`}
              to={to}
            >
              <Icon style={{ width: 18, height: 18 }} />
              <span className="finance-shell-btn-label">{label}</span>
            </Link>
          );
        })}

        <button
          className="sidebar-btn logout-btn finance-shell-btn finance-shell-logout"
          onClick={handleLogout}
          type="button"
        >
          <FaSignOutAlt style={{ width: 18, height: 18 }} />
          <span className="finance-shell-btn-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
