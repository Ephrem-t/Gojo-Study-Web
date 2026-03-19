import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import useDarkMode from "../hooks/useDarkMode";
import {
} from "react-icons/fa";
import "../styles/global.css";
import { getRtdbRoot } from "../api/rtdbScope";
import Sidebar from "./Sidebar";

const API_BASE = "http://127.0.0.1:5000/api";
const RTDB_BASE = getRtdbRoot();

function SettingsPage() {
  const [teacher, setTeacher] = useState(null);
  const [profileImage, setProfileImage] = useState("/default-profile.png");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [darkMode, toggleDarkMode] = useDarkMode();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = useNavigate();

  // Messenger state (same behavior as Dashboard)
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]); // conversations with unread messages for this teacher

  // Utility for local notification "seen" persistence
  const getSeenNotifications = (teacherId) => {
    return JSON.parse(localStorage.getItem(`seen_notifications_${teacherId}`)) || [];
  };
  const markNotificationSeen = (teacherId, postId) => {
    const seen = getSeenNotifications(teacherId);
    if (!seen.includes(postId)) {
      localStorage.setItem(
        `seen_notifications_${teacherId}`,
        JSON.stringify([...seen, postId])
      );
    }
  };

  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  useEffect(() => {
    if (teacher) {
      setProfileImage(teacher.profileImage || "/default-profile.png");
      setName(teacher.name || "");
      setUsername(teacher.username || "");
      // fetch messenger conversations for settings page topbar
      fetchConversations(teacher);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher]);

  const handleFileChange = (e) => setSelectedFile(e.target.files[0]);

  const handleProfileSubmit = async () => {
    if (!selectedFile) return alert("Select an image first.");
    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onloadend = async () => {
        const base64Image = reader.result;
        await axios.patch(
          `${RTDB_BASE}/Users/${teacher.userId}.json`,
          { profileImage: base64Image }
        );
        const updatedTeacher = { ...teacher, profileImage: base64Image };
        localStorage.setItem("teacher", JSON.stringify(updatedTeacher));
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
        `${RTDB_BASE}/Users/${teacher.userId}.json`,
        { name, username }
      );
      const updatedTeacher = { ...teacher, name, username };
      localStorage.setItem("teacher", JSON.stringify(updatedTeacher));
      setTeacher(updatedTeacher);
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
        `${RTDB_BASE}/Users/${teacher.userId}.json`,
        { password }
      );
      setPassword("");
      setConfirmPassword("");
      alert("Password updated successfully!");
    } catch (err) {
      console.error("Error updating password:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // Notification fetch
 

  // --- FETCH NOTIFICATIONS: posts + unread messages ---
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // 1. Fetch posts
        const res = await axios.get(`${API_BASE}/get_posts`);
        let postsData = res.data || [];
        if (!Array.isArray(postsData) && typeof postsData === "object") postsData = Object.values(postsData);

        const [adminsRes, usersRes, chatsRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/School_Admins.json`),
          axios.get(`${RTDB_BASE}/Users.json`),
          axios.get(`${RTDB_BASE}/Chats.json`),
        ]);
        const schoolAdmins = adminsRes.data || {};
        const users = usersRes.data || {};
        const chats = chatsRes.data || {};

        // Get teacher from localStorage so we know who's seen what
        const teacher = JSON.parse(localStorage.getItem("teacher"));
        const seenPosts = getSeenPosts(teacher?.userId);

        // --- Helper to resolve admin info ---
        const resolveAdminInfo = (post) => {
          const adminId = post.adminId || post.posterAdminId || post.poster || post.admin || null;
          if (adminId && schoolAdmins[adminId]) {
            const schoolAdminRec = schoolAdmins[adminId];
            const userKey = schoolAdminRec.userId;
            const userRec = users[userKey] || null;
            const name = (userRec && userRec.name) || schoolAdminRec.name || post.adminName || "Admin";
            const profile = (userRec && userRec.profileImage) || schoolAdminRec.profileImage || post.adminProfile || "/default-profile.png";
            return { name, profile };
          }
          return { name: post.adminName || "Admin", profile: post.adminProfile || "/default-profile.png" };
        };

        // --- Post notifications (unseen only) ---
        const postNotifs = postsData
          .slice()
          .sort((a, b) => {
            const ta = a.time ? new Date(a.time).getTime() : 0;
            const tb = b.time ? new Date(b.time).getTime() : 0;
            return tb - ta;
          })
          .filter((post) => post.postId && !seenPosts.includes(post.postId))
          .slice(0, 5)
          .map((post) => {
            const info = resolveAdminInfo(post);
            return {
              id: post.postId,
              type: "post",
              title: post.message?.substring(0, 50) || "Untitled post",
              adminName: info.name,
              adminProfile: info.profile,
            };
          });

        // --- Message notifications (unread only, for this teacher) ---
        let messageNotifs = [];
        if (teacher && teacher.userId) {
          Object.entries(chats).forEach(([chatId, chat]) => {
            const unreadMap = chat.unread || {};
            const unreadForMe = unreadMap[teacher.userId] || 0;
            if (!unreadForMe) return;
            const participants = chat.participants || {};
            const otherKey = Object.keys(participants).find((p) => p !== teacher.userId);
            let otherUser = users[otherKey] || { userId: otherKey, name: otherKey, profileImage: "/default-profile.png" };
            messageNotifs.push({
              chatId,
              type: "message",
              displayName: otherUser.name || otherUser.username || otherKey,
              profile: otherUser.profileImage || otherUser.profile || "/default-profile.png",
              unreadForMe,
            });
          });
        }

        // Only show up to 5 notifications (posts + messages, most recent first)
        const allNotifs = [...postNotifs, ...messageNotifs].slice(0, 5);
        setNotifications(allNotifs);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };
    fetchNotifications();
  }, []);



// --- Handler to remove notification after clicked (and mark seen) ---
const handleNotificationClick = async (notif) => {
  if (!teacher) return;
  if (notif.type === "post" && notif.id) {
    saveSeenPost(teacher.userId, notif.id);
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    setShowNotifications(false);
    // Optionally: navigate to dashboard and highlight post
    navigate("/dashboard");
  } else if (notif.type === "message" && notif.chatId) {
    setNotifications((prev) => prev.filter((n) => n.chatId !== notif.chatId));
    setShowNotifications(false);
    // Mark messages as read in DB
    try {
      await axios.put(`${RTDB_BASE}/Chats/${notif.chatId}/unread/${teacher.userId}.json`, null);
    } catch (err) {}
    navigate("/all-chat");
  }
};

function getSeenPosts(teacherId) {
  return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
}

function saveSeenPost(teacherId, postId) {
  const seen = getSeenPosts(teacherId);
  if (!seen.includes(postId)) {
    localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seen, postId]));
  }
}

  // ---------------- MESSENGER FUNCTIONS (same behavior as Dashboard) ----------------
  const fetchConversations = async (currentTeacher = teacher) => {
    try {
      const t = currentTeacher || JSON.parse(localStorage.getItem("teacher"));
      if (!t || !t.userId) {
        setConversations([]);
        return;
      }

      const [chatsRes, usersRes] = await Promise.all([
        axios.get(`${RTDB_BASE}/Chats.json`),
        axios.get(`${RTDB_BASE}/Users.json`),
      ]);
      const chats = chatsRes.data || {};
      const users = usersRes.data || {};

      const usersByKey = users || {};
      const userKeyByUserId = {};
      Object.entries(usersByKey).forEach(([pushKey, u]) => {
        if (u && u.userId) userKeyByUserId[u.userId] = pushKey;
      });

      const convs = Object.entries(chats)
        .map(([chatId, chat]) => {
          const unreadMap = chat.unread || {};
          const unreadForMe = unreadMap[t.userId] || 0;
          if (!unreadForMe) return null;

          const participants = chat.participants || {};
          const otherKeyCandidate = Object.keys(participants || {}).find((p) => p !== t.userId);
          if (!otherKeyCandidate) return null;

          let otherPushKey = otherKeyCandidate;
          let otherRecord = usersByKey[otherPushKey];

          if (!otherRecord) {
            const mapped = userKeyByUserId[otherKeyCandidate];
            if (mapped) {
              otherPushKey = mapped;
              otherRecord = usersByKey[mapped];
            }
          }

          if (!otherRecord) {
            otherRecord = { userId: otherKeyCandidate, name: otherKeyCandidate, profileImage: "/default-profile.png" };
          }

          const contact = {
            pushKey: otherPushKey,
            userId: otherRecord.userId || otherKeyCandidate,
            name: otherRecord.name || otherRecord.username || otherKeyCandidate,
            profileImage: otherRecord.profileImage || otherRecord.profile || "/default-profile.png",
          };

          const lastMessage = chat.lastMessage || {};

          return {
            chatId,
            contact,
            displayName: contact.name,
            profile: contact.profileImage,
            lastMessageText: lastMessage.text || "",
            lastMessageTime: lastMessage.timeStamp || lastMessage.time || null,
            unreadForMe,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

      setConversations(convs);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setConversations([]);
    }
  };

  const handleMessengerToggle = async () => {
    setShowMessenger((s) => !s);
    await fetchConversations();
  };

  const handleOpenConversation = async (conv, index) => {
    if (!teacher || !conv) return;
    const { chatId, contact } = conv;

    // Navigate to AllChat with contact + chatId and indicate settings tab
    navigate("/all-chat", { state: { contact, chatId, tab: "settings" } });

    // Clear unread in RTDB for this teacher (permanent)
    try {
      await axios.put(`${RTDB_BASE}/Chats/${chatId}/unread/${teacher.userId}.json`, null);
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }

    // Remove from UI
    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };

  // Messenger badge: count unread messages only (from notifications)
  const totalUnreadMessages = notifications.filter((n) => n.type === "message").reduce((sum, n) => sum + (n.unreadForMe || 0), 0);

  return (
    <div
      className="dashboard-page"
      style={{
        background: "var(--page-bg)",
        minHeight: "100vh",
        height: "100vh",
        overflow: "hidden",
        color: "var(--text-primary)",
        "--surface-panel": "#ffffff",
        "--surface-accent": "#eff6ff",
        "--surface-muted": "#f8fafc",
        "--surface-strong": "#e2e8f0",
        "--page-bg": "#f5f8ff",
        "--border-soft": "#e2e8f0",
        "--border-strong": "#cbd5e1",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": "#2563eb",
        "--accent-soft": "#dbeafe",
        "--accent-strong": "#1d4ed8",
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
        "--shadow-soft": "0 10px 24px rgba(15, 23, 42, 0.08)",
      }}
    >
      <div className="google-dashboard" style={{ display: "flex", gap: 12, padding: "12px", height: "calc(100vh - 73px)", overflow: "hidden" }}>
        <Sidebar
          active="settings"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          teacher={teacher}
          handleLogout={handleLogout}
        />

        <div
          className="teacher-sidebar-spacer"
          style={{
            width: "var(--sidebar-width)",
            minWidth: "var(--sidebar-width)",
            flex: "0 0 var(--sidebar-width)",
            pointerEvents: "none",
          }}
        />

        {/* Main content */}
        <div
          className="main-content"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "flex-start",
            padding: "0",
            width: "100%",
            minWidth: 0,
            height: "100%",
            overflowY: "auto",
          }}
        >
          <div style={{ padding: "16px 18px 20px", width: "100%", maxWidth: 1320, margin: 0 }}>
            <div className="section-header-card" style={{ marginBottom: 14 }}>
              <h2 className="section-header-card__title" style={{ fontSize: 24 }}>Settings</h2>
              <div className="section-header-card__meta">
                <span>{teacher?.name || "Teacher"}</span>
                <span className="section-header-card__chip">Account</span>
              </div>
            </div>

            <div
              style={{
                marginBottom: 14,
                background: "linear-gradient(135deg, #eff6ff, #f8fafc)",
                border: "1px solid var(--border-soft)",
                borderRadius: 14,
                padding: "12px 14px",
                color: "var(--text-secondary)",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Manage your profile image, account details, password, and preferences.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 14,
              }}
            >
              <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 14, padding: 16, boxShadow: "var(--shadow-soft)" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "var(--text-secondary)" }}>Profile Image</h3>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <img
                    src={profileImage}
                    alt="profile"
                    style={{
                      width: "130px",
                      height: "130px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      marginBottom: "12px",
                      border: "3px solid #4b6cb7"
                    }}
                  />
                  <input type="file" onChange={handleFileChange} style={{ width: "100%", marginBottom: 10 }} />
                  <button onClick={handleProfileSubmit} style={{
                    padding: "10px 14px", borderRadius: "999px",
                    border: "none", background: "var(--accent-strong)", color: "#fff", cursor: "pointer", fontWeight: 700
                  }}>
                    Update Profile Image
                  </button>
                </div>
              </div>

              <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 14, padding: 16, boxShadow: "var(--shadow-soft)" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "var(--text-secondary)" }}>Basic Info</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)}
                    style={{ padding: "10px", borderRadius: "10px", border: "1px solid var(--border-strong)", background: "#f8fafc" }} />
                  <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)}
                    style={{ padding: "10px", borderRadius: "10px", border: "1px solid var(--border-strong)", background: "#f8fafc" }} />
                  <button onClick={handleInfoUpdate} style={{
                    padding: "10px 14px", borderRadius: "999px",
                    border: "none", background: "var(--accent-strong)", color: "#fff", cursor: "pointer", fontWeight: 700
                  }}>Update Info</button>
                </div>
              </div>

              <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 14, padding: 16, boxShadow: "var(--shadow-soft)" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "var(--text-secondary)" }}>Password</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input type="password" placeholder="New Password" value={password} onChange={e => setPassword(e.target.value)}
                    style={{ padding: "10px", borderRadius: "10px", border: "1px solid var(--border-strong)", background: "#f8fafc" }} />
                  <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    style={{ padding: "10px", borderRadius: "10px", border: "1px solid var(--border-strong)", background: "#f8fafc" }} />
                  <button onClick={handlePasswordChange} style={{
                    padding: "10px 14px", borderRadius: "999px",
                    border: "none", background: "var(--accent-strong)", color: "#fff", cursor: "pointer", fontWeight: 700
                  }}>Change Password</button>
                </div>
              </div>

              <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 14, padding: 16, boxShadow: "var(--shadow-soft)" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "var(--text-secondary)" }}>Preferences</h3>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>Dark Mode</label>
                  <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} style={{ width: 18, height: 18 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;