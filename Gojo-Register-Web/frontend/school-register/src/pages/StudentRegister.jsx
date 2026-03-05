import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaSave, FaHome, FaFileAlt, FaChalkboardTeacher, FaChartLine, FaSignOutAlt, FaCog, FaChevronDown, FaBell, FaFacebookMessenger } from "react-icons/fa";
import { BACKEND_BASE } from "../config";
import "../styles/global.css";

export default function StudentRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    grade: "",
    section: "",
    gender: "",
    dob: "",
    admissionDate: "",
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
      username: "",
      temporaryPassword: "",
      isActive: "true",
      role: "parent",
    },
  ]);
  const [studentPhoto, setStudentPhoto] = useState(null);
  const [studentNationalIdImage, setStudentNationalIdImage] = useState(null);
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
        const res = await fetch(`${DB_URL}/schoolInfo/currentAcademicYear.json`);
        const currentYear = res.ok ? await res.json() : "";
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
        const res = await fetch(`${DB_URL}/GradeManagement/grades.json`);
        const gradesObj = res.ok ? (await res.json()) || {} : {};
        const grades = Object.keys(gradesObj || {}).sort((a, b) => Number(a) - Number(b));

        const nextSections = {};
        grades.forEach((grade) => {
          const sections = Object.keys((gradesObj?.[grade]?.sections || {})).sort((a, b) => String(a).localeCompare(String(b)));
          nextSections[grade] = sections;
        });

        setGradeOptions(grades);
        setSectionsByGrade(nextSections);

        setForm((prev) => {
          const next = { ...prev };
          if (grades.length > 0 && !grades.includes(String(prev.grade || ""))) {
            next.grade = grades[0];
          }

          const activeGrade = String(next.grade || "");
          const allowedSections = nextSections[activeGrade] || [];
          if (allowedSections.length > 0 && !allowedSections.includes(String(prev.section || "").toUpperCase())) {
            next.section = allowedSections[0];
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
        const shortNameRes = await fetch(`${DB_URL}/schoolInfo/shortName.json`);
        const fetchedShortName = shortNameRes.ok ? await shortNameRes.json() : "";
        shortName = String(fetchedShortName || "").trim();
      }

      if (!shortName) {
        setForm((prev) => ({ ...prev, studentNumber: "", username: "" }));
        return "";
      }

      setSchoolShortName(shortName);

      const studentsRes = await fetch(`${DB_URL}/Students.json`);
      const studentsObj = studentsRes.ok ? (await studentsRes.json()) || {} : {};
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
        const shortNameRes = await fetch(`${DB_URL}/schoolInfo/shortName.json`);
        const fetchedShortName = shortNameRes.ok ? await shortNameRes.json() : "";
        shortName = String(fetchedShortName || "").trim();
      }

      if (!shortName) {
        setParents((prev) => prev.map((parent) => ({ ...parent, parentId: "" })));
        return [];
      }

      setSchoolShortName(shortName);

      const parentsRes = await fetch(`${DB_URL}/Parents.json`);
      const parentsObj = parentsRes.ok ? (await parentsRes.json()) || {} : {};
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
        const allowedSections = sectionsByGrade[String(value || "")] || [];
        if (allowedSections.length > 0 && !allowedSections.includes(String(prev.section || "").toUpperCase())) {
          next.section = allowedSections[0];
        }
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
        username: "",
        temporaryPassword: generateTemporaryPassword(8),
        isActive: "true",
        role: "parent",
      },
    ]);
  };

  const removeParent = (index) => {
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
        const nationalIdImageField = `parentNationalIdImage_${index}`;
        const { originalIndex, ...parentPayload } = parent;
        validParentsWithFiles.push({ ...parentPayload, nationalIdImageField });
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
          admissionDate: "",
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
            username: "",
            temporaryPassword: generateTemporaryPassword(8),
            isActive: "true",
            role: "parent",
          },
        ]);
        setStudentPhoto(null);
        setStudentNationalIdImage(null);
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

  const labelStyle = { textAlign: "left", marginBottom: 6, display: "block", fontWeight: 700, color: "#334155", fontSize: 12 };
  const fieldStyle = {
    width: "100%",
    border: "1px solid #dbe3ef",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    color: "#0f172a",
    background: "#f8fafc",
    outline: "none",
  };
  const sectionCardStyle = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    background: "#ffffff",
    boxShadow: "0 6px 18px rgba(15,23,42,0.05)",
  };
  const sectionTitleStyle = {
    margin: "0 0 10px",
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
  };

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
        <div className="google-sidebar" style={{ width: '220px', padding: '12px', borderRadius: 16, background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 10px 24px rgba(15,23,42,0.06)', height: 'fit-content' }}>
          <div className="sidebar-profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBottom: 6 }}>
            <div className="sidebar-img-circle" style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '2px solid #e6eefc' }}>
              <img src={admin.profileImage || "/default-profile.png"} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{admin.name || "Register Office"}</h3>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{admin.adminId || "username"}</p>
          </div>

          <div className="sidebar-menu" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <button
              type="button"
              className="sidebar-btn"
              onClick={() => setDashboardMenuOpen((prev) => !prev)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg, #eff6ff, #eef2ff)', color: '#1e3a8a', borderRadius: 12, border: '1px solid #c7d2fe', cursor: 'pointer' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FaHome style={{ width: 18, height: 18 }} /> Dashboard</span>
              <FaChevronDown style={{ transform: dashboardMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }} />
            </button>

            {dashboardMenuOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 10, paddingLeft: 10, borderLeft: '2px solid #dbeafe' }}>
                <Link className="sidebar-btn" to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}><FaHome style={{ width: 16, height: 16 }} /> Home</Link>
                <Link className="sidebar-btn" to="/my-posts" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}><FaFileAlt style={{ width: 16, height: 16 }} /> My Posts</Link>
                <Link className="sidebar-btn" to="/overview" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}><FaChartLine style={{ width: 16, height: 16 }} /> Overview</Link>
                <Link className="sidebar-btn" to="/academic-years" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}><FaFileAlt style={{ width: 16, height: 16 }} /> Academic Year</Link>
                <Link className="sidebar-btn" to="/grede-management" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}><FaFileAlt style={{ width: 16, height: 16 }} /> Grede Management</Link>
              </div>
            )}

            <button
              type="button"
              className="sidebar-btn"
              onClick={() => setStudentMenuOpen((prev) => !prev)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg, #eff6ff, #eef2ff)', color: '#1e3a8a', borderRadius: 12, border: '1px solid #c7d2fe', cursor: 'pointer' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Students</span>
              <FaChevronDown style={{ transform: studentMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }} />
            </button>

            {studentMenuOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 10, paddingLeft: 10, borderLeft: '2px solid #dbeafe' }}>
                <Link className="sidebar-btn" to="/students" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}><FaChalkboardTeacher style={{ width: 16, height: 16 }} /> Student</Link>
                <Link className="sidebar-btn" to="/student-register" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, fontWeight: 700, backgroundColor: '#1d4ed8', color: '#fff', borderRadius: 10, boxShadow: '0 8px 18px rgba(29,78,216,0.25)' }}><FaFileAlt style={{ width: 16, height: 16 }} /> Register Student</Link>
                <Link className="sidebar-btn" to="/parents" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}><FaFileAlt style={{ width: 16, height: 16 }} /> Student Parent</Link>
              </div>
            )}

            <Link className="sidebar-btn" to="/analytics" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12 }}>
              <FaChartLine style={{ width: 18, height: 18 }} /> Analytics
            </Link>

            <button
              className="sidebar-btn logout-btn"
              onClick={() => {
                localStorage.removeItem("registrar");
                localStorage.removeItem("admin");
                window.location.href = "/login";
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12 }}
            >
              <FaSignOutAlt style={{ width: 18, height: 18 }} /> Logout
            </button>
          </div>
        </div>

        <div className="main-content google-main" style={{ padding: "10px 20px 20px", flex: 1, minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ maxWidth: 760, margin: "0 auto 12px", background: "linear-gradient(135deg, #1e3a8a, #2563eb)", color: "#fff", borderRadius: 14, padding: "12px 14px", boxShadow: "0 14px 28px rgba(30,58,138,0.22)" }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Student Registration</div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.95 }}>Create a new student account with complete profile details.</div>
          </div>

          <div style={{ maxWidth: 980, margin: "0 auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, boxShadow: "0 8px 20px rgba(15,23,42,0.08)", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <button type="button" onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "black", cursor: "pointer", fontSize: 20, width: 10 }}>←</button>
              <h2 style={{ margin: 0 }}>Student Registration</h2>
            </div>

            {message && (
              <div
                style={{
                  marginBottom: 12,
                  color: message.startsWith("Student registered") ? "#166534" : "#b91c1c",
                  background: message.startsWith("Student registered") ? "#ecfdf3" : "#fff1f2",
                  border: `1px solid ${message.startsWith("Student registered") ? "#86efac" : "#fecdd3"}`,
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
                            border: isOpen ? "1px solid #1d4ed8" : "1px solid #e2e8f0",
                            background: isOpen ? "#eff6ff" : "#fff",
                            color: "#0f172a",
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
                            <span style={{ width: 22, height: 22, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, background: isOpen ? "#1d4ed8" : "#e2e8f0", color: isOpen ? "#fff" : "#334155" }}>{step.id}</span>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{step.title}</span>
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 900, color: done ? "#16a34a" : "#94a3b8" }}>{done ? "✓" : "○"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <div style={sectionCardStyle}>
                    <button type="button" onClick={() => handleStepOpen(1)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                      <h3 style={sectionTitleStyle}>1) Basic Student Information {completedSteps[1] ? "✓" : ""}</h3>
                    </button>
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
                              style={{ ...fieldStyle, background: "#eef2ff", fontWeight: 700 }}
                            />
                            
                            {nextAvailableStudentId ? (
                              <div style={{ marginTop: 4, fontSize: 11, color: "#0f766e", fontWeight: 700 }}>
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
                              style={{ ...fieldStyle, background: "#eef2ff", fontWeight: 700 }}
                            />
                            <div style={{ marginTop: 4, fontSize: 11, color: activeAcademicYear ? "#0f766e" : "#b91c1c", fontWeight: 700 }}>
                              {activeAcademicYear
                                ? `Active Academic Year from system: ${String(activeAcademicYear).replace("_", "/")}`
                                : "No active academic year found. Activate Academic Year before registration."}
                            </div>
                          </div>
                          <div>
                            <label style={labelStyle}>Grade *</label>
                            {gradeOptions.length > 0 ? (
                              <select name="grade" value={form.grade} onChange={handleChange} style={fieldStyle}>
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
                            {(sectionsByGrade[String(form.grade || "")] || []).length > 0 ? (
                              <select name="section" value={form.section} onChange={handleChange} style={fieldStyle}>
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
                          <button type="button" onClick={() => goToNextStep(1)} style={{ border: "none", background: "#1d4ed8", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save & Next</button>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={sectionCardStyle}>
                    <button type="button" onClick={() => handleStepOpen(2)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                      <h3 style={sectionTitleStyle}>2) Parent / Guardian Information {completedSteps[2] ? "✓" : ""}</h3>
                    </button>
                    {openStep === 2 && (
                      <>
                        {parents.map((parent, index) => (
                          <div key={index} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, marginBottom: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <strong style={{ fontSize: 13, color: "#1f2937" }}>Parent/Guardian {index + 1}</strong>
                              {parents.length > 1 && <button type="button" onClick={() => removeParent(index)} style={{ border: "1px solid #fee2e2", color: "#b91c1c", background: "#fff", borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Remove</button>}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                              <div>
                                <label style={labelStyle}>Parent ID *</label>
                                <input value={parent.parentId || ""} readOnly style={{ ...fieldStyle, background: "#eef2ff", fontWeight: 700 }} />
                              </div>
                              <div><label style={labelStyle}>Full Name *</label><input value={parent.fullName} onChange={(e) => handleParentChange(index, "fullName", e.target.value)} style={fieldStyle} /></div>
                              <div><label style={labelStyle}>Relationship *</label><select value={parent.relationship} onChange={(e) => handleParentChange(index, "relationship", e.target.value)} style={fieldStyle}><option value="Father">Father</option><option value="Mother">Mother</option><option value="Guardian">Guardian</option></select></div>
                              <div><label style={labelStyle}>Phone Number *</label><input value={parent.phone} onChange={(e) => handleParentChange(index, "phone", e.target.value)} style={fieldStyle} /></div>
                              <div><label style={labelStyle}>Alternative Phone</label><input value={parent.alternativePhone} onChange={(e) => handleParentChange(index, "alternativePhone", e.target.value)} style={fieldStyle} /></div>
                              <div><label style={labelStyle}>Email</label><input type="email" value={parent.email} onChange={(e) => handleParentChange(index, "email", e.target.value)} style={fieldStyle} /></div>
                              <div><label style={labelStyle}>Occupation</label><input value={parent.occupation} onChange={(e) => handleParentChange(index, "occupation", e.target.value)} style={fieldStyle} /></div>
                              <div><label style={labelStyle}>National ID Number</label><input value={parent.nationalIdNumber || ""} onChange={(e) => handleParentChange(index, "nationalIdNumber", e.target.value)} style={fieldStyle} /></div>
                              <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>National ID Image</label><input type="file" accept="image/*" onChange={(e) => handleParentNationalIdFileChange(index, e.target.files?.[0] || null)} style={fieldStyle} /></div>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                          <button type="button" onClick={addParent} style={{ border: "1px solid #dbeafe", color: "#1d4ed8", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>+ Add Another Parent/Guardian</button>
                          <button type="button" onClick={() => goToNextStep(2)} style={{ border: "none", background: "#1d4ed8", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save & Next</button>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={sectionCardStyle}>
                    <button type="button" onClick={() => handleStepOpen(3)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}><h3 style={sectionTitleStyle}>3) Address Information {completedSteps[3] ? "✓" : ""}</h3></button>
                    {openStep === 3 && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                          <div><label style={labelStyle}>Region *</label><input name="region" value={form.region} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>City *</label><input name="city" value={form.city} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Sub-city *</label><input name="subCity" value={form.subCity} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Zone/Kebele</label><input name="kebele" value={form.kebele} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>House Number</label><input name="houseNumber" value={form.houseNumber} onChange={handleChange} style={fieldStyle} /></div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button type="button" onClick={() => goToNextStep(3)} style={{ border: "none", background: "#1d4ed8", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save & Next</button></div>
                      </>
                    )}
                  </div>

                  <div style={sectionCardStyle}>
                    <button type="button" onClick={() => handleStepOpen(4)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}><h3 style={sectionTitleStyle}>4) Finance Information {completedSteps[4] ? "✓" : ""}</h3></button>
                    {openStep === 4 && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                          <div><label style={labelStyle}>Registration Fee Paid? *</label><select name="registrationFeePaid" value={form.registrationFeePaid} onChange={handleChange} style={fieldStyle}><option value="yes">Yes</option><option value="no">No</option></select></div>
                          <div><label style={labelStyle}>Discount / Scholarship *</label><select name="hasDiscount" value={form.hasDiscount} onChange={handleChange} style={fieldStyle}><option value="no">No</option><option value="yes">Yes</option></select></div>
                          <div><label style={labelStyle}>Discount Amount</label><input name="discountAmount" value={form.discountAmount} onChange={handleChange} disabled={form.hasDiscount !== "yes"} style={{ ...fieldStyle, opacity: form.hasDiscount === "yes" ? 1 : 0.6 }} /></div>
                          <div><label style={labelStyle}>Payment Plan Type *</label><select name="paymentPlanType" value={form.paymentPlanType} onChange={handleChange} style={fieldStyle}><option value="monthly">Monthly</option><option value="semester">Semester</option></select></div>
                          <div><label style={labelStyle}>Transport Service *</label><select name="transportService" value={form.transportService} onChange={handleChange} style={fieldStyle}><option value="no">No</option><option value="yes">Yes</option></select></div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button type="button" onClick={() => goToNextStep(4)} style={{ border: "none", background: "#1d4ed8", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save & Next</button></div>
                      </>
                    )}
                  </div>

                  <div style={sectionCardStyle}>
                    <button type="button" onClick={() => handleStepOpen(5)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}><h3 style={sectionTitleStyle}>5) Health & Emergency (Optional) {completedSteps[5] ? "✓" : ""}</h3></button>
                    {openStep === 5 && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                          <div><label style={labelStyle}>Blood Type</label><input name="bloodType" value={form.bloodType} onChange={handleChange} style={fieldStyle} /></div>
                          <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>Medical Condition</label><input name="medicalCondition" value={form.medicalCondition} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Emergency Contact Name</label><input name="emergencyContactName" value={form.emergencyContactName} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Emergency Phone</label><input name="emergencyPhone" value={form.emergencyPhone} onChange={handleChange} style={fieldStyle} /></div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button type="button" onClick={() => goToNextStep(5)} style={{ border: "none", background: "#1d4ed8", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save & Next</button></div>
                      </>
                    )}
                  </div>

                  <div style={sectionCardStyle}>
                    <button type="button" onClick={() => handleStepOpen(6)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}><h3 style={sectionTitleStyle}>6) Academic Setup (Optional) {completedSteps[6] ? "✓" : ""}</h3></button>
                    {openStep === 6 && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                          <div><label style={labelStyle}>Stream</label><select name="stream" value={form.stream} onChange={handleChange} style={fieldStyle}><option value="">Select</option><option value="Natural">Natural</option><option value="Social">Social</option></select></div>
                          <div><label style={labelStyle}>Special Program</label><input name="specialProgram" value={form.specialProgram} onChange={handleChange} style={fieldStyle} /></div>
                          <div><label style={labelStyle}>Language Option</label><input name="languageOption" value={form.languageOption} onChange={handleChange} style={fieldStyle} /></div>
                          <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Elective Subjects</label><input name="electiveSubjects" value={form.electiveSubjects} onChange={handleChange} style={fieldStyle} /></div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button type="button" onClick={() => goToNextStep(6)} style={{ border: "none", background: "#1d4ed8", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save & Next</button></div>
                      </>
                    )}
                  </div>

                  <div style={sectionCardStyle}>
                    <button type="button" onClick={() => handleStepOpen(7)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}><h3 style={sectionTitleStyle}>7) System Account Information {completedSteps[7] ? "✓" : ""}</h3></button>
                    {openStep === 7 && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                          <div><label style={labelStyle}>Username</label><input name="username" value={form.username} onChange={handleChange} style={fieldStyle} /></div>
                          <div>
                            <label style={labelStyle}>Temporary Password</label>
                            <div style={{ display: "flex", gap: 6 }}>
                              <input type="password" name="temporaryPassword" value={form.temporaryPassword} onChange={handleChange} style={fieldStyle} />
                              <button type="button" onClick={() => setForm((prev) => ({ ...prev, temporaryPassword: generateTemporaryPassword(8) }))} style={{ border: "1px solid #dbeafe", color: "#1d4ed8", background: "#fff", borderRadius: 8, padding: "0 10px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Generate</button>
                            </div>
                          </div>
                          <div><label style={labelStyle}>isActive</label><select name="isActive" value={form.isActive} onChange={handleChange} style={fieldStyle}><option value="true">true</option><option value="false">false</option></select></div>
                          <div><label style={labelStyle}>Role</label><input name="role" value="student" readOnly style={{ ...fieldStyle, background: "#eef2ff", fontWeight: 700 }} /></div>
                        </div>

                        <div style={{ marginTop: 14 }}>
                          <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: "#1f2937" }}>Parent System Account Information</h4>
                          {parents.map((parent, index) => (
                            <div key={`parent-system-${index}`} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, marginBottom: 10 }}>
                              <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, color: "#334155" }}>Parent/Guardian {index + 1}</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                                <div><label style={labelStyle}>Username</label><input value={parent.username || parent.parentId || ""} onChange={(e) => handleParentChange(index, "username", e.target.value)} style={fieldStyle} /></div>
                                <div>
                                  <label style={labelStyle}>Temporary Password</label>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <input value={parent.temporaryPassword || ""} onChange={(e) => handleParentChange(index, "temporaryPassword", e.target.value)} style={fieldStyle} />
                                    <button type="button" onClick={() => handleParentChange(index, "temporaryPassword", generateTemporaryPassword(8))} style={{ border: "1px solid #dbeafe", color: "#1d4ed8", background: "#fff", borderRadius: 8, padding: "0 10px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Generate</button>
                                  </div>
                                </div>
                                <div><label style={labelStyle}>isActive</label><select value={parent.isActive || "true"} onChange={(e) => handleParentChange(index, "isActive", e.target.value)} style={fieldStyle}><option value="true">true</option><option value="false">false</option></select></div>
                                <div><label style={labelStyle}>Role</label><input value={parent.role || "parent"} readOnly style={{ ...fieldStyle, background: "#eef2ff", fontWeight: 700 }} /></div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button
                            type="submit"
                            disabled={submitting}
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: "none", background: "#1d4ed8", color: "#fff", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.75 : 1 }}
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
  );
}
