import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaFacebookMessenger,
  FaSearch,
  FaCalendarAlt,
} from "react-icons/fa";
import axios from "axios";
import { BACKEND_BASE } from "../config";
import useDarkMode from "../hooks/useDarkMode";
import useTopbarNotifications from "../hooks/useTopbarNotifications";
import { getFinanceDbRoot, normalizeFinanceSession } from "../utils/financeSession";

function SettingsPage() {
  const [admin, setAdmin] = useState(() => {
    try {
      const stored = localStorage.getItem("finance") || localStorage.getItem("admin") || "{}";
      return normalizeFinanceSession(JSON.parse(stored));
    } catch {
      return normalizeFinanceSession({});
    }
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [profileImage, setProfileImage] = useState(
    admin.profileImage || "/default-profile.png"
  );
  const [darkMode, toggleDarkMode] = useDarkMode();

  const [name, setName] = useState(admin.name || "");
  const [username, setUsername] = useState(admin.username || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [showPostDropdown, setShowPostDropdown] = useState(false);

  const adminId = admin.userId;
  const DB_ROOT = getFinanceDbRoot(admin.schoolCode || "");
  const {
    unreadSenders,
    setUnreadSenders,
    unreadPosts: postNotifications,
    setUnreadPosts: setPostNotifications,
    messageCount,
    totalNotifications,
    markMessagesAsSeen,
    markPostAsSeen,
  } = useTopbarNotifications({
    dbRoot: DB_ROOT,
    currentUserId: admin.userId,
  });

 const handleNotificationClick = async (notification) => {
  try {
    await markPostAsSeen(notification.postId);
  } catch (err) {
    console.warn("Failed to delete notification:", err);
  }

  // 🔥 REMOVE FROM UI IMMEDIATELY
  setPostNotifications((prev) =>
    prev.filter((n) => n.notificationId !== notification.notificationId)
  );

  setShowPostDropdown(false);

  // ➜ Navigate to post
  navigate("/dashboard", {
    state: { postId: notification.postId },
  });
};
useEffect(() => {
  if (location.state?.postId) {
    setPostNotifications([]);
  }
}, []);


  useEffect(() => {
    const closeDropdown = (e) => {
      if (
        !e.target.closest(".icon-circle") &&
        !e.target.closest(".notification-dropdown")
      ) {
        setShowPostDropdown(false);
      }
    };

    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  // ------------------ rest of the component (unchanged) ------------------

  const handleFileChange = (e) => setSelectedFile(e.target.files[0]);

  const handleProfileSubmit = async () => {
    if (!selectedFile) return alert("Select an image first.");
    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onloadend = async () => {
        const base64Image = reader.result;
        await axios.patch(
          `${DB_ROOT}/Users/${admin.userId}.json`,
          { profileImage: base64Image }
        );
        const updatedAdmin = { ...admin, profileImage: base64Image };
        localStorage.setItem("admin", JSON.stringify(updatedAdmin));
        setProfileImage(base64Image);
        setSelectedFile(null);
        alert("Profile image updated!");
      };
    } catch (err) {
      console.error("Error updating profile image:", err);
    }
  };

  const handleInfoUpdate = async () => {
    if (!name || !username) return alert("Name and Username required!");
    try {
      await axios.patch(
        `${DB_ROOT}/Users/${admin.userId}.json`,
        { name, username }
      );
      const updatedAdmin = { ...admin, name, username };
      localStorage.setItem("admin", JSON.stringify(updatedAdmin));
      setAdmin(updatedAdmin);
      alert("Profile info updated!");
    } catch (err) {
      console.error("Error updating info:", err);
    }
  };

  const handlePasswordChange = async () => {
    if (!password || !confirmPassword) return alert("Fill both password fields.");
    if (password !== confirmPassword) return alert("Passwords do not match!");
    try {
      await axios.patch(
        `${DB_ROOT}/Users/${admin.userId}.json`,
        { password }
      );
      setPassword("");
      setConfirmPassword("");
      alert("Password updated successfully!");
    } catch (err) {
      console.error("Error updating password:", err);
    }
  };

  const toggleDropdown = () => {
    setShowMessageDropdown((prev) => !prev);
  };

  useEffect(() => {
    const closeDropdown = (e) => {
      setShowMessageDropdown(false);
    };

    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  const handleClick = () => {
    navigate("/all-chat");
  };

  // ---------------- CLOSE DROPDOWN WHEN CLICKING OUTSIDE ----------------
  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".messenger-dropdown")) {
        setShowMessageDropdown(false);
      }
    };

    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);


  return (
    <div className="dashboard-page">
      {/* ---------------- TOP NAVIGATION BAR ---------------- */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>

        {/* Search Bar */}
   

        <div className="nav-right">
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowPostDropdown((prev) => !prev);
            }}
          >
            <FaBell />
            {totalNotifications > 0 && (
              <span className="badge">{totalNotifications}</span>
            )}
            {showPostDropdown && (
              <div className="notification-dropdown" onClick={(e) => e.stopPropagation()} style={{
                  position: "absolute",
                  top: "45px",
                  right: "0",
                  width: "360px",
                  maxHeight: "420px",
                  overflowY: "auto",
                  background: "#fff",
                  borderRadius: 10,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                  zIndex: 1000,
                  padding: 6,
                }}>
                {totalNotifications === 0 ? (
                  <p className="muted">No new notifications</p>
                ) : (
                  <div>
                    {/* Posts section */}
                    {postNotifications.length > 0 && (
                      <div>
                        <div className="notification-section-title">Posts</div>
                        {postNotifications.map((n) => (
                          <div
                            key={n.notificationId}
                            className="notification-row"
                            onClick={async () => {
                              try {
                                await axios.post("http://127.0.0.1:5000/api/mark_post_notification_read", {
                                  notificationId: n.notificationId,
                                });
                              } catch (err) {
                                console.warn("Failed to mark notification:", err);
                              }

                              setPostNotifications((prev) => prev.filter((notif) => notif.notificationId !== n.notificationId));
                              setShowPostDropdown(false);
                              navigate("/dashboard", {
                                state: {
                                  postId: n.postId,
                                  posterName: n.adminName,
                                  posterProfile: n.adminProfile,
                                },
                              });
                            }}
                            style={{
                              padding: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              cursor: "pointer",
                              borderBottom: "1px solid #f0f0f0",
                              transition: "background 120ms ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                          >
                            <img src={n.adminProfile || "/default-profile.png"} alt={n.adminName} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: "block", marginBottom: 4 }}>{n.adminName}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{n.message}</p>
                            </div>
                            <div style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>{new Date(n.time || n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Messages section */}
                    {messageCount > 0 && (
                      <div>
                        <div className="notification-section-title" style={{ padding: '8px 10px', color: '#333', fontWeight: 700, background: '#fafafa', borderRadius: 6, margin: '8px 6px' }}>Messages</div>
                        {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                              <div
                                key={userId}
                                className="notification-row"
                                onClick={async () => {
                                  await markMessagesAsSeen(userId);
                                  setUnreadSenders((prev) => {
                                    const copy = { ...prev };
                                    delete copy[userId];
                                    return copy;
                                  });
                                  setShowPostDropdown(false);
                                  navigate("/all-chat", { state: { user: { userId, name: sender.name, profileImage: sender.profileImage, type: sender.type } } });
                                }}
                                style={{
                                  padding: 10,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  cursor: "pointer",
                                  borderBottom: "1px solid #f0f0f0",
                                  transition: "background 120ms ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                              >
                                <img src={sender.profileImage || "/default-profile.png"} alt={sender.name} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <strong style={{ display: "block", marginBottom: 4 }}>{sender.name}</strong>
                                  <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{sender.count} new message{sender.count > 1 && "s"}</p>
                                </div>
                              </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/all-chat") }>
            <FaFacebookMessenger />
            {messageCount > 0 && <span className="badge">{messageCount}</span>}
          </div>

          {/* Settings */}
          <Link className="icon-circle" to="/settings">
            <FaCog />
          </Link>

          {/* Profile */}
          <img
            src={admin.profileImage || "/default-profile.png"}
            alt="admin"
            className="profile-img"
          />
        </div>
      </nav>

      <div
        className="google-dashboard"
        style={{ background: darkMode ? "#2c2c2c" : "#f1f1f1" }}
      >
        {/* SIDEBAR */}
        <div
          className="google-sidebar"
          style={{ background: darkMode ? "#1a1a1a" : "#fff" }}
        >
          <div className="sidebar-profile">
            <div className="sidebar-img-circle">
              <img src={admin.profileImage || "/default-profile.png"} alt="profile" />
            </div>
            <h3>{admin.name}</h3>
            <p>{admin?.adminId || "username"}</p>
          </div>
          <div className="sidebar-menu">
            <Link className="sidebar-btn" to="/dashboard">
              <FaHome style={{ width: "28px", height: "28px" }} /> Home
            </Link>
            <Link className="sidebar-btn" to="/my-posts">
              <FaFileAlt /> My Posts
            </Link>
            <Link className="sidebar-btn" to="/teachers">
              <FaChalkboardTeacher /> Teachers
            </Link>
            <Link className="sidebar-btn" to="/students">
              <FaChalkboardTeacher /> Students
            </Link>
            <Link className="sidebar-btn" to="/schedule">
              <FaCalendarAlt /> Schedule
            </Link>
            <Link className="sidebar-btn" to="/parents">
              <FaChalkboardTeacher /> Parents
            </Link>
           <Link className="sidebar-btn" to="/registration-form" ><FaChalkboardTeacher /> Registration Form
                        </Link>
            <button
              className="sidebar-btn logout-btn"
              onClick={() => {
                localStorage.removeItem("admin");
                window.location.href = "/login";
              }}
            >
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div
          className="main-content"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "50px",
            width: "100%",
            gap: "30px",
          }}
        >
          <h2>Settings</h2>

          {/* Profile Image */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "30px",
              borderRadius: "12px",
              background: darkMode ? "#3a3a3a" : "#fff",
              boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
            }}
          >
            <img
              src={profileImage}
              alt="profile"
              style={{
                width: "150px",
                height: "150px",
                borderRadius: "50%",
                objectFit: "cover",
                marginBottom: "15px",
                border: "3px solid #4b6cb7",
              }}
            />
            <input type="file" onChange={handleFileChange} />
            <button
              onClick={handleProfileSubmit}
              style={{
                marginTop: "15px",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: "#4b6cb7",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Update Profile Image
            </button>
          </div>

          {/* Name / Username */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "30px",
              borderRadius: "12px",
              background: darkMode ? "#3a3a3a" : "#fff",
              boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
            }}
          >
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
            <button
              onClick={handleInfoUpdate}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: "#4b6cb7",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Update Info
            </button>
          </div>

          {/* Password */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "30px",
              borderRadius: "12px",
              background: darkMode ? "#3a3a3a" : "#fff",
              boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
            }}
          >
            <input
              type="password"
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
            <button
              onClick={handlePasswordChange}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: "#4b6cb7",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Change Password
            </button>
          </div>

          {/* Dark Mode */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              padding: "20px",
              borderRadius: "12px",
              background: darkMode ? "#3a3a3a" : "#fff",
              boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
            }}
          >
            <label style={{ fontSize: "18px", fontWeight: "500" }}>Dark Mode</label>
            <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;