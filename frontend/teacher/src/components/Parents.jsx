import React, { useState, useEffect, useRef } from "react";
import { FaHome, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaSearch, FaBell, FaClipboardCheck, FaUsers, FaFacebookMessenger, FaCommentDots } from "react-icons/fa";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { ref, onValue, off } from "firebase/database";
import { db } from "../firebase"; // adjust path

const getChatId = (id1, id2) => {
  return [id1, id2].sort().join("_");
};


function TeacherParent() {
  const [teacher, setTeacher] = useState(null);
  const [parents, setParents] = useState([]);
  const [selectedParent, setSelectedParent] = useState(null);
  const [loading, setLoading] = useState(true);
const [activeTab, setActiveTab] = useState("Details"); // default tab
 const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const messagesEndRef = useRef(null);
const [children, setChildren] = useState([]);

  const navigate = useNavigate();
  
 const handleExpand = () => {
    // Navigate to AllChat page
    // Pass user info and tab type
    navigate("/all-chat", {
      state: {
        user: selectedUser,
        tab: selectedTab,
      },
    });
  };
  // Load teacher from localStorage on mount
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login"); // redirect if not logged in
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // Fetch parents and students after teacher is loaded
  useEffect(() => {
    if (!teacher) return;

    const fetchParents = async () => {
      try {
        setLoading(true);

        // Fetch all relevant data
        const [assignmentsRes, coursesRes, studentsRes, usersRes, parentsRes] = await Promise.all([
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Courses.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Parents.json")
        ]);

        const assignments = assignmentsRes.data || {};
        const courses = coursesRes.data || {};
        const students = studentsRes.data || {};
        const users = usersRes.data || {};
        const parentsData = parentsRes.data || {};

        const teacherId = teacher.userId;

        // Get the courses assigned to this teacher
        const teacherCourseIds = Object.values(assignments)
          .filter(a => a.teacherId === teacherId)
          .map(a => a.courseId);

        const teacherCourses = Object.values(courses)
          .filter(c => teacherCourseIds.includes(c.id))
          .map(c => ({ grade: c.grade, section: c.section }));

        // Map studentId -> parentIds
        const studentToParentMap = {};
        Object.entries(parentsData).forEach(([parentId, parent]) => {
          if (!parent.children) return;
          Object.values(parent.children).forEach(child => {
            if (!child.studentId) return;
            if (!studentToParentMap[child.studentId]) studentToParentMap[child.studentId] = [];
            studentToParentMap[child.studentId].push(parentId);
          });
        });

        // Map parentId -> children (only students in teacher's courses)
        const parentChildrenMap = {};
      Object.entries(students).forEach(([studentId, student]) => {
    // const isTeacherStudent = teacherCourses.some(tc => tc.grade === student.grade && tc.section === student.section);
    // if (!isTeacherStudent) return;

   const studentUser = Object.values(users).find(u => u.userId === student.userId);
        const studentName = studentUser?.name || "No Name";
        const studentProfileImage = studentUser?.profileImage || "/default-profile.png";

        const parentIds = studentToParentMap[studentId] || [];
        parentIds.forEach(pid => {
          if (!parentChildrenMap[pid]) parentChildrenMap[pid] = [];
          parentChildrenMap[pid].push({
            studentId,
            name: studentName,
            grade: student.grade,
            section: student.section,
            profileImage: studentProfileImage
          });
        });
      });

        // Build final parent list
        const finalParents = Object.keys(parentChildrenMap).map(pid => {
          const parent = parentsData[pid];
          const parentUser = Object.values(users).find(u => u.userId === parent.userId);
          return {
            id: pid,
            userId: parent.userId,
            name: parentUser?.name || "No Name",
            email: parentUser?.email || "N/A",
            profileImage: parentUser?.profileImage || "/default-profile.png",
            children: parentChildrenMap[pid]
          };
        });

        setParents(finalParents);
      } catch (err) {
        console.error("Error fetching parents:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchParents();
  }, [teacher]);

// Scroll to bottom when new message arrives
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Fetch messages for this teacher → parent chat
useEffect(() => {
  if (!selectedParent || !teacher || !chatOpen) return;

  const chatId = getChatId(teacher.userId, selectedParent.userId);
  const messagesRef = ref(db, `Chats/${chatId}/messages`);

  const unsubscribe = onValue(messagesRef, (snapshot) => {
    const data = snapshot.val();

    if (data) {
      const msgs = Object.entries(data).map(([id, msg]) => ({
        messageId: id,
        ...msg
      }));

      msgs.sort((a, b) => a.timeStamp - b.timeStamp);
      setMessages(msgs);
    } else {
      setMessages([]);
    }
  });

  markAsSeen(chatId);

  return () => off(messagesRef);
}, [selectedParent, teacher, chatOpen]);


  // Send a new message
 const sendMessage = async (text) => {
  if (!text.trim()) return;

  const senderId = teacher.userId;
  const receiverId = selectedParent.userId;
  const chatId = getChatId(senderId, receiverId);
  const timeStamp = Date.now();

  const message = {
    senderId,
    receiverId,
    type: "text",
    text,
    imageUrl: null,
    replyTo: null,
    seen: false,
    edited: false,
    deleted: false,
    timeStamp
  };

  try {
    await axios.post(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatId}/messages.json`,
      message
    );

    await axios.patch(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatId}.json`,
      {
        participants: {
          [senderId]: true,
          [receiverId]: true
        },
        lastMessage: {
          text,
          senderId,
          seen: false,
          timeStamp
        },
        unread: {
          [senderId]: 0,
          [receiverId]: 1
        }
      }
    );

    setNewMessageText("");
  } catch (err) {
    console.error("Send message error:", err.response?.data || err);
  }
};




const markAsSeen = async (chatId) => {
  try {
    await axios.patch(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatId}/unread.json`,
      {
        [teacher.userId]: 0,
      }
    );

    await axios.patch(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatId}/lastMessage.json`,
      {
        seen: true,
      }
    );
  } catch (err) {
    console.error("Mark as seen error:", err);
  }
};







  return (
    <div className="dashboard-page">
      {/* Top Navbar */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>
        <div className="nav-search">
          <FaSearch className="search-icon" />
          <input type="text" placeholder="Search Teacher and Student..." />
        </div>
        <div className="nav-right">
          <div className="icon-circle"><FaBell /></div>
          <div className="icon-circle"><FaFacebookMessenger /></div>
          <div className="icon-circle"><FaCog /></div>
          <img src={teacher?.profileImage || "/default-profile.png"} alt="profile" />
        </div>
      </nav>

      <div className="google-dashboard">
        {/* Sidebar */}
        <div className="google-sidebar">
          {teacher && (
            <div className="sidebar-profile">
              <div className="sidebar-img-circle">
                <img src={teacher.profileImage || "/default-profile.png"} alt="profile" />
              </div>
              <h3>{teacher.name}</h3>
              <p>{teacher.username}</p>
            </div>
          )}

          <div className="sidebar-menu">
            <Link className="sidebar-btn" to="/dashboard"><FaHome /> Home</Link>
      
            <Link className="sidebar-btn" to="/students"><FaUsers /> Students</Link>
            <Link className="sidebar-btn" to="/admins"><FaUsers /> Admins</Link>
            <Link className="sidebar-btn" to="/parents" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaChalkboardTeacher /> Parents</Link>
            <Link className="sidebar-btn" to="/marks"><FaClipboardCheck /> Marks</Link>
            <Link className="sidebar-btn" to="/attendance"><FaUsers /> Attendance</Link>
            <Link className="sidebar-btn" to="/schedule" >
                                             <FaUsers /> Schedule
                                           </Link>
            <Link className="sidebar-btn" to="/settings"><FaCog /> Settings</Link>
            <button className="sidebar-btn logout-btn" onClick={handleLogout}><FaSignOutAlt /> Logout</button>
          </div>
        </div>

        {/* MAIN */}
       <div className="main-content" style={{ padding: "30px", width: "65%", marginLeft: "400px",  }}>
  <h2 style={{ marginBottom: "30px", textAlign: "center", color: "#4b6cb7", fontWeight: "700" }}>
    Parents
  </h2>

  {loading ? (
    <p style={{ textAlign: "center", fontSize: "18px", color: "#555" }}>Loading...</p>
  ) : parents.length === 0 ? (
    <p style={{ textAlign: "center", fontSize: "18px", color: "#999" }}>No parents found.</p>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
      {parents.map((p) => (
        <div
          key={p.id}
          onClick={() => setSelectedParent(p)}
          style={{
            display: "flex",
            marginLeft: "110px",
            width: "650px",
            height: "100px",
            flexDirection: "column",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
            backgroundColor: selectedParent?.id === p.id ? "#f0f4ff" : "#fff",
            transition: "all 0.3s ease",
            cursor: "pointer",
            border: "1px solid #e0e0e0",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <img
              src={p.profileImage}
              alt={p.name}
              style={{ width: "60px", height: "60px", borderRadius: "50%", objectFit: "cover" }}
            />
            <div>
              <h3 style={{ margin: "0", fontSize: "18px", color: "#333" }}>{p.name}</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "14px", color: "#777" }}>{p.email}</p>
            </div>
          </div>

        
        </div>
      ))}
    </div>
  )}
</div>
 {/* Right Sidebar */}
  {selectedParent && (
    <div
      className="parent-sidebar"
      style={{
        width: "500px",
        backgroundColor: "#f9f9f9",
        borderLeft: "-150px solid #ddd",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.3s",
      }}
    >
      <img
        src={selectedParent.profileImage}
        alt={selectedParent.name}
        style={{
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          margin: "0 auto 20px auto",
          objectFit: "cover",
        }}
      />
      <h3 style={{ textAlign: "center", marginBottom: "10px", color: "#333" }}>
        {selectedParent.name}
      </h3>

      {/* Tabs */}
      <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "20px" }}>
        {["Details", "Children", "Status"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              background: activeTab === tab ? "#4b6cb7" : "#e0e0e0",
              color: activeTab === tab ? "#fff" : "#555",
              fontWeight: activeTab === tab ? "600" : "500",
              transition: "all 0.3s",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ lineHeight: "1.6", color: "#555" }}>
        {activeTab === "Details" && (
  <div
    style={{
      background: "#f7f9fc",
      borderRadius: "20px",
      padding: "30px 20px",
      boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      transition: "all 0.3s ease",
      maxWidth: "380px",
      margin: "0 auto",
    }}
  >
    
    {/* Info Grid */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "15px 15px",
        width: "100%",
      }}
    >
      {[
        { label: "User ID", value: selectedParent.userId },
        { label: "Email", value: selectedParent.email || "N/A" },
        { label: "Phone", value: selectedParent.phone || "N/A" },
        { label: "Address", value: selectedParent.address || "N/A" },
        { label: "Extra Info", value: selectedParent.extra || "N/A", span: true },
      ].map((item, idx) => (
        <div
          key={idx}
          style={{
            background: "#fff",
            padding: "12px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            gridColumn: item.span ? "span 2" : "span 1",
            transition: "transform 0.3s",
          }}
        >
          <p style={{ margin: "0 0 4px 0", color: "#555", fontWeight: 600 }}>
            {item.label}
          </p>
          <p style={{ margin: 0, color: "#333", fontWeight: 500 }}>{item.value}</p>
        </div>
      ))}
    </div>


    </div>

)}



  {activeTab === "Children" && (
  <div style={{ display: "flex", flexDirection: "column", gap: "15px", padding: "10px 0" }}>
    {selectedParent.children.map((c) => (
      <div
        key={c.studentId}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "15px 20px",
          borderRadius: "16px",
          background: "#fff",
          boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
          transition: "all 0.3s ease",
          cursor: "pointer",
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-4px)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
      >
        {/* Profile Image */}
        <div style={{ width: "60px", height: "60px", borderRadius: "50%", overflow: "hidden", marginRight: "15px", border: "2px solid #4b6cb7", flexShrink: 0 }}>
          <img src={c.profileImage} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>

        {/* Student Info */}
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, color: "#4b6cb7", fontSize: "1.2rem" }}>{c.name}</h3>
          <p style={{ margin: "4px 0 0 0", color: "#555" }}>{c.userId}</p>

          <div style={{ marginTop: "6px", display: "flex", gap: "8px" }}>
            <span style={{ background: "linear-gradient(135deg, #6a11cb, #2575fc)", color: "#fff", padding: "3px 10px", borderRadius: "12px", fontSize: "0.85rem", fontWeight: "600" }}>Grade {c.grade}</span>
            <span style={{ background: "linear-gradient(135deg, #ff7e5f, #feb47b)", color: "#fff", padding: "3px 10px", borderRadius: "12px", fontSize: "0.85rem", fontWeight: "600" }}>Section {c.section}</span>
          </div>
        </div>

        <button style={{ padding: "8px 12px", borderRadius: "12px", border: "none", background: "#4b6cb7", color: "#fff", fontWeight: "600", cursor: "pointer", transition: "all 0.3s" }} onMouseEnter={e => (e.target.style.transform = "scale(1.05)")} onMouseLeave={e => (e.target.style.transform = "scale(1)")}>View</button>
      </div>
    ))}
  </div>
)}



        {activeTab === "Status" && (
          <div style={{ color: "#555" }}>
            <p><strong>Status:</strong> {selectedParent.status || "Active"}</p>
            <p><strong>Created At:</strong> {new Date(selectedParent.createdAt).toLocaleString()}</p>
          </div>
        )}
      </div>


 {/* Chat Button */}
      {!chatOpen && (
        <div
          onClick={() => setChatOpen(true)}
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: "50px",
            height: "50px",
            background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
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
        >
          <FaCommentDots size={24} />
        </div>
      )}

      {/* Chat Popup */}
      {chatOpen && selectedParent && (
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
            <strong>{selectedParent.name}</strong>

            <div style={{ display: "flex", gap: "10px" }}>
              {/* Expand */}
              
              <button
  onClick={() => {
    setChatOpen(false); // properly close popup
    navigate("/all-chat", {
      state: {
        user: selectedParent, // user to auto-select
        tab: "parent",        // tab type
      },
    });
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


              {/* Close */}
              <button
                onClick={() => setChatOpen(false)}
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
          <div
            style={{
              flex: 1,
              padding: "12px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              background: "#f9f9f9",
            }}
          >
            {messages.length === 0 ? (
              <p style={{ textAlign: "center", color: "#aaa" }}>
                Start chatting with {selectedParent.name}
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.messageId}
                  style={{
                    display: "flex",
                    justifyContent:
                      m.senderId === teacher.userId ? "flex-end" : "flex-start",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "8px 14px",
                      borderRadius: "20px",
                      background:
                        m.senderId === teacher.userId ? "#4b6cb7" : "#e5e5ea",
                      color: m.senderId === teacher.userId ? "#fff" : "#000",
                      maxWidth: "70%",
                      wordWrap: "break-word",
                      transition: "all 0.2s",
                    }}
                  >
                    {m.text}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "10px",
              borderTop: "1px solid #eee",
              display: "flex",
              gap: "8px",
              background: "#fff",
            }}
          >
            <input
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "999px",
                border: "1px solid #ccc",
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage(newMessageText);
              }}
            />
            <button
              onClick={() => sendMessage(newMessageText)}
              style={{
                background:
                  "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
                border: "none",
                borderRadius: "50%",
                width: "42px",
                height: "42px",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}


    </div>
  )}

  
</div>
      </div>
   
  );
}

export default TeacherParent;
