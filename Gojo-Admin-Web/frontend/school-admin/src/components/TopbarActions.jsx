import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaBell, FaFacebookMessenger } from "react-icons/fa";
import ProfileAvatar from "./ProfileAvatar";

export default function TopbarActions({
  unreadPosts = [],
  unreadSenders = {},
  totalNotifications = 0,
  messageCount = 0,
  onPostClick,
  onMessageClick,
  onOpenNotifications,
  chatTo = "/all-chat",
}) {
  const notificationRef = useRef(null);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotificationDropdown(false);
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  return (
    <>
      <div
        ref={notificationRef}
        className="icon-circle"
        aria-label="Dashboard notifications"
        style={{ position: "relative", cursor: "pointer" }}
        onClick={(event) => {
          event.stopPropagation();
          setShowNotificationDropdown((currentValue) => {
            const nextValue = !currentValue;
            if (nextValue) {
              onOpenNotifications?.();
            }
            return nextValue;
          });
        }}
      >
        <FaBell />

        {totalNotifications > 0 ? <span className="badge">{totalNotifications}</span> : null}

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
                    <div className="notification-section-title">Posts</div>
                    {unreadPosts.map((notification) => (
                      <div
                        key={notification.notificationId || notification.postId}
                        className="notification-row"
                        style={{ padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderBottom: "1px solid var(--border-soft)", transition: "background 120ms ease" }}
                        onMouseEnter={(event) => (event.currentTarget.style.background = "var(--surface-muted)")}
                        onMouseLeave={(event) => (event.currentTarget.style.background = "")}
                        onClick={async () => {
                          await onPostClick?.(notification);
                          setShowNotificationDropdown(false);
                        }}
                      >
                        <ProfileAvatar src={notification.adminProfile} name={notification.adminName || "Notification"} alt={notification.adminName || "Notification"} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ display: "block", marginBottom: 4 }}>{notification.adminName || "Admin"}</strong>
                          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{notification.message || "New post"}</p>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
                          {new Date(notification.time || notification.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
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
                        className="notification-row"
                        style={{ padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderBottom: "1px solid var(--border-soft)", transition: "background 120ms ease" }}
                        onMouseEnter={(event) => (event.currentTarget.style.background = "var(--surface-muted)")}
                        onMouseLeave={(event) => (event.currentTarget.style.background = "")}
                        onClick={async () => {
                          await onMessageClick?.(userId, sender);
                          setShowNotificationDropdown(false);
                        }}
                      >
                        <ProfileAvatar src={sender.profileImage} name={sender.name || "User"} alt={sender.name || "User"} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ display: "block", marginBottom: 4 }}>{sender.name || "User"}</strong>
                          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {sender.count} new message{sender.count > 1 ? "s" : ""}
                          </p>
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

      <Link className="icon-circle" to={chatTo} aria-label="Open chat" style={{ position: "relative" }}>
        <FaFacebookMessenger />
        {messageCount > 0 ? <span className="badge">{messageCount}</span> : null}
      </Link>
    </>
  );
}
