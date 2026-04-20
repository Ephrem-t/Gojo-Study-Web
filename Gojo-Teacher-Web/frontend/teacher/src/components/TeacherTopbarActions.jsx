import React from "react";
import { Link } from "react-router-dom";
import { FaBell, FaCog, FaFacebookMessenger } from "react-icons/fa";
import ProfileAvatar from "./ProfileAvatar";

export default function TeacherTopbarActions({
  showNotifications = false,
  setShowNotifications,
  notificationCount = 0,
  postNotifications = [],
  messageNotifications = [],
  onPostClick,
  onMessageClick,
  onOpenMessages,
  messageCount = 0,
  settingsTo = "/settings",
  profileImage = "/default-profile.png",
  profileName = "Teacher",
}) {
  const hasNotifications = (postNotifications?.length || 0) + (messageNotifications?.length || 0) > 0;

  const closeNotifications = () => setShowNotifications?.(false);
  const toggleNotifications = () => setShowNotifications?.((current) => !current);

  return (
    <>
      <div className="icon-circle" style={{ position: "relative" }}>
        <div
          onClick={toggleNotifications}
          style={{ cursor: "pointer", position: "relative" }}
          aria-label="Show notifications"
          tabIndex={0}
          role="button"
          onKeyPress={(event) => {
            if (event.key === "Enter") {
              toggleNotifications();
            }
          }}
        >
          <FaBell size={24} />
          {notificationCount > 0 ? (
            <span
              style={{
                position: "absolute",
                top: -5,
                right: -5,
                background: "red",
                color: "white",
                borderRadius: "50%",
                width: 18,
                height: 18,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {notificationCount}
            </span>
          ) : null}
        </div>

        {showNotifications ? (
          <>
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.08)",
                zIndex: 3000,
              }}
              onClick={closeNotifications}
            />
            <div
              className="notification-popup"
              style={
                typeof window !== "undefined" && window.innerWidth <= 600
                  ? {
                      position: "fixed",
                      left: "50%",
                      top: "8%",
                      transform: "translate(-50%, 0)",
                      width: "90vw",
                      maxWidth: 340,
                      zIndex: 3001,
                      background: "#fff",
                      borderRadius: 12,
                      boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
                      maxHeight: "70vh",
                      overflowY: "auto",
                      padding: 12,
                    }
                  : {
                      position: "fixed",
                      top: "calc(var(--topbar-height, 56px) + 8px)",
                      right: 14,
                      width: 300,
                      maxHeight: 400,
                      overflowY: "auto",
                      background: "#fff",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
                      borderRadius: 8,
                      zIndex: 3001,
                    }
              }
              onClick={(event) => event.stopPropagation()}
            >
              {postNotifications?.map((post, index) => (
                <div
                  key={post.id || post.postId || index}
                  onClick={() => {
                    onPostClick?.(post, index);
                    closeNotifications();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 15px",
                    borderBottom: "1px solid #eee",
                    cursor: "pointer",
                  }}
                >
                  <img
                    src={post.adminProfile || "/default-profile.png"}
                    alt={post.adminName || "Admin"}
                    style={{ width: 35, height: 35, borderRadius: "50%", marginRight: 10 }}
                    onError={(event) => {
                      event.currentTarget.src = "/default-profile.png";
                    }}
                  />
                  <div>
                    <strong>{post.adminName || "Admin"}</strong>
                    <p style={{ margin: 0, fontSize: 12 }}>{post.title || post.message || "New post"}</p>
                  </div>
                </div>
              ))}

              {messageNotifications?.map((message, index) => (
                <div
                  key={message.chatId || message.id || message.userId || index}
                  onClick={() => {
                    onMessageClick?.(message, index);
                    closeNotifications();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 15px",
                    borderBottom: "1px solid #eee",
                    cursor: "pointer",
                  }}
                >
                  <img
                    src={message.profile || message.adminProfile || "/default-profile.png"}
                    alt={message.displayName || message.adminName || "User"}
                    style={{ width: 35, height: 35, borderRadius: "50%", marginRight: 10 }}
                    onError={(event) => {
                      event.currentTarget.src = "/default-profile.png";
                    }}
                  />
                  <div>
                    <strong>{message.displayName || message.adminName || "User"}</strong>
                    <p style={{ margin: 0, fontSize: 12, color: "#0b78f6" }}>
                      {message.title || message.message || "New message"}
                    </p>
                  </div>
                </div>
              ))}

              {!hasNotifications ? <div style={{ padding: 15 }}>No notifications</div> : null}
            </div>
          </>
        ) : null}
      </div>

      <div className="icon-circle" style={{ position: "relative", marginLeft: 12 }}>
        <div onClick={onOpenMessages} style={{ cursor: "pointer", position: "relative" }}>
          <FaFacebookMessenger size={22} />
          {messageCount > 0 ? (
            <span
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                background: "#f60b0b",
                color: "#fff",
                borderRadius: "50%",
                minWidth: 18,
                height: 18,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 5px",
              }}
            >
              {messageCount}
            </span>
          ) : null}
        </div>
      </div>

      <Link className="icon-circle" to={settingsTo}>
        <FaCog />
      </Link>
      <ProfileAvatar
        src={profileImage || "/default-profile.png"}
        name={profileName}
        alt="teacher"
        className="profile-img"
      />
    </>
  );
}
