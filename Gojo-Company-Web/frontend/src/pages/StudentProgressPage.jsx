import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../apiBaseUrl'
import CompanySidebar from '../components/CompanySidebar'

function toOptionalTimestamp(value) {
	const normalized = String(value || '').trim()
	if (!normalized) {
		return null
	}

	const numeric = Number(normalized)
	if (Number.isFinite(numeric)) {
		return numeric
	}

	const parsed = new Date(normalized)
	return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
}

function formatDateTime(value) {
	const timestamp = toOptionalTimestamp(value)
	if (timestamp === null) {
		return 'Not submitted'
	}

	const date = new Date(timestamp)
	if (Number.isNaN(date.getTime())) {
		return 'Not submitted'
	}

	return date.toLocaleString()
}

function formatPercent(value) {
	if (!Number.isFinite(value)) {
		return '-'
	}

	return `${Math.round(value * 100) / 100}%`
}

function formatGradeLabel(value) {
	const normalized = String(value || '').trim()
	if (!normalized) {
		return 'Unassigned grade'
	}

	const match = normalized.match(/(\d{1,2})/)
	if (match) {
		return `Grade ${match[1]}`
	}

	return normalized
		.replace(/[_-]+/g, ' ')
		.replace(/\b\w/g, (character) => character.toUpperCase())
}

function compareGrades(left, right) {
	const leftMatch = String(left || '').match(/(\d{1,2})/)
	const rightMatch = String(right || '').match(/(\d{1,2})/)
	const leftValue = leftMatch ? Number(leftMatch[1]) : Number.POSITIVE_INFINITY
	const rightValue = rightMatch ? Number(rightMatch[1]) : Number.POSITIVE_INFINITY

	if (leftValue !== rightValue) {
		return leftValue - rightValue
	}

	return formatGradeLabel(left).localeCompare(formatGradeLabel(right))
}

function formatSchoolLabel(value) {
	const normalized = String(value || '').trim()
	return normalized || 'Unknown school'
}

function formatDecimal(value) {
	if (!Number.isFinite(value)) {
		return '0'
	}

	const rounded = Math.round(value * 10) / 10
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function formatRelativeShare(value, peak) {
	if (!Number.isFinite(value) || !Number.isFinite(peak) || peak <= 0) {
		return '0% of peak'
	}

	return `${Math.round((value / peak) * 100)}% of peak`
}

function resolveExamMode(exam) {
	const normalizedMode = String(exam?.mode || '').trim().toLowerCase()
	if (normalizedMode === 'practice' || normalizedMode === 'competitive' || normalizedMode === 'entrance') {
		return normalizedMode
	}

	const normalizedRoundId = String(exam?.roundId || '').trim().toLowerCase()
	const normalizedExamId = String(exam?.examId || '').trim().toUpperCase()
	if (normalizedRoundId.startsWith('r')) {
		return 'competitive'
	}
	if (normalizedRoundId.startsWith('e') || normalizedExamId.includes('_ENT_') || normalizedExamId.includes('ENTRANCE')) {
		return 'entrance'
	}
	return 'practice'
}

function isCompletedExamEntry(exam) {
	const status = String(exam?.status || '').trim().toLowerCase()
	return status === 'completed' || status === 'submitted' || toOptionalTimestamp(exam?.lastSubmittedAt) !== null
}

function isScoredExamEntry(exam) {
	return Number.isFinite(exam?.bestScorePercent) || Number.isFinite(exam?.examPoints) || Number.isFinite(exam?.storedExamPoints)
}

function filterCompetitiveStudentProgress(overview) {
	const students = Array.isArray(overview.students)
		? overview.students
				.map((student) => {
					const competitiveExams = Array.isArray(student.exams)
						? student.exams
								.map((exam) => ({
									...exam,
									mode: resolveExamMode(exam),
								}))
								.filter((exam) => exam.mode === 'competitive')
						: []

					return {
						...student,
						exams: competitiveExams,
						examCount: competitiveExams.length,
						completedCount: competitiveExams.filter(isCompletedExamEntry).length,
						scoredCount: competitiveExams.filter(isScoredExamEntry).length,
					}
				})
				.filter((student) => student.exams.length > 0)
		: []

	return {
		...overview,
		students,
		count: students.length,
		examEntryCount: students.reduce((count, student) => count + (student.examCount || 0), 0),
		completedExamEntryCount: students.reduce((count, student) => count + (student.completedCount || 0), 0),
		scoredExamEntryCount: students.reduce((count, student) => count + (student.scoredCount || 0), 0),
	}
}

function buildGradeAnalytics(students) {
	const gradeMap = new Map()

	for (const student of students) {
		const gradeKey = String(student.grade || '').trim() || 'unassigned'
		const current = gradeMap.get(gradeKey) || {
			key: gradeKey,
			label: formatGradeLabel(gradeKey),
			studentCount: 0,
			examEntryCount: 0,
			completedCount: 0,
			scoredCount: 0,
			schools: new Set(),
		}

		current.studentCount += 1
		current.examEntryCount += student.examCount || 0
		current.completedCount += student.completedCount || 0
		current.scoredCount += student.scoredCount || 0
		current.schools.add(formatSchoolLabel(student.schoolCode))
		gradeMap.set(gradeKey, current)
	}

	return Array.from(gradeMap.values())
		.map((item) => ({
			...item,
			schoolCount: item.schools.size,
			completionRate: item.examEntryCount ? (item.completedCount / item.examEntryCount) * 100 : 0,
		}))
		.sort((left, right) => compareGrades(left.key, right.key))
}

function buildSchoolAnalytics(students) {
	const schoolMap = new Map()

	for (const student of students) {
		const schoolKey = formatSchoolLabel(student.schoolCode)
		const current = schoolMap.get(schoolKey) || {
			key: schoolKey,
			label: schoolKey,
			studentCount: 0,
			examEntryCount: 0,
			completedCount: 0,
			scoredCount: 0,
			grades: new Set(),
		}

		current.studentCount += 1
		current.examEntryCount += student.examCount || 0
		current.completedCount += student.completedCount || 0
		current.scoredCount += student.scoredCount || 0
		current.grades.add(formatGradeLabel(student.grade))
		schoolMap.set(schoolKey, current)
	}

	return Array.from(schoolMap.values())
		.map((item) => ({
			...item,
			gradeCount: item.grades.size,
			completionRate: item.examEntryCount ? (item.completedCount / item.examEntryCount) * 100 : 0,
		}))
		.sort((left, right) => {
			if (right.studentCount !== left.studentCount) {
				return right.studentCount - left.studentCount
			}

			if (right.examEntryCount !== left.examEntryCount) {
				return right.examEntryCount - left.examEntryCount
			}

			return left.label.localeCompare(right.label)
		})
}

function StatCard({ label, value, tone = 'teal' }) {
	return (
		<div className={`builder-stat-card tone-${tone}`}>
			<p className='config-key'>{label}</p>
			<p className='config-value'>{value}</p>
		</div>
	)
}

export default function StudentProgressPage() {
	const [studentProgressOverview, setStudentProgressOverview] = useState({
		students: [],
		count: 0,
		examEntryCount: 0,
		completedExamEntryCount: 0,
		scoredExamEntryCount: 0,
	})
	const [loadState, setLoadState] = useState({ loading: true, error: '' })
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedGrade, setSelectedGrade] = useState('all')

	useEffect(() => {
		async function loadStudentProgress() {
			setLoadState({ loading: true, error: '' })

			try {
				const response = await fetch(`${API_BASE_URL}/api/student-progress/students`)
				const data = await response.json()

				if (!response.ok) {
					throw new Error(data.error || 'Unable to load student progress data')
				}

				setStudentProgressOverview(data)
				setLoadState({ loading: false, error: '' })
			} catch (error) {
				setLoadState({ loading: false, error: error.message || 'Unable to connect to backend' })
			}
		}

		loadStudentProgress()
	}, [])

	const competitiveOverview = filterCompetitiveStudentProgress(studentProgressOverview)

	const availableGrades = Array.from(
		new Set(competitiveOverview.students.map((student) => String(student.grade || '').trim()).filter(Boolean))
	).sort(compareGrades)
	const normalizedSearchQuery = searchQuery.trim().toLowerCase()
	const filteredStudents = competitiveOverview.students.filter((student) => {
		const matchesGrade = selectedGrade === 'all' || String(student.grade || '').trim().toLowerCase() === selectedGrade
		if (!matchesGrade) {
			return false
		}

		if (!normalizedSearchQuery) {
			return true
		}

		const searchableFields = [
			student.studentName,
			student.studentId,
			student.schoolCode,
			student.grade,
			student.section,
			student.academicYear,
			student.gender,
		]

		return searchableFields.some((value) => String(value || '').toLowerCase().includes(normalizedSearchQuery))
	})
	const resolvedStudentCount = filteredStudents.filter((student) => student.studentFound).length
	const filteredExamEntryCount = filteredStudents.reduce((count, student) => count + (student.examCount || 0), 0)
	const filteredCompletedEntryCount = filteredStudents.reduce((count, student) => count + (student.completedCount || 0), 0)
	const filteredScoredEntryCount = filteredStudents.reduce((count, student) => count + (student.scoredCount || 0), 0)
	const completionRate = filteredExamEntryCount
		? (filteredCompletedEntryCount / filteredExamEntryCount) * 100
		: 0
	const gradeAnalytics = buildGradeAnalytics(filteredStudents)
	const schoolAnalytics = buildSchoolAnalytics(filteredStudents)
	const gradePeak = gradeAnalytics.reduce((largest, item) => Math.max(largest, item.studentCount), 0)
	const schoolPeak = schoolAnalytics.reduce((largest, item) => Math.max(largest, item.studentCount), 0)
	const featuredGrade = [...gradeAnalytics].sort((left, right) => {
		if (right.studentCount !== left.studentCount) {
			return right.studentCount - left.studentCount
		}

		return compareGrades(left.key, right.key)
	})[0] || null
	const featuredSchool = schoolAnalytics[0] || null
	const strongestCompletionGrade = [...gradeAnalytics].sort((left, right) => {
		if (right.completionRate !== left.completionRate) {
			return right.completionRate - left.completionRate
		}

		return right.studentCount - left.studentCount
	})[0] || null
	const strongestCompletionSchool = [...schoolAnalytics].sort((left, right) => {
		if (right.completionRate !== left.completionRate) {
			return right.completionRate - left.completionRate
		}

		return right.studentCount - left.studentCount
	})[0] || null
	const activeSchoolCount = new Set(filteredStudents.map((student) => formatSchoolLabel(student.schoolCode))).size
	const activeGradeCount = new Set(filteredStudents.map((student) => formatGradeLabel(student.grade))).size
	const averageEntriesPerStudent = filteredStudents.length ? filteredExamEntryCount / filteredStudents.length : 0
	const scoreCoverageRate = filteredExamEntryCount
		? (filteredScoredEntryCount / filteredExamEntryCount) * 100
		: 0
	const analyticsScope = selectedGrade === 'all' ? 'all visible grades' : formatGradeLabel(selectedGrade)
	const schoolDisplayAnalytics = schoolAnalytics.slice(0, 8)

	return (
		<div className='google-dashboard'>
			<CompanySidebar />
			<main className='google-main company-main'>
				<div className='exam-shell builder-shell progress-page-shell'>
					<section className='hero-panel progress-hero-panel'>
						<div className='hero-copy progress-hero-copy'>
							<span className='eyebrow'>Competitive Exam Analytics</span>
							<h1>See who is taking the exam by grade and by school.</h1>
							<p>
								This view tracks only competitive exam participation and turns the current student list into a quick analytics
								dashboard with grade and school breakdowns.
							</p>
							<div className='hero-actions'>
								<a className='primary-action' href='#progress-analytics'>View analytics</a>
								<a className='secondary-action' href='#student-progress-list'>Open student records</a>
							</div>
							<div className='progress-analytics-meta'>
								<div className='progress-hero-note'>
									<strong>Live filter scope</strong>
									<span>
										Charts update with the current search and grade filters across {analyticsScope} and {activeGradeCount}{' '}
										visible grade{activeGradeCount === 1 ? '' : 's'}.
									</span>
								</div>
								<div className='progress-hero-note'>
									<strong>Participation focus</strong>
									<span>Each student is counted once in the grade and school charts, with exam entries shown as supporting detail.</span>
								</div>
							</div>
						</div>

						<div className='progress-hero-card'>
							<div className='builder-stat-grid progress-hero-stats'>
								<StatCard label='Competitive Students' value={filteredStudents.length} tone='gold' />
								<StatCard label='Exam Entries' value={filteredExamEntryCount} tone='teal' />
								<StatCard label='Schools In View' value={activeSchoolCount} tone='coral' />
								<StatCard label='Avg Entries / Student' value={formatDecimal(averageEntriesPerStudent)} tone='teal' />
							</div>

							<div className='progress-insight-strip'>
								<div className='progress-insight-card accent'>
									<h3>{featuredGrade ? featuredGrade.label : 'No grade data'}</h3>
									<p>
										{featuredGrade
											? `${featuredGrade.studentCount} student${featuredGrade.studentCount === 1 ? '' : 's'} are active here across ${featuredGrade.schoolCount} school${featuredGrade.schoolCount === 1 ? '' : 's'}.`
											: 'No grade analytics are available for the current filter.'}
									</p>
								</div>
								<div className='progress-insight-card'>
									<h3>{featuredSchool ? featuredSchool.label : 'No school data'}</h3>
									<p>
										{featuredSchool
											? `${featuredSchool.studentCount} student${featuredSchool.studentCount === 1 ? '' : 's'} from ${featuredSchool.gradeCount} grade${featuredSchool.gradeCount === 1 ? '' : 's'} appear in the current view.`
											: 'No school analytics are available for the current filter.'}
									</p>
								</div>
							</div>
						</div>
					</section>

					<section className='section-block progress-analytics-panel' id='progress-analytics'>
						<div className='section-header-row'>
							<div className='section-heading'>
								<span className='section-kicker'>Participation Charts</span>
								<h2>Competitive exam reach by grade and school</h2>
							</div>
							<p className='progress-section-note'>
								{strongestCompletionGrade
									? `${strongestCompletionGrade.label} has the strongest completion rate at ${formatPercent(strongestCompletionGrade.completionRate)} in the current view.`
									: 'Use the filters below to explore participation trends across grades and schools.'}
							</p>
						</div>

							<div className='progress-chart-signal-row'>
								<div className='progress-chart-signal-card accent-teal'>
									<span>Peak Grade Cluster</span>
									<strong>{featuredGrade ? featuredGrade.label : 'No grade data'}</strong>
									<small>
										{featuredGrade
											? `${featuredGrade.studentCount} students across ${featuredGrade.schoolCount} schools.`
											: 'The current view does not have enough grade data yet.'}
									</small>
								</div>
								<div className='progress-chart-signal-card accent-gold'>
									<span>Leading School</span>
									<strong>{featuredSchool ? featuredSchool.label : 'No school data'}</strong>
									<small>
										{featuredSchool
											? `${featuredSchool.studentCount} students and ${featuredSchool.examEntryCount} exam entries in view.`
											: 'The current filter does not expose school participation yet.'}
									</small>
								</div>
								<div className='progress-chart-signal-card accent-coral'>
									<span>Completion Leader</span>
									<strong>{strongestCompletionSchool ? strongestCompletionSchool.label : 'No completion leader'}</strong>
									<small>
										{strongestCompletionSchool
											? `${formatPercent(strongestCompletionSchool.completionRate)} completion across ${strongestCompletionSchool.gradeCount} grades.`
											: 'Completion rates will appear when competitive attempts are visible.'}
									</small>
								</div>
								<div className='progress-chart-signal-card'>
									<span>Score Coverage</span>
									<strong>{formatPercent(scoreCoverageRate)}</strong>
									<small>{filteredScoredEntryCount} of {filteredExamEntryCount} visible entries already have recorded scores.</small>
								</div>
							</div>

						{filteredStudents.length ? (
							<div className='progress-analytics-grid'>
								<article className='catalog-card progress-analytics-card progress-analytics-card-grade'>
									<div className='progress-chart-header'>
											<div className='progress-chart-heading'>
											<span className='pill pill-teal'>By Grade</span>
											<h3>Students taking competitive exams</h3>
										</div>
										<p>Each bar shows visible students in the current view. Entry counts and completion rates are added beside the bars.</p>
									</div>

									<div className='progress-bar-list'>
										{gradeAnalytics.map((item) => (
												<div className={`progress-bar-row${featuredGrade?.key === item.key ? ' is-leading' : ''}`} key={item.key}>
												<div className='progress-bar-copy'>
														<div className='progress-bar-title-row'>
															<strong>{item.label}</strong>
															{featuredGrade?.key === item.key ? <span className='progress-bar-badge'>Peak</span> : null}
														</div>
													<span>
														{item.examEntryCount} entr{item.examEntryCount === 1 ? 'y' : 'ies'} across {item.schoolCount} school{item.schoolCount === 1 ? '' : 's'}
													</span>
														<div className='progress-bar-meta'>
															<span className='progress-bar-chip'>{item.schoolCount} school{item.schoolCount === 1 ? '' : 's'}</span>
															<span className='progress-bar-chip subdued'>{formatPercent(item.completionRate)} complete</span>
														</div>
												</div>
												<div className='progress-bar-track'>
													<div
														className='progress-bar-fill tone-teal'
														style={{ width: `${gradePeak ? Math.max((item.studentCount / gradePeak) * 100, 10) : 0}%` }}
													/>
												</div>
												<div className='progress-bar-value'>
													<strong>{item.studentCount}</strong>
														<span>{item.examEntryCount} entries</span>
														<small>{formatRelativeShare(item.studentCount, gradePeak)}</small>
												</div>
											</div>
										))}
									</div>
								</article>

								<article className='catalog-card progress-analytics-card progress-analytics-card-school'>
									<div className='progress-chart-header'>
											<div className='progress-chart-heading'>
											<span className='pill pill-gold'>By School</span>
											<h3>Top schools by participation</h3>
										</div>
										<p>The tallest bars show where the largest number of visible students have taken competitive exams.</p>
									</div>

									<div className='progress-school-spotlight'>
										<div className='progress-school-spotlight-copy'>
											<span className='pill pill-coral'>School Spotlight</span>
											<h4>{featuredSchool ? featuredSchool.label : 'No school currently leads this view'}</h4>
											<p>
												{featuredSchool
													? `${featuredSchool.label} currently leads this filtered dashboard with ${featuredSchool.studentCount} visible students, ${featuredSchool.examEntryCount} recorded entries, and ${formatPercent(featuredSchool.completionRate)} completion.`
													: 'Apply or relax filters to surface the leading school for this competitive exam view.'}
											</p>
										</div>
										<div className='progress-school-spotlight-metrics'>
											<div>
												<span>Students</span>
												<strong>{featuredSchool ? featuredSchool.studentCount : 0}</strong>
											</div>
											<div>
												<span>Entries</span>
												<strong>{featuredSchool ? featuredSchool.examEntryCount : 0}</strong>
											</div>
											<div>
												<span>Completion</span>
												<strong>{featuredSchool ? formatPercent(featuredSchool.completionRate) : '0%'}</strong>
											</div>
										</div>
									</div>

									<div className='progress-school-bars'>
											{schoolDisplayAnalytics.map((item, index) => (
												<div className={`progress-school-bar-card${index === 0 ? ' is-leading' : ''}`} key={item.key} title={item.label}>
													<div className='progress-school-card-top'>
														<span className='progress-school-rank'>#{index + 1}</span>
														<span className='progress-school-share'>{formatRelativeShare(item.studentCount, schoolPeak)}</span>
													</div>
												<div className='progress-school-bar-track'>
													<div
														className='progress-school-bar-fill'
														style={{ height: `${schoolPeak ? Math.max((item.studentCount / schoolPeak) * 100, 14) : 0}%` }}
														>
															<span className='progress-school-bar-value'>{item.studentCount}</span>
														</div>
												</div>
													<div className='progress-school-card-copy'>
														<strong>{item.label}</strong>
														<span>{item.studentCount} student{item.studentCount === 1 ? '' : 's'}</span>
													</div>
													<div className='progress-school-card-stats'>
														<span className='progress-school-chip'>{item.examEntryCount} entries</span>
														<span className='progress-school-chip strong'>{formatPercent(item.completionRate)} complete</span>
													</div>
												<small>{item.gradeCount} grade{item.gradeCount === 1 ? '' : 's'} active</small>
											</div>
										))}
									</div>
										<p className='progress-school-legend'>Each column compares the top visible schools by student volume and completion quality.</p>
								</article>
							</div>
						) : (
							<div className='empty-state'>No competitive analytics are available for the current search and grade filters.</div>
						)}
					</section>

					<div className='results-command-deck progress-command-deck'>
						<div className='results-filter-panel progress-filter-panel'>
							<div className='results-filter-copy'>
								<span className='section-kicker'>Filter Students</span>
								<h3>{selectedGrade === 'all' ? 'Browse all competitive exam progress' : `Browsing ${formatGradeLabel(selectedGrade)} competitive progress`}</h3>
								<p>Search by student name, ID, school code, section, or academic year, then narrow the view to a single grade for competitive exam records only.</p>
							</div>

							<div className='filter-bar progress-filter-bar'>
								<label className='filter-field progress-search-field'>
									<span>Search student</span>
									<input
										type='text'
										value={searchQuery}
										onChange={(event) => setSearchQuery(event.target.value)}
										placeholder='Name, ID, school, section...'
									/>
								</label>

								<label className='filter-field'>
									<span>Grade</span>
									<select value={selectedGrade} onChange={(event) => setSelectedGrade(event.target.value)}>
										<option value='all'>All grades</option>
										{availableGrades.map((grade) => (
											<option key={grade} value={grade.toLowerCase()}>
												{formatGradeLabel(grade)}
											</option>
										))}
									</select>
								</label>
							</div>
						</div>

						<div className='builder-stat-grid progress-filter-stats'>
							<StatCard label='Visible Students' value={filteredStudents.length} tone='gold' />
							<StatCard label='Resolved Records' value={resolvedStudentCount} tone='teal' />
							<StatCard label='Scored Entries' value={filteredScoredEntryCount} tone='coral' />
							<StatCard label='Completion Rate' value={formatPercent(completionRate)} tone='teal' />
						</div>
					</div>

					{loadState.error ? <div className='status-banner warning'>{loadState.error}</div> : null}
					
			<section className='section-block' id='student-progress-list'>
				<div className='section-header-row'>
					<div className='section-heading'>
						<span className='section-kicker'>Student Progress</span>
						<h2>Students with competitive exam progress</h2>
					</div>
					<p className='progress-section-note'>Showing {filteredStudents.length} student record{filteredStudents.length === 1 ? '' : 's'} with the current search and grade filters applied.</p>
				</div>

				{filteredStudents.length ? (
					<div className='results-stack student-progress-stack'>
						{filteredStudents.map((student) => (
							<article className='catalog-card results-card student-progress-card' key={student.studentId}>
								<div className='section-header-row results-card-header student-progress-card-header'>
									<div>
										<div className='catalog-meta-row'>
											<span className='pill pill-teal'>{student.grade || 'unknown grade'}</span>
											<span className='pill pill-gold'>{student.schoolCode || 'No school code'}</span>
											{student.section ? <span className='pill pill-coral'>Section {student.section}</span> : null}
											<span className={`progress-record-pill${student.studentFound ? ' found' : ''}`}>
												{student.studentFound ? 'Directory matched' : 'Directory missing'}
											</span>
										</div>
										<h3>{student.studentName || student.studentId}</h3>
										<p>
											{student.studentId}
											{student.academicYear ? ` • ${student.academicYear}` : ''}
											{student.gender ? ` • ${student.gender}` : ''}
										</p>
										<p className={`student-node-note${student.studentFound ? '' : ' missing'}`}>
											{student.studentFound
												? `Resolved from ${student.studentNodePath}`
												: 'No matching record found under Schools/*/Students.'}
										</p>
									</div>

									<div className='results-summary-grid'>
										<div>
											<p className='config-key'>Exam Entries</p>
											<p className='config-value'>{student.examCount ?? 0}</p>
										</div>
										<div>
											<p className='config-key'>Completed</p>
											<p className='config-value'>{student.completedCount ?? 0}</p>
										</div>
										<div>
											<p className='config-key'>Scored</p>
											<p className='config-value'>{student.scoredCount ?? 0}</p>
										</div>
									</div>
								</div>

								<p className='results-card-note progress-card-note'>
									{`${student.completedCount ?? 0} of ${student.examCount ?? 0} entries completed.`}
									{student.scoredCount ? ` ${student.scoredCount} scored attempt${student.scoredCount === 1 ? '' : 's'} are already available.` : ' No scored attempts are available yet.'}
								</p>

								{student.exams.length ? (
									<div className='results-table-wrap'>
										<table className='results-table'>
											<thead>
												<tr>
													<th>Round</th>
													<th>Exam</th>
													<th>Title</th>
													<th>Subject</th>
													<th>Score</th>
													<th>Attempts</th>
													<th>Status</th>
													<th>Last Attempt</th>
													<th>Last Submitted</th>
												</tr>
											</thead>
											<tbody>
												{student.exams.map((exam) => (
													<tr key={`${student.studentId}-${exam.roundId}-${exam.examId}`}>
														<td>{exam.roundId}</td>
														<td>{exam.examId}</td>
														<td>{exam.title || exam.examId}</td>
														<td>{exam.subject || '-'}</td>
														<td>{formatPercent(exam.bestScorePercent)}</td>
														<td>{exam.attemptsUsed ?? 0}</td>
														<td>{exam.status || '-'}</td>
														<td>{formatDateTime(exam.lastAttemptTimestamp)}</td>
														<td>{formatDateTime(exam.lastSubmittedAt)}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								) : (
									<div className='empty-state student-progress-empty'>No competitive exam records were found for this student.</div>
								)}
							</article>
						))}
					</div>
				) : competitiveOverview.students.length ? (
					<div className='empty-state'>No students matched the current search and grade filters.</div>
				) : (
					<div className='empty-state'>No students were found with competitive exam records in the studentProgress node.</div>
				)}
			</section>
				</div>
			</main>
		</div>
	)
}