import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import "../styles/global.css";
import { AiFillPicture, AiFillVideoCamera } from "react-icons/ai";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaBell, FaFacebookMessenger, FaCalendarAlt, FaHeart, FaRegHeart } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";

function Dashboard() {
  // ---------------- STATE ----------------
  const [admin, setAdmin] = useState({
    adminId: "",
    userId: "",          // ✅ ADD THIS
    name: "",
    username: "",
    profileImage: "/default-profile.png",
    isActive: false,
  });

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
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const [unreadSenders, setUnreadSenders] = useState({}); 
  // All unread messages from any sender type
  // Correct order
  const location = useLocation();
  const scrollToPostId = location.state?.scrollToPostId;
  const postIdToScroll = location.state?.postId;
  const postId = location.state?.postId;

  const [currentChat, setCurrentChat] = useState([]);
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  const adminUserId = admin.userId;
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [unreadPostList, setUnreadPostList] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    if (postId) {
      const element = document.getElementById(`post-${postId}`);
      if (element) element.scrollIntoView({ behavior: "smooth" });
    }
  }, [postId]);

  // ---------------- HELPER: LOAD ADMIN FROM LOCALSTORAGE ----------------
  const loadAdminFromStorage = async () => {
    const storedAdmin = localStorage.getItem("admin");

    if (!storedAdmin) {
      setLoadingAdmin(false);
      return;
    }

    try {
      const adminData = JSON.parse(storedAdmin);

      if (!adminData.adminId) {
        localStorage.removeItem("admin");
        setLoadingAdmin(false);
        return;
      }

      const res = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/School_Admins/${adminData.adminId}.json`
      );

      if (!res.data) {
        localStorage.removeItem("admin");
        setLoadingAdmin(false);
        return;
      }

      const userRes = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${res.data.userId}.json`
      );

      setAdmin({
        adminId: adminData.adminId,
        userId: res.data.userId,
        name: userRes.data?.name || "Admin",
        username: userRes.data?.username || "",
        profileImage: userRes.data?.profileImage || "/default-profile.png",
      });

    } catch (e) {
      localStorage.removeItem("admin");
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
      const res = await axios.get("http://127.0.0.1:5000/api/get_posts");
      console.log(res.data); // check here
      const sortedPosts = res.data.sort(
        (a, b) => new Date(b.time) - new Date(a.time)
      );
      setPosts(sortedPosts);
    } catch (err) {
      console.error("Error fetching posts:", err);
    }
  };

  // ---------------- FETCH UNREAD MESSAGES ----------------
  const fetchUnreadMessages = async () => {
    if (!admin.adminId) return;

    const senders = {};

    try {
      // 1️⃣ USERS (names & images)
      const usersRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"
      );
      const usersData = usersRes.data || {};

      const findUserByUserId = (userId) => {
        return Object.values(usersData).find(u => u.userId === userId);
      };

      // helper to read messages from BOTH chat keys
      const getUnreadCount = async (userId) => {
        const key1 = `${admin.userId}_${userId}`;
        const key2 = `${userId}_${admin.userId}`;

        const [r1, r2] = await Promise.all([
          axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`),
          axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`)
        ]);

        const msgs = [
          ...Object.values(r1.data || {}),
          ...Object.values(r2.data || {})
        ];

        return msgs.filter(
          m => m.receiverId === admin.userId && !m.seen
        ).length;
      };

      // 2️⃣ TEACHERS
      const teachersRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"
      );

      for (const k in teachersRes.data || {}) {
        const t = teachersRes.data[k];
        const unread = await getUnreadCount(t.userId);

        if (unread > 0) {
         const user = findUserByUserId(t.userId);

          senders[t.userId] = {
            type: "teacher",
            name: user?.name || "Teacher",
            profileImage: user?.profileImage || "/default-profile.png",
            count: unread
          };
        }
      }

      // 3️⃣ STUDENTS
      const studentsRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json"
      );

      for (const k in studentsRes.data || {}) {
        const s = studentsRes.data[k];
        const unread = await getUnreadCount(s.userId);

        if (unread > 0) {
          const user = findUserByUserId(s.userId);

          senders[s.userId] = {
            type: "student",
            name: user?.name || s.name || "Student",
            profileImage: user?.profileImage || s.profileImage || "/default-profile.png",
            count: unread
          };
        }
      }

      // 4️⃣ PARENTS
      const parentsRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Parents.json"
      );

      for (const k in parentsRes.data || {}) {
        const p = parentsRes.data[k];
        const unread = await getUnreadCount(p.userId);

        if (unread > 0) {
         const user = findUserByUserId(p.userId);

          senders[p.userId] = {
            type: "parent",
            name: user?.name || p.name || "Parent",
            profileImage: user?.profileImage || p.profileImage || "/default-profile.png",
            count: unread
          };
        }
      }

      setUnreadSenders(senders);
    } catch (err) {
      console.error("Unread fetch failed:", err);
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
    if (!admin.adminId) return;

    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 5000);

    return () => clearInterval(interval);
  }, [admin.adminId]);

  /// ---------------- FETCH POST NOTIFICATIONS ----------------
  useEffect(() => {
    if (!admin.userId) return;

    const fetchUnreadPosts = async () => {
      try {
        const res = await axios.get("http://127.0.0.1:5000/api/get_posts");

        const unread = res.data.filter(
          p => !p.seenBy || !p.seenBy[admin.userId]
        );

        setUnreadPostList(unread);
      } catch (err) {
        console.error(err);
      }
    };

    fetchUnreadPosts();
  }, [admin.userId]);

  useEffect(() => {
    const fetchTeachersAndUnread = async () => {
      try {
        const [teachersRes, usersRes] = await Promise.all([
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json")
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
          const chatKey = `${adminUserId}_${t.userId}`;
          const res = await axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`);
          const msgs = Object.values(res.data || {}).map(m => ({
            ...m,
            sender: m.senderId === adminUserId ? "admin" : "teacher"
          }));
          allMessages.push(...msgs);

          const unreadCount = msgs.filter(m => m.receiverId === adminUserId && !m.seen).length;
          if (unreadCount > 0) unread[t.userId] = unreadCount;
        }

        setPopupMessages(allMessages);
        setUnreadTeachers(unread);

      } catch (err) {
        console.error(err);
      }
    };

    fetchTeachersAndUnread();
  }, [adminUserId]);

  const openChatWithUser = async (userId) => {
    setShowMessengerDropdown(false);

    // Fetch chat history
    const res = await axios.get(`http://127.0.0.1:5000/api/chat/${admin.userId}/${userId}`);
    setCurrentChat(res.data); // You need a state `currentChat` to render the conversation

    // Mark messages as read
    await axios.post("http://127.0.0.1:5000/api/mark_messages_read", {
      adminId: admin.userId,
      senderId: userId
    });

    // Refresh unread messages
    setUnreadMessages(prev => prev.filter(m => m.senderId !== userId));
  };

  // ---------------- OPEN POST FROM NOTIFICATION ----------------
  const openPostFromNotif = async (post) => {
    setShowPostDropdown(false);

    try {
      // 1️⃣ Mark as seen in backend
      await axios.post("http://127.0.0.1:5000/api/mark_post_seen", {
        postId: post.postId,
        userId: admin.userId
      });

      // 2️⃣ REMOVE from notification list IMMEDIATELY
      setUnreadPostList(prev =>
        prev.filter(p => p.postId !== post.postId)
      );

      // 3️⃣ Update post as seen in main feed
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

      // 4️⃣ Scroll + highlight
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
    loadAdminFromStorage();
    fetchPosts();
  }, []);

  // Add this effect to monitor admin state changes
  useEffect(() => {
    if (loadingAdmin) return;

    if (!admin.userId) {
      console.log("No admin found, redirecting to login");
      navigate("/login", { replace: true });
    }
  }, [loadingAdmin, admin.userId]);

  const handlePost = async () => {
    if (!postText && !postMedia) return;

    if (!admin.adminId || !admin.userId) {
      alert("Session expired");
      return;
    }

    const formData = new FormData();
    formData.append("message", postText);

    // ✅ CORRECT
    formData.append("adminId", admin.adminId); // ownership
    formData.append("userId", admin.userId);   // display & likes
    formData.append("adminName", admin.name);
    formData.append("adminProfile", admin.profileImage);

    if (postMedia) formData.append("post_media", postMedia);

    await axios.post("http://127.0.0.1:5000/api/create_post", formData);

    setPostText("");
    setPostMedia(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchPosts();
  };

  // ---------------- HANDLE LIKE ----------------
  const handleLike = async (postId) => {
    try {
      // ✅ Use full backend URL
      const res = await axios.post(`http://127.0.0.1:5000/api/like_post`, {
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
      await axios.delete(`http://127.0.0.1:5000/api/delete_post/${postId}`, {
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
      await axios.post(`http://127.0.0.1:5000/api/edit_post/${postId}`, {
       adminId: admin.adminId,
        postText: newText,
      });
      fetchPosts();
    } catch (err) {
      console.error("Error editing post:", err);
    }
  };

  const markMessagesAsSeen = async (userId) => {
    const key1 = `${admin.userId}_${userId}`;
    const key2 = `${userId}_${admin.userId}`;

    const [r1, r2] = await Promise.all([
      axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`),
      axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`)
    ]);

    const updates = {};

    const collectUpdates = (data, basePath) => {
      Object.entries(data || {}).forEach(([msgId, msg]) => {
        if (msg.receiverId === admin.userId && !msg.seen) {
          updates[`${basePath}/${msgId}/seen`] = true;
        }
      });
    };

    collectUpdates(r1.data, `Chats/${key1}/messages`);
    collectUpdates(r2.data, `Chats/${key2}/messages`);

    if (Object.keys(updates).length > 0) {
      await axios.patch(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/.json",
        updates
      );
    }
  };

  // ---------------- RENDER ----------------
  return (
    <div className="dashboard-page">

      {/* ---------------- TOP NAVIGATION BAR ---------------- */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>

        <div className="nav-right">
          {/* Notification */}
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={() => setShowPostDropdown(p => !p)}
          >
            <FaBell />

            {unreadPostList.length > 0 && (
              <span style={{
                position: "absolute",
                top: "-5px",
                right: "-5px",
                background: "red",
                color: "#fff",
                borderRadius: "50%",
                padding: "2px 6px",
                fontSize: "10px",
                fontWeight: "bold"
              }}>
                {unreadPostList.length}
              </span>
            )}

          </div>

          {/* ---------------- POST NOTIFICATION DROPDOWN ---------------- */}
          {showPostDropdown && (
            <div
              className="notification-dropdown"
              style={{
                position: "absolute",
                top: "45px",
                right: "0",
                width: "320px",
                maxHeight: "400px",
                overflowY: "auto",
                background: "#fff",
                borderRadius: "8px",
                boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                zIndex: 1000
              }}
            >
              {unreadPostList.length === 0 ? (
                <p style={{ padding: "10px", textAlign: "center", color: "#777" }}>
                  No new posts
                </p>
              ) : (
                unreadPostList.map(post => (
                  <div
                    key={post.postId}
                    onClick={() => openPostFromNotif(post)}
                    style={{
                      padding: "10px",
                      borderBottom: "1px solid #eee",
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer"
                    }}
                  >
                    <img
                      src={post.adminProfile || "/default-profile.png"}
                      alt=""
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        marginRight: "10px"
                      }}
                    />

                    <div style={{ flex: 1 }}>
                      <strong>{post.adminName}</strong>
                      <p style={{ margin: 0, fontSize: "12px", color: "#555" }}>
                        {post.message?.slice(0, 40) || "New post"}
                      </p>
                    </div>

                    <span style={{ fontSize: "10px", color: "#888" }}>
                      {new Date(post.time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Messenger */}
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowMessageDropdown((prev) => !prev);
            }}
          >
            <FaFacebookMessenger />

            {/* 🔴 TOTAL UNREAD COUNT */}
            {Object.keys(unreadSenders).length > 0 && (
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
                {Object.values(unreadSenders).reduce((a, b) => a + b.count, 0)}
              </span>
            )}

            {/* 📩 DROPDOWN */}
            {showMessageDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "40px",
                  right: "0",
                  width: "300px",
                  background: "#fff",
                  borderRadius: "10px",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.25)",
                  zIndex: 1000
                }}
              >
                {Object.keys(unreadSenders).length === 0 ? (
                  <p style={{ padding: "12px", textAlign: "center", color: "#777" }}>
                    No new messages
                  </p>
                ) : (
                  Object.entries(unreadSenders).map(([userId, sender]) => (
                    <div
                      key={userId}
                      style={{
                        padding: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                        borderBottom: "1px solid #eee"
                      }}
                      onClick={async () => {
                        setShowMessageDropdown(false);

                        // 1️⃣ Mark messages as seen in DB
                        await markMessagesAsSeen(userId);

                        // 2️⃣ Remove sender immediately from UI
                        setUnreadSenders(prev => {
                          const copy = { ...prev };
                          delete copy[userId];
                          return copy;
                        });

                        // 3️⃣ Navigate to exact chat
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
                          width: "42px",
                          height: "42px",
                          borderRadius: "50%"
                        }}
                      />
                      <div>
                        <strong>{sender.name}</strong>
                        <p style={{ fontSize: "12px", margin: 0 }}>
                          {sender.count} new message{sender.count > 1 && "s"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
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

      <div className="app-layout">
        <div className="google-dashboard">
          {/* LEFT SIDEBAR — 25% */}

          <div className="google-sidebar">
            <div className="sidebar-profile">
              <div className="sidebar-img-circle">
                <img src={admin?.profileImage || "/default-profile.png"} alt="profile" />
              </div>
              <h3>{admin?.name || "Admin Name"}</h3>
              <p>{admin?.username || "username"}</p>
            </div>

            <div className="sidebar-menu">
              <Link className="sidebar-btn" to="/dashboard"
                style={{ backgroundColor: "#4b6cb7", color: "#fff" }}
              > <FaHome style={{ width: "28px", height:"28px" }}/> Home</Link>
              <Link className="sidebar-btn" to="/my-posts"><FaFileAlt /> My Posts</Link>
              <Link className="sidebar-btn" to="/teachers"><FaChalkboardTeacher /> Teachers</Link>
              <Link className="sidebar-btn" to="/students" > <FaChalkboardTeacher /> Students</Link>
              <Link
                className="sidebar-btn"
                to="/schedule"
              >
                <FaCalendarAlt /> Schedule
              </Link>
              <Link className="sidebar-btn" to="/parents" ><FaChalkboardTeacher /> Parents
              </Link>

              <button
                className="sidebar-btn logout-btn"
                onClick={() => {
                  localStorage.removeItem("admin");
                  window.location.href = "/login";
                }}
              >
                <FaSignOutAlt /> Logout
              </button>
            </div>
          </div>

          {/* MAIN CONTENT — 75% */}
          <div className="google-main">

            {/* Post input box */}
            <div className="post-box">
              <div className="fb-post-top" style={{ display: "flex", gap: 12 }}>
                <img src={admin.profileImage || "/default-profile.png"} alt="me" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <textarea
                    placeholder="What's on your mind?"
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                  />
                  <div className="fb-post-bottom" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <label className="fb-upload" title="Upload media" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <AiFillPicture className="fb-icon" />
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
                        width: "20%",                 // 20% of the fb-post-bottom container
                        minWidth: 140,                // prevent it from getting too small
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 10px",
                        background: "#f3f4f6",
                        borderRadius: 8,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        boxSizing: "border-box"
                      }}>
                        <span style={{ fontSize: 13, color: "#111", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
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
                      <button className="telegram-send-icon" onClick={handlePost}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 25 25"
                          width="35"
                          height="35"
                          fill="#0088cc"
                        >
                          <path d="M2.01 21L23 12 2.01 3v7l15 2-15 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Posts container */}
            <div className="posts-container">
              {posts.map((post) => (
                <div className="post-card" id={`post-${post.postId}`} key={post.postId}>
                  <div className="post-header">
                    <div className="img-circle">
                      <img
                        src={post.adminProfile || "/default-profile.png"}
                        alt="profile"
                      />
                    </div>
                    <div className="post-info">
                      <h4>{post.adminName}</h4>
                      <span>{post.time}</span>
                    </div>
                  </div>

                  <p>{post.message}</p>
                  {post.postUrl && <img src={post.postUrl} alt="post media" />}

                  <div className="post-actions">
                    <div className="like-button">
                      <button
                        onClick={() => handleLike(post.postId)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          width: "120px",
                          padding: "6px 10px",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: "500",
                          color: post.likes && post.likes[admin.userId] ? "#e0245e" : "#555",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {/* LEFT: Heart + Text */}
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {post.likes && post.likes[admin.userId] ? (
                            <FaHeart style={{ color: "#e0245e", fontSize: "16px" }} />
                          ) : (
                            <FaRegHeart style={{ fontSize: "16px" }} />
                          )}

                          {post.likes && post.likes[admin.userId] ? "Liked" : "Like"}
                        </span>

                        {/* RIGHT: Count */}
                        <span style={{ marginRight: "650px", fontSize: "15px", color: "#777" }}>
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
    </div>
  );
}

export default Dashboard;