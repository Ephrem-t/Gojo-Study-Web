import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import CompanySidebar from '../components/CompanySidebar'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

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

	const availableGrades = Array.from(
		new Set(studentProgressOverview.students.map((student) => String(student.grade || '').trim()).filter(Boolean))
	).sort(compareGrades)
	const normalizedSearchQuery = searchQuery.trim().toLowerCase()
	const filteredStudents = studentProgressOverview.students.filter((student) => {
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

	return (
		<div className='google-dashboard'>
			<CompanySidebar />
			<main className='google-main company-main'>
				<div className='exam-shell builder-shell'>
					<div className='results-command-deck progress-command-deck'>
						<div className='results-filter-panel progress-filter-panel'>
							<div className='results-filter-copy'>
								<span className='section-kicker'>Filter Students</span>
								<h3>{selectedGrade === 'all' ? 'Browse all student progress records' : `Browsing ${formatGradeLabel(selectedGrade)} progress`}</h3>
								<p>Search by student name, ID, school code, section, or academic year, then narrow the view to a single grade when needed.</p>
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
					
			<section className='section-block'>
				<div className='section-header-row'>
					<div className='section-heading'>
						<span className='section-kicker'>Student Progress</span>
						<h2>Students that took and scored exams</h2>
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
									<div className='empty-state student-progress-empty'>No exam records were found for this student.</div>
								)}
							</article>
						))}
					</div>
				) : studentProgressOverview.students.length ? (
					<div className='empty-state'>No students matched the current search and grade filters.</div>
				) : (
					<div className='empty-state'>No students were found in the studentProgress node.</div>
				)}
			</section>
				</div>
			</main>
		</div>
	)
}