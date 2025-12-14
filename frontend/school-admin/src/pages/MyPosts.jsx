import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaBell,  FaSearch  } from "react-icons/fa";
import { AiFillPicture } from "react-icons/ai";
import "../styles/global.css";

function MyPosts() {
  const [posts, setPosts] = useState([]);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  
  // New post states
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);

  // Logged-in admin
  const admin = JSON.parse(localStorage.getItem("admin")) || {};

  useEffect(() => {
    fetchMyPosts();
  }, []);

  const fetchMyPosts = async () => {
    try {
      const res = await axios.get(
        `http://127.0.0.1:5000/api/get_my_posts/${admin.adminId}`
      );
      setPosts(res.data || []);
    } catch (err) {
      console.error("Error fetching posts:", err);
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await axios.delete(`http://127.0.0.1:5000/api/delete_post/${postId}`, {
        data: { adminId: admin.adminId },
      });
      setPosts(posts.filter((post) => post.postId !== postId));
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  const handleEdit = (postId, currentContent) => {
    setEditingPostId(postId);
    setEditedContent(currentContent);
  };

  const saveEdit = async (postId) => {
    try {
      await axios.post(`http://127.0.0.1:5000/api/edit_post/${postId}`, {
        adminId: admin.adminId,
        postText: editedContent,
      });
      setPosts(
        posts.map((post) =>
          post.postId === postId
            ? { ...post, message: editedContent, edited: true }
            : post
        )
      );
      setEditingPostId(null);
      setEditedContent("");
    } catch (err) {
      console.error("Error updating post:", err);
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await axios.post("http://127.0.0.1:5000/api/like_post", {
        adminId: admin.adminId,
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
                    [admin.adminId]: res.data.liked ? true : undefined,
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

  // ---------------- NEW POST ----------------
  const handlePost = async () => {
    if (!postText && !postMedia) return; // don't allow empty posts
    try {
      const formData = new FormData();
      formData.append("adminId", admin.adminId);
      formData.append("postText", postText);
      if (postMedia) formData.append("postMedia", postMedia);

      const res = await axios.post(
        "http://127.0.0.1:5000/api/create_post",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setPosts([res.data, ...posts]); // add new post to the top
      setPostText("");
      setPostMedia(null);
    } catch (err) {
      console.error("Error creating post:", err);
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
        src={admin.profileImage || "/default-profile.png"}
        alt="admin"
        className="profile-img"
      />
      {/* <span>{admin.name}</span> */}
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
       
       > <FaHome style={{ width: "28px", height:"28px" }}/> Home</Link>
        <Link className="sidebar-btn" to="/my-posts"
        style={{ backgroundColor: "#4b6cb7", color: "#fff" }}
        ><FaFileAlt /> My Posts</Link>
           <Link className="sidebar-btn" to="/teachers"><FaChalkboardTeacher /> Teachers</Link>
          <Link className="sidebar-btn" to="/students" >
                                  <FaChalkboardTeacher /> Students
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




















            {/* ---------------- POSTS LIST ---------------- */}
            {posts.length === 0 && (
              <p style={{ fontSize: "16px", textAlign: "center" }}>You have no posts yet.</p>
            )}

            {posts.map((post) => (
              <div
                key={post.postId}
               style={{
                       width: "55%",               // fixed width
                       margin: "0 5% 30px 40%", /* top:0, right:0, bottom:30px, left:25% */
                       border: "1px solid #ccc",
                       borderRadius: "12px",
                       boxShadow: "0 5px 20px rgba(0,0,0,0.1)",
                       background: "#fff",
}}

                className="post-card"
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "15px",
                    gap: "10px",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <div
                    style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "50%",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={admin.profileImage || "/default-profile.png"}
                      alt="profile"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div>
                    <h4 style={{ margin: 0 }}>{admin.name}</h4>
                    <small style={{ color: "gray" }}>{post.time}</small>
                  </div>
                </div>

                {/* Post content */}
                <div style={{ padding: "15px" }}>
                  {editingPostId === post.postId ? (
                    <div>
                      <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        style={{
                          width: "100%",
                          height: "100px",
                          padding: "10px",
                          borderRadius: "8px",
                          fontSize: "16px",
                          resize: "none",
                        }}
                      />
                      <div style={{ marginTop: "10px" }}>
                        <button
                          onClick={() => saveEdit(post.postId)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#4b6cb7",
                            color: "#fff",
                            cursor: "pointer",
                            marginRight: "10px",
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPostId(null)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#ccc",
                            color: "#333",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize: "16px", marginBottom: "10px" }}>{post.message}</p>
                      {post.edited && <small style={{ color: "gray" }}>(edited)</small>}
                      {post.postUrl && (
                        <img
                          src={post.postUrl}
                          alt="post media"
                          style={{
                            width: "100%",
                            maxHeight: "400px",
                            objectFit: "cover",
                            borderRadius: "12px",
                            marginTop: "10px",
                          }}
                        />
                      )}
                    </>
                  )}
                </div>

                {/* Footer buttons */}
                {editingPostId !== post.postId && (
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      padding: "10px 15px",
                      borderTop: "1px solid #eee",
                    }}
                  >
                    <button
                      onClick={() => handleEdit(post.postId, post.message)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#ffa500",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(post.postId)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#ff4b5c",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          
        </div>
      </div>
    </div>
  );
}

export default MyPosts;
