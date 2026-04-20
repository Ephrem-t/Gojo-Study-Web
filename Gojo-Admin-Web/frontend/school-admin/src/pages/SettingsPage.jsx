import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaCamera, FaLock, FaMoon, FaPalette, FaSave, FaUserCog } from "react-icons/fa";
import axios from "axios";
import useDarkMode from "../hooks/useDarkMode";
import ProfileAvatar from "../components/ProfileAvatar";

function SettingsPage() {
  const [admin, setAdmin] = useState(
    JSON.parse(localStorage.getItem("admin")) || {}
  );
  const [selectedFile, setSelectedFile] = useState(null);
  const [profileImage, setProfileImage] = useState(
    admin.profileImage || "/default-profile.png"
  );
  const [darkMode, toggleDarkMode] = useDarkMode();
  const [userRecordRef, setUserRecordRef] = useState({ key: "", baseUrl: "" });
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
  const schoolCode = String(admin?.schoolCode || "").trim();
  const schoolUsersBaseUrl = schoolCode
    ? `${RTDB_BASE}/Platform1/Schools/${encodeURIComponent(schoolCode)}/Users`
    : `${RTDB_BASE}/Users`;
  const globalUsersBaseUrl = `${RTDB_BASE}/Users`;
  const shellUsersBaseUrl = schoolCode ? schoolUsersBaseUrl : globalUsersBaseUrl;

  const pageVars = {
    "--page-bg": darkMode ? "#07111f" : "#ffffff",
    "--page-bg-secondary": darkMode ? "#0b1728" : "#F7FBFF",
    "--surface-panel": darkMode ? "#0f1c2e" : "#ffffff",
    "--surface-muted": darkMode ? "#13243a" : "#F8FBFF",
    "--surface-accent": darkMode ? "#162b45" : "#EAF4FF",
    "--surface-strong": darkMode ? "#213958" : "#D7E7FB",
    "--surface-overlay": darkMode ? "#0d1828" : "#F1F8FF",
    "--border-soft": darkMode ? "#223753" : "#D7E7FB",
    "--border-strong": darkMode ? "#33537b" : "#B5D2F8",
    "--text-primary": darkMode ? "#e5eefb" : "#0f172a",
    "--text-secondary": darkMode ? "#bfd0e6" : "#334155",
    "--text-muted": darkMode ? "#8fa6c3" : "#64748b",
    "--accent": "#007afb",
    "--accent-soft": darkMode ? "rgba(0,122,251,0.18)" : "#E7F2FF",
    "--accent-strong": "#007afb",
    "--success": "#00B6A9",
    "--success-soft": darkMode ? "rgba(0,182,169,0.16)" : "#E9FBF9",
    "--success-border": darkMode ? "rgba(0,182,169,0.38)" : "#AAEDE7",
    "--warning": "#DC2626",
    "--warning-soft": darkMode ? "rgba(220,38,38,0.16)" : "#FEE2E2",
    "--warning-border": darkMode ? "rgba(248,113,113,0.38)" : "#FCA5A5",
    "--danger": "#b91c1c",
    "--danger-border": darkMode ? "rgba(248,113,113,0.38)" : "#fca5a5",
    "--sidebar-width": "clamp(230px, 16vw, 290px)",
    "--input-bg": darkMode ? "#0a1423" : "#ffffff",
    "--input-border": darkMode ? "#33537b" : "#B5D2F8",
    "--shadow-soft": darkMode ? "0 14px 28px rgba(0, 0, 0, 0.28)" : "0 10px 24px rgba(0, 122, 251, 0.10)",
    "--shadow-panel": darkMode ? "0 18px 34px rgba(0, 0, 0, 0.32)" : "0 14px 30px rgba(0, 122, 251, 0.14)",
    "--shadow-glow": darkMode ? "0 0 0 2px rgba(0, 122, 251, 0.28)" : "0 0 0 2px rgba(0, 122, 251, 0.18)",
  };

  const cardStyle = {
    background: "var(--surface-panel)",
    borderRadius: 16,
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
    padding: 20,
  };

  const shellCardStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    borderRadius: 16,
    boxShadow: "var(--shadow-soft)",
  };

  const headerCardStyle = {
    ...shellCardStyle,
    width: "100%",
    maxWidth: "min(1320px, 100%)",
    margin: "0 auto",
    alignSelf: "stretch",
    color: "var(--text-primary)",
    padding: "18px 20px",
    position: "relative",
    overflow: "hidden",
    background: darkMode
      ? "linear-gradient(135deg, #0f1c2e 0%, #162b45 100%)"
      : "linear-gradient(135deg, color-mix(in srgb, var(--surface-panel) 88%, white) 0%, color-mix(in srgb, var(--surface-panel) 94%, var(--surface-accent)) 100%)",
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid var(--input-border)",
    outline: "none",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    fontSize: 14,
    boxSizing: "border-box",
  };

  const readOnlyInputStyle = {
    ...inputStyle,
    background: "var(--surface-muted)",
    color: "var(--text-secondary)",
    cursor: "not-allowed",
    opacity: 0.9,
  };

  const primaryButtonStyle = {
    border: "none",
    borderRadius: 999,
    padding: "10px 16px",
    background: "linear-gradient(135deg, #007afb, #2563eb)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 10px 20px rgba(0,122,251,0.22)",
  };

  const secondaryButtonStyle = {
    border: "1px solid var(--border-soft)",
    borderRadius: 999,
    padding: "10px 16px",
    background: "var(--surface-panel)",
    color: "var(--text-secondary)",
    fontWeight: 700,
    cursor: "pointer",
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

  const resolveUserRecordRef = async () => {
    if (!admin?.userId && !admin?.username) return "";
    const bases = schoolCode ? [schoolUsersBaseUrl, globalUsersBaseUrl] : [globalUsersBaseUrl];

    for (const baseUrl of bases) {
      const usersRes = await axios.get(`${baseUrl}.json`).catch(() => ({ data: {} }));
      const usersData = usersRes.data || {};
      const match = Object.entries(usersData).find(([, user]) => {
        const userId = String(user?.userId || "").trim();
        const uname = String(user?.username || "").trim();
        return (
          (admin?.userId && userId === String(admin.userId).trim()) ||
          (admin?.username && uname && uname === String(admin.username).trim())
        );
      });

      if (match?.[0]) {
        return { key: match[0], baseUrl };
      }
    }

    return { key: "", baseUrl: shellUsersBaseUrl };
  };

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      try {
        const resolved = await resolveUserRecordRef();
        if (!ignore) setUserRecordRef(resolved);
      } catch {
        if (!ignore) setUserRecordRef({ key: "", baseUrl: shellUsersBaseUrl });
      }
    };
    run();
    return () => {
      ignore = true;
    };
  }, [admin?.userId, admin?.username, schoolCode]);

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
      const resolved = userRecordRef.key ? userRecordRef : await resolveUserRecordRef();
      if (!resolved.key) throw new Error("Unable to find user profile record.");

      const base64Image = await readFileAsDataUrl(selectedFile);
      await axios.patch(
        `${resolved.baseUrl}/${resolved.key}.json`,
        { profileImage: base64Image }
      );
      const updatedAdmin = { ...admin, profileImage: base64Image };
      localStorage.setItem("admin", JSON.stringify(updatedAdmin));
      setAdmin(updatedAdmin);
      setUserRecordRef(resolved);
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
    setStatus({
      type: "error",
      message: "Admin name and username are locked and cannot be edited from settings.",
    });
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
      const resolved = userRecordRef.key ? userRecordRef : await resolveUserRecordRef();
      if (!resolved.key) throw new Error("Unable to find user profile record.");

      const currentUserRes = await axios.get(`${resolved.baseUrl}/${resolved.key}.json`);
      const currentUser = currentUserRes.data || {};
      const currentPassword = String(currentUser?.password || "");
      if (String(oldPassword) !== currentPassword) {
        setStatus({ type: "error", message: "Old password is incorrect." });
        return;
      }

      await axios.patch(
        `${resolved.baseUrl}/${resolved.key}.json`,
        { password }
      );
      setOldPassword("");
      setPassword("");
      setConfirmPassword("");
      setUserRecordRef(resolved);
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
    <div className="dashboard-page" style={{ background: "var(--page-bg)", minHeight: "100vh", color: "var(--text-primary)", ...pageVars }}>
      <div
        className="google-dashboard"
        style={{ display: "flex", gap: 14, padding: "18px 14px", minHeight: "100vh", background: "var(--page-bg)", width: "100%", boxSizing: "border-box", alignItems: "flex-start" }}
      >
        <div
          className="admin-sidebar-spacer"
          style={{
            width: "var(--sidebar-width)",
            minWidth: "var(--sidebar-width)",
            flex: "0 0 var(--sidebar-width)",
            pointerEvents: "none",
          }}
        />

        <div
          className="main-content"
          style={{
            flex: "1 1 0",
            minWidth: 0,
            maxWidth: "none",
            margin: 0,
            boxSizing: "border-box",
            alignSelf: "flex-start",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "flex-start",
            padding: "0 12px 0 2px",
            width: "100%",
            gap: "8px",
            minHeight: "calc(100vh - 24px)",
            overflowY: "visible",
            overflowX: "hidden",
            position: "relative",
          }}
        >
          <div style={{ width: "100%", maxWidth: "min(1320px, 100%)", margin: 0, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 56 }}>
            <div className="section-header-card" style={headerCardStyle}>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: "linear-gradient(90deg, var(--accent), var(--accent-strong), color-mix(in srgb, var(--accent) 68%, white))",
                }}
              />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.01em", color: "var(--text-primary)" }}>Settings</div>
                <div style={{ marginTop: 6, color: "var(--text-secondary)", fontSize: 14 }}>
                  Manage profile, security, and appearance in one place.
                </div>
                {status.message ? (
                  <div style={{ marginTop: 12, borderRadius: 10, padding: "10px 12px", background: status.type === "success" ? "var(--success-soft)" : "var(--warning-soft)", color: status.type === "success" ? "var(--success)" : "var(--danger)", border: status.type === "success" ? "1px solid var(--success-border)" : "1px solid var(--warning-border)", fontWeight: 600 }}>
                    {status.message}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-primary)", fontWeight: 800 }}>
                  <FaCamera /> Profile Picture
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <ProfileAvatar src={profilePreview} name={name || username || "Admin"} alt="profile" style={{ width: 110, height: 110, borderRadius: "50%", objectFit: "cover", border: "3px solid var(--accent-strong)", boxShadow: "var(--shadow-glow)" }} />
                <div style={{ flex: 1 }}>
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ color: "var(--text-primary)", width: "100%" }} />
                  <button onClick={handleProfileSubmit} disabled={savingProfile} style={{ ...primaryButtonStyle, marginTop: 12, opacity: savingProfile ? 0.7 : 1 }}>
                    <FaSave /> {savingProfile ? "Saving..." : "Update Profile Image"}
                  </button>
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-primary)", fontWeight: 800, marginBottom: 14 }}>
                <FaUserCog /> Account Information
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input type="text" placeholder="Name" value={name} readOnly disabled style={readOnlyInputStyle} />
                <input type="text" placeholder="Username" value={username} readOnly disabled style={readOnlyInputStyle} />
                <div
                  style={{
                    borderRadius: 12,
                    padding: "12px 14px",
                    background: "var(--surface-muted)",
                    border: "1px solid var(--border-soft)",
                    color: "var(--text-secondary)",
                    fontSize: 12,
                    lineHeight: 1.5,
                    fontWeight: 600,
                  }}
                >
                  Name and username are managed centrally for admin accounts and cannot be changed here.
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-primary)", fontWeight: 800, marginBottom: 14 }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-primary)", fontWeight: 800, marginBottom: 14 }}>
                <FaPalette /> Appearance
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, color: "var(--text-primary)" }}>
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
                      background: darkMode ? "var(--accent-strong)" : "var(--border-strong)",
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

              <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Dark mode now updates the same page shell, surfaces, borders, and inputs used by the rest of admin instead of falling back to a separate grey theme.
              </div>

              <button
                onClick={handleLogout}
                style={{ ...secondaryButtonStyle, marginTop: 16, border: "1px solid var(--danger-border)", background: darkMode ? "rgba(127,29,29,0.18)" : "#fff", color: "var(--danger)" }}
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