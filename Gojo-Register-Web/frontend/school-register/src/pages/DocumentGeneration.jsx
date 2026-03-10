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
    background: "linear-gradient(135deg, var(--accent-strong), var(--accent))",
    color: "#fff",
    borderRadius: 14,
    padding: "12px 14px",
    boxShadow: "var(--shadow-glow)",
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
      const [schoolInfoRes, currentYearRes, studentsRes, usersRes, yearHistoryRes] = await Promise.all([
        axios.get(`${DB_URL}/schoolInfo.json`).catch(() => ({ data: {} })),
        axios.get(`${DB_URL}/schoolInfo/currentAcademicYear.json`).catch(() => ({ data: "" })),
        axios.get(`${DB_URL}/Students.json`).catch(() => ({ data: {} })),
        axios.get(`${DB_URL}/Users.json`).catch(() => ({ data: {} })),
        axios.get(`${DB_URL}/YearHistory.json`).catch(() => ({ data: {} })),
      ]);

      setSchoolInfo(schoolInfoRes.data || {});
      setCurrentAcademicYear(String(currentYearRes.data || "").trim());
      setStudentsMap(studentsRes.data || {});
      setUsersMap(usersRes.data || {});
      setYearHistoryMap(yearHistoryRes.data || {});
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
      const title = DOC_TYPES[documentType];
      const fileName = `${documentType}_${selectedStudent.studentId}_${Date.now()}.pdf`;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(schoolName, 40, 46);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`${title}`, 40, 68);
      doc.text(`Issue Date: ${issueDate}`, 40, 86);
      doc.text(`Registrar: ${admin.name}`, 40, 104);

      if (documentType === "id_card") {
        const mmToPt = 2.834645669;
        const standardIdWidthPt = 85.6 * mmToPt;
        const standardIdHeightPt = 53.98 * mmToPt;
        const idCardX = 40;
        const idCardY = 130;
        const idCardW = standardIdWidthPt;
        const idCardH = standardIdHeightPt;
        const cardGap = 16;
        const backCardX = idCardX + idCardW + cardGap;
        const backCardY = idCardY;
        const headerH = 28;
        const photoDataUrl = await loadImageAsDataUrl(selectedStudentPhotoUrl);
        const issue = new Date();
        const validUntil = `${issue.getFullYear() + 1}-${String(issue.getMonth() + 1).padStart(2, "0")}-${String(issue.getDate()).padStart(2, "0")}`;
        const emergencyName = firstFilled(selectedStudent.row?.healthEmergency?.emergencyContactName, parentInfo?.[0]?.fullName, parentInfo?.[0]?.name, "N/A");
        const emergencyPhone = firstFilled(selectedStudent.row?.healthEmergency?.emergencyPhone, parentInfo?.[0]?.phone, "N/A");
        const bloodType = firstFilled(selectedStudent.row?.healthEmergency?.bloodType, "N/A");
        const addressText = firstFilled(
          selectedStudent.row?.addressInformation?.city,
          selectedStudent.row?.addressInformation?.region,
          schoolAddress,
          "N/A"
        );

        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(1);
        doc.roundedRect(idCardX, idCardY, idCardW, idCardH, 8, 8);

        doc.setFillColor(30, 58, 138);
        doc.roundedRect(idCardX, idCardY, idCardW, headerH, 8, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text(schoolName, idCardX + 10, idCardY + 14);
        doc.setFontSize(7.5);
        doc.text("OFFICIAL STUDENT IDENTIFICATION CARD", idCardX + 10, idCardY + 24);

        doc.setTextColor(15, 23, 42);
        doc.setDrawColor(203, 213, 225);
        doc.rect(idCardX + 10, idCardY + 36, 50, 62);
        if (photoDataUrl) {
          const format = photoDataUrl.includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(photoDataUrl, format, idCardX + 11.5, idCardY + 37.5, 47, 59);
        } else {
          doc.setFontSize(7);
          doc.text("PHOTO", idCardX + 23, idCardY + 70);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(`Name: ${selectedStudent.name}`, idCardX + 66, idCardY + 46);
        doc.setFont("helvetica", "normal");
        doc.text(`Student ID: ${selectedStudent.studentId}`, idCardX + 66, idCardY + 58);
        doc.text(`Grade/Section: ${selectedStudent.grade}${selectedStudent.section ? ` ${selectedStudent.section}` : ""}`, idCardX + 66, idCardY + 70);
        doc.text(`Academic Year: ${yearLabel(selectedStudent.academicYear || currentAcademicYear)}`, idCardX + 66, idCardY + 82);
        doc.text(`Status: ${selectedStudent.status}`, idCardX + 66, idCardY + 94);

        doc.setDrawColor(226, 232, 240);
        doc.line(idCardX + 10, idCardY + 108, idCardX + idCardW - 10, idCardY + 108);
        doc.setFontSize(7);
        doc.text(`Issue: ${issueDate}`, idCardX + 10, idCardY + 118);
        doc.text(`Valid: ${validUntil}`, idCardX + 120, idCardY + 118);
        doc.text(`Contact: ${schoolPhone || schoolEmail || "N/A"}`, idCardX + 10, idCardY + 128);

        doc.setDrawColor(203, 213, 225);
        doc.line(idCardX + 10, idCardY + 141, idCardX + 96, idCardY + 141);
        doc.line(idCardX + 136, idCardY + 141, idCardX + 232, idCardY + 141);
        doc.setFontSize(6.5);
        doc.text("Registrar Sign", idCardX + 10, idCardY + 149);
        doc.text("School Stamp", idCardX + 136, idCardY + 149);

        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(1);
        doc.roundedRect(backCardX, backCardY, idCardW, idCardH, 8, 8);
        doc.setFillColor(30, 58, 138);
        doc.roundedRect(backCardX, backCardY, idCardW, headerH, 8, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(schoolName, backCardX + 10, backCardY + 14);
        doc.setFontSize(7.5);
        doc.text("OFFICIAL STUDENT IDENTIFICATION CARD - BACK", backCardX + 10, backCardY + 24);

        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`Emergency Contact: ${emergencyName}`, backCardX + 10, backCardY + 44);
        doc.text(`Emergency Phone: ${emergencyPhone}`, backCardX + 10, backCardY + 56);
        doc.text(`Blood Type: ${bloodType}`, backCardX + 10, backCardY + 68);
        doc.text(`Address: ${addressText}`, backCardX + 10, backCardY + 80);

        doc.setDrawColor(226, 232, 240);
        doc.line(backCardX + 10, backCardY + 92, backCardX + idCardW - 10, backCardY + 92);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text("NOTICE", backCardX + 10, backCardY + 104);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        const noticeLines = doc.splitTextToSize("If found, please return this card to the school administration.", idCardW - 20);
        doc.text(noticeLines, backCardX + 10, backCardY + 114);
        doc.text(`School: ${schoolName}`, backCardX + 10, backCardY + 136);
        doc.text(`Contact: ${schoolPhone || schoolEmail || "N/A"}`, backCardX + 10, backCardY + 146);
      }

      if (documentType === "enrollment_letter") {
        doc.setFontSize(12);
        const lines = [
          "This is to certify that",
          `${selectedStudent.name}`,
          `Student ID: ${selectedStudent.studentId}`,
          `is officially enrolled in Grade ${selectedStudent.grade}${selectedStudent.section || ""}`,
          `for Academic Year ${yearLabel(selectedStudent.academicYear || currentAcademicYear)}`,
          `at ${schoolName}.`,
        ];
        let y = 150;
        lines.forEach((line) => {
          doc.text(line, 40, y);
          y += 24;
        });
        doc.text(`Registrar Signature: ${admin.name}`, 40, y + 30);
      }

      if (documentType === "transfer_letter") {
        doc.setFontSize(12);
        doc.text(`Student Name: ${selectedStudent.name}`, 40, 150);
        doc.text(`Student ID: ${selectedStudent.studentId}`, 40, 172);
        doc.text(`Date of Birth: ${firstFilled(selectedStudent.row?.dob, selectedStudent.row?.basicStudentInformation?.dob, "N/A")}`, 40, 194);
        doc.text(`Grade: ${selectedStudent.grade}${selectedStudent.section ? ` ${selectedStudent.section}` : ""}`, 40, 216);
        doc.text(`Years Studied: ${academicRecords.length || 1}`, 40, 238);
        doc.text(`Reason for Transfer: ${transferReason}`, 40, 260);
        doc.text("Academic Performance Summary:", 40, 290);

        autoTable(doc, {
          startY: 305,
          head: [["Academic Year", "Grade", "Section", "Status"]],
          body: academicRecords.length
            ? academicRecords.map((r) => [yearLabel(r.year), r.grade || "-", r.section || "-", r.status || "-"])
            : [[yearLabel(selectedStudent.academicYear || currentAcademicYear), selectedStudent.grade || "-", selectedStudent.section || "-", selectedStudent.status || "-"]],
          styles: { fontSize: 10 },
        });
      }

      if (documentType === "profile_report") {
        doc.text(`Student: ${selectedStudent.name}`, 40, 146);
        doc.text(`Student ID: ${selectedStudent.studentId}`, 40, 164);
        doc.text(`Grade/Section: ${selectedStudent.grade}${selectedStudent.section ? ` ${selectedStudent.section}` : ""}`, 40, 182);
        doc.text(`Status: ${selectedStudent.status}`, 40, 200);

        autoTable(doc, {
          startY: 220,
          head: [["Parent", "Relationship", "Phone", "Email"]],
          body: parentInfo.length
            ? parentInfo.map((p) => [
              firstFilled(p?.fullName, p?.name, "Parent"),
              firstFilled(p?.relationship, "Guardian"),
              firstFilled(p?.phone, "-"),
              firstFilled(p?.email, "-"),
            ])
            : [["-", "-", "-", "-"]],
          styles: { fontSize: 10 },
          headStyles: { fillColor: [30, 58, 138] },
        });

        const afterParents = (doc.lastAutoTable?.finalY || 240) + 24;
        doc.text(`Attendance Summary - Present: ${attendanceSummary.present} | Absent: ${attendanceSummary.absent} | Late: ${attendanceSummary.late}`, 40, afterParents);

        autoTable(doc, {
          startY: afterParents + 14,
          head: [["Academic Year", "Grade", "Section", "Status"]],
          body: academicRecords.length
            ? academicRecords.map((r) => [yearLabel(r.year), r.grade || "-", r.section || "-", r.status || "-"])
            : [["-", "-", "-", "-"]],
          styles: { fontSize: 10 },
          headStyles: { fillColor: [22, 101, 52] },
        });
      }

      if (documentType === "enrollment_certificate") {
        const certNo = certificateNumber || await buildCertificateNumber();
        if (!certificateNumber) setCertificateNumber(certNo);

        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(1.5);
        doc.rect(30, 120, 535, 650);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("CERTIFICATE OF ENROLLMENT", 170, 175);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.text(`Certificate No: ${certNo}`, 40, 210);
        doc.text(`Issue Date: ${issueDate}`, 420, 210);

        const textLines = [
          "This is to certify that",
          selectedStudent.name,
          `Student ID: ${selectedStudent.studentId}`,
          `is officially enrolled in Grade ${selectedStudent.grade}${selectedStudent.section || ""}`,
          `for Academic Year ${yearLabel(selectedStudent.academicYear || currentAcademicYear)}`,
          `at ${schoolName}.`,
        ];

        let y = 290;
        textLines.forEach((line) => {
          doc.text(line, 60, y);
          y += 30;
        });

        doc.text("Registrar Signature: _____________________", 60, 560);
        doc.text(`Name: ${admin.name}`, 60, 585);
        doc.text("School Stamp Area", 420, 585);
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

    if (documentType === "id_card") {
      const previewCardWidth = 390;
      const previewCardHeight = Math.round((previewCardWidth * 53.98) / 85.6);
      const issue = new Date();
      const validUntil = `${issue.getFullYear() + 1}-${String(issue.getMonth() + 1).padStart(2, "0")}-${String(issue.getDate()).padStart(2, "0")}`;
      const emergencyName = firstFilled(selectedStudent.row?.healthEmergency?.emergencyContactName, parentInfo?.[0]?.fullName, parentInfo?.[0]?.name, "N/A");
      const emergencyPhone = firstFilled(selectedStudent.row?.healthEmergency?.emergencyPhone, parentInfo?.[0]?.phone, "N/A");
      const bloodType = firstFilled(selectedStudent.row?.healthEmergency?.bloodType, "N/A");
      const addressText = firstFilled(
        selectedStudent.row?.addressInformation?.city,
        selectedStudent.row?.addressInformation?.region,
        schoolAddress,
        "N/A"
      );
      return (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
          <div className="box" style={{ border: "1px solid #0f172a", borderRadius: 12, overflow: "hidden", background: "#fff", flex: "0 0 390px", width: previewCardWidth, height: previewCardHeight, display: "flex", flexDirection: "column" }}>
            <div style={{ background: "linear-gradient(135deg, #1e3a8a, #2563eb)", color: "#fff", padding: "10px 12px" }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{schoolName}</div>
              <div style={{ fontSize: 11, marginTop: 2, opacity: 0.95 }}>OFFICIAL STUDENT IDENTIFICATION CARD</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 10, padding: 12 }}>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, height: 96, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 11 }}>
                {selectedStudentPhotoUrl ? (
                  <img
                    src={selectedStudentPhotoUrl}
                    alt={`${selectedStudent.name} profile`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
                  />
                ) : (
                  "PHOTO"
                )}
              </div>
              <div style={{ fontSize: 12, color: "#0f172a", display: "grid", gap: 4 }}>
                <div><strong>Name:</strong> {selectedStudent.name}</div>
                <div><strong>Student ID:</strong> {selectedStudent.studentId}</div>
                <div><strong>Grade/Section:</strong> {selectedStudent.grade}{selectedStudent.section ? ` ${selectedStudent.section}` : ""}</div>
                <div><strong>Academic Year:</strong> {academicYearText}</div>
                <div><strong>Status:</strong> {selectedStudent.status}</div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", padding: "10px 12px", fontSize: 11, color: "#475569", display: "grid", gap: 4 }}>
              <div><strong>Issue Date:</strong> {new Date().toLocaleDateString()} | <strong>Valid Until:</strong> {validUntil}</div>
              <div><strong>School Contact:</strong> {schoolPhone || schoolEmail || "N/A"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
                <div style={{ borderTop: "1px solid #94a3b8", paddingTop: 4 }}>Registrar Sign</div>
                <div style={{ borderTop: "1px solid #94a3b8", paddingTop: 4 }}>School Stamp</div>
              </div>
            </div>
          </div>

          <div className="box" style={{ border: "1px solid #0f172a", borderRadius: 12, overflow: "hidden", background: "#fff", flex: "0 0 390px", width: previewCardWidth, height: previewCardHeight, display: "flex", flexDirection: "column" }}>
            <div style={{ background: "linear-gradient(135deg, #1e3a8a, #2563eb)", color: "#fff", padding: "10px 12px" }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{schoolName}</div>
              <div style={{ fontSize: 11, marginTop: 2, opacity: 0.95 }}>OFFICIAL STUDENT IDENTIFICATION CARD - BACK</div>
            </div>

            <div style={{ padding: 12, color: "#0f172a", fontSize: 12, display: "grid", gap: 7 }}>
              <div><strong>Emergency Contact:</strong> {emergencyName}</div>
              <div><strong>Emergency Phone:</strong> {emergencyPhone}</div>
              <div><strong>Blood Type:</strong> {bloodType}</div>
              <div><strong>Address:</strong> {addressText}</div>
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", padding: "10px 12px", fontSize: 11, color: "#475569", display: "grid", gap: 4 }}>
              <div><strong>NOTICE:</strong> If found, please return this card to the school administration.</div>
              <div><strong>School:</strong> {schoolName}</div>
              <div><strong>Contact:</strong> {schoolPhone || schoolEmail || "N/A"}</div>
            </div>
          </div>
        </div>
      );
    }

    if (documentType === "enrollment_letter") {
      return (
        <div className="box" style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 14 }}>
          <h3 style={{ margin: "0 0 8px" }}>{schoolName}</h3>
          <h4 style={{ margin: "0 0 12px" }}>Enrollment Letter</h4>
          <p>This is to certify that <strong>{selectedStudent.name}</strong> (Student ID: <strong>{selectedStudent.studentId}</strong>) is officially enrolled in Grade <strong>{selectedStudent.grade}{selectedStudent.section || ""}</strong> for Academic Year <strong>{academicYearText}</strong> at <strong>{schoolName}</strong>.</p>
          <p style={{ marginTop: 16 }}>Registrar: {admin.name}</p>
        </div>
      );
    }

    if (documentType === "transfer_letter") {
      return (
        <div className="box" style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 14 }}>
          <h3 style={{ margin: "0 0 8px" }}>{schoolName}</h3>
          <h4 style={{ margin: "0 0 12px" }}>Transfer Letter</h4>
          <p>Student Name: <strong>{selectedStudent.name}</strong></p>
          <p>Student ID: <strong>{selectedStudent.studentId}</strong></p>
          <p>Date of Birth: <strong>{firstFilled(selectedStudent.row?.dob, selectedStudent.row?.basicStudentInformation?.dob, "N/A")}</strong></p>
          <p>Grade: <strong>{selectedStudent.grade}{selectedStudent.section ? ` ${selectedStudent.section}` : ""}</strong></p>
          <p>Years Studied: <strong>{academicRecords.length || 1}</strong></p>
          <p>Reason for Transfer: <strong>{transferReason}</strong></p>
          <h5 style={{ margin: "12px 0 6px" }}>Academic Performance Summary</h5>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #cbd5e1", padding: 6 }}>Academic Year</th>
                <th style={{ border: "1px solid #cbd5e1", padding: 6 }}>Grade</th>
                <th style={{ border: "1px solid #cbd5e1", padding: 6 }}>Section</th>
                <th style={{ border: "1px solid #cbd5e1", padding: 6 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(academicRecords.length ? academicRecords : [{ year: selectedStudent.academicYear || currentAcademicYear, grade: selectedStudent.grade, section: selectedStudent.section, status: selectedStudent.status }]).map((r) => (
                <tr key={`${r.year}_${r.grade}_${r.section}`}>
                  <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>{yearLabel(r.year)}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>{r.grade || "-"}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>{r.section || "-"}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>{r.status || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (documentType === "profile_report") {
      return (
        <div className="box" style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 14 }}>
          <h3 style={{ margin: "0 0 8px" }}>{schoolName}</h3>
          <h4 style={{ margin: "0 0 12px" }}>Student Profile Report</h4>
          <p><strong>Student:</strong> {selectedStudent.name}</p>
          <p><strong>Student ID:</strong> {selectedStudent.studentId}</p>
          <p><strong>Grade/Section:</strong> {selectedStudent.grade}{selectedStudent.section ? ` ${selectedStudent.section}` : ""}</p>
          <p><strong>Status:</strong> {selectedStudent.status}</p>

          <h5 style={{ margin: "12px 0 6px" }}>Parent Information</h5>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #cbd5e1", padding: 6 }}>Name</th>
                <th style={{ border: "1px solid #cbd5e1", padding: 6 }}>Relationship</th>
                <th style={{ border: "1px solid #cbd5e1", padding: 6 }}>Phone</th>
                <th style={{ border: "1px solid #cbd5e1", padding: 6 }}>Email</th>
              </tr>
            </thead>
            <tbody>
              {(parentInfo.length ? parentInfo : [{}]).map((p, idx) => (
                <tr key={`${p?.parentId || "parent"}_${idx}`}>
                  <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>{firstFilled(p?.fullName, p?.name, "-")}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>{firstFilled(p?.relationship, "-")}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>{firstFilled(p?.phone, "-")}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>{firstFilled(p?.email, "-")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ marginTop: 10 }}><strong>Attendance:</strong> Present {attendanceSummary.present}, Absent {attendanceSummary.absent}, Late {attendanceSummary.late}</p>
        </div>
      );
    }

    const certNo = certificateNumber || "CERT-YYYY-00001";
    return (
      <div className="box" style={{ border: "2px solid #0f172a", borderRadius: 12, padding: 16 }}>
        <h3 style={{ margin: "0 0 6px", textAlign: "center" }}>{schoolName}</h3>
        <h4 style={{ margin: "0 0 12px", textAlign: "center" }}>CERTIFICATE OF ENROLLMENT</h4>
        <p>Certificate No: <strong>{certNo}</strong></p>
        <p>This is to certify that <strong>{selectedStudent.name}</strong> (ID: <strong>{selectedStudent.studentId}</strong>) is enrolled in Grade <strong>{selectedStudent.grade}{selectedStudent.section || ""}</strong> for Academic Year <strong>{academicYearText}</strong>.</p>
        <p style={{ marginTop: 16 }}>Registrar Signature: {admin.name}</p>
        <p>School Stamp Area</p>
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
          <img src={admin.profileImage || "/default-profile.png"} alt="admin" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px" }}>
        <RegisterSidebar user={admin} sticky fullHeight />

        <div className="main-content google-main" style={{ padding: "10px 20px 20px", flex: 1, minWidth: 0, boxSizing: "border-box" }}>
          <div style={heroStyle}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Document Generation System</div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.95 }}>Generate official school documents in one click: preview, export PDF, print.</div>
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
