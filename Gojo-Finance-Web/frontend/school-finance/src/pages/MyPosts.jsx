import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { AiFillPicture } from "react-icons/ai";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaFacebookMessenger,
  FaCalendarAlt,
  FaChartLine,
} from "react-icons/fa";
import "../styles/global.css";
import { BACKEND_BASE } from "../config.js";
import useTopbarNotifications from "../hooks/useTopbarNotifications";

function MyPosts() {
  const API_BASE = `${BACKEND_BASE}/api`;
  const [posts, setPosts] = useState([]);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);
  const fileInputRef = useRef(null);
  const [teachers, setTeachers] = useState([]);
  const [unreadTeachers, setUnreadTeachers] = useState({});
  const [popupMessages, setPopupMessages] = useState([]);
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const [showPostDropdown, setShowPostDropdown] = useState(false);

  // loading states for edit/delete
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();

  // Read admin from localStorage
  // Read finance/admin from localStorage (compat)
  const _storedFinance = (() => {
    try {
      return JSON.parse(localStorage.getItem("finance") || localStorage.getItem("admin")) || {};
    } catch (e) {
      return {};
    }
  })();

  const [finance, setFinance] = useState({
    financeId: _storedFinance.financeId || _storedFinance.adminId || "",
    userId: _storedFinance.userId || "",
    schoolCode: _storedFinance.schoolCode || "",
    name: _storedFinance.name || _storedFinance.username || "Finance",
    username: _storedFinance.username || "",
    profileImage: _storedFinance.profileImage || "/default-profile.png",
    token: _storedFinance.token || _storedFinance.accessToken || _storedFinance.idToken || _storedFinance.apiKey || null,
  });

  // Compatibility alias: older code expects `admin` object
  const admin = {
    adminId: finance.financeId || finance.adminId || "",
    userId: finance.userId || "",
    name: finance.name || finance.username || "Finance",
    profileImage: finance.profileImage || "/default-profile.png",
    token: finance.token || null,
  };

  // include username (from Users node) for sidebar display
  admin.username = finance.username || "";

  // Prefer the finance/adminId (financeId) when available; fallback to userId
  const adminId = admin?.adminId || admin?.userId || null;
  const token = admin?.token || null;

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      axios.defaults.headers.common["x-access-token"] = token;
    } else {
      delete axios.defaults.headers.common["Authorization"];
      delete axios.defaults.headers.common["x-access-token"];
    }
  }, [token]);

  const RTDB_BASE_RAW = "https://bale-house-rental-default-rtdb.firebaseio.com";
  const schoolCode = finance.schoolCode || _storedFinance.schoolCode || "";
  const DB_ROOT = schoolCode
    ? `${RTDB_BASE_RAW}/Platform1/Schools/${schoolCode}`
    : RTDB_BASE_RAW;
  const RTDB_BASE = DB_ROOT;
  const DB_URL = DB_ROOT;

  const [loadingFinance, setLoadingFinance] = useState(true);

  const loadFinanceFromStorage = async () => {
    const stored = localStorage.getItem("finance") || localStorage.getItem("admin");

    if (!stored) {
      setLoadingFinance(false);
      return;
    }

    try {
      const financeData = JSON.parse(stored) || {};

      const financeKey = financeData.financeId || financeData.adminId || financeData.id || financeData.uid || "";
      const possibleUserId = financeData.userId || financeData.user_id || financeData.uid || financeData.user || "";

      if (financeKey) {
        let res = null;
        try {
          res = (await axios.get(`${DB_URL}/Finance/${financeKey}.json`)) || null;
        } catch (err) {
          res = null;
        }

        if (!res || !res.data) {
          try {
            res = (await axios.get(`${DB_URL}/Academics/${financeKey}.json`)) || null;
          } catch (err) {
            res = null;
          }
        }

        if (res && res.data) {
          const node = res.data;
          const userId = node.userId || node.user_id || possibleUserId || "";

          if (userId) {
            try {
              const userRes = await axios.get(`${DB_URL}/Users/${userId}.json`);
              const nextFinance = {
                financeId: financeKey,
                userId,
                schoolCode: financeData.schoolCode || "",
                name: userRes.data?.name || node.name || financeData.name || "Finance",
                username: userRes.data?.username || financeData.username || "",
                profileImage: userRes.data?.profileImage || node.profileImage || financeData.profileImage || "/default-profile.png",
                token: financeData.token || financeData.accessToken || financeData.idToken || financeData.apiKey || null,
              };
              setFinance(nextFinance);
              localStorage.setItem("finance", JSON.stringify({ ...financeData, ...nextFinance }));
              localStorage.setItem("admin", JSON.stringify({ ...financeData, ...nextFinance, adminId: nextFinance.financeId }));
              setLoadingFinance(false);
              return;
            } catch (err) {
              const nextFinance = {
                financeId: financeKey,
                userId,
                schoolCode: financeData.schoolCode || "",
                name: node.name || financeData.name || "Finance",
                username: node.username || financeData.username || "",
                profileImage: node.profileImage || financeData.profileImage || "/default-profile.png",
                token: financeData.token || financeData.accessToken || financeData.idToken || financeData.apiKey || null,
              };
              setFinance(nextFinance);
              localStorage.setItem("finance", JSON.stringify({ ...financeData, ...nextFinance }));
              localStorage.setItem("admin", JSON.stringify({ ...financeData, ...nextFinance, adminId: nextFinance.financeId }));
              setLoadingFinance(false);
              return;
            }
          }
        }
      }

      if (possibleUserId) {
        try {
          const userRes = await axios.get(`${DB_URL}/Users/${possibleUserId}.json`);
          const nextFinance = {
            financeId: financeData.financeId || financeData.adminId || "",
            userId: possibleUserId,
            schoolCode: financeData.schoolCode || "",
            name: userRes.data?.name || financeData.name || "Finance",
            username: userRes.data?.username || financeData.username || "",
            profileImage: userRes.data?.profileImage || financeData.profileImage || "/default-profile.png",
            token: financeData.token || financeData.accessToken || financeData.idToken || financeData.apiKey || null,
          };
          setFinance(nextFinance);
          localStorage.setItem("finance", JSON.stringify({ ...financeData, ...nextFinance }));
          localStorage.setItem("admin", JSON.stringify({ ...financeData, ...nextFinance, adminId: nextFinance.financeId }));
          setLoadingFinance(false);
          return;
        } catch (err) {
          // ignore and fallback to stored data
        }
      }

      const fallbackFinance = {
        financeId: financeData.financeId || financeData.adminId || "",
        userId: financeData.userId || "",
        schoolCode: financeData.schoolCode || "",
        name: financeData.name || financeData.username || "Finance",
        username: financeData.username || "",
        profileImage: financeData.profileImage || "/default-profile.png",
        token: financeData.token || financeData.accessToken || financeData.idToken || financeData.apiKey || null,
      };
      setFinance(fallbackFinance);
      localStorage.setItem("finance", JSON.stringify({ ...financeData, ...fallbackFinance }));
      localStorage.setItem("admin", JSON.stringify({ ...financeData, ...fallbackFinance, adminId: fallbackFinance.financeId }));
    } catch (e) {
      try {
        localStorage.removeItem("finance");
        localStorage.removeItem("admin");
      } catch (err) {}
    }

    setLoadingFinance(false);
  };

  const {
    unreadSenders,
    setUnreadSenders,
    unreadPosts: postNotifications,
    setUnreadPosts: setPostNotifications,
    messageCount,
    totalNotifications,
    markMessagesAsSeen,
    markPostAsSeen,
  } = useTopbarNotifications({
    dbRoot: RTDB_BASE,
    currentUserId: admin.userId,
  });

  const handleNotificationClick = async (notification) => {
    try {
      await markPostAsSeen(notification.postId);
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
      const res = await axios.get(`${API_BASE}/get_my_posts/${adminId}`, {
        params: { schoolCode },
      });
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
    if (loadingFinance) return;
    if (!adminId) return;

    fetchMyPosts();
    const interval = setInterval(fetchMyPosts, 10000);
    return () => clearInterval(interval);
  }, [adminId, loadingFinance]);

  // load finance info on mount (so adminId is populated from RTDB when needed)
  useEffect(() => {
    loadFinanceFromStorage();
  }, []);

  const handlePost = async () => {
    if (!postText && !postMedia) return;
    try {
      const formData = new FormData();
      // Use backend-compatible field names: `message`, `postUrl` (if uploading client-side), and include finance fields
      formData.append("adminId", adminId);
      formData.append("message", postText);
      if (postMedia) formData.append("postMedia", postMedia);

      // Include finance fields for new schema compatibility
      formData.append("financeId", finance.financeId || admin.adminId || "");
      formData.append("financeName", finance.name || admin.name || "");
      formData.append("financeProfile", finance.profileImage || admin.profileImage || "");
      // also include admin display fields for older backend compatibility
      formData.append("adminName", admin.name || "");
      formData.append("adminProfile", admin.profileImage || "");
      // include userId if available
      formData.append("userId", finance.userId || admin.userId || "");
      formData.append("schoolCode", schoolCode || "");

      await axios.post(`${API_BASE}/create_post`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPostText("");
      setPostMedia(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      const url = `${API_BASE}/edit_post/${postId}`;
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
      const url = `${API_BASE}/delete_post/${postId}`;
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
      const res = await axios.post(`${API_BASE}/like_post`, {
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
    <div className="dashboard-page" style={{ background: "#f5f8ff", minHeight: "100vh" }}>
      <nav className="top-navbar" style={{ borderBottom: "1px solid #e5e7eb", background: "#ffffff" }}>
        <h2 style={{ color: "#0f172a", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Finance Portal</h2>

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
            {totalNotifications > 0 && (
              <span className="badge">{totalNotifications}</span>
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
                                await axios.post(`${API_BASE}/mark_post_notification_read`, {
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

          <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/all-chat") }>
            <FaFacebookMessenger />
            {messageCount > 0 && <span className="badge">{messageCount}</span>}
          </div>

          <Link className="icon-circle" to="/settings"><FaCog /></Link>

          <img src={admin.profileImage || "/default-profile.png"} alt="admin" className="profile-img" />
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
            {(admin?.username || admin?.userId || admin?.adminId) ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{admin?.username || admin?.userId || admin?.adminId}</p>
            ) : null}
          </div>

          <div className="sidebar-menu" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <Link className="sidebar-btn" to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaHome style={{ width: 18, height: 18 }} /> Home
            </Link>
            <Link className="sidebar-btn" to="/my-posts" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13, backgroundColor: '#1d4ed8', color: '#fff', borderRadius: 10, boxShadow: '0 8px 18px rgba(29,78,216,0.25)' }}>
              <FaFileAlt style={{ width: 18, height: 18 }} /> My Posts
            </Link>
            <Link className="sidebar-btn" to="/students" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Students
            </Link>
            <Link className="sidebar-btn" to="/parents" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Parents
            </Link>
            <Link className="sidebar-btn" to="/analytics" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaChartLine style={{ width: 18, height: 18 }} /> Analytics
            </Link>

            <button
              className="sidebar-btn logout-btn"
              onClick={() => {
                localStorage.removeItem("admin");
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
            <div style={{ fontSize: 17, fontWeight: 800 }}>My Posts</div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.95 }}>Manage your updates and announcements professionally.</div>
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
                      boxSizing: "border-box",
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
                          lineHeight: 1,
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
          {posts.length === 0 ? (
            <p className="muted" style={{ textAlign: "center", padding: 10 }}>You have no posts yet.</p>
          ) : (
            <div className="posts-container" style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {posts.map((post) => (
                <div
                  className="post-card"
                  id={`post-${post.postId}`}
                  key={post.postId}
                  style={{ background: "#fff", border: "1px solid #dfe3e8", borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.08)", overflow: "hidden" }}
                >
                  <div className="post-header" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px 4px" }}>
                    <div className="img-circle" style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", border: "2px solid #e6eefc", flexShrink: 0 }}>
                      <img
                        src={post.adminProfile || admin.profileImage || "/default-profile.png"}
                        alt="profile"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <div className="post-info" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <h4 style={{ margin: 0, fontSize: 13, color: "#0f172a", fontWeight: 700 }}>{post.adminName || admin.name || "Admin"}</h4>
                      <span style={{ fontSize: 10, color: "#64748b" }}>{post.time}{post.edited ? " · Edited" : ""} · Public</span>
                    </div>
                  </div>

                  {editingPostId === post.postId ? (
                    <div style={{ padding: "0 10px 8px" }}>
                      <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        style={{ width: "100%", minHeight: 72, resize: "vertical", border: "1px solid #d9dde3", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      />
                      <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => setEditingPostId(null)}
                          style={{ border: "1px solid #d9dde3", background: "#fff", borderRadius: 6, height: 30, padding: "0 12px", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(post.postId)}
                          disabled={savingId === post.postId}
                          style={{ border: "none", background: "#1877f2", borderRadius: 6, height: 30, padding: "0 12px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          {savingId === post.postId ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
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

                      <div style={{ padding: "4px 10px 6px", display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #edf0f2" }}>
                        <button
                          onClick={() => handleEdit(post.postId, post.message)}
                          style={{ border: "1px solid #d9dde3", background: "#fff", borderRadius: 6, height: 28, padding: "0 10px", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(post.postId)}
                          disabled={deletingId === post.postId}
                          style={{ border: "none", background: "#ef4444", borderRadius: 6, height: 28, padding: "0 10px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          {deletingId === post.postId ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyPosts;