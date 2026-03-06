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
  const activeStyle = {
    background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
    color: "#fff",
    boxShadow: "0 8px 18px rgba(29,78,216,0.25)",
    border: "1px solid #1d4ed8",
  };

  return (
    <>
      {typeof window !== "undefined" && window.innerWidth <= 600 && !sidebarOpen && (
        <button
          className="sidebar-arrow-btn"
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
        />
      )}

      <div
        className={`google-sidebar${isMobile && sidebarOpen ? " open" : ""}`}
      >
        <style>{`
          .sidebar-arrow-btn {
            position: fixed;
            left: 0;
            top: var(--topbar-height);
            z-index: 1300;
            background: #ffffff;
            border: none;
            border-radius: 0 10px 10px 0;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
            padding: 10px 8px;
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          .sidebar-overlay {
            display: none;
          }
          @media (max-width: 600px) {
            .google-sidebar {
              top: var(--topbar-height) !important;
              left: -220px !important;
              width: 220px !important;
              min-width: 220px !important;
              height: calc(100vh - var(--topbar-height)) !important;
              transition: left 0.25s cubic-bezier(.4,0,.2,1);
              border-radius: 0 !important;
              padding-top: 10px !important;
              z-index: 1202 !important;
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
            >
              <img
                src={teacher.profileImage || "/default-profile.png"}
                alt="profile"
              />
            </div>
            <h3 style={{ margin: 0, fontWeight: 700 }}>
              {teacher.name}
            </h3>
            <p style={{ margin: 0 }}>
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
