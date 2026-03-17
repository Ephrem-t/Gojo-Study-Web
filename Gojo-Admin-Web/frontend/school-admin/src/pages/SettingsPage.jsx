import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import useDarkMode from "../hooks/useDarkMode";
import Sidebar from "../components/Sidebar";

function SettingsPage() {
  const [admin, setAdmin] = useState(
    JSON.parse(localStorage.getItem("admin")) || {}
  );
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
  const [unreadSenders, setUnreadSenders] = useState([]);
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);

  // POST NOTIFICATIONS
  const [postNotifications, setPostNotifications] = useState([]);
  const [showPostDropdown, setShowPostDropdown] = useState(false);

  const adminId = admin.userId;

  // Fetch post notifications and enrich each with poster's name & profile image
  const fetchPostNotifications = async () => {
  if (!adminId) return;

  try {
    // 1️⃣ Get post notifications
    const res = await axios.get(
      `http://127.0.0.1:5000/api/get_post_notifications/${adminId}`
    );

    let notifications = Array.isArray(res.data)
      ? res.data
      : Object.values(res.data || {});

    if (notifications.length === 0) {
      setPostNotifications([]);
      return;
    }

    // 2️⃣ Fetch Users
    const usersRes = await axios.get(
      "https://bale-house-rental-default-rtdb.firebaseio.com/Users.json"
    );

    const users = usersRes.data || {};

    // 3️⃣ Helpers
    const findAdminUser = (posterId) =>
      Object.values(users).find(
        (u) => u.userId === posterId || u.username === posterId
      );

    // 4️⃣ Enrich notifications
    const enriched = notifications.map((n) => {
      const posterUser = findAdminUser(n.adminId);

      return {
        ...n,
        notificationId:
          n.notificationId ||
          n.id ||
          `${n.postId}_${n.adminId}`,

        adminName: posterUser?.name || n.adminName || "Unknown Admin",
        adminProfile:
          posterUser?.profileImage || n.adminProfile || "/default-profile.png",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId]);

 const handleNotificationClick = async (notification) => {
  try {
    await axios.post(
      "http://127.0.0.1:5000/api/mark_post_notification_read",
      {
        notificationId: notification.notificationId,
        adminId: admin.userId,
      }
    );
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
          `https://bale-house-rental-default-rtdb.firebaseio.com/Users/${admin.userId}.json`,
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
        `https://bale-house-rental-default-rtdb.firebaseio.com/Users/${admin.userId}.json`,
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
        `https://bale-house-rental-default-rtdb.firebaseio.com/Users/${admin.userId}.json`,
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

  useEffect(() => {
    const fetchUnreadSenders = async () => {
      try {
        const response = await fetch("/api/unreadSenders");
        const data = await response.json();
        setUnreadSenders(data);
      } catch (err) {
        // ignore
      }
    };
    fetchUnreadSenders();
  }, []);

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
        "https://bale-house-rental-default-rtdb.firebaseio.com/Users.json"
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
            `https://bale-house-rental-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`
          ),
          axios.get(
            `https://bale-house-rental-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`
          ),
        ]);

        const msgs = [...Object.values(r1.data || {}), ...Object.values(r2.data || {})];

        return msgs.filter((m) => m.receiverId === admin.userId && !m.seen).length;
      };

      // TEACHERS
      const teachersRes = await axios.get(
        "https://bale-house-rental-default-rtdb.firebaseio.com/Teachers.json"
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
        "https://bale-house-rental-default-rtdb.firebaseio.com/Students.json"
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
        "https://bale-house-rental-default-rtdb.firebaseio.com/Parents.json"
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
        `https://bale-house-rental-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`
      ),
      axios.get(
        `https://bale-house-rental-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`
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
        "https://bale-house-rental-default-rtdb.firebaseio.com/.json",
        updates
      );
    }
  };

  // badge counts (match MyPosts UI)
  const messageCount = Object.values(unreadSenders || {}).reduce((acc, s) => acc + (s.count || 0), 0);
  const totalNotifications = (postNotifications?.length || 0) + messageCount;

  return (
    <div className="dashboard-page">
      <div
        className="google-dashboard"
        style={{ display: "flex", gap: 14, padding: "4px 14px", height: "calc(100vh - 73px)", overflow: "hidden", background: darkMode ? "#2c2c2c" : "#f1f1f1", width: "100%", boxSizing: "border-box" }}
      >
        {/* SIDEBAR */}
        <Sidebar admin={admin} />

        {/* MAIN CONTENT */}
        <div
          className="main-content"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "0 20px 20px",
            width: "100%",
            gap: "30px",
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
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