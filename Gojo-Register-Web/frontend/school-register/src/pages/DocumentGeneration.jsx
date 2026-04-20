import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaBell,
  FaChartLine,
  FaChalkboardTeacher,
  FaChevronDown,
  FaCog,
  FaDownload,
  FaFacebookMessenger,
  FaFileAlt,
  FaHome,
  FaPrint,
  FaSearch,
  FaSignOutAlt,
  FaSyncAlt,
} from "react-icons/fa";
import axios from "axios";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { BACKEND_BASE } from "../config";
import RegisterSidebar from "../components/RegisterSidebar";
import ProfileAvatar from "../components/ProfileAvatar";
import { buildUserLookupFromNode, loadSchoolInfoNode, loadSchoolStudentsNode, loadSchoolUsersNode } from "../utils/registerData";
import { fetchCachedJson } from "../utils/rtdbCache";

const DOC_TYPES = {
  id_card: "Student ID Card",
  enrollment_letter: "Enrollment Letter",
  transfer_letter: "Transfer Letter",
  profile_report: "Student Profile Report",
  enrollment_certificate: "Certificate of Enrollment",
};

const cardStyle = {
  background: "var(--surface-panel)",
  border: "1px solid var(--border-soft)",
  borderRadius: 14,
  boxShadow: "var(--shadow-panel)",
};

const yearLabel = (key) => String(key || "").replace("_", "/");

const normalizeRows = (node) => {
  if (Array.isArray(node)) return node;
  if (node && typeof node === "object") return Object.values(node);
  return [];
};

const firstFilled = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const txt = String(value).trim();
    if (txt) return txt;
  }
  return "";
};

const getNameInitials = (value) => {
  const parts = String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return "GS";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
};

export default function DocumentGeneration() {
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
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  const [schoolInfo, setSchoolInfo] = useState({});
  const [currentAcademicYear, setCurrentAcademicYear] = useState("");
  const [studentsMap, setStudentsMap] = useState({});
  const [usersMap, setUsersMap] = useState({});
  const [yearHistoryMap, setYearHistoryMap] = useState({});

  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [documentType, setDocumentType] = useState("id_card");
  const [transferReason, setTransferReason] = useState("");
  const [previewReady, setPreviewReady] = useState(false);
  const [certificateNumber, setCertificateNumber] = useState("");
  const heroStyle = {
    maxWidth: 760,
    margin: "0 auto 12px",
    position: "relative",
    overflow: "hidden",
  };
  const inputShellStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid var(--input-border)",
    borderRadius: 8,
    padding: "8px 10px",
    background: "var(--input-bg)",
  };
  const selectStyle = {
    width: "100%",
    border: "1px solid var(--input-border)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    boxSizing: "border-box",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
  };
  const inputStyle = {
    width: "100%",
    border: "1px solid var(--input-border)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    boxSizing: "border-box",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
  };
  const secondaryButtonStyle = {
    border: "1px solid var(--border-soft)",
    background: "var(--surface-panel)",
    color: "var(--text-secondary)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 800,
  };

  const notify = (type, text) => setFeedback({ type, text });

  const loadData = async () => {
    if (!schoolCode) {
      notify("error", "Missing schoolCode in session. Please login again.");
      return;
    }

    setLoading(true);
    try {
      const [nextSchoolInfo, studentsData, usersNode, yearHistoryData] = await Promise.all([
        loadSchoolInfoNode({ rtdbBase: DB_URL }),
        loadSchoolStudentsNode({ rtdbBase: DB_URL }),
        loadSchoolUsersNode({ rtdbBase: DB_URL }),
        fetchCachedJson(`${DB_URL}/YearHistory.json`, { ttlMs: 60000 }).catch(() => ({})),
      ]);

      setSchoolInfo(nextSchoolInfo || {});
      setCurrentAcademicYear(String(nextSchoolInfo?.currentAcademicYear || "").trim());
      setStudentsMap(studentsData || {});
      setUsersMap(buildUserLookupFromNode(usersNode));
      setYearHistoryMap(yearHistoryData || {});
      notify("", "");
    } catch (err) {
      notify("error", err?.response?.data?.message || err?.message || "Failed to load document generation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [schoolCode]);

  const mergedStudents = useMemo(() => {
    const map = { ...(studentsMap || {}) };

    Object.values(yearHistoryMap || {}).forEach((yearNode) => {
      const studentsNode = (yearNode || {}).Students || {};
      Object.entries(studentsNode).forEach(([studentId, row]) => {
        if (!map[studentId]) map[studentId] = row || {};
      });
    });

    return map;
  }, [studentsMap, yearHistoryMap]);

  const studentList = useMemo(() => {
    const list = [];
    Object.entries(mergedStudents || {}).forEach(([studentId, row]) => {
      const s = row || {};
      const name =
        s.name ||
        [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ") ||
        s.basicStudentInformation?.name ||
        "Student";

      list.push({
        studentId,
        name,
        grade: firstFilled(s.grade, s.basicStudentInformation?.grade),
        section: String(firstFilled(s.section, s.basicStudentInformation?.section)).toUpperCase(),
        academicYear: firstFilled(s.academicYear, s.basicStudentInformation?.academicYear, currentAcademicYear),
        status: firstFilled(s.status, s.basicStudentInformation?.status, "active"),
        row: s,
      });
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [mergedStudents, currentAcademicYear]);

  const filteredStudents = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return studentList;
    return studentList.filter((s) => {
      return String(s.studentId).toLowerCase().includes(q)
        || String(s.name).toLowerCase().includes(q)
        || String(s.grade).toLowerCase().includes(q)
        || String(s.section).toLowerCase().includes(q);
    });
  }, [studentList, search]);

  const selectedStudent = useMemo(
    () => studentList.find((s) => s.studentId === selectedStudentId) || null,
    [studentList, selectedStudentId]
  );

  const attendanceSummary = useMemo(() => {
    const attendanceRows = normalizeRows(selectedStudent?.row?.attendance);
    if (!attendanceRows.length) return { present: 0, absent: 0, late: 0, total: 0 };

    let present = 0;
    let absent = 0;
    let late = 0;
    attendanceRows.forEach((a) => {
      const st = String(a?.status || a?.attendance_status || "").toLowerCase();
      if (st === "present") present += 1;
      else if (st === "late") late += 1;
      else absent += 1;
    });

    return {
      present,
      absent,
      late,
      total: attendanceRows.length,
    };
  }, [selectedStudent]);

  const academicRecords = useMemo(() => {
    const records = selectedStudent?.row?.records || {};
    return Object.entries(records)
      .map(([year, row]) => ({
        year,
        grade: firstFilled(row?.grade),
        section: firstFilled(row?.section),
        status: firstFilled(row?.status),
      }))
      .sort((a, b) => String(a.year).localeCompare(String(b.year)));
  }, [selectedStudent]);

  const parentInfo = useMemo(() => {
    const list = normalizeRows(selectedStudent?.row?.parentGuardianInformation?.parents);
    if (list.length > 0) return list;

    const fallback = selectedStudent?.row?.parents || {};
    return Object.entries(fallback).map(([parentId, link]) => ({
      parentId,
      relationship: link?.relationship || "Guardian",
      fullName: "",
      phone: "",
      email: "",
    }));
  }, [selectedStudent]);

  const schoolName = firstFilled(schoolInfo?.name, schoolInfo?.schoolName, "Gojo Academy");
  const schoolPhone = firstFilled(schoolInfo?.phone, schoolInfo?.phoneNumber, "");
  const schoolEmail = firstFilled(schoolInfo?.email, "");
  const schoolAddress = firstFilled(schoolInfo?.address, schoolInfo?.city, "");

  const selectedStudentPhotoUrl = useMemo(() => {
    if (!selectedStudent) return "";

    const row = selectedStudent.row || {};
    const users = usersMap || {};

    const userById = row.userId ? users[row.userId] : null;
    const userByStudentId = Object.values(users).find((u) => {
      return String(u?.role || "").toLowerCase() === "student"
        && (u?.studentId === selectedStudent.studentId || u?.username === selectedStudent.studentId);
    });

    const url = firstFilled(
      userById?.profileImage,
      userByStudentId?.profileImage,
      row.profileImage,
      row.basicStudentInformation?.studentPhoto,
      row.basicStudentInformation?.profileImage
    );

    return url === "/default-profile.png" ? "" : url;
  }, [selectedStudent, usersMap]);

  const loadImageAsDataUrl = async (url) => {
    if (!url) return "";
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  };

  const buildCertificateNumber = async () => {
    const year = String(new Date().getFullYear());
    const docsRes = await axios.get(`${DB_URL}/GeneratedDocuments.json`).catch(() => ({ data: {} }));
    const docs = docsRes.data || {};

    let maxSeq = 0;
    Object.values(docs).forEach((row) => {
      const cert = String(row?.certificateNumber || "");
      const m = cert.match(/^CERT-(\d{4})-(\d{5})$/);
      if (!m || m[1] !== year) return;
      const seq = Number(m[2]);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    });

    return `CERT-${year}-${String(maxSeq + 1).padStart(5, "0")}`;
  };

  const handleGeneratePreview = async () => {
    if (!selectedStudent) {
      notify("error", "Select a student first.");
      return;
    }

    if (documentType === "transfer_letter" && !transferReason.trim()) {
      notify("warning", "Please add transfer reason for transfer letter.");
      return;
    }

    if (documentType === "enrollment_certificate") {
      const cert = await buildCertificateNumber();
      setCertificateNumber(cert);
    }

    setPreviewReady(true);
    notify("success", `${DOC_TYPES[documentType]} preview generated.`);
  };

  const saveGeneratedMeta = async (fileName) => {
    if (!selectedStudent) return;
    const key = `${Date.now()}_${selectedStudent.studentId}`;
    await axios.patch(`${DB_URL}/GeneratedDocuments/${key}.json`, {
      key,
      schoolCode,
      studentId: selectedStudent.studentId,
      studentName: selectedStudent.name,
      documentType,
      documentName: DOC_TYPES[documentType],
      fileName,
      certificateNumber: certificateNumber || "",
      generatedBy: admin.adminId || admin.username || "registrar",
      generatedAt: new Date().toISOString(),
      academicYear: selectedStudent.academicYear || currentAcademicYear || "",
    }).catch(() => null);
  };

  const exportPdf = async () => {
    if (!selectedStudent) {
      notify("error", "Select a student first.");
      return;
    }
    if (!previewReady) {
      notify("warning", "Generate preview first.");
      return;
    }

    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const issueDate = new Date().toLocaleDateString();
      const academicYearText = yearLabel(selectedStudent.academicYear || currentAcademicYear);
      const fileName = `${documentType}_${selectedStudent.studentId}_${Date.now()}.pdf`;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const photoDataUrl = await loadImageAsDataUrl(selectedStudentPhotoUrl);
      const studentDob = firstFilled(selectedStudent.row?.dob, selectedStudent.row?.basicStudentInformation?.dob, "N/A");
      const schoolContact = schoolPhone || schoolEmail || "N/A";
      const studentReference = `GOJO/${new Date().getFullYear()}/${String(selectedStudent.studentId || "0000").slice(-4).padStart(4, "0")}`;
      const emergencyName = firstFilled(selectedStudent.row?.healthEmergency?.emergencyContactName, parentInfo?.[0]?.fullName, parentInfo?.[0]?.name, "N/A");
      const emergencyPhone = firstFilled(selectedStudent.row?.healthEmergency?.emergencyPhone, parentInfo?.[0]?.phone, "N/A");
      const bloodType = firstFilled(selectedStudent.row?.healthEmergency?.bloodType, "N/A");
      const addressText = firstFilled(
        selectedStudent.row?.addressInformation?.city,
        selectedStudent.row?.addressInformation?.region,
        schoolAddress,
        "N/A"
      );
      const issue = new Date();
      const validUntil = `${issue.getFullYear() + 1}-${String(issue.getMonth() + 1).padStart(2, "0")}-${String(issue.getDate()).padStart(2, "0")}`;
      const parents = parentInfo.length ? parentInfo : [{}];
      const records = academicRecords.length
        ? academicRecords
        : [{ year: selectedStudent.academicYear || currentAcademicYear, grade: selectedStudent.grade, section: selectedStudent.section, status: selectedStudent.status }];
      const certNo = documentType === "enrollment_certificate"
        ? (certificateNumber || await buildCertificateNumber())
        : "";

      if (documentType === "enrollment_certificate" && !certificateNumber) {
        setCertificateNumber(certNo);
      }

      const colors = {
        navy: [15, 23, 42],
        blue: [0, 122, 251],
        blueDeep: [0, 95, 204],
        teal: [0, 182, 169],
        slate: [51, 65, 85],
        muted: [100, 116, 139],
        line: [215, 231, 251],
        soft: [241, 248, 255],
        softAlt: [247, 251, 255],
        white: [255, 255, 255],
        greenSoft: [233, 251, 249],
        amber: [146, 64, 14],
        amberSoft: [255, 247, 237],
      };

      const setTextColor = (color) => doc.setTextColor(...color);
      const setDrawColor = (color) => doc.setDrawColor(...color);
      const setFillColor = (color) => doc.setFillColor(...color);
      const drawFormalHeader = ({ title, reference, subject }) => {
        setTextColor(colors.navy);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text(schoolName, 40, 56);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        setTextColor(colors.slate);
        const headerLines = [schoolAddress, schoolPhone, schoolEmail].filter(Boolean).join("   |   ");
        if (headerLines) {
          doc.text(doc.splitTextToSize(headerLines, pageWidth - 240), 40, 74);
        }

        setTextColor(colors.navy);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text(title, pageWidth / 2, 108, { align: "center" });

        setDrawColor(colors.navy);
        doc.setLineWidth(1.2);
        doc.line(40, 86, pageWidth - 40, 86);
        doc.setDrawColor(colors.line);
        doc.setLineWidth(1);
        doc.line(40, 118, pageWidth - 40, 118);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        setTextColor(colors.slate);
        doc.text(`Date: ${issueDate}`, pageWidth - 40, 56, { align: "right" });
        doc.text(`Reference: ${reference}`, pageWidth - 40, 72, { align: "right" });
        doc.text(`Prepared by: ${admin.name}`, pageWidth - 40, 88, { align: "right" });

        if (subject) {
          setTextColor(colors.navy);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11.5);
          doc.text(`Subject: ${subject}`, 40, 144);
          return 164;
        }

        return 138;
      };
      const drawFieldRows = (startY, rows, options = {}) => {
        const labelWidth = options.labelWidth || 130;
        const rowHeight = options.rowHeight || 22;
        const width = options.width || pageWidth - 80;
        const x = options.x || 40;

        rows.forEach(([label, value], index) => {
          const rowY = startY + index * rowHeight;
          if (index % 2 === 0) {
            setFillColor(colors.softAlt);
            doc.rect(x, rowY - 14, width, rowHeight, "F");
          }
          setTextColor(colors.muted);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text(label, x + 12, rowY);
          setTextColor(colors.slate);
          doc.setFont("helvetica", "normal");
          doc.text(String(value || "-"), x + labelWidth, rowY);
        });

        setDrawColor(colors.line);
        doc.rect(x, startY - 20, width, rows.length * rowHeight + 6);
        return startY + rows.length * rowHeight;
      };
      const drawSignatureLine = (x, y, width, label) => {
        setDrawColor(colors.muted);
        doc.line(x, y, x + width, y);
        setTextColor(colors.muted);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(label, x, y + 14);
      };

      if (documentType === "id_card") {
        const mmToPt = 2.834645669;
        const cardWidth = 85.6 * mmToPt;
        const cardHeight = 53.98 * mmToPt;
        const frontX = 36;
        const frontY = 140;
        const backX = frontX + cardWidth + 18;
        const topBandHeight = 30;
        const photoX = frontX + 14;
        const photoY = frontY + 42;
        const photoW = 44;
        const photoH = 54;
        const labelX = frontX + 66;
        const valueX = frontX + 125;

        [frontX, backX].forEach((cardX) => {
          setFillColor(colors.white);
          doc.roundedRect(cardX, frontY, cardWidth, cardHeight, 10, 10, "F");
          setDrawColor(colors.navy);
          doc.setLineWidth(1);
          doc.roundedRect(cardX, frontY, cardWidth, cardHeight, 10, 10);
        });

        setFillColor(colors.navy);
        doc.roundedRect(frontX, frontY, cardWidth, topBandHeight, 10, 10, "F");
        setTextColor(colors.white);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);
        doc.text(String(schoolName).toUpperCase(), frontX + 12, frontY + 13);
        doc.setFontSize(8.3);
        doc.text("STUDENT IDENTITY CARD", frontX + 12, frontY + 24);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text(studentReference, frontX + cardWidth - 12, frontY + 18, { align: "right" });

        setFillColor(colors.softAlt);
        doc.roundedRect(photoX, photoY, photoW, photoH, 7, 7, "F");
        setDrawColor(colors.line);
        doc.roundedRect(photoX, photoY, photoW, photoH, 7, 7);
        if (photoDataUrl) {
          const format = photoDataUrl.includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(photoDataUrl, format, photoX + 1.5, photoY + 1.5, photoW - 3, photoH - 3);
        } else {
          setTextColor(colors.muted);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.text(getNameInitials(selectedStudent.name), photoX + photoW / 2, photoY + 24, { align: "center" });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.2);
          doc.text("PHOTO", photoX + photoW / 2, photoY + 37, { align: "center" });
        }

        setTextColor(colors.navy);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(selectedStudent.name, labelX, frontY + 46);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.7);
        doc.text("ID NO.", labelX, frontY + 61);
        doc.text("GRADE", labelX, frontY + 74);
        doc.text("SECTION", labelX, frontY + 87);
        doc.text("ACADEMIC YEAR", labelX, frontY + 100);

        doc.setFont("helvetica", "bold");
        doc.text(String(selectedStudent.studentId), valueX, frontY + 61);
        doc.text(String(selectedStudent.grade || "-"), valueX, frontY + 74);
        doc.text(String(selectedStudent.section || "-"), valueX, frontY + 87);
        doc.text(academicYearText, valueX, frontY + 100);

        setDrawColor(colors.line);
        doc.line(frontX + 12, frontY + 108, frontX + cardWidth - 12, frontY + 108);
        setTextColor(colors.slate);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        doc.text(`Issued: ${issueDate}`, frontX + 12, frontY + 119);
        doc.text(`Valid until: ${validUntil}`, frontX + 12, frontY + 128);
        doc.text(`Contact: ${schoolContact}`, frontX + 12, frontY + 137);

        setFillColor(colors.navy);
        doc.roundedRect(backX, frontY, cardWidth, topBandHeight, 10, 10, "F");
        setTextColor(colors.white);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);
        doc.text(String(schoolName).toUpperCase(), backX + 12, frontY + 13);
        doc.setFontSize(8.3);
        doc.text("HOLDER INFORMATION", backX + 12, frontY + 24);

        setTextColor(colors.navy);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.7);
        doc.text("EMERGENCY CONTACT", backX + 12, frontY + 48);
        doc.text("PHONE", backX + 12, frontY + 62);
        doc.text("BLOOD TYPE", backX + 12, frontY + 76);
        doc.text("ADDRESS", backX + 12, frontY + 90);

        doc.setFont("helvetica", "bold");
        doc.text(String(emergencyName), backX + 88, frontY + 48);
        doc.text(String(emergencyPhone), backX + 88, frontY + 62);
        doc.text(String(bloodType), backX + 88, frontY + 76);
        doc.text(doc.splitTextToSize(addressText, cardWidth - 100), backX + 88, frontY + 90);

        setDrawColor(colors.line);
        doc.line(backX + 12, frontY + 108, backX + cardWidth - 12, frontY + 108);
        setTextColor(colors.slate);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.2);
        doc.text("If found, return to the school administration office.", backX + 12, frontY + 119);
        doc.setFont("helvetica", "normal");
        doc.text(schoolContact, backX + 12, frontY + 128);
        doc.text(studentReference, backX + cardWidth - 12, frontY + 128, { align: "right" });
      }

      if (documentType === "enrollment_letter") {
        const startY = drawFormalHeader({
          title: "ENROLLMENT LETTER",
          reference: studentReference,
          subject: `Confirmation of enrollment for ${selectedStudent.name}`,
        });

        doc.setTextColor(...colors.slate);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.text("To whom it may concern,", 40, startY + 18);

        const paragraph = doc.splitTextToSize(
          `This is to formally certify that ${selectedStudent.name}, identified by student ID ${selectedStudent.studentId}, is a currently enrolled student of ${schoolName}. According to the official register office record, the student is assigned to Grade ${selectedStudent.grade}${selectedStudent.section ? ` ${selectedStudent.section}` : ""} for the ${academicYearText} academic year.`,
          pageWidth - 80
        );
        doc.text(paragraph, 40, startY + 46);

        const detailsY = startY + 46 + paragraph.length * 16 + 24;
        drawFieldRows(detailsY + 20, [
          ["Student Name", selectedStudent.name],
          ["Student ID", selectedStudent.studentId],
          ["Grade and Section", `${selectedStudent.grade}${selectedStudent.section ? ` ${selectedStudent.section}` : ""}`],
          ["Academic Year", academicYearText],
          ["Status", selectedStudent.status],
        ]);

        const closingY = detailsY + 148;
        const closing = doc.splitTextToSize(
          "This letter is issued upon request for official educational and administrative use. All information herein is based on the current school register and is valid as of the date of issue.",
          pageWidth - 80
        );
        doc.text(closing, 40, closingY);

        const signY = closingY + closing.length * 16 + 56;
        drawSignatureLine(44, signY, 200, `Registrar: ${admin.name}`);
        drawSignatureLine(pageWidth - 244, signY, 200, "School stamp");
      }

      if (documentType === "transfer_letter") {
        const startY = drawFormalHeader({
          title: "TRANSFER LETTER",
          reference: studentReference,
          subject: `Transfer clearance for ${selectedStudent.name}`,
        });

        doc.setTextColor(...colors.slate);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.text("To whom it may concern,", 40, startY + 18);

        const intro = doc.splitTextToSize(
          `This letter confirms that ${selectedStudent.name}, student ID ${selectedStudent.studentId}, has been processed for transfer from ${schoolName}. The details below summarize the student's registered academic status and the stated reason for transfer.`,
          pageWidth - 80
        );
        doc.text(intro, 40, startY + 46);

        autoTable(doc, {
          startY: startY + 74,
          theme: "grid",
          head: [["Student", "ID", "Date of Birth", "Grade", "Academic Year"]],
          body: [[
            selectedStudent.name,
            selectedStudent.studentId,
            studentDob,
            `${selectedStudent.grade}${selectedStudent.section ? ` ${selectedStudent.section}` : ""}`,
            academicYearText,
          ]],
          headStyles: { fillColor: colors.navy, textColor: colors.white, fontStyle: "bold", fontSize: 10 },
          bodyStyles: { textColor: colors.slate, fontSize: 10 },
          styles: { lineColor: colors.line, lineWidth: 1 },
          margin: { left: 40, right: 40 },
        });

        const reasonY = (doc.lastAutoTable?.finalY || startY) + 18;
        setTextColor(colors.navy);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Transfer Reason", 40, reasonY + 4);
        setDrawColor(colors.line);
        doc.rect(40, reasonY + 12, pageWidth - 80, 64);
        setTextColor(colors.slate);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11.5);
        doc.text(doc.splitTextToSize(transferReason || "No transfer reason recorded.", pageWidth - 104), 52, reasonY + 34);

        autoTable(doc, {
          startY: reasonY + 94,
          theme: "grid",
          head: [["Academic Year", "Grade", "Section", "Status"]],
          body: records.map((r) => [yearLabel(r.year), r.grade || "-", r.section || "-", r.status || "-"]),
          headStyles: { fillColor: colors.blue, textColor: colors.white, fontStyle: "bold", fontSize: 10 },
          bodyStyles: { textColor: colors.slate, fontSize: 10 },
          alternateRowStyles: { fillColor: colors.softAlt },
          styles: { lineColor: colors.line, lineWidth: 1 },
          margin: { left: 40, right: 40 },
        });

        const noteY = (doc.lastAutoTable?.finalY || reasonY + 94) + 28;
        setTextColor(colors.slate);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(doc.splitTextToSize(`This transfer letter is prepared from the official academic and administrative records maintained by ${schoolName} and is issued for formal reference purposes.`, pageWidth - 88), 40, noteY);
        drawSignatureLine(40, noteY + 54, 200, "Registrar authorization");
      }

      if (documentType === "profile_report") {
        const startY = drawFormalHeader({
          title: "STUDENT PROFILE REPORT",
          reference: studentReference,
          subject: `Student record summary for ${selectedStudent.name}`,
        });

        const infoRows = [
          ["Student Name", selectedStudent.name],
          ["Student ID", selectedStudent.studentId],
          ["Grade and Section", `${selectedStudent.grade}${selectedStudent.section ? ` ${selectedStudent.section}` : ""}`],
          ["Academic Year", academicYearText],
          ["Date of Birth", studentDob],
          ["Status", selectedStudent.status],
          ["Address", addressText],
          ["Emergency Contact", `${emergencyName} (${emergencyPhone})`],
        ];
        drawFieldRows(startY + 20, infoRows, { rowHeight: 20 });

        autoTable(doc, {
          startY: startY + 208,
          theme: "grid",
          head: [["Attendance", "Count"]],
          body: [["Present", attendanceSummary.present], ["Absent", attendanceSummary.absent], ["Late", attendanceSummary.late], ["Total", attendanceSummary.total]],
          headStyles: { fillColor: colors.navy, textColor: colors.white, fontStyle: "bold", fontSize: 10 },
          bodyStyles: { textColor: colors.slate, fontSize: 10 },
          styles: { lineColor: colors.line, lineWidth: 1 },
          margin: { left: 40, right: pageWidth / 2 + 10 },
        });

        autoTable(doc, {
          startY: startY + 208,
          theme: "grid",
          head: [["Parent", "Relationship", "Phone", "Email"]],
          body: parents.map((p) => [
            firstFilled(p?.fullName, p?.name, "-"),
            firstFilled(p?.relationship, "-"),
            firstFilled(p?.phone, "-"),
            firstFilled(p?.email, "-"),
          ]),
          headStyles: { fillColor: colors.blue, textColor: colors.white, fontStyle: "bold", fontSize: 10 },
          bodyStyles: { textColor: colors.slate, fontSize: 10 },
          alternateRowStyles: { fillColor: colors.softAlt },
          styles: { lineColor: colors.line, lineWidth: 1 },
          margin: { left: pageWidth / 2 + 20, right: 40 },
        });

        autoTable(doc, {
          startY: Math.max(doc.lastAutoTable?.finalY || 0, startY + 318) + 20,
          theme: "grid",
          head: [["Academic Year", "Grade", "Section", "Status"]],
          body: records.map((r) => [yearLabel(r.year), r.grade || "-", r.section || "-", r.status || "-"]),
          headStyles: { fillColor: colors.teal, textColor: colors.white, fontStyle: "bold", fontSize: 10 },
          bodyStyles: { textColor: colors.slate, fontSize: 10 },
          alternateRowStyles: { fillColor: colors.softAlt },
          styles: { lineColor: colors.line, lineWidth: 1 },
          margin: { left: 40, right: 40 },
        });
      }

      if (documentType === "enrollment_certificate") {
        setDrawColor(colors.navy);
        doc.setLineWidth(1.5);
        doc.rect(34, 34, pageWidth - 68, pageHeight - 68);
        setDrawColor(colors.line);
        doc.rect(46, 46, pageWidth - 92, pageHeight - 92);

        setTextColor(colors.navy);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("OFFICIAL SCHOOL CERTIFICATE", pageWidth / 2, 82, { align: "center" });
        doc.setFontSize(28);
        doc.text(schoolName, pageWidth / 2, 122, { align: "center" });
        doc.setFontSize(22);
        doc.text("CERTIFICATE OF ENROLLMENT", pageWidth / 2, 156, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11.5);
        doc.text(`Certificate No. ${certNo}`, pageWidth / 2, 188, { align: "center" });
        doc.text(`Issued on ${issueDate}`, pageWidth / 2, 206, { align: "center" });

        setTextColor(colors.slate);
        doc.setFontSize(14);
        const certificateLines = doc.splitTextToSize(
          `This is to certify that ${selectedStudent.name}, bearing student identification number ${selectedStudent.studentId}, is officially enrolled at ${schoolName} in Grade ${selectedStudent.grade}${selectedStudent.section ? ` ${selectedStudent.section}` : ""} for the ${academicYearText} academic year. This certificate is issued by the school register office for official use and verification.`,
          430
        );
        doc.text(certificateLines, pageWidth / 2, 286, { align: "center" });

        autoTable(doc, {
          startY: 390,
          theme: "grid",
          head: [["Student", "Student ID", "Academic Year", "Reference"]],
          body: [[selectedStudent.name, selectedStudent.studentId, academicYearText, studentReference]],
          headStyles: { fillColor: colors.navy, textColor: colors.white, fontStyle: "bold", fontSize: 10 },
          bodyStyles: { textColor: colors.slate, fontSize: 10, halign: "center" },
          styles: { lineColor: colors.line, lineWidth: 1 },
          margin: { left: 92, right: 92 },
        });

        drawSignatureLine(88, 620, 180, `Registrar: ${admin.name}`);
        setDrawColor(colors.line);
        doc.rect(pageWidth - 250, 572, 150, 70);
        setTextColor(colors.muted);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text("School stamp area", pageWidth - 175, 612, { align: "center" });
      }

      doc.save(fileName);
      await saveGeneratedMeta(fileName);
      notify("success", `${DOC_TYPES[documentType]} exported as PDF.`);
    } catch (err) {
      notify("error", err?.message || "Failed to export PDF.");
    } finally {
      setGenerating(false);
    }
  };

  const printPreview = () => {
    const section = document.getElementById("doc-preview-area");
    if (!section) {
      notify("warning", "Generate preview first.");
      return;
    }

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>${DOC_TYPES[documentType]}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
            .box { border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; }
            h2,h3,p { margin: 0 0 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; font-size: 12px; }
          </style>
        </head>
        <body>${section.innerHTML}</body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  const renderPreview = () => {
    if (!selectedStudent) return null;

    const academicYearText = yearLabel(selectedStudent.academicYear || currentAcademicYear);
    const issueDateText = new Date().toLocaleDateString();
    const issue = new Date();
    const validUntil = `${issue.getFullYear() + 1}-${String(issue.getMonth() + 1).padStart(2, "0")}-${String(issue.getDate()).padStart(2, "0")}`;
    const studentDob = firstFilled(selectedStudent.row?.dob, selectedStudent.row?.basicStudentInformation?.dob, "N/A");
    const emergencyName = firstFilled(selectedStudent.row?.healthEmergency?.emergencyContactName, parentInfo?.[0]?.fullName, parentInfo?.[0]?.name, "N/A");
    const emergencyPhone = firstFilled(selectedStudent.row?.healthEmergency?.emergencyPhone, parentInfo?.[0]?.phone, "N/A");
    const bloodType = firstFilled(selectedStudent.row?.healthEmergency?.bloodType, "N/A");
    const addressText = firstFilled(
      selectedStudent.row?.addressInformation?.city,
      selectedStudent.row?.addressInformation?.region,
      schoolAddress,
      "N/A"
    );
    const studentReference = `GOJO/${new Date().getFullYear()}/${String(selectedStudent.studentId || "0000").slice(-4).padStart(4, "0")}`;
    const previewPaperStyle = {
      background: "#ffffff",
      border: "1px solid #cbd5e1",
      borderRadius: 10,
      padding: 32,
      boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
      color: "#0f172a",
    };
    const previewHeadingStyle = {
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#0f172a",
      marginBottom: 10,
    };
    const tableHeaderCellStyle = {
      border: "1px solid #d7e7fb",
      padding: "8px 10px",
      textAlign: "left",
      fontSize: 11,
      fontWeight: 800,
      color: "#0f172a",
      background: "#F1F8FF",
    };
    const tableCellStyle = {
      border: "1px solid #d7e7fb",
      padding: "8px 10px",
      textAlign: "left",
      fontSize: 11,
      color: "#334155",
      verticalAlign: "top",
    };
    const summaryCardStyle = {
      border: "1px solid #cbd5e1",
      borderRadius: 6,
      padding: "12px 14px",
      background: "#ffffff",
    };
    const letterHeaderStyle = {
      display: "flex",
      justifyContent: "space-between",
      gap: 18,
      flexWrap: "wrap",
      paddingBottom: 14,
      borderBottom: "2px solid #0f172a",
      marginBottom: 18,
    };
    const letterMetaStyle = {
      minWidth: 240,
      fontSize: 12,
      color: "#475569",
      lineHeight: 1.7,
      textAlign: "right",
    };
    const letterInfoRowStyle = {
      display: "grid",
      gridTemplateColumns: "180px 1fr",
      borderBottom: "1px solid #e2e8f0",
    };
    const letterLabelStyle = {
      padding: "10px 12px",
      fontSize: 12,
      fontWeight: 800,
      color: "#475569",
      background: "#f8fafc",
    };
    const letterValueStyle = {
      padding: "10px 12px",
      fontSize: 12,
      color: "#0f172a",
    };

    if (documentType === "id_card") {
      const previewCardWidth = 400;
      const previewCardHeight = Math.round((previewCardWidth * 53.98) / 85.6);

      return (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
          <div style={{ width: previewCardWidth, height: previewCardHeight, borderRadius: 16, overflow: "hidden", background: "#ffffff", border: "1px solid #0f172a", boxShadow: "0 10px 16px rgba(15, 23, 42, 0.08)", position: "relative" }}>
            <div style={{ position: "absolute", inset: "0 0 auto 0", height: 34, background: "#0f172a" }} />

            <div style={{ position: "relative", height: "100%", padding: 14, display: "grid", gridTemplateColumns: "68px 1fr", gap: 12 }}>
              <div style={{ marginTop: 30, width: 68, height: 84, borderRadius: 8, overflow: "hidden", border: "1px solid #cbd5e1", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 16, fontWeight: 800 }}>
                {selectedStudentPhotoUrl ? (
                  <img src={selectedStudentPhotoUrl} alt={`${selectedStudent.name} profile`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : getNameInitials(selectedStudent.name)}
              </div>

              <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginTop: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 7.8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#ffffff" }}>Gojo Education Authority</div>
                    <div style={{ marginTop: 2, fontSize: 8.4, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#ffffff" }}>Student Identity Card</div>
                    <div style={{ marginTop: 12, fontSize: 18, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{schoolName}</div>
                  </div>
                  <div style={{ padding: "4px 8px", borderRadius: 8, background: "#f8fafc", border: "1px solid #cbd5e1", color: "#334155", fontSize: 8.2, fontWeight: 800 }}>
                    {studentReference}
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "grid", gap: 7 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "58px 1fr", gap: 8, alignItems: "baseline", paddingBottom: 5, borderBottom: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 8, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Name</div>
                    <div style={{ fontSize: 13.5, color: "#0f172a", fontWeight: 800, lineHeight: 1.2 }}>{selectedStudent.name}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "58px 1fr", gap: 8, alignItems: "baseline", paddingBottom: 5, borderBottom: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 8, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>ID No.</div>
                    <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 800 }}>{selectedStudent.studentId}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "58px 1fr", gap: 8, alignItems: "baseline", paddingBottom: 5, borderBottom: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 8, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Grade</div>
                    <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 800 }}>{selectedStudent.grade}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "58px 1fr", gap: 8, alignItems: "baseline", paddingBottom: 5, borderBottom: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 8, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Section</div>
                    <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 800 }}>{selectedStudent.section || "-"}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "58px 1fr", gap: 8, alignItems: "baseline", paddingBottom: 5, borderBottom: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 8, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Year</div>
                    <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 800 }}>{academicYearText}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "58px 1fr", gap: 8, alignItems: "baseline" }}>
                    <div style={{ fontSize: 8, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Valid</div>
                    <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 800 }}>{validUntil}</div>
                  </div>
                </div>

                <div style={{ marginTop: "auto", borderTop: "1px solid #e2e8f0", paddingTop: 7, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 8.3, color: "#64748b", lineHeight: 1.55 }}>
                    Issued: {issueDateText}
                    <br />
                    Contact: {schoolPhone || schoolEmail || "N/A"}
                  </div>
                  <div style={{ fontSize: 8.3, color: "#334155", fontWeight: 800, textTransform: "uppercase" }}>
                    Active
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ width: previewCardWidth, height: previewCardHeight, borderRadius: 16, overflow: "hidden", background: "#ffffff", border: "1px solid #0f172a", boxShadow: "0 10px 16px rgba(15, 23, 42, 0.08)", position: "relative" }}>
            <div style={{ position: "absolute", inset: "0 0 auto 0", height: 34, background: "#0f172a" }} />

            <div style={{ position: "relative", height: "100%", padding: 16, display: "flex", flexDirection: "column" }}>
              <div style={{ marginTop: 8, fontSize: 7.8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#ffffff" }}>Gojo Education Authority</div>
              <div style={{ marginTop: 2, fontSize: 8.4, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#ffffff" }}>Holder Information</div>
              <div style={{ marginTop: 12, fontSize: 18, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.03em" }}>{schoolName}</div>

              <div style={{ marginTop: 12, display: "grid", gap: 7 }}>
                <div style={{ display: "grid", gridTemplateColumns: "76px 1fr", gap: 8, alignItems: "baseline", paddingBottom: 5, borderBottom: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 8, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Emergency</div>
                  <div style={{ fontSize: 12.8, fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>{emergencyName}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "76px 1fr", gap: 8, alignItems: "baseline", paddingBottom: 5, borderBottom: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 8, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Phone</div>
                  <div style={{ fontSize: 12.8, fontWeight: 800, color: "#0f172a" }}>{emergencyPhone}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "76px 1fr", gap: 8, alignItems: "baseline", paddingBottom: 5, borderBottom: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 8, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Blood Type</div>
                  <div style={{ fontSize: 12.8, fontWeight: 800, color: "#0f172a" }}>{bloodType}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "76px 1fr", gap: 8, alignItems: "baseline", paddingBottom: 5, borderBottom: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 8, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Address</div>
                  <div style={{ fontSize: 11.8, fontWeight: 700, color: "#0f172a", lineHeight: 1.35 }}>{addressText}</div>
                </div>
              </div>

              <div style={{ marginTop: 10, borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
                <div style={{ fontSize: 8, fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>Return Notice</div>
                <div style={{ marginTop: 5, fontSize: 10.2, color: "#475569", lineHeight: 1.55 }}>
                  If found, please return this card to the school administration office. This card remains the property of {schoolName}.
                </div>
              </div>

              <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end", borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
                <div style={{ fontSize: 8.3, color: "#64748b", lineHeight: 1.55 }}>
                  {schoolPhone || schoolEmail || "Contact not provided"}
                  <br />
                  Ref {studentReference}
                </div>
                <div style={{ width: 88, borderTop: "1px solid #94a3b8", paddingTop: 4, fontSize: 8.5, color: "#64748b" }}>
                  School stamp
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (documentType === "enrollment_letter") {
      return (
        <div style={{ ...previewPaperStyle, maxWidth: 840, margin: "0 auto" }}>
          <div style={letterHeaderStyle}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: "#0f172a" }}>{schoolName}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, maxWidth: 460, lineHeight: 1.6 }}>
                {[schoolAddress, schoolPhone, schoolEmail].filter(Boolean).join(" | ") || "School contact information"}
              </div>
              <div style={{ marginTop: 18, fontSize: 18, fontWeight: 800, letterSpacing: "0.06em", color: "#0f172a" }}>ENROLLMENT LETTER</div>
            </div>
            <div style={letterMetaStyle}>
              <div>Date: {issueDateText}</div>
              <div>Reference: {studentReference}</div>
              <div>Prepared by: {admin.name}</div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.8 }}>
            <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Subject: Confirmation of enrollment for {selectedStudent.name}</div>
            <div>To whom it may concern,</div>
            <div style={{ marginTop: 14 }}>
              This is to formally certify that <strong style={{ color: "#0f172a" }}>{selectedStudent.name}</strong>, identified by student ID <strong style={{ color: "#0f172a" }}>{selectedStudent.studentId}</strong>, is a currently enrolled student of <strong style={{ color: "#0f172a" }}>{schoolName}</strong>. According to the official register office record, the student is assigned to <strong style={{ color: "#0f172a" }}>Grade {selectedStudent.grade}{selectedStudent.section ? ` ${selectedStudent.section}` : ""}</strong> for the <strong style={{ color: "#0f172a" }}>{academicYearText}</strong> academic year.
            </div>
          </div>

          <div style={{ marginTop: 22, border: "1px solid #cbd5e1" }}>
            {[
              ["Student Name", selectedStudent.name],
              ["Student ID", selectedStudent.studentId],
              ["Grade and Section", `Grade ${selectedStudent.grade}${selectedStudent.section ? ` ${selectedStudent.section}` : ""}`],
              ["Academic Year", academicYearText],
              ["Status", selectedStudent.status],
            ].map(([label, value]) => (
              <div key={label} style={letterInfoRowStyle}>
                <div style={letterLabelStyle}>{label}</div>
                <div style={letterValueStyle}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, fontSize: 13, color: "#334155", lineHeight: 1.8 }}>
            This letter is issued upon request for official educational and administrative use. All information herein is based on the current school register and is valid as of the date of issue.
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 42, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>
              Issued by the school register office.
            </div>
            <div style={{ width: 220, borderTop: "1px solid #94a3b8", paddingTop: 8, fontSize: 12, color: "#334155" }}>
              Registrar: {admin.name}
            </div>
          </div>
        </div>
      );
    }

    if (documentType === "transfer_letter") {
      const transferRecords = academicRecords.length
        ? academicRecords
        : [{ year: selectedStudent.academicYear || currentAcademicYear, grade: selectedStudent.grade, section: selectedStudent.section, status: selectedStudent.status }];

      return (
        <div style={{ ...previewPaperStyle, maxWidth: 860, margin: "0 auto" }}>
          <div style={letterHeaderStyle}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: "#0f172a" }}>{schoolName}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, maxWidth: 460, lineHeight: 1.6 }}>
                {[schoolAddress, schoolPhone, schoolEmail].filter(Boolean).join(" | ") || "School contact information"}
              </div>
              <div style={{ marginTop: 18, fontSize: 18, fontWeight: 800, letterSpacing: "0.06em", color: "#0f172a" }}>TRANSFER LETTER</div>
            </div>
            <div style={letterMetaStyle}>
              <div>Date: {issueDateText}</div>
              <div>Reference: {studentReference}</div>
              <div>Prepared by: {admin.name}</div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.8 }}>
            <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Subject: Transfer clearance for {selectedStudent.name}</div>
            <div>To whom it may concern,</div>
            <div style={{ marginTop: 14 }}>
              This letter confirms that <strong style={{ color: "#0f172a" }}>{selectedStudent.name}</strong>, student ID <strong style={{ color: "#0f172a" }}>{selectedStudent.studentId}</strong>, has been processed for transfer from <strong style={{ color: "#0f172a" }}>{schoolName}</strong>. The following information summarizes the student's registered academic status and the stated reason for transfer.
            </div>
          </div>

          <div style={{ marginTop: 22, border: "1px solid #cbd5e1" }}>
            {[
              ["Student Name", selectedStudent.name],
              ["Student ID", selectedStudent.studentId],
              ["Date of Birth", studentDob],
              ["Grade and Section", `Grade ${selectedStudent.grade}${selectedStudent.section ? ` ${selectedStudent.section}` : ""}`],
              ["Academic Year", academicYearText],
            ].map(([label, value]) => (
              <div key={label} style={letterInfoRowStyle}>
                <div style={letterLabelStyle}>{label}</div>
                <div style={letterValueStyle}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={previewHeadingStyle}>Transfer Reason</div>
            <div style={{ border: "1px solid #cbd5e1", padding: "14px 16px", fontSize: 13, color: "#334155", lineHeight: 1.8 }}>
              {transferReason || "No transfer reason recorded."}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={previewHeadingStyle}>Academic History</div>
            <table style={{ width: "100%", borderCollapse: "collapse", overflow: "hidden", borderRadius: 16 }}>
              <thead>
                <tr>
                  <th style={tableHeaderCellStyle}>Academic Year</th>
                  <th style={tableHeaderCellStyle}>Grade</th>
                  <th style={tableHeaderCellStyle}>Section</th>
                  <th style={tableHeaderCellStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {transferRecords.map((r) => (
                  <tr key={`${r.year}_${r.grade}_${r.section}`}>
                    <td style={tableCellStyle}>{yearLabel(r.year)}</td>
                    <td style={tableCellStyle}>{r.grade || "-"}</td>
                    <td style={tableCellStyle}>{r.section || "-"}</td>
                    <td style={tableCellStyle}>{r.status || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, maxWidth: 460 }}>
              This transfer letter is prepared from the official academic and administrative records maintained by {schoolName} and is issued for formal reference purposes.
            </div>
            <div style={{ width: 220, borderTop: "1px solid #94a3b8", paddingTop: 8, fontSize: 12, color: "#334155" }}>
              Registrar authorization
            </div>
          </div>
        </div>
      );
    }

    if (documentType === "profile_report") {
      const parents = parentInfo.length ? parentInfo : [{}];
      const records = academicRecords.length ? academicRecords : [{ year: selectedStudent.academicYear || currentAcademicYear, grade: selectedStudent.grade, section: selectedStudent.section, status: selectedStudent.status }];

      return (
        <div style={{ ...previewPaperStyle, maxWidth: 920, margin: "0 auto" }}>
          <div style={letterHeaderStyle}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: "#0f172a" }}>{schoolName}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, maxWidth: 460, lineHeight: 1.6 }}>
                {[schoolAddress, schoolPhone, schoolEmail].filter(Boolean).join(" | ") || "School contact information"}
              </div>
              <div style={{ marginTop: 18, fontSize: 18, fontWeight: 800, letterSpacing: "0.06em", color: "#0f172a" }}>STUDENT PROFILE REPORT</div>
            </div>
            <div style={letterMetaStyle}>
              <div>Date: {issueDateText}</div>
              <div>Reference: {studentReference}</div>
              <div>Prepared by: {admin.name}</div>
            </div>
          </div>

          <div style={{ border: "1px solid #cbd5e1" }}>
            {[
              ["Student Name", selectedStudent.name],
              ["Student ID", selectedStudent.studentId],
              ["Grade and Section", `Grade ${selectedStudent.grade}${selectedStudent.section ? ` ${selectedStudent.section}` : ""}`],
              ["Academic Year", academicYearText],
              ["Date of Birth", studentDob],
              ["Status", selectedStudent.status],
              ["Address", addressText],
              ["Emergency Contact", `${emergencyName} (${emergencyPhone})`],
            ].map(([label, value]) => (
              <div key={label} style={letterInfoRowStyle}>
                <div style={letterLabelStyle}>{label}</div>
                <div style={letterValueStyle}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "0.62fr 1.38fr", gap: 16 }}>
            <div>
              <div style={previewHeadingStyle}>Attendance Summary</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={tableHeaderCellStyle}>Attendance</th>
                    <th style={tableHeaderCellStyle}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Present", attendanceSummary.present],
                    ["Absent", attendanceSummary.absent],
                    ["Late", attendanceSummary.late],
                    ["Total", attendanceSummary.total],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td style={tableCellStyle}>{label}</td>
                      <td style={tableCellStyle}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div style={previewHeadingStyle}>Parent And Guardian Information</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={tableHeaderCellStyle}>Name</th>
                    <th style={tableHeaderCellStyle}>Relationship</th>
                    <th style={tableHeaderCellStyle}>Phone</th>
                    <th style={tableHeaderCellStyle}>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {parents.map((p, idx) => (
                    <tr key={`${p?.parentId || "parent"}_${idx}`}>
                      <td style={tableCellStyle}>{firstFilled(p?.fullName, p?.name, "-")}</td>
                      <td style={tableCellStyle}>{firstFilled(p?.relationship, "-")}</td>
                      <td style={tableCellStyle}>{firstFilled(p?.phone, "-")}</td>
                      <td style={tableCellStyle}>{firstFilled(p?.email, "-")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={previewHeadingStyle}>Academic history</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={tableHeaderCellStyle}>Academic Year</th>
                  <th style={tableHeaderCellStyle}>Grade</th>
                  <th style={tableHeaderCellStyle}>Section</th>
                  <th style={tableHeaderCellStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={`${r.year}_${r.grade}_${r.section}`}>
                    <td style={tableCellStyle}>{yearLabel(r.year)}</td>
                    <td style={tableCellStyle}>{r.grade || "-"}</td>
                    <td style={tableCellStyle}>{r.section || "-"}</td>
                    <td style={tableCellStyle}>{r.status || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    const certNo = certificateNumber || "CERT-YYYY-00001";
    return (
      <div style={{ ...previewPaperStyle, maxWidth: 900, margin: "0 auto", border: "2px solid #0f172a", position: "relative" }}>
        <div style={{ border: "1px solid #cbd5e1", padding: 22 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#0f172a", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>Official School Certificate</div>
            <div style={{ marginTop: 10, fontSize: 34, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.05em" }}>{schoolName}</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 800, color: "#0f172a", letterSpacing: "0.04em" }}>CERTIFICATE OF ENROLLMENT</div>
            <div style={{ marginTop: 14, fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
              Certificate No. {certNo}
              <br />
              Issued on {issueDateText}
            </div>
          </div>

          <div style={{ marginTop: 34, textAlign: "center", fontSize: 16, lineHeight: 1.9, color: "#334155", maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
            This is to certify that <strong style={{ color: "#0f172a" }}>{selectedStudent.name}</strong>, bearing student identification number <strong style={{ color: "#0f172a" }}>{selectedStudent.studentId}</strong>, is officially enrolled at <strong style={{ color: "#0f172a" }}>{schoolName}</strong> in <strong style={{ color: "#0f172a" }}>Grade {selectedStudent.grade}{selectedStudent.section ? ` ${selectedStudent.section}` : ""}</strong> for the <strong style={{ color: "#0f172a" }}>{academicYearText}</strong> academic year. This certificate is issued by the school register office for official use and verification.
          </div>

          <div style={{ marginTop: 28 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={tableHeaderCellStyle}>Student</th>
                  <th style={tableHeaderCellStyle}>Student ID</th>
                  <th style={tableHeaderCellStyle}>Academic Year</th>
                  <th style={tableHeaderCellStyle}>Reference</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tableCellStyle}>{selectedStudent.name}</td>
                  <td style={tableCellStyle}>{selectedStudent.studentId}</td>
                  <td style={tableCellStyle}>{academicYearText}</td>
                  <td style={tableCellStyle}>{studentReference}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 42, display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ width: 220, borderTop: "1px solid #94a3b8", paddingTop: 8, fontSize: 12, color: "#334155" }}>
              Registrar: {admin.name}
            </div>
            <div style={{ width: 220, height: 76, border: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#64748b" }}>
              School stamp area
            </div>
        </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-page" style={{ background: "var(--page-bg)", minHeight: "100vh" }}>
      <nav className="top-navbar" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface-panel)" }}>
        <h2 style={{ color: "var(--text-primary)", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>
        <div className="nav-right">
          <Link className="icon-circle" to="/dashboard"><FaBell /></Link>
          <Link className="icon-circle" to="/all-chat"><FaFacebookMessenger /></Link>
          <ProfileAvatar imageUrl={admin.profileImage} name={admin.name} size={38} className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px" }}>
        <RegisterSidebar user={admin} sticky fullHeight />

        <div className="main-content google-main" style={{ padding: "10px 20px 20px", flex: 1, minWidth: 0, boxSizing: "border-box" }}>
          <div className="section-header-card" style={heroStyle}>
            <div className="section-header-card__title" style={{ fontSize: 17 }}>Document Generation System</div>
            <div className="section-header-card__subtitle">Generate official school documents in one click: preview, export PDF, print.</div>
          </div>

          <div style={{ maxWidth: 980, margin: "0 auto", ...cardStyle, padding: 16 }}>
            {feedback.text ? (
              <div style={{ marginBottom: 12, color: feedback.type === "error" ? "#b91c1c" : feedback.type === "warning" ? "#92400e" : "#166534", background: feedback.type === "error" ? "#fff1f2" : feedback.type === "warning" ? "#fffbeb" : "#ecfdf3", border: `1px solid ${feedback.type === "error" ? "#fecdd3" : feedback.type === "warning" ? "#fde68a" : "#86efac"}`, borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 700 }}>
                {feedback.text}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Search Student</label>
                  <div style={inputShellStyle}>
                    <FaSearch style={{ color: "var(--text-muted)" }} />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, grade, section" style={{ border: "none", outline: "none", width: "100%", fontSize: 13 }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Select Student</label>
                  <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} style={selectStyle}>
                    <option value="">Choose student</option>
                    {filteredStudents.map((s) => (
                      <option key={s.studentId} value={s.studentId}>
                        {s.name} ({s.studentId}) - G{s.grade}{s.section ? ` ${s.section}` : ""}
                      </option>
                    ))}
                  </select>
                  <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                    Showing {filteredStudents.length} of {studentList.length}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Document Type</label>
                  <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} style={selectStyle}>
                    {Object.entries(DOC_TYPES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {documentType === "transfer_letter" ? (
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Transfer Reason</label>
                    <input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="Reason for transfer" style={inputStyle} />
                  </div>
                ) : <div />}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={handleGeneratePreview} disabled={loading || !selectedStudentId} style={{ border: "1px solid #1d4ed8", background: "#1d4ed8", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 800, cursor: loading || !selectedStudentId ? "not-allowed" : "pointer", opacity: loading || !selectedStudentId ? 0.65 : 1 }}>
                  Generate
                </button>
                <button onClick={exportPdf} disabled={generating || !previewReady || !selectedStudentId} style={{ border: "1px solid #0f766e", background: "#0f766e", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 800, cursor: generating || !previewReady || !selectedStudentId ? "not-allowed" : "pointer", opacity: generating || !previewReady || !selectedStudentId ? 0.65 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <FaDownload /> {generating ? "Exporting..." : "Download PDF"}
                </button>
                <button onClick={printPreview} disabled={!previewReady || !selectedStudentId} style={{ ...secondaryButtonStyle, cursor: !previewReady || !selectedStudentId ? "not-allowed" : "pointer", opacity: !previewReady || !selectedStudentId ? 0.65 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <FaPrint /> Print
                </button>
              </div>

              <div id="doc-preview-area" style={{ marginTop: 6, border: "1px solid var(--border-soft)", borderRadius: 12, padding: 14, background: "var(--surface-muted)", minHeight: 180 }}>
                {previewReady && selectedStudent ? renderPreview() : (
                  <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Preview area. Select student and click Generate.</div>
                )}
              </div>

              <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
                School: {schoolName} {schoolAddress ? `| ${schoolAddress}` : ""} {schoolPhone ? `| ${schoolPhone}` : ""} {schoolEmail ? `| ${schoolEmail}` : ""}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
