import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FaBell, FaFacebookMessenger } from "react-icons/fa";
import ProfileAvatar from "./ProfileAvatar";
import RegisterSidebar from "./RegisterSidebar";
import useTopbarNotifications, { RegisterNotificationsContext } from "../hooks/useTopbarNotifications";

const DB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";

const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/overview": "Overview",
  "/academic-years": "Academic Year Management",
  "/grede-management": "Grade Management",
  "/promotion-system": "Promotion System",
  "/transfer-withdrawal": "Transfer & Withdrawal",
  "/document-generation": "Document Generation",
  "/my-posts": "My Posts",
  "/students": "Students",
  "/parents": "Parents",
  "/analytics": "Analytics",
  "/analatics": "Analytics",
  "/settings": "Settings",
  "/parent-register": "Parent Register",
  "/student-register": "Student Register",
  "/teacher-register": "Teacher Register",
};

function readStoredRegistrar() {
  try {
    return JSON.parse(localStorage.getItem("registrar") || localStorage.getItem("admin") || "{}") || {};
  } catch {
    return {};
  }
}

export default function RegisterShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const notificationRef = useRef(null);
  const [isNarrow, setIsNarrow] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 1100 : false));
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth <= 1100);

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const user = useMemo(() => {
    const stored = readStoredRegistrar();

    return {
      name: stored.name || stored.username || "Register Office",
      username: stored.username || "",
      profileImage: stored.profileImage || "/default-profile.png",
      adminId: stored.registrarId || stored.financeId || stored.adminId || stored.userId || "",
      userId: stored.userId || "",
      schoolCode: stored.schoolCode || "",
    };
  }, [location.pathname]);

  const dbRoot = useMemo(() => (user.schoolCode ? `${DB_BASE}/Platform1/Schools/${user.schoolCode}` : DB_BASE), [user.schoolCode]);

  const notifications = useTopbarNotifications({
    dbRoot,
    currentUserId: user.userId,
  });

  const {
    unreadSenders,
    setUnreadSenders,
    unreadPosts,
    totalNotifications,
    messageCount,
    markMessagesAsSeen,
    markPostAsSeen,
  } = notifications;

  const pageTitle = PAGE_TITLES[location.pathname] || "Gojo Register Portal";

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotificationDropdown(false);
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const handleNotificationClick = async (notification) => {
    try {
      await markPostAsSeen(notification.postId);
    } catch (error) {
      console.warn("Failed to mark post notification as seen:", error);
    }

    setShowNotificationDropdown(false);
    navigate("/dashboard", {
      state: {
        postId: notification.postId,
        posterName: notification.adminName,
        posterProfile: notification.adminProfile,
      },
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("admin");
    localStorage.removeItem("registrar");
    navigate("/login", { replace: true });
  };

  return (
    <RegisterNotificationsContext.Provider value={notifications}>
      <div className="register-shell">
      <nav
        className="top-navbar register-shell__topbar"
        style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface-overlay)", backdropFilter: "blur(10px)" }}
      >
        <div className="register-shell__brand">
          <h2 style={{ color: "var(--text-primary)", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>
          {pageTitle !== "Gojo Register Portal" ? (
            <span className="register-shell__page-chip">{pageTitle}</span>
          ) : null}
        </div>

        <div className="nav-right">
          <div
            ref={notificationRef}
            className="icon-circle"
            aria-label="Dashboard notifications"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(event) => {
              event.stopPropagation();
              setShowNotificationDropdown((currentValue) => !currentValue);
            }}
          >
            <FaBell />

            {totalNotifications > 0 ? (
              <span className="badge">{totalNotifications}</span>
            ) : null}

            {showNotificationDropdown ? (
              <div
                className="notification-dropdown"
                onClick={(event) => event.stopPropagation()}
                style={{ position: "absolute", top: 40, right: 0, width: 360, maxHeight: 420, overflowY: "auto", background: "var(--surface-panel)", borderRadius: 10, boxShadow: "var(--shadow-panel)", border: "1px solid var(--border-soft)", zIndex: 1000, padding: 6 }}
              >
                {totalNotifications === 0 ? (
                  <p style={{ padding: 12, textAlign: "center", color: "var(--text-muted)" }}>No new notifications</p>
                ) : (
                  <div>
                    {unreadPosts.length > 0 ? (
                      <div>
                        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-soft)", fontWeight: 700, color: "var(--text-primary)" }}>Posts</div>
                        {unreadPosts.map((notification) => (
                          <div
                            key={notification.notificationId}
                            style={{ padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderBottom: "1px solid var(--border-soft)", transition: "background 120ms ease" }}
                            onMouseEnter={(event) => (event.currentTarget.style.background = "var(--surface-muted)")}
                            onMouseLeave={(event) => (event.currentTarget.style.background = "")}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <ProfileAvatar imageUrl={notification.adminProfile} name={notification.adminName} size={46} borderRadius={8} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: "block", marginBottom: 4 }}>{notification.adminName}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{notification.message}</p>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>{new Date(notification.time || notification.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {messageCount > 0 ? (
                      <div>
                        <div style={{ padding: "8px 10px", color: "var(--text-primary)", fontWeight: 700, background: "var(--surface-muted)", borderRadius: 6, margin: "8px 6px" }}>Messages</div>
                        {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                          <div
                            key={userId}
                            style={{ padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderBottom: "1px solid var(--border-soft)", transition: "background 120ms ease" }}
                            onMouseEnter={(event) => (event.currentTarget.style.background = "var(--surface-muted)")}
                            onMouseLeave={(event) => (event.currentTarget.style.background = "")}
                            onClick={async () => {
                              await markMessagesAsSeen(userId);
                              setUnreadSenders((currentValue) => {
                                const nextValue = { ...currentValue };
                                delete nextValue[userId];
                                return nextValue;
                              });
                              setShowNotificationDropdown(false);
                              navigate("/all-chat", { state: { user: { userId, name: sender.name, profileImage: sender.profileImage, type: sender.type } } });
                            }}
                          >
                            <ProfileAvatar imageUrl={sender.profileImage} name={sender.name} size={46} borderRadius={8} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: "block", marginBottom: 4 }}>{sender.name}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{sender.count} new message{sender.count > 1 ? "s" : ""}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <Link className="icon-circle" to="/all-chat" aria-label="Open chat" style={{ position: "relative" }}>
            <FaFacebookMessenger />
            {messageCount > 0 ? <span className="badge">{messageCount}</span> : null}
          </Link>
          <ProfileAvatar imageUrl={user.profileImage} name={user.name} size={38} className="profile-img" />
        </div>
      </nav>

      <div className="register-shell__body">
        <div className="register-shell__sidebar">
          <RegisterSidebar
            user={user}
            sticky={!isNarrow}
            fullHeight={!isNarrow}
            style={isNarrow ? { width: "100%", minWidth: 0, flex: "0 0 auto" } : { flex: "0 0 auto" }}
            onLogout={handleLogout}
          />
        </div>

        <main className="register-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
    </RegisterNotificationsContext.Provider>
  );
}