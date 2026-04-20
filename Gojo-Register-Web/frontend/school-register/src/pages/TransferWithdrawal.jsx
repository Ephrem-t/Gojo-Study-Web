import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaBell,
  FaChartLine,
  FaChalkboardTeacher,
  FaChevronDown,
  FaCog,
  FaExchangeAlt,
  FaFacebookMessenger,
  FaFileAlt,
  FaHome,
  FaSearch,
  FaSignOutAlt,
  FaSyncAlt,
  FaUserTimes,
  FaUsers,
} from "react-icons/fa";
import axios from "axios";
import { BACKEND_BASE } from "../config";
import RegisterSidebar from "../components/RegisterSidebar";
import ProfileAvatar from "../components/ProfileAvatar";
import {
  loadSchoolInfoNode,
  loadSchoolParentsNode,
  loadSchoolStudentsNode,
  loadSchoolUsersNode,
} from "../utils/registerData";
import { fetchCachedJson } from "../utils/rtdbCache";

const PAGE_BG = "linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-secondary) 100%)";

const cardStyle = {
  background: "var(--surface-panel)",
  border: "1px solid var(--border-soft)",
  borderRadius: 12,
  boxShadow: "var(--shadow-panel)",
};

const summaryCardStyle = {
  border: "1px solid var(--border-soft)",
  borderRadius: 10,
  padding: 10,
  background: "var(--surface-muted)",
};

const fieldLabelStyle = {
  display: "block",
  marginBottom: 4,
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-secondary)",
};

const fieldStyle = {
  width: "100%",
  border: "1px solid var(--input-border)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  boxSizing: "border-box",
  background: "var(--input-bg)",
  color: "var(--text-primary)",
};

const searchBarShellStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--border-soft)",
  background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)",
  boxShadow: "var(--shadow-soft)",
  boxSizing: "border-box",
};

const searchBarInputStyle = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "var(--text-primary)",
  fontSize: 13,
  fontWeight: 600,
};

const selectShellStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--border-soft)",
  background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)",
  boxShadow: "var(--shadow-soft)",
  boxSizing: "border-box",
};

const selectInputStyle = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "var(--text-primary)",
  fontSize: 13,
  fontWeight: 700,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  cursor: "pointer",
};

const selectChevronStyle = {
  width: 30,
  height: 30,
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--surface-panel)",
  border: "1px solid var(--border-soft)",
  color: "var(--accent-strong)",
  flexShrink: 0,
  pointerEvents: "none",
};

const textFieldShellStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--border-soft)",
  background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)",
  boxShadow: "var(--shadow-soft)",
  boxSizing: "border-box",
};

const textFieldInputStyle = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "var(--text-primary)",
  fontSize: 13,
  fontWeight: 600,
};

const textAreaShellStyle = {
  display: "grid",
  gridTemplateColumns: "32px minmax(0, 1fr)",
  alignItems: "start",
  gap: 10,
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--border-soft)",
  background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)",
  boxShadow: "var(--shadow-soft)",
  boxSizing: "border-box",
};

const textAreaInputStyle = {
  width: "100%",
  minHeight: 78,
  border: "none",
  outline: "none",
  resize: "vertical",
  background: "transparent",
  color: "var(--text-primary)",
  fontSize: 13,
  fontWeight: 600,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const fieldIconBoxStyle = {
  width: 32,
  height: 32,
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--surface-accent)",
  color: "var(--accent-strong)",
  flexShrink: 0,
};

const toggleCardStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid var(--border-soft)",
  background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)",
  boxShadow: "var(--shadow-soft)",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-secondary)",
};

const selectedCardStyle = {
  marginTop: 12,
  border: "1px solid var(--border-soft)",
  borderRadius: 14,
  padding: 14,
  background: "linear-gradient(135deg, var(--surface-accent) 0%, var(--surface-muted) 100%)",
  boxShadow: "var(--shadow-soft)",
};

const searchResultsPanelStyle = {
  marginTop: 8,
  border: "1px solid var(--border-soft)",
  borderRadius: 12,
  background: "var(--surface-panel)",
  boxShadow: "var(--shadow-soft)",
  overflow: "hidden",
};

const searchResultButtonStyle = (isActive) => ({
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  background: isActive ? "var(--surface-accent)" : "transparent",
  border: "none",
  borderBottom: "1px solid var(--border-soft)",
  cursor: "pointer",
  textAlign: "left",
});

const heroActionStyle = {
  border: "1px solid rgba(255,255,255,0.45)",
  background: "rgba(255,255,255,0.15)",
  color: "#fff",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 700,
};

const dangerButtonStyle = {
  border: "1px solid var(--danger)",
  background: "var(--danger)",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 800,
};

const neutralButtonStyle = {
  border: "1px solid var(--input-border)",
  background: "var(--surface-panel)",
  color: "var(--text-secondary)",
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 700,
};

const yearLabel = (key) => String(key || "").replace("_", "/");

const normalizeParents = (node) => {
  if (Array.isArray(node)) return node;
  if (node && typeof node === "object") return Object.values(node);
  return [];
};

const getStudentStatus = (student = {}) =>
  String(student.status || student.basicStudentInformation?.status || "active").toLowerCase();

const getLinkedParentIds = (studentNode = {}) => {
  const parentIds = new Set();

  Object.keys(studentNode?.parents || {}).forEach((pid) => {
    if (pid) parentIds.add(String(pid));
  });

  normalizeParents(studentNode?.parentGuardianInformation?.parents).forEach((parent) => {
    const pid = String(parent?.parentId || "").trim();
    if (pid) parentIds.add(pid);
  });

  return [...parentIds];
};

const studentReferencesParent = (studentNode = {}, parentId) => {
  if (!parentId) return false;
  const canonicalParentId = String(parentId);

  if (studentNode?.parents && studentNode.parents[canonicalParentId]) {
    return true;
  }

  return normalizeParents(studentNode?.parentGuardianInformation?.parents).some(
    (parent) => String(parent?.parentId || "").trim() === canonicalParentId
  );
};

export default function TransferWithdrawal() {
  const navigate = useNavigate();

  const stored = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("registrar") || localStorage.getItem("admin") || "{}") || {};
    } catch {
      return {};
    }
  }, []);

  const schoolCode = stored.schoolCode || "";
  const DB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";
  const DB_URL = schoolCode ? `${DB_BASE}/Platform1/Schools/${schoolCode}` : DB_BASE;

  const admin = {
    name: stored.name || stored.username || "Register Office",
    adminId: stored.financeId || stored.adminId || stored.userId || "",
    userId: stored.userId || "",
    profileImage: stored.profileImage || "/default-profile.png",
    username: stored.username || "",
  };

  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(true);
  const [studentMenuOpen, setStudentMenuOpen] = useState(true);

  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  const [academicYears, setAcademicYears] = useState({});
  const [currentAcademicYear, setCurrentAcademicYear] = useState("");
  const [studentsMap, setStudentsMap] = useState({});
  const [parentsMap, setParentsMap] = useState({});

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [actionType, setActionType] = useState("transfer_out");
  const [note, setNote] = useState("");
  const [destinationSchool, setDestinationSchool] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [registererPassword, setRegistererPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const notify = (type, text) => setFeedback({ type, text });

  const loadBaseData = async () => {
    if (!schoolCode) {
      notify("error", "Missing schoolCode in session. Please login again.");
      return;
    }

    setLoading(true);
    try {
      const [yearsRes, dbYearsData, schoolInfo, studentsData, parentsData] = await Promise.all([
        axios.get(`${BACKEND_BASE}/api/academic-years`, { params: { schoolCode } }).catch(() => ({ data: {} })),
        fetchCachedJson(`${DB_URL}/AcademicYears.json`, { ttlMs: 60000 }).catch(() => ({})),
        loadSchoolInfoNode({ rtdbBase: DB_URL }),
        loadSchoolStudentsNode({ rtdbBase: DB_URL }),
        loadSchoolParentsNode({ rtdbBase: DB_URL }),
      ]);

      const yearsPayload = yearsRes.data || {};
      const nextYears = yearsPayload.academicYears || dbYearsData || {};
      const derivedCurrent = Object.entries(nextYears || {}).find(([, row]) => !!row?.isCurrent)?.[0] || "";
      const nextCurrent = yearsPayload.currentAcademicYear || schoolInfo?.currentAcademicYear || derivedCurrent || "";

      setAcademicYears(nextYears);
      setCurrentAcademicYear(nextCurrent);
      setStudentsMap(studentsData || {});
      setParentsMap(parentsData || {});

      notify("", "");
    } catch (err) {
      notify("error", err?.response?.data?.message || err?.message || "Failed to load transfer/withdrawal data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBaseData();
  }, [schoolCode]);

  const activeStudents = useMemo(() => {
    const list = [];
    Object.entries(studentsMap || {}).forEach(([studentId, row]) => {
      const student = row || {};
      const status = getStudentStatus(student);
      if (status !== "active") return;

      const name =
        student.name ||
        [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ") ||
        student.basicStudentInformation?.name ||
        "Student";

      list.push({
        studentId,
        name,
        grade: String(student.grade || student.basicStudentInformation?.grade || ""),
        section: String(student.section || student.basicStudentInformation?.section || "").toUpperCase(),
        userId: student.userId || student.systemAccountInformation?.userId || "",
        raw: student,
      });
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [studentsMap]);

  const selectedStudent = useMemo(
    () => activeStudents.find((s) => s.studentId === selectedStudentId) || null,
    [activeStudents, selectedStudentId]
  );

  const filteredActiveStudents = useMemo(() => {
    const q = String(studentSearch || "").trim().toLowerCase();
    if (!q) return activeStudents;
    return activeStudents.filter((student) => {
      const id = String(student.studentId || "").toLowerCase();
      const name = String(student.name || "").toLowerCase();
      const grade = String(student.grade || "").toLowerCase();
      const section = String(student.section || "").toLowerCase();
      return id.includes(q) || name.includes(q) || grade.includes(q) || section.includes(q);
    });
  }, [activeStudents, studentSearch]);

  const actionLabel = useMemo(() => {
    if (actionType === "withdraw") return "Withdraw";
    if (actionType === "graduate") return "Graduate";
    return "Transfer Out";
  }, [actionType]);

  const feedbackStyles = useMemo(() => {
    if (feedback.type === "error") {
      return {
        color: "var(--danger)",
        background: "var(--danger-soft)",
        border: "1px solid var(--danger-border)",
      };
    }
    if (feedback.type === "warning") {
      return {
        color: "var(--warning)",
        background: "var(--warning-soft)",
        border: "1px solid var(--warning-border)",
      };
    }
    return {
      color: "var(--success)",
      background: "var(--success-soft)",
      border: "1px solid var(--success-border)",
    };
  }, [feedback.type]);

  const openConfirmModal = () => {
    if (!selectedStudent) {
      notify("error", "Select a student first.");
      return;
    }
    if (!currentAcademicYear) {
      notify("error", "Current academic year is missing.");
      return;
    }
    setRegistererPassword("");
    setPasswordError("");
    setShowConfirmModal(true);
  };

  const handleSelectStudentChoice = (studentId) => {
    setSelectedStudentId(studentId);
    setStudentSearch("");
  };

  const copyParentsToYearHistory = async (yearKey, studentNode) => {
    const parentIds = getLinkedParentIds(studentNode);

    await Promise.all(
      parentIds.map(async (pid) => {
        const parentPayload = parentsMap[pid] || {
          parentId: pid,
          name: "Parent",
          schoolCode,
        };
        await axios.patch(`${DB_URL}/YearHistory/${yearKey}/Parents/${pid}.json`, {
          ...(parentPayload || {}),
          parentId: pid,
          schoolCode,
          movedAt: new Date().toISOString(),
        });
      })
    );
  };

  const setUsersActiveByStudent = async (studentNode, isActive) => {
    const users = await loadSchoolUsersNode({ rtdbBase: DB_URL });

    const studentId = String(studentNode?.studentId || "");
    const studentUserId = String(studentNode?.userId || studentNode?.systemAccountInformation?.userId || "");
    const usernames = new Set([
      String(studentNode?.systemAccountInformation?.username || "").toLowerCase(),
      String(studentNode?.username || "").toLowerCase(),
    ].filter(Boolean));

    const patchUserIds = new Set();
    if (studentUserId) patchUserIds.add(studentUserId);
    Object.entries(users).forEach(([uid, row]) => {
      const user = row || {};
      const uname = String(user.username || "").toLowerCase();
      if (String(user.studentId || "") === studentId) patchUserIds.add(uid);
      if (usernames.has(uname)) patchUserIds.add(uid);
    });

    await Promise.all(
      [...patchUserIds].map((uid) => axios.patch(`${DB_URL}/Users/${uid}.json`, { isActive }))
    );
  };

  const cleanupParentsAfterStudentRemoval = async (studentNode) => {
    const studentId = String(studentNode?.studentId || selectedStudent?.studentId || "").trim();
    if (!studentId) return;

    const linkedParentIds = getLinkedParentIds(studentNode);
    if (linkedParentIds.length === 0) return;

    const users = await loadSchoolUsersNode({ rtdbBase: DB_URL });
    const remainingStudents = Object.entries(studentsMap || {}).filter(([sid]) => String(sid) !== studentId);

    await Promise.all(
      linkedParentIds.map(async (parentId) => {
        const parentRecord = parentsMap[parentId] || (await axios.get(`${DB_URL}/Parents/${parentId}.json`).catch(() => ({ data: null }))).data || null;
        const nextChildrenEntries = Object.entries(parentRecord?.children || {}).filter(
          ([, childLink]) => String(childLink?.studentId || "") !== studentId
        );
        const nextChildren = Object.fromEntries(nextChildrenEntries);
        const stillLinkedElsewhere = remainingStudents.some(([, studentRow]) => studentReferencesParent(studentRow || {}, parentId));

        if (!stillLinkedElsewhere) {
          await axios.delete(`${DB_URL}/Parents/${parentId}.json`).catch(() => {});

          const parentUserIds = new Set();
          const directUserId = String(parentRecord?.userId || studentNode?.parents?.[parentId]?.userId || "").trim();
          if (directUserId) parentUserIds.add(directUserId);

          Object.entries(users).forEach(([uid, userRow]) => {
            if (String(userRow?.parentId || "").trim() === String(parentId)) {
              parentUserIds.add(uid);
            }
          });

          await Promise.all([...parentUserIds].map((uid) => axios.delete(`${DB_URL}/Users/${uid}.json`).catch(() => {})));
          return;
        }

        await axios.patch(`${DB_URL}/Parents/${parentId}.json`, {
          children: Object.keys(nextChildren).length ? nextChildren : null,
        }).catch(() => {});
      })
    );
  };

  const handleTransferOutWithdrawalGraduate = async () => {
    if (!selectedStudent) {
      notify("error", "Select a student first.");
      return;
    }
    if (!currentAcademicYear) {
      notify("error", "Current academic year is missing.");
      return;
    }

    if (!registererPassword) {
      setPasswordError("Enter your registerer password to continue.");
      return;
    }

    if (!admin.userId) {
      setPasswordError("Missing registerer session. Please login again.");
      return;
    }

    const finalStatus = actionType === "withdraw" ? "withdrawn" : actionType === "graduate" ? "graduated" : "transferred";
    setWorking(true);
    try {
      const currentUserRes = await axios.get(`${DB_URL}/Users/${admin.userId}.json`).catch(() => ({ data: null }));
      const currentUser = currentUserRes.data || null;
      const expectedPassword = String(currentUser?.password || "");

      if (!expectedPassword || expectedPassword !== registererPassword) {
        setPasswordError("Incorrect registerer password.");
        return;
      }

      setPasswordError("");
      setShowConfirmModal(false);

      const now = new Date().toISOString();
      const studentNode = selectedStudent.raw || {};

      const archivedPayload = {
        ...(studentNode || {}),
        studentId: selectedStudent.studentId,
        name: selectedStudent.name,
        grade: selectedStudent.grade,
        section: selectedStudent.section,
        academicYear: currentAcademicYear,
        status: finalStatus,
        transferAction: actionType,
        transferNote: note || "",
        destinationSchool: destinationSchool || "",
        movedAt: now,
        movedBy: admin.adminId || admin.username || "registrar",
        records: {
          ...(studentNode.records || {}),
          [currentAcademicYear]: {
            ...(studentNode.records?.[currentAcademicYear] || {}),
            academicYear: currentAcademicYear,
            grade: selectedStudent.grade,
            section: selectedStudent.section,
            status: finalStatus,
            sourceAction: actionType,
            movedAt: now,
            note: note || "",
            destinationSchool: destinationSchool || "",
          },
        },
      };

      await axios.patch(`${DB_URL}/YearHistory/${currentAcademicYear}/Students/${selectedStudent.studentId}.json`, archivedPayload);
      await copyParentsToYearHistory(currentAcademicYear, studentNode);
      await setUsersActiveByStudent(studentNode, false);

      await cleanupParentsAfterStudentRemoval(studentNode);
      await axios.delete(`${DB_URL}/Students/${selectedStudent.studentId}.json`);

      setSelectedStudentId("");
      setStudentSearch("");
      setNote("");
      setDestinationSchool("");
      notify("success", `${selectedStudent.name} moved to YearHistory as ${finalStatus}.`);
      await loadBaseData();
    } catch (err) {
      notify("error", err?.response?.data?.message || err?.message || "Failed to process student status change.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="dashboard-page" style={{ background: PAGE_BG, height: "100vh", overflow: "hidden" }}>
      <nav className="top-navbar" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface-overlay)", boxShadow: "var(--shadow-soft)", backdropFilter: "blur(10px)" }}>
        <h2 style={{ color: "var(--text-primary)", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>
        <div className="nav-right">
          <Link className="icon-circle" to="/dashboard"><FaBell /></Link>
          <Link className="icon-circle" to="/all-chat"><FaFacebookMessenger /></Link>
          <ProfileAvatar imageUrl={admin.profileImage} name={admin.name} size={38} className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px", height: "calc(100vh - 73px)", overflow: "hidden" }}>
        <RegisterSidebar user={admin} sticky fullHeight />

        <div className="main-content google-main" style={{ padding: "10px 20px 20px", flex: 1, minWidth: 0, boxSizing: "border-box", height: "100%", overflowY: "auto", overflowX: "hidden" }}>
          <div className="section-header-card" style={{ width: "100%", margin: "0 0 12px" }}>
            <div className="section-header-card__row">
              <div>
                <div className="section-header-card__title" style={{ fontSize: 17 }}>Transfer & Withdrawal</div>
                <div className="section-header-card__subtitle">Update student exit status and archive records to YearHistory.</div>
              </div>
              <button type="button" onClick={loadBaseData} disabled={loading || working} style={{ ...heroActionStyle, cursor: loading || working ? "not-allowed" : "pointer", opacity: loading || working ? 0.65 : 1 }}>
                <FaSyncAlt /> Refresh
              </button>
            </div>
          </div>

          <div style={{ width: "100%", ...cardStyle, padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 12 }}>
              {[{
                title: "Active Students",
                value: activeStudents.length,
                hint: "Eligible for status change",
              }, {
                title: "Current Year",
                value: currentAcademicYear ? yearLabel(currentAcademicYear) : "-",
                hint: "Archive destination",
              }, {
                title: "Academic Years",
                value: Object.keys(academicYears || {}).length,
                hint: "Configured years",
              }].map((item) => (
                <div key={item.title} style={summaryCardStyle}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{item.title}</div>
                  <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900, color: "var(--text-primary)" }}>{item.value}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}>{item.hint}</div>
                </div>
              ))}
            </div>

            {feedback.text ? (
              <div style={{ marginBottom: 12, ...feedbackStyles, borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 700 }}>
                {feedback.text}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: "var(--text-primary)", fontWeight: 800 }}>Transfer Out / Withdraw / Graduate</h3>
              </div>

              <div style={{ display: "grid", gap: 9 }}>
                  <div>
                    <label style={fieldLabelStyle}>Search Active Student</label>
                    <div style={searchBarShellStyle}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "var(--surface-accent)",
                          color: "var(--accent-strong)",
                          flexShrink: 0,
                        }}
                      >
                        <FaSearch size={13} />
                      </div>
                      <input
                        style={searchBarInputStyle}
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search by name, student ID, grade, or section"
                      />
                      <div
                        style={{
                          flexShrink: 0,
                          padding: "5px 9px",
                          borderRadius: 999,
                          background: "var(--surface-panel)",
                          border: "1px solid var(--border-soft)",
                          color: "var(--text-muted)",
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        {filteredActiveStudents.length} match{filteredActiveStudents.length === 1 ? "" : "es"}
                      </div>
                    </div>
                    {studentSearch.trim() ? (
                      <div style={searchResultsPanelStyle}>
                        {filteredActiveStudents.length > 0 ? (
                          filteredActiveStudents.slice(0, 8).map((student, index, visibleStudents) => (
                            <button
                              key={student.studentId}
                              type="button"
                              onClick={() => handleSelectStudentChoice(student.studentId)}
                              style={{
                                ...searchResultButtonStyle(selectedStudentId === student.studentId),
                                borderBottom: index === visibleStudents.length - 1 ? "none" : "1px solid var(--border-soft)",
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {student.name}
                                </div>
                                <div style={{ marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}>
                                  {student.studentId} • Grade {student.grade || "-"}{student.section ? ` • ${student.section}` : ""}
                                </div>
                              </div>
                              <div style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: selectedStudentId === student.studentId ? "var(--accent-strong)" : "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                                {selectedStudentId === student.studentId ? "Selected" : "Choose"}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div style={{ padding: "12px", fontSize: 12, color: "var(--text-muted)" }}>
                            No active student matches this search.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Select Active Student</label>
                    <div style={selectShellStyle}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "var(--surface-accent)",
                          color: "var(--accent-strong)",
                          flexShrink: 0,
                        }}
                      >
                        <FaUsers size={13} />
                      </div>
                      <select style={selectInputStyle} value={selectedStudentId} onChange={(e) => handleSelectStudentChoice(e.target.value)}>
                        <option value="">Choose student</option>
                        {filteredActiveStudents.map((student) => (
                          <option key={student.studentId} value={student.studentId}>
                            {student.name} ({student.studentId}) - G{student.grade}{student.section ? ` ${student.section}` : ""}
                          </option>
                        ))}
                      </select>
                      <div style={selectChevronStyle}>
                        <FaChevronDown size={11} />
                      </div>
                      <div
                        style={{
                          flexShrink: 0,
                          padding: "5px 9px",
                          borderRadius: 999,
                          background: selectedStudentId ? "var(--surface-accent)" : "var(--surface-panel)",
                          border: "1px solid var(--border-soft)",
                          color: selectedStudentId ? "var(--accent-strong)" : "var(--text-muted)",
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        {selectedStudentId ? "Selected" : "Choose"}
                      </div>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                      Showing {filteredActiveStudents.length} of {activeStudents.length} active students
                    </div>
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Action</label>
                    <div style={selectShellStyle}>
                      <div style={fieldIconBoxStyle}>
                        <FaExchangeAlt size={13} />
                      </div>
                      <select style={selectInputStyle} value={actionType} onChange={(e) => setActionType(e.target.value)}>
                        <option value="transfer_out">Transfer Out</option>
                        <option value="withdraw">Dropout / Withdraw</option>
                        <option value="graduate">Graduate</option>
                      </select>
                      <div style={selectChevronStyle}>
                        <FaChevronDown size={11} />
                      </div>
                      <div style={{ flexShrink: 0, padding: "5px 9px", borderRadius: 999, background: "var(--surface-panel)", border: "1px solid var(--border-soft)", color: "var(--text-muted)", fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        {actionLabel}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Destination School (for transfer)</label>
                    <div style={textFieldShellStyle}>
                      <div style={fieldIconBoxStyle}>
                        <FaHome size={13} />
                      </div>
                      <input
                        style={textFieldInputStyle}
                        value={destinationSchool}
                        onChange={(e) => setDestinationSchool(e.target.value)}
                        placeholder="Optional"
                      />
                      <div style={{ flexShrink: 0, padding: "5px 9px", borderRadius: 999, background: destinationSchool.trim() ? "var(--surface-accent)" : "var(--surface-panel)", border: "1px solid var(--border-soft)", color: destinationSchool.trim() ? "var(--accent-strong)" : "var(--text-muted)", fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        {destinationSchool.trim() ? "Set" : "Optional"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Reason / Note</label>
                    <div style={textAreaShellStyle}>
                      <div style={fieldIconBoxStyle}>
                        <FaFileAlt size={13} />
                      </div>
                      <textarea
                        rows={3}
                        style={textAreaInputStyle}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Reason, reference, or registrar note"
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                    <button onClick={openConfirmModal} disabled={working || !selectedStudentId || loading} style={{ ...dangerButtonStyle, cursor: working || !selectedStudentId || loading ? "not-allowed" : "pointer", opacity: working || !selectedStudentId || loading ? 0.65 : 1, display: "inline-flex", alignItems: "center", gap: 8, minWidth: 190, justifyContent: "center", boxShadow: "0 12px 26px rgba(185, 28, 28, 0.18)" }}>
                      <FaUserTimes /> Save Status Change
                    </button>
                  </div>
                </div>
            </div>

            {selectedStudent ? (
              <div style={selectedCardStyle}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--accent-strong)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Selected Student</div>
                <div style={{ marginTop: 8, fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{selectedStudent.name}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {selectedStudent.studentId} • Grade {selectedStudent.grade || "-"}{selectedStudent.section ? ` • ${selectedStudent.section}` : ""}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showConfirmModal ? (
        <div style={{ position: "fixed", inset: 0, background: "color-mix(in srgb, var(--page-bg) 54%, transparent)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
          <div style={{ width: "100%", maxWidth: 460, background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 12, boxShadow: "var(--shadow-panel)", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-soft)" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Confirm Status Change</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>Please review before proceeding.</div>
            </div>

            <div style={{ padding: 16, display: "grid", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
              <div><strong>Student:</strong> {selectedStudent?.name || "-"} ({selectedStudent?.studentId || "-"})</div>
              <div><strong>Action:</strong> {actionLabel}</div>
              <div><strong>Academic Year:</strong> {currentAcademicYear ? yearLabel(currentAcademicYear) : "-"}</div>
              <div style={{ marginTop: 6 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 800, color: "var(--text-primary)" }}>
                  Registerer Password
                </label>
                <input
                  type="password"
                  value={registererPassword}
                  onChange={(e) => {
                    setRegistererPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  placeholder="Enter your password to confirm"
                  style={{
                    width: "100%",
                    border: "1px solid var(--input-border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 13,
                    boxSizing: "border-box",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />
                {passwordError ? (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "var(--danger)" }}>
                    {passwordError}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-soft)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={working}
                style={{ ...neutralButtonStyle, cursor: working ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransferOutWithdrawalGraduate}
                disabled={working}
                style={{ ...dangerButtonStyle, padding: "7px 12px", cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.65 : 1 }}
              >
                {working ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
