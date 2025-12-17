import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { FaArrowLeft } from "react-icons/fa";

function TeacherChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { studentId } = location.state || {};

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const teacherId = "-Og0ocoJTv29t9XHH8_2"; // Replace with your teacher's userId or from auth

  useEffect(() => {
    if (!studentId) return;

    const fetchMessages = async () => {
      try {
        const res = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentMessages.json`
        );
        const allMessages = Object.values(res.data || {}).filter(
          (m) => m.studentId === studentId
        );
        setMessages(allMessages);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    fetchMessages();
  }, [studentId]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const newMessage = {
      studentId,
      senderId: teacherId,
      receiverId: studentId,
      text: input,
      timeStamp: new Date().getTime(),
    };

    try {
      await axios.post(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentMessages.json",
        newMessage
      );
      setMessages([...messages, newMessage]);
      setInput("");
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            fontSize: "20px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          <FaArrowLeft />
        </button>
        <h2>Chat with Student</h2>
      </div>

      <div
        style={{
          height: "400px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "10px",
          overflowY: "auto",
          marginBottom: "10px",
        }}
      >
        {messages.length === 0 ? (
          <p style={{ color: "#aaa", textAlign: "center" }}>No messages yet</p>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              style={{
                marginBottom: "10px",
                textAlign: msg.senderId === teacherId ? "right" : "left",
              }}
            >
              <span
                style={{
                  background: msg.senderId === teacherId ? "#4b6cb7" : "#eee",
                  color: msg.senderId === teacherId ? "#fff" : "#000",
                  padding: "6px 12px",
                  borderRadius: "12px",
                  display: "inline-block",
                }}
              >
                {msg.text}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid #ddd",
          }}
        />
        <button
          onClick={handleSendMessage}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: "#4b6cb7",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default TeacherChatPage;
