import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaBell, FaCheckCircle, FaCog, FaFacebookMessenger, FaShieldAlt, FaUserLock } from 'react-icons/fa'
import api from '../api'
import './Dashboard.css'
import '../styles/global.css'

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
    setDisplayName(admin?.displayName || admin?.name || '')
    setUsername(admin?.username || admin?.userName || admin?.hrId || '')
    setProfileImage(admin?.profileImage || admin?.photoURL || '')
    setPreview(admin?.profileImage || admin?.photoURL || '')
  }, [admin])

  const passwordChecks = useMemo(() => {
    const value = String(password || '')
    return [
      { label: 'At least 8 characters', ok: value.length >= 8 },
      { label: 'Contains uppercase letter', ok: /[A-Z]/.test(value) },
      { label: 'Contains lowercase letter', ok: /[a-z]/.test(value) },
      { label: 'Contains a number', ok: /\d/.test(value) },
    ]
  }, [password])

  const resolvedPreviewImage = useMemo(() => sanitizeProfileImage(preview), [preview])

  function resetFormToStoredAdmin() {
    setPreview(admin?.profileImage || admin?.photoURL || '')
    setProfileImage(admin?.profileImage || admin?.photoURL || '')
    setCurrentPassword('')
    setPassword('')
    setConfirmPassword('')
    setProfileImageMeta(null)
    setFieldErrors({})
    setMessage('')
  }

  async function handleFileChange(event) {
    const file = event.target.files && event.target.files[0]
    if (!file) return

    setIsOptimizingImage(true)
    setMessage('')

    try {
      const optimizedResult = await compressImageToJpeg(file)
      const optimizedFile = optimizedResult.file
      const reader = new FileReader()

      reader.onload = () => {
        setPreview(String(reader.result || ''))
      }
      reader.readAsDataURL(optimizedFile)

      setProfileImage(optimizedFile)
      setProfileImageMeta(optimizedResult)
    } catch (error) {
      console.error('HRSettings image optimization error:', error)
      setMessageType('error')
      setMessage(error?.message || 'Unable to process the selected profile image.')
    } finally {
      setIsOptimizingImage(false)
      event.target.value = ''
    }
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
    success: { border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8' },
    error: { border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c' },
    warning: { border: '1px solid #fed7aa', background: '#fff7ed', color: '#b45309' },
    info: { border: '1px solid #e6ecf8', background: '#f8fafc', color: '#111827' },
  }

  return (
    <div
      className="dashboard-page"
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
      <style>{`
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
          border: 1px solid #dbe4ef;
          background: #fbfdff;
          color: #0f172a;
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
          color: #b91c1c;
        }

        .settings-input.readonly {
          background: #f8fafc;
          color: #64748b;
          border-color: #e2e8f0;
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

      <div className="google-dashboard" style={{ display: 'flex', gap: 14, padding: 'calc(var(--topbar-height) + 18px) 14px 18px', minHeight: '100vh', background: '#ffffff', width: '100%', boxSizing: 'border-box', alignItems: 'flex-start' }}>
        <div className="admin-sidebar-spacer" style={{ width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)', flex: '0 0 var(--sidebar-width)', pointerEvents: 'none' }} />

        <main style={{ flex: '1 1 0', minWidth: 0, margin: 0, padding: '0 12px 0 2px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 1160, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)', border: '1px solid #e7ecf3', borderRadius: 22, padding: '22px 24px', boxShadow: '0 20px 46px rgba(15, 23, 42, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 760 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', minHeight: 30, padding: '0 12px', borderRadius: 999, border: '1px solid #d8e8ff', background: '#eef6ff', color: '#0f4fa8', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Account Settings</span>
                <h3 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.03em' }}>HR Profile & Security</h3>
                <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)' }}>Update your account identity, replace your profile image, and set a stronger password with validation before any save is allowed.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 12, minWidth: 'min(100%, 420px)' }}>
                {/* <div style={{ background: '#ffffff', border: '1px solid #e7ecf3', borderRadius: 18, padding: 16, boxShadow: '0 18px 44px rgba(15, 23, 42, 0.05)' }}>
                  <span style={{ display: 'block', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{displayName.trim() ? 'Ready' : 'Missing'}</span>
                  <span style={{ display: 'block', marginTop: 5, fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profile Name</span>
                </div> */}
                {/* <div style={{ background: '#ffffff', border: '1px solid #e7ecf3', borderRadius: 18, padding: 16, boxShadow: '0 18px 44px rgba(15, 23, 42, 0.05)' }}>
                  <span style={{ display: 'block', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{password ? `${passwordChecks.filter((item) => item.ok).length}/4` : '0/4'}</span>
                  <span style={{ display: 'block', marginTop: 5, fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password Rules</span>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e7ecf3', borderRadius: 18, padding: 16, boxShadow: '0 18px 44px rgba(15, 23, 42, 0.05)' }}>
                  <span style={{ display: 'block', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{profileImage ? 'Set' : 'Default'}</span>
                  <span style={{ display: 'block', marginTop: 5, fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profile Photo</span>
                </div> */}
              </div>
            </section>

            {message ? (
              <div style={{ padding: '12px 14px', borderRadius: 14, fontSize: 13, fontWeight: 700, ...alertStyles[messageType] }}>
                {message}
              </div>
            ) : null}

            <section style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
              <div style={{ background: '#ffffff', border: '1px solid #e7ecf3', borderRadius: 22, boxShadow: '0 20px 46px rgba(15, 23, 42, 0.05)', padding: 22 }}>
                <div style={{ width: 180, height: 180, borderRadius: 28, overflow: 'hidden', margin: '0 auto', background: '#f1f5f9', boxShadow: '0 18px 34px rgba(15, 23, 42, 0.08)', border: '1px solid #e7ecf3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AvatarBadge
                    src={resolvedPreviewImage}
                    name={displayName || admin?.name || 'HR Officer'}
                    size={180}
                    fontSize={52}
                    radius="28px"
                  />
                </div>

                <div style={{ marginTop: 18, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{displayName || admin?.name || 'HR Officer'}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#64748b' }}>Profile image used across the HR portal.</div>
                </div>

                <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 76, padding: '16px 18px', borderRadius: 18, border: '1px solid #d7e7fb', background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Update profile photo</span>
                      <span style={{ fontSize: 12, lineHeight: 1.5, color: '#64748b' }}>Use a clear square photo for better display across employee-facing views. Images are compressed to JPEG before upload.</span>
                    </div>
                    <label htmlFor="hr-settings-image" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 146, minHeight: 42, padding: '0 16px', borderRadius: 999, border: '1px solid #cfe0f7', background: '#eef6ff', color: '#1f4f96', fontSize: 13, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
                      {isOptimizingImage ? 'Optimizing...' : typeof profileImage === 'string' ? 'Choose image' : 'Change image'}
                    </label>
                    <input id="hr-settings-image" type="file" accept="image/*" onChange={handleFileChange} className="settings-hidden-file" />
                  </div>
                  {profileImageMeta ? (
                    <div style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid #d7e7fb', background: '#f8fbff', color: '#47637f', fontSize: 12, fontWeight: 700 }}>
                      Optimized from {formatFileSize(profileImageMeta.originalSize)} to {formatFileSize(profileImageMeta.finalSize)}{profileImageMeta.wasConvertedToJpeg ? ' as JPEG' : ''}.
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#ffffff', border: '1px solid #e7ecf3', borderRadius: 22, boxShadow: '0 20px 46px rgba(15, 23, 42, 0.05)', padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, border: '1px solid #dbeafe', background: '#eff6ff', color: '#007AFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FaCog />
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Profile Details</div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>Edit the main identity fields stored for the HR account.</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>Display name</label>
                      <input className="settings-input readonly" value={displayName} readOnly aria-readonly="true" />
                      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: '#64748b' }}>Display name is managed by the system and cannot be changed here.</div>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>Username</label>
                      <input className="settings-input readonly" value={username} readOnly aria-readonly="true" />
                      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: '#64748b' }}>Username is locked for HR accounts and cannot be edited here.</div>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e7ecf3', borderRadius: 22, boxShadow: '0 20px 46px rgba(15, 23, 42, 0.05)', padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, border: '1px solid #dbeafe', background: '#eff6ff', color: '#007AFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FaUserLock />
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Password Security</div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>A password update is optional, but if you change it you must provide the current password first.</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>Current password</label>
                      <input type="password" className="settings-input" placeholder="Enter your current password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setFieldErrors((previous) => ({ ...previous, currentPassword: '' })) }} />
                      {fieldErrors.currentPassword ? <div className="settings-field-error">{fieldErrors.currentPassword}</div> : null}
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>New password</label>
                      <input type="password" className="settings-input" placeholder="Enter a strong password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((previous) => ({ ...previous, password: '', confirmPassword: previous.confirmPassword })) }} />
                      {fieldErrors.password ? <div className="settings-field-error">{fieldErrors.password}</div> : null}
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>Confirm password</label>
                      <input type="password" className="settings-input" placeholder="Repeat the new password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setFieldErrors((previous) => ({ ...previous, confirmPassword: '' })) }} />
                      {fieldErrors.confirmPassword ? <div className="settings-field-error">{fieldErrors.confirmPassword}</div> : null}
                    </div>
                  </div>

                  <div style={{ marginTop: 18, padding: 16, borderRadius: 16, border: '1px solid #e7ecf3', background: '#fbfdff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, fontWeight: 800, color: '#334155' }}>
                      <FaShieldAlt style={{ color: '#007AFB' }} /> Password rules
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {passwordChecks.map((rule) => (
                        <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '0 12px', borderRadius: 12, border: `1px solid ${rule.ok ? '#bfdbfe' : '#e7ecf3'}`, background: rule.ok ? '#eff6ff' : '#ffffff', color: rule.ok ? '#1d4ed8' : '#64748b', fontSize: 12, fontWeight: 700 }}>
                          <FaCheckCircle style={{ opacity: rule.ok ? 1 : 0.35 }} />
                          <span>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={resetFormToStoredAdmin} type="button" style={{ minWidth: 132, height: 46, borderRadius: 14, padding: '0 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer', border: '1px solid #d7e7fb', background: '#ffffff', color: '#334155', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)' }}>
                    Cancel
                  </button>
                  <button onClick={handleSave} type="button" disabled={isSaving || isOptimizingImage} style={{ minWidth: 154, height: 46, borderRadius: 14, padding: '0 18px', fontSize: 14, fontWeight: 800, cursor: isSaving || isOptimizingImage ? 'not-allowed' : 'pointer', border: 'none', color: '#ffffff', background: 'linear-gradient(135deg, #007AFB 0%, #0b82ff 100%)', boxShadow: '0 0 0 2px rgba(0, 122, 251, 0.18)', opacity: isSaving || isOptimizingImage ? 0.7 : 1 }}>
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
