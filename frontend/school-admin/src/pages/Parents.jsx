import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaBell, FaFacebookMessenger, FaSearch, FaCalendarAlt, FaCommentDots } from "react-icons/fa";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Parent() {
  const [parents, setParents] = useState([]);
  const [selectedParent, setSelectedParent] = useState(null);
  const [parentTab, setParentTab] = useState("details");
  const [parentChatOpen, setParentChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [parentInfo, setParentInfo] = useState(null);
  const [children, setChildren] = useState([]);

  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem("admin")) || {};

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





  // Fetch chat messages
  useEffect(() => {
    if (!selectedParent) return;

    const chatId = `${selectedParent.userId}_${admin.userId}`; 
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatId}/messages.json`);
        const msgs = res.data ? Object.values(res.data).sort((a,b) => a.timeStamp - b.timeStamp) : [];
        setMessages(msgs);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };
    fetchMessages();
  }, [selectedParent]);

  // Send message
  const sendMessage = async (text) => {
    if (!text.trim() || !selectedParent) return;
    const chatId = `${selectedParent.userId}_${admin.userId}`; 

    const newMessage = {
      senderId: admin.userId,
      receiverId: selectedParent.userId,
      text,
      timeStamp: Date.now(),
      edited: false,
      deleted: false,
      messageId: `msg_${Date.now()}`
    };

    try {
      await axios.post(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatId}/messages.json`, newMessage);
      setMessages(prev => [...prev, newMessage]);
      setNewMessageText("");
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

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
          <div className="icon-circle"><FaBell /></div>
          <div className="icon-circle"><FaFacebookMessenger /></div>
          <div className="icon-circle"><FaCog /></div>
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
            <Link className="sidebar-btn" to="/settings"><FaCog /> Settings</Link>
            <button className="sidebar-btn logout-btn" onClick={() => { localStorage.removeItem("admin"); window.location.href = "/login"; }}>
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="main-content" style={{ padding: "30px", width: "65%", marginLeft: "180px" }}>
          <h2 style={{ marginBottom: "20px", textAlign: "center" }}>Parents</h2>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
            {parents.length === 0 ? (
              <p>No parents found.</p>
            ) : (
              parents.map(p => (
                <div key={p.userId} onClick={() => setSelectedParent(p)} style={{
                  width: "500px",
                  height: "70px",
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
                  <div style={{ padding: "15px", background: "#f8f9ff", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.08)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", color: "#555" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#fff", borderRadius: "8px", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                        <span><strong>User ID:</strong></span>
                        <span>{parentInfo.userId}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#fff", borderRadius: "8px", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                        <span><strong>Email:</strong></span>
                        <span>{parentInfo.email}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#fff", borderRadius: "8px", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                        <span><strong>Phone:</strong></span>
                        <span>{parentInfo.phone}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#fff", borderRadius: "8px", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                        <span><strong>Status:</strong></span>
                        <span>{parentInfo.status}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#fff", borderRadius: "8px", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                        <span><strong>Additional Info:</strong></span>
                        <span>{parentInfo.additionalInfo}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#fff", borderRadius: "8px", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                        <span><strong>Created At:</strong></span>
                        <span>{parentInfo.createdAt}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* CHILDREN TAB */}
                {parentTab === "children" && (
                  <div style={{ padding: "15px" }}>
                    <h4 style={{ marginBottom: "10px", color: "#4b6cb7" }}>Children</h4>
                    {children.length === 0 ? (
                      <p>No children found</p>
                    ) : (
                      children.map(child => (
                        <div key={child.studentId} style={{ display: "flex", alignItems: "center", padding: "12px", marginBottom: "10px", background: "#f8f9ff", borderRadius: "10px", boxShadow: "0 4px 10px rgba(0,0,0,0.05)", gap: "12px" }}>
                          <img src={child.profileImage} alt={child.name} style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover" }} />
                          <div>
                            <h3 style={{ margin: "0 0 5px 0" }}>{child.name}</h3>
                            <p style={{ margin: "2px 0" }}>Email: {child.email}</p>
                            <p style={{ margin: "2px 0" }}>Grade: {child.grade}</p>
                            <p style={{ margin: "2px 0" }}>Section: {child.section}</p>
                            <p style={{ margin: "2px 0" }}>Parent Phone: {child.parentPhone}</p>
                            <p style={{ margin: "2px 0" }}>Relationship: {child.relationship}</p>
                          </div>
                        </div>
                      ))
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

