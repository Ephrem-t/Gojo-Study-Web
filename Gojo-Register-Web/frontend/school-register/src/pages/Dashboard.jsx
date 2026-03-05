import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import "../styles/global.css";
import { storage } from "../firebase.js";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { AiFillPicture, AiFillVideoCamera } from "react-icons/ai";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaBell, FaFacebookMessenger, FaCalendarAlt, FaHeart, FaRegHeart, FaChartLine, FaChevronDown } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { BACKEND_BASE } from "../config.js";
import useTopbarNotifications from "../hooks/useTopbarNotifications";

function Dashboard() {
  const API_BASE = `${BACKEND_BASE}/api`;
  const DB_URL = "https://bale-house-rental-default-rtdb.firebaseio.com";
  // ---------------- STATE ----------------
  const _storedFinance = (() => {
    try {
      return JSON.parse(localStorage.getItem("registrar") || localStorage.getItem("admin")) || {};
    } catch (e) {
      return {};
    }
  })();

  const [finance, setFinance] = useState({
    financeId: _storedFinance.financeId || _storedFinance.adminId || "",
    userId: _storedFinance.userId || "",
    schoolCode: _storedFinance.schoolCode || "",
    name: _storedFinance.name || _storedFinance.username || "Register Office",
    username: _storedFinance.username || "",
    profileImage: _storedFinance.profileImage || "/default-profile.png",
    isActive: _storedFinance.isActive || false,
  });

  const schoolCode = finance.schoolCode || _storedFinance.schoolCode || "";
  const DB_ROOT = schoolCode ? `${DB_URL}/Platform1/Schools/${schoolCode}` : DB_URL;

  // Compatibility alias: older code refers to `admin` — map `finance` fields to `admin`
  const admin = {
    adminId: finance.financeId || finance.adminId || "",
    userId: finance.userId || "",
    name: finance.name || finance.username || "Register Office",
    profileImage: finance.profileImage || "/default-profile.png",
    isActive: finance.isActive || false,
  };

  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);
  const fileInputRef = useRef(null);

  const [unreadMessages, setUnreadMessages] = useState([]);
  const [showMessengerDropdown, setShowMessengerDropdown] = useState(false);

  const [teachers, setTeachers] = useState([]);
  const [unreadTeachers, setUnreadTeachers] = useState({});
  const [popupMessages, setPopupMessages] = useState([]);
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(true);
  const [studentMenuOpen, setStudentMenuOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  // All unread messages from any sender type
  // Correct order
  const location = useLocation();
  const scrollToPostId = location.state?.scrollToPostId;
  const postIdToScroll = location.state?.postId;
  const postId = location.state?.postId;

  const [currentChat, setCurrentChat] = useState([]);
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  const financeUserId = finance.userId;
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const {
    unreadSenders,
    setUnreadSenders,
    unreadPosts: unreadPostList,
    setUnreadPosts: setUnreadPostList,
    messageCount,
    totalNotifications,
    markMessagesAsSeen,
    markPostAsSeen,
  } = useTopbarNotifications({
    dbRoot: DB_ROOT,
    currentUserId: admin.userId,
  });

  const navigate = useNavigate();

  useEffect(() => {
    if (postId) {
      const element = document.getElementById(`post-${postId}`);
      if (element) element.scrollIntoView({ behavior: "smooth" });
    }
  }, [postId]);

  // ---------------- HELPER: LOAD ADMIN FROM LOCALSTORAGE ----------------
  const loadFinanceFromStorage = async () => {
    const stored = localStorage.getItem("registrar") || localStorage.getItem("admin");

    if (!stored) {
      setLoadingAdmin(false);
      return;
    }

    try {
      const financeData = JSON.parse(stored) || {};

      const financeKey = financeData.financeId || financeData.adminId || financeData.id || financeData.uid || "";
      const possibleUserId = financeData.userId || financeData.user_id || financeData.uid || financeData.user || "";

      // If financeKey exists try Finance -> School_Admins
      if (financeKey) {
        let res = null;
        try {
          res = (await axios.get(`${DB_ROOT}/Finance/${financeKey}.json`)) || null;
        } catch (err) {
          res = null;
        }

        if (!res || !res.data) {
          try {
            res = (await axios.get(`${DB_ROOT}/School_Admins/${financeKey}.json`)) || null;
          } catch (err) {
            res = null;
          }
        }

        if (res && res.data) {
          const node = res.data;
          const userId = node.userId || node.user_id || possibleUserId || "";
          if (userId) {
            try {
              const userRes = await axios.get(`${DB_ROOT}/Users/${userId}.json`);
              setFinance({
                financeId: financeKey,
                userId,
                schoolCode: financeData.schoolCode || "",
                name: userRes.data?.name || node.name || financeData.name || "Register Office",
                username: userRes.data?.username || financeData.username || "",
                profileImage: userRes.data?.profileImage || node.profileImage || financeData.profileImage || "/default-profile.png",
                isActive: node.isActive || financeData.isActive || false,
              });
            } catch (err) {
              setFinance({
                financeId: financeKey,
                userId,
                schoolCode: financeData.schoolCode || "",
                name: node.name || financeData.name || "Register Office",
                username: node.username || financeData.username || "",
                profileImage: node.profileImage || financeData.profileImage || "/default-profile.png",
                isActive: node.isActive || financeData.isActive || false,
              });
            }
            setLoadingAdmin(false);
            return;
          }

          // node exists but no linked userId: use node fields
          setFinance({
            financeId: financeKey,
            userId: "",
            schoolCode: financeData.schoolCode || "",
            name: node.name || financeData.name || "Register Office",
            username: node.username || financeData.username || "",
            profileImage: node.profileImage || financeData.profileImage || "/default-profile.png",
            isActive: node.isActive || financeData.isActive || false,
          });
          setLoadingAdmin(false);
          return;
        }
      }

      // If we don't have financeKey but have a userId, try Users
      if (possibleUserId) {
        try {
          const userRes = await axios.get(`${DB_ROOT}/Users/${possibleUserId}.json`);
          setFinance({
            financeId: financeData.financeId || financeData.adminId || "",
            userId: possibleUserId,
            schoolCode: financeData.schoolCode || "",
            name: userRes.data?.name || financeData.name || "Register Office",
            username: userRes.data?.username || financeData.username || "",
            profileImage: userRes.data?.profileImage || financeData.profileImage || "/default-profile.png",
            isActive: financeData.isActive || false,
          });
          setLoadingAdmin(false);
          return;
        } catch (err) {
          // ignore and fallback
        }
      }

      // Fallback: use stored fields without clearing storage (prevents redirect on reload)
      setFinance({
        financeId: financeData.financeId || financeData.adminId || "",
        userId: financeData.userId || "",
        schoolCode: financeData.schoolCode || "",
        name: financeData.name || financeData.username || "Register Office",
        username: financeData.username || "",
        profileImage: financeData.profileImage || "/default-profile.png",
        isActive: financeData.isActive || false,
      });
    } catch (e) {
      // parsing failed: clear corrupted storage
      try {
        localStorage.removeItem("registrar");
        localStorage.removeItem("admin");
      } catch (err) {}
    }

    setLoadingAdmin(false);
  };

  const handleOpenChat = (user, userType) => {
    navigate("/all-chat", {
      state: {
        userType,           // "teacher" or "student"
        studentId: user?.id, // for student chat
        teacher: user,       // for teacher chat
      },
    });
  };

  // ---------------- FETCH POSTS ----------------
  const fetchPosts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/get_posts`, {
        params: { schoolCode },
      });
      console.log(res.data); // check here
      const sortedPosts = res.data.sort(
        (a, b) => new Date(b.time) - new Date(a.time)
      );
      const enriched = await Promise.all(sortedPosts.map(async (p) => {
        let profile = p.adminProfile || p.adminProfileImage || p.profileImage || "";

        try {
          if (!profile && p.userId) {
            const uRes = await axios.get(`${DB_ROOT}/Users/${p.userId}.json`);
            const u = uRes.data || {};
            profile = u.profileImage || u.profile || u.avatar || "";
          }

          if (!profile && (p.financeId || p.adminId)) {
            const ownerFinanceId = p.financeId || p.adminId;
            const fRes = await axios.get(`${DB_ROOT}/Finance/${ownerFinanceId}.json`);
            const f = fRes.data || {};
            profile = f.profileImage || f.profile || "";
          }
        } catch (err) {
          // ignore profile enrichment failure
        }

        return {
          ...p,
          adminProfile: profile || "/default-profile.png",
        };
      }));

      setPosts(enriched);
    } catch (err) {
      console.error("Error fetching posts:", err);
    }
  };

  // ---------------- CLOSE DROPDOWN ON OUTSIDE CLICK ----------------
  useEffect(() => {
    const closeDropdown = (e) => {
      if (
        !e.target.closest(".icon-circle") &&
        !e.target.closest(".messenger-dropdown")
      ) {
        setShowMessageDropdown(false);
      }
    };

    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    const fetchTeachersAndUnread = async () => {
      try {
        const [teachersRes, usersRes] = await Promise.all([
          axios.get(`${DB_ROOT}/Teachers.json`),
          axios.get(`${DB_ROOT}/Users.json`)
        ]);

        const teachersData = teachersRes.data || {};
        const usersData = usersRes.data || {};

        const teacherList = Object.keys(teachersData).map(tid => {
          const teacher = teachersData[tid];
          const user = usersData[teacher.userId] || {};
          return {
            teacherId: tid,
            userId: teacher.userId,
            name: user.name || "No Name",
            profileImage: user.profileImage || "/default-profile.png"
          };
        });

        setTeachers(teacherList);

        // fetch unread messages
        const unread = {};
        const allMessages = [];

        for (const t of teacherList) {
          const chatKey = `${financeUserId}_${t.userId}`;
          const res = await axios.get(`${DB_ROOT}/Chats/${chatKey}/messages.json`);
          const msgs = Object.values(res.data || {}).map(m => ({
            ...m,
            sender: m.senderId === financeUserId ? "registerer" : "teacher"
          }));
          allMessages.push(...msgs);

          const unreadCount = msgs.filter(m => m.receiverId === financeUserId && !m.seen).length;
          if (unreadCount > 0) unread[t.userId] = unreadCount;
        }

        setPopupMessages(allMessages);
        setUnreadTeachers(unread);

      } catch (err) {
        console.error(err);
      }
    };

    fetchTeachersAndUnread();
  }, [financeUserId, schoolCode]);

  const openChatWithUser = async (userId) => {
    setShowMessengerDropdown(false);

    // Fetch chat history
    const res = await axios.get(`${API_BASE}/chat/${admin.userId}/${userId}`);
    setCurrentChat(res.data); // You need a state `currentChat` to render the conversation

    // Mark messages as read
    await axios.post(`${API_BASE}/mark_messages_read`, {
      financeId: finance.userId,
      senderId: userId
    });

    // Refresh unread messages
    setUnreadMessages(prev => prev.filter(m => m.senderId !== userId));
  };

  // ---------------- OPEN POST FROM NOTIFICATION ----------------
  const openPostFromNotif = async (post) => {
    setShowPostDropdown(false);

    try {
      await markPostAsSeen(post.postId);

      // Update post as seen in main feed
      setPosts(prev =>
        prev.map(p =>
          p.postId === post.postId
            ? {
                ...p,
                seenBy: {
                  ...(p.seenBy || {}),
                  [admin.userId]: true
                }
              }
            : p
        )
      );

      // Scroll + highlight
      setTimeout(() => {
        const el = document.getElementById(`post-${post.postId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.backgroundColor = "#fff9c4";
          setTimeout(() => (el.style.backgroundColor = ""), 1500);
        }
      }, 200);

    } catch (err) {
      console.error("Error opening post notification:", err);
    }
  };

  useEffect(() => {
    if (postIdToScroll) {
      const element = document.getElementById(`post-${postIdToScroll}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
        element.style.backgroundColor = "#ffffe0"; // optional highlight
        setTimeout(() => (element.style.backgroundColor = ""), 2000);
      }
    }
  }, [postIdToScroll]);

  // ---------------- CLOSE DROPDOWN ON OUTSIDE CLICK ----------------
  useEffect(() => {
    const close = (e) => {
      if (
        !e.target.closest(".icon-circle") &&
        !e.target.closest(".notification-dropdown")
      ) {
        setShowPostDropdown(false);
      }
    };

    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // ---------------- EFFECT ON MOUNT ----------------
  useEffect(() => {
    loadFinanceFromStorage();
    fetchPosts();
  }, []);

  // Add this effect to monitor admin state changes
  useEffect(() => {
    if (loadingAdmin) return;

    if (!admin.userId && !admin.adminId) {
      console.log("No admin found, redirecting to login");
      navigate("/login", { replace: true });
    }
  }, [loadingAdmin, admin.userId, admin.adminId]);

  const handlePost = async () => {
    if (!postText && !postMedia) return;

    if (!admin.adminId || !admin.userId) {
      alert("Session expired");
      return;
    }

    // If a media file is selected, upload it to Firebase Storage and get a download URL
    let postUrl = "";
    try {
      if (postMedia) {
        const path = `posts/${Date.now()}_${postMedia.name.replace(/[^a-zA-Z0-9.\-_/]/g, "_")}`;
        const storageRef = sRef(storage, path);
        // upload as blob/file
        await uploadBytes(storageRef, postMedia);
        postUrl = await getDownloadURL(storageRef);
      }
    } catch (err) {
      console.error("Failed to upload media to Firebase Storage:", err);
      // proceed without media URL
    }

    const formData = new FormData();
    formData.append("message", postText);
    formData.append("postUrl", postUrl);

    // keep old admin fields for compatibility
    formData.append("adminId", admin.adminId); // ownership
    formData.append("userId", admin.userId);   // display & likes
    formData.append("adminName", admin.name);
    formData.append("adminProfile", admin.profileImage);

    // new finance fields (for Finance schema)
    formData.append("financeId", admin.adminId || "");
    formData.append("financeName", admin.name || "");
    formData.append("financeProfile", admin.profileImage || "");
    formData.append("schoolCode", schoolCode || "");

    await axios.post(`${API_BASE}/create_post`, formData);

    setPostText("");
    setPostMedia(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchPosts();
  };

  // ---------------- HANDLE LIKE ----------------
  const handleLike = async (postId) => {
    try {
      // ✅ Use full backend URL
      const res = await axios.post(`${API_BASE}/like_post`, {
        postId,
        adminId: admin.userId, // or admin.adminId if your backend expects it
      });

      if (res.data.success) {
        const liked = res.data.liked; // boolean returned by backend
        const likeCount = res.data.likeCount; // number returned by backend

        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId === postId
              ? {
                  ...post,
                  likeCount,
                  likes: {
                    ...post.likes,
                    [admin.userId]: liked ? true : undefined,
                  },
                }
              : post
          )
        );
      }
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  // ---------------- HANDLE DELETE ----------------
  const handleDelete = async (postId) => {
    try {
      await axios.delete(`${API_BASE}/delete_post/${postId}`, {
       data: { adminId: admin.adminId },
      });
      fetchPosts();
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  // ---------------- HANDLE EDIT ----------------
  const handleEdit = async (postId, currentText) => {
    const newText = prompt("Edit your post:", currentText);
    if (!newText) return;
    try {
      await axios.post(`${API_BASE}/edit_post/${postId}`, {
       adminId: admin.adminId,
        postText: newText,
      });
      fetchPosts();
    } catch (err) {
      console.error("Error editing post:", err);
    }
  };

  // ---------------- RENDER ----------------
  return (
    <div className="dashboard-page" style={{ background: "#f5f8ff", minHeight: "100vh" }}>

      {/* ---------------- TOP NAVIGATION BAR ---------------- */}
      <nav className="top-navbar" style={{ borderBottom: "1px solid #e5e7eb", background: "#ffffff" }}>
        <h2 style={{ color: "#0f172a", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>

        <div className="nav-right">
          {/* Combined bell: posts + message senders */}
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowPostDropdown((prev) => !prev);
            }}
          >
            <FaBell />

            {totalNotifications > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-5px",
                  background: "red",
                  color: "#fff",
                  borderRadius: "50%",
                  padding: "2px 6px",
                  fontSize: "10px",
                  fontWeight: "bold",
                }}
              >
                {totalNotifications}
              </span>
            )}
          </div>

          {/* ---------------- POST NOTIFICATION DROPDOWN ---------------- */}
          {showPostDropdown && (
            <div
              className="notification-dropdown"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "40px",
                right: "0",
                width: "360px",
                maxHeight: "420px",
                overflowY: "auto",
                background: "#fff",
                borderRadius: 10,
                boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                zIndex: 1000,
                padding: 6,
              }}
            >
              {totalNotifications === 0 ? (
                <p style={{ padding: "12px", textAlign: "center", color: "#777" }}>
                  No new notifications
                </p>
              ) : (
                <div>
                  {/* Posts section */}
                  {unreadPostList.length > 0 && (
                    <div>
                      <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontWeight: 700 }}>Posts</div>
                      {unreadPostList.map(post => (
                        <div
                          key={post.postId}
                          onClick={() => openPostFromNotif(post)}
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
                          <img
                            src={post.adminProfile || "/default-profile.png"}
                            alt=""
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 8,
                              objectFit: "cover",
                            }}
                          />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong>{post.adminName}</strong>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 13,
                                color: "#555",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {post.message || "New post"}
                            </p>
                          </div>

                          <div style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>
                            {new Date(post.time || post.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Messages section */}
                  {messageCount > 0 && (
                    <div>
                      <div style={{ padding: '8px 10px', color: '#333', fontWeight: 700, background: '#fafafa', borderRadius: 6, margin: '8px 6px' }}>Messages</div>
                      {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                        <div
                          key={userId}
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
                          onClick={async () => {
                            // mark messages seen, remove sender and navigate to all-chat
                            await markMessagesAsSeen(userId);
                            setUnreadSenders(prev => {
                              const copy = { ...prev };
                              delete copy[userId];
                              return copy;
                            });
                            setShowPostDropdown(false);
                            navigate("/all-chat", {
                              state: {
                                user: {
                                  userId,
                                  name: sender.name,
                                  profileImage: sender.profileImage,
                                  type: sender.type
                                }
                              }
                            });
                          }}
                        >
                          <img
                            src={sender.profileImage}
                            alt={sender.name}
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 8,
                              objectFit: "cover",
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ display: "block", marginBottom: 4 }}>{sender.name}</strong>
                            <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {sender.count} new message{sender.count > 1 && "s"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Messenger */}
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={() => navigate("/all-chat")}
          >
            <FaFacebookMessenger />

            {/* 🔴 MESSAGE COUNT ONLY */}
            {messageCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-5px",
                  background: "red",
                  color: "#fff",
                  borderRadius: "50%",
                  padding: "2px 6px",
                  fontSize: "10px",
                  fontWeight: "bold"
                }}
              >
                {messageCount}
              </span>
            )}
          </div>

          {/* Settings */}
          <Link className="icon-circle" to="/settings">
            <FaCog />
          </Link>

          {/* Profile */}
          <img
            src={admin.profileImage || "/default-profile.png"}
            alt="admin"
            className="profile-img"
          />
          {/* <span>{admin.name}</span> */}
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "12px" }}>
        {/* ---------------- SIDEBAR ---------------- */}
        <div className="google-sidebar" style={{ width: '220px', padding: '12px', borderRadius: 16, background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 10px 24px rgba(15,23,42,0.06)', height: 'fit-content' }}>
          <div className="sidebar-profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBottom: 6 }}>
            <div className="sidebar-img-circle" style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '2px solid #e6eefc' }}>
              <img src={admin?.profileImage || "/default-profile.png"} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{admin?.name || "Admin Name"}</h3>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{admin?.adminId || "username"}</p>
          </div>

          <div className="sidebar-menu" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <button
              type="button"
              className="sidebar-btn"
              onClick={() => setDashboardMenuOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 12px',
                fontSize: 13,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #eff6ff, #eef2ff)',
                color: '#1e3a8a',
                borderRadius: 12,
                border: '1px solid #c7d2fe',
                cursor: 'pointer'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaHome style={{ width: 18, height: 18 }} /> Dashboard
              </span>
              <FaChevronDown style={{ transform: dashboardMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }} />
            </button>

            {dashboardMenuOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 10, paddingLeft: 10, borderLeft: '2px solid #dbeafe' }}>
                <Link className="sidebar-btn" to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, fontWeight: 700, backgroundColor: '#1d4ed8', color: '#fff', borderRadius: 10, boxShadow: '0 8px 18px rgba(29,78,216,0.25)' }}>
                  <FaHome style={{ width: 16, height: 16 }} /> Home
                </Link>
                <Link className="sidebar-btn" to="/my-posts" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <FaFileAlt style={{ width: 16, height: 16 }} /> My Posts
                </Link>
                <Link className="sidebar-btn" to="/overview" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <FaChartLine style={{ width: 16, height: 16 }} /> Overview
                </Link>
                <Link className="sidebar-btn" to="/academic-years" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <FaFileAlt style={{ width: 16, height: 16 }} /> Academic Year
                </Link>
                <Link className="sidebar-btn" to="/grede-management" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaFileAlt style={{ width: 16, height: 16 }} /> Grede Management</Link>
              </div>
            )}

            <button
              type="button"
              className="sidebar-btn"
              onClick={() => setStudentMenuOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 12px',
                fontSize: 13,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #eff6ff, #eef2ff)',
                color: '#1e3a8a',
                borderRadius: 12,
                border: '1px solid #c7d2fe',
                cursor: 'pointer'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Students
              </span>
              <FaChevronDown style={{ transform: studentMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }} />
            </button>

            {studentMenuOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 10, paddingLeft: 10, borderLeft: '2px solid #dbeafe' }}>
                <Link className="sidebar-btn" to="/students" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <FaChalkboardTeacher style={{ width: 16, height: 16 }} /> Student
                </Link>
                <Link className="sidebar-btn" to="/student-register" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <FaFileAlt style={{ width: 16, height: 16 }} /> Register Student
                </Link>
                <Link className="sidebar-btn" to="/parents" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <FaFileAlt style={{ width: 16, height: 16 }} /> Student Parent
                </Link>
              </div>
            )}
            <Link className="sidebar-btn" to="/analytics" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaChartLine style={{ width: 18, height: 18 }} /> Analytics
            </Link>

            <button
              className="sidebar-btn logout-btn"
              onClick={() => {
                localStorage.removeItem("admin");
                localStorage.removeItem("registrar");
                window.location.href = "/login";
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}
            >
              <FaSignOutAlt style={{ width: 18, height: 18 }} /> Logout
            </button>
          </div>
        </div>

        {/* ---------------- MAIN CONTENT ---------------- */}
        <div
          className="main-content google-main"
          style={{
            padding: "10px 20px 20px",
            flex: 1,
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
            <div
              style={{
                maxWidth: 560,
                margin: "0 auto 12px",
                background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
                color: "#fff",
                borderRadius: 14,
                padding: "12px 14px",
                boxShadow: "0 14px 28px rgba(30,58,138,0.22)",
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 800 }}>School Updates Feed</div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.95 }}>Post announcements, payment reminders, and notices.</div>
            </div>

            {/* Post input box */}
            <div className="post-box" style={{ maxWidth: 560, margin: "0 auto 12px" }}>
              <div
                className="fb-post-top"
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #dfe3e8",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                  padding: 10,
                }}
              >
                <img
                  src={admin.profileImage || "/default-profile.png"}
                  alt="me"
                  style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid #e6eefc" }}
                />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <textarea
                    placeholder="What's on your mind?"
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    style={{
                      minHeight: 56,
                      resize: "vertical",
                      border: "none",
                      background: "#f0f2f5",
                      borderRadius: 18,
                      padding: "10px 12px",
                      fontSize: 12,
                      lineHeight: 1.4,
                      outline: "none",
                    }}
                  />
                  <div className="fb-post-bottom" style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: "1px solid #edf0f2" }}>
                    <label className="fb-upload" title="Upload media" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6, background: "transparent", border: "1px solid #d9dde3", cursor: "pointer", fontWeight: 600, fontSize: 12, color: "#3f4752" }}>
                      <AiFillPicture className="fb-icon" />
                      <span>Photo/Video</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          setPostMedia(file || null);
                        }}
                        accept="image/*,video/*"
                      />
                    </label>

                    {/* Filename box occupying 20% of the input area's width */}
                    {postMedia && (
                      <div style={{
                        width: "20%",
                        minWidth: 120,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 10px",
                        background: "#f5f6f7",
                        borderRadius: 8,
                        border: "1px solid #d9dde3",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        boxSizing: "border-box"
                      }}>
                        <span style={{ fontSize: 12, color: "#111", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {postMedia.name}
                        </span>
                        <button
                          onClick={() => {
                            setPostMedia(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#6b7280",
                            cursor: "pointer",
                            fontSize: 16,
                            lineHeight: 1
                          }}
                          aria-label="Remove selected media"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    <div style={{ marginLeft: "auto" }}>
                      <button
                        className="telegram-send-icon"
                        onClick={handlePost}
                        style={{
                          border: "none",
                          background: "#1877f2",
                          borderRadius: 6,
                          height: 30,
                          minWidth: 64,
                          padding: "0 12px",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Posts container */}
            <div className="posts-container" style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {posts.map((post) => (
                <div className="post-card" id={`post-${post.postId}`} key={post.postId} style={{ background: "#fff", border: "1px solid #dfe3e8", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                  <div className="post-header" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px 4px" }}>
                    <div className="img-circle" style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", border: "2px solid #e6eefc", flexShrink: 0 }}>
                      <img
                        src={post.adminProfile || "/default-profile.png"}
                        alt="profile"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <div className="post-info" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <h4 style={{ margin: 0, fontSize: 13, color: "#0f172a", fontWeight: 700 }}>{post.adminName}</h4>
                      <span style={{ fontSize: 10, color: "#64748b" }}>{post.time} · Public</span>
                    </div>
                  </div>

                  <p style={{ margin: 0, padding: "0 10px 8px", color: "#1c1e21", fontSize: 13, lineHeight: 1.45 }}>{post.message}</p>
                  {post.postUrl && (
                    <div style={{ background: "#000", borderTop: "1px solid #edf0f2", borderBottom: "1px solid #edf0f2" }}>
                      <img
                        src={post.postUrl}
                        alt="post media"
                        style={{ width: "100%", maxHeight: 420, objectFit: "contain", display: "block", margin: "0 auto" }}
                      />
                    </div>
                  )}

                  <div className="post-actions" style={{ padding: "4px 10px 6px", display: "flex", justifyContent: "flex-start", borderTop: "1px solid #edf0f2" }}>
                    <div className="like-button">
                      <button
                        onClick={() => handleLike(post.postId)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          width: "96px",
                          padding: "6px 8px",
                          background: "transparent",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: post.likes && post.likes[admin.userId] ? "#e0245e" : "#65676b",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {/* LEFT: Heart + Text */}
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {post.likes && post.likes[admin.userId] ? (
                            <FaHeart style={{ color: "#e0245e", fontSize: "12px" }} />
                          ) : (
                            <FaRegHeart style={{ fontSize: "12px" }} />
                          )}

                          {post.likes && post.likes[admin.userId] ? "Liked" : "Like"}
                        </span>

                        {/* RIGHT: Count */}
                        <span style={{ fontSize: "12px", color: "#777" }}>
                          {post.likeCount || 0}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

        </div>
      </div>
    </div>
  );
}

export default Dashboard;