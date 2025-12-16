import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";

function AllChat() {
  // ------------------- ROUTE & ADMIN DATA -------------------
  const location = useLocation();
  const admin = JSON.parse(localStorage.getItem("admin")) || {};
  const passedStudentId = location.state?.studentId;
  const passedUserType = location.state?.userType; // "student" | "teacher"
  const passedTeacher = location.state?.teacher; // teacher object from TeachersPage

  // ------------------- STATE VARIABLES -------------------
  const [chatType, setChatType] = useState("teacher"); // teacher | student
  const [messageInput, setMessageInput] = useState(""); // input for sending message
  const [messages, setMessages] = useState([]); // all messages
  const [users, setUsers] = useState([]); // teachers or students list
  const [recentChats, setRecentChats] = useState([]); // users with message history
  const [selectedUser, setSelectedUser] = useState(null); // current chat user
  const autoSelectedRef = useRef(false); // auto select user from popup

  // ------------------- SET CHAT TYPE BASED ON ROUTE STATE -------------------
  useEffect(() => {
    if (passedUserType === "student") setChatType("student");
    if (passedUserType === "teacher") setChatType("teacher");
  }, [passedUserType]);

  // ================= FETCH USERS =================
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json");
        const userData = usersRes.data || {};
        let list = [];

        // ---------- TEACHERS ----------
        if (chatType === "teacher") {
          const tRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json");
          const teachersData = tRes.data || {};
          list = Object.keys(teachersData).map((id) => {
            const t = teachersData[id];
            const u = userData[t.userId] || {};
            return {
              id,
              name: u.name || "No Name",
              profileImage: u.profileImage || "/default-profile.png",
            };
          });
        }

        // ---------- STUDENTS ----------
        if (chatType === "student") {
          const sRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json");
          const studentsData = sRes.data || {};
          list = Object.keys(studentsData).map((id) => {
            const s = studentsData[id];
            const u = userData[s.userId] || {};
            return {
              id,
              name: u.name || u.username || "No Name",
              profileImage: u.profileImage || "/default-profile.png",
            };
          });
        }

        setUsers(list);

        // ---------- AUTO SELECT USER FROM MINI POPUP (ONLY ONCE) ----------
        if (!autoSelectedRef.current) {
          if (chatType === "teacher" && passedTeacher) {
            const found = list.find((u) => u.id === passedTeacher.teacherId);
            if (found) {
              setSelectedUser(found);
              autoSelectedRef.current = true;
            }
          }
          if (chatType === "student" && passedStudentId) {
            const found = list.find((u) => u.id === passedStudentId);
            if (found) {
              setSelectedUser(found);
              autoSelectedRef.current = true;
            }
          }
        }

      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };

    fetchUsers();
  }, [chatType, location.state]);

  // ================= FETCH MESSAGES =================
  useEffect(() => {
    if (!users.length) return;

    const fetchMessages = async () => {
      try {
        const url =
          chatType === "teacher"
            ? "https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherMessages.json"
            : "https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentMessages.json";

        const res = await axios.get(url);
        const allMessages = Object.values(res.data || {}).filter(
          (m) => m.adminId === admin.adminId
        );

        // Sort messages by latest first
        allMessages.sort(
          (a, b) => new Date(b.time || b.timestamp) - new Date(a.time || a.timestamp)
        );

        setMessages(allMessages);

        // Build recent chats list
        const uniqueUsers = [];
        const seen = new Set();
        allMessages.forEach((m) => {
          const userId = m.teacherId || m.studentId;
          if (!seen.has(userId)) {
            const user = users.find((u) => u.id === userId);
            if (user) {
              uniqueUsers.push(user);
              seen.add(userId);
            }
          }
        });
        setRecentChats(uniqueUsers);

      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    // Initial fetch + polling every 3 seconds
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [users, chatType, admin.adminId]);

  // ================= SEND MESSAGE =================
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedUser) return;

    try {
      let msg;
      if (chatType === "teacher") {
        msg = {
          teacherId: selectedUser.id,
          adminId: admin.adminId,
          text: messageInput,
          time: new Date().toISOString(),
        };
        await axios.post(
          "https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherMessages.json",
          msg
        );
      } else {
        msg = {
          studentId: selectedUser.id,
          adminId: admin.adminId,
          content: messageInput,
          timestamp: new Date().toISOString(),
        };
        await axios.post(
          "https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentMessages.json",
          msg
        );
      }

      // Update UI immediately
      setMessages((prev) => [msg, ...prev]);
      setRecentChats((prev) => {
        if (prev.find((u) => u.id === selectedUser.id)) return prev;
        return [selectedUser, ...prev];
      });
      setMessageInput("");
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // ================= UI =================
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* -------- LEFT: Recent Chats -------- */}
      <div style={{ width: 280, borderRight: "1px solid #ddd", background: "#fff" }}>
        {/* Chat Type Toggle */}
        <div style={{ padding: 15, borderBottom: "1px solid #ddd" }}>
          <button onClick={() => setChatType("teacher")} style={{ marginRight: 10 }}>
            Teacher
          </button>
          <button onClick={() => setChatType("student")}>Student</button>
        </div>

        {/* Recent Chats List */}
        {recentChats.map((u) => {
          const isActive = selectedUser?.id === u.id;
          return (
            <div
              key={u.id}
              onClick={() => setSelectedUser(u)}
              style={{
                padding: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                marginBottom: 5,
                borderRadius: 6,
                background: isActive ? "#e0e7ff" : "transparent",
              }}
            >
              <img
                src={u.profileImage}
                alt=""
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  marginRight: 10,
                  border: isActive ? "2px solid #4b6cb7" : "2px solid transparent",
                }}
              />
              <span>{u.name}</span>
            </div>
          );
        })}
      </div>

      {/* -------- RIGHT: Chat Window -------- */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Chat Header */}
        <div style={{ padding: 15, borderBottom: "1px solid #ddd" }}>
          <strong>{selectedUser ? selectedUser.name : "Select a chat"}</strong>
        </div>

        {/* Chat Messages */}
        <div
          style={{
            flex: 1,
            padding: 15,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column-reverse",
          }}
        >
          {messages
            .filter((m) => (chatType === "teacher" ? m.teacherId : m.studentId) === selectedUser?.id)
            .map((m, i) => (
              <div
                key={i}
                style={{ marginBottom: 10, textAlign: m.adminId === admin.adminId ? "right" : "left" }}
              >
                <span
                  style={{
                    padding: "8px 12px",
                    background: m.adminId === admin.adminId ? "#4b6cb7" : "#ddd",
                    color: m.adminId === admin.adminId ? "#fff" : "#000",
                    borderRadius: 10,
                    display: "inline-block",
                    maxWidth: "80%",
                    wordBreak: "break-word",
                  }}
                >
                  {m.text || m.content}
                </span>
              </div>
            ))}
        </div>

        {/* Message Input */}
        {selectedUser && (
          <div style={{ display: "flex", padding: 15, borderTop: "1px solid #ddd" }}>
            <input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
              placeholder="Type message..."
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            />
            <button
              onClick={handleSendMessage}
              style={{
                marginLeft: 10,
                padding: "8px 16px",
                borderRadius: 8,
                background: "#4b6cb7",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AllChat;
