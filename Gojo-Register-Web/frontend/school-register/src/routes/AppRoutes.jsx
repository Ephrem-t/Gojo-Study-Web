import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Login";

import Dashboard from "../pages/Dashboard";
import Overview from "../pages/Overview";
import AcademicYearManagement from "../pages/AcademicYearManagement";
import GredeManagement from "../pages/GredeManagement";
import PromotionSystem from "../pages/PromotionSystem";
import TransferWithdrawal from "../pages/TransferWithdrawal";
import DocumentGeneration from "../pages/DocumentGeneration";
import MyPosts from "../pages/MyPosts";
import Students from "../pages/Students";
import Parents from "../pages/Parents";
import Analatics from "../pages/Analatics";
import SettingsPage from "../pages/SettingsPage";
import AllChat from "../pages/AllChat";
import StudentChatPage from "../pages/StudentChatPage";
import ParentRegister from "../pages/ParentRegister";
import StudentRegister from "../pages/StudentRegister";
import TeacherRegister from "../pages/TeacherRegister";
import RegistererRegister from "../pages/RegistererRegister";
import Register from "../pages/Register";

function ProtectedRoute({ element }) {
  const registrarRaw = localStorage.getItem("registrar");
  if (!registrarRaw) return <Navigate to="/login" replace />;
  try {
    const session = JSON.parse(registrarRaw) || {};
    if (!session.registrarId || !session.schoolCode) return <Navigate to="/login" replace />;
    return element;
  } catch {
    return <Navigate to="/login" replace />;
  }
}

export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        

        {/* Admin Pages */}
        <Route path="/dashboard" element={<ProtectedRoute element={<Dashboard />} />} />
        <Route path="/overview" element={<ProtectedRoute element={<Overview />} />} />
        <Route path="/academic-years" element={<ProtectedRoute element={<AcademicYearManagement />} />} />
        <Route path="/grede-management" element={<ProtectedRoute element={<GredeManagement />} />} />
        <Route path="/promotion-system" element={<ProtectedRoute element={<PromotionSystem />} />} />
        <Route path="/transfer-withdrawal" element={<ProtectedRoute element={<TransferWithdrawal />} />} />
        <Route path="/document-generation" element={<ProtectedRoute element={<DocumentGeneration />} />} />
        <Route path="/my-posts" element={<ProtectedRoute element={<MyPosts />} />} />
        <Route path="/students" element={<ProtectedRoute element={<Students />} />} />
        <Route path="/parents" element={<ProtectedRoute element={<Parents />} />} />
        <Route path="/analytics" element={<ProtectedRoute element={<Analatics />} />} />
        <Route path="/analatics" element={<ProtectedRoute element={<Analatics />} />} />
        <Route path="/settings" element={<ProtectedRoute element={<SettingsPage />} />} />

        {/* Chat */}
        <Route path="/all-chat" element={<ProtectedRoute element={<AllChat />} />} />
        <Route path="/student-chat" element={<ProtectedRoute element={<StudentChatPage />} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/registerer-register" element={<RegistererRegister />} />
        <Route path="/parent-register" element={<ProtectedRoute element={<ParentRegister />} />} />
        <Route path="/student-register" element={<ProtectedRoute element={<StudentRegister />} />} />
        <Route path="/teacher-register" element={<ProtectedRoute element={<TeacherRegister />} />} />
      </Routes>
    </Router>
  );
}
