import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaBell, FaFacebookMessenger ,  FaSearch, FaCalendarAlt  } from "react-icons/fa";
import { AiFillPicture } from "react-icons/ai";
import "../styles/global.css";

function MyPosts() {
  const [posts, setPosts] = useState([]);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  
  // New post states
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);
  const [teachers, setTeachers] = useState([]);
const [unreadTeachers, setUnreadTeachers] = useState({});
const [popupMessages, setPopupMessages] = useState([]);
const [showMessageDropdown, setShowMessageDropdown] = useState(false);
const [selectedTeacher, setSelectedTeacher] = useState(null);
const [teacherChatOpen, setTeacherChatOpen] = useState(false);





  // Logged-in admin
  const admin = JSON.parse(localStorage.getItem("admin")) || {};
const adminUserId = admin.userId;
  // SAFELY GET ADMIN ID
  const adminId = admin.adminId || admin.userId || admin.id;

 useEffect(() => {
    if (!adminId) {
      console.error("Admin ID missing in localStorage", admin);
      return;
    }
    fetchMyPosts();
  }, [adminId]);

   const fetchMyPosts = async () => {
    try {
      const res = await axios.get(`http://127.0.0.1:5000/api/get_my_posts/${adminId}`);
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

        {/* Messenger */}
    <div 
  className="icon-circle" 
  style={{ position: "relative", cursor: "pointer" }}
  onClick={() => setShowMessageDropdown(prev => !prev)}
>
  <FaFacebookMessenger />
  {Object.values(unreadTeachers).reduce((a,b)=>a+b,0) > 0 && (
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
      {Object.values(unreadTeachers).reduce((a,b)=>a+b,0)}
    </span>
  )}

  {showMessageDropdown && (
    <div style={{
      position: "absolute",
      top: "35px",
      right: "0",
      width: "300px",
      maxHeight: "400px",
      overflowY: "auto",
      background: "#fff",
      border: "1px solid #ddd",
      borderRadius: "8px",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
      zIndex: 1000
    }}>
      {teachers.map(t => {
        const msgs = popupMessages
          .filter(m => m.senderId === t.userId || m.receiverId === t.userId)
          .sort((a,b) => a.timeStamp - b.timeStamp);
        const latestMsg = msgs[msgs.length - 1];

        return (
          <div
            key={t.userId}
            onClick={() => {
              setSelectedTeacher(t);
              setTeacherChatOpen(true);
              setShowMessageDropdown(false);
            }}
            style={{
              padding: "10px",
              borderBottom: "1px solid #eee",
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              background: unreadTeachers[t.userId] > 0 ? "#f0f4ff" : "#fff"
            }}
          >
            <img src={t.profileImage} alt={t.name} style={{ width: "40px", height: "40px", borderRadius: "50%", marginRight: "10px" }} />
            <div style={{ flex: 1 }}>
              <strong>{t.name}</strong>
              <p style={{ margin:0, fontSize:"12px", color:"#555" }}>{latestMsg?.text || "No messages yet"}</p>
            </div>
            {unreadTeachers[t.userId] > 0 && (
              <span style={{
                background: "red",
                color: "#fff",
                borderRadius: "50%",
                padding: "2px 6px",
                fontSize: "10px",
                marginLeft: "5px"
              }}>
                {unreadTeachers[t.userId]}
              </span>
            )}
          </div>
        )
      })}
      {teachers.every(t => !unreadTeachers[t.userId]) && (
        <p style={{ textAlign: "center", padding: "10px", color:"#777" }}>No new messages</p>
      )}
    </div>
  )}
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
             <Link className="sidebar-btn" to="/my-posts" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaFileAlt /> My Posts</Link>
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
