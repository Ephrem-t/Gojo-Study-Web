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
import RegisterSidebar from "../components/RegisterSidebar";

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
    <div className="dashboard-page" style={{ background: PAGE_BG, minHeight: "100vh" }}>
      <nav className="top-navbar" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface-overlay)", boxShadow: "var(--shadow-soft)", backdropFilter: "blur(10px)" }}>
        <h2 style={{ color: "var(--text-primary)", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>
        <div className="nav-right">
          <Link className="icon-circle" to="/dashboard"><FaBell /></Link>
          <Link className="icon-circle" to="/all-chat"><FaFacebookMessenger /></Link>
          <img src={admin.profileImage || "/default-profile.png"} alt="admin" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px" }}>
        <RegisterSidebar user={admin} sticky fullHeight />

        <div className="main-content google-main" style={{ padding: "10px 20px 20px", flex: 1, minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ maxWidth: 760, margin: "0 auto 12px", background: "linear-gradient(135deg, var(--accent-strong), var(--accent))", color: "#fff", borderRadius: 14, padding: "12px 14px", boxShadow: "var(--shadow-glow)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Transfer & Withdrawal</div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.95 }}>Update student exit status and archive records to YearHistory.</div>
            </div>
            <button type="button" onClick={loadBaseData} disabled={loading || working} style={{ ...heroActionStyle, cursor: loading || working ? "not-allowed" : "pointer", opacity: loading || working ? 0.65 : 1 }}>
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
                    <input
                      style={fieldStyle}
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search by name, student ID, grade, or section"
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Select Active Student</label>
                    <select style={fieldStyle} value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                      <option value="">Choose student</option>
                      {filteredActiveStudents.map((student) => (
                        <option key={student.studentId} value={student.studentId}>
                          {student.name} ({student.studentId}) - G{student.grade}{student.section ? ` ${student.section}` : ""}
                        </option>
                      ))}
                    </select>
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                      Showing {filteredActiveStudents.length} of {activeStudents.length} active students
                    </div>
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Action</label>
                    <select style={fieldStyle} value={actionType} onChange={(e) => setActionType(e.target.value)}>
                      <option value="transfer_out">Transfer Out</option>
                      <option value="withdraw">Dropout / Withdraw</option>
                      <option value="graduate">Graduate</option>
                    </select>
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Destination School (for transfer)</label>
                    <input
                      style={fieldStyle}
                      value={destinationSchool}
                      onChange={(e) => setDestinationSchool(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Reason / Note</label>
                    <textarea
                      rows={3}
                      style={fieldStyle}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Reason, reference, or registrar note"
                    />
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
                    <input
                      type="checkbox"
                      checked={removeFromStudentsNode}
                      onChange={(e) => setRemoveFromStudentsNode(e.target.checked)}
                    />
                    Remove from Students node after archiving to YearHistory
                  </label>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                    <button onClick={openConfirmModal} disabled={working || !selectedStudentId || loading} style={{ ...dangerButtonStyle, cursor: working || !selectedStudentId || loading ? "not-allowed" : "pointer", opacity: working || !selectedStudentId || loading ? 0.65 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <FaUserTimes /> Save Status Change
                    </button>
                  </div>
                </div>
            </div>

            {selectedStudent ? (
              <div style={{ marginTop: 10, border: "1px solid var(--border-soft)", borderRadius: 10, padding: 12, background: "var(--surface-muted)" }}>
                <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>Selected:</strong>{" "}
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {selectedStudent.name} ({selectedStudent.studentId}) - Grade {selectedStudent.grade} {selectedStudent.section || ""}
                </span>
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
              <div><strong>Remove From Students:</strong> {removeFromStudentsNode ? "Yes" : "No"}</div>
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
