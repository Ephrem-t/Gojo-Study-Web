import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Dashboard from '../pages/Dashboard'
import Register from '../pages/Register'
import Employees from '../pages/Employees'

export default function AppRoutes() {
  return (
    <>
      <nav style={{ padding: 10 }}>
        <Link to="/">Dashboard</Link> | <Link to="/register">Register</Link> | <Link to="/employees">Employees</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/register" element={<Register />} />
        <Route path="/employees" element={<Employees />} />
      </Routes>
    </>
  )
}
