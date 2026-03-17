import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import AdminTopbarLayout from "../components/AdminTopbarLayout";

import Dashboard from "../pages/Dashboard";
import MyPosts from "../pages/MyPosts";
import OverviewPage from "../pages/Overview";
import Teachers from "../pages/Teachers";
import Students from "../pages/Students";
import Parents from "../pages/Parents";
import SettingsPage from "../pages/SettingsPage";
import SchedulePage from "../pages/SchedulePage";
import AssagninTeacher from "../pages/AssagninTeacher";
import AllChat from "../pages/AllChat";
import StudentChatPage from "../pages/StudentChatPage";
import TeacherRegister from "../pages/TeacherRegister"; // NEW
import StudentRegister from "../pages/StudentRegister"; // NEW
import ParentRegister from "../pages/ParentRegister"; // NEW
import Register from "../pages/Register"; // NEW
import AcademicYearPage from "../pages/AcademicYearPage";
import SubjectManagementPage from "../pages/SubjectManagement";
import ExamsPage from "../pages/ExamsPage";
import ResultsPage from "../pages/ResultsPage";
import ReportCardsPage from "../pages/ReportCardsPage";

const isAdminRole = (value) => {
  const role = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  return ["school_admins", "school_admin", "admin", "admins"].includes(role);
};

function RequireAdmin({ children }) {
  try {
    const storedAdmin = JSON.parse(localStorage.getItem("admin") || "{}");
    if ((storedAdmin.userId || storedAdmin.adminId) && isAdminRole(storedAdmin.role)) {
      return children;
    }
  } catch (error) {
    localStorage.removeItem("admin");
  }

  localStorage.removeItem("admin");
  return <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        {/* Auth */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        

        {/* Admin Pages */}
        <Route element={<RequireAdmin><AdminTopbarLayout /></RequireAdmin>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="my-posts" element={<MyPosts />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="teachers" element={<Teachers />} />
          <Route path="students" element={<Students />} />
          <Route path="parents" element={<Parents />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="assign-teacher" element={<AssagninTeacher />} />

          <Route path="academic-year" element={<AcademicYearPage />} />
          <Route path="subject-management" element={<SubjectManagementPage />} />
          <Route path="grade-and-section" element={<Navigate to="/subject-management" replace />} />
          <Route path="grades" element={<Navigate to="/subject-management" replace />} />
          <Route path="sections" element={<Navigate to="/subject-management" replace />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="report-cards" element={<ReportCardsPage />} />

          <Route path="settings" element={<SettingsPage />} />

          {/* Chat */}
          <Route path="all-chat" element={<AllChat />} />
          <Route path="student-chat" element={<StudentChatPage />} />
          {/* registration-form removed */}
          <Route path="teacher-register" element={<TeacherRegister />} /> {/* NEW */}
          <Route path="student-register" element={<StudentRegister />} /> {/* NEW */}
          <Route path="parent-register" element={<ParentRegister />} /> {/* NEW */}
        </Route>
        <Route path="/register" element={<Register />} /> {/* NEW */}
      </Routes>
    </Router>
  );
}
