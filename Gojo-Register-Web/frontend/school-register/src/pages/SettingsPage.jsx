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
  FaChartLine,
  FaChevronDown,
} from "react-icons/fa";
import axios from "axios";
import { BACKEND_BASE } from "../config";
import useDarkMode from "../hooks/useDarkMode";
import RegisterSidebar from "../components/RegisterSidebar";

function SettingsPage() {
  const storedAdmin = (() => {
    try {
      return JSON.parse(localStorage.getItem("admin") || localStorage.getItem("registrar") || "{}") || {};
    } catch {
      return {};
    }
  })();

  const [admin, setAdmin] = useState(storedAdmin);
  const [selectedFile, setSelectedFile] = useState(null);
  const [profileImage, setProfileImage] = useState(storedAdmin.profileImage || "/default-profile.png");
  const [darkMode, toggleDarkMode] = useDarkMode();
  const [name, setName] = useState(storedAdmin.name || "");
  const [username, setUsername] = useState(storedAdmin.username || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();
  const [unreadSenders, setUnreadSenders] = useState({});
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [postNotifications, setPostNotifications] = useState([]);
  const [showPostDropdown, setShowPostDropdown] = useState(false);

  const adminId = admin.userId;

  const fetchPostNotifications = async () => {
    if (!adminId) return;

    try {
      const res = await axios.get(`${BACKEND_BASE}/api/get_post_notifications/${adminId}`);
      const notifications = Array.isArray(res.data) ? res.data : Object.values(res.data || {});

      if (notifications.length === 0) {
        setPostNotifications([]);
        return;
      }

      const [usersRes, adminsRes] = await Promise.all([
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"),
        axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/School_Admins.json"),
      ]);

      const users = usersRes.data || {};
      const admins = adminsRes.data || {};

      const findAdminUser = (notificationAdminId) => {
        const schoolAdmin = admins[notificationAdminId];
        if (!schoolAdmin) return null;
        return Object.values(users).find((user) => user.userId === schoolAdmin.userId);
      };

      const enriched = notifications.map((notification) => {
        const posterUser = findAdminUser(notification.adminId);

        return {
          ...notification,
          notificationId:
            notification.notificationId ||
            notification.id ||
            `${notification.postId}_${notification.adminId}`,
          adminName: posterUser?.name || "Unknown Admin",
          adminProfile: posterUser?.profileImage || "/default-profile.png",
        };
      });

      setPostNotifications(enriched);
    } catch (err) {
      console.error("Post notification fetch failed", err);
      setPostNotifications([]);
    }
  };

  useEffect(() => {
    if (!adminId) return;

    fetchPostNotifications();
    const interval = setInterval(fetchPostNotifications, 5000);

    return () => clearInterval(interval);
  }, [adminId]);

  const handleFileChange = (e) => setSelectedFile(e.target.files[0] || null);

  const persistAdmin = (updatedAdmin) => {
    setAdmin(updatedAdmin);
    localStorage.setItem("admin", JSON.stringify(updatedAdmin));
    localStorage.setItem("registrar", JSON.stringify(updatedAdmin));
  };

  const handleProfileSubmit = async () => {
    if (!selectedFile) {
      alert("Select an image first.");
      return;
    }

    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onloadend = async () => {
        const base64Image = reader.result;
        await axios.patch(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${admin.userId}.json`,
          { profileImage: base64Image }
        );

        const updatedAdmin = { ...admin, profileImage: base64Image };
        persistAdmin(updatedAdmin);
        setProfileImage(base64Image);
        setSelectedFile(null);
        alert("Profile image updated!");
      };
    } catch (err) {
      console.error("Error updating profile image:", err);
    }
  };

  const handleInfoUpdate = async () => {
    if (!name || !username) {
      alert("Name and Username required!");
      return;
    }

    try {
      await axios.patch(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${admin.userId}.json`,
        { name, username }
      );

      const updatedAdmin = { ...admin, name, username };
      persistAdmin(updatedAdmin);
      alert("Profile info updated!");
    } catch (err) {
      console.error("Error updating info:", err);
    }
  };

  const handlePasswordChange = async () => {
    if (!password || !confirmPassword) {
      alert("Fill both password fields.");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    try {
      await axios.patch(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${admin.userId}.json`,
        { password }
      );
      setPassword("");
      setConfirmPassword("");
      alert("Password updated successfully!");
    } catch (err) {
      console.error("Error updating password:", err);
    }
  };

  const handleClick = () => {
    navigate("/all-chat");
  };

  // ---------------- FETCH UNREAD MESSAGES ----------------
  const fetchUnreadMessages = async () => {
    if (!admin.userId) return;

    const senders = {};

    try {
      // 1) USERS (names & images)
      const usersRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"
      );
      const usersData = usersRes.data || {};

      const findUserByUserId = (userId) => {
        return Object.values(usersData).find((u) => u.userId === userId);
      };

      const getUnreadCount = async (userId) => {
        const key1 = `${admin.userId}_${userId}`;
        const key2 = `${userId}_${admin.userId}`;

        const [r1, r2] = await Promise.all([
          axios.get(
            `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`
          ),
          axios.get(
            `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`
          ),
        ]);

        const msgs = [...Object.values(r1.data || {}), ...Object.values(r2.data || {})];

        return msgs.filter((m) => m.receiverId === admin.userId && !m.seen).length;
      };

      // TEACHERS
      const teachersRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"
      );

      for (const k in teachersRes.data || {}) {
        const t = teachersRes.data[k];
        const unread = await getUnreadCount(t.userId);

        if (unread > 0) {
          const user = findUserByUserId(t.userId);

          senders[t.userId] = {
            type: "teacher",
            name: user?.name || "Teacher",
            profileImage: user?.profileImage || "/default-profile.png",
            count: unread,
          };
        }
      }

      // STUDENTS
      const studentsRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json"
      );

      for (const k in studentsRes.data || {}) {
        const s = studentsRes.data[k];
        const unread = await getUnreadCount(s.userId);

        if (unread > 0) {
          const user = findUserByUserId(s.userId);

          senders[s.userId] = {
            type: "student",
            name: user?.name || s.name || "Student",
            profileImage: user?.profileImage || s.profileImage || "/default-profile.png",
            count: unread,
          };
        }
      }

      // PARENTS
      const parentsRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Parents.json"
      );

      for (const k in parentsRes.data || {}) {
        const p = parentsRes.data[k];
        const unread = await getUnreadCount(p.userId);

        if (unread > 0) {
          const user = findUserByUserId(p.userId);

          senders[p.userId] = {
            type: "parent",
            name: user?.name || p.name || "Parent",
            profileImage: user?.profileImage || p.profileImage || "/default-profile.png",
            count: unread,
          };
        }
      }

      setUnreadSenders(senders);
    } catch (err) {
      console.error("Unread fetch failed:", err);
    }
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

  useEffect(() => {
    if (!admin.userId) return;

    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 5000);

    return () => clearInterval(interval);
  }, [admin.userId]);

  const markMessagesAsSeen = async (userId) => {
    const key1 = `${admin.userId}_${userId}`;
    const key2 = `${userId}_${admin.userId}`;

    const [r1, r2] = await Promise.all([
      axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`
      ),
      axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`
      ),
    ]);

    const updates = {};

    const collectUpdates = (data, basePath) => {
      Object.entries(data || {}).forEach(([msgId, msg]) => {
        if (msg.receiverId === admin.userId && !msg.seen) {
          updates[`${basePath}/${msgId}/seen`] = true;
        }
      });
    };

    collectUpdates(r1.data, `Chats/${key1}/messages`);
    collectUpdates(r2.data, `Chats/${key2}/messages`);

    if (Object.keys(updates).length > 0) {
      await axios.patch(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/.json",
        updates
      );
    }
  };

  // badge counts (match MyPosts UI)
  const messageCount = Object.values(unreadSenders || {}).reduce((acc, s) => acc + (s.count || 0), 0);
  const totalNotifications = (postNotifications?.length || 0) + messageCount;
  const cardStyle = {
    width: "min(100%, 760px)",
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    borderRadius: 22,
    boxShadow: "var(--shadow-panel)",
    color: "var(--text-primary)",
  };
  const mutedTextStyle = {
    color: "var(--text-secondary)",
  };
  const inputStyle = {
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    fontSize: 14,
  };
  const primaryButtonStyle = {
    padding: "12px 18px",
    borderRadius: "12px",
    border: "1px solid var(--accent-strong)",
    background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 800,
    boxShadow: "var(--shadow-glow)",
  };
  const toggleButtonStyle = {
    width: 68,
    height: 38,
    borderRadius: 999,
    border: `1px solid ${darkMode ? "var(--border-strong)" : "var(--border-soft)"}`,
    background: darkMode
      ? "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)"
      : "linear-gradient(135deg, var(--surface-muted) 0%, var(--surface-accent) 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: darkMode ? "flex-end" : "flex-start",
    padding: 4,
    cursor: "pointer",
    boxShadow: darkMode ? "var(--shadow-glow)" : "var(--shadow-soft)",
  };
  const toggleKnobStyle = {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#ffffff",
    boxShadow: "0 6px 14px rgba(15,23,42,0.22)",
  };

  return (
    <div className="dashboard-page" style={{ minHeight: "100vh", background: "var(--page-bg)", color: "var(--text-primary)" }}>
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
        style={{ background: "var(--page-bg)" }}
      >
        {/* SIDEBAR */}
        <RegisterSidebar user={admin} sticky fullHeight />
        {/* MAIN CONTENT */}
        <div
          className="main-content"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "34px 28px 60px",
            width: "100%",
            gap: "24px",
          }}
        >
          <div
            style={{
              ...cardStyle,
              padding: "26px 28px",
              background: "linear-gradient(135deg, var(--surface-accent) 0%, var(--surface-panel) 100%)",
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)" }}>Settings</div>
            <div style={{ marginTop: 8, fontSize: 14, ...mutedTextStyle }}>
              Manage account details, security, and appearance. Dark mode now applies across the register pages from one standard toggle.
            </div>
          </div>

          {/* Profile Image */}
          <div
            style={{
              ...cardStyle,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "30px",
            }}
          >
            <div style={{ alignSelf: "flex-start", marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Profile Photo</div>
              <div style={{ marginTop: 4, fontSize: 13, ...mutedTextStyle }}>Update the picture shown in the top bar and sidebar.</div>
            </div>
            <img
              src={profileImage}
              alt="profile"
              style={{
                width: "150px",
                height: "150px",
                borderRadius: "50%",
                objectFit: "cover",
                marginBottom: "15px",
                border: "4px solid var(--border-strong)",
                boxShadow: "var(--shadow-glow)",
              }}
            />
            <input type="file" onChange={handleFileChange} />
            <button
              onClick={handleProfileSubmit}
              style={{ ...primaryButtonStyle, marginTop: 15 }}
            >
              Update Profile Image
            </button>
          </div>

          {/* Name / Username */}
          <div
            style={{
              ...cardStyle,
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              padding: "30px",
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Profile Information</div>
              <div style={{ marginTop: 4, fontSize: 13, ...mutedTextStyle }}>Keep your name and username current across your register profile.</div>
            </div>
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
            />
            <button
              onClick={handleInfoUpdate}
              style={primaryButtonStyle}
            >
              Update Info
            </button>
          </div>

          {/* Password */}
          <div
            style={{
              ...cardStyle,
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              padding: "30px",
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Security</div>
              <div style={{ marginTop: 4, fontSize: 13, ...mutedTextStyle }}>Use a new password to keep the register account protected.</div>
            </div>
            <input
              type="password"
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
            />
            <button
              onClick={handlePasswordChange}
              style={primaryButtonStyle}
            >
              Change Password
            </button>
          </div>

          {/* Dark Mode */}
          <div
            style={{
              ...cardStyle,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "15px",
              padding: "22px 24px",
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Appearance</div>
              <div style={{ marginTop: 4, fontSize: 13, ...mutedTextStyle }}>
                {darkMode ? "Dark mode is active across the register interface." : "Light mode is active across the register interface."}
              </div>
            </div>
            <button type="button" onClick={toggleDarkMode} style={toggleButtonStyle} aria-label="Toggle dark mode">
              <span style={toggleKnobStyle} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;