import React from "react";
import { Link } from "react-router-dom";
import {
  FaHome,
  FaUsers,
  FaChalkboardTeacher,
  FaClipboardCheck,
  FaUserCheck,
  FaCalendarAlt,
  FaBookOpen,
  FaSignOutAlt,
  FaChevronRight,
} from "react-icons/fa";
export default function Sidebar({ 
  active,
  sidebarOpen,
  setSidebarOpen,
  teacher,
  handleLogout,
}) {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 600;
  const activeStyle = { backgroundColor: "#4b6cb7", color: "#fff" };

  return (
    <>
      {typeof window !== "undefined" && window.innerWidth <= 600 && !sidebarOpen && (
        <button
          className="sidebar-arrow-btn"
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            zIndex: 1300,
            background: "#fff",
            border: "none",
            borderRadius: "0 8px 8px 0",
            boxShadow: "2px 0 8px rgba(0,0,0,0.12)",
            padding: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar menu"
        >
          <FaChevronRight size={22} />
        </button>
      )}

      {typeof window !== "undefined" && window.innerWidth <= 600 && sidebarOpen && (
        <div
          className="sidebar-overlay visible"
          onClick={() => setSidebarOpen(false)}
          style={{
            display: "block",
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 1200,
          }}
        />
      )}

      <div
        className={`google-sidebar${isMobile && sidebarOpen ? " open" : ""}`}
        style={
          isMobile
            ? {
                position: "fixed",
                top: 64,
                left: sidebarOpen ? 0 : "-220px",
                width: 220,
                height: "calc(100vh - 64px)",
                background: "#fff",
                boxShadow: "2px 0 8px rgba(0,0,0,0.12)",
                zIndex: 1200,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingTop: 10,
                overflowY: "auto",
                borderRadius: 0,
                transition: "left 0.25s cubic-bezier(.4,0,.2,1)",
              }
            : {
                position: "fixed",
                top: 64,
                left: 0,
                width: 220,
                height: "calc(100vh - 64px)",
                background: "#fff",
                boxShadow: "2px 0 8px rgba(0,0,0,0.04)",
                zIndex: 900,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingTop: 10,
                overflowY: "auto",
                borderRadius: 0,
              }
        }
      >
        <style>{`
          @media (max-width: 600px) {
            .google-sidebar {
              left: -220px !important;
              width: 220px !important;
              min-width: 220px !important;
              transition: left 0.25s cubic-bezier(.4,0,.2,1);
              border-radius: 0 !important;
            }
            .google-sidebar.open {
              left: 0 !important;
              z-index: 1202;
              border-radius: 0 !important;
            }
            .sidebar-overlay {
              display: block;
              position: fixed;
              inset: 0;
              background: rgba(0,0,0,0.35);
              z-index: 1200;
              transition: opacity 0.2s;
            }
            .sidebar-arrow-btn {
              display: flex !important;
            }
          }
        `}</style>

        {teacher && (
          <div className="sidebar-profile">
            <div
              className="sidebar-img-circle"
              style={{ width: 48, height: 48, borderWidth: 2, marginBottom: 6 }}
            >
              <img
                src={teacher.profileImage || "/default-profile.png"}
                alt="profile"
              />
            </div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
              {teacher.name}
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              {teacher.username}
            </p>
          </div>
        )}

        <div className="sidebar-menu">
          <Link
            className="sidebar-btn"
            to="/dashboard"
            style={active === "dashboard" ? activeStyle : undefined}
          >
            <FaHome /> Home
          </Link>
          <Link
            className="sidebar-btn"
            to="/students"
            style={active === "students" ? activeStyle : undefined}
          >
            <FaUsers /> Students
          </Link>
          <Link
            className="sidebar-btn"
            to="/admins"
            style={active === "admins" ? activeStyle : undefined}
          >
            <FaUsers /> Admins
          </Link>
          <Link
            className="sidebar-btn"
            to="/parents"
            style={active === "parents" ? activeStyle : undefined}
          >
            <FaChalkboardTeacher /> Parents
          </Link>
          <Link
            className="sidebar-btn"
            to="/marks"
            style={active === "marks" ? activeStyle : undefined}
          >
            <FaClipboardCheck /> Marks
          </Link>
          <Link
            className="sidebar-btn"
            to="/attendance"
            style={active === "attendance" ? activeStyle : undefined}
          >
            <FaUserCheck /> Attendance
          </Link>
          <Link
            className="sidebar-btn"
            to="/schedule"
            style={active === "schedule" ? activeStyle : undefined}
          >
            <FaCalendarAlt /> Schedule
          </Link>
          <Link
            className="sidebar-btn"
            to="/lesson-plan"
            style={active === "lesson-plan" ? activeStyle : undefined}
          >
            <FaBookOpen /> Lesson Plan
          </Link>

          <button className="sidebar-btn logout-btn" onClick={handleLogout}>
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </div>
    </>
  );
}
