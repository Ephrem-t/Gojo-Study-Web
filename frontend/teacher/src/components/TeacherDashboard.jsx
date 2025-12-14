import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaBell,  FaSearch  } from "react-icons/fa";

import axios from "axios";
import "../styles/global.css";

const API_BASE = "http://127.0.0.1:5000/api";

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState({
    teacherId: "",
    name: "",
    username: "",
    profileImage: "/default-profile.png",
  });
  const [posts, setPosts] = useState([]);

  // Load teacher from backend
  useEffect(() => {
    const storedTeacher = localStorage.getItem("teacher");
    if (!storedTeacher) return navigate("/login");

    const { teacherId } = JSON.parse(storedTeacher);

    // Fetch latest teacher info from backend
    const fetchTeacher = async () => {
      try {
        const res = await axios.get(`${API_BASE}/teacher/${teacherId}`);
        if (res.data.success) {
          const teacherData = res.data.teacher;
          if (!teacherData.profileImage) teacherData.profileImage = "/default-profile.png";
          setTeacher(teacherData);
          localStorage.setItem("teacher", JSON.stringify(teacherData)); // update localStorage
        } else {
          navigate("/login");
        }
      } catch (err) {
        console.error(err);
        navigate("/login");
      }
    };

    fetchTeacher();
    fetchPosts();
  }, []);

  // Fetch posts from backend
  const fetchPosts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/get_posts`);

      // Map posts to include admin info if missing
      const mappedPosts = res.data.map((post) => ({
        postId: post.postId,
        adminName: post.adminName || "Admin",
        adminProfile: post.adminProfile || "/default-profile.png",
        message: post.message,
        postUrl: post.postUrl,
        timestamp: post.time || post.timestamp || "",
        likeCount: post.likeCount || 0,
        likes: post.likes || {},
      }));

      // Sort by timestamp descending
      mappedPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setPosts(mappedPosts);
    } catch (err) {
      console.error("Error fetching posts:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  return (
    <div className="dashboard-page">





     {/* ---------------- TOP NAVIGATION BAR ---------------- */}
     <nav className="top-navbar">
       <h2>Gojo Dashboard</h2>
     
       {/* Search Bar */}
       <div className="nav-search">
         <FaSearch className="search-icon" />
         <input type="text" placeholder="Search Teacher and Student..." />
       </div>
     
       <div className="nav-right">
         {/* Notification */}
         <div className="icon-circle">
           <FaBell />
         </div>
     
         {/* Settings */}
         <div className="icon-circle">
           <FaCog />
         </div>
     
         {/* Profile */}
         <img
           src={teacher.profileImage || "/default-profile.png"}
           alt="teacher"
           className="profile-img"
         />
         {/* <span>{admin.name}</span> */}
       </div>
     </nav>









      <div className="google-dashboard">
        {/* Sidebar */}
        <div className="google-sidebar">
          <div className="sidebar-profile">
            <div className="sidebar-img-circle">
              <img src={teacher.profileImage} alt="profile" />
            </div>
            <h3>{teacher.name || "Admin Name"}</h3>
            <p>{teacher.username || "username"}</p>
          </div>

          <div className="sidebar-menu">
            <Link className="sidebar-btn" to="/dashboard" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}>
              <FaHome style={{ width: "28px", height: "28px" }} /> Home
            </Link>
            <Link className="sidebar-btn" to="/my-posts">
              <FaFileAlt /> My Posts
            </Link>
            <Link className="sidebar-btn" to="/teachers">
              <FaChalkboardTeacher /> Teachers
            </Link>
            <Link className="sidebar-btn" to="/students">
              <FaChalkboardTeacher /> Students
            </Link>
            <Link className="sidebar-btn" to="/settings">
              <FaCog /> Settings
            </Link>
            <button className="sidebar-btn logout-btn" onClick={handleLogout}>
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="google-main">
          <div className="posts-container">
            {posts.length === 0 && <p>No posts available</p>}

            {posts.map((post) => (
              <div className="post-card" key={post.postId}>
                <div className="post-header">
                  <div className="img-circle">
                    <img src={post.adminProfile} alt={post.adminName} />
                  </div>
                  <div className="post-info">
                    <h4>{post.adminName}</h4>
                    <span>{post.timestamp}</span>
                  </div>
                </div>

                <p>{post.message}</p>
                {post.postUrl && <img src={post.postUrl} alt="post media" />}

                <div className="post-actions">
                  <div className="like-button">
                    <button
                      style={{
                        cursor: "pointer",
                        background: "transparent",
                        border: "none",
                        fontSize: "16px",
                      }}
                    >
                      👍 {post.likeCount}
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
};

export default TeacherDashboard;
