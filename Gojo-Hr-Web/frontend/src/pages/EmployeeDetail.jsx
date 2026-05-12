import React, { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FaBell, FaCog, FaFacebookMessenger } from 'react-icons/fa'
import EmployeeDetailPanel from '../components/EmployeeDetailPanel'

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [admin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('admin')) || {}
    } catch (e) {
      return {}
    }
  })

  return (
    <div className="dashboard-page" style={{ minHeight: '100vh', background: '#ffffff' }}>
      <nav className="top-navbar" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '0 18px 0 20px', borderBottom: '1px solid #d7e7fb', background: '#ffffff', zIndex: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>Gojo HR</h2>
        </div>

        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" title="Notifications" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 999, border: '1px solid #d7e7fb', background: '#ffffff', color: '#334155', cursor: 'pointer' }}><FaBell /></button>
          <button type="button" title="Messages" onClick={() => navigate('/all-chat')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 999, border: '1px solid #d7e7fb', background: '#ffffff', color: '#334155', cursor: 'pointer' }}><FaFacebookMessenger /></button>
          <Link to="/settings" aria-label="Settings" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 999, border: '1px solid #d7e7fb', background: '#ffffff', color: '#334155', cursor: 'pointer', textDecoration: 'none' }}><FaCog /></Link>
          <img src={admin.profileImage || '/default-profile.png'} alt="admin" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1px solid #d7e7fb' }} />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: 'flex', gap: 14, padding: '82px 14px 18px', minHeight: '100vh', background: '#ffffff', width: '100%', boxSizing: 'border-box', alignItems: 'flex-start' }}>
        <div style={{ width: 'clamp(230px, 16vw, 290px)', minWidth: 'clamp(230px, 16vw, 290px)', flex: '0 0 clamp(230px, 16vw, 290px)', pointerEvents: 'none' }} />

        <main className="google-main" style={{ flex: '1 1 0', minWidth: 0, margin: 0, boxSizing: 'border-box', padding: '0 12px 0 2px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 1260 }}>
            <EmployeeDetailPanel employeeId={id} admin={admin} onClose={() => navigate('/employees')} />
          </div>
        </main>
      </div>
    </div>
  )
}
