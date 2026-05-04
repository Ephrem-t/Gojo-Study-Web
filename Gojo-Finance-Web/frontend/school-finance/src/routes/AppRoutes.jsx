import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "../pages/Login";
import FinanceLayout from "../components/FinanceLayout";

import Dashboard from "../pages/Dashboard";
import MyPosts from "../pages/MyPosts";
import Students from "../pages/Students";
import Parents from "../pages/Parents";
import Analatics from "../pages/Analatics";
import SettingsPage from "../pages/SettingsPage";
import AllChat from "../pages/AllChat";
import StudentChatPage from "../pages/StudentChatPage";
// removed SchedulePage and RegistrationForm imports (pages deleted)
import ParentRegister from "../pages/ParentRegister"; // NEW
export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        <Route element={<FinanceLayout />}>
          {/* Finance Pages */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/my-posts" element={<MyPosts />} />
          <Route path="/students" element={<Students />} />
          <Route path="/parents" element={<Parents />} />
          <Route path="/analytics" element={<Analatics />} />
          <Route path="/analatics" element={<Analatics />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Chat */}
        <Route path="/all-chat" element={<AllChat />} />
        <Route path="/student-chat" element={<StudentChatPage />} />
        {/* registration-form removed (page deleted) */}
        <Route path="/parent-register" element={<ParentRegister />} /> {/* NEW */}
      </Routes>
    </Router>
  );
}
