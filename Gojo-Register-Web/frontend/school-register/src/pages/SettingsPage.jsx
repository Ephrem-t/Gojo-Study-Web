import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaChalkboardTeacher,
  FaCog,
  FaDatabase,
  FaExternalLinkAlt,
  FaFileAlt,
  FaGlobe,
  FaLock,
  FaMoon,
  FaSave,
  FaSun,
  FaUserPlus,
  FaUsers,
} from "react-icons/fa";
import axios from "axios";
import { generateSecret, verify } from "otplib";
import useDarkMode from "../hooks/useDarkMode";
import {
  buildSchoolRoot,
  cacheSchoolSettings,
  DEFAULT_PREFERENCES,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_TEMPLATE_SETTINGS,
  formatDateForSettings,
  getCachedSchoolSettings,
  getUserRole,
  MANAGED_ROLES,
  PERMISSION_LABELS,
  persistStoredSession,
  readStoredRegistrar,
} from "../utils/registerSettings";
import ProfileAvatar from "../components/ProfileAvatar";
import {
  loadGradeManagementNode,
  loadSchoolInfoNode,
  loadSchoolParentsNode,
  loadSchoolStudentsNode,
  loadSchoolTeachersNode,
} from "../utils/registerData";
import { fetchCachedJson } from "../utils/rtdbCache";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function buildRecoveryCodes() {
  return Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 10).toUpperCase());
}

function downloadJsonFile(fileName, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const storedAdmin = readStoredRegistrar();
  const [darkMode, toggleDarkMode] = useDarkMode();
  const backupInputRef = useRef(null);
  const currentRole = getUserRole(storedAdmin);
  const cachedSettings = getCachedSchoolSettings(storedAdmin.schoolCode || "");

  const [admin, setAdmin] = useState(storedAdmin);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [appSettings, setAppSettings] = useState(cachedSettings);

  const [schoolInfo, setSchoolInfo] = useState({});
  const [schoolForm, setSchoolForm] = useState({
    name: "",
    shortName: "",
    logoUrl: "",
    addressLine: "",
    city: "",
    region: "",
    country: "Ethiopia",
    phone: "",
    email: "",
    website: "",
    motto: "",
  });
  const [academicForm, setAcademicForm] = useState({
    currentAcademicYear: "",
    sectionNamingSystem: "Alphabetical (A, B, C)",
    promotionPassMark: "50",
    maxStudentsPerSection: "45",
  });
  const [templateForm, setTemplateForm] = useState(DEFAULT_TEMPLATE_SETTINGS);
  const [preferencesForm, setPreferencesForm] = useState(DEFAULT_PREFERENCES);
  const [securityForm, setSecurityForm] = useState({
    name: storedAdmin.name || "",
    username: storedAdmin.username || "",
    newPassword: "",
    confirmPassword: "",
    sessionTimeout: "30",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorRecoveryCodes: [],
  });
  const [selectedProfileFile, setSelectedProfileFile] = useState(null);
  const [profileImage, setProfileImage] = useState(storedAdmin.profileImage || "/default-profile.png");
  const [counts, setCounts] = useState({ students: 0, parents: 0, teachers: 0, registerers: 0, sections: 0, grades: 0 });
  const [permissionsForm, setPermissionsForm] = useState({
    ...DEFAULT_ROLE_PERMISSIONS,
    ...(cachedSettings.permissions || {}),
  });
  const [selectedRole, setSelectedRole] = useState(MANAGED_ROLES.includes(currentRole) ? currentRole : "registerer");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [backupStats, setBackupStats] = useState({ snapshots: 0, lastSnapshot: "" });

  const schoolCode = storedAdmin.schoolCode || "";
  const dbRoot = buildSchoolRoot(schoolCode);
  const backupRoot = schoolCode ? `${dbRoot.replace(`/Schools/${schoolCode}`, "")}/SchoolBackups/${schoolCode}` : "";

  const notify = (type, text) => setFeedback({ type, text });

  const persistAdmin = (updatedAdmin) => {
    setAdmin(updatedAdmin);
    persistStoredSession(updatedAdmin);
  };

  const syncSettingsCache = (settingsPatch) => {
    const normalized = cacheSchoolSettings(schoolCode, settingsPatch);
    setAppSettings(normalized);
    return normalized;
  };

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      if (!schoolCode) {
        setLoading(false);
        notify("error", "No school session found. Please sign in again.");
        return;
      }

      try {
        setLoading(true);

        const [nextSchoolInfo, gradesMap, studentsData, parentsData, teachersData, registerersData, backups] = await Promise.all([
          loadSchoolInfoNode({ rtdbBase: dbRoot }),
          loadGradeManagementNode({ rtdbBase: dbRoot }),
          loadSchoolStudentsNode({ rtdbBase: dbRoot }),
          loadSchoolParentsNode({ rtdbBase: dbRoot }),
          loadSchoolTeachersNode({ rtdbBase: dbRoot }),
          fetchCachedJson(`${dbRoot}/Registerers.json`, { ttlMs: 60000 }).catch(() => ({})),
          backupRoot ? fetchCachedJson(`${backupRoot}.json`, { ttlMs: 60000 }).catch(() => ({})) : Promise.resolve({}),
        ]);

        if (cancelled) return;

        const normalizedSettings = syncSettingsCache(nextSchoolInfo);
        const academicSettings = normalizedSettings.academic || {};
        const documentTemplates = normalizedSettings.documentTemplates || {};
        const preferences = normalizedSettings.preferences || {};
        const security = normalizedSettings.security || {};
        const sortedBackups = Object.values(backups)
          .filter((entry) => entry && typeof entry === "object")
          .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());

        const gradeKeys = Object.keys(gradesMap || {}).filter(Boolean).sort((a, b) => Number(a) - Number(b));
        const sectionCount = gradeKeys.reduce((total, gradeKey) => total + Object.keys(gradesMap?.[gradeKey]?.sections || {}).length, 0);

        setSchoolInfo(nextSchoolInfo);
        setSchoolForm({
          name: nextSchoolInfo.name || "",
          shortName: nextSchoolInfo.shortName || storedAdmin.shortName || storedAdmin.schoolShortName || "",
          logoUrl: nextSchoolInfo.logoUrl || "",
          addressLine: nextSchoolInfo?.address?.line1 || nextSchoolInfo.address || "",
          city: nextSchoolInfo.city || nextSchoolInfo?.address?.city || "",
          region: nextSchoolInfo.region || nextSchoolInfo?.address?.region || "",
          country: nextSchoolInfo.country || nextSchoolInfo?.address?.country || "Ethiopia",
          phone: String(nextSchoolInfo.phone || ""),
          email: nextSchoolInfo.email || "",
          website: nextSchoolInfo.website || "",
          motto: nextSchoolInfo.motto || "",
        });
        setAcademicForm({
          currentAcademicYear: nextSchoolInfo.currentAcademicYear || "",
          sectionNamingSystem: academicSettings.sectionNamingSystem || "Alphabetical (A, B, C)",
          promotionPassMark: String(academicSettings.promotionPassMark || "50"),
          maxStudentsPerSection: String(academicSettings.maxStudentsPerSection || "45"),
        });
        setTemplateForm({
          ...DEFAULT_TEMPLATE_SETTINGS,
          ...documentTemplates,
        });
        setPreferencesForm({
          ...DEFAULT_PREFERENCES,
          ...preferences,
        });
        setSecurityForm((prev) => ({
          ...prev,
          name: storedAdmin.name || prev.name || "",
          username: storedAdmin.username || prev.username || "",
          sessionTimeout: String(security.sessionTimeout || "30"),
          twoFactorEnabled: Boolean(security.twoFactorEnabled),
          twoFactorSecret: String(security.twoFactorSecret || ""),
          twoFactorRecoveryCodes: Array.isArray(security.twoFactorRecoveryCodes) ? security.twoFactorRecoveryCodes : [],
          newPassword: "",
          confirmPassword: "",
        }));
        setPermissionsForm(normalizedSettings.permissions || DEFAULT_ROLE_PERMISSIONS);
        setBackupStats({
          snapshots: Object.keys(backups).length,
          lastSnapshot: sortedBackups[0]?.createdAt || "",
        });
        setProfileImage(storedAdmin.profileImage || "/default-profile.png");
        setCounts({
          students: Object.keys(studentsData || {}).length,
          parents: Object.keys(parentsData || {}).length,
          teachers: Object.keys(teachersData || {}).length,
          registerers: Object.keys(registerersData || {}).length,
          grades: gradeKeys.length,
          sections: sectionCount,
        });
      } catch (error) {
        console.error("Failed to load settings data:", error);
        if (!cancelled) notify("error", "Failed to load settings data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [backupRoot, dbRoot, schoolCode, storedAdmin.name, storedAdmin.profileImage, storedAdmin.schoolShortName, storedAdmin.shortName, storedAdmin.username]);

  useEffect(() => {
    if (!securityForm.twoFactorEnabled || securityForm.twoFactorSecret) return;

    setSecurityForm((prev) => ({
      ...prev,
      twoFactorSecret: generateSecret(),
      twoFactorRecoveryCodes: prev.twoFactorRecoveryCodes?.length ? prev.twoFactorRecoveryCodes : buildRecoveryCodes(),
    }));
  }, [securityForm.twoFactorEnabled, securityForm.twoFactorRecoveryCodes, securityForm.twoFactorSecret]);

  const systemInfo = useMemo(() => {
    const storageSignals = [schoolInfo.logoUrl, profileImage].filter(Boolean).length;
    return {
      version: "Register v1",
      serverStatus: schoolCode ? "Connected" : "Offline",
      lastUpdate: formatDateForSettings(schoolInfo.createdAt || schoolInfo.updatedAt, preferencesForm),
      storageUsage: `${storageSignals} media assets configured | ${backupStats.snapshots} cloud snapshots`,
    };
  }, [backupStats.snapshots, preferencesForm, profileImage, schoolCode, schoolInfo.createdAt, schoolInfo.logoUrl, schoolInfo.updatedAt]);

  const updateSchoolForm = (key, value) => setSchoolForm((prev) => ({ ...prev, [key]: value }));
  const updateAcademicForm = (key, value) => setAcademicForm((prev) => ({ ...prev, [key]: value }));
  const updateTemplateForm = (key, value) => setTemplateForm((prev) => ({ ...prev, [key]: value }));
  const updatePreferencesForm = (key, value) => setPreferencesForm((prev) => ({ ...prev, [key]: value }));
  const updateSecurityForm = (key, value) => setSecurityForm((prev) => ({ ...prev, [key]: value }));
  const updateRolePermission = (role, key, value) => setPermissionsForm((prev) => ({
    ...prev,
    [role]: {
      ...(prev[role] || {}),
      [key]: value,
    },
  }));

  const saveSchoolInformation = async () => {
    try {
      setSavingKey("school");
      await axios.patch(`${dbRoot}/schoolInfo.json`, {
        name: schoolForm.name,
        shortName: schoolForm.shortName,
        logoUrl: schoolForm.logoUrl,
        phone: schoolForm.phone,
        email: schoolForm.email,
        website: schoolForm.website,
        motto: schoolForm.motto,
        city: schoolForm.city,
        region: schoolForm.region,
        country: schoolForm.country,
        address: {
          ...(schoolInfo.address || {}),
          line1: schoolForm.addressLine,
          city: schoolForm.city,
          region: schoolForm.region,
          country: schoolForm.country,
        },
      });
      setSchoolInfo((prev) => ({
        ...prev,
        name: schoolForm.name,
        shortName: schoolForm.shortName,
        logoUrl: schoolForm.logoUrl,
        phone: schoolForm.phone,
        email: schoolForm.email,
        website: schoolForm.website,
        motto: schoolForm.motto,
        city: schoolForm.city,
        region: schoolForm.region,
        country: schoolForm.country,
        address: {
          ...(prev.address || {}),
          line1: schoolForm.addressLine,
          city: schoolForm.city,
          region: schoolForm.region,
          country: schoolForm.country,
        },
      }));
      notify("success", "School information updated.");
    } catch (error) {
      console.error("Failed to save school information:", error);
      notify("error", "Failed to save school information.");
    } finally {
      setSavingKey("");
    }
  };

  const saveAcademicConfiguration = async () => {
    try {
      setSavingKey("academic");
      const nextSettings = {
        ...(schoolInfo.settings || {}),
        academic: {
          ...((schoolInfo.settings || {}).academic || {}),
          sectionNamingSystem: academicForm.sectionNamingSystem,
          promotionPassMark: Number(academicForm.promotionPassMark || 0),
          maxStudentsPerSection: Number(academicForm.maxStudentsPerSection || 0),
        },
      };
      await axios.patch(`${dbRoot}/schoolInfo.json`, {
        currentAcademicYear: academicForm.currentAcademicYear,
        settings: nextSettings,
      });
      setSchoolInfo((prev) => ({
        ...prev,
        currentAcademicYear: academicForm.currentAcademicYear,
        settings: {
          ...(prev.settings || {}),
          academic: {
            ...((prev.settings || {}).academic || {}),
            sectionNamingSystem: academicForm.sectionNamingSystem,
            promotionPassMark: Number(academicForm.promotionPassMark || 0),
            maxStudentsPerSection: Number(academicForm.maxStudentsPerSection || 0),
          },
        },
      }));
      syncSettingsCache(nextSettings);
      notify("success", "Academic configuration updated.");
    } catch (error) {
      console.error("Failed to save academic configuration:", error);
      notify("error", "Failed to save academic configuration.");
    } finally {
      setSavingKey("");
    }
  };

  const saveTemplates = async () => {
    try {
      setSavingKey("templates");
      const nextSettings = {
        ...(schoolInfo.settings || {}),
        documentTemplates: { ...templateForm },
      };
      await axios.patch(`${dbRoot}/schoolInfo.json`, {
        settings: nextSettings,
      });
      setSchoolInfo((prev) => ({
        ...prev,
        settings: {
          ...(prev.settings || {}),
          documentTemplates: { ...templateForm },
        },
      }));
      syncSettingsCache(nextSettings);
      notify("success", "Document template defaults updated.");
    } catch (error) {
      console.error("Failed to save document templates:", error);
      notify("error", "Failed to save document templates.");
    } finally {
      setSavingKey("");
    }
  };

  const savePreferences = async () => {
    try {
      setSavingKey("preferences");
      const nextSettings = {
        ...(schoolInfo.settings || {}),
        preferences: { ...preferencesForm },
      };
      await axios.patch(`${dbRoot}/schoolInfo.json`, {
        settings: nextSettings,
      });
      setSchoolInfo((prev) => ({
        ...prev,
        settings: {
          ...(prev.settings || {}),
          preferences: { ...preferencesForm },
        },
      }));
      syncSettingsCache(nextSettings);
      notify("success", "System preferences updated.");
    } catch (error) {
      console.error("Failed to save preferences:", error);
      notify("error", "Failed to save system preferences.");
    } finally {
      setSavingKey("");
    }
  };

  const savePermissions = async () => {
    try {
      setSavingKey("permissions");
      const nextSettings = {
        ...(schoolInfo.settings || {}),
        permissions: { ...permissionsForm },
      };

      await axios.patch(`${dbRoot}/schoolInfo.json`, {
        settings: nextSettings,
      });

      setSchoolInfo((prev) => ({
        ...prev,
        settings: {
          ...(prev.settings || {}),
          permissions: { ...permissionsForm },
        },
      }));

      syncSettingsCache(nextSettings);
      notify("success", `${selectedRole.charAt(0).toUpperCase()}${selectedRole.slice(1)} permissions updated.`);
    } catch (error) {
      console.error("Failed to save permissions:", error);
      notify("error", "Failed to save role permissions.");
    } finally {
      setSavingKey("");
    }
  };

  const saveSecurity = async () => {
    if (securityForm.newPassword && securityForm.newPassword !== securityForm.confirmPassword) {
      notify("error", "New password and confirmation do not match.");
      return;
    }

    const twoFactorSecret = securityForm.twoFactorEnabled
      ? (securityForm.twoFactorSecret || generateSecret())
      : "";
    const twoFactorRecoveryCodes = securityForm.twoFactorEnabled
      ? (securityForm.twoFactorRecoveryCodes?.length ? securityForm.twoFactorRecoveryCodes : buildRecoveryCodes())
      : [];

    const twoFactorResult = securityForm.twoFactorEnabled
      ? await verify({
          secret: twoFactorSecret,
          token: String(twoFactorCode || "").trim(),
        }).catch(() => ({ valid: false }))
      : { valid: true };

    if (securityForm.twoFactorEnabled && !twoFactorResult.valid) {
      notify("error", "Enter a valid authenticator code to enable two-factor authentication.");
      return;
    }

    try {
      setSavingKey("security");

      const userPatch = {
        name: securityForm.name,
        username: securityForm.username,
      };

      if (securityForm.newPassword) {
        userPatch.password = securityForm.newPassword;
      }

      if (admin.userId) {
        await axios.patch(`${dbRoot}/Users/${admin.userId}.json`, userPatch);
      }

      let nextProfileImage = profileImage;

      if (selectedProfileFile && admin.userId) {
        const nextProfileImage = await fileToBase64(selectedProfileFile);
        await axios.patch(`${dbRoot}/Users/${admin.userId}.json`, { profileImage: nextProfileImage });
        setProfileImage(nextProfileImage);
        const updatedAdmin = { ...admin, profileImage: nextProfileImage, name: securityForm.name, username: securityForm.username };
        persistAdmin(updatedAdmin);
      } else {
        persistAdmin({ ...admin, name: securityForm.name, username: securityForm.username, role: currentRole });
      }

      const nextSettings = {
        ...(schoolInfo.settings || {}),
        security: {
          ...((schoolInfo.settings || {}).security || {}),
          sessionTimeout: Number(securityForm.sessionTimeout || 0),
          twoFactorEnabled: Boolean(securityForm.twoFactorEnabled),
          twoFactorSecret,
          twoFactorRecoveryCodes,
        },
      };

      await axios.patch(`${dbRoot}/schoolInfo.json`, {
        settings: nextSettings,
      });

      setSelectedProfileFile(null);
      setSecurityForm((prev) => ({
        ...prev,
        newPassword: "",
        confirmPassword: "",
        twoFactorSecret,
        twoFactorRecoveryCodes,
      }));
      setTwoFactorCode("");
      syncSettingsCache(nextSettings);
      notify("success", "Security and account settings updated.");
    } catch (error) {
      console.error("Failed to save security settings:", error);
      notify("error", "Failed to update security settings.");
    } finally {
      setSavingKey("");
    }
  };

  const exportSchoolData = async () => {
    try {
      setSavingKey("backupExport");
      const response = await axios.get(`${dbRoot}.json`).catch(() => ({ data: {} }));
      downloadJsonFile(`register-backup-${schoolCode || "school"}-${Date.now()}.json`, response.data || {});
      notify("success", "School backup downloaded.");
    } catch (error) {
      console.error("Failed to export school backup:", error);
      notify("error", "Failed to export school data.");
    } finally {
      setSavingKey("");
    }
  };

  const createCloudSnapshot = async () => {
    if (!backupRoot) {
      notify("error", "Missing school code. Cannot create backup snapshot.");
      return;
    }

    try {
      setSavingKey("backupSnapshot");
      const response = await axios.get(`${dbRoot}.json`).catch(() => ({ data: {} }));
      const snapshotId = `${Date.now()}`;
      await axios.put(`${backupRoot}/${snapshotId}.json`, {
        createdAt: new Date().toISOString(),
        createdBy: admin.userId || admin.username || "registerer",
        data: response.data || {},
      });
      setBackupStats((prev) => ({ snapshots: prev.snapshots + 1, lastSnapshot: new Date().toISOString() }));
      notify("success", "Cloud snapshot created.");
    } catch (error) {
      console.error("Failed to create cloud snapshot:", error);
      notify("error", "Failed to create cloud backup snapshot.");
    } finally {
      setSavingKey("");
    }
  };

  const restoreSchoolBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setSavingKey("backupRestore");
      const text = await file.text();
      const parsed = JSON.parse(text || "{}");

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        notify("error", "Backup file is not a valid school data export.");
        return;
      }

      if (!window.confirm("Restore this backup? This will replace the current school data.")) {
        return;
      }

      if (backupRoot) {
        const currentData = await axios.get(`${dbRoot}.json`).catch(() => ({ data: {} }));
        await axios.put(`${backupRoot}/pre_restore_${Date.now()}.json`, {
          createdAt: new Date().toISOString(),
          createdBy: admin.userId || admin.username || "registerer",
          reason: "Automatic snapshot before restore",
          data: currentData.data || {},
        });
      }

      await axios.put(`${dbRoot}.json`, parsed);
      syncSettingsCache(parsed.schoolInfo || parsed);
      notify("success", "Backup restored. Reloading settings...");
      window.location.reload();
    } catch (error) {
      console.error("Failed to restore backup:", error);
      notify("error", "Failed to restore backup file.");
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = "";
      setSavingKey("");
    }
  };

  const pageStyle = {
    padding: "10px 4px 28px",
    minWidth: 0,
    boxSizing: "border-box",
    color: "var(--text-primary)",
  };
  const shellStyle = {
    width: "min(100%, 1220px)",
    margin: 0,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.75fr) minmax(320px, 0.9fr)",
    gap: 14,
    alignItems: "start",
  };
  const panelStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    borderRadius: 16,
    boxShadow: "var(--shadow-soft)",
  };
  const sectionStyle = {
    ...panelStyle,
    padding: 18,
  };
  const statStyle = {
    ...panelStyle,
    padding: 14,
  };
  const labelStyle = {
    display: "block",
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text-secondary)",
  };
  const inputStyle = {
    width: "100%",
    border: "1px solid var(--input-border)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    outline: "none",
  };
  const textareaStyle = {
    ...inputStyle,
    minHeight: 94,
    resize: "vertical",
  };
  const primaryButtonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "1px solid var(--accent-strong)",
    background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
    color: "#fff",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "var(--shadow-glow)",
  };
  const subtleButtonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "1px solid var(--border-strong)",
    background: "var(--surface-panel)",
    color: "var(--accent-strong)",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  };
  const tinyPillStyle = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 11,
    fontWeight: 800,
    background: "var(--surface-accent)",
    color: "var(--accent-strong)",
    border: "1px solid var(--border-strong)",
  };

  return (
    <div style={pageStyle}>
      <div style={{ width: "min(100%, 1220px)", margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="section-header-card" style={{ padding: 20 }}>
          <div className="section-header-card__row">
            <div>
              <h1 className="section-header-card__title" style={{ fontSize: 28, fontWeight: 900 }}>Settings</h1>
              <p className="section-header-card__subtitle" style={{ fontSize: 14 }}>
                A cleaner registrar settings workspace with school information, academic configuration, user tools, templates, and security in one place.
              </p>
            </div>
            <div className="section-header-card__actions">
              <span className="section-header-card__chip">School: {schoolCode || "Unknown"}</span>
              <span className="section-header-card__chip">{loading ? "Loading..." : `Users: ${counts.registerers + counts.teachers}`}</span>
            </div>
          </div>
        </div>

        {feedback.text ? (
          <div
            style={{
              ...panelStyle,
              padding: "12px 14px",
              borderColor: feedback.type === "error" ? "var(--danger-border)" : "var(--border-strong)",
              background: feedback.type === "error" ? "var(--danger-soft)" : "var(--surface-accent)",
              color: feedback.type === "error" ? "var(--danger)" : "var(--accent-strong)",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {feedback.text}
          </div>
        ) : null}

        <div style={shellStyle}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FaGlobe style={{ color: "var(--accent-strong)" }} />
                    <div style={{ fontSize: 18, fontWeight: 900 }}>School Information</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
                    Basic school details used in ID cards, documents, certificates, and registrar records.
                  </div>
                </div>
                <button type="button" onClick={saveSchoolInformation} disabled={savingKey === "school"} style={{ ...primaryButtonStyle, opacity: savingKey === "school" ? 0.7 : 1 }}>
                  <FaSave /> {savingKey === "school" ? "Saving..." : "Save School Info"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 260px)", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>School Name</label>
                    <input value={schoolForm.name} onChange={(event) => updateSchoolForm("name", event.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Short Name</label>
                    <input value={schoolForm.shortName} onChange={(event) => updateSchoolForm("shortName", event.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>School Motto</label>
                    <input value={schoolForm.motto} onChange={(event) => updateSchoolForm("motto", event.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>School Logo URL</label>
                    <input value={schoolForm.logoUrl} onChange={(event) => updateSchoolForm("logoUrl", event.target.value)} style={inputStyle} placeholder="https://..." />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>School Address</label>
                    <textarea value={schoolForm.addressLine} onChange={(event) => updateSchoolForm("addressLine", event.target.value)} style={textareaStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input value={schoolForm.city} onChange={(event) => updateSchoolForm("city", event.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Region</label>
                    <input value={schoolForm.region} onChange={(event) => updateSchoolForm("region", event.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Country</label>
                    <input value={schoolForm.country} onChange={(event) => updateSchoolForm("country", event.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone Number</label>
                    <input value={schoolForm.phone} onChange={(event) => updateSchoolForm("phone", event.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input value={schoolForm.email} onChange={(event) => updateSchoolForm("email", event.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Website</label>
                    <input value={schoolForm.website} onChange={(event) => updateSchoolForm("website", event.target.value)} style={inputStyle} placeholder="https://school.example.com" />
                  </div>
                </div>

                <div style={{ ...panelStyle, padding: 14, background: "linear-gradient(180deg, var(--surface-muted) 0%, var(--surface-panel) 100%)" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 10 }}>Preview</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <img
                      src={schoolForm.logoUrl || "/default-profile.png"}
                      alt="School logo"
                      style={{ width: 92, height: 92, borderRadius: 18, objectFit: "cover", border: "1px solid var(--border-soft)", background: "var(--surface-panel)" }}
                    />
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{schoolForm.name || "School Name"}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{schoolForm.motto || "School motto appears here"}</div>
                    <div style={{ display: "grid", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                      <div>{schoolForm.city || "City"}, {schoolForm.region || "Region"}</div>
                      <div>{schoolForm.phone || "Phone"}</div>
                      <div>{schoolForm.email || "Email"}</div>
                      <div>{schoolForm.website || "Website"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                      <span style={tinyPillStyle}>ID Cards</span>
                      <span style={tinyPillStyle}>Certificates</span>
                      <span style={tinyPillStyle}>Documents</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FaChalkboardTeacher style={{ color: "var(--accent-strong)" }} />
                    <div style={{ fontSize: 18, fontWeight: 900 }}>Academic Configuration</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
                    Control the academic structure, promotion threshold, section naming, and capacity defaults.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => navigate("/academic-years")} style={subtleButtonStyle}>Academic Years</button>
                  <button type="button" onClick={() => navigate("/grede-management")} style={subtleButtonStyle}>Grade Management</button>
                  <button type="button" onClick={saveAcademicConfiguration} disabled={savingKey === "academic"} style={{ ...primaryButtonStyle, opacity: savingKey === "academic" ? 0.7 : 1 }}>
                    <FaSave /> {savingKey === "academic" ? "Saving..." : "Save Academic Config"}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Current Academic Year</label>
                  <input value={academicForm.currentAcademicYear} onChange={(event) => updateAcademicForm("currentAcademicYear", event.target.value)} style={inputStyle} placeholder="2028_2029" />
                </div>
                <div>
                  <label style={labelStyle}>Section Naming System</label>
                  <select value={academicForm.sectionNamingSystem} onChange={(event) => updateAcademicForm("sectionNamingSystem", event.target.value)} style={inputStyle}>
                    <option value="Alphabetical (A, B, C)">Alphabetical (A, B, C)</option>
                    <option value="Numeric (1, 2, 3)">Numeric (1, 2, 3)</option>
                    <option value="Custom Mixed">Custom Mixed</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Promotion Pass Mark (%)</label>
                  <input value={academicForm.promotionPassMark} onChange={(event) => updateAcademicForm("promotionPassMark", event.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Default Max Students per Section</label>
                  <input value={academicForm.maxStudentsPerSection} onChange={(event) => updateAcademicForm("maxStudentsPerSection", event.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
                <div style={statStyle}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>Grade Levels</div>
                  <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "var(--accent-strong)" }}>{loading ? "--" : counts.grades}</div>
                </div>
                <div style={statStyle}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>Sections</div>
                  <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "var(--success)" }}>{loading ? "--" : counts.sections}</div>
                </div>
                <div style={statStyle}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>Pass Mark</div>
                  <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>{academicForm.promotionPassMark}%</div>
                </div>
                <div style={statStyle}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>Max Students</div>
                  <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>{academicForm.maxStudentsPerSection}</div>
                </div>
              </div>
            </div>

            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FaUsers style={{ color: "var(--accent-strong)" }} />
                    <div style={{ fontSize: 18, fontWeight: 900 }}>User Management</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
                    Create users, review counts, and jump to live register pages for students, parents, teachers, and registrar staff.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => navigate("/student-register")} style={subtleButtonStyle}><FaUserPlus /> Add Student</button>
                  <button type="button" onClick={() => navigate("/teacher-register")} style={subtleButtonStyle}><FaUserPlus /> Add Teacher</button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                {[
                  { label: "Students", value: counts.students, action: () => navigate("/students") },
                  { label: "Parents", value: counts.parents, action: () => navigate("/parents") },
                  { label: "Teachers", value: counts.teachers, action: () => navigate("/teacher-register") },
                  { label: "Registrars", value: counts.registerers, action: () => navigate("/registerer-register") },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    style={{ ...statStyle, textAlign: "left", cursor: "pointer" }}
                  >
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{item.label}</div>
                    <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900, color: "var(--text-primary)" }}>{loading ? "--" : item.value}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--accent-strong)", fontWeight: 700 }}>Open</div>
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <button type="button" onClick={() => navigate("/parent-register")} style={subtleButtonStyle}>Create Parent</button>
                <button type="button" onClick={() => navigate("/registerer-register")} style={subtleButtonStyle}>Create Registrar</button>
                <button type="button" onClick={() => navigate("/all-chat")} style={subtleButtonStyle}>Open Staff Communication</button>
              </div>
            </div>

            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FaFileAlt style={{ color: "var(--accent-strong)" }} />
                    <div style={{ fontSize: 18, fontWeight: 900 }}>Document Templates</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
                    Configure document naming defaults for ID cards, enrollment letters, transfer letters, and certificates.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => navigate("/document-generation")} style={subtleButtonStyle}><FaExternalLinkAlt /> Open Document Generation</button>
                  <button type="button" onClick={saveTemplates} disabled={savingKey === "templates"} style={{ ...primaryButtonStyle, opacity: savingKey === "templates" ? 0.7 : 1 }}>
                    <FaSave /> {savingKey === "templates" ? "Saving..." : "Save Templates"}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Student ID Card Title</label>
                  <input value={templateForm.idCardTitle} onChange={(event) => updateTemplateForm("idCardTitle", event.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Enrollment Letter Title</label>
                  <input value={templateForm.enrollmentLetterTitle} onChange={(event) => updateTemplateForm("enrollmentLetterTitle", event.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Transfer Letter Title</label>
                  <input value={templateForm.transferLetterTitle} onChange={(event) => updateTemplateForm("transferLetterTitle", event.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Certificate Title</label>
                  <input value={templateForm.certificateTitle} onChange={(event) => updateTemplateForm("certificateTitle", event.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Signatory Name</label>
                  <input value={templateForm.signatoryName} onChange={(event) => updateTemplateForm("signatoryName", event.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Footer Note</label>
                  <input value={templateForm.footerNote} onChange={(event) => updateTemplateForm("footerNote", event.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FaLock style={{ color: "var(--accent-strong)" }} />
                    <div style={{ fontSize: 18, fontWeight: 900 }}>Security</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
                    Update registrar account details, password, session timeout, and profile image from one place.
                  </div>
                </div>
                <button type="button" onClick={saveSecurity} disabled={savingKey === "security"} style={{ ...primaryButtonStyle, opacity: savingKey === "security" ? 0.7 : 1 }}>
                  <FaSave /> {savingKey === "security" ? "Saving..." : "Save Security Settings"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", gap: 14 }}>
                <div style={{ ...panelStyle, padding: 14, background: "linear-gradient(180deg, var(--surface-muted) 0%, var(--surface-panel) 100%)" }}>
                  <ProfileAvatar imageUrl={profileImage} name={securityForm.name || "Register Office"} size={96} style={{ border: "3px solid var(--border-strong)", boxShadow: "var(--shadow-glow)" }} />
                  <div style={{ marginTop: 12, fontSize: 16, fontWeight: 900 }}>{securityForm.name || "Register Office"}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>@{securityForm.username || "registrar"}</div>
                  <div style={{ marginTop: 12 }}>
                    <label style={labelStyle}>Profile Image</label>
                    <input type="file" accept="image/*" onChange={(event) => setSelectedProfileFile(event.target.files?.[0] || null)} style={{ ...inputStyle, padding: 8 }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Display Name</label>
                    <input value={securityForm.name} onChange={(event) => updateSecurityForm("name", event.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Username</label>
                    <input value={securityForm.username} onChange={(event) => updateSecurityForm("username", event.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>New Password</label>
                    <input type="password" value={securityForm.newPassword} onChange={(event) => updateSecurityForm("newPassword", event.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm Password</label>
                    <input type="password" value={securityForm.confirmPassword} onChange={(event) => updateSecurityForm("confirmPassword", event.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Session Timeout (minutes)</label>
                    <select value={securityForm.sessionTimeout} onChange={(event) => updateSecurityForm("sessionTimeout", event.target.value)} style={inputStyle}>
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">60 minutes</option>
                      <option value="120">120 minutes</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Two-Factor Authentication</label>
                    <select value={securityForm.twoFactorEnabled ? "enabled" : "disabled"} onChange={(event) => updateSecurityForm("twoFactorEnabled", event.target.value === "enabled")} style={inputStyle}>
                      <option value="disabled">Disabled</option>
                      <option value="enabled">Enabled</option>
                    </select>
                  </div>
                </div>

                {securityForm.twoFactorEnabled ? (
                  <div style={{ ...panelStyle, padding: 14, marginTop: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 10 }}>Authenticator Setup</div>
                    <div style={{ display: "grid", gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Setup Key</label>
                        <input
                          value={securityForm.twoFactorSecret || ""}
                          readOnly
                          style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: "0.08em" }}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Verification Code</label>
                        <input
                          value={twoFactorCode}
                          onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="Enter 6-digit authenticator code"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Recovery Codes</label>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                          {(securityForm.twoFactorRecoveryCodes || []).map((code) => (
                            <div key={code} style={{ ...panelStyle, padding: "8px 10px", fontFamily: "monospace", fontSize: 12, fontWeight: 800 }}>
                              {code}
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateSecurityForm("twoFactorRecoveryCodes", buildRecoveryCodes())}
                        style={subtleButtonStyle}
                      >
                        Regenerate Recovery Codes
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <FaCog style={{ color: "var(--accent-strong)" }} />
                <div style={{ fontSize: 17, fontWeight: 900 }}>System Preferences</div>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Language</label>
                  <select value={preferencesForm.language} onChange={(event) => updatePreferencesForm("language", event.target.value)} style={inputStyle}>
                    <option value="English">English</option>
                    <option value="Afaan Oromo">Afaan Oromo</option>
                    <option value="Amharic">Amharic</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Time Zone</label>
                  <input value={preferencesForm.timeZone} onChange={(event) => updatePreferencesForm("timeZone", event.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Date Format</label>
                  <select value={preferencesForm.dateFormat} onChange={(event) => updatePreferencesForm("dateFormat", event.target.value)} style={inputStyle}>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Default Page</label>
                  <select value={preferencesForm.defaultPage} onChange={(event) => updatePreferencesForm("defaultPage", event.target.value)} style={inputStyle}>
                    <option value="/dashboard">Dashboard</option>
                    <option value="/overview">Overview</option>
                    <option value="/students">Students</option>
                    <option value="/document-generation">Document Generation</option>
                  </select>
                </div>
                <button type="button" onClick={toggleDarkMode} style={{ ...subtleButtonStyle, justifyContent: "space-between" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{darkMode ? <FaMoon /> : <FaSun />} Theme</span>
                  <span>{darkMode ? "Dark" : "Light"}</span>
                </button>
                <button type="button" onClick={savePreferences} disabled={savingKey === "preferences"} style={{ ...primaryButtonStyle, opacity: savingKey === "preferences" ? 0.7 : 1 }}>
                  <FaSave /> {savingKey === "preferences" ? "Saving..." : "Save Preferences"}
                </button>
              </div>
            </div>

            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FaUsers style={{ color: "var(--accent-strong)" }} />
                  <div style={{ fontSize: 17, fontWeight: 900 }}>Roles & Notifications</div>
                </div>
                <button type="button" onClick={savePermissions} disabled={savingKey === "permissions"} style={{ ...primaryButtonStyle, opacity: savingKey === "permissions" ? 0.7 : 1 }}>
                  <FaSave /> {savingKey === "permissions" ? "Saving..." : "Save Role Access"}
                </button>
              </div>

              <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                {[
                  { key: "emailNotifications", label: "Email notifications" },
                  { key: "systemAlerts", label: "System alerts" },
                  { key: "deadlineReminders", label: "Deadline reminders" },
                  { key: "registrationAlerts", label: "Registration alerts" },
                ].map((item) => (
                  <label key={item.key} style={{ ...panelStyle, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{item.label}</span>
                    <input type="checkbox" checked={Boolean(preferencesForm[item.key])} onChange={(event) => updatePreferencesForm(item.key, event.target.checked)} />
                  </label>
                ))}
              </div>

              <div style={{ ...panelStyle, padding: 12, marginBottom: 12 }}>
                <label style={labelStyle}>Manage Role Access</label>
                <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} style={inputStyle}>
                  {MANAGED_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase()}{role.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <label key={key} style={{ ...panelStyle, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(permissionsForm[selectedRole]?.[key])}
                      onChange={(event) => updateRolePermission(selectedRole, key, event.target.checked)}
                    />
                  </label>
                ))}
              </div>

              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 12 }}>
                Role access is enforced in navigation, protected routes, and default-page redirects for new sessions.
              </div>
            </div>

            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <FaDatabase style={{ color: "var(--accent-strong)" }} />
                <div style={{ fontSize: 17, fontWeight: 900 }}>Backup & Data</div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <button type="button" onClick={exportSchoolData} disabled={savingKey === "backupExport"} style={subtleButtonStyle}>
                  <FaExternalLinkAlt /> Export School Data
                </button>
                <button type="button" onClick={createCloudSnapshot} disabled={savingKey === "backupSnapshot"} style={subtleButtonStyle}>
                  <FaDatabase /> Create Cloud Snapshot
                </button>
                <button type="button" onClick={() => backupInputRef.current?.click()} disabled={savingKey === "backupRestore"} style={subtleButtonStyle}>
                  <FaDatabase /> Restore From Backup File
                </button>
                <button type="button" onClick={() => navigate("/academic-years")} style={subtleButtonStyle}>
                  <FaDatabase /> Open Academic Archives
                </button>
                <button type="button" onClick={() => window.open(`${dbRoot}/YearHistory.json`, "_blank", "noopener,noreferrer")} style={subtleButtonStyle}>
                  <FaExternalLinkAlt /> View YearHistory Snapshot
                </button>
                <input ref={backupInputRef} type="file" accept="application/json" onChange={restoreSchoolBackup} style={{ display: "none" }} />
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
                Cloud snapshots: {backupStats.snapshots}. Latest snapshot: {backupStats.lastSnapshot ? formatDateForSettings(Number(backupStats.lastSnapshot), preferencesForm) : "Not available"}.
              </div>
            </div>

            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <FaFileAlt style={{ color: "var(--accent-strong)" }} />
                <div style={{ fontSize: 17, fontWeight: 900 }}>System Information</div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  { label: "System version", value: systemInfo.version },
                  { label: "Server status", value: systemInfo.serverStatus },
                  { label: "Last update", value: systemInfo.lastUpdate },
                  { label: "Storage usage", value: systemInfo.storageUsage },
                ].map((item) => (
                  <div key={item.label} style={{ ...panelStyle, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{item.label}</div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-primary)", fontWeight: 800 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
