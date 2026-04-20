import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaChartLine,
  FaBell,
  FaFacebookMessenger,
  FaChevronDown,
} from "react-icons/fa";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import useTopbarNotifications from "../hooks/useTopbarNotifications";
import RegisterSidebar from "../components/RegisterSidebar";
import ProfileAvatar from "../components/ProfileAvatar";
import { buildUserLookupFromNode, loadSchoolStudentsNode, loadSchoolUsersNode } from "../utils/registerData";
import { fetchCachedJson } from "../utils/rtdbCache";

const DB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Analatics() {
  const navigate = useNavigate();

  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem("registrar") || localStorage.getItem("admin")) || {};
    } catch {
      return {};
    }
  })();

  const [finance, setFinance] = useState({
    financeId: stored.financeId || stored.adminId || "",
    userId: stored.userId || "",
    schoolCode: stored.schoolCode || "",
    name: stored.name || stored.username || "Register Office",
    username: stored.username || "",
    profileImage: stored.profileImage || "/default-profile.png",
  });

  const schoolCode = finance.schoolCode || stored.schoolCode || "";
  const DB_ROOT = schoolCode ? `${DB_BASE}/Platform1/Schools/${schoolCode}` : DB_BASE;

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [monthlyPaidRaw, setMonthlyPaidRaw] = useState({});
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [periodMode, setPeriodMode] = useState("month"); // month | year
  const [exporting, setExporting] = useState(false);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(true);
  const [studentMenuOpen, setStudentMenuOpen] = useState(false);
  const {
    unreadSenders,
    setUnreadSenders,
    unreadPosts: unreadPostList,
    totalNotifications,
    messageCount,
    markMessagesAsSeen,
    markPostAsSeen,
  } = useTopbarNotifications({
    dbRoot: DB_ROOT,
    currentUserId: finance.userId,
  });

  useEffect(() => {
    let cancelled = false;

    const loadFinanceProfile = async () => {
      if (!finance.userId) return;
      try {
        const res = await axios.get(`${DB_ROOT}/Users/${finance.userId}.json`);
        if (cancelled) return;
        const user = res.data || {};
        setFinance((prev) => ({
          ...prev,
          name: user.name || prev.name,
          username: user.username || prev.username,
          profileImage: user.profileImage || prev.profileImage,
        }));
      } catch {
        // keep fallback profile data
      }
    };

    loadFinanceProfile();
    return () => {
      cancelled = true;
    };
  }, [DB_ROOT, finance.userId]);

  useEffect(() => {
    let cancelled = false;

    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);
        const [studentsData, usersNode, monthlyPaidData] = await Promise.all([
          loadSchoolStudentsNode({ rtdbBase: DB_ROOT }),
          loadSchoolUsersNode({ rtdbBase: DB_ROOT }),
          fetchCachedJson(`${DB_ROOT}/monthlyPaid.json`, { ttlMs: 60000 }).catch(() => ({})),
        ]);

        if (cancelled) return;

        const usersData = buildUserLookupFromNode(usersNode);

        const list = Object.entries(studentsData).map(([studentId, studentNode]) => {
          const userNode = usersData?.[studentNode.userId] || {};
          const genderRaw = userNode.gender || studentNode.gender || "Unknown";

          return {
            studentId,
            userId: studentNode.userId || "",
            grade: String(studentNode.grade || "Unknown"),
            section: studentNode.section || "N/A",
            gender: String(genderRaw).toLowerCase(),
            name: userNode.name || userNode.username || studentNode.name || "Student",
          };
        });

        setStudents(list);
        setMonthlyPaidRaw(monthlyPaidData || {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAnalyticsData();

    return () => {
      cancelled = true;
    };
  }, [DB_ROOT]);

  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".notification-dropdown")) {
        setShowPostDropdown(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  const openPostFromNotif = async (post) => {
    setShowPostDropdown(false);

    try {
      await markPostAsSeen(post.postId);
      navigate("/dashboard", { state: { postId: post.postId } });
    } catch (err) {
      console.error("Error opening post notification:", err);
    }
  };

  const allYears = useMemo(() => {
    const years = new Set();
    Object.keys(monthlyPaidRaw || {}).forEach((k) => {
      const [year] = String(k).split("-");
      if (year) years.add(year);
    });
    if (years.size === 0) years.add(String(new Date().getFullYear()));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [monthlyPaidRaw]);

  useEffect(() => {
    if (!allYears.includes(selectedYear)) {
      setSelectedYear(allYears[0]);
    }
  }, [allYears, selectedYear]);

  const selectedMonthKey = `${selectedYear}-${selectedMonth}`;

  const summary = useMemo(() => {
    const totalStudents = students.length;
    const monthNode = monthlyPaidRaw?.[selectedMonthKey] || {};

    const paidSet = new Set();
    Object.entries(monthNode).forEach(([sid, paidValue]) => {
      if (paidValue) paidSet.add(String(sid));
    });

    const paid = students.filter((s) => paidSet.has(String(s.studentId)) || paidSet.has(String(s.userId))).length;
    const unpaid = Math.max(totalStudents - paid, 0);
    const paidRate = totalStudents > 0 ? Math.round((paid / totalStudents) * 100) : 0;

    return { totalStudents, paid, unpaid, paidRate };
  }, [students, monthlyPaidRaw, selectedMonthKey]);

  const monthlyTrend = useMemo(() => {
    const year = selectedYear;
    return MONTHS.map((month) => {
      const key = `${year}-${month}`;
      const monthNode = monthlyPaidRaw?.[key] || {};
      const paidSet = new Set();
      Object.entries(monthNode).forEach(([sid, paidValue]) => {
        if (paidValue) paidSet.add(String(sid));
      });

      const paid = students.filter((s) => paidSet.has(String(s.studentId)) || paidSet.has(String(s.userId))).length;
      const unpaid = Math.max(students.length - paid, 0);

      return {
        month,
        paid,
        unpaid,
        paidRate: students.length ? Number(((paid / students.length) * 100).toFixed(1)) : 0,
      };
    });
  }, [monthlyPaidRaw, selectedYear, students]);

  const gradeBreakdown = useMemo(() => {
    const monthNode = monthlyPaidRaw?.[selectedMonthKey] || {};
    const paidSet = new Set();
    Object.entries(monthNode).forEach(([sid, paidValue]) => {
      if (paidValue) paidSet.add(String(sid));
    });

    const map = {};

    students.forEach((s) => {
      const key = s.grade || "Unknown";
      if (!map[key]) map[key] = { grade: key, paid: 0, unpaid: 0, total: 0 };

      const isPaid = paidSet.has(String(s.studentId)) || paidSet.has(String(s.userId));
      map[key].total += 1;
      if (isPaid) map[key].paid += 1;
      else map[key].unpaid += 1;
    });

    return Object.values(map).sort((a, b) => Number(a.grade) - Number(b.grade));
  }, [students, monthlyPaidRaw, selectedMonthKey]);

  const genderBreakdown = useMemo(() => {
    const monthNode = monthlyPaidRaw?.[selectedMonthKey] || {};
    const paidSet = new Set();
    Object.entries(monthNode).forEach(([sid, paidValue]) => {
      if (paidValue) paidSet.add(String(sid));
    });

    const base = {
      male: { name: "Male", paid: 0, unpaid: 0, total: 0 },
      female: { name: "Female", paid: 0, unpaid: 0, total: 0 },
      other: { name: "Other", paid: 0, unpaid: 0, total: 0 },
      unknown: { name: "Unknown", paid: 0, unpaid: 0, total: 0 },
    };

    students.forEach((s) => {
      const genderKey = ["male", "female", "other"].includes(s.gender) ? s.gender : "unknown";
      const isPaid = paidSet.has(String(s.studentId)) || paidSet.has(String(s.userId));
      base[genderKey].total += 1;
      if (isPaid) base[genderKey].paid += 1;
      else base[genderKey].unpaid += 1;
    });

    return Object.values(base).filter((g) => g.total > 0);
  }, [students, monthlyPaidRaw, selectedMonthKey]);

  const paidUnpaidPie = [
    { name: "Paid", value: summary.paid },
    { name: "Unpaid", value: summary.unpaid },
  ];

  const yearlyTrend = useMemo(() => {
    return allYears
      .slice()
      .sort((a, b) => Number(a) - Number(b))
      .map((year) => {
        let paidTotal = 0;

        MONTHS.forEach((month) => {
          const key = `${year}-${month}`;
          const monthNode = monthlyPaidRaw?.[key] || {};
          const paidSet = new Set();
          Object.entries(monthNode).forEach(([sid, paidValue]) => {
            if (paidValue) paidSet.add(String(sid));
          });

          const paidThisMonth = students.filter(
            (s) => paidSet.has(String(s.studentId)) || paidSet.has(String(s.userId))
          ).length;

          paidTotal += paidThisMonth;
        });

        const yearlyExpected = students.length * 12;
        const unpaidTotal = Math.max(yearlyExpected - paidTotal, 0);
        const paidRate = yearlyExpected ? Number(((paidTotal / yearlyExpected) * 100).toFixed(1)) : 0;

        return {
          year,
          paid: paidTotal,
          unpaid: unpaidTotal,
          paidRate,
        };
      });
  }, [allYears, monthlyPaidRaw, students]);

  const selectedYearSummary = useMemo(() => {
    const row = yearlyTrend.find((r) => String(r.year) === String(selectedYear));
    const expected = students.length * 12;
    if (row) {
      return {
        totalExpected: expected,
        paid: row.paid,
        unpaid: row.unpaid,
        paidRate: row.paidRate,
      };
    }
    return { totalExpected: expected, paid: 0, unpaid: expected, paidRate: 0 };
  }, [yearlyTrend, selectedYear, students.length]);

  const yearlyGradeBreakdown = useMemo(() => {
    const map = {};

    students.forEach((s) => {
      const key = s.grade || "Unknown";
      if (!map[key]) map[key] = { grade: key, paid: 0, unpaid: 0, total: 0 };

      MONTHS.forEach((month) => {
        const monthNode = monthlyPaidRaw?.[`${selectedYear}-${month}`] || {};
        const isPaid = Boolean(monthNode?.[s.studentId] || monthNode?.[s.userId]);
        map[key].total += 1;
        if (isPaid) map[key].paid += 1;
        else map[key].unpaid += 1;
      });
    });

    return Object.values(map).sort((a, b) => Number(a.grade) - Number(b.grade));
  }, [students, monthlyPaidRaw, selectedYear]);

  const yearlyGenderBreakdown = useMemo(() => {
    const base = {
      male: { name: "Male", paid: 0, unpaid: 0, total: 0 },
      female: { name: "Female", paid: 0, unpaid: 0, total: 0 },
      other: { name: "Other", paid: 0, unpaid: 0, total: 0 },
      unknown: { name: "Unknown", paid: 0, unpaid: 0, total: 0 },
    };

    students.forEach((s) => {
      const genderKey = ["male", "female", "other"].includes(s.gender) ? s.gender : "unknown";
      MONTHS.forEach((month) => {
        const monthNode = monthlyPaidRaw?.[`${selectedYear}-${month}`] || {};
        const isPaid = Boolean(monthNode?.[s.studentId] || monthNode?.[s.userId]);
        base[genderKey].total += 1;
        if (isPaid) base[genderKey].paid += 1;
        else base[genderKey].unpaid += 1;
      });
    });

    return Object.values(base).filter((g) => g.total > 0);
  }, [students, monthlyPaidRaw, selectedYear]);

  const activeSummary = periodMode === "year"
    ? {
        totalStudents: selectedYearSummary.totalExpected,
        paid: selectedYearSummary.paid,
        unpaid: selectedYearSummary.unpaid,
        paidRate: selectedYearSummary.paidRate,
      }
    : summary;

  const activeGradeBreakdown = periodMode === "year" ? yearlyGradeBreakdown : gradeBreakdown;
  const activeGenderBreakdown = periodMode === "year" ? yearlyGenderBreakdown : genderBreakdown;
  const activeLabel = periodMode === "year" ? `This Year (${selectedYear})` : `${selectedMonth} ${selectedYear}`;
  const yearlyChartData = periodMode === "year"
    ? yearlyTrend.filter((row) => String(row.year) === String(selectedYear))
    : yearlyTrend;
  const selectedYearRateText = `${selectedYearSummary.paidRate}%`;

  const handleExportExcel = async () => {
    try {
      setExporting(true);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Gojo Register Portal";
      workbook.created = new Date();

      const summarySheet = workbook.addWorksheet("Summary");
      summarySheet.columns = [
        { header: "Metric", key: "metric", width: 30 },
        { header: "Value", key: "value", width: 24 },
      ];

      summarySheet.addRows([
        { metric: "School Code", value: schoolCode || "N/A" },
        { metric: "Selected Year", value: selectedYear },
        { metric: "View Mode", value: periodMode === "year" ? "This Year" : "Monthly" },
        { metric: "Selected Month", value: periodMode === "year" ? "All Months" : selectedMonth },
        { metric: periodMode === "year" ? "Total Expected Payments" : "Total Students", value: activeSummary.totalStudents },
        { metric: "Paid", value: activeSummary.paid },
        { metric: "Unpaid", value: activeSummary.unpaid },
        { metric: "Payment Rate", value: `${activeSummary.paidRate}%` },
      ]);

      const gradeSheet = workbook.addWorksheet("Grade Breakdown");
      gradeSheet.columns = [
        { header: "Grade", key: "grade", width: 16 },
        { header: "Total", key: "total", width: 14 },
        { header: "Paid", key: "paid", width: 14 },
        { header: "Unpaid", key: "unpaid", width: 14 },
        { header: "Rate", key: "rate", width: 14 },
      ];

      activeGradeBreakdown.forEach((row) => {
        const rate = row.total ? `${Math.round((row.paid / row.total) * 100)}%` : "0%";
        gradeSheet.addRow({
          grade: `Grade ${row.grade}`,
          total: row.total,
          paid: row.paid,
          unpaid: row.unpaid,
          rate,
        });
      });

      const genderSheet = workbook.addWorksheet("Gender Breakdown");
      genderSheet.columns = [
        { header: "Gender", key: "name", width: 18 },
        { header: "Total", key: "total", width: 14 },
        { header: "Paid", key: "paid", width: 14 },
        { header: "Unpaid", key: "unpaid", width: 14 },
      ];
      activeGenderBreakdown.forEach((row) => genderSheet.addRow(row));

      const trendSheet = workbook.addWorksheet("Monthly Trend");
      trendSheet.columns = [
        { header: "Month", key: "month", width: 14 },
        { header: "Paid", key: "paid", width: 14 },
        { header: "Unpaid", key: "unpaid", width: 14 },
        { header: "Paid Rate", key: "paidRate", width: 14 },
      ];
      monthlyTrend.forEach((row) => trendSheet.addRow({ ...row, paidRate: `${row.paidRate}%` }));

      const yearlySheet = workbook.addWorksheet("Yearly Trend");
      yearlySheet.columns = [
        { header: "Year", key: "year", width: 14 },
        { header: "Paid", key: "paid", width: 16 },
        { header: "Unpaid", key: "unpaid", width: 16 },
        { header: "Paid Rate", key: "paidRate", width: 16 },
      ];
      yearlyTrend.forEach((row) => yearlySheet.addRow({ ...row, paidRate: `${row.paidRate}%` }));

      const applyHeaderStyle = (sheet) => {
        const header = sheet.getRow(1);
        header.font = { bold: true, color: { argb: "FFFFFFFF" } };
        header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
      };

      [summarySheet, gradeSheet, genderSheet, trendSheet, yearlySheet].forEach(applyHeaderStyle);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(blob, `finance-analytics-${selectedYear}-${selectedMonth}.xlsx`);
    } catch (err) {
      console.error("Excel export failed:", err);
      alert("Failed to export Excel report.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = () => {
    try {
      setExporting(true);

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

      doc.setFontSize(16);
      doc.text("Gojo Register Portal - Payment Analytics Report", 40, 40);
      doc.setFontSize(10);
      doc.text(`School: ${schoolCode || "N/A"}`, 40, 58);
      doc.text(`Period: ${selectedMonth} ${selectedYear}`, 40, 72);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 86);

      autoTable(doc, {
        startY: 102,
        head: [["Metric", "Value"]],
        body: [
          ["Total Students", summary.totalStudents],
          [periodMode === "year" ? "Total Expected Payments" : "Total Students", activeSummary.totalStudents],
          ["Paid", activeSummary.paid],
          ["Unpaid", activeSummary.unpaid],
          ["Payment Rate", `${activeSummary.paidRate}%`],
        ],
        theme: "grid",
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 14,
        head: [["Grade", "Total", "Paid", "Unpaid", "Rate"]],
        body: activeGradeBreakdown.map((row) => [
          `Grade ${row.grade}`,
          row.total,
          row.paid,
          row.unpaid,
          `${row.total ? Math.round((row.paid / row.total) * 100) : 0}%`,
        ]),
        theme: "grid",
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 14,
        head: [["Gender", "Total", "Paid", "Unpaid"]],
        body: activeGenderBreakdown.map((row) => [row.name, row.total, row.paid, row.unpaid]),
        theme: "grid",
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 14,
        head: [["Year", "Paid", "Unpaid", "Paid Rate"]],
        body: yearlyTrend.map((row) => [row.year, row.paid, row.unpaid, `${row.paidRate}%`]),
        theme: "grid",
      });

      doc.save(`finance-analytics-${selectedYear}-${selectedMonth}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Failed to export PDF report.");
    } finally {
      setExporting(false);
    }
  };

  const pageBackground = "linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-secondary) 100%)";
  const heroStyle = {
    position: "relative",
    overflow: "hidden",
  };
  const panelStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    borderRadius: 12,
    boxShadow: "var(--shadow-soft)",
  };
  const filterBarStyle = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    padding: "10px 12px",
    ...panelStyle,
  };
  const pillButtonStyle = (active) => ({
    border: active ? "1px solid var(--accent-strong)" : "1px solid var(--accent-soft)",
    background: active ? "var(--accent-strong)" : "var(--accent-soft)",
    color: active ? "#fff" : "var(--accent-strong)",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  });
  const statCardStyle = (borderColor) => ({
    ...panelStyle,
    padding: 12,
    border: `1px solid ${borderColor}`,
  });
  const notificationDropdownStyle = {
    position: "absolute",
    top: 40,
    right: 0,
    width: 360,
    maxHeight: 420,
    overflowY: "auto",
    background: "var(--surface-panel)",
    borderRadius: 10,
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-panel)",
    zIndex: 1000,
    padding: 6,
  };
  const chartAxisStyle = { fontSize: 11, fill: "var(--text-muted)" };
  const chartGridStroke = "var(--border-soft)";
  const paidColor = "var(--success)";
  const unpaidColor = "var(--danger)";
  const accentColor = "var(--accent-strong)";
  const warningColor = "var(--warning)";

  return (
    <div className="dashboard-page" style={{ background: pageBackground, minHeight: "100vh" }}>
      <nav className="top-navbar" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface-panel)" }}>
        <h2 style={{ color: "var(--text-primary)", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>
        <div className="nav-right">
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowPostDropdown((prev) => !prev);
            }}
          >
            <FaBell />
            {totalNotifications > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-5px",
                  background: "var(--danger)",
                  color: "#fff",
                  borderRadius: "50%",
                  padding: "2px 6px",
                  fontSize: "10px",
                  fontWeight: "bold",
                }}
              >
                {totalNotifications}
              </span>
            )}

            {showPostDropdown && (
              <div
                className="notification-dropdown"
                onClick={(e) => e.stopPropagation()}
                style={notificationDropdownStyle}
              >
                {totalNotifications === 0 ? (
                  <p style={{ padding: 12, textAlign: "center", color: "var(--text-muted)" }}>No new notifications</p>
                ) : (
                  <div>
                    {unreadPostList.length > 0 && (
                      <div>
                        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-soft)", fontWeight: 700, color: "var(--text-primary)" }}>Posts</div>
                        {unreadPostList.map((post) => (
                          <div
                            key={post.postId}
                            onClick={() => openPostFromNotif(post)}
                            style={{
                              padding: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              cursor: "pointer",
                              borderBottom: "1px solid var(--border-soft)",
                              transition: "background 120ms ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                          >
                            <ProfileAvatar imageUrl={post.adminProfile} name={post.adminName || "Admin"} size={46} borderRadius={8} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ color: "var(--text-primary)" }}>{post.adminName || "Admin"}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {post.message || "New post"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {messageCount > 0 && (
                      <div>
                        <div style={{ padding: "8px 10px", color: "var(--text-primary)", fontWeight: 700, background: "var(--surface-muted)", borderRadius: 6, margin: "8px 6px" }}>Messages</div>
                        {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                          <div
                            key={userId}
                            style={{
                              padding: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              cursor: "pointer",
                              borderBottom: "1px solid var(--border-soft)",
                              transition: "background 120ms ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                            onClick={async () => {
                              await markMessagesAsSeen(userId);
                              setUnreadSenders((prev) => {
                                const copy = { ...prev };
                                delete copy[userId];
                                return copy;
                              });
                              setShowPostDropdown(false);
                              navigate("/all-chat", {
                                state: {
                                  user: {
                                    userId,
                                    name: sender.name,
                                    profileImage: sender.profileImage,
                                    type: sender.type,
                                  },
                                },
                              });
                            }}
                          >
                            <ProfileAvatar imageUrl={sender.profileImage} name={sender.name} size={46} borderRadius={8} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: "block", marginBottom: 4, color: "var(--text-primary)" }}>{sender.name}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>{sender.count} new message{sender.count > 1 && "s"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/all-chat")}>
            <FaFacebookMessenger />
            {messageCount > 0 && <span className="badge">{messageCount}</span>}
          </div>

          <ProfileAvatar imageUrl={finance.profileImage} name={finance.name} size={38} className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px" }}>
        <RegisterSidebar user={finance} sticky fullHeight />

        <div className="main-content" style={{ padding: "10px 20px 20px", flex: 1, minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="section-header-card" style={heroStyle}>
              <h2 className="section-header-card__title">Financial Analytics Dashboard</h2>
              <div className="section-header-card__subtitle">Production-level payment analytics by month, grade, and gender.</div>
            </div>

            <div style={filterBarStyle}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700 }}>Year</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "6px 10px", fontSize: 12, outline: "none", background: "var(--input-bg)", color: "var(--text-primary)" }}>
                {allYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <button
                onClick={() => setPeriodMode("year")}
                style={{ marginLeft: 10, ...pillButtonStyle(periodMode === "year") }}
              >
                This Year
              </button>

              <label style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, marginLeft: 8 }}>Month</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {MONTHS.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedMonth(m);
                      setPeriodMode("month");
                    }}
                    style={pillButtonStyle(periodMode === "month" && selectedMonth === m)}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  onClick={handleExportExcel}
                  disabled={loading || exporting}
                  style={{
                    border: "1px solid var(--success)",
                    background: "var(--success)",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "7px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: loading || exporting ? "not-allowed" : "pointer",
                    opacity: loading || exporting ? 0.7 : 1,
                  }}
                >
                  Export Excel
                </button>
                <button
                  onClick={handleExportPdf}
                  disabled={loading || exporting}
                  style={{
                    border: "1px solid var(--accent-strong)",
                    background: "var(--accent-strong)",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "7px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: loading || exporting ? "not-allowed" : "pointer",
                    opacity: loading || exporting ? 0.7 : 1,
                  }}
                >
                  Export PDF
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 10 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ height: 90, borderRadius: 12, background: "var(--surface-panel)", border: "1px solid var(--border-soft)" }} />
                ))}
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                  <div style={statCardStyle("var(--border-soft)")}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{periodMode === "year" ? "TOTAL EXPECTED PAYMENTS" : "TOTAL STUDENTS"}</div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>{activeSummary.totalStudents}</div>
                  </div>
                  <div style={statCardStyle("var(--success-border)")}>
                    <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 700 }}>PAID ({activeLabel})</div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: "var(--success)" }}>{activeSummary.paid}</div>
                  </div>
                  <div style={statCardStyle("var(--danger-border)")}>
                    <div style={{ fontSize: 11, color: "var(--danger)", fontWeight: 700 }}>UNPAID ({activeLabel})</div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: "var(--danger)" }}>{activeSummary.unpaid}</div>
                  </div>
                  <div style={statCardStyle("var(--accent-soft)")}>
                    <div style={{ fontSize: 11, color: "var(--accent-strong)", fontWeight: 700 }}>PAYMENT RATE</div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: "var(--accent-strong)" }}>{activeSummary.paidRate}%</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                  <div style={{ ...panelStyle, padding: 12, minHeight: 320 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)", marginBottom: 8 }}>Monthly Payment Trend ({selectedYear})</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={monthlyTrend}>
                        <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={chartAxisStyle} />
                        <YAxis tick={chartAxisStyle} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="paid" stroke={paidColor} strokeWidth={2.5} />
                        <Line type="monotone" dataKey="unpaid" stroke={unpaidColor} strokeWidth={2.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ ...panelStyle, padding: 12, minHeight: 320 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)", marginBottom: 8 }}>Paid vs Unpaid ({activeLabel})</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={[{ name: "Paid", value: activeSummary.paid }, { name: "Unpaid", value: activeSummary.unpaid }]} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} paddingAngle={4}>
                          <Cell fill={paidColor} />
                          <Cell fill={unpaidColor} />
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                  <div style={{ ...panelStyle, padding: 12, minHeight: 340 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)", marginBottom: 8 }}>Grade-wise Collection Performance ({activeLabel})</div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={activeGradeBreakdown}>
                        <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                        <XAxis dataKey="grade" tick={chartAxisStyle} />
                        <YAxis tick={chartAxisStyle} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="paid" stackId="a" fill={paidColor} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="unpaid" stackId="a" fill={warningColor} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ ...panelStyle, padding: 12, minHeight: 340 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)", marginBottom: 8 }}>Gender Distribution ({activeLabel})</div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={activeGenderBreakdown}>
                        <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={chartAxisStyle} />
                        <YAxis tick={chartAxisStyle} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="paid" fill={accentColor} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="unpaid" fill={unpaidColor} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {periodMode === "year" && (
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                    <div style={{ ...panelStyle, padding: 12, minHeight: 320 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)", marginBottom: 8 }}>Yearly Collection Trend</div>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={yearlyChartData}>
                          <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                          <XAxis dataKey="year" tick={chartAxisStyle} />
                          <YAxis tick={chartAxisStyle} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="paid" stroke={accentColor} strokeWidth={2.5} />
                          <Line type="monotone" dataKey="unpaid" stroke={warningColor} strokeWidth={2.5} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div style={{ ...panelStyle, padding: 12, minHeight: 320 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)", marginBottom: 8 }}>Yearly Payment Rate %</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                        paidRate : {selectedYearRateText}
                      </div>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={yearlyChartData}>
                          <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                          <XAxis dataKey="year" tick={chartAxisStyle} />
                          <YAxis domain={[0, 100]} tick={chartAxisStyle} />
                          <Tooltip formatter={(v) => `${v}%`} />
                          <Legend />
                          <Bar dataKey="paidRate" fill={paidColor} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <div style={{ ...panelStyle, padding: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)", marginBottom: 10 }}>Grade Summary Table ({activeLabel})</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "var(--surface-muted)" }}>
                          <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-soft)", color: "var(--text-primary)" }}>Grade</th>
                          <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid var(--border-soft)", color: "var(--text-primary)" }}>Total</th>
                          <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid var(--border-soft)", color: "var(--text-primary)" }}>Paid</th>
                          <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid var(--border-soft)", color: "var(--text-primary)" }}>Unpaid</th>
                          <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid var(--border-soft)", color: "var(--text-primary)" }}>Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeGradeBreakdown.map((row) => {
                          const rate = row.total ? Math.round((row.paid / row.total) * 100) : 0;
                          return (
                            <tr key={row.grade}>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-soft)", fontWeight: 700, color: "var(--text-primary)" }}>Grade {row.grade}</td>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-soft)", textAlign: "right", color: "var(--text-primary)" }}>{row.total}</td>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-soft)", textAlign: "right", color: "var(--success)", fontWeight: 700 }}>{row.paid}</td>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-soft)", textAlign: "right", color: "var(--warning)", fontWeight: 700 }}>{row.unpaid}</td>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-soft)", textAlign: "right", color: "var(--accent-strong)", fontWeight: 800 }}>{rate}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analatics;
