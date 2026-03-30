import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FaArrowLeft, FaCheck, FaPaperPlane, FaSearch } from 'react-icons/fa'
import { getDatabase, get, onValue, push, ref, set, update } from 'firebase/database'
import { app } from '../firebase'
import api from '../api'

const RTDB_BASE = 'https://bale-house-rental-default-rtdb.firebaseio.com'
const DEFAULT_PROFILE = '/default-profile.png'

const ROLE_META = {
  teacher: { label: 'Teacher', node: 'Teachers' },
  finance: { label: 'Finance', node: 'Finance' },
  school_admins: { label: 'School Admins', node: 'School_Admins' },
}

const normalizeTab = (value) => {
  const tab = String(value || '').trim().toLowerCase()
  if (tab === 'teacher' || tab === 'teachers') return 'teacher'
  if (tab === 'finance') return 'finance'
  if (['school_admins', 'school_admin', 'school admins', 'school-admins', 'management', 'admin', 'admins'].includes(tab)) return 'school_admins'
  return 'teacher'
}

const getChatCandidates = (leftId, rightId) => {
  const left = String(leftId || '').trim()
  const right = String(rightId || '').trim()
  if (!left || !right) return []
  return Array.from(new Set([[left, right].sort().join('_'), `${left}_${right}`, `${right}_${left}`]))
}

const resolveExistingChatKey = (chats, leftId, rightId) => {
  const candidates = getChatCandidates(leftId, rightId)
  return (
    candidates.find((key) => {
      const chatNode = chats?.[key]
      if (!chatNode || typeof chatNode !== 'object') return false
      return Boolean(chatNode.lastMessage || chatNode.messages || chatNode.participants)
    }) || candidates[0] || ''
  )
}

const formatChatTime = (value) => {
  const stamp = Number(value || 0)
  if (!stamp) return ''
  const date = new Date(stamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatContactTime = (value) => {
  const stamp = Number(value || 0)
  if (!stamp) return ''
  const date = new Date(stamp)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return formatChatTime(stamp)
  }
  const diffDays = Math.floor((now.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000)
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

const formatChatDayLabel = (value) => {
  const stamp = Number(value || 0)
  if (!stamp) return ''
  const date = new Date(stamp)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  const todayFloor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dateFloor = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((todayFloor - dateFloor) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })
}

const getLastSeenText = (value) => {
  const stamp = Number(value || 0)
  if (!stamp) return 'Offline'
  const diffMs = Date.now() - stamp
  if (diffMs < 60_000) return 'Online recently'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `last seen ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `last seen ${hours}h ago`
  const days = Math.floor(hours / 24)
  return `last seen ${days}d ago`
}

const getDisplayName = (userNode, fallbackNode, fallbackLabel) =>
  userNode?.name ||
  userNode?.displayName ||
  userNode?.username ||
  fallbackNode?.name ||
  fallbackNode?.username ||
  fallbackLabel

const getProfileImage = (userNode, fallbackNode) =>
  userNode?.profileImage ||
  userNode?.profile ||
  userNode?.avatar ||
  fallbackNode?.profileImage ||
  DEFAULT_PROFILE

export default function AllChat() {
  const location = useLocation()
  const navigate = useNavigate()
  const db = getDatabase(app)

  const [admin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('admin')) || {}
    } catch {
      return {}
    }
  })

  const hrUserId = String(admin?.userId || admin?.id || admin?.uid || admin?.user_id || admin?.hrId || '').trim()
  const schoolCode = String(
    admin?.schoolCode ||
      (() => {
        try {
          const stored = JSON.parse(localStorage.getItem('gojo_admin') || '{}')
          return stored?.schoolCode || ''
        } catch {
          return ''
        }
      })()
  ).trim()

  const [resolvedSchoolCode, setResolvedSchoolCode] = useState(schoolCode)

  const activeSchoolCode = String(resolvedSchoolCode || schoolCode || '').trim()

  const schoolDbRoot = activeSchoolCode
    ? `${RTDB_BASE}/Platform1/Schools/${encodeURIComponent(activeSchoolCode)}`
    : RTDB_BASE
  const schoolNodePrefix = activeSchoolCode ? `Platform1/Schools/${activeSchoolCode}` : ''
  const withSchoolPath = (path) => (schoolNodePrefix ? `${schoolNodePrefix}/${path}` : path)

  const navigationState = location.state || {}
  const incomingUser = navigationState.contact || navigationState.user || null
  const incomingTab = normalizeTab(navigationState.tab || incomingUser?.type)

  const [baseUsers, setBaseUsers] = useState({})
  const [baseNodes, setBaseNodes] = useState({ teacher: {}, finance: {}, school_admins: {} })
  const [contactsByTab, setContactsByTab] = useState({ teacher: [], finance: [], school_admins: [] })
  const [selectedTab, setSelectedTab] = useState(incomingTab)
  const [selectedChatUser, setSelectedChatUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [typing, setTyping] = useState(false)
  const [lastSeen, setLastSeen] = useState(null)
  const [activeChatKey, setActiveChatKey] = useState('')
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  const chatEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth < 880)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadBaseData = async () => {
      if (!hrUserId) {
        setLoadingContacts(false)
        setError('HR user information is missing. Please log in again.')
        return
      }

      setLoadingContacts(true)
      setError('')

      try {
        const [contextRes, usersRes, teachersRes, financeRes, schoolAdminsRes] = await Promise.all([
          api.get('/school_context').catch(() => ({ data: {} })),
          api.get('/users').catch(() => ({ data: {} })),
          api.get('/teachers').catch(() => ({ data: {} })),
          api.get('/finance').catch(() => ({ data: {} })),
          api.get('/school_admins').catch(() => api.get('/management').catch(() => ({ data: {} }))),
        ])

        if (cancelled) return

        const backendSchoolCode = String(contextRes?.data?.schoolCode || '').trim()
        if (backendSchoolCode) {
          setResolvedSchoolCode(backendSchoolCode)
        }

        setBaseUsers(usersRes.data || {})
        setBaseNodes({
          teacher: teachersRes.data || {},
          finance: financeRes.data || {},
          school_admins: schoolAdminsRes.data || {},
        })
      } catch (requestError) {
        if (cancelled) return
        setError('Failed to load chat contacts.')
      } finally {
        if (!cancelled) setLoadingContacts(false)
      }
    }

    loadBaseData()
    return () => {
      cancelled = true
    }
  }, [hrUserId])

  useEffect(() => {
    if (!hrUserId) return undefined
    if (!activeSchoolCode) return undefined

    const chatsRef = ref(db, withSchoolPath('Chats'))

    const unsubscribe = onValue(chatsRef, (snapshot) => {
      const chats = snapshot.val() || {}

      const buildContacts = (tabKey) =>
        Object.entries(baseNodes[tabKey] || {})
          .map(([nodeKey, nodeValue]) => {
            const userId = String(nodeValue?.userId || '').trim()
            if (!userId || userId === hrUserId) return null

            const userNode = baseUsers[userId] || {}
            const chatKey = resolveExistingChatKey(chats, hrUserId, userId)
            const chatNode = chats?.[chatKey] || {}
            const unread = Number(chatNode?.unread?.[hrUserId] || 0)
            const lastMessage = chatNode?.lastMessage || null

            return {
              key: `${tabKey}-${nodeKey}`,
              nodeKey,
              type: tabKey,
              roleLabel: ROLE_META[tabKey].label,
              userId,
              name: getDisplayName(userNode, nodeValue, ROLE_META[tabKey].label),
              profileImage: getProfileImage(userNode, nodeValue),
              lastSeen: userNode?.lastSeen || null,
              unread,
              chatKey,
              lastMsgText: String(lastMessage?.text || '').trim(),
              lastMsgTime: Number(lastMessage?.timeStamp || 0),
            }
          })
          .filter(Boolean)
          .sort((left, right) => {
            const timeDiff = Number(right.lastMsgTime || 0) - Number(left.lastMsgTime || 0)
            if (timeDiff !== 0) return timeDiff
            return left.name.localeCompare(right.name)
          })

      setContactsByTab({
        teacher: buildContacts('teacher'),
        finance: buildContacts('finance'),
        school_admins: buildContacts('school_admins'),
      })
    })

    return () => unsubscribe()
  }, [activeSchoolCode, db, baseNodes, baseUsers, hrUserId, schoolNodePrefix])

  useEffect(() => {
    const findIncomingUser = () => {
      if (!incomingUser?.userId) return null
      const targetTab = normalizeTab(incomingUser?.type || incomingTab)
      const pool = contactsByTab[targetTab] || []
      return pool.find((contact) => String(contact.userId) === String(incomingUser.userId)) || null
    }

    const incomingMatch = findIncomingUser()
    if (incomingMatch) {
      setSelectedTab(normalizeTab(incomingUser?.type || incomingTab))
      setSelectedChatUser(incomingMatch)
      return
    }

    if (selectedChatUser?.userId) {
      const currentPool = contactsByTab[selectedTab] || []
      const refreshed = currentPool.find((contact) => contact.userId === selectedChatUser.userId)
      if (refreshed) {
        setSelectedChatUser(refreshed)
      } else if (!currentPool.length) {
        setSelectedChatUser(null)
      }
      return
    }

    if (!(contactsByTab[selectedTab] || []).length) return
  }, [contactsByTab, incomingTab, incomingUser, selectedChatUser, selectedTab])

  useEffect(() => {
    if (!selectedChatUser?.userId || !hrUserId) {
      setMessages([])
      setTyping(false)
      setLastSeen(null)
      setActiveChatKey('')
      return undefined
    }
    if (!activeSchoolCode) return undefined

    const chatKey = selectedChatUser.chatKey || resolveExistingChatKey({}, hrUserId, selectedChatUser.userId)
    const chatPath = withSchoolPath(`Chats/${chatKey}`)
    const messagesRef = ref(db, `${chatPath}/messages`)
    const typingRef = ref(db, `${chatPath}/typing`)
    const lastSeenRef = ref(db, withSchoolPath(`Users/${selectedChatUser.userId}/lastSeen`))

    setActiveChatKey(chatKey)

    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {}
      const mappedMessages = Object.entries(data)
        .filter(([, message]) => !message?.deleted)
        .map(([id, message]) => ({
          id,
          ...message,
          mine: String(message?.senderId) === String(hrUserId),
        }))
        .sort((left, right) => Number(left.timeStamp || 0) - Number(right.timeStamp || 0))

      setMessages(mappedMessages)

      Object.entries(data).forEach(([id, message]) => {
        if (message && !message.deleted && !message.seen && String(message.receiverId) === String(hrUserId)) {
          update(ref(db, `${chatPath}/messages/${id}`), { seen: true }).catch(() => {})
        }
      })

      update(ref(db, `${chatPath}/unread`), { [hrUserId]: 0 }).catch(() => {})
    })

    const unsubscribeTyping = onValue(typingRef, (snapshot) => {
      const typingData = snapshot.val()
      setTyping(Boolean(typingData?.userId) && String(typingData.userId) === String(selectedChatUser.userId))
    })

    const unsubscribeLastSeen = onValue(lastSeenRef, (snapshot) => {
      setLastSeen(snapshot.val())
    })

    return () => {
      unsubscribeMessages()
      unsubscribeTyping()
      unsubscribeLastSeen()
    }
  }, [activeSchoolCode, db, hrUserId, selectedChatUser, schoolNodePrefix])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const filteredContacts = useMemo(() => {
    const pool = contactsByTab[selectedTab] || []
    const query = String(searchQuery || '').trim().toLowerCase()
    if (!query) return pool
    return pool.filter((contact) => {
      const haystack = `${contact.name} ${contact.roleLabel} ${contact.lastMsgText}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [contactsByTab, searchQuery, selectedTab])

  const threadItems = useMemo(() => {
    const items = []
    let previousDayLabel = ''

    messages.forEach((message) => {
      const dayLabel = formatChatDayLabel(message.timeStamp)
      if (dayLabel && dayLabel !== previousDayLabel) {
        items.push({ type: 'day', key: `day-${dayLabel}-${message.id}`, label: dayLabel })
        previousDayLabel = dayLabel
      }

      items.push({ type: 'message', key: message.id, message })
    })

    return items
  }, [messages])

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedChatUser?.userId || !hrUserId || !activeChatKey) return

    const chatPath = withSchoolPath(`Chats/${activeChatKey}`)
    const chatRef = ref(db, chatPath)
    const messagesRef = ref(db, `${chatPath}/messages`)
    const payload = {
      senderId: hrUserId,
      receiverId: selectedChatUser.userId,
      type: 'text',
      text: messageInput.trim(),
      imageUrl: null,
      replyTo: null,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp: Date.now(),
    }

    const messageRef = push(messagesRef)
    await set(messageRef, payload)

    let unreadState = {}
    try {
      const unreadSnapshot = await get(ref(db, `${chatPath}/unread`))
      unreadState = unreadSnapshot.val() || {}
    } catch {
      unreadState = {}
    }

    await update(chatRef, {
      participants: {
        [hrUserId]: true,
        [selectedChatUser.userId]: true,
      },
      lastMessage: {
        ...payload,
        messageId: messageRef.key,
      },
      unread: {
        ...(unreadState || {}),
        [hrUserId]: 0,
        [selectedChatUser.userId]: Number(unreadState?.[selectedChatUser.userId] || 0) + 1,
      },
      typing: null,
    })

    setMessageInput('')
  }

  const handleTyping = async (event) => {
    const nextValue = event.target.value
    setMessageInput(nextValue)

    if (!selectedChatUser?.userId || !hrUserId || !activeChatKey) return

    const typingRef = ref(db, `${withSchoolPath(`Chats/${activeChatKey}`)}/typing`)

    if (!nextValue.trim()) {
      await set(typingRef, { userId: null })
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      return
    }

    await set(typingRef, { userId: hrUserId })

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      set(typingRef, { userId: null }).catch(() => {})
    }, 1600)
  }

  const subtitle =
    selectedChatUser && typing
      ? `${selectedChatUser.roleLabel} is typing...`
      : selectedChatUser
        ? getLastSeenText(lastSeen || selectedChatUser.lastSeen)
        : 'Select a staff member to start chatting'

  const selectedUnreadCount = Math.max(Number(selectedChatUser?.unread || 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg, #f4f6fb)', padding: '18px 14px', boxSizing: 'border-box' }}>
      <div
        style={{
          minHeight: 'calc(100vh - 36px)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <main
          style={{
            width: '100%',
            minWidth: 0,
            maxWidth: 'none',
            minHeight: 'calc(100vh - 36px)',
            padding: '0 2px',
            boxSizing: 'border-box',
          }}
        >
          <style>{`
            .hr-chat-shell {
              display: flex;
              flex-direction: column;
              gap: 18px;
              min-height: calc(100vh - 40px);
            }
            .hr-chat-hero {
              position: relative;
              overflow: hidden;
              border-radius: 22px;
              padding: 24px;
              border: 1px solid var(--border-strong, rgba(191, 219, 254, 0.9));
              background:
                radial-gradient(circle at top right, color-mix(in srgb, var(--accent, #60a5fa) 20%, transparent), transparent 34%),
                linear-gradient(135deg, var(--surface-panel, #f8fbff) 0%, var(--surface-accent, #e9f2ff) 52%, var(--surface-panel, #f8fbff) 100%);
              box-shadow: var(--shadow-panel, 0 18px 40px rgba(15, 23, 42, 0.08));
            }
            .hr-chat-topbar {
              display: flex;
              align-items: flex-start;
              gap: 14px;
            }
            .hr-chat-page-back {
              width: 44px;
              height: 44px;
              border: none;
              border-radius: 14px;
              background: color-mix(in srgb, var(--surface-panel, #ffffff) 92%, transparent);
              color: var(--accent-strong, #1d4ed8);
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              box-shadow: var(--shadow-soft, 0 10px 20px rgba(37, 99, 235, 0.12));
              flex-shrink: 0;
            }
            .hr-chat-hero-copy {
              min-width: 0;
            }
            .hr-chat-hero h1 {
              margin: 0;
              color: var(--text-primary, #0f172a);
              font-size: 30px;
              font-weight: 800;
            }
            .hr-chat-hero p {
              margin: 8px 0 0;
              max-width: 720px;
              color: var(--text-secondary, #475569);
              font-size: 14px;
              line-height: 1.6;
            }
            .hr-chat-tabs {
              margin-top: 18px;
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
            }
            .hr-chat-tab {
              border: 1px solid var(--border-soft, #cbdaf8);
              background: color-mix(in srgb, var(--surface-panel, #ffffff) 92%, transparent);
              color: var(--text-secondary, #28539a);
              border-radius: 999px;
              padding: 10px 16px;
              font-size: 13px;
              font-weight: 800;
              cursor: pointer;
              transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
            }
            .hr-chat-tab:hover {
              transform: translateY(-1px);
              background: var(--surface-accent, #eef4ff);
              box-shadow: var(--shadow-glow, 0 10px 20px rgba(37, 99, 235, 0.14));
            }
            .hr-chat-tab.active {
              color: #fff;
              border-color: var(--accent-strong, #2563eb);
              background: linear-gradient(135deg, var(--accent, #2563eb), var(--accent-strong, #4f8cff));
            }
            .hr-chat-card {
              display: grid;
              grid-template-columns: 340px minmax(0, 1fr);
              gap: 18px;
              min-height: calc(100vh - 220px);
            }
            .hr-chat-panel,
            .hr-chat-thread {
              background: linear-gradient(180deg, var(--surface-panel, #ffffff) 0%, var(--surface-muted, #f9fbff) 100%);
              border: 1px solid var(--border-soft, rgba(226, 232, 240, 0.9));
              border-radius: 22px;
              box-shadow: var(--shadow-panel, 0 18px 40px rgba(15, 23, 42, 0.08));
            }
            .hr-chat-panel {
              padding: 18px;
              display: flex;
              flex-direction: column;
              min-width: 0;
            }
            .hr-chat-thread {
              display: flex;
              flex-direction: column;
              min-width: 0;
              overflow: hidden;
            }
            .hr-chat-panel-head {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              margin-bottom: 14px;
            }
            .hr-chat-panel-title {
              margin: 0;
              color: var(--text-primary, #0f172a);
              font-size: 18px;
              font-weight: 800;
            }
            .hr-chat-panel-copy {
              margin: 4px 0 0;
              color: var(--text-muted, #64748b);
              font-size: 12px;
            }
            .hr-chat-search {
              position: relative;
              margin-bottom: 14px;
            }
            .hr-chat-search svg {
              position: absolute;
              left: 12px;
              top: 50%;
              transform: translateY(-50%);
              color: var(--text-muted, #94a3b8);
              font-size: 14px;
            }
            .hr-chat-search input {
              width: 100%;
              height: 42px;
              border-radius: 14px;
              border: 1px solid var(--input-border, #dbe6f8);
              padding: 0 14px 0 38px;
              font-size: 13px;
              font-weight: 600;
              color: var(--text-primary, #0f172a);
              background: var(--input-bg, #fff);
              outline: none;
              box-sizing: border-box;
            }
            .hr-chat-list {
              display: flex;
              flex-direction: column;
              gap: 10px;
              overflow-y: auto;
              padding-right: 4px;
            }
            .hr-chat-contact {
              display: flex;
              align-items: center;
              gap: 12px;
              border-radius: 18px;
              padding: 12px;
              border: 1px solid var(--border-soft, #e2e8f0);
              background: var(--surface-panel, #fff);
              cursor: pointer;
              transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
            }
            .hr-chat-contact:hover {
              transform: translateY(-1px);
              box-shadow: var(--shadow-soft, 0 12px 24px rgba(15, 23, 42, 0.08));
            }
            .hr-chat-contact.active {
              background: linear-gradient(180deg, var(--surface-accent, #eaf3ff) 0%, var(--accent-soft, #dbeafe) 100%);
              border-color: var(--border-strong, #93c5fd);
              box-shadow: var(--shadow-glow, 0 16px 28px rgba(37, 99, 235, 0.16));
            }
            .hr-chat-avatar {
              width: 52px;
              height: 52px;
              border-radius: 16px;
              object-fit: cover;
              flex-shrink: 0;
              border: 1px solid color-mix(in srgb, var(--border-soft, #94a3b8) 32%, transparent);
              background: var(--surface-accent, #eef4ff);
            }
            .hr-chat-contact-main {
              flex: 1;
              min-width: 0;
            }
            .hr-chat-contact-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 10px;
            }
            .hr-chat-contact-time {
              flex-shrink: 0;
              font-size: 11px;
              font-weight: 700;
              color: var(--text-muted, #94a3b8);
            }
            .hr-chat-contact-name {
              font-size: 14px;
              font-weight: 800;
              color: var(--text-primary, #0f172a);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .hr-chat-contact-role {
              margin-top: 2px;
              font-size: 12px;
              color: var(--accent, #3b82f6);
              font-weight: 700;
            }
            .hr-chat-contact-preview {
              margin-top: 4px;
              font-size: 12px;
              color: var(--text-muted, #64748b);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .hr-chat-unread {
              min-width: 22px;
              height: 22px;
              border-radius: 999px;
              background: var(--danger, #dc2626);
              color: #fff;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-weight: 800;
              padding: 0 6px;
              box-sizing: border-box;
            }
            .hr-chat-thread-head {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 14px;
              padding: 16px 20px;
              border-bottom: 1px solid var(--border-soft, rgba(226, 232, 240, 0.8));
              background: linear-gradient(180deg, color-mix(in srgb, var(--surface-panel, #ffffff) 96%, transparent) 0%, color-mix(in srgb, var(--surface-muted, #f3f7ff) 96%, transparent) 100%);
              backdrop-filter: blur(12px);
            }
            .hr-chat-thread-meta {
              display: flex;
              align-items: center;
              gap: 12px;
              min-width: 0;
            }
            .hr-chat-thread-avatar {
              width: 46px;
              height: 46px;
              border-radius: 50%;
              object-fit: cover;
              border: 2px solid var(--border-strong, rgba(191, 219, 254, 0.9));
              box-shadow: var(--shadow-glow, 0 10px 22px rgba(37, 99, 235, 0.14));
              flex-shrink: 0;
            }
            .hr-chat-thread-name {
              font-size: 16px;
              font-weight: 800;
              color: var(--text-primary, #0f172a);
            }
            .hr-chat-thread-name-row {
              display: flex;
              align-items: center;
              gap: 10px;
              min-width: 0;
            }
            .hr-chat-thread-subtitle {
              font-size: 12px;
              color: var(--text-muted, #64748b);
              font-weight: 600;
            }
            .hr-chat-thread-count {
              flex-shrink: 0;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              min-width: 28px;
              height: 28px;
              padding: 0 10px;
              border-radius: 999px;
              background: linear-gradient(135deg, var(--accent, #2563eb), var(--accent-strong, #1d4ed8));
              color: #fff;
              font-size: 12px;
              font-weight: 800;
              box-shadow: var(--shadow-glow, 0 10px 20px rgba(37, 99, 235, 0.18));
            }
            .hr-chat-back {
              width: 38px;
              height: 38px;
              border: none;
              border-radius: 12px;
              background: var(--surface-accent, #e2ebfb);
              color: var(--accent-strong, #1d4ed8);
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }
            .hr-chat-body {
              flex: 1;
              overflow-y: auto;
              padding: 22px 20px 18px;
              background:
                radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--accent, #60a5fa) 18%, transparent), transparent 18%),
                radial-gradient(circle at 80% 0%, color-mix(in srgb, var(--accent, #60a5fa) 10%, transparent), transparent 20%),
                linear-gradient(180deg, var(--page-bg-secondary, #edf4ff) 0%, var(--surface-panel, #f8fbff) 45%, var(--surface-accent, #eef6ff) 100%);
            }
            .hr-chat-empty-thread,
            .hr-chat-empty-list {
              display: flex;
              align-items: center;
              justify-content: center;
              flex-direction: column;
              gap: 8px;
              color: var(--text-muted, #64748b);
              text-align: center;
              min-height: 220px;
              padding: 20px;
            }
            .hr-chat-empty-thread h3,
            .hr-chat-empty-list h3 {
              margin: 0;
              color: var(--text-primary, #0f172a);
              font-size: 18px;
            }
            .hr-chat-day-separator {
              display: flex;
              justify-content: center;
              margin: 6px 0 18px;
            }
            .hr-chat-day-chip {
              padding: 6px 12px;
              border-radius: 999px;
              background: color-mix(in srgb, var(--surface-panel, #ffffff) 82%, transparent);
              border: 1px solid var(--border-strong, rgba(191, 219, 254, 0.9));
              color: var(--text-muted, #64748b);
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.04em;
              box-shadow: var(--shadow-soft, 0 8px 18px rgba(15, 23, 42, 0.06));
              backdrop-filter: blur(10px);
            }
            .hr-chat-message-row {
              display: flex;
              align-items: flex-end;
              gap: 10px;
              margin-bottom: 14px;
            }
            .hr-chat-message-row.theirs {
              justify-content: flex-start;
            }
            .hr-chat-message-row.mine {
              justify-content: flex-end;
            }
            .hr-chat-message-avatar {
              width: 34px;
              height: 34px;
              border-radius: 50%;
              object-fit: cover;
              border: 2px solid color-mix(in srgb, var(--surface-panel, #ffffff) 90%, transparent);
              box-shadow: var(--shadow-soft, 0 8px 18px rgba(15, 23, 42, 0.08));
              align-self: flex-end;
              flex-shrink: 0;
            }
            .hr-chat-message-stack {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              max-width: min(78%, 700px);
            }
            .hr-chat-message-row.mine .hr-chat-message-stack {
              align-items: flex-end;
            }
            .hr-chat-bubble {
              width: fit-content;
              max-width: 100%;
              padding: 12px 14px 24px;
              border-radius: 18px;
              position: relative;
              box-shadow: var(--shadow-soft, 0 14px 24px rgba(15, 23, 42, 0.08));
              line-height: 1.5;
              font-size: 14px;
              white-space: pre-wrap;
              word-break: break-word;
            }
            .hr-chat-bubble.mine {
              color: #fff;
              background: linear-gradient(135deg, #2a7fff 0%, #1473f6 55%, #0d65e8 100%);
              border-top-right-radius: 8px;
            }
            .hr-chat-bubble.theirs {
              color: var(--text-primary, #0f172a);
              background: color-mix(in srgb, var(--surface-panel, #ffffff) 95%, transparent);
              border: 1px solid var(--border-soft, rgba(226, 232, 240, 0.9));
              border-top-left-radius: 8px;
            }
            .hr-chat-bubble.mine::after,
            .hr-chat-bubble.theirs::after {
              content: '';
              position: absolute;
              bottom: 0;
              width: 16px;
              height: 16px;
            }
            .hr-chat-bubble.mine::after {
              right: -5px;
              background: linear-gradient(135deg, var(--accent, #1473f6) 0%, var(--accent-strong, #0d65e8) 100%);
              clip-path: polygon(0 0, 100% 100%, 0 100%);
            }
            .hr-chat-bubble.theirs::after {
              left: -5px;
              background: color-mix(in srgb, var(--surface-panel, #ffffff) 95%, transparent);
              border-left: 1px solid var(--border-soft, rgba(226, 232, 240, 0.9));
              border-bottom: 1px solid var(--border-soft, rgba(226, 232, 240, 0.9));
              clip-path: polygon(100% 0, 100% 100%, 0 100%);
            }
            .hr-chat-bubble-text {
              display: block;
              padding-right: 56px;
            }
            .hr-chat-meta {
              position: absolute;
              right: 10px;
              bottom: 8px;
              display: inline-flex;
              align-items: center;
              gap: 6px;
              font-size: 11px;
              color: rgba(255, 255, 255, 0.92);
              font-weight: 700;
            }
            .hr-chat-bubble.theirs .hr-chat-meta {
              color: var(--text-muted, #64748b);
            }
            .hr-chat-input {
              padding: 16px 18px 18px;
              border-top: 1px solid var(--border-soft, rgba(226, 232, 240, 0.8));
              background: linear-gradient(180deg, color-mix(in srgb, var(--surface-panel, #ffffff) 98%, transparent) 0%, color-mix(in srgb, var(--surface-muted, #f8fafc) 98%, transparent) 100%);
            }
            .hr-chat-composer {
              display: flex;
              align-items: flex-end;
              gap: 12px;
              padding: 8px 8px 8px 16px;
              border-radius: 26px;
              background: color-mix(in srgb, var(--surface-panel, #ffffff) 98%, transparent);
              border: 1px solid var(--border-soft, rgba(209, 223, 248, 0.95));
              box-shadow: var(--shadow-soft, 0 16px 28px rgba(15, 23, 42, 0.08));
            }
            .hr-chat-input textarea {
              flex: 1;
              min-height: 26px;
              max-height: 120px;
              resize: none;
              border-radius: 0;
              border: none;
              background: transparent;
              padding: 10px 0 10px 0;
              font-size: 14px;
              font-family: inherit;
              outline: none;
              box-sizing: border-box;
              line-height: 1.5;
              color: var(--text-primary, #0f172a);
            }
            .hr-chat-send {
              width: 50px;
              height: 50px;
              border: none;
              border-radius: 50%;
              background: linear-gradient(135deg, var(--accent, #2a7fff), var(--accent-strong, #0d65e8));
              color: #fff;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              box-shadow: var(--shadow-glow, 0 16px 26px rgba(37, 99, 235, 0.24));
              flex-shrink: 0;
            }
            .hr-chat-send:disabled {
              opacity: 0.45;
              cursor: not-allowed;
              box-shadow: none;
            }
            .hr-chat-typing {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 10px 12px;
              border-radius: 14px;
              background: color-mix(in srgb, var(--surface-panel, #ffffff) 90%, transparent);
              border: 1px solid var(--border-strong, rgba(191, 219, 254, 0.9));
              color: var(--accent-strong, #1d4ed8);
              font-size: 12px;
              font-weight: 700;
              margin: 6px 0 0 46px;
            }
            .hr-chat-loading {
              padding: 28px;
              color: var(--text-secondary, #475569);
              font-weight: 700;
              text-align: center;
            }
            @media (max-width: 1120px) {
              .hr-chat-card {
                grid-template-columns: 300px minmax(0, 1fr);
              }
            }
            @media (max-width: 880px) {
              .hr-chat-card {
                grid-template-columns: 1fr;
                min-height: calc(100vh - 220px);
              }
              .hr-chat-panel.mobile-hidden,
              .hr-chat-thread.mobile-hidden {
                display: none;
              }
            }
            @media (max-width: 640px) {
              .hr-chat-bubble-text {
                padding-right: 48px;
              }
              .hr-chat-message-stack {
                max-width: 88%;
              }
              .hr-chat-typing {
                margin-left: 0;
              }
            }
          `}</style>

          <div className="hr-chat-shell">
            <section className="hr-chat-hero">
              <div className="hr-chat-topbar">
                <button type="button" className="hr-chat-page-back" onClick={() => navigate(-1)} aria-label="Go back">
                  <FaArrowLeft />
                </button>
                <div className="hr-chat-hero-copy">
                  <h1>All Chat</h1>
                  <p>
                    HR can message staff teams directly from one workspace. This page is limited to employee communication with Teachers, Finance, and School Admins, and uses the shared realtime chat node so it stays compatible with the other panels.
                  </p>
                </div>
              </div>
              <div className="hr-chat-tabs">
                {Object.entries(ROLE_META).map(([tabKey, meta]) => {
                  const count = contactsByTab[tabKey]?.length || 0
                  return (
                    <button
                      key={tabKey}
                      type="button"
                      className={`hr-chat-tab ${selectedTab === tabKey ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedTab(tabKey)
                        setSelectedChatUser(null)
                      }}
                    >
                      {meta.label} ({count})
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="hr-chat-card">
              <aside className={`hr-chat-panel ${isMobile && selectedChatUser ? 'mobile-hidden' : ''}`}>
                <div className="hr-chat-panel-head">
                  <div>
                    <h2 className="hr-chat-panel-title">{ROLE_META[selectedTab].label} Contacts</h2>
                    <p className="hr-chat-panel-copy">Choose who HR should message.</p>
                  </div>
                </div>

                <div className="hr-chat-search">
                  <FaSearch />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={`Search ${ROLE_META[selectedTab].label.toLowerCase()} contacts...`}
                  />
                </div>

                {loadingContacts ? (
                  <div className="hr-chat-loading">Loading contacts...</div>
                ) : error ? (
                  <div className="hr-chat-empty-list">
                    <h3>Chat unavailable</h3>
                    <p>{error}</p>
                  </div>
                ) : filteredContacts.length ? (
                  <div className="hr-chat-list">
                    {filteredContacts.map((contact) => (
                      <button
                        key={contact.key}
                        type="button"
                        className={`hr-chat-contact ${selectedChatUser?.userId === contact.userId ? 'active' : ''}`}
                        onClick={() => setSelectedChatUser(contact)}
                        style={{ textAlign: 'left' }}
                      >
                        <img className="hr-chat-avatar" src={contact.profileImage} alt={contact.name} />
                        <div className="hr-chat-contact-main">
                          <div className="hr-chat-contact-row">
                            <span className="hr-chat-contact-name">{contact.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {contact.lastMsgTime ? <span className="hr-chat-contact-time">{formatContactTime(contact.lastMsgTime)}</span> : null}
                              {contact.unread > 0 ? <span className="hr-chat-unread">{contact.unread}</span> : null}
                            </div>
                          </div>
                          <div className="hr-chat-contact-role">{contact.roleLabel}</div>
                          <div className="hr-chat-contact-preview">
                            {contact.lastMsgText || 'No messages yet'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="hr-chat-empty-list">
                    <h3>No contacts found</h3>
                    <p>There are no {ROLE_META[selectedTab].label.toLowerCase()} contacts matching this search.</p>
                  </div>
                )}
              </aside>

              <section className={`hr-chat-thread ${isMobile && !selectedChatUser ? 'mobile-hidden' : ''}`}>
                {selectedChatUser ? (
                  <>
                    <header className="hr-chat-thread-head">
                      <div className="hr-chat-thread-meta">
                        {isMobile ? (
                          <button type="button" className="hr-chat-back" onClick={() => setSelectedChatUser(null)}>
                            <FaArrowLeft />
                          </button>
                        ) : null}
                        <img className="hr-chat-thread-avatar" src={selectedChatUser.profileImage} alt={selectedChatUser.name} />
                        <div style={{ minWidth: 0 }}>
                          <div className="hr-chat-thread-name-row">
                            <div className="hr-chat-thread-name">{selectedChatUser.name}</div>
                            {selectedUnreadCount > 0 ? <span className="hr-chat-thread-count">{selectedUnreadCount}</span> : null}
                          </div>
                          <div className="hr-chat-thread-subtitle">{subtitle}</div>
                        </div>
                      </div>
                    </header>

                    <div className="hr-chat-body">
                      {threadItems.length ? (
                        threadItems.map((item) => {
                          if (item.type === 'day') {
                            return (
                              <div key={item.key} className="hr-chat-day-separator">
                                <span className="hr-chat-day-chip">{item.label}</span>
                              </div>
                            )
                          }

                          const message = item.message
                          return (
                            <div key={item.key} className={`hr-chat-message-row ${message.mine ? 'mine' : 'theirs'}`}>
                              {!message.mine ? (
                                <img
                                  className="hr-chat-message-avatar"
                                  src={selectedChatUser.profileImage}
                                  alt={selectedChatUser.name}
                                />
                              ) : null}
                              <div className="hr-chat-message-stack">
                                <div className={`hr-chat-bubble ${message.mine ? 'mine' : 'theirs'}`}>
                                  <span className="hr-chat-bubble-text">{message.text || 'Message'}</span>
                                  <span className="hr-chat-meta">
                                    <span>{formatChatTime(message.timeStamp)}</span>
                                    {message.mine ? <FaCheck color={message.seen ? '#a5d8ff' : '#dbeafe'} size={11} /> : null}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="hr-chat-empty-thread">
                          <h3>Start the conversation</h3>
                          <p>Send the first message to {selectedChatUser.name}.</p>
                        </div>
                      )}

                      {typing ? <div className="hr-chat-typing">{selectedChatUser.name} is typing...</div> : null}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="hr-chat-input">
                      <div className="hr-chat-composer">
                        <textarea
                          value={messageInput}
                          onChange={handleTyping}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault()
                              sendMessage().catch(() => {})
                            }
                          }}
                          placeholder={`Message ${selectedChatUser.name}...`}
                        />
                        <button type="button" className="hr-chat-send" onClick={() => sendMessage().catch(() => {})} disabled={!messageInput.trim()}>
                          <FaPaperPlane />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="hr-chat-empty-thread">
                    <h3>Select a user to start chatting</h3>
                    <p>Pick a teacher, finance officer, or school admin contact from the list.</p>
                  </div>
                )}
              </section>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}