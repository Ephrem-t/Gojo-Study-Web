import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaUsers,
  FaSearch,
  FaRegHeart,
  FaHeart,
  FaClipboardCheck,
  FaFacebookMessenger,
} from "react-icons/fa";
import axios from "axios";
import "../styles/global.css";

const API_BASE = "http://127.0.0.1:5000/api";
const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

export default function Dashboard() {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [posts, setPosts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);

  // Messenger state
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]); // only conversations that have unread messages for me
  const postRefs = useRef({});
  const postRefsRerender = useRef(0);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("teacher"));
    if (!stored) {
      navigate("/login");
      return;
    }
    setTeacher(stored);
    fetchPostsAndAdmins();
    fetchConversations(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch posts and resolve admin info
  const fetchPostsAndAdmins = async () => {
    try {
      const postsResp = await axios.get(`${API_BASE}/get_posts`);
      let postsData = postsResp.data || [];
      if (!Array.isArray(postsData) && typeof postsData === "object")
        postsData = Object.values(postsData);

      const [adminsResp, usersResp] = await Promise.all([
        axios.get(`${RTDB_BASE}/School_Admins.json`),
        axios.get(`${RTDB_BASE}/Users.json`),
      ]);
      const schoolAdmins = adminsResp.data || {};
      const users = usersResp.data || {};

      const resolveAdminInfo = (adminId) => {
        if (!adminId) return { name: "Admin", profile: "/default-profile.png" };
        const adminRec = schoolAdmins[adminId];
        if (!adminRec) return { name: adminId, profile: "/default-profile.png" };
        const userKey = adminRec.userId;
        const userRec = userKey ? users[userKey] : null;
        const name = userRec?.name || adminRec?.title || adminId;
        const profile = userRec?.profileImage || "/default-profile.png";
        return { name, profile };
      };

      const finalPosts = postsData.map((post) => {
        const postId = post.postId || post.id || post.key || "";
        const { name, profile } = resolveAdminInfo(post.adminId);
        let likesArray = [];
        if (Array.isArray(post.likes)) likesArray = post.likes;
        else if (post.likes && typeof post.likes === "object")
          likesArray = Object.keys(post.likes);

        const timeValue = post.time || post.timestamp || post.createdAt || null;

        return {
          ...post,
          postId,
          adminName: name,
          adminProfile: profile,
          time: timeValue,
          likes: likesArray,
          likeCount: post.likeCount || likesArray.length || 0,
        };
      });

      finalPosts.sort((a, b) => {
        const ta = a.time ? new Date(a.time).getTime() : 0;
        const tb = b.time ? new Date(b.time).getTime() : 0;
        return tb - ta;
      });

      setPosts(finalPosts);

      const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
      const seenPosts = getSeenPosts(storedTeacher?.userId);

      const notifs = finalPosts
        .filter((p) => !seenPosts.includes(p.postId))
        .slice(0, 5)
        .map((p) => ({
          id: p.postId,
          title: p.message?.substring(0, 80) || "Untitled post",
          adminName: p.adminName,
          adminProfile: p.adminProfile,
        }));

      setNotifications(notifs);
    } catch (err) {
      console.error("Error fetching posts/admins handshake:", err);
    }
  };

  const handleLikePost = async (postId) => {
    if (!teacher) return;
    try {
      const res = await axios.post(`${API_BASE}/like_post`, {
        postId,
        teacherId: teacher.userId,
      });
      if (res.data.success) {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.postId !== postId) return p;
            const likesSet = new Set(p.likes || []);
            if (res.data.liked) likesSet.add(teacher.userId);
            else likesSet.delete(teacher.userId);
            return { ...p, likes: Array.from(likesSet), likeCount: res.data.likeCount };
          })
        );
      }
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  };

  // Seen posts local storage helpers
  const getSeenPosts = (teacherId) => {
    return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
  };

  const saveSeenPost = (teacherId, postId) => {
    const seen = getSeenPosts(teacherId);
    if (!seen.includes(postId)) {
      localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seen, postId]));
    }
  };

  // Remove notification after click (and mark seen locally)
  const handleNotificationClick = (postId) => {
    if (!teacher) return;
    saveSeenPost(teacher.userId, postId);
    setHighlightedPostId(postId);
    const el = postRefs.current[postId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setNotifications((prev) => prev.filter((n) => n.id !== postId));
    setShowNotifications(false);
    setTimeout(() => setHighlightedPostId(null), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // ---------------- MESSENGER: fetch conversations with unread messages ----------------
 // Replace fetchConversations in Dashboard with this:
const fetchConversations = async (currentTeacher = teacher) => {
  try {
    const t = currentTeacher || JSON.parse(localStorage.getItem("teacher"));
    if (!t || !t.userId) {
      setConversations([]);
      return;
    }

    const [chatsRes, usersRes] = await Promise.all([
      axios.get(`${RTDB_BASE}/Chats.json`),
      axios.get(`${RTDB_BASE}/Users.json`),
    ]);
    const chats = chatsRes.data || {};
    const users = usersRes.data || {};

    // map user.pushKey -> record and userId -> pushKey
    const usersByKey = users || {};
    const userKeyByUserId = {};
    Object.entries(usersByKey).forEach(([pushKey, u]) => {
      if (u && u.userId) userKeyByUserId[u.userId] = pushKey;
    });

    const convs = Object.entries(chats)
      .map(([chatId, chat]) => {
        const unreadMap = chat.unread || {};
        const unreadForMe = unreadMap[t.userId] || 0;
        if (!unreadForMe) return null; // only show convs with unread messages

        const participants = chat.participants || {};
        // find the "other" participant key (could be pushKey or a userId)
        const otherKeyCandidate = Object.keys(participants || {}).find((p) => p !== t.userId);
        if (!otherKeyCandidate) return null;

        // Try to resolve the other participant to a Users pushKey + record
        let otherPushKey = otherKeyCandidate;
        let otherRecord = usersByKey[otherPushKey];

        if (!otherRecord) {
          // otherKeyCandidate might be a user.userId; map to pushKey
          const mappedPushKey = userKeyByUserId[otherKeyCandidate];
          if (mappedPushKey) {
            otherPushKey = mappedPushKey;
            otherRecord = usersByKey[mappedPushKey];
          }
        }

        // If still not found, fall back to a minimal contact (use candidate as userId)
        if (!otherRecord) {
          otherRecord = { userId: otherKeyCandidate, name: otherKeyCandidate, profileImage: "/default-profile.png" };
        }

        const contact = {
          pushKey: otherPushKey,                       // may be undefined if unknown
          userId: otherRecord.userId || otherKeyCandidate,
          name: otherRecord.name || otherRecord.username || otherKeyCandidate,
          profileImage: otherRecord.profileImage || otherRecord.profile || "/default-profile.png",
        };

        const lastMessage = chat.lastMessage || {};

        return {
          chatId,
          contact, // full contact object we will pass when opening chat
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

// Replace handleOpenConversation in Dashboard with this:
const handleOpenConversation = async (conv, index) => {
  if (!teacher || !conv) return;
  const { chatId, contact } = conv;

  // Pass a concrete contact object to AllChat so it opens that exact person
  navigate("/all-chat", { state: { contact, chatId } });

  // Clear unread count for this teacher in RTDB (permanent)
  try {
    await axios.put(`${RTDB_BASE}/Chats/${chatId}/unread/${teacher.userId}.json`, null);
  } catch (err) {
    console.error("Failed to clear unread in DB:", err);
  }

  // Remove from UI immediately
  setConversations((prev) => prev.filter((_, i) => i !== index));
  setShowMessenger(false);
};

  // Toggle messenger and refresh conversations
  const handleMessengerToggle = async () => {
    setShowMessenger((s) => !s);
    await fetchConversations();
  };


  // total unread messages (sum of unreadForMe across conversations)
  const totalUnreadMessages = conversations.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);

  // Safe teacher for rendering
  const t = teacher || {};



  
  return (
    <div className="dashboard-page">
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
              <FaBell size={22} />
              {notifications.length > 0 && (
                <span style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "red",
                  color: "#fff",
                  borderRadius: "50%",
                  width: 18,
                  height: 18,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>{notifications.length}</span>
              )}
            </div>

            {showNotifications && (
              <div style={{
                position: "absolute",
                top: 34,
                right: 0,
                width: 340,
                maxHeight: 420,
                overflowY: "auto",
                background: "#fff",
                boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                borderRadius: 8,
                zIndex: 200
              }}>
                {notifications.length > 0 ? notifications.map((n, i) => (
                  <div key={n.id || i} onClick={() => handleNotificationClick(n.id)}
                    style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, borderBottom: "1px solid #eee", cursor: "pointer" }}>
                    <img src={n.adminProfile || "/default-profile.png"} alt={n.adminName || "Admin"} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                    <div>
                      <strong style={{ display: "block" }}>{n.adminName}</strong>
                      <div style={{ fontSize: 13, color: "#444" }}>{n.title}</div>
                    </div>
                  </div>
                )) : <div style={{ padding: 14 }}>No notifications</div>}
              </div>
            )}
          </div>

          {/* Messenger */}
          <div className="icon-circle" style={{ position: "relative", marginLeft: 12 }}>
            <div onClick={handleMessengerToggle} style={{ cursor: "pointer", position: "relative" }}>
              <FaFacebookMessenger size={22} />
              {/* show total unread messages (not people) */}
              {totalUnreadMessages > 0 && (
                <span style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "#0b78f6",
                  color: "#fff",
                  borderRadius: "50%",
                  minWidth: 18,
                  height: 18,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 5px"
                }}>
                  {totalUnreadMessages}
                </span>
              )}
            </div>

            {showMessenger && (
              <div style={{
                position: "absolute",
                top: 34,
                right: 0,
                width: 340,
                maxHeight: 420,
                overflowY: "auto",
                background: "#fff",
                boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                borderRadius: 8,
                zIndex: 200,
                padding: 8
              }}>
                {conversations.length === 0 ? (
                  <div style={{ padding: 14 }}>No unread messages</div>
                ) : conversations.map((conv, idx) => (
                  <div key={conv.chatId || idx}
                       onClick={() => handleOpenConversation(conv, idx)}
                       style={{ display: "flex", gap: 12, alignItems: "center", padding: 10, borderBottom: "1px solid #eee", cursor: "pointer" }}>
                    <img src={conv.profile || "/default-profile.png"} alt={conv.displayName} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{conv.displayName}</strong>
                        {conv.unreadForMe > 0 && (
                          <span style={{ background: "#0b78f6", color: "#fff", padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>
                            {conv.unreadForMe}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>{conv.lastMessageText || "No messages yet"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="icon-circle" onClick={() => navigate("/settings")}><FaCog /></div>

          <img src={t.profileImage || "/default-profile.png"} alt="teacher" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard">
        <div className="google-sidebar">
          <div className="sidebar-profile">
            <div className="sidebar-img-circle">
              <img src={t.profileImage || "/default-profile.png"} alt="profile" style={{ objectFit: "cover" }} />
            </div>
            <h3>{t.name || "—"}</h3>
            <p>{t.username || "—"}</p>
          </div>

          <div className="sidebar-menu">
            <Link className="sidebar-btn" to="/dashboard" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaHome /> Home</Link>
            <Link className="sidebar-btn" to="/students"><FaUsers /> Students</Link>
            <Link className="sidebar-btn" to="/admins"><FaUsers /> Admins</Link>
            <Link className="sidebar-btn" to="/parents"><FaChalkboardTeacher /> Parents</Link>
            <Link className="sidebar-btn" to="/marks"><FaClipboardCheck /> Marks</Link>
            <Link className="sidebar-btn" to="/attendance"><FaUsers /> Attendance</Link>
            <Link className="sidebar-btn" to="/schedule"><FaUsers /> Schedule</Link>

            <button className="sidebar-btn logout-btn" onClick={handleLogout}><FaSignOutAlt /> Logout</button>
          </div>
        </div>

        <div className="google-main">
          <div className="posts-container">
            {posts.length === 0 && <p>No posts available</p>}
            {posts.map((post) => (
              <div
                key={post.postId}
                ref={(el) => (postRefs.current[post.postId] = el)}
                className="post-card"
                style={{
                  border: highlightedPostId === post.postId ? "2px solid #4b6cb7" : "1px solid #eee",
                  backgroundColor: highlightedPostId === post.postId ? "#fff9c4" : "#fff",
                  transition: "background-color 0.4s, border 0.2s",
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <div className="post-header" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="img-circle">
                    <img src={post.adminProfile || "/default-profile.png"} alt={post.adminName || "Admin"} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
                  </div>
                  <div className="post-info">
                    <h4 style={{ margin: 0 }}>{post.adminName || "Admin"}</h4>
                    <div style={{ fontSize: 12, color: "#666" }}>{post.time ? new Date(post.time).toLocaleString() : ""}</div>
                  </div>
                </div>

                <p style={{ marginTop: 12 }}>{post.message}</p>

                {post.postUrl && <img src={post.postUrl} alt="post media" className="post-media" style={{ width: "100%", borderRadius: 8, marginTop: 8 }} />}

                <div className="like-button" style={{ marginTop: 12 }}>
                  <button onClick={() => handleLikePost(post.postId)} className="admin-like-btn" style={{ color: (post.likes || []).includes(teacher?.userId) ? "#e0245e" : "#555" }}>
                    <span className="like-left">{(post.likes || []).includes(teacher?.userId) ? <FaHeart /> : <FaRegHeart />} &nbsp; {(post.likes || []).includes(teacher?.userId) ? "Liked" : "Like"}</span>
                    <span className="like-count" style={{ marginLeft: 8 }}>{post.likeCount || 0}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}