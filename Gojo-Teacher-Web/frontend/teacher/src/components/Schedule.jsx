import React, { useEffect, useState, useRef } from "react";
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
import { ref, onValue, off } from "firebase/database";
import { db } from "../firebase";

const API_BASE = "http://127.0.0.1:5000/api";
const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

const getChatId = (id1, id2) => [id1, id2].sort().join("_");

function Schedule() {
  const [teacher, setTeacher] = useState(null);
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const postRefs = useRef({});

  const navigate = useNavigate();
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const allSections = ["All", "A", "B", "C", "D"];

  // Messenger state (Dashboard-like)
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]); // conversations with unread messages for this teacher

  // total unread messages (sum of unread counts)
  const totalUnreadMessages = conversations.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);

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
        const res = await axios.get(`${RTDB_BASE}/Schedules.json`);
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

  // ---------------- FETCH NOTIFICATIONS (ENRICHED WITH ADMIN INFO) ----------------
 
  // ---------------- FETCH NOTIFICATIONS (ENRICHED WITH ADMIN INFO) ----------------
   // ---------------- FETCH NOTIFICATIONS (ENRICHED WITH ADMIN INFO) ----------------
  useEffect(() => {
  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API_BASE}/get_posts`);
      let postsData = res.data || [];
      if (!Array.isArray(postsData) && typeof postsData === "object") {
        postsData = Object.values(postsData);
      }

      const [adminsRes, usersRes] = await Promise.all([
        axios.get(`${RTDB_BASE}/School_Admins.json`),
        axios.get(`${RTDB_BASE}/Users.json`),
      ]);
      const schoolAdmins = adminsRes.data || {};
      const users = usersRes.data || {};

      // Get teacher from localStorage so we know who's seen what
      const teacher = JSON.parse(localStorage.getItem("teacher"));
      const seenPosts = getSeenPosts(teacher?.userId);

      // ...resolveAdminInfo as before...

      const resolveAdminInfo = (post) => {
        const adminId = post.adminId || post.posterAdminId || post.poster || post.admin || null;
        // ...same as your code...
        if (adminId && schoolAdmins[adminId]) {
          const schoolAdminRec = schoolAdmins[adminId];
          const userKey = schoolAdminRec.userId;
          const userRec = users[userKey] || null;
          const name = (userRec && userRec.name) || schoolAdminRec.name || post.adminName || "Admin";
          const profile = (userRec && userRec.profileImage) || schoolAdminRec.profileImage || post.adminProfile || "/default-profile.png";
          return { name, profile };
        }
        return { name: post.adminName || "Admin", profile: post.adminProfile || "/default-profile.png" };
      };

      const latest = postsData
        .slice()
        .sort((a, b) => {
          const ta = a.time ? new Date(a.time).getTime() : 0;
          const tb = b.time ? new Date(b.time).getTime() : 0;
          return tb - ta;
        })
        // ONLY SHOW NOTIFICATIONS FOR UNSEEN POSTS
        .filter((post) => post.postId && !seenPosts.includes(post.postId))
        .slice(0, 5)
        .map((post) => {
          const info = resolveAdminInfo(post);
          return {
            id: post.postId,
            title: post.message?.substring(0, 50) || "Untitled post",
            adminName: info.name,
            adminProfile: info.profile,
          };
        });

      setNotifications(latest);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  fetchNotifications();
}, []);


// --- 3. Handler to remove notification after clicked (and mark seen) ---

const handleNotificationClick = (postId) => {
  if (!teacher || !postId) return;
  // Save to localStorage
  saveSeenPost(teacher.userId, postId);
  // Remove from UI right away
  setNotifications(prev => prev.filter((n) => n.id !== postId));
  setShowNotifications(false); // Optionally close the notification panel
};

function getSeenPosts(teacherId) {
  return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
}

function saveSeenPost(teacherId, postId) {
  const seen = getSeenPosts(teacherId);
  if (!seen.includes(postId)) {
    localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seen, postId]));
  }
}

  // ---------------- MESSENGER: fetch conversations with unread messages (same as Dashboard) ----------------
  const fetchConversations = async (currentTeacher = teacher) => {
    try {
      const t = currentTeacher || JSON.parse(localStorage.getItem("teacher"));
      if (!t || !t.userId) {
        setConversations([]);
        return;
      }

      const [chatsRes, usersRes] = await Promise.all([axios.get(`${RTDB_BASE}/Chats.json`), axios.get(`${RTDB_BASE}/Users.json`)]);
      const chats = chatsRes.data || {};
      const users = usersRes.data || {};

      // build maps
      const usersByKey = users || {};
      const userKeyByUserId = {};
      Object.entries(usersByKey).forEach(([pushKey, u]) => {
        if (u && u.userId) userKeyByUserId[u.userId] = pushKey;
      });

      const convs = Object.entries(chats)
        .map(([chatId, chat]) => {
          const unreadMap = chat.unread || {};
          const unreadForMe = unreadMap[t.userId] || 0;
          if (!unreadForMe) return null;
          const participants = chat.participants || {};
          const otherKeyCandidate = Object.keys(participants || {}).find((p) => p !== t.userId);
          if (!otherKeyCandidate) return null;

          let otherPushKey = otherKeyCandidate;
          let otherRecord = usersByKey[otherPushKey];

          if (!otherRecord) {
            const mapped = userKeyByUserId[otherKeyCandidate];
            if (mapped) {
              otherPushKey = mapped;
              otherRecord = usersByKey[mapped];
            }
          }

          if (!otherRecord) {
            otherRecord = { userId: otherKeyCandidate, name: otherKeyCandidate, profileImage: "/default-profile.png" };
          }

          const contact = {
            pushKey: otherPushKey,
            userId: otherRecord.userId || otherKeyCandidate,
            name: otherRecord.name || otherRecord.username || otherKeyCandidate,
            profileImage: otherRecord.profileImage || otherRecord.profile || "/default-profile.png",
          };

          const lastMessage = chat.lastMessage || {};

          return {
            chatId,
            contact,
            displayName: contact.name,
            profile: contact.profileImage,
            lastMessageText: lastMessage.text || "",
            lastMessageTime: lastMessage.timeStamp || lastMessage.time || null,
            unreadForMe,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

      setConversations(convs);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setConversations([]);
    }
  };

  const handleMessengerToggle = async () => {
    setShowMessenger((s) => !s);
    await fetchConversations();
  };

  const handleOpenConversation = async (conv, index) => {
    if (!teacher || !conv) return;
    const { chatId, contact } = conv;

    // Navigate to AllChat with contact + chatId and indicate schedule tab
    navigate("/all-chat", { state: { contact, chatId, tab: "schedule" } });

    // Clear unread in RTDB for this teacher
    try {
      await axios.put(`${RTDB_BASE}/Chats/${chatId}/unread/${teacher.userId}.json`, null);
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }

    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };

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
            {/* Notifications */}
            <div className="icon-circle" style={{ position: "relative" }}>
              <div onClick={() => setShowNotifications(!showNotifications)} style={{ cursor: "pointer", position: "relative" }}>
                <FaBell size={24} />
                {notifications.length > 0 && (
                  <span style={{ position: "absolute", top: -5, right: -5, background: "red", color: "white", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {notifications.length}
                  </span>
                )}
              </div>

              {showNotifications && (
                <div style={{ position: "absolute", top: 30, right: 0, width: 300, maxHeight: 400, overflowY: "auto", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.2)", borderRadius: 8, zIndex: 100 }}>
                  {notifications.length > 0 ? notifications.map((post, index) => (
                    <div key={post.id || index} onClick={() => {
                      navigate("/dashboard");
                      setTimeout(() => {
                        const postElement = postRefs.current[post.id];
                        if (postElement) {
                          postElement.scrollIntoView({ behavior: "smooth", block: "center" });
                          setHighlightedPostId(post.id);
                          setTimeout(() => setHighlightedPostId(null), 3000);
                        }
                      }, 150);
                      setNotifications(prev => prev.filter((_, i) => i !== index));
                      setShowNotifications(false);
                    }} style={{ display: "flex", alignItems: "center", padding: "10px 15px", borderBottom: "1px solid #eee", cursor: "pointer" }}>
                      <img src={post.adminProfile} alt={post.adminName} style={{ width: 35, height: 35, borderRadius: "50%", marginRight: 10 }} />
                      <div>
                        <strong>{post.adminName}</strong>
                        <p style={{ margin: 0, fontSize: 12 }}>{post.title}</p>
                      </div>
                    </div>
                  )) : <div style={{ padding: 15 }}>No notifications</div>}
                </div>
              )}
            </div>

            {/* Messenger (Dashboard-like) */}
            <div className="icon-circle" style={{ position: "relative", marginLeft: 12 }}>
              <div onClick={handleMessengerToggle} style={{ cursor: "pointer", position: "relative" }}>
                <FaFacebookMessenger size={22} />
                {totalUnreadMessages > 0 && (
                  <span style={{ position: "absolute", top: -6, right: -6, background: "#0b78f6", color: "#fff", borderRadius: "50%", minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px", fontSize: 12 }}>
                    {totalUnreadMessages}
                  </span>
                )}
              </div>

              {showMessenger && (
                <div style={{ position: "absolute", top: 34, right: 0, width: 340, maxHeight: 420, overflowY: "auto", background: "#fff", boxShadow: "0 4px 14px rgba(0,0,0,0.12)", borderRadius: 8, zIndex: 200, padding: 8 }}>
                  {conversations.length === 0 ? (
                    <div style={{ padding: 14 }}>No unread messages</div>
                  ) : conversations.map((conv, idx) => (
                    <div key={conv.chatId || idx} onClick={() => handleOpenConversation(conv, idx)} style={{ display: "flex", gap: 12, alignItems: "center", padding: 10, borderBottom: "1px solid #eee", cursor: "pointer" }}>
                      <img src={conv.profile || "/default-profile.png"} alt={conv.displayName} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <strong>{conv.displayName}</strong>
                          {conv.unreadForMe > 0 && <span style={{ background: "#0b78f6", color: "#fff", padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{conv.unreadForMe}</span>}
                        </div>
                        <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>{conv.lastMessageText || "No messages yet"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

             <div className="icon-circle" onClick={() => navigate("/settings")}><FaCog /></div>
            <img src={teacher?.profileImage || "/default-profile.png"} alt="profile" />
          </div>
        </nav>

        {/* Filters + schedule content (unchanged) */}
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
          position: "fixed",
          top: "60px",
          right: "20px",
          width: "450px",
          height: "calc(100vh - 40px)",
          background: "#fff",
          borderRadius: "1px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          overflow: "hidden",
        }}
      >
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

        <div style={{ padding: "20px", height: "calc(100% - 60px)", overflowY: "auto", background: "#f9fafb" }}>
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
                <div key={day} style={{ marginBottom: "20px", padding: "10px", borderRadius: "12px", background: isToday ? "#e0f2fe" : "#fff", boxShadow: isToday ? "0 4px 12px rgba(59, 130, 246, 0.2)" : "0 2px 6px rgba(0,0,0,0.05)" }}>
                  <h4 style={{ color: "#1e3a8a", marginBottom: "12px", fontWeight: "600", fontSize: "1.05rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "5px" }}>{day}</h4>

                  {Object.entries(periods).map(([periodName, entries]) => (
                    <div key={periodName} style={{ marginBottom: "12px", background: "#f3f4f6", padding: "12px 15px", borderRadius: "10px", borderLeft: "5px solid #2563eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", transition: "transform 0.2s, box-shadow 0.2s", cursor: "pointer" }}>
                      <strong style={{ display: "block", marginBottom: "6px", color: "#1e3a8a", fontSize: "0.98rem" }}>{periodName}</strong>
                      <ul style={{ paddingLeft: "18px", margin: 0 }}>
                        {entries.map((entry, idx) => (
                          <li key={idx} style={{ marginBottom: "6px", color: "#374151", fontSize: "0.95rem" }}>
                            <span style={{ fontWeight: "600", color: "#2563eb" }}>{entry.class}</span> - {entry.subject} ({entry.time})
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