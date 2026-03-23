import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaCamera, FaLock, FaMoon, FaPalette, FaSave, FaUserCog } from "react-icons/fa";
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
  const [userNodeKey, setUserNodeKey] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const [name, setName] = useState(admin.name || "");
  const [username, setUsername] = useState(admin.username || "");
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();
  const RTDB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";

  const cardStyle = {
    background: darkMode ? "#1f2937" : "#ffffff",
    borderRadius: 16,
    border: darkMode ? "1px solid #374151" : "1px solid #e5e7eb",
    boxShadow: darkMode ? "0 10px 24px rgba(0,0,0,0.28)" : "0 10px 24px rgba(15,23,42,0.08)",
    padding: 20,
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: darkMode ? "1px solid #4b5563" : "1px solid #d1d5db",
    outline: "none",
    background: darkMode ? "#111827" : "#f8fafc",
    color: darkMode ? "#f3f4f6" : "#111827",
    fontSize: 14,
  };

  const primaryButtonStyle = {
    border: "none",
    borderRadius: 999,
    padding: "10px 16px",
    background: "linear-gradient(135deg, #1d4ed8, #4f46e5)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };

  const profilePreview = useMemo(() => {
    if (!selectedFile) return profileImage;
    return URL.createObjectURL(selectedFile);
  }, [selectedFile, profileImage]);

  useEffect(() => {
    return () => {
      if (selectedFile && profilePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(profilePreview);
      }
    };
  }, [selectedFile, profilePreview]);

  const resolveUserNodeKey = async () => {
    if (!admin?.userId && !admin?.username) return "";
    const usersRes = await axios.get(`${RTDB_BASE}/Users.json`);
    const usersData = usersRes.data || {};
    const match = Object.entries(usersData).find(([, user]) => {
      const userId = String(user?.userId || "").trim();
      const uname = String(user?.username || "").trim();
      return (
        (admin?.userId && userId === String(admin.userId).trim()) ||
        (admin?.username && uname && uname === String(admin.username).trim())
      );
    });
    return match?.[0] || "";
  };

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      try {
        const key = await resolveUserNodeKey();
        if (!ignore) setUserNodeKey(key);
      } catch {
        if (!ignore) setUserNodeKey("");
      }
    };
    run();
    return () => {
      ignore = true;
    };
  }, [admin?.userId, admin?.username]);

  const handleFileChange = (e) => setSelectedFile(e.target.files[0]);

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });

  const handleProfileSubmit = async () => {
    if (!selectedFile) return setStatus({ type: "error", message: "Select an image first." });
    try {
      setSavingProfile(true);
      setStatus({ type: "", message: "" });
      const resolvedKey = userNodeKey || (await resolveUserNodeKey());
      if (!resolvedKey) throw new Error("Unable to find user profile record.");

      const base64Image = await readFileAsDataUrl(selectedFile);
      await axios.patch(
        `${RTDB_BASE}/Users/${resolvedKey}.json`,
        { profileImage: base64Image }
      );
      const updatedAdmin = { ...admin, profileImage: base64Image };
      localStorage.setItem("admin", JSON.stringify(updatedAdmin));
      setAdmin(updatedAdmin);
      setUserNodeKey(resolvedKey);
      setProfileImage(base64Image);
      setSelectedFile(null);
      setStatus({ type: "success", message: "Profile image updated successfully." });
    } catch (err) {
      console.error("Error updating profile image:", err);
      setStatus({ type: "error", message: "Failed to update profile image." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleInfoUpdate = async () => {
    const nextName = String(name || "").trim();
    const nextUsername = String(username || "").trim();

    if (!nextName || !nextUsername) {
      return setStatus({ type: "error", message: "Name and username are required." });
    }

    if (!/^[A-Za-z0-9_.-]{3,50}$/.test(nextUsername)) {
      return setStatus({
        type: "error",
        message: "Username must be 3-50 chars and use only letters, numbers, ., _, -",
      });
    }

    try {
      setSavingInfo(true);
      setStatus({ type: "", message: "" });
      const resolvedKey = userNodeKey || (await resolveUserNodeKey());
      if (!resolvedKey) throw new Error("Unable to find user profile record.");

      const usersRes = await axios.get(`${RTDB_BASE}/Users.json`);
      const usersData = usersRes.data || {};
      const duplicateUsername = Object.entries(usersData).some(([key, user]) => {
        if (String(key) === String(resolvedKey)) return false;
        const sameIdentityByUserId =
          String(user?.userId || "").trim() &&
          String(admin?.userId || "").trim() &&
          String(user.userId).trim() === String(admin.userId).trim();
        if (sameIdentityByUserId) return false;
        return String(user?.username || "").trim().toLowerCase() === nextUsername.toLowerCase();
      });

      if (duplicateUsername) {
        setStatus({ type: "error", message: "This username is already in use. Please choose another one." });
        return;
      }

      await axios.patch(
        `${RTDB_BASE}/Users/${resolvedKey}.json`,
        { name: nextName, username: nextUsername }
      );
      const updatedAdmin = { ...admin, name: nextName, username: nextUsername };
      localStorage.setItem("admin", JSON.stringify(updatedAdmin));
      setAdmin(updatedAdmin);
      setName(nextName);
      setUsername(nextUsername);
      setUserNodeKey(resolvedKey);
      setStatus({ type: "success", message: "Profile info updated successfully." });
    } catch (err) {
      console.error("Error updating info:", err);
      const serverMessage = err?.response?.data?.message || err?.message || "Failed to update profile info.";
      setStatus({ type: "error", message: serverMessage });
    } finally {
      setSavingInfo(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!oldPassword || !password || !confirmPassword) {
      return setStatus({ type: "error", message: "Fill old password, new password, and confirm password." });
    }
    if (password.length < 6) return setStatus({ type: "error", message: "Password must be at least 6 characters." });
    if (password !== confirmPassword) return setStatus({ type: "error", message: "Passwords do not match." });
    try {
      setSavingPassword(true);
      setStatus({ type: "", message: "" });
      const resolvedKey = userNodeKey || (await resolveUserNodeKey());
      if (!resolvedKey) throw new Error("Unable to find user profile record.");

      const currentUserRes = await axios.get(`${RTDB_BASE}/Users/${resolvedKey}.json`);
      const currentUser = currentUserRes.data || {};
      const currentPassword = String(currentUser?.password || "");
      if (String(oldPassword) !== currentPassword) {
        setStatus({ type: "error", message: "Old password is incorrect." });
        return;
      }

      await axios.patch(
        `${RTDB_BASE}/Users/${resolvedKey}.json`,
        { password }
      );
      setOldPassword("");
      setPassword("");
      setConfirmPassword("");
      setUserNodeKey(resolvedKey);
      setStatus({ type: "success", message: "Password updated successfully." });
    } catch (err) {
      console.error("Error updating password:", err);
      setStatus({ type: "error", message: "Failed to update password." });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin");
    navigate("/");
  };

  return (
    <div className="dashboard-page">
      <div
        className="google-dashboard"
        style={{ display: "flex", gap: 14, padding: "4px 14px", height: "calc(100vh - 73px)", overflow: "hidden", background: darkMode ? "#0f172a" : "#eef2ff", width: "100%", boxSizing: "border-box" }}
      >
        <Sidebar admin={admin} />

        <div
          className="main-content"
          style={{
            flex: "1.08 1 0",
            minWidth: 0,
            maxWidth: "none",
            margin: "0",
            boxSizing: "border-box",
            alignSelf: "stretch",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "flex-start",
            padding: "0 2px 10px 2px",
            width: "100%",
            gap: "8px",
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <div style={{ width: "100%", maxWidth: "min(1320px, 100%)", margin: "0", display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              className="section-header-card"
              style={{
                ...cardStyle,
                borderRadius: 14,
                padding: "16px 18px 14px",
                position: "relative",
                overflow: "hidden",
                background: darkMode
                  ? "linear-gradient(135deg, #0b1220 0%, #111827 100%)"
                  : "linear-gradient(135deg, color-mix(in srgb, #ffffff 88%, white) 0%, color-mix(in srgb, #ffffff 94%, #eef2ff) 100%)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: "linear-gradient(90deg, #4f46e5, #2563eb, #60a5fa)",
                }}
              />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.01em", color: darkMode ? "#f8fafc" : "#0f172a" }}>Settings</div>
                <div style={{ marginTop: 6, color: darkMode ? "#cbd5e1" : "#475569", fontSize: 14 }}>
                  Manage profile, security, and appearance in one place.
                </div>
                {status.message ? (
                  <div style={{ marginTop: 12, borderRadius: 10, padding: "10px 12px", background: status.type === "success" ? "#ecfdf5" : "#fef2f2", color: status.type === "success" ? "#166534" : "#991b1b", border: status.type === "success" ? "1px solid #bbf7d0" : "1px solid #fecaca", fontWeight: 600 }}>
                    {status.message}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: darkMode ? "#e5e7eb" : "#0f172a", fontWeight: 800 }}>
                  <FaCamera /> Profile Picture
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <img
                  src={profilePreview}
                  alt="profile"
                  style={{ width: 110, height: 110, borderRadius: "50%", objectFit: "cover", border: "3px solid #4f46e5" }}
                />
                <div style={{ flex: 1 }}>
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ color: darkMode ? "#e5e7eb" : "#111827" }} />
                  <button onClick={handleProfileSubmit} disabled={savingProfile} style={{ ...primaryButtonStyle, marginTop: 12, opacity: savingProfile ? 0.7 : 1 }}>
                    <FaSave /> {savingProfile ? "Saving..." : "Update Profile Image"}
                  </button>
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: darkMode ? "#e5e7eb" : "#0f172a", fontWeight: 800, marginBottom: 14 }}>
                <FaUserCog /> Account Information
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
                <button onClick={handleInfoUpdate} disabled={savingInfo} style={{ ...primaryButtonStyle, opacity: savingInfo ? 0.7 : 1 }}>
                  <FaSave /> {savingInfo ? "Saving..." : "Update Info"}
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: darkMode ? "#e5e7eb" : "#0f172a", fontWeight: 800, marginBottom: 14 }}>
                <FaLock /> Security
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input type="password" autoComplete="new-password" name="old-password-no-autofill" placeholder="Old Password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} style={inputStyle} />
                <input type="password" autoComplete="new-password" name="new-password" placeholder="New Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
                <input type="password" autoComplete="new-password" name="confirm-new-password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />
                <button onClick={handlePasswordChange} disabled={savingPassword} style={{ ...primaryButtonStyle, opacity: savingPassword ? 0.7 : 1 }}>
                  <FaSave /> {savingPassword ? "Saving..." : "Change Password"}
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: darkMode ? "#e5e7eb" : "#0f172a", fontWeight: 800, marginBottom: 14 }}>
                <FaPalette /> Appearance
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, background: darkMode ? "#111827" : "#f8fafc", border: darkMode ? "1px solid #374151" : "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, color: darkMode ? "#e5e7eb" : "#111827" }}>
                  <FaMoon /> Dark Mode
                </div>
                <label style={{ position: "relative", width: 48, height: 26, display: "inline-block" }}>
                  <input
                    type="checkbox"
                    checked={darkMode}
                    onChange={toggleDarkMode}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      cursor: "pointer",
                      inset: 0,
                      background: darkMode ? "#4f46e5" : "#cbd5e1",
                      borderRadius: 999,
                      transition: "all 0.2s ease",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      top: 3,
                      left: darkMode ? 25 : 3,
                      width: 20,
                      height: 20,
                      background: "#fff",
                      borderRadius: "50%",
                      transition: "all 0.2s ease",
                    }}
                  />
                </label>
              </div>

              <button
                onClick={handleLogout}
                style={{ marginTop: 16, border: "1px solid #ef4444", borderRadius: 999, padding: "10px 16px", background: "#fff", color: "#b91c1c", fontWeight: 700, cursor: "pointer" }}
              >
                Sign Out
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;