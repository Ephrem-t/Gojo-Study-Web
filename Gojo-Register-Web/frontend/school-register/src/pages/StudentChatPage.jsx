import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/global.css";
import ProfileAvatar from "../components/ProfileAvatar";
import { buildUserLookupFromNode, loadSchoolStudentsNode, loadSchoolUsersNode } from "../utils/registerData";
import { fetchCachedJson } from "../utils/rtdbCache";

function StudentChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { studentId } = location.state || {};
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");

  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem("registrar") || localStorage.getItem("admin") || "{}") || {};
    } catch {
      return {};
    }
  })();
  const admin = stored;
  const schoolCode = stored.schoolCode || "";
  const DB_BASE = "https://bale-house-rental-default-rtdb.firebaseio.com";
  const DB_URL = schoolCode ? `${DB_BASE}/Platform1/Schools/${schoolCode}` : DB_BASE;

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const [studentsData, usersNode] = await Promise.all([
          loadSchoolStudentsNode({ rtdbBase: DB_URL }),
          loadSchoolUsersNode({ rtdbBase: DB_URL }),
        ]);
        const usersData = buildUserLookupFromNode(usersNode);

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
  }, [DB_URL, studentId]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedStudent) return;
      try {
        const allMessages = await fetchCachedJson(`${DB_URL}/StudentMessages.json`, { ttlMs: 15000 }).catch(() => ({}));
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
      await axios.post(`${DB_URL}/StudentMessages.json`, newMessage);
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
            <ProfileAvatar imageUrl={student.profileImage} name={student.name} size={40} />
            <span style={{ color: "var(--text-primary)" }}>{student.name}</span>
          </div>
        ))}
      </div>

      {/* RIGHT CHAT WINDOW */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {selectedStudent ? (
          <>
            <div style={{ ...shellHeaderStyle, justifyContent: "flex-start", gap: "15px" }}>
              <ProfileAvatar imageUrl={selectedStudent.profileImage} name={selectedStudent.name} size={50} />
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
