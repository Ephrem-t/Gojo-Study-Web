import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from '../pages/Dashboard'
import Register from '../pages/Register'
import Employees from '../pages/Employees'
import EmployeeDetail from '../pages/EmployeeDetail'
import EmployeesAttendance from '../pages/EmployeesAttendance'
import TerminatedEmployees from '../pages/Terminated_Employees'
import Login from '../pages/Login'
import HRSettings from '../pages/HRSettings'
import AllChat from '../pages/AllChat'

function getStoredAdmin() {
  try {
    const raw = localStorage.getItem('admin')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function RequireAuth({ children }) {
  const admin = getStoredAdmin()
  return admin ? children : <Navigate to="/login" replace />
}

function RootRedirect() {
  return <Navigate to="/login" replace />
}

export default function AppRoutes() {
  return (
    <>
     
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/register" element={<RequireAuth><Register /></RequireAuth>} />
        <Route path="/employees" element={<RequireAuth><Employees /></RequireAuth>} />
        <Route path="/employees/attendance" element={<RequireAuth><EmployeesAttendance /></RequireAuth>} />
        <Route path="/employees/terminated" element={<RequireAuth><TerminatedEmployees /></RequireAuth>} />
        <Route path="/employees/:id" element={<RequireAuth><EmployeeDetail /></RequireAuth>} />
        <Route path="/all-chat" element={<RequireAuth><AllChat /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><HRSettings /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
