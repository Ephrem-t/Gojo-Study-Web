import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "../components/Login";

const Register = lazy(() => import("../components/Register"));
const Dashboard = lazy(() => import("../components/Dashboard"));
const Students = lazy(() => import("../components/Students"));
const Marks = lazy(() => import("../components/MarksPage"));
const Attendance = lazy(() => import("../components/AttendancePage"));
const AdminPage = lazy(() => import("../components/AdminPage"));
const Parents = lazy(() => import("../components/Parents"));
const SettingsPage = lazy(() => import("../components/SettingsPage"));
const Timetable = lazy(() => import("../components/Schedule"));
const LessonPlan = lazy(() => import("../components/LessonPlan"));
const TeacherExam = lazy(() => import("../components/TeacherExam"));
const StudentFeedbackPage = lazy(() => import("../components/StudentFeedbackPage"));
const TeacherAppLayout = lazy(() => import("../components/TeacherAppLayout"));
const AllChat = lazy(() => import("../components/AllChat"));

function RouteLoadingFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #f7fbff 0%, #ffffff 100%)",
        color: "#10233f",
        fontFamily: '"Manrope", "Segoe UI", Tahoma, sans-serif',
        fontSize: "1rem",
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}
    >
      Loading teacher workspace...
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Router>
      <Suspense fallback={<RouteLoadingFallback />}>
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
      </Suspense>
    </Router>
  );
}
