import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaBell, FaFacebookMessenger, FaSearch, FaCalendarAlt, FaCommentDots } from "react-icons/fa";
import axios from "axios";
import { getDatabase, ref, onValue } from "firebase/database"; // make sure firebase initialized
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";


const DB = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

const getChatId = (a, b) => [a, b].sort().join("_");

function Parent() {
  const [parents, setParents] = useState([]);

  const [parentTab, setParentTab] = useState("details");
  const [parentChatOpen, setParentChatOpen] = useState(false);
  
  const [newMessageText, setNewMessageText] = useState("");
  const [parentInfo, setParentInfo] = useState(null);
  const [children, setChildren] = useState([]);
  const [expandedChildren, setExpandedChildren] = useState({});
  // At the top of your Parent component
  const [expanded, setExpanded] = useState(false);
const [unreadSenders, setUnreadSenders] = useState([]); 
const [showMessageDropdown, setShowMessageDropdown] = useState(false);
const [postNotifications, setPostNotifications] = useState([]);
const [showPostDropdown, setShowPostDropdown] = useState(false);
const [selectedParent, setSelectedParent] = useState(null);

 const [messageDropdownVisible, setMessageDropdownVisible] = useState(false);
  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem("admin")) || {};


const adminId = admin.userId;
 const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  if (!admin?.userId) return null;


 const chatId =
  admin?.userId && selectedParent?.userId
    ? getChatId(admin.userId, selectedParent.userId)
    : null;



const fetchPostNotifications = async () => {
  if (!adminId) return;

  try {
    // 1️⃣ Get post notifications
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

    // 2️⃣ Fetch Users & School_Admins
    const [usersRes, adminsRes] = await Promise.all([
      axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"
      ),
      axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/School_Admins.json"
      ),
    ]);

    const users = usersRes.data || {};
    const admins = adminsRes.data || {};

    // 3️⃣ Helpers
    const findAdminUser = (adminId) => {
      const admin = admins[adminId];
      if (!admin) return null;

      return Object.values(users).find(
        (u) => u.userId === admin.userId
      );
    };

    // 4️⃣ Enrich notifications
    const enriched = notifications.map((n) => {
      const posterUser = findAdminUser(n.adminId);

      return {
        ...n,
        notificationId:
          n.notificationId ||
          n.id ||
          `${n.postId}_${n.adminId}`,

        adminName: posterUser?.name || "Unknown Admin",
        adminProfile:
          posterUser?.profileImage || "/default-profile.png",
      };
    });

    setPostNotifications(enriched);
  } catch (err) {
    console.error("Post notification fetch failed", err);
    setPostNotifications([]);
  }
};


useEffect(() => {
  if (!adminId) return;

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

  // 🔥 REMOVE FROM UI IMMEDIATELY
  setPostNotifications((prev) =>
    prev.filter((n) => n.notificationId !== notification.notificationId)
  );

  setShowPostDropdown(false);

  // ➜ Navigate to post
  navigate("/dashboard", {
    state: { postId: notification.postId },
  });
};
useEffect(() => {
  if (location.state?.postId) {
    setPostNotifications([]);
  }
}, []);




useEffect(() => {
  const closeDropdown = (e) => {
    if (
      !e.target.closest(".icon-circle") &&
      !e.target.closest(".notification-dropdown")
    ) {
      setShowPostDropdown(false);
    }
  };

  document.addEventListener("click", closeDropdown);
  return () => document.removeEventListener("click", closeDropdown);
}, []);




  // Fetch all parents from Users DB
  useEffect(() => {
    const fetchParents = async () => {
      try {
        const res = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json");
        const users = res.data || {};
        const parentList = Object.keys(users)
          .filter(uid => users[uid].role === "parent")
          .map(uid => ({
            userId: uid,
            name: users[uid].name || users[uid].username || "No Name",
            email: users[uid].email || "N/A",
            profileImage: users[uid].profileImage || "/default-profile.png",
          }));
        setParents(parentList);
      } catch (err) {
        console.error("Error fetching parents:", err);
      }
    };
    fetchParents();
  }, []);
 const toggleDropdown = () => {
    setShowMessageDropdown(prev => !prev);
  };
const handleClick = () => {
    navigate("/all-chat"); // replace with your target route
  };


  useEffect(() => {
    // Replace with your actual API call
    const fetchUnreadSenders = async () => {
      const response = await fetch("/api/unreadSenders");
      const data = await response.json();
      setUnreadSenders(data);
    };
    fetchUnreadSenders();
  }, []);

  // Fetch parent info & children for selected parent
 useEffect(() => {
  if (!selectedParent) return;

  const fetchParentInfoAndChildren = async () => {
    try {
      // Fetch Parents
      const parentsRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Parents.json"
      );
      const parentsData = parentsRes.data || {};
      const parentRecord = Object.values(parentsData).find(
        p => p.userId === selectedParent.userId
      );

      if (!parentRecord) {
        setParentInfo(null);
        setChildren([]);
        return;
      }

      // Fetch Users
      const usersRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"
      );
      const usersData = usersRes.data || {};
      const userInfo = usersData[selectedParent.userId] || {};

      setParentInfo({
        userId: selectedParent.userId,
        name: userInfo.name || userInfo.username || "No Name",
        email: userInfo.email || "N/A",
        phone: parentRecord.phone || "N/A",
        status: parentRecord.status || "N/A",
        additionalInfo: parentRecord.additionalInfo || "N/A",
        createdAt: parentRecord.createdAt || "N/A",
        profileImage: userInfo.profileImage || "/default-profile.png",
      });

      // Fetch Students
      const studentsRes = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json"
      );
      const studentsData = studentsRes.data || {};

      // Map children
      const childrenList = Object.values(parentRecord.children || {}).map(childLink => {
        const studentRecord = studentsData[childLink.studentId];
        if (!studentRecord) {
          console.warn("Student record not found for:", childLink.studentId);
          return null;
        }

        const studentUserId = studentRecord.use || studentRecord.userId; // try both
        if (!studentUserId) {
          console.warn("Student userId missing in studentRecord:", studentRecord);
        }

        const studentUser = usersData[studentUserId] || {};
        return {
          studentId: childLink.studentId,
          name: studentUser.name || studentUser.username || "No Name",
          email: studentUser.email || "N/A",
          grade: studentRecord.grade || "N/A",
          section: studentRecord.section || "N/A",
          parentPhone: parentRecord.phone || "N/A",
          relationship: childLink.relationship || "N/A",
          profileImage: studentUser.profileImage || "/default-profile.png",
        };
      }).filter(Boolean);

      setChildren(childrenList);
      console.log("Fetched children:", childrenList);

    } catch (err) {
      console.error("Error fetching parent info and children:", err);
      setParentInfo(null);
      setChildren([]);
    }
  };

  fetchParentInfoAndChildren();
}, [selectedParent]);


 // ---------------- FETCH UNREAD MESSAGES ----------------
const fetchUnreadMessages = async () => {
  if (!admin.userId) return;

  const senders = {};

  try {
    // 1️⃣ USERS (names & images)
    const usersRes = await axios.get(
      "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"
    );
    const usersData = usersRes.data || {};

 const findUserByUserId = (userId) => {
  return Object.values(usersData).find(u => u.userId === userId);
};



    // helper to read messages from BOTH chat keys
    const getUnreadCount = async (userId) => {
      const key1 = `${admin.userId}_${userId}`;
      const key2 = `${userId}_${admin.userId}`;

      const [r1, r2] = await Promise.all([
        axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`),
        axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`)
      ]);

      const msgs = [
        ...Object.values(r1.data || {}),
        ...Object.values(r2.data || {})
      ];

      return msgs.filter(
        m => m.receiverId === admin.userId && !m.seen
      ).length;
    };

    // 2️⃣ TEACHERS
    const teachersRes = await axios.get(
      "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"
    );

    for (const k in teachersRes.data || {}) {
      const t = teachersRes.data[k];
      const unread = await getUnreadCount(t.userId);

      if (unread > 0) {
       const user = findUserByUserId(t.userId);

senders[t.userId] = {
  type: "teacher",
  name: user?.name || "Teacher",
  profileImage: user?.profileImage || "/default-profile.png",
  count: unread
};
      }
    }

    // 3️⃣ STUDENTS
    const studentsRes = await axios.get(
      "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json"
    );

    for (const k in studentsRes.data || {}) {
      const s = studentsRes.data[k];
      const unread = await getUnreadCount(s.userId);

      if (unread > 0) {
        const user = findUserByUserId(s.userId);

senders[s.userId] = {
  type: "student",
  name: user?.name || s.name || "Student",
  profileImage: user?.profileImage || s.profileImage || "/default-profile.png",
  count: unread
};

      }
    }

    // 4️⃣ PARENTS
    const parentsRes = await axios.get(
      "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Parents.json"
    );

    for (const k in parentsRes.data || {}) {
      const p = parentsRes.data[k];
      const unread = await getUnreadCount(p.userId);

      if (unread > 0) {
       const user = findUserByUserId(p.userId);

senders[p.userId] = {
  type: "parent",
  name: user?.name || p.name || "Parent",
  profileImage: user?.profileImage || p.profileImage || "/default-profile.png",
  count: unread
};

      }
    }

    setUnreadSenders(senders);
  } catch (err) {
    console.error("Unread fetch failed:", err);
  }
};

  // ---------------- CLOSE DROPDOWN ON OUTSIDE CLICK ----------------
useEffect(() => {
  const closeDropdown = (e) => {
    if (
      !e.target.closest(".icon-circle") &&
      !e.target.closest(".messenger-dropdown")
    ) {
      setShowMessageDropdown(false);
    }
  };

  document.addEventListener("click", closeDropdown);
  return () => document.removeEventListener("click", closeDropdown);
}, []);


useEffect(() => {
  if (!admin.userId) return;

  fetchUnreadMessages();
  const interval = setInterval(fetchUnreadMessages, 5000);

  return () => clearInterval(interval);
}, [admin.userId]);

useEffect(() => {
    const closeDropdown = (e) => {
      // Optionally check if click is outside
      setShowMessageDropdown(false);
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);





  /* ================= FETCH MESSAGES ================= */
useEffect(() => {
  if (!chatId) return;

  const db = getDatabase();
  const messagesRef = ref(db, `Chats/${chatId}/messages`);

  const unsubscribe = onValue(messagesRef, (snapshot) => {
    const data = snapshot.val() || {};
    const list = Object.entries(data)
      .map(([id, msg]) => ({ messageId: id, ...msg }))
      .sort((a, b) => a.timeStamp - b.timeStamp);
    setMessages(list);
  });

  return () => unsubscribe(); // cleanup listener on unmount
}, [chatId]);


  /* ================= INIT CHAT ================= */
  const initChatIfMissing = async () => {
    await axios.patch(`${DB}/Chats/${chatId}.json`, {
      participants: {
        [admin.userId]: true,
        [selectedParent.userId]: true
      },
      unread: {
        [admin.userId]: 0,
        [selectedParent.userId]: 0
      }
    });
  };

  /* ================= SEND MESSAGE ================= */
const sendMessage = async (text) => {
  if (!text.trim() || !selectedParent) return;
if (!admin?.userId || !selectedParent?.userId) return;

 
  const chatId = getChatId(admin.userId, selectedParent.userId);
  const messageId = Date.now();

  await axios.put(`${DB}/Chats/${chatId}/messages/${messageId}.json`, {
    senderId: admin.userId,
    receiverId: selectedParent.userId,
    type: "text",
    text,
    imageUrl: null,
    replyTo: null,
    seen: false,
    edited: false,
    deleted: false,
    timeStamp: Date.now(),
  });

  await axios.patch(`${DB}/Chats/${chatId}.json`, {
    lastMessage: {
      text,
      senderId: admin.userId,
      seen: false,
      timeStamp: Date.now(),
    },
    unread: {
      [selectedParent.userId]: 1
    }
  });

  setNewMessageText("");
};


  /* ================= MARK AS SEEN ================= */
 useEffect(() => {
  if (!selectedParent || !admin?.userId) return;

  const chatId = getChatId(admin.userId, selectedParent.userId);

  axios.patch(`${DB}/Chats/${chatId}.json`, {
    unread: {
      [admin.userId]: 0
    },
    lastMessage: {
      seen: true
    }
  });
}, [selectedParent]);



  return (
    <div className="dashboard-page">
      {/* TOP NAVBAR */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>
        <div className="nav-search">
          <FaSearch className="search-icon" />
          <input type="text" placeholder="Search Parents..." />
        </div>
        <div className="nav-right">
          <div
  className="icon-circle"
  style={{ position: "relative", cursor: "pointer" }}
  onClick={(e) => {
    e.stopPropagation();
    setShowPostDropdown(prev => !prev);
  }}
>
  <FaBell />

  {/* 🔴 Notification Count */}
  {postNotifications.length > 0 && (
    <span
      style={{
        position: "absolute",
        top: "-5px",
        right: "-5px",
        background: "red",
        color: "#fff",
        borderRadius: "50%",
        padding: "2px 6px",
        fontSize: "10px",
        fontWeight: "bold"
      }}
    >
      {postNotifications.length}
    </span>
  )}

  {/* 🔔 Notification Dropdown */}
  {showPostDropdown && (
    <div
      className="notification-dropdown"
      style={{
        position: "absolute",
        top: "40px",
        right: "0",
        width: "350px",
        maxHeight: "400px",
        overflowY: "auto",
        background: "#fff",
        borderRadius: "10px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.25)",
        zIndex: 1000
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {postNotifications.length === 0 ? (
        <p style={{ padding: "12px", textAlign: "center" }}>
          No new notifications
        </p>
      ) : (
        postNotifications.map(n => (
          <div
            key={n.notificationId}
            style={{
              display: "flex",
              gap: "10px",
              padding: "10px",
              cursor: "pointer",
              borderBottom: "1px solid #eee"
            }}
            onClick={() => handleNotificationClick(n)}
          >
            <img
              src={n.adminProfile || "/default-profile.png"}
              alt={n.adminName}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%"
              }}
            />
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




          {/* ================= MESSENGER ================= */}
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowMessageDropdown((prev) => !prev);
            }}
          >
            <FaFacebookMessenger />
          
            {/* 🔴 TOTAL UNREAD COUNT */}
            {Object.keys(unreadSenders).length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-5px",
                  background: "red",
                  color: "#fff",
                  borderRadius: "50%",
                  padding: "2px 6px",
                  fontSize: "10px",
                  fontWeight: "bold"
                }}
              >
                {Object.values(unreadSenders).reduce((a, b) => a + b.count, 0)}
              </span>
            )}
          
            {/* 📩 DROPDOWN */}
            {showMessageDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "40px",
                  right: "0",
                  width: "300px",
                  background: "#fff",
                  borderRadius: "10px",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.25)",
                  zIndex: 1000
                }}
              >
                {Object.keys(unreadSenders).length === 0 ? (
                  <p style={{ padding: "12px", textAlign: "center", color: "#777" }}>
                    No new messages
                  </p>
                ) : (
                  Object.entries(unreadSenders).map(([userId, sender]) => (
                    <div
                      key={userId}
                      style={{
                        padding: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                        borderBottom: "1px solid #eee"
                      }}
                  onClick={async () => {
  setShowMessageDropdown(false);

  // 1️⃣ Mark messages as seen in DB
  await markMessagesAsSeen(userId);

  // 2️⃣ Remove sender immediately from UI
  setUnreadSenders(prev => {
    const copy = { ...prev };
    delete copy[userId];
    return copy;
  });

  // 3️⃣ Navigate to exact chat
  navigate("/all-chat", {
    state: {
      user: {
        userId,
        name: sender.name,
        profileImage: sender.profileImage,
        type: sender.type
      }
    }
  });
}}

          
          
                    >
                      <img
                        src={sender.profileImage}
                        alt={sender.name}
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "50%"
                        }}
                      />
                      <div>
                        <strong>{sender.name}</strong>
                        <p style={{ fontSize: "12px", margin: 0 }}>
                          {sender.count} new message{sender.count > 1 && "s"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {/* ============== END MESSENGER ============== */}
          
           <Link className="icon-circle" to="/settings">
                 <FaCog />
               </Link>
          <img src={admin.profileImage || "/default-profile.png"} alt="admin" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex" }}>
        {/* LEFT SIDEBAR */}
        <div className="google-sidebar">
          <div className="sidebar-profile">
            <div className="sidebar-img-circle">
              <img src={admin.profileImage || "/default-profile.png"} alt="profile" />
            </div>
            <h3>{admin.name}</h3>
            <p>{admin.username}</p>
          </div>
          <div className="sidebar-menu">
            <Link className="sidebar-btn" to="/dashboard"><FaHome /> Home</Link>
            <Link className="sidebar-btn" to="/my-posts"><FaFileAlt /> My Posts</Link>
            <Link className="sidebar-btn" to="/teachers"><FaChalkboardTeacher /> Teachers</Link>
            <Link className="sidebar-btn" to="/students"><FaChalkboardTeacher /> Students</Link>
            <Link className="sidebar-btn" to="/schedule"><FaCalendarAlt /> Schedule</Link>
            <Link className="sidebar-btn" to="/parents" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaChalkboardTeacher /> Parents</Link>
        
            <button className="sidebar-btn logout-btn" onClick={() => { localStorage.removeItem("admin"); window.location.href = "/login"; }}>
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="main-content" style={{ padding: "30px", width: "65%", marginLeft: "200px" }}>
          <h2 style={{ marginBottom: "20px", textAlign: "center" }}>Parents</h2>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
            {parents.length === 0 ? (
              <p>No parents found.</p>
            ) : (
              parents.map(p => (
                <div key={p.userId} onClick={() => setSelectedParent(p)} style={{
                  width: "700px",
                  height: "100px",
                  borderRadius: "12px",
                  padding: "15px",
                  background: selectedParent?.userId === p.userId ? "#e0e7ff" : "#fff",
                  border: selectedParent?.userId === p.userId ? "2px solid #4b6cb7" : "1px solid #ddd",
                  display: "flex",
                  alignItems: "center",
                  gap: "20px",
                  boxShadow: selectedParent?.userId === p.userId ? "0 6px 15px rgba(75,108,183,0.3)" : "0 4px 10px rgba(0,0,0,0.1)",
                  cursor: "pointer",
                  transition: "all 0.3s ease"
                }}>
                  <img src={p.profileImage} alt={p.name} style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover" }} />
                  <div>
                    <h3 style={{ margin: 0 }}>{p.name}</h3>
                    <p style={{ margin: "4px 0", color: "#555" }}>{p.email}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        {selectedParent && (
          <div className="parent-info-sidebar" style={{ width: "30%", padding: "25px", background: "#fff", boxShadow: "0 0 15px rgba(0,0,0,0.05)", position: "fixed", right: 0, top: "60px", height: "calc(100vh - 60px)", overflowY: "auto", zIndex: 10 }}>
            <div style={{ textAlign: "center" }}>
              {/* Parent Profile */}
              <div style={{ background: "#becff7ff", padding: "25px 10px", height: "200px", margin: "-25px -25px 20px", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }}>
                <div style={{ width: "100px", height: "100px", margin: "-20px auto 15px", borderRadius: "50%", overflow: "hidden", border: "4px solid #4b6cb7" }}>
                  <img src={selectedParent.profileImage} alt={selectedParent.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <h2 style={{ margin: 0, fontSize: "22px", marginTop: "-10px", color: "#333" }}>{selectedParent.name}</h2>
                <h2 style={{ margin: 0, fontSize: "16px", marginTop: "0", color: "#585656ff" }}>{selectedParent.email}</h2>
              </div>

              {/* Tabs */}
              <div style={{ background: "#fff", borderRadius: "10px", padding: "15px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", width: "100%", textAlign: "left" }}>
                <div style={{ display: "flex", borderBottom: "1px solid #eee", marginBottom: "15px" }}>
                  {["details", "children", "status"].map(tab => (
                    <button key={tab} onClick={() => setParentTab(tab)} style={{ flex: 1, padding: "10px", border: "none", background: "none", cursor: "pointer", fontWeight: "600", color: parentTab === tab ? "#4b6cb7" : "#777", borderBottom: parentTab === tab ? "3px solid #4b6cb7" : "3px solid transparent" }}>
                      {tab.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* DETAILS TAB */}
      {parentTab === "details" && parentInfo && (
  <div
    style={{
    
      padding: 20,
      width: "480px",
      background: "linear-gradient(180deg,#eef2ff,#f8fafc)",
      borderRadius: 24,
      boxShadow: "0 10px 16px rgba(0,0,0,0.15)",
      fontFamily: "Inter, system-ui",
    }}
  >
    {/* HEADER */}
    <div style={{ marginBottom: 26 }}>
      <h3
        style={{
        
          margin: 0,
          fontSize: 22,
          fontWeight: 900,
          color: "#1e40af",
          letterSpacing: ".2px",
        }}
      >
        👤 Parent Profile
      </h3>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 13,
          color: "#64748b",
        }}
      >
        Account & personal information overview
      </p>
    </div>

    {/* INFO GRID */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 18,
      }}
    >
      {[
        { label: "User ID", value: parentInfo.userId, icon: "🆔" },
        { label: "Email", value: parentInfo.email, icon: "📧" },
        { label: "Phone", value: parentInfo.phone, icon: "📞" },
        { label: "Status", value: parentInfo.status, icon: "✅" },
        { label: "Additional Info", value: parentInfo.additionalInfo, icon: "📝" },
        { label: "Created At", value: parentInfo.createdAt, icon: "📅" },
      ].map((item, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px",
            background:
              "linear-gradient(180deg,rgba(255,255,255,.97),rgba(255,255,255,.92))",
            borderRadius: 18,
            boxShadow: "0 10px 25px rgba(0,0,0,.1)",
            transition: "all .25s ease",
            overflow: "hidden",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow =
              "0 20px 40px rgba(0,0,0,.18)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow =
              "0 10px 25px rgba(0,0,0,.1)";
          }}
        >
          {/* LEFT */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "14px",
                background:
                  "linear-gradient(135deg,#6366f1,#2563eb)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                boxShadow: "0 10px 20px rgba(99,102,241,.45)",
              }}
            >
              {item.icon}
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".6px",
                  color: "#64748b",
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1f2937",
                  wordBreak: "break-word",
                }}
              >
                {item.value || "-"}
              </div>
            </div>
          </div>

          {/* STATUS PILL */}
          {item.label === "Status" && (
            <span
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                background:
                  parentInfo.status === "active"
                    ? "#dcfce7"
                    : "#fee2e2",
                color:
                  parentInfo.status === "active"
                    ? "#166534"
                    : "#991b1b",
              }}
            >
              {parentInfo.status?.toUpperCase()}
            </span>
          )}
        </div>
      ))}
    </div>
  </div>
)}


                {/* CHILDREN TAB */}
       {/* CHILDREN TAB */}
{parentTab === "children" && (
  <div style={{ padding: "30px" }}>
    <h4 style={{ 
      marginBottom: "30px", 
      color: "#4b6cb7", 
      fontSize: "26px", 
      fontWeight: "700", 
      borderBottom: "3px solid #4b6cb7", 
      paddingBottom: "10px" 
    }}>
      Children
    </h4>

    {children.length === 0 ? (
      <p style={{ color: "#777", fontStyle: "italic", textAlign: "center", fontSize: "16px" }}>
        No children found
      </p>
    ) : (
      <div 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
          gap: "25px" 
        }}
      >
        {children.map(child => {
          const isExpanded = expandedChildren[child.studentId] || false;

          return (
            <div
  key={child.studentId}
  style={{
    background: "#ffffff",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
    transition: "0.3s",
    borderLeft: "6px solid #4b6cb7"
  }}
>
  {/* HEADER – IMAGE + NAME (HORIZONTAL) */}
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "16px",
      marginBottom: "16px"
    }}
  >
    <img
      src={child.profileImage || "/default-profile.png"}
      alt={child.name}
      style={{
        width: "64px",
        height: "64px",
        borderRadius: "50%",
        objectFit: "cover",
        border: "2px solid #4b6cb7"
      }}
    />

    <div style={{ flex: 1 }}>
      <h3
        style={{
          margin: 0,
          fontSize: "18px",
          fontWeight: "600",
          color: "#1f2937"
        }}
      >
        {child.name}
      </h3>

      <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
        <span
          style={{
            background: "#eef2ff",
            color: "#4b6cb7",
            padding: "4px 10px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: "600"
          }}
        >
          Grade {child.grade}
        </span>

        <span
          style={{
            background: "#f1f5f9",
            color: "#334155",
            padding: "4px 10px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: "600"
          }}
        >
          Section {child.section}
        </span>
      </div>
    </div>

    {/* TOGGLE BUTTON */}
    <button
      onClick={() =>
        setExpandedChildren(prev => ({
          ...prev,
          [child.studentId]: !expandedChildren[child.studentId]
        }))
      }
      style={{
        padding: "8px 14px",
        borderRadius: "10px",
        border: "none",
        background: expandedChildren[child.studentId] ? "#1e293b" : "#4b6cb7",
        color: "#fff",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: "600"
      }}
    >
      {expandedChildren[child.studentId] ? "Hide" : "Details"}
    </button>
  </div>

  {/* EXPANDED DETAILS */}
  {expandedChildren[child.studentId] && (
    <>
      <div
        style={{
          borderTop: "1px solid #e5e7eb",
          paddingTop: "12px",
          fontSize: "14px",
          color: "#475569",
          lineHeight: "1.7"
        }}
      >
        <p>
          <strong>Email:</strong>{" "}
          <a href={`mailto:${child.email}`} style={{ color: "#4b6cb7" }}>
            {child.email}
          </a>
        </p>
        <p>
          <strong>Parent Phone:</strong>{" "}
          <a href={`tel:${child.parentPhone}`} style={{ color: "#16a34a" }}>
            {child.parentPhone}
          </a>
        </p>
        <p>
          <strong>Relationship:</strong> {child.relationship}
        </p>
      </div>

      {/* ACTIONS */}
      <div style={{ display: "flex", gap: "12px", marginTop: "14px" }}>
        <a
          href={`mailto:${child.email}`}
          style={{
            flex: 1,
            textAlign: "center",
            padding: "8px",
            background: "#4b6cb7",
            color: "#fff",
            borderRadius: "10px",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: "600"
          }}
        >
          Email
        </a>
        <a
          href={`tel:${child.parentPhone}`}
          style={{
            flex: 1,
            textAlign: "center",
            padding: "8px",
            background: "#16a34a",
            color: "#fff",
            borderRadius: "10px",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: "600"
          }}
        >
          Call
        </a>
      </div>
    </>
  )}
</div>

          );
        })}
      </div>
    )}
  </div>
)}




                {/* STATUS TAB */}
                {parentTab === "status" && (
                  <div>
                    <p style={{ color: "#555" }}>Parent account status and activity info will be displayed here.</p>
                  </div>
                )}
              </div>

              {/* Chat Button */}
              {!parentChatOpen && (
                <div onClick={() => setParentChatOpen(true)} style={{ position: "fixed", bottom: "20px", right: "20px", width: "48px", height: "48px", background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer", zIndex: 1000, boxShadow: "0 8px 18px rgba(0,0,0,0.25)", transition: "transform 0.2s ease" }}>
                  <FaCommentDots size={22} />
                </div>
              )}

                            {/* Chat Popup */}
             {/* Chat Popup */}
{parentChatOpen && selectedParent && (
  <div style={{
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "340px",
    height: "420px",
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
    zIndex: 2000,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  }}>
  {/* HEADER */}
  <div style={{
    padding: "12px 14px",
    borderBottom: "1px solid #eee",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#fafafa",
  }}>
    <strong>{selectedParent.name}</strong>

    <div style={{ display: "flex", gap: "10px" }}>
      {/* Expand button */}
      <button
        onClick={() => {
          setParentChatOpen(false); 
          navigate("/all-chat", { state: { user: selectedParent } });
        }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "18px",
        }}
      >
        ⤢
      </button>

      {/* Close button */}
      <button
        onClick={() => setParentChatOpen(false)}
        style={{
          background: "none",
          border: "none",
          fontSize: "20px",
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  </div>

  {/* Messages */}
  <div style={{ flex: 1, padding: "10px", overflowY: "auto" }}>
    {messages.length === 0 ? (
      <p style={{ textAlign: "center", color: "#aaa" }}>
        Start chatting with {selectedParent.name}
      </p>
    ) : (
      messages.map(m => (
        <div key={m.messageId} style={{ textAlign: m.senderId === admin.userId ? "right" : "left", marginBottom: "8px" }}>
          <span style={{
            display: "inline-block",
            padding: "8px 12px",
            borderRadius: "18px",
            background: m.senderId === admin.userId ? "#4b6cb7" : "#f1f1f1",
            color: m.senderId === admin.userId ? "#fff" : "#000",
          }}>
            {m.text}
          </span>
        </div>
      ))
    )}
  </div>

  {/* Input */}
  <div style={{ padding: "10px", borderTop: "1px solid #eee", display: "flex", gap: "8px" }}>
    <input
      value={newMessageText}
      onChange={(e) => setNewMessageText(e.target.value)}
      placeholder="Message..."
      style={{
        flex: 1,
        padding: "10px",
        borderRadius: "999px",
        border: "1px solid #ccc",
      }}
      onKeyDown={(e) => { if(e.key === "Enter") sendMessage(newMessageText); }}
    />
    <button
      onClick={() => sendMessage(newMessageText)}
      style={{
        background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
        border: "none",
        borderRadius: "50%",
        width: "40px",
        height: "40px",
        color: "#fff",
        cursor: "pointer",
      }}
    >
      ➤
    </button>
  </div>
</div>
)}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Parent;