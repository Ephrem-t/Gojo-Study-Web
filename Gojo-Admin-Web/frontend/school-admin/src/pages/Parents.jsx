import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaFacebookMessenger,
  FaSearch,
  FaCalendarAlt,
  FaCommentDots,
} from "react-icons/fa";
import axios from "axios";
import { getDatabase, ref as rdbRef, onValue } from "firebase/database";

const DB = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";
const getChatId = (a, b) => [a, b].sort().join("_");

function Parent() {
  const [parents, setParents] = useState([]);
  const [parentTab, setParentTab] = useState("details");
  const [parentChatOpen, setParentChatOpen] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");
  const [parentInfo, setParentInfo] = useState(null);
  const [children, setChildren] = useState([]);
  const [expandedChildren, setExpandedChildren] = useState({});
  const [unreadSenders, setUnreadSenders] = useState({});
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [postNotifications, setPostNotifications] = useState([]);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sidebarVisible, setSidebarVisible] = useState(window.innerWidth > 900);

  const navigate = useNavigate();
  const location = useLocation();
  const admin = JSON.parse(localStorage.getItem("admin")) || {};
  const adminId = admin.userId;
  const chatId =
    admin?.userId && selectedParent?.userId
      ? getChatId(admin.userId, selectedParent.userId)
      : null;

  const messagesEndRef = useRef(null);
  const [windowW, setWindowW] = useState(window.innerWidth);

  // Window resize handling for responsiveness
  useEffect(() => {
    const onResize = () => setWindowW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Keep sidebarVisible default based on screen size
  useEffect(() => {
    setSidebarVisible(windowW > 900);
  }, [windowW]);

  // Fetch parents
  useEffect(() => {
    const fetchParents = async () => {
      try {
        const res = await axios.get(`${DB}/Users.json`);
        const users = res.data || {};
        const parentList = Object.keys(users)
          .filter((uid) => users[uid].role === "parent")
          .map((uid) => ({
            userId: uid,
            name: users[uid].name || users[uid].username || "No Name",
            email: users[uid].email || "N/A",
            profileImage: users[uid].profileImage || "/default-profile.png",
          }));
        setParents(parentList);
      } catch (err) {
        console.error("Error fetching parents:", err);
        setParents([]);
      }
    };
    fetchParents();
  }, []);

  // Post notifications
  const fetchPostNotifications = async () => {
    if (!adminId) return;
    try {
      const res = await axios.get(
        `http://127.0.0.1:5000/api/get_post_notifications/${adminId}`
      );
      let notifications = Array.isArray(res.data)
        ? res.data
        : Object.values(res.data || {});
      if (notifications.length === 0) {
        setPostNotifications([]);
        return;
      }
      const [usersRes, adminsRes] = await Promise.all([
        axios.get(`${DB}/Users.json`),
        axios.get(`${DB}/School_Admins.json`),
      ]);
      const users = usersRes.data || {};
      const admins = adminsRes.data || {};
      const findAdminUser = (id) => {
        const rec = admins[id];
        if (!rec) return null;
        return Object.values(users).find((u) => u.userId === rec.userId);
      };
      const enriched = notifications.map((n) => {
        const posterUser = findAdminUser(n.adminId);
        return {
          ...n,
          notificationId: n.notificationId || n.id || `${n.postId}_${n.adminId}`,
          adminName: posterUser?.name || "Unknown Admin",
          adminProfile: posterUser?.profileImage || "/default-profile.png",
        };
      });
      setPostNotifications(enriched);
    } catch (err) {
      console.error("Post notification fetch failed", err);
      setPostNotifications([]);
    }
  };

  useEffect(() => {
    if (!adminId) return;
    fetchPostNotifications();
    const interval = setInterval(fetchPostNotifications, 9000);
    return () => clearInterval(interval);
  }, [adminId]);

  // Mark post notification & navigate
  const handleNotificationClick = async (notification) => {
    try {
      await axios.post("http://127.0.0.1:5000/api/mark_post_notification_read", {
        notificationId: notification.notificationId,
        adminId: admin.userId,
      });
    } catch (err) {
      console.warn("Failed to mark notification:", err);
    }
    setPostNotifications((prev) =>
      prev.filter((n) => n.notificationId !== notification.notificationId)
    );
    setShowPostDropdown(false);
    navigate("/dashboard", { state: { postId: notification.postId } });
  };

  useEffect(() => {
    if (location.state?.postId) setPostNotifications([]);
  }, [location.state]);

  // Unread senders (messenger)
  const fetchUnreadMessages = async () => {
    if (!admin.userId) return;
    const senders = {};
    try {
      const usersRes = await axios.get(`${DB}/Users.json`);
      const usersData = usersRes.data || {};
      const findUserByUserId = (userId) =>
        Object.values(usersData).find((u) => u.userId === userId);

      // helper to read both chat keys
      const getUnreadCount = async (userId) => {
        const key1 = `${admin.userId}_${userId}`;
        const key2 = `${userId}_${admin.userId}`;
        const [r1, r2] = await Promise.all([
          axios.get(`${DB}/Chats/${key1}/messages.json`).catch(() => ({ data: null })),
          axios.get(`${DB}/Chats/${key2}/messages.json`).catch(() => ({ data: null })),
        ]);
        const msgs = [...Object.values(r1.data || {}), ...Object.values(r2.data || {})];
        return msgs.filter((m) => m.receiverId === admin.userId && !m.seen).length;
      };

      // Teachers
      const teachersRes = await axios.get(`${DB}/Teachers.json`).catch(() => ({ data: {} }));
      for (const k in teachersRes.data || {}) {
        const t = teachersRes.data[k];
        const unread = await getUnreadCount(t.userId);
        if (unread > 0) {
          const user = findUserByUserId(t.userId);
          senders[t.userId] = {
            type: "teacher",
            name: user?.name || "Teacher",
            profileImage: user?.profileImage || "/default-profile.png",
            count: unread,
          };
        }
      }
      // Students
      const studentsRes = await axios.get(`${DB}/Students.json`).catch(() => ({ data: {} }));
      for (const k in studentsRes.data || {}) {
        const s = studentsRes.data[k];
        const unread = await getUnreadCount(s.userId);
        if (unread > 0) {
          const user = findUserByUserId(s.userId);
          senders[s.userId] = {
            type: "student",
            name: user?.name || s.name || "Student",
            profileImage: user?.profileImage || s.profileImage || "/default-profile.png",
            count: unread,
          };
        }
      }
      // Parents
      const parentsRes = await axios.get(`${DB}/Parents.json`).catch(() => ({ data: {} }));
      for (const k in parentsRes.data || {}) {
        const p = parentsRes.data[k];
        const unread = await getUnreadCount(p.userId);
        if (unread > 0) {
          const user = findUserByUserId(p.userId);
          senders[p.userId] = {
            type: "parent",
            name: user?.name || p.name || "Parent",
            profileImage: user?.profileImage || p.profileImage || "/default-profile.png",
            count: unread,
          };
        }
      }

      setUnreadSenders(senders);
    } catch (err) {
      console.error("Unread fetch failed:", err);
      setUnreadSenders({});
    }
  };

  useEffect(() => {
    if (!admin.userId) return;
    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 9000);
    return () => clearInterval(interval);
  }, [admin.userId]);

  // Close messenger dropdown if clicked outside
  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".messenger-dropdown")) {
        setShowMessageDropdown(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  // Fetch parent info & children
  useEffect(() => {
    if (!selectedParent) return;
    const fetchParentInfoAndChildren = async () => {
      try {
        const parentsRes = await axios.get(`${DB}/Parents.json`).catch(() => ({ data: {} }));
        const parentsData = parentsRes.data || {};
        const parentRecord = Object.values(parentsData).find((p) => p.userId === selectedParent.userId);
        if (!parentRecord) {
          setParentInfo(null);
          setChildren([]);
          return;
        }
        const usersRes = await axios.get(`${DB}/Users.json`).catch(() => ({ data: {} }));
        const usersData = usersRes.data || {};
        const userInfo = usersData[selectedParent.userId] || {};
        setParentInfo({
          userId: selectedParent.userId,
          name: userInfo.name || userInfo.username || "No Name",
          email: userInfo.email || "N/A",
          phone: parentRecord.phone || "N/A",
          status: parentRecord.status || "N/A",
          additionalInfo: parentRecord.additionalInfo || "N/A",
          createdAt: parentRecord.createdAt || "N/A",
          profileImage: userInfo.profileImage || "/default-profile.png",
        });
        const studentsRes = await axios.get(`${DB}/Students.json`).catch(() => ({ data: {} }));
        const studentsData = studentsRes.data || {};
        const childrenList = Object.values(parentRecord.children || {})
          .map((childLink) => {
            const studentRecord = studentsData[childLink.studentId];
            if (!studentRecord) return null;
            const studentUserId = studentRecord.use || studentRecord.userId;
            const studentUser = usersData[studentUserId] || {};
            return {
              studentId: childLink.studentId,
              name: studentUser.name || studentUser.username || "No Name",
              email: studentUser.email || "N/A",
              grade: studentRecord.grade || "N/A",
              section: studentRecord.section || "N/A",
              parentPhone: parentRecord.phone || "N/A",
              relationship: childLink.relationship || "N/A",
              profileImage: studentUser.profileImage || "/default-profile.png",
            };
          })
          .filter(Boolean);
        setChildren(childrenList);
      } catch (err) {
        console.error("Error fetching parent info and children:", err);
        setParentInfo(null);
        setChildren([]);
      }
    };
    fetchParentInfoAndChildren();
  }, [selectedParent]);

  // Fetch chat messages in realtime
  useEffect(() => {
    if (!chatId) return;
    const db = getDatabase();
    const messagesRef = rdbRef(db, `Chats/${chatId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data)
        .map(([id, msg]) => ({ messageId: id, ...msg }))
        .sort((a, b) => a.timeStamp - b.timeStamp);
      setMessages(list);
    });
    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, parentChatOpen]);

  // Ensure chat object exists
  const initChatIfMissing = async () => {
    if (!chatId) return;
    await axios.patch(`${DB}/Chats/${chatId}.json`, {
      participants: { [admin.userId]: true, [selectedParent.userId]: true },
      unread: { [admin.userId]: 0, [selectedParent.userId]: 0 },
    }).catch(() => {});
  };

  // Send message
  const sendMessage = async (text) => {
    if (!text || !text.trim() || !selectedParent) return;
    if (!admin?.userId || !selectedParent?.userId) return;
    const id = getChatId(admin.userId, selectedParent.userId);
    const messageId = Date.now();
    await initChatIfMissing();
    await axios.put(`${DB}/Chats/${id}/messages/${messageId}.json`, {
      senderId: admin.userId,
      receiverId: selectedParent.userId,
      type: "text",
      text,
      imageUrl: null,
      replyTo: null,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp: Date.now(),
    }).catch(() => {});
    await axios.patch(`${DB}/Chats/${id}.json`, {
      lastMessage: { text, senderId: admin.userId, seen: false, timeStamp: Date.now() },
      unread: { [selectedParent.userId]: 1 },
    }).catch(() => {});
    setNewMessageText("");
  };

  // Mark as seen when selectedParent changes
  useEffect(() => {
    if (!selectedParent || !admin?.userId) return;
    const id = getChatId(admin.userId, selectedParent.userId);
    axios.patch(`${DB}/Chats/${id}.json`, { unread: { [admin.userId]: 0 }, lastMessage: { seen: true } }).catch(() => {});
  }, [selectedParent, admin]);

  // Mark messages seen helper for dropdown click
  const markMessagesAsSeen = async (userId) => {
    if (!admin?.userId || !userId) return;
    const id = getChatId(admin.userId, userId);
    await axios.patch(`${DB}/Chats/${id}/unread.json`, { [admin.userId]: 0 }).catch(() => {});
    await axios.patch(`${DB}/Chats/${id}/lastMessage.json`, { seen: true }).catch(() => {});
  };

  if (!admin?.userId) return null;

  // MAIN CONTENT responsive & centered when sidebar closed
  const mainContentStyle = {
    padding: windowW <= 600 ? "12px" : "30px",
    width: "100%",
    maxWidth: sidebarVisible && windowW > 900 ? 900 : 1100,
    margin: "0 auto",
    boxSizing: "border-box",
  };

  const parentCardBase = {
    height: "100px",
    borderRadius: "12px",
    padding: "15px",
    display: "flex",
    alignItems: "center",
    gap: "20px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    width: "100%",
    maxWidth: 700,
    boxSizing: "border-box",
  };

  return (
     <div className="dashboard-page">
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>

        <div className="nav-right">
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowPostDropdown((prev) => !prev);
            }}
          >
            <FaBell />
            {postNotifications.length > 0 && (
              <span className="badge">{postNotifications.length}</span>
            )}
            {showPostDropdown && (
              <div className="notification-dropdown" onClick={(e) => e.stopPropagation()}>
                {postNotifications.length === 0 ? (
                  <p className="muted">No new notifications</p>
                ) : (
                  postNotifications.map((n) => (
                    <div
                      key={n.notificationId}
                      className="notification-row"
                      onClick={async () => {
                        await axios.post("http://127.0.0.1:5000/api/mark_post_notification_read", {
                          notificationId: n.notificationId,
                        });

                        setPostNotifications((prev) => prev.filter((notif) => notif.notificationId !== n.notificationId));
                        setShowPostDropdown(false);
                        navigate("/dashboard", {
                          state: {
                            postId: n.postId,
                            posterName: n.adminName,
                            posterProfile: n.adminProfile,
                          },
                        });
                      }}
                    >
                      <img src={n.adminProfile || "/default-profile.png"} alt={n.adminName} className="notif-img" />
                      <div>
                        <strong>{n.adminName}</strong>
                        <p style={{ margin: 0 }}>{n.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setShowMessageDropdown((p) => !p); }}>
            <FaFacebookMessenger />
            {Object.keys(unreadSenders).length > 0 && <span className="badge">{Object.values(unreadSenders).reduce((a, b) => a + b.count, 0)}</span>}
            {showMessageDropdown && (
              <div className="notification-dropdown">
                {Object.keys(unreadSenders).length === 0 ? (
                  <p className="muted">No new messages</p>
                ) : (
                  Object.entries(unreadSenders).map(([userId, sender]) => (
                    <div key={userId} className="notification-row" onClick={() => navigate("/all-chat", { state: { user: { userId, name: sender.name, profileImage: sender.profileImage, type: sender.type } } })}>
                      <img src={sender.profileImage} alt={sender.name} className="notif-img" />
                      <div>
                        <strong>{sender.name}</strong>
                        <p style={{ margin: 0 }}>{sender.count} new message{sender.count > 1 && "s"}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <Link className="icon-circle" to="/settings"><FaCog /></Link>

          <img src={admin.profileImage || "/default-profile.png"} alt="admin" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard">
        <div className="google-sidebar">
          <div className="sidebar-profile">
            <div className="sidebar-img-circle"><img src={admin?.profileImage || "/default-profile.png"} alt="profile" /></div>
            <h3>{admin?.name || "Admin Name"}</h3>
            <p>{admin?.username || "username"}</p>
          </div>

          <div className="sidebar-menu">

          <div className="sidebar-menu" style={{ marginTop: 12 }}>
            <Link className="sidebar-btn" to="/dashboard" ><FaHome /> Home</Link>
            <Link className="sidebar-btn" to="/my-posts" ><FaFileAlt /> My Posts</Link>
            <Link className="sidebar-btn" to="/teachers"><FaChalkboardTeacher /> Teachers</Link>
            <Link className="sidebar-btn" to="/students" ><FaChalkboardTeacher /> Students</Link>
            <Link className="sidebar-btn" to="/schedule" ><FaCalendarAlt /> Schedule</Link>
            <Link className="sidebar-btn" to="/parents" style={{ background: "#4b6cb7", color: "#fff" }}><FaChalkboardTeacher /> Parents</Link>
            <button className="sidebar-btn logout-btn" onClick={() => { localStorage.removeItem("admin"); window.location.href = "/login"; }}>
              <FaSignOutAlt /> Logout
            </button>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT (centered & responsive) */}
        <main className="main-content" style={mainContentStyle}>
          <h2 style={{ marginBottom: 20, textAlign: "center" }}>Parents</h2>
          <div style={{ display: "flex", width: "500px", flexDirection: "column", alignItems: "center", gap: 20, marginLeft: "150px" }}>
            {parents.length === 0 ? (
              <p>No parents found.</p>
            ) : (
              parents.map((p) => (
                <div
                  key={p.userId}
                  onClick={() => { setSelectedParent(p); setSidebarVisible(true); }}
                  style={{
                    ...parentCardBase,
                    background: selectedParent?.userId === p.userId ? "#e0e7ff" : "#fff",
                    border: selectedParent?.userId === p.userId ? "2px solid #4b6cb7" : "1px solid #ddd",
                    boxShadow: selectedParent?.userId === p.userId ? "0 6px 15px rgba(75,108,183,0.3)" : "0 4px 10px rgba(0,0,0,0.1)",
                  }}
                >
                  <img src={p.profileImage} alt={p.name} style={{ width: 50, height: 50, borderRadius: 25, objectFit: "cover" }} />
                  <div>
                    <h3 style={{ margin: 0 }}>{p.name}</h3>
                    <p style={{ margin: "4px 0", color: "#555" }}>{p.email}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        {/* RIGHT SIDEBAR */}
        {selectedParent && sidebarVisible && (
          <aside className="parent-info-sidebar" style={{
            width: windowW <= 900 ? "100vw" : "32%",
            maxWidth: 520,
            padding: 25,
            background: "#fff",
            position: "fixed",
            right: 0,
            top: 60,
            height: "calc(100vh - 60px)",
            overflowY: "auto",
            boxShadow: "0 0 15px rgba(0,0,0,0.05)",
            zIndex: 300,
          }}>
            {/* CLOSE BUTTON */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setSidebarVisible(false)}
                aria-label="Close sidebar"
                style={{
                  background: "none",
                  marginTop: "-30px",
                  border: "none",
                  fontSize: 26,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ textAlign: "center" }}>
              {/* Parent Profile */}
              <div style={{ background: "#becff7ff", padding: "25px 10px", height: 200, margin: "-25px -25px 20px", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }}>
                <div style={{ width: 100, height: 100, margin: "-20px auto 15px", borderRadius: "50%", overflow: "hidden", border: "4px solid #4b6cb7" }}>
                  <img src={selectedParent.profileImage} alt={selectedParent.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <h2 style={{ margin: 0, fontSize: 22, marginTop: -10, color: "#333" }}>{selectedParent.name}</h2>
                <h2 style={{ margin: 0, fontSize: 16, marginTop: 0, color: "#585656ff" }}>{selectedParent.email}</h2>
              </div>

              {/* Tabs */}
              <div style={{ background: "#fff", borderRadius: 10, padding: 15, boxShadow: "0 4px 12px rgba(0,0,0,0.05)", width: "100%", textAlign: "left" }}>
                <div style={{ display: "flex", borderBottom: "1px solid #eee", marginBottom: 15 }}>
                  {["details", "children", "status"].map((tab) => (
                    <button key={tab} onClick={() => setParentTab(tab)} style={{ flex: 1, padding: 10, border: "none", background: "none", cursor: "pointer", fontWeight: 600, color: parentTab === tab ? "#4b6cb7" : "#777", borderBottom: parentTab === tab ? "3px solid #4b6cb7" : "3px solid transparent" }}>
                      {tab.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* DETAILS */}
                {parentTab === "details" && parentInfo && (
                  <div style={{ padding: 20, background: "linear-gradient(180deg,#eef2ff,#f8fafc)", borderRadius: 24, boxShadow: "0 10px 16px rgba(0,0,0,0.15)" }}>
                    <div style={{ marginBottom: 26 }}>
                      <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#1e40af" }}>👤 Parent Profile</h3>
                      <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>Account & personal information overview</p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18 }}>
                      {[
                        { label: "User ID", value: parentInfo.userId, icon: "🆔" },
                        { label: "Email", value: parentInfo.email, icon: "📧" },
                        { label: "Phone", value: parentInfo.phone, icon: "📞" },
                        { label: "Status", value: parentInfo.status, icon: "✅" },
                        { label: "Additional Info", value: parentInfo.additionalInfo, icon: "📝" },
                        { label: "Created At", value: parentInfo.createdAt, icon: "📅" },
                      ].map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 8, background: "white", borderRadius: 18, boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ width: 42, height: 42, borderRadius: 14, background: "linear-gradient(135deg,#6366f1,#2563eb)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{item.icon}</div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>{item.label}</div>
                              <div style={{ marginTop: 4, fontSize: 15, fontWeight: 700, color: "#1f2937", wordBreak: "break-word" }}>{item.value || "-"}</div>
                            </div>
                          </div>
                          {item.label === "Status" && (
                            <span style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: parentInfo.status === "active" ? "#dcfce7" : "#fee2e2", color: parentInfo.status === "active" ? "#166534" : "#991b1b" }}>{parentInfo.status?.toUpperCase()}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CHILDREN */}
                {parentTab === "children" && (
                  <div style={{ padding: 30 }}>
                    <h4 style={{ marginBottom: 30, color: "#4b6cb7", fontSize: 26, fontWeight: 700, borderBottom: "3px solid #4b6cb7", paddingBottom: 10 }}>Children</h4>
                    {children.length === 0 ? <p style={{ color: "#777", fontStyle: "italic", textAlign: "center", fontSize: 16 }}>No children found</p> :
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 25 }}>
                        {children.map((child) => {
                          const expanded = expandedChildren[child.studentId];
                          return (
                            <div key={child.studentId} style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.08)", borderLeft: "6px solid #4b6cb7" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                                <img src={child.profileImage || "/default-profile.png"} alt={child.name} style={{ width: 64, height: 64, borderRadius: 32, objectFit: "cover", border: "2px solid #4b6cb7" }} />
                                <div style={{ flex: 1 }}>
                                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#1f2937" }}>{child.name}</h3>
                                  <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                                    <span style={{ background: "#eef2ff", color: "#4b6cb7", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Grade {child.grade}</span>
                                    <span style={{ background: "#f1f5f9", color: "#334155", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Section {child.section}</span>
                                  </div>
                                </div>
                                <button onClick={() => setExpandedChildren(prev => ({ ...prev, [child.studentId]: !prev[child.studentId] }))} style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: expanded ? "#1e293b" : "#4b6cb7", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{expanded ? "Hide" : "Details"}</button>
                              </div>
                              {expanded && (
                                <>
                                  <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, fontSize: 14, color: "#475569", lineHeight: 1.7 }}>
                                    <p><strong>Email:</strong> <a href={`mailto:${child.email}`} style={{ color: "#4b6cb7" }}>{child.email}</a></p>
                                    <p><strong>Parent Phone:</strong> <a href={`tel:${child.parentPhone}`} style={{ color: "#16a34a" }}>{child.parentPhone}</a></p>
                                    <p><strong>Relationship:</strong> {child.relationship}</p>
                                  </div>
                                  <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                                    <a href={`mailto:${child.email}`} style={{ flex: 1, textAlign: "center", padding: 8, background: "#4b6cb7", color: "#fff", borderRadius: 10, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>Email</a>
                                    <a href={`tel:${child.parentPhone}`} style={{ flex: 1, textAlign: "center", padding: 8, background: "#16a34a", color: "#fff", borderRadius: 10, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>Call</a>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    }
                  </div>
                )}

                {/* STATUS */}
                {parentTab === "status" && <div><p style={{ color: "#555" }}>Parent account status and activity info will be displayed here.</p></div>}
              </div>

              {/* Chat button & Popup */}
              {!parentChatOpen && (
                <div onClick={() => setParentChatOpen(true)} style={{ position: "fixed", bottom: 20, right: 20, width: 48, height: 48, background: "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer", zIndex: 400 }}>
                  <FaCommentDots size={22} />
                </div>
              )}

              {parentChatOpen && selectedParent && (
                <div style={{ position: "fixed", bottom: 20, right: 20, width: 340, height: 420, background: "#fff", borderRadius: 16, boxShadow: "0 12px 30px rgba(0,0,0,0.25)", zIndex: 500, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fafafa" }}>
                    <strong>{selectedParent.name}</strong>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => { setParentChatOpen(false); navigate("/all-chat", { state: { user: selectedParent } }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>⤢</button>
                      <button onClick={() => setParentChatOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>×</button>
                    </div>
                  </div>

                  <div style={{ flex: 1, padding: 10, overflowY: "auto" }}>
                    {messages.length === 0 ? <p style={{ textAlign: "center", color: "#aaa" }}>Start chatting with {selectedParent.name}</p> :
                      messages.map((m) => (
                        <div key={m.messageId} style={{ textAlign: m.senderId === admin.userId ? "right" : "left", marginBottom: 8 }}>
                          <span style={{ display: "inline-block", padding: "8px 12px", borderRadius: 18, background: m.senderId === admin.userId ? "#4b6cb7" : "#f1f1f1", color: m.senderId === admin.userId ? "#fff" : "#000" }}>{m.text}</span>
                        </div>
                      ))
                    }
                    <div ref={messagesEndRef} />
                  </div>

                  <div style={{ padding: 10, borderTop: "1px solid #eee", display: "flex", gap: 8 }}>
                    <input value={newMessageText} onChange={(e) => setNewMessageText(e.target.value)} placeholder="Message..." style={{ flex: 1, padding: 10, borderRadius: 999, border: "1px solid #ccc" }} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(newMessageText); }} />
                    <button onClick={() => sendMessage(newMessageText)} style={{ background: "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)", border: "none", borderRadius: "50%", width: 40, height: 40, color: "#fff", cursor: "pointer" }}>➤</button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

      </div>
    </div>
  );
}

export default Parent;