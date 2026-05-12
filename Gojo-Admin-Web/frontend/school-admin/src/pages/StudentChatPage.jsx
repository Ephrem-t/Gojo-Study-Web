import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import ProfileAvatar from "../components/ProfileAvatar";
import { fetchCachedJson } from "../utils/rtdbCache";

const STUDENT_DIR_CACHE_TTL_MS = 15 * 60 * 1000;

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
        const directoryData = await fetchCachedJson(
          "https://bale-house-rental-default-rtdb.firebaseio.com/StudentDirectory.json",
          { ttlMs: STUDENT_DIR_CACHE_TTL_MS, fallbackValue: {} }
        );

        const studentList = Object.entries(directoryData || {}).map(([id, entry]) => ({
          studentId: entry.studentId || id,
          userId: entry.userId || id,
          name: entry.name || "No Name",
          profileImage: entry.profileImage || "/default-profile.png",
        }));

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
      if (!selectedStudent || !admin.adminId) return;
      // Read only the single conversation instead of all school messages
      const chatId = [admin.adminId, selectedStudent.studentId].sort().join("_");
      try {
        const res = await axios.get(
          `https://bale-house-rental-default-rtdb.firebaseio.com/StudentMessages/${chatId}.json`
        );
        const data = res.data || {};
        const chatMessages = Object.values(data).filter(Boolean);
        setMessages(chatMessages);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    fetchMessages();
  }, [selectedStudent, admin.adminId]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedStudent || !admin.adminId) return;

    const chatId = [admin.adminId, selectedStudent.studentId].sort().join("_");
    const newMessage = {
      studentId: selectedStudent.studentId,
      adminId: admin.adminId,
      content: messageInput,
      timestamp: new Date().toISOString(),
    };

    try {
      await axios.post(
        `https://bale-house-rental-default-rtdb.firebaseio.com/StudentMessages/${chatId}.json`,
        newMessage
      );
      setMessages(prev => [...prev, newMessage]);
      setMessageInput("");
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--surface-soft)" }}>
      {/* LEFT CHAT LIST */}
      <div
        style={{
          width: "280px",
          background: "var(--surface-panel)",
          borderRight: "1px solid var(--border-soft)",
          overflowY: "auto",
        }}
      >
        <div style={{ padding: "15px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Students</strong>
          <button onClick={() => navigate("/students")} style={{ cursor: "pointer", fontSize: "16px", background: "none", border: "none", color: "var(--text-primary)" }}>
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
              background: selectedStudent?.studentId === student.studentId ? "color-mix(in srgb, var(--accent) 14%, var(--surface-panel))" : "var(--surface-panel)",
              borderBottom: "1px solid var(--border-soft)",
            }}
          >
            <ProfileAvatar src={student.profileImage} name={student.name} alt={student.name} loading="lazy" style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
            <span>{student.name}</span>
          </div>
        ))}
      </div>

      {/* RIGHT CHAT WINDOW */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {selectedStudent ? (
          <>
            <div style={{ padding: "15px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: "15px", background: "var(--surface-panel)" }}>
              <ProfileAvatar src={selectedStudent.profileImage} name={selectedStudent.name} alt={selectedStudent.name} style={{ width: "50px", height: "50px", borderRadius: "50%" }} />
              <strong>{selectedStudent.name}</strong>
            </div>

            <div style={{ flex: 1, padding: "15px", overflowY: "auto", background: "var(--surface-soft)" }}>
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
                      color: msg.adminId === admin.adminId ? "var(--on-accent)" : "var(--text-primary)",
                      padding: "10px 15px",
                      borderRadius: "12px",
                      maxWidth: "70%",
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
                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--border-soft)", background: "var(--surface-panel)", color: "var(--text-primary)" }}
              />
              <button
                onClick={handleSendMessage}
                style={{ background: "var(--accent-strong)", color: "var(--on-accent)", padding: "10px 15px", borderRadius: "8px", border: "none", cursor: "pointer" }}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", color: "var(--text-muted)" }}>
            Select a student to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentChatPage;
