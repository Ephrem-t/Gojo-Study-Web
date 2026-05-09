import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  FaBell,
  FaCamera,
  FaCheckCircle,
  FaComments,
  FaEye,
  FaEyeSlash,
  FaLock,
  FaPalette,
  FaShieldAlt,
  FaSignOutAlt,
  FaUserCircle,
} from "react-icons/fa";
import "../../styles/global.css";
import "../../styles/settingsPage.css";
import { API_BASE } from "../../api/apiConfig";
import { getRtdbRoot } from "../../api/rtdbScope";
import Sidebar from "../Sidebar";
import ProfileAvatar from "../ProfileAvatar";
import QuickLessonPlanCheckModal from "./QuickLessonPlanCheckModal";
import { buildChatSummaryPath, buildChatSummaryUpdate } from "../../utils/chatRtdb";
import { clearCachedChatSummary, fetchTeacherConversationSummaries } from "../../utils/teacherData";

const RTDB_BASE = getRtdbRoot();
const DEFAULT_PREFERENCES = {
  emailAlerts: true,
  pushAlerts: true,
  weeklyDigest: false,
  compactCards: false,
};
const EMPTY_ACTIVITY_STATE = {
  alerts: [],
  conversations: [],
  loading: false,
  error: "",
};

const readJsonStorage = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const scorePassword = (value) => {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
};

const passwordLabel = (score) => {
  if (score >= 4) return "Strong";
  if (score >= 3) return "Good";
  if (score >= 2) return "Fair";
  if (score >= 1) return "Weak";
  return "Empty";
};

const hasRequiredPasswordMix = (value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value);

const normalizeTimestamp = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
};

const formatActivityTime = (value) => {
  const timestamp = normalizeTimestamp(value);
  if (!timestamp) return "Recent";

  const diffMs = Date.now() - timestamp;
  if (diffMs < 60 * 60 * 1000) {
    return `${Math.max(1, Math.round(diffMs / 60000))}m ago`;
  }
  if (diffMs < 24 * 60 * 60 * 1000) {
    return `${Math.max(1, Math.round(diffMs / 3600000))}h ago`;
  }

  return new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
};

const getSeenPosts = (teacherId) => readJsonStorage(`seen_posts_${teacherId}`, []);

const saveSeenPost = (teacherId, postId) => {
  const seenPosts = getSeenPosts(teacherId);
  if (!seenPosts.includes(postId)) {
    localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seenPosts, postId]));
  }
};

const isRecordObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

const resolveTeacherUserNode = async (teacher) => {
  const directUserKey = String(teacher?.userId || "").trim();
  const directUsername = String(teacher?.username || "").trim();

  if (!directUserKey && !directUsername) {
    throw new Error("Teacher user reference is missing.");
  }

  if (directUserKey) {
    const directResponse = await axios.get(`${RTDB_BASE}/Users/${encodeURIComponent(directUserKey)}.json`);
    const directRecord = directResponse.data;
    const directMatches =
      isRecordObject(directRecord) &&
      (String(directRecord.userId || "").trim() === directUserKey ||
        String(directRecord.username || "").trim() === directUsername);

    if (directMatches) {
      return { key: directUserKey, record: directRecord };
    }
  }

  const usersResponse = await axios.get(`${RTDB_BASE}/Users.json`);
  const users = isRecordObject(usersResponse.data) ? usersResponse.data : {};

  for (const [nodeKey, userRecord] of Object.entries(users)) {
    if (!isRecordObject(userRecord)) continue;

    const matchesUserId = directUserKey && String(userRecord.userId || "").trim() === directUserKey;
    const matchesUsername = directUsername && String(userRecord.username || "").trim() === directUsername;
    const matchesNodeKey = directUserKey && String(nodeKey || "").trim() === directUserKey;

    if (matchesUserId || matchesUsername || matchesNodeKey) {
      return { key: nodeKey, record: userRecord };
    }
  }

  throw new Error("Teacher user node not found.");
};

function SectionHeader({ kicker, title, description, icon, actions }) {
  return (
    <div className="settings-section-header">
      <div>
        <span className="settings-kicker">{kicker}</span>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="settings-section-header-side">
        {actions ? <div className="settings-section-actions">{actions}</div> : null}
        {icon ? <span className="settings-icon-badge">{icon}</span> : null}
      </div>
    </div>
  );
}

function MetricTile({ label, value, note }) {
  return (
    <article className="settings-metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function PasswordField({ label, value, onChange, shown, onToggle, placeholder }) {
  return (
    <label className="settings-field settings-field-password">
      <span>{label}</span>
      <input
        type={shown ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <button type="button" className="settings-field-action" onClick={onToggle} aria-label={`Toggle ${label}`}>
        {shown ? <FaEyeSlash /> : <FaEye />}
      </button>
    </label>
  );
}

function PreferenceRow({ icon: Icon, title, description, checked, onChange }) {
  return (
    <label className="settings-preference-row">
      <div className="settings-preference-copy">
        <strong>
          {Icon ? <Icon /> : null}
          {title}
        </strong>
        <span>{description}</span>
      </div>
      <span className="settings-toggle-control">
        <input type="checkbox" className="settings-toggle-input" checked={checked} onChange={onChange} />
        <span className="settings-toggle-switch" />
      </span>
    </label>
  );
}

function ActivityItem({ item, onClick }) {
  return (
    <button type="button" className="settings-activity-item" onClick={() => onClick(item)}>
      <div className="settings-activity-avatar">
        <ProfileAvatar
          src={item.actorProfile}
          name={item.actorName || item.label || "Activity"}
          alt={item.actorName || item.label || "Activity"}
        />
      </div>
      <div className="settings-activity-copy">
        <div className="settings-activity-copy-top">
          <strong>{item.actorName}</strong>
          <span className={`settings-activity-pill is-${item.type}`}>{item.type === "post" ? "Alert" : "Message"}</span>
        </div>
        <span>{item.headline}</span>
      </div>
      <div className="settings-activity-meta">
        {item.unreadCount ? <em className="settings-count-badge">{item.unreadCount}</em> : null}
        <small>{formatActivityTime(item.timestamp)}</small>
      </div>
    </button>
  );
}

export default function SettingsPagePremium() {
  const navigate = useNavigate();
  const feedbackTimerRef = useRef(null);
  const [teacher, setTeacher] = useState(null);
  const [profilePreview, setProfilePreview] = useState("/default-profile.png");
  const [selectedFile, setSelectedFile] = useState(null);
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth > 600 : true
  );
  const [savingSection, setSavingSection] = useState("");
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [activity, setActivity] = useState(EMPTY_ACTIVITY_STATE);
  const [activityFilter, setActivityFilter] = useState("all");
  const [quickLessonCheckOpen, setQuickLessonCheckOpen] = useState(false);

  const flashMessage = useCallback((type, text) => {
    setFeedback({ type, text });
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    if (typeof window !== "undefined") {
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback({ type: "", text: "" });
      }, 2800);
    }
  }, []);

  const fetchWorkspaceActivity = useCallback(async (currentTeacher) => {
    const activeTeacher = currentTeacher || JSON.parse(localStorage.getItem("teacher") || "null");
    if (!activeTeacher?.userId) {
      setActivity(EMPTY_ACTIVITY_STATE);
      return;
    }

    setActivity((previous) => ({ ...previous, loading: true, error: "" }));

    try {
      const [postsRes, adminsRes, usersRes, conversationSummaries] = await Promise.all([
        axios.get(`${API_BASE}/get_posts`),
        axios.get(`${RTDB_BASE}/School_Admins.json`),
        axios.get(`${RTDB_BASE}/Users.json`),
        fetchTeacherConversationSummaries({
          rtdbBase: RTDB_BASE,
          schoolCode: activeTeacher.schoolCode,
          teacherUserId: activeTeacher.userId,
          unreadOnly: true,
        }),
      ]);

      let postsData = postsRes.data || [];
      if (!Array.isArray(postsData) && typeof postsData === "object") {
        postsData = Object.values(postsData);
      }

      const schoolAdmins = adminsRes.data || {};
      const users = usersRes.data || {};
      const seenPosts = getSeenPosts(activeTeacher.userId);
      const usersByPushKey = {};
      const usersByUserId = {};

      Object.entries(users).forEach(([pushKey, userValue]) => {
        const userRecord = userValue && typeof userValue === "object"
          ? { ...userValue, pushKey }
          : { userId: pushKey, pushKey };

        usersByPushKey[pushKey] = userRecord;
        if (userRecord.userId) {
          usersByUserId[userRecord.userId] = userRecord;
        }
      });

      const resolveAdminInfo = (post) => {
        const adminId = post.adminId || post.posterAdminId || post.poster || post.admin || null;
        if (adminId && schoolAdmins[adminId]) {
          const schoolAdmin = schoolAdmins[adminId];
          const mappedUser = usersByUserId[schoolAdmin.userId] || usersByPushKey[schoolAdmin.userId] || null;
          return {
            name: mappedUser?.name || schoolAdmin.name || post.adminName || "Admin",
            profile:
              mappedUser?.profileImage ||
              schoolAdmin.profileImage ||
              post.adminProfile ||
              "/default-profile.png",
          };
        }

        return {
          name: post.adminName || "Admin",
          profile: post.adminProfile || "/default-profile.png",
        };
      };

      const alerts = postsData
        .slice()
        .sort((left, right) => normalizeTimestamp(right.time || right.createdAt) - normalizeTimestamp(left.time || left.createdAt))
        .filter((post) => post.postId && !seenPosts.includes(post.postId))
        .slice(0, 8)
        .map((post) => {
          const adminInfo = resolveAdminInfo(post);
          return {
            id: post.postId,
            type: "post",
            actorName: adminInfo.name,
            actorProfile: adminInfo.profile,
            headline: post.title || post.message?.substring(0, 84) || "Untitled post",
            timestamp: normalizeTimestamp(post.time || post.createdAt),
          };
        });

      const conversations = (conversationSummaries || [])
        .map((conversation) => ({
          chatId: conversation.chatId,
          type: "message",
          actorName: conversation.displayName || conversation.contact?.name || "User",
          actorProfile: conversation.profile || conversation.contact?.profileImage || "/default-profile.png",
          headline: conversation.lastMessageText || "Unread conversation",
          unreadCount: Number(conversation.unreadForMe || 0),
          timestamp: normalizeTimestamp(conversation.lastMessageTime),
          contact: conversation.contact,
        }))
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(0, 8);

      setActivity({ alerts, conversations, loading: false, error: "" });
    } catch (error) {
      console.error("Error loading settings activity:", error);
      setActivity({
        alerts: [],
        conversations: [],
        loading: false,
        error: "Unable to load alerts and messages right now.",
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher") || "null");
    if (!storedTeacher) {
      navigate("/login");
      return;
    }

    setTeacher(storedTeacher);
    setProfilePreview(storedTeacher.profileImage || "/default-profile.png");
    setPreferences(
      readJsonStorage(`teacher_settings_preferences_${storedTeacher.userId}`, DEFAULT_PREFERENCES)
    );
  }, [navigate]);

  useEffect(() => {
    if (!teacher?.userId) return;
    setProfilePreview(teacher.profileImage || "/default-profile.png");
  }, [teacher?.profileImage, teacher?.userId]);

  useEffect(() => {
    if (!teacher?.userId) return;
    localStorage.setItem(
      `teacher_settings_preferences_${teacher.userId}`,
      JSON.stringify(preferences)
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("teacher-settings-preferences-changed", {
          detail: { teacherUserId: teacher.userId, preferences },
        })
      );
    }
  }, [preferences, teacher?.userId]);

  useEffect(() => {
    if (!teacher?.userId) return;
    fetchWorkspaceActivity(teacher);
  }, [teacher, fetchWorkspaceActivity]);

  const visibleAlerts = useMemo(
    () => (preferences.emailAlerts ? activity.alerts : []),
    [activity.alerts, preferences.emailAlerts]
  );

  const visibleConversations = useMemo(
    () => (preferences.pushAlerts ? activity.conversations : []),
    [activity.conversations, preferences.pushAlerts]
  );

  const activityItems = useMemo(() => {
    const combinedItems = {
      all: [...visibleAlerts, ...visibleConversations],
      alerts: visibleAlerts,
      messages: visibleConversations,
    };

    return (combinedItems[activityFilter] || combinedItems.all)
      .slice()
      .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0));
  }, [activityFilter, visibleAlerts, visibleConversations]);

  const activityFilters = useMemo(
    () => [
      { id: "all", label: "All", count: visibleAlerts.length + visibleConversations.length },
      { id: "alerts", label: "Alerts", count: visibleAlerts.length },
      { id: "messages", label: "Messages", count: visibleConversations.length },
    ],
    [visibleAlerts.length, visibleConversations.length]
  );

  const pendingPasswordScore = useMemo(() => scorePassword(password), [password]);
  const effectivePasswordScore = password
    ? pendingPasswordScore
    : scorePassword(String(teacher?.password || ""));
  const hasProfileImage = Boolean(profilePreview && profilePreview !== "/default-profile.png");

  const securityScore = useMemo(() => {
    let score = 0;
    if (hasProfileImage) score += 1;
    if (String(teacher?.name || "").trim()) score += 1;
    if (String(teacher?.username || teacher?.teacherId || teacher?.userId || "").trim()) score += 1;
    if (effectivePasswordScore >= 3) score += 1;
    return score;
  }, [effectivePasswordScore, hasProfileImage, teacher?.name, teacher?.teacherId, teacher?.userId, teacher?.username]);

  const heroMetrics = useMemo(
    () => [
      {
        label: "Open activity",
        value: visibleAlerts.length + visibleConversations.length,
        note: "Unread alerts and messages",
      },
      {
        label: "Messages waiting",
        value: visibleConversations.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0),
        note: "Unread message count",
      },
      {
        label: "Security health",
        value: `${securityScore}/4`,
        note: "Profile and password readiness",
      },
    ],
    [securityScore, visibleAlerts.length, visibleConversations]
  );

  const accountFacts = useMemo(
    () => [
      { label: "Full Name", value: teacher?.name || "Not provided" },
      { label: "Username", value: teacher?.username || "Not assigned" },
      { label: "Teacher ID", value: teacher?.teacherId || teacher?.userId || "Not available" },
      { label: "School Code", value: teacher?.schoolCode || "Not linked" },
    ],
    [teacher?.name, teacher?.schoolCode, teacher?.teacherId, teacher?.userId, teacher?.username]
  );

  const securityChecklist = useMemo(
    () => [
      { label: "Profile image attached", done: hasProfileImage },
      { label: "Full name available", done: Boolean(String(teacher?.name || "").trim()) },
      { label: "Username configured", done: Boolean(String(teacher?.username || teacher?.teacherId || teacher?.userId || "").trim()) },
      { label: "Strong password ready", done: effectivePasswordScore >= 3 },
    ],
    [effectivePasswordScore, hasProfileImage, teacher?.name, teacher?.teacherId, teacher?.userId, teacher?.username]
  );

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePreview(reader.result || "/default-profile.png");
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = async () => {
    if (!teacher?.userId) return;
    if (!selectedFile) {
      flashMessage("warning", "Choose a profile image first.");
      return;
    }

    setSavingSection("profile");

    try {
      const base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const { key: userNodeKey } = await resolveTeacherUserNode(teacher);

      await axios.patch(`${RTDB_BASE}/Users/${encodeURIComponent(userNodeKey)}.json`, { profileImage: base64Image });

      const updatedTeacher = { ...teacher, profileImage: base64Image };
      localStorage.setItem("teacher", JSON.stringify(updatedTeacher));
      setTeacher(updatedTeacher);
      setProfilePreview(base64Image);
      setSelectedFile(null);
      flashMessage("success", "Profile image updated successfully.");
    } catch (error) {
      console.error("Error updating profile image:", error);
      flashMessage("error", "Profile image update failed.");
    } finally {
      setSavingSection("");
    }
  };

  const handlePasswordChange = async () => {
    if (!teacher?.userId) return;
    if (!oldPassword || !password || !confirmPassword) {
      flashMessage("warning", "Fill old, new, and confirm password fields.");
      return;
    }
    if (password === oldPassword) {
      flashMessage("warning", "New password must be different from the old password.");
      return;
    }
    if (password !== confirmPassword) {
      flashMessage("error", "Passwords do not match.");
      return;
    }
    if (!hasRequiredPasswordMix(password)) {
      flashMessage("error", "New password must include both letters and numbers.");
      return;
    }

    setSavingSection("security");

    try {
      const { key: userNodeKey, record: userRecord } = await resolveTeacherUserNode(teacher);
      const savedPassword = String(userRecord?.password ?? teacher?.password ?? "");

      if (!savedPassword) {
        flashMessage("error", "Current password could not be verified. Please log in again.");
        return;
      }

      if (oldPassword !== savedPassword) {
        flashMessage("error", "Old password is incorrect.");
        return;
      }

      await axios.patch(`${RTDB_BASE}/Users/${encodeURIComponent(userNodeKey)}.json`, { password });
      const updatedTeacher = { ...teacher, password };
      localStorage.setItem("teacher", JSON.stringify(updatedTeacher));
      setTeacher(updatedTeacher);
      setOldPassword("");
      setPassword("");
      setConfirmPassword("");
      flashMessage("success", "Password updated successfully.");
    } catch (error) {
      console.error("Error updating password:", error);
      flashMessage("error", "Password update failed.");
    } finally {
      setSavingSection("");
    }
  };

  const handleActivityClick = async (item) => {
    if (!teacher || !item) return;

    if (item.type === "post" && item.id) {
      saveSeenPost(teacher.userId, item.id);
      setActivity((previous) => ({
        ...previous,
        alerts: previous.alerts.filter((alert) => alert.id !== item.id),
      }));
      navigate("/dashboard");
      flashMessage("success", "Post notification cleared.");
      return;
    }

    if (item.type === "message" && item.chatId) {
      setActivity((previous) => ({
        ...previous,
        conversations: previous.conversations.filter((conversation) => conversation.chatId !== item.chatId),
      }));

      try {
        await axios.patch(
          `${RTDB_BASE}/${buildChatSummaryPath(teacher.userId, item.chatId)}.json`,
          buildChatSummaryUpdate({
            chatId: item.chatId,
            otherUserId: item.contact?.userId,
            unreadCount: 0,
            lastMessageSeen: true,
            lastMessageSeenAt: Date.now(),
          })
        );
        clearCachedChatSummary({ rtdbBase: RTDB_BASE, chatId: item.chatId, teacherUserId: teacher.userId });
      } catch (error) {
        console.error("Failed to clear unread messages:", error);
      }

      navigate("/all-chat", {
        state: { contact: item.contact, chatId: item.chatId, tab: "settings" },
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  if (!teacher) return null;

  return (
    <div className={`settings-page-shell ${preferences.compactCards ? "is-compact" : ""}`.trim()}>
      <div className="google-dashboard settings-dashboard-layout">
        <Sidebar
          active="settings"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          teacher={teacher}
          handleLogout={handleLogout}
        />

        <div className="teacher-sidebar-spacer settings-sidebar-spacer" />

        <main className="settings-main-content">
          <section className="settings-overview-card">
            <div className="settings-overview-main">
              <span className="settings-kicker">Teacher Settings</span>
              <h1>Professional account settings with a cleaner workspace.</h1>
              <p>
                Manage your profile, security, communication preferences, and session tools in one
                simple premium layout built for daily teaching work.
              </p>

              <div className="settings-overview-actions">
                <button type="button" className="settings-primary-button" onClick={() => navigate("/dashboard")}>
                  Return to Dashboard
                </button>
                <button type="button" className="settings-secondary-button" onClick={() => setQuickLessonCheckOpen(true)}>
                  Quick Lesson Check
                </button>
                <button type="button" className="settings-secondary-button" onClick={() => fetchWorkspaceActivity(teacher)}>
                  Refresh Activity
                </button>
              </div>

              <div className="settings-metrics-grid">
                {heroMetrics.map((item) => (
                  <MetricTile key={item.label} label={item.label} value={item.value} note={item.note} />
                ))}
              </div>
            </div>

            <aside className="settings-account-card">
              <div className="settings-account-identity">
                <div className="settings-account-avatar">
                  <ProfileAvatar
                    src={profilePreview}
                    name={teacher?.name || "Teacher"}
                    alt={teacher?.name || "Teacher"}
                  />
                </div>
                <div>
                  <strong>{teacher?.name || "Teacher"}</strong>
                  <span>{teacher?.username || teacher?.teacherId || teacher?.userId || "Account"}</span>
                </div>
              </div>

              <div className="settings-account-badges">
                <span>{teacher?.schoolCode || "No school code"}</span>
                <span>Teacher workspace</span>
                <span>{preferences.compactCards ? "Compact layout" : "Comfort layout"}</span>
              </div>

              <p>
                Settings are stored per teacher account so your preferred experience stays consistent
                across the teacher workspace.
              </p>
            </aside>
          </section>

          {feedback.text ? (
            <div className={`settings-feedback is-${feedback.type || "success"}`}>
              <FaCheckCircle />
              <span>{feedback.text}</span>
            </div>
          ) : null}

          <section className="settings-body-grid">
            <div className="settings-column">
              <article className="settings-card">
                <SectionHeader
                  kicker="Profile"
                  title="Identity and presentation"
                  description="Keep your public teacher profile clean and recognizable without editing school-managed account details."
                  icon={<FaUserCircle />}
                />

                <div className="settings-profile-layout">
                  <div className="settings-avatar-panel">
                    <div className="settings-avatar-shell">
                      <ProfileAvatar
                        src={profilePreview}
                        name={teacher?.name || "Teacher"}
                        alt="Profile preview"
                      />
                      <label className="settings-camera-trigger">
                        <FaCamera />
                        <input type="file" accept="image/*" onChange={handleFileChange} />
                      </label>
                    </div>
                    <p>Upload a clear teacher photo so students, parents, and admins recognize you faster.</p>
                    <button
                      type="button"
                      className="settings-primary-button"
                      onClick={handleProfileSubmit}
                      disabled={savingSection === "profile" || !selectedFile}
                    >
                      {savingSection === "profile" ? "Saving..." : "Update Photo"}
                    </button>
                  </div>

                  <div className="settings-fact-grid">
                    {accountFacts.map((item) => (
                      <div key={item.label} className="settings-fact-card">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                    <div className="settings-fact-note">
                      Name, username, and school-linked identifiers are controlled by account setup and are shown here as read-only reference details.
                    </div>
                  </div>
                </div>
              </article>

              <article className="settings-card">
                <SectionHeader
                  kicker="Security"
                  title="Password and protection"
                  description="Use one focused security area for password updates and account health instead of split duplicated panels."
                  icon={<FaShieldAlt />}
                />

                <div className="settings-security-layout">
                  <div className="settings-form-stack">
                    <PasswordField
                      label="Old Password"
                      value={oldPassword}
                      onChange={setOldPassword}
                      shown={showOldPassword}
                      onToggle={() => setShowOldPassword((previousValue) => !previousValue)}
                      placeholder="Enter your current password"
                    />

                    <PasswordField
                      label="New Password"
                      value={password}
                      onChange={setPassword}
                      shown={showPassword}
                      onToggle={() => setShowPassword((previousValue) => !previousValue)}
                      placeholder="Create a stronger password"
                    />
                    <p className="settings-inline-note">New password must include at least one letter and one number.</p>

                    <PasswordField
                      label="Confirm Password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      shown={showConfirmPassword}
                      onToggle={() => setShowConfirmPassword((previousValue) => !previousValue)}
                      placeholder="Repeat the new password"
                    />

                    <div className="settings-strength-row">
                      <div className="settings-strength-track">
                        <div className={`settings-strength-fill strength-${password ? pendingPasswordScore : effectivePasswordScore}`} />
                      </div>
                      <span>{passwordLabel(password ? pendingPasswordScore : effectivePasswordScore)}</span>
                    </div>

                    <button
                      type="button"
                      className="settings-primary-button"
                      onClick={handlePasswordChange}
                      disabled={savingSection === "security"}
                    >
                      {savingSection === "security" ? "Saving..." : "Change Password"}
                    </button>
                  </div>

                  <div className="settings-score-card">
                    <div className="settings-score-ring">
                      <strong>{securityScore}</strong>
                      <span>/4</span>
                    </div>
                    <h3>Security health</h3>
                    <p>Your score improves as the account becomes easier to trust and harder to misuse.</p>

                    <div className="settings-score-list">
                      {securityChecklist.map((item) => (
                        <span key={item.label} className={item.done ? "done" : "pending"}>
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <div className="settings-column settings-column-side">
              <article className="settings-card">
                <SectionHeader
                  kicker="Preferences"
                  title="Experience and delivery"
                  description="Tune how activity reaches you and how dense the page feels, without duplicating control groups in multiple places."
                  icon={<FaPalette />}
                />

                <div className="settings-preference-list">
                  <PreferenceRow
                    icon={FaBell}
                    title="Post alerts"
                    description="Keep school announcements and admin posts visible in your settings activity feed."
                    checked={preferences.emailAlerts}
                    onChange={(event) =>
                      setPreferences((previous) => ({ ...previous, emailAlerts: event.target.checked }))
                    }
                  />

                  <PreferenceRow
                    icon={FaComments}
                    title="Chat alerts"
                    description="Show unread conversations and messenger activity inside the communication center."
                    checked={preferences.pushAlerts}
                    onChange={(event) =>
                      setPreferences((previous) => ({ ...previous, pushAlerts: event.target.checked }))
                    }
                  />

                  <PreferenceRow
                    icon={FaCheckCircle}
                    title="Weekly digest"
                    description="Group lower-priority reminders into a quieter settings experience during the week."
                    checked={preferences.weeklyDigest}
                    onChange={(event) =>
                      setPreferences((previous) => ({ ...previous, weeklyDigest: event.target.checked }))
                    }
                  />

                  <PreferenceRow
                    icon={FaPalette}
                    title="Compact cards"
                    description="Reduce spacing and card padding for a denser, faster-scanning layout."
                    checked={preferences.compactCards}
                    onChange={(event) =>
                      setPreferences((previous) => ({ ...previous, compactCards: event.target.checked }))
                    }
                  />
                </div>
              </article>

              <article className="settings-card">
                <SectionHeader
                  kicker="Communication"
                  title="Activity center"
                  description="One premium activity feed for both admin alerts and unread conversations."
                  icon={<FaComments />}
                  actions={
                    <div className="settings-filter-group">
                      {activityFilters.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`settings-filter-chip ${activityFilter === item.id ? "is-active" : ""}`.trim()}
                          onClick={() => setActivityFilter(item.id)}
                        >
                          {item.label}
                          <span>{item.count}</span>
                        </button>
                      ))}
                    </div>
                  }
                />

                {activity.loading ? <div className="settings-empty-state">Loading activity...</div> : null}
                {!activity.loading && activity.error ? <div className="settings-empty-state">{activity.error}</div> : null}

                {!activity.loading && !activity.error ? (
                  activityItems.length ? (
                    <div className="settings-activity-list">
                      {activityItems.map((item) => (
                        <ActivityItem
                          key={item.id || item.chatId}
                          item={item}
                          onClick={handleActivityClick}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="settings-empty-state">
                      {activityFilter === "alerts" && !preferences.emailAlerts
                        ? "Post alerts are turned off."
                        : activityFilter === "messages" && !preferences.pushAlerts
                          ? "Chat alerts are turned off."
                          : "Everything is clear right now."}
                    </div>
                  )
                ) : null}
              </article>

              <article className="settings-card">
                <SectionHeader
                  kicker="Session"
                  title="Account actions"
                  description="Leave the settings page cleanly or return to your main workspace from one simple session panel."
                  icon={<FaLock />}
                />

                <div className="settings-session-actions">
                  <button type="button" className="settings-secondary-button" onClick={() => navigate("/dashboard")}>
                    Return to Dashboard
                  </button>
                  <button type="button" className="settings-danger-button" onClick={handleLogout}>
                    <FaSignOutAlt />
                    Logout
                  </button>
                </div>
                <p className="settings-session-note">
                  Logging out clears the current teacher session from this browser and sends you back to the login screen.
                </p>
              </article>
            </div>
          </section>
        </main>
      </div>

      <QuickLessonPlanCheckModal
        open={quickLessonCheckOpen}
        teacher={teacher}
        onClose={() => setQuickLessonCheckOpen(false)}
        flashMessage={flashMessage}
      />
    </div>
  );
}