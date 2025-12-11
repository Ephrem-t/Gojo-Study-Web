import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

function TeacherChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const teacherIdFromState = location.state?.teacherId;

  const [teachers, setTeachers] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");

  const admin = JSON.parse(localStorage.getItem("admin")) || {};

  // Fetch teachers and recent chats
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const teachersRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json");
        const usersRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json");

        const teachersData = teachersRes.data || {};
        const usersData = usersRes.data || {};

        const teacherList = Object.keys(teachersData).map(id => {
          const teacher = teachersData[id];
          const user = usersData[teacher.userId] || {};
          return {
            teacherId: id,
            name: user.name || "No Name",
            profileImage: user.profileImage || "/default-profile.png"
          };
        });

        setTeachers(teacherList);

        if (teacherIdFromState) {
          const selected = teacherList.find(t => t.teacherId === teacherIdFromState);
          if (selected) setSelectedTeacher(selected);
        }

        setRecentChats(teacherList.slice(0, 5).map(t => t.teacherId));
      } catch (err) {
        console.error("Error fetching teachers:", err);
      }
    };

    fetchTeachers();
  }, [teacherIdFromState]);

  // Fetch messages for selected teacher
  useEffect(() => {
    if (!selectedTeacher) return;

    const fetchMessages = async () => {
      try {
        const messagesRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherMessages.json");
        const allMessages = messagesRes.data || {};
        const chatMessages = Object.values(allMessages).filter(
          m => m.teacherId === selectedTeacher.teacherId
        );
        setMessages(chatMessages);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    fetchMessages();
  }, [selectedTeacher]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedTeacher) return;

    const newMessage = {
      teacherId: selectedTeacher.teacherId,
      adminId: admin.adminId,
      text: messageInput,
      time: new Date().toISOString()
    };

    try {
      await axios.post(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherMessages.json",
        newMessage
      );

      setMessages(prev => [...prev, newMessage]);
      setMessageInput("");
      setRecentChats(prev => [selectedTeacher.teacherId, ...prev.filter(id => id !== selectedTeacher.teacherId)]);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif" }}>
      {/* LEFT PANEL - Recent Chats */}
      <div style={{ width: "280px", borderRight: "1px solid #ddd", overflowY: "auto", background: "#fff" }}>
        <h3 style={{ padding: "15px", borderBottom: "1px solid #ddd" }}>Chats</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "10px" }}>
          {recentChats.map(id => {
            const t = teachers.find(t => t.teacherId === id);
            if (!t) return null;
            return (
              <div
                key={id}
                onClick={() => setSelectedTeacher(t)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px",
                  cursor: "pointer",
                  background: selectedTeacher?.teacherId === id ? "#e0e7ff" : "transparent",
                  borderRadius: "8px",
                  transition: "0.2s"
                }}
              >
                <img
                  src={t.profileImage}
                  alt={t.name}
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    marginRight: "10px",
                    border: selectedTeacher?.teacherId === id ? "2px solid #4b6cb7" : "2px solid transparent",
                    objectFit: "cover"
                  }}
                />
                <span>{t.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL - Chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Chat Header - Fixed */}
        <div style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#fff",
          padding: "15px",
          borderBottom: "1px solid #ddd",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <button
            onClick={() => navigate("/teachers")}
            style={{
              marginRight: "10px",
              padding: "5px 10px",
              borderRadius: "5px",
              border: "none",
              cursor: "pointer",
              background: "#ddd"
            }}
          >
            ← Back
          </button>
          {selectedTeacher ? (
            <>
              <img src={selectedTeacher.profileImage} alt={selectedTeacher.name} style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
              <strong>{selectedTeacher.name}</strong>
            </>
          ) : (
            <span style={{ color: "#aaa" }}>Select a teacher to chat</span>
          )}
        </div>

        {/* Chat Body */}
        <div style={{ flex: 1, padding: "15px", overflowY: "auto", background: "#f9f9f9" }}>
          {selectedTeacher && messages.length === 0 && (
            <p style={{ color: "#aaa", textAlign: "center" }}>Start chatting with {selectedTeacher.name}...</p>
          )}
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                maxWidth: "70%",
                marginBottom: "10px",
                padding: "10px",
                borderRadius: "10px",
                background: msg.adminId === admin.adminId ? "#4b6cb7" : "#ddd",
                color: msg.adminId === admin.adminId ? "#fff" : "#000",
                alignSelf: msg.adminId === admin.adminId ? "flex-end" : "flex-start"
              }}
            >
              {msg.text}
              <div style={{ fontSize: "10px", marginTop: "3px", color: msg.adminId === admin.adminId ? "#ccc" : "#555" }}>
                {new Date(msg.time).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>

        {/* Chat Input */}
        {selectedTeacher && (
          <div style={{ padding: "15px", borderTop: "1px solid #ddd", display: "flex", gap: "10px" }}>
            <input
              type="text"
              placeholder="Type a message..."
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
              onKeyDown={e => e.key === "Enter" && handleSendMessage()}
            />
            <button
              onClick={handleSendMessage}
              style={{ background: "#4b6cb7", padding: "10px 15px", color: "#fff", borderRadius: "8px", border: "none", cursor: "pointer" }}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherChatPage;
