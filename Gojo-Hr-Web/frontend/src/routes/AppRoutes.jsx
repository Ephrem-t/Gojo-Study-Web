import React, { useEffect, useState } from 'react'
import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Dashboard from '../pages/Dashboard'
import Register from '../pages/Register'
import Employees from '../pages/Employees'
import EmployeeDetail from '../pages/EmployeeDetail'
import EmployeesAttendance from '../pages/EmployeesAttendance'
import TerminatedEmployees from '../pages/Terminated_Employees'
import Login from '../pages/Login'
import HRSettings from '../pages/HRSettings'
import AllChat from '../pages/AllChat'

function readStoredAdmin() {
  try {
    return JSON.parse(localStorage.getItem('admin') || '{}')
  } catch {
    return {}
  }
}

function PersistentSidebarShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [admin, setAdmin] = useState(() => readStoredAdmin())

  useEffect(() => {
    setAdmin(readStoredAdmin())
  }, [location.pathname])

  useEffect(() => {
    const syncAdmin = () => {
      setAdmin(readStoredAdmin())
    }

    window.addEventListener('storage', syncAdmin)
    window.addEventListener('hr-admin-updated', syncAdmin)

    return () => {
      window.removeEventListener('storage', syncAdmin)
      window.removeEventListener('hr-admin-updated', syncAdmin)
    }
  }, [])

  if (location.pathname === '/login') {
    return null
  }

  return (
    <Sidebar
      admin={admin}
      style={{
        position: 'fixed',
        top: 'calc(var(--topbar-height) + 18px)',
        left: 14,
        width: 'var(--sidebar-width)',
        minWidth: 'var(--sidebar-width)',
        maxWidth: 'var(--sidebar-width)',
        height: 'calc(100vh - var(--topbar-height) - 36px)',
        maxHeight: 'calc(100vh - var(--topbar-height) - 36px)',
        marginLeft: 0,
        marginRight: 0,
        marginTop: 0,
        zIndex: 30,
      }}
      fullHeight
      top={4}
      onLogout={() => {
        localStorage.removeItem('admin')
        window.dispatchEvent(new Event('hr-admin-updated'))
        navigate('/login', { replace: true })
      }}
    />
  )
}

function RootRedirect() {
  const admin = readStoredAdmin()
  const hasSession = Boolean(admin && typeof admin === 'object' && Object.keys(admin).length)
  return <Navigate to={hasSession ? '/dashboard' : '/login'} replace />
}

export default function AppRoutes() {
  const location = useLocation()
  const isLoginRoute = location.pathname === '/login'

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--page-bg)',
        color: 'var(--text-primary)',
        '--sidebar-width': 'clamp(230px, 16vw, 290px)',
        '--topbar-height': '64px',
      }}
    >
      {!isLoginRoute ? <PersistentSidebarShell /> : null}
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/register" element={<Register />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/employees/attendance" element={<EmployeesAttendance />} />
        <Route path="/employees/terminated" element={<TerminatedEmployees />} />
        <Route path="/employees/:id" element={<EmployeeDetail />} />
        <Route path="/all-chat" element={<AllChat />} />
        <Route path="/settings" element={<HRSettings />} />
      </Routes>
    </div>
  )
}
