import { useEffect, useState } from 'react'
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

function formatOrdinal(value) {
	if (!Number.isFinite(value)) {
		return 'Unranked'
	}

	const normalized = Math.abs(Number(value))
	const modHundred = normalized % 100
	if (modHundred >= 11 && modHundred <= 13) {
		return `${value}th`
	}

	switch (normalized % 10) {
		case 1:
			return `${value}st`
		case 2:
			return `${value}nd`
		case 3:
			return `${value}rd`
		default:
			return `${value}th`
	}
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

function normalizeSearchValue(value) {
	return String(value || '').trim().toLowerCase()
}

function formatSchoolLabel(value) {
	const normalized = String(value || '').trim()
	return normalized || 'Unknown school'
}

function compareRankedStudents(left, right) {
	const leftCountryRank = Number.isFinite(left.countryRank) ? left.countryRank : Number.POSITIVE_INFINITY
	const rightCountryRank = Number.isFinite(right.countryRank) ? right.countryRank : Number.POSITIVE_INFINITY
	if (leftCountryRank !== rightCountryRank) {
		return leftCountryRank - rightCountryRank
	}

	const leftPoints = Number.isFinite(left.countryTotalPoints) ? left.countryTotalPoints : -1
	const rightPoints = Number.isFinite(right.countryTotalPoints) ? right.countryTotalPoints : -1
	if (leftPoints !== rightPoints) {
		return rightPoints - leftPoints
	}

	const leftScore = Number.isFinite(left.bestScorePercent) ? left.bestScorePercent : -1
	const rightScore = Number.isFinite(right.bestScorePercent) ? right.bestScorePercent : -1
	if (leftScore !== rightScore) {
		return rightScore - leftScore
	}

	return String(left.studentName || left.studentId).localeCompare(String(right.studentName || right.studentId))
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

function buildTopRankedStudents(results) {
	const students = new Map()

	for (const result of results) {
		if (!result || result.mode !== 'competitive') {
			continue
		}

		const studentId = String(result.studentId || '').trim()
		if (!studentId) {
			continue
		}

		const current = students.get(studentId)
		const score = Number.isFinite(result.bestScorePercent) ? result.bestScorePercent : null
		const points = Number.isFinite(result.countryTotalPoints) ? result.countryTotalPoints : 0
		const examPoints = Number.isFinite(result.examPoints) ? result.examPoints : 0
		const countryRank = Number.isFinite(result.countryRank) ? result.countryRank : null
		const schoolRank = Number.isFinite(result.schoolRank) ? result.schoolRank : null

		if (!current) {
			students.set(studentId, {
				studentId,
				studentName: result.studentName || studentId,
				schoolCode: result.schoolCode || '',
				grade: result.grade || '',
				bestScorePercent: score,
				countryTotalPoints: points,
				examPoints,
				countryRank,
				schoolRank,
				featuredExamTitle: result.title || result.examId || '',
				resultCount: 1,
			})
			continue
		}

		current.resultCount += 1
		current.studentName = current.studentName || result.studentName || studentId
		current.schoolCode = current.schoolCode || result.schoolCode || ''
		current.grade = current.grade || result.grade || ''
		current.countryTotalPoints = Math.max(current.countryTotalPoints || 0, points)
		current.examPoints = Math.max(current.examPoints || 0, examPoints)

		if (score !== null && (current.bestScorePercent === null || score > current.bestScorePercent)) {
			current.bestScorePercent = score
			current.featuredExamTitle = result.title || result.examId || current.featuredExamTitle
		}

		if (countryRank !== null && (current.countryRank === null || countryRank < current.countryRank)) {
			current.countryRank = countryRank
		}

		if (schoolRank !== null && (current.schoolRank === null || schoolRank < current.schoolRank)) {
			current.schoolRank = schoolRank
		}
	}

	return Array.from(students.values())
		.sort(compareRankedStudents)
		.slice(0, 3)
		.map((student, index) => ({
			...student,
			placement: index + 1,
		}))
}

function buildTopRankedStudentsByGrade(results) {
	const groupedResults = new Map()

	for (const result of results) {
		if (!result || result.mode !== 'competitive') {
			continue
		}

		const gradeKey = String(result.grade || '').trim().toLowerCase() || 'unassigned'
		if (!groupedResults.has(gradeKey)) {
			groupedResults.set(gradeKey, [])
		}

		groupedResults.get(gradeKey).push(result)
	}

	return Array.from(groupedResults.entries())
		.map(([gradeKey, gradeResults]) => ({
			gradeKey,
			gradeLabel: formatGradeLabel(gradeResults[0]?.grade || gradeKey),
			students: buildTopRankedStudents(gradeResults),
		}))
		.filter((group) => group.students.length > 0)
		.sort((left, right) => compareGrades(left.gradeKey, right.gradeKey))
}

function summarizeExamResults(results) {
	const scoredResults = results.filter((result) => Number.isFinite(result.bestScorePercent))
	const averageScorePercent = scoredResults.length
		? scoredResults.reduce((total, result) => total + result.bestScorePercent, 0) / scoredResults.length
		: null
	const topScorePercent = scoredResults.length
		? Math.max(...scoredResults.map((result) => result.bestScorePercent))
		: null

	return {
		studentCount: results.length,
		averageScorePercent,
		topScorePercent,
	}
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
	const [selectedGrade, setSelectedGrade] = useState('all')
	const [selectedSchool, setSelectedSchool] = useState('all')
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedPodiumGrade, setSelectedPodiumGrade] = useState('')

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
				success: `Stored points for ${data.summary.processedResultCount} result${data.summary.processedResultCount === 1 ? '' : 's'} in rankings and updated ${data.summary.updatedAttemptCount ?? 0} attempt${data.summary.updatedAttemptCount === 1 ? '' : 's'}.`,
			})
			await reloadResults()
		} catch (error) {
			setRankingSubmitState({ loading: false, error: error.message || 'Unable to submit ranking points', success: '' })
		}
	}

	const competitiveExamResults = resultsOverview.byExam.filter((exam) => exam.mode === 'competitive')
	const competitiveResultsPool = competitiveExamResults.flatMap((exam) =>
		(exam.results || []).map((result) => ({
			...result,
			examId: result.examId || exam.examId,
			title: result.title || exam.title || result.examId || exam.examId,
			subject: result.subject || exam.subject || '',
			grade: result.grade || exam.grade || '',
			schoolCode: result.schoolCode || '',
		}))
	)
	const availableGrades = Array.from(
		competitiveResultsPool.reduce((gradeMap, result) => {
			const normalizedGrade = String(result.grade || '').trim()
			if (!normalizedGrade) {
				return gradeMap
			}

			const gradeKey = normalizeSearchValue(normalizedGrade)
			if (!gradeMap.has(gradeKey)) {
				gradeMap.set(gradeKey, { value: gradeKey, raw: normalizedGrade, label: formatGradeLabel(normalizedGrade) })
			}

			return gradeMap
		}, new Map()).values()
	).sort((left, right) => compareGrades(left.raw, right.raw))
	const schoolScopeResults = competitiveResultsPool.filter((result) => {
		if (selectedResultExamId !== 'all' && result.examId !== selectedResultExamId) {
			return false
		}

		if (selectedGrade !== 'all' && normalizeSearchValue(result.grade) !== selectedGrade) {
			return false
		}

		return true
	})
	const availableSchools = Array.from(
		schoolScopeResults.reduce((schoolMap, result) => {
			const schoolCode = String(result.schoolCode || '').trim()
			if (!schoolCode) {
				return schoolMap
			}

			const schoolKey = normalizeSearchValue(schoolCode)
			if (!schoolMap.has(schoolKey)) {
				schoolMap.set(schoolKey, { value: schoolKey, label: formatSchoolLabel(schoolCode) })
			}

			return schoolMap
		}, new Map()).values()
	).sort((left, right) => left.label.localeCompare(right.label))
	const normalizedSearchQuery = normalizeSearchValue(searchQuery)
	const visibleExamResults = competitiveExamResults
		.filter((exam) => selectedResultExamId === 'all' || exam.examId === selectedResultExamId)
		.map((exam) => {
			const filteredResults = (exam.results || [])
				.map((result) => ({
					...result,
					examId: result.examId || exam.examId,
					title: result.title || exam.title || result.examId || exam.examId,
					subject: result.subject || exam.subject || '',
					grade: result.grade || exam.grade || '',
					schoolCode: result.schoolCode || '',
				}))
				.filter((result) => {
					if (selectedGrade !== 'all' && normalizeSearchValue(result.grade) !== selectedGrade) {
						return false
					}

					if (selectedSchool !== 'all' && normalizeSearchValue(result.schoolCode) !== selectedSchool) {
						return false
					}

					if (!normalizedSearchQuery) {
						return true
					}

					const searchFields = [
						result.studentName,
						result.studentId,
						result.schoolCode,
						result.roundId,
						result.status,
						result.grade,
						exam.examId,
						exam.title,
						exam.subject,
					]

					return searchFields.some((field) => normalizeSearchValue(field).includes(normalizedSearchQuery))
				})
			const summary = summarizeExamResults(filteredResults)

			return {
				...exam,
				results: filteredResults,
				studentCount: summary.studentCount,
				averageScorePercent: summary.averageScorePercent,
				topScorePercent: summary.topScorePercent,
			}
		})
		.filter((exam) => exam.results.length > 0)
	const visibleCompetitiveResults = visibleExamResults.flatMap((exam) => exam.results || [])
	const competitiveVisibleResultCount = visibleExamResults.reduce((count, exam) => count + (exam.results?.length || 0), 0)
	const topRankedStudentsByGrade = buildTopRankedStudentsByGrade(visibleCompetitiveResults)
	const activePodiumGrade = topRankedStudentsByGrade.find((group) => group.gradeKey === selectedPodiumGrade) || topRankedStudentsByGrade[0] || null
	const scoredVisibleResults = visibleCompetitiveResults.filter((result) => Number.isFinite(result.bestScorePercent))
	const averageVisibleScorePercent = scoredVisibleResults.length
		? scoredVisibleResults.reduce((total, result) => total + result.bestScorePercent, 0) / scoredVisibleResults.length
		: null
	const activeSchoolCount = new Set(visibleCompetitiveResults.map((result) => formatSchoolLabel(result.schoolCode))).size
	const activeGradeCount = new Set(visibleCompetitiveResults.map((result) => formatGradeLabel(result.grade))).size
	const featuredExam = [...visibleExamResults].sort((left, right) => {
		if ((right.studentCount || 0) !== (left.studentCount || 0)) {
			return (right.studentCount || 0) - (left.studentCount || 0)
		}

		return (right.topScorePercent || 0) - (left.topScorePercent || 0)
	})[0] || null
	const featuredLeaderboardStudent = topRankedStudentsByGrade
		.flatMap((group) => group.students)
		.sort(compareRankedStudents)[0] || null
	const activeSchoolLabel =
		selectedSchool === 'all'
			? 'All schools'
			: availableSchools.find((school) => school.value === selectedSchool)?.label || formatSchoolLabel(selectedSchool)

	useEffect(() => {
		if (selectedSchool === 'all') {
			return
		}

		if (!availableSchools.some((school) => school.value === selectedSchool)) {
			setSelectedSchool('all')
		}
	}, [availableSchools, selectedSchool])

	useEffect(() => {
		if (!topRankedStudentsByGrade.length) {
			if (selectedPodiumGrade) {
				setSelectedPodiumGrade('')
			}
			return
		}

		if (!topRankedStudentsByGrade.some((group) => group.gradeKey === selectedPodiumGrade)) {
			setSelectedPodiumGrade(topRankedStudentsByGrade[0].gradeKey)
		}
	}, [selectedPodiumGrade, topRankedStudentsByGrade])

	return (
		<div className='google-dashboard'>
			<CompanySidebar />
			<main className='google-main company-main'>
				<div className='exam-shell builder-shell results-page-shell'>
					<section className='hero-panel results-hero-panel'>
						<div className='hero-copy results-hero-copy'>
							<span className='eyebrow'>Competitive Results Center</span>
							<h1>Wider result views for marks, ranks, and leaderboard momentum.</h1>
							<p>
								Track competitive exam marks across schools and grades, then push visible score-derived points into the ranking system from one premium command view.
							</p>
							<div className='hero-actions'>
								<a className='primary-action' href='#student-results'>Open result tables</a>
								<a className='secondary-action' href='#results-podium'>View leaderboard</a>
							</div>
							<div className='results-hero-meta'>
								<div className='results-hero-note'>
									<strong>{selectedResultExamId === 'all' ? 'All competitive exams' : selectedResultExamId}</strong>
									<span>
										Current filters expose {visibleExamResults.length} exam view{visibleExamResults.length === 1 ? '' : 's'} across {activeGradeCount} grade{activeGradeCount === 1 ? '' : 's'}.
									</span>
								</div>
								<div className='results-hero-note'>
									<strong>{selectedSchool === 'all' ? 'Open school scope' : activeSchoolLabel}</strong>
									<span>
										{activeSchoolCount} school{activeSchoolCount === 1 ? '' : 's'} remain in the current ranking lens with {competitiveVisibleResultCount} visible result{competitiveVisibleResultCount === 1 ? '' : 's'}.
									</span>
								</div>
							</div>
						</div>

						<div className='results-hero-card'>
							<div className='builder-stat-grid results-hero-stats'>
								<StatCard label='Visible Results' value={competitiveVisibleResultCount} tone='gold' />
								<StatCard label='Competitive Exams' value={visibleExamResults.length} tone='teal' />
								<StatCard label='Schools In View' value={activeSchoolCount} tone='coral' />
								<StatCard label='Average Mark' value={formatPercent(averageVisibleScorePercent)} tone='teal' />
							</div>

							<div className='results-insight-strip'>
								<div className='results-insight-card accent'>
									<h3>{featuredLeaderboardStudent ? featuredLeaderboardStudent.studentName : 'No current leader'}</h3>
									<p>
										{featuredLeaderboardStudent
											? `${featuredLeaderboardStudent.schoolCode || 'Unknown school'} leads the visible leaderboard with ${featuredLeaderboardStudent.countryTotalPoints ?? 0} total points and ${formatPercent(featuredLeaderboardStudent.bestScorePercent)} best score.`
											: 'Leaderboard insights will appear once competitive result records are visible.'}
									</p>
								</div>
								<div className='results-insight-card'>
									<h3>{featuredExam ? featuredExam.title || featuredExam.examId : 'No visible exam yet'}</h3>
									<p>
										{featuredExam
											? `${featuredExam.studentCount} student result${featuredExam.studentCount === 1 ? '' : 's'} are visible here with a top mark of ${formatPercent(featuredExam.topScorePercent)}.`
											: 'Relax or change the filters to surface the strongest competitive exam view.'}
									</p>
								</div>
							</div>
						</div>
					</section>

			<section className='section-block podium-section' id='results-podium'>
				<div className='section-header-row'>
					<div className='section-heading'>
						<span className='section-kicker'>Leaderboard Spotlight</span>
						<h2>Top three ranked students by grade</h2>
					</div>
					
				</div>

				{topRankedStudentsByGrade.length ? (
					<div className='podium-grade-stack'>
						<div className='podium-grade-selector' role='tablist' aria-label='Grade leaderboard selector'>
							{topRankedStudentsByGrade.map((group) => (
								<button
									key={group.gradeKey}
									className={`podium-grade-button${activePodiumGrade?.gradeKey === group.gradeKey ? ' active' : ''}`}
									type='button'
									onClick={() => setSelectedPodiumGrade(group.gradeKey)}
								>
									{group.gradeLabel}
								</button>
							))}
						</div>

						{activePodiumGrade ? (
							<section className='podium-grade-group' key={activePodiumGrade.gradeKey}>
								<div className='podium-grade-header'>
									<div className='podium-grade-heading'>
										<span className='pill pill-teal'>{activePodiumGrade.gradeLabel}</span>
										<h3>{activePodiumGrade.gradeLabel} leaderboard</h3>
									</div>
								</div>

								<div className='results-podium'>
									{activePodiumGrade.students.map((student) => (
										<article className={`podium-card rank-${student.placement}`} key={`${activePodiumGrade.gradeKey}-${student.studentId}`}>
											<div className='podium-rank-chip'>{formatOrdinal(student.placement)}</div>
											<div className='podium-avatar'>{String(student.studentName || student.studentId).charAt(0).toUpperCase()}</div>
											<p className='podium-title'>
												{student.countryRank !== null
													? `Country rank ${formatOrdinal(student.countryRank)}`
													: 'Top competitive scorer'}
											</p>
											<h3>{student.studentName || student.studentId}</h3>
											<p className='podium-subtitle'>
												{student.studentId}
												{student.schoolCode ? ` • ${student.schoolCode}` : ''}
											</p>
											<div className='podium-metrics'>
												<div>
													<span>Best score</span>
													<strong>{formatPercent(student.bestScorePercent)}</strong>
												</div>
												<div>
													<span>Total points</span>
													<strong>{student.countryTotalPoints ?? 0}</strong>
												</div>
											</div>
											<p className='podium-footnote'>
												{student.featuredExamTitle || 'Competitive exam result'}
												{student.resultCount > 1 ? ` • ${student.resultCount} ranked results` : ''}
											</p>
										</article>
									))}
								</div>
							</section>
						) : null}
					</div>
				) : (
					<div className='empty-state'>No competitive ranking data is available for the current filter yet.</div>
				)}
			</section>

			{loadState.error ? <div className='status-banner warning'>{loadState.error}</div> : null}
			{rankingSubmitState.error ? <div className='status-banner warning'>{rankingSubmitState.error}</div> : null}
			{rankingSubmitState.success ? <div className='status-banner success-banner'>{rankingSubmitState.success}</div> : null}

			<section className='section-block' id='student-results'>
				<div className='section-header-row'>
					<div className='section-heading'>
						<span className='section-kicker'>Student Results</span>
						<h2>Competitive marks and points by exam</h2>
					</div>
				</div>

				<div className='results-command-deck'>
					<div className='results-filter-panel'>
						<div className='results-filter-copy'>
							<span className='section-kicker'>Command View</span>
								<h3>{selectedResultExamId === 'all' ? 'Viewing every competitive exam' : `Viewing ${selectedResultExamId}`}</h3>
								<p>Use exam, grade, school, and search filters together to narrow the leaderboard, summaries, and detailed competitive result tables.</p>
						</div>

							<div className='filter-bar results-filter-bar'>
								<label className='filter-field results-search-field'>
									<span>Search</span>
									<input
										type='text'
										value={searchQuery}
										onChange={(event) => setSearchQuery(event.target.value)}
										placeholder='Student, ID, school, exam, round...'
									/>
								</label>

								<label className='filter-field'>
									<span>Grade</span>
									<select value={selectedGrade} onChange={(event) => setSelectedGrade(event.target.value)}>
										<option value='all'>All grades</option>
										{availableGrades.map((grade) => (
											<option key={grade.value} value={grade.value}>
												{grade.label}
											</option>
										))}
									</select>
								</label>

								<label className='filter-field'>
									<span>School</span>
									<select value={selectedSchool} onChange={(event) => setSelectedSchool(event.target.value)}>
										<option value='all'>All schools</option>
										{availableSchools.map((school) => (
											<option key={school.value} value={school.value}>
												{school.label}
											</option>
										))}
									</select>
								</label>

							<label className='filter-field'>
								<span>Exam filter</span>
								<select value={selectedResultExamId} onChange={(event) => setSelectedResultExamId(event.target.value)}>
									<option value='all'>All competitive exams</option>
									{competitiveExamResults.map((exam) => (
										<option key={exam.examId} value={exam.examId}>
											{exam.examId}
										</option>
									))}
								</select>
							</label>
						</div>
					</div>

					<div className='results-rule-strip'>
						{(resultsOverview.pointRules || []).map((rule) => (
							<div className='results-rule-card' key={`${rule.minimumPercent}-${rule.points}`}>
								<span className='pill pill-gold'>Points</span>
								<h3>{rule.points}</h3>
								<p>Score {rule.minimumPercent}% and above on competitive exams.</p>
							</div>
						))}
					</div>
				</div>

				{visibleExamResults.length ? (
					<div className='results-stack'>
						{visibleExamResults.map((exam) => (
							<article className='catalog-card results-card' key={exam.examId}>
								<div className='section-header-row results-card-header'>
									<div>
										<div className='catalog-meta-row'>
											<span className='pill pill-teal'>{exam.grade || 'unknown grade'}</span>
											<span className='pill pill-coral'>{exam.mode || 'practice'}</span>
											{exam.subject ? <span className='pill'>{exam.subject}</span> : null}
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
												<th>Country Total</th>
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
													<td>{result.examPoints ?? '-'}</td>
													<td>{result.countryTotalPoints ?? '-'}</td>
													<td>{result.status || '-'}</td>
													<td>{result.countryRank ?? '-'}</td>
													<td>{result.schoolRank ?? '-'}</td>
													<td>{formatDateTime(result.lastSubmittedAt)}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>

								<p className='inline-note results-card-note'>
									Country total points come from the ranking node. Competitive exam points use this page rule: 90%+ = 4, 80%+ = 3, 70%+ = 2, 60%+ = 1.
								</p>
							</article>
						))}
					</div>
				) : (
					<div className='empty-state'>No competitive student results found for the selected exam yet.</div>
				)}

				<div className='results-submit-row'>
					<p className='inline-note'>
						Submit converts visible competitive exam score percent values into points and writes them to the rankings database.
					</p>
					<button
						className='primary-action'
						type='button'
						onClick={handleSubmitRankingPoints}
						disabled={rankingSubmitState.loading || competitiveVisibleResultCount === 0}
					>
						{rankingSubmitState.loading
							? 'Submitting points...'
							: `Submit ${selectedResultExamId === 'all' ? 'visible competitive' : 'selected competitive exam'} points`}
					</button>
				</div>
			</section>
				</div>
			</main>
		</div>
	)
}