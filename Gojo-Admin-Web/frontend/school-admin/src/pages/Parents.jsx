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
  FaPaperPlane,
  FaCheck,
} from "react-icons/fa";
import axios from "axios";
import { getDatabase, ref as rdbRef, onValue } from "firebase/database";

const DB = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";
const getChatId = (a, b) => [a, b].sort().join("_");

function Parent() {
  const [parents, setParents] = useState([]);
  const [parentTab, setParentTab] = useState("Details");
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
  const formatDateLabel = (ts) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleDateString(); } catch { return ""; }
  };
  const formatTime = (ts) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ""; }
  };
  const [windowW, setWindowW] = useState(window.innerWidth);

  // Portrait detection helper used in sidebar layout
  const isPortrait = windowW <= 600;

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
            phone: users[uid].phone || users[uid].phoneNumber || "N/A",
            age: users[uid].age || null,
            city: users[uid].city || (users[uid].address && users[uid].address.city) || null,
            citizenship: users[uid].citizenship || null,
            job: users[uid].job || null,
            address: users[uid].address || null,
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
        const usersRes = await axios.get(`${DB}/Users.json`).catch(() => ({ data: {} }));
        const usersData = usersRes.data || {};
        const userInfo = usersData[selectedParent.userId] || {};

        // compute age from possible DOB fields or explicit age field
        const dobRaw = userInfo?.dob || userInfo?.birthDate || parentRecord?.dob || parentRecord?.birthDate || null;
        const computeAge = (dob) => {
          if (!dob) return null;
          try {
            const d = typeof dob === "number" ? new Date(dob) : new Date(String(dob));
            const now = new Date();
            let age = now.getFullYear() - d.getFullYear();
            const m = now.getMonth() - d.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
            return age;
          } catch (e) {
            return null;
          }
        };

        const age = parentRecord?.age || userInfo?.age || computeAge(dobRaw) || null;

        // derive relationships from child links if present
        const rels = (Object.values(parentRecord?.children || {}).map((c) => c.relationship).filter(Boolean)) || [];

        const info = {
          userId: selectedParent.userId,
          name: userInfo.name || userInfo.username || "No Name",
          username: userInfo.username || null,
          email: userInfo.email || "N/A",
          phone: userInfo.phone || parentRecord?.phone || "N/A",
          isActive: userInfo.isActive ?? parentRecord?.isActive ?? true,
          job: userInfo.job || parentRecord?.job || null,
          relationships: rels,
          age: age ?? "—",
          city: parentRecord?.city || (parentRecord?.address && parentRecord.address.city) || userInfo.city || "—",
          citizenship: parentRecord?.citizenship || userInfo.citizenship || "—",
          status: parentRecord?.status || (userInfo.isActive ? "Active" : "Inactive") || "N/A",
          address: parentRecord?.address || userInfo.address || null,
          additionalInfo: parentRecord?.additionalInfo || "N/A",
          createdAt: parentRecord?.createdAt || userInfo.createdAt || "N/A",
          profileImage: userInfo.profileImage || "/default-profile.png",
        };
        setParentInfo(info);
        setSelectedParent((prev) => ({ ...(prev || {}), ...info }));
        const studentsRes = await axios.get(`${DB}/Students.json`).catch(() => ({ data: {} }));
        const studentsData = studentsRes.data || {};
        const childrenList = Object.values(parentRecord?.children || {})
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
    const unsubscribe = onValue(messagesRef, async (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data)
        .map(([id, msg]) => ({ messageId: id, ...msg }))
        .sort((a, b) => a.timeStamp - b.timeStamp);
      setMessages(list);

      // mark unseen messages addressed to admin as seen
      const updates = {};
      Object.entries(data).forEach(([msgId, msg]) => {
        if (msg && msg.receiverId === admin.userId && !msg.seen) {
          updates[`${msgId}/seen`] = true;
        }
      });

      if (Object.keys(updates).length > 0) {
        try {
          await axios.patch(`${DB}/Chats/${chatId}/messages.json`, updates).catch(() => {});
        } catch (err) {
          console.warn('Failed to patch parent seen updates', err);
        }
        // also reset unread and mark lastMessage seen
        axios.patch(`${DB}/Chats/${chatId}.json`, { unread: { [admin.userId]: 0 }, lastMessage: { seen: true } }).catch(() => {});
        // optimistic local update
        setMessages((prev) => prev.map((m) => (m.receiverId === admin.userId ? { ...m, seen: true } : m)));
      }
    });
    return () => unsubscribe();
  }, [chatId]);

  // Mark messages as seen when the chat popup opens or selected parent changes
  useEffect(() => {
    if (!parentChatOpen || !selectedParent || !admin?.userId) return;
    const chatKey = getChatId(admin.userId, selectedParent.userId);

    const markSeen = async () => {
      try {
        const res = await axios.get(`${DB}/Chats/${chatKey}/messages.json`);
        const data = res.data || {};
        const updates = {};
        Object.entries(data).forEach(([msgId, msg]) => {
          if (msg && msg.receiverId === admin.userId && !msg.seen) {
            updates[`${msgId}/seen`] = true;
          }
        });

        if (Object.keys(updates).length > 0) {
          // Patch the messages node with per-message seen updates
          await axios.patch(`${DB}/Chats/${chatKey}/messages.json`, updates).catch(() => {});
        }

        // Optimistically update local state
        setMessages((prev) => prev.map((m) => (m.receiverId === admin.userId ? { ...m, seen: true } : m)));
      } catch (err) {
        console.warn("Failed to mark messages as seen:", err);
      }
    };

    markSeen();
    // also reset unread counter for admin in chat root
    axios.patch(`${DB}/Chats/${chatKey}.json`, { unread: { [admin.userId]: 0 }, lastMessage: { seen: true } }).catch(() => {});
  }, [parentChatOpen, selectedParent, admin]);

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

  // badge counts
  const messageCount = Object.values(unreadSenders || {}).reduce((acc, s) => acc + (s.count || 0), 0);
  const totalNotifications = (postNotifications?.length || 0) + messageCount;

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
          {/* Combined bell: shows posts + message senders in one dropdown */}
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowPostDropdown((prev) => !prev);
            }}
          >
            <FaBell />
            {(
              postNotifications.length + Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)
            ) > 0 && (
              <span className="badge">{postNotifications.length + Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)}</span>
            )}

            {showPostDropdown && (
              <div className="notification-dropdown" onClick={(e) => e.stopPropagation()} style={{
                  position: "absolute",
                  top: "45px",
                  right: "0",
                  width: "360px",
                  maxHeight: "420px",
                  overflowY: "auto",
                  background: "#fff",
                  borderRadius: 10,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                  zIndex: 1000,
                  padding: 6,
                }}>
                {totalNotifications === 0 ? (
                  <p className="muted">No new notifications</p>
                ) : (
                  <div>
                    {/* Posts section */}
                    {postNotifications.length > 0 && (
                      <div>
                        <div className="notification-section-title">Posts</div>
                        {postNotifications.map((n) => (
                          <div
                            key={n.notificationId}
                            className="notification-row"
                            onClick={async () => {
                              try {
                                await axios.post("http://127.0.0.1:5000/api/mark_post_notification_read", {
                                  notificationId: n.notificationId,
                                });
                              } catch (err) {
                                console.warn("Failed to mark notification:", err);
                              }

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
                            style={{
                              padding: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              cursor: "pointer",
                              borderBottom: "1px solid #f0f0f0",
                              transition: "background 120ms ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                          >
                            <img src={n.adminProfile || "/default-profile.png"} alt={n.adminName} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: "block", marginBottom: 4 }}>{n.adminName}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{n.message}</p>
                            </div>
                            <div style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>{new Date(n.time || n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Messages section */}
                    {messageCount > 0 && (
                      <div>
                        <div className="notification-section-title" style={{ padding: '8px 10px', color: '#333', fontWeight: 700, background: '#fafafa', borderRadius: 6, margin: '8px 6px' }}>Messages</div>
                        {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                              <div
                                key={userId}
                                className="notification-row"
                                onClick={async () => {
                                  await markMessagesAsSeen(userId);
                                  setUnreadSenders((prev) => {
                                    const copy = { ...prev };
                                    delete copy[userId];
                                    return copy;
                                  });
                                  setShowPostDropdown(false);
                                  navigate("/all-chat", { state: { user: { userId, name: sender.name, profileImage: sender.profileImage, type: sender.type } } });
                                }}
                                style={{
                                  padding: 10,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  cursor: "pointer",
                                  borderBottom: "1px solid #f0f0f0",
                                  transition: "background 120ms ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                              >
                                <img src={sender.profileImage || "/default-profile.png"} alt={sender.name} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <strong style={{ display: "block", marginBottom: 4 }}>{sender.name}</strong>
                                  <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{sender.count} new message{sender.count > 1 && "s"}</p>
                                </div>
                              </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Messenger icon: only counts messages and navigates straight to /all-chat */}
          <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/all-chat") }>
            <FaFacebookMessenger />
            {Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0) > 0 && (
              <span className="badge">{Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)}</span>
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
           <p>{admin?.adminId || "username"}</p>
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
              <div style={{ background: "rgb(206, 218, 248)", padding: "25px 10px", height: 250, margin: "-25px -25px 20px", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }}>
                <div style={{ width: 100, height: 100, margin: "20px auto 15px", borderRadius: "50%", overflow: "hidden", border: "4px solid #4b6cb7" }}>
                  <img src={selectedParent.profileImage} alt={selectedParent.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <h2 style={{ margin: 0, fontSize: 22, marginTop: -10, color: "#333" }}>{selectedParent.name}</h2>
                <h2 style={{ margin: 0, fontSize: 16, marginTop: 0, color: "#585656ff" }}>{selectedParent.email}</h2>
              </div>

             <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {["Details", "Children", "Status"].map((t) => (
                      <button key={t} onClick={() => setParentTab(t)} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "none", cursor: "pointer", background: parentTab === t ? "#4b6cb7" : "#f0f0f0", color: parentTab === t ? "#fff" : "#333", fontWeight: 700 }}>
                        {t}
                      </button>
                    ))}
                  </div>

                  <div style={{ paddingBottom: 40 }}>
                 {parentTab === "Details" && (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 28,
      padding: isPortrait ? 50 : 50,
      marginLeft: 0,
      marginRight: 0,
      borderRadius: 0,
      background: "linear-gradient(180deg,#eef2ff,#f8fafc)",
      fontFamily: "Inter, system-ui",
    }}
  >
    {/* ================= LEFT COLUMN ================= */}
    <div>
      {/* PARENT DETAILS */}
      <div
        style={{
          fontSize: 24,
          fontWeight: 900,
          marginBottom: 18,
          marginTop: -30,
          background: "linear-gradient(90deg,#2563eb,#7c3aed)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Parent Details
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: 68,
          rowGap: 14,
        }}
      >
        {[
      
          ["Email", selectedParent.email || "N/A"],
          ["Phone", selectedParent.phone || "N/A"],
          ["Relationship(s)", (selectedParent.relationships && selectedParent.relationships.length) ? selectedParent.relationships.join(", ") : "—"],
          ["Age", selectedParent.age || "—"],
          ["City", selectedParent.city || (selectedParent.address && typeof selectedParent.address === 'object' ? selectedParent.address.city : selectedParent.city) || "—"],
          ["Citizenship", selectedParent.citizenship || "—"],
          ["Job", selectedParent.job || "—"],
          ["Status", selectedParent.status ? (selectedParent.status.charAt(0).toUpperCase() + selectedParent.status.slice(1)) : "—"],
          ["Address", (typeof selectedParent.address === 'string' ? selectedParent.address : (selectedParent.address && (selectedParent.address.street || selectedParent.address.city || JSON.stringify(selectedParent.address))) ) || "—", true],
        ].map(([label, value, span]) => (
          <div
            key={label}
            style={{
              padding: 18,
              borderRadius: 20,
              background: "#ffffff",
              boxShadow: "0 6px 10px rgba(0,0,0,0.08)",
              marginLeft: -30,
              marginRight: -30,
              gridColumn: span ? "span 2" : "span 1",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#000102",
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 16,
                fontWeight: 400,
                color: "#000102",
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

     
    </div>
  </div>
)}

       {parentTab === "Children" && (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 20,
      background: "#f5f7fa",
      padding: 18,
      borderRadius: 10,
    }}
  >
    {children.map((c) => (
      <div
        key={c.studentId}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 22,
          background: "#fff",
          borderRadius: 16,
          padding: "22px 30px",
          boxShadow: "0 4px 24px rgba(80,90,130,0.10)",
          border: "1px solid #edeef2",
          transition: "box-shadow 0.2s, transform 0.18s",
          cursor: "pointer",
        }}
        onMouseEnter={e =>
          (e.currentTarget.style.boxShadow =
            "0 8px 32px 0 rgba(60,72,120,0.17)")
        }
        onMouseLeave={e =>
          (e.currentTarget.style.boxShadow =
            "0 4px 24px rgba(80,90,130,0.10)")
        }
      >
        {/* Profile Image */}
        <img
          src={c.profileImage}
          alt={c.name}
          style={{
            width: 66,
            height: 66,
            borderRadius: "50%",
            border: "3px solid #2868f1",
            objectFit: "cover",
            background: "#f0f4fa",
            flexShrink: 0,
            boxShadow: "0 2px 8px 0 rgba(60,72,120,0.07)",
          }}
        />
        {/* User Info */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontWeight: 700, fontSize: 21, color: "#213052", marginBottom: 2, marginLeft: -99 }}>
            {c.name}
          </span>
          
          {/* Badges Row */}
          <div style={{ display: "flex", columnGap: 1, marginTop: -12, marginLeft: -21 }}>
            <div
              style={{
             
                color: "#050505",
                fontWeight: 400,
                fontSize: 14,
                padding: "6px 18px",
                borderRadius: 999,
                letterSpacing: 0.5,
                boxShadow: "0 2px 8px rgba(22,119,255,.09)",
              }}
            >
              Grade:{c.grade}
            </div>
            <div
              style={{
              
                color: "#000000",
                fontWeight: 400,
                fontSize: 14,
                padding: "6px 1px",
                borderRadius: 999,
                letterSpacing: 0.5,
                boxShadow: "0 2px 8px rgba(255,126,95,.09)",
              }}
            >
              Section:{c.section}
            </div>
          </div>
          <span style={{ fontSize: 15, color: "#424242", marginTop: "-10px", marginLeft: -115 }}>
            {c.relationship && `Relation: ${c.relationship}`}
          </span>
        </div>
      </div>
    ))}
  </div>
)}
                    {parentTab === "Status" && (
                      <div>
                        <p><strong>Status:</strong> {selectedParent.status || "Active"}</p>
                        <p><strong>Created:</strong> {selectedParent.createdAt ? new Date(selectedParent.createdAt).toLocaleString() : "—"}</p>
                      </div>
                    )}
                  </div>

              {/* Chat button & Popup - matches Students UI */}
              {!parentChatOpen && (
                <div
                  onClick={() => setParentChatOpen(true)}
                  style={{
                    position: "fixed",
                    bottom: "20px",
                    right: "20px",
                    width: "60px",
                    height: "60px",
                    background: "linear-gradient(135deg, #833ab4, #0259fa, #459afc)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    cursor: "pointer",
                    zIndex: 1000,
                    boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  <FaCommentDots size={30} />
                </div>
              )}

              {parentChatOpen && selectedParent && (
                <div
                  style={{
                    position: "fixed",
                    bottom: "20px",
                    right: "20px",
                    width: "360px",
                    height: "480px",
                    background: "#fff",
                    borderRadius: "16px",
                    boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
                    zIndex: 2000,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  {/* HEADER */}
                  <div style={{ padding: "14px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fafafa" }}>
                    <strong>{selectedParent.name}</strong>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        onClick={() => {
                          setParentChatOpen(false);
                          navigate("/all-chat", { state: { user: selectedParent, tab: "parent" } });
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}
                      >
                        ⤢
                      </button>
                      <button onClick={() => setParentChatOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>×</button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", background: "#f9f9f9" }}>
                    {messages.length === 0 ? (
                      <p style={{ textAlign: "center", color: "#aaa" }}>Start chatting with {selectedParent.name}</p>
                    ) : (
                      messages.map((m) => {
                        const isAdmin = String(m.senderId) === String(admin.userId);
                        return (
                          <div key={m.messageId || m.id} style={{ display: "flex", flexDirection: "column", alignItems: isAdmin ? "flex-end" : "flex-start", marginBottom: 10 }}>
                            <div style={{ maxWidth: "70%", background: isAdmin ? "#4facfe" : "#fff", color: isAdmin ? "#fff" : "#000", padding: "10px 14px", borderRadius: 18, borderTopRightRadius: isAdmin ? 0 : 18, borderTopLeftRadius: isAdmin ? 18 : 0, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", wordBreak: "break-word", cursor: "default", position: "relative" }}>
                              {m.text} {m.edited && (<small style={{ fontSize: 10 }}> (edited)</small>)}
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 6, fontSize: 11, color: isAdmin ? "#fff" : "#888" }}>
                                <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>{formatDateLabel(m.timeStamp)}</span>
                                <span>{formatTime(m.timeStamp)}</span>
                                {isAdmin && !m.deleted && (
                                  <span style={{ display: "flex", gap: 0, alignItems: "center" }}>
                                    <FaCheck size={10} color={isAdmin ? "#fff" : "#888"} style={{ opacity: 0.90, marginLeft: 2 }} />
                                    {m.seen && (<FaCheck size={10} color={isAdmin ? "#f3f7f8" : "#ccc"} style={{ marginLeft: -6, opacity: 0.95 }} />)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div style={{ padding: "10px", borderTop: "1px solid #eee", display: "flex", gap: "8px", background: "#fff" }}>
                    <input value={newMessageText} onChange={(e) => setNewMessageText(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: "10px 14px", borderRadius: "25px", border: "1px solid #ccc", outline: "none" }} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(newMessageText); }} />
                    <button onClick={() => sendMessage(newMessageText)} style={{ width: 45, height: 45, borderRadius: "50%", background: "#4facfe", border: "none", color: "#fff", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
                      <FaPaperPlane />
                    </button>
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