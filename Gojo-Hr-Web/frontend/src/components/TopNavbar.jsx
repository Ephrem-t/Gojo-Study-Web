import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaBell, FaCog, FaFacebookMessenger } from 'react-icons/fa';

export default function TopNavbar({
  admin,
  subtitle = '— Admin Dashboard',
  notificationCount = 0,
  messageCount = 0,
  onNotificationClick,
  notificationPanel = null,
  settingsAsButton = false,
  onSettingsClick,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNotificationAction = () => {
    if (onNotificationClick) {
      onNotificationClick();
      return;
    }

    if (location.pathname === '/dashboard') {
      return;
    }

    navigate('/dashboard', { state: { openNotifications: true } });
  };

  const handleMessengerAction = () => {
    if (location.pathname === '/all-chat') {
      return;
    }

    navigate('/all-chat');
  };

  const notificationButton = (
    <button
      type="button"
      className="icon-circle"
      title="Notifications"
      aria-label="Notifications"
      onClick={handleNotificationAction}
      style={{ position: 'relative', cursor: 'pointer', border: 'none' }}
    >
      <FaBell />
      {notificationCount > 0 ? (
        <span style={{ position: 'absolute', top: -4, right: -2, minWidth: 17, height: 17, borderRadius: '999px', background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
          {notificationCount}
        </span>
      ) : null}
    </button>
  );

  return (
    <nav className="top-navbar" style={{ borderBottom: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-overlay, #ffffff)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <h2>Gojo HR</h2>
        <span className="muted">{subtitle}</span>
      </div>

      <div className="nav-right" style={{ position: 'relative' }}>
        {notificationButton}
        {notificationPanel}
        <button type="button" className="icon-circle" title="Messages" aria-label="Messages" onClick={handleMessengerAction} style={{ border: 'none', position: 'relative' }}>
          <FaFacebookMessenger />
          {messageCount > 0 ? (
            <span style={{ position: 'absolute', top: -4, right: -2, minWidth: 17, height: 17, borderRadius: '999px', background: '#2563eb', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
              {messageCount}
            </span>
          ) : null}
        </button>
        {settingsAsButton ? (
          <button type="button" className="icon-circle" aria-label="Settings" onClick={onSettingsClick} style={{ border: 'none' }}>
            <FaCog />
          </button>
        ) : (
          <Link to="/settings" className="icon-circle" aria-label="Settings"><FaCog /></Link>
        )}
        <img src={admin?.profileImage || '/default-profile.png'} alt="admin" className="profile-img" />
      </div>
    </nav>
  );
}
