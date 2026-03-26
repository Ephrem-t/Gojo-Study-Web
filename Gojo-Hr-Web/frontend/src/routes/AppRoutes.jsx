import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Dashboard from '../pages/Dashboard'
import Register from '../pages/Register'
import Employees from '../pages/Employees'
import EmployeeDetail from '../pages/EmployeeDetail'
import EmployeesAttendance from '../pages/EmployeesAttendance'
import TerminatedEmployees from '../pages/Terminated_Employees'
import Login from '../pages/Login'
import HRSettings from '../pages/HRSettings'

export default function AppRoutes() {
  return (
    <>
     
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/employees/attendance" element={<EmployeesAttendance />} />
        <Route path="/employees/terminated" element={<TerminatedEmployees />} />
        <Route path="/employees/:id" element={<EmployeeDetail />} />
        <Route path="/settings" element={<HRSettings />} />
      </Routes>
    </>
  )
}
