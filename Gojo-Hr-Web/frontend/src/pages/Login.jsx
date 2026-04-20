import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { Link, useNavigate } from 'react-router-dom'
import '../styles/global.css'
import './Login.css'

const isHrRole = (value) => {
  const role = String(value || '').trim().toLowerCase().replace(/-/g, '_')
  return ['hr', 'human_resources', 'human_resource', 'humanresource'].includes(role)
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const registerLink = '/register'

  const canSubmit = useMemo(() => !loading, [loading])

  useEffect(() => {
    try {
      const storedAdmin = JSON.parse(localStorage.getItem('admin') || '{}')
      const hasSession = storedAdmin.hrId || storedAdmin.adminId || storedAdmin.id || storedAdmin.userId

      if (hasSession) {
        if (!storedAdmin.role || isHrRole(storedAdmin.role)) {
          navigate('/', { replace: true })
          return
        }

        localStorage.removeItem('admin')
      }
    } catch {
      localStorage.removeItem('admin')
    }
  }, [navigate])

  const validate = () => {
    const nextErrors = {}
    const usernameValue = username.trim()
    const passwordValue = String(password || '')

    if (!usernameValue) {
      nextErrors.username = 'Username is required.'
    }

    if (!passwordValue.trim()) {
      nextErrors.password = 'Password is required.'
    } else if (passwordValue.length < 4) {
      nextErrors.password = 'Password must be at least 4 characters.'
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function submit(e) {
    e.preventDefault()
    setError('')

    if (!validate()) return

    setLoading(true)

    try {
      const res = await api.post('/login', { username: username.trim(), password })
      if (res.data && res.data.ok && res.data.user) {
        const user = res.data.user || {}

        if (user.role && !isHrRole(user.role)) {
          localStorage.removeItem('admin')
          setError('Only HR users can login here')
          return
        }

        localStorage.setItem('admin', JSON.stringify(user))
        window.location.href = '/' // full reload to ensure app state
        return
      }
      setError(res.data?.error || 'Login failed')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="hr-login-page">
      <div className="hr-login-glow hr-login-glow-left" aria-hidden="true" />
      <div className="hr-login-glow hr-login-glow-right" aria-hidden="true" />

      <div className="hr-login-shell">
        <section className="hr-login-hero">
          <span className="hr-login-badge">Gojo HR Portal</span>
          <h1>Welcome, HR Officer</h1>
          <p>
            Sign in to manage employees, attendance, staffing records, terminations, reactivations, and internal HR operations from one place.
          </p>
          <ul className="hr-login-list">
            <li>Use your HR username and password</li>
            <li>Only authorized HR accounts can access this portal</li>
            <li>Need help? Contact the school admin or system supervisor</li>
          </ul>
        </section>

        <section className="hr-login-card-wrap">
          <div className="hr-login-card">
            <h2>HR Login</h2>
            <p className="hr-login-sub">Use your HR portal credentials to continue.</p>

            {error ? <p className="hr-login-alert">{error}</p> : null}

            <form onSubmit={submit} className="hr-login-form" noValidate>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="Enter your HR username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setFieldErrors((prev) => ({ ...prev, username: '' }))
                }}
                autoComplete="username"
                disabled={loading}
              />
              {fieldErrors.username ? <p className="hr-login-field-error">{fieldErrors.username}</p> : null}

              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setFieldErrors((prev) => ({ ...prev, password: '' }))
                }}
                autoComplete="current-password"
                disabled={loading}
              />
              {fieldErrors.password ? <p className="hr-login-field-error">{fieldErrors.password}</p> : null}

              <div className="hr-login-actions">
                <button type="submit" className="hr-login-button" disabled={!canSubmit}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>
                {/* <button
                  type="button"
                  className="hr-login-secondary"
                  onClick={() => {
                    setUsername('')
                    setPassword('')
                    setError('')
                    setFieldErrors({})
                  }}
                  disabled={loading}
                >
                  Clear
                </button> */}
              </div>
            </form>

            <p className="hr-login-footer">
              Don&apos;t have an account? <Link to={registerLink}>Register</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
