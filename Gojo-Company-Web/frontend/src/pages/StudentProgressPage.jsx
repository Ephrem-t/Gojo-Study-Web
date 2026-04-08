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

	const activeStudentCount = studentProgressOverview.students.filter((student) => (student.examCount || 0) > 0).length

	return (
		<div className='google-dashboard'>
			<CompanySidebar />
			<main className='google-main company-main'>
				<div className='exam-shell builder-shell'>
			<section className='hero-panel'>
				<div className='hero-copy'>
					<span className='eyebrow'>Student Progress</span>
					<h1>Student participation and scores in a dedicated progress view.</h1>
					<p>
						This page focuses on students who attempted company exams, including their linked school records, score history, and progress details.
					</p>
					<div className='hero-actions'>
						<Link className='primary-action' to='/student-results'>Open student results</Link>
					</div>
					{loadState.error ? <div className='status-banner warning'>{loadState.error}</div> : null}
				</div>

				<div className='hero-card'>
					<span className='hero-card-label'>Current Snapshot</span>
					<div className='builder-stat-grid'>
						<StatCard label='Students' value={studentProgressOverview.count ?? 0} tone='gold' />
						<StatCard label='Active Students' value={activeStudentCount} tone='teal' />
						<StatCard label='Exam Entries' value={studentProgressOverview.examEntryCount ?? 0} tone='coral' />
						<StatCard label='Scored Entries' value={studentProgressOverview.scoredExamEntryCount ?? 0} tone='teal' />
					</div>
					<p className='inline-note'>
						{loadState.loading ? 'Loading student progress data...' : 'Each card resolves the student ID against the school student directory.'}
					</p>
				</div>
			</section>

			<section className='section-block'>
				<div className='section-header-row'>
					<div className='section-heading'>
						<span className='section-kicker'>Student Progress</span>
						<h2>Students that took and scored exams</h2>
					</div>
				</div>

				{studentProgressOverview.students.length ? (
					<div className='results-stack student-progress-stack'>
						{studentProgressOverview.students.map((student) => (
							<article className='catalog-card results-card student-progress-card' key={student.studentId}>
								<div className='section-header-row'>
									<div>
										<div className='catalog-meta-row'>
											<span className='pill pill-teal'>{student.grade || 'unknown grade'}</span>
											<span className='pill pill-gold'>{student.schoolCode || 'No school code'}</span>
											{student.section ? <span className='pill pill-coral'>Section {student.section}</span> : null}
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
				) : (
					<div className='empty-state'>No students were found in the studentProgress node.</div>
				)}
			</section>
				</div>
			</main>
		</div>
	)
}