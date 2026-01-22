import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaFacebookMessenger,
  FaCalendarAlt,
} from "react-icons/fa";
import "../styles/global.css";

function MyPosts() {
  const [posts, setPosts] = useState([]);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [unreadTeachers, setUnreadTeachers] = useState({});
  const [popupMessages, setPopupMessages] = useState([]);
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const [unreadSenders, setUnreadSenders] = useState([]);
  const [postNotifications, setPostNotifications] = useState([]);
  const [showPostDropdown, setShowPostDropdown] = useState(false);

  // loading states for edit/delete
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();

  // Read admin from localStorage
  let admin = {};
  try {
    admin = JSON.parse(localStorage.getItem("admin")) || {};
  } catch (e) {
    admin = {};
  }
  const adminId = admin?.userId || null;
  const token =
    admin?.token ||
    admin?.accessToken ||
    admin?.idToken ||
    admin?.apiKey ||
    null;

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      axios.defaults.headers.common["x-access-token"] = token;
    } else {
      delete axios.defaults.headers.common["Authorization"];
      delete axios.defaults.headers.common["x-access-token"];
    }
  }, [token]);

  const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

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
        axios.get(`${RTDB_BASE}/Users.json`),
        axios.get(`${RTDB_BASE}/School_Admins.json`),
      ]);

      const users = usersRes.data || {};
      const admins = adminsRes.data || {};

      const findAdminUser = (adminId) => {
        const admin = admins[adminId];
        if (!admin) return null;
        return Object.values(users).find((u) => u.userId === admin.userId);
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
    fetchPostNotifications();
    const interval = setInterval(fetchPostNotifications, 5000);
    return () => clearInterval(interval);
  }, [adminId]);

  const handleNotificationClick = async (notification) => {
    try {
      await axios.post(
        "http://127.0.0.1:5000/api/mark_post_notification_read",
        {
          notificationId: notification.notificationId,
          adminId: admin.userId,
        }
      );
    } catch (err) {
      console.warn("Failed to delete notification:", err);
    }

    setPostNotifications((prev) =>
      prev.filter((n) => n.notificationId !== notification.notificationId)
    );

    setShowPostDropdown(false);

    navigate("/dashboard", {
      state: { postId: notification.postId },
    });
  };

  const fetchMyPosts = async () => {
    if (!adminId) return;
    try {
      const res = await axios.get(
        `http://127.0.0.1:5000/api/get_my_posts/${adminId}`
      );
      const postsArray = Array.isArray(res.data)
        ? res.data
        : Object.entries(res.data || {}).map(([key, post]) => ({
            postId: key,
            ...post,
          }));

      const mappedPosts = postsArray
        .map((p) => {
          const parsedTime = p.time ? new Date(p.time) : new Date();
          const postId = p.postId || p.id || "";
          return {
            postId: postId || String(p?.postId || p?.id || ""),
            message: p.message || p.postText || "",
            postUrl: p.postUrl || p.mediaUrl || p.postUrl || null,
            time: parsedTime.toLocaleString(),
            parsedTime,
            edited: p.edited || false,
            likeCount: Number(p.likeCount) || 0,
            likes: p.likes || {},
            adminId: p.adminId || adminId,
          };
        })
        .sort((a, b) => b.parsedTime - a.parsedTime);

      setPosts(mappedPosts);
    } catch (err) {
      console.error("Error fetching posts:", err.response?.data || err);
    }
  };

  useEffect(() => {
    if (!adminId) return;
    fetchMyPosts();
    const interval = setInterval(fetchMyPosts, 10000);
    return () => clearInterval(interval);
  }, [adminId]);

  const handlePost = async () => {
    if (!postText && !postMedia) return;
    try {
      const formData = new FormData();
      formData.append("adminId", adminId);
      formData.append("postText", postText);
      if (postMedia) formData.append("postMedia", postMedia);

      await axios.post("http://127.0.0.1:5000/api/create_post", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPostText("");
      setPostMedia(null);
      fetchMyPosts();
    } catch (err) {
      console.error("Error creating post:", err.response?.data || err);
      alert("Create post failed: " + (err.response?.data?.message || err.message || "See console"));
    }
  };

  const handleEdit = (postId, currentContent) => {
    setEditingPostId(postId);
    setEditedContent(currentContent || "");
  };

  const saveEdit = async (postId) => {
    if (!postId) return;
    if (!adminId) return;
    const trimmed = (editedContent || "").trim();
    if (trimmed.length === 0) {
      alert("Post content cannot be empty.");
      return;
    }
    setSavingId(postId);

    // Try Firebase first
    try {
      const payload = {
        message: trimmed,
        edited: true,
        editedAt: new Date().toISOString(),
        lastEditedBy: adminId,
      };
      const firebaseUrl = `${RTDB_BASE}/Posts/${encodeURIComponent(postId)}.json`;
      await axios.patch(firebaseUrl, payload);
      setPosts((prev) =>
        prev.map((post) =>
          post.postId === postId ? { ...post, message: trimmed, edited: true } : post
        )
      );
      setEditingPostId(null);
      setEditedContent("");
      setSavingId(null);
      return;
    } catch (err) {
      // fallback to backend
    }

    try {
      const url = `http://127.0.0.1:5000/api/edit_post/${postId}`;
      const payload = { adminId, postText: trimmed, message: trimmed };
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        headers["x-access-token"] = token;
      }
      const res = await axios.post(url, payload, { headers });
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || "Edit failed on backend");
      }
      setPosts((prev) =>
        prev.map((post) =>
          post.postId === postId ? { ...post, message: trimmed, edited: true } : post
        )
      );
      setEditingPostId(null);
      setEditedContent("");
    } catch (err) {
      console.error("[EDIT] Final error:", err.response?.status, err.response?.data || err.message || err);
      alert("Edit failed: " + (err.response?.data?.message || err.message || "See console"));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (postId) => {
    if (!postId) return;
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    if (!adminId) return;
    setDeletingId(postId);

    try {
      const firebaseUrl = `${RTDB_BASE}/Posts/${encodeURIComponent(postId)}.json`;
      await axios.delete(firebaseUrl);
      setPosts((prev) => prev.filter((p) => p.postId !== postId));
      setDeletingId(null);
      return;
    } catch (err) {
      // fallback below
    }

    try {
      const url = `http://127.0.0.1:5000/api/delete_post/${postId}`;
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        headers["x-access-token"] = token;
      }

      try {
        const rPost = await axios.post(url, { adminId }, { headers });
        if (rPost.data && rPost.data.success === false) throw new Error(rPost.data.message || "delete returned success:false");
        setPosts((prev) => prev.filter((p) => p.postId !== postId));
        setDeletingId(null);
        return;
      } catch (postErr) {
        // try delete with body
      }

      try {
        const rDelBody = await axios.delete(url, { data: { adminId }, headers });
        if (rDelBody.data && rDelBody.data.success === false) throw new Error(rDelBody.data.message || "delete returned success:false");
        setPosts((prev) => prev.filter((p) => p.postId !== postId));
        setDeletingId(null);
        return;
      } catch (delBodyErr) {
        // try delete with params
      }

      const rDelParam = await axios.delete(url, { params: { adminId }, headers });
      if (rDelParam.data && rDelParam.data.success === false) throw new Error(rDelParam.data.message || "delete returned success:false");
      setPosts((prev) => prev.filter((p) => p.postId !== postId));
    } catch (err) {
      console.error("[DELETE] Final error:", err.response?.status, err.response?.data || err.message || err);
      alert("Delete failed: " + (err.response?.data?.message || err.message || "See console"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await axios.post("http://127.0.0.1:5000/api/like_post", {
        adminId,
        postId,
      });
      if (res.data.success) {
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId === postId
              ? {
                  ...post,
                  likeCount: res.data.likeCount,
                  likes: {
                    ...post.likes,
                    [adminId]: res.data.liked ? true : undefined,
                  },
                }
              : post
          )
        );
      }
    } catch (err) {
      console.error("Error liking post:", err.response?.data || err);
    }
  };

  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".messenger-dropdown")) {
        setShowMessageDropdown(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".notification-dropdown")) {
        setShowPostDropdown(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

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
            <Link className="sidebar-btn" to="/dashboard"><FaHome /> Home</Link>
            <Link className="sidebar-btn active" to="/my-posts"><FaFileAlt /> My Posts</Link>
            <Link className="sidebar-btn" to="/teachers"><FaChalkboardTeacher /> Teachers</Link>
            <Link className="sidebar-btn" to="/students"><FaChalkboardTeacher /> Students</Link>
            <Link className="sidebar-btn" to="/schedule"><FaCalendarAlt /> Schedule</Link>
            <Link className="sidebar-btn" to="/parents"><FaChalkboardTeacher /> Parents</Link>
            <button className="sidebar-btn logout-btn" onClick={() => { localStorage.removeItem("admin"); window.location.href = "/login"; }}><FaSignOutAlt /> Logout</button>
          </div>
        </div>

        <main className="google-main">
          <h2 className="page-title">My Posts</h2>

          {posts.length === 0 && <p className="muted center">You have no posts yet.</p>}

          <section className="posts-list">
            {posts.map((post) => (
              <article key={post.postId} id={`post-${post.postId}`} className="post-card">
                <header className="post-card-header">
                  <div className="avatar">
                    <img src={admin.profileImage || "/default-profile.png"} alt="profile" />
                  </div>
                  <div className="post-meta">
                    <h4 className="post-author">{admin.name}</h4>
                    <small className="post-time">{post.time}</small>
                  </div>
                </header>

                <div className="post-card-body">
                  {editingPostId === post.postId ? (
                    <div className="edit-area">
                      <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="edit-textarea"
                      />
                      <div className="edit-actions">
                        <button onClick={() => saveEdit(post.postId)} disabled={savingId === post.postId} className="btn primary">
                          {savingId === post.postId ? "Saving..." : "Save"}
                        </button>
                        <button onClick={() => setEditingPostId(null)} className="btn muted">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="post-content">
                      <p>{post.message}</p>
                      {post.edited && <small className="muted">(edited)</small>}
                      {post.postUrl && (
                        <img src={post.postUrl} alt="post media" className="post-media" />
                      )}
                    </div>
                  )}
                </div>

                {editingPostId !== post.postId && (
                  <footer className="post-card-actions">
                    <button onClick={() => handleEdit(post.postId, post.message)} className="btn warning">Edit</button>
                    <button onClick={() => handleDelete(post.postId)} disabled={deletingId === post.postId} className="btn danger">
                      {deletingId === post.postId ? "Deleting..." : "Delete"}
                    </button>
                  </footer>
                )}
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}

export default MyPosts;