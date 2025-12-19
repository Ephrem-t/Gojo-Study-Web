import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaUsers,
  FaClipboardCheck,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaSearch,
  FaHandHoldingMedical
} from "react-icons/fa";
import "../styles/global.css";

// Admin item component
const AdminItem = ({ admin, selected, onClick }) => (
  <div
    onClick={() => onClick(admin)}
    style={{
      width: "100%",
      borderRadius: "12px",
      padding: "15px",
      display: "flex",
      alignItems: "center",
      gap: "20px",
      cursor: "pointer",
      background: selected ? "#e0e7ff" : "#fff",
      border: selected ? "2px solid #4b6cb7" : "1px solid #ddd",
      boxShadow: selected
        ? "0 6px 15px rgba(75,108,183,0.3)"
        : "0 4px 10px rgba(0,0,0,0.1)",
      transition: "all 0.3s ease"
    }}
  >
    <img
      src={admin.profileImage || "/default-profile.png"}
      alt={admin.name}
      style={{
        width: "50px",
        height: "50px",
        borderRadius: "50%",
        objectFit: "cover",
        border: selected ? "3px solid #4b6cb7" : "3px solid red"
      }}
    />
    <div>
      <h3 style={{ margin: 0 }}>{admin.name}</h3>
      <p style={{ margin: "4px 0", color: "#555" }}>
        {admin.username || admin.email}
      </p>
    </div>
  </div>
);

function AdminPage() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  const [adminTab, setAdminTab] = useState("details");
  const [adminChatOpen, setAdminChatOpen] = useState(false);

  const [popupMessages, setPopupMessages] = useState([]);
  const [popupInput, setPopupInput] = useState("");

  const [teacherInfo, setTeacherInfo] = useState(null);
  const navigate = useNavigate();

  // ---------------- LOAD TEACHER ----------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacherInfo(storedTeacher);
  }, [navigate]);

  // ---------------- FETCH ADMINS ----------------
  useEffect(() => {
    async function fetchAdmins() {
      try {
        setLoading(true);
        const res = await axios.get(
          "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"
        );

        const users = res.data || {};
        const adminsArray = Object.entries(users)
          .filter(([_, u]) => {
            const role = (u.role || u.userType || "").toLowerCase();
            return role === "admin" || role === "school_admin";
          })
          .map(([key, u]) => ({ adminId: key, ...u }));

        setAdmins(adminsArray);
        setError(adminsArray.length === 0 ? "No admins found" : "");
      } catch (err) {
        console.error(err);
        setError("Failed to fetch admins");
      } finally {
        setLoading(false);
      }
    }

    fetchAdmins();
  }, []);

  // ---------------- FETCH CHAT ----------------
  useEffect(() => {
    if (!selectedAdmin || !teacherInfo) return;

    async function fetchMessages() {
      try {
        const key =
          teacherInfo.userId < selectedAdmin.adminId
            ? `${selectedAdmin.adminId}_${teacherInfo.userId}`
            : `${selectedAdmin.adminId}_${teacherInfo.userId}`;

        const res = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key}/messages.json`
        );

        const msgs = Object.values(res.data || {})
          .map(m => ({
            ...m,
            sender: m.senderId === teacherInfo.userId ? "teacher" : "admin"
          }))
          .sort((a, b) => a.timeStamp - b.timeStamp);

        setPopupMessages(msgs);
      } catch (err) {
        console.error(err);
        setPopupMessages([]);
      }
    }

    fetchMessages();
  }, [selectedAdmin, teacherInfo]);

  // ---------------- SEND MESSAGE ----------------
  const handleSendMessage = async () => {
    if (!popupInput.trim() || !teacherInfo || !selectedAdmin) return;

    const newMessage = {
      senderId: teacherInfo.userId,
      receiverId: selectedAdmin.adminId,
      text: popupInput,
      timeStamp: Date.now(),
      seen: false,
    };

    try {
      const key =
        teacherInfo.userId < selectedAdmin.adminId
          ? `${selectedAdmin.adminId}_${teacherInfo.userId}`
          : `${selectedAdmin.adminId}_${teacherInfo.userId}`;

      await axios.post(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key}/messages.json`,
        newMessage
      );

      setPopupMessages([...popupMessages, { ...newMessage, sender: "teacher" }]);
      setPopupInput("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-page">
      {/* TOP NAV */}
      <nav className="top-navbar">
        <h2>Teacher Dashboard</h2>
        <div style={{ display: "flex", gap: "15px" }}>
          <FaSearch />
          <FaBell />
          <FaCog />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex" }}>
        {/* LEFT SIDEBAR */}
        <div className="google-sidebar">
          {teacherInfo && (
            <div style={{ textAlign: "center", padding: "20px", borderBottom: "1px solid #ddd" }}>
              <div style={{ width: "80px", height: "80px", margin: "0 auto 10px", borderRadius: "50%", overflow: "hidden", border: "3px solid #4b6cb7" }}>
                <img src={teacherInfo.profileImage || "/default-profile.png"} alt={teacherInfo.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <h3>{teacherInfo.name}</h3>
              <p>{teacherInfo.username || teacherInfo.email}</p>
            </div>
          )}

          <div className="sidebar-menu">
            <Link className="sidebar-btn" to="/dashboard"><FaHome /> Home</Link>
            <Link className="sidebar-btn" to="/students"><FaUsers /> Students</Link>
            <Link className="sidebar-btn" to="/admins" style={{ background: "#4b6cb7", color: "#fff" }}><FaUsers /> Admins</Link>
            <Link className="sidebar-btn" to="/marks"><FaClipboardCheck /> Marks</Link>
            <Link className="sidebar-btn" to="/attendance"><FaUsers /> Attendance</Link>
            <Link className="sidebar-btn" to="/settings"><FaCog /> Settings</Link>
            <Link className="sidebar-btn" to="/logout"><FaSignOutAlt /> Logout</Link>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "30px" }}>
          <div style={{ width: "30%" }}>
            <h2 style={{ textAlign: "center", marginBottom: "20px" }}>All Admins</h2>

            {loading && <p>Loading admins...</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {admins.map(a => (
                <AdminItem
                  key={a.adminId}
                  admin={a}
                  selected={selectedAdmin?.adminId === a.adminId}
                  onClick={setSelectedAdmin}
                />
              ))}
            </div>
          </div>

          {/* RIGHT SIDEBAR (STUDENT STYLE) */}
          {selectedAdmin && (
            <div style={{ width: "30%", padding: "25px", background: "#fff", boxShadow: "0 0 15px rgba(0,0,0,0.05)", position: "fixed", right: 0, top: "60px", height: "calc(100vh - 60px)" }}>
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ width: "120px", height: "120px", margin: "0 auto 15px", borderRadius: "50%", overflow: "hidden", border: "4px solid red" }}>
                  <img src={selectedAdmin.profileImage} alt={selectedAdmin.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <h2>{selectedAdmin.name}</h2>
                <p>{selectedAdmin.email}</p>
              </div>

              <div style={{ display: "flex", marginBottom: "15px" }}>
                {["details", "attendance", "performance"].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setAdminTab(tab)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontWeight: "600",
                      color: adminTab === tab ? "#4b6cb7" : "#777",
                      borderBottom: adminTab === tab ? "3px solid #4b6cb7" : "3px solid transparent"
                    }}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>

              {adminTab === "details" && (
                <div>
                  <p><strong>ID:</strong> {selectedAdmin.adminId}</p>
                  <p><strong>Username:</strong> {selectedAdmin.username}</p>
                </div>
              )}
              {adminTab === "attendance" && <p>Attendance data here.</p>}
              {adminTab === "performance" && <p>Performance data here.</p>}

              <div style={{ marginTop: "20px" }}>
                <button onClick={() => setAdminChatOpen(true)} style={{ width: "20%", marginLeft: "200px", padding: "10px", background: "#4b6cb7", color: "#fff", border: "none", borderRadius: "8px" }}>
                  Message
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CHAT POPUP */}
      {adminChatOpen && selectedAdmin && (
        <div style={{ position: "fixed", bottom: "6px", right: "22px", width: "320px", background: "#fff", borderRadius: "12px", boxShadow: "0 8px 25px rgba(0,0,0,0.15)", padding: "15px", zIndex: 999 }}>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #ddd", paddingBottom: "10px" }}>
            <strong>{selectedAdmin.name}</strong>
<button onClick={() => navigate("/teacher-chat", { state: { studentId: selectedStudent.userId, userType: "admin" } })} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", marginRight: "-170px" }}>↗</button>
                  <button onClick={() => setStudentChatOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>×</button>         
          </div>

          <div style={{ height: "260px", overflowY: "auto", padding: "10px" }}>
            {popupMessages.map((msg, i) => (
              <div key={i} style={{ textAlign: msg.sender === "teacher" ? "right" : "left", marginBottom: "10px" }}>
                <span style={{ background: msg.sender === "teacher" ? "#4b6cb7" : "#eee", color: msg.sender === "teacher" ? "#fff" : "#000", padding: "6px 12px", borderRadius: "12px" }}>
                  {msg.text}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "5px" }}>
            <input value={popupInput} onChange={e => setPopupInput(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid #ddd" }} />
            <button onClick={handleSendMessage} style={{ background: "#4b6cb7", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 12px" }}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
