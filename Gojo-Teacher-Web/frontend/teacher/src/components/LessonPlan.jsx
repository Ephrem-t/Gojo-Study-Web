import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate } from "react-router-dom";
import { FaBookOpen, FaFileExcel, FaFilePdf, FaFilter } from "react-icons/fa";
import * as XLSX from "xlsx";
import Sidebar from "./Sidebar";
import { getRtdbRoot, RTDB_BASE_RAW } from "../api/rtdbScope";
import { getTeacherCourseContext } from "../api/teacherApi";
import LessonPlanTable from "./lessonPlan/LessonPlanTable";
import DailyLogsPanel from "./lessonPlan/DailyLogsPanel";
import { ETHIOPIAN_MONTHS, useLessonPlanData } from "./lessonPlan/useLessonPlanData";
import "./lessonPlan/lessonPlan.css";

const resolveAcademicYearFromNode = (yearsNode) => {
	if (!yearsNode || typeof yearsNode !== "object") return "";
	const withCurrent = Object.entries(yearsNode).find(([, val]) => Boolean(val?.isCurrent));
	if (withCurrent?.[0]) return String(withCurrent[0]);
	return String(Object.keys(yearsNode)[0] || "");
};

const LESSON_PLAN_AUTOSAVE_STORAGE_KEY = "teacher_lesson_plan_auto_save_enabled";
const LESSON_PLAN_AUTOSAVE_DELAY_MS = 900;
const EMPTY_SAVE_META = { status: "idle", error: "", lastSavedAt: null };

const getStoredAutoSaveEnabled = () => {
	if (typeof window === "undefined") return true;
	const storedValue = window.localStorage.getItem(LESSON_PLAN_AUTOSAVE_STORAGE_KEY);
	if (storedValue === null) return true;
	return storedValue === "true";
};

const formatSavedTime = (value) => {
	if (!value) return "";
	const dateValue = new Date(value);
	if (Number.isNaN(dateValue.getTime())) return "";
	return dateValue.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const sanitizeFileNamePart = (value) => {
	const sanitizedValue = String(value || "")
		.trim()
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
	return sanitizedValue || "lesson-plan";
};

const buildExportSheet = ({ title, contextRows = [], headers = [], bodyRows = [] }) => {
	const safeHeaders = headers.length ? headers : ["Details"];
	const allRows = [[title], ...contextRows, [], safeHeaders, ...bodyRows];
	const worksheet = XLSX.utils.aoa_to_sheet(allRows);
	worksheet["!merges"] = [
		{
			s: { r: 0, c: 0 },
			e: { r: 0, c: Math.max(safeHeaders.length - 1, 0) },
		},
	];
	worksheet["!cols"] = safeHeaders.map((header, index) => {
		const lengths = [
			String(header || "").length,
			...contextRows.map((row) => Math.max(String(row[0] || "").length, String(row[1] || "").length)),
			...bodyRows.map((row) => String(row[index] ?? "").length),
		];
		return { wch: Math.min(Math.max(...lengths, 14), 42) };
	});
	return worksheet;
};

const downloadPdfTable = ({ title, subtitleLines = [], headers = [], rows = [], fileName = "lesson-plan.pdf" }) => {
	const safeHeaders = headers.length ? headers : ["Details"];
	const safeRows = Array.isArray(rows) ? rows : [];
	const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

	doc.setFont("helvetica", "bold");
	doc.setFontSize(20);
	doc.setTextColor(23, 34, 58);
	doc.text(String(title || "Lesson Plan"), 40, 40);

	doc.setFont("helvetica", "normal");
	doc.setFontSize(10);
	doc.setTextColor(68, 80, 102);

	let metaY = 60;
	subtitleLines.filter(Boolean).forEach((line) => {
		doc.text(String(line), 40, metaY);
		metaY += 14;
	});

	autoTable(doc, {
		startY: metaY + 10,
		head: [safeHeaders.map((value) => String(value ?? ""))],
		body: safeRows.map((row) => row.map((value) => String(value ?? ""))),
		theme: "grid",
		styles: {
			font: "helvetica",
			fontSize: 8,
			cellPadding: 5,
			overflow: "linebreak",
			textColor: [23, 34, 58],
			lineColor: [215, 223, 236],
			lineWidth: 0.5,
		},
		headStyles: {
			fillColor: [234, 243, 255],
			textColor: [18, 87, 168],
			fontStyle: "bold",
		},
		alternateRowStyles: {
			fillColor: [249, 251, 255],
		},
		margin: { top: 40, right: 40, bottom: 40, left: 40 },
		tableWidth: "auto",
	});

	doc.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
};

function LessonPlan() {
	const navigate = useNavigate();
	const annualTableRef = useRef(null);
	const dailyLogsPanelRef = useRef(null);
	const [teacher, setTeacher] = useState(null);
	const [teacherKey, setTeacherKey] = useState("");
	const [courses, setCourses] = useState([]);
	const [selectedCourseId, setSelectedCourseId] = useState("");
	const [academicYear, setAcademicYear] = useState("");
	const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => getStoredAutoSaveEnabled());
	const [annualDirtyCount, setAnnualDirtyCount] = useState(0);
	const [dailyDirtyCount, setDailyDirtyCount] = useState(0);
	const [annualSaveMeta, setAnnualSaveMeta] = useState(EMPTY_SAVE_META);
	const [dailySaveMeta, setDailySaveMeta] = useState(EMPTY_SAVE_META);
	const [academicYearOptions, setAcademicYearOptions] = useState([]);
	const [coursesLoading, setCoursesLoading] = useState(false);
	const [rtdbBase, setRtdbBase] = useState(() => getRtdbRoot());
	const [schoolBaseResolved, setSchoolBaseResolved] = useState(false);
	const [leftSidebarOpen, setLeftSidebarOpen] = useState(
		typeof window !== "undefined" ? window.innerWidth > 600 : true
	);

	const [panelOpen, setPanelOpen] = useState(false);
	const [activeWeek, setActiveWeek] = useState(null);
	const [panelDefaultDate, setPanelDefaultDate] = useState("");
	const [newMonthId, setNewMonthId] = useState(ETHIOPIAN_MONTHS[0]);
	const [newWeekId, setNewWeekId] = useState("W1");
	const [newExpectedDays, setNewExpectedDays] = useState(5);

	const selectedCourse = useMemo(
		() => courses.find((course) => course.id === selectedCourseId) || null,
		[courses, selectedCourseId]
	);

	const {
		semesterIds,
		selectedSemesterId,
		setSelectedSemesterId,
		weeks,
		loading,
		saving,
		error,
		saveWeekPlans,
		updateWeekPlan,
		dailyLogsByWeek,
		dailyLogsLoadingKey,
		loadWeekDailyLogs,
		saveDailyLog,
		submitDailyLog,
		completeWeek,
		createWeekPlan,
		deleteWeekPlan,
		deleteDailyLog,
	} = useLessonPlanData({
		rtdbBase,
		academicYear,
		teacherId: teacherKey,
		course: selectedCourse,
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(LESSON_PLAN_AUTOSAVE_STORAGE_KEY, String(autoSaveEnabled));
	}, [autoSaveEnabled]);

	useEffect(() => {
		const storedTeacher = JSON.parse(localStorage.getItem("teacher") || "null");
		if (!storedTeacher) {
			navigate("/login");
			return;
		}
		setTeacher(storedTeacher);
		setTeacherKey(String(storedTeacher?.teacherId || storedTeacher?.teacherKey || ""));
	}, [navigate]);

	useEffect(() => {
		const resolveSchoolBase = async () => {
			if (!teacher) return;
			setSchoolBaseResolved(false);

			const rawSchoolCode = String(teacher?.schoolCode || "").trim();
			if (!rawSchoolCode) {
				setRtdbBase(getRtdbRoot());
				setSchoolBaseResolved(true);
				return;
			}

			if (rawSchoolCode.startsWith("ET-")) {
				setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${rawSchoolCode}`);
				setSchoolBaseResolved(true);
				return;
			}

			try {
				const shortCode = rawSchoolCode.toUpperCase();
				const mapRes = await axios.get(`${RTDB_BASE_RAW}/Platform1/schoolCodeIndex/${shortCode}.json`);
				const mappedCode = String(mapRes?.data || "").trim();
				if (mappedCode) {
					setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${mappedCode}`);
					setSchoolBaseResolved(true);
					return;
				}
			} catch {
				// Continue to fallback.
			}

			setRtdbBase(`${RTDB_BASE_RAW}/Platform1/Schools/${rawSchoolCode}`);
			setSchoolBaseResolved(true);
		};

		resolveSchoolBase();
	}, [teacher]);

	useEffect(() => {
		if (!teacher || !schoolBaseResolved || !rtdbBase) return;

		const loadCoreFilters = async () => {
			setCoursesLoading(true);

			try {
				const [courseContext, yearLowerRes, yearUpperRes] = await Promise.all([
					getTeacherCourseContext({ teacher, rtdbBase }),
					axios.get(`${rtdbBase}/academicYears.json`).catch(() => ({ data: {} })),
					axios.get(`${rtdbBase}/AcademicYears.json`).catch(() => ({ data: {} })),
				]);

				const resolvedCourses = Array.isArray(courseContext?.courses) ? courseContext.courses : [];
				setCourses(resolvedCourses);
				setTeacherKey(String(courseContext?.teacherKey || teacher?.teacherId || teacher?.teacherKey || ""));
				setSelectedCourseId((prev) => (prev && resolvedCourses.some((item) => item.id === prev) ? prev : (resolvedCourses[0]?.id || "")));

				const yearsNodeLower = yearLowerRes?.data && typeof yearLowerRes.data === "object" ? yearLowerRes.data : {};
				const yearsNodeUpper = yearUpperRes?.data && typeof yearUpperRes.data === "object" ? yearUpperRes.data : {};
				const yearsNode = Object.keys(yearsNodeLower).length ? yearsNodeLower : yearsNodeUpper;
				const years = Object.keys(yearsNode);
				setAcademicYearOptions(years);

				const preferredYear = resolveAcademicYearFromNode(yearsNode);
				setAcademicYear((prev) => {
					if (prev && years.includes(prev)) return prev;
					return preferredYear || prev || "";
				});
			} finally {
				setCoursesLoading(false);
			}
		};

		loadCoreFilters();
	}, [teacher, schoolBaseResolved, rtdbBase]);

	const flushPendingDrafts = useCallback(async () => {
		const annualSaveOk = annualTableRef.current?.flushPending ? await annualTableRef.current.flushPending() : true;
		if (annualSaveOk === false) return false;
		const dailySaveOk = dailyLogsPanelRef.current?.flushPending ? await dailyLogsPanelRef.current.flushPending() : true;
		if (dailySaveOk === false) return false;
		return true;
	}, []);

	const openWeekPanel = async (week, withTodayDraft = false) => {
		if (!week) return;
		const canContinue = dailyLogsPanelRef.current?.flushPending ? await dailyLogsPanelRef.current.flushPending() : true;
		if (canContinue === false) return;
		setActiveWeek(week);
		setPanelDefaultDate(withTodayDraft ? new Date().toISOString().slice(0, 10) : "");
		setPanelOpen(true);
		await loadWeekDailyLogs({ monthId: week.monthId, weekId: week.weekId });
	};

	const handleCompleteWeek = async (week) => {
		await completeWeek({ monthId: week.monthId, weekId: week.weekId });
	};

	const handleSaveDailyLog = async (payload) => {
		if (!activeWeek) return;
		await saveDailyLog({
			monthId: activeWeek.monthId,
			weekId: activeWeek.weekId,
			date: payload.date,
			log: payload,
		});
	};

	const handleSubmitDailyLog = async (date) => {
		if (!activeWeek || !date) return;
		await submitDailyLog({
			monthId: activeWeek.monthId,
			weekId: activeWeek.weekId,
			date,
		});
	};

	const handleDeleteWeek = async (week) => {
		if (!week) return;
		const ok = window.confirm(`Delete ${week.monthId} ${week.weekId}? This removes the week plan, daily logs, and submissions.`);
		if (!ok) return;
		await deleteWeekPlan({ monthId: week.monthId, weekId: week.weekId });
		if (activeWeek && activeWeek.monthId === week.monthId && activeWeek.weekId === week.weekId) {
			setPanelOpen(false);
		}
	};

	const handleDeleteDailyLog = async (date) => {
		if (!activeWeek || !date) return;
		const ok = window.confirm(`Delete daily log for ${date}?`);
		if (!ok) return;
		await deleteDailyLog({ monthId: activeWeek.monthId, weekId: activeWeek.weekId, date });
	};

	const handleCreateWeekPlan = async () => {
		if (!selectedCourseId || !newMonthId || !newWeekId) return;
		await createWeekPlan({
			monthId: newMonthId,
			weekId: newWeekId,
			payload: {
				expectedDays: Number(newExpectedDays || 5),
			},
		});
	};

	const logsKey = activeWeek ? `${activeWeek.monthId}__${activeWeek.weekId}` : "";
	const logs = logsKey ? (dailyLogsByWeek[logsKey] || []) : [];
	const logsLoading = Boolean(logsKey && dailyLogsLoadingKey === logsKey);
	const activeWeekLive = activeWeek
		? (weeks.find((row) => row.id === activeWeek.id) || weeks.find((row) => row.monthId === activeWeek.monthId && row.weekId === activeWeek.weekId) || activeWeek)
		: null;
	const totalExpected = weeks.reduce((sum, row) => sum + Number(row.expectedDays || 0), 0);
	const totalSubmitted = weeks.reduce((sum, row) => sum + Number(row.submittedCount || 0), 0);
	const pendingWeeks = weeks.filter((row) => Number(row.progressPercent || 0) < 100).length;
	const hasUnsavedChanges = annualDirtyCount > 0 || dailyDirtyCount > 0;
	const lastSavedAt = Math.max(Number(annualSaveMeta.lastSavedAt || 0), Number(dailySaveMeta.lastSavedAt || 0)) || null;
	const combinedSaveError = annualSaveMeta.error || dailySaveMeta.error || "";
	const combinedSaveState = annualSaveMeta.status === "error" || dailySaveMeta.status === "error"
		? "error"
		: annualSaveMeta.status === "saving" || dailySaveMeta.status === "saving"
			? "saving"
			: annualSaveMeta.status === "pending" || dailySaveMeta.status === "pending"
				? "pending"
				: "idle";
	const saveStatusText = combinedSaveState === "saving"
		? "Saving lesson plan..."
		: combinedSaveState === "pending"
			? "Auto-save queued..."
			: combinedSaveState === "error"
				? (combinedSaveError || "Lesson plan save failed.")
				: hasUnsavedChanges
					? (autoSaveEnabled ? "Unsaved lesson plan changes detected" : "Unsaved changes in manual mode")
					: lastSavedAt
						? `Saved at ${formatSavedTime(lastSavedAt)}`
						: (autoSaveEnabled ? "Auto Save is on" : "Auto Save is off");
	const saveStatusStyle = combinedSaveState === "error"
		? { background: "#fff1f1", borderColor: "#f3c7c7", color: "#a33d3d" }
		: combinedSaveState === "saving"
			? { background: "#eff6ff", borderColor: "#c9defc", color: "#1459aa" }
			: combinedSaveState === "pending"
				? { background: "#eef5ff", borderColor: "#d2e3fd", color: "#245fb3" }
				: { background: "#f3f8ff", borderColor: "#d6e6ff", color: "#15539f" };
	const saveHelperText = autoSaveEnabled
		? `Changes in the annual and daily plan save automatically ${LESSON_PLAN_AUTOSAVE_DELAY_MS / 1000}s after you stop typing.`
		: "Auto Save is off. Use Save for annual rows and Save Daily Log for the daily plan.";
	const selectedCourseLabel = selectedCourse?.subject || selectedCourse?.name || selectedCourse?.id || "Course";
	const annualExportHeaders = ["#", "Month", "Week", "Objective", "Topic", "Method", "Material", "Assessment", "Expected Days", "Submitted Days", "Progress", "Status"];
	const annualExportRows = useMemo(
		() => weeks.map((row, index) => [
			index + 1,
			row.monthId,
			row.weekId,
			row.objective || "-",
			row.topic || "-",
			row.method || "-",
			row.material || "-",
			row.assessment || "-",
			Number(row.expectedDays || 0),
			Number(row.submittedCount || 0),
			`${Number(row.progressPercent || 0)}%`,
			row.status || "pending",
		]),
		[weeks]
	);
	const dailySubmittedSet = useMemo(() => new Set(activeWeekLive?.submittedDays || []), [activeWeekLive]);
	const dailyExportHeaders = ["#", "Date", "Day", "Topic", "Method", "Teaching Aids", "Assessment", "Notes", "Status"];
	const dailyExportRows = useMemo(
		() => logs.map((log, index) => [
			index + 1,
			log.date || "-",
			log.dayName || "-",
			log.topic || "-",
			log.method || "-",
			log.aids || "-",
			log.assessment || "-",
			log.note || "-",
			dailySubmittedSet.has(log.date) ? "Submitted" : "Pending",
		]),
		[logs, dailySubmittedSet]
	);

	const exportAnnualPlanExcel = () => {
		if (!annualExportRows.length) return;
		const workbook = XLSX.utils.book_new();
		const worksheet = buildExportSheet({
			title: "Annual Plan",
			contextRows: [
				["Course", selectedCourseLabel],
				["Semester", selectedSemesterId || "-"],
				["Academic Year", academicYear || "-"],
			],
			headers: annualExportHeaders,
			bodyRows: annualExportRows,
		});
		XLSX.utils.book_append_sheet(workbook, worksheet, "Annual Plan");
		XLSX.writeFile(
			workbook,
			`${sanitizeFileNamePart(selectedCourseLabel)}-${sanitizeFileNamePart(selectedSemesterId || "semester")}-${sanitizeFileNamePart(academicYear || "year")}-annual-plan.xlsx`
		);
	};

	const exportAnnualPlanPdf = () => {
		if (!annualExportRows.length) return;
		downloadPdfTable({
			title: "Annual Plan",
			subtitleLines: [
				`Course: ${selectedCourseLabel}`,
				`Semester: ${selectedSemesterId || "-"}`,
				`Academic Year: ${academicYear || "-"}`,
			],
			headers: annualExportHeaders,
			rows: annualExportRows,
			fileName: `${sanitizeFileNamePart(selectedCourseLabel)}-${sanitizeFileNamePart(selectedSemesterId || "semester")}-${sanitizeFileNamePart(academicYear || "year")}-annual-plan.pdf`,
		});
	};

	const exportDailyPlanExcel = () => {
		if (!activeWeekLive || !dailyExportRows.length) return;
		const workbook = XLSX.utils.book_new();
		const worksheet = buildExportSheet({
			title: "Daily Plan",
			contextRows: [
				["Course", selectedCourseLabel],
				["Semester", selectedSemesterId || "-"],
				["Week", `${activeWeekLive.monthId} ${activeWeekLive.weekId}`],
			],
			headers: dailyExportHeaders,
			bodyRows: dailyExportRows,
		});
		XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Plan");
		XLSX.writeFile(
			workbook,
			`${sanitizeFileNamePart(selectedCourseLabel)}-${sanitizeFileNamePart(activeWeekLive.monthId)}-${sanitizeFileNamePart(activeWeekLive.weekId)}-daily-plan.xlsx`
		);
	};

	const exportDailyPlanPdf = () => {
		if (!activeWeekLive || !dailyExportRows.length) return;
		downloadPdfTable({
			title: "Daily Plan",
			subtitleLines: [
				`Course: ${selectedCourseLabel}`,
				`Semester: ${selectedSemesterId || "-"}`,
				`Week: ${activeWeekLive.monthId} ${activeWeekLive.weekId}`,
			],
			headers: dailyExportHeaders,
			rows: dailyExportRows,
			fileName: `${sanitizeFileNamePart(selectedCourseLabel)}-${sanitizeFileNamePart(activeWeekLive.monthId)}-${sanitizeFileNamePart(activeWeekLive.weekId)}-daily-plan.pdf`,
		});
	};

	const handleLogout = async () => {
		const canLeave = await flushPendingDrafts();
		if (canLeave === false) return;
		localStorage.removeItem("teacher");
		navigate("/login");
	};

	if (!teacher) return null;

	return (
		<div className="dashboard-page lesson-plan-page">
			<div className="google-dashboard lesson-plan-shell">
				<Sidebar
					active="lesson-plan"
					sidebarOpen={leftSidebarOpen}
					setSidebarOpen={setLeftSidebarOpen}
					teacher={teacher}
					handleLogout={handleLogout}
				/>

				<div
					className="teacher-sidebar-spacer"
					style={{
						width: "var(--sidebar-width, clamp(230px, 16vw, 290px))",
						minWidth: "var(--sidebar-width, clamp(230px, 16vw, 290px))",
						flex: "0 0 var(--sidebar-width, clamp(230px, 16vw, 290px))",
						pointerEvents: "none",
						background: "#ffffff",
					}}
				/>

				<main className="lesson-plan-main" style={{ background: "#ffffff" }}>
					<section className="lp-card lp-header">
						<div>
							<h1 className="lp-title">Lessons Planning Studio</h1>
							<p className="lp-subtitle">
								Professional weekly planning built on AssessmentTemplates, LessonPlans, LessonDailyLogs, and LessonSubmissions.
							</p>
							<div className="lp-context-strip">
								{selectedCourse?.subject ? <span className="lp-context-pill">Course: {selectedCourse.subject}</span> : null}
								{selectedCourse?.grade ? <span className="lp-context-pill">Grade {selectedCourse.grade}</span> : null}
								{selectedCourse?.section ? <span className="lp-context-pill">Section {selectedCourse.section}</span> : null}
								{/* {academicYear ? <span className="lp-context-pill">Year: {academicYear}</span> : null} */}
							</div>
							<div className="lp-metrics">
								<span className="lp-chip"><FaBookOpen /> Week Rows: {weeks.length}</span>
								{/* <span className="lp-chip"><FaCalendarAlt /> Submitted: {totalSubmitted}/{totalExpected || 0}</span> */}
								<span className="lp-chip"><FaFilter /> Semester: {selectedSemesterId || "-"}</span>
							</div>
							<div className="lp-summary-row">
								<div className="lp-summary-card">
									<div className="lp-summary-label">Expected Days</div>
									<div className="lp-summary-value">{totalExpected}</div>
								</div>
								<div className="lp-summary-card">
									<div className="lp-summary-label">Submitted Days</div>
									<div className="lp-summary-value">{totalSubmitted}</div>
								</div>
								<div className="lp-summary-card">
									<div className="lp-summary-label">Pending Weeks</div>
									<div className="lp-summary-value">{pendingWeeks}</div>
								</div>
							</div>
							<div className="lp-save-strip">
								<span className="lp-save-pill" style={saveStatusStyle}>{saveStatusText}</span>
								<button
									type="button"
									className={`lp-toggle-button ${autoSaveEnabled ? "is-on" : "is-off"}`}
									onClick={() => setAutoSaveEnabled((previousValue) => !previousValue)}
								>
									<span className="lp-toggle-track">
										<span className="lp-toggle-thumb" />
									</span>
									<span>{autoSaveEnabled ? "Auto Save On" : "Auto Save Off"}</span>
								</button>
							</div>
							<p className="lp-helper-copy">{saveHelperText}</p>
						</div>

						<div className="lp-controls">
							<label>
								Academic Year
								<select value={academicYear} onChange={async (event) => {
									const nextYear = event.target.value;
									if (nextYear === academicYear) return;
									const canSwitch = await flushPendingDrafts();
									if (canSwitch === false) return;
									setAcademicYear(nextYear);
									setPanelOpen(false);
									setActiveWeek(null);
								}}>
									<option value="">Select year</option>
									{academicYearOptions.map((year) => (
										<option key={year} value={year}>{year}</option>
									))}
								</select>
							</label>

							<label>
								Course
								<select
									value={selectedCourseId}
									onChange={async (event) => {
										const nextCourseId = event.target.value;
										if (nextCourseId === selectedCourseId) return;
										const canSwitch = await flushPendingDrafts();
										if (canSwitch === false) return;
										setSelectedCourseId(nextCourseId);
										setPanelOpen(false);
										setActiveWeek(null);
									}}
									disabled={coursesLoading}
								>
									<option value="">{coursesLoading ? "Loading courses..." : "Select course"}</option>
									{courses.map((course) => (
										<option key={course.id} value={course.id}>
											{(course.subject || course.name || course.id)} {course.grade ? `- G${course.grade}` : ""}{course.section ? `${course.section}` : ""}
										</option>
									))}
								</select>
							</label>

							<label>
								Semester
								<select value={selectedSemesterId} onChange={async (event) => {
									const nextSemesterId = event.target.value;
									if (nextSemesterId === selectedSemesterId) return;
									const canSwitch = await flushPendingDrafts();
									if (canSwitch === false) return;
									setSelectedSemesterId(nextSemesterId);
									setPanelOpen(false);
									setActiveWeek(null);
								}}>
									{semesterIds.map((semesterId) => (
										<option key={semesterId} value={semesterId}>{semesterId}</option>
									))}
								</select>
							</label>

							<label>
								Month
								<select value={newMonthId} onChange={(event) => setNewMonthId(event.target.value)}>
									{ETHIOPIAN_MONTHS.map((monthId) => (
										<option key={monthId} value={monthId}>{monthId}</option>
									))}
								</select>
							</label>

							<label>
								Week
								<select value={newWeekId} onChange={(event) => setNewWeekId(event.target.value)}>
									<option value="W1">W1</option>
									<option value="W2">W2</option>
									<option value="W3">W3</option>
									<option value="W4">W4</option>
								</select>
							</label>

							<label>
								Expected Days
								<input type="number" min={1} max={7} value={newExpectedDays} onChange={(event) => setNewExpectedDays(Number(event.target.value || 5))} />
							</label>

							<label>
								Create Plan
								<button className="lp-btn primary" onClick={handleCreateWeekPlan} disabled={saving || !selectedCourseId}>
									Add Week Plan
								</button>
							</label>
						</div>
					</section>

					{error ? <div className="lp-empty">{error}</div> : null}

					<section className="lp-card lp-section-heading">
						<div>
							<div className="lp-section-kicker">Annual Plan</div>
							<h2 className="lp-section-title">Annual Plan Overview</h2>
							<p className="lp-section-subtitle">Added months and weeks stay here, and you can export the full annual plan to Excel or PDF.</p>
						</div>
						<div className="lp-export-toolbar">
							<button className="lp-btn ghost" onClick={exportAnnualPlanExcel} disabled={!annualExportRows.length}>
								<FaFileExcel /> Annual Excel
							</button>
							<button className="lp-btn ghost" onClick={exportAnnualPlanPdf} disabled={!annualExportRows.length}>
								<FaFilePdf /> Annual PDF
							</button>
						</div>
					</section>

					<LessonPlanTable
						ref={annualTableRef}
						rows={weeks}
						loading={loading}
						saving={saving}
						autoSaveEnabled={autoSaveEnabled}
						autoSaveDelayMs={LESSON_PLAN_AUTOSAVE_DELAY_MS}
						onSaveRow={updateWeekPlan}
						onSaveRows={saveWeekPlans}
						onOpenWeek={(week) => openWeekPanel(week, false)}
						onQuickAddToday={(week) => openWeekPanel(week, true)}
						onCompleteWeek={handleCompleteWeek}
						onDeleteWeek={handleDeleteWeek}
						onDirtyCountChange={setAnnualDirtyCount}
						onSaveMetaChange={setAnnualSaveMeta}
					/>
				</main>
			</div>

			<DailyLogsPanel
				ref={dailyLogsPanelRef}
				open={panelOpen}
				week={activeWeekLive}
				logs={logs}
				loading={logsLoading}
				saving={saving}
				autoSaveEnabled={autoSaveEnabled}
				autoSaveDelayMs={LESSON_PLAN_AUTOSAVE_DELAY_MS}
				onClose={() => setPanelOpen(false)}
				onSave={handleSaveDailyLog}
				onSubmitDay={handleSubmitDailyLog}
				onDeleteDay={handleDeleteDailyLog}
				defaultDate={panelDefaultDate}
				onDirtyCountChange={setDailyDirtyCount}
				onSaveMetaChange={setDailySaveMeta}
				onExportExcel={exportDailyPlanExcel}
				onExportPdf={exportDailyPlanPdf}
			/>
		</div>
	);
}

export default LessonPlan;
