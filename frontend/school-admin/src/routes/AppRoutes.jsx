import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "../pages/Login";
import Register from "../pages/Register";
import Dashboard from "../pages/Dashboard";
import MyPosts from "../pages/MyPosts";
import Teachers from "../pages/Teachers";
import Students from "../pages/Students";
import Parents from "../pages/Parents";
import SettingsPage from "../pages/SettingsPage";
import AllChat from "../pages/AllChat";
import StudentChatPage from "../pages/StudentChatPage";
import SchedulePage from "../pages/SchedulePage"; // ✅ NEW

export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Admin Pages */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/my-posts" element={<MyPosts />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="/students" element={<Students />} />
        <Route path="/parents" element={<Parents />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Schedule */}
        <Route path="/schedule" element={<SchedulePage />} /> {/* ✅ */}

        {/* Chat */}
        <Route path="/all-chat" element={<AllChat />} />
        <Route path="/student-chat" element={<StudentChatPage />} />
      </Routes>
    </Router>
  );
}
