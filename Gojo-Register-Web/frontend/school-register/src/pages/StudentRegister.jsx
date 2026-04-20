import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaSave, FaHome, FaFileAlt, FaChalkboardTeacher, FaChartLine, FaSignOutAlt, FaCog, FaChevronDown, FaBell, FaFacebookMessenger } from "react-icons/fa";
import { BACKEND_BASE } from "../config";
import "../styles/global.css";
import RegisterSidebar from "../components/RegisterSidebar";
import ProfileAvatar from "../components/ProfileAvatar";
import {
  loadGradeManagementNode,
  loadSchoolInfoNode,
  loadSchoolParentsNode,
  loadSchoolStudentsNode,
} from "../utils/registerData";

export default function StudentRegister() {
  const navigate = useNavigate();
  const todayDate = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    grade: "",
    section: "",
    gender: "",
    dob: "",
    admissionDate: todayDate,
    studentNumber: "",
    academicYear: "",
    previousSchool: "",
    nationalIdNumber: "",
    status: "active",

    region: "",
    city: "",
    subCity: "",
    kebele: "",
    houseNumber: "",

    registrationFeePaid: "yes",
    hasDiscount: "no",
    discountAmount: "",
    paymentPlanType: "monthly",
    transportService: "no",

    bloodType: "",
    medicalCondition: "",
    emergencyContactName: "",
    emergencyPhone: "",

    stream: "",
    specialProgram: "",
    languageOption: "",
    electiveSubjects: "",

    username: "",
    temporaryPassword: "",
    isActive: "true",
    role: "student",
  });
  const [parents, setParents] = useState([
    {
      parentId: "",
      fullName: "",
      relationship: "Father",
      phone: "",
      alternativePhone: "",
      email: "",
      occupation: "",
      nationalIdNumber: "",
      profileImage: "",
      username: "",
      temporaryPassword: "",
      isActive: "true",
      role: "parent",
    },
  ]);
  const [studentPhoto, setStudentPhoto] = useState(null);
  const [studentNationalIdImage, setStudentNationalIdImage] = useState(null);
  const [parentProfileFiles, setParentProfileFiles] = useState({});
  const [parentNationalIdFiles, setParentNationalIdFiles] = useState({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [idLoading, setIdLoading] = useState(false);
  const [schoolShortName, setSchoolShortName] = useState("");
  const [nextAvailableStudentId, setNextAvailableStudentId] = useState("");
  const [activeAcademicYear, setActiveAcademicYear] = useState("");
  const [loadingAcademicYear, setLoadingAcademicYear] = useState(false);
  const [gradeOptions, setGradeOptions] = useState([]);
  const [sectionsByGrade, setSectionsByGrade] = useState({});
  const [openStep, setOpenStep] = useState(1);
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(true);
  const [studentMenuOpen, setStudentMenuOpen] = useState(true);

  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem("registrar") || localStorage.getItem("admin") || "{}") || {};
    } catch (e) {
      return {};
    }
  })();

  const admin = {
    name: stored.name || stored.username || "Register Office",
    adminId: stored.financeId || stored.adminId || stored.userId || "",
    profileImage: stored.profileImage || "/default-profile.png",
  };
  const schoolCode = stored.schoolCode || "";
  const DB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";
  const DB_URL = schoolCode ? `${DB_BASE}/Platform1/Schools/${schoolCode}` : DB_BASE;

  const parseAcademicYearSuffix = (yearInput) => {
    const raw = String(yearInput || "").trim();
    if (!raw) return "";

    const fourDigitYear = raw.match(/\d{4}/);
    if (fourDigitYear && fourDigitYear[0]) {
      return fourDigitYear[0].slice(-2);
    }

    const twoDigitYear = raw.match(/\d{2}/);
    return twoDigitYear && twoDigitYear[0] ? twoDigitYear[0] : "";
  };

  const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const isValidGradeKey = (value) => {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric >= 1 && numeric <= 12;
  };

  const normalizeSectionKey = (value) => String(value || "").trim().toUpperCase();

  const generateTemporaryPassword = (length = 8) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let result = "";
    for (let i = 0; i < length; i += 1) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  useEffect(() => {
    setForm((prev) => (prev.temporaryPassword ? prev : { ...prev, temporaryPassword: generateTemporaryPassword(8) }));
    setParents((prev) => prev.map((parent) => ({ ...parent, temporaryPassword: parent.temporaryPassword || generateTemporaryPassword(8) })));
  }, []);

  useEffect(() => {
    const fetchActiveAcademicYear = async () => {
      if (!schoolCode) return;
      setLoadingAcademicYear(true);
      try {
        const schoolInfo = await loadSchoolInfoNode({ rtdbBase: DB_URL });
        const currentYear = schoolInfo?.currentAcademicYear || "";
        const normalizedYear = String(currentYear || "").trim();
        setActiveAcademicYear(normalizedYear);
        setForm((prev) => ({ ...prev, academicYear: normalizedYear }));
      } catch (error) {
        console.error("Failed to fetch active academic year:", error);
        setActiveAcademicYear("");
        setForm((prev) => ({ ...prev, academicYear: "" }));
      } finally {
        setLoadingAcademicYear(false);
      }
    };

    fetchActiveAcademicYear();
  }, [schoolCode, DB_URL]);

  useEffect(() => {
    const fetchGradeManagement = async () => {
      if (!schoolCode) return;
      try {
        const rawGrades = await loadGradeManagementNode({ rtdbBase: DB_URL });
        const gradesObj = Object.fromEntries(
          Object.entries(rawGrades || {}).filter(([gradeKey]) => isValidGradeKey(gradeKey))
        );
        const grades = Object.keys(gradesObj).sort((a, b) => Number(a) - Number(b));

        const nextSections = {};
        grades.forEach((grade) => {
          const sections = Object.keys((gradesObj?.[grade]?.sections || {}))
            .map((sectionKey) => normalizeSectionKey(sectionKey))
            .filter(Boolean)
            .sort((a, b) => String(a).localeCompare(String(b)));
          nextSections[grade] = sections;
        });

        setGradeOptions(grades);
        setSectionsByGrade(nextSections);

        setForm((prev) => {
          const next = { ...prev };
          if (prev.grade && !grades.includes(String(prev.grade || ""))) {
            next.grade = "";
          }

          const activeGrade = String(next.grade || "");
          const allowedSections = nextSections[activeGrade] || [];
          if (!activeGrade || !allowedSections.includes(String(prev.section || "").toUpperCase())) {
            next.section = "";
          }
          return next;
        });
      } catch (error) {
        console.error("Failed to load grade management:", error);
      }
    };

    fetchGradeManagement();
  }, [schoolCode, DB_URL]);

  const generateStudentNumber = async (yearInput) => {
    const yearSuffix = parseAcademicYearSuffix(yearInput);
    if (!schoolCode || !yearSuffix) {
      setForm((prev) => ({ ...prev, studentNumber: "", username: "" }));
      return "";
    }

    setIdLoading(true);
    try {
      let shortName = (schoolShortName || stored.shortName || stored.schoolShortName || "").trim();

      if (!shortName) {
        const schoolInfo = await loadSchoolInfoNode({ rtdbBase: DB_URL });
        const fetchedShortName = schoolInfo?.shortName || "";
        shortName = String(fetchedShortName || "").trim();
      }

      if (!shortName) {
        setForm((prev) => ({ ...prev, studentNumber: "", username: "" }));
        return "";
      }

      setSchoolShortName(shortName);

  const studentsObj = await loadSchoolStudentsNode({ rtdbBase: DB_URL });
      // Append 'S' to shortName to clearly mark student IDs (e.g. ShortNameS_0001_24)
      const safeShortName = escapeRegex(String(shortName) + "S");
      const pattern = new RegExp(`^${safeShortName}_(\\d{4})_${yearSuffix}$`);

      let maxSeq = 0;
      Object.keys(studentsObj || {}).forEach((studentKey) => {
        const match = String(studentKey || "").match(pattern);
        if (match && match[1]) {
          const seqNum = Number(match[1]);
          if (!Number.isNaN(seqNum) && seqNum > maxSeq) {
            maxSeq = seqNum;
          }
        }
      });

      const nextSeq = String(maxSeq + 1).padStart(4, "0");
      const generatedId = `${shortName}S_${nextSeq}_${yearSuffix}`;
      setNextAvailableStudentId(generatedId);
      setForm((prev) => ({ ...prev, studentNumber: generatedId, username: generatedId }));
      return generatedId;
    } catch (err) {
      console.error("Failed to auto-generate student number:", err);
      setNextAvailableStudentId("");
      setForm((prev) => ({ ...prev, studentNumber: "", username: "" }));
      return "";
    } finally {
      setIdLoading(false);
    }
  };

  const generateParentIds = async (yearInput, parentCount = parents.length) => {
    const yearSuffix = parseAcademicYearSuffix(yearInput);
    if (!schoolCode || !yearSuffix || parentCount <= 0) {
      setParents((prev) => prev.map((parent) => ({ ...parent, parentId: "" })));
      return [];
    }

    try {
      let shortName = (schoolShortName || stored.shortName || stored.schoolShortName || "").trim();

      if (!shortName) {
        const schoolInfo = await loadSchoolInfoNode({ rtdbBase: DB_URL });
        const fetchedShortName = schoolInfo?.shortName || "";
        shortName = String(fetchedShortName || "").trim();
      }

      if (!shortName) {
        setParents((prev) => prev.map((parent) => ({ ...parent, parentId: "" })));
        return [];
      }

      setSchoolShortName(shortName);

  const parentsObj = await loadSchoolParentsNode({ rtdbBase: DB_URL });
      const safePrefix = escapeRegex(`${shortName}P`);
      // Use 4-digit sequence for parent IDs (e.g. GMIP_0001_26)
      const pattern = new RegExp(`^${safePrefix}_(\\d{4})_${yearSuffix}$`);

      let maxSeq = 0;
      Object.keys(parentsObj || {}).forEach((parentKey) => {
        const match = String(parentKey || "").match(pattern);
        if (match && match[1]) {
          const seqNum = Number(match[1]);
          if (!Number.isNaN(seqNum) && seqNum > maxSeq) {
            maxSeq = seqNum;
          }
        }
      });

      const generatedParentIds = Array.from({ length: parentCount }, (_, index) => `${shortName}P_${String(maxSeq + index + 1).padStart(4, "0")}_${yearSuffix}`);

      setParents((prev) => prev.map((parent, index) => ({
        ...parent,
        parentId: generatedParentIds[index] || "",
        username: parent.username || generatedParentIds[index] || "",
        temporaryPassword: parent.temporaryPassword || generateTemporaryPassword(8),
      })));
      return generatedParentIds;
    } catch (err) {
      console.error("Failed to auto-generate parent IDs:", err);
      setParents((prev) => prev.map((parent) => ({ ...parent, parentId: "" })));
      return [];
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "grade") {
        next.section = "";
      }
      if (name === "section") {
        next.section = String(value || "").toUpperCase();
      }
      return next;
    });
  };

  const handleParentChange = (index, key, value) => {
    setParents((prev) =>
      prev.map((parent, idx) => (idx === index ? { ...parent, [key]: value } : parent))
    );
  };

  const addParent = () => {
    setParents((prev) => [
      ...prev,
      {
        parentId: "",
        fullName: "",
        relationship: "Guardian",
        phone: "",
        alternativePhone: "",
        email: "",
        occupation: "",
        nationalIdNumber: "",
        profileImage: "",
        username: "",
        temporaryPassword: generateTemporaryPassword(8),
        isActive: "true",
        role: "parent",
      },
    ]);
  };

  const removeParent = (index) => {
    setParentProfileFiles((prev) => {
      const next = {};
      Object.entries(prev || {}).forEach(([key, file]) => {
        const idx = Number(key);
        if (Number.isNaN(idx) || idx === index) return;
        next[idx > index ? idx - 1 : idx] = file;
      });
      return next;
    });
    setParentNationalIdFiles((prev) => {
      const next = {};
      Object.entries(prev || {}).forEach(([key, file]) => {
        const idx = Number(key);
        if (Number.isNaN(idx) || idx === index) return;
        next[idx > index ? idx - 1 : idx] = file;
      });
      return next;
    });
    setParents((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const handleParentNationalIdFileChange = (index, file) => {
    setParentNationalIdFiles((prev) => ({ ...prev, [index]: file || null }));
  };

  const handleParentProfileFileChange = (index, file) => {
    setParentProfileFiles((prev) => ({ ...prev, [index]: file || null }));
  };

  useEffect(() => {
    if (!schoolCode) return;

    if (!form.academicYear) {
      setForm((prev) => ({ ...prev, studentNumber: "", username: "" }));
      return;
    }

    const timer = setTimeout(() => {
      generateStudentNumber(form.academicYear);
    }, 250);

    return () => clearTimeout(timer);
  }, [form.academicYear, schoolCode]);

  useEffect(() => {
    if (!schoolCode || !form.academicYear || parents.length === 0) return;
    generateParentIds(form.academicYear, parents.length);
  }, [form.academicYear, schoolCode, parents.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const stored = JSON.parse(localStorage.getItem("registrar") || localStorage.getItem("admin") || "{}") || {};
      const schoolCode = stored.schoolCode || "";

      if (!schoolCode) {
        setMessage("Missing schoolCode in session. Please login again.");
        setSubmitting(false);
        return;
      }

      if (!activeAcademicYear) {
        setMessage("No active academic year is set. Please set/activate Academic Year first.");
        setOpenStep(1);
        setSubmitting(false);
        return;
      }

      const studentTempPassword = (form.temporaryPassword || "").trim() || generateTemporaryPassword(8);

      // Always fetch fresh next ID from DB right before register to avoid stale IDs.
      const ensuredStudentId = await generateStudentNumber(activeAcademicYear);
      if (!ensuredStudentId) {
        setMessage("Could not auto-generate Student ID. Please provide Academic Year and ensure school shortName exists.");
        setOpenStep(1);
        setSubmitting(false);
        return;
      }

      if (!basicComplete) {
        setMessage("Please complete Step 1 (Basic Student Information).\n");
        setOpenStep(1);
        setSubmitting(false);
        return;
      }
      if (!parentComplete) {
        setMessage("Please complete Step 2 (Parent / Guardian Information).\n");
        setOpenStep(2);
        setSubmitting(false);
        return;
      }
      if (!addressComplete) {
        setMessage("Please complete Step 3 (Address Information).\n");
        setOpenStep(3);
        setSubmitting(false);
        return;
      }
      if (!financeComplete) {
        setMessage("Please complete Step 4 (Finance Information).\n");
        setOpenStep(4);
        setSubmitting(false);
        return;
      }

      const generatedParentIds = await generateParentIds(activeAcademicYear, parents.length);
      const parentsWithIds = parents.map((parent, index) => ({ ...parent, parentId: generatedParentIds[index] || parent.parentId || "", originalIndex: index }));
      const validParents = parentsWithIds.filter((p) => p.parentId && p.fullName.trim() && p.phone.trim());
      if (validParents.length === 0) {
        setMessage("At least one parent/guardian with parentId, full name and phone is required.");
        setSubmitting(false);
        return;
      }

      const fd = new FormData();
      Object.entries({ ...form, academicYear: activeAcademicYear, temporaryPassword: studentTempPassword, studentNumber: ensuredStudentId }).forEach(([k, v]) => fd.append(k, v));

      const fullName = [form.firstName, form.middleName, form.lastName]
        .map((v) => (v || "").trim())
        .filter(Boolean)
        .join(" ");

      // Compatibility fields for existing backend
      fd.append("name", fullName);
      fd.append("password", studentTempPassword);

      const validParentsWithFiles = [];
      validParents.forEach((parent, index) => {
        const profileImageField = `parentProfileImage_${index}`;
        const nationalIdImageField = `parentNationalIdImage_${index}`;
        const { originalIndex, ...parentPayload } = parent;
        validParentsWithFiles.push({ ...parentPayload, profileImageField, nationalIdImageField });
        const parentProfileFile = parentProfileFiles[originalIndex];
        if (parentProfileFile) {
          fd.append(profileImageField, parentProfileFile);
        }
        const parentFile = parentNationalIdFiles[originalIndex];
        if (parentFile) {
          fd.append(nationalIdImageField, parentFile);
        }
      });

      fd.append("parents", JSON.stringify(validParentsWithFiles));

      if (studentPhoto) {
        fd.append("studentPhoto", studentPhoto);
      }

      if (studentNationalIdImage) {
        fd.append("studentNationalIdImage", studentNationalIdImage);
      }

      fd.append("schoolCode", schoolCode);

      const res = await fetch(`${BACKEND_BASE}/register/student`, { method: "POST", body: fd });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage(`Student registered. studentId: ${data.studentId || ""}`);
        setForm({
          firstName: "",
          middleName: "",
          lastName: "",
          grade: "",
          section: "",
          gender: "",
          dob: "",
          admissionDate: todayDate,
          studentNumber: "",
          academicYear: activeAcademicYear,
          previousSchool: "",
          nationalIdNumber: "",
          status: "active",
          region: "",
          city: "",
          subCity: "",
          kebele: "",
          houseNumber: "",
          registrationFeePaid: "yes",
          hasDiscount: "no",
          discountAmount: "",
          paymentPlanType: "monthly",
          transportService: "no",
          bloodType: "",
          medicalCondition: "",
          emergencyContactName: "",
          emergencyPhone: "",
          stream: "",
          specialProgram: "",
          languageOption: "",
          electiveSubjects: "",
          username: "",
          temporaryPassword: generateTemporaryPassword(8),
          isActive: "true",
          role: "student",
        });
        setParents([
          {
            parentId: "",
            fullName: "",
            relationship: "Father",
            phone: "",
            alternativePhone: "",
            email: "",
            occupation: "",
            nationalIdNumber: "",
            profileImage: "",
            username: "",
            temporaryPassword: generateTemporaryPassword(8),
            isActive: "true",
            role: "parent",
          },
        ]);
        setStudentPhoto(null);
        setStudentNationalIdImage(null);
        setParentProfileFiles({});
        setParentNationalIdFiles({});
      } else {
        setMessage(data.message || "Registration failed.");
      }
    } catch (err) {
      setMessage("Server error. Check console.");
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle = { textAlign: "left", marginBottom: 6, display: "block", fontWeight: 700, color: "var(--text-secondary)", fontSize: 12 };
  const fieldStyle = {
    width: "100%",
    border: "1px solid var(--input-border)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    color: "var(--text-primary)",
    background: "var(--input-bg)",
    outline: "none",
  };
  const sectionCardStyle = {
    border: "1px solid var(--border-soft)",
    borderRadius: 12,
    padding: 12,
    background: "var(--surface-panel)",
    boxShadow: "var(--shadow-soft)",
  };
  const sectionTitleStyle = {
    margin: "0 0 10px",
    fontSize: 14,
    fontWeight: 800,
    color: "var(--text-primary)",
  };
  const readonlyFieldStyle = { ...fieldStyle, background: "var(--accent-soft)", fontWeight: 700 };
  const primaryButtonStyle = {
    border: "none",
    background: "var(--accent-strong)",
    color: "#fff",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
  const subtleButtonStyle = {
    border: "1px solid var(--border-strong)",
    color: "var(--accent-strong)",
    background: "var(--surface-panel)",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  };
  const dangerGhostButtonStyle = {
    border: "1px solid var(--danger-border)",
    color: "var(--danger)",
    background: "var(--surface-panel)",
    borderRadius: 8,
    padding: "4px 8px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  };
  const pageBackground = "linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-secondary) 100%)";
  const messageIsSuccess = message.startsWith("Student registered");

  const stepItems = [
    { id: 1, title: "Basic Student Information" },
    { id: 2, title: "Parent / Guardian Information" },
    { id: 3, title: "Address Information" },
    { id: 4, title: "Finance Information" },
    { id: 5, title: "Health & Emergency (Optional)" },
    { id: 6, title: "Academic Setup (Optional)" },
    { id: 7, title: "System Account Information" },
  ];

  const basicComplete = Boolean(
    form.firstName && form.middleName && form.lastName && form.gender && form.dob && form.admissionDate && form.studentNumber && form.academicYear && form.grade && form.section && form.status && studentPhoto
  );
  const validParentsCount = parents.filter((p) => p.fullName.trim() && p.phone.trim()).length;
  const parentComplete = validParentsCount > 0;
  const addressComplete = Boolean(form.region && form.city && form.subCity);
  const financeComplete = Boolean(
    form.registrationFeePaid && form.hasDiscount && form.paymentPlanType && form.transportService && (form.hasDiscount !== "yes" || form.discountAmount)
  );
  const healthComplete = true;
  const academicComplete = true;
  const systemComplete = true;

  const completedSteps = {
    1: basicComplete,
    2: parentComplete,
    3: addressComplete,
    4: financeComplete,
    5: healthComplete,
    6: academicComplete,
    7: systemComplete,
  };

  const canOpenStep = (id) => {
    if (id === 1) return true;
    for (let i = 1; i < id; i += 1) {
      if (!completedSteps[i]) return false;
    }
    return true;
  };

  const handleStepOpen = (id) => {
    if (!canOpenStep(id)) {
      setMessage("Please complete previous step(s) first.");
      return;
    }
    setMessage("");
    setOpenStep(id);
  };

  const goToNextStep = (id) => {
    if (!completedSteps[id]) {
      setMessage(`Please complete Step ${id} before continuing.`);
      return;
    }
    if (id < 7) {
      setMessage("");
      setOpenStep(id + 1);
    }
  };

  const activeStep = stepItems.find((step) => step.id === openStep) || stepItems[0];

  return (
    <div className="dashboard-page" style={{ background: pageBackground, minHeight: "100vh", height: "100vh", overflow: "hidden" }}>
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

        <div className="main-content google-main" style={{ padding: "10px 20px 20px", flex: 1, minWidth: 0, boxSizing: "border-box", overflowY: "auto", overflowX: "hidden", height: "100%" }}>
          <div style={{ width: "min(100%, 980px)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="section-header-card" style={{ padding: 18 }}>
              <div className="section-header-card__title" style={{ fontSize: 17 }}>Student Registration</div>
              <div className="section-header-card__subtitle">Create a new student account with complete profile details.</div>
            </div>

            <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-soft)", borderRadius: 14, boxShadow: "var(--shadow-panel)", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <button type="button" onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "var(--text-primary)", cursor: "pointer", fontSize: 20, width: 10 }}>←</button>
              <h2 style={{ margin: 0, color: "var(--text-primary)" }}>Student Registration</h2>
            </div>

            {message && (
              <div
                style={{
                  marginBottom: 12,
                  color: messageIsSuccess ? "var(--success)" : "var(--danger)",
                  background: messageIsSuccess ? "var(--success-soft)" : "var(--danger-soft)",
                  border: `1px solid ${messageIsSuccess ? "var(--success-border)" : "var(--danger-border)"}`,
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14, alignItems: "start" }}>
                <div style={{ ...sectionCardStyle, position: "sticky", top: 74 }}>
                  <h3 style={{ ...sectionTitleStyle, marginBottom: 12 }}>Registration Steps</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {stepItems.map((step) => {
                      const done = completedSteps[step.id];
                      const isOpen = openStep === step.id;
                      return (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => handleStepOpen(step.id)}
                          style={{
                            textAlign: "left",
                            border: isOpen ? "1px solid var(--accent-strong)" : "1px solid var(--border-soft)",
                            background: isOpen ? "var(--accent-soft)" : "var(--surface-panel)",
                            color: "var(--text-primary)",
                            borderRadius: 10,
                            padding: "10px 10px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 22, height: 22, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, background: isOpen ? "var(--accent-strong)" : "var(--surface-strong)", color: isOpen ? "#fff" : "var(--text-secondary)" }}>{step.id}</span>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{step.title}</span>
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 900, color: done ? "var(--success)" : "var(--text-muted)" }}>{done ? "✓" : "○"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...sectionCardStyle, paddingBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span className="section-header-card__chip">Step {activeStep.id}</span>
                      <h3 style={{ ...sectionTitleStyle, margin: 0 }}>{activeStep.title}</h3>
                    </div>
                  </div>

                  <div style={{ ...sectionCardStyle, display: openStep === 1 ? "block" : "none" }}>
                    {openStep === 1 && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                          <div><label style={labelStyle}>First Name *</label><input name="firstName" value={form.firstName} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Middle Name *</label><input name="middleName" value={form.middleName} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Last Name *</label><input name="lastName" value={form.lastName} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Gender *</label><select name="gender" value={form.gender} onChange={handleChange} style={fieldStyle}><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
                          <div><label style={labelStyle}>Date of Birth *</label><input name="dob" type="date" value={form.dob} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Admission Date *</label><input name="admissionDate" type="date" value={form.admissionDate} onChange={handleChange} style={fieldStyle} /></div>
                          <div>
                            <label style={labelStyle}>Student ID / Number *</label>
                            <input
                              name="studentNumber"
                              value={idLoading ? "Generating..." : form.studentNumber}
                              readOnly
                              style={readonlyFieldStyle}
                            />
                            
                            {nextAvailableStudentId ? (
                              <div style={{ marginTop: 4, fontSize: 11, color: "var(--success)", fontWeight: 700 }}>
                                Current available ID: {nextAvailableStudentId}
                              </div>
                            ) : null}
                          </div>
                          <div>
                            <label style={labelStyle}>Academic Year *</label>
                            <input
                              name="academicYear"
                              value={loadingAcademicYear ? "Loading..." : form.academicYear}
                              readOnly
                              style={readonlyFieldStyle}
                            />
                            <div style={{ marginTop: 4, fontSize: 11, color: activeAcademicYear ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                              {activeAcademicYear
                                ? `Active Academic Year from system: ${String(activeAcademicYear).replace("_", "/")}`
                                : "No active academic year found. Activate Academic Year before registration."}
                            </div>
                          </div>
                          <div>
                            <label style={labelStyle}>Grade *</label>
                            {gradeOptions.length > 0 ? (
                              <select name="grade" value={form.grade} onChange={handleChange} style={fieldStyle}>
                                <option value="">Select grade</option>
                                {gradeOptions.map((grade) => (
                                  <option key={grade} value={grade}>{grade}</option>
                                ))}
                              </select>
                            ) : (
                              <input name="grade" value={form.grade} onChange={handleChange} style={fieldStyle} placeholder="Create grades in Grede Management" />
                            )}
                          </div>
                          <div>
                            <label style={labelStyle}>Section *</label>
                            {!form.grade ? (
                              <select name="section" value="" disabled style={{ ...fieldStyle, opacity: 0.7, cursor: "not-allowed" }}>
                                <option value="">Select grade first</option>
                              </select>
                            ) : (sectionsByGrade[String(form.grade || "")] || []).length > 0 ? (
                              <select name="section" value={form.section} onChange={handleChange} style={fieldStyle}>
                                <option value="">Select section</option>
                                {(sectionsByGrade[String(form.grade || "")] || []).map((section) => (
                                  <option key={section} value={section}>{section}</option>
                                ))}
                              </select>
                            ) : (
                              <input name="section" value={form.section} onChange={handleChange} style={fieldStyle} placeholder="Add sections in Grede Management" />
                            )}
                          </div>
                          <div><label style={labelStyle}>Previous School</label><input name="previousSchool" value={form.previousSchool} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>National ID Number</label><input name="nationalIdNumber" value={form.nationalIdNumber} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Status *</label><select name="status" value={form.status} onChange={handleChange} style={fieldStyle}><option value="active">Active</option><option value="transferred">Transferred</option><option value="withdrawn">Withdrawn</option></select></div>
                          <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Student Photo *</label><input type="file" accept="image/*" onChange={(e) => setStudentPhoto(e.target.files?.[0] || null)} style={fieldStyle} /></div>
                          <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Student National ID Image</label><input type="file" accept="image/*" onChange={(e) => setStudentNationalIdImage(e.target.files?.[0] || null)} style={fieldStyle} /></div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button type="button" onClick={() => goToNextStep(1)} style={primaryButtonStyle}>Save & Next</button>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ ...sectionCardStyle, display: openStep === 2 ? "block" : "none" }}>
                    {openStep === 2 && (
                      <>
                        {parents.map((parent, index) => (
                          <div key={index} style={{ border: "1px solid var(--border-soft)", borderRadius: 10, padding: 10, marginBottom: 10, background: "var(--surface-muted)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>Parent/Guardian {index + 1}</strong>
                              {parents.length > 1 && <button type="button" onClick={() => removeParent(index)} style={dangerGhostButtonStyle}>Remove</button>}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                              <div>
                                <label style={labelStyle}>Parent ID *</label>
                                <input value={parent.parentId || ""} readOnly style={readonlyFieldStyle} />
                              </div>
                              <div><label style={labelStyle}>Full Name *</label><input value={parent.fullName} onChange={(e) => handleParentChange(index, "fullName", e.target.value)} style={fieldStyle} /></div>
                              <div><label style={labelStyle}>Relationship *</label><select value={parent.relationship} onChange={(e) => handleParentChange(index, "relationship", e.target.value)} style={fieldStyle}><option value="Father">Father</option><option value="Mother">Mother</option><option value="Guardian">Guardian</option></select></div>
                              <div><label style={labelStyle}>Phone Number *</label><input value={parent.phone} onChange={(e) => handleParentChange(index, "phone", e.target.value)} style={fieldStyle} /></div>
                              <div><label style={labelStyle}>Alternative Phone</label><input value={parent.alternativePhone} onChange={(e) => handleParentChange(index, "alternativePhone", e.target.value)} style={fieldStyle} /></div>
                              <div><label style={labelStyle}>Email</label><input type="email" value={parent.email} onChange={(e) => handleParentChange(index, "email", e.target.value)} style={fieldStyle} /></div>
                              <div><label style={labelStyle}>Occupation</label><input value={parent.occupation} onChange={(e) => handleParentChange(index, "occupation", e.target.value)} style={fieldStyle} /></div>
                              <div><label style={labelStyle}>National ID Number</label><input value={parent.nationalIdNumber || ""} onChange={(e) => handleParentChange(index, "nationalIdNumber", e.target.value)} style={fieldStyle} /></div>
                              <div><label style={labelStyle}>Parent Profile Picture</label><input type="file" accept="image/*" onChange={(e) => handleParentProfileFileChange(index, e.target.files?.[0] || null)} style={fieldStyle} /></div>
                              <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>National ID Image</label><input type="file" accept="image/*" onChange={(e) => handleParentNationalIdFileChange(index, e.target.files?.[0] || null)} style={fieldStyle} /></div>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                          <button type="button" onClick={addParent} style={subtleButtonStyle}>+ Add Another Parent/Guardian</button>
                          <button type="button" onClick={() => goToNextStep(2)} style={primaryButtonStyle}>Save & Next</button>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ ...sectionCardStyle, display: openStep === 3 ? "block" : "none" }}>
                    {openStep === 3 && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                          <div><label style={labelStyle}>Region *</label><input name="region" value={form.region} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>City *</label><input name="city" value={form.city} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Sub-city *</label><input name="subCity" value={form.subCity} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Zone/Kebele</label><input name="kebele" value={form.kebele} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>House Number</label><input name="houseNumber" value={form.houseNumber} onChange={handleChange} style={fieldStyle} /></div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button type="button" onClick={() => goToNextStep(3)} style={primaryButtonStyle}>Save & Next</button></div>
                      </>
                    )}
                  </div>

                  <div style={{ ...sectionCardStyle, display: openStep === 4 ? "block" : "none" }}>
                    {openStep === 4 && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                          <div><label style={labelStyle}>Registration Fee Paid? *</label><select name="registrationFeePaid" value={form.registrationFeePaid} onChange={handleChange} style={fieldStyle}><option value="yes">Yes</option><option value="no">No</option></select></div>
                          <div><label style={labelStyle}>Discount / Scholarship *</label><select name="hasDiscount" value={form.hasDiscount} onChange={handleChange} style={fieldStyle}><option value="no">No</option><option value="yes">Yes</option></select></div>
                          <div><label style={labelStyle}>Discount Amount</label><input name="discountAmount" value={form.discountAmount} onChange={handleChange} disabled={form.hasDiscount !== "yes"} style={{ ...fieldStyle, opacity: form.hasDiscount === "yes" ? 1 : 0.6 }} /></div>
                          <div><label style={labelStyle}>Payment Plan Type *</label><select name="paymentPlanType" value={form.paymentPlanType} onChange={handleChange} style={fieldStyle}><option value="monthly">Monthly</option><option value="semester">Semester</option></select></div>
                          <div><label style={labelStyle}>Transport Service *</label><select name="transportService" value={form.transportService} onChange={handleChange} style={fieldStyle}><option value="no">No</option><option value="yes">Yes</option></select></div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button type="button" onClick={() => goToNextStep(4)} style={primaryButtonStyle}>Save & Next</button></div>
                      </>
                    )}
                  </div>

                  <div style={{ ...sectionCardStyle, display: openStep === 5 ? "block" : "none" }}>
                    {openStep === 5 && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                          <div><label style={labelStyle}>Blood Type</label><input name="bloodType" value={form.bloodType} onChange={handleChange} style={fieldStyle} /></div>
                          <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>Medical Condition</label><input name="medicalCondition" value={form.medicalCondition} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Emergency Contact Name</label><input name="emergencyContactName" value={form.emergencyContactName} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Emergency Phone</label><input name="emergencyPhone" value={form.emergencyPhone} onChange={handleChange} style={fieldStyle} /></div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button type="button" onClick={() => goToNextStep(5)} style={primaryButtonStyle}>Save & Next</button></div>
                      </>
                    )}
                  </div>

                  <div style={{ ...sectionCardStyle, display: openStep === 6 ? "block" : "none" }}>
                    {openStep === 6 && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                          <div><label style={labelStyle}>Stream</label><select name="stream" value={form.stream} onChange={handleChange} style={fieldStyle}><option value="">Select</option><option value="Natural">Natural</option><option value="Social">Social</option></select></div>
                          <div><label style={labelStyle}>Special Program</label><input name="specialProgram" value={form.specialProgram} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Language Option</label><input name="languageOption" value={form.languageOption} onChange={handleChange} style={fieldStyle} /></div>
                          <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Elective Subjects</label><input name="electiveSubjects" value={form.electiveSubjects} onChange={handleChange} style={fieldStyle} /></div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button type="button" onClick={() => goToNextStep(6)} style={primaryButtonStyle}>Save & Next</button></div>
                      </>
                    )}
                  </div>

                  <div style={{ ...sectionCardStyle, display: openStep === 7 ? "block" : "none" }}>
                    {openStep === 7 && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                          <div><label style={labelStyle}>Username</label><input name="username" value={form.username} onChange={handleChange} style={fieldStyle} /></div>
                          <div>
                            <label style={labelStyle}>Temporary Password</label>
                            <div style={{ display: "flex", gap: 6 }}>
                              <input type="password" name="temporaryPassword" value={form.temporaryPassword} onChange={handleChange} style={fieldStyle} />
                              <button type="button" onClick={() => setForm((prev) => ({ ...prev, temporaryPassword: generateTemporaryPassword(8) }))} style={{ ...subtleButtonStyle, padding: "0 10px" }}>Generate</button>
                            </div>
                          </div>
                          <div><label style={labelStyle}>isActive</label><select name="isActive" value={form.isActive} onChange={handleChange} style={fieldStyle}><option value="true">true</option><option value="false">false</option></select></div>
                          <div><label style={labelStyle}>Role</label><input name="role" value="student" readOnly style={readonlyFieldStyle} /></div>
                        </div>

                        <div style={{ marginTop: 14 }}>
                          <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>Parent System Account Information</h4>
                          {parents.map((parent, index) => (
                            <div key={`parent-system-${index}`} style={{ border: "1px solid var(--border-soft)", borderRadius: 10, padding: 10, marginBottom: 10, background: "var(--surface-muted)" }}>
                              <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Parent/Guardian {index + 1}</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                                <div><label style={labelStyle}>Username</label><input value={parent.username || parent.parentId || ""} onChange={(e) => handleParentChange(index, "username", e.target.value)} style={fieldStyle} /></div>
                                <div>
                                  <label style={labelStyle}>Temporary Password</label>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <input value={parent.temporaryPassword || ""} onChange={(e) => handleParentChange(index, "temporaryPassword", e.target.value)} style={fieldStyle} />
                                    <button type="button" onClick={() => handleParentChange(index, "temporaryPassword", generateTemporaryPassword(8))} style={{ ...subtleButtonStyle, padding: "0 10px" }}>Generate</button>
                                  </div>
                                </div>
                                <div><label style={labelStyle}>isActive</label><select value={parent.isActive || "true"} onChange={(e) => handleParentChange(index, "isActive", e.target.value)} style={fieldStyle}><option value="true">true</option><option value="false">false</option></select></div>
                                <div><label style={labelStyle}>Role</label><input value={parent.role || "parent"} readOnly style={readonlyFieldStyle} /></div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button
                            type="submit"
                            disabled={submitting}
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, ...primaryButtonStyle, borderRadius: 10, padding: "10px 12px", fontSize: 13, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.75 : 1 }}
                          >
                            <FaSave style={{ marginRight: 8 }} />
                            {submitting ? "Saving..." : "Register Student"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
