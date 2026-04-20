import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaBell,
  FaChartLine,
  FaChalkboardTeacher,
  FaChevronDown,
  FaCog,
  FaFacebookMessenger,
  FaFileAlt,
  FaHome,
  FaLock,
  FaPlay,
  FaSignOutAlt,
  FaSyncAlt,
  FaUsers,
} from "react-icons/fa";
import axios from "axios";
import { BACKEND_BASE } from "../config";
import RegisterSidebar from "../components/RegisterSidebar";
import ProfileAvatar from "../components/ProfileAvatar";
import {
  loadGradeManagementNode,
  loadSchoolInfoNode,
  loadSchoolParentsNode,
  loadSchoolStudentsNode,
  loadSchoolUsersNode,
} from "../utils/registerData";
import { fetchCachedJson } from "../utils/rtdbCache";

const PAGE_BG = "var(--page-bg)";

const cardStyle = {
  background: "var(--surface-panel)",
  border: "1px solid var(--border-soft)",
  borderRadius: 16,
  boxShadow: "var(--shadow-panel)",
};

const ACTIONS = {
  promote: "promote",
  repeat: "repeat",
  graduate: "graduate",
  transfer: "transfer",
  withdraw: "withdraw",
};

const isFinalGrade = (grade, maxGrade) => Number(grade) >= Number(maxGrade);

const normalizeYearKey = (value) => String(value || "").trim();

const yearLabel = (key) => String(key || "").replace("_", "/");

const buildNextYearKey = (fromYearKey) => {
  const safe = normalizeYearKey(fromYearKey);
  const m = safe.match(/^(\d{4})_(\d{4})$/);
  if (!m) return "";
  const y1 = Number(m[1]);
  const y2 = Number(m[2]);
  return `${y1 + 1}_${y2 + 1}`;
};

const isAlreadyReRegisteredToYear = (studentRoot = {}, targetYear = "") => {
  const year = String(targetYear || "").trim();
  if (!year) return false;

  const rootAcademicYear = String(studentRoot?.academicYear || "").trim();
  const basicAcademicYear = String(studentRoot?.basicStudentInformation?.academicYear || "").trim();
  const recordsToYear = studentRoot?.records?.[year] || null;
  const hasReRegisterStamp = !!studentRoot?.reRegisteredAt;

  // Treat as already re-registered when the student is already placed in target year
  // with explicit re-register stamp, or when a target-year record exists via promotion/repeat.
  if ((rootAcademicYear === year || basicAcademicYear === year) && hasReRegisterStamp) return true;
  if (recordsToYear && ["promote", "repeat"].includes(String(recordsToYear.sourceAction || "").toLowerCase())) return true;

  return false;
};

const firstFilled = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

const normalizeParents = (node) => {
  if (Array.isArray(node)) return node;
  if (node && typeof node === "object") return Object.values(node);
  return [];
};

const normalizeGradesPayload = (payload) => {
  const map = {};

  if (Array.isArray(payload)) {
    payload.forEach((row) => {
      if (!row || typeof row !== "object") return;
      const gradeKey = String(row.grade || "").trim();
      if (!gradeKey) return;
      map[gradeKey] = {
        ...row,
        grade: gradeKey,
        sections: row.sections || {},
      };
    });
    return map;
  }

  if (payload && typeof payload === "object") {
    Object.entries(payload).forEach(([key, row]) => {
      if (!row || typeof row !== "object") return;
      const gradeKey = String(row.grade || key || "").trim();
      if (!gradeKey || gradeKey === "null" || gradeKey === "undefined") return;
      map[gradeKey] = {
        ...row,
        grade: gradeKey,
        sections: row.sections || {},
      };
    });
  }

  return map;
};

const toBooleanActive = (value, defaultValue = true) => {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return defaultValue;
  return ["1", "true", "yes", "y", "on"].includes(text);
};

const generateTemporaryPassword = (length = 8) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function PromotionSystem() {
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
    role: String(stored.role || stored.userType || "registrar").toLowerCase(),
  };

  const canConfirmPromotion = ["admin", "registrar", "school_admin"].includes(admin.role) || !admin.role;

  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(true);
  const [studentMenuOpen, setStudentMenuOpen] = useState(true);

  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  const [step, setStep] = useState(1);
  const [academicYears, setAcademicYears] = useState({});
  const [currentAcademicYear, setCurrentAcademicYear] = useState("");
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [maxGrade, setMaxGrade] = useState("12");

  const [gradesMap, setGradesMap] = useState({});
  const [studentsMap, setStudentsMap] = useState({});
  const [yearHistoryStudentsMap, setYearHistoryStudentsMap] = useState({});
  const [yearHistoryLoading, setYearHistoryLoading] = useState(false);

  const [runLocked] = useState(false);
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [studentSearch, setStudentSearch] = useState("");

  const [decisions, setDecisions] = useState({});
  const [selectedStudentsMap, setSelectedStudentsMap] = useState({});
  const [confirmText, setConfirmText] = useState("");
  const [showReRegisterModal, setShowReRegisterModal] = useState(false);
  const [reRegisterQueue, setReRegisterQueue] = useState([]);
  const [reRegisterIndex, setReRegisterIndex] = useState(0);
  const [reRegisterDraft, setReRegisterDraft] = useState(null);
  const [reRegisterSaving, setReRegisterSaving] = useState(false);
  const [reRegisterMode, setReRegisterMode] = useState("reregister");
  const [draftOverrides, setDraftOverrides] = useState({});
  const [processedStudentIds, setProcessedStudentIds] = useState({});

  const notify = (type, text) => setFeedback({ type, text });

  const gradeKeys = useMemo(
    () => Object.keys(gradesMap || {}).sort((a, b) => Number(a) - Number(b)),
    [gradesMap]
  );

  const yearKeys = useMemo(
    () => Object.keys(academicYears || {}).sort((a, b) => b.localeCompare(a)),
    [academicYears]
  );

  useEffect(() => {
    if (!fromYear) return;
    const computed = buildNextYearKey(fromYear);
    if (computed && computed !== toYear) setToYear(computed);
  }, [fromYear]);

  const loadBaseData = async () => {
    if (!schoolCode) {
      notify("error", "Missing schoolCode in session. Please login again.");
      return;
    }

    setLoading(true);
    try {
      const [yearsRes, dbYearsData, schoolInfo, gradesData, studentsData] = await Promise.all([
        axios.get(`${BACKEND_BASE}/api/academic-years`, { params: { schoolCode } }).catch(() => ({ data: {} })),
        fetchCachedJson(`${DB_URL}/AcademicYears.json`, { ttlMs: 60000 }).catch(() => ({})),
        loadSchoolInfoNode({ rtdbBase: DB_URL }),
        loadGradeManagementNode({ rtdbBase: DB_URL }),
        loadSchoolStudentsNode({ rtdbBase: DB_URL }),
      ]);

      const yearsPayload = yearsRes.data || {};
      const nextYears = yearsPayload.academicYears || dbYearsData || {};
      const derivedCurrent = Object.entries(nextYears || {}).find(([, row]) => !!row?.isCurrent)?.[0] || "";
      const nextCurrent = yearsPayload.currentAcademicYear || schoolInfo?.currentAcademicYear || derivedCurrent || "";

      setAcademicYears(nextYears);
      setCurrentAcademicYear(nextCurrent);
      setFromYear((prev) => prev || nextCurrent || Object.keys(nextYears)[0] || "");
      setGradesMap(normalizeGradesPayload(gradesData || {}));
      setStudentsMap(studentsData || {});

      notify("", "");
    } catch (err) {
      notify("error", err?.response?.data?.message || err?.message || "Failed to load promotion data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBaseData();
  }, [schoolCode]);

  const loadYearHistoryStudents = async (yearKey) => {
    if (!yearKey || !schoolCode) {
      setYearHistoryStudentsMap({});
      return;
    }

    setYearHistoryLoading(true);
    try {
      const data = await fetchCachedJson(`${DB_URL}/YearHistory/${yearKey}/Students.json`, { ttlMs: 60000 }).catch(() => ({}));
      setYearHistoryStudentsMap(data || {});
    } catch (err) {
      setYearHistoryStudentsMap({});
      notify("error", err?.response?.data?.message || err?.message || "Failed to load YearHistory students.");
    } finally {
      setYearHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadYearHistoryStudents(fromYear);
  }, [fromYear, schoolCode]);

  useEffect(() => {
    // Reset processed cache when year range changes.
    setProcessedStudentIds({});
    setDraftOverrides({});
  }, [fromYear, toYear]);

  const studentsForFromYear = useMemo(() => {
    if (!fromYear) return [];

    const list = [];
    Object.entries(yearHistoryStudentsMap || {}).forEach(([studentId, node]) => {
      if (processedStudentIds[studentId]) return;

      const historyRow = node || {};
      const rootRow = studentsMap[studentId] || {};

      // Persistent guard: never list students already re-registered to selected To Year.
      if (isAlreadyReRegisteredToYear(rootRow, toYear)) return;

      const rootRecords = rootRow.records || {};
      const historyRecord = (historyRow.records || {})[fromYear] || null;
      const rootRecord = rootRecords[fromYear] || null;

      const currentStatus = String(historyRecord?.status || rootRecord?.status || historyRow.status || rootRow.status || "active").toLowerCase();
      if (["graduated", "transferred", "withdrawn"].includes(currentStatus)) return;

      const grade = String(historyRecord?.grade || rootRecord?.grade || historyRow.grade || rootRow.grade || "");
      const section = String(historyRecord?.section || rootRecord?.section || historyRow.section || rootRow.section || "").toUpperCase();

      if (!grade) return;

      list.push({
        studentId,
        userId: historyRow.userId || rootRow.userId || "",
        name:
          historyRow.name ||
          rootRow.name ||
          [historyRow.firstName || rootRow.firstName, historyRow.middleName || rootRow.middleName, historyRow.lastName || rootRow.lastName].filter(Boolean).join(" ") ||
          historyRow.basicStudentInformation?.name ||
          rootRow.basicStudentInformation?.name ||
          "Student",
        grade,
        section,
        status: currentStatus || "active",
        raw: rootRow,
        rawHistory: historyRow,
      });
    });

    return list.sort((a, b) => {
      const gradeDiff = Number(a.grade || 0) - Number(b.grade || 0);
      if (gradeDiff !== 0) return gradeDiff;

      const sectionDiff = String(a.section || "").localeCompare(String(b.section || ""));
      if (sectionDiff !== 0) return sectionDiff;

      return a.name.localeCompare(b.name);
    });
  }, [yearHistoryStudentsMap, studentsMap, fromYear, toYear, processedStudentIds]);

  useEffect(() => {
    if (gradeFilter === "all") {
      setSectionFilter("all");
      return;
    }

    const sectionsForGrade = new Set(
      studentsForFromYear
        .filter((student) => String(student.grade || "") === String(gradeFilter))
        .map((student) => String(student.section || "").trim().toUpperCase())
        .filter(Boolean)
    );

    if (sectionFilter !== "all" && !sectionsForGrade.has(sectionFilter)) {
      setSectionFilter("all");
    }
  }, [gradeFilter, sectionFilter, studentsForFromYear]);

  const getDefaultAction = (student) => {
    if (isFinalGrade(student.grade, maxGrade)) return ACTIONS.graduate;
    return ACTIONS.promote;
  };

  const sectionOptionsByGrade = useMemo(() => {
    const map = {};
    gradeKeys.forEach((grade) => {
      const sections = (gradesMap[grade] || {}).sections || {};
      map[grade] = Object.keys(sections).sort((a, b) => a.localeCompare(b));
    });
    return map;
  }, [gradeKeys, gradesMap]);

  const buildDefaultDecision = (student) => {
    const action = getDefaultAction(student);
    const nextGrade = action === ACTIONS.promote ? String(Number(student.grade || 0) + 1) : student.grade;

    return {
      action,
      targetGrade: action === ACTIONS.graduate ? student.grade : nextGrade,
      targetSection: student.section || "",
      notes: "",
    };
  };

  const prepareReview = () => {
    if (!fromYear || !toYear) {
      notify("error", "Select From Year and To Year first.");
      return;
    }

    if (yearHistoryLoading) {
      notify("warning", "YearHistory is still loading. Please wait.");
      return;
    }

    if (studentsForFromYear.length === 0) {
      notify("warning", `No students found in YearHistory for ${yearLabel(fromYear)}.`);
      return;
    }

    const next = {};
    const selected = {};
    studentsForFromYear.forEach((student) => {
      next[student.studentId] = buildDefaultDecision(student);
      selected[student.studentId] = false;
    });
    setDecisions(next);
    setSelectedStudentsMap(selected);
    setStep(2);
    notify("success", `Loaded ${studentsForFromYear.length} active students for review.`);
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudentsMap((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  const setAllSelection = (checked) => {
    const next = {};
    visibleStudents.forEach((student) => {
      next[student.studentId] = checked;
    });
    setSelectedStudentsMap((prev) => ({
      ...prev,
      ...next,
    }));
  };

  const selectedStudents = useMemo(
    () => studentsForFromYear.filter((student) => !!selectedStudentsMap[student.studentId]),
    [studentsForFromYear, selectedStudentsMap]
  );

  const availableGrades = useMemo(() => {
    return [...new Set(studentsForFromYear.map((student) => String(student.grade || "").trim()).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
  }, [studentsForFromYear]);

  const availableSections = useMemo(() => {
    const base = gradeFilter === "all"
      ? studentsForFromYear
      : studentsForFromYear.filter((student) => String(student.grade || "") === String(gradeFilter));

    return [...new Set(base.map((student) => String(student.section || "").trim().toUpperCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [studentsForFromYear, gradeFilter]);

  const visibleStudents = useMemo(() => {
    const query = String(studentSearch || "").trim().toLowerCase();

    return studentsForFromYear.filter((student) => {
      if (gradeFilter !== "all" && String(student.grade || "") !== String(gradeFilter)) return false;
      if (sectionFilter !== "all" && String(student.section || "").trim().toUpperCase() !== sectionFilter) return false;

      if (!query) return true;

      const haystack = [student.name, student.studentId, student.grade, student.section]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(query);
    });
  }, [studentsForFromYear, gradeFilter, sectionFilter, studentSearch]);

  const groupedVisibleStudents = useMemo(() => {
    const groups = visibleStudents.reduce((acc, student) => {
      const grade = String(student.grade || "-");
      const section = String(student.section || "-").trim().toUpperCase() || "-";

      if (!acc[grade]) acc[grade] = {};
      if (!acc[grade][section]) acc[grade][section] = [];
      acc[grade][section].push(student);
      return acc;
    }, {});

    return Object.entries(groups)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([grade, sections]) => ({
        grade,
        sections: Object.entries(sections)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([section, students]) => ({
            section,
            students: [...students].sort((a, b) => a.name.localeCompare(b.name)),
          })),
      }));
  }, [visibleStudents]);

  const buildDraftFromQueueItem = (queueItem) => {
    if (!queueItem) return null;

    const decision = queueItem.decision || {};
    const existingDraft = queueItem.draftOverride || {};
    const existingForm = existingDraft.form || {};
    const source = existingDraft.sourceData || queueItem.fullStudent || queueItem.student?.raw || queueItem.student?.rawHistory || {};

    const basic = source.basicStudentInformation || {};
    const address = source.addressInformation || {};
    const finance = source.financeInformation || {};
    const health = source.healthEmergency || {};
    const academic = source.academicSetup || {};
    const account = source.systemAccountInformation || {};
    const parentInfo = source.parentGuardianInformation || {};
    const normalizedSourceParents = normalizeParents(parentInfo.parents).map((row) => {
      const item = row || {};
      const accountInfo = item.systemAccountInformation || {};
      return {
        parentId: firstFilled(item.parentId),
        fullName: firstFilled(item.fullName, item.name),
        relationship: firstFilled(item.relationship, "Guardian"),
        phone: firstFilled(item.phone),
        alternativePhone: firstFilled(item.alternativePhone),
        email: firstFilled(item.email),
        occupation: firstFilled(item.occupation),
        nationalIdNumber: firstFilled(item.nationalIdNumber),
        username: firstFilled(accountInfo.username),
        temporaryPassword: firstFilled(accountInfo.temporaryPassword),
        isActive: firstFilled(accountInfo.isActive, "true"),
        role: firstFilled(accountInfo.role, "parent"),
      };
    });
    const parents = (existingDraft.parents || []).length ? existingDraft.parents : normalizedSourceParents;

    const firstName = firstFilled(existingForm.firstName, basic.firstName, source.firstName);
    const middleName = firstFilled(existingForm.middleName, basic.middleName, source.middleName);
    const lastName = firstFilled(existingForm.lastName, basic.lastName, source.lastName);
    const builtName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
    const resolvedStatus = firstFilled(existingForm.status, source.status, basic.status, "active");

    const form = {
      firstName,
      middleName,
      lastName,
      grade: firstFilled(decision.targetGrade, existingForm.grade, source.grade, basic.grade, queueItem.student?.grade),
      section: firstFilled(decision.targetSection, existingForm.section, source.section, basic.section, queueItem.student?.section).toUpperCase(),
      gender: firstFilled(existingForm.gender, source.gender, basic.gender),
      dob: firstFilled(existingForm.dob, source.dob, basic.dob, source.dateOfBirth),
      admissionDate: firstFilled(existingForm.admissionDate, source.admissionDate, basic.admissionDate),
      studentNumber: firstFilled(existingForm.studentNumber, source.studentId, queueItem.student?.studentId),
      academicYear: firstFilled(toYear, existingForm.academicYear, source.academicYear, basic.academicYear),
      previousSchool: firstFilled(existingForm.previousSchool, source.previousSchool, basic.previousSchool),
      nationalIdNumber: firstFilled(existingForm.nationalIdNumber, source.nationalIdNumber, basic.nationalIdNumber),
      status: resolvedStatus === "graduated" ? "active" : resolvedStatus,
      region: firstFilled(existingForm.region, address.region),
      city: firstFilled(existingForm.city, address.city),
      subCity: firstFilled(existingForm.subCity, address.subCity),
      kebele: firstFilled(existingForm.kebele, address.kebele),
      houseNumber: firstFilled(existingForm.houseNumber, address.houseNumber),
      registrationFeePaid: firstFilled(existingForm.registrationFeePaid, finance.registrationFeePaid, "yes"),
      hasDiscount: firstFilled(existingForm.hasDiscount, finance.hasDiscount, "no"),
      discountAmount: firstFilled(existingForm.discountAmount, finance.discountAmount),
      paymentPlanType: firstFilled(existingForm.paymentPlanType, finance.paymentPlanType, "monthly"),
      transportService: firstFilled(existingForm.transportService, finance.transportService, "no"),
      bloodType: firstFilled(existingForm.bloodType, health.bloodType),
      medicalCondition: firstFilled(existingForm.medicalCondition, health.medicalCondition),
      emergencyContactName: firstFilled(existingForm.emergencyContactName, health.emergencyContactName),
      emergencyPhone: firstFilled(existingForm.emergencyPhone, health.emergencyPhone),
      stream: firstFilled(existingForm.stream, academic.stream),
      specialProgram: firstFilled(existingForm.specialProgram, academic.specialProgram),
      languageOption: firstFilled(existingForm.languageOption, academic.languageOption),
      electiveSubjects: firstFilled(existingForm.electiveSubjects, academic.electiveSubjects),
      username: firstFilled(existingForm.username, account.username, source.username, source.studentId),
      temporaryPassword: firstFilled(existingForm.temporaryPassword, account.temporaryPassword),
      isActive: firstFilled(existingForm.isActive, account.isActive, source.isActive, "true"),
      role: firstFilled(existingForm.role, account.role, "student"),
      phone: firstFilled(existingForm.phone, source.phone),
      email: firstFilled(existingForm.email, source.email),
      name: firstFilled(existingForm.name, source.name, basic.name, builtName, queueItem.student?.name, "Student"),
      userId: firstFilled(existingForm.userId, existingDraft.userId, source.userId, queueItem.student?.userId),
    };

    return {
      studentId: firstFilled(existingDraft.studentId, queueItem.student?.studentId, source.studentId),
      userId: firstFilled(existingDraft.userId, form.userId),
      sourceData: source,
      form,
      parents: parents.length ? parents : [{
        parentId: "",
        fullName: "",
        relationship: "Guardian",
        phone: "",
        alternativePhone: "",
        email: "",
        occupation: "",
        nationalIdNumber: "",
        username: "",
        temporaryPassword: generateTemporaryPassword(8),
        isActive: "true",
        role: "parent",
      }],
    };
  };

  const initReRegisterDraft = (queueItem) => {
    setReRegisterDraft(buildDraftFromQueueItem(queueItem));
  };

  const loadParentSources = async () => {
    const [yearHistoryParentsMap, mainParentsMap] = await Promise.all([
      fetchCachedJson(`${DB_URL}/YearHistory/${fromYear}/Parents.json`, { ttlMs: 60000 }).catch(() => ({})),
      loadSchoolParentsNode({ rtdbBase: DB_URL }),
    ]);

    return {
      yearHistoryParentsMap: yearHistoryParentsMap || {},
      mainParentsMap: mainParentsMap || {},
    };
  };

  const buildReRegisterQueueItem = async (student, decision, parentSources) => {
    const { yearHistoryParentsMap, mainParentsMap } = parentSources || (await loadParentSources());
    const fullRes = await axios
      .get(`${DB_URL}/YearHistory/${fromYear}/Students/${student.studentId}.json`)
      .catch(() => ({ data: null }));

    const sourceStudent = fullRes.data || student.rawHistory || student.raw || {};
    const fromInfoParents = normalizeParents(sourceStudent.parentGuardianInformation?.parents);
    const linkedParentsMap = sourceStudent.parents || {};
    const seenParentIds = new Set(fromInfoParents.map((p) => String((p || {}).parentId || "").trim()).filter(Boolean));
    const mergedParents = [...fromInfoParents];

    Object.keys(linkedParentsMap).forEach((parentId) => {
      const pid = String(parentId || "").trim();
      if (!pid || seenParentIds.has(pid)) return;

      const linked = linkedParentsMap[pid] || {};
      const parentNode = yearHistoryParentsMap[pid] || mainParentsMap[pid] || {};
      mergedParents.push({
        parentId: pid,
        fullName: String(parentNode.name || "").trim(),
        relationship: String(linked.relationship || "Guardian").trim() || "Guardian",
        phone: String(parentNode.phone || "").trim(),
        alternativePhone: "",
        email: String(parentNode.email || "").trim(),
        occupation: String(parentNode.occupation || "").trim(),
        nationalIdNumber: String(parentNode.nationalIdNumber || "").trim(),
        systemAccountInformation: {
          username: pid,
          temporaryPassword: "",
          isActive: "true",
          role: "parent",
        },
      });
    });

    return {
      student,
      decision,
      fullStudent: {
        ...sourceStudent,
        parentGuardianInformation: {
          ...(sourceStudent.parentGuardianInformation || {}),
          parents: mergedParents,
        },
      },
      draftOverride: draftOverrides[student.studentId] || null,
    };
  };

  const openStudentDraftEditor = async (student) => {
    const decision = effectiveDecision(student);
    if (!(decision.action === ACTIONS.promote || decision.action === ACTIONS.repeat)) {
      notify("warning", "Only students staying in school can be edited from this table.");
      return;
    }

    setWorking(true);
    try {
      const parentSources = await loadParentSources();
      const queueItem = await buildReRegisterQueueItem(student, decision, parentSources);
      setReRegisterQueue([queueItem]);
      setReRegisterIndex(0);
      setReRegisterMode("edit");
      initReRegisterDraft(queueItem);
      setShowReRegisterModal(true);
      notify("", "");
    } catch (err) {
      notify("error", err?.response?.data?.message || err?.message || "Failed to open student editor.");
    } finally {
      setWorking(false);
    }
  };

  const updateDraftField = (field, value) => {
    setReRegisterDraft((prev) => ({
      ...prev,
      form: {
        ...(prev?.form || {}),
        [field]: value,
      },
    }));
  };

  const updateParentDraftField = (index, key, value) => {
    setReRegisterDraft((prev) => ({
      ...prev,
      parents: (prev?.parents || []).map((parent, idx) => (idx === index ? { ...parent, [key]: value } : parent)),
    }));
  };

  const addParentDraftRow = () => {
    setReRegisterDraft((prev) => ({
      ...prev,
      parents: [
        ...(prev?.parents || []),
        {
          parentId: "",
          fullName: "",
          relationship: "Guardian",
          phone: "",
          alternativePhone: "",
          email: "",
          occupation: "",
          nationalIdNumber: "",
          username: "",
          temporaryPassword: generateTemporaryPassword(8),
          isActive: "true",
          role: "parent",
        },
      ],
    }));
  };

  const removeParentDraftRow = (index) => {
    setReRegisterDraft((prev) => {
      const current = prev?.parents || [];
      if (current.length <= 1) return prev;
      return {
        ...prev,
        parents: current.filter((_, idx) => idx !== index),
      };
    });
  };

  const moveReRegisterIndex = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= reRegisterQueue.length) return;
    setReRegisterIndex(nextIndex);
    initReRegisterDraft(reRegisterQueue[nextIndex]);
  };

  const handleSaveReRegister = async () => {
    if (!reRegisterDraft?.studentId) {
      notify("error", "Missing student to re-register.");
      return;
    }

    setReRegisterSaving(true);
    try {
      const parsed = reRegisterDraft?.sourceData || {};

      const form = reRegisterDraft.form || {};
      const fullName = [form.firstName, form.middleName, form.lastName]
        .map((v) => String(v || "").trim())
        .filter(Boolean)
        .join(" ") || form.name || parsed.name || "Student";

      const parents = (reRegisterDraft.parents || []).map((parent) => ({
        parentId: String(parent.parentId || "").trim(),
        fullName: String(parent.fullName || "").trim(),
        relationship: String(parent.relationship || "Guardian").trim() || "Guardian",
        phone: String(parent.phone || "").trim(),
        alternativePhone: String(parent.alternativePhone || "").trim(),
        email: String(parent.email || "").trim(),
        occupation: String(parent.occupation || "").trim(),
        nationalIdNumber: String(parent.nationalIdNumber || "").trim(),
        systemAccountInformation: {
          username: String(parent.username || "").trim(),
          temporaryPassword: String(parent.temporaryPassword || "").trim(),
          isActive: String(parent.isActive || "true").trim() || "true",
          role: String(parent.role || "parent").trim() || "parent",
        },
      }));

      const yearSuffix = String(toYear || new Date().getFullYear()).match(/\d{4}/)?.[0]?.slice(-2) || String(new Date().getFullYear()).slice(-2);
  const schoolInfo = await loadSchoolInfoNode({ rtdbBase: DB_URL });
  const shortName = String(schoolInfo?.shortName || stored.shortName || stored.schoolShortName || "GP").trim() || "GP";
      const parentPrefix = `${shortName}P`;

  const existingParents = await loadSchoolParentsNode({ rtdbBase: DB_URL });
      const parentPattern = new RegExp(`^${parentPrefix}_(\\d{4})_${yearSuffix}$`);
      let maxParentSeq = 0;
      Object.keys(existingParents).forEach((key) => {
        const m = String(key || "").match(parentPattern);
        if (!m || !m[1]) return;
        const n = Number(m[1]);
        if (!Number.isNaN(n) && n > maxParentSeq) maxParentSeq = n;
      });

      const normalizedParents = parents
        .filter((row) => row.fullName || row.phone || row.email || row.parentId)
        .map((row) => {
          let parentId = row.parentId;
          if (!parentId) {
            maxParentSeq += 1;
            parentId = `${parentPrefix}_${String(maxParentSeq).padStart(4, "0")}_${yearSuffix}`;
          }
          const account = row.systemAccountInformation || {};
          return {
            ...row,
            parentId,
            systemAccountInformation: {
              username: String(account.username || parentId).trim() || parentId,
              temporaryPassword: String(account.temporaryPassword || generateTemporaryPassword(8)).trim(),
              isActive: String(account.isActive || "true").trim() || "true",
              role: String(account.role || "parent").trim() || "parent",
            },
          };
        });

      const merged = {
        ...(parsed || {}),
        studentId: reRegisterDraft.studentId,
        userId: reRegisterDraft.userId || form.userId || parsed.userId || "",
        name: fullName,
        firstName: form.firstName || "",
        middleName: form.middleName || "",
        lastName: form.lastName || "",
        grade: String(form.grade || ""),
        section: String(form.section || "").toUpperCase(),
        gender: form.gender || "",
        dob: form.dob || "",
        admissionDate: form.admissionDate || "",
        previousSchool: form.previousSchool || "",
        academicYear: toYear,
        status: String(form.status || "active"),
        nationalIdNumber: form.nationalIdNumber || "",
        phone: form.phone || "",
        email: form.email || "",
        reRegisteredAt: new Date().toISOString(),
        basicStudentInformation: {
          ...(parsed.basicStudentInformation || {}),
          studentId: reRegisterDraft.studentId,
          firstName: form.firstName || "",
          middleName: form.middleName || "",
          lastName: form.lastName || "",
          name: fullName,
          gender: form.gender || "",
          dob: form.dob || "",
          admissionDate: form.admissionDate || "",
          academicYear: toYear,
          grade: String(form.grade || ""),
          section: String(form.section || "").toUpperCase(),
          previousSchool: form.previousSchool || "",
          status: String(form.status || "active"),
          nationalIdNumber: form.nationalIdNumber || "",
        },
        parentGuardianInformation: {
          ...(parsed.parentGuardianInformation || {}),
          parents: normalizedParents,
        },
        addressInformation: {
          ...(parsed.addressInformation || {}),
          region: form.region || "",
          city: form.city || "",
          subCity: form.subCity || "",
          kebele: form.kebele || "",
          houseNumber: form.houseNumber || "",
        },
        financeInformation: {
          ...(parsed.financeInformation || {}),
          registrationFeePaid: form.registrationFeePaid || "yes",
          hasDiscount: form.hasDiscount || "no",
          discountAmount: form.discountAmount || "",
          paymentPlanType: form.paymentPlanType || "monthly",
          transportService: form.transportService || "no",
        },
        healthEmergency: {
          ...(parsed.healthEmergency || {}),
          bloodType: form.bloodType || "",
          medicalCondition: form.medicalCondition || "",
          emergencyContactName: form.emergencyContactName || "",
          emergencyPhone: form.emergencyPhone || "",
        },
        academicSetup: {
          ...(parsed.academicSetup || {}),
          stream: form.stream || "",
          specialProgram: form.specialProgram || "",
          languageOption: form.languageOption || "",
          electiveSubjects: form.electiveSubjects || "",
        },
        systemAccountInformation: {
          ...(parsed.systemAccountInformation || {}),
          username: form.username || reRegisterDraft.studentId,
          temporaryPassword: form.temporaryPassword || "",
          isActive: String(form.isActive || "true"),
          role: form.role || "student",
          userId: reRegisterDraft.userId || form.userId || parsed.userId || "",
        },
      };

      if (reRegisterMode === "edit") {
        const savedDraft = {
          ...reRegisterDraft,
          studentId: reRegisterDraft.studentId,
          userId: merged.userId || reRegisterDraft.userId || form.userId || parsed.userId || "",
          sourceData: merged,
          form: {
            ...form,
            name: fullName,
            grade: String(merged.grade || ""),
            section: String(merged.section || "").toUpperCase(),
            academicYear: toYear,
            status: String(merged.status || "active"),
            userId: merged.userId || reRegisterDraft.userId || form.userId || parsed.userId || "",
          },
          parents: normalizedParents,
        };

        setDraftOverrides((prev) => ({
          ...prev,
          [reRegisterDraft.studentId]: savedDraft,
        }));
        setDecisions((prev) => ({
          ...prev,
          [reRegisterDraft.studentId]: {
            ...(prev[reRegisterDraft.studentId] || {}),
            targetSection: String(savedDraft.form.section || "").toUpperCase(),
          },
        }));
        setShowReRegisterModal(false);
        setReRegisterQueue([]);
        setReRegisterIndex(0);
        setReRegisterDraft(null);
        setReRegisterMode("reregister");
        notify("success", "Student edit draft saved. It will be used during re-registration.");
        return;
      }

      await axios.patch(`${DB_URL}/Students/${reRegisterDraft.studentId}.json`, merged);

  const usersMap = await loadSchoolUsersNode({ rtdbBase: DB_URL });

      const studentActive = true;
      const desiredStudentUsername = String(merged.systemAccountInformation?.username || merged.studentId || "").trim() || merged.studentId;
      const studentCandidates = Object.entries(usersMap).filter(([, row]) => {
        const user = row || {};
        return String(user.studentId || "") === String(merged.studentId || "")
          || String(user.username || "").toLowerCase() === desiredStudentUsername.toLowerCase();
      });

      let chosenStudentUserId = String(merged.userId || merged.systemAccountInformation?.userId || "").trim();
      if (!chosenStudentUserId && studentCandidates.length > 0) {
        chosenStudentUserId = studentCandidates[0][0];
      }

      if (chosenStudentUserId) {
        await axios.patch(`${DB_URL}/Users/${chosenStudentUserId}.json`, {
          name: merged.name,
          email: merged.email || "",
          phone: merged.phone || "",
          username: desiredStudentUsername,
          studentId: merged.studentId,
          isActive: studentActive,
          role: "student",
          schoolCode,
        });

        const duplicateStudentUserIds = studentCandidates
          .map(([uid]) => uid)
          .filter((uid) => uid !== chosenStudentUserId);

        await Promise.all(
          duplicateStudentUserIds.map((uid) => axios.patch(`${DB_URL}/Users/${uid}.json`, { isActive: false }))
        );

        merged.userId = chosenStudentUserId;
        merged.systemAccountInformation = {
          ...(merged.systemAccountInformation || {}),
          userId: chosenStudentUserId,
          username: desiredStudentUsername,
          isActive: studentActive,
          role: "student",
        };

        await axios.patch(`${DB_URL}/Students/${reRegisterDraft.studentId}.json`, {
          userId: chosenStudentUserId,
          systemAccountInformation: merged.systemAccountInformation,
        });
      }

      await Promise.all(
        normalizedParents.map(async (parent) => {
          const account = parent.systemAccountInformation || {};
          const username = String(account.username || parent.parentId).trim() || parent.parentId;
          const isActive = true;
          const role = String(account.role || "parent").trim() || "parent";

          let parentUserId = "";
          const parentCandidates = Object.entries(usersMap).filter(([, row]) => {
            const user = row || {};
            return String(user.parentId || "") === String(parent.parentId || "")
              || String(user.username || "").toLowerCase() === username.toLowerCase();
          });

          Object.entries(usersMap).forEach(([uid, row]) => {
            if (parentUserId) return;
            const user = row || {};
            if (String(user.parentId || "") === parent.parentId) parentUserId = uid;
            if (!parentUserId && String(user.username || "").toLowerCase() === username.toLowerCase()) parentUserId = uid;
          });

          if (!parentUserId && existingParents[parent.parentId]?.userId) {
            parentUserId = String(existingParents[parent.parentId].userId || "");
          }

          const parentUserPayload = {
            userId: parentUserId || undefined,
            name: parent.fullName || "Parent",
            username,
            password: account.temporaryPassword || generateTemporaryPassword(8),
            email: parent.email || "",
            phone: parent.phone || "",
            profileImage: "/default-profile.png",
            role,
            isActive,
            schoolCode,
            parentId: parent.parentId,
            nationalIdNumber: parent.nationalIdNumber || "",
            nationalIdImage: existingParents[parent.parentId]?.nationalIdImage || "",
          };

          if (parentUserId) {
            await axios.patch(`${DB_URL}/Users/${parentUserId}.json`, parentUserPayload);
          }

          const duplicateParentUserIds = parentCandidates
            .map(([uid]) => uid)
            .filter((uid) => uid !== parentUserId);

          await Promise.all(
            duplicateParentUserIds.map((uid) => axios.patch(`${DB_URL}/Users/${uid}.json`, { isActive: false }))
          );

          await axios.patch(`${DB_URL}/Parents/${parent.parentId}.json`, {
            parentId: parent.parentId,
            userId: parentUserId || "",
            name: parent.fullName || "Parent",
            phone: parent.phone || "",
            email: parent.email || "",
            occupation: parent.occupation || "",
            nationalIdNumber: parent.nationalIdNumber || "",
            nationalIdImage: existingParents[parent.parentId]?.nationalIdImage || "",
            status: "active",
            schoolCode,
            updatedAt: new Date().toISOString(),
          });

          await axios.patch(`${DB_URL}/Students/${reRegisterDraft.studentId}/parents/${parent.parentId}.json`, {
            relationship: parent.relationship || "Guardian",
            userId: parentUserId || "",
            parentId: parent.parentId,
            linkedAt: new Date().toISOString(),
          });
        })
      );

      const isLast = reRegisterIndex >= reRegisterQueue.length - 1;
      const savedStudentId = reRegisterDraft.studentId;

      if (savedStudentId) {
        setProcessedStudentIds((prev) => ({ ...prev, [savedStudentId]: true }));
        setSelectedStudentsMap((prev) => ({ ...prev, [savedStudentId]: false }));
        setDecisions((prev) => {
          const next = { ...prev };
          delete next[savedStudentId];
          return next;
        });
      }

      if (isLast) {
        setShowReRegisterModal(false);
        setReRegisterQueue([]);
        setReRegisterIndex(0);
        setReRegisterDraft(null);
        notify("success", "Promotion done and re-registration details saved.");
      } else {
        moveReRegisterIndex(reRegisterIndex + 1);
      }
    } catch (err) {
      notify("error", err?.response?.data?.message || err?.message || "Failed to save re-registration.");
    } finally {
      setReRegisterSaving(false);
    }
  };

  const updateDecision = (studentId, patch) => {
    setDecisions((prev) => {
      const current = prev[studentId] || {};
      return {
        ...prev,
        [studentId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const effectiveDecision = (student) => {
    const row = decisions[student.studentId] || buildDefaultDecision(student);
    const action = row.action || getDefaultAction(student);

    let targetGrade = row.targetGrade || student.grade;
    if (action === ACTIONS.promote) targetGrade = String(Number(student.grade || 0) + 1);
    if (action === ACTIONS.repeat) targetGrade = String(student.grade || "");
    if (action === ACTIONS.graduate) targetGrade = String(student.grade || "");

    const targetSection = String(row.targetSection || student.section || "").toUpperCase();

    return {
      ...row,
      action,
      targetGrade,
      targetSection,
    };
  };

  const summary = useMemo(() => {
    let promoteCount = 0;
    let repeatCount = 0;
    let graduateCount = 0;
    let transferCount = 0;
    let withdrawCount = 0;

    selectedStudents.forEach((student) => {
      const action = effectiveDecision(student).action;
      if (action === ACTIONS.promote) promoteCount += 1;
      if (action === ACTIONS.repeat) repeatCount += 1;
      if (action === ACTIONS.graduate) graduateCount += 1;
      if (action === ACTIONS.transfer) transferCount += 1;
      if (action === ACTIONS.withdraw) withdrawCount += 1;
    });

    return {
      total: selectedStudents.length,
      totalLoaded: studentsForFromYear.length,
      promoteCount,
      repeatCount,
      graduateCount,
      transferCount,
      withdrawCount,
    };
  }, [studentsForFromYear, selectedStudents, decisions, maxGrade]);

  const applyPromotion = async () => {
    if (!canConfirmPromotion) {
      notify("error", "Only admin/registrar can confirm promotion.");
      return;
    }

    if (!fromYear || !toYear) {
      notify("error", "Year selection is missing.");
      return;
    }

    if (normalizeYearKey(fromYear) === normalizeYearKey(toYear)) {
      notify("error", "From Year and To Year must be different.");
      return;
    }

    if (selectedStudents.length === 0) {
      notify("warning", "Select at least one student before confirming promotion.");
      return;
    }

    setWorking(true);
    try {
      const now = new Date().toISOString();

      await Promise.all(
        selectedStudents.map(async (student) => {
          const decision = effectiveDecision(student);
          if (decision.action === ACTIONS.promote || decision.action === ACTIONS.repeat) {
            // Re-register step is the source of truth for year/grade movement.
            return;
          }

          const source = student.raw || {};
          const sourceHistory = student.rawHistory || {};
          const seed = { ...(sourceHistory || {}), ...(source || {}) };
          const oldRecords = seed.records || {};
          const historyRecords = sourceHistory.records || {};
          const historyFromRecord = historyRecords[fromYear] || {
            academicYear: fromYear,
            grade: String(student.grade || sourceHistory.grade || ""),
            section: String(student.section || sourceHistory.section || ""),
            status: student.status || "active",
          };
          const fromRecord = historyFromRecord || oldRecords[fromYear] || {
            academicYear: fromYear,
            grade: String(student.grade || sourceHistory.grade || ""),
            section: String(student.section || sourceHistory.section || ""),
            status: student.status || "active",
          };

          const initialGrade = String(seed.grade || sourceHistory.grade || student.grade || "");
          const initialSection = String(seed.section || sourceHistory.section || student.section || "").toUpperCase();
          let nextGrade = initialGrade;
          let nextSection = initialSection;
          let nextStatus = String(seed.status || student.status || "active");

          const basePatch = {
            ...seed,
            // Ensure missing student root can be reconstructed from YearHistory snapshot.
            studentId: seed.studentId || student.studentId,
            userId: seed.userId || student.userId || "",
            name: seed.name || student.name || "Student",
            updatedAt: now,
            records: {
              ...oldRecords,
              [fromYear]: {
                ...fromRecord,
                academicYear: fromYear,
                sourceNode: "YearHistory",
              },
            },
          };

          if (decision.action === ACTIONS.graduate) {
            const targetRecord = {
              academicYear: toYear,
              grade: String(student.grade || ""),
              section: String(student.section || ""),
              status: "graduated",
              sourceAction: ACTIONS.graduate,
              graduatedAt: now,
              notes: decision.notes || "",
            };

            nextGrade = String(student.grade || initialGrade || "");
            nextSection = String(student.section || initialSection || "").toUpperCase();
            nextStatus = "graduated";
            basePatch.records[toYear] = targetRecord;
            basePatch.academicYear = toYear;
            basePatch.status = "graduated";
            basePatch.grade = nextGrade;
            basePatch.section = nextSection;
          }

          if (decision.action === ACTIONS.transfer || decision.action === ACTIONS.withdraw) {
            const statusAfterMove = decision.action === ACTIONS.transfer ? "transferred" : "withdrawn";
            const targetRecord = {
              academicYear: toYear,
              grade: String(student.grade || ""),
              section: String(student.section || ""),
              status: statusAfterMove,
              sourceAction: decision.action,
              updatedAt: now,
              notes: decision.notes || "",
            };

            nextGrade = String(student.grade || initialGrade || "");
            nextSection = String(student.section || initialSection || "").toUpperCase();
            nextStatus = statusAfterMove;
            basePatch.records[toYear] = targetRecord;
            basePatch.academicYear = toYear;
            basePatch.status = statusAfterMove;
            basePatch.grade = nextGrade;
            basePatch.section = nextSection;
          }

          basePatch.basicStudentInformation = {
            ...(seed.basicStudentInformation || {}),
            studentId: basePatch.studentId,
            name: basePatch.name,
            grade: nextGrade,
            section: nextSection,
            academicYear: toYear,
            status: nextStatus,
          };

          basePatch.systemAccountInformation = {
            ...(seed.systemAccountInformation || {}),
            userId: basePatch.userId || seed.systemAccountInformation?.userId || "",
            username: seed.systemAccountInformation?.username || basePatch.studentId,
            role: seed.systemAccountInformation?.role || "student",
          };

          await axios.patch(`${DB_URL}/Students/${student.studentId}.json`, basePatch);
        })
      );

      const reRegisterTargets = selectedStudents.filter((student) => {
        const action = effectiveDecision(student).action;
        return action === ACTIONS.promote || action === ACTIONS.repeat;
      });

      if (reRegisterTargets.length > 0) {
        const parentSources = await loadParentSources();
        const queue = await Promise.all(
          reRegisterTargets.map((student) => buildReRegisterQueueItem(student, effectiveDecision(student), parentSources))
        );

        // Lifecycle rule: rollover deactivates existing Users accounts only.
        const usersMap = await loadSchoolUsersNode({ rtdbBase: DB_URL });
        const deactivateUserIds = new Set();

        queue.forEach((entry) => {
          const fullStudent = entry.fullStudent || {};
          const studentUserId = String(fullStudent.userId || entry.student?.userId || "").trim();
          if (studentUserId) deactivateUserIds.add(studentUserId);

          const parentIds = new Set();
          Object.keys(fullStudent.parents || {}).forEach((pid) => {
            if (pid) parentIds.add(pid);
          });
          normalizeParents(fullStudent.parentGuardianInformation?.parents).forEach((p) => {
            const pid = String(p?.parentId || "").trim();
            if (pid) parentIds.add(pid);
          });

          parentIds.forEach((pid) => {
            const linkedParentUserId = String(fullStudent.parents?.[pid]?.userId || "").trim();
            if (linkedParentUserId) deactivateUserIds.add(linkedParentUserId);

            Object.entries(usersMap).forEach(([uid, row]) => {
              if (String((row || {}).parentId || "") === pid) {
                deactivateUserIds.add(uid);
              }
            });
          });
        });

        await Promise.all(
          [...deactivateUserIds].map((uid) => axios.patch(`${DB_URL}/Users/${uid}.json`, { isActive: false }))
        );

        setReRegisterQueue(queue);
        setReRegisterIndex(0);
        setReRegisterMode("reregister");
        initReRegisterDraft(queue[0]);
        setShowReRegisterModal(true);
      }

      setStep(3);
      setConfirmText("");
      notify("success", `Promotion confirmed. ${summary.promoteCount} promoted, ${summary.repeatCount} repeated, ${summary.graduateCount} graduated.`);
      await loadBaseData();
    } catch (err) {
      notify("error", err?.response?.data?.message || err?.message || "Failed to confirm promotion.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="dashboard-page" style={{ background: PAGE_BG, minHeight: "100vh" }}>
      <style>
        {`
          .ps-root { color: var(--text-primary); }
          .ps-dashboard { display: flex; gap: 14px; padding: 12px; }
          .ps-sidebar { width: 220px; }
          .ps-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .ps-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
          .ps-table { display: grid; grid-template-columns: 0.35fr 1.25fr 0.45fr 0.45fr 0.8fr 0.5fr 0.8fr 0.75fr; gap: 8px; align-items: center; }
          .ps-rereg-body { display: grid; grid-template-columns: 1fr; gap: 14px; }
          .ps-rereg-section { border: 1px solid var(--border-soft); border-radius: 12px; padding: 10px; background: var(--surface-muted); }
          .ps-rereg-section:hover { border-color: var(--border-strong); }
          .ps-rereg-section-title { font-size: 13px; font-weight: 800; color: var(--text-primary); margin: 0 0 8px; }
          .ps-rereg-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .ps-rereg-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
          .ps-rereg-field label { display: block; margin-bottom: 4px; font-size: 11px; font-weight: 700; color: var(--text-secondary); }
          .ps-rereg-field input, .ps-rereg-field select, .ps-rereg-field textarea { width: 100%; border: 1px solid var(--input-border); border-radius: 8px; padding: 7px 9px; font-size: 12px; box-sizing: border-box; background: var(--input-bg); color: var(--text-primary); }
          .ps-panel { background: var(--surface-panel); border: 1px solid var(--border-soft); border-radius: 16px; box-shadow: var(--shadow-panel); }
          .ps-kpi { position: relative; overflow: hidden; transition: transform .2s ease, box-shadow .2s ease; }
          .ps-kpi::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--kpi-color, #2563eb); }
          .ps-kpi:hover { transform: translateY(-1px); box-shadow: 0 16px 28px color-mix(in srgb, var(--shadow-panel) 80%, transparent); }
          .ps-table-head { position: sticky; top: 0; z-index: 2; background: var(--surface-muted); }
          .ps-row { transition: background .2s ease; }
          .ps-row:hover { background: var(--surface-muted); }
          .ps-btn { border-radius: 9px; padding: 8px 12px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: transform .15s ease, box-shadow .2s ease, background .2s ease; }
          .ps-btn:hover { transform: translateY(-1px); }
          .ps-btn:disabled { transform: none; cursor: not-allowed; opacity: .65; }
          .ps-btn-primary { border: 1px solid #1d4ed8; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; box-shadow: 0 10px 18px rgba(37, 99, 235, 0.25); }
          .ps-btn-soft { border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent); background: var(--accent-soft); color: var(--accent-strong); }
          .ps-btn-danger { border: 1px solid #dc2626; background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; box-shadow: 0 10px 18px rgba(220, 38, 38, 0.24); }
          .ps-step-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 900; color: var(--text-primary); margin-bottom: 10px; }
          .ps-step-chip { background: var(--accent-soft); color: var(--accent-strong); border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent); border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 800; }
          .ps-input, .ps-select { border: 1px solid var(--input-border); border-radius: 8px; padding: 8px 10px; font-size: 13px; background: var(--input-bg); color: var(--text-primary); }
          .ps-input:focus, .ps-select:focus, .ps-rereg-field input:focus, .ps-rereg-field select:focus, .ps-rereg-field textarea:focus { outline: none; border-color: var(--input-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent); }
          .ps-hero-note { margin-top: 8px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent); background: var(--accent-soft); color: var(--accent-strong); border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 800; }
          @media (max-width: 1180px) { .ps-dashboard { flex-direction: column; } .ps-sidebar { width: auto; } }
          @media (max-width: 980px) {
            .ps-grid-2 { grid-template-columns: 1fr; }
            .ps-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .ps-table { grid-template-columns: 1fr; }
            .ps-rereg-body { grid-template-columns: 1fr; }
            .ps-rereg-grid-2, .ps-rereg-grid-3 { grid-template-columns: 1fr; }
          }
          @media (max-width: 640px) {
            .ps-stats { grid-template-columns: 1fr; }
            .ps-dashboard { padding: 8px; }
          }
        `}
      </style>

      <nav className="top-navbar" style={{ borderBottom: "1px solid var(--border-soft)", background: "color-mix(in srgb, var(--surface-panel) 88%, transparent)", backdropFilter: "blur(6px)" }}>
        <h2 style={{ color: "var(--text-primary)", fontWeight: 900, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>
        <div className="nav-right">
          <Link className="icon-circle" to="/dashboard"><FaBell /></Link>
          <Link className="icon-circle" to="/all-chat"><FaFacebookMessenger /></Link>
          <ProfileAvatar imageUrl={admin.profileImage} name={admin.name} size={38} className="profile-img" />
        </div>
      </nav>

      <div className="ps-dashboard ps-root">
        <RegisterSidebar user={admin} sticky fullHeight />
        <div className="main-content" style={{ padding: "10px 8px 20px", flex: 1, minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ width: "min(100%, 1220px)", margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="ps-panel section-header-card" style={{ padding: 18 }}>
              <div className="section-header-card__row">
                <div>
                  <h1 className="section-header-card__title" style={{ fontSize: 24, fontWeight: 900 }}>Promotion System</h1>
                    <p className="section-header-card__subtitle" style={{ fontSize: 13 }}>
                      End-of-year workflow from YearHistory snapshot: review selected students, confirm actions, and complete re-registration.
                  </p>
                  <div className="ps-hero-note"><FaLock /> Confirm key: PROMOTE</div>
                </div>

                <button type="button" onClick={loadBaseData} className="ps-btn ps-btn-soft" disabled={loading || working}>
                  <FaSyncAlt /> Refresh
                </button>
              </div>
            </div>

            <div className="ps-stats">
              {[{
                  title: "YearHistory Students",
                value: studentsForFromYear.length,
                  hint: fromYear ? `Source: YearHistory/${fromYear}` : "No year selected",
                color: "#2563eb",
              }, {
                title: "Promote",
                value: summary.promoteCount,
                hint: "Move to next grade",
                color: "#0f766e",
              }, {
                title: "Repeat",
                value: summary.repeatCount,
                hint: "Stay in same grade",
                color: "#b45309",
              }, {
                title: "Graduate",
                value: summary.graduateCount,
                hint: "Final grade complete",
                color: "#7c3aed",
              }].map((item) => (
                <div key={item.title} className="ps-kpi" style={{ ...cardStyle, padding: 12, "--kpi-color": item.color }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{item.title}</span>
                    <FaUsers style={{ color: item.color }} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: "var(--text-primary)" }}>{item.value}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}>{item.hint}</div>
                </div>
              ))}
            </div>

            {feedback.text ? (
              <div style={{ borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 700, border: `1px solid ${feedback.type === "error" ? "#fecaca" : feedback.type === "warning" ? "#fde68a" : "#bfdbfe"}`, background: feedback.type === "error" ? "#fef2f2" : feedback.type === "warning" ? "#fffbeb" : "#eff6ff", color: feedback.type === "error" ? "#991b1b" : feedback.type === "warning" ? "#92400e" : "#1e3a8a" }}>
                {feedback.text}
              </div>
            ) : null}

            <div className="ps-panel" style={{ ...cardStyle, padding: 14 }}>
              <div className="ps-step-title">
                <span className="ps-step-chip">Step 1</span>
                Select Academic Year Range
              </div>

              <div className="ps-grid-2">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <select value={fromYear} onChange={(e) => setFromYear(e.target.value)} className="ps-select">
                    <option value="">From Year</option>
                    {yearKeys.map((key) => (
                      <option key={key} value={key}>{yearLabel(key)}</option>
                    ))}
                  </select>

                  <input value={toYear} onChange={(e) => setToYear(e.target.value)} placeholder="To Year e.g. 2027_2028" className="ps-input" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "120px auto", gap: 8, justifyContent: "end" }}>
                  <input value={maxGrade} onChange={(e) => setMaxGrade(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Max Grade" className="ps-input" />
                  <button onClick={prepareReview} className="ps-btn ps-btn-primary" disabled={loading || working || runLocked}>
                    <FaPlay /> Review Students
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
                Current Academic Year: {currentAcademicYear ? yearLabel(currentAcademicYear) : "Not set"}
                {" | Status: Ready"}
              </div>
            </div>

            {step >= 2 ? (
              <div className="ps-panel" style={{ ...cardStyle, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", fontWeight: 900, color: "var(--text-primary)", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>Step 2 - Review Student Decisions ({visibleStudents.length} visible of {studentsForFromYear.length})</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{yearLabel(fromYear)} {"->"} {yearLabel(toYear)}</span>
                </div>

                <div style={{ ...cardStyle, margin: 12, padding: 10, border: "1px solid var(--border-soft)", background: "var(--surface-muted)" }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span>Selected: {summary.total} / {summary.totalLoaded}</span>
                    <span>Visible: {visibleStudents.length}</span>
                    <span>Promote: {summary.promoteCount}</span>
                    <span>Repeat: {summary.repeatCount}</span>
                    <span>Graduate: {summary.graduateCount}</span>
                    <span>Transfer: {summary.transferCount}</span>
                    <span>Withdraw: {summary.withdrawCount}</span>
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => setAllSelection(true)} className="ps-btn ps-btn-soft" style={{ padding: "6px 10px", fontSize: 11 }}>Select All</button>
                    <button onClick={() => setAllSelection(false)} className="ps-btn" style={{ border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", padding: "6px 10px", fontSize: 11 }}>Clear Selection</button>
                  </div>
                </div>

                <div style={{ ...cardStyle, margin: "0 12px 12px", padding: 10, border: "1px solid var(--border-soft)", background: "var(--surface-panel)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                    <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="ps-select">
                      <option value="all">All Grades</option>
                      {availableGrades.map((grade) => (
                        <option key={grade} value={grade}>{`Grade ${grade}`}</option>
                      ))}
                    </select>

                    <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="ps-select">
                      <option value="all">All Sections</option>
                      {availableSections.map((section) => (
                        <option key={section} value={section}>{`Section ${section}`}</option>
                      ))}
                    </select>

                    <input
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search by student name or ID"
                      className="ps-input"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setGradeFilter("all");
                        setSectionFilter("all");
                        setStudentSearch("");
                      }}
                      className="ps-btn"
                      style={{ border: "1px solid var(--border-soft)", background: "var(--surface-muted)", color: "var(--text-secondary)", justifyContent: "center" }}
                    >
                      Reset Filters
                    </button>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                    Students are now grouped by grade and section so the registerer can review one class level at a time.
                  </div>
                </div>

                <div style={{ ...cardStyle, margin: "0 12px 12px", overflow: "hidden" }}>
                  <div className="ps-table-head" style={{ ...cardStyle, borderRadius: 0, border: "none", borderBottom: "1px solid var(--border-soft)", boxShadow: "none", padding: "10px 12px", background: "var(--surface-muted)" }}>
                    <div className="ps-table" style={{ fontSize: 12, fontWeight: 900, color: "var(--text-secondary)" }}>
                      <div>Select</div>
                      <div>Student</div>
                      <div>Grade</div>
                      <div>Section</div>
                      <div>Action</div>
                      <div>To Grade</div>
                      <div>To Section</div>
                      <div>Edit Info</div>
                    </div>
                  </div>

                  <div style={{ maxHeight: 460, overflow: "auto" }}>
                    {groupedVisibleStudents.length === 0 ? (
                      <div style={{ padding: "18px 14px", fontSize: 13, color: "var(--text-muted)" }}>
                        No students match the current grade filter, section filter, or search.
                      </div>
                    ) : groupedVisibleStudents.map((gradeGroup) => (
                      <div key={gradeGroup.grade}>
                        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)", background: "color-mix(in srgb, var(--accent) 8%, var(--surface-muted))", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: "var(--text-primary)" }}>{`Grade ${gradeGroup.grade}`}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>
                            {gradeGroup.sections.reduce((count, sectionGroup) => count + sectionGroup.students.length, 0)} students
                          </div>
                        </div>

                        {gradeGroup.sections.map((sectionGroup) => (
                          <div key={`${gradeGroup.grade}-${sectionGroup.section}`}>
                            <div style={{ padding: "8px 12px", background: "var(--surface-panel)", borderBottom: "1px solid var(--border-soft)", fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>
                              {`Section ${sectionGroup.section}`}
                            </div>

                            {sectionGroup.students.map((student) => {
                              const decision = effectiveDecision(student);
                              const sectionOpts = sectionOptionsByGrade[decision.targetGrade] || [];
                              const canEditInfo = decision.action === ACTIONS.promote || decision.action === ACTIONS.repeat;
                              const hasDraftOverride = !!draftOverrides[student.studentId];

                              return (
                                <div key={student.studentId} className="ps-row" style={{ borderTop: "1px solid var(--border-soft)", padding: "10px 12px" }}>
                                  <div className="ps-table">
                                    <div>
                                      <input
                                        type="checkbox"
                                        checked={!!selectedStudentsMap[student.studentId]}
                                        onChange={() => toggleStudentSelection(student.studentId)}
                                      />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student.name}</div>
                                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{student.studentId}</div>
                                    </div>

                                    <div style={{ fontSize: 12, fontWeight: 700 }}>{student.grade}</div>
                                    <div style={{ fontSize: 12, fontWeight: 700 }}>{student.section || "-"}</div>

                                    <select value={decision.action} onChange={(e) => updateDecision(student.studentId, { action: e.target.value })} className="ps-select" style={{ padding: "6px 8px", fontSize: 12 }}>
                                      <option value={ACTIONS.promote}>Promote</option>
                                      <option value={ACTIONS.repeat}>Repeat</option>
                                      <option value={ACTIONS.graduate}>Graduate</option>
                                      <option value={ACTIONS.transfer}>Transfer</option>
                                      <option value={ACTIONS.withdraw}>Withdraw</option>
                                    </select>

                                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                                      {decision.action === ACTIONS.graduate || decision.action === ACTIONS.transfer || decision.action === ACTIONS.withdraw
                                        ? "-"
                                        : decision.targetGrade}
                                    </div>

                                    {decision.action === ACTIONS.promote || decision.action === ACTIONS.repeat ? (
                                      <select
                                        value={decision.targetSection}
                                        onChange={(e) => updateDecision(student.studentId, { targetSection: e.target.value })}
                                        className="ps-select"
                                        style={{ padding: "6px 8px", fontSize: 12 }}
                                      >
                                        <option value="">Select</option>
                                        {(sectionOpts.length ? sectionOpts : [student.section || "A"]).map((s) => (
                                          <option key={s} value={String(s).toUpperCase()}>{String(s).toUpperCase()}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>-</div>
                                    )}

                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => openStudentDraftEditor(student)}
                                        disabled={!canEditInfo || working || reRegisterSaving}
                                        className="ps-btn"
                                        title={canEditInfo ? "Edit student information before re-registration" : "Editing is only available for promote or repeat actions"}
                                        style={{
                                          width: "100%",
                                          justifyContent: "center",
                                          border: `1px solid ${canEditInfo ? "color-mix(in srgb, var(--accent) 28%, transparent)" : "var(--border-soft)"}`,
                                          background: canEditInfo ? "var(--accent-soft)" : "var(--surface-panel)",
                                          color: canEditInfo ? "var(--accent-strong)" : "var(--text-muted)",
                                          padding: "6px 8px",
                                          fontSize: 11,
                                          fontWeight: 800,
                                        }}
                                      >
                                        <FaFileAlt /> {hasDraftOverride ? "Edit Draft" : "Edit"}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {step >= 2 ? (
              <div className="ps-panel" style={{ ...cardStyle, padding: 14 }}>
                <div className="ps-step-title">
                  <span className="ps-step-chip">Step 3</span>
                  Confirm Promotion
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type PROMOTE to confirm"
                    className="ps-input"
                  />

                  <button
                    onClick={applyPromotion}
                    className="ps-btn ps-btn-danger"
                    disabled={working || confirmText.trim().toUpperCase() !== "PROMOTE"}
                  >
                    <FaLock /> Confirm Promotion
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showReRegisterModal && reRegisterDraft ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 10000, padding: 16 }}>
          <div style={{ width: "100%", height: "100%", background: "var(--surface-panel)", borderRadius: 16, border: "1px solid var(--border-soft)", boxShadow: "0 24px 44px rgba(15,23,42,0.28)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", background: "linear-gradient(180deg, var(--surface-muted) 0%, var(--surface-panel) 100%)" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)" }}>{reRegisterMode === "edit" ? "Edit Student Promotion Draft" : "Re-Register Student Data"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {reRegisterMode === "edit"
                    ? `This draft will be applied when promotion is confirmed | ID: ${reRegisterDraft.studentId}`
                    : `Student ${reRegisterIndex + 1} of ${reRegisterQueue.length} | ID: ${reRegisterDraft.studentId}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {reRegisterMode !== "edit" ? (
                  <>
                    <button onClick={() => moveReRegisterIndex(reRegisterIndex - 1)} className="ps-btn" disabled={reRegisterIndex === 0 || reRegisterSaving} style={{ border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", padding: "7px 10px", fontWeight: 700 }}>Previous</button>
                    <button onClick={() => moveReRegisterIndex(reRegisterIndex + 1)} className="ps-btn" disabled={reRegisterIndex >= reRegisterQueue.length - 1 || reRegisterSaving} style={{ border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", padding: "7px 10px", fontWeight: 700 }}>Next</button>
                  </>
                ) : null}
                <button onClick={() => setShowReRegisterModal(false)} className="ps-btn" disabled={reRegisterSaving} style={{ border: "1px solid var(--danger-border)", background: "var(--surface-panel)", color: "var(--danger)", padding: "7px 10px", fontWeight: 700 }}>Close</button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
              <div className="ps-rereg-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="ps-rereg-section">
                    <p className="ps-rereg-section-title">Basic Student Information</p>
                    <div className="ps-rereg-grid-3">
                      <div className="ps-rereg-field"><label>First Name</label><input value={reRegisterDraft.form?.firstName || ""} onChange={(e) => updateDraftField("firstName", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Middle Name</label><input value={reRegisterDraft.form?.middleName || ""} onChange={(e) => updateDraftField("middleName", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Last Name</label><input value={reRegisterDraft.form?.lastName || ""} onChange={(e) => updateDraftField("lastName", e.target.value)} /></div>
                    </div>
                    <div className="ps-rereg-grid-3" style={{ marginTop: 8 }}>
                      <div className="ps-rereg-field"><label>Grade</label><input value={reRegisterDraft.form?.grade || ""} onChange={(e) => updateDraftField("grade", e.target.value.replace(/[^0-9]/g, ""))} /></div>
                      <div className="ps-rereg-field"><label>Section</label><input value={reRegisterDraft.form?.section || ""} onChange={(e) => updateDraftField("section", e.target.value.toUpperCase())} /></div>
                      <div className="ps-rereg-field"><label>Academic Year</label><input value={reRegisterDraft.form?.academicYear || ""} onChange={(e) => updateDraftField("academicYear", e.target.value)} /></div>
                    </div>
                    <div className="ps-rereg-grid-3" style={{ marginTop: 8 }}>
                      <div className="ps-rereg-field"><label>Gender</label><input value={reRegisterDraft.form?.gender || ""} onChange={(e) => updateDraftField("gender", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Date of Birth</label><input value={reRegisterDraft.form?.dob || ""} onChange={(e) => updateDraftField("dob", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Admission Date</label><input value={reRegisterDraft.form?.admissionDate || ""} onChange={(e) => updateDraftField("admissionDate", e.target.value)} /></div>
                    </div>
                    <div className="ps-rereg-grid-3" style={{ marginTop: 8 }}>
                      <div className="ps-rereg-field"><label>Student Number</label><input value={reRegisterDraft.form?.studentNumber || ""} onChange={(e) => updateDraftField("studentNumber", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>National ID Number</label><input value={reRegisterDraft.form?.nationalIdNumber || ""} onChange={(e) => updateDraftField("nationalIdNumber", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Status</label><input value={reRegisterDraft.form?.status || "active"} onChange={(e) => updateDraftField("status", e.target.value)} /></div>
                    </div>
                    <div className="ps-rereg-grid-2" style={{ marginTop: 8 }}>
                      <div className="ps-rereg-field"><label>Phone</label><input value={reRegisterDraft.form?.phone || ""} onChange={(e) => updateDraftField("phone", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Email</label><input value={reRegisterDraft.form?.email || ""} onChange={(e) => updateDraftField("email", e.target.value)} /></div>
                    </div>
                    <div className="ps-rereg-field" style={{ marginTop: 8 }}><label>Previous School</label><input value={reRegisterDraft.form?.previousSchool || ""} onChange={(e) => updateDraftField("previousSchool", e.target.value)} /></div>
                  </div>

                  <div className="ps-rereg-section">
                    <p className="ps-rereg-section-title">Address Information</p>
                    <div className="ps-rereg-grid-3">
                      <div className="ps-rereg-field"><label>Region</label><input value={reRegisterDraft.form?.region || ""} onChange={(e) => updateDraftField("region", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>City</label><input value={reRegisterDraft.form?.city || ""} onChange={(e) => updateDraftField("city", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Sub City</label><input value={reRegisterDraft.form?.subCity || ""} onChange={(e) => updateDraftField("subCity", e.target.value)} /></div>
                    </div>
                    <div className="ps-rereg-grid-2" style={{ marginTop: 8 }}>
                      <div className="ps-rereg-field"><label>Kebele</label><input value={reRegisterDraft.form?.kebele || ""} onChange={(e) => updateDraftField("kebele", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>House Number</label><input value={reRegisterDraft.form?.houseNumber || ""} onChange={(e) => updateDraftField("houseNumber", e.target.value)} /></div>
                    </div>
                  </div>

                  <div className="ps-rereg-section">
                    <p className="ps-rereg-section-title">Finance Information</p>
                    <div className="ps-rereg-grid-3">
                      <div className="ps-rereg-field"><label>Registration Fee Paid</label><input value={reRegisterDraft.form?.registrationFeePaid || ""} onChange={(e) => updateDraftField("registrationFeePaid", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Has Discount</label><input value={reRegisterDraft.form?.hasDiscount || ""} onChange={(e) => updateDraftField("hasDiscount", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Discount Amount</label><input value={reRegisterDraft.form?.discountAmount || ""} onChange={(e) => updateDraftField("discountAmount", e.target.value)} /></div>
                    </div>
                    <div className="ps-rereg-grid-2" style={{ marginTop: 8 }}>
                      <div className="ps-rereg-field"><label>Payment Plan Type</label><input value={reRegisterDraft.form?.paymentPlanType || ""} onChange={(e) => updateDraftField("paymentPlanType", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Transport Service</label><input value={reRegisterDraft.form?.transportService || ""} onChange={(e) => updateDraftField("transportService", e.target.value)} /></div>
                    </div>
                  </div>

                  <div className="ps-rereg-section">
                    <p className="ps-rereg-section-title">Health And Academic Setup</p>
                    <div className="ps-rereg-grid-2">
                      <div className="ps-rereg-field"><label>Blood Type</label><input value={reRegisterDraft.form?.bloodType || ""} onChange={(e) => updateDraftField("bloodType", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Medical Condition</label><input value={reRegisterDraft.form?.medicalCondition || ""} onChange={(e) => updateDraftField("medicalCondition", e.target.value)} /></div>
                    </div>
                    <div className="ps-rereg-grid-2" style={{ marginTop: 8 }}>
                      <div className="ps-rereg-field"><label>Emergency Contact Name</label><input value={reRegisterDraft.form?.emergencyContactName || ""} onChange={(e) => updateDraftField("emergencyContactName", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Emergency Phone</label><input value={reRegisterDraft.form?.emergencyPhone || ""} onChange={(e) => updateDraftField("emergencyPhone", e.target.value)} /></div>
                    </div>
                    <div className="ps-rereg-grid-3" style={{ marginTop: 8 }}>
                      <div className="ps-rereg-field"><label>Stream</label><input value={reRegisterDraft.form?.stream || ""} onChange={(e) => updateDraftField("stream", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Special Program</label><input value={reRegisterDraft.form?.specialProgram || ""} onChange={(e) => updateDraftField("specialProgram", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Language Option</label><input value={reRegisterDraft.form?.languageOption || ""} onChange={(e) => updateDraftField("languageOption", e.target.value)} /></div>
                    </div>
                    <div className="ps-rereg-field" style={{ marginTop: 8 }}>
                      <label>Elective Subjects</label>
                      <textarea rows={2} value={reRegisterDraft.form?.electiveSubjects || ""} onChange={(e) => updateDraftField("electiveSubjects", e.target.value)} />
                    </div>
                  </div>

                  <div className="ps-rereg-section">
                    <p className="ps-rereg-section-title">System Account Information</p>
                    <div className="ps-rereg-grid-2">
                      <div className="ps-rereg-field"><label>Username</label><input value={reRegisterDraft.form?.username || ""} onChange={(e) => updateDraftField("username", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Temporary Password</label><input value={reRegisterDraft.form?.temporaryPassword || ""} onChange={(e) => updateDraftField("temporaryPassword", e.target.value)} /></div>
                    </div>
                    <div className="ps-rereg-grid-2" style={{ marginTop: 8 }}>
                      <div className="ps-rereg-field"><label>Is Active</label><input value={reRegisterDraft.form?.isActive || "true"} onChange={(e) => updateDraftField("isActive", e.target.value)} /></div>
                      <div className="ps-rereg-field"><label>Role</label><input value={reRegisterDraft.form?.role || "student"} onChange={(e) => updateDraftField("role", e.target.value)} /></div>
                    </div>
                  </div>

                  <div className="ps-rereg-section">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <p className="ps-rereg-section-title" style={{ margin: 0 }}>Parent Guardian Information</p>
                      <button onClick={addParentDraftRow} type="button" style={{ border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)", background: "var(--accent-soft)", color: "var(--accent-strong)", borderRadius: 8, padding: "5px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Add Parent</button>
                    </div>
                    {(reRegisterDraft.parents || []).map((parent, index) => (
                      <div key={`${parent.parentId || "parent"}_${index}`} style={{ border: "1px solid var(--border-soft)", borderRadius: 10, padding: 8, marginBottom: 8, background: "var(--surface-panel)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <strong style={{ fontSize: 12, color: "var(--text-primary)" }}>Parent #{index + 1}</strong>
                          <button type="button" onClick={() => removeParentDraftRow(index)} style={{ border: "1px solid var(--danger-border)", background: "var(--surface-panel)", color: "var(--danger)", borderRadius: 8, padding: "4px 7px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Remove</button>
                        </div>
                        <div className="ps-rereg-grid-3">
                          <div className="ps-rereg-field"><label>Parent ID</label><input value={parent.parentId || ""} onChange={(e) => updateParentDraftField(index, "parentId", e.target.value)} /></div>
                          <div className="ps-rereg-field"><label>Full Name</label><input value={parent.fullName || ""} onChange={(e) => updateParentDraftField(index, "fullName", e.target.value)} /></div>
                          <div className="ps-rereg-field">
                            <label>Relationship</label>
                            <select value={parent.relationship || "Guardian"} onChange={(e) => updateParentDraftField(index, "relationship", e.target.value)}>
                              <option value="Father">Father</option>
                              <option value="Mother">Mother</option>
                              <option value="Guardian">Guardian</option>
                            </select>
                          </div>
                        </div>
                        <div className="ps-rereg-grid-3" style={{ marginTop: 8 }}>
                          <div className="ps-rereg-field"><label>Phone</label><input value={parent.phone || ""} onChange={(e) => updateParentDraftField(index, "phone", e.target.value)} /></div>
                          <div className="ps-rereg-field"><label>Alternative Phone</label><input value={parent.alternativePhone || ""} onChange={(e) => updateParentDraftField(index, "alternativePhone", e.target.value)} /></div>
                          <div className="ps-rereg-field"><label>Email</label><input value={parent.email || ""} onChange={(e) => updateParentDraftField(index, "email", e.target.value)} /></div>
                        </div>
                        <div className="ps-rereg-grid-3" style={{ marginTop: 8 }}>
                          <div className="ps-rereg-field"><label>Occupation</label><input value={parent.occupation || ""} onChange={(e) => updateParentDraftField(index, "occupation", e.target.value)} /></div>
                          <div className="ps-rereg-field"><label>National ID Number</label><input value={parent.nationalIdNumber || ""} onChange={(e) => updateParentDraftField(index, "nationalIdNumber", e.target.value)} /></div>
                          <div className="ps-rereg-field"><label>Username</label><input value={parent.username || ""} onChange={(e) => updateParentDraftField(index, "username", e.target.value)} /></div>
                        </div>
                        <div className="ps-rereg-grid-3" style={{ marginTop: 8 }}>
                          <div className="ps-rereg-field"><label>Temporary Password</label><input value={parent.temporaryPassword || ""} onChange={(e) => updateParentDraftField(index, "temporaryPassword", e.target.value)} /></div>
                          <div className="ps-rereg-field">
                            <label>isActive</label>
                            <select value={parent.isActive || "true"} onChange={(e) => updateParentDraftField(index, "isActive", e.target.value)}>
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                          </div>
                          <div className="ps-rereg-field"><label>Role</label><input value={parent.role || "parent"} readOnly /></div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                          <button
                            type="button"
                            onClick={() => updateParentDraftField(index, "temporaryPassword", generateTemporaryPassword(8))}
                            style={{ border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)", color: "var(--accent-strong)", background: "var(--surface-panel)", borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                          >
                            Generate Password
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
            </div>

            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", background: "linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)" }}>
              {reRegisterMode === "edit" ? (
                <div style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>Save the draft here, then confirm promotion when you are ready.</div>
                  <button onClick={handleSaveReRegister} className="ps-btn ps-btn-primary" disabled={reRegisterSaving}>
                    {reRegisterSaving ? "Saving..." : "Save Draft"}
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={() => moveReRegisterIndex(reRegisterIndex + 1)} className="ps-btn" disabled={reRegisterIndex >= reRegisterQueue.length - 1 || reRegisterSaving} style={{ border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-secondary)", fontWeight: 700 }}>
                    Skip (Next)
                  </button>

                  <button onClick={handleSaveReRegister} className="ps-btn ps-btn-primary" disabled={reRegisterSaving}>
                    {reRegisterSaving ? "Saving..." : reRegisterIndex >= reRegisterQueue.length - 1 ? "Re-Register & Finish" : "Re-Register & Next"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
