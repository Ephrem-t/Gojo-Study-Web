import React, { useState } from 'react'
import api from '../api'
import { useNavigate } from 'react-router-dom'
import '../styles/global.css'
import './Login.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const res = await api.post('/login', { username, password })
      if (res.data && res.data.ok && res.data.user) {
        localStorage.setItem('admin', JSON.stringify(res.data.user))
        window.location.href = '/' // full reload to ensure app state
        return
      }
      setError(res.data?.error || 'Login failed')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-right">
          <form className="login-form" onSubmit={submit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              <div className="brand">Gojo HR Panel</div>
              <div className="brand-sub">Manage employees, attendance & reports — securely.</div>
            </div>

            <h2>Welcome back</h2>
            <p className="leadin">Sign in to your HR panel to continue</p>
            {error && <div className="error">{error}</div>}

            <div className="input-group">
              <label>Username</label>
              <input className="text-input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="username" />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input className="text-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" />
            </div>

            <div className="helper">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input id="remember" type="checkbox" /> <label htmlFor="remember" style={{ fontSize: 13, color: '#6b7280' }}>Remember</label>
              </div>
              <a className="small-link" href="#">Forgot?</a>
            </div>

            <div className="actions">
              <button type="submit" className="btn-primary">Sign in</button>
              <button type="button" className="btn-ghost" onClick={()=>{ setUsername(''); setPassword(''); setError('') }}>Clear</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
