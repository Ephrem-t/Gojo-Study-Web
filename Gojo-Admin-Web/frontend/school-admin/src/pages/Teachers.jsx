import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaFacebookMessenger,
  FaSearch,
  FaCalendarAlt,
  FaCommentDots,
  FaPaperPlane,
  FaCheck
} from "react-icons/fa";
import axios from "axios";
import { getDatabase, ref, onValue } from "firebase/database";
import app from "../firebase";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";




function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [popupMessages, setPopupMessages] = useState([]);
  const [popupInput, setPopupInput] = useState("");
  const messagesEndRef = useRef(null);

  const formatDateLabel = (ts) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleDateString(); } catch { return ""; }
  };
  const formatTime = (ts) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ""; }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [popupMessages, teacherChatOpen]);
  const [teacherSchedule, setTeacherSchedule] = useState({}); // store schedule

  const [showMessageDropdown, setShowMessageDropdown] = useState(false);

  const [unreadTeachers, setUnreadTeachers] = useState({});
  const [unreadSenders, setUnreadSenders] = useState({}); 
  const [postNotifications, setPostNotifications] = useState([]);
const [showPostDropdown, setShowPostDropdown] = useState(false);
const [selectedTeacherUser, setSelectedTeacherUser] = useState(null);
  const [isPortrait, setIsPortrait] = useState(typeof window !== "undefined" ? window.innerWidth < window.innerHeight : false);
  const [isNarrow, setIsNarrow] = useState(typeof window !== "undefined" ? window.innerWidth < 900 : false);
  const navigate = useNavigate();
 const admin = JSON.parse(localStorage.getItem("admin")) || {};
const adminUserId = admin.userId;   // ✅ now it exists
const adminId = admin.userId; 
const dbRT = getDatabase(app);
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
  if (!selectedTeacher?.userId) {
    setSelectedTeacherUser(null);
    return;
  }

  async function fetchUser() {
    try {
      const res = await axios.get(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${selectedTeacher.userId}.json`
      );
      setSelectedTeacherUser(res.data || {});
    } catch (err) {
      setSelectedTeacherUser(null);
    }
  }
  fetchUser();
}, [selectedTeacher]);

useEffect(() => {
  const onResize = () => {
    setIsPortrait(window.innerWidth < window.innerHeight);
    setIsNarrow(window.innerWidth < 900);
  };
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);

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



    // helper to read messages from BOTH chat keys (resilient)
    const getUnreadCount = async (userId) => {
      const key1 = `${admin.userId}_${userId}`;
      const key2 = `${userId}_${admin.userId}`;

      try {
        // use Promise.allSettled so one failing key doesn't abort both
        const results = await Promise.allSettled([
          axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key1}/messages.json`, { timeout: 10000 }),
          axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${key2}/messages.json`, { timeout: 10000 }),
        ]);

        const msgs = [];
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value && r.value.data) {
            msgs.push(...Object.values(r.value.data || {}));
          }
        }

        return msgs.filter(m => m && m.receiverId === admin.userId && !m.seen).length;
      } catch (err) {
        // don't throw; return 0 if there's any problem
        console.warn('getUnreadCount error for', userId, err?.message || err);
        return 0;
      }
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

  const chatKey = getChatKey(selectedTeacher.userId, adminUserId);
  const messagesRef = ref(dbRT, `Chats/${chatKey}/messages`);

  const handleSnapshot = async (snapshot) => {
    const data = snapshot.val() || {};
    const list = Object.entries(data)
      .map(([id, msg]) => ({ messageId: id, ...msg }))
      .sort((a, b) => a.timeStamp - b.timeStamp);
    setPopupMessages(list);

    const updates = {};
    Object.entries(data).forEach(([msgId, msg]) => {
      if (msg && msg.receiverId === adminUserId && !msg.seen) {
        updates[`Chats/${chatKey}/messages/${msgId}/seen`] = true;
      }
    });

    if (Object.keys(updates).length > 0) {
      try {
        await axios.patch(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/.json`, updates);
        setUnreadTeachers(prev => ({ ...prev, [selectedTeacher.userId]: 0 }));
        axios.patch(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatKey}.json`, { unread: { [adminUserId]: 0 }, lastMessage: { seen: true } }).catch(() => {});
      } catch (err) {
        console.error('Failed to patch seen updates:', err);
      }
    }
  };

  const unsubscribe = onValue(messagesRef, handleSnapshot);
  return () => unsubscribe();
}, [teacherChatOpen, selectedTeacher, adminUserId]);











  return (
    <div className="dashboard-page">
      {/* ---------------- TOP NAVBAR ---------------- */}
      <nav className="top-navbar">
  <h2>Gojo Dashboard</h2>

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

      {/* combined notifications count */}
      {(() => {
        const messageCount = Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0);
        const total = (postNotifications?.length || 0) + messageCount;
        return total > 0 ? (
          <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "red", color: "#fff", borderRadius: "50%", padding: "2px 6px", fontSize: "10px", fontWeight: "bold" }}>{total}</span>
        ) : null;
      })()}

      {showPostDropdown && (
        <div
          className="notification-dropdown"
          style={{ position: "absolute", top: "40px", right: "0", width: "360px", maxHeight: "420px", overflowY: "auto", background: "#fff", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", zIndex: 1000, padding: 6 }}
          onClick={(e) => e.stopPropagation()}
        >
          {((postNotifications?.length || 0) + Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)) === 0 ? (
            <p style={{ padding: "12px", textAlign: "center", color: "#777" }}>No new notifications</p>
          ) : (
            <div>
              {/* Posts */}
              {postNotifications.length > 0 && (
                <div>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontWeight: 700 }}>Posts</div>
                  {postNotifications.map(n => (
                    <div key={n.notificationId} style={{ padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderBottom: "1px solid #f0f0f0", transition: "background 120ms ease" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")} onMouseLeave={(e) => (e.currentTarget.style.background = "") } onClick={() => handleNotificationClick(n)}>
                      <img src={n.adminProfile || "/default-profile.png"} alt={n.adminName} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: "block", marginBottom: 4 }}>{n.adminName}</strong>
                        <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{n.message}</p>
                      </div>
                      <div style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>{new Date(n.time || n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Messages */}
              {Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count||0), 0) > 0 && (
                <div>
                  <div style={{ padding: '8px 10px', color: '#333', fontWeight: 700, background: '#fafafa', borderRadius: 6, margin: '8px 6px' }}>Messages</div>
                  {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                    <div key={userId} style={{ padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderBottom: "1px solid #f0f0f0", transition: "background 120ms ease" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")} onMouseLeave={(e) => (e.currentTarget.style.background = "") } onClick={async () => {
                      await markMessagesAsSeen(userId);
                      setUnreadSenders(prev => { const copy = { ...prev }; delete copy[userId]; return copy; });
                      setShowPostDropdown(false);
                      navigate('/all-chat', { state: { user: { userId, name: sender.name, profileImage: sender.profileImage, type: sender.type } } });
                    }}>
                      <img src={sender.profileImage || "/default-profile.png"} alt={sender.name} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: "block", marginBottom: 4 }}>{sender.name}</strong>
                        <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{sender.count} new message{sender.count > 1 && 's'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>


    {/* ================= MESSENGER ================= */}
    <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/all-chat") }>
      <FaFacebookMessenger />
      {Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0) > 0 && (
        <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "red", color: "#fff", borderRadius: "50%", padding: "2px 6px", fontSize: "10px", fontWeight: "bold" }}>{Object.values(unreadSenders || {}).reduce((a, s) => a + (s.count || 0), 0)}</span>
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
             <p>{admin?.adminId || "username"}</p>
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
                                    <Link className="sidebar-btn" to="/registration-form" ><FaChalkboardTeacher /> Registration Form
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
        <div className="main-content" style={{ padding: "20px", width: isNarrow ? "100%" : "100%", marginLeft: selectedTeacher && !isPortrait ? "-100px" : 0, boxSizing: "border-box" }}>
          <h2 style={{ marginBottom: "10px", textAlign: "center" }}>Teachers</h2>

          {/* Grade Filter */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px" }}>
            <div style={{ display: "flex", gap: "12px" }}>
              {["All", "7", "8", "9", "10", "11", "12"].map(g => (
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
                    width: isNarrow ? "90%" : "500px",
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
      width: isPortrait ? "100%" : "30%",
      position: "fixed",
      left: isPortrait ? 0 : "auto",
      right: 0,
      top: isPortrait ? 0 : "70px",
      height: isPortrait ? "100vh" : "calc(100vh - 70px)",
      background: "#ffffff",
      boxShadow: "0 0 18px rgba(0,0,0,0.08)",
      borderLeft: isPortrait ? "none" : "1px solid #e5e7eb",
      zIndex: 120,
      display: "flex",
      flexDirection: "column"
    }}
  >
    {/* CLOSE BUTTON at the top right */}
    <div style={{ position: "absolute", top: 15, right: 22, zIndex: 999 }}>
      <button
        onClick={() => setSelectedTeacher(null)}
        aria-label="Close sidebar"
        style={{
          background: "none",
          border: "none",
          fontSize: 28,
          fontWeight: 700,
          color: "#3647b7",
          cursor: "pointer",
          padding: 2,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
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
          {selectedTeacherUser?.email || selectedTeacher.email || "teacher@example.com"}
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
  <div
    style={{
      padding: "30px 18px",
      background: "linear-gradient(180deg,#eef2ff 75%,#f8fafc 100%)",
      borderRadius: 24,
      boxShadow: "0 10px 30px rgba(75,108,183,0.08)",
      fontFamily: "Inter, system-ui,sans-serif",
      margin: "0 auto",
      maxWidth: 450
    }}
  >
    <h3 style={{
      margin: 0, marginBottom: 10, color: "#1e40af", fontWeight: 900, letterSpacing: ".2px", fontSize: 22, textAlign: "center"
    }}>
      👩‍🏫 Teacher Profile
    </h3>
    <div style={{ color: "#64748b", fontSize: 13, textAlign: "center", marginBottom: 22 }}>
      ID: <b style={{ color: "#4b6cb7" }}>{selectedTeacher.teacherId}</b>
    </div>

    {/* Info GRID */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 18,
        marginBottom: 16,
      }}
    >
      {[
        { label: "Email", icon: "📧", value: selectedTeacherUser?.email || selectedTeacher.email },
        { label: "Gender", icon: (selectedTeacherUser?.gender || selectedTeacher.gender) === "male" ? "♂️" : (selectedTeacherUser?.gender || selectedTeacher.gender) === "female" ? "♀️" : "⚧", value: selectedTeacherUser?.gender || selectedTeacher.gender || "N/A" },
        { label: "Phone", icon: "📱", value: selectedTeacherUser?.phone || selectedTeacher.phone || selectedTeacher.phoneNumber || "N/A" },
        { label: "Status", icon: "✅", value: selectedTeacher.status || "Active" },
        { label: "Subject(s)", icon: "📚", value: selectedTeacher.gradesSubjects?.map(gs => gs.subject).filter(Boolean).join(", ") },
        { label: "Teacher ID", icon: "🆔", value: selectedTeacher.teacherId },
      ].map((item, i) => (
        <div
          key={i}
          style={{
            alignItems: "center",
            justifyContent: "flex-start",
            display: "flex",
            background: "#fff",
            padding: "14px",
            borderRadius: 14,
            boxShadow: "0 2px 12px rgba(75,108,183,0.04)",
            minHeight: 50,
          }}
        >
          <span style={{
            fontSize: 24,
            marginRight: 14,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#4b6cb7"
          }}>{item.icon}</span>
          <div>
            <div style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: ".6px",
              color: "#64748b",
              textTransform: "uppercase"
            }}>
              {item.label}
            </div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: item.label === "Status"
                ? (item.value && String(item.value).toLowerCase() === "active" ? "#16a34a" : "#991b1b")
                : "#111",
              marginTop: 2,
              wordBreak: "break-word"
            }}>
              {item.value || <span style={{ color: "#d1d5db" }}>N/A</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
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
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "60px",
    height: "60px",
    background: "linear-gradient(135deg, #833ab4, #0259fa, #459afc)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    cursor: "pointer",
    zIndex: 1000,
    boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
    transition: "transform 0.2s ease",
  }}
  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1) ")}
>
  <FaCommentDots size={30} />
</div>


</div>
  

    </div>
 
)}

      </div>

      {/* ---------------- MINI POPUP CHAT ---------------- */}
      {teacherChatOpen && selectedTeacher && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: "360px",
            height: "480px",
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
            zIndex: 2000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* HEADER */}
          <div
            style={{
              padding: "14px",
              borderBottom: "1px solid #eee",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#fafafa",
            }}
          >
            <strong>{selectedTeacher.name}</strong>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  setTeacherChatOpen(false);
                  navigate("/all-chat", { state: { user: selectedTeacher, tab: "teacher" } });
                }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}
              >
                ⤢
              </button>
              <button onClick={() => setTeacherChatOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>×</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", background: "#f9f9f9" }}>
            {popupMessages.length === 0 ? (
              <p style={{ textAlign: "center", color: "#aaa" }}>Start chatting with {selectedTeacher.name}</p>
            ) : (
              popupMessages.map((m) => {
                const isAdmin = String(m.senderId) === String(adminUserId) || m.sender === "admin";
                return (
                  <div key={m.messageId || m.id} style={{ display: "flex", flexDirection: "column", alignItems: isAdmin ? "flex-end" : "flex-start", marginBottom: 10 }}>
                    <div style={{ maxWidth: "70%", background: isAdmin ? "#4facfe" : "#fff", color: isAdmin ? "#fff" : "#000", padding: "10px 14px", borderRadius: 18, borderTopRightRadius: isAdmin ? 0 : 18, borderTopLeftRadius: isAdmin ? 18 : 0, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", wordBreak: "break-word", cursor: "default", position: "relative" }}>
                      {m.text} {m.edited && (<small style={{ fontSize: 10 }}> (edited)</small>)}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 6, fontSize: 11, color: isAdmin ? "#fff" : "#888" }}>
                        <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>{formatDateLabel(m.timeStamp)}</span>
                        <span>{formatTime(m.timeStamp)}</span>
                        {isAdmin && !m.deleted && (
                          <span style={{ display: "flex", gap: 0, alignItems: "center" }}>
                            <FaCheck size={10} color={isAdmin ? "#fff" : "#888"} style={{ opacity: 0.85, marginLeft: 4 }} />
                            {m.seen && (<FaCheck size={10} color={isAdmin ? "#f3f7f8" : "#ccc"} style={{ marginLeft: 2, opacity: 0.95 }} />)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px", borderTop: "1px solid #eee", display: "flex", gap: "8px", background: "#fff" }}>
            <input value={popupInput} onChange={(e) => setPopupInput(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: "10px 14px", borderRadius: "25px", border: "1px solid #ccc", outline: "none" }} onKeyDown={(e) => { if (e.key === "Enter") sendPopupMessage(); }} />
            <button onClick={() => sendPopupMessage()} style={{ width: 45, height: 45, borderRadius: "50%", background: "#4facfe", border: "none", color: "#fff", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
              <FaPaperPlane />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeachersPage;
