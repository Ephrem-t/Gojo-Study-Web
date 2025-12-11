import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AiFillPicture } from "react-icons/ai";
import { FaHome, FaFileAlt, FaUserGraduate, FaCog, FaSignOutAlt, FaSearch } from "react-icons/fa";
import axios from "axios";
import "../styles/global.css";
import { FaChalkboardTeacher } from "react-icons/fa";


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
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);

  useEffect(() => {
    const storedTeacher = localStorage.getItem("teacher");
    if (!storedTeacher) return navigate("/login");
    setTeacher(JSON.parse(storedTeacher));
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/get_posts`);
      const sortedPosts = res.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setPosts(sortedPosts);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePost = async () => {
    if (!postText && !postMedia) return alert("Enter message or select media");
    const formData = new FormData();
    formData.append("text", postText);
    formData.append("teacherId", teacher.teacherId);
    if (postMedia) formData.append("post_media", postMedia);

    try {
      await axios.post(`${API_BASE}/create_post`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPostText("");
      setPostMedia(null);
      fetchPosts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await axios.post(`${API_BASE}/like_post`, {
        teacherId: teacher.teacherId,
        postId,
      });
      if (res.data.success) {
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId === postId
              ? {
                  ...post,
                  likeCount: res.data.likeCount,
                  likes: { ...post.likes, [teacher.teacherId]: res.data.liked ? true : undefined },
                }
              : post
          )
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (postId) => {
    try {
      await axios.delete(`${API_BASE}/delete_post/${postId}`, {
        data: { teacherId: teacher.teacherId },
      });
      fetchPosts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = async (postId, currentText) => {
    const newText = prompt("Edit your post:", currentText);
    if (!newText) return;
    try {
      await axios.post(`${API_BASE}/edit_post/${postId}`, {
        teacherId: teacher.teacherId,
        postText: newText,
      });
      fetchPosts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  return (
     <div className="dashboard-page">
      {/* Top Navbar */}
     <nav className="top-navbar">
        <h2>Teacher Dashboard</h2>
        {/* Search Bar */}
  <div className="nav-search">
          <FaSearch className="search-icon" />
          <input type="text" placeholder="Search..."  />
        </div>
        <div className="nav-right">
          <img src={teacher.profileImage} alt="profile" />
          <span>{teacher.name}</span>
        </div>
      </nav>

       <div className="google-dashboard">
        {/* Sidebar */}
       <div className="google-sidebar">
      <div className="sidebar-profile">
        <div className="sidebar-img-circle">
            <img src={teacher.profileImage} alt="profile"/>
        </div>
            <h3>{teacher.name || "Admin Name"}</h3>
            <p>{teacher.username || "username"}</p>
          </div>
          
        <div className="sidebar-menu">
      <Link className="sidebar-btn" to="/dashboard"
       style={{ backgroundColor: "#4b6cb7", color: "#fff" }}
       > <FaHome style={{ width: "28px", height:"28px" }}/> Home</Link>
        <Link className="sidebar-btn" to="/my-posts"><FaFileAlt /> My Posts</Link>
        <Link className="sidebar-btn" to="/teachers"><FaChalkboardTeacher /> Teachers</Link>
          <Link className="sidebar-btn" to="/students" > <FaChalkboardTeacher /> Students
                                </Link>
         <Link className="sidebar-btn" to="/settings" >
                      <FaCog /> Settings
                    </Link>
        <button
          className="sidebar-btn logout-btn"
          onClick={() => {
           localStorage.removeItem("teacher");


            window.location.href = "/login";
          }}
        >
          <FaSignOutAlt /> Logout
        </button>
      </div>
        </div>


         {/* MAIN CONTENT — 75% */}
        <div className="google-main">
       

        
        
           {/* Posts container */}
          <div className="posts-container">
            {posts.map((post) => (
              <div className="post-card" key={post.postId}>
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
      color: post.likes && post.likes[teacher.teacherId] ? "red" : "black",
      cursor: "pointer",
      background: "transparent",
      border: "none",
      fontSize: "16px"
    }}
  >
    👍 {post.likeCount || 0}
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
