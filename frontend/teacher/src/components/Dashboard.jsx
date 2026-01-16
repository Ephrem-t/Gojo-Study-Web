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

  const postRefs = useRef({});

  // On mount: load teacher from localStorage and ensure we have fresh profileImage/name
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("teacher"));
    if (!stored) {
      navigate("/login");
      return;
    }

    // set partial right away so UI isn't blank
    setTeacher(stored);

    // fetch full user record from RTDB Users node to pick up profileImage/name/username if missing
    const enrichTeacher = async () => {
      try {
        const usersRes = await axios.get(`${RTDB_BASE}/Users.json`);
        const users = usersRes.data || {};

        // Try to find by userId (preferred), then by username, then by teacherId field
        const findUser = () => {
          if (stored.userId) {
            const byKey = Object.values(users).find(u => u && u.userId === stored.userId);
            if (byKey) return byKey;
          }
          if (stored.username) {
            const byUsername = Object.values(users).find(u => u && u.username === stored.username);
            if (byUsername) return byUsername;
          }
          if (stored.teacherId) {
            const byTeacherId = Object.values(users).find(u => u && u.teacherId === stored.teacherId);
            if (byTeacherId) return byTeacherId;
          }
          // fallback: try to find by name
          const byName = Object.values(users).find(u => u && u.name === stored.name);
          if (byName) return byName;
          return null;
        };

        const userRec = findUser();
        if (userRec) {
          // merge and persist to localStorage so subsequent loads are fast
          const merged = {
            ...stored,
            name: userRec.name || stored.name,
            username: userRec.username || stored.username,
            profileImage: userRec.profileImage || stored.profileImage || "/default-profile.png",
            email: userRec.email || stored.email,
            phone: userRec.phone || stored.phone,
            userId: userRec.userId || stored.userId,
            teacherId: userRec.teacherId || stored.teacherId
          };
          setTeacher(merged);
          try {
            localStorage.setItem("teacher", JSON.stringify(merged));
          } catch (err) {
            // ignore localStorage write failures
          }
        } else {
          // if no user record found, ensure profileImage fallback exists
          const fallback = {
            ...stored,
            profileImage: stored.profileImage || "/default-profile.png"
          };
          setTeacher(fallback);
        }
      } catch (err) {
        console.error("Failed to fetch teacher profile from RTDB:", err);
        // ensure profileImage is present even on error
        setTeacher(prev => prev ? { ...prev, profileImage: prev.profileImage || "/default-profile.png" } : prev);
      }
    };

    enrichTeacher();
    fetchPosts(); // also load posts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Primary function: fetch posts, then fetch School_Admins and Users and resolve poster info.
  const fetchPosts = async () => {
    try {
      const postsResp = await axios.get(`${API_BASE}/get_posts`);
      let postsData = postsResp.data || [];

      // normalize if backend returned object keyed by id
      if (!Array.isArray(postsData) && typeof postsData === "object") {
        postsData = Object.values(postsData);
      }

      // fetch School_Admins and Users from RTDB
      const [adminsResp, usersResp] = await Promise.all([
        axios.get(`${RTDB_BASE}/School_Admins.json`),
        axios.get(`${RTDB_BASE}/Users.json`),
      ]);

      const schoolAdmins = adminsResp.data || {};
      const users = usersResp.data || {};

      // helpers for lookups
      const getSchoolAdminByKey = (key) => {
        if (!key) return null;
        return schoolAdmins[key] || null;
      };

      const getUserByKey = (key) => {
        if (!key) return null;
        return users[key] || null;
      };

      // sometimes the value in post.adminId might be a Users key or a user.userId field value
      const getUserByUserIdField = (userIdField) => {
        if (!userIdField) return null;
        return Object.values(users).find((u) => u && u.userId === userIdField) || null;
      };

      // enrich each post with adminName & adminProfile
      const enriched = postsData.map((raw) => {
        const post = { ...raw };

        // normalize id fields
        const postId = post.postId || post.id || post.key || null;

        // normalize likes
        let likesArray = [];
        if (Array.isArray(post.likes)) likesArray = post.likes;
        else if (post.likes && typeof post.likes === "object") likesArray = Object.keys(post.likes);
        else likesArray = [];

        // pick time
        const timeValue = post.time || post.timestamp || post.createdAt || null;

        // Resolve poster:
        // Posts[].adminId is the School_Admins RTDB key (per your DB)
        const adminIdFromPost = post.adminId || post.posterAdminId || post.poster || post.admin || null;

        let adminName = post.adminName || null;
        let adminProfile = post.adminProfile || null;

        if (adminIdFromPost) {
          // 1) Try: adminIdFromPost is a School_Admins key
          const schoolAdminRecord = getSchoolAdminByKey(adminIdFromPost);
          if (schoolAdminRecord) {
            // that record has userId which points to Users key
            const userKey = schoolAdminRecord.userId;
            const userRecord = getUserByKey(userKey) || getUserByUserIdField(userKey);

            if (userRecord) {
              adminName = adminName || userRecord.name || userRecord.username || schoolAdminRecord.name;
              adminProfile = adminProfile || userRecord.profileImage || userRecord.profile || "/default-profile.png";
            } else {
              // user not found but school admin has name
              adminName = adminName || schoolAdminRecord.name || schoolAdminRecord.username || "Admin";
              adminProfile = adminProfile || schoolAdminRecord.profileImage || "/default-profile.png";
            }
          } else {
            // 2) Maybe adminIdFromPost is already the Users key
            const userRecordDirect = getUserByKey(adminIdFromPost) || getUserByUserIdField(adminIdFromPost);
            if (userRecordDirect) {
              adminName = adminName || userRecordDirect.name || userRecordDirect.username || "Admin";
              adminProfile = adminProfile || userRecordDirect.profileImage || "/default-profile.png";
            } else {
              // 3) fallback to any adminName/profile fields in post
              adminName = adminName || post.name || post.username || "Admin";
              adminProfile = adminProfile || post.profileImage || post.authorProfile || "/default-profile.png";
              console.warn(`Unresolved adminId "${adminIdFromPost}" for post ${postId}. Falling back to post fields.`);
            }
          }
        } else {
          // no adminId in post; try existing fields
          adminName = adminName || post.adminName || post.name || post.username || "Admin";
          adminProfile = adminProfile || post.adminProfile || post.profileImage || "/default-profile.png";
        }

        // ensure fallbacks
        adminName = adminName || "Admin";
        adminProfile = adminProfile || "/default-profile.png";

        return {
          ...post,
          postId,
          adminName,
          adminProfile,
          time: timeValue,
          likes: likesArray,
          likeCount: post.likeCount || likesArray.length || 0,
        };
      });

      // sort newest first
      enriched.sort((a, b) => {
        const ta = a.time ? new Date(a.time).getTime() : 0;
        const tb = b.time ? new Date(b.time).getTime() : 0;
        return tb - ta;
      });

      setPosts(enriched);

      // build notifications (most recent 5)
      const latestNotifications = enriched.slice(0, 5).map((p) => ({
        id: p.postId,
        title: p.message?.substring(0, 80) || "Untitled post",
        adminName: p.adminName,
        adminProfile: p.adminProfile,
      }));
      setNotifications(latestNotifications);
    } catch (err) {
      console.error("Error fetching posts / resolving admins:", err);
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

  const handleNotificationClick = (postId, index) => {
    setHighlightedPostId(postId);
    const el = postRefs.current[postId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });

    setNotifications((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });

    setShowNotifications(false);
    setTimeout(() => setHighlightedPostId(null), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  if (!teacher) return null;

  return (
    <div className="dashboard-page">
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>

        <div className="nav-search">
          <FaSearch className="search-icon" />
          <input type="text" placeholder="Search Teacher and Student..." />
        </div>

        <div className="nav-right">
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
                }}>
                  {notifications.length}
                </span>
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
                  <div key={n.id || i} onClick={() => handleNotificationClick(n.id, i)} style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, borderBottom: "1px solid #eee", cursor: "pointer" }}>
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

          <div className="icon-circle"><FaFacebookMessenger /></div>
          <div className="icon-circle" onClick={() => navigate("/settings")}><FaCog /></div>

          <img src={teacher.profileImage || "/default-profile.png"} alt="teacher" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard">
        <div className="google-sidebar">
          <div className="sidebar-profile">
            <div className="sidebar-img-circle">
              <img src={teacher.profileImage || "/default-profile.png"} alt="profile" style={{ objectFit: "cover" }} />
            </div>
            <h3>{teacher.name}</h3>
            <p>{teacher.username}</p>
          </div>

          <div className="sidebar-menu">
            <Link className="sidebar-btn" to="/dashboard" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaHome /> Home</Link>
            <Link className="sidebar-btn" to="/students"><FaUsers /> Students</Link>
            <Link className="sidebar-btn" to="/admins"><FaUsers /> Admins</Link>
            <Link className="sidebar-btn" to="/parents"><FaChalkboardTeacher /> Parents</Link>
            <Link className="sidebar-btn" to="/marks"><FaClipboardCheck /> Marks</Link>
            <Link className="sidebar-btn" to="/attendance"><FaUsers /> Attendance</Link>
            <Link className="sidebar-btn" to="/schedule"><FaUsers /> Schedule</Link>
            <Link className="sidebar-btn" to="/settings"><FaCog /> Settings</Link>
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
                  <button onClick={() => handleLikePost(post.postId)} className="admin-like-btn" style={{ color: (post.likes || []).includes(teacher.userId) ? "#e0245e" : "#555" }}>
                    <span className="like-left">{(post.likes || []).includes(teacher.userId) ? <FaHeart /> : <FaRegHeart />} &nbsp; {(post.likes || []).includes(teacher.userId) ? "Liked" : "Like"}</span>
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