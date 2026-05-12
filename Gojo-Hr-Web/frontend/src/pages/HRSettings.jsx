import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaBell, FaCheckCircle, FaCog, FaFacebookMessenger, FaMoon, FaShieldAlt, FaSun, FaUserLock } from 'react-icons/fa'
import api from '../api'
import './Dashboard.css'
import '../styles/global.css'
import { useTheme } from '../theme/ThemeContext'

function getInitials(name) {
  return (name || 'HR Office')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'HR'
}

function createPlaceholderAvatar(name) {
  const initials = getInitials(name)
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#007AFB'/>
      <stop offset='100%' stop-color='#45A5FF'/>
    </linearGradient>
  </defs>
  <rect width='160' height='160' rx='80' fill='url(#g)'/>
  <text x='50%' y='53%' dominant-baseline='middle' text-anchor='middle' fill='white' font-family='Segoe UI, Arial, sans-serif' font-size='56' font-weight='700'>${initials}</text>
</svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function sanitizeProfileImage(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const lower = raw.toLowerCase()
  if (lower === '/default-profile.png') return ''
  if (lower.startsWith('file://') || lower.startsWith('content://')) return ''

  return raw
}

function AvatarBadge({ src, name, size = 40, fontSize = 14, radius = '50%' }) {
  const [failed, setFailed] = useState(false)
  const normalizedSrc = sanitizeProfileImage(src)
  const fallbackSrc = createPlaceholderAvatar(name)

  useEffect(() => {
    setFailed(false)
  }, [src])

  return (
    <img
      src={!normalizedSrc || failed ? fallbackSrc : normalizedSrc}
      alt={name || 'HR Office'}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', border: '1px solid #d9e5f5', flexShrink: 0 }}
    />
  )
}

function formatFileSize(bytes) {
  const numericBytes = Number(bytes || 0)
  if (!numericBytes) return '0 KB'
  if (numericBytes >= 1024 * 1024) {
    return `${(numericBytes / (1024 * 1024)).toFixed(2)} MB`
  }
  return `${Math.max(1, Math.round(numericBytes / 1024))} KB`
}

async function compressImageToJpeg(file, { maxDimension = 960, maxBytes = 350 * 1024 } = {}) {
  if (!file || !String(file.type || '').startsWith('image/') || file.type === 'image/svg+xml') {
    return {
      file,
      originalSize: Number(file?.size || 0),
      finalSize: Number(file?.size || 0),
      wasCompressed: false,
      wasConvertedToJpeg: false,
    }
  }

  const imageUrl = URL.createObjectURL(file)

  try {
    const imageElement = await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Unable to process selected image.'))
      image.src = imageUrl
    })

    const originalWidth = imageElement.naturalWidth || imageElement.width || 1
    const originalHeight = imageElement.naturalHeight || imageElement.height || 1
    const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight))
    let targetWidth = Math.max(1, Math.round(originalWidth * scale))
    let targetHeight = Math.max(1, Math.round(originalHeight * scale))
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: false })

    if (!context) {
      throw new Error('Canvas context unavailable.')
    }

    const renderImage = () => {
      canvas.width = targetWidth
      canvas.height = targetHeight
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, targetWidth, targetHeight)
      context.drawImage(imageElement, 0, 0, targetWidth, targetHeight)
    }

    const canvasToBlob = (quality) => new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        reject(new Error('Image compression failed.'))
      }, 'image/jpeg', quality)
    })

    renderImage()

    const qualitySteps = [0.78, 0.68, 0.58, 0.48, 0.4]
    let bestBlob = null

    for (const quality of qualitySteps) {
      const candidateBlob = await canvasToBlob(quality)
      bestBlob = candidateBlob
      if (candidateBlob.size <= maxBytes) {
        break
      }
    }

    if (bestBlob && bestBlob.size > maxBytes) {
      targetWidth = Math.max(480, Math.round(targetWidth * 0.8))
      targetHeight = Math.max(480, Math.round(targetHeight * 0.8))
      renderImage()
      bestBlob = await canvasToBlob(0.4)
    }

    if (!bestBlob) {
      throw new Error('Image compression failed.')
    }

    const jpegFile = new File(
      [bestBlob],
      `${file.name.replace(/\.[^.]+$/, '') || 'profile-image'}.jpg`,
      { type: 'image/jpeg', lastModified: Date.now() },
    )

    return {
      file: jpegFile,
      originalSize: Number(file.size || 0),
      finalSize: Number(jpegFile.size || 0),
      wasCompressed: jpegFile.size < file.size,
      wasConvertedToJpeg: true,
    }
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

function validatePassword(currentValue, value, confirmValue) {
  const nextErrors = {}
  const currentPasswordValue = String(currentValue || '')
  const passwordValue = String(value || '')
  const confirmPasswordValue = String(confirmValue || '')
  const hasPasswordInput = Boolean(currentPasswordValue || passwordValue || confirmPasswordValue)

  if (!hasPasswordInput) {
    return nextErrors
  }

  if (!currentPasswordValue) {
    nextErrors.currentPassword = 'Enter your current password.'
  }

  if (!passwordValue) {
    nextErrors.password = 'Enter a new password.'
    return nextErrors
  }

  if (passwordValue.length < 8) {
    nextErrors.password = 'Password must be at least 8 characters.'
  } else if (!/[a-z]/.test(passwordValue) || !/[A-Z]/.test(passwordValue) || !/\d/.test(passwordValue)) {
    nextErrors.password = 'Password must include uppercase, lowercase, and a number.'
  }

  if (!confirmPasswordValue) {
    nextErrors.confirmPassword = 'Please confirm the new password.'
  } else if (passwordValue !== confirmPasswordValue) {
    nextErrors.confirmPassword = 'Passwords do not match.'
  }

  return nextErrors
}

export default function HRSettings() {
  const navigate = useNavigate()
  const { theme, isDark, setTheme } = useTheme()
  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('admin') || '{}')
    } catch {
      return {}
    }
  })

  const [displayName, setDisplayName] = useState(admin?.displayName || admin?.name || '')
  const [username, setUsername] = useState(admin?.username || admin?.userName || admin?.hrId || '')
  const [profileImage, setProfileImage] = useState(admin?.profileImage || admin?.photoURL || '')
  const [preview, setPreview] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isOptimizingImage, setIsOptimizingImage] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('info')
  const [fieldErrors, setFieldErrors] = useState({})
  const [profileImageMeta, setProfileImageMeta] = useState(null)

  useEffect(() => {
    setDisplayName(admin?.displayName || admin?.name || '');
    setUsername(admin?.username || admin?.userName || admin?.hrId || '');
    setProfileImage(admin?.profileImage || admin?.photoURL || '');
    setPreview(admin?.profileImage || admin?.photoURL || '');
  }, [admin]);

  const resolvedPreviewImage = useMemo(() => sanitizeProfileImage(
    preview || (typeof profileImage === 'string' ? profileImage : '') || admin?.profileImage || admin?.photoURL || '',
  ), [admin?.photoURL, admin?.profileImage, preview, profileImage])

  const passwordChecks = useMemo(() => {
    const nextPassword = String(password || '')
    return [
      { label: 'At least 8 characters', ok: nextPassword.length >= 8 },
      { label: 'Contains uppercase', ok: /[A-Z]/.test(nextPassword) },
      { label: 'Contains lowercase', ok: /[a-z]/.test(nextPassword) },
      { label: 'Contains a number', ok: /\d/.test(nextPassword) },
    ]
  }, [password])

  function resetFormToStoredAdmin() {
    setDisplayName(admin?.displayName || admin?.name || '')
    setUsername(admin?.username || admin?.userName || admin?.hrId || '')
    setProfileImage(admin?.profileImage || admin?.photoURL || '')
    setPreview(admin?.profileImage || admin?.photoURL || '')
    setCurrentPassword('')
    setPassword('')
    setConfirmPassword('')
    setFieldErrors({})
    setProfileImageMeta(null)
    setMessage('')
    setMessageType('info')
  }

  function handleFileChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(f);
    setProfileImage(f);
  }

  async function handleSave() {
    const nextFieldErrors = {}

    Object.assign(nextFieldErrors, validatePassword(currentPassword, password, confirmPassword))
    setFieldErrors(nextFieldErrors)

    if (Object.keys(nextFieldErrors).length > 0) {
      setMessageType('error')
      setMessage('Please fix the highlighted fields before saving.')
      return
    }

    setIsSaving(true)
    setMessage('')
    setMessageType('info')

    try {
      let userId = admin?.id || admin?.userId || admin?.uid || admin?.user_id || admin?.adminId || admin?.hrId || admin?.employeeId
      if (!userId) {
        try {
          const lookup = await api.get('/users/lookup', {
            params: {
              username: admin?.username || admin?.userName || '',
              email: admin?.email || '',
            },
          })
          const match = lookup.data || {}
          if (match) userId = match.id || match.uid || match.userId
        } catch (error) {
          console.warn('targeted user lookup failed', error)
        }
      }

      let profileUrl = preview || ''

      if (profileImage && typeof profileImage !== 'string' && userId) {
        const form = new FormData()
        form.append('profile', profileImage)
        const uploadResponse = await api.post(`/users/${userId}/upload_profile_image`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        profileUrl = uploadResponse.data?.profileImageUrl || profileUrl
      }

      if (userId) {
        const payload = {}
        if (profileUrl) payload.profileImage = profileUrl
        if (password) {
          payload.password = password
          payload.oldPassword = currentPassword
        }
        await api.put(`/users/${userId}`, payload)
      } else {
        setMessageType('warning')
        setMessage('Profile saved locally but backend user id could not be resolved. Please sign in again.')
      }

      const updated = { ...(admin || {}) }
      updated.profileImage = profileUrl || updated.profileImage
      localStorage.setItem('admin', JSON.stringify(updated))
      window.dispatchEvent(new Event('hr-admin-updated'))
      setAdmin(updated)
      setCurrentPassword('')
      setPassword('')
      setConfirmPassword('')
      setFieldErrors({})

      if (messageType !== 'warning') {
        setMessageType('success')
        setMessage('Profile updated successfully.')
      }
    } catch (error) {
      console.error('HRSettings save error:', error)
      const responseData = error?.response?.data
      if (responseData && typeof responseData === 'object') {
        const msgParts = []
        if (responseData.error) msgParts.push(responseData.error)
        if (responseData.hint) msgParts.push(responseData.hint)
        if (responseData.trace) {
          console.debug('Backend trace:', responseData.trace)
        }
        setMessageType('error')
        setMessage(msgParts.join(' - ') || JSON.stringify(responseData))
      } else {
        setMessageType('error')
        setMessage(error?.response?.statusText || error?.message || 'Failed to update profile')
      }
    } finally {
      setIsSaving(false)
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

  const alertStyles = {
    success: { border: '1px solid var(--success-border)', background: 'var(--success-soft)', color: 'var(--success)' },
    error: { border: '1px solid var(--danger-border)', background: 'var(--danger-soft)', color: 'var(--danger)' },
    warning: { border: '1px solid var(--warning-border)', background: 'var(--warning-soft)', color: 'var(--warning)' },
    info: { border: '1px solid var(--border-soft)', background: 'var(--surface-muted)', color: 'var(--text-primary)' },
  }

  return (
    <div
      className="dashboard-page"
      style={{
        minHeight: '100vh',
        background: 'var(--page-bg)',
        color: 'var(--text-primary)',
        '--surface-panel': isDark ? '#0f172a' : '#FFFFFF',
        '--surface-accent': isDark ? '#14213b' : '#F1F8FF',
        '--surface-muted': isDark ? '#111c31' : '#F7FBFF',
        '--surface-strong': isDark ? '#1e293b' : '#DCEBFF',
        '--page-bg': isDark ? '#08111f' : '#FFFFFF',
        '--border-soft': isDark ? '#243247' : '#D7E7FB',
        '--border-strong': isDark ? '#2f4f77' : '#B5D2F8',
        '--text-primary': isDark ? '#e5eefb' : '#0f172a',
        '--text-secondary': isDark ? '#c5d4ea' : '#334155',
        '--text-muted': isDark ? '#94a3b8' : '#64748b',
        '--accent': isDark ? '#60a5fa' : '#007AFB',
        '--accent-soft': isDark ? 'rgba(59, 130, 246, 0.18)' : '#E7F2FF',
        '--accent-strong': isDark ? '#3b82f6' : '#007AFB',
        '--success': isDark ? '#4ade80' : '#16a34a',
        '--success-soft': isDark ? 'rgba(20, 83, 45, 0.32)' : '#eefbf3',
        '--success-border': isDark ? 'rgba(74, 222, 128, 0.35)' : '#bbf7d0',
        '--warning': isDark ? '#fbbf24' : '#d97706',
        '--warning-soft': isDark ? 'rgba(120, 53, 15, 0.3)' : '#fffbeb',
        '--warning-border': isDark ? 'rgba(251, 191, 36, 0.34)' : '#fde68a',
        '--danger': isDark ? '#f87171' : '#dc2626',
        '--danger-soft': isDark ? 'rgba(127, 29, 29, 0.28)' : '#fff1f2',
        '--danger-border': isDark ? 'rgba(248, 113, 113, 0.32)' : '#fecaca',
        '--shadow-soft': isDark ? '0 10px 24px rgba(2, 6, 23, 0.26)' : '0 10px 24px rgba(0, 122, 251, 0.10)',
        '--shadow-panel': isDark ? '0 14px 30px rgba(2, 6, 23, 0.32)' : '0 14px 30px rgba(0, 122, 251, 0.14)',
        '--shadow-glow': isDark ? '0 0 0 2px rgba(59, 130, 246, 0.24)' : '0 0 0 2px rgba(0, 122, 251, 0.18)',
        '--sidebar-width': 'clamp(230px, 16vw, 290px)',
        '--topbar-height': '64px',
      }}
    >
      <style>{`
        .settings-theme-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 36px;
          padding: 0 14px;
          border-radius: 999px;
          border: 1px solid var(--border-soft);
          background: var(--surface-panel);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
        }

        .settings-panel {
          background: var(--surface-panel);
          border: 1px solid var(--border-soft);
          border-radius: 22px;
          box-shadow: 0 20px 46px rgba(15, 23, 42, 0.05);
        }

        .settings-soft-panel {
          border: 1px solid var(--border-soft);
          background: linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%);
        }

        .settings-icon-badge {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          border: 1px solid var(--border-strong);
          background: var(--surface-accent);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .settings-theme-toggle {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .settings-theme-option {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 64px;
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid var(--border-soft);
          background: var(--surface-panel);
          color: var(--text-secondary);
          cursor: pointer;
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
        }

        .settings-theme-option:hover {
          transform: translateY(-1px);
          border-color: var(--border-strong);
          background: var(--surface-muted);
        }

        .settings-theme-option.active {
          border-color: var(--accent-strong);
          background: var(--accent-soft);
          color: var(--text-primary);
          box-shadow: var(--shadow-glow);
        }

        .settings-theme-option-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border-soft);
          background: var(--surface-muted);
          color: var(--accent);
          flex-shrink: 0;
        }

        .settings-theme-option.active .settings-theme-option-icon {
          border-color: var(--accent-strong);
          background: var(--surface-panel);
        }

        .settings-theme-option-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .settings-theme-option-copy {
          margin-top: 4px;
          font-size: 12px;
          line-height: 1.5;
          color: var(--text-muted);
        }

        .settings-hidden-file {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .settings-input {
          width: 100%;
          height: 46px;
          border-radius: 14px;
          border: 1px solid var(--border-soft);
          background: var(--surface-muted);
          color: var(--text-primary);
          padding: 0 14px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .settings-input:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.18);
        }

        .settings-field-error {
          margin-top: 6px;
          font-size: 12px;
          font-weight: 700;
          color: var(--danger);
        }

        .settings-input.readonly {
          background: var(--surface-panel);
          color: var(--text-muted);
          border-color: var(--border-soft);
          cursor: not-allowed;
        }
      `}</style>

      <nav className="top-navbar" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--topbar-height)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '0 18px 0 20px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-panel)', zIndex: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Gojo HR</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" title="Notifications" style={headerActionStyle}><FaBell /></button>
          <Link to="/all-chat" aria-label="Messages" style={headerActionStyle}><FaFacebookMessenger /></Link>
          <Link to="/settings" aria-label="Settings" style={{ ...headerActionStyle, color: '#007AFB', borderColor: '#bfdbfe', background: '#eff6ff' }}><FaCog /></Link>
          <AvatarBadge src={admin.profileImage} name={admin.name || 'HR Office'} size={40} fontSize={14} />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: 'flex', gap: 14, padding: '18px 14px 18px', height: '100vh', overflow: 'hidden', background: 'var(--page-bg)', width: '100%', boxSizing: 'border-box', alignItems: 'flex-start' }}>
        <div className="admin-sidebar-spacer" style={{ width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)', flex: '0 0 var(--sidebar-width)', pointerEvents: 'none' }} />

        <main className="google-main" style={{ flex: '1 1 0', minWidth: 0, maxWidth: 'none', margin: 0, boxSizing: 'border-box', alignSelf: 'flex-start', height: 'calc(100vh - var(--topbar-height) - 36px)', maxHeight: 'calc(100vh - var(--topbar-height) - 36px)', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', position: 'relative', padding: '0 12px 12px 2px', display: 'flex', justifyContent: 'center', width: '100%' }}>
          <div style={{ width: '100%', maxWidth: 1160, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section style={{ background: 'linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)', border: '1px solid var(--border-soft)', borderRadius: 22, padding: '22px 24px', boxShadow: '0 20px 46px rgba(15, 23, 42, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 760 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', minHeight: 30, padding: '0 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface-accent)', color: 'var(--accent)', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Account Settings</span>
                <h3 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.03em' }}>HR Profile & Security</h3>
                <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)' }}>Update your account identity, replace your profile image, and set a stronger password with validation before any save is allowed.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 12, minWidth: 'min(100%, 420px)' }}>
                <div className="settings-theme-chip">
                  {isDark ? <FaMoon /> : <FaSun />}
                  <span>{theme === 'dark' ? 'Dark mode on' : 'Light mode on'}</span>
                </div>
              </div>
            </section>

            {message ? (
              <div style={{ padding: '12px 14px', borderRadius: 14, fontSize: 13, fontWeight: 700, ...alertStyles[messageType] }}>
                {message}
              </div>
            ) : null}

            <section style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
              <div className="settings-panel" style={{ padding: 22 }}>
                <div style={{ width: 180, height: 180, borderRadius: 28, overflow: 'hidden', margin: '0 auto', background: 'var(--surface-muted)', boxShadow: '0 18px 34px rgba(15, 23, 42, 0.08)', border: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AvatarBadge
                    src={resolvedPreviewImage}
                    name={displayName || admin?.name || 'HR Officer'}
                    size={180}
                    fontSize={52}
                    radius="28px"
                  />
                </div>

                <div style={{ marginTop: 18, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{displayName || admin?.name || 'HR Officer'}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>Profile image used across the HR portal.</div>
                </div>

                <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="settings-soft-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 76, padding: '16px 18px', borderRadius: 18 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Update profile photo</span>
                      <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)' }}>Use a clear square photo for better display across employee-facing views. Images are compressed to JPEG before upload.</span>
                    </div>
                    <label htmlFor="hr-settings-image" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 146, minHeight: 42, padding: '0 16px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface-accent)', color: 'var(--accent)', fontSize: 13, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
                      {isOptimizingImage ? 'Optimizing...' : typeof profileImage === 'string' ? 'Choose image' : 'Change image'}
                    </label>
                    <input id="hr-settings-image" type="file" accept="image/*" onChange={handleFileChange} className="settings-hidden-file" />
                  </div>
                  {profileImageMeta ? (
                    <div style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid var(--border-soft)', background: 'var(--surface-muted)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}>
                      Optimized from {formatFileSize(profileImageMeta.originalSize)} to {formatFileSize(profileImageMeta.finalSize)}{profileImageMeta.wasConvertedToJpeg ? ' as JPEG' : ''}.
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="settings-panel" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <div className="settings-icon-badge">
                      <FaCog />
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Profile Details</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Edit the main identity fields stored for the HR account.</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>Display name</label>
                      <input className="settings-input readonly" value={displayName} readOnly aria-readonly="true" />
                      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Display name is managed by the system and cannot be changed here.</div>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>Username</label>
                      <input className="settings-input readonly" value={username} readOnly aria-readonly="true" />
                      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Username is locked for HR accounts and cannot be edited here.</div>
                    </div>
                  </div>
                </div>

                <div className="settings-panel" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <div className="settings-icon-badge">
                      {isDark ? <FaMoon /> : <FaSun />}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Appearance</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Switch between light and dark mode for the full HR portal. Changes apply instantly.</div>
                    </div>
                  </div>

                  <div className="settings-theme-toggle">
                    <button type="button" className={`settings-theme-option ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>
                      <span className="settings-theme-option-icon"><FaSun /></span>
                      <span>
                        <span className="settings-theme-option-title">Light mode</span>
                        <span className="settings-theme-option-copy">Bright surfaces for daytime work and print-friendly review.</span>
                      </span>
                    </button>
                    <button type="button" className={`settings-theme-option ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>
                      <span className="settings-theme-option-icon"><FaMoon /></span>
                      <span>
                        <span className="settings-theme-option-title">Dark mode</span>
                        <span className="settings-theme-option-copy">Lower-glare screens with the existing shared dark palette.</span>
                      </span>
                    </button>
                  </div>
                </div>

                <div className="settings-panel" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <div className="settings-icon-badge">
                      <FaUserLock />
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Password Security</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>A password update is optional, but if you change it you must provide the current password first.</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>Current password</label>
                      <input type="password" className="settings-input" placeholder="Enter your current password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setFieldErrors((previous) => ({ ...previous, currentPassword: '' })) }} />
                      {fieldErrors.currentPassword ? <div className="settings-field-error">{fieldErrors.currentPassword}</div> : null}
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>New password</label>
                      <input type="password" className="settings-input" placeholder="Enter a strong password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((previous) => ({ ...previous, password: '', confirmPassword: previous.confirmPassword })) }} />
                      {fieldErrors.password ? <div className="settings-field-error">{fieldErrors.password}</div> : null}
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>Confirm password</label>
                      <input type="password" className="settings-input" placeholder="Repeat the new password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setFieldErrors((previous) => ({ ...previous, confirmPassword: '' })) }} />
                      {fieldErrors.confirmPassword ? <div className="settings-field-error">{fieldErrors.confirmPassword}</div> : null}
                    </div>
                  </div>

                  <div style={{ marginTop: 18, padding: 16, borderRadius: 16, border: '1px solid var(--border-soft)', background: 'var(--surface-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)' }}>
                      <FaShieldAlt style={{ color: 'var(--accent)' }} /> Password rules
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {passwordChecks.map((rule) => (
                        <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '0 12px', borderRadius: 12, border: `1px solid ${rule.ok ? 'var(--border-strong)' : 'var(--border-soft)'}`, background: rule.ok ? 'var(--accent-soft)' : 'var(--surface-panel)', color: rule.ok ? 'var(--accent)' : 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>
                          <FaCheckCircle style={{ opacity: rule.ok ? 1 : 0.35 }} />
                          <span>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={resetFormToStoredAdmin} type="button" style={{ minWidth: 132, height: 46, borderRadius: 14, padding: '0 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer', border: '1px solid var(--border-soft)', background: 'var(--surface-panel)', color: 'var(--text-secondary)', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)' }}>
                    Cancel
                  </button>
                  <button onClick={handleSave} type="button" disabled={isSaving || isOptimizingImage} style={{ minWidth: 154, height: 46, borderRadius: 14, padding: '0 18px', fontSize: 14, fontWeight: 800, cursor: isSaving || isOptimizingImage ? 'not-allowed' : 'pointer', border: 'none', color: '#ffffff', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)', boxShadow: 'var(--shadow-glow)', opacity: isSaving || isOptimizingImage ? 0.7 : 1 }}>
                    {isOptimizingImage ? 'Optimizing...' : isSaving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
