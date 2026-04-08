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

export default function StudentResultsPage() {
	const [resultsOverview, setResultsOverview] = useState({ stats: {}, byExam: [], results: [], pointRules: [] })
	const [loadState, setLoadState] = useState({ loading: true, error: '' })
	const [rankingSubmitState, setRankingSubmitState] = useState({ loading: false, error: '', success: '' })
	const [selectedResultExamId, setSelectedResultExamId] = useState('all')

	useEffect(() => {
		async function loadResults() {
			setLoadState({ loading: true, error: '' })

			try {
				const response = await fetch(`${API_BASE_URL}/api/company-exams/results`)
				const data = await response.json()

				if (!response.ok) {
					throw new Error(data.error || 'Unable to load exam results')
				}

				setResultsOverview(data)
				setLoadState({ loading: false, error: '' })
			} catch (error) {
				setLoadState({ loading: false, error: error.message || 'Unable to connect to backend' })
			}
		}

		loadResults()
	}, [])

	async function reloadResults() {
		try {
			const response = await fetch(`${API_BASE_URL}/api/company-exams/results`)
			const data = await response.json()
			if (!response.ok) {
				throw new Error(data.error || 'Unable to reload results')
			}
			setResultsOverview(data)
		} catch {
			return
		}
	}

	async function handleSubmitRankingPoints() {
		setRankingSubmitState({ loading: true, error: '', success: '' })

		try {
			const response = await fetch(`${API_BASE_URL}/api/company-exams/results/submit-points`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					examId: selectedResultExamId === 'all' ? null : selectedResultExamId,
				}),
			})
			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Unable to submit ranking points')
			}

			setRankingSubmitState({
				loading: false,
				error: '',
				success: `Stored points for ${data.summary.processedResultCount} result${data.summary.processedResultCount === 1 ? '' : 's'} in rankings.`,
			})
			await reloadResults()
		} catch (error) {
			setRankingSubmitState({ loading: false, error: error.message || 'Unable to submit ranking points', success: '' })
		}
	}

	const visibleExamResults = selectedResultExamId === 'all'
		? resultsOverview.byExam
		: resultsOverview.byExam.filter((exam) => exam.examId === selectedResultExamId)
	const visibleResultCount = visibleExamResults.reduce((count, exam) => count + (exam.results?.length || 0), 0)

	return (
		<div className='google-dashboard'>
			<CompanySidebar />
			<main className='google-main company-main'>
				<div className='exam-shell builder-shell'>
			<section className='hero-panel'>
				<div className='hero-copy'>
					<span className='eyebrow'>Student Results</span>
					<h1>Marks, ranking points, and exam submissions in one page.</h1>
					<p>
						This page is dedicated to student exam results so the exam builder stays focused on creating and managing exam data.
					</p>
					<div className='hero-actions'>
						<Link className='primary-action' to='/student-progress'>Open student progress</Link>
					</div>
					{loadState.error ? <div className='status-banner warning'>{loadState.error}</div> : null}
					{rankingSubmitState.error ? <div className='status-banner warning'>{rankingSubmitState.error}</div> : null}
					{rankingSubmitState.success ? <div className='status-banner success-banner'>{rankingSubmitState.success}</div> : null}
				</div>

				<div className='hero-card'>
					<span className='hero-card-label'>Current Snapshot</span>
					<div className='builder-stat-grid'>
						<StatCard label='Students' value={resultsOverview.stats.studentCount ?? 0} tone='gold' />
						<StatCard label='Exam Results' value={resultsOverview.stats.resultCount ?? 0} tone='teal' />
						<StatCard label='Completed' value={resultsOverview.stats.completedCount ?? 0} tone='coral' />
						<StatCard label='Point Rules' value={resultsOverview.pointRules?.length ?? 0} tone='teal' />
					</div>
					<p className='inline-note'>
						{loadState.loading ? 'Loading student result data...' : 'Filter by exam and submit visible ranking points from this page.'}
					</p>
				</div>
			</section>

			<section className='section-block'>
				<div className='section-header-row'>
					<div className='section-heading'>
						<span className='section-kicker'>Student Results</span>
						<h2>Marks and points by exam</h2>
					</div>

					<div className='filter-bar'>
						<label className='filter-field'>
							<span>Exam filter</span>
							<select value={selectedResultExamId} onChange={(event) => setSelectedResultExamId(event.target.value)}>
								<option value='all'>All exams</option>
								{resultsOverview.byExam.map((exam) => (
									<option key={exam.examId} value={exam.examId}>
										{exam.examId}
									</option>
								))}
							</select>
						</label>
					</div>
				</div>

				<div className='catalog-grid compact-grid'>
					{(resultsOverview.pointRules || []).map((rule) => (
						<div className='catalog-card' key={`${rule.minimumPercent}-${rule.points}`}>
							<div className='catalog-meta-row'>
								<span className='pill pill-gold'>Points</span>
							</div>
							<h3>{rule.points} point{rule.points === 1 ? '' : 's'}</h3>
							<p>Score {rule.minimumPercent}% and above.</p>
						</div>
					))}
				</div>

				{visibleExamResults.length ? (
					<div className='results-stack'>
						{visibleExamResults.map((exam) => (
							<article className='catalog-card results-card' key={exam.examId}>
								<div className='section-header-row'>
									<div>
										<div className='catalog-meta-row'>
											<span className='pill pill-teal'>{exam.grade || 'unknown grade'}</span>
											<span className='pill pill-coral'>{exam.mode || 'practice'}</span>
										</div>
										<h3>{exam.title || exam.examId}</h3>
										<p>{exam.examId} • {exam.subject || 'Unknown subject'}</p>
									</div>

									<div className='results-summary-grid'>
										<div>
											<p className='config-key'>Students</p>
											<p className='config-value'>{exam.studentCount}</p>
										</div>
										<div>
											<p className='config-key'>Average Mark</p>
											<p className='config-value'>{formatPercent(exam.averageScorePercent)}</p>
										</div>
										<div>
											<p className='config-key'>Top Mark</p>
											<p className='config-value'>{formatPercent(exam.topScorePercent)}</p>
										</div>
									</div>
								</div>

								<div className='results-table-wrap'>
									<table className='results-table'>
										<thead>
											<tr>
												<th>Student</th>
												<th>Round</th>
												<th>Mark</th>
												<th>Points</th>
												<th>Stored</th>
												<th>Status</th>
												<th>Country Rank</th>
												<th>School Rank</th>
												<th>Submitted</th>
											</tr>
										</thead>
										<tbody>
											{exam.results.map((result) => (
												<tr key={`${result.examId}-${result.studentId}-${result.roundId}`}>
													<td>
														<div className='student-cell'>
															<strong>{result.studentName || result.studentId}</strong>
															<span>{result.studentId}</span>
															<span>{result.schoolCode || 'No school code'}</span>
														</div>
													</td>
													<td>{result.roundId}</td>
													<td>{formatPercent(result.bestScorePercent)}</td>
													<td>{result.examPoints}</td>
													<td>{result.pointsSubmitted ? result.storedExamPoints : '-'}</td>
													<td>{result.status || '-'}</td>
													<td>{result.countryRank ?? '-'}</td>
													<td>{result.schoolRank ?? '-'}</td>
													<td>{formatDateTime(result.lastSubmittedAt)}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>

								<p className='inline-note'>
									Country total points come from the ranking node. Exam points use this page rule: 90%+ = 4, 80%+ = 3,
									70%+ = 2, 60%+ = 1.
								</p>
							</article>
						))}
					</div>
				) : (
					<div className='empty-state'>No student results found for the selected exam yet.</div>
				)}

				<div className='results-submit-row'>
					<p className='inline-note'>
						Submit converts the visible student score percent into exam points and writes them to the rankings database.
					</p>
					<button
						className='primary-action'
						type='button'
						onClick={handleSubmitRankingPoints}
						disabled={rankingSubmitState.loading || visibleResultCount === 0}
					>
						{rankingSubmitState.loading
							? 'Submitting points...'
							: `Submit ${selectedResultExamId === 'all' ? 'visible' : 'selected exam'} points`}
					</button>
				</div>
			</section>
				</div>
			</main>
		</div>
	)
}