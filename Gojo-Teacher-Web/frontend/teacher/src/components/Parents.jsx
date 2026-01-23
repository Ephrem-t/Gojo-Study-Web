import React, { useState, useEffect, useRef } from "react";
import {
  FaHome,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaSearch,
  FaBell,
  FaClipboardCheck,
  FaUsers,
  FaFacebookMessenger,
  FaCommentDots,
} from "react-icons/fa";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { ref, onValue, off } from "firebase/database";
import { db } from "../firebase"; // adjust path if needed
import "../styles/global.css";

/**
 * TeacherParent (responsive)
 *
 * - Keeps existing behavior.
 * - Right sidebar becomes a sheet on small screens / portrait (fills viewport).
 * - Adds overlay and prevents background scroll while sidebar is open.
 * - Adds a close button at the top of the sidebar.
 * - Minor polish to layout so it adapts to narrow viewports.
 */

const getChatId = (id1, id2) => [id1, id2].sort().join("_");
const API_BASE = "http://127.0.0.1:5000/api";
const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

function TeacherParent() {
const [teacher, setTeacher] = useState(null);
  const [parents, setParents] = useState([]);
  const [selectedParent, setSelectedParent] = useState(null);
  const [loading, setLoading] = useState(true);
const [activeTab, setActiveTab] = useState("Details"); // default tab
 const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const messagesEndRef = useRef(null);
const [children, setChildren] = useState([]);
 const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState(null);

  const [showMessenger, setShowMessenger] = useState(false);
    const [conversations, setConversations] = useState([]);
  
  const navigate = useNavigate();

  // detect portrait (width < height) and small screens
  const [isPortrait, setIsPortrait] = useState(window.innerWidth < window.innerHeight);
  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerWidth < window.innerHeight);
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // load teacher from localStorage
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // fetch parents & related data
  useEffect(() => {
    if (!teacher) return;
    let cancelled = false;

    const fetchParents = async () => {
      try {
        setLoading(true);

        const [assignmentsRes, coursesRes, studentsRes, usersRes, parentsRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/TeacherAssignments.json`),
          axios.get(`${RTDB_BASE}/Courses.json`),
          axios.get(`${RTDB_BASE}/Students.json`),
          axios.get(`${RTDB_BASE}/Users.json`),
          axios.get(`${RTDB_BASE}/Parents.json`),
        ]);

        const assignments = assignmentsRes.data || {};
        const courses = coursesRes.data || {};
        const students = studentsRes.data || {};
        const users = usersRes.data || {};
        const parentsData = parentsRes.data || {};

        const teacherId = teacher.userId;

        // teacher's courses (you can re-enable filtering if you want)
        const teacherCourseIds = Object.values(assignments)
          .filter((a) => a.teacherId === teacherId)
          .map((a) => a.courseId);

        // Build student->parent map
        const studentToParentMap = {};
        Object.entries(parentsData).forEach(([parentId, parent]) => {
          if (!parent.children) return;
          Object.values(parent.children).forEach((child) => {
            if (!child.studentId) return;
            if (!studentToParentMap[child.studentId]) studentToParentMap[child.studentId] = [];
            studentToParentMap[child.studentId].push(parentId);
          });
        });

        // Build parent->children (use all students; you can filter by teacherCourses if desired)
        const parentChildrenMap = {};
        Object.entries(students).forEach(([studentId, student]) => {
          const studentUser = Object.values(users).find((u) => String(u.userId) === String(student.userId));
          const studentName = studentUser?.name || "No Name";
          const studentProfileImage = studentUser?.profileImage || "/default-profile.png";

          const parentIds = studentToParentMap[studentId] || [];
          parentIds.forEach((pid) => {
            if (!parentChildrenMap[pid]) parentChildrenMap[pid] = [];
            parentChildrenMap[pid].push({
              studentId,
              name: studentName,
              grade: student.grade,
              section: student.section,
              profileImage: studentProfileImage,
              userId: student.userId,
            });
          });
        });

        const finalParents = Object.keys(parentChildrenMap).map((pid) => {
          const parent = parentsData[pid] || {};
          const parentUser = Object.values(users).find((u) => String(u.userId) === String(parent.userId)) || {};
          return {
            id: pid,
            userId: parent.userId,
            name: parentUser.name || parent.name || "No Name",
            email: parentUser.email || parent.email || "N/A",
            phone: parentUser.phone || parent.phone || "",
            profileImage: parentUser.profileImage || parent.profileImage || "/default-profile.png",
            children: parentChildrenMap[pid],
            status: parent.status || "Active",
            createdAt: parent.createdAt,
            address: parent.address,
            extra: parent.extra,
          };
        });

        if (!cancelled) setParents(finalParents);
      } catch (err) {
        console.error("Error fetching parents:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchParents();
    return () => {
      cancelled = true;
    };
  }, [teacher]);

  // Scroll to bottom when new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // fetch messages when chat popup open for selectedParent
  useEffect(() => {
    if (!selectedParent || !teacher || !chatOpen) return;
    const chatId = getChatId(teacher.userId, selectedParent.userId);
    const messagesRef = ref(db, `Chats/${chatId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const msgs = Object.entries(data).map(([id, msg]) => ({ messageId: id, ...msg }));
      msgs.sort((a, b) => a.timeStamp - b.timeStamp);
      setMessages(msgs);
    });
    markAsSeen(chatId);
    return () => off(messagesRef);
  }, [selectedParent, teacher, chatOpen]);

  const sendMessage = async (text) => {
    if (!text?.trim() || !selectedParent || !teacher) return;
    const senderId = teacher.userId;
    const receiverId = selectedParent.userId;
    const chatId = getChatId(senderId, receiverId);
    const timeStamp = Date.now();
    const message = { senderId, receiverId, type: "text", text, seen: false, timeStamp };
    try {
      await axios.post(`${RTDB_BASE}/Chats/${chatId}/messages.json`, message);
      await axios.patch(`${RTDB_BASE}/Chats/${chatId}.json`, {
        participants: { [senderId]: true, [receiverId]: true },
        lastMessage: { text, senderId, seen: false, timeStamp },
        unread: { [senderId]: 0, [receiverId]: 1 },
      });
      setNewMessageText("");
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  const markAsSeen = async (chatId) => {
    try {
      await axios.patch(`${RTDB_BASE}/Chats/${chatId}/unread.json`, { [teacher.userId]: 0 });
      await axios.patch(`${RTDB_BASE}/Chats/${chatId}/lastMessage.json`, { seen: true });
    } catch (err) {
      console.error("Mark as seen error:", err);
    }
  };

  // notifications & messenger (kept as in your original)

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${API_BASE}/get_posts`);
        let postsData = res.data || [];
        if (!Array.isArray(postsData) && typeof postsData === "object") postsData = Object.values(postsData);
        const [adminsRes, usersRes] = await Promise.all([axios.get(`${RTDB_BASE}/School_Admins.json`), axios.get(`${RTDB_BASE}/Users.json`)]);
        const schoolAdmins = adminsRes.data || {};
        const users = usersRes.data || {};
        const teacherLocal = JSON.parse(localStorage.getItem("teacher"));
        const seenPosts = getSeenPosts(teacherLocal?.userId);
        const resolveAdminInfo = (post) => {
          const adminId = post.adminId || post.posterAdminId || post.poster || post.admin || null;
          if (adminId && schoolAdmins[adminId]) {
            const sa = schoolAdmins[adminId];
            const userKey = sa.userId;
            const userRec = users[userKey] || null;
            const name = (userRec && userRec.name) || sa.name || post.adminName || "Admin";
            const profile = (userRec && userRec.profileImage) || sa.profileImage || post.adminProfile || "/default-profile.png";
            return { name, profile };
          }
          return { name: post.adminName || "Admin", profile: post.adminProfile || "/default-profile.png" };
        };
        const latest = postsData
          .slice()
          .sort((a, b) => ((b.time ? new Date(b.time).getTime() : 0) - (a.time ? new Date(a.time).getTime() : 0)))
          .filter((post) => post.postId && !seenPosts.includes(post.postId))
          .slice(0, 5)
          .map((post) => {
            const info = resolveAdminInfo(post);
            return { id: post.postId, title: post.message?.substring(0, 50) || "Untitled post", adminName: info.name, adminProfile: info.profile };
          });
        setNotifications(latest);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };
    fetchNotifications();
  }, []);

  function getSeenPosts(teacherId) {
    return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
  }
  function saveSeenPost(teacherId, postId) {
    const seen = getSeenPosts(teacherId);
    if (!seen.includes(postId)) localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seen, postId]));
  }

  // messenger conversations fetch
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
      const usersByKey = users || {};
      const userKeyByUserId = {};
      Object.entries(usersByKey).forEach(([pushKey, u]) => { if (u && u.userId) userKeyByUserId[u.userId] = pushKey; });
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
            if (mapped) { otherPushKey = mapped; otherRecord = usersByKey[mapped]; }
          }
          if (!otherRecord) otherRecord = { userId: otherKeyCandidate, name: otherKeyCandidate, profileImage: "/default-profile.png" };
          const contact = { pushKey: otherPushKey, userId: otherRecord.userId || otherKeyCandidate, name: otherRecord.name || otherRecord.username || otherKeyCandidate, profileImage: otherRecord.profileImage || otherRecord.profile || "/default-profile.png" };
          const lastMessage = chat.lastMessage || {};
          return { chatId, contact, displayName: contact.name, profile: contact.profileImage, lastMessageText: lastMessage.text || "", lastMessageTime: lastMessage.timeStamp || lastMessage.time || null, unreadForMe };
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
    navigate("/all-chat", { state: { contact, chatId, tab: "parents" } });
    try {
      await axios.put(`${RTDB_BASE}/Chats/${chatId}/unread/${teacher.userId}.json`, null);
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }
    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };

  const totalUnreadMessages = conversations.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);

  // Prevent background scroll while sidebar is open (applies on small screens)
  useEffect(() => {
    if (selectedParent) {
      document.body.classList.add("sidebar-open");
    } else {
      document.body.classList.remove("sidebar-open");
    }
    return () => document.body.classList.remove("sidebar-open");
  }, [selectedParent]);

  // Render
  return (
    <div className="dashboard-page">
      {/* Top Navbar */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>

        <div className="nav-right">
          <div className="icon-circle" style={{ position: "relative" }}>
            <div onClick={() => setShowNotifications(!showNotifications)} style={{ cursor: "pointer", position: "relative" }}>
              <FaBell size={24} />
              {notifications.length > 0 && (
                <span style={{ position: "absolute", top: -5, right: -5, background: "red", color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {notifications.length}
                </span>
              )}
            </div>

            {showNotifications && (
              <div style={{ position: "absolute", top: 30, right: 0, width: 300, maxHeight: 400, overflowY: "auto", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.2)", borderRadius: 8, zIndex: 100 }}>
                {notifications.length > 0 ? notifications.map((post, index) => (
                  <div key={post.id || index} onClick={() => { saveSeenPost(teacher?.userId, post.id); setNotifications(prev => prev.filter((_, i) => i !== index)); setShowNotifications(false); navigate("/dashboard"); }} style={{ display: "flex", alignItems: "center", padding: "10px 15px", borderBottom: "1px solid #eee", cursor: "pointer" }}>
                    <img src={post.adminProfile} alt={post.adminName} style={{ width: 35, height: 35, borderRadius: "50%", marginRight: 10 }} />
                    <div><strong>{post.adminName}</strong><p style={{ margin: 0, fontSize: 12 }}>{post.title}</p></div>
                  </div>
                )) : <div style={{ padding: 15 }}>No notifications</div>}
              </div>
            )}
          </div>

          <div className="icon-circle" style={{ position: "relative", marginLeft: 12 }}>
            <div onClick={handleMessengerToggle} style={{ cursor: "pointer", position: "relative" }}>
              <FaFacebookMessenger size={22} />
              {totalUnreadMessages > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, background: "#0b78f6", color: "#fff", borderRadius: "50%", minWidth: 18, height: 18, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
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
          <img src={teacher?.profileImage || "/default-profile.png"} alt="profile" style={{ width: 36, height: 36, borderRadius: "50%" }} />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex" }}>
        {/* Sidebar */}
        <div className="google-sidebar">
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
            <Link className="sidebar-btn" to="/parents" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaChalkboardTeacher /> Parents</Link>
            <Link className="sidebar-btn" to="/marks"><FaClipboardCheck /> Marks</Link>
            <Link className="sidebar-btn" to="/attendance"><FaUsers /> Attendance</Link>
            <Link className="sidebar-btn" to="/schedule"><FaUsers /> Schedule</Link>
            <button className="sidebar-btn logout-btn" onClick={handleLogout}><FaSignOutAlt /> Logout</button>
          </div>
        </div>

        {/* MAIN */}
        <main style={{ flex: 1, padding: 30 }}>
          <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            <section style={{ flex: "1 1 320px", minWidth: 280 }}>
              <h2 style={{ textAlign: "center", marginBottom: 20, color: "#4b6cb7", fontWeight: 700 }}>Parents</h2>

              {loading ? (
                <p style={{ textAlign: "center", fontSize: 18, color: "#555" }}>Loading...</p>
              ) : parents.length === 0 ? (
                <p style={{ textAlign: "center", fontSize: 18, color: "#999" }}>No parents found.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                  {parents.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedParent(p)}
                      style={{
                        display: "flex",
                        gap: 15,
                        width: "calc(100% - 50px)",
                        padding: 16,
                        marginLeft: 50,
                        borderRadius: 12,
                        boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
                        backgroundColor: selectedParent?.id === p.id ? "#f0f4ff" : "#fff",
                        cursor: "pointer",
                        alignItems: "center",
                      }}
                    >
                      <img src={p.profileImage} alt={p.name} style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover" }} />
                      <div>
                        <h3 style={{ margin: 0, fontSize: 18 }}>{p.name}</h3>
                        <p style={{ margin: "6px 0 0 0", color: "#777" }}>{p.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Responsive Right Sidebar */}
            {selectedParent && (
              <>
                {/* overlay for mobile/portrait */}
                <div
                  className="parent-sidebar-overlay"
                  onClick={() => setSelectedParent(null)}
                  style={{ display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 999 }}
                />

                <aside
                  className="parent-sidebar"
                  style={{
                    width: isPortrait ? "100%" : 420,
                    height: isPortrait ? "100vh" : "calc(100vh - 60px)",
                    position: "fixed",
                    right: 0,
                    top: isPortrait ? 0 : 60,
                    background: "#fff",
                    boxShadow: isPortrait ? "none" : "0 0 20px rgba(0,0,0,0.06)",
                    zIndex: 1000,
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                    padding: isPortrait ? 18 : 24,
                    transition: "all 0.32s ease",
                  }}
                  role="dialog"
                  aria-modal="true"
                >
                  {/* close button */}
                  <button
                    onClick={() => setSelectedParent(null)}
                    style={{
                      position: "absolute",
                      top: isPortrait ? 8 : -11,
                      right: 18,
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      border: "none",
                      background: "#fff",
                      boxShadow: "0 8px 18px rgba(2,6,23,0.08)",
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                      zIndex: 1010,
                      fontSize: 20,
                    }}
                    aria-label="Close details"
                  >
                    ×
                  </button>

                  <div style={{ textAlign: "center", marginBottom: 12 }}>
                    <div style={{ width: 100, height: 100, margin: "0 auto 12px", borderRadius: "50%", overflow: "hidden", border: "4px solid #4b6cb7" }}>
                      <img src={selectedParent.profileImage} alt={selectedParent.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <h3 style={{ margin: 0 }}>{selectedParent.name}</h3>
                    <div style={{ color: "#666", marginTop: 6 }}>{selectedParent.email}</div>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {["Details", "Children", "Status"].map((t) => (
                      <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "none", cursor: "pointer", background: activeTab === t ? "#4b6cb7" : "#f0f0f0", color: activeTab === t ? "#fff" : "#333", fontWeight: 700 }}>
                        {t}
                      </button>
                    ))}
                  </div>

                  <div style={{ paddingBottom: 40 }}>
                    {activeTab === "Details" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {[
                          { label: "User ID", value: selectedParent.userId },
                          { label: "Email", value: selectedParent.email || "N/A" },
                          { label: "Phone", value: selectedParent.phone || "N/A" },
                          { label: "Address", value: selectedParent.address || "N/A" },
                          { label: "Extra", value: selectedParent.extra || "N/A", span: true },
                        ].map((it, idx) => (
                          <div key={idx} style={{ background: "#f7f9fc", padding: 12, borderRadius: 10, gridColumn: it.span ? "span 2" : "span 1" }}>
                            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>{it.label}</div>
                            <div style={{ fontWeight: 800 }}>{it.value}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === "Children" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {selectedParent.children.map((c) => (
                          <div key={c.studentId} style={{ display: "flex", gap: 12, alignItems: "center", background: "#fff", padding: 12, borderRadius: 10 }}>
                            <img src={c.profileImage} alt={c.name} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "2px solid #4b6cb7" }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 800, color: "#0b1220" }}>{c.name}</div>
                              <div style={{ color: "#64748b", fontSize: 13 }}>{c.userId}</div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <div style={{ background: "linear-gradient(135deg,#6a11cb,#2575fc)", color: "#fff", padding: "6px 10px", borderRadius: 999 }}>Grade {c.grade}</div>
                              <div style={{ background: "linear-gradient(135deg,#ff7e5f,#feb47b)", color: "#fff", padding: "6px 10px", borderRadius: 999 }}>Section {c.section}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === "Status" && (
                      <div>
                        <p><strong>Status:</strong> {selectedParent.status || "Active"}</p>
                        <p><strong>Created:</strong> {selectedParent.createdAt ? new Date(selectedParent.createdAt).toLocaleString() : "—"}</p>
                      </div>
                    )}
                  </div>


 {/* Chat Button */}
      {!chatOpen && (
        <div
          onClick={() => setChatOpen(true)}
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: "50px",
            height: "50px",
            background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
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
          <FaCommentDots size={24} />
        </div>
      )}


{chatOpen && selectedParent && (
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
          <div
            style={{
              padding: "14px",
              borderBottom: "1px solid #eee",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#fafafa",
            }}
          >
            <strong>{selectedParent.name}</strong>

            <div style={{ display: "flex", gap: "10px" }}>
              {/* Expand */}
              
              <button
  onClick={() => {
    setChatOpen(false); // properly close popup
    navigate("/all-chat", {
      state: {
        user: selectedParent, // user to auto-select
        tab: "parent",        // tab type
      },
    });
  }}
  style={{
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "18px",
  }}
>
  ⤢
</button>


              {/* Close */}
              <button
                onClick={() => setChatOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              padding: "12px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              background: "#f9f9f9",
            }}
          >
            {messages.length === 0 ? (
              <p style={{ textAlign: "center", color: "#aaa" }}>
                Start chatting with {selectedParent.name}
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.messageId}
                  style={{
                    display: "flex",
                    justifyContent:
                      m.senderId === teacher.userId ? "flex-end" : "flex-start",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "8px 14px",
                      borderRadius: "20px",
                      background:
                        m.senderId === teacher.userId ? "#4b6cb7" : "#e5e5ea",
                      color: m.senderId === teacher.userId ? "#fff" : "#000",
                      maxWidth: "70%",
                      wordWrap: "break-word",
                      transition: "all 0.2s",
                    }}
                  >
                    {m.text}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "10px",
              borderTop: "1px solid #eee",
              display: "flex",
              gap: "8px",
              background: "#fff",
            }}
          >
            <input
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "999px",
                border: "1px solid #ccc",
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage(newMessageText);
              }}
            />
            <button
              onClick={() => sendMessage(newMessageText)}
              style={{
                background:
                  "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
                border: "none",
                borderRadius: "50%",
                width: "42px",
                height: "42px",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}




                </aside>

                {/* component-scoped CSS for responsive behavior */}
                <style>{`
                  @media (max-width: 900px), (orientation: portrait) {
                    .parent-sidebar { width: 100vw !important; height: 100vh !important; left: 0 !important; top: 0 !important; border-radius: 0 !important; padding: 16px !important; }
                    .parent-sidebar-overlay { display: block !important; }
                    body.sidebar-open { overflow: hidden !important; }
                  }
                `}</style>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default TeacherParent;