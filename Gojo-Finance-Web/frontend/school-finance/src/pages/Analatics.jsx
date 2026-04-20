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
import { getOrLoad } from "../utils/requestCache";

const DB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Analatics() {
  const navigate = useNavigate();

  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem("finance") || localStorage.getItem("admin")) || {};
    } catch {
      return {};
    }
  })();

  const [finance, setFinance] = useState({
    financeId: stored.financeId || stored.adminId || "",
    userId: stored.userId || "",
    schoolCode: stored.schoolCode || "",
    name: stored.name || stored.username || "Finance",
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
        const [studentsData, usersData, monthlyPaidData] = await Promise.all([
          getOrLoad(
            `finance:analytics:students:${DB_ROOT}`,
            async () => {
              const response = await axios.get(`${DB_ROOT}/Students.json`).catch(() => ({ data: {} }));
              return response.data || {};
            },
            { ttlMs: 5 * 60 * 1000 }
          ),
          getOrLoad(
            `finance:analytics:users:${DB_ROOT}`,
            async () => {
              const response = await axios.get(`${DB_ROOT}/Users.json`).catch(() => ({ data: {} }));
              return response.data || {};
            },
            { ttlMs: 5 * 60 * 1000 }
          ),
          getOrLoad(
            `finance:analytics:monthlyPaid:${DB_ROOT}`,
            async () => {
              const response = await axios.get(`${DB_ROOT}/monthlyPaid.json`).catch(() => ({ data: {} }));
              return response.data || {};
            },
            { ttlMs: 5 * 60 * 1000 }
          ),
        ]);

        if (cancelled) return;

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
      workbook.creator = "Gojo Finance Portal";
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
      doc.text("Gojo Finance Portal - Payment Analytics Report", 40, 40);
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

  return (
    <div className="dashboard-page" style={{ background: "#f5f8ff", minHeight: "100vh" }}>
      <nav className="top-navbar" style={{ borderBottom: "1px solid #e5e7eb", background: "#ffffff" }}>
        <h2 style={{ color: "#0f172a", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Finance Portal</h2>
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
                  background: "red",
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
                style={{
                  position: "absolute",
                  top: 40,
                  right: 0,
                  width: 360,
                  maxHeight: 420,
                  overflowY: "auto",
                  background: "#fff",
                  borderRadius: 10,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                  zIndex: 1000,
                  padding: 6,
                }}
              >
                {totalNotifications === 0 ? (
                  <p style={{ padding: 12, textAlign: "center", color: "#777" }}>No new notifications</p>
                ) : (
                  <div>
                    {unreadPostList.length > 0 && (
                      <div>
                        <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontWeight: 700 }}>Posts</div>
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
                              borderBottom: "1px solid #f0f0f0",
                              transition: "background 120ms ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                          >
                            <img src={post.adminProfile || "/default-profile.png"} alt="" style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong>{post.adminName || "Admin"}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {post.message || "New post"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {messageCount > 0 && (
                      <div>
                        <div style={{ padding: "8px 10px", color: "#333", fontWeight: 700, background: "#fafafa", borderRadius: 6, margin: "8px 6px" }}>Messages</div>
                        {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                          <div
                            key={userId}
                            style={{
                              padding: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              cursor: "pointer",
                              borderBottom: "1px solid #f0f0f0",
                              transition: "background 120ms ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
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
                            <img src={sender.profileImage || "/default-profile.png"} alt={sender.name} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: "block", marginBottom: 4 }}>{sender.name}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "#555" }}>{sender.count} new message{sender.count > 1 && "s"}</p>
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

          <Link className="icon-circle" to="/settings"><FaCog /></Link>
          <img src={finance.profileImage || "/default-profile.png"} alt="finance" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px" }}>
        <div className="google-sidebar" style={{ width: "220px", padding: "12px", borderRadius: 16, background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 10px 24px rgba(15,23,42,0.06)", height: "fit-content" }}>
          <div className="sidebar-profile" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingBottom: 6 }}>
            <div className="sidebar-img-circle" style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", border: "2px solid #e6eefc" }}>
              <img src={finance.profileImage || "/default-profile.png"} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{finance.name || "Finance"}</h3>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{finance.username || finance.userId || finance.financeId || "finance"}</p>
          </div>

          <div className="sidebar-menu" style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            <Link className="sidebar-btn" to="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", fontSize: 13 }}>
              <FaHome style={{ width: 18, height: 18 }} /> Home
            </Link>
            <Link className="sidebar-btn" to="/my-posts" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", fontSize: 13 }}>
              <FaFileAlt style={{ width: 18, height: 18 }} /> My Posts
            </Link>
            <Link className="sidebar-btn" to="/students" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", fontSize: 13 }}>
              <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Students
            </Link>
            <Link className="sidebar-btn" to="/parents" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", fontSize: 13 }}>
              <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Parents
            </Link>
            <Link className="sidebar-btn" to="/analytics" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", fontSize: 13, backgroundColor: "#1d4ed8", color: "#fff", borderRadius: 10, boxShadow: "0 8px 18px rgba(29,78,216,0.25)" }}>
              <FaChartLine style={{ width: 18, height: 18 }} /> Analytics
            </Link>

            <button
              className="sidebar-btn logout-btn"
              onClick={() => {
                localStorage.removeItem("finance");
                localStorage.removeItem("admin");
                window.location.href = "/login";
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", fontSize: 13 }}
            >
              <FaSignOutAlt style={{ width: 18, height: 18 }} /> Logout
            </button>
          </div>
        </div>

        <div className="main-content" style={{ padding: "10px 20px 20px", flex: 1, minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "linear-gradient(135deg, #1e3a8a, #2563eb)", color: "#fff", borderRadius: 14, padding: "14px 16px", boxShadow: "0 14px 28px rgba(30,58,138,0.22)" }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Financial Analytics Dashboard</h2>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.95 }}>Production-level payment analytics by month, grade, and gender.</div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", boxShadow: "0 6px 18px rgba(15,23,42,0.07)" }}>
              <label style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>Year</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 10px", fontSize: 12, outline: "none" }}>
                {allYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <button
                onClick={() => setPeriodMode("year")}
                style={{
                  marginLeft: 10,
                  border: periodMode === "year" ? "1px solid #1d4ed8" : "1px solid #dbeafe",
                  background: periodMode === "year" ? "#1d4ed8" : "#eef2ff",
                  color: periodMode === "year" ? "#fff" : "#1e3a8a",
                  borderRadius: 999,
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                This Year
              </button>

              <label style={{ fontSize: 12, color: "#334155", fontWeight: 700, marginLeft: 8 }}>Month</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {MONTHS.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedMonth(m);
                      setPeriodMode("month");
                    }}
                    style={{
                      border: periodMode === "month" && selectedMonth === m ? "1px solid #1d4ed8" : "1px solid #dbeafe",
                      background: periodMode === "month" && selectedMonth === m ? "#1d4ed8" : "#eef2ff",
                      color: periodMode === "month" && selectedMonth === m ? "#fff" : "#1e3a8a",
                      borderRadius: 999,
                      padding: "6px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
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
                    border: "1px solid #16a34a",
                    background: "#16a34a",
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
                    border: "1px solid #1d4ed8",
                    background: "#1d4ed8",
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
                  <div key={i} style={{ height: 90, borderRadius: 12, background: "#fff", border: "1px solid #e5e7eb" }} />
                ))}
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{periodMode === "year" ? "TOTAL EXPECTED PAYMENTS" : "TOTAL STUDENTS"}</div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{activeSummary.totalStudents}</div>
                  </div>
                  <div style={{ background: "#fff", border: "1px solid #dcfce7", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#166534", fontWeight: 700 }}>PAID ({activeLabel})</div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: "#166534" }}>{activeSummary.paid}</div>
                  </div>
                  <div style={{ background: "#fff", border: "1px solid #fee2e2", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#991b1b", fontWeight: 700 }}>UNPAID ({activeLabel})</div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: "#991b1b" }}>{activeSummary.unpaid}</div>
                  </div>
                  <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#1e3a8a", fontWeight: 700 }}>PAYMENT RATE</div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: "#1e3a8a" }}>{activeSummary.paidRate}%</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, minHeight: 320 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>Monthly Payment Trend ({selectedYear})</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="paid" stroke="#16a34a" strokeWidth={2.5} />
                        <Line type="monotone" dataKey="unpaid" stroke="#dc2626" strokeWidth={2.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, minHeight: 320 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>Paid vs Unpaid ({activeLabel})</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={[{ name: "Paid", value: activeSummary.paid }, { name: "Unpaid", value: activeSummary.unpaid }]} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} paddingAngle={4}>
                          <Cell fill="#16a34a" />
                          <Cell fill="#dc2626" />
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, minHeight: 340 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>Grade-wise Collection Performance ({activeLabel})</div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={activeGradeBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="grade" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="paid" stackId="a" fill="#16a34a" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="unpaid" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, minHeight: 340 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>Gender Distribution ({activeLabel})</div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={activeGenderBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="paid" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="unpaid" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {periodMode === "year" && (
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, minHeight: 320 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>Yearly Collection Trend</div>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={yearlyChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="paid" stroke="#2563eb" strokeWidth={2.5} />
                          <Line type="monotone" dataKey="unpaid" stroke="#ea580c" strokeWidth={2.5} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, minHeight: 320 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>Yearly Payment Rate %</div>
                      <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>
                        paidRate : {selectedYearRateText}
                      </div>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={yearlyChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip formatter={(v) => `${v}%`} />
                          <Legend />
                          <Bar dataKey="paidRate" fill="#16a34a" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 10 }}>Grade Summary Table ({activeLabel})</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>Grade</th>
                          <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>Total</th>
                          <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>Paid</th>
                          <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>Unpaid</th>
                          <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeGradeBreakdown.map((row) => {
                          const rate = row.total ? Math.round((row.paid / row.total) * 100) : 0;
                          return (
                            <tr key={row.grade}>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 700 }}>Grade {row.grade}</td>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>{row.total}</td>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "right", color: "#166534", fontWeight: 700 }}>{row.paid}</td>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "right", color: "#b45309", fontWeight: 700 }}>{row.unpaid}</td>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "right", color: "#1e3a8a", fontWeight: 800 }}>{rate}%</td>
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
