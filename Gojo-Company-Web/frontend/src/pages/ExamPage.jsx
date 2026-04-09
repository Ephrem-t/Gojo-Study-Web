import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import CompanySidebar from '../components/CompanySidebar'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

const SUBJECT_CODE_MAP = {
	GENERAL_SCIENCE: 'GS',
	PHYSICS: 'PHY',
	MATHEMATICS: 'MATH',
	MATH: 'MATH',
	CHEMISTRY: 'CHEM',
	BIOLOGY: 'BIO',
	ENGLISH: 'ENG',
	SOCIAL_STUDIES: 'SS',
}

const WORD_CODE_MAP = {
	GENERAL: 'G',
	SCIENCE: 'S',
	PHYSICS: 'PHY',
	MATHEMATICS: 'MATH',
	MATH: 'MATH',
	ALGEBRA: 'ALG',
	CHEMISTRY: 'CHEM',
	BIOLOGY: 'BIO',
	ENGLISH: 'ENG',
	ENTRANCE: 'ENT',
	PRACTICE: 'PRACTICE',
	COMPETITIVE: 'COMP',
	FULL: 'FULL',
	EXAM: 'EXAM',
}

function createQuestion(index) {
	return {
		key: `Q${index}`,
		question: '',
		type: 'mcq',
		correctAnswer: 'A',
		explanation: '',
		marks: 1,
		options: {
			A: '',
			B: '',
			C: '',
			D: '',
		},
	}
}

const defaultForm = {
	questionBankId: '',
	questionBank: {
		metadata: {
			chapter: '',
			difficulty: 'medium',
			grade: 'grade7',
			subject: '',
			totalQuestions: '',
		},
		questions: [createQuestion(1)],
	},
	examId: '',
	exam: {
		title: '',
		maxAttempts: 1,
		passPercent: '',
		questionPoolSize: '',
		rankingEnabled: false,
		scoringEnabled: false,
		attemptRefillEnabled: false,
		attemptRefillIntervalMs: '',
		timeLimit: 1800,
		totalQuestions: '',
		textKey: 'instructions',
		includeLeadingNull: true,
		textItems: ['', ''],
		scoring: {
			diamondPercent: '',
			goldPercent: '',
			maxPoints: '',
			platinumPercent: '',
		},
	},
	packageId: '',
	package: {
		active: true,
		name: '',
		description: '',
		grade: 'grade7',
		type: 'practice',
		entranceYear: String(new Date().getFullYear()),
		packageIcon: '',
		subjectKey: '',
		subjectName: '',
		roundId: 'R1',
		round: {
			chapter: '',
			name: '',
			status: 'active',
			createdAt: '',
			updatedAt: '',
			startTimestamp: '',
			endTimestamp: '',
			resultReleaseTimestamp: '',
		},
	},
}

const roundTimestampFields = [
	{
		key: 'createdAt',
		label: 'Created time',
		hint: 'When this round record was first created.',
	},
	{
		key: 'updatedAt',
		label: 'Last updated time',
		hint: 'When you last changed this round.',
	},
	{
		key: 'startTimestamp',
		label: 'Round starts',
		hint: 'Students can start the round from this time.',
	},
	{
		key: 'endTimestamp',
		label: 'Round ends',
		hint: 'After this time, the round should be closed.',
	},
	{
		key: 'resultReleaseTimestamp',
		label: 'Results visible from',
		hint: 'Students can see results after this time.',
	},
]

function trimText(value) {
	return String(value || '').trim()
}

function hasContent(value) {
	return trimText(value).length > 0
}

function toOptionalNumber(value) {
	const normalized = trimText(value)
	if (!normalized) {
		return null
	}

	const parsed = Number(normalized)
	return Number.isFinite(parsed) ? parsed : null
}

function toOptionalTimestamp(value) {
	const normalized = trimText(value)
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

function formatTimestampForInput(value) {
	const timestamp = toOptionalTimestamp(value)
	if (timestamp === null) {
		return ''
	}

	const date = new Date(timestamp)
	if (Number.isNaN(date.getTime())) {
		return ''
	}

	const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000
	return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16)
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

function normalizeIdToken(value) {
	return trimText(value)
		.replace(/[^A-Za-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.toUpperCase()
}

function toGradeCode(value) {
	const normalized = normalizeIdToken(value)
	if (!normalized) {
		return ''
	}

	const match = normalized.match(/(\d{1,2})/)
	if (match) {
		return `G${match[1]}`
	}

	if (normalized.startsWith('G')) {
		return normalized
	}

	return normalized
}

function abbreviateWord(value) {
	const normalized = normalizeIdToken(value)
	if (!normalized) {
		return ''
	}

	if (WORD_CODE_MAP[normalized]) {
		return WORD_CODE_MAP[normalized]
	}

	if (/^CH\d+$/.test(normalized)) {
		return normalized
	}

	if (/^\d+$/.test(normalized)) {
		return normalized
	}

	if (normalized.length <= 4) {
		return normalized
	}

	return normalized.slice(0, 3)
}

function toSubjectCode(value) {
	const normalized = normalizeIdToken(value)
	if (!normalized) {
		return ''
	}

	if (SUBJECT_CODE_MAP[normalized]) {
		return SUBJECT_CODE_MAP[normalized]
	}

	const parts = normalized.split('_').filter(Boolean)
	if (parts.length > 1) {
		return parts.map(abbreviateWord).join('_')
	}

	return abbreviateWord(normalized)
}

function toChapterCode(value) {
	const normalized = normalizeIdToken(value)
	if (!normalized) {
		return ''
	}

	if (/^ENT(_\d{4})?$/.test(normalized)) {
		return normalized
	}

	if (/^CH\d+$/.test(normalized)) {
		return normalized
	}

	const parts = normalized.split('_').filter(Boolean)
	if (parts.length > 1) {
		return parts.map(abbreviateWord).join('_')
	}

	return abbreviateWord(normalized)
}

function extractYearToken(...values) {
	for (const value of values) {
		const match = String(value || '').match(/\b(19\d{2}|20\d{2})\b/)
		if (match) {
			return match[1]
		}
	}
	return ''
}

function normalizeExamMode(value) {
	const normalized = trimText(value).toLowerCase()
	return ['practice', 'competitive', 'entrance'].includes(normalized) ? normalized : 'practice'
}

function isEntranceFlow(form) {
	return normalizeExamMode(form.package.type) === 'entrance'
}

function normalizeEntranceYear(value) {
	const normalized = trimText(value)
	return /^\d{4}$/.test(normalized) ? normalized : ''
}

function buildSuggestedRoundId(form) {
	const examMode = normalizeExamMode(form.package.type)
	if (examMode === 'entrance') {
		return 'E1'
	}

	return examMode === 'competitive' ? 'R1' : 'P1'
}

function toCompetitiveSetCode(roundId) {
	const normalized = normalizeIdToken(roundId)
	const match = normalized.match(/^R(\d+)$/)
	if (match) {
		const roundNumber = Number(match[1])
		if (roundNumber >= 1 && roundNumber <= 26) {
			return `SET_${String.fromCharCode(64 + roundNumber)}`
		}
	}

	if (!normalized) {
		return 'SET_A'
	}

	if (normalized.startsWith('SET_')) {
		return normalized
	}

	return `SET_${normalized}`
}

function inferEntranceCode(form) {
	const entranceYear = normalizeEntranceYear(form.package.entranceYear)
	return entranceYear ? `ENT_${entranceYear}` : 'ENT'
}

function inferCompetitiveYear(form) {
	const timestampValues = [
		form.package.round.startTimestamp,
		form.package.round.endTimestamp,
		form.package.round.resultReleaseTimestamp,
		form.package.round.createdAt,
		form.package.round.updatedAt,
	]

	for (const value of timestampValues) {
		const timestamp = toOptionalTimestamp(value)
		if (timestamp !== null) {
			return String(new Date(timestamp).getFullYear())
		}
	}

	return extractYearToken(form.package.name, form.package.description) || String(new Date().getFullYear())
}

function joinIdParts(prefix, parts) {
	const cleanParts = parts.map(normalizeIdToken).filter(Boolean)
	return [prefix, ...cleanParts].join('_')
}

function buildGeneratedIds(form) {
	const gradeCode = toGradeCode(form.questionBank.metadata.grade || form.package.grade)
	const subjectCode = toSubjectCode(form.questionBank.metadata.subject || form.package.subjectKey)
	const chapterCode = toChapterCode(form.questionBank.metadata.chapter || form.package.round.chapter)
	const roundCode = normalizeIdToken(form.package.roundId) || buildSuggestedRoundId(form)
	const examMode = normalizeExamMode(form.package.type)

	let questionBankId = ''
	let examId = ''
	let packageId = ''

	if (examMode === 'entrance') {
		const entranceCode = inferEntranceCode(form)
		questionBankId = joinIdParts('QB', [gradeCode, subjectCode, entranceCode])
		examId = joinIdParts('EX', [gradeCode, subjectCode, entranceCode])
		packageId = joinIdParts('PKG', ['ENTRANCE', gradeCode, normalizeEntranceYear(form.package.entranceYear) || 'YEAR'])
	} else if (examMode === 'competitive') {
		questionBankId = joinIdParts('QB', [gradeCode, subjectCode, chapterCode, toCompetitiveSetCode(roundCode)])
		examId = joinIdParts('EX', [gradeCode, subjectCode, chapterCode, roundCode || 'R1'])
		packageId = joinIdParts('PKG', ['COMP', gradeCode, inferCompetitiveYear(form)])
	} else {
		questionBankId = joinIdParts('QB', [gradeCode, subjectCode, chapterCode, 'PRACTICE'])
		examId = joinIdParts('EX', [gradeCode, subjectCode, chapterCode, roundCode || 'P1'])
		packageId = joinIdParts('PKG', ['PRACTICE', gradeCode])
	}

	return {
		questionBankId,
		examId,
		packageId,
	}
}

function serializeInstructionItems(items, includeLeadingNull) {
	const cleanItems = items.map(trimText).filter(Boolean)
	if (!cleanItems.length) {
		return undefined
	}

	return includeLeadingNull ? [null, ...cleanItems] : cleanItems
}

function buildQuestionBankNode(form) {
	const activeQuestions = form.questionBank.questions.filter((item) => {
		return hasContent(item.question) || Object.values(item.options).some(hasContent)
	})

	const questions = activeQuestions.reduce((result, item, index) => {
		const key = trimText(item.key) || `Q${index + 1}`
		const options = Object.entries(item.options).reduce((optionResult, [optionKey, optionValue]) => {
			if (hasContent(optionValue)) {
				optionResult[optionKey] = trimText(optionValue)
			}
			return optionResult
		}, {})

		result[key] = {
			correctAnswer: trimText(item.correctAnswer) || 'A',
			explanation: trimText(item.explanation),
			marks: toOptionalNumber(item.marks) ?? 1,
			options,
			question: trimText(item.question),
			type: trimText(item.type) || 'mcq',
		}
		return result
	}, {})

	const totalQuestions = toOptionalNumber(form.questionBank.metadata.totalQuestions) ?? (Object.keys(questions).length || 1)

	return {
		metadata: {
			chapter: trimText(form.questionBank.metadata.chapter),
			difficulty: trimText(form.questionBank.metadata.difficulty),
			grade: trimText(form.questionBank.metadata.grade),
			subject: trimText(form.questionBank.metadata.subject),
			totalQuestions,
		},
		questions,
	}
}

function buildExamNode(form) {
	const questionBankNode = buildQuestionBankNode(form)
	const derivedTotalQuestions = questionBankNode.metadata.totalQuestions
	const textItems = serializeInstructionItems(form.exam.textItems, form.exam.includeLeadingNull)
	const examMode = normalizeExamMode(form.package.type)
	const exam = {
		mode: examMode,
		questionBankId: trimText(form.questionBankId),
		maxAttempts: toOptionalNumber(form.exam.maxAttempts) ?? 1,
		questionPoolSize: toOptionalNumber(form.exam.questionPoolSize) ?? derivedTotalQuestions,
		rankingEnabled: examMode === 'competitive',
		scoringEnabled: Boolean(form.exam.scoringEnabled),
		timeLimit: toOptionalNumber(form.exam.timeLimit) ?? 1800,
		totalQuestions: toOptionalNumber(form.exam.totalQuestions) ?? derivedTotalQuestions,
	}

	if (hasContent(form.exam.title)) {
		exam.title = trimText(form.exam.title)
	}

	if (form.exam.attemptRefillEnabled) {
		exam.attemptRefillEnabled = true
		if (toOptionalNumber(form.exam.attemptRefillIntervalMs) !== null) {
			exam.attemptRefillIntervalMs = toOptionalNumber(form.exam.attemptRefillIntervalMs)
		}
	}

	if (toOptionalNumber(form.exam.passPercent) !== null) {
		exam.passPercent = toOptionalNumber(form.exam.passPercent)
	}

	if (textItems) {
		exam[form.exam.textKey] = textItems
	}

	if (form.exam.scoringEnabled) {
		const scoring = {}
		for (const [key, value] of Object.entries(form.exam.scoring)) {
			const parsed = toOptionalNumber(value)
			if (parsed !== null) {
				scoring[key] = parsed
			}
		}

		if (Object.keys(scoring).length) {
			exam.scoring = scoring
		}
	}

	return exam
}

function buildPackageNode(form) {
	const examMode = normalizeExamMode(form.package.type)
	const round = {
		examId: trimText(form.examId),
		name: trimText(form.package.round.name),
		status: trimText(form.package.round.status) || 'active',
	}

	if (hasContent(form.package.round.chapter)) {
		round.chapter = trimText(form.package.round.chapter)
	}

	for (const field of ['createdAt', 'updatedAt', 'startTimestamp', 'endTimestamp', 'resultReleaseTimestamp']) {
		const parsed = toOptionalTimestamp(form.package.round[field])
		if (parsed !== null) {
			round[field] = parsed
		}
	}

	const packageNode = {
		active: Boolean(form.package.active),
		description: trimText(form.package.description),
		grade: trimText(form.package.grade),
		name: trimText(form.package.name),
		subjects: {
			[trimText(form.package.subjectKey) || 'subject_key']: {
				name: trimText(form.package.subjectName),
				rounds: {
					[trimText(form.package.roundId) || 'R1']: round,
				},
			},
		},
		type: examMode,
	}

	if (examMode === 'entrance' && normalizeEntranceYear(form.package.entranceYear)) {
		packageNode.entranceYear = Number(normalizeEntranceYear(form.package.entranceYear))
	}

	if (hasContent(form.package.packageIcon)) {
		packageNode.packageIcon = trimText(form.package.packageIcon)
	}

	return packageNode
}

function buildSubmission(form, overwrite) {
	const questionBankId = trimText(form.questionBankId) || 'QUESTION_BANK_ID'
	const examId = trimText(form.examId) || 'EXAM_ID'
	const packageId = trimText(form.packageId) || 'PACKAGE_ID'
	const questionBank = buildQuestionBankNode(form)
	const exam = buildExamNode(form)
	const packageNode = buildPackageNode(form)

	return {
		payload: {
			questionBankId,
			questionBank,
			examId,
			exam,
			packageId,
			package: packageNode,
			overwrite,
		},
		preview: {
			questionBanks: {
				questionBanks: {
					[questionBankId]: questionBank,
				},
			},
			companyExams: {
				exams: {
					[examId]: exam,
				},
				packages: {
					[packageId]: packageNode,
				},
			},
		},
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

export default function ExamPage() {
	const [form, setForm] = useState(defaultForm)
	const [overview, setOverview] = useState({ stats: {}, exams: [], packages: [], questionBanks: [] })
	const [loadState, setLoadState] = useState({ loading: true, error: '' })
	const [submitState, setSubmitState] = useState({ loading: false, error: '', success: '' })
	const [allowOverwrite, setAllowOverwrite] = useState(false)
	const [manualIds, setManualIds] = useState({ questionBank: false, exam: false, package: false })

	const { payload, preview } = buildSubmission(form, allowOverwrite)
	const generatedIds = buildGeneratedIds(form)
	const suggestedRoundId = buildSuggestedRoundId(form)
	const entranceFlow = isEntranceFlow(form)
	const examMode = normalizeExamMode(form.package.type)
	const competitiveExams = overview.exams.filter((item) => item.mode === 'competitive')
	const practiceExams = overview.exams.filter((item) => item.mode === 'practice')
	const entranceExams = overview.exams.filter((item) => item.mode === 'entrance')

	useEffect(() => {
		async function loadOverview() {
			setLoadState({ loading: true, error: '' })

			try {
				const overviewResponse = await fetch(`${API_BASE_URL}/api/company-exams/overview`)
				const overviewData = await overviewResponse.json()

				if (!overviewResponse.ok) {
					throw new Error(overviewData.error || 'Unable to load current exam data')
				}
				setOverview(overviewData)
				setLoadState({ loading: false, error: '' })
			} catch (error) {
				setLoadState({ loading: false, error: error.message || 'Unable to connect to backend' })
			}
		}

		loadOverview()
	}, [])

	useEffect(() => {
		setForm((current) => {
			const currentRoundId = trimText(current.package.roundId)
			const nextRoundId = buildSuggestedRoundId(current)
			const shouldReplaceRoundId = !currentRoundId || ['R1', 'P1', 'E1'].includes(currentRoundId)

			if (!shouldReplaceRoundId || currentRoundId === nextRoundId) {
				return current
			}

			return {
				...current,
				package: {
					...current.package,
					roundId: nextRoundId,
				},
			}
		})
	}, [form.package.type])

	useEffect(() => {
		setForm((current) => {
			const nextRankingEnabled = normalizeExamMode(current.package.type) === 'competitive'
			if (current.exam.rankingEnabled === nextRankingEnabled) {
				return current
			}

			return {
				...current,
				exam: {
					...current.exam,
					rankingEnabled: nextRankingEnabled,
				},
			}
		})
	}, [form.package.type])

	useEffect(() => {
		setForm((current) => {
			const nextQuestionBankId = manualIds.questionBank ? current.questionBankId : generatedIds.questionBankId
			const nextExamId = manualIds.exam ? current.examId : generatedIds.examId
			const nextPackageId = manualIds.package ? current.packageId : generatedIds.packageId

			if (
				current.questionBankId === nextQuestionBankId &&
				current.examId === nextExamId &&
				current.packageId === nextPackageId
			) {
				return current
			}

			return {
				...current,
				questionBankId: nextQuestionBankId,
				examId: nextExamId,
				packageId: nextPackageId,
			}
		})
	}, [generatedIds.questionBankId, generatedIds.examId, generatedIds.packageId, manualIds])

	function updateForm(updater) {
		setForm((current) => updater(current))
	}

	function updateMetadata(field, value) {
		updateForm((current) => ({
			...current,
			questionBank: {
				...current.questionBank,
				metadata: {
					...current.questionBank.metadata,
					[field]: value,
				},
			},
		}))
	}

	function updateExamField(field, value) {
		updateForm((current) => ({
			...current,
			exam: {
				...current.exam,
				[field]: value,
			},
		}))
	}

	function updateExamMode(value) {
		updateForm((current) => ({
			...current,
			package: {
				...current.package,
				type: normalizeExamMode(value),
			},
		}))
	}

	function updatePackageField(field, value) {
		updateForm((current) => ({
			...current,
			package: {
				...current.package,
				[field]: value,
			},
		}))
	}

	function updateRoundField(field, value) {
		updateForm((current) => ({
			...current,
			package: {
				...current.package,
				round: {
					...current.package.round,
					[field]: value,
				},
			},
		}))
	}

	function toggleManualId(field) {
		setManualIds((current) => ({
			...current,
			[field]: !current[field],
		}))
	}

	function updateQuestion(index, field, value) {
		updateForm((current) => ({
			...current,
			questionBank: {
				...current.questionBank,
				questions: current.questionBank.questions.map((item, itemIndex) => {
					if (itemIndex !== index) {
						return item
					}
					return {
						...item,
						[field]: value,
					}
				}),
			},
		}))
	}

	function updateQuestionOption(index, optionKey, value) {
		updateForm((current) => ({
			...current,
			questionBank: {
				...current.questionBank,
				questions: current.questionBank.questions.map((item, itemIndex) => {
					if (itemIndex !== index) {
						return item
					}
					return {
						...item,
						options: {
							...item.options,
							[optionKey]: value,
						},
					}
				}),
			},
		}))
	}

	function addQuestion() {
		updateForm((current) => ({
			...current,
			questionBank: {
				...current.questionBank,
				questions: [...current.questionBank.questions, createQuestion(current.questionBank.questions.length + 1)],
			},
		}))
	}

	function removeQuestion(index) {
		updateForm((current) => ({
			...current,
			questionBank: {
				...current.questionBank,
				questions: current.questionBank.questions.filter((_, itemIndex) => itemIndex !== index),
			},
		}))
	}

	function updateInstruction(index, value) {
		updateForm((current) => ({
			...current,
			exam: {
				...current.exam,
				textItems: current.exam.textItems.map((item, itemIndex) => (itemIndex === index ? value : item)),
			},
		}))
	}

	function addInstruction() {
		updateForm((current) => ({
			...current,
			exam: {
				...current.exam,
				textItems: [...current.exam.textItems, ''],
			},
		}))
	}

	function removeInstruction(index) {
		updateForm((current) => ({
			...current,
			exam: {
				...current.exam,
				textItems: current.exam.textItems.filter((_, itemIndex) => itemIndex !== index),
			},
		}))
	}

	async function reloadOverview() {
		try {
			const response = await fetch(`${API_BASE_URL}/api/company-exams/overview`)
			const data = await response.json()
			if (!response.ok) {
				throw new Error(data.error || 'Unable to reload overview')
			}
			setOverview(data)
		} catch {
			return
		}
	}

	async function handleSubmit(event) {
		event.preventDefault()
		setSubmitState({ loading: true, error: '', success: '' })

		try {
			const response = await fetch(`${API_BASE_URL}/api/platform/company-exams/save-record`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			})
			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Save failed')
			}

			setSubmitState({
				loading: false,
				error: '',
				success: `Saved ${data.saved.questionBankId}, ${data.saved.examId}, and ${data.saved.packageId} into ${data.location}.`,
			})
			await reloadOverview()
		} catch (error) {
			setSubmitState({ loading: false, error: error.message || 'Save failed', success: '' })
		}
	}

	return (
		<div className='google-dashboard'>
			<CompanySidebar />
			<main className='google-main company-main'>
				<div className='exam-shell builder-shell'>
			<section className='hero-panel'>
				<div className='hero-copy'>
					<span className='eyebrow'>Platform1 Exam Builder</span>
					<h1>Write exam data </h1>
					<p>
						This screen builds one question bank, one linked exam, and one package round for practice, competitive, or
						entrance flows, then saves them with a single backend update under Platform1.
					</p>
					<div className='hero-actions'>
						<a className='primary-action' href='#builder-form'>Create a record</a>
					</div>
					{loadState.error ? <div className='status-banner warning'>{loadState.error}</div> : null}
					{submitState.error ? <div className='status-banner warning'>{submitState.error}</div> : null}
					{submitState.success ? <div className='status-banner success-banner'>{submitState.success}</div> : null}
				</div>

				<div className='hero-card'>
					<span className='hero-card-label'>Current Snapshot</span>
					<div className='builder-stat-grid'>
						<StatCard label='Packages' value={overview.stats.packageCount ?? 0} tone='gold' />
						<StatCard label='Competitive Exams' value={overview.stats.competitiveExamCount ?? 0} tone='teal' />
						<StatCard label='Practice Exams' value={overview.stats.practiceExamCount ?? 0} tone='coral' />
						<StatCard label='Entrance Exams' value={overview.stats.entranceExamCount ?? 0} tone='teal' />
					</div>
					<p className='inline-note'>
						{loadState.loading ? 'Loading current exam content...' : 'Overview merges legacy root data with Platform1 data.'}
					</p>
				</div>
			</section>

			<section className='section-block' id='builder-form'>
				<div className='section-header-row'>
					<div className='section-heading'>
						<span className='section-kicker'>Data Entry</span>
						<h2>Exam record editor</h2>
					</div>

					<label className='toggle-field'>
						<input type='checkbox' checked={allowOverwrite} onChange={(event) => setAllowOverwrite(event.target.checked)} />
						<span>Allow overwrite for existing Platform1 IDs</span>
					</label>
				</div>

				<div className='builder-grid'>
					<form className='builder-form-panel' onSubmit={handleSubmit}>
						<section className='form-card'>
							<div className='section-heading compact-heading'>
								<span className='section-kicker'>Question Bank</span>
								<h2>Metadata and questions</h2>
							</div>

							<div className='form-grid two-column'>
								<label className='field'>
									<div className='field-heading'>
										<span>Question bank ID</span>
										<button className='field-toggle' type='button' onClick={() => toggleManualId('questionBank')}>
											{manualIds.questionBank ? 'Use auto ID' : 'Manual edit'}
										</button>
									</div>
									<input
										className={!manualIds.questionBank ? 'field-auto-input' : ''}
										value={form.questionBankId}
										onChange={(event) => setForm({ ...form, questionBankId: event.target.value })}
										placeholder='QB_G7_GS_CH1_SET_A'
										readOnly={!manualIds.questionBank}
										required
									/>
									<small className='field-hint'>
										{manualIds.questionBank
											? 'Manual mode is on for this ID.'
											: generatedIds.questionBankId || 'Auto format starts after you fill grade, subject, chapter, and mode.'}
									</small>
								</label>

								<label className='field'>
									<span>Subject</span>
									<input value={form.questionBank.metadata.subject} onChange={(event) => updateMetadata('subject', event.target.value)} placeholder='general_science' required />
								</label>

								<label className='field'>
									<span>Grade</span>
									<input value={form.questionBank.metadata.grade} onChange={(event) => updateMetadata('grade', event.target.value)} placeholder='grade7' required />
								</label>

								<label className='field'>
									<span>Chapter</span>
									<input value={form.questionBank.metadata.chapter} onChange={(event) => updateMetadata('chapter', event.target.value)} placeholder='ch1' required />
								</label>

								<label className='field'>
									<span>Difficulty</span>
									<select value={form.questionBank.metadata.difficulty} onChange={(event) => updateMetadata('difficulty', event.target.value)}>
										<option value='easy'>easy</option>
										<option value='medium'>medium</option>
										<option value='hard'>hard</option>
										<option value='mixed'>mixed</option>
									</select>
								</label>

								<label className='field'>
									<span>Total questions</span>
									<input type='number' min='1' value={form.questionBank.metadata.totalQuestions} onChange={(event) => updateMetadata('totalQuestions', event.target.value)} placeholder='120' />
								</label>
							</div>

							<div className='row-header'>
								<h3>Questions</h3>
								<button className='secondary-action inline-button' type='button' onClick={addQuestion}>
									Add question
								</button>
							</div>

							<div className='stack-list'>
								{form.questionBank.questions.map((question, index) => (
									<article className='editor-card' key={`${question.key}-${index}`}>
										<div className='row-header'>
											<h3>Question {index + 1}</h3>
											{form.questionBank.questions.length > 1 ? (
												<button className='ghost-button' type='button' onClick={() => removeQuestion(index)}>
													Remove
												</button>
											) : null}
										</div>

										<div className='form-grid two-column'>
											<label className='field'>
												<span>Question key</span>
												<input value={question.key} onChange={(event) => updateQuestion(index, 'key', event.target.value)} placeholder='Q1' required />
											</label>

											<label className='field'>
												<span>Type</span>
												<select value={question.type} onChange={(event) => updateQuestion(index, 'type', event.target.value)}>
													<option value='mcq'>mcq</option>
													<option value='written'>written</option>
													<option value='true_false'>true_false</option>
													<option value='fill_blank'>fill_blank</option>
												</select>
											</label>

											<label className='field'>
												<span>Correct answer</span>
												<input value={question.correctAnswer} onChange={(event) => updateQuestion(index, 'correctAnswer', event.target.value)} placeholder='B' required />
											</label>

											<label className='field'>
												<span>Marks</span>
												<input type='number' min='1' value={question.marks} onChange={(event) => updateQuestion(index, 'marks', event.target.value)} required />
											</label>
										</div>

										<label className='field'>
											<span>Question text</span>
											<textarea value={question.question} onChange={(event) => updateQuestion(index, 'question', event.target.value)} placeholder='Which planet is known as the Red Planet?' rows='3' required />
										</label>

										<label className='field'>
											<span>Explanation</span>
											<textarea value={question.explanation} onChange={(event) => updateQuestion(index, 'explanation', event.target.value)} placeholder='Explain why the answer is correct.' rows='2' />
										</label>

										<div className='option-grid'>
											{Object.keys(question.options).map((optionKey) => (
												<label className='field' key={optionKey}>
													<span>Option {optionKey}</span>
													<input value={question.options[optionKey]} onChange={(event) => updateQuestionOption(index, optionKey, event.target.value)} placeholder={`Choice ${optionKey}`} />
												</label>
											))}
										</div>
									</article>
								))}
							</div>
						</section>

						<section className='form-card'>
							<div className='section-heading compact-heading'>
								<span className='section-kicker'>Exam</span>
								<h2>Linked exam configuration</h2>
							</div>

							<div className='form-grid two-column'>
								<label className='field'>
									<div className='field-heading'>
										<span>Exam ID</span>
										<button className='field-toggle' type='button' onClick={() => toggleManualId('exam')}>
											{manualIds.exam ? 'Use auto ID' : 'Manual edit'}
										</button>
									</div>
									<input
										className={!manualIds.exam ? 'field-auto-input' : ''}
										value={form.examId}
										onChange={(event) => setForm({ ...form, examId: event.target.value })}
										placeholder='EX_G7_GS_CH1_R1'
										readOnly={!manualIds.exam}
										required
									/>
									<small className='field-hint'>
										{manualIds.exam ? 'Manual mode is on for this ID.' : generatedIds.examId || 'Auto format follows subject, chapter, and round.'}
									</small>
								</label>

									<label className='field'>
										<span>Exam type</span>
										<select value={form.package.type} onChange={(event) => updateExamMode(event.target.value)}>
											<option value='practice'>practice</option>
											<option value='competitive'>competitive</option>
											<option value='entrance'>entrance</option>
										</select>
										<small className='field-hint'>
											Practice, competitive, and entrance save as separate exam modes.
										</small>
									</label>

								<label className='field'>
									<span>Optional title</span>
									<input value={form.exam.title} onChange={(event) => updateExamField('title', event.target.value)} placeholder='Round 1 - Chapter 1' />
								</label>

									{entranceFlow ? (
										<label className='field'>
											<span>Entrance year</span>
											<input
												type='number'
												min='1900'
												max='9999'
												value={form.package.entranceYear}
												onChange={(event) => updatePackageField('entranceYear', event.target.value)}
												placeholder='2026'
												required
											/>
											<small className='field-hint'>The entrance year is user-defined and becomes part of the entrance exam ID.</small>
										</label>
									) : null}

								<label className='field'>
									<span>Max attempts</span>
									<input type='number' min='1' value={form.exam.maxAttempts} onChange={(event) => updateExamField('maxAttempts', event.target.value)} required />
								</label>

								<label className='field'>
									<span>Pass percent</span>
									<input type='number' min='0' value={form.exam.passPercent} onChange={(event) => updateExamField('passPercent', event.target.value)} placeholder='80' />
								</label>

								<label className='field'>
									<span>Question pool size</span>
									<input type='number' min='1' value={form.exam.questionPoolSize} onChange={(event) => updateExamField('questionPoolSize', event.target.value)} placeholder='120' />
								</label>

								<label className='field'>
									<span>Total questions</span>
									<input type='number' min='1' value={form.exam.totalQuestions} onChange={(event) => updateExamField('totalQuestions', event.target.value)} placeholder='40' />
								</label>

								<label className='field'>
									<span>Time limit (seconds)</span>
									<input type='number' min='1' value={form.exam.timeLimit} onChange={(event) => updateExamField('timeLimit', event.target.value)} required />
								</label>

								<label className='field'>
									<span>Text field key</span>
									<select value={form.exam.textKey} onChange={(event) => updateExamField('textKey', event.target.value)}>
										<option value='instructions'>instructions</option>
										<option value='instruction'>instruction</option>
										<option value='rules'>rules</option>
									</select>
								</label>
							</div>

							<div className='toggle-grid'>
								<label className='toggle-field'>
									<input type='checkbox' checked={examMode === 'competitive'} disabled readOnly />
									<span>Ranking enabled for competitive exams only</span>
								</label>

								<label className='toggle-field'>
									<input type='checkbox' checked={form.exam.scoringEnabled} onChange={(event) => updateExamField('scoringEnabled', event.target.checked)} />
									<span>Scoring enabled</span>
								</label>

								<label className='toggle-field'>
									<input type='checkbox' checked={form.exam.attemptRefillEnabled} onChange={(event) => updateExamField('attemptRefillEnabled', event.target.checked)} />
									<span>Attempt refill enabled</span>
								</label>

								<label className='toggle-field'>
									<input type='checkbox' checked={form.exam.includeLeadingNull} onChange={(event) => updateExamField('includeLeadingNull', event.target.checked)} />
									<span>Keep Firebase-style leading null in lists</span>
								</label>
							</div>

							{form.exam.attemptRefillEnabled ? (
								<div className='form-grid'>
									<label className='field'>
										<span>Attempt refill interval (ms)</span>
										<input type='number' min='1' value={form.exam.attemptRefillIntervalMs} onChange={(event) => updateExamField('attemptRefillIntervalMs', event.target.value)} placeholder='1200000' />
									</label>
								</div>
							) : null}

							<div className='row-header'>
								<h3>Instructions or rules</h3>
								<button className='secondary-action inline-button' type='button' onClick={addInstruction}>
									Add line
								</button>
							</div>

							<div className='stack-list tight-stack'>
								{form.exam.textItems.map((item, index) => (
									<div className='inline-row' key={`instruction-${index}`}>
										<input className='row-input' value={item} onChange={(event) => updateInstruction(index, event.target.value)} placeholder={index === 0 ? 'No switching apps' : 'Submit before timer ends'} />
										{form.exam.textItems.length > 1 ? (
											<button className='ghost-button' type='button' onClick={() => removeInstruction(index)}>
												Remove
											</button>
										) : null}
									</div>
								))}
							</div>

							{form.exam.scoringEnabled ? (
								<div className='form-grid two-column'>
									{Object.entries(form.exam.scoring).map(([field, value]) => (
										<label className='field' key={field}>
											<span>{field}</span>
											<input type='number' min='0' value={value} onChange={(event) => updateExamField('scoring', { ...form.exam.scoring, [field]: event.target.value })} />
										</label>
									))}
								</div>
							) : null}
						</section>

						<section className='form-card package-card'>
							<div className='section-heading compact-heading'>
								<span className='section-kicker'>Package</span>
								<h2>Package, subject, and round</h2>
							</div>

							<div className='form-grid two-column'>
								<label className='field'>
									<div className='field-heading'>
										<span>Package ID</span>
										<button className='field-toggle' type='button' onClick={() => toggleManualId('package')}>
											{manualIds.package ? 'Use auto ID' : 'Manual edit'}
										</button>
									</div>
									<input
										className={!manualIds.package ? 'field-auto-input' : ''}
										value={form.packageId}
										onChange={(event) => setForm({ ...form, packageId: event.target.value })}
										placeholder='PKG_COMP_G7_2026'
										readOnly={!manualIds.package}
										required
									/>
									<small className='field-hint'>
										{manualIds.package
											? 'Manual mode is on for this ID.'
											: generatedIds.packageId || 'Auto format uses package type, grade, and year or entrance mode.'}
									</small>
								</label>

								<label className='field'>
									<span>Package name</span>
									<input value={form.package.name} onChange={(event) => updatePackageField('name', event.target.value)} placeholder='National Competitive Exam' required />
								</label>

								<label className='field'>
									<span>Grade</span>
									<input value={form.package.grade} onChange={(event) => updatePackageField('grade', event.target.value)} placeholder='grade7' required />
								</label>

								<label className='field'>
									<span>Package type</span>
									<input className='field-auto-input' value={examMode} readOnly />
									<small className='field-hint'>
										{entranceFlow
											? 'Entrance package IDs include the entrance year you entered.'
											: examMode === 'competitive'
												? 'Competitive package IDs use COMP and yearly package codes.'
												: 'Practice package IDs use PRACTICE and chapter-based IDs.'}
									</small>
								</label>

								<label className='field'>
									<span>Subject key</span>
									<input value={form.package.subjectKey} onChange={(event) => updatePackageField('subjectKey', event.target.value)} placeholder='general_science' required />
								</label>

								<label className='field'>
									<span>Subject name</span>
									<input value={form.package.subjectName} onChange={(event) => updatePackageField('subjectName', event.target.value)} placeholder='General Science' required />
								</label>

								<label className='field'>
									<span>Round ID</span>
									<input value={form.package.roundId} onChange={(event) => updatePackageField('roundId', event.target.value)} placeholder={suggestedRoundId} required />
									<small className='field-hint'>
										Suggested round ID: {suggestedRoundId}. Competitive usually uses R1, practice uses P1, entrance uses E1.
									</small>
								</label>

								<label className='field'>
									<span>Round name</span>
									<input value={form.package.round.name} onChange={(event) => updateRoundField('name', event.target.value)} placeholder='Round 1 - Chapter 1' required />
								</label>

								<label className='field'>
									<span>Round chapter</span>
									<input value={form.package.round.chapter} onChange={(event) => updateRoundField('chapter', event.target.value)} placeholder='ch1' />
								</label>

								<label className='field'>
									<span>Round status</span>
									<input value={form.package.round.status} onChange={(event) => updateRoundField('status', event.target.value)} placeholder='active' required />
								</label>

								<label className='field field-span-2'>
									<span>Description</span>
									<textarea value={form.package.description} onChange={(event) => updatePackageField('description', event.target.value)} placeholder='Practice without ranking' rows='3' required />
								</label>

								<label className='field field-span-2'>
									<span>Package icon URL</span>
									<input value={form.package.packageIcon} onChange={(event) => updatePackageField('packageIcon', event.target.value)} placeholder='https://storage.googleapis.com/...png' />
								</label>
							</div>

							<div className='toggle-grid'>
								<label className='toggle-field'>
									<input type='checkbox' checked={form.package.active} onChange={(event) => updatePackageField('active', event.target.checked)} />
									<span>Package active</span>
								</label>
							</div>

							<div className='field-group-note'>
								Choose real date and time values only when the round needs scheduling. You can leave these blank if the round
								does not need automatic start, end, or result timing.
							</div>

							<div className='form-grid two-column'>
								{roundTimestampFields.map((field) => (
									<label className='field' key={field.key}>
										<span>{field.label}</span>
										<input
											type='datetime-local'
											value={formatTimestampForInput(form.package.round[field.key])}
											onChange={(event) => updateRoundField(field.key, event.target.value)}
										/>
										<small className='field-hint'>{field.hint}</small>
									</label>
								))}
							</div>
						</section>

						<div className='submit-row'>
							<button className='primary-action' type='submit' disabled={submitState.loading}>
								{submitState.loading ? 'Saving to Platform1...' : 'Save record'}
							</button>
							<p className='inline-note'>One backend request. One batched Firebase update. No polling loop.</p>
						</div>
					</form>

				
				</div>
			</section>

			<section className='section-block'>
				<div className='section-header-row'>
					<div className='section-heading'>
						<span className='section-kicker'>Existing Content</span>
						<h2>Current IDs by exam type</h2>
					</div>
				</div>

				<div className='catalog-grid compact-grid'>
					<div className='catalog-card'>
						<div className='catalog-meta-row'>
							<span className='pill pill-teal'>Question Banks</span>
						</div>
						<ul className='catalog-list'>
							{overview.questionBanks.slice(0, 8).map((item) => (
								<li key={item.questionBankId}>{item.questionBankId}</li>
							))}
						</ul>
					</div>

					<div className='catalog-card'>
						<div className='catalog-meta-row'>
							<span className='pill pill-gold'>Competitive Exams</span>
						</div>
						<ul className='catalog-list'>
							{competitiveExams.slice(0, 8).map((item) => (
								<li key={item.examId}>{item.examId}</li>
							))}
						</ul>
					</div>

					<div className='catalog-card'>
						<div className='catalog-meta-row'>
							<span className='pill pill-coral'>Practice Exams</span>
						</div>
						<ul className='catalog-list'>
							{practiceExams.slice(0, 8).map((item) => (
								<li key={item.examId}>{item.examId}</li>
							))}
						</ul>
					</div>

					<div className='catalog-card'>
						<div className='catalog-meta-row'>
							<span className='pill pill-teal'>Entrance Exams</span>
						</div>
						<ul className='catalog-list'>
							{entranceExams.slice(0, 8).map((item) => (
								<li key={item.examId}>{item.examId}</li>
							))}
						</ul>
					</div>

					<div className='catalog-card'>
						<div className='catalog-meta-row'>
							<span className='pill pill-coral'>Packages</span>
						</div>
						<ul className='catalog-list'>
							{overview.packages.slice(0, 8).map((item) => (
								<li key={item.packageId}>{item.packageId}</li>
							))}
						</ul>
					</div>
				</div>
			</section>

			

		
				</div>
			</main>
		</div>
	)
}
