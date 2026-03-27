import React, { useState } from 'react'
import api from '../api'
import { useNavigate } from 'react-router-dom'
import '../styles/global.css'
import './Login.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await api.post('/login', { username, password })
      if (res.data && res.data.ok && res.data.user) {
        localStorage.setItem('admin', JSON.stringify(res.data.user))
        navigate('/dashboard', { replace: true })
        return
      }
      setError(res.data?.error || 'Login failed')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-right">
          <form className="login-form" onSubmit={submit}>
            <div className="login-header">
              <div className="brand-mark">GH</div>
              <div className="login-header-copy">
                <div className="brand">Gojo HR Panel</div>
                <div className="brand-sub">Secure access to employee and attendance management.</div>
              </div>
            </div>

            <h2>Sign in</h2>
            <p className="leadin">Use your account credentials to continue to the dashboard.</p>
            {error && <div className="error">{error}</div>}

            <div className="input-group">
              <label htmlFor="username">Username</label>
              <input id="username" className="text-input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter your username" autoComplete="username" />
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input id="password" className="text-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" />
            </div>

            <div className="helper">
              <label className="remember-row" htmlFor="remember">
                <input id="remember" type="checkbox" />
                <span>Remember me</span>
              </label>
              <span className="helper-note">Protected login</span>
            </div>

            <div className="actions">
              <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Signing in...' : 'Sign in'}</button>
              <button type="button" className="btn-ghost" onClick={()=>{ setUsername(''); setPassword(''); setError('') }}>Clear</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
