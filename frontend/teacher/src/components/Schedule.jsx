import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaCog,
  FaSignOutAlt,
  FaSearch,
  FaUsers,
  FaChalkboardTeacher,
  FaClipboardCheck,
  FaFacebookMessenger,
  FaBell,
} from "react-icons/fa";
import "../styles/global.css";

function Schedule() {
  const [teacher, setTeacher] = useState(null);
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");

  const navigate = useNavigate();
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const allSections = ["All", "A", "B", "C", "D"];

  // Load logged-in teacher
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  // Fetch full schedule
  useEffect(() => {
    if (!teacher) return;

    const fetchSchedule = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Schedules.json"
        );
        setSchedule(res.data || {});
        setError("");
      } catch (err) {
        console.error(err);
        setError("Failed to load schedule.");
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [teacher]);

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // Filter teacher schedule for the right sidebar
  const getTeacherSchedule = () => {
    if (!teacher || !schedule) return {};
    const filtered = {};

    Object.entries(schedule).forEach(([day, grades]) => {
      Object.entries(grades || {}).forEach(([grade, periods]) => {
        Object.entries(periods || {}).forEach(([periodName, info]) => {
          if (!info?.teacherName) return;
          if (info.teacherName === teacher.name) {
            if (!filtered[day]) filtered[day] = {};
            if (!filtered[day][periodName]) filtered[day][periodName] = [];

            filtered[day][periodName].push({
              class: grade,
              subject: info.subject || "-",
              time: info.time || periodName.match(/\((.*?)\)/)?.[1] || "N/A",
            });
          }
        });
      });
    });

    return filtered;
  };

  const teacherSchedule = getTeacherSchedule();

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      {/* Left Sidebar */}
      <div className="google-sidebar" style={{ width: "400px" }}>
        {teacher && (
          <div className="sidebar-profile">
            <div className="sidebar-img-circle">
              <img src={teacher.profileImage || "/default-profile.png"} alt="profile" />
            </div>
            <h3>{teacher.name}</h3>
            <p>{teacher.username}</p>
          </div>
        )}
        <div className="sidebar-menu">
          <Link className="sidebar-btn" to="/dashboard"><FaHome /> Home</Link>

          <Link className="sidebar-btn" to="/students"><FaUsers /> Students</Link>
          <Link className="sidebar-btn" to="/admins"><FaUsers /> Admins</Link>
          <Link className="sidebar-btn" to="/parents"><FaChalkboardTeacher /> Parents</Link>
          <Link className="sidebar-btn" to="/marks"><FaClipboardCheck /> Marks</Link>
          <Link className="sidebar-btn" to="/attendance"><FaUsers /> Attendance</Link>
          <Link
            className="sidebar-btn"
            to="/schedule"
            style={{ backgroundColor: "#4b6cb7", color: "#fff" }}
          >
            <FaUsers /> Schedule
          </Link>
          <Link className="sidebar-btn" to="/settings"><FaCog /> Settings</Link>
          <button className="sidebar-btn logout-btn" onClick={handleLogout}>
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          padding: "30px",
          background: "#f0f4f8",
          minHeight: "100vh",
          borderRadius: "12px",
          marginLeft: "420px",
          marginRight: "500px",
          marginTop: "60px",
          marginBottom: "20px",
        }}
      >
        <nav className="top-navbar">
          <h2>Gojo Dashboard</h2>
          <div className="nav-search">
            <FaSearch className="search-icon" />
            <input type="text" placeholder="Search Teacher and Student..." />
          </div>
          <div className="nav-right">
            <div className="icon-circle"><FaBell /></div>
            <div className="icon-circle"><FaFacebookMessenger /></div>
            <div className="icon-circle"><FaCog /></div>
            <img src={teacher?.profileImage || "/default-profile.png"} alt="profile" />
          </div>
        </nav>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            marginBottom: "25px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <label style={{ marginRight: "8px", fontWeight: "600" }}>Grade:</label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                cursor: "pointer",
              }}
            >
              <option value="All">All</option>
              <option value="9">9</option>
              <option value="10">10</option>
              <option value="12">12</option>
            </select>
          </div>
          <div>
            <label style={{ marginRight: "8px", fontWeight: "600" }}>Section:</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                cursor: "pointer",
              }}
            >
              <option value="All">All</option>
              {allSections.filter((s) => s !== "All").map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <h2 style={{ textAlign: "center", marginBottom: "30px", color: "#2563eb" }}>
          Full Schedule
        </h2>

        {loading && <p style={{ textAlign: "center" }}>Loading schedule...</p>}
        {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}

        {!loading &&
          daysOfWeek.map((day) => {
            const grades = schedule[day];
            if (!grades) return null;

            return (
              <div key={day} style={{ marginBottom: "40px" }}>
                <h3 style={{ color: "#1c03ffff", marginBottom: "15px" }}>{day}</h3>
                {Object.entries(grades)
                  .filter(([grade]) => selectedGrade === "All" || grade.includes(selectedGrade))
                  .map(([grade, periods]) => {
                    const sectionFromGrade = grade.slice(-1);
                    if (selectedSection !== "All" && sectionFromGrade !== selectedSection) return null;

                    return (
                      <div key={grade} style={{ marginBottom: "20px" }}>
                        <h4 style={{ color: "#4603fcff", marginBottom: "10px" }}>{grade}</h4>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            background: "#fff",
                            borderRadius: "12px",
                            overflow: "hidden",
                            boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
                          }}
                        >
                          <thead style={{ background: "#2563eb", color: "#fff" }}>
                            <tr>
                              <th style={{ padding: "12px", textAlign: "left" }}>Period</th>
                              <th style={{ padding: "12px", textAlign: "left" }}>Subject</th>
                              <th style={{ padding: "12px", textAlign: "left" }}>Time</th>
                              <th style={{ padding: "12px", textAlign: "left" }}>Teacher</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(periods).map(([periodName, info], idx) => {
                              const isMyClass = info?.teacherName === teacher?.name;
                              const time = info.time || periodName.match(/\((.*?)\)/)?.[1] || "N/A";

                              return (
                                <tr
                                  key={idx}
                                  style={{
                                    borderBottom: "1px solid #eee",
                                    backgroundColor: isMyClass ? "#dbeafe" : "#f3f4f6",
                                    color: isMyClass ? "#1e40af" : "#6b7280",
                                    fontWeight: isMyClass ? "700" : "400",
                                    borderLeft: isMyClass ? "4px solid #2563eb" : "none",
                                    opacity: isMyClass ? 1 : 0.7,
                                  }}
                                >
                                  <td style={{ padding: "12px" }}>{periodName}</td>
                                  <td style={{ padding: "12px" }}>{info.subject || "-"}</td>
                                  <td style={{ padding: "12px" }}>{time}</td>
                                  <td style={{ padding: "12px" }}>{info.teacherName || "-"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
              </div>
            );
          })}
      </div>

      {/* Right Sidebar - Teacher Schedule */}
     <div
  style={{
    position: "fixed",          // Fix the sidebar
    top: "60px",                // Distance from top
    right: "20px",              // Distance from right
    width: "450px",
    height: "calc(100vh - 40px)", // Full height minus padding
    background: "#fff",
    borderRadius: "1px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
    overflow: "hidden",         // Hide overflowing scroll outside the inner box
  }}
>
  {/* Header */}
  <div
    style={{
      background: "linear-gradient(90deg, #2563eb, #3b82f6)",
      color: "#fff",
      padding: "12px 20px",
      textAlign: "center",
      fontWeight: "600",
      fontSize: "1.2rem",
      boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
      borderTopLeftRadius: "1px",
      borderTopRightRadius: "1px",
    }}
  >
    My Schedule
  </div>

  {/* Scrollable content */}
  <div
    style={{
      padding: "20px",
      height: "calc(100% - 60px)", // Take full height minus header
      overflowY: "auto",           // Make scrollable
      background: "#f9fafb",
    }}
  >
    {loading ? (
      <p style={{ textAlign: "center", color: "#6b7280" }}>Loading schedule...</p>
    ) : Object.keys(teacherSchedule).length === 0 ? (
      <p style={{ textAlign: "center", color: "#6b7280" }}>No schedule found.</p>
    ) : (
      ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => {
        const periods = teacherSchedule[day];
        if (!periods) return null;

        const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
        const isToday = today === day;

        return (
          <div
            key={day}
            style={{
              marginBottom: "20px",
              padding: "10px",
              borderRadius: "12px",
              background: isToday ? "#e0f2fe" : "#fff",
              boxShadow: isToday
                ? "0 4px 12px rgba(59, 130, 246, 0.2)"
                : "0 2px 6px rgba(0,0,0,0.05)",
            }}
          >
            <h4
              style={{
                color: "#1e3a8a",
                marginBottom: "12px",
                fontWeight: "600",
                fontSize: "1.05rem",
                borderBottom: "1px solid #e5e7eb",
                paddingBottom: "5px",
              }}
            >
              {day}
            </h4>

            {Object.entries(periods).map(([periodName, entries]) => (
              <div
                key={periodName}
                style={{
                  marginBottom: "12px",
                  background: "#f3f4f6",
                  padding: "12px 15px",
                  borderRadius: "10px",
                  borderLeft: "5px solid #2563eb",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
                }}
              >
                <strong
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    color: "#1e3a8a",
                    fontSize: "0.98rem",
                  }}
                >
                  {periodName}
                </strong>
                <ul style={{ paddingLeft: "18px", margin: 0 }}>
                  {entries.map((entry, idx) => (
                    <li
                      key={idx}
                      style={{
                        marginBottom: "6px",
                        color: "#374151",
                        fontSize: "0.95rem",
                      }}
                    >
                      <span style={{ fontWeight: "600", color: "#2563eb" }}>
                        {entry.class}
                      </span>{" "}
                      - {entry.subject} ({entry.time})
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      })
    )}
  </div>
</div>


    </div>
  );
}

export default Schedule;
