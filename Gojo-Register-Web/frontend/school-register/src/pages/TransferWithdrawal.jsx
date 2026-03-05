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
  FaSignOutAlt,
  FaSyncAlt,
  FaUserTimes,
  FaUsers,
} from "react-icons/fa";
import axios from "axios";
import { BACKEND_BASE } from "../config";

const PAGE_BG = "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
};

const yearLabel = (key) => String(key || "").replace("_", "/");

const normalizeParents = (node) => {
  if (Array.isArray(node)) return node;
  if (node && typeof node === "object") return Object.values(node);
  return [];
};

const getStudentStatus = (student = {}) =>
  String(student.status || student.basicStudentInformation?.status || "active").toLowerCase();

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
  const [removeFromStudentsNode, setRemoveFromStudentsNode] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const notify = (type, text) => setFeedback({ type, text });

  const loadBaseData = async () => {
    if (!schoolCode) {
      notify("error", "Missing schoolCode in session. Please login again.");
      return;
    }

    setLoading(true);
    try {
      const [yearsRes, dbYearsRes, dbCurrentYearRes, studentsRes, parentsRes] = await Promise.all([
        axios.get(`${BACKEND_BASE}/api/academic-years`, { params: { schoolCode } }).catch(() => ({ data: {} })),
        axios.get(`${DB_URL}/AcademicYears.json`).catch(() => ({ data: {} })),
        axios.get(`${DB_URL}/schoolInfo/currentAcademicYear.json`).catch(() => ({ data: "" })),
        axios.get(`${DB_URL}/Students.json`).catch(() => ({ data: {} })),
        axios.get(`${DB_URL}/Parents.json`).catch(() => ({ data: {} })),
      ]);

      const yearsPayload = yearsRes.data || {};
      const nextYears = yearsPayload.academicYears || dbYearsRes.data || {};
      const derivedCurrent = Object.entries(nextYears || {}).find(([, row]) => !!row?.isCurrent)?.[0] || "";
      const nextCurrent = yearsPayload.currentAcademicYear || dbCurrentYearRes.data || derivedCurrent || "";

      setAcademicYears(nextYears);
      setCurrentAcademicYear(nextCurrent);
      setStudentsMap(studentsRes.data || {});
      setParentsMap(parentsRes.data || {});

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

  const openConfirmModal = () => {
    if (!selectedStudent) {
      notify("error", "Select a student first.");
      return;
    }
    if (!currentAcademicYear) {
      notify("error", "Current academic year is missing.");
      return;
    }
    setShowConfirmModal(true);
  };

  const copyParentsToYearHistory = async (yearKey, studentNode) => {
    const parentIds = new Set();
    Object.keys(studentNode?.parents || {}).forEach((pid) => {
      if (pid) parentIds.add(pid);
    });
    normalizeParents(studentNode?.parentGuardianInformation?.parents).forEach((parent) => {
      const pid = String(parent?.parentId || "").trim();
      if (pid) parentIds.add(pid);
    });

    await Promise.all(
      [...parentIds].map(async (pid) => {
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
    const usersRes = await axios.get(`${DB_URL}/Users.json`).catch(() => ({ data: {} }));
    const users = usersRes.data || {};

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

    const parentIds = new Set();
    Object.keys(studentNode?.parents || {}).forEach((pid) => {
      if (pid) parentIds.add(pid);
    });
    normalizeParents(studentNode?.parentGuardianInformation?.parents).forEach((parent) => {
      const pid = String(parent?.parentId || "").trim();
      if (pid) parentIds.add(pid);
    });

    Object.entries(users).forEach(([uid, row]) => {
      const user = row || {};
      if (parentIds.has(String(user.parentId || ""))) patchUserIds.add(uid);
    });

    await Promise.all(
      [...patchUserIds].map((uid) => axios.patch(`${DB_URL}/Users/${uid}.json`, { isActive }))
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

    const finalStatus = actionType === "withdraw" ? "withdrawn" : actionType === "graduate" ? "graduated" : "transferred";

    setShowConfirmModal(false);
    setWorking(true);
    try {
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

      if (removeFromStudentsNode) {
        await axios.delete(`${DB_URL}/Students/${selectedStudent.studentId}.json`);
      } else {
        await axios.patch(`${DB_URL}/Students/${selectedStudent.studentId}.json`, {
          status: finalStatus,
          academicYear: currentAcademicYear,
          transferAction: actionType,
          transferNote: note || "",
          destinationSchool: destinationSchool || "",
          movedAt: now,
          basicStudentInformation: {
            ...(studentNode.basicStudentInformation || {}),
            status: finalStatus,
            academicYear: currentAcademicYear,
          },
        });
      }

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
    <div className="dashboard-page" style={{ background: "#f5f8ff", minHeight: "100vh" }}>
      <nav className="top-navbar" style={{ borderBottom: "1px solid #e5e7eb", background: "#ffffff" }}>
        <h2 style={{ color: "#0f172a", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>
        <div className="nav-right">
          <Link className="icon-circle" to="/dashboard"><FaBell /></Link>
          <Link className="icon-circle" to="/all-chat"><FaFacebookMessenger /></Link>
          <Link className="icon-circle" to="/settings"><FaCog /></Link>
          <img src={admin.profileImage || "/default-profile.png"} alt="admin" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px" }}>
        <div className="google-sidebar" style={{ width: "220px", padding: "12px", borderRadius: 16, background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 10px 24px rgba(15,23,42,0.06)", height: "fit-content" }}>
          <div className="sidebar-profile" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingBottom: 6 }}>
            <div className="sidebar-img-circle" style={{ width: 50, height: 50, borderRadius: "50%", overflow: "hidden", border: "2px solid #e6eefc" }}>
              <img src={admin.profileImage || "/default-profile.png"} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{admin.name}</h3>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{admin.username || admin.adminId || "register"}</p>
          </div>

          <div className="sidebar-menu" style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            <button
              type="button"
              className="sidebar-btn"
              onClick={() => setDashboardMenuOpen((prev) => !prev)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg, #eff6ff, #eef2ff)", color: "#1e3a8a", borderRadius: 12, border: "1px solid #c7d2fe", cursor: "pointer" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><FaHome style={{ width: 18, height: 18 }} /> Dashboard</span>
              <FaChevronDown style={{ transform: dashboardMenuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s ease" }} />
            </button>

            {dashboardMenuOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 10, paddingLeft: 10, borderLeft: "2px solid #dbeafe" }}>
                <Link className="sidebar-btn" to="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaHome style={{ width: 16, height: 16 }} /> Home</Link>
                <Link className="sidebar-btn" to="/my-posts" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaFileAlt style={{ width: 16, height: 16 }} /> My Posts</Link>
                <Link className="sidebar-btn" to="/overview" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaChartLine style={{ width: 16, height: 16 }} /> Overview</Link>
                <Link className="sidebar-btn" to="/academic-years" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaFileAlt style={{ width: 16, height: 16 }} /> Academic Year</Link>
                <Link className="sidebar-btn" to="/grede-management" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaFileAlt style={{ width: 16, height: 16 }} /> Grede Management</Link>
                <Link className="sidebar-btn" to="/promotion-system" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaFileAlt style={{ width: 16, height: 16 }} /> Promotion System</Link>
                <Link className="sidebar-btn" to="/transfer-withdrawal" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, fontWeight: 700, backgroundColor: "#1d4ed8", color: "#fff", borderRadius: 10, boxShadow: "0 8px 18px rgba(29,78,216,0.25)" }}><FaExchangeAlt style={{ width: 16, height: 16 }} /> Transfer & Withdrawal</Link>
                <Link className="sidebar-btn" to="/document-generation" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaFileAlt style={{ width: 16, height: 16 }} /> Document Generation</Link>
              </div>
            )}

            <button
              type="button"
              className="sidebar-btn"
              onClick={() => setStudentMenuOpen((prev) => !prev)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg, #eff6ff, #eef2ff)", color: "#1e3a8a", borderRadius: 12, border: "1px solid #c7d2fe", cursor: "pointer" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Students</span>
              <FaChevronDown style={{ transform: studentMenuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s ease" }} />
            </button>

            {studentMenuOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 10, paddingLeft: 10, borderLeft: "2px solid #dbeafe" }}>
                <Link className="sidebar-btn" to="/students" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaChalkboardTeacher style={{ width: 16, height: 16 }} /> Student</Link>
                <Link className="sidebar-btn" to="/student-register" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaFileAlt style={{ width: 16, height: 16 }} /> Register Student</Link>
                <Link className="sidebar-btn" to="/parents" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaFileAlt style={{ width: 16, height: 16 }} /> Student Parent</Link>
              </div>
            )}

            <Link className="sidebar-btn" to="/analytics" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12 }}><FaChartLine style={{ width: 18, height: 18 }} /> Analytics</Link>
            <button className="sidebar-btn logout-btn" onClick={() => { localStorage.removeItem("registrar"); localStorage.removeItem("admin"); navigate("/login"); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", fontSize: 13 }}><FaSignOutAlt style={{ width: 18, height: 18 }} /> Logout</button>
          </div>
        </div>

        <div className="main-content google-main" style={{ padding: "10px 20px 20px", flex: 1, minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ maxWidth: 760, margin: "0 auto 12px", background: "linear-gradient(135deg, #1e3a8a, #2563eb)", color: "#fff", borderRadius: 14, padding: "12px 14px", boxShadow: "0 14px 28px rgba(30,58,138,0.22)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Transfer & Withdrawal</div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.95 }}>Update student exit status and archive records to YearHistory.</div>
            </div>
            <button type="button" onClick={loadBaseData} disabled={loading || working} style={{ border: "1px solid rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.15)", color: "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: loading || working ? "not-allowed" : "pointer", opacity: loading || working ? 0.65 : 1 }}>
              <FaSyncAlt /> Refresh
            </button>
          </div>

          <div style={{ maxWidth: 980, margin: "0 auto", ...cardStyle, padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
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
                <div key={item.title} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, background: "#f8fafc" }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{item.title}</div>
                  <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{item.value}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "#64748b" }}>{item.hint}</div>
                </div>
              ))}
            </div>

            {feedback.text ? (
              <div style={{ marginBottom: 12, color: feedback.type === "error" ? "#b91c1c" : feedback.type === "warning" ? "#92400e" : "#166534", background: feedback.type === "error" ? "#fff1f2" : feedback.type === "warning" ? "#fffbeb" : "#ecfdf3", border: `1px solid ${feedback.type === "error" ? "#fecdd3" : feedback.type === "warning" ? "#fde68a" : "#86efac"}`, borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 700 }}>
                {feedback.text}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a", fontWeight: 800 }}>Transfer Out / Withdraw / Graduate</h3>
              </div>

              <div style={{ display: "grid", gap: 9 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 700, color: "#334155" }}>Search Active Student</label>
                    <input
                      style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search by name, student ID, grade, or section"
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 700, color: "#334155" }}>Select Active Student</label>
                    <select style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }} value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                      <option value="">Choose student</option>
                      {filteredActiveStudents.map((student) => (
                        <option key={student.studentId} value={student.studentId}>
                          {student.name} ({student.studentId}) - G{student.grade}{student.section ? ` ${student.section}` : ""}
                        </option>
                      ))}
                    </select>
                    <div style={{ marginTop: 4, fontSize: 11, color: "#64748b" }}>
                      Showing {filteredActiveStudents.length} of {activeStudents.length} active students
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 700, color: "#334155" }}>Action</label>
                    <select style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }} value={actionType} onChange={(e) => setActionType(e.target.value)}>
                      <option value="transfer_out">Transfer Out</option>
                      <option value="withdraw">Dropout / Withdraw</option>
                      <option value="graduate">Graduate</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 700, color: "#334155" }}>Destination School (for transfer)</label>
                    <input
                      style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
                      value={destinationSchool}
                      onChange={(e) => setDestinationSchool(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 700, color: "#334155" }}>Reason / Note</label>
                    <textarea
                      rows={3}
                      style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Reason, reference, or registrar note"
                    />
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "#334155" }}>
                    <input
                      type="checkbox"
                      checked={removeFromStudentsNode}
                      onChange={(e) => setRemoveFromStudentsNode(e.target.checked)}
                    />
                    Remove from Students node after archiving to YearHistory
                  </label>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                    <button onClick={openConfirmModal} disabled={working || !selectedStudentId || loading} style={{ border: "1px solid #dc2626", background: "#dc2626", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 800, cursor: working || !selectedStudentId || loading ? "not-allowed" : "pointer", opacity: working || !selectedStudentId || loading ? 0.65 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <FaUserTimes /> Save Status Change
                    </button>
                  </div>
                </div>
            </div>

            {selectedStudent ? (
              <div style={{ marginTop: 10, border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#f8fafc" }}>
                <strong style={{ fontSize: 13, color: "#0f172a" }}>Selected:</strong>{" "}
                <span style={{ fontSize: 13, color: "#334155" }}>
                  {selectedStudent.name} ({selectedStudent.studentId}) - Grade {selectedStudent.grade} {selectedStudent.section || ""}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showConfirmModal ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 460, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 20px 40px rgba(15,23,42,0.2)", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Confirm Status Change</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>Please review before proceeding.</div>
            </div>

            <div style={{ padding: 16, display: "grid", gap: 8, fontSize: 13, color: "#334155" }}>
              <div><strong>Student:</strong> {selectedStudent?.name || "-"} ({selectedStudent?.studentId || "-"})</div>
              <div><strong>Action:</strong> {actionLabel}</div>
              <div><strong>Academic Year:</strong> {currentAcademicYear ? yearLabel(currentAcademicYear) : "-"}</div>
              <div><strong>Remove From Students:</strong> {removeFromStudentsNode ? "Yes" : "No"}</div>
            </div>

            <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={working}
                style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: working ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransferOutWithdrawalGraduate}
                disabled={working}
                style={{ border: "1px solid #dc2626", background: "#dc2626", color: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 800, cursor: working ? "not-allowed" : "pointer", opacity: working ? 0.65 : 1 }}
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
