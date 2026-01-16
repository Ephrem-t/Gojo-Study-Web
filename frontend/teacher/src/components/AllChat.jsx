import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaPaperPlane, FaCheck } from "react-icons/fa";
import { getDatabase, ref, onValue, push, update } from "firebase/database";
import { db } from "../firebase";

const getChatId = (id1, id2) => [String(id1), String(id2)].sort().join("_");

/* ================= FIREBASE ================= */

export default function TeacherAllChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const chatEndRef = useRef(null);

  const teacher = JSON.parse(localStorage.getItem("teacher")) || {};
  const teacherUserId = String(teacher.userId || "");

  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const { user, tab } = location.state || {};
  const [selectedTab, setSelectedTab] = useState(tab || "student");
  const [selectedChatUser, setSelectedChatUser] = useState(user || null);

  const [clickedMessageId, setClickedMessageId] = useState(null);

  // ✅ Per-message editing state (top-level hooks)
  const [editingMessages, setEditingMessages] = useState({}); // { messageId: true/false }
  const [editTexts, setEditTexts] = useState({}); // { messageId: text }





  const getProfileImage = (user = {}) =>
    user.profileImage || user.profile || user.avatar || "/default-profile.png";

  /* ================= FETCH USERS ================= */
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [studentsRes, parentsRes, adminsRes, usersRes] = await Promise.all([
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json").then((r) => r.json()),
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Parents.json").then((r) => r.json()),
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/School_Admins.json").then((r) => r.json()),
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json").then((r) => r.json()),
        ]);

        const users = usersRes || {};

        const allStudents = Object.values(studentsRes || {}).map((s) => {
          const u = users[s.userId] || {};
          return { userId: s.userId, name: u.name || s.name || "Student", profileImage: getProfileImage(u) };
        });

        const allParents = Object.values(parentsRes || {}).map((p) => {
          const u = users[p.userId] || {};
          return { userId: p.userId, name: u.name || p.name || "Parent", profileImage: getProfileImage(u) };
        });

        const allAdmins = Object.values(adminsRes || {}).map((a) => {
          const u = users[a.userId] || {};
          return { userId: a.userId, name: a.name || u.name || "Admin", profileImage: getProfileImage(u) };
        });

        setStudents(allStudents);
        setParents(allParents);
        setAdmins(allAdmins);
      } catch (err) {
        console.error("❌ Fetch error:", err);
      }
    };

    fetchUsers();
  }, []);

  /* ================= AUTO SELECT ================= */
  useEffect(() => {
    if (!selectedChatUser) {
      if (selectedTab === "student" && students.length) setSelectedChatUser(students[0]);
      if (selectedTab === "parent" && parents.length) setSelectedChatUser(parents[0]);
      if (selectedTab === "admin" && admins.length) setSelectedChatUser(admins[0]);
    }
  }, [selectedTab, students, parents, admins, selectedChatUser]);

  useEffect(() => {
    if (!user) return;
    if (selectedTab === "student" && students.length)
      setSelectedChatUser(students.find((s) => s.userId === user.userId) || students[0]);
    if (selectedTab === "parent" && parents.length)
      setSelectedChatUser(parents.find((p) => p.userId === user.userId) || parents[0]);
    if (selectedTab === "admin" && admins.length)
      setSelectedChatUser(admins.find((a) => a.userId === user.userId) || admins[0]);
  }, [students, parents, admins, user, selectedTab]);

  /* ================= CHAT LISTENER ================= */
  useEffect(() => {
    if (!selectedChatUser || !teacherUserId) return;

    const chatKey = getChatId(teacherUserId, selectedChatUser.userId);
    const chatRef = ref(db, `Chats/${chatKey}/messages`);

    return onValue(chatRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .filter(([_, m]) => !m.deleted)
        .map(([id, m]) => ({
          id,
          ...m,
          isTeacher: m.senderId === teacherUserId,
        }))
        .sort((a, b) => a.timeStamp - b.timeStamp);

      setMessages(list);

      // ✅ Mark as seen only if teacher is the receiver
      Object.entries(data).forEach(([id, m]) => {
        if (m && !m.seen && m.receiverId === teacherUserId) {
          update(ref(db, `Chats/${chatKey}/messages/${id}`), { seen: true }).catch(console.error);
        }
      });

      // ✅ Reset unread count
      update(ref(db, `Chats/${chatKey}/unread`), { [teacherUserId]: 0 }).catch(console.error);
    });
  }, [selectedChatUser, teacherUserId]);

  /* ================= SEND MESSAGE ================= */
 const sendMessage = async () => {
  if (!input.trim() || !selectedChatUser) return;

  const editingId = Object.keys(editingMessages).find(id => editingMessages[id]);
  const chatKey = getChatId(teacherUserId, selectedChatUser.userId);

  if (editingId) {
    // Update existing message
    await update(ref(db, `Chats/${chatKey}/messages/${editingId}`), {
      text: input,
      edited: true,
    });
    setEditingMessages({});
    setClickedMessageId(null);
    setInput("");
  } else {
    // Send new message
    const messagesRef = ref(db, `Chats/${chatKey}/messages`);
    const messageData = {
      senderId: teacherUserId,
      receiverId: selectedChatUser.userId,
      type: "text",
      text: input,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp: Date.now(),
    };

    await push(messagesRef, messageData);

    await update(ref(db, `Chats/${chatKey}/participants`), {
      [teacherUserId]: true,
      [selectedChatUser.userId]: true,
    });

    await update(ref(db, `Chats/${chatKey}/lastMessage`), {
      text: input,
      senderId: teacherUserId,
      seen: false,
      timeStamp: messageData.timeStamp,
    });

    await update(ref(db, `Chats/${chatKey}/unread`), {
      [teacherUserId]: 0,
      [selectedChatUser.userId]:
        (messages.filter((m) => !m.seen && m.senderId !== selectedChatUser.userId).length || 0) + 1,
    });

    setInput("");
  }
};


  /* ================= EDIT / DELETE ================= */
  const handleEditMessage = (id, newText) => {
    const chatKey = getChatId(teacherUserId, selectedChatUser.userId);
    update(ref(db, `Chats/${chatKey}/messages/${id}`), {
      text: newText,
      edited: true,
    }).catch(console.error);
    setEditingMessages((prev) => ({ ...prev, [id]: false }));
  };

  const handleDeleteMessage = (id) => {
    const chatKey = getChatId(teacherUserId, selectedChatUser.userId);
    update(ref(db, `Chats/${chatKey}/messages/${id}`), { deleted: true }).catch(console.error);
  };

 const startEditing = (id, text) => {
  setEditingMessages({ [id]: true });  // mark this message as being edited
  setInput(text);                     // move text to main input
  setClickedMessageId(id);            // highlight the message
};



const stopEditing = (id) => {
  setEditingMessages((prev) => ({ ...prev, [id]: false }));
  setEditTexts((prev) => ({ ...prev, [id]: "" }));
};


  const formatTime = (ts) => {
    const date = new Date(ts);
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const list = selectedTab === "student" ? students : selectedTab === "parent" ? parents : admins;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#eef2f7", fontFamily: "sans-serif" }}>
      {/* ===== SIDEBAR ===== */}
      <div style={{ width: 280, background: "#fff", padding: 16, boxShadow: "2px 0 10px rgba(0,0,0,0.1)" }}>
        <button onClick={() => navigate(-1)} style={{ border: "none", background: "none" }}>
          <FaArrowLeft size={20} />
        </button>

        <div style={{ display: "flex", gap: 6, margin: "12px 0" }}>
          {["student", "parent", "admin"].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTab(t)}
              style={{
                flex: 1,
                padding: 8,
                borderRadius: 20,
                border: "none",
                background: selectedTab === t ? "#4facfe" : "#ddd",
                color: selectedTab === t ? "#fff" : "#000",
                cursor: "pointer",
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {list.map((u) => (
          <div
            key={u.userId}
            onClick={() => setSelectedChatUser(u)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: 10,
              borderRadius: 14,
              cursor: "pointer",
              marginBottom: 8,
              background: selectedChatUser?.userId === u.userId ? "#dbeafe" : "#f9fafb",
              boxShadow: selectedChatUser?.userId === u.userId ? "0 2px 10px rgba(0,0,0,0.1)" : "none",
            }}
          >
            <img
              src={u.profileImage}
              alt={u.name}
              onError={(e) => (e.target.src = "/default-profile.png")}
              style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
            />
            <span style={{ fontWeight: 500 }}>{u.name}</span>
          </div>
        ))}
      </div>

      {/* ===== CHAT ===== */}
      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column" }}>
        {selectedChatUser ? (
          <>
            {/* ===== CHAT HEADER ===== */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom: "1px solid #ccc",
                boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                background: "#fff",
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <img
                src={selectedChatUser.profileImage}
                alt={selectedChatUser.name}
                onError={(e) => (e.target.src = "/default-profile.png")}
                style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover" }}
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{selectedChatUser.name}</span>
                <span style={{ fontSize: 12, color: "#666" }}>
                  {selectedTab.charAt(0).toUpperCase() + selectedTab.slice(1)}
                </span>
              </div>
            </div>

            {/* ===== CHAT MESSAGES ===== */}
{/* ===== CHAT MESSAGES ===== */}
<div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column" }}>
  {messages.map((m) => {
    const isEditing = !!editingMessages[m.id];
    const editText = editTexts[m.id] || m.text;
    const isClicked = clickedMessageId === m.id;

    const isTeacher = m.isTeacher;

    return (
      <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isTeacher ? "flex-end" : "flex-start", marginBottom: 10 }}>
        
        {/* Message bubble */}
        <div
          onClick={() => setClickedMessageId(m.id)}
          style={{
            maxWidth: "70%",
            background: isTeacher ? "#4facfe" : "#fff",
            color: isTeacher ? "#fff" : "#000",
            padding: "10px 14px",
            borderRadius: 18,
            borderTopRightRadius: isTeacher ? 0 : 18,
            borderTopLeftRadius: isTeacher ? 18 : 0,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            wordBreak: "break-word",
            cursor: "pointer",
            position: "relative",
          }}
        >
          
              {m.text} {m.edited && <small style={{ fontSize: 10 }}> (edited)</small>}
           
          
          {/* Time + two checkmarks (for teacher) or only time (for received) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 5,
              marginTop: 4,
              fontSize: 10,
              color: isTeacher ? "#fff" : "#888",
            }}
          >
            <span>{formatTime(m.timeStamp)}</span>
            {isTeacher && !m.deleted && (
              <span style={{ display: "flex", gap: 0 }}>
                {/* First tick = sent */}
                <FaCheck size={10} color="#f2f3f3b9" />
                {/* Second tick = seen */}
                <FaCheck size={10} color={m.seen ? "#f2f3f3b9" : "#f2f3f3b9"} />
              </span>
            )}
          </div>
        </div>

        {/* Edit/Delete buttons */}
        {isClicked && isTeacher && !m.deleted && !isEditing && (
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 4,
              fontSize: 12,
              justifyContent: isTeacher ? "flex-end" : "flex-start",
            }}
          >
            <button
              onClick={() => startEditing(m.id, m.text)}
              style={{
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid #ccc",
                cursor: "pointer",
                background: "#f1f1f1",
              }}
            >
              Edit
            </button>
            <button
              onClick={() => handleDeleteMessage(m.id)}
              style={{
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid #ccc",
                cursor: "pointer",
                background: "#f1f1f1",
                color: "red",
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    );
  })}
  <div ref={chatEndRef} />
</div>



            {/* ===== INPUT ===== */}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message..."
                style={{ flex: 1, padding: 12, borderRadius: 25, border: "1px solid #ccc", outline: "none" }}
              />
              <button
                onClick={sendMessage}
                style={{
                  width: 45,
                  height: 45,
                  borderRadius: "50%",
                  background: "#4facfe",
                  border: "none",
                  color: "#fff",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <FaPaperPlane />
              </button>
            </div>
          </>
        ) : (
          <h3 style={{ textAlign: "center", marginTop: 50 }}>Select a user to start chatting 💬</h3>
        )}
      </div>
    </div>
  );
}
