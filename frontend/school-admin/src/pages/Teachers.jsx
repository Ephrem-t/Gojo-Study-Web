import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaFacebookMessenger,
  FaSearch , FaCalendarAlt, FaCommentDots

} from "react-icons/fa";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";




function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [popupMessages, setPopupMessages] = useState([]);
  const [popupInput, setPopupInput] = useState("");
  const [teacherSchedule, setTeacherSchedule] = useState({}); // store schedule

  const [showMessageDropdown, setShowMessageDropdown] = useState(false);

  const [unreadTeachers, setUnreadTeachers] = useState({});
  const [unreadSenders, setUnreadSenders] = useState([]); 
  const [postNotifications, setPostNotifications] = useState([]);
const [showPostDropdown, setShowPostDropdown] = useState(false);

  const navigate = useNavigate();
 const admin = JSON.parse(localStorage.getItem("admin")) || {};
const adminUserId = admin.userId;   // ✅ now it exists
const adminId = admin.userId; 
const weekOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];


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


  // ---------------- FETCH TEACHERS ----------------
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const [teachersRes, assignmentsRes, coursesRes, usersRes] = await Promise.all([
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Courses.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json")
        ]);

        const teachersData = teachersRes.data || {};
        const assignmentsData = assignmentsRes.data || {};
        const coursesData = coursesRes.data || {};
        const usersData = usersRes.data || {};

        const teacherList = Object.keys(teachersData).map(teacherId => {
          const teacher = teachersData[teacherId];
          const user = usersData[teacher.userId] || {};

          const gradesSubjects = Object.values(assignmentsData)
            .filter(a => a.teacherId === teacherId)
            .map(a => {
              const course = coursesData[a.courseId];
              return course ? { grade: course.grade, subject: course.subject, section: course.section } : null;
            })
            .filter(Boolean);

          return {
            teacherId,
            name: user.name || "No Name",
            profileImage: user.profileImage || "/default-profile.png",
            gradesSubjects,
            email: user.email || null,
            userId: teacher.userId
          };
        });

        setTeachers(teacherList);
      } catch (err) {
        console.error("Error fetching teachers:", err);
      }
    };

    fetchTeachers();
  }, []);

  // ---------------- FILTER TEACHERS ----------------
  const filteredTeachers =
    selectedGrade === "All"
      ? teachers
      : teachers.filter(t => t.gradesSubjects.some(gs => gs.grade === selectedGrade));


const handleClick = () => {
    navigate("/all-chat"); // replace with your target route
  };


// ---------------- FETCH TEACHER SCHEDULE ----------------
// ---------------- FETCH TEACHER SCHEDULE (FIXED & WORKING) ----------------
useEffect(() => {
  if (!selectedTeacher || activeTab !== "schedule") return;

  const fetchSchedule = async () => {
    try {
      const res = await axios.get(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/Schedules.json"
      );


      const allSchedules = res.data || {};
      const result = {};

      Object.entries(allSchedules).forEach(([day, dayData]) => {
        Object.entries(dayData || {}).forEach(([classKey, periods]) => {
          Object.entries(periods || {}).forEach(([periodKey, entry]) => {
            if (
              entry &&
              entry.teacherId === selectedTeacher.teacherId && // ✅ FIX
              !entry.break
            ) {
              if (!result[day]) result[day] = {};
              if (!result[day][periodKey]) result[day][periodKey] = [];

              result[day][periodKey].push({
                subject: entry.subject,
                class: classKey
              });
            }
          });
        });
      });

      console.log("✅ FINAL TEACHER SCHEDULE:", result);
      setTeacherSchedule(result);
    } catch (err) {
      console.error("❌ Schedule fetch failed:", err);
      setTeacherSchedule({});
    }
  };

  fetchSchedule();
}, [selectedTeacher, activeTab]);


useEffect(() => {
    // Replace with your actual API call
    const fetchUnreadSenders = async () => {
      const response = await fetch("/api/unreadSenders");
      const data = await response.json();
      setUnreadSenders(data);
    };
    fetchUnreadSenders();
  }, []);


// helper: canonical chat key (sorted so it's consistent)
const getChatKey = (userA, userB) => {
  // ensure stable ordering: "lower_higher"
  return [userA, userB].sort().join("_");
};

// FETCH CHAT MESSAGES for popup (replace your existing effect)
useEffect(() => {
  if (!teacherChatOpen || !selectedTeacher) return;

  const fetchMessages = async () => {
    try {
      const chatKey = getChatKey(selectedTeacher.userId, adminUserId);

      // read messages node
      const res = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${encodeURIComponent(chatKey)}/messages.json`
      );

      const data = res.data || {};
      // transform object -> array with messageId and sender role
      const msgs = Object.entries(data || {})
        .map(([id, msg]) => ({
          messageId: id,
          ...msg,
          sender: msg.senderId === adminUserId ? "admin" : "teacher",
        }))
        .sort((a, b) => (a.timeStamp || 0) - (b.timeStamp || 0));

      setPopupMessages(msgs);
    } catch (err) {
      console.error("Failed to fetch chat messages:", err);
      setPopupMessages([]);
    }
  };

  fetchMessages();

  // optional: poll for new messages while popup is open
  const interval = setInterval(fetchMessages, 3000);
  return () => clearInterval(interval);
}, [teacherChatOpen, selectedTeacher, adminUserId]);

//----------------------Fetch unread messages for teachers--------------------

      useEffect(() => {
  if (!adminUserId || teachers.length === 0) return;

  const fetchUnreadTeachers = async () => {
    const unread = {};

    for (const t of teachers) {
      const chatKey = `${adminUserId}_${t.userId}`;
      try {
        const res = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`
        );

        const msgs = Object.values(res.data || {});
        const count = msgs.filter(
          m => m.receiverId === adminUserId && m.seen === false
        ).length;

        if (count > 0) unread[t.userId] = count;
      } catch (err) {
        console.error(err);
      }
    }

    setUnreadTeachers(unread);
  };

  fetchUnreadTeachers();
}, [teachers, adminUserId]);


  // ---------------- FETCH CHAT MESSAGES ----------------
useEffect(() => {
  if (!teacherChatOpen || !selectedTeacher) return;

  const fetchMessages = async () => {
    try {
      const chatKey = getChatKey(selectedTeacher.userId, adminUserId);

      const res = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`
      );

      const msgs = Object.entries(res.data || {}).map(([id, msg]) => ({
        messageId: id,
        ...msg,
        sender: msg.senderId === adminUserId ? "admin" : "teacher"
      })).sort((a, b) => a.timeStamp - b.timeStamp);

      setPopupMessages(msgs);
    } catch (err) {
      console.error(err);
      setPopupMessages([]);
    }
  };

  fetchMessages();
}, [teacherChatOpen, selectedTeacher, adminUserId]);

// ---------------- SEND POPUP MESSAGE ----------------
const sendPopupMessage = async () => {
  if (!popupInput.trim() || !selectedTeacher) return;

  const chatKey = getChatKey(selectedTeacher.userId, adminUserId);
  const timestamp = Date.now();

  const newMessage = {
    senderId: adminUserId,
    receiverId: selectedTeacher.userId,
    type: "text",
    text: popupInput,
    imageUrl: null,
    replyTo: null,
    seen: false,
    edited: false,
    deleted: false,
    timeStamp: timestamp
  };

  try {
    // 1) Push message to messages node (POST -> returns a name/key)
    const pushRes = await axios.post(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${encodeURIComponent(chatKey)}/messages.json`,
      newMessage
    );
    const generatedId = pushRes.data && pushRes.data.name;

    // 2) Update lastMessage (so UI can show previews)
    const lastMessage = {
      text: newMessage.text,
      senderId: newMessage.senderId,
      seen: false,
      timeStamp: newMessage.timeStamp
    };

    await axios.patch(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${encodeURIComponent(chatKey)}.json`,
      {
        lastMessage,
        // ensure participants entry exists
        participants: {
          ...(/* keep existing participants if any */ {}),
          [adminUserId]: true,
          [selectedTeacher.userId]: true
        }
      }
    );

    // 3) Increment unread count for receiver (non-atomic: read -> increment -> write)
    try {
      const unreadRes = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${encodeURIComponent(chatKey)}/unread.json`
      );
      const unread = unreadRes.data || {};
      const prev = Number(unread[selectedTeacher.userId] || 0);
      const updated = { ...(unread || {}), [selectedTeacher.userId]: prev + 1 };
      await axios.put(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${encodeURIComponent(chatKey)}/unread.json`,
        updated
      );
    } catch (uErr) {
      // if unread node missing or failed, set it
      await axios.put(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${encodeURIComponent(chatKey)}/unread.json`,
        { [selectedTeacher.userId]: 1, [adminUserId]: 0 }
      );
    }

    // 4) Optimistically update UI
    setPopupMessages(prev => [
      ...prev,
      { messageId: generatedId || `${timestamp}`, ...newMessage, sender: "admin" }
    ]);
    setPopupInput("");
  } catch (err) {
    console.error("Failed to send message:", err);
  }
};

const markMessagesAsSeen = async (userId) => {
  const chatKey = getChatKey(userId, adminUserId);

  try {
    // read messages
    const res = await axios.get(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${encodeURIComponent(chatKey)}/messages.json`
    );
    const data = res.data || {};

    // build updates to set seen=true for messages where receiverId === adminUserId and seen is false
    const updates = {};
    Object.entries(data).forEach(([msgId, msg]) => {
      if (msg.receiverId === adminUserId && !msg.seen) {
        updates[`messages/${msgId}/seen`] = true;
      }
    });

    // apply updates (PATCH at chat root)
    if (Object.keys(updates).length > 0) {
      await axios.patch(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${encodeURIComponent(chatKey)}.json`,
        updates
      );
    }

    // reset unread counter for adminUserId
    try {
      const unreadRes = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${encodeURIComponent(chatKey)}/unread.json`
      );
      const unread = unreadRes.data || {};
      // set admin unread to 0
      const updated = { ...(unread || {}), [adminUserId]: 0 };
      await axios.put(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${encodeURIComponent(chatKey)}/unread.json`,
        updated
      );
    } catch (uErr) {
      // ignore
    }
  } catch (err) {
    console.error("markMessagesAsSeen error:", err);
  }
};

const getUnreadCount = async (userId) => {
  const chatKey = getChatKey(userId, adminUserId);

  try {
    const res = await axios.get(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`
    );

    const msgs = Object.values(res.data || {});
    return msgs.filter(m => m.receiverId === adminUserId && !m.seen).length;
  } catch (err) {
    console.error(err);
    return 0;
  }
};


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


// ---------------- MARK MESSAGES AS SEEN ----------------


useEffect(() => {
  if (!teacherChatOpen || !selectedTeacher) return;

  const markMessagesAsSeen = async () => {
    const chatKey = `${adminUserId}_${selectedTeacher.userId}`;
    try {
      const res = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`
      );
      const msgs = Object.entries(res.data || {});
      const updates = {};
      msgs.forEach(([key, msg]) => {
        if (msg.receiverId === adminUserId && !msg.seen) updates[key + "/seen"] = true;
      });

      if (Object.keys(updates).length > 0) {
        await axios.patch(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}/messages.json`,
          updates
        );
        // remove badge
        setUnreadTeachers(prev => ({ ...prev, [selectedTeacher.userId]: 0 }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  markMessagesAsSeen();
}, [teacherChatOpen, selectedTeacher, adminUserId]);











  return (
    <div className="dashboard-page">
      {/* ---------------- TOP NAVBAR ---------------- */}
      <nav className="top-navbar">
  <h2>Gojo Dashboard</h2>
  <div className="nav-search">
    <FaSearch className="search-icon" />
    <input type="text" placeholder="Search Teacher and Student..." />
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
        {/* ---------------- SIDEBAR ---------------- */}
        <div className="google-sidebar">
          <div className="sidebar-profile">
            <div className="sidebar-img-circle">
              <img src={admin.profileImage || "/default-profile.png"} alt="profile" />
            </div>
            <h3>{admin.name}</h3>
            <p>{admin.username}</p>
          </div>
          <div className="sidebar-menu">
                              <Link className="sidebar-btn" to="/dashboard"
                               
                               > <FaHome style={{ width: "28px", height:"28px" }}/> Home</Link>
                                <Link className="sidebar-btn" to="/my-posts"><FaFileAlt /> My Posts</Link>
                                <Link className="sidebar-btn" to="/teachers" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaChalkboardTeacher /> Teachers</Link>
                                  <Link className="sidebar-btn" to="/students" > <FaChalkboardTeacher /> Students</Link>
                                   <Link
                                                className="sidebar-btn"
                                                to="/schedule"
                                                
                                              >
                                                <FaCalendarAlt /> Schedule
                                              </Link>
                                   <Link className="sidebar-btn" to="/parents" ><FaChalkboardTeacher /> Parents
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

        {/* ---------------- MAIN CONTENT ---------------- */}
        <div className="main-content" style={{ padding: "30px", width: "65%", marginLeft: "200px" }}>
          <h2 style={{ marginBottom: "10px", textAlign: "center" }}>Teachers</h2>

          {/* Grade Filter */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px" }}>
            <div style={{ display: "flex", gap: "12px" }}>
              {["All", "9", "10", "11", "12"].map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGrade(g)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    background: selectedGrade === g ? "#4b6cb7" : "#ddd",
                    color: selectedGrade === g ? "#fff" : "#000",
                    cursor: "pointer",
                    border: "none"
                  }}
                >
                  {g === "All" ? "All Teachers" : `Grade ${g}`}
                </button>
              ))}
            </div>
          </div>

          {/* Teachers List */}
          {filteredTeachers.length === 0 ? (
            <p style={{ textAlign: "center", color: "#555" }}>No teachers found for this grade.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
              {filteredTeachers.map(t => (
                <div
                  key={t.teacherId}
                  onClick={() => setSelectedTeacher(t)}
                  style={{
                    width: "700px",
                    height: "100px",
                    border: "1px solid #ddd",
                    borderRadius: "12px",
                    padding: "15px",
                    background: selectedTeacher?.teacherId === t.teacherId ? "#e0e7ff" : "#fff",
                    border: selectedTeacher?.teacherId === t.teacherId ? "2px solid #4b6cb7" : "1px solid #ddd",
                    boxShadow: selectedTeacher?.teacherId === t.teacherId ? "0 6px 15px rgba(75,108,183,0.3)" : "0 4px 10px rgba(0,0,0,0.1)",
                    cursor: "pointer",
                    transition: "all 0.3s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                    <img
                      src={t.profileImage}
                      alt={t.name}
                      style={{
                        width: "65px",
                        height: "65px",
                        borderRadius: "50%",
                        border: selectedTeacher?.teacherId === t.teacherId ? "3px solid #4b6cb7" : "3px solid red",
                        objectFit: "cover",
                        transition: "all 0.3s ease"
                      }}
                    />
                    <h3 style={{marginTop: "-35px" }}>{t.name}</h3>


                      {/* ---------- UNREAD BADGE ---------- */}
  {unreadTeachers[t.userId] > 0 && (
  <span style={{
    margin: "10px 10px 10px 200px",
    background: "red",
    color: "#fff",
    borderRadius: "50%",
    padding: "4px 8px",
    fontSize: "12px"
  }}>
    {unreadTeachers[t.userId]}
  </span>
)}
    
</div>
                  <div style={{ marginLeft: "70px", marginTop: "-25px", color: "#555" }}>
                    {t.gradesSubjects.length > 0 ? t.gradesSubjects.map(gs => gs.subject).join(", ") : "No assigned courses"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---------------- RIGHT SIDEBAR ---------------- */}
        {selectedTeacher && (
  <div
    className="teacher-info-sidebar"
    style={{
      width: "30%",
      position: "fixed",
      right: 0,
      top: "70px",
      height: "calc(100vh - 70px)",
      background: "#ffffff",
      boxShadow: "0 0 18px rgba(0,0,0,0.08)",
      borderLeft: "1px solid #e5e7eb",
      zIndex: 20,
      display: "flex",
      flexDirection: "column"
    }}
  >
    {/* ================= SCROLLABLE CONTENT ================= */}
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "25px"
      }}
    >
      {/* ================= HEADER ================= */}
      <div
        style={{
          background: "#e0e7ff",
          margin: "-25px -25px 20px",
          padding: "30px 20px",
          textAlign: "center"
        }}
      >
        <div
          style={{
            width: "110px",
            height: "110px",
            margin: "0 auto 15px",
            borderRadius: "50%",
            overflow: "hidden",
            border: "4px solid #4b6cb7"
          }}
        >
          <img
            src={selectedTeacher.profileImage}
            alt={selectedTeacher.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        <h2 style={{ margin: 0, color: "#111827" }}>
          {selectedTeacher.name}
        </h2>

        <p style={{ margin: "4px 0", color: "#6b7280", fontSize: "14px" }}>
          {selectedTeacher.email || "teacher@example.com"}
        </p>
      </div>

      {/* ================= TABS ================= */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #e5e7eb",
          marginBottom: "15px"
        }}
      >
        {["details", "schedule", "plan"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "12px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              color: activeTab === tab ? "#4b6cb7" : "#6b7280",
              borderBottom:
                activeTab === tab
                  ? "3px solid #4b6cb7"
                  : "3px solid transparent"
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>



     
{/* ================= DETAILS TAB ================= */}


{activeTab === "details" && selectedTeacher && (
  <div style={{
    background: "linear-gradient(145deg, #f0f4ff, #ffffff)",
    padding: "30px",
    borderRadius: "24px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
    maxWidth: "900px",
    margin: "20px auto",
    fontFamily: "Poppins, sans-serif",
    transition: "0.4s",
  }}>

    {/* Header */}
    <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 30 }}>
    
      <div>
        <h2 style={{ margin: 0, color: "#1e40af", fontSize: 28 }}>{selectedTeacher.name}</h2>
        <p style={{ margin: 4, color: "#6b7280", fontSize: 14 }}>Teacher ID: <span style={{ fontWeight: 600 }}>{selectedTeacher.teacherId}</span></p>
      </div>
    </div>

    {/* Summary Cards */}
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 25 }}>
      <div style={{
        flex: "1 1 150px",
        background: "#e0f2fe",
        padding: "16px",
        borderRadius: "16px",
        textAlign: "center",
        boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
        cursor: "default",
      }}>
        <h3 style={{ margin: 0, color: "#1e3a8a" }}>{selectedTeacher.gradesSubjects?.length || 0}</h3>
        <p style={{ margin: 0, color: "#2563eb" }}>Courses Assigned</p>
      </div>

      <div style={{
        flex: "1 1 150px",
        background: "#fde68a",
        padding: "16px",
        borderRadius: "16px",
        textAlign: "center",
        boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
        cursor: "default",
      }}>
        <h3 style={{ margin: 0, color: "#b45309" }}>
          {selectedTeacher.gradesSubjects?.reduce((acc, gs) => acc + 1, 0)}
        </h3>
        <p style={{ margin: 0, color: "#f59e0b" }}>Subjects</p>
      </div>

      {/* Busy Periods Icon */}
      <div style={{
        flex: "1 1 150px",
        background: "#fef3c7",
        padding: "16px",
        borderRadius: "16px",
        textAlign: "center",
        boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
        position: "relative",
      }}>
        <div style={{
          width: 40,
          height: 40,
          margin: "0 auto 8px",
          borderRadius: "50%",
          background: "#fbbf24",
          animation: "pulse 1.5s infinite",
        }}></div>
        <p style={{ margin: 0, fontWeight: 600, color: "#b45309" }}>Busy Periods</p>
        <p style={{ margin: 0, color: "#92400e", fontSize: 14 }}>
          {selectedTeacher.gradesSubjects?.reduce((acc, gs) => acc + (gs.periods || 1), 0)} / 8
        </p>
      </div>
    </div>

    {/* Courses List */}
    <div>
      <h4 style={{ color: "#4b6cb7", marginBottom: 16 }}>Assigned Courses</h4>
      {selectedTeacher.gradesSubjects?.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 12 }}>
          {selectedTeacher.gradesSubjects.map((gs, i) => {
            const colors = [
              ["#e0f2fe", "#bae6fd"],
              ["#d1fae5", "#a7f3d0"],
              ["#fef3c7", "#fde68a"],
              ["#fee2e2", "#fecaca"],
              ["#ede9fe", "#ddd6fe"]
            ];
            const color = colors[i % colors.length];
            const totalPeriods = gs.periods || Math.floor(Math.random() * 5) + 1;
            const availability = gs.availability || Math.floor(Math.random() * 100);

            return (
              <div key={i} style={{
                background: `linear-gradient(135deg, ${color[0]}, ${color[1]})`,
                padding: "14px",
                borderRadius: "16px",
                boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden"
              }}>
                <p style={{ margin: 0, fontWeight: 600, color: "#1e3a8a" }}>{gs.subject}</p>
                <small style={{ color: "#374151" }}>Grade {gs.grade} • Section {gs.section}</small>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No assigned courses yet</p>
      )}
    </div>

    {/* Pie Chart: Busy vs Free Periods */}
    <div style={{ marginTop: 40, background: "#fefefe", padding: 20, borderRadius: 16, boxShadow: "0 10px 25px rgba(0,0,0,0.08)" }}>
      <h4 style={{ color: "#4b6cb7", marginBottom: 12 }}>Workload Overview</h4>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={[
              { name: "Busy", value: selectedTeacher.gradesSubjects?.reduce((acc, gs) => acc + (gs.periods || 1), 0) || 0 },
              { name: "Free", value: 8 - (selectedTeacher.gradesSubjects?.reduce((acc, gs) => acc + (gs.periods || 1), 0) || 0) }
            ]}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={70}
            innerRadius={40}
            paddingAngle={4}
          >
            <Cell key="busy" fill="#4b6cb7" />
            <Cell key="free" fill="#dbeafe" />
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <p style={{ textAlign: "center", marginTop: 8, fontWeight: 600, color: "#1e3a8a" }}>Busy vs Free Periods</p>
    </div>

    <style>{`
      @keyframes pulse {
        0% { transform: scale(0.9); opacity: 0.7; }
        50% { transform: scale(1.1); opacity: 1; }
        100% { transform: scale(0.9); opacity: 0.7; }
      }
    `}</style>
  </div>
)}


      
{/* ================= SCHEDULE TAB ================= */}
{/* ================= SCHEDULE TAB ================= */}
{activeTab === "schedule" && (
  <div style={{ padding: "20px" }}>
    {/* Title */}
    <h4
      style={{
        fontSize: "22px",
        fontWeight: "700",
        textAlign: "center",
        marginBottom: "25px",
        color: "#1e3a8a",
        letterSpacing: "0.5px"
      }}
    >
      Weekly Teaching Schedule
    </h4>

    {/* Empty State */}
    {Object.keys(teacherSchedule).length === 0 ? (
      <div
        style={{
          textAlign: "center",
          padding: "40px",
          borderRadius: "16px",
          background: "#f3f4f6",
          color: "#6b7280",
          fontSize: "15px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
        }}
      >
        📭 No schedule assigned yet
      </div>
    ) : (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)", // TWO COLUMNS
          gap: "24px"
        }}
      >
        {weekOrder
          .filter(day => teacherSchedule[day])
          .map(day => {
            const periods = teacherSchedule[day];

            return (
              <div
                key={day}
                style={{
                  borderRadius: "16px",
                  padding: "18px",
                  background: "#ffffff",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
                  border: "1px solid #e5e7eb",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow =
                    "0 12px 30px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 20px rgba(0,0,0,0.08)";
                }}
              >
                {/* Day Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px"
                  }}
                >
                  <h5
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      color: "#1e3a8a"
                    }}
                  >
                    📆 {day}
                  </h5>

                  <span
                    style={{
                      fontSize: "12px",
                      padding: "5px 12px",
                      borderRadius: "999px",
                      background: "#eef2ff",
                      color: "#1e40af",
                      fontWeight: "500"
                    }}
                  >
                    {Object.keys(periods).length} periods
                  </span>
                </div>

                {/* Periods */}
                {Object.entries(periods).map(([period, entries]) => (
                  <div
                    key={period}
                    style={{
                      marginBottom: "14px",
                      borderRadius: "12px",
                      padding: "12px",
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      transition: "transform 0.2s ease",
                      cursor: "pointer"
                    }}
                    onMouseEnter={e =>
                      (e.currentTarget.style.transform = "translateY(-2px)")
                    }
                    onMouseLeave={e =>
                      (e.currentTarget.style.transform = "translateY(0)")
                    }
                  >
                    {/* Period Header */}
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#374151",
                        marginBottom: "10px"
                      }}
                    >
                      ⏰ {period}
                    </div>

                    {/* Subjects */}
                    {entries.map((e, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 10px",
                          borderRadius: "10px",
                          background: "#ffffff",
                          marginBottom: "6px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                          fontSize: "13px"
                        }}
                      >
                        <span style={{ fontWeight: "500", color: "#111827" }}>
                          📘 {e.subject}
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "500",
                            padding: "3px 8px",
                            borderRadius: "999px",
                            background: "#e0e7ff",
                            color: "#3730a3"
                          }}
                        >
                          {e.class}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
      </div>
    )}
  </div>
)}




      {/* ================= PLAN TAB ================= */}
      {activeTab === "plan" && (
        <p style={{ color: "#6b7280" }}>
          Teacher lesson plans will be shown here.
        </p>
      )}

      {/* ================= MESSAGE BUTTON ================= */}
     

{/* ================= FIXED MESSAGE BUTTON ================= */}
<div
  onClick={() => setTeacherChatOpen(true)}
  style={{
    position: "fixed",        // 🔒 RIGID
    bottom: "20px",
    right: "20px",
    width: "48px",
    height: "48px",
    background:
      "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    cursor: "pointer",
    zIndex: 9999,
    boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.08)";
    e.currentTarget.style.boxShadow =
      "0 12px 26px rgba(0,0,0,0.35)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.boxShadow =
      "0 8px 18px rgba(0,0,0,0.25)";
  }}
>
  <FaCommentDots size={22} />
</div>


</div>
  

    </div>
 
)}

      </div>

      {/* ---------------- MINI POPUP CHAT ---------------- */}
      {teacherChatOpen && selectedTeacher && (
        <div style={{
          
          position: "fixed",
          bottom: "6px",
          right: "22px",
          width: "320px",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
          padding: "15px",
          zIndex: 999
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ddd", paddingBottom: "10px" }}>
            <strong>{selectedTeacher.name}</strong>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
  onClick={() => {
    setTeacherChatOpen(false); // close mini popup
    navigate("/all-chat", { state: { user: selectedTeacher } }); // pass teacher as selected user
  }}
  style={{
    background: "none",
    border: "none",
    fontSize: "18px",
    cursor: "pointer"
  }}
>
  ↗
</button>

              <button
                onClick={() => setTeacherChatOpen(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Chat Body */}
          <div style={{ height: "260px", overflowY: "auto", padding: "10px" }}>
            {popupMessages.length === 0 ? (
              <p style={{ color: "#aaa", textAlign: "center" }}>Start a conversation with {selectedTeacher.name}...</p>
            ) : (
              popupMessages.map((m, i) => (
                <div key={i} style={{ marginBottom: "8px", textAlign: m.sender === "admin" ? "right" : "left" }}>
                  <span style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    background: m.sender === "admin" ? "#4b6cb7" : "#eee",
                    color: m.sender === "admin" ? "#fff" : "#000",
                    display: "inline-block",
                    maxWidth: "80%"
                  }}>{m.text}</span>
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <input
              value={popupInput}
              onChange={e => setPopupInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendPopupMessage()}
              placeholder="Type a message..."
              style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
            />
            <button
        onClick={() => sendMessage(newMessageText)}
        style={{
          background: "none",
          border: "none",
          color: "#3654dada",
          cursor: "pointer",
          fontSize: "30px",
        }}
      >
        ➤
      </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeachersPage;
