import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import RegisterShell from "../components/RegisterShell";
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

function ProtectedRoute() {
  const registrarRaw = localStorage.getItem("registrar");
  if (!registrarRaw) return <Navigate to="/login" replace />;

  try {
    const session = JSON.parse(registrarRaw) || {};
    if (!session.registrarId || !session.schoolCode) return <Navigate to="/login" replace />;
    return <Outlet />;
  } catch {
    return <Navigate to="/login" replace />;
  }
}

export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<RegisterShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/academic-years" element={<AcademicYearManagement />} />
            <Route path="/grede-management" element={<GredeManagement />} />
            <Route path="/promotion-system" element={<PromotionSystem />} />
            <Route path="/transfer-withdrawal" element={<TransferWithdrawal />} />
            <Route path="/document-generation" element={<DocumentGeneration />} />
            <Route path="/my-posts" element={<MyPosts />} />
            <Route path="/students" element={<Students />} />
            <Route path="/parents" element={<Parents />} />
            <Route path="/analytics" element={<Analatics />} />
            <Route path="/analatics" element={<Analatics />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/parent-register" element={<ParentRegister />} />
            <Route path="/student-register" element={<StudentRegister />} />
            <Route path="/teacher-register" element={<TeacherRegister />} />
          </Route>

          <Route path="/all-chat" element={<AllChat />} />
          <Route path="/student-chat" element={<StudentChatPage />} />
        </Route>

        <Route path="/register" element={<Register />} />
        <Route path="/registerer-register" element={<RegistererRegister />} />
      </Routes>
    </Router>
  );
}
