import React from "react";
import { Link } from "react-router-dom";
import { FaCog } from "react-icons/fa";

export default function Navbar({
  title = "Dashboard",
  brandTitle = "Gojo Admin Portal",
  admin = {},
  children = null,
  style,
  showSettings = false,
  settingsTo = "/settings",
  hideProfile = false,
}) {
  const profileImage = admin?.profileImage || "/default-profile.png";
  const showPageChip = title && title !== brandTitle;

  return (
    <nav
      className="top-navbar register-shell__topbar"
      style={{
        borderBottom: "1px solid var(--border-soft)",
        background: "var(--surface-overlay)",
        backdropFilter: "blur(10px)",
        ...style,
      }}
    >
      <div className="register-shell__brand">
        <h2 className="register-shell__brand-title">{brandTitle}</h2>
        {showPageChip ? <span className="register-shell__page-chip">{title}</span> : null}
      </div>

      <div className="nav-right">
        {children}
        {showSettings ? (
          <Link className="icon-circle" to={settingsTo}>
            <FaCog />
          </Link>
        ) : null}
        {!hideProfile ? <img src={profileImage} alt="admin" className="profile-img" /> : null}
      </div>
    </nav>
  );
}
