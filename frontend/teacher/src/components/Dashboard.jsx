import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaBell, FaSearch, FaClipboardCheck, FaUsers } from "react-icons/fa";
import axios from "axios";
import "../styles/global.css";

const API_BASE = "http://127.0.0.1:5000/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/get_posts`);
      const mappedPosts = (res.data || []).map((post) => ({
        postId: post.postId,
        adminName: post.adminName || "Admin",
        adminProfile: post.adminProfile || "/default-profile.png",
        message: post.message,
        postUrl: post.postUrl,
        timestamp: post.timestamp || "",
        likeCount: post.likeCount || 0,
        likes: post.likes ? Object.values(post.likes) : [] // get likes array from database
      }));
      mappedPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setPosts(mappedPosts);
    } catch (err) {
      console.error("Error fetching posts:", err);
    }
  };

  const handleLikePost = async (postId) => {
    if (!teacher) return;
    try {
      const res = await axios.post(`${API_BASE}/like_post`, {
        postId,
        teacherId: teacher.userId
      });

      if (res.data.success) {
        const updatedPosts = posts.map((post) => {
          if (post.postId === postId) {
            const likesSet = new Set(post.likes);
            if (res.data.liked) {
              likesSet.add(teacher.userId);
            } else {
              likesSet.delete(teacher.userId);
            }
            return {
              ...post,
              likeCount: res.data.likeCount,
              likes: Array.from(likesSet)
            };
          }
          return post;
        });
        setPosts(updatedPosts);
      }
    } catch (err) {
      console.error("Error toggling like:", err);
    }
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
          <div className="icon-circle"><FaBell /></div>
          <div className="icon-circle"><FaCog /></div>
          <img src={teacher.profileImage || "/default-profile.png"} alt="teacher" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard">
        <div className="google-sidebar">
          <div className="sidebar-profile">
            <div className="sidebar-img-circle">
              <img src={teacher.profileImage || "/default-profile.png"} alt="profile" />
            </div>
            <h3>{teacher.name}</h3>
            <p>{teacher.username}</p>
          </div>

          <div className="sidebar-menu">
            <Link className="sidebar-btn" to="/dashboard" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaHome /> Home</Link>
             <Link className="sidebar-btn" to="/notes" ><FaClipboardCheck /> Notes</Link>
            <Link className="sidebar-btn" to="/students"><FaUsers /> Students</Link>
            <Link className="sidebar-btn" to="/admins"><FaUsers /> Admins</Link>
            <Link className="sidebar-btn" to="/marks"><FaClipboardCheck /> Marks</Link>
            <Link to="/attendance" className="sidebar-btn"><FaUsers /> Attendance</Link>
            <Link className="sidebar-btn" to="/settings"><FaCog /> Settings</Link>
            <button className="sidebar-btn logout-btn" onClick={handleLogout}><FaSignOutAlt /> Logout</button>
          </div>
        </div>

        <div className="google-main">
          <div className="posts-container">
            {posts.length === 0 && <p>No posts available</p>}
            {posts.map((post) => (
              <div className="post-card" key={post.postId}>
                {/* Post Header */}
                <div className="post-header">
                  <div className="img-circle">
                    <img src={post.adminProfile} alt={post.adminName} />
                  </div>
                  <div className="post-info">
                    <h4>{post.adminName}</h4>
                    <span>{new Date(post.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                {/* Post Content */}
                <p>{post.message}</p>
                {post.postUrl && <img src={post.postUrl} alt="post media" className="post-media" />}

                {/* Like Button */}
                <div className="post-actions">
                  <button
                    className="like-button"
                    onClick={() => handleLikePost(post.postId)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      padding: "10px 18px",
                      borderRadius: "50px",
                      border: "none",
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: "pointer",
                      color: "#fff",
                      background: post.likes.includes(teacher.userId)
                        ? "#2563eb"
                        : "linear-gradient(135deg, #4b6cb7, #182848)",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                      transition: "all 0.3s ease"
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>👍</span>
                    {post.likeCount}
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
