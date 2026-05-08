import { get, ref, update } from 'firebase/database'

const CHAT_SUMMARY_NODE = 'Chat_Summaries'
const DEFAULT_BATCH_SIZE = 25

function normalizeTimestamp(value) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value
	}

	if (typeof value === 'string') {
		const numericValue = Number(value)
		if (Number.isFinite(numericValue)) {
			return numericValue
		}

		const parsedValue = new Date(value).getTime()
		if (Number.isFinite(parsedValue)) {
			return parsedValue
		}
	}

	return 0
}

export function sortedChatId(id1, id2) {
	return [String(id1 || '').trim(), String(id2 || '').trim()].sort().join('_')
}

export function dedupeUserIds(values = []) {
	return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)))
}

async function mapInBatches(items, batchSize, mapper) {
	const results = []

	for (let index = 0; index < items.length; index += batchSize) {
		const batch = items.slice(index, index + batchSize)
		const batchResults = await Promise.all(batch.map(mapper))
		results.push(...batchResults)
	}

	return results
}

function buildChatSummaryPath(ownerUserId, chatId) {
	return `${CHAT_SUMMARY_NODE}/${String(ownerUserId || '').trim()}/${String(chatId || '').trim()}`
}

function buildOwnerChatSummariesPath(ownerUserId) {
	return `${CHAT_SUMMARY_NODE}/${String(ownerUserId || '').trim()}`
}

export function buildChatSummaryPreview({ text = '', type = '' } = {}) {
	const normalizedType = String(type || '').trim().toLowerCase()

	if (normalizedType === 'image') return 'Image'
	if (normalizedType === 'video') return 'Video'
	if (normalizedType === 'deleted') return ''

	return String(text || '').trim()
}

export function normalizeChatSummaryValue(value = {}, fallback = {}) {
	const lastMessageType = String(value?.lastMessageType || fallback?.lastMessageType || 'text').trim().toLowerCase() || 'text'
	const lastMessageTime = normalizeTimestamp(value?.lastMessageTime ?? fallback?.lastMessageTime)
	const unreadCount = Math.max(0, Number(value?.unreadCount ?? fallback?.unreadCount ?? 0) || 0)

	return {
		chatId: String(value?.chatId || fallback?.chatId || '').trim(),
		otherUserId: String(value?.otherUserId || fallback?.otherUserId || '').trim(),
		unreadCount,
		lastMessageText: buildChatSummaryPreview({
			text: value?.lastMessageText ?? fallback?.lastMessageText,
			type: lastMessageType,
		}),
		lastMessageType,
		lastMessageTime,
		lastSenderId: String(value?.lastSenderId || fallback?.lastSenderId || '').trim(),
		updatedAt: String(value?.updatedAt || fallback?.updatedAt || '').trim(),
	}
}

export function buildChatSummaryUpdate(summary = {}) {
	const patch = {
		updatedAt: new Date(normalizeTimestamp(summary?.lastMessageTime) || Date.now()).toISOString(),
	}

	if (Object.prototype.hasOwnProperty.call(summary, 'chatId')) {
		patch.chatId = String(summary?.chatId || '').trim()
	}

	if (Object.prototype.hasOwnProperty.call(summary, 'otherUserId')) {
		patch.otherUserId = String(summary?.otherUserId || '').trim()
	}

	if (Object.prototype.hasOwnProperty.call(summary, 'unreadCount')) {
		patch.unreadCount = Math.max(0, Number(summary?.unreadCount || 0) || 0)
	}

	const hasLastMessageData = ['lastMessageText', 'lastMessageType', 'lastMessageTime', 'lastSenderId'].some((key) => Object.prototype.hasOwnProperty.call(summary, key))

	if (hasLastMessageData) {
		const lastMessageType = String(summary?.lastMessageType || 'text').trim().toLowerCase() || 'text'
		patch.lastMessageType = lastMessageType
		patch.lastMessageText = buildChatSummaryPreview({
			text: summary?.lastMessageText,
			type: lastMessageType,
		})
		patch.lastMessageTime = normalizeTimestamp(summary?.lastMessageTime)
		patch.lastSenderId = String(summary?.lastSenderId || '').trim()
	}

	return patch
}

export async function writeChatSummaryUpdate({ db, schoolPath, ownerUserId, chatId, summary }) {
	if (!db || typeof schoolPath !== 'function') return
	if (!ownerUserId || !chatId) return

	await update(ref(db, schoolPath(buildChatSummaryPath(ownerUserId, chatId))), buildChatSummaryUpdate(summary))
}

export async function clearChatSummaryUnread({ db, schoolPath, ownerUserId, otherUserId, chatId }) {
	return writeChatSummaryUpdate({
		db,
		schoolPath,
		ownerUserId,
		chatId,
		summary: {
			chatId,
			otherUserId,
			unreadCount: 0,
		},
	})
}

export async function loadChatSummariesForContacts({
	db,
	schoolPath,
	ownerUserId,
	contacts,
}) {
	if (!db || typeof schoolPath !== 'function' || !ownerUserId) {
		return []
	}

	const uniqueContacts = []
	const seenContactIds = new Set()

	;(contacts || []).forEach((contact) => {
		const userId = String(contact?.userId || '').trim()
		if (!userId || seenContactIds.has(userId)) {
			return
		}

		seenContactIds.add(userId)
		uniqueContacts.push({ ...(contact || {}), userId })
	})

	if (!uniqueContacts.length) {
		return []
	}

	const ownerSummariesSnapshot = await get(ref(db, schoolPath(buildOwnerChatSummariesPath(ownerUserId)))).catch(() => null)
	const ownerSummaries = ownerSummariesSnapshot?.val()
	const ownerSummaryMap = ownerSummaries && typeof ownerSummaries === 'object' ? ownerSummaries : {}

	const entries = uniqueContacts.map((contact) => {
		const chatId = sortedChatId(ownerUserId, contact.userId)
		const normalizedSummary = normalizeChatSummaryValue(ownerSummaryMap?.[chatId], {
			chatId,
			otherUserId: contact.userId,
		})

		if (!normalizedSummary.unreadCount && !normalizedSummary.lastMessageTime) {
			return null
		}

		return {
			...contact,
			...normalizedSummary,
		}
	})

	return entries.filter(Boolean)
}

export async function loadPresenceByUserIds({
	db,
	schoolPath,
	userIds,
	batchSize = DEFAULT_BATCH_SIZE,
}) {
	if (!db || typeof schoolPath !== 'function') {
		return {}
	}

	const entries = await mapInBatches(dedupeUserIds(userIds), batchSize, async (userId) => {
		const snapshot = await get(ref(db, schoolPath(`Presence/${userId}`))).catch(() => null)
		return [userId, snapshot?.val() ?? null]
	})

	return entries.reduce((accumulator, [userId, value]) => {
		accumulator[userId] = value
		return accumulator
	}, {})
}