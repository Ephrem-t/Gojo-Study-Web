import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Dashboard from "../pages/Dashboard";
import MyPosts from "../pages/MyPosts";
import Teachers from "../pages/Teachers";
import Students from "../pages/Students";
import SettingsPage from "../pages/SettingsPage";
import TeacherChatPage from "../pages/TeacherChatPage";
import StudentChatPage from "../pages/StudentChatPage";


export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/my-posts" element={<MyPosts />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="/students" element={<Students />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/teacher-chat" element={<TeacherChatPage />} />
        <Route path="/student-chat" element={<StudentChatPage />} />

      </Routes>
    </Router>
  );
}


