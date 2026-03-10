import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/global.css";

function StudentChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { studentId } = location.state || {};
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");

  const admin = JSON.parse(localStorage.getItem("admin")) || {};

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const studentsRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json");
        const usersRes = await axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json");

        const studentsData = studentsRes.data || {};
        const usersData = usersRes.data || {};

        const studentList = Object.keys(studentsData).map(id => {
          const student = studentsData[id];
          const user = usersData[student.userId] || {};
          return {
            studentId: id,
            name: user.name || user.username || "No Name",
            profileImage: user.profileImage || "/default-profile.png",
          };
        });

        setStudents(studentList);

        // Preselect student if navigated with studentId
        if (studentId) {
          const found = studentList.find(s => s.studentId === studentId);
          if (found) setSelectedStudent(found);
        }
      } catch (err) {
        console.error("Error fetching students:", err);
      }
    };

    fetchStudents();
  }, [studentId]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedStudent) return;
      try {
        const res = await axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentMessages.json`);
        const allMessages = res.data || {};
        const chatMessages = Object.values(allMessages).filter(
          m =>
            (m.studentId === selectedStudent.studentId && m.adminId === admin.adminId) ||
            (m.studentId === admin.adminId && m.adminId === selectedStudent.studentId)
        );
        setMessages(chatMessages);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    fetchMessages();
  }, [selectedStudent, admin.adminId]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedStudent) return;

    const newMessage = {
      studentId: selectedStudent.studentId,
      adminId: admin.adminId,
      content: messageInput,
      timestamp: new Date().toISOString(),
    };

    try {
      await axios.post(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentMessages.json`, newMessage);
      setMessages(prev => [...prev, newMessage]);
      setMessageInput("");
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const pageShellStyle = {
    display: "flex",
    height: "100vh",
    background: "linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-secondary) 100%)",
    color: "var(--text-primary)",
  };

  const sidebarStyle = {
    width: "280px",
    background: "var(--surface-panel)",
    borderRight: "1px solid var(--border-soft)",
    overflowY: "auto",
    boxShadow: "var(--shadow-soft)",
  };

  const shellHeaderStyle = {
    padding: "15px",
    borderBottom: "1px solid var(--border-soft)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--surface-muted)",
  };

  const composerInputStyle = {
    flex: 1,
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
  };

  return (
    <div style={pageShellStyle}>
      {/* LEFT CHAT LIST */}
      <div style={sidebarStyle}>
        <div style={shellHeaderStyle}>
          <strong style={{ color: "var(--text-primary)" }}>Students</strong>
          <button onClick={() => navigate("/students")} style={{ cursor: "pointer", fontSize: "16px", background: "none", border: "none", color: "var(--accent-strong)" }}>
            ← Back
          </button>
        </div>
        {students.map(student => (
          <div
            key={student.studentId}
            onClick={() => setSelectedStudent(student)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px",
              cursor: "pointer",
              background: selectedStudent?.studentId === student.studentId ? "var(--accent-soft)" : "var(--surface-panel)",
              borderBottom: "1px solid var(--border-soft)",
            }}
          >
            <img src={student.profileImage} alt={student.name} style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
            <span style={{ color: "var(--text-primary)" }}>{student.name}</span>
          </div>
        ))}
      </div>

      {/* RIGHT CHAT WINDOW */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {selectedStudent ? (
          <>
            <div style={{ ...shellHeaderStyle, justifyContent: "flex-start", gap: "15px" }}>
              <img src={selectedStudent.profileImage} alt={selectedStudent.name} style={{ width: "50px", height: "50px", borderRadius: "50%" }} />
              <strong style={{ color: "var(--text-primary)" }}>{selectedStudent.name}</strong>
            </div>

            <div style={{ flex: 1, padding: "15px", overflowY: "auto", background: "var(--surface-overlay)" }}>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: "10px",
                    display: "flex",
                    justifyContent: msg.adminId === admin.adminId ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      background: msg.adminId === admin.adminId ? "var(--accent-strong)" : "var(--surface-panel)",
                      color: msg.adminId === admin.adminId ? "#fff" : "var(--text-primary)",
                      padding: "10px 15px",
                      borderRadius: "12px",
                      maxWidth: "70%",
                      border: msg.adminId === admin.adminId ? "none" : "1px solid var(--border-soft)",
                      boxShadow: "var(--shadow-soft)",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", padding: "15px", gap: "10px", borderTop: "1px solid var(--border-soft)", background: "var(--surface-panel)" }}>
              <input
                type="text"
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                style={composerInputStyle}
              />
              <button
                onClick={handleSendMessage}
                style={{ background: "var(--accent-strong)", color: "#fff", padding: "10px 15px", borderRadius: "8px", border: "none", cursor: "pointer", boxShadow: "var(--shadow-glow)" }}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", color: "var(--text-secondary)" }}>
            Select a student to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentChatPage;
