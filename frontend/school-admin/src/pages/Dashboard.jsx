
import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/global.css";
import { AiFillPicture, AiFillVideoCamera } from "react-icons/ai";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaSearch  } from "react-icons/fa";
import { Link } from "react-router-dom";




function Dashboard() {
  // ---------------- STATE ----------------
  const [admin, setAdmin] = useState({
    adminId: "",
    name: "",
    username: "",
    profileImage: "/default-profile.png",
  });
  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);

  // ---------------- HELPER: LOAD ADMIN FROM LOCALSTORAGE ----------------
  const loadAdminFromStorage = () => {
    const storedAdmin = localStorage.getItem("admin");
    if (storedAdmin) {
      setAdmin(JSON.parse(storedAdmin));
    }
  };

  // ---------------- FETCH POSTS ----------------
  const fetchPosts = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:5000/api/get_posts");
      const sortedPosts = res.data.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
      setPosts(sortedPosts);
    } catch (err) {
      console.error("Error fetching posts:", err);
    }
  };

  // ---------------- EFFECT ON MOUNT ----------------
  useEffect(() => {
    loadAdminFromStorage();
    fetchPosts();
  }, []);

  // ---------------- HANDLE POST ----------------
  const handlePost = async () => {
    if (!postText && !postMedia) return alert("Enter message or select media");
    const formData = new FormData();
    formData.append("text", postText);
    formData.append("adminId", admin.adminId);
    if (postMedia) formData.append("post_media", postMedia);

    try {
      await axios.post("http://127.0.0.1:5000/api/create_post", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPostText("");
      setPostMedia(null);
      fetchPosts();
    } catch (err) {
      console.error("Error creating post:", err);
    }
  };
// ---------------- LIKE POST ----------------
async function toggleLike(postId) {
    const adminId = localStorage.getItem("adminId");
    await fetch("/api/like_post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, adminId })
    });
    loadPosts();
}
  // ---------------- HANDLE LIKE ----------------

const handleLike = async (postId) => {
  try {
    const res = await axios.post("http://127.0.0.1:5000/api/like_post", {
      adminId: admin.adminId,
      postId,
    });

    if (res.data.success) {
      // Update posts state
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.postId === postId
            ? {
                ...post,
                likeCount: res.data.likeCount,
                likes: {
                  ...post.likes,
                  [admin.adminId]: res.data.liked ? true : undefined
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
    <img
      src={admin.profileImage || "/default-profile.png"}
      alt="admin"
    />
    <span>{admin.name}</span>
  </div>
</nav>


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
          <Link className="sidebar-btn" to="/students" > <FaChalkboardTeacher /> Students
                                </Link>
         <Link className="sidebar-btn" to="/settings" >
                      <FaCog /> Settings
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
  <div className="fb-post-top">
    <img src={admin.profileImage || "/default-profile.png"} alt="me" />
    <textarea
      placeholder="What's on your mind?"
      value={postText}
      onChange={(e) => setPostText(e.target.value)}
    />
<div className="fb-post-bottom">
   <label className="fb-upload">
  <AiFillPicture className="fb-icon" />
 
  <input
    type="file"
    onChange={(e) => setPostMedia(e.target.files[0])}
    accept="image/*,video/*"
  />
</label>


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
      color: post.likes && post.likes[admin.adminId] ? "red" : "black",
      cursor: "pointer",
      background: "transparent",
      border: "none",
      fontSize: "16px"
    }}
  >
    👍 {post.likeCount || 0}
  </button>
</div>


                  {post.adminId === admin.adminId && (
                    <>
                      <button
                        onClick={() => handleEdit(post.postId, post.message)}
                      >
                        Edit
                      </button>
                      <button onClick={() => handleDelete(post.postId)}>
                        Delete
                      </button>
                    </>
                  )}
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
