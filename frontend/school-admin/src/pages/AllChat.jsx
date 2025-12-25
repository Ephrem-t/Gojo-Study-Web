import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPaperPlane, FaTrash, FaEdit, FaSearch } from "react-icons/fa";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, update, set } from "firebase/database";
import "../styles/global.css"; // we will add CSS animations here

// ------------------- Firebase Config -------------------
const firebaseConfig = {
  apiKey: "AIzaSyCMkZr4Xz204NjvETje-Rhznf6ECDYiEnE",
  authDomain: "ethiostore-17d9f.firebaseapp.com",
  databaseURL: "https://ethiostore-17d9f-default-rtdb.firebaseio.com",
  projectId: "ethiostore-17d9f",
  storageBucket: "ethiostore-17d9f.appspot.com",
  messagingSenderId: "964518277159",
  appId: "1:964518277159:web:9404cace890edf88961e02"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function AllChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedUser = location.state?.user || null;

  const [popupMessages, setPopupMessages] = useState([]);
  const [popupInput, setPopupInput] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [selectedTab, setSelectedTab] = useState("teacher");
  const [selectedChatUser, setSelectedChatUser] = useState(selectedUser);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [typing, setTyping] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const admin = JSON.parse(localStorage.getItem("admin")) || {};
  const adminUserId = admin.userId;

  const chatEndRef = useRef(null);
  const typingRef = useRef(null);
  const messageRefs = useRef({});


  // ------------------- Fetch users -------------------
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [teachersRes, studentsRes, parentsRes, usersRes, chatsRes] = await Promise.all([
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json").then(res => res.json()),
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json").then(res => res.json()),
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Parents.json").then(res => res.json()),
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json").then(res => res.json()),
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats.json").then(res => res.json())
        ]);

        const usersData = usersRes || {};
        const chatsData = chatsRes || {};

        const formatUsers = (listData) => Object.keys(listData || {})
          .map((id) => {
            const userId = listData[id].userId;
            const user = usersData[userId] || {};
            const chatKey = `${userId}_${adminUserId}`;
            const messages = chatsData[chatKey] ? Object.values(chatsData[chatKey].messages || {}) : [];
            const lastMsg = messages.length > 0 ? messages.sort((a, b) => b.timeStamp - a.timeStamp)[0] : null;
            return {
              id,
              userId,
              name: user.name || "No Name",
              profileImage: user.profileImage || "/default-profile.png",
              lastMsgTime: lastMsg ? lastMsg.timeStamp : 0,
              lastMsgText: lastMsg ? lastMsg.text : "",
              lastSeen: user.lastSeen || null
            };
          })
          .sort((a, b) => b.lastMsgTime - a.lastMsgTime);

        setTeachers(formatUsers(teachersRes));
        setStudents(formatUsers(studentsRes));
        setParents(formatUsers(parentsRes));
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    fetchUsers();
  }, [adminUserId]);

  // ------------------- Real-time messages -------------------
  useEffect(() => {
    if (!selectedChatUser) return;
    const chatKey = `${selectedChatUser.userId}_${adminUserId}`;
    const chatRef = ref(db, `Chats/${chatKey}/messages`);

    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      const msgs = data
  ? Object.entries(data).map(([id, m]) => ({
      ...m,
      id,
      timeStamp: Number(m.timeStamp) || null,
      sender: m.senderId === adminUserId ? "admin" : "user",
    }))
  : [];

      setPopupMessages(msgs.sort((a, b) => a.timeStamp - b.timeStamp));
    });

    const typingStatusRef = ref(db, `Chats/${chatKey}/typing`);
    const unsubscribeTyping = onValue(typingStatusRef, (snapshot) => {
      const val = snapshot.val();
      setTyping(val && val.userId === selectedChatUser.userId);
    });

    const lastSeenRef = ref(db, `Users/${selectedChatUser.userId}/lastSeen`);
    const unsubscribeLastSeen = onValue(lastSeenRef, (snapshot) => {
      setLastSeen(snapshot.val());
    });

    return () => {
      unsubscribe();
      unsubscribeTyping();
      unsubscribeLastSeen();
    };
  }, [selectedChatUser, adminUserId]);

  // ------------------- Send/Edit message -------------------
 const sendPopupMessage = async () => {
  if (!popupInput.trim()) return;
  const chatKey = `${selectedChatUser.userId}_${adminUserId}`;

  if (editingMsgId) {
    // Edit existing message
    await update(ref(db, `Chats/${chatKey}/messages/${editingMsgId}`), {
      text: popupInput,
      edited: true
    });
    setEditingMsgId(null); // reset editing state
  } else {
    // New message
    await push(ref(db, `Chats/${chatKey}/messages`), {
      senderId: adminUserId,
      receiverId: selectedChatUser.userId,
      text: popupInput,
      timeStamp: Date.now(),
      seen: false,
      edited: false,
      deleted: false
    });
  }

  setPopupInput("");
};


  // ------------------- Delete message -------------------
  const deleteMessage = async (msgId) => {
    if (!selectedChatUser) return;
    const chatKey = `${selectedChatUser.userId}_${adminUserId}`;
    const delRef = ref(db, `Chats/${chatKey}/messages/${msgId}`);
    await update(delRef, { deleted: true });
  };

  // ------------------- Typing -------------------
  const handleTyping = async (e) => {
    setPopupInput(e.target.value);
    if (!selectedChatUser) return;
    const chatKey = `${selectedChatUser.userId}_${adminUserId}`;
    const typingStatusRef = ref(db, `Chats/${chatKey}/typing`);
    await set(typingStatusRef, { userId: adminUserId });
    if (typingRef.current) clearTimeout(typingRef.current);
    typingRef.current = setTimeout(async () => {
      await set(typingStatusRef, { userId: null });
    }, 2000);
  };

  // ------------------- Scroll to bottom -------------------
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [popupMessages, typing]);

const formatTime = (timestamp) => {
  if (!timestamp || isNaN(timestamp)) return "";
  const date = new Date(Number(timestamp));
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

  const chatBubbleStyle = (isAdmin) => ({
    maxWidth: "70%",
    padding: "12px 16px",
    borderRadius: "20px",
    background: isAdmin ? "linear-gradient(135deg, #0084ff, #006bbf)" : "#e4e6eb",
    color: isAdmin ? "#fff" : "#050505",
    wordBreak: "break-word",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    marginBottom: "12px",
    opacity: 0,
    transform: "translateY(20px)",
    animation: "slideIn 0.3s forwards"
  });

  const chatContainerStyle = {
    flex: 1,
    overflowY: "auto",
    padding: "15px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    background: "#e5ddd5",
    borderRadius: "10px"
  };

  const renderUserList = (users) =>
    users
      .filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .map((u) => (
        <div key={u.userId} onClick={() => setSelectedChatUser(u)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", borderRadius: "8px", background: selectedChatUser?.userId === u.userId ? "#d0e6ff" : "#fff", cursor: "pointer", marginBottom: "8px", transition: "0.2s all" }}>
          <img src={u.profileImage} alt={u.name} style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: "500" }}>{u.name}</div>
            <div style={{ fontSize: "12px", color: "#888" }}>{u.lastMsgText?.slice(0, 30)}...</div>
          </div>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: u.lastSeen && Date.now() - u.lastSeen < 60000 ? "green" : "gray" }} />
        </div>
      ));

  return (
    <div style={{ display: "flex", height: "100vh", background: "#e5ddd5" }}>
      {/* Sidebar */}
      <div style={{ width: "300px", background: "#fff", borderRight: "1px solid #ddd", overflowY: "auto", padding: "15px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "15px" }}>
          <button onClick={() => navigate(-1)} style={{ background: "#0084ff", color: "#fff", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", marginRight: "10px" }}><FaArrowLeft /></button>
          <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "20px", border: "1px solid #ccc", outline: "none" }} />
        </div>

        <div style={{ display: "flex", marginBottom: "15px", gap: "5px" }}>
          {["teacher", "student", "parent"].map(tab => (
            <button key={tab} onClick={() => setSelectedTab(tab)} style={{ flex: 1, padding: "8px", borderRadius: "20px", border: "none", cursor: "pointer", background: selectedTab === tab ? "#0084ff" : "#f0f0f0", color: selectedTab === tab ? "#fff" : "#000" }}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
          ))}
        </div>

        {selectedTab === "teacher" && renderUserList(teachers)}
        {selectedTab === "student" && renderUserList(students)}
        {selectedTab === "parent" && renderUserList(parents)}
      </div>

      {/* Chat Box */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "15px" }}>
        {selectedChatUser ? (
          <>
            <div style={{ padding: "10px", borderBottom: "1px solid #ddd", display: "flex", alignItems: "center", gap: "10px", background: "#f0f2f5", borderRadius: "10px", marginBottom: "10px" }}>
              <img src={selectedChatUser.profileImage} alt={selectedChatUser.name} style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
              <div>
                <strong>{selectedChatUser.name}</strong>
                <div style={{ fontSize: "12px", color: "#666" }}>{typing ? "Typing..." : lastSeen ? `Last seen: ${new Date(lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</div>
              </div>
            </div>

            <div style={chatContainerStyle}>
              {popupMessages.length === 0 ? (
                <p style={{ color: "#888", textAlign: "center", marginTop: "20px" }}>Start chatting with {selectedChatUser.name}...</p>
              ) : popupMessages.map(m => {
                  const isAdmin = m.sender === "admin";
  const isSelected = activeMessageId === m.id;

  return (
    <div key={m.id} style={{ marginBottom: 12, display: "flex", flexDirection: "column", alignItems: isAdmin ? "flex-end" : "flex-start" }}>
  {/* Only show message if not deleted */}
  {!m.deleted && (
    <>
      {/* Message Bubble */}
      <div
        data-id={m.id}
        ref={el => (messageRefs.current[m.id] = el)}
        onClick={() => setActiveMessageId(m.id)} // select message
        style={{
          background: isAdmin ? "#0084ff" : "#e4e6eb",
          color: isAdmin ? "#fff" : "#000",
          padding: "8px 12px",
          borderRadius: 16,
          borderTopRightRadius: isAdmin ? 0 : 16, // tail effect
          borderTopLeftRadius: isAdmin ? 16 : 0,  // tail effect
          maxWidth: "45%",
          cursor: "pointer",
          marginBottom: 4,
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          wordBreak: "break-word",
          transition: "all 0.2s"
        }}
      >
        {/* Message Text */}
        <div>{m.text}</div>

        {/* Edited Label */}
        {m.edited && (
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>edited</div>
        )}

        {/* Time + Seen */}
        <div
          style={{
            fontSize: 10,
            opacity: 0.7,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 6,
            marginTop: 4
          }}
        >
          <span>{formatTime(m.timeStamp)}</span>
          {isAdmin && <span>{m.seen ? "✔✔" : "✔"}</span>}
        </div>
      </div>

      {/* Edit/Delete Buttons (Only for Admin and Selected) */}
      {isSelected && isAdmin && (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 6,
              border: "none",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              cursor: "pointer",
              color: "#0084ff",
              transition: "all 0.2s"
            }}
            onClick={(e) => {
              e.stopPropagation();
              setPopupInput(m.text); // edit message in input
              setEditingMsgId(m.id);
            }}
          >
            Edit
          </button>
          <button
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 6,
              border: "none",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              cursor: "pointer",
              color: "#ff3b30",
              transition: "all 0.2s"
            }}
            onClick={async (e) => {
              e.stopPropagation();
              const confirmDelete = window.confirm("Delete this message?");
              if (confirmDelete) {
                await update(
                  ref(db, `Chats/${selectedChatUser.userId}_${adminUserId}/messages/${m.id}`),
                  { deleted: true }
                );
              }
            }}
          >
            Delete
          </button>
        </div>
      )}
    </>
  )}
</div>


  );
              })}
              <div ref={chatEndRef}></div>
            </div>

            {/* Input Bar */}
            <div style={{ display: "flex", gap: "8px", paddingTop: "10px", borderTop: "1px solid #ddd" }}>
              <input value={popupInput} onChange={handleTyping} onKeyDown={e => e.key === "Enter" && sendPopupMessage()} placeholder="Type a message..." style={{ flex: 1, padding: "12px 16px", borderRadius: "30px", border: "1px solid #ccc", outline: "none", background: "#fff" }} />
              <button onClick={sendPopupMessage} style={{ background: "#0084ff", border: "none", color: "#fff", borderRadius: "50%", width: "45px", height: "45px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer", boxShadow: "0 2px 5px rgba(0,0,0,0.2)" }}>
                <FaPaperPlane />
              </button>
            </div>
          </>
        ) : <p style={{ color: "#555", textAlign: "center", marginTop: "50%" }}>Select a user to start chatting...</p>}
      </div>
    </div>
  );
}

export default AllChat;
