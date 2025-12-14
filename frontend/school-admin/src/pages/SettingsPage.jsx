import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaBell,  FaSearch  } from "react-icons/fa";
import axios from "axios";
import useDarkMode from "../hooks/useDarkMode";

function SettingsPage() {
  const [admin, setAdmin] = useState(JSON.parse(localStorage.getItem("admin")) || {});
  const [selectedFile, setSelectedFile] = useState(null);
  const [profileImage, setProfileImage] = useState(admin.profileImage || "/default-profile.png");
    const [darkMode, toggleDarkMode] = useDarkMode();

  const [name, setName] = useState(admin.name || "");
  const [username, setUsername] = useState(admin.username || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  
  

  const handleFileChange = (e) => setSelectedFile(e.target.files[0]);

  const handleProfileSubmit = async () => {
    if (!selectedFile) return alert("Select an image first.");
    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onloadend = async () => {
        const base64Image = reader.result;
        await axios.patch(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${admin.userId}.json`,
          { profileImage: base64Image }
        );
        const updatedAdmin = { ...admin, profileImage: base64Image };
        localStorage.setItem("admin", JSON.stringify(updatedAdmin));
        setProfileImage(base64Image);
        setSelectedFile(null);
        alert("Profile image updated!");
      };
    } catch (err) {
      console.error("Error updating profile image:", err);
    }
  };

  const handleInfoUpdate = async () => {
    if (!name || !username) return alert("Name and Username required!");
    try {
      await axios.patch(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${admin.userId}.json`,
        { name, username }
      );
      const updatedAdmin = { ...admin, name, username };
      localStorage.setItem("admin", JSON.stringify(updatedAdmin));
      setAdmin(updatedAdmin);
      alert("Profile info updated!");
    } catch (err) {
      console.error("Error updating info:", err);
    }
  };

  const handlePasswordChange = async () => {
    if (!password || !confirmPassword) return alert("Fill both password fields.");
    if (password !== confirmPassword) return alert("Passwords do not match!");
    try {
      await axios.patch(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users/${admin.userId}.json`,
        { password }
      );
      setPassword("");
      setConfirmPassword("");
      alert("Password updated successfully!");
    } catch (err) {
      console.error("Error updating password:", err);
    }
  };

  return (
    <div className="dashboard-page">
     
     {/* ---------------- TOP NAVIGATION BAR ---------------- */}
     <nav className="top-navbar">
       <h2>Gojo Dashboard</h2>
     
       {/* Search Bar */}
       <div className="nav-search">
         <FaSearch className="search-icon" />
         <input type="text" placeholder="Search Teacher and Student..." />
       </div>
     
       <div className="nav-right">
         {/* Notification */}
         <div className="icon-circle">
           <FaBell />
         </div>
     
         {/* Settings */}
         <div className="icon-circle">
           <FaCog />
         </div>
     
         {/* Profile */}
         <img
           src={admin.profileImage || "/default-profile.png"}
           alt="admin"
           className="profile-img"
         />
         {/* <span>{admin.name}</span> */}
       </div>
     </nav>
     
     
     
     

      <div className="google-dashboard" style={{ background: darkMode ? "#2c2c2c" : "#f1f1f1" }}>
        {/* SIDEBAR */}
        <div className="google-sidebar" style={{ background: darkMode ? "#1a1a1a" : "#fff" }}>
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
            <Link className="sidebar-btn" to="/settings" style={{ background: "#4b6cb7", color: "#fff" }}><FaCog /> Settings</Link>
            <button
              className="sidebar-btn logout-btn"
              onClick={() => {
                localStorage.removeItem("admin");
                window.location.href = "/login";
              }}
            >
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div
          className="main-content"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "50px",
            width: "100%",
            gap: "30px",
          }}
        >
          <h2>Settings</h2>

          {/* Profile Image */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "30px",
            borderRadius: "12px",
            background: darkMode ? "#3a3a3a" : "#fff",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
          }}>
            <img
              src={profileImage}
              alt="profile"
              style={{ width: "150px", height: "150px", borderRadius: "50%", objectFit: "cover", marginBottom: "15px", border: "3px solid #4b6cb7" }}
            />
            <input type="file" onChange={handleFileChange} />
            <button onClick={handleProfileSubmit} style={{ marginTop: "15px", padding: "10px 20px", borderRadius: "8px", border: "none", background: "#4b6cb7", color: "#fff", cursor: "pointer" }}>
              Update Profile Image
            </button>
          </div>

          {/* Name / Username */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "30px",
            borderRadius: "12px",
            background: darkMode ? "#3a3a3a" : "#fff",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
          }}>
            <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
            <button onClick={handleInfoUpdate} style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#4b6cb7", color: "#fff", cursor: "pointer" }}>Update Info</button>
          </div>

          {/* Password */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "30px",
            borderRadius: "12px",
            background: darkMode ? "#3a3a3a" : "#fff",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
          }}>
            <input type="password" placeholder="New Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
            <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
            <button onClick={handlePasswordChange} style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#4b6cb7", color: "#fff", cursor: "pointer" }}>Change Password</button>
          </div>

          {/* Dark Mode */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
            padding: "20px",
            borderRadius: "12px",
            background: darkMode ? "#3a3a3a" : "#fff",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
          }}>
            <label style={{ fontSize: "18px", fontWeight: "500" }}>Dark Mode</label>
            <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
