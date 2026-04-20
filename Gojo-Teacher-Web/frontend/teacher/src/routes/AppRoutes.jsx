import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "../components/Login";
import Register from "../components/Register";

import Dashboard from "../components/Dashboard";
import Students from "../components/Students";
import Marks from "../components/MarksPage";
import Attendance from "../components/AttendancePage";
import AdminPage from "../components/AdminPage";

import Parents from "../components/Parents";
import SettingsPage from "../components/SettingsPage";
import Timetable from "../components/Schedule";
import LessonPlan from "../components/LessonPlan";
import TeacherExam from "../components/TeacherExam";
import StudentFeedbackPage from "../components/StudentFeedbackPage";
import TeacherAppLayout from "../components/TeacherAppLayout";
// ✅ Chat Pages
import AllChat from "../components/AllChat";

export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
       

        {/* Teacher App (persistent topbar layout) */}
        <Route element={<TeacherAppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/students" element={<Students />} />
          <Route path="/admins" element={<AdminPage />} />
          <Route path="/marks" element={<Marks />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/parents" element={<Parents />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/all-chat" element={<AllChat />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/schedule" element={<Timetable />} />
          <Route path="/lesson-plan" element={<LessonPlan />} />
          <Route path="/student-feedback" element={<StudentFeedbackPage />} />
          <Route path="/exam" element={<TeacherExam />} />
        </Route>
        
      </Routes>
    </Router>
  );
}
