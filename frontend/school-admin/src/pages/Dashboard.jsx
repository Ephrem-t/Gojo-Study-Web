
import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/global.css";
import { AiFillPicture, AiFillVideoCamera } from "react-icons/ai";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaBell,  FaSearch, FaFacebookMessenger, FaCalendarAlt  } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";






function Dashboard() {
  // ---------------- STATE ----------------
const [admin, setAdmin] = useState({
  userId: "",
  name: "",
  username: "",
  profileImage: "/default-profile.png",
});

  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);

  const [unreadMessages, setUnreadMessages] = useState([]);
  const [showMessengerDropdown, setShowMessengerDropdown] = useState(false);

const [teachers, setTeachers] = useState([]);
const [unreadTeachers, setUnreadTeachers] = useState({});
const [popupMessages, setPopupMessages] = useState([]);
const [showMessageDropdown, setShowMessageDropdown] = useState(false);
const [selectedTeacher, setSelectedTeacher] = useState(null);
const [teacherChatOpen, setTeacherChatOpen] = useState(false);


const adminUserId = admin.userId;


const navigate = useNavigate();

  // ---------------- HELPER: LOAD ADMIN FROM LOCALSTORAGE ----------------
  const loadAdminFromStorage = () => {
    const storedAdmin = localStorage.getItem("admin");
    if (storedAdmin) {
      setAdmin(JSON.parse(storedAdmin));
    }
  };

const handleOpenChat = (user, userType) => {
  navigate("/allchat", {
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





/// ---------------- FETCH POST NOTIFICATIONS ----------------


const [showPostDropdown, setShowPostDropdown] = useState(false);
const [unreadPostList, setUnreadPostList] = useState([]);



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
    // Mark post as seen in the backend
    await axios.post("http://127.0.0.1:5000/api/mark_post_seen", {
      postId: post.postId,
      userId: admin.userId
    });

    // Remove this post from the unreadPostList immediately
    setUnreadPostList(prev => prev.filter(p => p.postId !== post.postId));

    // Scroll to the post in the main feed
    const el = document.getElementById(`post-${post.postId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      el.style.backgroundColor = "#ffffcc";
      setTimeout(() => (el.style.backgroundColor = ""), 2000);
    }
  } catch (err) {
    console.error("Error opening post notification:", err);
  }
};




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

 //
const handlePost = async () => {
  if (!postText && !postMedia) return alert("Enter message or select media");

  const formData = new FormData();
  formData.append("message", postText);

  formData.append("adminId", admin.userId);

  formData.append("adminName", admin.name);
  formData.append("adminProfile", admin.profileImage);

  if (postMedia) formData.append("post_media", postMedia);

  try {
    await axios.post("http://127.0.0.1:5000/api/create_post", formData);
    setPostText("");
    setPostMedia(null);
    fetchPosts();
  } catch (err) {
    console.error(err);
  }
};


  // ---------------- HANDLE LIKE ----------------

const handleLike = async (postId) => {
  try {
   const res = await axios.post("http://127.0.0.1:5000/api/like_post", {
  adminId: admin.userId,
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
  [admin.userId]: res.data.liked ? true : undefined
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
       data: { adminId: admin.userId },

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
       adminId: admin.userId,

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
      {teachers
  .filter(t => unreadTeachers[t.userId] > 0)
  .map(t => {
    const msgs = popupMessages
      .filter(m => m.senderId === t.userId && !m.seen)
      .sort((a, b) => a.timeStamp - b.timeStamp);
    const latestMsg = msgs[msgs.length - 1];

    return (
      <div
        key={t.userId}
        style={{
          padding: "10px",
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          cursor: "pointer", // make it clickable
          background: "#f9f9f9"
        }}
        onClick={() => {
          setShowMessageDropdown(false); // close dropdown
          navigate("/all-chat", { state: { teacher: t } }); // navigate
        }}
      >
        <img 
          src={t.profileImage} 
          alt={t.name} 
          style={{ width: "40px", height: "40px", borderRadius: "50%", marginRight: "10px" }} 
        />
        <div style={{ flex: 1 }}>
          <strong>{t.name}</strong>
          <p style={{ margin: 0, fontSize: "12px", color: "#555" }}>
            {latestMsg?.text || "New message"}
          </p>
        </div>
        {latestMsg && (
          <span style={{ fontSize: "10px", color: "#888", marginLeft: "5px" }}>
            {new Date(latestMsg.timeStamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    );
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
     color: post.likes && post.likes[admin.userId] ? "red" : "black",

      cursor: "pointer",
      background: "transparent",
      border: "none",
      fontSize: "16px"
    }}
  >
    👍 {post.likeCount || 0}
  </button>
</div>


                 {post.adminId === admin.userId && (

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
