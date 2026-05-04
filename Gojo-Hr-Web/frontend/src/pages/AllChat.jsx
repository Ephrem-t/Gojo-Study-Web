import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
	FaArrowLeft,
	FaBell,
	FaCheck,
	FaChevronUp,
	FaCog,
	FaEdit,
	FaFacebookMessenger,
	FaFilter,
	FaImage,
	FaPaperPlane,
	FaSearch,
	FaTimes,
	FaTrash,
	FaUsers,
} from 'react-icons/fa'
import { endAt, get, getDatabase, limitToLast, onValue, orderByChild, push, query, ref, update } from 'firebase/database'
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage'
import { app } from '../firebase'
import {
	getEmployeeContact,
	getEmployeeJob,
	getEmployeeMeta,
	getEmployeeName,
	getEmployeeProfileImage,
	getEmployeesSnapshot,
} from '../hrData'
import { createProfilePlaceholder, isFallbackProfileImage, resolveProfileImage } from '../utils/profileImage'
import '../styles/global.css'

const DEFAULT_PROFILE_IMAGE = '/default-profile.png'
const DEFAULT_SCHOOL_CODE = 'ET-ORO-ADA-GMI'
const MESSAGE_PAGE_SIZE = 25
const MAX_CHAT_IMAGE_BYTES = 280 * 1024

const sortedChatId = (id1, id2) => [String(id1 || '').trim(), String(id2 || '').trim()].sort().join('_')

function getInitials(name) {
	return (name || 'HR Office')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join('') || 'HR'
}

function createPlaceholderAvatar(name) {
	return createProfilePlaceholder(name || 'HR Office')
}

function sanitizeProfileImage(value) {
	return resolveProfileImage(value)
}

function resolveAvatarSrc(rawValue, name) {
	const sanitized = sanitizeProfileImage(rawValue)
	if (!sanitized || isFallbackProfileImage(sanitized)) {
		return createPlaceholderAvatar(name)
	}
	return sanitized
}

function AvatarBadge({ src, name, size = 40, fontSize = 14, radius = '50%' }) {
	const [failed, setFailed] = useState(false)
	const fallbackSrc = useMemo(() => createPlaceholderAvatar(name), [name])
	const resolvedSrc = useMemo(() => {
		const normalizedSrc = failed ? DEFAULT_PROFILE_IMAGE : sanitizeProfileImage(src)
		if (isFallbackProfileImage(normalizedSrc)) {
			return fallbackSrc
		}
		return normalizedSrc
	}, [failed, fallbackSrc, src])

	useEffect(() => {
		setFailed(false)
	}, [src])

	return (
		<img
			src={resolvedSrc}
			alt={name || 'HR Office'}
			onError={(event) => {
				if (event.currentTarget.src !== fallbackSrc) {
					event.currentTarget.src = fallbackSrc
				}
				setFailed(true)
			}}
			style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', border: '1px solid #d9e5f5', flexShrink: 0 }}
		/>
	)
}

const loadImageFromFile = (file) =>
	new Promise((resolve, reject) => {
		const objectUrl = URL.createObjectURL(file)
		const image = new Image()

		image.onload = () => {
			URL.revokeObjectURL(objectUrl)
			resolve(image)
		}

		image.onerror = () => {
			URL.revokeObjectURL(objectUrl)
			reject(new Error('Failed to load image file'))
		}

		image.src = objectUrl
	})

function canvasToJpegBlob(canvas, quality) {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(output) => {
				if (!output) {
					reject(new Error('Image compression failed'))
					return
				}
				resolve(output)
			},
			'image/jpeg',
			quality
		)
	})
}

async function compressImageToJpeg(file, {
	maxWidth = 1080,
	maxHeight = 1080,
	maxBytes = MAX_CHAT_IMAGE_BYTES,
	initialQuality = 0.7,
	minimumQuality = 0.42,
	qualityStep = 0.08,
	dimensionStep = 0.86,
} = {}) {
	const image = await loadImageFromFile(file)

	let width = image.naturalWidth || image.width
	let height = image.naturalHeight || image.height
	const ratio = Math.min(maxWidth / width, maxHeight / height, 1)

	width = Math.max(1, Math.round(width * ratio))
	height = Math.max(1, Math.round(height * ratio))

	const canvas = document.createElement('canvas')
	canvas.width = width
	canvas.height = height

	const context = canvas.getContext('2d')
	if (!context) {
		throw new Error('Canvas context unavailable')
	}

	let bestBlob = null
	let currentWidth = width
	let currentHeight = height

	for (let dimensionAttempt = 0; dimensionAttempt < 4; dimensionAttempt += 1) {
		canvas.width = currentWidth
		canvas.height = currentHeight
		context.clearRect(0, 0, currentWidth, currentHeight)
		context.drawImage(image, 0, 0, currentWidth, currentHeight)

		for (let quality = initialQuality; quality >= minimumQuality; quality -= qualityStep) {
			const blob = await canvasToJpegBlob(canvas, Number(quality.toFixed(2)))
			bestBlob = blob
			if (blob.size <= maxBytes) {
				return blob
			}
		}

		currentWidth = Math.max(480, Math.round(currentWidth * dimensionStep))
		currentHeight = Math.max(480, Math.round(currentHeight * dimensionStep))
	}

	if (!bestBlob) {
		throw new Error('Image compression failed')
	}

	return bestBlob
}

function normalizeRoleLabel(value) {
	const normalized = String(value || '').trim().toLowerCase()
	if (!normalized) return 'Staff'
	if (normalized === 'hr') return 'HR'
	if (normalized === 'finance') return 'Finance'
	if (normalized === 'teacher') return 'Teacher'
	if (normalized === 'management') return 'Management'
	return value
}

function formatTime(ts) {
	const date = new Date(Number(ts) || Date.now())
	let hours = date.getHours()
	const minutes = date.getMinutes().toString().padStart(2, '0')
	const period = hours >= 12 ? 'PM' : 'AM'
	hours %= 12
	if (hours === 0) hours = 12
	return `${hours}:${minutes} ${period}`
}

function formatDateLabel(ts) {
	if (!ts) return ''

	const msgDate = new Date(Number(ts))
	const now = new Date()
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	const startOfMsgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate())
	const diffMs = startOfToday - startOfMsgDay
	const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))

	if (diffDays === 0) return 'Today'
	if (diffDays === 1) return 'Yesterday'
	if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`
	return msgDate.toLocaleDateString()
}

function isEmployeeActive(employee = {}) {
	const status = String(employee?.status || employee?.employment?.status || employee?.job?.status || '').trim().toLowerCase()
	return !employee?.terminated && employee?.isActive !== false && !status.includes('terminated') && !status.includes('inactive') && !status.includes('deactivated')
}

function normalizeChatMessages(payload, currentUserId) {
	return Object.entries(payload || {})
		.map(([id, value]) => ({
			id,
			...(value || {}),
			isMine: String(value?.senderId || '') === String(currentUserId || ''),
		}))
		.sort((left, right) => Number(left.timeStamp || 0) - Number(right.timeStamp || 0))
}

function mergeMessages(existingMessages, incomingMessages) {
	const merged = new Map()
	;[...(existingMessages || []), ...(incomingMessages || [])].forEach((message) => {
		if (!message?.id) return
		merged.set(message.id, message)
	})
	return Array.from(merged.values()).sort((left, right) => Number(left.timeStamp || 0) - Number(right.timeStamp || 0))
}

export default function AllChat() {
	const location = useLocation()
	const navigate = useNavigate()
	const chatEndRef = useRef(null)
	const imageInputRef = useRef(null)
	const db = useMemo(() => getDatabase(app), [])
	const storage = useMemo(() => getStorage(app), [])
	const [admin] = useState(() => JSON.parse(localStorage.getItem('admin') || '{}'))
	const adminUserId = String(admin?.userId || admin?.id || '').trim()
	const schoolCode = String(admin?.activeSchoolCode || admin?.schoolCode || DEFAULT_SCHOOL_CODE).trim() || DEFAULT_SCHOOL_CODE
	const locationState = location.state || {}
	const incomingContact = locationState.contact || locationState.user || null
	const incomingContactUserId = String(incomingContact?.userId || '').trim()
	const incomingChatId = String(locationState.chatId || '').trim()

	const [employees, setEmployees] = useState([])
	const [loadingContacts, setLoadingContacts] = useState(true)
	const [contactError, setContactError] = useState('')
	const [searchText, setSearchText] = useState('')
	const [selectedRoleFilter, setSelectedRoleFilter] = useState('all')
	const [selectedChatUser, setSelectedChatUser] = useState(() => incomingContact || null)
	const [recentMessages, setRecentMessages] = useState([])
	const [olderMessages, setOlderMessages] = useState([])
	const [input, setInput] = useState('')
	const [presence, setPresence] = useState({})
	const [unreadCounts, setUnreadCounts] = useState({})
	const [imageSending, setImageSending] = useState(false)
	const [previewImageUrl, setPreviewImageUrl] = useState('')
	const [editingMessageId, setEditingMessageId] = useState('')
	const [activeMenuMessageId, setActiveMenuMessageId] = useState('')
	const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
	const [hasOlderMessages, setHasOlderMessages] = useState(false)

	const schoolPath = (path) => `Platform1/Schools/${schoolCode}/${String(path || '').replace(/^\/+/, '')}`

	useEffect(() => {
		if (adminUserId) return
		navigate('/login', { replace: true })
	}, [adminUserId, navigate])

	useEffect(() => {
		if (!incomingContactUserId) return
		setSelectedChatUser((current) => {
			if (current?.userId === incomingContactUserId) {
				return current
			}

			return incomingContact
		})
	}, [incomingContact, incomingContactUserId])

	useEffect(() => {
		let cancelled = false

		async function loadEmployees() {
			setLoadingContacts(true)
			setContactError('')

			try {
				const snapshot = await getEmployeesSnapshot(0)
				if (cancelled) return

				const normalized = snapshot
					.map((employee) => {
						const job = getEmployeeJob(employee)
						const contact = getEmployeeContact(employee)
						const meta = getEmployeeMeta(employee)
						const role = normalizeRoleLabel(job.employeeCategory || job.category || job.position || employee.role || employee.position || 'Staff')
						const userId = String(employee.userId || meta.userId || '').trim()
						const name = getEmployeeName(employee)
						const profileImage = resolveAvatarSrc(getEmployeeProfileImage(employee), name)
						const status = String(job.status || employee.status || '').trim() || 'Active'

						return {
							...employee,
							id: employee.id || employee.employeeId,
							employeeId: employee.employeeId || employee.id || '',
							userId,
							name,
							role,
							department: job.department || employee.department || 'Unassigned',
							status,
							email: contact.email || contact.altEmail || employee.email || '',
							phone: contact.phone1 || contact.phone || contact.phone2 || employee.phone || '',
							profileImage,
						}
					})
					.filter((employee) => employee.userId)
					.filter((employee) => employee.userId !== adminUserId)
					.filter((employee) => isEmployeeActive(employee))
					.sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))

				setEmployees(normalized)
			} catch (error) {
				console.error(error)
				if (!cancelled) {
					setContactError('Employee contacts could not be loaded.')
				}
			} finally {
				if (!cancelled) {
					setLoadingContacts(false)
				}
			}
		}

		loadEmployees()
		return () => {
			cancelled = true
		}
	}, [adminUserId])

	const roleFilters = useMemo(() => {
		const values = ['all', ...new Set(employees.map((employee) => String(employee.role || '').trim()).filter(Boolean))]
		return values
	}, [employees])

	const filteredEmployees = useMemo(() => {
		const query = String(searchText || '').trim().toLowerCase()

		return employees.filter((employee) => {
			if (selectedRoleFilter !== 'all' && String(employee.role || '').toLowerCase() !== String(selectedRoleFilter || '').toLowerCase()) {
				return false
			}

			if (!query) return true

			return [employee.name, employee.department, employee.role, employee.employeeId, employee.email]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(query))
		})
	}, [employees, searchText, selectedRoleFilter])

	const orderedFilteredEmployees = useMemo(() => {
		if (!selectedChatUser?.userId) return filteredEmployees

		return [...filteredEmployees].sort((left, right) => {
			if (left.userId === selectedChatUser.userId) return -1
			if (right.userId === selectedChatUser.userId) return 1
			return 0
		})
	}, [filteredEmployees, selectedChatUser])

	useEffect(() => {
		if (!employees.length) return

		const matchedEmployee = employees.find((employee) => {
			if (incomingContactUserId && employee.userId === incomingContactUserId) {
				return true
			}

			if (incomingChatId && adminUserId && sortedChatId(adminUserId, employee.userId) === incomingChatId) {
				return true
			}

			return false
		})

		if (!matchedEmployee) return

		setSelectedChatUser((current) => {
			if (
				current?.userId === matchedEmployee.userId
				&& current?.name === matchedEmployee.name
				&& current?.role === matchedEmployee.role
				&& current?.department === matchedEmployee.department
				&& current?.profileImage === matchedEmployee.profileImage
			) {
				return current
			}

			return matchedEmployee
		})
	}, [adminUserId, employees, incomingChatId, incomingContactUserId])

	const currentChatKey = useMemo(() => {
		if (!adminUserId || !selectedChatUser?.userId) return null
		return sortedChatId(adminUserId, selectedChatUser.userId)
	}, [adminUserId, selectedChatUser])

	const messages = useMemo(() => mergeMessages(olderMessages, recentMessages), [olderMessages, recentMessages])

	const displayItems = useMemo(() => {
		const items = []
		let lastLabel = null

		messages.forEach((message) => {
			const label = formatDateLabel(message.timeStamp)
			if (label && label !== lastLabel) {
				items.push({ type: 'date', id: `date-${label}-${message.timeStamp}`, label })
				lastLabel = label
			}
			items.push({ type: 'message', ...message })
		})

		return items
	}, [messages])

	useEffect(() => {
		if (!selectedChatUser || !adminUserId || !currentChatKey) {
			setRecentMessages([])
			setOlderMessages([])
			setHasOlderMessages(false)
			return undefined
		}

		setOlderMessages([])
		setHasOlderMessages(false)

		const chatRef = ref(db, schoolPath(`Chats/${currentChatKey}/messages`))
		const recentMessagesQuery = query(chatRef, orderByChild('timeStamp'), limitToLast(MESSAGE_PAGE_SIZE))
		const unsubscribe = onValue(recentMessagesQuery, (snapshot) => {
			const payload = snapshot.val() || {}
			const list = normalizeChatMessages(payload, adminUserId)

			setRecentMessages(list)
			setHasOlderMessages(list.length >= MESSAGE_PAGE_SIZE)

			Object.entries(payload).forEach(([id, value]) => {
				if (String(value?.receiverId || '') === adminUserId && !value?.seen) {
					update(ref(db, schoolPath(`Chats/${currentChatKey}/messages/${id}`)), { seen: true }).catch(console.error)
				}
			})

			update(ref(db, schoolPath(`Chats/${currentChatKey}/unread`)), { [adminUserId]: 0 }).catch(console.error)
		})

		return () => unsubscribe()
	}, [adminUserId, currentChatKey, db, selectedChatUser])

	useEffect(() => {
		if (!adminUserId || !employees.length) return undefined

		const unsubscribers = employees.map((employee) => {
			const chatKey = sortedChatId(adminUserId, employee.userId)
			return onValue(ref(db, schoolPath(`Chats/${chatKey}/unread/${adminUserId}`)), (snapshot) => {
				const count = Number(snapshot.val() || 0)
				setUnreadCounts((previous) => ({ ...previous, [employee.userId]: count }))
			})
		})

		return () => {
			unsubscribers.forEach((unsubscribe) => unsubscribe())
		}
	}, [adminUserId, db, employees])

	useEffect(() => {
		const presenceRef = ref(db, schoolPath('Presence'))
		const unsubscribe = onValue(presenceRef, (snapshot) => {
			setPresence(snapshot.val() || {})
		})

		return () => unsubscribe()
	}, [db])

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [recentMessages])

	useEffect(() => {
		if (!selectedChatUser?.userId) return
		if (employees.some((employee) => employee.userId === selectedChatUser.userId)) return
		setSelectedChatUser(null)
	}, [employees, selectedChatUser])

	const isUserOnline = (userId) => {
		const record = presence?.[userId]
		if (record == null) return false
		if (typeof record === 'boolean') return record
		if (typeof record === 'number') return Date.now() - Number(record) < 2 * 60 * 1000
		if (typeof record === 'object') {
			if (typeof record.online === 'boolean') return record.online
			const lastSeen = record.lastSeen || record.timestamp || record.updatedAt
			if (lastSeen) return Date.now() - Number(lastSeen) < 2 * 60 * 1000
		}
		return false
	}

	const getLastSeenText = (userId) => {
		const record = presence?.[userId]
		if (!record || isUserOnline(userId)) return 'Online now'

		let timestamp = null
		if (typeof record === 'number') timestamp = record
		if (typeof record === 'object') timestamp = record.lastSeen || record.timestamp || record.updatedAt || null
		if (!timestamp) return 'Offline'

		const diff = Date.now() - Number(timestamp)
		const minutes = Math.floor(diff / 60000)
		if (minutes < 1) return 'Seen just now'
		if (minutes < 60) return `Seen ${minutes}m ago`
		const hours = Math.floor(minutes / 60)
		if (hours < 24) return `Seen ${hours}h ago`
		const days = Math.floor(hours / 24)
		if (days < 7) return `Seen ${days}d ago`
		return `Seen ${new Date(Number(timestamp)).toLocaleDateString()}`
	}

	const resetComposer = () => {
		setInput('')
		setEditingMessageId('')
		setActiveMenuMessageId('')
	}

	const loadOlderMessages = async () => {
		if (!currentChatKey || loadingOlderMessages || !hasOlderMessages) return

		const loadedMessages = mergeMessages(olderMessages, recentMessages)
		const oldestTimestamp = Number(loadedMessages[0]?.timeStamp || 0)
		if (!oldestTimestamp) {
			setHasOlderMessages(false)
			return
		}

		setLoadingOlderMessages(true)
		try {
			const olderMessagesQuery = query(
				ref(db, schoolPath(`Chats/${currentChatKey}/messages`)),
				orderByChild('timeStamp'),
				endAt(oldestTimestamp - 1),
				limitToLast(MESSAGE_PAGE_SIZE)
			)
			const snapshot = await get(olderMessagesQuery)
			const payload = snapshot.val() || {}
			const list = normalizeChatMessages(payload, adminUserId)

			if (!list.length) {
				setHasOlderMessages(false)
				return
			}

			setOlderMessages((previous) => mergeMessages(previous, list))
			if (list.length < MESSAGE_PAGE_SIZE) {
				setHasOlderMessages(false)
			}
		} catch (error) {
			console.error('Failed to load older messages:', error)
		} finally {
			setLoadingOlderMessages(false)
		}
	}

	const sendMessage = async () => {
		if (!selectedChatUser || !adminUserId || !currentChatKey) return
		const text = String(input || '').trim()
		if (!text) return

		if (editingMessageId) {
			await update(ref(db, schoolPath(`Chats/${currentChatKey}/messages/${editingMessageId}`)), {
				text,
				edited: true,
			})
			resetComposer()
			return
		}

		const timeStamp = Date.now()
		const messageData = {
			senderId: adminUserId,
			receiverId: selectedChatUser.userId,
			type: 'text',
			text,
			seen: false,
			edited: false,
			deleted: false,
			timeStamp,
		}

		await push(ref(db, schoolPath(`Chats/${currentChatKey}/messages`)), messageData)
		await update(ref(db, schoolPath(`Chats/${currentChatKey}/participants`)), {
			[adminUserId]: true,
			[selectedChatUser.userId]: true,
		})
		await update(ref(db, schoolPath(`Chats/${currentChatKey}/lastMessage`)), {
			text,
			senderId: adminUserId,
			seen: false,
			timeStamp,
			type: 'text',
		})
		const receiverUnreadRef = ref(db, schoolPath(`Chats/${currentChatKey}/unread/${selectedChatUser.userId}`))
		const receiverUnreadSnapshot = await get(receiverUnreadRef).catch(() => null)
		const nextReceiverUnread = Number(receiverUnreadSnapshot?.val() || 0) + 1
		await update(ref(db, schoolPath(`Chats/${currentChatKey}/unread`)), {
			[selectedChatUser.userId]: nextReceiverUnread,
		}).catch(() => {})

		setInput('')
	}

	const sendImageMessage = async (event) => {
		const file = event?.target?.files?.[0]
		if (!file || !selectedChatUser || !adminUserId || !currentChatKey) {
			if (event?.target) event.target.value = ''
			return
		}

		try {
			setImageSending(true)
			const compressedBlob = await compressImageToJpeg(file, { maxBytes: MAX_CHAT_IMAGE_BYTES })
			const messagesRef = ref(db, schoolPath(`Chats/${currentChatKey}/messages`))
			const messageRef = push(messagesRef)
			const messageId = messageRef.key
			const timeStamp = Date.now()
			const uploadRef = storageRef(storage, `chatImages/${schoolCode}/${currentChatKey}/${messageId}.jpg`)

			await uploadBytes(uploadRef, compressedBlob, { contentType: 'image/jpeg' })
			const imageUrl = await getDownloadURL(uploadRef)

			await update(messageRef, {
				messageId,
				senderId: adminUserId,
				receiverId: selectedChatUser.userId,
				type: 'image',
				text: '',
				imageUrl,
				seen: false,
				edited: false,
				deleted: false,
				timeStamp,
			})

			await update(ref(db, schoolPath(`Chats/${currentChatKey}/participants`)), {
				[adminUserId]: true,
				[selectedChatUser.userId]: true,
			})
			await update(ref(db, schoolPath(`Chats/${currentChatKey}/lastMessage`)), {
				senderId: adminUserId,
				seen: false,
				text: 'Image',
				timeStamp,
				type: 'image',
			})
			const receiverUnreadRef = ref(db, schoolPath(`Chats/${currentChatKey}/unread/${selectedChatUser.userId}`))
			const receiverUnreadSnapshot = await get(receiverUnreadRef).catch(() => null)
			const nextReceiverUnread = Number(receiverUnreadSnapshot?.val() || 0) + 1
			await update(ref(db, schoolPath(`Chats/${currentChatKey}/unread`)), {
				[selectedChatUser.userId]: nextReceiverUnread,
			}).catch(() => {})
		} catch (error) {
			console.error('Image send failed:', error)
			window.alert('Image send failed. Please try again.')
		} finally {
			setImageSending(false)
			if (event?.target) event.target.value = ''
		}
	}

	const beginEditing = (message) => {
		setEditingMessageId(message.id)
		setInput(String(message.text || ''))
		setActiveMenuMessageId('')
	}

	const deleteMessage = async (messageId) => {
		if (!currentChatKey || !messageId) return
		await update(ref(db, schoolPath(`Chats/${currentChatKey}/messages/${messageId}`)), { deleted: true })
		setActiveMenuMessageId('')
		if (editingMessageId === messageId) {
			resetComposer()
		}
	}

	const headerActionStyle = {
		position: 'relative',
		display: 'inline-flex',
		alignItems: 'center',
		gap: 8,
		height: 38,
		padding: '0 14px',
		borderRadius: 999,
		border: '1px solid var(--border-soft, #dbe2f2)',
		background: 'var(--surface-panel, #fff)',
		color: 'var(--text-secondary, #334155)',
		fontSize: 13,
		fontWeight: 700,
		cursor: 'pointer',
		textDecoration: 'none',
	}

	return (
		<div
			style={{
				minHeight: '100vh',
				background: '#ffffff',
				color: 'var(--text-primary)',
				'--surface-panel': '#FFFFFF',
				'--surface-accent': '#F1F8FF',
				'--surface-muted': '#F7FBFF',
				'--surface-strong': '#DCEBFF',
				'--page-bg': '#FFFFFF',
				'--border-soft': '#D7E7FB',
				'--border-strong': '#B5D2F8',
				'--text-primary': '#0f172a',
				'--text-secondary': '#334155',
				'--text-muted': '#64748b',
				'--accent': '#007AFB',
				'--accent-soft': '#E7F2FF',
				'--accent-strong': '#007AFB',
				'--shadow-soft': '0 10px 24px rgba(0, 122, 251, 0.10)',
				'--shadow-panel': '0 14px 30px rgba(0, 122, 251, 0.14)',
				'--shadow-glow': '0 0 0 2px rgba(0, 122, 251, 0.18)',
				'--sidebar-width': 'clamp(230px, 16vw, 290px)',
				'--topbar-height': '64px',
			}}
		>
			<nav className="top-navbar" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--topbar-height)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '0 18px 0 20px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-panel)', zIndex: 60 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
					<h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Gojo HR</h2>
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<button type="button" title="Notifications" style={headerActionStyle}><FaBell /></button>
					<Link to="/all-chat" aria-label="Messages" style={{ ...headerActionStyle, color: '#007AFB', borderColor: '#bfdbfe', background: '#eff6ff' }}><FaFacebookMessenger /></Link>
					<Link to="/settings" aria-label="Settings" style={headerActionStyle}><FaCog /></Link>
					<AvatarBadge src={admin.profileImage} name={admin.name || 'HR Office'} size={40} fontSize={14} />
				</div>
			</nav>

			<div className="google-dashboard" style={{ display: 'flex', gap: 14, padding: 'calc(var(--topbar-height) + 18px) 14px 18px', minHeight: '100vh', background: '#ffffff', width: '100%', boxSizing: 'border-box', alignItems: 'flex-start' }}>
				<div className="admin-sidebar-spacer" style={{ width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)', flex: '0 0 var(--sidebar-width)', pointerEvents: 'none' }} />

				<main style={{ flex: '1 1 0', minWidth: 0, margin: 0, padding: '0 12px 0 2px', display: 'flex', justifyContent: 'center' }}>
					<div style={{ width: '100%', maxWidth: 1260, display: 'flex', flexDirection: 'column', gap: 16 }}>
						<section style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)', border: '1px solid #e7ecf3', borderRadius: 22, padding: '22px 24px', boxShadow: '0 20px 46px rgba(15, 23, 42, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
							<div style={{ maxWidth: 760 }}>
								<span style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', minHeight: 30, padding: '0 12px', borderRadius: 999, border: '1px solid #d8e8ff', background: '#eef6ff', color: '#0f4fa8', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Employee Messaging</span>
								<h3 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.03em' }}>HR Internal Chat</h3>
								<p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)' }}>This page is restricted to employee conversations only. Parents and students are not loaded here, and HR can message active teachers, finance staff, management, and other HR employees.</p>
							</div>

							<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 12, minWidth: 'min(100%, 420px)' }}>
								<div style={{ background: '#ffffff', border: '1px solid #e7ecf3', borderRadius: 18, padding: 16, boxShadow: '0 18px 44px rgba(15, 23, 42, 0.05)' }}>
									<span style={{ display: 'block', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{employees.length}</span>
									<span style={{ display: 'block', marginTop: 5, fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Employees</span>
								</div>
								<div style={{ background: '#ffffff', border: '1px solid #e7ecf3', borderRadius: 18, padding: 16, boxShadow: '0 18px 44px rgba(15, 23, 42, 0.05)' }}>
									<span style={{ display: 'block', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{filteredEmployees.length}</span>
									<span style={{ display: 'block', marginTop: 5, fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visible Contacts</span>
								</div>
								<div style={{ background: '#ffffff', border: '1px solid #e7ecf3', borderRadius: 18, padding: 16, boxShadow: '0 18px 44px rgba(15, 23, 42, 0.05)' }}>
									<span style={{ display: 'block', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{selectedChatUser ? selectedChatUser.role : 'None'}</span>
									<span style={{ display: 'block', marginTop: 5, fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Role</span>
								</div>
							</div>
						</section>

						<section style={{ display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)', gap: 16, alignItems: 'stretch' }}>
							<div style={{ background: '#ffffff', border: '1px solid #e7ecf3', borderRadius: 22, boxShadow: '0 20px 46px rgba(15, 23, 42, 0.05)', display: 'flex', flexDirection: 'column', minHeight: 620 }}>
								<div style={{ padding: '18px 18px 14px', borderBottom: '1px solid #edf2f7' }}>
									<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
										<div>
											<div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Employees</div>
											<div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>HR conversations are limited to staff only</div>
										</div>
										<div style={{ width: 38, height: 38, borderRadius: 14, border: '1px solid #dbeafe', background: '#eff6ff', color: '#007AFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
											<FaUsers />
										</div>
									</div>

									<div style={{ position: 'relative', marginBottom: 12 }}>
										<FaSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 13 }} />
										<input
											value={searchText}
											onChange={(event) => setSearchText(event.target.value)}
											placeholder="Search employees..."
											style={{ width: '100%', height: 44, borderRadius: 14, border: '1px solid #dbe4ef', background: '#fbfdff', color: '#0f172a', padding: '0 14px 0 38px', fontSize: 13, outline: 'none' }}
										/>
									</div>

									<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
										{roleFilters.map((role) => {
											const active = selectedRoleFilter === role
											return (
												<button
													key={role}
													type="button"
													onClick={() => setSelectedRoleFilter(role)}
													style={{
														border: active ? '1px solid #bfdbfe' : '1px solid #e7ecf3',
														background: active ? '#eff6ff' : '#ffffff',
														color: active ? '#007AFB' : '#475569',
														borderRadius: 999,
														minHeight: 34,
														padding: '0 12px',
														fontSize: 12,
														fontWeight: 800,
														cursor: 'pointer',
														display: 'inline-flex',
														alignItems: 'center',
														gap: 6,
													}}
												>
													{role === 'all' ? <FaFilter size={11} /> : null}
													{role === 'all' ? 'All roles' : role}
												</button>
											)
										})}
									</div>

									{contactError ? (
										<div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 14, border: '1px solid #fed7aa', background: '#fff7ed', color: '#b45309', fontSize: 13, fontWeight: 700 }}>
											{contactError}
										</div>
									) : null}
								</div>

								<div style={{ padding: 14, overflowY: 'auto', flex: 1 }}>
									{loadingContacts ? <div style={{ padding: '12px 8px', color: '#64748b', fontSize: 13 }}>Loading employee contacts...</div> : null}
									{!loadingContacts && !filteredEmployees.length ? <div style={{ padding: '12px 8px', color: '#64748b', fontSize: 13 }}>No employee contacts matched the current filter.</div> : null}

									{orderedFilteredEmployees.map((employee) => {
										const isActive = selectedChatUser?.userId === employee.userId
										const unread = unreadCounts[employee.userId] || 0
										const online = isUserOnline(employee.userId)

										return (
											<button
												key={employee.userId}
												type="button"
												onClick={() => {
													setSelectedChatUser(employee)
													setActiveMenuMessageId('')
													setEditingMessageId('')
													setInput('')
												}}
												style={{
													width: '100%',
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'space-between',
													gap: 10,
													padding: 12,
													borderRadius: 16,
													cursor: 'pointer',
													marginBottom: 10,
													background: '#ffffff',
													border: isActive ? '1px solid #93c5fd' : '1px solid #e5e7eb',
													boxShadow: isActive ? 'inset 3px 0 0 #007AFB, 0 8px 18px rgba(0,122,251,0.12)' : '0 2px 8px rgba(15,23,42,0.05)',
													textAlign: 'left',
												}}
											>
												<div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
													<div style={{ position: 'relative', flexShrink: 0 }}>
														<img
															src={employee.profileImage}
															alt={employee.name}
															onError={(event) => {
																const fallback = createPlaceholderAvatar(employee.name)
																if (event.currentTarget.src === fallback) return
																event.currentTarget.src = fallback
															}}
															style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #ffffff', boxShadow: '0 4px 10px rgba(15,23,42,0.12)' }}
														/>
														<span style={{ position: 'absolute', right: -2, bottom: -2, width: 12, height: 12, borderRadius: 12, border: '2px solid #fff', background: online ? '#22c55e' : '#cbd5e1' }} />
													</div>

													<div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
														<span style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{employee.name}</span>
														<span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{employee.role} · {employee.department}</span>
														<span style={{ fontSize: 11, color: online ? '#16a34a' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{online ? 'Online now' : getLastSeenText(employee.userId)}</span>
													</div>
												</div>

												{unread > 0 ? <div style={{ minWidth: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', color: '#fff', borderRadius: 14, padding: '0 6px', fontSize: 11, fontWeight: 800, boxShadow: '0 4px 10px rgba(239,68,68,0.25)' }}>{unread > 99 ? '99+' : unread}</div> : <div style={{ width: 26 }} />}
											</button>
										)
									})}
								</div>
							</div>

							<div style={{ background: '#ffffff', border: '1px solid #e7ecf3', borderRadius: 22, boxShadow: '0 20px 46px rgba(15, 23, 42, 0.05)', display: 'flex', flexDirection: 'column', minHeight: 620 }}>
								{selectedChatUser ? (
									<>
										<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 18px 14px', borderBottom: '1px solid #eef2f7' }}>
											<div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
												{/* <button
													type="button"
													onClick={() => navigate(-1)}
													style={{ border: '1px solid #dbeafe', background: '#ffffff', padding: 8, cursor: 'pointer', borderRadius: 999, color: '#007AFB', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)' }}
													aria-label="Go back"
												>
													<FaArrowLeft size={16} />
												</button> */}

												<img
													src={selectedChatUser.profileImage}
													alt={selectedChatUser.name}
													onError={(event) => {
														const fallback = createPlaceholderAvatar(selectedChatUser.name)
														if (event.currentTarget.src === fallback) return
														event.currentTarget.src = fallback
													}}
													style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '2px solid #ffffff', boxShadow: '0 6px 12px rgba(15,23,42,0.12)' }}
												/>

												<div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
													<span style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedChatUser.name}</span>
													<span style={{ fontSize: 12, color: isUserOnline(selectedChatUser.userId) ? '#16A34A' : '#64748b' }}>{isUserOnline(selectedChatUser.userId) ? 'Online' : getLastSeenText(selectedChatUser.userId)}</span>
												</div>
											</div>

											<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
												<span style={{ fontSize: 11, fontWeight: 700, color: '#007AFB', background: '#FFFFFF', border: '1px solid #007AFB', padding: '5px 10px', borderRadius: 999 }}>{selectedChatUser.role}</span>
												<span style={{ fontSize: 11, fontWeight: 700, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 10px', borderRadius: 999 }}>{selectedChatUser.department}</span>
												<span style={{ fontSize: 11, fontWeight: 700, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 10px', borderRadius: 999 }}>{messages.length} loaded</span>
											</div>
										</div>

										<div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
											{hasOlderMessages ? (
												<div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 16px' }}>
													<button
														type="button"
														onClick={() => loadOlderMessages().catch(console.error)}
														disabled={loadingOlderMessages}
														style={{
															minHeight: 36,
															padding: '0 14px',
															borderRadius: 999,
															border: '1px solid #dbeafe',
															background: '#eff6ff',
															color: '#007AFB',
															fontWeight: 800,
															fontSize: 12,
															cursor: loadingOlderMessages ? 'wait' : 'pointer',
															display: 'inline-flex',
															alignItems: 'center',
															gap: 8,
														}}
													>
														<FaChevronUp size={11} />
														{loadingOlderMessages ? 'Loading older messages...' : `Load ${MESSAGE_PAGE_SIZE} older messages`}
													</button>
												</div>
											) : null}

											{displayItems.map((item, index) => {
												if (item.type === 'date') {
													return (
														<div key={item.id} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 16px' }}>
															<span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 999, padding: '6px 12px' }}>{item.label}</span>
														</div>
													)
												}

												const message = item
												const isMine = message.isMine
												const previous = index > 0 ? displayItems[index - 1] : null
												const prevSameSender = previous && previous.type === 'message' && previous.senderId === message.senderId
												const isImageMessage = String(message.type || '').toLowerCase() === 'image' && !!message.imageUrl
												const isDeleted = !!message.deleted
												const showMenu = activeMenuMessageId === message.id && isMine && !isDeleted

												return (
													<div key={message.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
														<div
															onClick={() => {
																if (!isMine || isDeleted) return
																setActiveMenuMessageId((current) => current === message.id ? '' : message.id)
															}}
															style={{
																maxWidth: '76%',
																background: isMine ? '#007AFB' : '#f6f7fb',
																color: isMine ? '#fff' : '#111827',
																padding: isImageMessage ? 6 : '10px 13px',
																borderRadius: 14,
																borderTopRightRadius: isMine ? 6 : 14,
																borderTopLeftRadius: isMine ? 14 : 6,
																boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
																border: isMine ? 'none' : '1px solid #e5e7eb',
																wordBreak: 'break-word',
																cursor: isMine ? 'pointer' : 'default',
																position: 'relative',
																overflow: 'visible',
															}}
														>
															{!isMine && !prevSameSender ? <div style={{ position: 'absolute', left: -6, bottom: -2, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '8px solid #f6f7fb', transform: 'rotate(180deg)' }} /> : null}
															{isMine && !prevSameSender ? <div style={{ position: 'absolute', right: -6, bottom: -2, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '8px solid #007AFB' }} /> : null}

															{isDeleted ? (
																<>
																	<span style={{ fontStyle: 'italic', color: isMine ? 'rgba(255,255,255,0.92)' : '#64748b' }}>This message is deleted</span>
																	<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 6, fontSize: 10, color: isMine ? 'rgba(255,255,255,0.85)' : '#64748b' }}>
																		<span>{formatTime(message.timeStamp)}</span>
																	</div>
																</>
															) : isImageMessage ? (
																<div style={{ width: 240, position: 'relative' }}>
																	<img
																		src={message.imageUrl}
																		alt="Chat"
																		onClick={(event) => {
																			event.stopPropagation()
																			setPreviewImageUrl(message.imageUrl)
																		}}
																		style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, display: 'block', background: isMine ? '#0b61c3' : '#e2e8f0', cursor: 'zoom-in' }}
																	/>
																	<div style={{ position: 'absolute', right: 8, bottom: 8, display: 'flex', alignItems: 'center', gap: 6, background: isMine ? 'rgba(2,6,23,0.24)' : 'rgba(255,255,255,0.82)', borderRadius: 999, padding: '2px 8px', fontSize: 10, color: isMine ? '#f8fafc' : '#475569' }}>
																		<span>{formatTime(message.timeStamp)}</span>
																		{isMine ? <span style={{ display: 'flex', alignItems: 'center' }}><FaCheck size={10} color="#fff" style={{ opacity: 0.82 }} />{message.seen ? <FaCheck size={10} color="#fff" style={{ marginLeft: 2, opacity: 0.98 }} /> : null}</span> : null}
																	</div>
																</div>
															) : (
																<>
																	{message.text}
																	<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 6, fontSize: 10, color: isMine ? 'rgba(255,255,255,0.85)' : '#64748b' }}>
																		{message.edited ? <span style={{ fontStyle: 'italic', opacity: 0.95 }}>edited</span> : null}
																		<span>{formatTime(message.timeStamp)}</span>
																		{isMine ? <span style={{ display: 'flex', alignItems: 'center' }}><FaCheck size={10} color="#fff" style={{ opacity: 0.82 }} />{message.seen ? <FaCheck size={10} color="#fff" style={{ marginLeft: 2, opacity: 0.98 }} /> : null}</span> : null}
																	</div>
																</>
															)}

															{showMenu ? (
																<div style={{ position: 'absolute', top: '100%', right: isMine ? 0 : 'auto', left: isMine ? 'auto' : 0, marginTop: 8, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 18px 40px rgba(2,6,23,0.18)', minWidth: 150, overflow: 'hidden', zIndex: 5 }}>
																	{!isImageMessage ? (
																		<button type="button" onClick={(event) => { event.stopPropagation(); beginEditing(message) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: '#ffffff', padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
																			<FaEdit size={12} /> Edit message
																		</button>
																	) : null}
																	<button type="button" onClick={(event) => { event.stopPropagation(); deleteMessage(message.id).catch(console.error) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: '#ffffff', padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#b91c1c', cursor: 'pointer' }}>
																		<FaTrash size={12} /> Delete message
																	</button>
																</div>
															) : null}
														</div>
													</div>
												)
											})}
											<div ref={chatEndRef} />
										</div>

										<div style={{ display: 'flex', gap: 8, margin: '0 18px 18px', padding: 8, borderRadius: 16, background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 6px 14px rgba(15,23,42,0.06)' }}>
											<input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={sendImageMessage} />
											<button type="button" onClick={() => imageInputRef.current?.click()} style={{ width: 46, height: 46, borderRadius: '50%', background: '#eff6ff', border: '1px solid #dbeafe', color: '#007AFB', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: imageSending ? 'not-allowed' : 'pointer', opacity: imageSending ? 0.65 : 1 }} disabled={imageSending} aria-label="Attach image">
												<FaImage />
											</button>
											<input
												value={input}
												onChange={(event) => setInput(event.target.value)}
												onKeyDown={(event) => {
													if (event.key === 'Enter') {
														event.preventDefault()
														sendMessage().catch(console.error)
													}
												}}
												placeholder={editingMessageId ? 'Edit your message...' : 'Type a message...'}
												style={{ flex: 1, padding: 12, borderRadius: 999, border: '1px solid #d1d5db', outline: 'none', background: '#ffffff', boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.04)' }}
											/>
											{editingMessageId ? <button type="button" onClick={resetComposer} style={{ minWidth: 88, borderRadius: 999, border: '1px solid #d1d5db', background: '#ffffff', color: '#334155', fontWeight: 700, cursor: 'pointer' }}>Cancel</button> : null}
											<button type="button" onClick={() => sendMessage().catch(console.error)} style={{ width: 46, height: 46, borderRadius: '50%', background: '#007AFB', border: 'none', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 8px 18px rgba(0, 122, 251, 0.25)', cursor: 'pointer' }} aria-label="Send message" disabled={imageSending}>
												<FaPaperPlane />
											</button>
										</div>
									</>
								) : (
									<div style={{ display: 'grid', placeItems: 'center', flex: 1, padding: 24 }}>
										<div style={{ textAlign: 'center', maxWidth: 460, padding: 28, borderRadius: 20, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 8px 22px rgba(15,23,42,0.06)' }}>
											<div style={{ width: 58, height: 58, margin: '0 auto 14px', borderRadius: 18, background: '#eff6ff', color: '#007AFB', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
												<FaFacebookMessenger />
											</div>
											<h3 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Select an employee to start chatting</h3>
											<div style={{ marginTop: 8, color: '#475569', fontSize: 14, lineHeight: 1.6 }}>This HR page loads internal employee conversations only. Students and parents are intentionally excluded from the contact list.</div>
										</div>
									</div>
								)}
							</div>
						</section>
					</div>
				</main>
			</div>

			{previewImageUrl ? (
				<div onClick={() => setPreviewImageUrl('')} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.85)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
					<button type="button" onClick={() => setPreviewImageUrl('')} style={{ position: 'absolute', top: 18, right: 18, width: 36, height: 36, borderRadius: 999, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(15,23,42,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Close image">
						<FaTimes />
					</button>
					<img src={previewImageUrl} alt="Preview" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 14 }} />
				</div>
			) : null}
		</div>
	)
}
