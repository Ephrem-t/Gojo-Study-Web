import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Dashboard from '../pages/Dashboard'
import Register from '../pages/Register'
import Employees from '../pages/Employees'
import Login from '../pages/Login'

export default function AppRoutes() {
  return (
    <>
     
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/employees" element={<Employees />} />
      </Routes>
    </>
  )
}
