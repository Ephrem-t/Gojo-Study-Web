import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../apiBaseUrl'
import CompanySidebar from '../components/CompanySidebar'
const DRAFT_STORAGE_PREFIX = 'gojo-company-exam-draft'

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

function createInitialForm(routeMode) {
	const nextMode = normalizeExamMode(routeMode)

	return {
		...defaultForm,
		questionBank: {
			...defaultForm.questionBank,
			metadata: {
				...defaultForm.questionBank.metadata,
			},
			questions: [createQuestion(1)],
		},
		exam: {
			...defaultForm.exam,
			textItems: [...defaultForm.exam.textItems],
			scoring: {
				...defaultForm.exam.scoring,
			},
		},
		package: {
			...defaultForm.package,
			type: nextMode,
			roundId: nextMode === 'entrance' ? 'E1' : nextMode === 'competitive' ? 'R1' : 'P1',
			round: {
				...defaultForm.package.round,
			},
		},
	}
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

function createManualIdState() {
	return {
		questionBank: false,
		exam: false,
		package: false,
	}
}

function createQuestionBankImportState() {
	return {
		loading: false,
		error: '',
		success: '',
		warnings: [],
	}
}

const SUBMISSION_KEY_PATTERN = /^[A-Za-z0-9_.-]+$/

function isPlainObject(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function formatModeLabel(value) {
	const normalized = normalizeExamMode(value)
	return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function formatReadableToken(value) {
	const normalized = trimText(value)
	if (!normalized) {
		return ''
	}

	const gradeFormatted = normalized.replace(/[_-]+/g, ' ').replace(/\bgrade\s*(\d{1,2})\b/gi, 'Grade $1')
	return gradeFormatted
		.split(' ')
		.filter(Boolean)
		.map((part) => {
			if (/^[A-Z0-9]+$/.test(part)) {
				return part
			}
			return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
		})
		.join(' ')
}

function normalizeLookupToken(value) {
	return trimText(value).toLowerCase()
}

function getRoundPrefix(value) {
	const normalized = normalizeExamMode(value)
	if (normalized === 'entrance') {
		return 'E'
	}

	return normalized === 'competitive' ? 'R' : 'P'
}

function toRoundNumber(roundId, examMode) {
	const normalizedRoundId = normalizeIdToken(roundId)
	const match = normalizedRoundId.match(new RegExp(`^${getRoundPrefix(examMode)}(\\d+)$`))
	return match ? Number(match[1]) : null
}

function findReusablePackage(packages, form, fallbackPackageId = '') {
	const packageList = Array.isArray(packages) ? packages : []
	if (!packageList.length || !isPlainObject(form?.package)) {
		return null
	}

	const targetPackageId = trimText(form.packageId) || trimText(fallbackPackageId)
	if (targetPackageId) {
		const exactMatch = packageList.find((item) => trimText(item?.packageId) === targetPackageId)
		if (exactMatch) {
			return exactMatch
		}
	}

	const targetMode = normalizeExamMode(form.package.type)
	const targetGrade = normalizeLookupToken(form.package.grade)
	if (!targetGrade) {
		return null
	}

	const targetEntranceYear = normalizeEntranceYear(form.package.entranceYear)
	const matches = packageList.filter((item) => {
		if (!isPlainObject(item)) {
			return false
		}

		if (normalizeExamMode(item.type) !== targetMode) {
			return false
		}

		if (normalizeLookupToken(item.grade) !== targetGrade) {
			return false
		}

		if (targetMode === 'entrance') {
			return String(item.entranceYear || '') === targetEntranceYear
		}

		return true
	})

	return matches.length === 1 ? matches[0] : null
}

function findPackageSubject(packageRecord, subjectKey, subjectName = '') {
	if (!isPlainObject(packageRecord?.subjects)) {
		return null
	}

	const lookupValues = [normalizeLookupToken(subjectKey), normalizeLookupToken(subjectName)].filter(Boolean)
	if (!lookupValues.length) {
		return null
	}

	return Object.values(packageRecord.subjects).find((item) => {
		if (!isPlainObject(item)) {
			return false
		}

		const subjectTokens = [normalizeLookupToken(item.subjectKey), normalizeLookupToken(item.name)].filter(Boolean)
		return lookupValues.some((lookupValue) => subjectTokens.includes(lookupValue))
	}) || null
}

function buildSuggestedRoundName(form, roundId) {
	const roundNumber = toRoundNumber(roundId, form.package.type) || 1
	const examMode = normalizeExamMode(form.package.type)
	const roundLabel = examMode === 'competitive'
		? `Round ${roundNumber}`
		: examMode === 'entrance'
			? `Entrance Round ${roundNumber}`
			: `Practice Round ${roundNumber}`
	const chapterLabel = formatReadableToken(form.package.round.chapter)

	return chapterLabel ? `${roundLabel} - ${chapterLabel}` : roundLabel
}

function createDraftStorageKey(routeMode) {
	return `${DRAFT_STORAGE_PREFIX}:${normalizeExamMode(routeMode)}`
}

function normalizeDraftQuestion(question, index) {
	const baseQuestion = createQuestion(index + 1)
	const draftQuestion = isPlainObject(question) ? question : {}

	return {
		...baseQuestion,
		...draftQuestion,
		key: trimText(draftQuestion.key) || baseQuestion.key,
		options: {
			...baseQuestion.options,
			...(isPlainObject(draftQuestion.options) ? draftQuestion.options : {}),
		},
	}
}

function normalizeDraftForm(savedForm, routeMode) {
	const baseForm = createInitialForm(routeMode)
	const draftForm = isPlainObject(savedForm) ? savedForm : {}
	const draftQuestionBank = isPlainObject(draftForm.questionBank) ? draftForm.questionBank : {}
	const draftExam = isPlainObject(draftForm.exam) ? draftForm.exam : {}
	const draftPackage = isPlainObject(draftForm.package) ? draftForm.package : {}
	const draftQuestions = Array.isArray(draftQuestionBank.questions) && draftQuestionBank.questions.length
		? draftQuestionBank.questions.map((question, index) => normalizeDraftQuestion(question, index))
		: baseForm.questionBank.questions
	const draftTextItems = Array.isArray(draftExam.textItems) && draftExam.textItems.length
		? draftExam.textItems.map((item) => String(item ?? ''))
		: [...baseForm.exam.textItems]

	return {
		...baseForm,
		questionBankId: typeof draftForm.questionBankId === 'string' ? draftForm.questionBankId : baseForm.questionBankId,
		examId: typeof draftForm.examId === 'string' ? draftForm.examId : baseForm.examId,
		packageId: typeof draftForm.packageId === 'string' ? draftForm.packageId : baseForm.packageId,
		questionBank: {
			...baseForm.questionBank,
			...draftQuestionBank,
			metadata: {
				...baseForm.questionBank.metadata,
				...(isPlainObject(draftQuestionBank.metadata) ? draftQuestionBank.metadata : {}),
			},
			questions: draftQuestions,
		},
		exam: {
			...baseForm.exam,
			...draftExam,
			textItems: draftTextItems,
			scoring: {
				...baseForm.exam.scoring,
				...(isPlainObject(draftExam.scoring) ? draftExam.scoring : {}),
			},
		},
		package: {
			...baseForm.package,
			...draftPackage,
			type: normalizeExamMode(draftPackage.type || routeMode),
			roundId: trimText(draftPackage.roundId) || baseForm.package.roundId,
			round: {
				...baseForm.package.round,
				...(isPlainObject(draftPackage.round) ? draftPackage.round : {}),
			},
		},
	}
}

function normalizeManualIds(value) {
	const manualIds = isPlainObject(value) ? value : {}
	return {
		questionBank: Boolean(manualIds.questionBank),
		exam: Boolean(manualIds.exam),
		package: Boolean(manualIds.package),
	}
}

function readSavedDraft(routeMode) {
	if (typeof window === 'undefined') {
		return null
	}

	const rawDraft = window.localStorage.getItem(createDraftStorageKey(routeMode))
	if (!rawDraft) {
		return null
	}

	try {
		const parsedDraft = JSON.parse(rawDraft)
		return {
			savedAt: toOptionalTimestamp(parsedDraft?.savedAt),
			form: normalizeDraftForm(parsedDraft?.form, routeMode),
			manualIds: normalizeManualIds(parsedDraft?.manualIds),
		}
	} catch {
		return {
			error: `Unable to load the ${formatModeLabel(routeMode).toLowerCase()} draft from this browser.`,
		}
	}
}

function clearSavedDraft(routeMode) {
	if (typeof window === 'undefined') {
		return
	}

	window.localStorage.removeItem(createDraftStorageKey(routeMode))
}

function countStartedQuestions(form) {
	return form.questionBank.questions.filter((item) => {
		return hasContent(item.question) || Object.values(item.options).some(hasContent)
	}).length
}

function isPackageStageReady(form) {
	return (
		[
			form.packageId,
			form.package.name,
			form.package.grade,
			form.package.subjectKey,
			form.package.subjectName,
			form.package.roundId,
			form.package.round.name,
			form.package.round.status,
			form.package.description,
		].every(hasContent) &&
		(!isEntranceFlow(form) || Boolean(normalizeEntranceYear(form.package.entranceYear)))
	)
}

function isExamStageReady(form) {
	return (
		hasContent(form.examId) &&
		toOptionalNumber(form.exam.maxAttempts) !== null &&
		toOptionalNumber(form.exam.timeLimit) !== null &&
		hasContent(form.exam.textKey) &&
		(!form.exam.attemptRefillEnabled || toOptionalNumber(form.exam.attemptRefillIntervalMs) !== null)
	)
}

function isQuestionBankStageReady(form, savedQuestionCount) {
	return (
		hasContent(form.questionBankId) &&
		hasContent(form.questionBank.metadata.subject) &&
		hasContent(form.questionBank.metadata.grade) &&
		hasContent(form.questionBank.metadata.chapter) &&
		savedQuestionCount > 0
	)
}

function getStageTone(isUnlocked, isReady) {
	if (!isUnlocked) {
		return 'is-locked'
	}

	return isReady ? 'is-ready' : 'is-pending'
}

function getStageToggleText(isOpen, isUnlocked, isReady) {
	if (!isUnlocked) {
		return 'Locked'
	}

	return isOpen ? 'Collapse' : 'Expand'
}

function canToggleStage(isOpen, isUnlocked, isReady) {
	return isUnlocked
}

function hasDraftableFormContent(form) {
	return (
		countStartedQuestions(form) > 0 ||
		[
			form.packageId,
			form.examId,
			form.questionBankId,
			form.package.name,
			form.package.subjectName,
			form.package.subjectKey,
		].some(hasContent)
	)
}

function getModePillClass(value) {
	const normalized = normalizeExamMode(value)
	if (normalized === 'competitive') {
		return 'pill-gold'
	}

	if (normalized === 'entrance') {
		return 'pill-teal'
	}

	return 'pill-coral'
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

function buildSuggestedRoundId(form, existingRounds = []) {
	const roundPrefix = getRoundPrefix(form.package.type)
	let highestRoundNumber = 0

	for (const round of existingRounds) {
		const roundId = isPlainObject(round) ? round.roundId : round
		const roundNumber = toRoundNumber(roundId, form.package.type)
		if (roundNumber && roundNumber > highestRoundNumber) {
			highestRoundNumber = roundNumber
		}
	}

	return `${roundPrefix}${Math.max(1, highestRoundNumber + 1)}`
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
	const subjectKey = trimText(form.package.subjectKey)
	const roundId = trimText(form.package.roundId)
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
			[subjectKey]: {
				name: trimText(form.package.subjectName),
				rounds: {
					[roundId]: round,
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
	const questionBankId = trimText(form.questionBankId)
	const examId = trimText(form.examId)
	const packageId = trimText(form.packageId)
	const previewQuestionBankId = questionBankId || 'QUESTION_BANK_ID'
	const previewExamId = examId || 'EXAM_ID'
	const previewPackageId = packageId || 'PACKAGE_ID'
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
					[previewQuestionBankId]: questionBank,
				},
			},
			companyExams: {
				exams: {
					[previewExamId]: exam,
				},
				packages: {
					[previewPackageId]: packageNode,
				},
			},
		},
	}
}

function requireSubmissionString(value, fieldName) {
	const text = trimText(value)
	if (!text) {
		throw new Error(`${fieldName} is required`)
	}
	return text
}

function requireSubmissionKey(value, fieldName) {
	const text = requireSubmissionString(value, fieldName)
	if (!SUBMISSION_KEY_PATTERN.test(text)) {
		throw new Error(`${fieldName} may only contain letters, numbers, underscores, dots, and dashes`)
	}
	return text
}

function coerceSubmissionInt(value, fieldName, options = {}) {
	const { allowNone = false, minimum = null } = options

	if (value === null || value === undefined || value === '') {
		if (allowNone) {
			return null
		}
		throw new Error(`${fieldName} is required`)
	}

	const number = Number(value)
	if (!Number.isInteger(number)) {
		throw new Error(`${fieldName} must be an integer`)
	}

	if (minimum !== null && number < minimum) {
		throw new Error(`${fieldName} must be at least ${minimum}`)
	}

	return number
}

function coerceSubmissionBool(value, fieldName) {
	if (typeof value === 'boolean') {
		return value
	}

	if (typeof value === 'number') {
		return Boolean(value)
	}

	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase()
		if (['true', '1', 'yes', 'on'].includes(normalized)) {
			return true
		}
		if (['false', '0', 'no', 'off'].includes(normalized)) {
			return false
		}
	}

	throw new Error(`${fieldName} must be a boolean`)
}

function normalizeSubmissionMode(value, fieldName, options = {}) {
	const { allowNone = false } = options
	const normalized = trimText(value).toLowerCase()

	if (!normalized) {
		if (allowNone) {
			return ''
		}
		throw new Error(`${fieldName} is required`)
	}

	if (!['practice', 'competitive', 'entrance'].includes(normalized)) {
		throw new Error(`${fieldName} must be one of practice, competitive, or entrance`)
	}

	return normalized
}

function optionalSubmissionTextList(value, fieldName) {
	if (value === null || value === undefined) {
		return null
	}

	if (!Array.isArray(value)) {
		throw new Error(`${fieldName} must be a list`)
	}

	const cleaned = []
	value.forEach((item, index) => {
		if (item === null) {
			if (index === 0) {
				cleaned.push(null)
			}
			return
		}

		const text = trimText(item)
		if (text) {
			cleaned.push(text)
		}
	})

	return cleaned.length ? cleaned : null
}

function collectOptionalPositiveIntFields(source, fieldNames) {
	return fieldNames.reduce((result, fieldName) => {
		if (Object.hasOwn(source, fieldName) && source[fieldName] !== null && source[fieldName] !== '') {
			result[fieldName] = coerceSubmissionInt(source[fieldName], fieldName, { minimum: 0 })
		}
		return result
	}, {})
}

function validateQuestionBankSubmission(questionBankId, node) {
	if (!isPlainObject(node)) {
		throw new Error('questionBank must be an object')
	}

	const metadata = node.metadata
	const questions = node.questions
	if (!isPlainObject(metadata)) {
		throw new Error('questionBank.metadata must be an object')
	}
	if (!isPlainObject(questions) || !Object.keys(questions).length) {
		throw new Error('questionBank.questions must be a non-empty object')
	}

	const validatedQuestions = {}
	for (const [questionKey, questionPayload] of Object.entries(questions)) {
		const key = requireSubmissionKey(questionKey, `question key for ${questionBankId}`)
		if (!isPlainObject(questionPayload)) {
			throw new Error(`questionBank.questions.${key} must be an object`)
		}

		const questionType = requireSubmissionString(questionPayload.type, `questionBank.questions.${key}.type`)
		const validatedQuestion = {
			question: requireSubmissionString(questionPayload.question, `questionBank.questions.${key}.question`),
			type: questionType,
			correctAnswer: requireSubmissionString(questionPayload.correctAnswer, `questionBank.questions.${key}.correctAnswer`),
			marks: coerceSubmissionInt(questionPayload.marks, `questionBank.questions.${key}.marks`, { minimum: 1 }),
		}

		const explanation = trimText(questionPayload.explanation)
		if (explanation) {
			validatedQuestion.explanation = explanation
		}

		const options = questionPayload.options
		if (questionType.toLowerCase() === 'mcq') {
			if (!isPlainObject(options) || Object.keys(options).length < 2) {
				throw new Error(`questionBank.questions.${key}.options must include at least two choices for mcq questions`)
			}

			const validatedOptions = {}
			for (const [optionKey, optionValue] of Object.entries(options)) {
				const normalizedOptionKey = requireSubmissionKey(optionKey, `questionBank.questions.${key}.options key`)
				validatedOptions[normalizedOptionKey] = requireSubmissionString(optionValue, `questionBank.questions.${key}.options.${normalizedOptionKey}`)
			}

			if (!Object.hasOwn(validatedOptions, validatedQuestion.correctAnswer)) {
				throw new Error(`questionBank.questions.${key}.correctAnswer must match an option key`)
			}
			validatedQuestion.options = validatedOptions
		} else if (isPlainObject(options) && Object.keys(options).length) {
			validatedQuestion.options = Object.fromEntries(
				Object.entries(options).map(([optionKey, optionValue]) => [
					requireSubmissionKey(optionKey, `questionBank.questions.${key}.options key`),
					requireSubmissionString(optionValue, `questionBank.questions.${key}.options.${optionKey}`),
				])
			)
		}

		validatedQuestions[key] = validatedQuestion
	}

	return {
		metadata: {
			chapter: requireSubmissionString(metadata.chapter, 'questionBank.metadata.chapter'),
			difficulty: requireSubmissionString(metadata.difficulty, 'questionBank.metadata.difficulty'),
			grade: requireSubmissionString(metadata.grade, 'questionBank.metadata.grade'),
			subject: requireSubmissionString(metadata.subject, 'questionBank.metadata.subject'),
			totalQuestions: coerceSubmissionInt(metadata.totalQuestions, 'questionBank.metadata.totalQuestions', { minimum: 1 }),
		},
		questions: validatedQuestions,
	}
}

function validateExamSubmission(examId, questionBankId, node) {
	if (!isPlainObject(node)) {
		throw new Error('exam must be an object')
	}

	const validated = {
		questionBankId: requireSubmissionKey(node.questionBankId, 'exam.questionBankId'),
		maxAttempts: coerceSubmissionInt(node.maxAttempts, 'exam.maxAttempts', { minimum: 1 }),
		questionPoolSize: coerceSubmissionInt(node.questionPoolSize, 'exam.questionPoolSize', { minimum: 1 }),
		rankingEnabled: coerceSubmissionBool(node.rankingEnabled, 'exam.rankingEnabled'),
		scoringEnabled: coerceSubmissionBool(node.scoringEnabled, 'exam.scoringEnabled'),
		timeLimit: coerceSubmissionInt(node.timeLimit, 'exam.timeLimit', { minimum: 1 }),
		totalQuestions: coerceSubmissionInt(node.totalQuestions, 'exam.totalQuestions', { minimum: 1 }),
	}

	if (validated.questionBankId !== questionBankId) {
		throw new Error('exam.questionBankId must match questionBankId')
	}

	let examMode = normalizeSubmissionMode(node.mode, 'exam.mode', { allowNone: true })
	if (!examMode) {
		examMode = validated.rankingEnabled ? 'competitive' : 'practice'
	}
	validated.mode = examMode
	validated.rankingEnabled = examMode === 'competitive'

	if (node.passPercent !== null && node.passPercent !== undefined && node.passPercent !== '') {
		validated.passPercent = coerceSubmissionInt(node.passPercent, 'exam.passPercent', { allowNone: true, minimum: 0 })
	}

	if (node.attemptRefillEnabled !== null && node.attemptRefillEnabled !== undefined) {
		validated.attemptRefillEnabled = coerceSubmissionBool(node.attemptRefillEnabled, 'exam.attemptRefillEnabled')
	}

	const attemptRefillInterval = coerceSubmissionInt(node.attemptRefillIntervalMs, 'exam.attemptRefillIntervalMs', { allowNone: true, minimum: 1 })
	if (attemptRefillInterval !== null) {
		validated.attemptRefillIntervalMs = attemptRefillInterval
	}

	const title = trimText(node.title)
	if (title) {
		validated.title = title
	}

	const textKeys = ['instructions', 'instruction', 'rules'].filter((key) => Object.hasOwn(node, key))
	if (textKeys.length > 1) {
		throw new Error('exam may only include one of instructions, instruction, or rules')
	}
	if (textKeys.length) {
		const textKey = textKeys[0]
		const validatedList = optionalSubmissionTextList(node[textKey], `exam.${textKey}`)
		if (validatedList) {
			validated[textKey] = validatedList
		}
	}

	if (node.scoring !== null && node.scoring !== undefined) {
		if (!isPlainObject(node.scoring)) {
			throw new Error('exam.scoring must be an object')
		}
		const validatedScoring = collectOptionalPositiveIntFields(node.scoring, ['diamondPercent', 'goldPercent', 'maxPoints', 'platinumPercent'])
		if (Object.keys(validatedScoring).length) {
			validated.scoring = validatedScoring
		}
	}

	return validated
}

function validatePackageSubmission(packageId, examId, node) {
	if (!isPlainObject(node)) {
		throw new Error('package must be an object')
	}

	const subjects = node.subjects
	if (!isPlainObject(subjects) || Object.keys(subjects).length !== 1) {
		throw new Error('package.subjects must contain exactly one subject')
	}

	const [subjectKey, subjectPayload] = Object.entries(subjects)[0]
	const normalizedSubjectKey = requireSubmissionKey(subjectKey, 'package subject key')
	if (!isPlainObject(subjectPayload)) {
		throw new Error('package subject payload must be an object')
	}

	const rounds = subjectPayload.rounds
	if (!isPlainObject(rounds) || Object.keys(rounds).length !== 1) {
		throw new Error('package subject rounds must contain exactly one round')
	}

	const [roundId, roundPayload] = Object.entries(rounds)[0]
	const normalizedRoundId = requireSubmissionKey(roundId, 'package round id')
	if (!isPlainObject(roundPayload)) {
		throw new Error('package round payload must be an object')
	}

	const validatedRound = {
		examId: requireSubmissionKey(roundPayload.examId, 'package round examId'),
		name: requireSubmissionString(roundPayload.name, 'package round name'),
		status: requireSubmissionString(roundPayload.status, 'package round status'),
	}
	if (validatedRound.examId !== examId) {
		throw new Error('package round examId must match examId')
	}

	const chapter = trimText(roundPayload.chapter)
	if (chapter) {
		validatedRound.chapter = chapter
	}

	Object.assign(
		validatedRound,
		collectOptionalPositiveIntFields(roundPayload, ['createdAt', 'updatedAt', 'startTimestamp', 'endTimestamp', 'resultReleaseTimestamp'])
	)

	const validatedPackage = {
		active: coerceSubmissionBool(node.active, 'package.active'),
		description: requireSubmissionString(node.description, 'package.description'),
		grade: requireSubmissionString(node.grade, 'package.grade'),
		name: requireSubmissionString(node.name, 'package.name'),
		type: normalizeSubmissionMode(node.type, 'package.type'),
		subjects: {
			[normalizedSubjectKey]: {
				name: requireSubmissionString(subjectPayload.name, 'package subject name'),
				rounds: {
					[normalizedRoundId]: validatedRound,
				},
			},
		},
	}

	if (validatedPackage.type === 'entrance') {
		validatedPackage.entranceYear = coerceSubmissionInt(node.entranceYear, 'package.entranceYear', { minimum: 1900 })
	}

	const packageIcon = trimText(node.packageIcon)
	if (packageIcon) {
		validatedPackage.packageIcon = packageIcon
	}

	return {
		package: validatedPackage,
		subjectKey: normalizedSubjectKey,
		roundId: normalizedRoundId,
	}
}

function validateCompanyExamSubmission(payload) {
	if (!isPlainObject(payload)) {
		throw new Error('Request body must be an object')
	}

	const questionBankId = requireSubmissionKey(payload.questionBankId, 'questionBankId')
	const examId = requireSubmissionKey(payload.examId, 'examId')
	const packageId = requireSubmissionKey(payload.packageId, 'packageId')

	coerceSubmissionBool(payload.overwrite, 'overwrite')
	validateQuestionBankSubmission(questionBankId, payload.questionBank)
	validateExamSubmission(examId, questionBankId, payload.exam)
	validatePackageSubmission(packageId, examId, payload.package)
	return { questionBankId, examId, packageId }
}

function StatCard({ label, value, tone = 'teal' }) {
	return (
		<div className={`builder-stat-card tone-${tone}`}>
			<p className='config-key'>{label}</p>
			<p className='config-value'>{value}</p>
		</div>
	)
}

export default function ExamPage({ routeMode = 'practice' }) {
	const normalizedRouteMode = normalizeExamMode(routeMode)
	const [form, setForm] = useState(() => createInitialForm(normalizedRouteMode))
	const [overview, setOverview] = useState({ stats: {}, exams: [], packages: [], questionBanks: [] })
	const [loadState, setLoadState] = useState({ loading: true, error: '' })
	const [submitState, setSubmitState] = useState({ loading: false, error: '', success: '' })
	const [draftState, setDraftState] = useState({ loading: false, error: '', success: '', lastSavedAt: null, hasDraft: false })
	const [draftLibrary, setDraftLibrary] = useState({ loading: true, error: '', drafts: [] })
	const [assetUploadState, setAssetUploadState] = useState({ loadingKey: '', error: '', success: '' })
	const [questionBankImportState, setQuestionBankImportState] = useState(() => createQuestionBankImportState())
	const [activeDraftId, setActiveDraftId] = useState('')
	const [isDraftLibraryVisible, setIsDraftLibraryVisible] = useState(false)
	const [allowOverwrite, setAllowOverwrite] = useState(false)
	const [manualIds, setManualIds] = useState(() => createManualIdState())
	const autoPackageDefaultsRef = useRef({ packageId: '', name: '', description: '', packageIcon: '', entranceYear: '', active: true })
	const previousAutoSubjectNameRef = useRef('')
	const previousAutoRoundIdRef = useRef('')
	const previousAutoRoundNameRef = useRef('')
	const [stageVisibility, setStageVisibility] = useState(() => ({
		package: true,
		exam: false,
		questionBank: false,
	}))

	const { payload } = buildSubmission(form, allowOverwrite)
	const generatedIds = buildGeneratedIds(form)
	const entranceFlow = isEntranceFlow(form)
	const examMode = normalizeExamMode(form.package.type)
	const competitiveExams = overview.exams.filter((item) => item.mode === 'competitive')
	const practiceExams = overview.exams.filter((item) => item.mode === 'practice')
	const entranceExams = overview.exams.filter((item) => item.mode === 'entrance')
	const reusablePackage = manualIds.package ? null : findReusablePackage(overview.packages, form, generatedIds.packageId)
	const reusablePackageSubject = findPackageSubject(reusablePackage, form.package.subjectKey, form.package.subjectName)
	const reusableSubjectRounds = Array.isArray(reusablePackageSubject?.rounds) ? reusablePackageSubject.rounds : []
	const suggestedRoundId = buildSuggestedRoundId(form, reusableSubjectRounds)
	const suggestedRoundName = buildSuggestedRoundName(form, suggestedRoundId)
	const activeDraft = draftLibrary.drafts.find((item) => item.draftId === activeDraftId) || null
	const currentRoundId = trimText(form.package.roundId) || suggestedRoundId
	const startedQuestionCount = countStartedQuestions(form)
	const savedQuestionCount = Object.keys(payload.questionBank.questions).length
	const packageStageReady = isPackageStageReady(form)
	const examStageUnlocked = packageStageReady
	const examStageReady = examStageUnlocked && isExamStageReady(form)
	const questionBankStageUnlocked = examStageReady
	const questionBankStageReady = questionBankStageUnlocked && isQuestionBankStageReady(form, savedQuestionCount)
	const packageStageTone = getStageTone(true, packageStageReady)
	const examStageTone = getStageTone(examStageUnlocked, examStageReady)
	const questionBankStageTone = getStageTone(questionBankStageUnlocked, questionBankStageReady)
	const examToggleEnabled = canToggleStage(stageVisibility.exam, examStageUnlocked, examStageReady)
	const questionBankToggleEnabled = canToggleStage(stageVisibility.questionBank, questionBankStageUnlocked, questionBankStageReady)
	const packageGradeLabel = formatReadableToken(form.package.grade) || 'Grade pending'
	const packageSubjectLabel = trimText(form.package.subjectName) || formatReadableToken(form.package.subjectKey) || 'Subject pending'
	const packageNameLabel = trimText(form.package.name) || 'Unnamed package'
	const roundNameLabel = trimText(form.package.round.name) || 'Round not named yet'
	const examTitleLabel = trimText(form.exam.title) || roundNameLabel
	const questionBankGradeLabel = formatReadableToken(form.questionBank.metadata.grade) || packageGradeLabel
	const questionBankSubjectLabel = formatReadableToken(form.questionBank.metadata.subject) || packageSubjectLabel
	const chapterLabel = formatReadableToken(form.questionBank.metadata.chapter || form.package.round.chapter) || 'Chapter pending'
	const questionBankFocus = stageVisibility.questionBank && questionBankStageUnlocked
	const currentModeExamCount = examMode === 'competitive' ? competitiveExams.length : examMode === 'entrance' ? entranceExams.length : practiceExams.length
	const currentModeExamLabel = `${formatModeLabel(examMode)} Exams`
	const activeWorkspaceLabel = activeDraft?.label || activeDraft?.packageId || 'New package draft'
	const reusablePackageSubjectCount = reusablePackage?.subjectCount ?? Object.keys(reusablePackage?.subjects || {}).length
	const reusableSubjectRoundLabels = reusableSubjectRounds.map((round) => {
		const chapterToken = trimText(round?.chapter)
		return chapterToken ? `${round.roundId} - ${formatReadableToken(chapterToken)}` : round.roundId
	})
	const findExistingRoundConflict = (candidateForm) => {
		const nextPackageId = trimText(candidateForm?.packageId)
		const nextSubjectKey = trimText(candidateForm?.package?.subjectKey)
		const nextRoundId = trimText(candidateForm?.package?.roundId)

		if (!nextPackageId || !nextSubjectKey || !nextRoundId) {
			return null
		}

		const matchingPackage = overview.packages.find((item) => trimText(item?.packageId) === nextPackageId)
		if (!isPlainObject(matchingPackage?.subjects)) {
			return null
		}

		const matchingSubject = Object.values(matchingPackage.subjects).find(
			(item) => normalizeLookupToken(item?.subjectKey) === normalizeLookupToken(nextSubjectKey)
		)
		if (!matchingSubject || !Array.isArray(matchingSubject.rounds)) {
			return null
		}

		return matchingSubject.rounds.find((item) => trimText(item?.roundId) === nextRoundId) || null
	}
	const getPublishConflictMessage = (candidateForm) => {
		const nextQuestionBankId = trimText(candidateForm?.questionBankId)
		if (nextQuestionBankId && overview.questionBanks.some((item) => item.questionBankId === nextQuestionBankId)) {
			return `questionBankId ${nextQuestionBankId} already exists in Platform1. Change the ID or enable Allow overwrite to replace it.`
		}

		const nextExamId = trimText(candidateForm?.examId)
		if (nextExamId && overview.exams.some((item) => item.examId === nextExamId)) {
			return `examId ${nextExamId} already exists in Platform1. Change the ID or enable Allow overwrite to replace it.`
		}

		const existingRound = findExistingRoundConflict(candidateForm)
		if (existingRound) {
			const nextPackageId = trimText(candidateForm?.packageId)
			const nextSubjectKey = trimText(candidateForm?.package?.subjectKey)
			const nextRoundId = trimText(candidateForm?.package?.roundId)
			return `round ${nextRoundId} already exists for package ${nextPackageId}/${nextSubjectKey} in Platform1. Use a new round ID or enable Allow overwrite to replace it.`
		}

		return ''
	}
	const workspaceTargetsExistingRecord = (candidateForm) => {
		return Boolean(getPublishConflictMessage(candidateForm))
	}

	useEffect(() => {
		setStageVisibility({
			package: true,
			exam: false,
			questionBank: false,
		})
	}, [normalizedRouteMode])

	useEffect(() => {
		setSubmitState({ loading: false, error: '', success: '' })
		setAllowOverwrite(false)
		setForm(createInitialForm(normalizedRouteMode))
		setManualIds(createManualIdState())
		autoPackageDefaultsRef.current = { packageId: '', name: '', description: '', packageIcon: '', entranceYear: '', active: true }
		previousAutoSubjectNameRef.current = ''
		previousAutoRoundIdRef.current = ''
		previousAutoRoundNameRef.current = ''
		setAssetUploadState({ loadingKey: '', error: '', success: '' })
		setQuestionBankImportState(createQuestionBankImportState())
		setActiveDraftId('')
		setIsDraftLibraryVisible(false)
		setDraftState({ loading: false, error: '', success: '', lastSavedAt: null, hasDraft: false })
		setDraftLibrary({ loading: true, error: '', drafts: [] })
	}, [normalizedRouteMode])

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
		reloadDraftLibrary()
	}, [normalizedRouteMode])

	useEffect(() => {
		setForm((current) => {
			if (!reusablePackage || manualIds.package) {
				autoPackageDefaultsRef.current = { packageId: '', name: '', description: '', packageIcon: '', entranceYear: '', active: true }
				return current
			}

			const previousDefaults = autoPackageDefaultsRef.current
			const nextDefaults = {
				packageId: trimText(reusablePackage.packageId),
				name: trimText(reusablePackage.name),
				description: trimText(reusablePackage.description),
				packageIcon: trimText(reusablePackage.packageIcon),
				entranceYear: reusablePackage.entranceYear ? String(reusablePackage.entranceYear) : '',
				active: Boolean(reusablePackage.active),
			}
			autoPackageDefaultsRef.current = nextDefaults

			const currentPackage = current.package
			const nextPackage = { ...currentPackage }
			let packageChanged = false
			let packageId = current.packageId

			if (!trimText(current.packageId) || trimText(current.packageId) === previousDefaults.packageId) {
				if (packageId !== nextDefaults.packageId) {
					packageId = nextDefaults.packageId
				}
			}

			if ((!trimText(currentPackage.name) || trimText(currentPackage.name) === previousDefaults.name) && nextPackage.name !== nextDefaults.name) {
				nextPackage.name = nextDefaults.name
				packageChanged = true
			}

			if ((!trimText(currentPackage.description) || trimText(currentPackage.description) === previousDefaults.description) && nextPackage.description !== nextDefaults.description) {
				nextPackage.description = nextDefaults.description
				packageChanged = true
			}

			if ((!trimText(currentPackage.packageIcon) || trimText(currentPackage.packageIcon) === previousDefaults.packageIcon) && nextDefaults.packageIcon && nextPackage.packageIcon !== nextDefaults.packageIcon) {
				nextPackage.packageIcon = nextDefaults.packageIcon
				packageChanged = true
			}

			if (entranceFlow && (!trimText(currentPackage.entranceYear) || trimText(currentPackage.entranceYear) === previousDefaults.entranceYear) && nextDefaults.entranceYear && nextPackage.entranceYear !== nextDefaults.entranceYear) {
				nextPackage.entranceYear = nextDefaults.entranceYear
				packageChanged = true
			}

			if (currentPackage.active === previousDefaults.active && nextPackage.active !== nextDefaults.active) {
				nextPackage.active = nextDefaults.active
				packageChanged = true
			}

			if (!packageChanged && current.packageId === packageId) {
				return current
			}

			return {
				...current,
				packageId,
				package: packageChanged ? nextPackage : current.package,
			}
		})
	}, [entranceFlow, manualIds.package, reusablePackage])

	useEffect(() => {
		setForm((current) => {
			const nextSubjectName = trimText(reusablePackageSubject?.name) || formatReadableToken(current.package.subjectKey)
			const previousAutoSubjectName = previousAutoSubjectNameRef.current
			previousAutoSubjectNameRef.current = nextSubjectName

			if (!nextSubjectName) {
				return current
			}

			const currentSubjectName = trimText(current.package.subjectName)
			const shouldReplace = !currentSubjectName || currentSubjectName === previousAutoSubjectName
			if (!shouldReplace || currentSubjectName === nextSubjectName) {
				return current
			}

			return {
				...current,
				package: {
					...current.package,
					subjectName: nextSubjectName,
				},
			}
		})
	}, [form.package.subjectKey, reusablePackageSubject])

	useEffect(() => {
		setForm((current) => {
			const nextMetadata = {
				...current.questionBank.metadata,
				grade: trimText(current.package.grade),
				subject: trimText(current.package.subjectKey),
				chapter: trimText(current.package.round.chapter),
			}

			if (
				current.questionBank.metadata.grade === nextMetadata.grade &&
				current.questionBank.metadata.subject === nextMetadata.subject &&
				current.questionBank.metadata.chapter === nextMetadata.chapter
			) {
				return current
			}

			return {
				...current,
				questionBank: {
					...current.questionBank,
					metadata: nextMetadata,
				},
			}
		})
	}, [form.package.grade, form.package.subjectKey, form.package.round.chapter])

	useEffect(() => {
		setForm((current) => {
			const currentRoundId = trimText(current.package.roundId)
			const previousAutoRoundId = previousAutoRoundIdRef.current
			previousAutoRoundIdRef.current = suggestedRoundId
			const shouldReplaceRoundId = !currentRoundId || currentRoundId === previousAutoRoundId || ['R1', 'P1', 'E1'].includes(currentRoundId)

			if (!shouldReplaceRoundId || currentRoundId === suggestedRoundId) {
				return current
			}

			return {
				...current,
				package: {
					...current.package,
					roundId: suggestedRoundId,
				},
			}
		})
	}, [suggestedRoundId])

	useEffect(() => {
		setForm((current) => {
			const currentRoundName = trimText(current.package.round.name)
			const previousAutoRoundName = previousAutoRoundNameRef.current
			previousAutoRoundNameRef.current = suggestedRoundName
			const shouldReplaceRoundName = !currentRoundName || currentRoundName === previousAutoRoundName

			if (!shouldReplaceRoundName || currentRoundName === suggestedRoundName) {
				return current
			}

			return {
				...current,
				package: {
					...current.package,
					round: {
						...current.package.round,
						name: suggestedRoundName,
					},
				},
			}
		})
	}, [suggestedRoundName])

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

	useEffect(() => {
		setStageVisibility((current) => {
			const next = {
				...current,
				package: true,
			}

			if (!packageStageReady) {
				next.exam = false
				next.questionBank = false
			}

			if (!examStageReady) {
				next.questionBank = false
			}

			if (
				current.package === next.package &&
				current.exam === next.exam &&
				current.questionBank === next.questionBank
			) {
				return current
			}

			return next
		})
	}, [packageStageReady, examStageReady])

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

	async function handlePackageIconUpload(file) {
		if (!file) {
			return
		}

		setAssetUploadState({ loadingKey: 'package-icon', error: '', success: '' })

		try {
			const body = new FormData()
			body.append('file', file)
			body.append('assetType', 'package-icon')
			body.append('examMode', examMode)
			body.append('packageId', trimText(form.packageId) || generatedIds.packageId || '')
			body.append('packageName', trimText(form.package.name) || 'package')

			const response = await fetch(`${API_BASE_URL}/api/company-exams/upload-asset`, {
				method: 'POST',
				body,
			})
			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Upload failed')
			}

			const uploadedUrl = trimText(data.url || data.downloadUrl || data.packageIcon)
			if (!uploadedUrl) {
				throw new Error('Upload succeeded but no URL was returned')
			}

			updatePackageField('packageIcon', uploadedUrl)
			setAssetUploadState({
				loadingKey: '',
				error: '',
				success: `${file.name} uploaded and linked successfully.`,
			})
		} catch (error) {
			setAssetUploadState({ loadingKey: '', error: error.message || 'Upload failed', success: '' })
		}
	}

	async function handleQuestionBankPdfImport(file) {
		if (!file) {
			return
		}

		setQuestionBankImportState({
			loading: true,
			error: '',
			success: '',
			warnings: [],
		})

		try {
			const body = new FormData()
			body.append('file', file)

			const response = await fetch(`${API_BASE_URL}/api/company-exams/question-banks/import-pdf`, {
				method: 'POST',
				body,
			})
			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Unable to import questions from this PDF')
			}

			const importedQuestions = Array.isArray(data.questions)
				? data.questions.map((question, index) => normalizeDraftQuestion(question, index))
				: []

			if (!importedQuestions.length) {
				throw new Error('The PDF was parsed, but no questions were returned')
			}

			const warningList = Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : []
			const importedTotalQuestions = String(data.metadata?.totalQuestions || importedQuestions.length)

			updateForm((current) => ({
				...current,
				questionBank: {
					...current.questionBank,
					metadata: {
						...current.questionBank.metadata,
						totalQuestions: importedTotalQuestions,
					},
					questions: importedQuestions,
				},
			}))

			setQuestionBankImportState({
				loading: false,
				error: '',
				success: `${importedQuestions.length} question${importedQuestions.length === 1 ? '' : 's'} imported from ${file.name}.${warningList.length ? ` Review ${warningList.length} parser note${warningList.length === 1 ? '' : 's'} below.` : ''}`,
				warnings: warningList,
			})
		} catch (error) {
			setQuestionBankImportState({
				loading: false,
				error: error.message || 'Unable to import questions from this PDF',
				success: '',
				warnings: [],
			})
		}
	}

	function toggleManualId(field) {
		setManualIds((current) => ({
			...current,
			[field]: !current[field],
		}))
	}

	function toggleStageVisibility(stageKey) {
		const stageIsUnlocked = stageKey === 'exam' ? examStageUnlocked : stageKey === 'questionBank' ? questionBankStageUnlocked : true

		if (!stageIsUnlocked) {
			return
		}

		setStageVisibility((current) => {
			const isOpening = !current[stageKey]
			const next = {
				...current,
				package: true,
				[stageKey]: !current[stageKey],
			}

			if (isOpening && stageKey === 'exam') {
				next.questionBank = false
			}

			if (isOpening && stageKey === 'questionBank') {
				next.exam = false
			}

			return next
		})
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

	async function reloadDraftLibrary(options = {}) {
		const { silent = false } = options

		if (!silent) {
			setDraftLibrary((current) => ({
				...current,
				loading: true,
				error: '',
			}))
		}

		try {
			const response = await fetch(`${API_BASE_URL}/api/company-exams/drafts?mode=${encodeURIComponent(normalizedRouteMode)}`)
			const data = await response.json()
			if (!response.ok) {
				throw new Error(data.error || 'Unable to load draft workspace')
			}

			setDraftLibrary({ loading: false, error: '', drafts: Array.isArray(data.drafts) ? data.drafts : [] })
		} catch (error) {
			setDraftLibrary((current) => ({
				loading: false,
				error: error.message || 'Unable to load draft workspace',
				drafts: silent ? current.drafts : [],
			}))
		}
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

	async function handleLoadDraft(draftId) {
		setDraftState((current) => ({
			...current,
			loading: true,
			error: '',
			success: '',
		}))
		setAssetUploadState({ loadingKey: '', error: '', success: '' })
		setQuestionBankImportState(createQuestionBankImportState())

		try {
			const response = await fetch(`${API_BASE_URL}/api/company-exams/drafts/${encodeURIComponent(draftId)}`)
			const data = await response.json()
			if (!response.ok) {
				throw new Error(data.error || 'Unable to open draft')
			}

			const nextForm = normalizeDraftForm(data.form, normalizedRouteMode)

			autoPackageDefaultsRef.current = { packageId: '', name: '', description: '', packageIcon: '', entranceYear: '', active: true }
			previousAutoSubjectNameRef.current = ''
			previousAutoRoundIdRef.current = ''
			previousAutoRoundNameRef.current = ''
			setForm(nextForm)
			setManualIds(normalizeManualIds(data.manualIds))
			setActiveDraftId(data.draftId)
			setAllowOverwrite(workspaceTargetsExistingRecord(nextForm))
			setDraftState({
				loading: false,
				error: '',
				success: `${data.label || 'Draft'} loaded from Firebase. Continue editing and save again whenever you need.`,
				lastSavedAt: data.updatedAt || null,
				hasDraft: true,
			})
		} catch (error) {
			setDraftState({
				loading: false,
				error: error.message || 'Unable to open draft',
				success: '',
				lastSavedAt: null,
				hasDraft: Boolean(activeDraftId),
			})
		}
	}

	async function saveDraftWorkspace() {
		const response = await fetch(`${API_BASE_URL}/api/company-exams/drafts/save-record`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				draftId: activeDraftId || undefined,
				routeMode: normalizedRouteMode,
				form,
				manualIds,
			}),
		})
		const data = await response.json()

		if (!response.ok) {
			throw new Error(data.error || 'Unable to save draft workspace')
		}

		setActiveDraftId(data.saved.draftId)
		return data.saved
	}

	async function handleSaveDraft() {
		setDraftState((current) => ({
			...current,
			loading: true,
			error: '',
			success: '',
		}))

		try {
			const savedDraft = await saveDraftWorkspace()
			setDraftState({
				loading: false,
				error: '',
				success: `${savedDraft.label || 'Draft'} saved to Firebase with ${savedDraft.startedQuestionCount ?? startedQuestionCount} started question${(savedDraft.startedQuestionCount ?? startedQuestionCount) === 1 ? '' : 's'}. You can switch to another package and reopen this one later.`,
				lastSavedAt: savedDraft.updatedAt || Date.now(),
				hasDraft: true,
			})
			await reloadDraftLibrary()
		} catch (error) {
			setDraftState({
				loading: false,
				error: error.message || 'Unable to save draft workspace.',
				success: '',
				lastSavedAt: null,
				hasDraft: Boolean(activeDraftId),
			})
		}
	}

	async function handleDeleteDraft(targetDraftId = activeDraftId) {
		if (!targetDraftId) {
			return
		}

		const targetDraft = draftLibrary.drafts.find((item) => item.draftId === targetDraftId) || null
		const targetDraftLabel = targetDraft?.label || targetDraft?.packageId || targetDraftId
		const activeDraftIdAtStart = activeDraftId
		const lastSavedAtAtStart = draftState.lastSavedAt
		const wasActiveDraft = targetDraftId === activeDraftIdAtStart

		if (typeof window !== 'undefined') {
			const shouldClear = window.confirm(`Delete this ${formatModeLabel(normalizedRouteMode).toLowerCase()} draft from Firebase?`)
			if (!shouldClear) {
				return
			}
		}

		setDraftState((current) => ({
			...current,
			loading: true,
			error: '',
			success: '',
		}))

		try {
			const response = await fetch(`${API_BASE_URL}/api/company-exams/drafts/${encodeURIComponent(targetDraftId)}/delete`, {
				method: 'POST',
			})
			const data = await response.json()
			const draftWasMissing = response.status === 404
			if (!response.ok && !draftWasMissing) {
				throw new Error(data.error || 'Unable to delete draft')
			}

			setDraftLibrary((current) => ({
				loading: false,
				error: '',
				drafts: current.drafts.filter((item) => item.draftId !== targetDraftId),
			}))

			if (wasActiveDraft) {
				setActiveDraftId('')
			}

			setDraftState({
				loading: false,
				error: '',
				success: wasActiveDraft
					? `${targetDraftLabel} was removed${draftWasMissing ? ' after Firebase reported it was already missing' : ''}. Current form values stay on screen until you start a new draft or load another one.`
					: `${targetDraftLabel} was removed${draftWasMissing ? ' after Firebase reported it was already missing' : ''}.`,
				lastSavedAt: wasActiveDraft ? null : lastSavedAtAtStart,
				hasDraft: wasActiveDraft ? false : Boolean(activeDraftIdAtStart && activeDraftIdAtStart !== targetDraftId),
			})
			await reloadDraftLibrary({ silent: true })
		} catch (error) {
			setDraftState({
				loading: false,
				error: error.message || 'Unable to delete draft',
				success: '',
				lastSavedAt: lastSavedAtAtStart,
				hasDraft: Boolean(activeDraftIdAtStart),
			})
		}
	}

	function handleStartNewDraft() {
		const shouldConfirm = activeDraftId || hasDraftableFormContent(form)
		if (shouldConfirm && typeof window !== 'undefined') {
			const confirmed = window.confirm(`Start a new ${formatModeLabel(normalizedRouteMode).toLowerCase()} draft? Your current form stays saved only if you already used Save draft.`)
			if (!confirmed) {
				return
			}
		}

		autoPackageDefaultsRef.current = { packageId: '', name: '', description: '', packageIcon: '', entranceYear: '', active: true }
		previousAutoSubjectNameRef.current = ''
		previousAutoRoundIdRef.current = ''
		previousAutoRoundNameRef.current = ''
		setForm(createInitialForm(normalizedRouteMode))
		setManualIds(createManualIdState())
		setAllowOverwrite(false)
		setAssetUploadState({ loadingKey: '', error: '', success: '' })
		setQuestionBankImportState(createQuestionBankImportState())
		setActiveDraftId('')
		setStageVisibility({ package: true, exam: false, questionBank: false })
		setDraftState({
			loading: false,
			error: '',
			success: `Ready for a new ${formatModeLabel(normalizedRouteMode).toLowerCase()} package draft. Save draft when you want this version stored in Firebase.`,
			lastSavedAt: null,
			hasDraft: false,
		})
	}

	async function handleSubmit(event) {
		event.preventDefault()
		setSubmitState({ loading: true, error: '', success: '' })

		try {
			validateCompanyExamSubmission(payload)
		} catch (error) {
			setSubmitState({ loading: false, error: error.message || 'Save failed', success: '' })
			return
		}

		const publishConflictMessage = allowOverwrite ? '' : getPublishConflictMessage(form)
		if (publishConflictMessage) {
			setSubmitState({ loading: false, error: publishConflictMessage, success: '' })
			return
		}

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

			let savedDraft = null
			let draftSyncError = ''

			try {
				savedDraft = await saveDraftWorkspace()
				setDraftState({
					loading: false,
					error: '',
					success: `${savedDraft.label || 'Draft'} stays in Firebase after publish. Keep editing this workspace and save record again whenever you need to update the same package, exam, and question bank IDs.`,
					lastSavedAt: savedDraft.updatedAt || Date.now(),
					hasDraft: true,
				})
			} catch (error) {
				draftSyncError = error.message || 'Unable to keep the draft workspace in Firebase.'
			}

			setAllowOverwrite(true)

			setSubmitState({
				loading: false,
				error: '',
				success: `Saved ${data.saved.questionBankId}, ${data.saved.examId}, and ${data.saved.packageId} into ${data.location}. ${savedDraft ? 'The draft workspace stayed in Firebase for more edits.' : `Published record saved, but the draft workspace could not be synced: ${draftSyncError}`} Overwrite is now enabled so you can update the same IDs from this page. Students only see the published record.`,
			})
			await reloadOverview()
			await reloadDraftLibrary({ silent: Boolean(savedDraft) })
		} catch (error) {
			setSubmitState({ loading: false, error: error.message || 'Save failed', success: '' })
		}
	}

	return (
		<div className='google-dashboard'>
			<CompanySidebar />
			<main className='google-main company-main'>
				<div className={`exam-shell builder-shell exam-premium-shell ${questionBankFocus ? 'question-bank-focus' : ''}`}>
					<section className='hero-panel exam-hero-panel exam-premium-hero'>
						<div className='hero-copy exam-hero-copy'>
							<div className='exam-hero-kicker-row'>
								<span className='eyebrow'>Platform1 Exam Builder</span>
								<span className={`pill ${getModePillClass(examMode)}`}>{formatModeLabel(examMode)}</span>
							</div>
							<h1>Build everything from one premium package workspace</h1>
							<p>
								Start with the package shell, open the exam only when you need to configure it, then expand the question bank
								into a full-width writing surface for fast question entry. The flow stays clean without exposing low-signal
								technical clutter.
							</p>
							<div className='hero-actions'>
								<a className='primary-action' href='#builder-form'>Open builder</a>
								<button
									className='secondary-action'
									type='button'
									onClick={() => setIsDraftLibraryVisible((current) => !current)}
									aria-expanded={isDraftLibraryVisible}
									aria-controls='exam-drafts'
								>
									{isDraftLibraryVisible ? 'Hide drafts' : 'Show drafts'}
								</button>
							</div>
							{loadState.error ? <div className='status-banner warning'>{loadState.error}</div> : null}
							{draftState.error ? <div className='status-banner warning'>{draftState.error}</div> : null}
							{draftLibrary.error ? <div className='status-banner warning'>{draftLibrary.error}</div> : null}
							{assetUploadState.error ? <div className='status-banner warning'>{assetUploadState.error}</div> : null}
							{draftState.success ? <div className='status-banner success-banner'>{draftState.success}</div> : null}
							{assetUploadState.success ? <div className='status-banner success-banner'>{assetUploadState.success}</div> : null}
							{submitState.error ? <div className='status-banner warning'>{submitState.error}</div> : null}
							{submitState.success ? <div className='status-banner success-banner'>{submitState.success}</div> : null}
						</div>

						
					</section>

					{isDraftLibraryVisible ? (
					<section className='section-block exam-draft-section' id='exam-drafts'>
						<div className='section-header-row'>
							<div className='section-heading'>
								<span className='section-kicker'>Draft Workspace</span>
								<h2>Keep premium draft workspaces ready</h2>
								<p className='inline-note'>
									{activeDraft
										? `Currently editing ${activeWorkspaceLabel}. Open another draft any time and continue from its latest Firebase save.`
										: 'Save draft stores the package, exam, and question bank in Firebase so you can reopen the workspace later.'}
								</p>
							</div>

							<div className='exam-draft-toolbar'>
								<span className='config-key'>
									{draftLibrary.loading
										? 'Syncing draft workspace...'
										: `${draftLibrary.drafts.length} draft${draftLibrary.drafts.length === 1 ? '' : 's'} stored in Firebase`}
								</span>
								<button className='ghost-button' type='button' onClick={() => setIsDraftLibraryVisible(false)} disabled={draftState.loading || submitState.loading}>
									Hide drafts
								</button>
								<button className='secondary-action' type='button' onClick={handleStartNewDraft} disabled={draftState.loading || submitState.loading}>
									Start new draft
								</button>
							</div>
						</div>

						<div className='catalog-grid exam-draft-grid'>
							{draftLibrary.loading ? (
								<article className='catalog-card exam-draft-card exam-draft-empty'>
									<span className='pill pill-teal'>Loading</span>
									<h3>Reading draft workspace</h3>
									<p className='catalog-footnote'>Fetching saved package drafts from Firebase.</p>
								</article>
							) : draftLibrary.drafts.length ? (
								draftLibrary.drafts.map((item) => (
									<article className={`catalog-card exam-draft-card ${activeDraftId === item.draftId ? 'is-active' : ''}`} key={item.draftId}>
										<div className='catalog-meta-row exam-draft-meta-row'>
											<span className={`pill ${getModePillClass(item.routeMode)}`}>{formatModeLabel(item.routeMode)}</span>
											{activeDraftId === item.draftId ? <span className='pill pill-teal'>Active</span> : null}
										</div>
										<h3>{item.label || item.packageId || item.draftId}</h3>
										<p className='catalog-footnote'>
											{[
												formatReadableToken(item.grade),
												item.subjectName || formatReadableToken(item.subjectKey),
												item.chapter ? formatReadableToken(item.chapter) : '',
											].filter(Boolean).join(' • ') || 'Metadata still in progress'}
										</p>
										<div className='exam-draft-metrics'>
											<div>
												<span className='config-key'>Started</span>
												<strong>{item.startedQuestionCount ?? 0}</strong>
											</div>
											<div>
												<span className='config-key'>Saveable</span>
												<strong>{item.saveableQuestionCount ?? 0}</strong>
											</div>
											<div>
												<span className='config-key'>Round</span>
												<strong>{item.roundId || '-'}</strong>
											</div>
										</div>
										<p className='inline-note'>Updated {formatDateTime(item.updatedAt)}</p>
										<div className='exam-draft-actions'>
											<button className='secondary-action' type='button' onClick={() => handleLoadDraft(item.draftId)} disabled={draftState.loading || submitState.loading}>
												{activeDraftId === item.draftId ? 'Reload draft' : 'Open draft'}
											</button>
											<button className='ghost-button' type='button' onClick={() => handleDeleteDraft(item.draftId)} disabled={draftState.loading || submitState.loading}>
												Delete
											</button>
										</div>
									</article>
								))
							) : (
								<article className='catalog-card exam-draft-card exam-draft-empty'>
									<span className='pill pill-coral'>No drafts yet</span>
									<h3>Save your first package draft</h3>
									<p className='catalog-footnote'>Store Biology, English, and any other package drafts in Firebase, then reopen any one later to keep adding questions.</p>
								</article>
							)}
						</div>
					</section>
					) : null}

					<section className='section-block exam-composer-section' id='builder-form'>
						<div className='section-header-row exam-composer-header'>
							<div className='section-heading'>
								<span className='section-kicker'>Composer</span>
								<h2>Keep exam setup and question writing inside the package card</h2>
								<p className='inline-note'>The package stays visible, the exam expands below it, and the question bank switches into a full-width focused workspace when opened.</p>
							</div>

							<div className='exam-composer-toolbar'>
								<span className='config-key'>{activeDraft ? `Editing ${activeWorkspaceLabel}` : 'Fresh package workspace'}</span>
								<label className='toggle-field'>
									<input type='checkbox' checked={allowOverwrite} onChange={(event) => setAllowOverwrite(event.target.checked)} />
									<span>Allow overwrite for existing Platform1 IDs</span>
								</label>
							</div>
						</div>

						<div className='builder-grid exam-builder-grid'>
							<form className={`builder-form-panel exam-builder-panel ${questionBankFocus ? 'question-bank-focus' : ''}`} onSubmit={handleSubmit} noValidate>
								<section className={`form-card package-card exam-stage-card exam-stage-package is-open ${packageStageTone} ${questionBankFocus ? 'question-bank-focus' : ''}`}>
									<div className='exam-stage-header exam-package-header'>
										<div className='exam-stage-header-row'>
											<div className='exam-stage-title'>
												<span className='exam-stage-badge'>01</span>
												<div className='compact-heading exam-stage-heading'>
													<span className='section-kicker'>Package Workspace</span>
													<h2>Start here and expand the rest inside it</h2>
												</div>
											</div>

											<div className='exam-stage-controls'>
												<span className={`exam-stage-status ${packageStageTone}`}>{packageStageReady ? 'Ready' : 'In progress'}</span>
												<span className={`pill ${getModePillClass(examMode)}`}>{formatModeLabel(examMode)}</span>
											</div>
										</div>
										<p className='exam-stage-note'>The package remains the main workspace. Open exam setup and question writing below only when you need them.</p>
									</div>

									<div className='exam-summary-grid exam-package-snapshot-grid'>
										<div className='exam-summary-card'>
											<p className='config-key'>Package ID</p>
											<p className='exam-summary-value'>{trimText(form.packageId) || generatedIds.packageId || 'Auto ID pending'}</p>
											<p className='exam-summary-note'>{packageNameLabel}</p>
										</div>
										<div className='exam-summary-card'>
											<p className='config-key'>Grade and subject</p>
											<p className='exam-summary-value'>{packageGradeLabel}</p>
											<p className='exam-summary-note'>{packageSubjectLabel}</p>
										</div>
										<div className='exam-summary-card'>
											<p className='config-key'>Round</p>
											<p className='exam-summary-value'>{currentRoundId}</p>
											<p className='exam-summary-note'>{roundNameLabel}</p>
										</div>
										<div className='exam-summary-card'>
											<p className='config-key'>Question bank</p>
											<p className='exam-summary-value'>{trimText(form.questionBankId) || generatedIds.questionBankId || 'Unlock after exam'}</p>
											<p className='exam-summary-note'>
												{questionBankFocus
													? 'Focus mode active for question writing.'
													: `${savedQuestionCount} question${savedQuestionCount === 1 ? '' : 's'} currently saveable.`}
											</p>
										</div>
									</div>

									<div className='exam-stage-body' id='package-stage-body'>
										<div className={`exam-smart-defaults ${reusablePackage ? 'is-linked' : 'is-empty'}`}>
											<div className='exam-smart-defaults-copy'>
												<p className='config-key'>Smart defaults</p>
												<h3>{reusablePackage ? `Reusing ${reusablePackage.packageId}` : 'No matching package yet'}</h3>
												<p>
													{reusablePackage
														? `Package-level values are loaded from ${reusablePackage.name || reusablePackage.packageId}. Change only the subject and round details that are new.`
														: 'When this grade already has a saved package for the current mode, the shared package details are filled automatically so you do not enter them again.'}
												</p>
											</div>

											<div className='exam-smart-defaults-metrics'>
												<div>
													<span className='config-key'>Package</span>
													<strong>{reusablePackage ? reusablePackage.packageId : 'New package'}</strong>
												</div>
												<div>
													<span className='config-key'>Subjects</span>
													<strong>{reusablePackage ? reusablePackageSubjectCount : 0}</strong>
												</div>
												<div>
													<span className='config-key'>This subject rounds</span>
													<strong>{reusableSubjectRounds.length}</strong>
												</div>
												<div>
													<span className='config-key'>Next round</span>
													<strong>{suggestedRoundId}</strong>
												</div>
											</div>

											<p className='exam-smart-defaults-note'>
												{reusablePackage
													? reusablePackageSubject
														? reusableSubjectRoundLabels.length
															? `${reusablePackageSubject.name || packageSubjectLabel} already has ${reusableSubjectRounds.length} round${reusableSubjectRounds.length === 1 ? '' : 's'}: ${reusableSubjectRoundLabels.join(', ')}. ${suggestedRoundId} is ready by default.`
															: `${reusablePackageSubject.name || packageSubjectLabel} already exists in this package. ${suggestedRoundId} is ready as the next round.`
														: `${packageSubjectLabel} is new inside this package, so ${suggestedRoundId} is prepared as the first round.`
													: 'Save the first package once, and the next subject you add for this grade and mode will open with shared package values already in place.'}
											</p>
										</div>

										<div className='form-grid two-column exam-package-grid'>
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
													<small className='field-hint'>
														{reusablePackage
															? 'Loaded from the matching package. Edit it only when the shared package record itself should change.'
															: 'This stays at package level and is reused for subjects stored under the same package.'}
													</small>
											</label>

											<label className='field'>
												<span>Grade</span>
												<input value={form.package.grade} onChange={(event) => updatePackageField('grade', event.target.value)} placeholder='grade7' required />
											</label>

											<label className='field'>
												<span>Subject key</span>
												<input value={form.package.subjectKey} onChange={(event) => updatePackageField('subjectKey', event.target.value)} placeholder='general_science' required />
													<small className='field-hint'>Use the subject database key, such as mathematics or english.</small>
											</label>

											<label className='field'>
												<span>Subject name</span>
												<input value={form.package.subjectName} onChange={(event) => updatePackageField('subjectName', event.target.value)} placeholder='General Science' required />
													<small className='field-hint'>This is auto-filled from saved package data when the subject already exists.</small>
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
													<small className='field-hint'>Entrance packages include the entrance year in the package and exam ID flow.</small>
												</label>
											) : null}

											<label className='field'>
												<span>Round ID</span>
												<input value={form.package.roundId} onChange={(event) => updatePackageField('roundId', event.target.value)} placeholder={suggestedRoundId} required />
													<small className='field-hint'>
														{reusablePackageSubject
															? `${suggestedRoundId} is suggested because this subject already has ${reusableSubjectRounds.length} round${reusableSubjectRounds.length === 1 ? '' : 's'} in the package.`
															: `Suggested round ID: ${suggestedRoundId}. Competitive uses R1, R2, R3 while practice uses P1, P2, P3.`}
													</small>
											</label>

											<label className='field'>
												<span>Round name</span>
													<input value={form.package.round.name} onChange={(event) => updateRoundField('name', event.target.value)} placeholder={suggestedRoundName} required />
													<small className='field-hint'>Until you type your own label, this stays aligned with the next round number.</small>
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
													<small className='field-hint'>
														{reusablePackage
															? 'Reused from the shared package so you do not type it again for each subject.'
															: 'Write the shared package description once. Future subjects in this package will reuse it.'}
													</small>
											</label>

											<div className='field field-span-2 exam-package-icon-field'>
												<span>Package icon</span>
												<label className='secondary-action exam-package-icon-upload'>
													<input
														type='file'
														accept='image/*'
														hidden
														onChange={(event) => {
															const nextFile = event.target.files?.[0]
															if (nextFile) {
																handlePackageIconUpload(nextFile)
															}
															event.target.value = ''
														}}
													/>
													<span>{assetUploadState.loadingKey === 'package-icon' ? 'Uploading icon...' : 'Upload package icon'}</span>
												</label>
												<span className='field-hint'>Accepted: JPG, PNG, WEBP, GIF. The icon URL is stored in the database without being shown in this form.</span>
												{trimText(form.package.packageIcon) ? (
													<div className='exam-package-icon-state'>
														<strong>Package icon stored</strong>
														<span>The uploaded package icon is linked and ready to save.</span>
													</div>
												) : null}
											</div>
										</div>

										<div className='toggle-grid'>
											<label className='toggle-field'>
												<input type='checkbox' checked={form.package.active} onChange={(event) => updatePackageField('active', event.target.checked)} />
												<span>Package active</span>
											</label>
										</div>

										<div className='field-group-note'>Set scheduling only if the round needs opening, closing, or result-release automation. Leaving these blank keeps the record clean.</div>

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

										<div className='exam-stage-launchers'>
											<button
												className={`exam-stage-launcher tone-teal ${stageVisibility.exam ? 'is-open' : ''}`}
												type='button'
												onClick={() => toggleStageVisibility('exam')}
												aria-expanded={stageVisibility.exam}
												aria-controls='exam-stage-body'
												disabled={!examToggleEnabled}
											>
												<span className='exam-stage-launcher-step'>02</span>
												<div className='exam-stage-launcher-copy'>
													<div className='exam-stage-launcher-top'>
														<strong>Exam setup</strong>
														<span className={`exam-stage-status ${examStageTone}`}>{!examStageUnlocked ? 'Locked' : examStageReady ? 'Ready' : 'Configure'}</span>
													</div>
													<p>{trimText(form.examId) || generatedIds.examId || 'Auto exam ID appears after package details are filled.'}</p>
													<span className='exam-stage-launcher-note'>
														{toOptionalNumber(form.exam.timeLimit) ?? 1800}s limit • {toOptionalNumber(form.exam.totalQuestions) ?? savedQuestionCount} questions • {getStageToggleText(stageVisibility.exam, examStageUnlocked, examStageReady)}
													</span>
												</div>
											</button>

											<button
												className={`exam-stage-launcher tone-accent ${stageVisibility.questionBank ? 'is-open' : ''} ${questionBankFocus ? 'is-focus' : ''}`}
												type='button'
												onClick={() => toggleStageVisibility('questionBank')}
												aria-expanded={stageVisibility.questionBank}
												aria-controls='question-bank-stage-body'
												disabled={!questionBankToggleEnabled}
											>
												<span className='exam-stage-launcher-step'>03</span>
												<div className='exam-stage-launcher-copy'>
													<div className='exam-stage-launcher-top'>
														<strong>Question bank</strong>
														<span className={`exam-stage-status ${questionBankStageTone}`}>{!questionBankStageUnlocked ? 'Locked' : questionBankStageReady ? 'Ready' : 'Writing'}</span>
													</div>
													<p>{trimText(form.questionBankId) || generatedIds.questionBankId || 'Unlock after finishing exam setup.'}</p>
													<span className='exam-stage-launcher-note'>
														{startedQuestionCount} started • {savedQuestionCount} saveable • {questionBankFocus ? 'Full-width focus mode active' : getStageToggleText(stageVisibility.questionBank, questionBankStageUnlocked, questionBankStageReady)}
													</span>
												</div>
											</button>
										</div>

										{!examStageUnlocked ? <p className='exam-stage-lock-note'>Complete the package essentials to unlock exam setup and question writing.</p> : null}

										{stageVisibility.exam && examStageUnlocked ? (
											<section className={`exam-nested-panel exam-stage-card exam-stage-exam ${stageVisibility.exam ? 'is-open' : 'is-collapsed'} ${examStageTone}`}>
												<div className='exam-stage-header'>
													<div className='exam-stage-header-row'>
														<div className='exam-stage-title'>
															<span className='exam-stage-badge'>02</span>
															<div className='compact-heading exam-stage-heading'>
																<span className='section-kicker'>Exam</span>
																<h2>Configure the exam inside the package</h2>
															</div>
														</div>

														<div className='exam-stage-controls'>
															<span className={`exam-stage-status ${examStageTone}`}>{examStageReady ? 'Ready' : 'Needs details'}</span>
															<button
																className='exam-stage-toggle'
																type='button'
																onClick={() => toggleStageVisibility('exam')}
																aria-expanded={stageVisibility.exam}
																aria-controls='exam-stage-body'
																disabled={!examToggleEnabled}
															>
																{getStageToggleText(stageVisibility.exam, examStageUnlocked, examStageReady)}
															</button>
														</div>
													</div>
													<p className='exam-stage-note'>Tune timer, attempts, scoring, and instructions here without leaving the package workspace.</p>
												</div>

												<div className='exam-summary-grid'>
													<div className='exam-summary-card'>
														<p className='config-key'>Exam ID</p>
														<p className='exam-summary-value'>{trimText(form.examId) || generatedIds.examId || 'Auto ID pending'}</p>
														<p className='exam-summary-note'>{examTitleLabel}</p>
													</div>
													<div className='exam-summary-card'>
														<p className='config-key'>Exam mode</p>
														<p className='exam-summary-value'>{formatModeLabel(examMode)}</p>
														<p className='exam-summary-note'>Linked to round {currentRoundId}</p>
													</div>
													<div className='exam-summary-card'>
														<p className='config-key'>Question plan</p>
														<p className='exam-summary-value'>{toOptionalNumber(form.exam.totalQuestions) ?? savedQuestionCount}</p>
														<p className='exam-summary-note'>Pool {toOptionalNumber(form.exam.questionPoolSize) ?? savedQuestionCount} • {toOptionalNumber(form.exam.timeLimit) ?? 1800}s limit</p>
													</div>
												</div>

												<div className='exam-stage-body' id='exam-stage-body'>
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
															<small className='field-hint'>{manualIds.exam ? 'Manual mode is on for this ID.' : generatedIds.examId || 'Auto format follows subject, chapter, and round.'}</small>
														</label>

														<label className='field'>
															<span>Exam type</span>
															<input className='field-auto-input' value={formatModeLabel(examMode)} readOnly />
															<small className='field-hint'>Exam type comes from the Exams sidebar group you opened.</small>
														</label>

														<label className='field'>
															<span>Optional title</span>
															<input value={form.exam.title} onChange={(event) => updateExamField('title', event.target.value)} placeholder='Round 1 - Chapter 1' />
														</label>

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
														<button className='secondary-action inline-button' type='button' onClick={addInstruction}>Add line</button>
													</div>

													<div className='stack-list tight-stack'>
														{form.exam.textItems.map((item, index) => (
															<div className='inline-row' key={`instruction-${index}`}>
																<input className='row-input' value={item} onChange={(event) => updateInstruction(index, event.target.value)} placeholder={index === 0 ? 'No switching apps' : 'Submit before timer ends'} />
																{form.exam.textItems.length > 1 ? <button className='ghost-button' type='button' onClick={() => removeInstruction(index)}>Remove</button> : null}
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
												</div>
											</section>
										) : null}

										{stageVisibility.questionBank && questionBankStageUnlocked ? (
											<section className={`exam-nested-panel exam-stage-card exam-stage-bank ${stageVisibility.questionBank ? 'is-open' : 'is-collapsed'} ${questionBankStageTone} ${questionBankFocus ? 'is-focus' : ''}`}>
												<div className='exam-stage-header'>
													<div className='exam-stage-header-row'>
														<div className='exam-stage-title'>
															<span className='exam-stage-badge'>03</span>
															<div className='compact-heading exam-stage-heading'>
																<span className='section-kicker'>Question Bank</span>
																<h2>Expand the question bank into full-width focus</h2>
															</div>
														</div>

														<div className='exam-stage-controls'>
															<span className={`exam-stage-status ${questionBankStageTone}`}>{questionBankStageReady ? 'Ready' : 'Writing'}</span>
															<button
																className='exam-stage-toggle'
																type='button'
																onClick={() => toggleStageVisibility('questionBank')}
																aria-expanded={stageVisibility.questionBank}
																aria-controls='question-bank-stage-body'
																disabled={!questionBankToggleEnabled}
															>
																{getStageToggleText(stageVisibility.questionBank, questionBankStageUnlocked, questionBankStageReady)}
															</button>
														</div>
													</div>
													<p className='exam-stage-note'>This is the focused writing surface. Use it for metadata and questions once the package and exam are already shaped.</p>
												</div>

												<div className='exam-summary-grid'>
													<div className='exam-summary-card'>
														<p className='config-key'>Question bank ID</p>
														<p className='exam-summary-value'>{trimText(form.questionBankId) || generatedIds.questionBankId || 'Auto ID pending'}</p>
														<p className='exam-summary-note'>{chapterLabel}</p>
													</div>
													<div className='exam-summary-card'>
														<p className='config-key'>Metadata focus</p>
														<p className='exam-summary-value'>{questionBankGradeLabel}</p>
														<p className='exam-summary-note'>{questionBankSubjectLabel} • {chapterLabel}</p>
													</div>
													<div className='exam-summary-card'>
														<p className='config-key'>Draft question progress</p>
														<p className='exam-summary-value'>{startedQuestionCount}</p>
														<p className='exam-summary-note'>{savedQuestionCount} question{savedQuestionCount === 1 ? '' : 's'} currently saveable</p>
													</div>
												</div>

												<div className='exam-stage-body' id='question-bank-stage-body'>
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
															<input className='field-auto-input' value={form.questionBank.metadata.subject} readOnly required />
															<small className='field-hint'>Pulled from the package subject key so you do not enter it again.</small>
														</label>

														<label className='field'>
															<span>Grade</span>
															<input className='field-auto-input' value={form.questionBank.metadata.grade} readOnly required />
															<small className='field-hint'>Synced from the package grade.</small>
														</label>

														<label className='field'>
															<span>Chapter</span>
															<input className='field-auto-input' value={form.questionBank.metadata.chapter} readOnly required />
															<small className='field-hint'>Set the chapter once in the round section above. The question bank follows it automatically.</small>
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

														<div className='field field-span-2 exam-package-icon-field'>
															<span>Import questions from PDF</span>
															<label className='secondary-action exam-package-icon-upload'>
																<input
																	type='file'
																	accept='application/pdf,.pdf'
																	hidden
																	onChange={(event) => {
																		const nextFile = event.target.files?.[0]
																		if (nextFile) {
																			handleQuestionBankPdfImport(nextFile)
																		}
																		event.target.value = ''
																	}}
																/>
																<span>{questionBankImportState.loading ? 'Importing PDF...' : 'Upload exam PDF'}</span>
															</label>
															<span className='field-hint'>Use a text-based PDF where each question starts with 1. or 1), choices start with A./A), and answers use Answer: or Correct Answer:. Importing replaces the current draft questions.</span>
														</div>
													</div>

													{questionBankImportState.error ? <div className='status-banner warning'>{questionBankImportState.error}</div> : null}
													{questionBankImportState.success ? <div className='status-banner success-banner'>{questionBankImportState.success}</div> : null}
													{questionBankImportState.warnings.length ? (
														<div className='status-banner warning'>
															<strong>Import notes</strong>
															<div className='stack-list tight-stack'>
																{questionBankImportState.warnings.slice(0, 5).map((warning, index) => (
																	<p key={`${warning}-${index}`}>{warning}</p>
																))}
																{questionBankImportState.warnings.length > 5 ? <p>{questionBankImportState.warnings.length - 5} more import note{questionBankImportState.warnings.length - 5 === 1 ? '' : 's'} hidden.</p> : null}
															</div>
														</div>
													) : null}

													<div className='row-header'>
														<h3>Questions</h3>
														<button className='secondary-action inline-button' type='button' onClick={addQuestion}>Add question</button>
													</div>

													<div className='stack-list exam-question-stack'>
														{form.questionBank.questions.map((question, index) => (
															<article className='editor-card' key={`${question.key}-${index}`}>
																<div className='row-header'>
																	<h3>Question {index + 1}</h3>
																	{form.questionBank.questions.length > 1 ? <button className='ghost-button' type='button' onClick={() => removeQuestion(index)}>Remove</button> : null}
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
												</div>
											</section>
										) : null}
									</div>
								</section>

								<div className='submit-row exam-submit-row'>
									{submitState.error ? <div className='status-banner warning'>{submitState.error}</div> : null}
									{submitState.success ? <div className='status-banner success-banner'>{submitState.success}</div> : null}
									<div className='exam-submit-actions'>
										<button className='secondary-action' type='button' onClick={handleSaveDraft} disabled={submitState.loading || draftState.loading}>
											{draftState.loading ? 'Working...' : activeDraftId ? 'Update draft' : 'Save draft'}
										</button>
										{activeDraftId ? <button className='ghost-button' type='button' onClick={() => handleDeleteDraft()} disabled={submitState.loading || draftState.loading}>Delete draft</button> : null}
										<button className='ghost-button' type='button' onClick={handleStartNewDraft} disabled={submitState.loading || draftState.loading}>New draft</button>
										<button className='primary-action' type='submit' disabled={submitState.loading}>{submitState.loading ? 'Saving to Platform1...' : 'Save record'}</button>
									</div>
									<p className='inline-note'>
										{draftState.lastSavedAt
											? `Last draft synced ${formatDateTime(draftState.lastSavedAt)}.${activeDraft ? ` Active workspace: ${activeWorkspaceLabel}.` : ''} Save record publishes the final package, exam, and bank nodes and keeps this workspace available for later edits.`
											: 'Save draft keeps this package workspace in Firebase. Save record publishes the final package, exam, and question bank nodes and keeps the draft available for later edits.'}
									</p>
								</div>
							</form>
						</div>
					</section>
				</div>
			</main>
		</div>
	)
}
